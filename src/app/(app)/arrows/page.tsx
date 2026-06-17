import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import ArrowsGame from "./ArrowsGame";

export default async function ArrowsPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();

  const [{ data: mine }, { data: partnerRow }, { data: partner }] = await Promise.all([
    supabase.from("arrows_progress").select("level").eq("user_id", me.userId).maybeSingle(),
    supabase.from("arrows_progress").select("level, user_id").neq("user_id", me.userId).maybeSingle(),
    supabase.from("profiles").select("display_name").neq("user_id", me.userId).limit(1).maybeSingle(),
  ]);

  const startLevel = Math.max(1, mine?.level ?? 1);
  const partnerLevel = partnerRow?.level ?? null;
  const partnerName = partner?.display_name ?? "Partner";

  async function saveLevel(level: number) {
    "use server";
    const me = await requireCoupled();
    if (!Number.isFinite(level) || level < 1) return;
    const supabase = await supabaseServer();
    // Only ever advance — never lower a saved level on replay.
    const { data: cur } = await supabase.from("arrows_progress").select("level").eq("user_id", me.userId).maybeSingle();
    if (cur && cur.level >= level) return;
    await supabase
      .from("arrows_progress")
      .upsert({ user_id: me.userId, couple_id: me.coupleId, level, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    revalidatePath("/arrows");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Arrows</h1>
        <p className="muted">A calm little puzzle. Clear the grid; chase each other&apos;s levels.</p>
      </header>
      <ArrowsGame startLevel={startLevel} partnerLevel={partnerLevel} partnerName={partnerName} saveLevel={saveLevel} />
    </div>
  );
}
