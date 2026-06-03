import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushEnabled, sendToUser } from "@/lib/push";

// Daily job: notify couples about anniversaries / birthdays that fall today or
// are coming up soon. Uses the admin client (system-wide, bypasses RLS).
//
// Timezone: anniversaries are date-only. We resolve "today" in a fixed zone
// (default America/New_York) so the day-of notification lands on the right
// calendar day for the couple rather than at UTC midnight.

type Window = { days: number; lead: string };
const WINDOWS: Window[] = [
  { days: 0, lead: "is today" },
  { days: 3, lead: "is in 3 days" },
];

function ymdInTZ(date: Date, tz: string): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export type AnniversaryRunResult = {
  ran: boolean;
  reason?: string;
  events: number;
  notificationsSent: number;
};

export async function runAnniversaryCheck(
  opts: { tz?: string; now?: Date } = {}
): Promise<AnniversaryRunResult> {
  if (!pushEnabled()) return { ran: false, reason: "push not configured", events: 0, notificationsSent: 0 };

  const tz = opts.tz ?? process.env.CRON_TZ ?? "America/New_York";
  const todayISO = ymdInTZ(opts.now ?? new Date(), tz);

  const admin = supabaseAdmin();
  const [{ data: annivs }, { data: profiles }] = await Promise.all([
    admin.from("anniversaries").select("couple_id, name, on_date, kind, recurring"),
    admin.from("profiles").select("user_id, couple_id, display_name, birthday"),
  ]);

  // couple_id -> member user_ids
  const members = new Map<string, string[]>();
  for (const p of profiles ?? []) {
    if (!p.couple_id) continue;
    if (!members.has(p.couple_id)) members.set(p.couple_id, []);
    members.get(p.couple_id)!.push(p.user_id);
  }

  // Precompute target dates per window.
  const targets = WINDOWS.map((w) => ({ ...w, iso: addDays(todayISO, w.days), md: addDays(todayISO, w.days).slice(5) }));

  type Notice = { recipient: string; title: string; body: string };
  const notices: Notice[] = [];

  function matches(onDate: string, recurring: boolean, t: { iso: string; md: string }): boolean {
    return recurring ? onDate.slice(5) === t.md : onDate === t.iso;
  }

  // Explicit anniversaries / milestones → notify both members.
  for (const a of annivs ?? []) {
    for (const t of targets) {
      if (!matches(a.on_date, a.recurring, t)) continue;
      const recipients = members.get(a.couple_id) ?? [];
      for (const uid of recipients) {
        notices.push({
          recipient: uid,
          title: "Tether",
          body: `${a.name} ${t.lead}.`,
        });
      }
    }
  }

  // Birthdays (from profiles) → notify the PARTNER, not the birthday person.
  for (const p of profiles ?? []) {
    if (!p.birthday || !p.couple_id) continue;
    for (const t of targets) {
      if (!matches(p.birthday, true, t)) continue;
      const recipients = (members.get(p.couple_id) ?? []).filter((uid) => uid !== p.user_id);
      for (const uid of recipients) {
        notices.push({
          recipient: uid,
          title: "Tether",
          body: `${p.display_name ?? "Your partner"}'s birthday ${t.lead}.`,
        });
      }
    }
  }

  let notificationsSent = 0;
  for (const n of notices) {
    const res = await sendToUser(n.recipient, {
      title: n.title,
      body: n.body,
      url: "/anniversaries",
      vibrate: [120, 60, 120],
    });
    notificationsSent += res.sent;
  }

  return { ran: true, events: notices.length, notificationsSent };
}
