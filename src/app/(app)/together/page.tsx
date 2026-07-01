import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { coordsForCity, zonedToUtcISO } from "@/lib/presence";
import TogetherView, { type Person } from "./TogetherView";

// Best-effort geocode for any city that isn't in the seed list. The app already
// relies on free OSM/Nominatim elsewhere; failures just leave distance hidden.
async function geocodeCity(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Tether/1.0 (couples companion app)" },
      cache: "no-store",
    });
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (Array.isArray(arr) && arr[0]) return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
  } catch {
    /* ignore */
  }
  return null;
}

const hour = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) ? Math.max(0, Math.min(23, n)) : null;
};

export default async function TogetherPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();

  const [{ data: couple }, { data: profiles }] = await Promise.all([
    supabase.from("couples").select("next_visit_at, next_visit_label, next_visit_traveler").eq("id", me.coupleId).single(),
    supabase
      .from("profiles")
      .select("user_id, display_name, home_city, home_lat, home_lng, timezone, wake_hour, sleep_hour, work_start_hour, work_end_hour, last_active_at")
      .eq("couple_id", me.coupleId),
  ]);

  type Row = NonNullable<typeof profiles>[number];
  const toPerson = (r: Row | undefined | null): Person | null =>
    r
      ? {
          userId: r.user_id,
          name: r.display_name ?? null,
          city: r.home_city ?? null,
          lat: r.home_lat ?? null,
          lng: r.home_lng ?? null,
          timezone: r.timezone ?? null,
          wakeHour: r.wake_hour ?? null,
          sleepHour: r.sleep_hour ?? null,
          workStartHour: r.work_start_hour ?? null,
          workEndHour: r.work_end_hour ?? null,
          lastActiveAt: r.last_active_at ?? null,
        }
      : null;

  const mine = toPerson((profiles ?? []).find((p) => p.user_id === me.userId))!;
  const partner = toPerson((profiles ?? []).find((p) => p.user_id !== me.userId) ?? null);

  async function saveVisit(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const naive = String(formData.get("at") ?? "").trim();
    const tz = String(formData.get("tz") ?? "America/New_York") || "America/New_York";
    await supabase
      .from("couples")
      .update({
        next_visit_at: naive ? zonedToUtcISO(naive, tz) : null,
        next_visit_label: String(formData.get("label") ?? "").trim() || null,
        next_visit_traveler: String(formData.get("traveler") ?? "").trim() || null,
      })
      .eq("id", me.coupleId);
    revalidatePath("/together");
  }

  async function saveRhythm(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const city = String(formData.get("city") ?? "").trim() || null;
    const update: Record<string, unknown> = {
      home_city: city,
      timezone: String(formData.get("timezone") ?? "").trim() || null,
      wake_hour: hour(formData.get("wake_hour")),
      sleep_hour: hour(formData.get("sleep_hour")),
      work_start_hour: hour(formData.get("work_start_hour")),
      work_end_hour: hour(formData.get("work_end_hour")),
      updated_at: new Date().toISOString(),
    };
    const seed = coordsForCity(city);
    const geo = seed ?? (city ? await geocodeCity(city) : null);
    if (geo) {
      update.home_lat = geo.lat;
      update.home_lng = geo.lng;
    }
    await supabase.from("profiles").update(update).eq("user_id", me.userId);
    revalidatePath("/together");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Together</h1>
        <p className="muted">The distance, the countdown, and whether it&apos;s a good time to reach out.</p>
      </header>
      <TogetherView
        me={mine}
        partner={partner}
        nextVisit={{
          at: couple?.next_visit_at ?? null,
          label: couple?.next_visit_label ?? null,
          traveler: couple?.next_visit_traveler ?? null,
        }}
        saveVisit={saveVisit}
        saveRhythm={saveRhythm}
      />
    </div>
  );
}
