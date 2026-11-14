"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "desktop" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "tether-install-dismissed";

export default function InstallPrompt({
  variant = "card",
}: {
  variant?: "card" | "banner";
}) {
  const [platform, setPlatform] = useState<Platform>(null);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
    }

    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installAndroid() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  }

  if (!hydrated || installed || dismissed || !platform) return null;
  if (platform === "desktop") return null; // optional: hide on desktop

  const inner = (() => {
    if (platform === "ios") {
      return (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Install Tether on your iPhone</div>
              <div className="text-muted text-[13px] mt-0.5">For push notifications and full-screen mode.</div>
            </div>
            <button onClick={dismiss} aria-label="Dismiss" className="btn btn-ghost shrink-0 !px-3 text-lg leading-none">×</button>
          </div>
          <ol className="text-[15px] mt-3 space-y-2">
            <li className="flex items-center gap-2">
              <span className="pill">1</span>
              Tap the <ShareIcon /> share button in Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="pill">2</span>
              Choose <strong>Add to Home Screen</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="pill">3</span>
              Open Tether from your home screen
            </li>
          </ol>
        </>
      );
    }
    if (platform === "android" && deferred) {
      return (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Install Tether</div>
            <div className="text-muted text-[13px] mt-0.5">One-tap install. Works offline. Push notifications.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={dismiss} className="btn btn-ghost">Later</button>
            <button onClick={installAndroid} className="btn btn-primary">Install</button>
          </div>
        </div>
      );
    }
    if (platform === "android") {
      return (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Add Tether to your home screen</div>
            <div className="text-muted text-[13px] mt-0.5">Menu (⋮) → Install app / Add to Home Screen.</div>
          </div>
          <button onClick={dismiss} aria-label="Dismiss" className="btn btn-ghost shrink-0 !px-3 text-lg leading-none">×</button>
        </div>
      );
    }
    return null;
  })();

  if (!inner) return null;

  if (variant === "banner") {
    return (
      <div className="card p-3.5">
        {inner}
      </div>
    );
  }

  return <div className="card p-5">{inner}</div>;
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5" aria-hidden>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
