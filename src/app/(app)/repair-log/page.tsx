import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/groq";
import LocalTime from "@/components/LocalTime";
import DeleteButton from "@/components/DeleteButton";
import RepairFlow from "./RepairFlow";
import { HeartHandshake } from "lucide-react";

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

      <section className="space-y-2">
        <h3 className="label">Your repairs</h3>
        {entries.length === 0 ? (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><HeartHandshake size={22} aria-hidden /></div>
            <p className="font-bold pt-2">Nothing here yet — and that&apos;s okay.</p>
            <p className="muted">When something stings, walk through the four steps above.</p>
          </div>
        ) : (
          <div className="thread">
            {entries.map((e) => {
              const mine = e.author_id === me.userId;
              return (
                <div key={e.id} className="contents">
                  <article className={`bubble w-[88%] space-y-2.5 ${mine ? "bubble-me" : "bubble-them"}`}>
                    <Line label="What set it off" value={e.trigger} />
                    <Line label="The feeling" value={e.feeling} />
                    <Line label="The need" value={e.need} />
                    <Line label="One small repair" value={e.repair} strong />
                  </article>
                  <div className={`stamp flex items-center gap-1.5 flex-wrap mb-2 ${mine ? "self-end justify-end" : ""}`}>
                    <span>{mine ? "You" : partnerName} · <LocalTime iso={e.created_at} mode="relative" /></span>
                    {mine && (
                      <form action={remove} className="inline-flex">
                        <input type="hidden" name="id" value={e.id} />
                        <DeleteButton className="underline underline-offset-2 hover:text-ink min-h-[32px] px-1" confirmText="Delete this repair? It can't be undone." />
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// Labels inherit the bubble's own text colour at reduced strength, so they stay
// legible on both the grey and the accent bubble.
function Line({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[13px] font-semibold opacity-80">{label}</div>
      <p className={`whitespace-pre-wrap ${strong ? "font-semibold" : ""}`}>{value}</p>
    </div>
  );
}
