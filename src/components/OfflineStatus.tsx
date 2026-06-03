"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribe, flush, isFlushing } from "@/lib/outbox";

export default function OfflineStatus() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    let prev = 0;
    const unsub = subscribe((c) => {
      // When the queue drains from >0 to 0, pull the now-synced data in.
      if (prev > 0 && c === 0) {
        setJustSynced(true);
        router.refresh();
        setTimeout(() => setJustSynced(false), 2500);
      }
      prev = c;
      setCount(c);
    });
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  if (count === 0 && !justSynced) return null;

  const flushing = isFlushing();
  const label = count > 0
    ? (flushing ? "syncing…" : `saved · will sync${count > 1 ? ` (${count})` : ""}`)
    : "synced ✓";

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-30 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-panel2/90 backdrop-blur px-3 py-1.5 text-xs text-ink shadow-soft">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            count > 0 ? "bg-accent2 animate-pulse" : "bg-emerald-400"
          }`}
        />
        {label}
      </div>
    </div>
  );
}
