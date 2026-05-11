import { NextResponse } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { sendToUser, pushEnabled, pushSetupError } from "@/lib/push";

export async function POST() {
  try {
    const me = await requireCoupled();
    if (!pushEnabled()) {
      return NextResponse.json({ error: "VAPID env vars are not set on the server." }, { status: 400 });
    }
    const setup = pushSetupError();
    if (setup) {
      return NextResponse.json({ error: setup }, { status: 500 });
    }
    const res = await sendToUser(me.userId, {
      title: "Tether",
      body: "Push notifications are working.",
      url: "/pulse",
    });
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
