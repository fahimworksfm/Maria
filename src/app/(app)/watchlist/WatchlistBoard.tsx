"use client";

import { useState } from "react";
import { useCollection } from "@/lib/useCollection";
import UndoToast from "@/components/UndoToast";
import SwipeRow from "@/components/SwipeRow";

export type WatchItem = {
  id: string;
  title: string;
  kind: string | null;
  notes: string | null;
  runtime_min: number | null;
  mood_tags: string[] | null;
  watched_at: string | null;
  rating: number | null;
  created_at: string;
};

// Unwatched first (watched_at null), then newest created first.
const sortWatch = (a: WatchItem, b: WatchItem) =>
  Number(Boolean(a.watched_at)) - Number(Boolean(b.watched_at)) ||
  (a.created_at < b.created_at ? 1 : -1);

export default function WatchlistBoard({ initial, coupleId }: { initial: WatchItem[]; coupleId: string }) {
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
        created_at: new Date().toISOString(),
      }
    );
  }

  const unwatched = items.filter((r) => !r.watched_at);
  const watched = items.filter((r) => r.watched_at);

  return (
    <div className="space-y-6">
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
              <div className="min-w-0">
                <div className="font-medium">{r.title}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {r.kind && <span className="pill">{r.kind}</span>}
                  {r.runtime_min && <span className="pill">{r.runtime_min}m</span>}
                  {(r.mood_tags ?? []).map((t) => <span key={t} className="pill">{t}</span>)}
                </div>
                {r.notes && <p className="muted text-xs mt-1">{r.notes}</p>}
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
            <div className="min-w-0">
              <div className="font-medium">{r.title} {r.rating ? `· ${"★".repeat(r.rating)}` : ""}</div>
              {r.notes && <p className="muted text-xs">{r.notes}</p>}
            </div>
            <button className="btn btn-ghost text-xs shrink-0" onClick={() => removeWithUndo(r.id)} aria-label="Delete">×</button>
          </div>
        ))}
      </section>

      <UndoToast show={Boolean(removed)} label="Removed from watchlist" onUndo={undo} onDismiss={dismissUndo} />
    </div>
  );
}
