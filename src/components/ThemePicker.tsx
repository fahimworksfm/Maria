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
            className="flex flex-col items-center gap-1.5"
            aria-pressed={isSel}
            title={t.label}
          >
            <span
              className={`w-11 h-11 rounded-full border transition ${
                isSel ? "ring-2 ring-offset-2 ring-offset-panel border-transparent" : "border-line"
              }`}
              style={{
                backgroundImage: `linear-gradient(135deg, rgb(${t.accent}), rgb(${t.accent2}) 55%, rgb(${t.accent3}))`,
                // ring uses the swatch's own accent
                ...(isSel ? ({ "--tw-ring-color": `rgb(${t.accent})` } as React.CSSProperties) : {}),
              }}
            />
            <span className={`text-xs ${isSel ? "text-ink" : "text-muted"}`}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
