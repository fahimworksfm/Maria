import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, signedUrl, userScopedPath } from "@/lib/media";
import LocalTime from "@/components/LocalTime";

export default async function VoiceLettersPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("voice_letters")
    .select("id, author_id, recipient_id, audio_url, transcript, unlock_at, is_private, created_at")
    .order("created_at", { ascending: false });

  const items = await Promise.all((rows ?? []).map(async (r) => ({
    ...r,
    signed: r.audio_url ? await signedUrl(supabase, r.audio_url) : null,
  })));

  async function upload(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const file = formData.get("audio") as File | null;
    if (!file || file.size === 0) return;
    const path = userScopedPath(me.userId, file.name || "letter.webm");
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "audio/webm",
    });
    if (upErr) throw upErr;
    await supabase.from("voice_letters").insert({
      couple_id: me.coupleId,
      author_id: me.userId,
      audio_url: path,
      transcript: String(formData.get("transcript") || "").trim() || null,
      unlock_at: String(formData.get("unlock_at") || "") || null,
      is_private: formData.get("is_private") === "on",
    });
    revalidatePath("/voice-letters");
  }

  async function remove(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("voice_letters").delete().eq("id", id);
    revalidatePath("/voice-letters");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Voice Letters</h1>
        <p className="muted">Record on your phone, upload here. Optional unlock date.</p>
      </header>

      <form action={upload} className="card p-4 space-y-2" encType="multipart/form-data">
        <input className="input" name="audio" type="file" accept="audio/*" required />
        <textarea className="input" name="transcript" rows={2} placeholder="Transcript (optional)" />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" name="unlock_at" type="datetime-local" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_private" /> Private (only for you)</label>
        </div>
        <button className="btn btn-primary w-full" type="submit">Save letter</button>
      </form>

      <section className="space-y-3">
        {items.map((r) => {
          const locked = r.unlock_at && new Date(r.unlock_at) > new Date() && r.author_id !== me.userId;
          return (
            <article key={r.id} className="card p-4 space-y-2">
              <div className="muted text-xs">
                {r.is_private ? "Private · " : ""}
                {r.author_id === me.userId ? "You" : "Partner"}
                {r.unlock_at ? <> · unlocks <LocalTime iso={r.unlock_at} mode="absolute" /></> : ""}
              </div>
              {locked ? (
                <p className="text-sm muted">🔒 Sealed until the unlock date.</p>
              ) : r.signed ? (
                <audio controls src={r.signed} className="w-full" />
              ) : null}
              {!locked && r.transcript && <p className="text-sm whitespace-pre-wrap">{r.transcript}</p>}
              {r.author_id === me.userId && (
                <form action={remove}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost text-xs" type="submit">Delete</button></form>
              )}
            </article>
          );
        })}
        {items.length === 0 && <p className="muted">No letters yet.</p>}
      </section>
    </div>
  );
}
