import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Lightweight endpoint pinged on a schedule to keep the free-tier Supabase
// project from auto-pausing after ~7 days of inactivity. Runs a trivial query
// so Supabase registers real API activity.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from("couples").select("id", { count: "exact", head: true });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "keepalive failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
