import { partnerNameFor, sideClass, sideName, sideOf } from "@/lib/authorship";
import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chatJson } from "@/lib/groq";
import SubmitButton from "@/components/SubmitButton";
import { Dices } from "lucide-react";

type Idea = {
  id: string;
  title: string;
  description: string | null;
  budget: string | null;
  effort: string | null;
  weather: string | null;
  done: boolean;
  ai_generated: boolean;
};

export default async function DateRoulettePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: ideas } = await supabase
    .from("date_ideas")
    .select("id, title, description, budget, effort, weather, done, ai_generated, author_id")
    .eq("couple_id", me.coupleId)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  async function addIdea(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    await supabase.from("date_ideas").insert({
      couple_id: me.coupleId,
      author_id: me.userId,
      title,
      description: String(formData.get("description") || "").trim() || null,
      budget: (formData.get("budget") as string) || null,
      effort: (formData.get("effort") as string) || null,
      weather: (formData.get("weather") as string) || null,
    });
    revalidatePath("/date-roulette");
  }

  async function toggleDone(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    const { data } = await supabase.from("date_ideas").select("done").eq("id", id).single();
    if (!data) return;
    await supabase.from("date_ideas").update({ done: !data.done }).eq("id", id);
    revalidatePath("/date-roulette");
  }

  async function generateIdeas(formData: FormData) {
    "use server";
    if (!aiEnabled()) return;
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const budget = (formData.get("budget") as string) || "any";
    const effort = (formData.get("effort") as string) || "any";
    const weather = (formData.get("weather") as string) || "any";

    type Gen = { ideas: Array<{ title: string; description: string }> };
    const out = await chatJson<Gen>({
      system:
        "You generate creative, specific date ideas for couples. Output strict JSON: {\"ideas\":[{\"title\":string,\"description\":string}]}. Five ideas. Titles under 6 words. Descriptions under 30 words. No generic 'go for a walk'.",
      user: `Budget: ${budget}. Effort: ${effort}. Weather: ${weather}. Make each idea concrete with a small twist.`,
      maxTokens: 600,
    });
    const rows = (out.ideas ?? []).slice(0, 5).map((i) => ({
      couple_id: me.coupleId,
      author_id: me.userId,
      title: String(i.title).slice(0, 100),
      description: String(i.description).slice(0, 400),
      budget: budget === "any" ? null : budget,
      effort: effort === "any" ? null : effort,
      weather: weather === "any" ? null : weather,
      ai_generated: true,
    }));
    if (rows.length) await supabase.from("date_ideas").insert(rows);
    revalidatePath("/date-roulette");
  }

  const pool = (ideas ?? []).filter((i) => !i.done);
  const spun = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;

  const partnerName = await partnerNameFor(supabase, me.userId);
  // Ideas Tether generated belong to neither of you.
  const side = (i: { author_id: string | null; ai_generated: boolean }) => (i.ai_generated ? null : sideOf(i.author_id, me.userId));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Date Roulette</h1>
        <p className="muted">Spin up something to do.</p>
      </header>

      {spun && (
        <section className="card p-4 space-y-2">
          <div className="label !mb-0">Tether suggests · tonight, maybe</div>
          <h2 className="h2">{spun.title}</h2>
          {spun.description && <p className="muted">{spun.description}</p>}
          <div className="flex gap-1.5 flex-wrap pt-1">
            {spun.budget && <span className="pill">{spun.budget}</span>}
            {spun.effort && <span className="pill">{spun.effort}</span>}
            {spun.weather && <span className="pill">{spun.weather}</span>}
          </div>
          <form action={toggleDone} className="pt-2">
            <input type="hidden" name="id" value={spun.id} />
            <button className="btn btn-primary w-full" type="submit">We did it</button>
          </form>
        </section>
      )}

      <section className="card p-4 space-y-3">
        <h3 className="label">Generate ideas with AI</h3>
        <form action={generateIdeas} className="grid grid-cols-3 gap-2">
          <select className="input" name="budget" aria-label="Budget" defaultValue="any">
            <option value="any">Any budget</option>
            <option value="free">Free</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select className="input" name="effort" aria-label="Effort" defaultValue="any">
            <option value="any">Any effort</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select className="input" name="weather" aria-label="Weather" defaultValue="any">
            <option value="any">Any weather</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
          <SubmitButton className="btn btn-primary col-span-3" disabled={!aiEnabled()} pendingLabel="Generating…">
            {aiEnabled() ? "Generate 5 ideas" : "Set GROQ_API_KEY to enable"}
          </SubmitButton>
        </form>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="label">Add your own</h3>
        <form action={addIdea} className="space-y-2">
          <input className="input" name="title" placeholder="Idea title" aria-label="Idea title" required />
          <textarea className="input" name="description" placeholder="Details (optional)" aria-label="Details" rows={2} />
          <div className="grid grid-cols-3 gap-2">
            <select className="input" name="budget" aria-label="Budget" defaultValue=""><option value="">Budget</option><option>free</option><option>low</option><option>medium</option><option>high</option></select>
            <select className="input" name="effort" aria-label="Effort" defaultValue=""><option value="">Effort</option><option>low</option><option>medium</option><option>high</option></select>
            <select className="input" name="weather" aria-label="Weather" defaultValue=""><option value="">Weather</option><option>indoor</option><option>outdoor</option></select>
          </div>
          <SubmitButton className="btn w-full">Add idea</SubmitButton>
        </form>
      </section>

      <section>
        <h3 className="label">All ideas</h3>
        <ul className="space-y-2">
          {(ideas ?? []).map((i) => (
            <li key={i.id} className={`card px-4 py-3 flex items-start justify-between gap-3 ${i.done ? "opacity-60" : ""} ${sideClass(side(i))}`}>
              <div className="min-w-0">
                {sideName(side(i), partnerName) && <div className="text-xs text-muted mb-0.5">{sideName(side(i), partnerName)}</div>}
                <div className="font-semibold leading-snug">{i.title}</div>
                {i.description && <p className="text-muted text-[13px]">{i.description}</p>}
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {i.budget && <span className="pill">{i.budget}</span>}
                  {i.effort && <span className="pill">{i.effort}</span>}
                  {i.weather && <span className="pill">{i.weather}</span>}
                  {i.ai_generated && <span className="pill">AI</span>}
                </div>
              </div>
              <form action={toggleDone}>
                <input type="hidden" name="id" value={i.id} />
                <button className="btn btn-ghost text-sm" type="submit">{i.done ? "Undo" : "Done"}</button>
              </form>
            </li>
          ))}
          {ideas && ideas.length === 0 && (
            <div className="card p-5 text-center space-y-1">
              <div className="mark-box"><Dices size={22} aria-hidden /></div>
              <p className="font-bold text-lg pt-2">No date ideas yet.</p>
              <p className="muted">Generate five with AI above, or add your own in the &ldquo;Add idea&rdquo; form above.</p>
              <p className="text-muted text-[13px]">For example: a picnic and a film projected on the wall.</p>
            </div>
          )}
        </ul>
      </section>
    </div>
  );
}
