"use client";

import { useState } from "react";
import { Sprout } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import UndoToast from "@/components/UndoToast";
import SwipeRow from "@/components/SwipeRow";

export type Gratitude = {
  id: string;
  author_id: string;
  text: string;
  created_at: string;
};

const sortGratitudes = (a: Gratitude, b: Gratitude) =>
  a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;

export default function GratitudeBoard({
  initial,
  coupleId,
  myUserId,
  partnerName,
}: {
  initial: Gratitude[];
  coupleId: string;
  myUserId: string;
  partnerName: string;
}) {
  const { items, add, removeWithUndo, undo, dismissUndo, removed } = useCollection<Gratitude>({
    table: "gratitudes",
    initial,
    coupleId,
    realtime: true,
    sort: sortGratitudes,
  });

  const [text, setText] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    await add(
      { text: value },
      { author_id: myUserId, text: value, created_at: new Date().toISOString() }
    );
  }

  return (
    <div className="space-y-5">
      <div className="card p-2 overflow-hidden">
        <Tree
          count={items.length}
          leaves={items.slice(0, 40).map((g, i) => ({ idx: i, text: g.text, mine: g.author_id === myUserId }))}
        />
      </div>

      {items.length === 0 ? (
        <div className="card p-5 text-center space-y-1">
          <div className="mark-box"><Sprout size={22} aria-hidden /></div>
          <p className="font-bold pt-2">An empty tree, waiting.</p>
          <p className="muted">Plant a small thing and watch it grow.</p>
        </div>
      ) : (
        <section className="thread" aria-label={`Recent leaves (${items.length})`}>
          <p className="day-mark">{items.length} {items.length === 1 ? "leaf" : "leaves"} · newest first</p>
          {items.slice(0, 30).map((g) => {
            const mine = g.author_id === myUserId;
            return (
              <SwipeRow key={g.id} onDelete={() => mine && removeWithUndo(g.id)}>
                <div className="collection-item flex flex-col gap-1">
                  <div className={`bubble ${mine ? "bubble-me" : "bubble-them"}`}>{g.text}</div>
                  <div className={`stamp flex items-center gap-1.5 ${mine ? "self-end" : ""}`}>
                    <span>{mine ? "You" : partnerName}</span>
                    {mine && (
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-ink min-h-[32px] px-1"
                        onClick={() => removeWithUndo(g.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </SwipeRow>
            );
          })}
        </section>
      )}

      {/* The composer. */}
      <form onSubmit={submit} className="card p-3.5 space-y-2.5">
        <label htmlFor="gratitude-text" className="sr-only">Something you&apos;re grateful for</label>
        <textarea
          id="gratitude-text"
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="A small thing you're grateful for, about them or with them"
        />
        <button className="btn btn-primary w-full" type="submit" disabled={!text.trim()}>
          Plant a leaf
        </button>
      </form>

      <UndoToast show={Boolean(removed)} label="Leaf removed" onUndo={undo} onDismiss={dismissUndo} />
    </div>
  );
}

function Tree({ leaves, count }: { count: number; leaves: Array<{ idx: number; text: string; mine: boolean }> }) {
  const w = 360, h = 360;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="auto" role="img" aria-label={`Gratitude tree with ${count} ${count === 1 ? "leaf" : "leaves"}`} className="text-muted">
      {/* trunk */}
      <path d={`M ${w / 2} ${h} C ${w / 2 - 4} ${h - 80}, ${w / 2 + 4} ${h - 120}, ${w / 2} ${h - 180}`}
            stroke="currentColor" strokeOpacity="0.55" strokeWidth="10" fill="none" strokeLinecap="round" />
      {/* branches */}
      {BRANCHES.map((b, i) => (
        <path key={i}
          d={`M ${w / 2} ${h - 180} Q ${w / 2 + b.cx} ${h - 180 + b.cy}, ${w / 2 + b.x} ${h - 180 + b.y}`}
          stroke="currentColor" strokeOpacity="0.55" strokeWidth={b.sw} fill="none" strokeLinecap="round" />
      ))}

      {/* leaves */}
      {leaves.map(({ idx, mine }) => {
        const pos = leafPos(idx, w, h);
        return (
          <g key={idx} transform={`translate(${pos.x} ${pos.y}) rotate(${pos.r})`}>
            <ellipse rx="8" ry="14" style={{ fill: mine ? "rgb(var(--c-prim-bg))" : "rgb(var(--accent-2))" }} opacity="0.9" />
          </g>
        );
      })}

      <text x={w - 12} y={h - 12} textAnchor="end" fill="currentColor" fontSize="12">
        {count} {count === 1 ? "leaf" : "leaves"}
      </text>
    </svg>
  );
}

const BRANCHES: Array<{ cx: number; cy: number; x: number; y: number; sw: number }> = [
  { cx: -40, cy: -20, x: -90, y: -50, sw: 6 },
  { cx: 40, cy: -20, x: 100, y: -40, sw: 6 },
  { cx: -10, cy: -40, x: -30, y: -90, sw: 5 },
  { cx: 20, cy: -50, x: 50, y: -100, sw: 5 },
  { cx: -60, cy: 10, x: -130, y: 10, sw: 4 },
  { cx: 60, cy: 10, x: 130, y: 0, sw: 4 },
];

function leafPos(i: number, w: number, h: number) {
  const angle = (i * 137.5 * Math.PI) / 180; // golden angle
  const r = 60 + (i % 6) * 18 + Math.floor(i / 8) * 6;
  const x = w / 2 + Math.cos(angle) * r;
  const y = h - 180 + Math.sin(angle) * r * 0.7 - Math.min(i, 30);
  const rot = (Math.cos(angle) * 30);
  return { x, y, r: rot };
}
