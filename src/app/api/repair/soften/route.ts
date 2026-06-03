import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { aiEnabled, softenNote } from "@/lib/groq";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await requireCoupled();
  if (!aiEnabled()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = (body?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Nothing to soften" }, { status: 400 });
  if (text.length > 600) return NextResponse.json({ error: "Too long" }, { status: 400 });
  try {
    const softened = await softenNote(text);
    return NextResponse.json({ softened });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Soften failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
