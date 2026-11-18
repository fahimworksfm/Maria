"use client";

import { ClaimButtons } from "@/components/ClaimButtons";
import { sideClass, sideName, sideOf } from "@/lib/authorship";
import { useState } from "react";
import { Globe, X } from "lucide-react";
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
  author_id?: string | null;
};

// Open first, then newest first within each group.
const sortItems = (a: BucketItem, b: BucketItem) =>
  Number(Boolean(a.completed_at)) - Number(Boolean(b.completed_at)) ||
  (a.created_at < b.created_at ? 1 : -1);

export default function BucketListBoard({ initial, coupleId, meId, partnerName }: { initial: BucketItem[]; coupleId: string; meId: string; partnerName: string }) {
  // Whose it is decides which side it sits on; rows with no author stay neutral.
  const side = (a: unknown) => sideOf(a, meId);
  const who = (a: unknown) => sideName(side(a), partnerName);
  const { items, add, update, claim, removeWithUndo, undo, dismissUndo, removed } = useCollection<BucketItem>({
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
      { title: t, notes: n, category: c, target_date: d, completed_at: null, created_at: new Date().toISOString(), author_id: meId }
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
          aria-label="New dream"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
        />
        {expanded && (
          <div className="space-y-2">
            <textarea className="input" placeholder="Notes (optional)" aria-label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Category (e.g. travel)" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <input className="input" type="date" aria-label="Target date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Less" : "Details"}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={!title.trim()}>Add</button>
        </div>
      </form>

      <section className="space-y-2">
        <h3 className="label">Open ({open.length})</h3>
        {open.map((it) => (
          <SwipeRow key={it.id} onDelete={() => removeWithUndo(it.id)}>
            <div className={`collection-item card px-4 py-3 flex items-start justify-between gap-3 ${sideClass(side(it.author_id))}`}>
              <div className="min-w-0">
                {who(it.author_id) && <div className="text-xs text-muted mb-0.5">{who(it.author_id)}</div>}
                <div className="font-semibold">{it.title}</div>
                {it.notes && <p className="text-muted text-[13px] mt-1">{it.notes}</p>}
                {(it.category || it.target_date) && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {it.category && <span className="pill">{it.category}</span>}
                    {it.target_date && <span className="pill">by {it.target_date}</span>}
                  </div>
                )}
                {!it.author_id && !String(it.id).startsWith("temp-") && (
                  <ClaimButtons partnerName={partnerName} onClaim={(w) => claim(it.id, w, w === "me" ? meId : "partner")} />
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="btn btn-ghost text-sm"
                  onClick={() => update(it.id, { completed_at: new Date().toISOString() })}
                >
                  Done
                </button>
                <button type="button" className="grid place-items-center w-11 h-11 shrink-0 rounded-full text-muted hover:bg-panel2 hover:text-ink transition" onClick={() => removeWithUndo(it.id)} aria-label="Delete"><X size={16} aria-hidden /></button>
              </div>
            </div>
          </SwipeRow>
        ))}
        {open.length === 0 && done.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><Globe size={22} aria-hidden /></div>
            <p className="font-bold text-lg">What&apos;s the first dream?</p>
            <p className="muted">A trip, a project, a habit, a quiet plan. Type it in the box above and tap Add.</p>
            <p className="text-muted text-[13px]">For example: &ldquo;See the northern lights together&rdquo;.</p>
          </div>
        )}
        {open.length === 0 && done.length > 0 && <p className="muted">All caught up.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="label">Done ({done.length})</h3>
        {done.map((it) => (
          <div key={it.id} className={`collection-item card px-4 py-3 flex items-start justify-between gap-3 opacity-60 ${sideClass(side(it.author_id))}`}>
            <div className="min-w-0">
              {who(it.author_id) && <div className="text-xs text-muted mb-0.5">{who(it.author_id)}</div>}
                <div className="font-semibold">{it.title}</div>
              {it.notes && <p className="text-muted text-[13px] mt-1">{it.notes}</p>}
              {(it.category || it.target_date) && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {it.category && <span className="pill">{it.category}</span>}
                  {it.target_date && <span className="pill">by {it.target_date}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button className="btn btn-ghost text-sm" onClick={() => update(it.id, { completed_at: null })}>Reopen</button>
              <button type="button" className="grid place-items-center w-11 h-11 shrink-0 rounded-full text-muted hover:bg-panel2 hover:text-ink transition" onClick={() => removeWithUndo(it.id)} aria-label="Delete"><X size={16} aria-hidden /></button>
            </div>
          </div>
        ))}
        {done.length === 0 && <p className="muted">Nothing checked off yet.</p>}
      </section>

      <UndoToast show={Boolean(removed)} label="Item removed" onUndo={undo} onDismiss={dismissUndo} />
    </div>
  );
}
