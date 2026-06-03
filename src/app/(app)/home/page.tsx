import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import InstallPrompt from "@/components/InstallPrompt";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StreakLine from "@/components/StreakLine";
import { getTogetherStreak } from "@/lib/streak";

const MOOD_EMOJI = ["😞", "😕", "🙂", "😊", "🤩"];

type Tile = {
  href: string;
  title: string;
  desc: string;
  zone: "shared" | "private" | "personal";
  emoji: string;
};

const TILES: Tile[] = [
  { emoji: "🧵", href: "/timeline", title: "Timeline", desc: "Your whole story, woven together.", zone: "shared" },
  { emoji: "💌", href: "/memories", title: "Memory Jar", desc: "Photos, notes, and moments.", zone: "shared" },
  { emoji: "📔", href: "/journal", title: "Journal", desc: "A daily prompt for two.", zone: "shared" },
  { emoji: "🎯", href: "/date-roulette", title: "Date Roulette", desc: "Spin up a plan for tonight.", zone: "shared" },
  { emoji: "🌍", href: "/bucket-list", title: "Bucket List", desc: "Dreams in progress.", zone: "shared" },
  { emoji: "🧠", href: "/quiz", title: "How Well Do You Know Me?", desc: "Ask. Guess. Compare.", zone: "shared" },
  { emoji: "🎬", href: "/watchlist", title: "Watchlist", desc: "Movies and shows for us.", zone: "shared" },
  { emoji: "📍", href: "/places", title: "Places", desc: "Restaurants and spots.", zone: "shared" },
  { emoji: "🎶", href: "/songs", title: "Our Songs", desc: "A playlist with stories.", zone: "shared" },
  { emoji: "🗺️", href: "/travel", title: "Travel", desc: "Pins and itineraries.", zone: "shared" },
  { emoji: "🍳", href: "/recipes", title: "Recipes", desc: "What we cook together.", zone: "shared" },
  { emoji: "💝", href: "/voice-letters", title: "Voice Letters", desc: "Audio for later.", zone: "shared" },
  { emoji: "📅", href: "/year", title: "Year in Review", desc: "Auto-generated recap.", zone: "shared" },
  { emoji: "🧭", href: "/anniversaries", title: "Anniversary Compass", desc: "Countdowns to every date.", zone: "shared" },
  { emoji: "🫀", href: "/repair-log", title: "Repair Log", desc: "What you both learned.", zone: "shared" },
  { emoji: "🃏", href: "/affirmations", title: "Affirmation Deck", desc: "Shuffle, draw, send.", zone: "shared" },
  { emoji: "✨", href: "/random-acts", title: "Random Acts", desc: "Six tiny love-acts a week.", zone: "shared" },
  { emoji: "💗", href: "/pulse", title: "Pulse", desc: "Their phone buzzes.", zone: "shared" },
  { emoji: "📰", href: "/digest", title: "Weekly Digest", desc: "Sunday auto-recap.", zone: "shared" },
  { emoji: "🌳", href: "/gratitude", title: "Gratitude Tree", desc: "Grow a leaf for each thanks.", zone: "shared" },
  { emoji: "📮", href: "/postcards", title: "Postcards", desc: "A note from wherever you are.", zone: "shared" },
  { emoji: "📝", href: "/worksheets", title: "Worksheets", desc: "Love languages, attachment, conflict.", zone: "shared" },
  { emoji: "🎁", href: "/vault", title: "Gift Vault", desc: "Private to you. PIN locked.", zone: "private" },
  { emoji: "🌤️", href: "/mood", title: "Mood", desc: "Daily check-in.", zone: "personal" },
  { emoji: "💞", href: "/love-language", title: "Love Language", desc: "Notice the patterns.", zone: "personal" },
  { emoji: "🪞", href: "/profile", title: "My Preferences", desc: "Sizes, favourites, wishlist.", zone: "personal" },
];

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
    // Partner's "heavy day" empathy signal for today (RLS-visible; carries the
    // score only if they opted to share it).
    supabase.from("mood_signals").select("mood, from_user").eq("couple_id", me.coupleId).eq("on_date", today).neq("from_user", me.userId).maybeSingle(),
  ]);

  const streak = await getTogetherStreak(supabase, me.coupleId);

  const journalAnswered = todaysJournal?.length ?? 0;
  const youAnswered = (todaysJournal ?? []).some((e) => e.author_id === me.userId);
  const partnerName = partner?.display_name ?? "your partner";

  const partnerHeavyDay = Boolean(partnerSignal);
  const partnerMoodEmoji =
    partnerSignal && typeof partnerSignal.mood === "number" ? MOOD_EMOJI[partnerSignal.mood - 1] : null;

  const todayCard = pickToday({
    unreadPulses: unreadPulses ?? 0,
    youAnswered,
    journalAnswered,
    annivs: annivs ?? [],
    partnerName,
    partnerHeavyDay,
    partnerMoodEmoji,
  });

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="mood_signals" coupleId={me.coupleId} />
      <InstallPrompt variant="banner" />
      <section className="card p-5 relative overflow-hidden">
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between gap-3">
          <p className="muted">Welcome back{me.displayName ? `, ${me.displayName}` : ""}.</p>
          <StreakLine days={streak} />
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl">{todayCard.emoji}</span>
          <h1 className="h1">{todayCard.headline}</h1>
        </div>
        <p className="muted text-sm mt-2">{todayCard.subtext}</p>
        <Link href={todayCard.href} className="btn btn-primary cta-glow inline-block mt-4">
          {todayCard.cta}
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        <Stat href="/memories" label="Memories" value={memoriesCount ?? 0} />
        <Stat href="/bucket-list" label="Open dreams" value={bucketOpen ?? 0} />
        <Stat href="/pulse" label="Pulses" value={unreadPulses ?? 0} highlight={(unreadPulses ?? 0) > 0} />
      </section>

      <Section title="Shared">
        <Grid tiles={TILES.filter((t) => t.zone === "shared")} />
      </Section>
      <Section title="Private to you">
        <Grid tiles={TILES.filter((t) => t.zone === "private")} />
      </Section>
      <Section title="Personal">
        <Grid tiles={TILES.filter((t) => t.zone === "personal")} />
      </Section>
    </div>
  );
}

type Anniv = { name: string; on_date: string; recurring: boolean };
type Card = { emoji: string; headline: string; subtext: string; cta: string; href: string };

function pickToday(input: {
  unreadPulses: number;
  youAnswered: boolean;
  journalAnswered: number;
  annivs: Anniv[];
  partnerName: string;
  partnerHeavyDay: boolean;
  partnerMoodEmoji: string | null;
}): Card {
  const today = new Date();
  const todayMD = `${today.getMonth() + 1}-${today.getDate()}`;
  const upcoming = input.annivs
    .map((a) => {
      const [y, m, d] = a.on_date.split("-").map(Number);
      const md = `${m}-${d}`;
      const occurs = new Date(today.getFullYear(), m! - 1, d!);
      let days = Math.round((occurs.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
      if (days < 0 && a.recurring) {
        const next = new Date(today.getFullYear() + 1, m! - 1, d!);
        days = Math.round((next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
      }
      return { name: a.name, days, md, y };
    })
    .filter((a) => a.days >= 0)
    .sort((a, b) => a.days - b.days);

  const todays = upcoming.filter((a) => a.md === todayMD);
  if (todays.length > 0) {
    return {
      emoji: "🎉",
      headline: `It's ${todays[0]!.name}.`,
      subtext: "Today is the day. Make it count.",
      cta: "Open Anniversary Compass",
      href: "/anniversaries",
    };
  }

  // Empathy loop: surface the partner's heavy day before everyday nudges.
  if (input.partnerHeavyDay) {
    return {
      emoji: "🫂",
      headline: `${input.partnerName} is having a heavy day.`,
      subtext: input.partnerMoodEmoji
        ? `They're feeling ${input.partnerMoodEmoji} today. A pulse might help — no pressure to fix it.`
        : "A pulse might help — no pressure to fix it.",
      cta: "Send a pulse",
      href: "/pulse",
    };
  }

  if (input.unreadPulses > 0) {
    return {
      emoji: "💗",
      headline: `${input.partnerName} sent ${input.unreadPulses} pulse${input.unreadPulses > 1 ? "s" : ""}.`,
      subtext: "Open Pulse to see and reply.",
      cta: "View pulses",
      href: "/pulse",
    };
  }

  if (!input.youAnswered) {
    return {
      emoji: "📔",
      headline: "Today's prompt is waiting.",
      subtext: input.journalAnswered === 1 ? `${input.partnerName} already answered. Your turn.` : "Both of you answer, then it's revealed together.",
      cta: "Answer the prompt",
      href: "/journal",
    };
  }

  if (input.journalAnswered === 2) {
    const soon = upcoming.find((a) => a.days <= 7);
    if (soon) {
      return {
        emoji: "🧭",
        headline: `${soon.name} in ${soon.days} day${soon.days === 1 ? "" : "s"}.`,
        subtext: "Plan something small. They'll remember.",
        cta: "Open Anniversary Compass",
        href: "/anniversaries",
      };
    }
    return {
      emoji: "🌱",
      headline: "Plant a leaf?",
      subtext: "Both of you answered today's prompt. Add a small gratitude to round out the day.",
      cta: "Open Gratitude Tree",
      href: "/gratitude",
    };
  }

  // You answered, partner hasn't yet
  return {
    emoji: "💌",
    headline: `Waiting on ${input.partnerName}.`,
    subtext: "Your answer is locked in. Drop a memory or send a pulse while you wait.",
    cta: "Send a pulse",
    href: "/pulse",
  };
}

function Stat({ href, label, value, highlight }: { href: string; label: string; value: string | number; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`block bg-panel2 border border-line rounded-lg py-2 px-1 transition active:scale-95 hover:bg-panel ${highlight ? "ring-1 ring-accent/60" : ""}`}
    >
      <div className={`text-base font-display leading-tight ${highlight ? "headline-gradient" : ""}`}>{value}</div>
      <div className="muted text-[10px] mt-0.5">{label}</div>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="label">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles.map((t) => (
        <Link key={t.href} href={t.href} className="card card-hover p-4 block">
          <div className="text-xl mb-1">{t.emoji}</div>
          <div className="font-medium text-sm">{t.title}</div>
          <div className="muted text-xs mt-1">{t.desc}</div>
        </Link>
      ))}
    </div>
  );
}
