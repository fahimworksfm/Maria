import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MoodForm from "@/components/MoodForm";
import { applyMoodSignal, clearTodaySignal, readMoodPrefs } from "@/lib/mood-signal";

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

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("prefs")
    .eq("user_id", me.userId)
    .single();
  const moodPrefs = readMoodPrefs(ownProfile?.prefs);

  async function save(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const mood = Number(formData.get("mood"));
    if (!Number.isFinite(mood) || mood < 1 || mood > 5) return;
    const onDate = new Date().toISOString().slice(0, 10);
    await supabase
      .from("mood_checkins")
      .upsert(
        {
          user_id: me.userId,
          couple_id: me.coupleId,
          on_date: onDate,
          mood,
          note: String(formData.get("note") || "").trim() || null,
          share_with_partner: formData.get("share") === "on",
        },
        { onConflict: "user_id,on_date" }
      );
    // Empathy loop: keep the partner-visible "heavy day" signal in sync.
    await applyMoodSignal(supabase, { userId: me.userId, coupleId: me.coupleId, mood, onDate });
    revalidatePath("/mood");
  }

  async function saveMoodPrefs(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const moodSignal = formData.get("mood_signal") === "on";
    const shareScore = formData.get("mood_share_score") === "on";
    const { data: prof } = await supabase
      .from("profiles")
      .select("prefs")
      .eq("user_id", me.userId)
      .single();
    const prefs = { ...((prof?.prefs as Record<string, unknown>) ?? {}), mood_signal: moodSignal, mood_share_score: shareScore };
    await supabase.from("profiles").update({ prefs }).eq("user_id", me.userId);
    // If they just turned the nudge off, retract today's signal immediately.
    if (!moodSignal) {
      await clearTodaySignal(supabase, me.userId, new Date().toISOString().slice(0, 10));
    }
    revalidatePath("/mood");
  }

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="mood_checkins" coupleId={me.coupleId} />
      <header>
        <h1 className="h1">Mood</h1>
        <p className="muted">A tap for today.</p>
      </header>

      <MoodForm
        action={save}
        initialMood={todayMine?.mood ?? null}
        initialNote={todayMine?.note ?? ""}
        initialShare={todayMine?.share_with_partner ?? true}
      />

      <form action={saveMoodPrefs} className="card p-4 space-y-3">
        <h3 className="label">When you&apos;re having a heavy day</h3>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="mood_signal" defaultChecked={moodPrefs.mood_signal} className="mt-0.5" />
          <span>
            Let your partner know
            <span className="muted block text-xs">They&apos;ll see a gentle &quot;heavy day&quot; nudge so they can reach out — never a guilt trip.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="mood_share_score" defaultChecked={moodPrefs.mood_share_score} className="mt-0.5" />
          <span>
            Include my exact mood
            <span className="muted block text-xs">Off by default — they&apos;ll know it&apos;s a low day without seeing the number.</span>
          </span>
        </label>
        <button className="btn w-full" type="submit">Save sharing settings</button>
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
