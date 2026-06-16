import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

export default async function PlacesPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("places")
    .select("id, name, kind, notes, visited, rating, created_at")
    .eq("couple_id", me.coupleId)
    .order("visited", { ascending: true })
    .order("created_at", { ascending: false });

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    // Guard against accidental double-submits: skip an identical place added in
    // the last 15 seconds.
    const { data: dupe } = await supabase
      .from("places")
      .select("id")
      .eq("couple_id", me.coupleId)
      .eq("name", name)
      .eq("visited", false)
      .gte("created_at", new Date(Date.now() - 15_000).toISOString())
      .limit(1)
      .maybeSingle();
    if (dupe) return;
    await supabase.from("places").insert({
      couple_id: me.coupleId,
      name,
      kind: String(formData.get("kind") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
    });
    revalidatePath("/places");
  }

  async function visit(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const rating = Number(formData.get("rating") || 0) || null;
    const supabase = await supabaseServer();
    await supabase.from("places").update({ visited: true, rating }).eq("id", id);
    revalidatePath("/places");
  }

  async function remove(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    if (!id) return;
    const supabase = await supabaseServer();
    await supabase.from("places").delete().eq("id", id);
    revalidatePath("/places");
  }

  const toGo = (rows ?? []).filter((r) => !r.visited);
  const been = (rows ?? []).filter((r) => r.visited);

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Places</h1><p className="muted">Restaurants and spots.</p></header>
      <form action={add} className="card p-4 space-y-2">
        <input className="input" name="name" placeholder="Place name" required />
        <input className="input" name="kind" placeholder="Type (cafe, dinner, park)" />
        <textarea className="input" name="notes" rows={2} placeholder="Why this one?" />
        <SubmitButton>Add</SubmitButton>
      </form>

      <section className="space-y-2">
        <h3 className="label">Want to go ({toGo.length})</h3>
        {toGo.map((r) => (
          <div key={r.id} className="card p-3 flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="font-medium">{r.name}</div>
              {r.kind && <span className="pill">{r.kind}</span>}
              {r.notes && <p className="muted text-xs mt-1">{r.notes}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <form action={visit} className="flex gap-1 items-center">
                <input type="hidden" name="id" value={r.id} />
                <select className="input text-xs py-1" name="rating" aria-label="Rating">
                  <option value="">★</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </select>
                <SubmitButton className="btn btn-ghost text-xs" pendingLabel="…">Been</SubmitButton>
              </form>
              <form action={remove}>
                <input type="hidden" name="id" value={r.id} />
                <DeleteButton confirmText="Remove this place?" />
              </form>
            </div>
          </div>
        ))}
        {toGo.length === 0 && <p className="muted">Nothing on the list yet.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="label">Been ({been.length})</h3>
        {been.map((r) => (
          <div key={r.id} className="card p-3 flex justify-between items-start gap-3 opacity-90">
            <div className="min-w-0">
              <div className="font-medium">{r.name} {r.rating ? `· ${"★".repeat(r.rating)}` : ""}</div>
              {r.notes && <p className="muted text-xs">{r.notes}</p>}
            </div>
            <form action={remove} className="shrink-0">
              <input type="hidden" name="id" value={r.id} />
              <DeleteButton confirmText="Remove this place?" />
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
