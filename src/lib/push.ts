import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

let configured = false;
let setupError: string | null = null;

function configure(): boolean {
  if (configured) return true;
  if (setupError) return false;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) {
    setupError = "VAPID env vars are missing (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).";
    return false;
  }
  if (!/^(mailto:|https?:\/\/)/i.test(subj)) {
    setupError = `VAPID_SUBJECT must start with "mailto:" or "https://" (got: ${subj.slice(0, 40)}).`;
    return false;
  }
  try {
    webpush.setVapidDetails(subj, pub, priv);
    configured = true;
    return true;
  } catch (e) {
    setupError = e instanceof Error ? e.message : "VAPID setup failed";
    return false;
  }
}

export function pushEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export function pushSetupError(): string | null {
  configure();
  return setupError;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  vibrate?: number[];
};

export async function sendToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; error?: string; details?: string[] }> {
  if (!configure()) return { sent: 0, failed: 0, error: setupError ?? "Push not configured" };
  const admin = supabaseAdmin();
  const { data: subs, error: qErr } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (qErr) return { sent: 0, failed: 0, error: `DB lookup failed: ${qErr.message}` };

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];
  const details: string[] = [];
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 }
      );
      sent++;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string; body?: string };
      const status = e.statusCode;
      if (status === 404 || status === 410) stale.push(s.endpoint);
      details.push(`${status ?? "?"}: ${e.message ?? "send failed"}`);
      failed++;
    }
  }
  if (stale.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", stale);
  }
  return { sent, failed, ...(details.length ? { details } : {}) };
}
