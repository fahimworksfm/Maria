"use client";

import { useState, useTransition } from "react";
import { runOrQueue } from "@/lib/outbox";

const MOODS = ["😞", "😕", "🙂", "😊", "🤩"];

export default function MoodForm({
  action,
  initialMood,
  initialNote,
  initialShare,
}: {
  action: (fd: FormData) => Promise<void>;
  initialMood: number | null;
  initialNote: string;
  initialShare: boolean;
}) {
  const [mood, setMood] = useState<number | null>(initialMood);
  const [note, setNote] = useState(initialNote);
  const [share, setShare] = useState(initialShare);
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mood) return;
    const fd = new FormData();
    fd.set("mood", String(mood));
    fd.set("note", note);
    if (share) fd.set("share", "on");
    const on_date = new Date().toISOString().slice(0, 10);
    start(async () => {
      try {
        const result = await runOrQueue(
          "mood.save",
          { mood, note, share_with_partner: share, on_date },
          () => action(fd)
        );
        if (result === "queued") {
          setQueued(true);
          setTimeout(() => setQueued(false), 3000);
        }
      } catch {
        /* real online error — leave state for retry */
      }
    });
  }

  return (
    <form onSubmit={submit} className="card p-3.5 space-y-3">
      <div className="grid grid-cols-5 gap-2" role="group" aria-label="How are you today?">
        {MOODS.map((emoji, i) => {
          const value = i + 1;
          const selected = mood === value;
          return (
            <button
              type="button"
              key={i}
              onClick={() => setMood(value)}
              className={`text-3xl text-center py-3 rounded-2xl transition ${selected ? "ring-2 ring-offset-2 ring-offset-panel" : "bg-panel2"}`}
              style={selected ? ({ background: "rgb(var(--c-prim-bg))", "--tw-ring-color": "rgb(var(--c-prim-bg))" } as React.CSSProperties) : undefined}
              aria-pressed={selected}
              aria-label={`Mood ${value} of 5`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      <textarea
        className="input"
        rows={2}
        aria-label="A line about today (optional)"
        placeholder="A line about today (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <label className="flex items-center gap-2.5 min-h-[44px] text-[15px]">
        <input type="checkbox" className="w-5 h-5" checked={share} onChange={(e) => setShare(e.target.checked)} />
        Share with partner
      </label>
      <button className="btn btn-primary w-full" type="submit" disabled={pending || !mood}>
        {pending ? "Saving…" : "Save"}
      </button>
      {queued && <p className="muted text-[13px]" role="status">Saved offline — it&apos;ll sync when you&apos;re back online.</p>}
    </form>
  );
}
