import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

type Tile = {
  href: string;
  title: string;
  desc: string;
  zone: "shared" | "private" | "personal";
};

const TILES: Tile[] = [
  { href: "/memories", title: "Memory Jar", desc: "Photos, notes, and moments.", zone: "shared" },
  { href: "/journal", title: "Journal", desc: "A daily prompt for two.", zone: "shared" },
  { href: "/date-roulette", title: "Date Roulette", desc: "Spin up a plan for tonight.", zone: "shared" },
  { href: "/bucket-list", title: "Bucket List", desc: "Dreams in progress.", zone: "shared" },
  { href: "/quiz", title: "How Well Do You Know Me?", desc: "Ask. Guess. Compare.", zone: "shared" },
  { href: "/watchlist", title: "Watchlist", desc: "Movies and shows for us.", zone: "shared" },
  { href: "/places", title: "Places", desc: "Restaurants and spots.", zone: "shared" },
  { href: "/songs", title: "Our Songs", desc: "A playlist with stories.", zone: "shared" },
  { href: "/travel", title: "Travel", desc: "Pins and itineraries.", zone: "shared" },
  { href: "/recipes", title: "Recipes", desc: "What we cook together.", zone: "shared" },
  { href: "/voice-letters", title: "Voice Letters", desc: "Audio for later.", zone: "shared" },
  { href: "/year", title: "Year in Review", desc: "Auto-generated recap.", zone: "shared" },
  { href: "/vault", title: "Gift Vault", desc: "Private to you. PIN locked.", zone: "private" },
  { href: "/mood", title: "Mood", desc: "Daily check-in.", zone: "personal" },
  { href: "/love-language", title: "Love Language", desc: "Notice the patterns.", zone: "personal" },
  { href: "/profile", title: "My Preferences", desc: "Sizes, favourites, wishlist.", zone: "personal" },
];

export default async function Home() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  // Lightweight at-a-glance stats
  const [{ count: memoriesCount }, { data: pendingJournal }, { count: bucketOpen }] = await Promise.all([
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("couple_id", me.coupleId),
    supabase.from("journal_entries").select("id, prompt").eq("couple_id", me.coupleId).eq("prompt_date", today).limit(1),
    supabase.from("bucket_items").select("id", { count: "exact", head: true }).eq("couple_id", me.coupleId).is("completed_at", null),
  ]);

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <p className="muted">Welcome back{me.displayName ? `, ${me.displayName}` : ""}.</p>
        <h1 className="h1 mt-1">Your space.</h1>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
          <Stat label="Memories" value={memoriesCount ?? 0} />
          <Stat label="Bucket open" value={bucketOpen ?? 0} />
          <Stat label="Today’s prompt" value={pendingJournal && pendingJournal.length ? "Open" : "Tap"} />
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-panel2 border border-line rounded-lg py-2">
      <div className="text-xl font-display">{value}</div>
      <div className="muted text-xs">{label}</div>
    </div>
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
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((t) => (
        <Link key={t.href} href={t.href} className="card card-hover p-4 block">
          <div className="font-medium">{t.title}</div>
          <div className="muted text-xs mt-1">{t.desc}</div>
        </Link>
      ))}
    </div>
  );
}
