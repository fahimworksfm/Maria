import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import SubmitButton from "@/components/SubmitButton";

export default async function BucketListPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: items } = await supabase
    .from("bucket_items")
    .select("id, title, notes, category, target_date, completed_at, created_at")
    .eq("couple_id", me.coupleId)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  async function addItem(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    await supabase.from("bucket_items").insert({
      couple_id: me.coupleId,
      title,
      notes: String(formData.get("notes") || "").trim() || null,
      category: String(formData.get("category") || "").trim() || null,
      target_date: String(formData.get("target_date") || "") || null,
    });
    revalidatePath("/bucket-list");
  }

  async function toggleDone(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    const { data } = await supabase.from("bucket_items").select("completed_at").eq("id", id).single();
    if (!data) return;
    await supabase
      .from("bucket_items")
      .update({ completed_at: data.completed_at ? null : new Date().toISOString() })
      .eq("id", id);
    revalidatePath("/bucket-list");
  }

  async function deleteItem(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("bucket_items").delete().eq("id", id);
    revalidatePath("/bucket-list");
  }

  const open = (items ?? []).filter((i) => !i.completed_at);
  const done = (items ?? []).filter((i) => i.completed_at);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Bucket List</h1>
        <p className="muted">Dreams in progress.</p>
      </header>

      <form action={addItem} className="card p-4 space-y-3">
        <input className="input" name="title" placeholder="What do you want to do together?" required />
        <textarea className="input" name="notes" rows={2} placeholder="Notes (optional)" />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" name="category" placeholder="Category (e.g. travel)" />
          <input className="input" name="target_date" type="date" />
        </div>
        <SubmitButton className="btn btn-primary w-full">Add</SubmitButton>
      </form>

      <section className="space-y-2">
        <h3 className="label">Open ({open.length})</h3>
        {open.map((it) => (
          <Row key={it.id} item={it} toggleDone={toggleDone} deleteItem={deleteItem} />
        ))}
        {open.length === 0 && done.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="text-3xl">🌍</div>
            <p className="font-display text-base">What&apos;s the first dream?</p>
            <p className="muted text-sm">A trip, a project, a habit, a quiet plan. Add one above.</p>
          </div>
        )}
        {open.length === 0 && done.length > 0 && <p className="muted">All caught up.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="label">Done ({done.length})</h3>
        {done.map((it) => (
          <Row key={it.id} item={it} toggleDone={toggleDone} deleteItem={deleteItem} />
        ))}
        {done.length === 0 && <p className="muted">Nothing checked off yet.</p>}
      </section>
    </div>
  );
}

type Item = {
  id: string;
  title: string;
  notes: string | null;
  category: string | null;
  target_date: string | null;
  completed_at: string | null;
};

function Row({ item, toggleDone, deleteItem }: {
  item: Item;
  toggleDone: (fd: FormData) => Promise<void>;
  deleteItem: (fd: FormData) => Promise<void>;
}) {
  return (
    <div className={`card p-3 flex items-start justify-between gap-3 ${item.completed_at ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <div className="font-medium">{item.title}</div>
        {item.notes && <p className="muted text-xs">{item.notes}</p>}
        <div className="flex gap-1 mt-1">
          {item.category && <span className="pill">{item.category}</span>}
          {item.target_date && <span className="pill">by {item.target_date}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <form action={toggleDone}>
          <input type="hidden" name="id" value={item.id} />
          <button className="btn btn-ghost text-xs" type="submit">{item.completed_at ? "Reopen" : "Done"}</button>
        </form>
        <form action={deleteItem}>
          <input type="hidden" name="id" value={item.id} />
          <button className="btn btn-ghost text-xs" type="submit">Delete</button>
        </form>
      </div>
    </div>
  );
}
