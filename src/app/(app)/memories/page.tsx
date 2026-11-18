import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, signedUrl, userScopedPath } from "@/lib/media";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";
import { Images, MapPin } from "lucide-react";
import { relativeDate } from "@/lib/dates";
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

  // Edits the words around a memory (not its photo or recording). Scoped to
  // rows you wrote, so you can never rewrite your partner's memory.
  async function editMemory(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const id = String(formData.get("id") || "");
    if (!id) return;
    const supabase = await supabaseServer();
    await supabase
      .from("memories")
      .update({
        title: String(formData.get("title") || "").trim() || null,
        body: String(formData.get("body") || "").trim() || null,
        happened_on: String(formData.get("happened_on") || "") || null,
        location_name: String(formData.get("location_name") || "").trim() || null,
      })
      .eq("id", id)
      .eq("author_id", me.userId);
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

      {/* The composer: say it, optionally attach something, save. Everything
          else is behind "More details" so the memories themselves come first. */}
      <form action={addMemory} className="card p-3.5 space-y-2.5" encType="multipart/form-data">
        <label htmlFor="memory-body" className="sr-only">What happened?</label>
        <textarea id="memory-body" className="input" name="body" placeholder="Drop a memory…" rows={2} />
        <div>
          <label className="label" htmlFor="memory-media">Photo, audio or video (optional)</label>
          <input id="memory-media" className="input min-h-[44px]" name="media" type="file" accept="image/*,audio/*,video/*" />
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-accentInk min-h-[44px] inline-flex items-center">More details</summary>
          <div className="space-y-3 pt-1">
            <div>
              <label className="label" htmlFor="memory-title">Title</label>
              <input id="memory-title" className="input" name="title" placeholder="Give it a name (optional)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="memory-date">Date</label>
                <input id="memory-date" className="input" name="happened_on" type="date" />
              </div>
              <div>
                <label className="label" htmlFor="memory-place">Place</label>
                <input id="memory-place" className="input" name="location_name" placeholder="e.g. our kitchen" />
              </div>
            </div>
            <p className="muted text-xs">Leave the date empty and it&apos;s saved as today.</p>
          </div>
        </details>
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
          <div className="card p-6 text-center space-y-2">
            <span className="mark-box"><Images size={20} aria-hidden /></span>
            <p className="font-bold text-lg pt-1">The jar is empty.</p>
            <p className="muted">Type one line above and save it. For example: &ldquo;You laughed so hard at dinner you cried.&rdquo;</p>
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
                <span>{relativeDate(when)}</span>
                {m.location_name && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{m.location_name}</span>
                  </>
                )}
                {mine && (
                  <form action={deleteMemory} className="inline-flex">
                    <input type="hidden" name="id" value={m.id} />
                    <DeleteButton className="underline underline-offset-2 hover:text-ink min-h-[44px] px-1" confirmText="Delete this memory? It can't be undone." />
                  </form>
                )}
              </div>
              {mine && (
                <details className="self-end w-full max-w-[85%] -mt-2 mb-2">
                  <summary className="stamp cursor-pointer underline underline-offset-2 hover:text-ink min-h-[44px] flex items-center justify-end">Edit</summary>
                  <form action={editMemory} className="card p-3.5 space-y-2.5 mt-1">
                    <input type="hidden" name="id" value={m.id} />
                    <div>
                      <label className="label" htmlFor={`edit-title-${m.id}`}>Title</label>
                      <input id={`edit-title-${m.id}`} className="input" name="title" defaultValue={m.title ?? ""} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`edit-body-${m.id}`}>What happened</label>
                      <textarea id={`edit-body-${m.id}`} className="input" name="body" rows={3} defaultValue={m.body ?? ""} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label" htmlFor={`edit-date-${m.id}`}>Date</label>
                        <input id={`edit-date-${m.id}`} className="input" name="happened_on" type="date" defaultValue={m.happened_on ?? ""} />
                      </div>
                      <div>
                        <label className="label" htmlFor={`edit-place-${m.id}`}>Place</label>
                        <input id={`edit-place-${m.id}`} className="input" name="location_name" defaultValue={m.location_name ?? ""} />
                      </div>
                    </div>
                    <SubmitButton className="btn btn-primary w-full">Save changes</SubmitButton>
                  </form>
                </details>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
