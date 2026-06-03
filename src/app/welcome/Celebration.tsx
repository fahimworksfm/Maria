"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Celebration({ names }: { names: string[] }) {
  const router = useRouter();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // The CSS @media(prefers-reduced-motion) backstop already forces the final
    // frame visually; this just shortens the auto-advance for those users.
    const reducedNow =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    setReduced(reducedNow);
    const t = setTimeout(() => router.replace("/home"), reducedNow ? 1400 : 3000);
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
      <svg viewBox="0 0 512 512" aria-hidden className="cord-glow">
        <defs>
          <linearGradient id="cordGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97373" />
            <stop offset="50%" stopColor="#f9c873" />
            <stop offset="100%" stopColor="#a87bff" />
          </linearGradient>
          <radialGradient id="knotA" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#ffb2b2" />
            <stop offset="100%" stopColor="#ff6a6a" />
          </radialGradient>
          <radialGradient id="knotB" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#e0c0ff" />
            <stop offset="100%" stopColor="#9a6cee" />
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
          stroke="#ffffff"
          strokeOpacity={0.7}
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
