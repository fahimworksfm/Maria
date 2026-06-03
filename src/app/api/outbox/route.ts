import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

// Replay target for offline writes. Applies a queued intent using the user's
// own session (RLS + couple scoping enforced exactly like the server actions).
// Returns { ok: true } on success, 400 for permanently-invalid intents.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await requireCoupled();
  const body = (await req.json().catch(() => null)) as
    | { kind?: string; payload?: Record<string, unknown> }
    | null;
  if (!body?.kind) {
    return NextResponse.json({ ok: false, error: "Missing kind" }, { status: 400 });
  }
  const payload = body.payload ?? {};
  const supabase = await supabaseServer();

  switch (body.kind) {
    case "gratitude.add": {
      const text = String(payload.text ?? "").trim();
      if (!text) return NextResponse.json({ ok: false, error: "Empty gratitude" }, { status: 400 });
      const { error } = await supabase.from("gratitudes").insert({
        couple_id: me.coupleId,
        author_id: me.userId,
        text,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "mood.save": {
      const mood = Number(payload.mood);
      if (!Number.isFinite(mood) || mood < 1 || mood > 5) {
        return NextResponse.json({ ok: false, error: "Invalid mood" }, { status: 400 });
      }
      const on_date = typeof payload.on_date === "string" && payload.on_date
        ? payload.on_date
        : new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("mood_checkins").upsert(
        {
          user_id: me.userId,
          couple_id: me.coupleId,
          on_date,
          mood,
          note: payload.note ? String(payload.note).trim() : null,
          share_with_partner: payload.share_with_partner !== false,
        },
        { onConflict: "user_id,on_date" }
      );
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: `Unknown kind: ${body.kind}` }, { status: 400 });
  }
}
