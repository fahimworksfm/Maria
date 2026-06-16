import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import SubmitButton from "@/components/SubmitButton";

const CATS = [
  { id: "words", label: "Words" },
  { id: "acts", label: "Acts" },
  { id: "gifts", label: "Gifts" },
  { id: "time", label: "Time" },
  { id: "touch", label: "Touch" },
];

export default async function LoveLanguagePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("love_language_logs")
    .select("id, user_id, category, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const mine = (rows ?? []).filter((r) => r.user_id === me.userId);
  const theirs = (rows ?? []).filter((r) => r.user_id !== me.userId);

  function tally(list: { category: string }[]) {
    const t: Record<string, number> = {};
    for (const r of list) t[r.category] = (t[r.category] ?? 0) + 1;
    return t;
  }

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const category = String(formData.get("category") || "");
    if (!CATS.find((c) => c.id === category)) return;
    await supabase.from("love_language_logs").insert({
      user_id: me.userId,
      couple_id: me.coupleId,
      category,
      note: String(formData.get("note") || "").trim() || null,
    });
    revalidatePath("/love-language");
  }

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Love Language</h1><p className="muted">Notice the small moments that matter.</p></header>

      <form action={add} className="card p-4 space-y-2">
        <div className="grid grid-cols-5 gap-2">
          {CATS.map((c) => (
            <label key={c.id} className="cursor-pointer">
              <input type="radio" name="category" value={c.id} className="peer sr-only" required />
              <div className="text-center py-2 rounded-lg border border-line bg-panel2 peer-checked:bg-accent peer-checked:text-bg text-sm">{c.label}</div>
            </label>
          ))}
        </div>
        <input className="input" name="note" placeholder="A small note (optional)" />
        <SubmitButton className="btn btn-primary w-full">Log</SubmitButton>
      </form>

      <section className="grid grid-cols-2 gap-3">
        <Bars title="You logged" data={tally(mine)} />
        <Bars title="Partner logged" data={tally(theirs)} />
      </section>

      <section>
        <h3 className="label">Recent</h3>
        <ul className="space-y-1 text-sm">
          {(rows ?? []).slice(0, 20).map((r) => (
            <li key={r.id} className="card p-2 flex justify-between gap-2">
              <span>{r.user_id === me.userId ? "You" : "Partner"} · <span className="pill">{r.category}</span></span>
              <span className="muted truncate">{r.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Bars({ title, data }: { title: string; data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="card p-3">
      <div className="label">{title}</div>
      <div className="space-y-1">
        {CATS.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs">
            <span className="w-12 muted">{c.label}</span>
            <div className="h-2 flex-1 bg-panel2 rounded">
              <div className="h-2 bg-accent rounded" style={{ width: `${((data[c.id] ?? 0) / max) * 100}%` }} />
            </div>
            <span className="w-6 text-right">{data[c.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
