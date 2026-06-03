import { NextResponse, type NextRequest } from "next/server";
import { runAnniversaryCheck } from "@/lib/anniversary-notify";

export const dynamic = "force-dynamic";

// Secret-protected daily job. Trigger from a scheduler (GitHub Action / Vercel
// Cron) with header `Authorization: Bearer <CRON_SECRET>`. Without a configured
// secret the endpoint refuses to run, so it can't be used to blast pushes.

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
    const result = await runAnniversaryCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "anniversary check failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
