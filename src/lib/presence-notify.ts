import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushEnabled, sendToUser } from "@/lib/push";
import { DEFAULT_RHYTHM, type Rhythm, inferStatus, localHour } from "@/lib/presence";

// Automatic long-distance presence pings — no daily tapping. Good-morning and
// both-free are driven by real app activity (called from the heartbeat);
// good-night needs an absence check, so it runs from a cron sweep. Everything is
// gated by pushEnabled(), so it's a silent no-op until VAPID is configured.
//
// De-dupe uses per-user timestamp guards stored in profiles.prefs.presence, so
// midnight/DST calendar boundaries can't double-fire or drop a ping.

const SELECT =
  "user_id, couple_id, display_name, timezone, wake_hour, sleep_hour, work_start_hour, work_end_hour, last_active_at, prefs";

type Row = {
  user_id: string;
  couple_id: string | null;
  display_name: string | null;
  timezone: string | null;
  wake_hour: number | null;
  sleep_hour: number | null;
  work_start_hour: number | null;
  work_end_hour: number | null;
  last_active_at: string | null;
  prefs: Record<string, unknown> | null;
};

type Admin = ReturnType<typeof supabaseAdmin>;
const H = 3_600_000;

function rhythm(r: Row): Rhythm {
  return {
    timezone: r.timezone || DEFAULT_RHYTHM.timezone,
    wakeHour: r.wake_hour ?? DEFAULT_RHYTHM.wakeHour,
    sleepHour: r.sleep_hour ?? DEFAULT_RHYTHM.sleepHour,
    workStartHour: r.work_start_hour ?? DEFAULT_RHYTHM.workStartHour,
    workEndHour: r.work_end_hour ?? DEFAULT_RHYTHM.workEndHour,
  };
}

const guardsOf = (r: Row): Record<string, string> => ((r.prefs?.presence as Record<string, string>) ?? {});
const sinceMs = (iso: string | undefined, nowMs: number) => (iso ? nowMs - new Date(iso).getTime() : Infinity);

async function setGuard(admin: Admin, r: Row, key: string, iso: string) {
  const prefs = { ...(r.prefs ?? {}), presence: { ...guardsOf(r), [key]: iso } };
  await admin.from("profiles").update({ prefs }).eq("user_id", r.user_id);
  r.prefs = prefs; // reflect locally so later checks in this run see it
}

const name = (r: Row) => r.display_name ?? "Your partner";

// Evaluate every ping for one couple's two members. `activeUserId` is set when a
// specific member just showed activity (enables their good-morning check).
async function evalCouple(admin: Admin, members: Row[], now: Date, activeUserId?: string): Promise<number> {
  if (members.length < 2) return 0;
  const nowMs = now.getTime();
  const nowISO = now.toISOString();
  let sent = 0;

  for (const me of members) {
    const partner = members.find((x) => x.user_id !== me.user_id)!;
    const r = rhythm(me);
    const g = guardsOf(me);

    // ☀️ Good morning — first activity inside their wake window, once per morning.
    if (activeUserId && me.user_id === activeUserId) {
      const h = localHour(now, r.timezone);
      if (h >= r.wakeHour && h < r.wakeHour + 3 && sinceMs(g.morning_at, nowMs) > 8 * H) {
        sent += (await sendToUser(partner.user_id, { title: "Tether", body: `☀️ ${name(me)} is up — good morning`, url: "/together", vibrate: [80, 40, 80] })).sent;
        await setGuard(admin, me, "morning_at", nowISO);
      }
    }

    // 🌙 Good night — was up in the last few hours but has gone quiet in their
    // sleep window. Only a cron run will see this (an active user isn't idle).
    const idle = sinceMs(me.last_active_at ?? undefined, nowMs);
    if (inferStatus(now, r).key === "asleep" && idle > 40 * 60_000 && idle < 3 * H && sinceMs(g.night_at, nowMs) > 8 * H) {
      sent += (await sendToUser(partner.user_id, { title: "Tether", body: `🌙 ${name(me)} turned in — goodnight`, url: "/together", vibrate: [80, 40, 80] })).sent;
      await setGuard(admin, me, "night_at", nowISO);
    }
  }

  // 🟢 Both free — one gentle mutual nudge per ~half-day.
  const [a, b] = members as [Row, Row];
  if (inferStatus(now, rhythm(a)).free && inferStatus(now, rhythm(b)).free) {
    const recent = sinceMs(guardsOf(a).both_free_at, nowMs) < 12 * H || sinceMs(guardsOf(b).both_free_at, nowMs) < 12 * H;
    if (!recent) {
      // Skip the one who's actively in the app (they already see the hint).
      const recipients = activeUserId ? members.filter((m) => m.user_id !== activeUserId) : members;
      for (const m of recipients) {
        sent += (await sendToUser(m.user_id, { title: "Tether", body: `🟢 You're both free — good time to call?`, url: "/together", vibrate: [80, 40, 80] })).sent;
      }
      for (const m of members) await setGuard(admin, m, "both_free_at", nowISO);
    }
  }

  return sent;
}

// Called from the presence heartbeat: morning + both-free for the active user's couple.
export async function runPresencePingsForCouple(coupleId: string, activeUserId: string): Promise<void> {
  if (!pushEnabled() || !coupleId) return;
  const admin = supabaseAdmin();
  const { data } = await admin.from("profiles").select(SELECT).eq("couple_id", coupleId);
  await evalCouple(admin, (data ?? []) as Row[], new Date(), activeUserId);
}

export type NightSweepResult = { ran: boolean; reason?: string; couples: number; sent: number };

// Called from cron: good-night + both-free across every couple.
export async function runPresenceNightSweep(now: Date = new Date()): Promise<NightSweepResult> {
  if (!pushEnabled()) return { ran: false, reason: "push not configured", couples: 0, sent: 0 };
  const admin = supabaseAdmin();
  const { data } = await admin.from("profiles").select(SELECT).not("couple_id", "is", null);
  const byCouple = new Map<string, Row[]>();
  for (const r of (data ?? []) as Row[]) {
    if (!r.couple_id) continue;
    const arr = byCouple.get(r.couple_id) ?? [];
    arr.push(r);
    byCouple.set(r.couple_id, arr);
  }
  let sent = 0;
  for (const members of byCouple.values()) sent += await evalCouple(admin, members, now);
  return { ran: true, couples: byCouple.size, sent };
}
