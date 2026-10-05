"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type Mode = "light" | "dark" | "system";

const KEY = "tether:mode";

/** Resolve and write the attribute the palette keys off. */
export function applyMode(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-mode", dark ? "dark" : "light");
}

const OPTIONS: { value: Mode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Paper", Icon: Sun },
  { value: "dark", label: "Ink", Icon: Moon },
  { value: "system", label: "Auto", Icon: Monitor },
];

export default function ModeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    let stored: Mode = "system";
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      /* blocked storage — Auto is a fine default */
    }
    setMode(stored);

    // Follow the OS while on Auto.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      try {
        if ((window.localStorage.getItem(KEY) ?? "system") === "system") applyMode("system");
      } catch {
        applyMode("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function choose(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* the choice still applies for this session */
    }
    applyMode(next);
  }

  return (
    <div className="inline-flex border border-line rounded-xl2 overflow-hidden" role="group" aria-label="Appearance">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold border-r border-line last:border-r-0 transition ${
              active ? "bg-ink text-bg" : "text-muted hover:bg-ink/5"
            }`}
          >
            <Icon size={13} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
