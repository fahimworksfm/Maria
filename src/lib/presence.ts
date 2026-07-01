// Pure helpers for the Together module: inferred availability from a one-time
// daily rhythm (no daily tapping), great-circle distance, countdown + last-seen
// formatting, and a "when are you both free" hint. All timezone-aware via Intl.

export type Rhythm = {
  timezone: string; // IANA, e.g. "America/New_York"
  wakeHour: number; // 0-23 local
  sleepHour: number; // 0-23 local
  workStartHour: number | null;
  workEndHour: number | null;
};

export const DEFAULT_RHYTHM = {
  timezone: "America/New_York",
  wakeHour: 7,
  sleepHour: 23,
  workStartHour: 9,
  workEndHour: 18,
} satisfies Rhythm;

// Seed coordinates so distance works out-of-the-box for the two of you; any other
// city gets geocoded on save. Keys are lower-cased, trimmed city strings.
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "charlotte": { lat: 35.2271, lng: -80.8431 },
  "charlotte, nc": { lat: 35.2271, lng: -80.8431 },
  "queens": { lat: 40.7282, lng: -73.7949 },
  "queens, ny": { lat: 40.7282, lng: -73.7949 },
  "queens, nyc": { lat: 40.7282, lng: -73.7949 },
  "new york": { lat: 40.7128, lng: -74.006 },
  "new york, ny": { lat: 40.7128, lng: -74.006 },
  "nyc": { lat: 40.7128, lng: -74.006 },
};

export function coordsForCity(city: string | null | undefined): { lat: number; lng: number } | null {
  if (!city) return null;
  return CITY_COORDS[city.trim().toLowerCase()] ?? null;
}

// Current local time in a timezone, as a fractional hour (0–24).
export function localHour(now: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return (h % 24) + m / 60;
  } catch {
    return now.getHours() + now.getMinutes() / 60;
  }
}

export function clockLabel(now: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(now);
  } catch {
    return "";
  }
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The calendar day in a given timezone, as "YYYY-MM-DD" — for today/tomorrow
// comparisons that must respect local midnight, not UTC.
export function localDay(d: Date, tz: string): string {
  try {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const g: Record<string, string> = {};
    for (const x of p) g[x.type] = x.value;
    return `${g.year}-${g.month}-${g.day}`;
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// Is `h` inside the window [start, end), allowing wrap past midnight (e.g. 23→7)?
function inWindow(h: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? h >= start && h < end : h >= start || h < end;
}

export type Status = {
  key: "asleep" | "morning" | "work" | "evening" | "free";
  label: string;
  emoji: string;
  free: boolean;
};

export function inferStatus(now: Date, r: Rhythm): Status {
  const h = localHour(now, r.timezone);
  if (inWindow(h, r.sleepHour, r.wakeHour)) return { key: "asleep", label: "Probably asleep", emoji: "🌙", free: false };
  // First ~1.5h after waking — the passive "good morning" window.
  if (h >= r.wakeHour && h < r.wakeHour + 1.5) return { key: "morning", label: "Just up — good morning", emoji: "☀️", free: true };
  if (r.workStartHour != null && r.workEndHour != null && inWindow(h, r.workStartHour, r.workEndHour))
    return { key: "work", label: "Usually working", emoji: "💼", free: false };
  // Last hour before sleep — the passive "good night" wind-down.
  if (h >= r.sleepHour - 1 && h < r.sleepHour) return { key: "evening", label: "Winding down", emoji: "🌆", free: true };
  return { key: "free", label: "Likely free", emoji: "🟢", free: true };
}

// A friendly "when are you both free" hint, computed by scanning ahead.
export function bothFreeHint(now: Date, mine: Rhythm, theirs: Rhythm): string | null {
  if (inferStatus(now, mine).free && inferStatus(now, theirs).free) return "You're both likely free right now — good time to call.";
  for (let step = 1; step <= 48; step++) {
    const t = new Date(now.getTime() + step * 30 * 60_000);
    if (inferStatus(t, mine).free && inferStatus(t, theirs).free) {
      const when = clockLabel(t, mine.timezone);
      const soon = step <= 2 ? "soon" : localDay(t, mine.timezone) === localDay(now, mine.timezone) ? "later today" : "tomorrow";
      return `You're both likely free ${soon}, around ${when}.`;
    }
  }
  return null;
}

const R_MILES = 3958.8;
export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(s)));
}

// "here now" if active within the last ~2 minutes; else a soft last-seen label.
export function activeNow(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  return now.getTime() - new Date(iso).getTime() < 2 * 60_000;
}

export function lastSeenLabel(iso: string | null | undefined, now: Date): string {
  if (!iso) return "no activity yet";
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "active just now";
  if (mins < 60) return `active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `active ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "active yesterday" : `active ${days}d ago`;
}

// Convert a naive <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm"),
// understood as wall-clock time in `tz`, to a UTC ISO string (DST-correct).
export function zonedToUtcISO(naive: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(naive);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi);
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcGuess));
    const g: Record<string, string> = {};
    for (const p of parts) g[p.type] = p.value;
    let hh = Number(g.hour); if (hh === 24) hh = 0;
    const asTz = Date.UTC(Number(g.year), Number(g.month) - 1, Number(g.day), hh, Number(g.minute), Number(g.second));
    return new Date(utcGuess - (asTz - utcGuess)).toISOString();
  } catch {
    return null;
  }
}

// Inverse: a stored UTC ISO → the datetime-local value that shows the wall-clock
// time in `tz` (for prefilling the edit form).
export function utcToZonedInput(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
    const g: Record<string, string> = {};
    for (const p of parts) g[p.type] = p.value;
    const hh = g.hour === "24" ? "00" : g.hour;
    return `${g.year}-${g.month}-${g.day}T${hh}:${g.minute}`;
  } catch {
    return "";
  }
}

export type Countdown = { done: boolean; days: number; hours: number; mins: number; secs: number };
export function countdownTo(iso: string | null | undefined, now: Date): Countdown | null {
  if (!iso) return null;
  let diff = new Date(iso).getTime() - now.getTime();
  if (diff <= 0) return { done: true, days: 0, hours: 0, mins: 0, secs: 0 };
  const days = Math.floor(diff / 86_400_000); diff -= days * 86_400_000;
  const hours = Math.floor(diff / 3_600_000); diff -= hours * 3_600_000;
  const mins = Math.floor(diff / 60_000); diff -= mins * 60_000;
  const secs = Math.floor(diff / 1_000);
  return { done: false, days, hours, mins, secs };
}
