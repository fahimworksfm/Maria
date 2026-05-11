import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addToPlaylist, spotifyConfigured, tokenForCouple } from "@/lib/spotify";
import SongSearch from "./SongSearch";

export default async function SongsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const me = await requireCoupled();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("songs")
    .select("id, title, artist, spotify_url, why, created_at")
    .eq("couple_id", me.coupleId)
    .order("created_at", { ascending: false });

  // Read connection info via admin (refresh_token must never be exposed).
  const admin = supabaseAdmin();
  const { data: coupleRow } = await admin
    .from("couples")
    .select("spotify_user_name, spotify_playlist_id, spotify_connected_by")
    .eq("id", me.coupleId)
    .single();
  const connected = Boolean(coupleRow?.spotify_playlist_id);

  async function addManual(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    await supabase.from("songs").insert({
      couple_id: me.coupleId,
      title,
      artist: String(formData.get("artist") || "").trim() || null,
      spotify_url: String(formData.get("spotify_url") || "").trim() || null,
      why: String(formData.get("why") || "").trim() || null,
    });
    revalidatePath("/songs");
  }

  async function addFromSpotify(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const uri = String(formData.get("uri") || "");
    const title = String(formData.get("title") || "").trim();
    const artist = String(formData.get("artist") || "").trim();
    const url = String(formData.get("url") || "").trim();
    const why = String(formData.get("why") || "").trim();
    if (!uri || !title) return;
    const tok = await tokenForCouple(me.coupleId);
    if (!tok?.playlistId) return;
    await addToPlaylist(tok.accessToken, tok.playlistId, uri);
    const supabase = await supabaseServer();
    await supabase.from("songs").insert({
      couple_id: me.coupleId,
      title,
      artist: artist || null,
      spotify_url: url || null,
      why: why || null,
    });
    revalidatePath("/songs");
  }

  async function deleteSong(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("songs").delete().eq("id", id);
    revalidatePath("/songs");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Our Songs</h1>
        <p className="muted">A playlist with stories.</p>
      </header>

      {sp.connected === "1" && <p className="card p-3 text-sm">Spotify connected. A private Tether playlist was created on your account.</p>}
      {sp.error && <p className="card p-3 text-sm text-accent">{sp.error}</p>}

      {!spotifyConfigured() ? (
        <div className="card p-4 text-sm muted">
          To enable Spotify search and a shared playlist, set <code>SPOTIFY_CLIENT_ID</code> and <code>SPOTIFY_CLIENT_SECRET</code> in your env.
        </div>
      ) : connected ? (
        <div className="card p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="font-medium">Connected to Spotify</div>
              <div className="muted text-xs">via {coupleRow?.spotify_user_name ?? "your partner"}{coupleRow?.spotify_connected_by === me.userId ? " (you)" : ""}</div>
            </div>
            <form action="/api/spotify/disconnect" method="post">
              <button className="btn btn-ghost text-xs" type="submit">Disconnect</button>
            </form>
          </div>
          <a className="btn btn-ghost text-xs" href={`https://open.spotify.com/playlist/${coupleRow?.spotify_playlist_id}`} target="_blank" rel="noreferrer">
            Open playlist in Spotify
          </a>
          <SongSearch addAction={addFromSpotify} />
        </div>
      ) : (
        <div className="card p-4 space-y-2">
          <p className="text-sm">Connect Spotify to search tracks and build a shared playlist that adds songs automatically.</p>
          <a className="btn btn-primary" href="/api/spotify/connect">Connect Spotify</a>
        </div>
      )}

      <form action={addManual} className="card p-4 space-y-2">
        <h3 className="label">Add manually</h3>
        <input className="input" name="title" placeholder="Song title" required />
        <input className="input" name="artist" placeholder="Artist" />
        <input className="input" name="spotify_url" placeholder="Spotify URL (optional)" />
        <textarea className="input" name="why" rows={2} placeholder="Why this song made it in" />
        <button className="btn w-full" type="submit">Save</button>
      </form>

      <section className="space-y-2">
        {(rows ?? []).map((s) => (
          <div key={s.id} className="card p-3">
            <div className="flex justify-between items-baseline gap-2">
              <div className="font-medium">{s.title}{s.artist ? ` · ${s.artist}` : ""}</div>
              <div className="flex gap-2 items-baseline">
                {s.spotify_url && <a className="muted text-xs underline" href={s.spotify_url} target="_blank" rel="noreferrer">Play</a>}
                <form action={deleteSong}><input type="hidden" name="id" value={s.id} /><button className="btn btn-ghost text-xs" type="submit">×</button></form>
              </div>
            </div>
            {s.why && <p className="text-sm muted">{s.why}</p>}
          </div>
        ))}
        {rows && rows.length === 0 && <p className="muted">No songs yet.</p>}
      </section>
    </div>
  );
}
