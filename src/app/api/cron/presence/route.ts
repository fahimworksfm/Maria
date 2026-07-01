import { NextResponse, type NextRequest } from "next/server";
import { runPresenceNightSweep } from "@/lib/presence-notify";

export const dynamic = "force-dynamic";

// Secret-protected presence sweep. Trigger every ~15 min from a scheduler
// (GitHub Action / cron-job.org / Vercel Cron) with `Authorization: Bearer
// <CRON_SECRET>`. It sends the "turned in" good-night pings and catches the
// "you're both free" nudge. Without a configured secret it refuses to run.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const headerKey = req.headers.get("x-cron-key") ?? "";
  const queryKey = req.nextUrl.searchParams.get("key") ?? "";
  return bearer === secret || headerKey === secret || queryKey === secret;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPresenceNightSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "presence sweep failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
