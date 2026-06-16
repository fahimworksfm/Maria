import Link from "next/link";
import {
  History, Images, NotebookPen, Dices, Globe, Brain, Clapperboard, MapPin, Music, Map as MapIcon,
  ChefHat, Mic, CalendarRange, Compass, HeartHandshake, Gem, Sparkles, HeartPulse, Newspaper,
  Sprout, Mail, ClipboardList, Gift, Smile, Heart, Settings2, ArrowRight, type LucideIcon,
} from "lucide-react";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import InstallPrompt from "@/components/InstallPrompt";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StreakLine from "@/components/StreakLine";
import { getTogetherStreak } from "@/lib/streak";

const MOOD_EMOJI = ["😞", "😕", "🙂", "😊", "🤩"];

type Tile = { href: string; title: string; desc: string; zone: "shared" | "private" | "personal"; Icon: LucideIcon };

const TILES: Tile[] = [
  { Icon: History, href: "/timeline", title: "Timeline", desc: "Your whole story, woven together.", zone: "shared" },
  { Icon: Images, href: "/memories", title: "Memory Jar", desc: "Photos, notes, and moments.", zone: "shared" },
  { Icon: NotebookPen, href: "/journal", title: "Journal", desc: "A daily prompt for two.", zone: "shared" },
  { Icon: Dices, href: "/date-roulette", title: "Date Roulette", desc: "Spin up a plan for tonight.", zone: "shared" },
  { Icon: Globe, href: "/bucket-list", title: "Bucket List", desc: "Dreams in progress.", zone: "shared" },
  { Icon: Brain, href: "/quiz", title: "Know Me", desc: "Ask. Guess. Compare.", zone: "shared" },
  { Icon: Clapperboard, href: "/watchlist", title: "Watchlist", desc: "Movies and shows for us.", zone: "shared" },
  { Icon: MapPin, href: "/places", title: "Places", desc: "Restaurants and spots.", zone: "shared" },
  { Icon: Music, href: "/songs", title: "Our Songs", desc: "A playlist with stories.", zone: "shared" },
  { Icon: MapIcon, href: "/travel", title: "Travel", desc: "Pins and itineraries.", zone: "shared" },
  { Icon: ChefHat, href: "/recipes", title: "Recipes", desc: "What we cook together.", zone: "shared" },
  { Icon: Mic, href: "/voice-letters", title: "Voice Letters", desc: "Audio for later.", zone: "shared" },
  { Icon: CalendarRange, href: "/year", title: "Year in Review", desc: "Auto-generated recap.", zone: "shared" },
  { Icon: Compass, href: "/anniversaries", title: "Anniversaries", desc: "Countdowns to every date.", zone: "shared" },
  { Icon: HeartHandshake, href: "/repair-log", title: "Repair Log", desc: "What you both learned.", zone: "shared" },
  { Icon: Gem, href: "/affirmations", title: "Affirmations", desc: "Shuffle, draw, send.", zone: "shared" },
  { Icon: Sparkles, href: "/random-acts", title: "Random Acts", desc: "Tiny love-acts each week.", zone: "shared" },
  { Icon: HeartPulse, href: "/pulse", title: "Pulse", desc: "Their phone buzzes.", zone: "shared" },
  { Icon: Newspaper, href: "/digest", title: "Weekly Digest", desc: "Sunday auto-recap.", zone: "shared" },
  { Icon: Sprout, href: "/gratitude", title: "Gratitude Tree", desc: "A leaf for each thanks.", zone: "shared" },
  { Icon: Mail, href: "/postcards", title: "Postcards", desc: "A note from anywhere.", zone: "shared" },
  { Icon: ClipboardList, href: "/worksheets", title: "Worksheets", desc: "Languages, attachment, conflict.", zone: "shared" },
  { Icon: Gift, href: "/vault", title: "Gift Vault", desc: "Private to you. PIN locked.", zone: "private" },
  { Icon: Smile, href: "/mood", title: "Mood", desc: "Daily check-in.", zone: "personal" },
  { Icon: Heart, href: "/love-language", title: "Love Language", desc: "Notice the patterns.", zone: "personal" },
  { Icon: Settings2, href: "/profile", title: "My Preferences", desc: "Sizes, favourites, wishlist.", zone: "personal" },
];

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

      <Section title="Shared"><Grid tiles={TILES.filter((t) => t.zone === "shared")} /></Section>
      <Section title="Private to you"><Grid tiles={TILES.filter((t) => t.zone === "private")} /></Section>
      <Section title="Personal"><Grid tiles={TILES.filter((t) => t.zone === "personal")} /></Section>
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
    <Link href={href} className={`block bg-panel2/70 border border-line rounded-xl2 py-3 px-2 text-center transition active:scale-95 hover:bg-panel2 ${highlight ? "ring-1 ring-accent/60" : ""}`}>
      <div className={`text-xl font-display font-medium leading-tight ${highlight ? "headline-gradient" : ""}`}>{value}</div>
      <div className="muted text-[10px] uppercase tracking-wider mt-1">{label}</div>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="label">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles.map((t) => {
        const Icon = t.Icon;
        return (
          <Link key={t.href} href={t.href} className="card card-hover p-4 block group">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl2 bg-accent/12 text-accent mb-3 transition group-hover:bg-accent/20">
              <Icon size={18} aria-hidden />
            </span>
            <div className="font-display font-medium leading-snug">{t.title}</div>
            <div className="muted text-xs mt-1 leading-relaxed">{t.desc}</div>
          </Link>
        );
      })}
    </div>
  );
}
