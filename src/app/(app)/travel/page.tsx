import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chat } from "@/lib/groq";

export default async function TravelPage({ searchParams }: { searchParams: Promise<{ plan_for?: string }> }) {
  const me = await requireCoupled();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: pins } = await supabase
    .from("travel_pins")
    .select("id, name, lat, lng, visited, visited_on, notes, created_at")
    .eq("couple_id", me.coupleId)
    .order("visited", { ascending: true })
    .order("created_at", { ascending: false });

  let itinerary: string | null = null;
  if (sp.plan_for && aiEnabled()) {
    const list = (pins ?? []).filter((p) => p.name.toLowerCase().includes(sp.plan_for!.toLowerCase()));
    if (list.length > 0) {
      itinerary = await chat({
        system: "Plan a tight one-day itinerary for a couple from a list of pinned places. Be concrete, give times, walking notes, and one wildcard.",
        user: `City filter: ${sp.plan_for}\nPins: ${JSON.stringify(list.map((p) => p.name))}`,
        temperature: 0.7,
        maxTokens: 500,
      });
    }
  }

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const name = String(formData.get("name") || "").trim();
    const lat = Number(formData.get("lat") || 0);
    const lng = Number(formData.get("lng") || 0);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    await supabase.from("travel_pins").insert({
      couple_id: me.coupleId,
      name,
      lat,
      lng,
      notes: String(formData.get("notes") || "").trim() || null,
    });
    revalidatePath("/travel");
  }

  async function visit(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase
      .from("travel_pins")
      .update({ visited: true, visited_on: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    revalidatePath("/travel");
  }

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Travel</h1><p className="muted">Pins for now and someday.</p></header>

      <form action={add} className="card p-4 space-y-2">
        <input className="input" name="name" placeholder="Place name" required />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" name="lat" type="number" step="any" placeholder="Latitude" required />
          <input className="input" name="lng" type="number" step="any" placeholder="Longitude" required />
        </div>
        <textarea className="input" name="notes" rows={2} placeholder="Why here?" />
        <p className="muted text-xs">Tip: in Google/Apple Maps, long-press a place to copy its coordinates.</p>
        <button className="btn btn-primary w-full" type="submit">Add pin</button>
      </form>

      <form className="card p-4 space-y-2">
        <h3 className="label">Plan a day</h3>
        <input className="input" name="plan_for" placeholder="City or filter (e.g. Lisbon)" defaultValue={sp.plan_for ?? ""} />
        <button className="btn w-full" type="submit" disabled={!aiEnabled()}>{aiEnabled() ? "Draft itinerary from matching pins" : "Set GROQ_API_KEY to enable"}</button>
        {itinerary && <pre className="whitespace-pre-wrap text-sm bg-panel2 border border-line rounded-lg p-3">{itinerary}</pre>}
      </form>

      <section className="space-y-2">
        <h3 className="label">Pins ({pins?.length ?? 0})</h3>
        {(pins ?? []).map((p) => (
          <div key={p.id} className="card p-3 flex justify-between items-start gap-3">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="muted text-xs">{p.lat.toFixed(3)}, {p.lng.toFixed(3)}{p.visited && p.visited_on ? ` · visited ${p.visited_on}` : ""}</div>
              {p.notes && <p className="muted text-xs mt-1">{p.notes}</p>}
            </div>
            {!p.visited && (
              <form action={visit}><input type="hidden" name="id" value={p.id} /><button className="btn btn-ghost text-xs" type="submit">Been</button></form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
