"use client";

import { useEffect } from "react";

// A calm, warm celebration: a few soft petals drift up and fade. Deliberately
// quiet (Arrows-style restraint) — not a confetti burst. Skips on reduced-motion.
export default function Confetti({ trigger, once }: { trigger: string | number | boolean | null; once?: string }) {
  useEffect(() => {
    if (!trigger) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (once) {
      const key = `tether-confetti:${once}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {}
    }

    const COUNT = 14;
    const colors = ["var(--accent)", "var(--accent-2)", "var(--accent-3)"];
    const root = document.body;
    const els: HTMLSpanElement[] = [];
    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement("span");
      el.className = "petal";
      const size = 9 + Math.random() * 9;
      const dur = 2.6 + Math.random() * 1.6;
      el.style.left = `${6 + Math.random() * 88}vw`;
      el.style.width = `${size}px`;
      el.style.height = `${size * 1.15}px`;
      el.style.background = `rgb(${colors[i % colors.length]} / ${0.55 + Math.random() * 0.3})`;
      el.style.setProperty("--sway", `${(Math.random() - 0.5) * 120}px`);
      el.style.setProperty("--spin", `${(Math.random() - 0.5) * 360}deg`);
      el.style.animation = `petalRise ${dur}s cubic-bezier(0.25, 0.6, 0.3, 1) ${Math.random() * 0.5}s forwards`;
      root.appendChild(el);
      els.push(el);
    }
    const t = setTimeout(() => { for (const el of els) el.remove(); }, 4600);
    return () => { clearTimeout(t); for (const el of els) el.remove(); };
  }, [trigger, once]);

  return null;
}
