import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/groq";
import LocalTime from "@/components/LocalTime";
import DeleteButton from "@/components/DeleteButton";
import RepairFlow from "./RepairFlow";

type Entry = {
  id: string;
  author_id: string;
  trigger: string | null;
  feeling: string | null;
  need: string | null;
  repair: string | null;
  created_at: string;
};

export default async function RepairLogPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();

  const { data: rows } = await supabase
    .from("repair_entries")
    .select("id, author_id, trigger, feeling, need, repair, created_at")
    .eq("couple_id", me.coupleId)
    .order("created_at", { ascending: false });

  const { data: partner } = await supabase
    .from("profiles")
    .select("display_name")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();
  const partnerName = partner?.display_name ?? "your partner";

  async function addEntry(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const trigger = String(formData.get("trigger") || "").trim() || null;
    const feeling = String(formData.get("feeling") || "").trim() || null;
    const need = String(formData.get("need") || "").trim() || null;
    const repair = String(formData.get("repair") || "").trim() || null;
    if (!trigger && !feeling && !need && !repair) return;
    await supabase.from("repair_entries").insert({
      couple_id: me.coupleId,
      author_id: me.userId,
      trigger,
      feeling,
      need,
      repair,
    });
    revalidatePath("/repair-log");
  }

  async function remove(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase.from("repair_entries").delete().eq("id", id);
    revalidatePath("/repair-log");
  }

  const entries = (rows ?? []) as Entry[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Repair Log</h1>
        <p className="muted">Not a record of who was right. A quiet way back to each other.</p>
      </header>

      <RepairFlow action={addEntry} aiEnabled={aiEnabled()} />

      <section className="space-y-1">
        <h3 className="label">Your repairs</h3>
        {entries.length === 0 ? (
          <div className="card p-5 text-center space-y-1">
            <div className="text-3xl">🤍</div>
            <p className="font-display text-base">Nothing here yet — and that&apos;s okay.</p>
            <p className="muted text-sm">When something stings, walk through the four steps above.</p>
          </div>
        ) : (
          <ol className="relative ml-3 border-l border-line">
            {entries.map((e) => (
              <li key={e.id} className="relative pl-6 pb-6">
                <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent" />
                <div className="card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="muted text-xs">
                      <LocalTime iso={e.created_at} mode="relative" /> · {e.author_id === me.userId ? "you" : partnerName}
                    </span>
                    {e.author_id === me.userId && (
                      <form action={remove}>
                        <input type="hidden" name="id" value={e.id} />
                        <DeleteButton confirmText="Delete this repair? It can't be undone." />
                      </form>
                    )}
                  </div>
                  <Line label="What set it off" value={e.trigger} />
                  <Line label="The feeling" value={e.feeling} />
                  <Line label="The need" value={e.need} />
                  <Line label="One small repair" value={e.repair} accent />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Line({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="muted text-[11px] uppercase tracking-wider">{label}</div>
      <p className={`text-sm whitespace-pre-wrap ${accent ? "text-ink" : ""}`}>{value}</p>
    </div>
  );
}
