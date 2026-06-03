// Curated couple themes. Values are space-separated RGB channels so they slot
// into Tailwind's `rgb(var(--accent) / <alpha-value>)` colors (opacity modifiers
// keep working). All chosen to stay legible on the #0b0b10 dark background and
// to carry dark (#0b0b10) text on solid accent buttons.

export type Theme = {
  key: string;
  label: string;
  accent: string;
  accent2: string;
  accent3: string;
};

export const THEMES: Record<string, Theme> = {
  coral: { key: "coral", label: "Coral", accent: "249 115 115", accent2: "249 200 115", accent3: "168 123 255" },
  tide: { key: "tide", label: "Tide", accent: "45 212 191", accent2: "96 165 250", accent3: "125 211 252" },
  lilac: { key: "lilac", label: "Lilac", accent: "192 132 252", accent2: "244 143 177", accent3: "129 140 248" },
  sage: { key: "sage", label: "Sage", accent: "134 216 143", accent2: "207 224 122", accent3: "94 211 197" },
  ember: { key: "ember", label: "Ember", accent: "251 146 110", accent2: "251 191 67", accent3: "244 114 182" },
};

export const DEFAULT_THEME = "coral";
export const THEME_LIST = Object.values(THEMES);

export function getTheme(key: string | null | undefined): Theme {
  return (key && THEMES[key]) || THEMES[DEFAULT_THEME]!;
}

/** Inline CSS custom properties for the app shell wrapper. */
export function themeVars(t: Theme): Record<string, string> {
  return { "--accent": t.accent, "--accent-2": t.accent2, "--accent-3": t.accent3 };
}
