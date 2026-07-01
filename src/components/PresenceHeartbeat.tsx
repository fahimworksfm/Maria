"use client";

import { useEffect, useRef } from "react";

// Silently stamps last_active_at while the app is open (on mount, when the tab
// becomes visible, and every ~2 min), throttled to at most once per 60s. This is
// what makes presence + good-morning/good-night inference automatic — no taps.
export default function PresenceHeartbeat() {
  const lastSent = useRef(0);

  useEffect(() => {
    const beat = () => {
      const now = Date.now();
      if (now - lastSent.current < 60_000) return;
      lastSent.current = now;
      // On failure (e.g. an expired session), clear the throttle so the next
      // tick/visibility change retries instead of going stale for a minute.
      fetch("/api/presence", { method: "POST", keepalive: true })
        .then((r) => { if (!r.ok) lastSent.current = 0; })
        .catch(() => { lastSent.current = 0; });
    };
    beat();
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => { if (document.visibilityState === "visible") beat(); }, 120_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
