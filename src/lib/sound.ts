"use client";

// Subtle, synthesized UI sound (no audio files). OFF by default; gated on a
// per-device setting. Tones are soft and short — quiet-luxury, not arcade.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem("tether-sound") === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem("tether-sound", on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function play(kind: "pulse" | "celebrate" | "tick"): void {
  if (!soundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;

  const note = (freq: number, t0: number, dur: number, peak = 0.045) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g);
    g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, now + t0);
    g.gain.exponentialRampToValueAtTime(peak, now + t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
    o.start(now + t0);
    o.stop(now + t0 + dur + 0.03);
  };

  if (kind === "pulse") {
    note(523.25, 0, 0.18, 0.05); // C5
    note(783.99, 0.07, 0.22, 0.04); // G5
  } else if (kind === "celebrate") {
    note(523.25, 0, 0.3, 0.04); // C5
    note(659.25, 0.1, 0.3, 0.04); // E5
    note(783.99, 0.2, 0.42, 0.045); // G5
  } else {
    note(880, 0, 0.08, 0.03); // soft tick
  }
}
