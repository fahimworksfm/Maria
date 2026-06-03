"use client";

import { useState, useTransition } from "react";
import { runOrQueue } from "@/lib/outbox";

export default function GratitudeForm({ action }: { action: (fd: FormData) => Promise<void> }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("text", value);
    start(async () => {
      try {
        const result = await runOrQueue("gratitude.add", { text: value }, () => action(fd));
        setText("");
        if (result === "queued") {
          setQueued(true);
          setTimeout(() => setQueued(false), 3000);
        }
      } catch {
        /* a real (online) error — leave the text so they can retry */
      }
    });
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-2">
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="A small thing you're grateful for, about them or with them"
        required
      />
      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Planting…" : "Plant a leaf"}
      </button>
      {queued && <p className="muted text-xs">Saved offline — it&apos;ll sync when you&apos;re back online.</p>}
    </form>
  );
}
