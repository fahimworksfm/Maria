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
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [iosNotInstalled, setIosNotInstalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIOS && !standalone) {
        if (!cancelled) {
          setIosNotInstalled(true);
          setStatus("unsupported");
        }
        return;
      }

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
    setErr(null); setInfo(null); setBusy(true);
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Subscribe failed");
      }
      // Clear any prior opt-out so the layout keeps the subscription fresh.
      try { localStorage.removeItem("tether-push-optout"); } catch { /* ignore */ }
      setStatus("enabled");
      setInfo("Notifications enabled on this device.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to enable");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setErr(null); setInfo(null); setBusy(true);
    try {
      // Remember the explicit opt-out so the layout doesn't auto-resubscribe.
      try { localStorage.setItem("tether-push-optout", "1"); } catch { /* ignore */ }
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
      setInfo("Disabled.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setErr(null); setInfo(null); setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Test failed (${res.status})`);
      if (data.sent === 0 && data.failed === 0) {
        setErr("No subscription found on the server. Try Disable then Enable again.");
      } else if (data.sent === 0) {
        setErr(`Push provider rejected ${data.failed} subscription(s). Disable then Enable to re-subscribe.`);
      } else {
        setInfo(`Sent to ${data.sent} device${data.sent > 1 ? "s" : ""}. Check the notification.`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  if (!pushConfigured) {
    return (
      <div className="card p-4 text-sm muted">
        Push notifications aren&apos;t configured on this server yet. The pulse will still be saved to your partner&apos;s feed.
      </div>
    );
  }

  if (iosNotInstalled) {
    return (
      <div className="card p-4 text-sm space-y-2">
        <div className="font-medium">Install Tether to enable Pulse on iPhone</div>
        <p className="muted text-xs">iOS only delivers push notifications when the app is installed to your home screen.</p>
        <ol className="text-xs space-y-1">
          <li>1. In Safari, tap the share icon at the bottom.</li>
          <li>2. Choose <strong>Add to Home Screen</strong>.</li>
          <li>3. Open Tether from your home screen, then come back here.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-2">
      <div className="flex justify-between items-center gap-3">
        <div>
          <div className="font-medium">Phone notifications</div>
          <div className="muted text-xs">
            {status === "loading" && "Checking…"}
            {status === "unsupported" && "This browser doesn't support push."}
            {status === "ready" && "Off — partner's pulses won't buzz this device."}
            {status === "enabled" && "On — pulses will buzz this device."}
            {status === "denied" && "Blocked in browser settings. Enable notifications for this site."}
          </div>
        </div>
        {status === "ready" && (
          <button className="btn btn-primary text-sm" onClick={enable} disabled={busy}>
            {busy ? "…" : "Enable"}
          </button>
        )}
        {status === "enabled" && (
          <div className="flex gap-1">
            <button className="btn btn-ghost text-xs" onClick={test} disabled={busy}>
              {busy ? "…" : "Test"}
            </button>
            <button className="btn btn-ghost text-xs" onClick={disable} disabled={busy}>Disable</button>
          </div>
        )}
      </div>
      {info && <p className="text-xs text-accent2">{info}</p>}
      {err && <p className="text-xs text-accent">{err}</p>}
    </div>
  );
}
