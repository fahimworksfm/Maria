import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { tmdbEnabled, tmdbRuntime, type WatchKind } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

// Runtime for one chosen title. Null is a fine answer — the field stays empty.
export async function GET(req: NextRequest) {
  await requireCoupled();
  if (!tmdbEnabled()) return NextResponse.json({ runtime: null });

  const id = Number(req.nextUrl.searchParams.get("id"));
  const kind: WatchKind = req.nextUrl.searchParams.get("kind") === "show" ? "show" : "movie";
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ runtime: null });

  return NextResponse.json({ runtime: await tmdbRuntime(id, kind) });
}
