import { NextResponse } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { sendToUser, pushEnabled } from "@/lib/push";

export async function POST() {
  const me = await requireCoupled();
  if (!pushEnabled()) return NextResponse.json({ error: "VAPID not configured" }, { status: 400 });
  const res = await sendToUser(me.userId, {
    title: "Tether",
    body: "Push notifications are working.",
    url: "/pulse",
  });
  return NextResponse.json(res);
}
