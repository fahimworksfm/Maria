import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  vibrate?: number[];
};

export async function sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!configure()) return { sent: 0, failed: 0 };
  const admin = supabaseAdmin();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  let sent = 0, failed = 0;
  const stale: string[] = [];
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 }
      );
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) stale.push(s.endpoint);
      failed++;
    }
  }
  if (stale.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", stale);
  }
  return { sent, failed };
}
