import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chatJson } from "@/lib/groq";
import SubmitButton from "@/components/SubmitButton";

export default async function WatchlistPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("watchlist")
    .select("id, title, kind, notes, runtime_min, mood_tags, watched_at, rating, created_at")
    .eq("couple_id", me.coupleId)
    .order("watched_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    const tagsRaw = String(formData.get("mood_tags") || "").trim();
    await supabase.from("watchlist").insert({
      couple_id: me.coupleId,
      title,
      kind: (formData.get("kind") as string) || "movie",
      runtime_min: Number(formData.get("runtime_min") || 0) || null,
      mood_tags: tagsRaw ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean) : null,
      notes: String(formData.get("notes") || "").trim() || null,
    });
    revalidatePath("/watchlist");
  }

  async function markWatched(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const rating = Number(formData.get("rating") || 0) || null;
    const supabase = await supabaseServer();
    await supabase.from("watchlist").update({ watched_at: new Date().toISOString(), rating }).eq("id", id);
    revalidatePath("/watchlist");
  }

  async function suggest(formData: FormData) {
    "use server";
    if (!aiEnabled()) return;
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const mood = String(formData.get("mood") || "").trim() || "anything";
    const maxMin = Number(formData.get("max_min") || 0) || 0;
    const { data: pool } = await supabase
      .from("watchlist")
      .select("title, kind, runtime_min, mood_tags")
      .eq("couple_id", me.coupleId)
      .is("watched_at", null)
      .limit(200);
    type Gen = { pick: string; reason: string };
    const out = await chatJson<Gen>({
      system:
        "Pick the best single title from a watchlist for a couple, given mood/time. Output strict JSON {\"pick\":string,\"reason\":string}. Pick must be one of the titles provided exactly.",
      user: `Mood: ${mood}. Time available (min): ${maxMin || "any"}.\nList: ${JSON.stringify(pool ?? [])}`,
      maxTokens: 300,
    });
    if (out.pick) {
      const { data: match } = await supabase
        .from("watchlist")
        .select("id")
        .eq("couple_id", me.coupleId)
        .eq("title", out.pick)
        .maybeSingle();
      if (match) {
        await supabase.from("watchlist").update({ notes: `AI pick: ${out.reason}` }).eq("id", match.id);
      }
    }
    revalidatePath("/watchlist");
  }

  const unwatched = (rows ?? []).filter((r) => !r.watched_at);
  const watched = (rows ?? []).filter((r) => r.watched_at);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Watchlist</h1>
        <p className="muted">Movies and shows for us.</p>
      </header>

      <form action={add} className="card p-4 space-y-2">
        <input className="input" name="title" placeholder="Title" required />
        <div className="grid grid-cols-3 gap-2">
          <select className="input" name="kind" defaultValue="movie">
            <option value="movie">Movie</option>
            <option value="show">Show</option>
            <option value="other">Other</option>
          </select>
          <input className="input" name="runtime_min" type="number" placeholder="Mins" />
          <input className="input" name="mood_tags" placeholder="Tags (comma)" />
        </div>
        <textarea className="input" name="notes" rows={2} placeholder="Notes" />
        <SubmitButton className="btn btn-primary w-full">Add</SubmitButton>
      </form>

      <form action={suggest} className="card p-4 space-y-2">
        <h3 className="label">Tonight?</h3>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" name="mood" placeholder="Mood (cozy, funny)" />
          <input className="input" name="max_min" type="number" placeholder="Max minutes" />
        </div>
        <SubmitButton className="btn w-full" disabled={!aiEnabled()} pendingLabel="Generating…">
          {aiEnabled() ? "AI: pick from our list" : "Set GROQ_API_KEY to enable"}
        </SubmitButton>
      </form>

      <section className="space-y-2">
        <h3 className="label">Unwatched ({unwatched.length})</h3>
        {unwatched.map((r) => (
          <div key={r.id} className="card p-3 flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="font-medium">{r.title}</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {r.kind && <span className="pill">{r.kind}</span>}
                {r.runtime_min && <span className="pill">{r.runtime_min}m</span>}
                {(r.mood_tags ?? []).map((t: string) => <span key={t} className="pill">{t}</span>)}
              </div>
              {r.notes && <p className="muted text-xs mt-1">{r.notes}</p>}
            </div>
            <form action={markWatched} className="flex gap-1 items-center">
              <input type="hidden" name="id" value={r.id} />
              <select className="input text-xs py-1" name="rating">
                <option value="">★</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
              <button className="btn btn-ghost text-xs" type="submit">Watched</button>
            </form>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="label">Watched ({watched.length})</h3>
        {watched.map((r) => (
          <div key={r.id} className="card p-3 opacity-80">
            <div className="font-medium">{r.title} {r.rating ? `· ${"★".repeat(r.rating)}` : ""}</div>
            {r.notes && <p className="muted text-xs">{r.notes}</p>}
          </div>
        ))}
      </section>
    </div>
  );
}
