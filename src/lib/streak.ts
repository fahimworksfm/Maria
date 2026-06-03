import type { SupabaseClient } from "@supabase/supabase-js";

// A "together day" is one where BOTH partners did something gentle that day —
// journaled or planted a gratitude. The streak is the run of consecutive
// together-days ending today (or yesterday, so it never reads as "broken"
// mid-day). A missed day simply restarts it; we never surface a warning.

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function prevDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y!, (m ?? 1) - 1, d ?? 1) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Pure: given the set of dates (YYYY-MM-DD) on which both partners were active,
 * count the consecutive run ending today, or ending yesterday if today isn't
 * done yet. Returns 0 if neither today nor yesterday qualifies.
 */
export function countTogetherStreak(togetherDays: Set<string>, today = dayKey(new Date())): number {
  let cursor = today;
  if (!togetherDays.has(cursor)) {
    cursor = prevDay(today); // grace: today may still be in progress
    if (!togetherDays.has(cursor)) return 0;
  }
  let count = 0;
  while (togetherDays.has(cursor)) {
    count++;
    cursor = prevDay(cursor);
  }
  return count;
}

/**
 * Loads recent journal + gratitude activity for the couple and returns the
 * current together-streak length (in days). Looks back 60 days.
 */
export async function getTogetherStreak(supabase: SupabaseClient, coupleId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: jrn }, { data: grat }] = await Promise.all([
    supabase.from("journal_entries").select("author_id, prompt_date").eq("couple_id", coupleId).gte("prompt_date", since),
    supabase.from("gratitudes").select("author_id, created_at").eq("couple_id", coupleId).gte("created_at", since),
  ]);

  const byDay = new Map<string, Set<string>>();
  const mark = (date: string, author: string) => {
    if (!byDay.has(date)) byDay.set(date, new Set());
    byDay.get(date)!.add(author);
  };
  for (const r of jrn ?? []) mark(r.prompt_date, r.author_id);
  for (const g of grat ?? []) mark(String(g.created_at).slice(0, 10), g.author_id);

  // Together = both partners active that day (a couple has exactly two members).
  const together = new Set<string>();
  for (const [date, authors] of byDay) {
    if (authors.size >= 2) together.add(date);
  }

  return countTogetherStreak(together);
}
