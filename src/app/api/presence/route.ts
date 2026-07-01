import { NextResponse } from "next/server";
import { getMe } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { runPresencePingsForCouple } from "@/lib/presence-notify";

// POST: stamp the current user's last_active_at. Called automatically by a
// heartbeat while the app is open, so presence is inferred with zero effort.
// Also opportunistically fires the good-morning / both-free pushes (no-op unless
// VAPID is configured).
export async function POST() {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await supabaseServer();
  await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("user_id", me.userId);
  if (me.coupleId) {
    try {
      await runPresencePingsForCouple(me.coupleId, me.userId);
    } catch {
      /* pings are best-effort; never fail the heartbeat */
    }
  }
  return NextResponse.json({ ok: true });
}

// GET: latest activity for both partners, so the Together view can refresh
// presence without a full reload.
export async function GET() {
  const me = await getMe();
  if (!me?.coupleId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, last_active_at")
    .eq("couple_id", me.coupleId);
  const mine = data?.find((r) => r.user_id === me.userId)?.last_active_at ?? null;
  const partner = data?.find((r) => r.user_id !== me.userId)?.last_active_at ?? null;
  return NextResponse.json({ me: mine, partner });
}
