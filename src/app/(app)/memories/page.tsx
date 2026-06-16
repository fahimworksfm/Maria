import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, signedUrl, userScopedPath } from "@/lib/media";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import { Images, MapPin, Quote } from "lucide-react";

type Memory = {
  id: string;
  title: string | null;
  body: string | null;
  media_url: string | null;
  media_type: "image" | "audio" | "video" | null;
  happened_on: string | null;
  location_name: string | null;
  author_id: string;
  created_at: string;
};

export default async function MemoriesPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("memories")
    .select("id, title, body, media_url, media_type, happened_on, location_name, author_id, created_at")
    .eq("couple_id", me.coupleId)
    .order("happened_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const items: Array<Memory & { signed: string | null }> = await Promise.all(
    (rows ?? []).map(async (m) => ({ ...m, signed: m.media_url ? await signedUrl(supabase, m.media_url) : null }))
  );

  // Partner name for "by Maria" attribution
  const { data: partner } = await supabase
    .from("profiles")
    .select("display_name")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();
  const partnerName = partner?.display_name ?? "partner";

  async function addMemory(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const title = String(formData.get("title") || "").trim() || null;
    const body = String(formData.get("body") || "").trim() || null;
    const happened = String(formData.get("happened_on") || "") || null;
    const location = String(formData.get("location_name") || "").trim() || null;

    let media_url: string | null = null;
    let media_type: Memory["media_type"] = null;
    const file = formData.get("media") as File | null;
    if (file && typeof file === "object" && file.size > 0) {
      const path = userScopedPath(me.userId, file.name || "upload");
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;
      media_url = path;
      media_type = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : null;
    }

    const { error } = await supabase.from("memories").insert({
      couple_id: me.coupleId,
      author_id: me.userId,
      title,
      body,
      media_url,
      media_type,
      happened_on: happened,
      location_name: location,
    });
    if (error) throw error;
    revalidatePath("/memories");
  }

  async function deleteMemory(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    if (!id) return;
    const supabase = await supabaseServer();
    await supabase.from("memories").delete().eq("id", id);
    revalidatePath("/memories");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Memory Jar</h1>
        <p className="muted">Drop in a moment whenever it happens.</p>
      </header>

      <form action={addMemory} className="card p-4 space-y-3" encType="multipart/form-data">
        <input className="input" name="title" placeholder="Title (optional)" />
        <textarea className="input" name="body" placeholder="What happened?" rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input className="input" name="happened_on" type="date" />
          </div>
          <div>
            <label className="label">Place</label>
            <input className="input" name="location_name" placeholder="e.g. our kitchen" />
          </div>
        </div>
        <div>
          <label className="label">Photo, audio or video (optional)</label>
          <input className="input" name="media" type="file" accept="image/*,audio/*,video/*" />
        </div>
        <SubmitButton className="btn btn-primary w-full">Save memory</SubmitButton>
      </form>

      <section className="space-y-6">
        {items.length === 0 && (
          <div className="card p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 text-accent grid place-items-center">
              <Images size={22} aria-hidden />
            </div>
            <p className="font-display text-lg">Drop your first moment.</p>
            <p className="muted text-sm">A photo, a voice note, a sentence — anything you&apos;d want to remember.</p>
          </div>
        )}
        {items.map((m) => {
          const when = m.happened_on ?? m.created_at.slice(0, 10);
          const author = m.author_id === me.userId ? "you" : partnerName;
          const meta = (
            <div className="flex justify-between items-center gap-3 text-xs">
              <span className="muted inline-flex items-center gap-1.5">
                {m.location_name && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} className="text-accent" aria-hidden />
                    {m.location_name}
                  </span>
                )}
                {m.location_name && <span aria-hidden>·</span>}
                <span>{when}</span>
                <span aria-hidden>·</span>
                <span>by {author}</span>
              </span>
              {m.author_id === me.userId && (
                <form action={deleteMemory}>
                  <input type="hidden" name="id" value={m.id} />
                  <DeleteButton confirmText="Delete this memory? It can't be undone." />
                </form>
              )}
            </div>
          );

          // Photo-forward: image leads, text settles beneath it.
          if (m.signed && m.media_type === "image") {
            return (
              <article key={m.id} className="card overflow-hidden">
                <img
                  src={m.signed}
                  alt={m.title || ""}
                  className="rounded-xl2 w-full max-h-96 object-cover"
                />
                <div className="p-4 space-y-2">
                  {m.title && <h3 className="display text-xl leading-tight">{m.title}</h3>}
                  {m.body && <p className="text-sm whitespace-pre-wrap">{m.body}</p>}
                  {meta}
                </div>
              </article>
            );
          }

          // Audio / video keep their players, framed simply.
          if (m.signed && (m.media_type === "audio" || m.media_type === "video")) {
            return (
              <article key={m.id} className="card p-4 space-y-3">
                {m.title && <h3 className="display text-xl leading-tight">{m.title}</h3>}
                {m.media_type === "audio" ? (
                  <audio controls src={m.signed} className="w-full" />
                ) : (
                  <video controls src={m.signed} className="w-full rounded-xl2" />
                )}
                {m.body && <p className="text-sm whitespace-pre-wrap">{m.body}</p>}
                {meta}
              </article>
            );
          }

          // Text-only: a warm quote card.
          return (
            <article key={m.id} className="card p-6 space-y-3">
              <Quote size={18} className="text-accent/70" aria-hidden />
              {m.title && <h3 className="display text-xl leading-tight">{m.title}</h3>}
              {m.body && <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>}
              {meta}
            </article>
          );
        })}
      </section>
    </div>
  );
}
