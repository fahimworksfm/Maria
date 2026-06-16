import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chatJson } from "@/lib/groq";
import AffirmationDeck from "./AffirmationDeck";
import SubmitButton from "@/components/SubmitButton";

const SEED = [
  "You are exactly the trouble I needed.",
  "I keep choosing you.",
  "Your softness is your power.",
  "Thank you for being patient with me.",
  "I love watching you sleep.",
  "You make ordinary days warm.",
];

export default async function AffirmationsPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: cards } = await supabase
    .from("affirmations")
    .select("id, text, added_by, created_at")
    .eq("couple_id", me.coupleId)
    .order("created_at", { ascending: false });

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const text = String(formData.get("text") || "").trim();
    if (!text) return;
    await supabase.from("affirmations").insert({ couple_id: me.coupleId, added_by: me.userId, text });
    revalidatePath("/affirmations");
  }

  async function remove(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("affirmations").delete().eq("id", id);
    revalidatePath("/affirmations");
  }

  async function seedFromAI() {
    "use server";
    if (!aiEnabled()) return;
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    type Gen = { cards: string[] };
    const out = await chatJson<Gen>({
      system:
        "Generate warm, specific affirmation cards for a couple. Output strict JSON {\"cards\":[string,...]}. 8 cards. Each under 16 words. Tender, real, never preachy or saccharine.",
      user: "Make them feel like inside-jokey love notes, not greeting cards.",
      maxTokens: 600,
    });
    const rows = (out.cards ?? []).slice(0, 8).map((t) => ({
      couple_id: me.coupleId,
      added_by: me.userId,
      text: String(t).slice(0, 200),
    }));
    if (rows.length) await supabase.from("affirmations").insert(rows);
    revalidatePath("/affirmations");
  }

  async function seedDefaults() {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const rows = SEED.map((t) => ({ couple_id: me.coupleId, added_by: me.userId, text: t }));
    await supabase.from("affirmations").insert(rows);
    revalidatePath("/affirmations");
  }

  const list = (cards ?? []).map((c) => ({ id: c.id, text: c.text }));

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Affirmation Deck</h1><p className="muted">Shuffle. Draw. Send.</p></header>

      {list.length === 0 ? (
        <div className="card p-4 space-y-2 text-center">
          <p className="muted">The deck is empty.</p>
          <div className="flex gap-2 justify-center">
            <form action={seedDefaults}><SubmitButton className="btn">Seed with starters</SubmitButton></form>
            <form action={seedFromAI}><SubmitButton className="btn btn-primary" disabled={!aiEnabled()} pendingLabel="Generating…">{aiEnabled() ? "AI: write 8 cards" : "Set GROQ_API_KEY"}</SubmitButton></form>
          </div>
        </div>
      ) : (
        <AffirmationDeck cards={list} />
      )}

      <form action={add} className="card p-4 space-y-2">
        <h3 className="label">Add a card</h3>
        <textarea className="input" name="text" rows={2} placeholder="Write something you'd want them to draw" required />
        <SubmitButton className="btn w-full">Add to deck</SubmitButton>
      </form>

      <form action={seedFromAI}>
        <SubmitButton className="btn btn-ghost w-full text-sm" disabled={!aiEnabled()} pendingLabel="Generating…">{aiEnabled() ? "AI: add 8 more" : ""}</SubmitButton>
      </form>

      <section className="space-y-1">
        <h3 className="label">All cards ({list.length})</h3>
        {list.map((c) => (
          <div key={c.id} className="card p-2 flex justify-between items-center gap-2 text-sm">
            <span className="truncate">{c.text}</span>
            <form action={remove}><input type="hidden" name="id" value={c.id} /><button className="btn btn-ghost text-xs" type="submit">×</button></form>
          </div>
        ))}
      </section>
    </div>
  );
}
