import { revalidatePath } from "next/cache";
import { Lock, Mic } from "lucide-react";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, signedUrl, userScopedPath } from "@/lib/media";
import LocalTime from "@/components/LocalTime";
import VoiceRecorder from "@/components/VoiceRecorder";
import DeleteButton from "@/components/DeleteButton";
import SubmitButton from "@/components/SubmitButton";

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

      <form action={upload} className="card p-3.5 space-y-3" encType="multipart/form-data">
        <VoiceRecorder name="audio" />
        <div>
          <label className="label" htmlFor="letter-transcript">Transcript (optional)</label>
          <textarea id="letter-transcript" className="input" name="transcript" rows={2} placeholder="What you said, in words" />
        </div>
        <div>
          <label className="label" htmlFor="letter-unlock">Unlock date (optional)</label>
          <input id="letter-unlock" className="input" name="unlock_at" type="datetime-local" />
        </div>
        <label className="flex items-center gap-2.5 min-h-[44px] text-[15px]"><input type="checkbox" name="is_private" className="w-5 h-5" /> Private (only for you)</label>
        <SubmitButton className="btn btn-primary w-full">Save letter</SubmitButton>
      </form>

      <section className="thread" aria-label="Voice letters">
        {items.map((r) => {
          const mine = r.author_id === me.userId;
          const locked = r.unlock_at && new Date(r.unlock_at) > new Date() && !mine;
          return (
            <div key={r.id} className="contents">
              <article className={`bubble w-[85%] space-y-2 ${mine ? "bubble-me" : "bubble-them"}`}>
                {locked ? (
                  <p className="inline-flex items-center gap-1.5"><Lock size={16} aria-hidden /> Sealed until the unlock date.</p>
                ) : r.signed ? (
                  <audio controls src={r.signed} className="w-full" />
                ) : null}
                {!locked && r.transcript && <p className="whitespace-pre-wrap">{r.transcript}</p>}
              </article>
              <div className={`stamp flex items-center gap-1.5 flex-wrap mb-2 ${mine ? "self-end justify-end" : ""}`}>
                <span>
                  {r.is_private ? "Private · " : ""}
                  {mine ? "You" : "Partner"}
                  {r.unlock_at ? <> · unlocks <LocalTime iso={r.unlock_at} mode="absolute" /></> : ""}
                </span>
                {mine && (
                  <form action={remove} className="inline-flex">
                    <input type="hidden" name="id" value={r.id} />
                    <DeleteButton className="underline underline-offset-2 hover:text-ink min-h-[32px] px-1" confirmText="Delete this voice letter? It can't be undone." />
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><Mic size={20} aria-hidden /></div>
            <p className="font-bold pt-2">No letters yet.</p>
            <p className="muted">Record one above. They can open it whenever you choose.</p>
          </div>
        )}
      </section>
    </div>
  );
}
