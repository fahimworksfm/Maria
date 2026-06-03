"use client";

import { useEffect } from "react";

const OPT_OUT_KEY = "tether-push-optout";
const ASKED_KEY = "tether-push-asked";

function b64ToUint8(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Runs once on app load inside the (app) layout. Registers/uses the service
 * worker, ensures the device is subscribed to push, and upserts the
 * subscription server-side. Designed to be silent and fail-safe:
 *  - no-op when push isn't configured or supported
 *  - skipped on iOS unless installed to the home screen (Safari tabs can't push)
 *  - respects an explicit "disable" from the Pulse page (opt-out flag)
 *  - only auto-prompts for permission once (the Pulse Enable button is the
 *    reliable, gesture-driven path; this is best-effort).
 */
export default function PushRegistration({ vapidKey }: { vapidKey: string }) {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!vapidKey) return;
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

      // iOS only delivers push to installed (standalone) PWAs.
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIOS && !standalone) return;

      // Respect an explicit opt-out chosen on the Pulse page.
      try {
        if (localStorage.getItem(OPT_OUT_KEY) === "1") return;
      } catch {
        /* ignore */
      }

      if (Notification.permission === "denied") return;

      if (Notification.permission === "default") {
        // Only auto-ask once ever, so we never nag on every load.
        let alreadyAsked = false;
        try {
          alreadyAsked = localStorage.getItem(ASKED_KEY) === "1";
        } catch {
          /* ignore */
        }
        if (alreadyAsked) return;
        try {
          localStorage.setItem(ASKED_KEY, "1");
        } catch {
          /* ignore */
        }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
      }

      // Permission granted at this point.
      const reg = await navigator.serviceWorker.ready;
      if (cancelled) return;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToUint8(vapidKey),
        }));
      if (cancelled) return;

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
        keepalive: true,
      });
    }

    run().catch(() => {
      /* best-effort; never surface */
    });

    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  return null;
}
