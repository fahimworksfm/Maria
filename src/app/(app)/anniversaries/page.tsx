import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

type Row = { id: string; name: string; on_date: string; kind: string; recurring: boolean };

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
    .select("id, name, on_date, kind, recurring")
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
    await supabase.from("anniversaries").insert({
      couple_id: me.coupleId,
      name,
      on_date,
      kind: (formData.get("kind") as string) || "anniversary",
      recurring: formData.get("recurring") === "on",
    });
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

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Anniversary Compass</h1><p className="muted">Every date that matters, with the days left.</p></header>

      <form action={add} className="card p-4 space-y-2">
        <input className="input" name="name" placeholder="What is it? (e.g. our first kiss)" required />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" name="on_date" type="date" required />
          <select className="input" name="kind" defaultValue="anniversary">
            <option value="anniversary">Anniversary</option>
            <option value="milestone">Milestone</option>
            <option value="custom">Other</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="recurring" defaultChecked /> Repeats every year
        </label>
        <button className="btn btn-primary w-full" type="submit">Add</button>
      </form>

      <section className="space-y-2">
        {(all as Array<Row & { _next: Date }>).map((r) => {
          const d = daysUntil(r._next);
          const tone = d === 0 ? "Today" : d === 1 ? "Tomorrow" : d < 0 ? `${-d} days ago` : `${d} days`;
          return (
            <div key={r.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="muted text-xs">{r._next.toDateString()} · <span className="pill">{r.kind}</span></div>
              </div>
              <div className="text-right">
                <div className={`font-display text-2xl ${d === 0 ? "headline-gradient" : ""}`}>{tone}</div>
                {!r.id.startsWith("bday-") && (
                  <form action={remove}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost text-xs" type="submit">Delete</button></form>
                )}
              </div>
            </div>
          );
        })}
        {all.length === 0 && <p className="muted">No dates yet. Add your first.</p>}
      </section>
    </div>
  );
}
