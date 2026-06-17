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
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm">
        Soft sounds
        <span className="muted block text-xs">A gentle tone on pulses and celebrations. Off by default.</span>
      </span>
      <input type="checkbox" checked={on} onChange={toggle} className="w-5 h-5 shrink-0" />
    </label>
  );
}
