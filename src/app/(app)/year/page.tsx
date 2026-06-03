import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chat } from "@/lib/groq";

export default async function YearPage({ searchParams }: { searchParams: Promise<{ year?: string; generate?: string }> }) {
  const me = await requireCoupled();
  const sp = await searchParams;
  const year = Number(sp.year || new Date().getFullYear());
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const supabase = await supabaseServer();

  const [{ data: mem }, { data: jrn }, { data: buc }, { data: dt }] = await Promise.all([
    supabase.from("memories").select("title, body, happened_on, location_name").eq("couple_id", me.coupleId).gte("happened_on", start).lte("happened_on", end).order("happened_on"),
    supabase.from("journal_entries").select("prompt_date, prompt, body, author_id").eq("couple_id", me.coupleId).gte("prompt_date", start).lte("prompt_date", end).order("prompt_date"),
    supabase.from("bucket_items").select("title, completed_at").eq("couple_id", me.coupleId).gte("completed_at", start).lte("completed_at", end),
    supabase.from("date_ideas").select("title, done").eq("couple_id", me.coupleId).eq("done", true),
  ]);

  let narrative: string | null = null;
  if (sp.generate === "1" && aiEnabled()) {
    narrative = await chat({
      system: "Write a warm, specific year-in-review narrative for a couple based on JSON data. ~250 words. Use months as anchors. Pull concrete moments — names, places. Never schmaltzy. End with one line of forward-looking.",
      user: `Year ${year}\nMemories: ${JSON.stringify(mem ?? [])}\nJournal: ${JSON.stringify(jrn ?? [])}\nBucket items completed: ${JSON.stringify(buc ?? [])}\nDates done: ${JSON.stringify(dt ?? [])}`,
      maxTokens: 800,
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="h1">Year in Review</h1>
          <p className="muted">Auto-pulled from everything you logged.</p>
        </div>
        <form className="flex gap-1 items-end">
          <input className="input w-24" name="year" type="number" defaultValue={year} />
          <button className="btn" type="submit">Load</button>
        </form>
      </header>

      <div className="grid grid-cols-2 gap-3 text-center">
        <Stat label="Memories" value={mem?.length ?? 0} />
        <Stat label="Journal entries" value={jrn?.length ?? 0} />
        <Stat label="Bucket items done" value={buc?.length ?? 0} />
        <Stat label="Dates done" value={dt?.length ?? 0} />
      </div>

      <form>
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="generate" value="1" />
        <button className="btn btn-primary w-full" type="submit" disabled={!aiEnabled()}>{aiEnabled() ? "Generate narrative" : "Set GROQ_API_KEY to enable"}</button>
      </form>

      {narrative && (
        <article className="card p-5 whitespace-pre-wrap text-sm leading-relaxed">{narrative}</article>
      )}

      <Link href={`/year/book?year=${year}`} className="card card-hover p-5 block text-center">
        <div className="text-3xl mb-1">📖</div>
        <div className="font-display text-lg">Make the book</div>
        <div className="muted text-sm mt-1">Lay {year} out as a printable A5 keepsake — memories, photos, and journal entries. Save it as a PDF.</div>
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-display">{value}</div>
      <div className="muted text-xs">{label}</div>
    </div>
  );
}
