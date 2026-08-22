"use client";

import { useEffect, useState } from "react";
import { useCollection } from "@/lib/useCollection";
import UndoToast from "@/components/UndoToast";
import SwipeRow from "@/components/SwipeRow";
import type { TmdbResult, WatchKind } from "@/lib/tmdb";

// Built here rather than imported so the server-only tmdb module (and its key
// handling) never gets pulled into the client bundle.
const posterUrl = (path: string) => `https://image.tmdb.org/t/p/w154${path}`;

export type WatchItem = {
  id: string;
  title: string;
  kind: string | null;
  notes: string | null;
  runtime_min: number | null;
  mood_tags: string[] | null;
  watched_at: string | null;
  rating: number | null;
  tmdb_id: number | null;
  poster_path: string | null;
  year: number | null;
  overview: string | null;
  created_at: string;
};

// Unwatched first (watched_at null), then newest created first.
const sortWatch = (a: WatchItem, b: WatchItem) =>
  Number(Boolean(a.watched_at)) - Number(Boolean(b.watched_at)) ||
  (a.created_at < b.created_at ? 1 : -1);

export default function WatchlistBoard({
  initial, coupleId, tmdbOn,
}: { initial: WatchItem[]; coupleId: string; tmdbOn: boolean }) {
  const { items, add, update, removeWithUndo, undo, dismissUndo, removed } = useCollection<WatchItem>({
    table: "watchlist",
    initial,
    coupleId,
    realtime: true,
    sort: sortWatch,
  });

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("movie");
  const [runtime, setRuntime] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [query, setQuery] = useState("");
  const [searchKind, setSearchKind] = useState<WatchKind>("movie");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);

  // Debounced search; the previous request is aborted so a fast typist can't
  // have an older response land after a newer one.
  useEffect(() => {
    const q = query.trim();
    if (!tmdbOn || q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const ctl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}&kind=${searchKind}`, { signal: ctl.signal });
        const json = (await res.json()) as { results?: TmdbResult[] };
        if (!ctl.signal.aborted) setResults(res.ok ? json.results ?? [] : []);
      } catch {
        if (!ctl.signal.aborted) setResults([]);
      } finally {
        if (!ctl.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { ctl.abort(); window.clearTimeout(timer); };
  }, [query, searchKind, tmdbOn]);

  async function pick(r: TmdbResult) {
    setPicking(true);
    // Runtime needs a second call; it feeding the "max minutes" picker is worth
    // it, but it stays optional — a failure just leaves the field empty.
    let runtimeMin: number | null = null;
    try {
      const res = await fetch(`/api/tmdb/details?id=${r.tmdbId}&kind=${r.kind}`);
      if (res.ok) runtimeMin = ((await res.json()) as { runtime: number | null }).runtime ?? null;
    } catch {
      /* optional */
    }
    const payload = {
      title: r.title, kind: r.kind, notes: null, runtime_min: runtimeMin, mood_tags: null,
      tmdb_id: r.tmdbId, poster_path: r.posterPath, year: r.year, overview: r.overview,
    };
    setQuery(""); setResults([]); setPicking(false);
    await add(payload, {
      ...payload, watched_at: null, rating: null, created_at: new Date().toISOString(),
    } as Omit<WatchItem, "id">);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const moodTags = tags.trim()
      ? tags.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const runtimeMin = Number(runtime) || null;
    const n = notes.trim() || null;
    const k = kind || "movie";
    setTitle(""); setKind("movie"); setRuntime(""); setTags(""); setNotes(""); setExpanded(false);
    await add(
      { title: t, kind: k, notes: n, runtime_min: runtimeMin, mood_tags: moodTags },
      {
        title: t,
        kind: k,
        notes: n,
        runtime_min: runtimeMin,
        mood_tags: moodTags,
        watched_at: null,
        rating: null,
        tmdb_id: null,
        poster_path: null,
        year: null,
        overview: null,
        created_at: new Date().toISOString(),
      }
    );
  }

  const unwatched = items.filter((r) => !r.watched_at);
  const watched = items.filter((r) => r.watched_at);

  return (
    <div className="space-y-6">
      {tmdbOn && (
        <div className="card p-4 space-y-2">
          <h3 className="label">Search TMDb</h3>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="input"
              value={searchKind}
              onChange={(e) => setSearchKind(e.target.value as WatchKind)}
              aria-label="Search movies or shows"
            >
              <option value="movie">Movie</option>
              <option value="show">Show</option>
            </select>
            <input
              className="input col-span-2"
              placeholder="Title…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              aria-label="Search by title"
            />
          </div>

          {results.length > 0 && (
            <ul className="space-y-1" aria-busy={picking}>
              {results.map((r) => (
                <li key={r.tmdbId}>
                  <button
                    type="button"
                    className="w-full text-left flex items-center gap-3 p-2 rounded-xl2 hover:bg-ink/5 disabled:opacity-50"
                    onClick={() => pick(r)}
                    disabled={picking}
                  >
                    {r.posterPath ? (
                      <img src={posterUrl(r.posterPath)} alt="" width={40} height={60} loading="lazy" className="w-10 h-[60px] object-cover rounded shrink-0" />
                    ) : (
                      <span className="w-10 h-[60px] rounded bg-ink/10 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{r.title}</span>
                      <span className="muted text-xs">{r.year ?? "Year unknown"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searching && <p className="muted text-xs">Searching…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="muted text-xs">No matches — add it by hand below.</p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="card p-4 space-y-2">
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
        />
        <div className="grid grid-cols-3 gap-2">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
            <option value="movie">Movie</option>
            <option value="show">Show</option>
            <option value="other">Other</option>
          </select>
          <input
            className="input"
            type="number"
            placeholder="Mins"
            value={runtime}
            onChange={(e) => setRuntime(e.target.value)}
          />
          <input
            className="input"
            placeholder="Tags (comma)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        {expanded && (
          <textarea
            className="input"
            rows={2}
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
        <div className="flex gap-2">
          <button type="button" className="btn text-sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Less" : "Notes"}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={!title.trim()}>Add</button>
        </div>
      </form>

      <section className="space-y-2">
        <h3 className="label">Unwatched ({unwatched.length})</h3>
        {unwatched.map((r) => (
          <SwipeRow key={r.id} onDelete={() => removeWithUndo(r.id)}>
            <div className="collection-item card p-3 flex justify-between items-start gap-3">
              <div className="flex gap-3 min-w-0">
                {r.poster_path && (
                  <img src={posterUrl(r.poster_path)} alt="" width={48} height={72} loading="lazy" className="w-12 h-[72px] object-cover rounded shrink-0" />
                )}
                <div className="min-w-0">
                <div className="font-medium">{r.title}{r.year ? ` (${r.year})` : ""}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {r.kind && <span className="pill">{r.kind}</span>}
                  {r.runtime_min && <span className="pill">{r.runtime_min}m</span>}
                  {(r.mood_tags ?? []).map((t) => <span key={t} className="pill">{t}</span>)}
                </div>
                {r.notes && <p className="muted text-xs mt-1">{r.notes}</p>}
                {!r.notes && r.overview && <p className="muted text-xs mt-1 line-clamp-2">{r.overview}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <select
                  className="input text-xs py-1"
                  aria-label="Rating"
                  defaultValue=""
                  onChange={(e) =>
                    update(r.id, {
                      watched_at: new Date().toISOString(),
                      rating: Number(e.target.value) || null,
                    } as Partial<WatchItem>)
                  }
                >
                  <option value="">Watched…</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </select>
                <button className="btn btn-ghost text-xs" onClick={() => removeWithUndo(r.id)} aria-label="Delete">×</button>
              </div>
            </div>
          </SwipeRow>
        ))}
        {unwatched.length === 0 && <p className="muted">Nothing queued yet — add one above.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="label">Watched ({watched.length})</h3>
        {watched.map((r) => (
          <div key={r.id} className="collection-item card p-3 flex justify-between items-start gap-3 opacity-80">
            <div className="flex gap-3 min-w-0">
              {r.poster_path && (
                <img src={posterUrl(r.poster_path)} alt="" width={32} height={48} loading="lazy" className="w-8 h-12 object-cover rounded shrink-0" />
              )}
              <div className="min-w-0">
              <div className="font-medium">{r.title} {r.rating ? `· ${"★".repeat(r.rating)}` : ""}</div>
              {r.notes && <p className="muted text-xs">{r.notes}</p>}
              </div>
            </div>
            <button className="btn btn-ghost text-xs shrink-0" onClick={() => removeWithUndo(r.id)} aria-label="Delete">×</button>
          </div>
        ))}
      </section>

      <UndoToast show={Boolean(removed)} label="Removed from watchlist" onUndo={undo} onDismiss={dismissUndo} />
    </div>
  );
}
