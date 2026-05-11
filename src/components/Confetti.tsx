"use client";

import { useEffect } from "react";

const EMOJI = ["💖", "✨", "💞", "💘", "🌟", "💕", "🎉"];

export default function Confetti({ trigger, once }: { trigger: string | number | boolean | null; once?: string }) {
  useEffect(() => {
    if (!trigger) return;
    if (once) {
      const key = `tether-confetti:${once}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {}
    }
    const burst = 28;
    const root = document.body;
    const els: HTMLSpanElement[] = [];
    for (let i = 0; i < burst; i++) {
      const el = document.createElement("span");
      el.className = "sparkle";
      el.textContent = EMOJI[i % EMOJI.length]!;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const angle = (Math.PI * 2 * i) / burst + Math.random() * 0.3;
      const dist = 120 + Math.random() * 180;
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      el.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      el.style.fontSize = `${20 + Math.random() * 20}px`;
      el.style.animationDelay = `${Math.random() * 0.1}s`;
      root.appendChild(el);
      els.push(el);
    }
    const t = setTimeout(() => {
      for (const el of els) el.remove();
    }, 1800);
    return () => {
      clearTimeout(t);
      for (const el of els) el.remove();
    };
  }, [trigger]);

  return null;
}
