"use client";

import { useEffect, useState } from "react";

type Props = { publicKey: string; pushConfigured: boolean };

type Status = "loading" | "unsupported" | "ready" | "enabled" | "denied";

function b64ToUint8(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export default function PulseClient({ publicKey, pushConfigured }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? "enabled" : "ready");
      } catch {
        if (!cancelled) setStatus("ready");
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(publicKey),
      }));
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) throw new Error("Subscribe failed");
      setStatus("enabled");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to enable");
    }
  }

  async function disable() {
    setErr(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("ready");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to disable");
    }
  }

  async function test() {
    setErr(null);
    await fetch("/api/push/test", { method: "POST" });
  }

  if (!pushConfigured) {
    return (
      <div className="card p-4 text-sm muted">
        Push notifications are not configured on this server. Run <code>node scripts/generate-vapid.mjs</code> and set the env vars to enable.
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-2">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-medium">Phone notifications</div>
          <div className="muted text-xs">
            {status === "loading" && "Checking…"}
            {status === "unsupported" && "This browser doesn't support push. Install the PWA from your phone's browser."}
            {status === "ready" && "Off — partner's pulses won't buzz your phone."}
            {status === "enabled" && "On — pulses will buzz this device."}
            {status === "denied" && "Blocked in browser settings. Enable notifications for this site to use Pulse."}
          </div>
        </div>
        {status === "ready" && <button className="btn btn-primary text-sm" onClick={enable}>Enable</button>}
        {status === "enabled" && (
          <div className="flex gap-1">
            <button className="btn btn-ghost text-xs" onClick={test}>Test</button>
            <button className="btn btn-ghost text-xs" onClick={disable}>Disable</button>
          </div>
        )}
      </div>
      {err && <p className="text-accent text-xs">{err}</p>}
    </div>
  );
}
