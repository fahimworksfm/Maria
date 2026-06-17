"use client";

import { useState } from "react";
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
      aria-label="Send pulse"
      onPointerDown={handleDown}
      className={`pulse-button ${pressed ? "is-pressed" : ""}`}
    >
      <span className="pulse-button-emoji" aria-hidden>💗</span>
    </button>
  );
}
