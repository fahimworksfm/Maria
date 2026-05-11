import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

export default async function RepairLogPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("repair_logs")
    .select("id, author_id, occurred_on, trigger_note, what_happened, what_repaired, learned, created_at")
    .eq("couple_id", me.coupleId)
    .order("occurred_on", { ascending: false });

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    await supabase.from("repair_logs").insert({
      couple_id: me.coupleId,
      author_id: me.userId,
      occurred_on: String(formData.get("occurred_on") || new Date().toISOString().slice(0, 10)),
      trigger_note: String(formData.get("trigger_note") || "").trim() || null,
      what_happened: String(formData.get("what_happened") || "").trim() || null,
      what_repaired: String(formData.get("what_repaired") || "").trim() || null,
      learned: String(formData.get("learned") || "").trim() || null,
    });
    revalidatePath("/repair-log");
  }

  async function remove(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("repair_logs").delete().eq("id", id);
    revalidatePath("/repair-log");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Repair Log</h1>
        <p className="muted">Not a list of who was right. A list of what you both learned.</p>
      </header>

      <form action={add} className="card p-4 space-y-2">
        <div>
          <label className="label">When</label>
          <input className="input" name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <label className="label">What triggered it</label>
          <textarea className="input" name="trigger_note" rows={2} placeholder="The flashpoint — small or large" />
        </div>
        <div>
          <label className="label">What happened</label>
          <textarea className="input" name="what_happened" rows={3} placeholder="The shape of the disagreement" />
        </div>
        <div>
          <label className="label">What repaired it</label>
          <textarea className="input" name="what_repaired" rows={2} placeholder="The first move toward each other" />
        </div>
        <div>
          <label className="label">What you learned</label>
          <textarea className="input" name="learned" rows={2} placeholder="One sentence" />
        </div>
        <button className="btn btn-primary w-full" type="submit">Save</button>
      </form>

      <section className="space-y-3">
        {(rows ?? []).map((r) => (
          <article key={r.id} className="card p-4 space-y-2">
            <div className="flex justify-between items-baseline">
              <h3 className="font-medium">{r.occurred_on}</h3>
              <form action={remove}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost text-xs" type="submit">Delete</button></form>
            </div>
            {r.trigger_note && <Field label="Trigger" value={r.trigger_note} />}
            {r.what_happened && <Field label="What happened" value={r.what_happened} />}
            {r.what_repaired && <Field label="Repair" value={r.what_repaired} />}
            {r.learned && <Field label="Learned" value={r.learned} />}
          </article>
        ))}
        {rows && rows.length === 0 && <p className="muted">Nothing logged yet.</p>}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted text-xs">{label}</div>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}
