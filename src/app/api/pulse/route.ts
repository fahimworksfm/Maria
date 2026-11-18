import { NextResponse } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { sendToUser, pushEnabled } from "@/lib/push";

export const dynamic = "force-dynamic";

// A wordless pulse, sent from the one-tap chip on Home. Mirrors the Pulse
// page's own send action: one row in nudges, then a push if it's configured.
export async function POST() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: p } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();
  if (!p?.user_id) return NextResponse.json({ error: "No partner yet" }, { status: 400 });

  const { error } = await supabase.from("nudges").insert({
    couple_id: me.coupleId,
    from_user: me.userId,
    to_user: p.user_id,
    kind: "pulse",
    message: null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (pushEnabled()) {
    try {
      await sendToUser(p.user_id, {
        title: `${me.displayName ?? "Your partner"} sent a pulse`,
        body: "Thinking of you. 💗",
        url: "/pulse",
        vibrate: [180, 80, 180, 80, 180],
      });
    } catch {
      // The pulse is saved either way; a failed push shouldn't fail the send.
    }
  }
  return NextResponse.json({ ok: true });
}
