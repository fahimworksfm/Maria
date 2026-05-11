import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireCoupled } from "@/lib/couple";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createPlaylist, exchangeCode, getMe } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const me = await requireCoupled();
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return redirectWithError(`Spotify: ${errorParam}`);
  if (!code || !state) return redirectWithError("Missing code/state");

  const c = await cookies();
  const cookieState = c.get("spotify_oauth_state")?.value;
  c.delete("spotify_oauth_state");
  if (!cookieState || cookieState !== state) return redirectWithError("State mismatch");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return redirectWithError("No refresh token returned");

    const profile = await getMe(tokens.access_token);

    // If the couple already has a playlist, keep it. Otherwise create one.
    const admin = supabaseAdmin();
    const { data: existing } = await admin
      .from("couples")
      .select("spotify_playlist_id")
      .eq("id", me.coupleId)
      .single();

    let playlistId = existing?.spotify_playlist_id ?? null;
    if (!playlistId) {
      const playlist = await createPlaylist(tokens.access_token, profile.id, "Tether — Our Songs");
      playlistId = playlist.id;
    }

    await admin
      .from("couples")
      .update({
        spotify_refresh_token: tokens.refresh_token,
        spotify_playlist_id: playlistId,
        spotify_connected_by: me.userId,
        spotify_user_name: profile.display_name ?? profile.id,
        spotify_connected_at: new Date().toISOString(),
      })
      .eq("id", me.coupleId);

    return NextResponse.redirect(new URL("/songs?connected=1", url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return redirectWithError(msg);
  }

  function redirectWithError(message: string) {
    return NextResponse.redirect(new URL(`/songs?error=${encodeURIComponent(message)}`, url));
  }
}
