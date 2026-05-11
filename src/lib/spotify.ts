import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const SPOTIFY_SCOPES = [
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-private",
].join(" ");

export function spotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export function redirectUri(): string {
  return `${env.siteUrl().replace(/\/$/, "")}/api/spotify/callback`;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "true",
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in: number;
  refresh_token?: string;
};

async function basicAuthHeader(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID!;
  const secret = process.env.SPOTIFY_CLIENT_SECRET!;
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: await basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: await basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

// Fetches a fresh access token for the couple. Returns null if not connected.
export async function tokenForCouple(coupleId: string): Promise<{ accessToken: string; playlistId: string | null } | null> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("couples")
    .select("spotify_refresh_token, spotify_playlist_id")
    .eq("id", coupleId)
    .single();
  if (!data?.spotify_refresh_token) return null;
  const tok = await refreshAccessToken(data.spotify_refresh_token);
  // Spotify may rotate refresh tokens; persist if a new one comes back.
  if (tok.refresh_token && tok.refresh_token !== data.spotify_refresh_token) {
    await admin.from("couples").update({ spotify_refresh_token: tok.refresh_token }).eq("id", coupleId);
  }
  return { accessToken: tok.access_token, playlistId: data.spotify_playlist_id ?? null };
}

// Spotify API helpers
async function api<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type SpotifyUser = { id: string; display_name: string | null };
export async function getMe(accessToken: string): Promise<SpotifyUser> {
  return api<SpotifyUser>(accessToken, "/me");
}

export async function createPlaylist(accessToken: string, userId: string, name: string): Promise<{ id: string }> {
  return api<{ id: string }>(accessToken, `/users/${encodeURIComponent(userId)}/playlists`, {
    method: "POST",
    body: JSON.stringify({ name, description: "Songs for us · Tether", public: false }),
  });
}

export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  external_urls: { spotify: string };
  artists: Array<{ name: string }>;
  album?: { images?: Array<{ url: string }> };
};

export async function searchTracks(accessToken: string, q: string): Promise<SpotifyTrack[]> {
  type R = { tracks: { items: SpotifyTrack[] } };
  const data = await api<R>(accessToken, `/search?q=${encodeURIComponent(q)}&type=track&limit=8`);
  return data.tracks?.items ?? [];
}

export async function addToPlaylist(accessToken: string, playlistId: string, uri: string): Promise<void> {
  await api<void>(accessToken, `/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ uris: [uri] }),
  });
}
