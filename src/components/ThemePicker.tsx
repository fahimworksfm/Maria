"use client";

import { useState, useTransition } from "react";
import { THEME_LIST, type Theme } from "@/lib/themes";

export default function ThemePicker({
  current,
  action,
}: {
  current: string;
  action: (key: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(current);
  const [, start] = useTransition();

  function choose(t: Theme) {
    setSelected(t.key);
    // Optimistic re-tint: override the app shell's inline vars immediately.
    const el = document.getElementById("app-shell");
    if (el) {
      el.style.setProperty("--accent", t.accent);
      el.style.setProperty("--accent-2", t.accent2);
      el.style.setProperty("--accent-3", t.accent3);
      el.style.setProperty("--c-prim-bg", t.prim);
    }
    start(() => { action(t.key); });
  }

  return (
    <div className="flex flex-wrap gap-3">
      {THEME_LIST.map((t) => {
        const isSel = selected === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => choose(t)}
            className="flex flex-col items-center gap-1.5 min-w-[44px]"
            aria-pressed={isSel}
            title={t.label}
          >
            <span
              className={`w-11 h-11 rounded-full border transition ${
                isSel ? "ring-2 ring-offset-2 ring-offset-panel border-transparent" : "border-line"
              }`}
              style={{
                // The swatch is the colour your bubbles will actually be.
                background: `rgb(${t.prim})`,
                ...(isSel ? ({ "--tw-ring-color": `rgb(${t.prim})` } as React.CSSProperties) : {}),
              }}
            />
            <span className={`text-xs ${isSel ? "text-ink font-bold" : "text-muted font-semibold"}`}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
