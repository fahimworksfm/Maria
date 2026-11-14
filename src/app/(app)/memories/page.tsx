import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, signedUrl, userScopedPath } from "@/lib/media";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import { MapPin } from "lucide-react";
import MemoryJarPanel from "./MemoryJarPanel";

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

      <MemoryJarPanel
        motes={items.map((m) => {
          const isPhoto = Boolean(m.signed && m.media_type === "image");
          return { id: m.id, withPhoto: isPhoto, photo: isPhoto ? m.signed : null };
        })}
      />

      {/* The jar as a thread: your memories on the right, theirs on the left,
          newest first so the one you just dropped in is right under the form. */}
      <section className="thread" aria-label="Memories">
        {items.length === 0 && (
          <div className="card p-8 text-center space-y-3">
            <span className="ink-art mx-auto w-36 aspect-[7/12]" style={{ ["--art" as string]: "url(/media/empty-jar.png)" }} aria-hidden />
            <p className="font-bold text-lg">Drop your first moment.</p>
            <p className="muted">A photo, a voice note, a sentence — anything you&apos;d want to remember.</p>
          </div>
        )}
        {items.map((m) => {
          const when = m.happened_on ?? m.created_at.slice(0, 10);
          const mine = m.author_id === me.userId;
          const hasMedia = Boolean(m.signed && (m.media_type === "image" || m.media_type === "audio" || m.media_type === "video"));
          const text = (m.title || m.body) && (
            <div className={hasMedia ? "px-2 pb-1.5 pt-0.5 space-y-0.5" : "space-y-0.5"}>
              {m.title && <h3 className="font-bold leading-snug">{m.title}</h3>}
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
            </div>
          );
          return (
            <div key={m.id} className="contents">
              <article
                id={`memory-${m.id}`}
                className={`bubble ${mine ? "bubble-me" : "bubble-them"} ${hasMedia ? "!p-1.5 w-[80%] space-y-1.5" : ""}`}
              >
                {m.signed && m.media_type === "image" && (
                  <img src={m.signed} alt={m.title || ""} className="rounded-2xl w-full max-h-96 object-cover" />
                )}
                {m.signed && m.media_type === "audio" && <audio controls src={m.signed} className="w-full" />}
                {m.signed && m.media_type === "video" && <video controls src={m.signed} className="w-full rounded-2xl" />}
                {text}
              </article>
              <div className={`stamp flex items-center gap-1.5 flex-wrap mb-2 ${mine ? "self-end justify-end" : ""}`}>
                <span>{mine ? "You" : partnerName}</span>
                <span aria-hidden>·</span>
                <span>{when}</span>
                {m.location_name && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{m.location_name}</span>
                  </>
                )}
                {mine && (
                  <form action={deleteMemory} className="inline-flex">
                    <input type="hidden" name="id" value={m.id} />
                    <DeleteButton className="underline underline-offset-2 hover:text-ink min-h-[32px] px-1" confirmText="Delete this memory? It can't be undone." />
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
