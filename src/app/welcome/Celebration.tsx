"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AmbientVideo from "@/components/AmbientVideo";

export default function Celebration({ names }: { names: string[] }) {
  const router = useRouter();
  const [reduced, setReduced] = useState(false);
  // The bloom is only visible in Ink, so on Paper it should not be downloaded.
  const [inkMode, setInkMode] = useState(false);

  useEffect(() => {
    // The CSS @media(prefers-reduced-motion) backstop already forces the final
    // frame visually; this just shortens the auto-advance for those users.
    const reducedNow =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    setReduced(reducedNow);
    setInkMode(document.documentElement.getAttribute("data-mode") === "dark");
    // 4.2s rather than 3s: the bloom runs 4.01s and its tail — settling back to
    // dark — is what makes the moment land instead of cutting. Reduced motion
    // plays no video and keeps the short advance. A tap still skips either way.
    const t = setTimeout(() => router.replace("/home"), reducedNow ? 1400 : 4200);
    return () => clearTimeout(t);
  }, [router]);

  const label = names.length === 2 ? `${names[0]} & ${names[1]}` : names.join(" & ") || "You two";

  return (
    <main
      className={`celebrate ${reduced ? "reduced" : ""}`}
      onClick={() => router.replace("/home")}
      role="button"
      aria-label="Continue to your space"
    >
      {inkMode && <AmbientVideo src="/media/welcome-bloom.mp4" className="celebrate-bloom" loop={false} />}

      <svg viewBox="0 0 512 512" aria-hidden className="cord-glow">
        <defs>
          <linearGradient id="cordGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--c-accent-ink)" />
            <stop offset="55%" stopColor="var(--c-accent-ink)" />
            <stop offset="100%" stopColor="rgb(var(--c-ink))" />
          </linearGradient>
          <radialGradient id="knotA" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="var(--c-accent-ink)" />
            <stop offset="100%" stopColor="var(--c-accent-ink)" />
          </radialGradient>
          <radialGradient id="knotB" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="rgb(var(--c-ink))" />
            <stop offset="100%" stopColor="rgb(var(--c-ink))" />
          </radialGradient>
        </defs>

        {/* the tether being drawn between two knots */}
        <path
          className="cord"
          pathLength={1}
          d="M 152 360 C 180 248, 220 220, 256 256 C 292 292, 332 264, 360 152"
          fill="none"
          stroke="url(#cordGrad)"
          strokeWidth={36}
          strokeLinecap="round"
        />
        {/* shine sweep */}
        <path
          className="shine"
          pathLength={1}
          d="M 152 360 C 180 248, 220 220, 256 256 C 292 292, 332 264, 360 152"
          fill="none"
          stroke="rgb(var(--c-surface))"
          strokeOpacity={0.55}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <circle className="knot knot-a" cx="152" cy="360" r="46" fill="url(#knotA)" />
        <circle className="knot knot-b" cx="360" cy="152" r="46" fill="url(#knotB)" />
      </svg>

      <div>
        <h1 className="names font-display text-3xl sm:text-4xl">{label}</h1>
        <p className="kicker muted mt-2 text-sm">You&apos;re tethered. Welcome to your space.</p>
      </div>
    </main>
  );
}
