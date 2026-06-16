import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";

export const dynamic = "force-dynamic";

// Free geocoding via OpenStreetMap Nominatim, proxied so we can set a proper
// User-Agent and keep the policy-compliant (low volume, two users).
export async function GET(req: NextRequest) {
  await requireCoupled();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ results: [] });
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Tether/1.0 (couples app; contact via app)", Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    const raw = (await res.json()) as Array<{ display_name: string; lat: string; lon: string; name?: string }>;
    const results = raw.map((r) => ({
      label: r.display_name,
      name: r.name || r.display_name.split(",")[0],
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
