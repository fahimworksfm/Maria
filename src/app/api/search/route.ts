import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type SearchHit = { type: string; title: string; snippet: string | null; href: string };

const PER_TYPE = 5;

// The term goes into PostgREST filter strings, so anything that means
// something there (wildcards, separators, quotes) is dropped rather than
// escaped. What is left is plain words.
function clean(raw: string): string {
  return raw.replace(/[%_\\,()"*:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function snip(text: string | null | undefined, n = 90): string | null {
  if (!text) return null;
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
}

// Search what the two of you have written. Couple-scoped; the Gift Vault is
// never searched, and a partner's journal answer only appears once that day
// has been revealed.
export async function GET(req: NextRequest) {
  const me = await requireCoupled();
  const q = clean(req.nextUrl.searchParams.get("q") ?? "");
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const supabase = await supabaseServer();
  const like = `%${q}%`;
  const either = (a: string, b: string) => `${a}.ilike."${like}",${b}.ilike."${like}"`;

  // One table failing (an older database, a missing column) must not take the
  // rest of the results down with it.
  async function rows<T>(run: () => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    try {
      const { data, error } = await run();
      return error ? [] : (data ?? []);
    } catch {
      return [];
    }
  }

  const [mems, songs, journal, bucket, watch, places, recipes, grats] = await Promise.all([
    rows<{ title: string | null; body: string | null }>(() =>
      supabase.from("memories").select("title, body").eq("couple_id", me.coupleId).or(either("title", "body")).order("created_at", { ascending: false }).limit(PER_TYPE)),
    rows<{ title: string; artist: string | null }>(() =>
      supabase.from("songs").select("title, artist").eq("couple_id", me.coupleId).or(either("title", "artist")).limit(PER_TYPE)),
    rows<{ prompt: string; body: string; author_id: string; prompt_date: string }>(() =>
      supabase.from("journal_entries").select("prompt, body, author_id, prompt_date").eq("couple_id", me.coupleId).or(either("prompt", "body")).order("prompt_date", { ascending: false }).limit(20)),
    rows<{ title: string; notes: string | null }>(() =>
      supabase.from("bucket_items").select("title, notes").eq("couple_id", me.coupleId).ilike("title", like).limit(PER_TYPE)),
    rows<{ title: string; year: number | null }>(() =>
      supabase.from("watchlist").select("title, year").eq("couple_id", me.coupleId).ilike("title", like).limit(PER_TYPE)),
    rows<{ name: string; kind: string | null }>(() =>
      supabase.from("places").select("name, kind").eq("couple_id", me.coupleId).ilike("name", like).limit(PER_TYPE)),
    rows<{ title: string }>(() =>
      supabase.from("recipes").select("title").eq("couple_id", me.coupleId).ilike("title", like).limit(PER_TYPE)),
    rows<{ text: string }>(() =>
      supabase.from("gratitudes").select("text").eq("couple_id", me.coupleId).ilike("text", like).order("created_at", { ascending: false }).limit(PER_TYPE)),
  ]);

  // Which of the matched journal days are revealed (both of you answered)?
  const dates = Array.from(new Set(journal.map((j) => j.prompt_date)));
  const revealed = new Set<string>();
  if (dates.length > 0) {
    const all = await rows<{ prompt_date: string; author_id: string }>(() =>
      supabase.from("journal_entries").select("prompt_date, author_id").eq("couple_id", me.coupleId).in("prompt_date", dates));
    const authors = new Map<string, Set<string>>();
    for (const r of all) {
      if (!authors.has(r.prompt_date)) authors.set(r.prompt_date, new Set());
      authors.get(r.prompt_date)!.add(r.author_id);
    }
    for (const [d, s] of authors) if (s.size >= 2) revealed.add(d);
  }

  const hits: SearchHit[] = [];
  for (const m of mems) hits.push({ type: "Memory", title: m.title || snip(m.body, 60) || "A moment", snippet: m.title ? snip(m.body) : null, href: "/memories" });
  for (const s of songs) hits.push({ type: "Song", title: s.title, snippet: s.artist, href: "/songs" });

  const seenDays = new Set<string>();
  for (const j of journal) {
    const mine = j.author_id === me.userId;
    // A sealed answer from your partner stays sealed here too.
    if (!mine && !revealed.has(j.prompt_date)) continue;
    if (seenDays.has(j.prompt_date)) continue;
    seenDays.add(j.prompt_date);
    hits.push({ type: "Journal", title: j.prompt, snippet: snip(j.body), href: "/journal" });
    if (seenDays.size >= PER_TYPE) break;
  }

  for (const b of bucket) hits.push({ type: "Bucket List", title: b.title, snippet: snip(b.notes), href: "/bucket-list" });
  for (const w of watch) hits.push({ type: "Watchlist", title: w.year ? `${w.title} (${w.year})` : w.title, snippet: null, href: "/watchlist" });
  for (const p of places) hits.push({ type: "Place", title: p.name, snippet: p.kind, href: "/places" });
  for (const r of recipes) hits.push({ type: "Recipe", title: r.title, snippet: null, href: "/recipes" });
  for (const g of grats) hits.push({ type: "Gratitude", title: snip(g.text, 80) ?? "A small thanks", snippet: null, href: "/gratitude" });

  return NextResponse.json({ hits });
}
