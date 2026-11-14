// Curated couple themes. Values are space-separated RGB channels so they slot
// into Tailwind's `rgb(var(--accent) / <alpha-value>)` colors (opacity modifiers
// keep working).
//
// `accent*` are the bright tints used for highlights, rings and washes.
// `prim` is the deep version that fills your own bubbles and primary buttons:
// each one is chosen to carry white text at 4.5:1 or better, which the bright
// accents (sage, tide, coral) cannot do on their own.

export type Theme = {
  key: string;
  label: string;
  accent: string;
  accent2: string;
  accent3: string;
  prim: string;
};

export const THEMES: Record<string, Theme> = {
  iris: { key: "iris", label: "Iris", accent: "108 99 255", accent2: "142 134 240", accent3: "96 165 250", prim: "75 63 228" },
  coral: { key: "coral", label: "Coral", accent: "249 115 115", accent2: "249 200 115", accent3: "168 123 255", prim: "200 62 74" },
  tide: { key: "tide", label: "Tide", accent: "45 212 191", accent2: "96 165 250", accent3: "125 211 252", prim: "13 124 112" },
  lilac: { key: "lilac", label: "Lilac", accent: "192 132 252", accent2: "244 143 177", accent3: "129 140 248", prim: "126 58 201" },
  sage: { key: "sage", label: "Sage", accent: "134 216 143", accent2: "207 224 122", accent3: "94 211 197", prim: "46 125 74" },
  ember: { key: "ember", label: "Ember", accent: "251 146 110", accent2: "251 191 67", accent3: "244 114 182", prim: "194 77 34" },
};

export const DEFAULT_THEME = "iris";
export const THEME_LIST = Object.values(THEMES);

export function getTheme(key: string | null | undefined): Theme {
  return (key && THEMES[key]) || THEMES[DEFAULT_THEME]!;
}

/** Inline CSS custom properties for the app shell wrapper. */
export function themeVars(t: Theme): Record<string, string> {
  return { "--accent": t.accent, "--accent-2": t.accent2, "--accent-3": t.accent3, "--c-prim-bg": t.prim };
}
