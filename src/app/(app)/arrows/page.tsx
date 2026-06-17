import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import ArrowsGame, { type Result } from "./ArrowsGame";

function todayKey(): string {
  // Date-only in a fixed zone so both partners share the same daily puzzle.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function ArrowsPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const day = todayKey();
  const dailyKey = `D${day}`;

  const [{ data: mine }, { data: partnerRow }, { data: partner }, { data: dailyResults }] = await Promise.all([
    supabase.from("arrows_progress").select("level").eq("user_id", me.userId).maybeSingle(),
    supabase.from("arrows_progress").select("level, user_id").neq("user_id", me.userId).maybeSingle(),
    supabase.from("profiles").select("user_id, display_name").neq("user_id", me.userId).limit(1).maybeSingle(),
    supabase.from("arrows_results").select("user_id, moves, time_ms").eq("couple_id", me.coupleId).eq("puzzle_key", dailyKey),
  ]);

  const startLevel = Math.max(1, mine?.level ?? 1);
  const partnerLevel = partnerRow?.level ?? null;
  const partnerName = partner?.display_name ?? "Partner";

  const myDaily: Result = (dailyResults ?? []).find((r) => r.user_id === me.userId)
    ? { moves: dailyResults!.find((r) => r.user_id === me.userId)!.moves, timeMs: dailyResults!.find((r) => r.user_id === me.userId)!.time_ms }
    : null;
  const partnerDaily: Result = (dailyResults ?? []).find((r) => r.user_id !== me.userId)
    ? (() => { const r = dailyResults!.find((x) => x.user_id !== me.userId)!; return { moves: r.moves, timeMs: r.time_ms }; })()
    : null;

  async function saveLevel(level: number) {
    "use server";
    const me = await requireCoupled();
    if (!Number.isFinite(level) || level < 1) return;
    const supabase = await supabaseServer();
    const { data: cur } = await supabase.from("arrows_progress").select("level").eq("user_id", me.userId).maybeSingle();
    if (cur && cur.level >= level) return;
    await supabase.from("arrows_progress").upsert({ user_id: me.userId, couple_id: me.coupleId, level, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    revalidatePath("/arrows");
  }

  async function recordResult(puzzleKey: string, moves: number, timeMs: number) {
    "use server";
    const me = await requireCoupled();
    if (!puzzleKey || !Number.isFinite(moves) || !Number.isFinite(timeMs)) return;
    const supabase = await supabaseServer();
    const { data: cur } = await supabase.from("arrows_results").select("moves, time_ms").eq("user_id", me.userId).eq("puzzle_key", puzzleKey).maybeSingle();
    // Keep the better: fewer moves, then faster.
    if (cur && (cur.moves < moves || (cur.moves === moves && cur.time_ms <= timeMs))) return;
    await supabase.from("arrows_results").upsert(
      { user_id: me.userId, couple_id: me.coupleId, puzzle_key: puzzleKey, moves, time_ms: timeMs },
      { onConflict: "user_id,puzzle_key" }
    );
    revalidatePath("/arrows");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Arrows</h1>
        <p className="muted">A calm little puzzle. Clear the grid; chase each other&apos;s scores.</p>
      </header>
      <ArrowsGame
        startLevel={startLevel}
        partnerLevel={partnerLevel}
        partnerName={partnerName}
        dailyDate={day}
        dailyKey={dailyKey}
        myDaily={myDaily}
        partnerDaily={partnerDaily}
        saveLevel={saveLevel}
        recordResult={recordResult}
      />
    </div>
  );
}
