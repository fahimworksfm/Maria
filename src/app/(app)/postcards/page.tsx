import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, signedUrl, userScopedPath } from "@/lib/media";
import SubmitButton from "@/components/SubmitButton";
import { Mail } from "lucide-react";

export default async function PostcardsPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("postcards")
    .select("id, author_id, location, photo_url, note, sent_on, created_at")
    .eq("couple_id", me.coupleId)
    .order("sent_on", { ascending: false });

  const items = await Promise.all(
    (rows ?? []).map(async (p) => ({ ...p, signed: p.photo_url ? await signedUrl(supabase, p.photo_url) : null }))
  );

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const location = String(formData.get("location") || "").trim() || null;
    const note = String(formData.get("note") || "").trim() || null;
    const file = formData.get("photo") as File | null;
    let photo_url: string | null = null;
    if (file && typeof file === "object" && file.size > 0) {
      const path = userScopedPath(me.userId, file.name || "postcard.jpg");
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      photo_url = path;
    }
    await supabase.from("postcards").insert({
      couple_id: me.coupleId,
      author_id: me.userId,
      location,
      photo_url,
      note,
    });
    revalidatePath("/postcards");
  }

  async function remove(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("postcards").delete().eq("id", id);
    revalidatePath("/postcards");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Postcards</h1>
        <p className="muted">A note from wherever you are. Save them up.</p>
      </header>

      <form action={add} className="card p-3.5 space-y-2.5" encType="multipart/form-data">
        <div>
          <label className="label" htmlFor="postcard-location">Where are you?</label>
          <input id="postcard-location" className="input" name="location" placeholder="e.g. Tokyo, the back garden" />
        </div>
        <div>
          <label className="label" htmlFor="postcard-photo">Photo (optional)</label>
          <input id="postcard-photo" className="input" name="photo" type="file" accept="image/*" />
        </div>
        <div>
          <label className="label" htmlFor="postcard-note">Your note</label>
          <textarea id="postcard-note" className="input" name="note" rows={4} placeholder="Wish you were here..." required />
        </div>
        <SubmitButton className="btn btn-primary w-full">Send postcard</SubmitButton>
      </form>

      {/* Each postcard is a message: the picture, where it was sent from, the note. */}
      <section className="thread" aria-label="Postcards">
        {items.map((p) => {
          const mine = p.author_id === me.userId;
          return (
            <div key={p.id} className="contents">
              <article className={`bubble ${mine ? "bubble-me" : "bubble-them"} ${p.signed ? "!p-1.5 w-[80%] space-y-1.5" : ""}`}>
                {p.signed && <img src={p.signed} alt="" className="rounded-2xl w-full max-h-96 object-cover" />}
                <div className={p.signed ? "px-2 pb-1.5 pt-0.5 space-y-1" : "space-y-1"}>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Mail size={13} aria-hidden /> From {p.location || "somewhere"}</p>
                  <p className="whitespace-pre-wrap">{p.note}</p>
                </div>
              </article>
              <div className={`stamp flex items-center gap-1.5 flex-wrap mb-2 ${mine ? "self-end justify-end" : ""}`}>
                <span>{mine ? "You" : "Partner"}</span>
                <span aria-hidden>·</span>
                <span>{p.sent_on}</span>
                {mine && (
                  <form action={remove} className="inline-flex">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="underline underline-offset-2 hover:text-ink min-h-[32px] px-1" type="submit">Delete</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><Mail size={20} aria-hidden /></div>
            <p className="font-bold pt-2">No postcards yet.</p>
            <p className="muted">Send one from wherever you are.</p>
          </div>
        )}
      </section>
    </div>
  );
}
