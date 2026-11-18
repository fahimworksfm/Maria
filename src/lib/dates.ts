// Friendly dates for things stored as date-only strings ("2026-11-08").
// Pure and dependency-free. Date-only strings are parsed as UTC, so the day
// never slips by one depending on where the server or the reader is.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

/** UTC midnight for the date part of an ISO string, or null if it isn't one. */
function utcDay(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ts) ? null : ts;
}

function utcToday(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** "Sunday 8 Nov", with the year added when it isn't this year. */
export function friendlyDate(iso: string | null | undefined, now: Date = new Date()): string {
  const ts = utcDay(iso);
  if (ts == null) return iso ?? "";
  const d = new Date(ts);
  const base = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === now.getUTCFullYear() ? base : `${base} ${d.getUTCFullYear()}`;
}

/**
 * "Today", "Yesterday", "3 days ago" for the last six days; otherwise the
 * friendly date. Future dates always get the friendly date.
 */
export function relativeDate(iso: string | null | undefined, now: Date = new Date()): string {
  const ts = utcDay(iso);
  if (ts == null) return iso ?? "";
  const days = Math.round((utcToday(now) - ts) / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days <= 6) return `${days} days ago`;
  return friendlyDate(iso, now);
}
