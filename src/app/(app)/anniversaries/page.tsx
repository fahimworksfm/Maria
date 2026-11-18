import { ClaimForm } from "@/components/ClaimButtons";
import { CalendarHeart } from "lucide-react";
import { claimRow, insertAuthored, isClaimWho, partnerNameFor, sideClass, sideName, sideOf } from "@/lib/authorship";
import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import SubmitButton from "@/components/SubmitButton";

type Row = { id: string; name: string; on_date: string; kind: string; recurring: boolean; author_id?: string | null };

function nextOccurrence(on: string, recurring: boolean): Date {
  const [y, m, d] = on.split("-").map(Number);
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), m! - 1, d!);
  if (!recurring) return new Date(y!, m! - 1, d!);
  return thisYear >= startOfDay(now) ? thisYear : new Date(now.getFullYear() + 1, m! - 1, d!);
}
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function daysUntil(target: Date) {
  const now = startOfDay(new Date()).getTime();
  return Math.round((startOfDay(target).getTime() - now) / 86_400_000);
}

export default async function AnniversariesPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("anniversaries")
    .select("*") // includes author_id once migration 0014 has run
    .eq("couple_id", me.coupleId);

  // Auto-include each user's birthday from profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, birthday");
  const synth: Row[] = (profiles ?? [])
    .filter((p): p is { user_id: string; display_name: string | null; birthday: string } => Boolean(p.birthday))
    .map((p) => ({
      id: `bday-${p.user_id}`,
      name: `${p.display_name ?? "Birthday"}'s birthday`,
      on_date: p.birthday,
      kind: "birthday",
      recurring: true,
    }));

  const all: Row[] = [...(rows ?? []), ...synth]
    .map((r) => ({ ...r, _next: nextOccurrence(r.on_date, r.recurring) }))
    .sort((a, b) => a._next.getTime() - b._next.getTime());

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const name = String(formData.get("name") || "").trim();
    const on_date = String(formData.get("on_date") || "");
    if (!name || !on_date) return;
    await insertAuthored(supabase, "anniversaries", {
      couple_id: me.coupleId,
      name,
      on_date,
      kind: (formData.get("kind") as string) || "anniversary",
      recurring: formData.get("recurring") === "on",
    }, me.userId);
    revalidatePath("/anniversaries");
  }

  async function remove(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    if (id.startsWith("bday-")) return;
    const supabase = await supabaseServer();
    await supabase.from("anniversaries").delete().eq("id", id);
    revalidatePath("/anniversaries");
  }

  async function update(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    const on_date = String(formData.get("on_date") || "");
    const kind = String(formData.get("kind") || "anniversary");
    // Birthdays come from each profile, not this table.
    if (!id || id.startsWith("bday-") || !name || !on_date) return;
    if (!["anniversary", "milestone", "custom"].includes(kind)) return;
    const supabase = await supabaseServer();
    await supabase
      .from("anniversaries")
      .update({ name, on_date, kind, recurring: formData.get("recurring") === "on" })
      .eq("id", id)
      .eq("couple_id", me.coupleId);
    revalidatePath("/anniversaries");
  }

  async function claim(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const who = formData.get("who");
    const id = String(formData.get("id") || "");
    if (!isClaimWho(who) || id.startsWith("bday-")) return;
    const supabase = await supabaseServer();
    await claimRow(supabase, "anniversaries", id, who, me);
    revalidatePath("/anniversaries");
  }

  const partnerName = await partnerNameFor(supabase, me.userId);
  const side = (a: unknown) => sideOf(a, me.userId);
  const who = (a: unknown) => sideName(side(a), partnerName);

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Anniversary Compass</h1><p className="muted">Every date that matters, with the days left.</p></header>

      <form action={add} className="card p-4 space-y-2">
        <input className="input" name="name" placeholder="What is it? (e.g. our first kiss)" aria-label="What is it?" required />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" name="on_date" type="date" aria-label="Date" required />
          <select className="input" name="kind" aria-label="Kind" defaultValue="anniversary">
            <option value="anniversary">Anniversary</option>
            <option value="milestone">Milestone</option>
            <option value="custom">Other</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-[15px] min-h-[44px]">
          <input type="checkbox" name="recurring" defaultChecked /> Repeats every year
        </label>
        <SubmitButton className="btn btn-primary w-full">Add</SubmitButton>
      </form>

      <section className="space-y-2">
        {(all as Array<Row & { _next: Date }>).map((r) => {
          const d = daysUntil(r._next);
          const tone = d === 0 ? "Today" : d === 1 ? "Tomorrow" : d < 0 ? `${-d} days ago` : `${d} days`;
          const real = !r.id.startsWith("bday-");
          return (
            <div key={r.id} className={`card px-4 py-3 ${sideClass(side(r.author_id))}`}>
             <div className="flex items-center justify-between gap-3">
              <div>
                {who(r.author_id) && <div className="text-xs text-muted mb-0.5">{who(r.author_id)}</div>}
                <div className="font-semibold">{r.name}</div>
                <div className="text-muted text-[13px] flex items-center gap-1.5 flex-wrap mt-0.5">{r._next.toDateString()} <span className="pill">{r.kind}</span></div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-bold text-xl tabular-nums ${d === 0 ? "text-accentInk" : ""}`}>{tone}</div>
                {real && (
                  <form action={remove}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost text-sm" type="submit">Delete</button></form>
                )}
              </div>
             </div>
              {real && !r.author_id && <ClaimForm action={claim} id={r.id} partnerName={partnerName} />}
              {real && (
                <details>
                  <summary className="inline-flex items-center min-h-[44px] px-1 text-[13px] font-semibold text-muted cursor-pointer select-none hover:text-ink">Edit</summary>
                  <form action={update} className="space-y-2 pb-1">
                    <input type="hidden" name="id" value={r.id} />
                    <div>
                      <label className="label" htmlFor={`ann-name-${r.id}`}>What is it?</label>
                      <input id={`ann-name-${r.id}`} className="input" name="name" defaultValue={r.name} required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label" htmlFor={`ann-date-${r.id}`}>Date</label>
                        <input id={`ann-date-${r.id}`} className="input" name="on_date" type="date" defaultValue={r.on_date.slice(0, 10)} required />
                      </div>
                      <div>
                        <label className="label" htmlFor={`ann-kind-${r.id}`}>Kind</label>
                        <select id={`ann-kind-${r.id}`} className="input" name="kind" defaultValue={["anniversary", "milestone", "custom"].includes(r.kind) ? r.kind : "custom"}>
                          <option value="anniversary">Anniversary</option>
                          <option value="milestone">Milestone</option>
                          <option value="custom">Other</option>
                        </select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[15px] min-h-[44px]">
                      <input type="checkbox" name="recurring" defaultChecked={r.recurring} /> Repeats every year
                    </label>
                    <SubmitButton className="btn w-full">Save changes</SubmitButton>
                  </form>
                </details>
              )}
            </div>
          );
        })}
        {all.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><CalendarHeart size={22} aria-hidden /></div>
            <p className="font-bold text-lg pt-2">No dates yet.</p>
            <p className="muted">Name the date in the form above and tap Add. Tether counts the days for you.</p>
            <p className="text-muted text-[13px]">For example: the day you met, or your first trip together.</p>
          </div>
        )}
      </section>
    </div>
  );
}
