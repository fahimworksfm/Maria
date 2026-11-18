"use client";

import { ClaimButtons } from "@/components/ClaimButtons";
import { sideClass, sideName, sideOf } from "@/lib/authorship";
import { useEffect, useState } from "react";
import { useCollection } from "@/lib/useCollection";
import UndoToast from "@/components/UndoToast";
import SwipeRow from "@/components/SwipeRow";
import type { TmdbResult, WatchKind } from "@/lib/tmdb";
import { Clapperboard, X } from "lucide-react";

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
  author_id?: string | null;
};

// Unwatched first (watched_at null), then newest created first.
const sortWatch = (a: WatchItem, b: WatchItem) =>
  Number(Boolean(a.watched_at)) - Number(Boolean(b.watched_at)) ||
  (a.created_at < b.created_at ? 1 : -1);

export default function WatchlistBoard({
  initial, coupleId, tmdbOn, meId, partnerName,
}: { initial: WatchItem[]; coupleId: string; tmdbOn: boolean; meId: string; partnerName: string }) {
  // Whose it is decides which side it sits on; rows with no author stay neutral.
  const side = (a: unknown) => sideOf(a, meId);
  const who = (a: unknown) => sideName(side(a), partnerName);
  const { items, add, update, claim, removeWithUndo, undo, dismissUndo, removed } = useCollection<WatchItem>({
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
      ...payload, watched_at: null, rating: null, created_at: new Date().toISOString(), author_id: meId,
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
        author_id: meId,
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
                    className="w-full text-left flex items-center gap-3 p-2 rounded-xl2 min-h-[44px] hover:bg-panel2 disabled:opacity-50"
                    onClick={() => pick(r)}
                    disabled={picking}
                  >
                    {r.posterPath ? (
                      <img src={posterUrl(r.posterPath)} alt="" width={40} height={60} loading="lazy" className="w-10 h-[60px] object-cover rounded-lg shrink-0" />
                    ) : (
                      <span className="w-10 h-[60px] rounded-lg bg-ink/10 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{r.title}</span>
                      <span className="text-muted text-[13px]">{r.year ?? "Year unknown"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searching && <p className="text-muted text-[13px]">Searching…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-muted text-[13px]">No matches — add it by hand below.</p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="card p-4 space-y-2">
        <input
          className="input"
          placeholder="Title"
          aria-label="Title"
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
            aria-label="Runtime in minutes"
            value={runtime}
            onChange={(e) => setRuntime(e.target.value)}
          />
          <input
            className="input"
            placeholder="Tags (comma)"
            aria-label="Mood tags, comma separated"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        {expanded && (
          <textarea
            className="input"
            rows={2}
            placeholder="Notes"
            aria-label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Less" : "Notes"}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={!title.trim()}>Add</button>
        </div>
      </form>

      <section className="space-y-2">
        <h3 className="label">Unwatched ({unwatched.length})</h3>
        {unwatched.map((r) => (
          <SwipeRow key={r.id} onDelete={() => removeWithUndo(r.id)}>
            <div className={`collection-item card px-4 py-3 flex justify-between items-start gap-3 ${sideClass(side(r.author_id))}`}>
              <div className="flex gap-4 min-w-0">
                {r.poster_path && (
                  <img src={posterUrl(r.poster_path)} alt="" width={48} height={72} loading="lazy" className="w-12 h-[72px] object-cover rounded-lg shrink-0" />
                )}
                <div className="min-w-0">
                {who(r.author_id) && <div className="text-xs text-muted mb-0.5">{who(r.author_id)}</div>}
                <div className="font-semibold leading-snug">{r.title}{r.year ? ` (${r.year})` : ""}</div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {r.kind && <span className="pill">{r.kind}</span>}
                  {r.runtime_min && <span className="pill">{r.runtime_min}m</span>}
                  {(r.mood_tags ?? []).map((t) => <span key={t} className="pill">{t}</span>)}
                </div>
                {r.notes && <p className="text-muted text-[13px] mt-1.5 leading-relaxed">{r.notes}</p>}
                {!r.notes && r.overview && <p className="text-muted text-[13px] mt-1.5 leading-relaxed line-clamp-2">{r.overview}</p>}
                {!r.author_id && !String(r.id).startsWith("temp-") && (
                  <ClaimButtons partnerName={partnerName} onClaim={(w) => claim(r.id, w, w === "me" ? meId : "partner")} />
                )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <select
                  className="input !w-auto text-sm"
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
                <button type="button" className="grid place-items-center w-11 h-11 shrink-0 rounded-full text-muted hover:bg-panel2 hover:text-ink transition" onClick={() => removeWithUndo(r.id)} aria-label="Delete"><X size={16} aria-hidden /></button>
              </div>
            </div>
          </SwipeRow>
        ))}
        {unwatched.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><Clapperboard size={22} aria-hidden /></div>
            <p className="font-bold text-lg pt-2">Nothing queued yet.</p>
            <p className="muted">{tmdbOn ? "Search for a title above, or add one by hand in the form above." : "Add a title in the form above."}</p>
            <p className="text-muted text-[13px]">For example: the film you keep saying you&apos;ll watch together.</p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="label">Watched ({watched.length})</h3>
        {watched.map((r) => (
          <div key={r.id} className={`collection-item card px-4 py-3 flex justify-between items-start gap-3 opacity-80 ${sideClass(side(r.author_id))}`}>
            <div className="flex gap-4 min-w-0">
              {r.poster_path && (
                <img src={posterUrl(r.poster_path)} alt="" width={32} height={48} loading="lazy" className="w-8 h-12 object-cover rounded-lg shrink-0" />
              )}
              <div className="min-w-0">
              <div className="font-semibold">{r.title} {r.rating ? `· ${"★".repeat(r.rating)}` : ""}</div>
              {r.notes && <p className="text-muted text-[13px] mt-1 leading-relaxed">{r.notes}</p>}
              {!r.author_id && <ClaimButtons partnerName={partnerName} onClaim={(w) => claim(r.id, w, w === "me" ? meId : "partner")} />}
              </div>
            </div>
            <button type="button" className="grid place-items-center w-11 h-11 shrink-0 rounded-full text-muted hover:bg-panel2 hover:text-ink transition" onClick={() => removeWithUndo(r.id)} aria-label="Delete"><X size={16} aria-hidden /></button>
          </div>
        ))}
      </section>

      <UndoToast show={Boolean(removed)} label="Removed from watchlist" onUndo={undo} onDismiss={dismissUndo} />
    </div>
  );
}
