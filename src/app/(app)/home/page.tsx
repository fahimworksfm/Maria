import Link from "next/link";
import { Compass, HeartPulse, Mail, NotebookPen, Sprout, type LucideIcon } from "lucide-react";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import InstallPrompt from "@/components/InstallPrompt";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StreakLine from "@/components/StreakLine";
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
  ] = await Promise.all([
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("couple_id", me.coupleId),
    supabase.from("journal_entries").select("author_id").eq("couple_id", me.coupleId).eq("prompt_date", today),
    supabase.from("bucket_items").select("id", { count: "exact", head: true }).eq("couple_id", me.coupleId).is("completed_at", null),
    supabase.from("nudges").select("id", { count: "exact", head: true }).eq("to_user", me.userId).is("read_at", null),
    supabase.from("anniversaries").select("name, on_date, recurring").eq("couple_id", me.coupleId),
    supabase.from("profiles").select("display_name").neq("user_id", me.userId).limit(1).maybeSingle(),
    supabase.from("mood_signals").select("mood, from_user").eq("couple_id", me.coupleId).eq("on_date", today).neq("from_user", me.userId).maybeSingle(),
  ]);

  const streak = await getTogetherStreak(supabase, me.coupleId);
  const journalAnswered = todaysJournal?.length ?? 0;
  const youAnswered = (todaysJournal ?? []).some((e) => e.author_id === me.userId);
  const partnerName = partner?.display_name ?? "your partner";
  const partnerHeavyDay = Boolean(partnerSignal);
  const partnerMoodEmoji = partnerSignal && typeof partnerSignal.mood === "number" ? MOOD_EMOJI[partnerSignal.mood - 1] : null;

  const card = pickToday({ unreadPulses: unreadPulses ?? 0, youAnswered, journalAnswered, annivs: annivs ?? [], partnerName, partnerHeavyDay, partnerMoodEmoji });
  const HeroIcon = card.Icon;

  return (
    <div className="space-y-8">
      <RealtimeRefresh table="mood_signals" coupleId={me.coupleId} />
      <InstallPrompt variant="banner" />

      {/* Editorial hero */}
      <section className="hero-glow card p-6 sm:p-7 fade-up">
        <div className="flex items-center justify-between gap-3">
          <p className="muted">{greeting()}{me.displayName ? `, ${me.displayName}` : ""}.</p>
          <StreakLine days={streak} />
        </div>
        <h1 className="display text-[2.3rem] sm:text-5xl mt-3">{card.headline}</h1>
        <p className="text-muted mt-3 max-w-md leading-relaxed">{card.subtext}</p>
        <Link href={card.href} className="btn btn-primary cta-glow inline-flex items-center gap-2 mt-6">
          <HeroIcon size={16} aria-hidden /> {card.cta}
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Stat href="/memories" label="Memories" value={memoriesCount ?? 0} />
        <Stat href="/bucket-list" label="Open dreams" value={bucketOpen ?? 0} />
        <Stat href="/pulse" label="Pulses" value={unreadPulses ?? 0} highlight={(unreadPulses ?? 0) > 0} />
      </section>

      <ModuleDirectory />
    </div>
  );
}

type Anniv = { name: string; on_date: string; recurring: boolean };
type Card = { Icon: LucideIcon; headline: string; subtext: string; cta: string; href: string };

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
  if (todays.length > 0) return { Icon: Compass, headline: `It's ${todays[0]!.name}.`, subtext: "Today is the day. Make it count.", cta: "Open Anniversaries", href: "/anniversaries" };
  if (input.partnerHeavyDay) return { Icon: HeartPulse, headline: `${input.partnerName} is having a heavy day.`, subtext: input.partnerMoodEmoji ? `Feeling ${input.partnerMoodEmoji} today. A pulse might help — no pressure to fix it.` : "A pulse might help — no pressure to fix it.", cta: "Send a pulse", href: "/pulse" };
  if (input.unreadPulses > 0) return { Icon: HeartPulse, headline: `${input.partnerName} sent ${input.unreadPulses} pulse${input.unreadPulses > 1 ? "s" : ""}.`, subtext: "Open Pulse to see and reply.", cta: "View pulses", href: "/pulse" };
  if (!input.youAnswered) return { Icon: NotebookPen, headline: "Today's prompt is waiting.", subtext: input.journalAnswered === 1 ? `${input.partnerName} already answered. Your turn.` : "Both of you answer, then it's revealed together.", cta: "Answer the prompt", href: "/journal" };
  if (input.journalAnswered === 2) {
    const soon = upcoming.find((a) => a.days <= 7);
    if (soon) return { Icon: Compass, headline: `${soon.name} in ${soon.days} day${soon.days === 1 ? "" : "s"}.`, subtext: "Plan something small. They'll remember.", cta: "Open Anniversaries", href: "/anniversaries" };
    return { Icon: Sprout, headline: "Plant a leaf?", subtext: "Both of you answered today's prompt. Round out the day with a small gratitude.", cta: "Open Gratitude Tree", href: "/gratitude" };
  }
  return { Icon: Mail, headline: `Waiting on ${input.partnerName}.`, subtext: "Your answer is locked in. Drop a memory or send a pulse while you wait.", cta: "Send a pulse", href: "/pulse" };
}

function Stat({ href, label, value, highlight }: { href: string; label: string; value: string | number; highlight?: boolean }) {
  return (
    <Link href={href} className={`block bg-panel border border-line rounded-xl2 py-3 px-2 text-center transition active:scale-95 hover:bg-panel2 ${highlight ? "ring-1 ring-accent/60" : ""}`}>
      <div className={`text-xl font-display font-medium leading-tight ${highlight ? "headline-gradient" : ""}`}>{value}</div>
      <div className="muted text-[10px] uppercase tracking-wider mt-1">{label}</div>
    </Link>
  );
}
