import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // All surfaces resolve through CSS variables so the whole palette
        // swaps on :root[data-mode]. Channels, not hex, so bg-panel/70 works.
        bg: "rgb(var(--c-surface) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        panel2: "rgb(var(--c-panel-2) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        // Couple accents, and the ink-weighted version used for rules and labels.
        accent: "rgb(var(--accent) / <alpha-value>)",
        accent2: "rgb(var(--accent-2) / <alpha-value>)",
        accent3: "rgb(var(--accent-3) / <alpha-value>)",
        accentInk: "var(--c-accent-ink)",
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Headings share the body face; weight does the work a second family used to.
        display: ['"Figtree Variable"', 'Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(0 0 0 / 0.05), 0 10px 24px -18px rgb(0 0 0 / 0.25)",
        lift: "0 2px 4px rgb(0 0 0 / 0.06), 0 18px 40px -22px rgb(0 0 0 / 0.35)",
      },
      borderRadius: {
        xl2: "14px",
        xl3: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
