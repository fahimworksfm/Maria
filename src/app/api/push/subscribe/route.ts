import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const me = await requireCoupled();
  const body = await req.json().catch(() => null) as
    | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const admin = supabaseAdmin();
  await admin.from("push_subscriptions").upsert(
    {
      endpoint: body.endpoint,
      user_id: me.userId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await requireCoupled();
  const body = await req.json().catch(() => null) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  const admin = supabaseAdmin();
  await admin.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
