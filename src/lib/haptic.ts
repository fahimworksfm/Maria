// Tiny haptic helper. Wraps navigator.vibrate so callers don't have to guard.
// Works on Android + Chrome on most platforms. iOS Safari does not support the
// Vibration API at all, so iOS users rely on visual feedback instead.

export function tap(pattern: number | readonly number[] = 8) {
  if (typeof navigator === "undefined") return;
  const n = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof n.vibrate !== "function") return;
  try { n.vibrate(Array.isArray(pattern) ? [...pattern] : (pattern as number)); } catch {}
}

export const HAPTIC = {
  tick: 6,
  tap: 12,
  pop: 20,
  thud: [25, 30, 25],
  pulse: [200, 80, 200, 80, 300],
  success: [12, 60, 30],
} as const;
