"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import UndoToast from "@/components/UndoToast";
import SwipeRow from "@/components/SwipeRow";

export type BucketItem = {
  id: string;
  title: string;
  notes: string | null;
  category: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
};

// Open first, then newest first within each group.
const sortItems = (a: BucketItem, b: BucketItem) =>
  Number(Boolean(a.completed_at)) - Number(Boolean(b.completed_at)) ||
  (a.created_at < b.created_at ? 1 : -1);

export default function BucketListBoard({ initial, coupleId }: { initial: BucketItem[]; coupleId: string }) {
  const { items, add, update, removeWithUndo, undo, dismissUndo, removed } = useCollection<BucketItem>({
    table: "bucket_items",
    initial,
    coupleId,
    realtime: true,
    sort: sortItems,
  });

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [expanded, setExpanded] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const n = notes.trim() || null;
    const c = category.trim() || null;
    const d = targetDate || null;
    setTitle(""); setNotes(""); setCategory(""); setTargetDate(""); setExpanded(false);
    await add(
      { title: t, notes: n, category: c, target_date: d },
      { title: t, notes: n, category: c, target_date: d, completed_at: null, created_at: new Date().toISOString() }
    );
  }

  const open = items.filter((i) => !i.completed_at);
  const done = items.filter((i) => i.completed_at);

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-4 space-y-2">
        <input
          className="input"
          placeholder="What do you want to do together?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
        />
        {expanded && (
          <div className="space-y-2">
            <textarea className="input" placeholder="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Category (e.g. travel)" value={category} onChange={(e) => setCategory(e.target.value)} />
              <input className="input" type="date" aria-label="Target date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn text-sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Less" : "Details"}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={!title.trim()}>Add</button>
        </div>
      </form>

      <section className="space-y-2">
        <h3 className="label">Open ({open.length})</h3>
        {open.map((it) => (
          <SwipeRow key={it.id} onDelete={() => removeWithUndo(it.id)}>
            <div className="collection-item card p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{it.title}</div>
                {it.notes && <p className="muted text-xs mt-1">{it.notes}</p>}
                {(it.category || it.target_date) && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {it.category && <span className="pill">{it.category}</span>}
                    {it.target_date && <span className="pill">by {it.target_date}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="btn btn-ghost text-xs"
                  onClick={() => update(it.id, { completed_at: new Date().toISOString() })}
                >
                  Done
                </button>
                <button className="btn btn-ghost text-xs" onClick={() => removeWithUndo(it.id)} aria-label="Delete">×</button>
              </div>
            </div>
          </SwipeRow>
        ))}
        {open.length === 0 && done.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 text-accent grid place-items-center"><Globe size={22} aria-hidden /></div>
            <p className="font-display text-base">What&apos;s the first dream?</p>
            <p className="muted text-sm">A trip, a project, a habit, a quiet plan. Add one above.</p>
          </div>
        )}
        {open.length === 0 && done.length > 0 && <p className="muted">All caught up.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="label">Done ({done.length})</h3>
        {done.map((it) => (
          <div key={it.id} className="collection-item card p-3 flex items-start justify-between gap-3 opacity-60">
            <div className="min-w-0">
              <div className="font-medium">{it.title}</div>
              {it.notes && <p className="muted text-xs mt-1">{it.notes}</p>}
              {(it.category || it.target_date) && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {it.category && <span className="pill">{it.category}</span>}
                  {it.target_date && <span className="pill">by {it.target_date}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button className="btn btn-ghost text-xs" onClick={() => update(it.id, { completed_at: null })}>Reopen</button>
              <button className="btn btn-ghost text-xs" onClick={() => removeWithUndo(it.id)} aria-label="Delete">×</button>
            </div>
          </div>
        ))}
        {done.length === 0 && <p className="muted">Nothing checked off yet.</p>}
      </section>

      <UndoToast show={Boolean(removed)} label="Item removed" onUndo={undo} onDismiss={dismissUndo} />
    </div>
  );
}
