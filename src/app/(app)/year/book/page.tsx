import Link from "next/link";
import "./book.css";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chat } from "@/lib/groq";
import { signedUrl } from "@/lib/media";
import PrintButton from "./PrintButton";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function seasonOf(month: number): string {
  if (month === 12 || month <= 2) return "Winter";
  if (month <= 5) return "Spring";
  if (month <= 8) return "Summer";
  return "Autumn";
}

type Entry =
  | { kind: "memory"; ts: number; month: number; date: string; title: string; body: string | null; place: string | null; photo: string | null }
  | { kind: "journal"; ts: number; month: number; date: string; prompt: string; answers: Array<{ who: string; body: string }> };

function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

export default async function YearBookPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const me = await requireCoupled();
  const sp = await searchParams;
  const year = Number(sp.year || new Date().getFullYear());
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const supabase = await supabaseServer();

  const [{ data: mems }, { data: jrn }, { data: profiles }] = await Promise.all([
    supabase
      .from("memories")
      .select("id, title, body, media_url, media_type, happened_on, location_name, created_at")
      .eq("couple_id", me.coupleId)
      .gte("happened_on", start)
      .lte("happened_on", end)
      .order("happened_on", { ascending: true }),
    supabase
      .from("journal_entries")
      .select("prompt, body, author_id, prompt_date")
      .eq("couple_id", me.coupleId)
      .gte("prompt_date", start)
      .lte("prompt_date", end)
      .order("prompt_date", { ascending: true }),
    supabase.from("profiles").select("user_id, display_name").eq("couple_id", me.coupleId),
  ]);

  const nameOf = new Map<string, string>();
  for (const p of profiles ?? []) nameOf.set(p.user_id, p.display_name ?? "Someone");
  const names = (profiles ?? []).map((p) => p.display_name).filter(Boolean) as string[];
  const coupleNames = names.length === 2 ? `${names[0]} & ${names[1]}` : names.join(" & ") || "Us";

  const entries: Entry[] = [];

  for (const m of mems ?? []) {
    const iso = (m.happened_on ?? m.created_at).slice(0, 10);
    const [yy, mm, dd] = iso.split("-").map(Number);
    const photo = m.media_type === "image" && m.media_url ? await signedUrl(supabase, m.media_url, 60 * 60 * 12) : null;
    entries.push({
      kind: "memory",
      ts: Date.UTC(yy!, (mm ?? 1) - 1, dd ?? 1),
      month: mm ?? 1,
      date: iso,
      title: m.title || "A moment",
      body: m.body,
      place: m.location_name,
      photo,
    });
  }

  // Revealed journal entries only (both partners answered).
  const byDate = new Map<string, { prompt: string; answers: Array<{ who: string; body: string }> }>();
  for (const r of jrn ?? []) {
    if (!byDate.has(r.prompt_date)) byDate.set(r.prompt_date, { prompt: r.prompt, answers: [] });
    byDate.get(r.prompt_date)!.answers.push({ who: nameOf.get(r.author_id) ?? "—", body: r.body });
  }
  for (const [date, info] of byDate) {
    if (info.answers.length < 2) continue;
    const [yy, mm, dd] = date.split("-").map(Number);
    entries.push({
      kind: "journal",
      ts: Date.UTC(yy!, (mm ?? 1) - 1, dd ?? 1),
      month: mm ?? 1,
      date,
      prompt: info.prompt,
      answers: info.answers,
    });
  }

  entries.sort((a, b) => a.ts - b.ts);

  // AI intro paragraph
  let intro = "A year of small, ordinary days that added up to something — gathered here, in no particular hurry.";
  if (aiEnabled() && entries.length > 0) {
    try {
      const titles = entries.filter((e) => e.kind === "memory").map((e) => (e as Extract<Entry, { kind: "memory" }>).title).slice(0, 12);
      const prompts = entries.filter((e) => e.kind === "journal").map((e) => (e as Extract<Entry, { kind: "journal" }>).prompt).slice(0, 6);
      const text = await chat({
        system:
          "Write a single warm paragraph (under 90 words) to open a couple's year-in-review keepsake book. Specific and tender but never schmaltzy or clichéd. No title, no quotes — just the paragraph.",
        user: `Year ${year}. Couple: ${coupleNames}.\nMemory titles: ${JSON.stringify(titles)}\nJournal prompts: ${JSON.stringify(prompts)}`,
        temperature: 0.8,
        maxTokens: 200,
      });
      if (text.trim()) intro = text.trim().replace(/^["']|["']$/g, "");
    } catch {
      /* keep fallback */
    }
  }

  // Walk entries, inserting a season chapter divider when the season changes.
  const blocks: Array<{ type: "chapter"; season: string } | { type: "entry"; entry: Entry }> = [];
  let currentSeason: string | null = null;
  for (const e of entries) {
    const s = seasonOf(e.month);
    if (s !== currentSeason) {
      blocks.push({ type: "chapter", season: s });
      currentSeason = s;
    }
    blocks.push({ type: "entry", entry: e });
  }

  return (
    <div>
      <div className="no-print flex items-center justify-between gap-3 mb-4">
        <Link href={`/year?year=${year}`} className="btn btn-ghost text-sm">← Year in Review</Link>
        <PrintButton />
      </div>
      <p className="no-print muted text-xs mb-4">
        Tip: in the print dialog choose <strong>Save as PDF</strong>, paper size <strong>A5</strong>, and enable
        &quot;Background graphics&quot; for the photos.
      </p>

      <div className="book">
        {/* Cover */}
        <section className="book-cover">
          <div className="kicker">Our Year</div>
          <div className="year">{year}</div>
          <div className="rule" />
          <div className="names">{coupleNames}</div>
        </section>

        {/* Intro */}
        <section className="book-intro">
          <p>{intro}</p>
        </section>

        {/* Body */}
        {entries.length === 0 ? (
          <section className="book-empty">
            <p>This chapter is still being written.</p>
            <p className="text-sm">Add a few memories and journal entries for {year}, then come back to make the book.</p>
          </section>
        ) : (
          blocks.map((b, i) =>
            b.type === "chapter" ? (
              <section className="book-chapter" key={`c-${i}`}>
                <div className="season">{b.season}</div>
                <div className="season-sub">{year}</div>
              </section>
            ) : b.entry.kind === "memory" ? (
              <article className="book-entry" key={`e-${i}`}>
                <div className="date">{dateLabel(b.entry.date)}</div>
                <h3>{b.entry.title}</h3>
                {b.entry.photo && <img className="book-photo" src={b.entry.photo} alt="" />}
                {b.entry.body && <p>{b.entry.body}</p>}
                {b.entry.place && <p className="place">{b.entry.place}</p>}
              </article>
            ) : (
              <article className="book-entry" key={`e-${i}`}>
                <div className="date">{dateLabel(b.entry.date)}</div>
                <p className="book-prompt">{b.entry.prompt}</p>
                {b.entry.answers.map((a, k) => (
                  <div className="book-answer" key={k}>
                    <span className="who">{a.who}</span>
                    <span>{a.body}</span>
                  </div>
                ))}
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}
