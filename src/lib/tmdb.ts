// TMDb lookup for the watchlist. Server-only: the key never reaches the client,
// the same way the Groq key doesn't. Everything degrades to manual entry when
// TMDB_API_KEY is unset.

const BASE = "https://api.themoviedb.org/3";
const TIMEOUT_MS = 5000;

export type WatchKind = "movie" | "show";

export type TmdbResult = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string | null;
  kind: WatchKind;
};

export function tmdbEnabled() {
  return Boolean(process.env.TMDB_API_KEY);
}

const yearOf = (date: unknown): number | null => {
  const y = Number(String(date ?? "").slice(0, 4));
  return Number.isFinite(y) && y > 1800 ? y : null;
};

async function tmdbGet<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const qs = new URLSearchParams({ ...params, api_key: key });
  try {
    const res = await Promise.race([
      fetch(`${BASE}${path}?${qs}`, { cache: "no-store" }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!res || !res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type SearchRow = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  release_date?: unknown;
  first_air_date?: unknown;
  poster_path?: unknown;
  overview?: unknown;
};

export async function tmdbSearch(query: string, kind: WatchKind): Promise<TmdbResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await tmdbGet<{ results?: SearchRow[] }>(
    kind === "movie" ? "/search/movie" : "/search/tv",
    { query: q, include_adult: "false", page: "1" }
  );
  const rows = Array.isArray(data?.results) ? data.results : [];
  return rows
    .map((r): TmdbResult | null => {
      const id = Number.isInteger(r.id) && (r.id as number) > 0 ? (r.id as number) : null;
      // TMDb calls it `title` for films and `name` for series.
      const title = typeof r.title === "string" ? r.title : typeof r.name === "string" ? r.name : null;
      if (id == null || !title) return null;
      return {
        tmdbId: id,
        title,
        year: yearOf(kind === "movie" ? r.release_date : r.first_air_date),
        posterPath: typeof r.poster_path === "string" ? r.poster_path : null,
        overview: typeof r.overview === "string" && r.overview.trim() ? r.overview.trim() : null,
        kind,
      };
    })
    .filter((r): r is TmdbResult => r !== null)
    .slice(0, 8);
}

// Runtime lives on the detail endpoint, not in search results. It feeds the
// existing "max minutes" filter on the Tonight? picker, so it's worth the
// second call when a title is actually chosen.
export async function tmdbRuntime(tmdbId: number, kind: WatchKind): Promise<number | null> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  if (kind === "movie") {
    const d = await tmdbGet<{ runtime?: unknown }>(`/movie/${tmdbId}`, {});
    return typeof d?.runtime === "number" && d.runtime > 0 ? d.runtime : null;
  }
  const d = await tmdbGet<{ episode_run_time?: unknown }>(`/tv/${tmdbId}`, {});
  const arr = Array.isArray(d?.episode_run_time) ? d.episode_run_time : [];
  const first = arr.find((n): n is number => typeof n === "number" && n > 0);
  return first ?? null;
}
