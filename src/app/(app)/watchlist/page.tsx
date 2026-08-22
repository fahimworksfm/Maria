import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chatJson } from "@/lib/groq";
import { tmdbEnabled } from "@/lib/tmdb";
import SubmitButton from "@/components/SubmitButton";
import WatchlistBoard, { type WatchItem } from "./WatchlistBoard";

export default async function WatchlistPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("watchlist")
    .select("id, title, kind, notes, runtime_min, mood_tags, watched_at, rating, tmdb_id, poster_path, year, overview, created_at")
    .eq("couple_id", me.coupleId)
    .order("watched_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Watchlist</h1>
        <p className="muted">Movies and shows for us.</p>
      </header>

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

      <WatchlistBoard initial={(rows ?? []) as WatchItem[]} coupleId={me.coupleId} tmdbOn={tmdbEnabled()} />
    </div>
  );
}
