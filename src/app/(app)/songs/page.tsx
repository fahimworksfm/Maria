import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SongsPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("songs")
    .select("id, title, artist, spotify_url, why, created_at")
    .eq("couple_id", me.coupleId)
    .order("created_at", { ascending: false });

  async function add(formData: FormData) {
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

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Our Songs</h1><p className="muted">A playlist with stories.</p></header>
      <form action={add} className="card p-4 space-y-2">
        <input className="input" name="title" placeholder="Song title" required />
        <input className="input" name="artist" placeholder="Artist" />
        <input className="input" name="spotify_url" placeholder="Spotify URL (optional)" />
        <textarea className="input" name="why" rows={2} placeholder="Why this song made it in" />
        <button className="btn btn-primary w-full" type="submit">Add</button>
      </form>
      <section className="space-y-2">
        {(rows ?? []).map((s) => (
          <div key={s.id} className="card p-3">
            <div className="flex justify-between items-baseline gap-2">
              <div className="font-medium">{s.title}{s.artist ? ` · ${s.artist}` : ""}</div>
              {s.spotify_url && <a className="muted text-xs underline" href={s.spotify_url} target="_blank" rel="noreferrer">Play</a>}
            </div>
            {s.why && <p className="text-sm muted">{s.why}</p>}
          </div>
        ))}
        {rows && rows.length === 0 && <p className="muted">No songs yet.</p>}
      </section>
    </div>
  );
}
