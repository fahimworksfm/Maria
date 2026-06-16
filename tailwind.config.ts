import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm editorial base — near-black with a hint of warmth, not cold blue-black.
        bg: "#0c0a09",
        panel: "#17120f",
        panel2: "#201a15",
        line: "#332a22",
        ink: "#f1ece5",
        muted: "#a99f93",
        // Themeable accents — driven by --accent / --accent-2 / --accent-3
        // (space-separated RGB channels). Opacity modifiers (bg-accent/20) work.
        accent: "rgb(var(--accent) / <alpha-value>)",
        accent2: "rgb(var(--accent-2) / <alpha-value>)",
        accent3: "rgb(var(--accent-3) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        // Warm, soft elevation with a faint top highlight (lit-from-above).
        soft: "inset 0 1px 0 rgba(255,243,230,0.05), 0 1px 2px rgba(0,0,0,0.3), 0 12px 30px -12px rgba(0,0,0,0.55)",
        lift: "inset 0 1px 0 rgba(255,243,230,0.06), 0 20px 50px -16px rgba(0,0,0,0.65)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
