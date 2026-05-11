import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { searchTracks, tokenForCouple } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const me = await requireCoupled();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ items: [] });
  const tok = await tokenForCouple(me.coupleId);
  if (!tok) return NextResponse.json({ error: "Not connected" }, { status: 400 });
  try {
    const items = await searchTracks(tok.accessToken, q);
    return NextResponse.json({
      items: items.map((t) => ({
        id: t.id,
        uri: t.uri,
        name: t.name,
        url: t.external_urls?.spotify ?? null,
        artists: t.artists.map((a) => a.name).join(", "),
        image: t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
