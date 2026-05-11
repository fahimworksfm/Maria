import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chat } from "@/lib/groq";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export default async function DigestPage({ searchParams }: { searchParams: Promise<{ generate?: string }> }) {
  const me = await requireCoupled();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const start = startOfWeek(new Date());
  const startISO = start.toISOString().slice(0, 10);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const endISO = end.toISOString().slice(0, 10);

  const [mem, jrn, mood, moodPartner, buc, dates, gr] = await Promise.all([
    supabase.from("memories").select("title, body, happened_on").eq("couple_id", me.coupleId).gte("created_at", startISO),
    supabase.from("journal_entries").select("prompt, body, author_id, prompt_date").eq("couple_id", me.coupleId).gte("prompt_date", startISO),
    supabase.from("mood_checkins").select("mood, note, on_date").eq("user_id", me.userId).gte("on_date", startISO).lte("on_date", endISO),
    supabase.from("mood_checkins").select("mood, on_date, share_with_partner").neq("user_id", me.userId).gte("on_date", startISO).lte("on_date", endISO),
    supabase.from("bucket_items").select("title, completed_at").eq("couple_id", me.coupleId).gte("completed_at", startISO),
    supabase.from("date_ideas").select("title, done").eq("couple_id", me.coupleId).eq("done", true),
    supabase.from("gratitudes").select("text, author_id, created_at").eq("couple_id", me.coupleId).gte("created_at", startISO),
  ]);

  const counts = {
    memories: mem.data?.length ?? 0,
    journal: jrn.data?.length ?? 0,
    mood: mood.data?.length ?? 0,
    bucket: buc.data?.length ?? 0,
    dates: dates.data?.length ?? 0,
    gratitudes: gr.data?.length ?? 0,
  };

  let narrative: string | null = null;
  if (sp.generate === "1" && aiEnabled()) {
    narrative = await chat({
      system:
        "Write a short, warm Sunday digest for a couple summarising this week from their logged data. ~150 words. Specific anchors (names, places, themes). No clichés. End with one gentle question.",
      user: `Week of ${startISO}\nMemories: ${JSON.stringify(mem.data ?? [])}\nJournal: ${JSON.stringify(jrn.data ?? [])}\nYour mood: ${JSON.stringify(mood.data ?? [])}\nPartner mood (shared only): ${JSON.stringify((moodPartner.data ?? []).filter((m) => m.share_with_partner))}\nBucket done: ${JSON.stringify(buc.data ?? [])}\nDates done: ${JSON.stringify(dates.data ?? [])}\nGratitudes: ${JSON.stringify(gr.data ?? [])}`,
      maxTokens: 600,
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Weekly Digest</h1>
        <p className="muted">Week of {startISO}.</p>
      </header>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Memories" value={counts.memories} />
        <Stat label="Journal" value={counts.journal} />
        <Stat label="Mood logs" value={counts.mood} />
        <Stat label="Bucket done" value={counts.bucket} />
        <Stat label="Dates done" value={counts.dates} />
        <Stat label="Gratitudes" value={counts.gratitudes} />
      </div>

      <form>
        <input type="hidden" name="generate" value="1" />
        <button className="btn btn-primary w-full" type="submit" disabled={!aiEnabled()}>
          {aiEnabled() ? "Generate this week's digest" : "Set GROQ_API_KEY to enable"}
        </button>
      </form>

      {narrative && (
        <article className="card p-5 whitespace-pre-wrap text-sm leading-relaxed">{narrative}</article>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-3">
      <div className="text-xl font-display">{value}</div>
      <div className="muted text-xs">{label}</div>
    </div>
  );
}
