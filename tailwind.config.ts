import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0b10",
        panel: "#15151c",
        panel2: "#1d1d27",
        line: "#2a2a36",
        ink: "#e9e9f0",
        muted: "#9a9aaa",
        // Themeable accents — driven by --accent / --accent-2 / --accent-3
        // (space-separated RGB channels). Opacity modifiers (bg-accent/20) work.
        accent: "rgb(var(--accent) / <alpha-value>)",
        accent2: "rgb(var(--accent-2) / <alpha-value>)",
        accent3: "rgb(var(--accent-3) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: "0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.35)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
