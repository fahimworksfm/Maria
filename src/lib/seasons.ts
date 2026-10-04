// Seasonal chapters for the Year in Review.

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";

export type Season = { key: SeasonKey; label: string; months: number[]; plate: string };

/**
 * Display order runs spring → winter so the year ends in December, which is how
 * a year in review wants to read. January and February fold into the same
 * winter chapter: within a single calendar year there is nowhere else for them,
 * and splitting winter in two would be worse.
 */
export const SEASONS: Season[] = [
  { key: "spring", label: "Spring", months: [2, 3, 4], plate: "/media/year-spring.webp" },
  { key: "summer", label: "Summer", months: [5, 6, 7], plate: "/media/year-summer.webp" },
  { key: "autumn", label: "Autumn", months: [8, 9, 10], plate: "/media/year-autumn.webp" },
  { key: "winter", label: "Winter", months: [11, 0, 1], plate: "/media/year-winter.webp" },
];

/**
 * Month index from a date-only string, read from the text rather than parsed
 * into a Date. `new Date("2026-03-01")` is UTC midnight, which in any western
 * timezone reports as February — that would quietly file memories under the
 * wrong chapter.
 */
export function monthOfISODate(value: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? month - 1 : null;
}

export function seasonOfMonth(month: number): SeasonKey | null {
  return SEASONS.find((s) => s.months.includes(month))?.key ?? null;
}

export function seasonOfISODate(value: string | null | undefined): SeasonKey | null {
  const month = monthOfISODate(value);
  return month == null ? null : seasonOfMonth(month);
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Mar" — again from the string, for the same timezone reason. */
export function shortDate(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  const month = monthOfISODate(value);
  if (!m || month == null) return null;
  return `${Number(m[3])} ${MONTH_SHORT[month]}`;
}
