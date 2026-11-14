import Link from "next/link";
import { Compass, Dices, Heart, HeartPulse, Images, Mail, NotebookPen, Sprout, type LucideIcon } from "lucide-react";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import InstallPrompt from "@/components/InstallPrompt";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StreakLine from "@/components/StreakLine";
import LocalTime from "@/components/LocalTime";
import ModuleDirectory from "./ModuleDirectory";
import { getTogetherStreak } from "@/lib/streak";

const MOOD_EMOJI = ["😞", "😕", "🙂", "😊", "🤩"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function Home() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: memoriesCount },
    { data: todaysJournal },
    { count: bucketOpen },
    { count: unreadPulses },
    { data: annivs },
    { data: partner },
    { data: partnerSignal },
    { data: recentPulses },
  ] = await Promise.all([
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("couple_id", me.coupleId),
    supabase.from("journal_entries").select("author_id").eq("couple_id", me.coupleId).eq("prompt_date", today),
    supabase.from("bucket_items").select("id", { count: "exact", head: true }).eq("couple_id", me.coupleId).is("completed_at", null),
    supabase.from("nudges").select("id", { count: "exact", head: true }).eq("to_user", me.userId).is("read_at", null),
    supabase.from("anniversaries").select("name, on_date, recurring").eq("couple_id", me.coupleId),
    supabase.from("profiles").select("display_name").neq("user_id", me.userId).limit(1).maybeSingle(),
    supabase.from("mood_signals").select("mood, from_user").eq("couple_id", me.coupleId).eq("on_date", today).neq("from_user", me.userId).maybeSingle(),
    // The last day of pulses, both ways: these are the messages in the thread.
    supabase.from("nudges").select("id, from_user, message, read_at, created_at").eq("couple_id", me.coupleId).gte("created_at", new Date(Date.now() - 86_400_000).toISOString()).order("created_at", { ascending: false }).limit(4),
  ]);

  const streak = await getTogetherStreak(supabase, me.coupleId);
  const journalAnswered = todaysJournal?.length ?? 0;
  const youAnswered = (todaysJournal ?? []).some((e) => e.author_id === me.userId);
  const partnerName = partner?.display_name ?? "your partner";
  const partnerHeavyDay = Boolean(partnerSignal);
  const partnerMoodEmoji = partnerSignal && typeof partnerSignal.mood === "number" ? MOOD_EMOJI[partnerSignal.mood - 1] : null;

  const card = pickToday({ unreadPulses: unreadPulses ?? 0, youAnswered, journalAnswered, annivs: annivs ?? [], partnerName, partnerHeavyDay, partnerMoodEmoji });
  const HeroIcon = card.Icon;

  const pulses = [...(recentPulses ?? [])].reverse();

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="mood_signals" coupleId={me.coupleId} />
      <RealtimeRefresh table="nudges" coupleId={me.coupleId} />
      <InstallPrompt variant="banner" />

      {/* Home is the conversation itself: what passed between you today, then
          the one thing Tether has to say, then what you can send back. */}
      <section className="thread fade-up" aria-label="Today">
        <div className="day-mark flex items-center gap-2">
          <span>{greeting()}{me.displayName ? `, ${me.displayName}` : ""}</span>
          <StreakLine days={streak} className="before:content-['·'] before:mr-2" />
        </div>

        {partnerHeavyDay && card.kind !== "heavy" && (
          <Link href="/pulse" className="bubble bubble-them">
            {partnerName} is having a heavy day{partnerMoodEmoji ? ` ${partnerMoodEmoji}` : ""}.
          </Link>
        )}

        {pulses.map((n) => {
          const mine = n.from_user === me.userId;
          const unread = !mine && !n.read_at;
          return (
            <div key={n.id} className="contents">
              <Link href="/pulse" className={`bubble flex items-center gap-2 ${mine ? "bubble-me" : "bubble-them"} ${unread ? "bubble-new" : ""}`}>
                <Heart size={15} fill="currentColor" className="shrink-0" aria-hidden />
                <span>{n.message ?? (mine ? "You sent a pulse" : `${partnerName} sent a pulse`)}</span>
              </Link>
              <span className={`stamp ${mine ? "self-end" : ""}`}>
                <LocalTime iso={n.created_at} mode="relative" />{unread ? " · new" : ""}
              </span>
            </div>
          );
        })}

        {journalAnswered === 1 && !youAnswered && card.kind !== "prompt" && (
          <Link href="/journal" className="bubble bubble-them">{partnerName} answered today&apos;s prompt.</Link>
        )}
        {youAnswered && (
          <Link href="/journal" className="bubble bubble-me">You answered today&apos;s prompt.</Link>
        )}

        <div className="card p-4 mt-2 space-y-2.5">
          <p className="label !mb-0">Tether</p>
          <h1 className="display text-[1.4rem]">{card.headline}</h1>
          <p className="text-muted text-[15px] leading-snug">{card.subtext}</p>
          <Link href={card.href} className="btn btn-primary w-full gap-2">
            <HeroIcon size={16} aria-hidden /> {card.cta}
          </Link>
        </div>

        <p className="day-mark">
          <Link href="/memories" className="hover:text-ink">{memoriesCount ?? 0} memories kept</Link>
          {" · "}
          <Link href="/bucket-list" className="hover:text-ink">{bucketOpen ?? 0} open dreams</Link>
        </p>
      </section>

      {/* What you can send back, where a composer would sit. */}
      <nav aria-label="Quick actions" className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <Link href="/pulse" className="chip"><HeartPulse size={15} aria-hidden /> Send a pulse</Link>
        <Link href="/memories" className="chip"><Images size={15} aria-hidden /> Add a memory</Link>
        <Link href="/date-roulette" className="chip"><Dices size={15} aria-hidden /> Spin a date</Link>
      </nav>

      <section className="space-y-3">
        <h2 className="h2">Spaces</h2>
        <ModuleDirectory />
      </section>
    </div>
  );
}

type Anniv = { name: string; on_date: string; recurring: boolean };
type Card = { kind: "anniversary" | "heavy" | "pulses" | "prompt" | "gratitude" | "waiting"; Icon: LucideIcon; headline: string; subtext: string; cta: string; href: string };

function pickToday(input: {
  unreadPulses: number; youAnswered: boolean; journalAnswered: number;
  annivs: Anniv[]; partnerName: string; partnerHeavyDay: boolean; partnerMoodEmoji: string | null;
}): Card {
  const today = new Date();
  const todayMD = `${today.getMonth() + 1}-${today.getDate()}`;
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const upcoming = input.annivs
    .map((a) => {
      const [, m, d] = a.on_date.split("-").map(Number);
      const md = `${m}-${d}`;
      let occurs = new Date(today.getFullYear(), m! - 1, d!);
      let days = Math.round((occurs.getTime() - startToday) / 86_400_000);
      if (days < 0 && a.recurring) { occurs = new Date(today.getFullYear() + 1, m! - 1, d!); days = Math.round((occurs.getTime() - startToday) / 86_400_000); }
      return { name: a.name, days, md };
    })
    .filter((a) => a.days >= 0)
    .sort((a, b) => a.days - b.days);

  const todays = upcoming.filter((a) => a.md === todayMD);
  if (todays.length > 0) return { kind: "anniversary", Icon: Compass, headline: `It's ${todays[0]!.name}.`, subtext: "Today is the day. Make it count.", cta: "Open Anniversaries", href: "/anniversaries" };
  if (input.partnerHeavyDay) return { kind: "heavy", Icon: HeartPulse, headline: `${input.partnerName} is having a heavy day.`, subtext: input.partnerMoodEmoji ? `Feeling ${input.partnerMoodEmoji} today. A pulse might help — no pressure to fix it.` : "A pulse might help — no pressure to fix it.", cta: "Send a pulse", href: "/pulse" };
  if (input.unreadPulses > 0) return { kind: "pulses", Icon: HeartPulse, headline: `${input.partnerName} sent ${input.unreadPulses} pulse${input.unreadPulses > 1 ? "s" : ""}.`, subtext: "Open Pulse to see and reply.", cta: "View pulses", href: "/pulse" };
  if (!input.youAnswered) return { kind: "prompt", Icon: NotebookPen, headline: "Today's prompt is waiting.", subtext: input.journalAnswered === 1 ? `${input.partnerName} already answered. Your turn.` : "Both of you answer, then it's revealed together.", cta: "Answer the prompt", href: "/journal" };
  if (input.journalAnswered === 2) {
    const soon = upcoming.find((a) => a.days <= 7);
    if (soon) return { kind: "anniversary", Icon: Compass, headline: `${soon.name} in ${soon.days} day${soon.days === 1 ? "" : "s"}.`, subtext: "Plan something small. They'll remember.", cta: "Open Anniversaries", href: "/anniversaries" };
    return { kind: "gratitude", Icon: Sprout, headline: "Plant a leaf?", subtext: "Both of you answered today's prompt. Round out the day with a small gratitude.", cta: "Open Gratitude Tree", href: "/gratitude" };
  }
  return { kind: "waiting", Icon: Mail, headline: `Waiting on ${input.partnerName}.`, subtext: "Your answer is locked in. Drop a memory or send a pulse while you wait.", cta: "Send a pulse", href: "/pulse" };
}
