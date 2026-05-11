import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireCoupled } from "@/lib/couple";
import { authorizeUrl, spotifyConfigured } from "@/lib/spotify";

export async function GET() {
  await requireCoupled();
  if (!spotifyConfigured()) {
    return NextResponse.json({ error: "Spotify is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET." }, { status: 400 });
  }
  const state = randomBytes(16).toString("hex");
  const c = await cookies();
  c.set("spotify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
  return NextResponse.redirect(authorizeUrl(state));
}
