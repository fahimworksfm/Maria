"use client";

import dynamic from "next/dynamic";
import type { Mote } from "./MemoryJar";

// Three.js is ~185KB gzipped, so it loads only on this page, and only when
// there is actually something in the jar.
const MemoryJar = dynamic(() => import("./MemoryJar"), { ssr: false });

export default function MemoryJarPanel({ motes }: { motes: Mote[] }) {
  if (motes.length === 0) return null;

  function select(id: string) {
    const el = document.getElementById(`memory-${id}`);
    if (!el) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    // Brief ring so it is obvious which one the mote was.
    el.classList.add("memory-flash");
    window.setTimeout(() => el.classList.remove("memory-flash"), 1800);
  }

  return (
    <div className="space-y-2">
      <MemoryJar motes={motes} onSelect={select} />
      <p className="muted text-xs text-center">Drag to turn it. Tap a light to find that memory.</p>
    </div>
  );
}
