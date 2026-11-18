"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AmbientVideo from "@/components/AmbientVideo";

export default function Celebration({ names }: { names: string[] }) {
  const router = useRouter();
  const [reduced, setReduced] = useState(false);
  // The bloom only shows in dark mode, so in light mode it should not be downloaded.
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
    // plays no video. The advance now waits well past that, so there is time to
    // choose "Turn on notifications"; a tap anywhere still skips.
    const t = setTimeout(() => router.replace("/home"), reducedNow ? 6000 : 8000);
    return () => clearTimeout(t);
  }, [router]);

  const label = names.length === 2 ? `${names[0]} & ${names[1]}` : names.join(" & ") || "You two";

  return (
    <main
      className={`celebrate ${reduced ? "reduced" : ""}`}
      onClick={() => router.replace("/home")}
    >
      {inkMode && <AmbientVideo src="/media/welcome-bloom.mp4" className="celebrate-bloom" loop={false} />}

      {/* Two messages meeting: theirs from the left, yours from the right,
          then the line that says the thread is open. */}
      <div className="celebrate-thread" aria-hidden>
        <div className="bubble bubble-them tether-left">{names[0] ?? "One of you"}</div>
        <div className="bubble bubble-me tether-right">{names[1] ?? "The other"}</div>
      </div>

      <div>
        <h1 className="names text-3xl sm:text-4xl font-bold tracking-[-0.02em]">{label}</h1>
        <p className="kicker text-muted mt-2 text-[15px]">You&apos;re tethered. Welcome to your space.</p>
        {/* Tapping anywhere continues; these two are the same choices for
            keyboards and screen readers, plus the one setup step worth doing first. */}
        <div className="kicker mt-5 flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Link href="/profile#notifications" className="btn btn-primary">Turn on notifications</Link>
          <button type="button" className="btn btn-ghost text-muted" onClick={() => router.replace("/home")}>Continue to your space</button>
        </div>
      </div>
    </main>
  );
}
