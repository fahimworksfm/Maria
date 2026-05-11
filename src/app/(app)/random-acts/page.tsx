import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chatJson } from "@/lib/groq";

function weekOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0, 10);
}

export default async function RandomActsPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const thisWeek = weekOf(new Date());

  const { data: rows } = await supabase
    .from("random_acts")
    .select("id, week_of, for_user, act, done, ai_generated, created_at")
    .eq("couple_id", me.coupleId)
    .order("week_of", { ascending: false })
    .order("created_at", { ascending: true });

  const { data: partner } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();

  async function generate() {
    "use server";
    if (!aiEnabled()) return;
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const week = weekOf(new Date());
    const { data: partner } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .neq("user_id", me.userId)
      .limit(1)
      .maybeSingle();
    if (!partner?.user_id) return;
    const { data: existing } = await supabase
      .from("random_acts")
      .select("id")
      .eq("couple_id", me.coupleId)
      .eq("week_of", week);
    if (existing && existing.length > 0) return; // already generated this week

    type Gen = { acts: Array<{ for: "me" | "partner"; act: string }> };
    const out = await chatJson<Gen>({
      system:
        "Generate 6 tiny acts of love for a couple to do this week. Output strict JSON {\"acts\":[{\"for\":\"me\"|\"partner\",\"act\":string}]}. Three for each. Each act is one specific small thing under 16 words. Mix surprise, service, words, presence. Never cheesy.",
      user: "Make each one a concrete action with a small twist, not a category.",
      maxTokens: 600,
    });
    const rows = (out.acts ?? []).slice(0, 6).map((a) => ({
      couple_id: me.coupleId,
      week_of: week,
      for_user: a.for === "me" ? me.userId : partner.user_id,
      act: String(a.act).slice(0, 220),
      ai_generated: true,
    }));
    if (rows.length) await supabase.from("random_acts").insert(rows);
    revalidatePath("/random-acts");
  }

  async function toggleDone(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    const { data } = await supabase.from("random_acts").select("done").eq("id", id).single();
    if (!data) return;
    await supabase.from("random_acts").update({ done: !data.done }).eq("id", id);
    revalidatePath("/random-acts");
  }

  async function addCustom(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const act = String(formData.get("act") || "").trim();
    const target = (formData.get("target") as string) || "partner";
    const { data: partner } = await supabase
      .from("profiles")
      .select("user_id")
      .neq("user_id", me.userId)
      .limit(1)
      .maybeSingle();
    const for_user = target === "me" ? me.userId : (partner?.user_id ?? me.userId);
    if (!act) return;
    await supabase.from("random_acts").insert({
      couple_id: me.coupleId,
      week_of: weekOf(new Date()),
      for_user,
      act,
      ai_generated: false,
    });
    revalidatePath("/random-acts");
  }

  const partnerName = partner?.display_name ?? "your partner";
  const groups = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    if (!groups.has(r.week_of)) groups.set(r.week_of, []);
    groups.get(r.week_of)!.push(r);
  }
  const thisWeekItems = groups.get(thisWeek) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Random Acts</h1>
        <p className="muted">Six tiny love-acts a week. Three for each of you.</p>
      </header>

      <section className="card p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="label">This week ({thisWeek})</h3>
          {thisWeekItems.length === 0 && (
            <form action={generate}>
              <button className="btn btn-primary text-sm" type="submit" disabled={!aiEnabled()}>
                {aiEnabled() ? "Generate with AI" : "Set GROQ_API_KEY"}
              </button>
            </form>
          )}
        </div>
        {thisWeekItems.length === 0 && <p className="muted text-sm">No acts yet. Generate or add a custom one below.</p>}
        <ul className="space-y-2">
          {thisWeekItems.map((a) => (
            <li key={a.id} className={`bg-panel2 border border-line rounded-lg p-3 flex items-center justify-between gap-3 ${a.done ? "opacity-60 line-through" : ""}`}>
              <div className="text-sm">
                <span className="pill mr-2">{a.for_user === me.userId ? "for you" : `for ${partnerName}`}</span>
                {a.act}
              </div>
              <form action={toggleDone}><input type="hidden" name="id" value={a.id} /><button className="btn btn-ghost text-xs" type="submit">{a.done ? "Undo" : "Done"}</button></form>
            </li>
          ))}
        </ul>
        <form action={addCustom} className="space-y-2 pt-2">
          <input className="input" name="act" placeholder="Add a custom act" required />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" name="target" defaultValue="partner">
              <option value="partner">For my partner</option>
              <option value="me">For me</option>
            </select>
            <button className="btn" type="submit">Add</button>
          </div>
        </form>
      </section>

      <section>
        <h3 className="label">Past weeks</h3>
        {Array.from(groups.entries()).filter(([w]) => w !== thisWeek).map(([w, items]) => (
          <div key={w} className="card p-3 mt-2">
            <div className="muted text-xs mb-1">Week of {w}</div>
            <ul className="text-sm space-y-1">
              {items!.map((a) => (
                <li key={a.id} className={a.done ? "opacity-70 line-through" : ""}>
                  {a.done ? "✓" : "○"} {a.act}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
