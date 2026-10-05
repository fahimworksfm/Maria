import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Soft glass: a deep neutral base, with every surface above it made of
        // translucent white rather than its own solid colour. Depth comes from
        // stacked transparency, so panels pick up whatever ambient light sits
        // behind them and each couple's theme tints the whole app.
        bg: "#0A0A0C",
        panel: "rgb(255 255 255 / 0.055)",
        panel2: "rgb(255 255 255 / 0.10)",
        line: "rgb(255 255 255 / 0.12)",
        ink: "#F7F6F4",
        muted: "#A2A0A8",
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
        // Glass elevation: a lit top edge, a tight contact shadow, and a wide
        // soft one. The top highlight is what sells a translucent surface as a
        // pane rather than a hole.
        soft: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(0,0,0,0.35), 0 16px 40px -18px rgba(0,0,0,0.7)",
        lift: "inset 0 1px 0 rgba(255,255,255,0.16), 0 2px 4px rgba(0,0,0,0.35), 0 28px 64px -22px rgba(0,0,0,0.8)",
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
