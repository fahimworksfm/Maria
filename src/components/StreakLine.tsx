// A single quiet line: "12 days, together".
// Intentionally understated — no big number, no "don't break it!".
// Renders nothing below 2 days so it only appears once it means something.
export default function StreakLine({ days, className = "" }: { days: number; className?: string }) {
  if (days < 2) return null;
  return <span className={`text-xs text-muted ${className}`}>{days} days, together</span>;
}
