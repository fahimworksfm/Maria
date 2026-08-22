// Current conditions from Open-Meteo (open-meteo.com) — no API key, free for
// non-commercial use. Fahrenheit to match the miles used elsewhere in Together.

export type Weather = {
  tempF: number;
  code: number;
  isDay: boolean;
  label: string;
  emoji: string;
};

// WMO weather interpretation codes, as documented by Open-Meteo.
export function describeWeather(code: number, isDay: boolean): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear", emoji: isDay ? "☀️" : "🌙" };
  if (code === 1) return { label: "Mostly clear", emoji: isDay ? "🌤️" : "🌙" };
  if (code === 2) return { label: "Partly cloudy", emoji: isDay ? "⛅" : "☁️" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Foggy", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "Showers", emoji: "🌦️" };
  if (code === 85 || code === 86) return { label: "Snow showers", emoji: "🌨️" };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "—", emoji: "🌡️" };
}

const TIMEOUT_MS = 3500;

export async function fetchWeather(lat: number | null, lng: number | null): Promise<Weather | null> {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Round to ~110m. Identical URLs across renders share the fetch data cache,
  // which keeps our request volume at a trickle.
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    `&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit`;

  try {
    // Weather is decoration — a slow Open-Meteo must never hold up the page.
    const res = await Promise.race([
      fetch(url, { next: { revalidate: 900 } }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!res || !res.ok) return null;

    const json = (await res.json()) as { current?: { temperature_2m?: unknown; weather_code?: unknown; is_day?: unknown } };
    const cur = json.current;
    if (!cur || typeof cur.temperature_2m !== "number" || typeof cur.weather_code !== "number") return null;

    const isDay = cur.is_day === 1;
    const code = cur.weather_code;
    return { tempF: Math.round(cur.temperature_2m), code, isDay, ...describeWeather(code, isDay) };
  } catch {
    return null;
  }
}
