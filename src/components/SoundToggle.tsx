"use client";

import { useEffect, useState } from "react";
import { soundEnabled, setSoundEnabled, play } from "@/lib/sound";

export default function SoundToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(soundEnabled()), []);

  function toggle() {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    if (next) play("pulse"); // preview when turning on
  }

  return (
    <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
      <span className="text-[15px] font-semibold">
        Soft sounds
        <span className="block text-[13px] font-normal text-muted">A gentle tone on pulses and celebrations. Off by default.</span>
      </span>
      <input type="checkbox" checked={on} onChange={toggle} className="w-6 h-6 shrink-0 accent-[rgb(var(--c-prim-bg))]" />
    </label>
  );
}
