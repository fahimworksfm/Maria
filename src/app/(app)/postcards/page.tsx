import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { BUCKET, signedUrl, userScopedPath } from "@/lib/media";

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

      <form action={add} className="card p-4 space-y-2" encType="multipart/form-data">
        <input className="input" name="location" placeholder="Where are you? (e.g. Tokyo, the back garden)" />
        <input className="input" name="photo" type="file" accept="image/*" />
        <textarea className="input" name="note" rows={4} placeholder="Wish you were here..." required />
        <button className="btn btn-primary w-full" type="submit">Send postcard</button>
      </form>

      <section className="space-y-4">
        {items.map((p) => (
          <article key={p.id} className="card p-0 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <div className="relative bg-panel2 min-h-[180px]">
                {p.signed ? (
                  <img src={p.signed} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-40">📮</div>
                )}
              </div>
              <div className="p-4 relative">
                <div className="absolute top-3 right-3 border border-line rounded-md px-2 py-1 text-[10px] uppercase tracking-widest text-muted rotate-[3deg]">
                  {p.sent_on}
                </div>
                <div className="muted text-xs">From</div>
                <div className="font-medium">{p.location || "Somewhere"}</div>
                <p className="font-display text-lg leading-snug mt-3 whitespace-pre-wrap">{p.note}</p>
                <div className="flex justify-between items-center mt-4">
                  <span className="muted text-xs">{p.author_id === me.userId ? "by you" : "by partner"}</span>
                  {p.author_id === me.userId && (
                    <form action={remove}><input type="hidden" name="id" value={p.id} /><button className="btn btn-ghost text-xs" type="submit">Delete</button></form>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="muted">No postcards yet.</p>}
      </section>
    </div>
  );
}
