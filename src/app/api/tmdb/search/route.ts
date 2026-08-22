import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { tmdbEnabled, tmdbSearch, type WatchKind } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

// Proxied so TMDB_API_KEY stays server-side. Coupled-only, like /api/geocode.
export async function GET(req: NextRequest) {
  await requireCoupled();
  if (!tmdbEnabled()) return NextResponse.json({ results: [] });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const kind: WatchKind = req.nextUrl.searchParams.get("kind") === "show" ? "show" : "movie";
  if (q.length < 2) return NextResponse.json({ results: [] });

  return NextResponse.json({ results: await tmdbSearch(q, kind) });
}
