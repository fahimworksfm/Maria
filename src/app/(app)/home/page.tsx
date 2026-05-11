import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import InstallPrompt from "@/components/InstallPrompt";

type Tile = {
  href: string;
  title: string;
  desc: string;
  zone: "shared" | "private" | "personal";
  emoji: string;
};

const TILES: Tile[] = [
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
  ] = await Promise.all([
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("couple_id", me.coupleId),
    supabase.from("journal_entries").select("author_id").eq("couple_id", me.coupleId).eq("prompt_date", today),
    supabase.from("bucket_items").select("id", { count: "exact", head: true }).eq("couple_id", me.coupleId).is("completed_at", null),
    supabase.from("nudges").select("id", { count: "exact", head: true }).eq("to_user", me.userId).is("read_at", null),
  ]);

  const journalAnswered = todaysJournal?.length ?? 0;
  const youAnswered = (todaysJournal ?? []).some((e) => e.author_id === me.userId);
  const journalLabel = journalAnswered === 0 ? "Not yet" : journalAnswered === 2 ? "Both ✓" : youAnswered ? "You done" : "Partner done";

  return (
    <div className="space-y-6">
      <InstallPrompt variant="banner" />
      <section className="card p-5 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <p className="muted">Welcome back{me.displayName ? `, ${me.displayName}` : ""}.</p>
        <h1 className="h1 mt-1">Your space.</h1>
        <div className="mt-4 grid grid-cols-4 gap-3 text-center text-sm">
          <Stat href="/memories" label="Memories" value={memoriesCount ?? 0} />
          <Stat href="/bucket-list" label="Open dreams" value={bucketOpen ?? 0} />
          <Stat href="/journal" label="Today's prompt" value={journalLabel} highlight={journalAnswered === 2} />
          <Stat href="/pulse" label="Pulses" value={unreadPulses ?? 0} highlight={(unreadPulses ?? 0) > 0} />
        </div>
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
