import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chatJson } from "@/lib/groq";

export default async function RecipesPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("recipes")
    .select("id, title, ingredients, steps, source_url, cooked_count, created_at")
    .eq("couple_id", me.coupleId)
    .order("created_at", { ascending: false });

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    const ingRaw = String(formData.get("ingredients") || "").trim();
    await supabase.from("recipes").insert({
      couple_id: me.coupleId,
      title,
      ingredients: ingRaw ? ingRaw.split("\n").map((s) => s.trim()).filter(Boolean) : null,
      steps: String(formData.get("steps") || "").trim() || null,
      source_url: String(formData.get("source_url") || "").trim() || null,
    });
    revalidatePath("/recipes");
  }

  async function cookedOnce(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    const { data } = await supabase.from("recipes").select("cooked_count").eq("id", id).single();
    await supabase.from("recipes").update({ cooked_count: (data?.cooked_count ?? 0) + 1 }).eq("id", id);
    revalidatePath("/recipes");
  }

  async function fromPantry(formData: FormData) {
    "use server";
    if (!aiEnabled()) return;
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const pantry = String(formData.get("pantry") || "").trim();
    if (!pantry) return;
    type Gen = { title: string; ingredients: string[]; steps: string };
    const out = await chatJson<Gen>({
      system: "Suggest one weeknight recipe from a pantry list. Output strict JSON {title, ingredients:[], steps:string}. Keep ingredients to ~8. Steps brief and numbered inline.",
      user: `Pantry: ${pantry}\nReturn JSON.`,
      maxTokens: 700,
    });
    await supabase.from("recipes").insert({
      couple_id: me.coupleId,
      title: String(out.title).slice(0, 100),
      ingredients: (out.ingredients ?? []).slice(0, 30).map((s) => String(s).slice(0, 100)),
      steps: String(out.steps).slice(0, 4000),
    });
    revalidatePath("/recipes");
  }

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Recipes</h1><p className="muted">What we cook together.</p></header>

      <form action={fromPantry} className="card p-4 space-y-2">
        <h3 className="label">AI: from pantry</h3>
        <textarea className="input" name="pantry" rows={2} placeholder="chicken, lemon, rice, eggs..." />
        <button className="btn w-full" type="submit" disabled={!aiEnabled()}>{aiEnabled() ? "Suggest a recipe" : "Set GROQ_API_KEY to enable"}</button>
      </form>

      <form action={add} className="card p-4 space-y-2">
        <input className="input" name="title" placeholder="Recipe title" required />
        <textarea className="input" name="ingredients" rows={4} placeholder="One ingredient per line" />
        <textarea className="input" name="steps" rows={4} placeholder="Steps" />
        <input className="input" name="source_url" placeholder="Source URL (optional)" />
        <button className="btn btn-primary w-full" type="submit">Save</button>
      </form>

      <section className="space-y-3">
        {(rows ?? []).map((r) => (
          <article key={r.id} className="card p-4 space-y-2">
            <div className="flex justify-between items-baseline">
              <h3 className="font-medium">{r.title}</h3>
              <form action={cookedOnce}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost text-xs" type="submit">Cooked ×{r.cooked_count}</button></form>
            </div>
            {r.ingredients && r.ingredients.length > 0 && (
              <ul className="text-sm grid grid-cols-2 gap-x-3 list-disc pl-5">
                {r.ingredients.map((i: string, k: number) => <li key={k}>{i}</li>)}
              </ul>
            )}
            {r.steps && <p className="whitespace-pre-wrap text-sm">{r.steps}</p>}
            {r.source_url && <a className="muted text-xs underline" href={r.source_url} target="_blank" rel="noreferrer">Source</a>}
          </article>
        ))}
        {rows && rows.length === 0 && <p className="muted">No recipes yet.</p>}
      </section>
    </div>
  );
}
