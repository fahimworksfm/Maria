"use client";

import { useEffect, useState } from "react";

type Connection = { saveData?: boolean; effectiveType?: string };

/**
 * A decorative looping video layered behind the page.
 *
 * It is an enhancement, never the design: nothing is fetched until we know the
 * viewer wants it, and the video only fades in once it is genuinely playing. If
 * autoplay is refused — iOS blocks it outright in Low Power Mode — `playing`
 * never fires, the layer stays transparent, and the CSS gradients underneath
 * carry the page exactly as they did before. That is also why there is no
 * poster: the finished-looking fallback is already on screen.
 */
export default function AmbientVideo({
  src,
  className = "",
  loop = true,
}: {
  src: string;
  /** Base class for this surface — it owns the positioning and opacity. */
  className?: string;
  loop?: boolean;
}) {
  const [allowed, setAllowed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // Don't spend someone's metered data on decoration.
    const conn = (navigator as unknown as { connection?: Connection }).connection;
    const thrifty = Boolean(conn?.saveData) || /(^|-)2g$/.test(conn?.effectiveType ?? "");
    setAllowed(!calm && !thrifty);
  }, []);

  if (!allowed) return null;

  return (
    <video
      className={`${className} ${playing ? "is-visible" : ""}`}
      src={src}
      autoPlay
      muted
      loop={loop}
      playsInline
      preload="auto"
      aria-hidden
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
    />
  );
}
