"use client";

import { useEffect, useState } from "react";
import { MapPin, Plane, CalendarHeart, Moon } from "lucide-react";
import SubmitButton from "@/components/SubmitButton";
import {
  DEFAULT_RHYTHM, type Rhythm, inferStatus, bothFreeHint, haversineMiles,
  activeNow, lastSeenLabel, countdownTo, clockLabel, utcToZonedInput,
} from "@/lib/presence";

export type Person = {
  userId: string;
  name: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string | null;
  wakeHour: number | null;
  sleepHour: number | null;
  workStartHour: number | null;
  workEndHour: number | null;
  lastActiveAt: string | null;
};

type Action = (formData: FormData) => Promise<void>;

function rhythmOf(p: Person): Rhythm {
  return {
    timezone: p.timezone || DEFAULT_RHYTHM.timezone,
    wakeHour: p.wakeHour ?? DEFAULT_RHYTHM.wakeHour,
    sleepHour: p.sleepHour ?? DEFAULT_RHYTHM.sleepHour,
    workStartHour: p.workStartHour ?? DEFAULT_RHYTHM.workStartHour,
    workEndHour: p.workEndHour ?? DEFAULT_RHYTHM.workEndHour,
  };
}

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const TZS = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "Europe/London"];

export default function TogetherView({
  me, partner, nextVisit, saveVisit, saveRhythm,
}: {
  me: Person;
  partner: Person | null;
  nextVisit: { at: string | null; label: string | null; traveler: string | null };
  saveVisit: Action;
  saveRhythm: Action;
}) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [activity, setActivity] = useState({ me: me.lastActiveAt, partner: partner?.lastActiveAt ?? null });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/presence");
        if (!r.ok) return;
        const j = (await r.json()) as { me: string | null; partner: string | null };
        if (alive) setActivity({ me: j.me ?? null, partner: j.partner ?? null });
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(poll, 45_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const myRhythm = rhythmOf(me);
  const myName = me.name ?? "You";
  const partnerName = partner?.name ?? "Your partner";

  const distance =
    me.lat != null && me.lng != null && partner?.lat != null && partner?.lng != null
      ? Math.round(haversineMiles(me.lat, me.lng, partner.lat, partner.lng))
      : null;

  const cd = countdownTo(nextVisit.at, now);
  const hint = partner ? bothFreeHint(now, myRhythm, rhythmOf(partner)) : null;

  const travelerLine = (() => {
    if (!nextVisit.traveler || !partner) return null;
    if (nextVisit.traveler === me.userId) return `You're heading to ${partner.city ?? partnerName}`;
    if (nextVisit.traveler === partner.userId) return `${partnerName} is coming to ${me.city ?? "you"}`;
    return null;
  })();

  return (
    <div className="space-y-6">
      {/* Hero: distance + countdown */}
      <section className="hero-glow card p-6 text-center space-y-4">
        {distance != null ? (
          <p className="muted flex items-center justify-center gap-1.5 text-sm">
            <MapPin size={14} aria-hidden />
            {me.city ?? "You"} <span className="opacity-60">↔</span> {partner?.city ?? partnerName}
            <span className="mx-1 opacity-60">·</span>
            <span className="text-ink">{distance.toLocaleString()} miles apart</span>
          </p>
        ) : (
          <p className="muted text-sm">Set both your cities below to see the distance between you.</p>
        )}

        {cd && !cd.done ? (
          <div>
            <div className="label !mb-1 flex items-center justify-center gap-1.5"><CalendarHeart size={13} aria-hidden /> Until {nextVisit.label || "you're together"}</div>
            <div className="font-display font-medium leading-none flex items-end justify-center gap-3 sm:gap-4" suppressHydrationWarning>
              <Unit n={cd.days} u="days" />
              <Unit n={cd.hours} u="hrs" />
              <Unit n={cd.mins} u="min" />
              <Unit n={cd.secs} u="sec" />
            </div>
            {travelerLine && <p className="muted text-sm mt-3 flex items-center justify-center gap-1.5"><Plane size={13} aria-hidden /> {travelerLine}</p>}
          </div>
        ) : cd?.done ? (
          <p className="display text-3xl">You&apos;re together right now. 💛</p>
        ) : (
          <p className="muted text-sm">No visit on the calendar yet — add one below and watch it count down.</p>
        )}
      </section>

      {/* Presence: auto-inferred, no daily tapping */}
      <section className="space-y-3">
        <div className={`grid gap-3 ${partner ? "grid-cols-2" : "grid-cols-1"}`}>
          <PersonCard person={me} rhythm={myRhythm} now={now} lastActive={activity.me} labelOverride={myName} isMe />
          {partner && <PersonCard person={partner} rhythm={rhythmOf(partner)} now={now} lastActive={activity.partner} labelOverride={partnerName} />}
        </div>
        {hint && (
          <p className="text-center text-sm rounded-xl2 border border-accent/30 bg-accent/10 text-ink py-2.5 px-3">{hint}</p>
        )}
        {!partner && <p className="muted text-center text-sm">{partnerName} hasn&apos;t joined yet — presence will light up once they&apos;re in.</p>}
      </section>

      {/* Setup — one-time; the rest runs itself */}
      <details className="card p-4">
        <summary className="cursor-pointer font-display font-medium">Next visit</summary>
        <form action={saveVisit} className="space-y-3 mt-3">
          <input type="hidden" name="tz" value={myRhythm.timezone} />
          <div>
            <label className="label">When</label>
            <input className="input" type="datetime-local" name="at" defaultValue={utcToZonedInput(nextVisit.at, myRhythm.timezone)} />
          </div>
          <div>
            <label className="label">What to call it</label>
            <input className="input" name="label" defaultValue={nextVisit.label ?? ""} placeholder="e.g. Maria's visit, our weekend" />
          </div>
          {partner && (
            <div>
              <label className="label">Who's traveling</label>
              <select className="input" name="traveler" defaultValue={nextVisit.traveler ?? ""}>
                <option value="">—</option>
                <option value={me.userId}>You visit {partnerName}</option>
                <option value={partner.userId}>{partnerName} visits you</option>
              </select>
            </div>
          )}
          <SubmitButton className="btn btn-primary w-full">Save visit</SubmitButton>
        </form>
      </details>

      <details className="card p-4">
        <summary className="cursor-pointer font-display font-medium flex items-center gap-2"><Moon size={15} aria-hidden /> Your city & daily rhythm</summary>
        <p className="muted text-xs mt-2">Set once. We use it to show whether it&apos;s a good time to reach out — no daily check-ins.</p>
        <form action={saveRhythm} className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Your city</label>
              <input className="input" name="city" defaultValue={me.city ?? "Charlotte, NC"} placeholder="City" />
            </div>
            <div>
              <label className="label">Timezone</label>
              <select className="input" name="timezone" defaultValue={me.timezone ?? DEFAULT_RHYTHM.timezone}>
                {TZS.map((tz) => <option key={tz} value={tz}>{tz.replace("America/", "").replace("Europe/", "").replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HourSelect name="wake_hour" label="Usually wake" value={me.wakeHour ?? DEFAULT_RHYTHM.wakeHour} />
            <HourSelect name="sleep_hour" label="Usually sleep" value={me.sleepHour ?? DEFAULT_RHYTHM.sleepHour} />
            <HourSelect name="work_start_hour" label="Work starts" value={me.workStartHour ?? DEFAULT_RHYTHM.workStartHour} allowNone />
            <HourSelect name="work_end_hour" label="Work ends" value={me.workEndHour ?? DEFAULT_RHYTHM.workEndHour} allowNone />
          </div>
          <SubmitButton className="btn btn-primary w-full">Save rhythm</SubmitButton>
        </form>
      </details>
    </div>
  );
}

function Unit({ n, u }: { n: number; u: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-4xl sm:text-5xl tabular-nums leading-none">{String(n).padStart(2, "0")}</span>
      <span className="label !mb-0 mt-1.5">{u}</span>
    </span>
  );
}

function PersonCard({
  person, rhythm, now, lastActive, labelOverride, isMe,
}: {
  person: Person; rhythm: Rhythm; now: Date; lastActive: string | null; labelOverride: string; isMe?: boolean;
}) {
  const status = inferStatus(now, rhythm);
  const online = activeNow(lastActive, now);
  const configured = person.timezone != null;
  return (
    <div className="card p-4 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-display font-medium truncate">{labelOverride}</span>
        {online && <span className="relative inline-flex shrink-0"><span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>}
      </div>
      <div className="text-xs" suppressHydrationWarning>
        {online ? <span className="text-emerald-400">here now</span> : <span className="text-muted">{lastSeenLabel(lastActive, now)}</span>}
      </div>
      <div className="flex items-baseline gap-2 pt-0.5" suppressHydrationWarning>
        <span className="text-2xl" aria-hidden>{status.emoji}</span>
        <span className="text-ink leading-tight">{status.label}</span>
      </div>
      <p className="muted text-xs" suppressHydrationWarning>
        {person.city ? `${person.city} · ` : ""}{clockLabel(now, rhythm.timezone)}
        {!configured && !isMe ? " · typical hours" : ""}
      </p>
    </div>
  );
}

function HourSelect({ name, label, value, allowNone }: { name: string; label: string; value: number; allowNone?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" name={name} defaultValue={String(value)}>
        {allowNone && <option value="">—</option>}
        {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
      </select>
    </div>
  );
}
