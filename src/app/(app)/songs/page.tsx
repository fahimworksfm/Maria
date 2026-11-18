import { ClaimForm } from "@/components/ClaimButtons";
import { claimRow, insertAuthored, isClaimWho, partnerNameFor, sideClass, sideName, sideOf } from "@/lib/authorship";
import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addToPlaylist, spotifyConfigured, tokenForCouple } from "@/lib/spotify";
import SongSearch from "./SongSearch";
import SubmitButton from "@/components/SubmitButton";
import { Music, X } from "lucide-react";

export default async function SongsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const me = await requireCoupled();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("songs")
    .select("*") // includes author_id once migration 0014 has run
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
    await insertAuthored(supabase, "songs", {
      couple_id: me.coupleId,
      title,
      artist: String(formData.get("artist") || "").trim() || null,
      spotify_url: String(formData.get("spotify_url") || "").trim() || null,
      why: String(formData.get("why") || "").trim() || null,
    }, me.userId);
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
    await insertAuthored(supabase, "songs", {
      couple_id: me.coupleId,
      title,
      artist: artist || null,
      spotify_url: url || null,
      why: why || null,
    }, me.userId);
    revalidatePath("/songs");
  }

  async function deleteSong(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("songs").delete().eq("id", id);
    revalidatePath("/songs");
  }

  async function updateSong(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const id = String(formData.get("id") || "");
    const title = String(formData.get("title") || "").trim();
    if (!id || !title) return;
    const supabase = await supabaseServer();
    await supabase
      .from("songs")
      .update({
        title,
        artist: String(formData.get("artist") || "").trim() || null,
        spotify_url: String(formData.get("spotify_url") || "").trim() || null,
        why: String(formData.get("why") || "").trim() || null,
      })
      .eq("id", id)
      .eq("couple_id", me.coupleId);
    revalidatePath("/songs");
  }

  async function claim(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const who = formData.get("who");
    if (!isClaimWho(who)) return;
    const supabase = await supabaseServer();
    await claimRow(supabase, "songs", String(formData.get("id") || ""), who, me);
    revalidatePath("/songs");
  }

  const partnerName = await partnerNameFor(supabase, me.userId);
  const side = (a: unknown) => sideOf(a, me.userId);
  const who = (a: unknown) => sideName(side(a), partnerName);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Our Songs</h1>
        <p className="muted">A playlist with stories.</p>
      </header>

      {sp.connected === "1" && <p className="card p-3 text-sm">Spotify connected. A private Tether playlist was created on your account.</p>}
      {sp.error && <p className="card p-3 text-sm font-semibold text-accentInk" role="alert">{sp.error}</p>}

      {!spotifyConfigured() ? (
        <div className="card p-4 muted">
          To enable Spotify search and a shared playlist, set <code>SPOTIFY_CLIENT_ID</code> and <code>SPOTIFY_CLIENT_SECRET</code> in your env.
        </div>
      ) : connected ? (
        <div className="card p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="font-semibold">Connected to Spotify</div>
              <div className="text-muted text-[13px]">via {coupleRow?.spotify_user_name ?? "your partner"}{coupleRow?.spotify_connected_by === me.userId ? " (you)" : ""}</div>
            </div>
            <form action="/api/spotify/disconnect" method="post">
              <button className="btn btn-ghost text-sm" type="submit">Disconnect</button>
            </form>
          </div>
          <a className="btn btn-ghost text-sm" href={`https://open.spotify.com/playlist/${coupleRow?.spotify_playlist_id}`} target="_blank" rel="noreferrer">
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
        <input className="input" name="title" placeholder="Song title" aria-label="Song title" required />
        <input className="input" name="artist" placeholder="Artist" aria-label="Artist" />
        <input className="input" name="spotify_url" placeholder="Spotify URL (optional)" aria-label="Spotify URL" />
        <textarea className="input" name="why" rows={2} placeholder="Why this song made it in" aria-label="Why this song made it in" />
        <SubmitButton className="btn w-full">Save</SubmitButton>
      </form>

      <section className="space-y-2">
        {(rows ?? []).map((s) => (
          <div key={s.id} className={`card px-4 py-3 space-y-1 ${sideClass(side(s.author_id))}`}>
            {who(s.author_id) && <div className="text-xs text-muted mb-0.5">{who(s.author_id)}</div>}
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-panel2 text-accentInk" aria-hidden><Music size={17} /></span>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.title}</div>
                  {s.artist && <div className="text-muted text-[13px] truncate">{s.artist}</div>}
                </div>
              </div>
              <div className="flex gap-1 items-center shrink-0">
                {s.spotify_url && <a className="btn btn-ghost text-sm text-accentInk" href={s.spotify_url} target="_blank" rel="noreferrer">Play</a>}
                <form action={deleteSong}><input type="hidden" name="id" value={s.id} /><button className="grid place-items-center w-11 h-11 shrink-0 rounded-full text-muted hover:bg-panel2 hover:text-ink transition" type="submit" aria-label="Delete"><X size={16} aria-hidden /></button></form>
              </div>
            </div>
            {s.why && <p className="text-[15px] leading-snug pl-[52px]">{s.why}</p>}
            <div className="pl-[52px]">
              {!s.author_id && <ClaimForm action={claim} id={s.id} partnerName={partnerName} />}
              <details>
                <summary className="inline-flex items-center min-h-[44px] px-1 text-[13px] font-semibold text-muted cursor-pointer select-none hover:text-ink">Edit</summary>
                <form action={updateSong} className="space-y-2 pb-1">
                  <input type="hidden" name="id" value={s.id} />
                  <div>
                    <label className="label" htmlFor={`song-title-${s.id}`}>Song title</label>
                    <input id={`song-title-${s.id}`} className="input" name="title" defaultValue={s.title} required />
                  </div>
                  <div>
                    <label className="label" htmlFor={`song-artist-${s.id}`}>Artist</label>
                    <input id={`song-artist-${s.id}`} className="input" name="artist" defaultValue={s.artist ?? ""} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`song-why-${s.id}`}>Why it made it in</label>
                    <textarea id={`song-why-${s.id}`} className="input" name="why" rows={2} defaultValue={s.why ?? ""} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`song-url-${s.id}`}>Spotify URL</label>
                    <input id={`song-url-${s.id}`} className="input" name="spotify_url" defaultValue={s.spotify_url ?? ""} />
                  </div>
                  <SubmitButton className="btn w-full">Save changes</SubmitButton>
                </form>
              </details>
            </div>
          </div>
        ))}
        {rows && rows.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><Music size={20} aria-hidden /></div>
            <p className="font-bold text-lg pt-2">No songs yet.</p>
            <p className="muted">Add the first one in the form above, and say why it made it in.</p>
            <p className="text-muted text-[13px]">For example: the song that was playing on your first drive together.</p>
          </div>
        )}
      </section>
    </div>
  );
}
