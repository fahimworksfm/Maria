import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

const MOODS = ["😞", "😕", "🙂", "😊", "🤩"];

export default async function MoodPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  // Own history
  const { data: mine } = await supabase
    .from("mood_checkins")
    .select("on_date, mood, note, share_with_partner")
    .eq("user_id", me.userId)
    .order("on_date", { ascending: false })
    .limit(30);

  // Partner's shared check-ins
  const { data: theirs } = await supabase
    .from("mood_checkins")
    .select("on_date, mood, note, user_id")
    .neq("user_id", me.userId)
    .order("on_date", { ascending: false })
    .limit(30);

  const todayMine = (mine ?? []).find((m) => m.on_date === today);

  async function save(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const mood = Number(formData.get("mood"));
    if (!Number.isFinite(mood) || mood < 1 || mood > 5) return;
    await supabase
      .from("mood_checkins")
      .upsert(
        {
          user_id: me.userId,
          couple_id: me.coupleId,
          on_date: new Date().toISOString().slice(0, 10),
          mood,
          note: String(formData.get("note") || "").trim() || null,
          share_with_partner: formData.get("share") === "on",
        },
        { onConflict: "user_id,on_date" }
      );
    revalidatePath("/mood");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Mood</h1>
        <p className="muted">A tap for today.</p>
      </header>

      <form action={save} className="card p-5 space-y-3">
        <div className="grid grid-cols-5 gap-2">
          {MOODS.map((emoji, i) => (
            <label key={i} className="cursor-pointer">
              <input type="radio" name="mood" value={i + 1} defaultChecked={todayMine?.mood === i + 1} className="peer sr-only" />
              <div className="text-3xl text-center py-3 rounded-lg border border-line bg-panel2 peer-checked:bg-accent peer-checked:text-bg">{emoji}</div>
            </label>
          ))}
        </div>
        <textarea className="input" name="note" rows={2} placeholder="A line about today (optional)" defaultValue={todayMine?.note ?? ""} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="share" defaultChecked={todayMine?.share_with_partner ?? true} />
          Share with partner
        </label>
        <button className="btn btn-primary w-full" type="submit">Save</button>
      </form>

      <section>
        <h3 className="label">Your last 30 days</h3>
        <Strip rows={mine ?? []} />
      </section>

      <section>
        <h3 className="label">Partner&apos;s recent (only what they shared)</h3>
        {theirs && theirs.length > 0 ? (
          <Strip rows={theirs} />
        ) : (
          <p className="muted">Nothing shared yet.</p>
        )}
      </section>
    </div>
  );
}

function Strip({ rows }: { rows: Array<{ on_date: string; mood: number; note?: string | null }> }) {
  return (
    <div className="card p-3 space-y-2">
      <div className="flex gap-1 overflow-x-auto">
        {rows.slice().reverse().map((r) => (
          <div key={r.on_date} className="text-center" title={`${r.on_date} ${r.note ?? ""}`}>
            <div className="text-xl">{MOODS[r.mood - 1]}</div>
            <div className="muted text-[10px]">{r.on_date.slice(5)}</div>
          </div>
        ))}
      </div>
      <ul className="space-y-1 text-sm">
        {rows.slice(0, 5).map((r) => (
          <li key={r.on_date} className="flex justify-between gap-2">
            <span>{r.on_date} {MOODS[r.mood - 1]}</span>
            <span className="muted truncate">{r.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
