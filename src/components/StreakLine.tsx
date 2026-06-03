// A single quiet line with a candle motif: "🕯️ 12 days, together".
// Intentionally understated — no big number, no colour, no "don't break it!".
// Renders nothing below 2 days so it only appears once it means something.
export default function StreakLine({ days, className = "" }: { days: number; className?: string }) {
  if (days < 2) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm text-muted ${className}`}>
      <span className="text-amber-300/80" aria-hidden>🕯️</span>
      <span>{days} days, together</span>
    </span>
  );
}
