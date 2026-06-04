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

  let step = "exchanging the code";
  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return redirectWithError("No refresh token returned");

    step = "reading your profile";
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
      step = "creating the playlist";
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
    const raw = err instanceof Error ? err.message : "Unknown error";
    console.error(`[spotify callback] failed while ${step}:`, raw);
    return redirectWithError(friendlySpotifyError(raw, step));
  }

  function redirectWithError(message: string) {
    return NextResponse.redirect(new URL(`/songs?error=${encodeURIComponent(message)}`, url));
  }
}

// Turn raw Spotify API errors into a human sentence.
function friendlySpotifyError(raw: string, step?: string): string {
  const where = step ? ` (step: ${step})` : "";
  if (/\b403\b|forbidden/i.test(raw)) {
    return `Spotify blocked this account${where}. In Development Mode only allow-listed users work — add your Spotify account's email under User Management in the Spotify dashboard, remove the app at spotify.com/account/apps, then reconnect. Changes can take a few minutes.`;
  }
  if (/\b401\b|unauthorized|invalid_grant/i.test(raw)) {
    return `Spotify sign-in expired before we finished${where}. Please tap Connect Spotify again.`;
  }
  if (/\b429\b/.test(raw)) {
    return "Spotify is rate-limiting right now. Give it a minute and try again.";
  }
  return `Couldn't connect Spotify${where}. Please try again.`;
}
