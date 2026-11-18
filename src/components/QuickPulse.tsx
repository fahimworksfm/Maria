"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Check } from "lucide-react";
import { tap, HAPTIC } from "@/lib/haptic";
import { play } from "@/lib/sound";

const UNDO_MS = 4000;

type Phase = "idle" | "pending" | "sent" | "failed";

/**
 * One-tap pulse for Home. The send is held for a few seconds so a stray thumb
 * can be undone; it goes out when the window closes, or straight away if you
 * leave the page first.
 */
export default function QuickPulse() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armed = useRef(false);

  const send = useCallback(async (leaving: boolean) => {
    if (!armed.current) return;
    armed.current = false;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try {
      // keepalive lets the request finish even if the page is going away.
      const res = await fetch("/api/pulse", { method: "POST", keepalive: true });
      if (leaving) return;
      if (!res.ok) throw new Error("send failed");
      setPhase("sent");
      router.refresh();
      window.setTimeout(() => setPhase((p) => (p === "sent" ? "idle" : p)), 2500);
    } catch {
      if (!leaving) setPhase("failed");
    }
  }, [router]);

  // Leaving with a pulse still held: send it rather than lose it.
  useEffect(() => {
    const flush = () => { void send(true); };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [send]);

  function start() {
    tap(HAPTIC.pulse);
    play("pulse");
    armed.current = true;
    setPhase("pending");
    timer.current = setTimeout(() => { void send(false); }, UNDO_MS);
  }

  function undo() {
    armed.current = false;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    tap(HAPTIC.tick);
    setPhase("idle");
  }

  if (phase === "pending") {
    return (
      <span className="chip !pr-1.5" role="status">
        <HeartPulse size={15} aria-hidden /> Pulse sent
        <button type="button" onClick={undo} className="ml-1 min-h-[36px] px-2.5 rounded-full bg-panel2 text-accentInk font-bold">
          Undo
        </button>
      </span>
    );
  }

  if (phase === "sent") {
    return <span className="chip" role="status"><Check size={15} aria-hidden /> Pulse sent</span>;
  }

  if (phase === "failed") {
    return (
      <Link href="/pulse" className="chip" role="alert">
        <HeartPulse size={15} aria-hidden /> Didn&apos;t send. Open Pulse
      </Link>
    );
  }

  return (
    <button type="button" onClick={start} className="chip">
      <HeartPulse size={15} aria-hidden /> Send a pulse
    </button>
  );
}
