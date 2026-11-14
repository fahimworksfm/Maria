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

      <form action={add} className="card p-3.5 space-y-2.5">
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Which love language?">
          {CATS.map((c) => (
            <label key={c.id} className="cursor-pointer">
              <input type="radio" name="category" value={c.id} className="peer sr-only" required />
              <div className="grid place-items-center min-h-[44px] px-1 rounded-xl2 border border-transparent bg-panel2 text-[13px] font-semibold text-center peer-checked:bg-[rgb(var(--c-prim-bg))] peer-checked:text-[rgb(var(--c-prim-fg))] peer-checked:border-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-accent">{c.label}</div>
            </label>
          ))}
        </div>
        <input className="input" name="note" aria-label="A small note (optional)" placeholder="A small note (optional)" />
        <SubmitButton className="btn btn-primary w-full">Log</SubmitButton>
      </form>

      <section className="grid grid-cols-2 gap-3">
        <Bars title="You logged" data={tally(mine)} />
        <Bars title="Partner logged" data={tally(theirs)} />
      </section>

      <section className="space-y-2">
        <h3 className="label">Recent</h3>
        <div className="thread">
          {(rows ?? []).slice(0, 20).map((r) => {
            const mine = r.user_id === me.userId;
            const label = CATS.find((c) => c.id === r.category)?.label ?? r.category;
            return (
              <div key={r.id} className="contents">
                <div className={`bubble ${mine ? "bubble-me" : "bubble-them"}`}>{r.note || label}</div>
                <span className={`stamp ${mine ? "self-end" : ""}`}>{mine ? "You" : "Partner"} · {label}</span>
              </div>
            );
          })}
          {(rows ?? []).length === 0 && <p className="muted text-center">Nothing logged yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Bars({ title, data }: { title: string; data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="card p-3">
      <div className="label">{title}</div>
      <div className="space-y-1.5">
        {CATS.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-[13px]">
            <span className="w-12 text-muted truncate">{c.label}</span>
            <div className="h-2 flex-1 bg-panel2 rounded-full">
              <div className="h-2 rounded-full" style={{ width: `${((data[c.id] ?? 0) / max) * 100}%`, background: "rgb(var(--c-prim-bg))" }} />
            </div>
            <span className="w-6 text-right tabular-nums">{data[c.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
