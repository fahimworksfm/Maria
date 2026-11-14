"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { tap, HAPTIC } from "@/lib/haptic";
import { play } from "@/lib/sound";

export default function PulseButton() {
  const [pressed, setPressed] = useState(false);

  function handleDown() {
    setPressed(true);
    tap(HAPTIC.pulse);
    play("pulse");
    window.setTimeout(() => setPressed(false), 850);
  }

  return (
    <button
      type="submit"
      onPointerDown={handleDown}
      className={`pulse-button ${pressed ? "is-pressed" : ""}`}
    >
      <Heart size={22} fill="currentColor" className="pulse-button-heart" aria-hidden />
      Send a pulse
    </button>
  );
}
