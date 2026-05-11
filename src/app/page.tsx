import Link from "next/link";
import { redirect } from "next/navigation";
import "./landing.css";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Tether — a private space for two" };

export default async function Landing() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <>
      <div className="landing-bg" />
      <div className="aurora">
        <div className="aurora-blob a" />
        <div className="aurora-blob b" />
        <div className="aurora-blob c" />
      </div>
      <HeartField />

      <main className="relative">
        {/* Top nav */}
        <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/" className="font-display text-xl flex items-center gap-2">
            <span className="inline-block w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent2" />
            Tether
          </Link>
          <nav className="flex items-center gap-1">
            <Link className="btn btn-ghost text-sm" href="/login">Sign in</Link>
            <Link className="btn btn-primary text-sm cta-glow" href="/signup">Get started</Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="px-6 max-w-6xl mx-auto pt-12 pb-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="muted fade-up">For two. And only two.</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display leading-[1.05] mt-3 fade-up d1">
              Your <span className="headline-gradient">private</span><br />space, together.
            </h1>
            <p className="mt-6 text-lg text-ink/80 max-w-md fade-up d2">
              Memories, a daily journal, dates, songs, recipes, secret gift planning. One app. Just the two of you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 fade-up d3">
              <Link className="btn btn-primary cta-glow text-base px-5 py-3" href="/signup">Create your Tether</Link>
              <Link className="btn text-base px-5 py-3" href="/login">I already have one</Link>
            </div>
            <p className="muted text-xs mt-6 fade-up d4">Free forever for the two of you. No ads.</p>
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center fade-up d3">
            <div className="phone">
              <div className="phone-screen">
                <div className="phone-slides">
                  <div className="phone-slide">
                    <div className="text-[10px] text-muted uppercase tracking-widest">Memory Jar · today</div>
                    <div className="font-display text-base">Sunday morning</div>
                    <div className="mini-card">
                      <div className="text-[10px] text-muted">our kitchen</div>
                      <div>Pancakes, the cat sat on the recipe again.</div>
                    </div>
                    <div className="mini-card">
                      <div className="text-[10px] text-muted">last week · the park</div>
                      <div>You picked up that yellow leaf for me.</div>
                    </div>
                    <div>
                      <span className="mini-pill">Photo</span>
                      <span className="mini-pill">Voice</span>
                    </div>
                  </div>
                  <div className="phone-slide">
                    <div className="text-[10px] text-muted uppercase tracking-widest">Journal · prompt</div>
                    <div className="font-display text-base leading-snug">What small thing did you appreciate about us this week?</div>
                    <div className="mini-card">
                      <div className="text-[10px] text-muted">You</div>
                      <div>The way you hum when you make coffee.</div>
                    </div>
                    <div className="mini-card opacity-60">
                      <div className="text-[10px] text-muted">Partner</div>
                      <div>… answering …</div>
                    </div>
                  </div>
                  <div className="phone-slide">
                    <div className="text-[10px] text-muted uppercase tracking-widest">Date Roulette</div>
                    <div className="mini-card text-center">
                      <div className="text-[10px] text-muted">Tonight, maybe…</div>
                      <div className="font-display text-base mt-1">Cook the wrong recipe on purpose</div>
                      <div className="mt-2">
                        <span className="mini-pill">low</span>
                        <span className="mini-pill">indoor</span>
                        <span className="mini-pill">AI</span>
                      </div>
                    </div>
                    <div className="mini-card">Sushi-making night</div>
                    <div className="mini-card">Park stargazing</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 max-w-6xl mx-auto py-16">
          <p className="muted text-center fade-up">What&apos;s inside</p>
          <h2 className="text-3xl sm:text-4xl font-display text-center mt-2 fade-up d1">Fifteen tiny apps. One quiet space.</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`glass glass-hover p-5 fade-up d${(i % 6) + 1}`}>
                <div className="text-2xl mb-2">{f.icon}</div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="muted text-sm mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section className="px-6 max-w-6xl mx-auto py-16">
          <div className="glass p-8 fade-up">
            <p className="muted text-center text-sm">Private by design</p>
            <h2 className="text-3xl sm:text-4xl font-display text-center mt-2">No one else gets a key.</h2>
            <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
              <Guarantee title="Couple-scoped" body="Your data lives inside a couple container only the two of you can read. Enforced at the database, not just the app." />
              <Guarantee title="PIN-locked vault" body="Gift planning is private to its owner — your partner can&apos;t read it even if they&apos;re logged in on your phone." />
              <Guarantee title="No ads, no resale" body="We don&apos;t monetize your memories. Built as a personal project. Bring your own free Supabase + Groq keys." />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 max-w-3xl mx-auto py-20 text-center">
          <h2 className="text-4xl sm:text-5xl font-display fade-up">Ready to start your space?</h2>
          <p className="muted mt-4 fade-up d1">Two minutes to set up. One invite code to share.</p>
          <div className="mt-8 flex justify-center gap-3 fade-up d2">
            <Link className="btn btn-primary cta-glow text-base px-6 py-3" href="/signup">Create your Tether</Link>
          </div>
        </section>

        <footer className="px-6 py-10 max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 border-t border-line/50 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-md bg-gradient-to-br from-accent to-accent2" />
            <span>Tether · a private space for two</span>
          </div>
          <nav className="flex gap-4">
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
          </nav>
        </footer>
      </main>
    </>
  );
}

const FEATURES = [
  { icon: "💌", title: "Memory Jar", desc: "Photos, voice notes, dated moments." },
  { icon: "📔", title: "Journal", desc: "A daily AI prompt. Both answer, both reveal." },
  { icon: "🎯", title: "Date Roulette", desc: "Spin tonight. AI generates fresh ideas." },
  { icon: "🌍", title: "Bucket List", desc: "Dreams with progress. Tick them off." },
  { icon: "🎁", title: "Gift Vault", desc: "PIN-locked. Surprises stay surprises." },
  { icon: "🧠", title: "Quiz", desc: "How well do you actually know each other?" },
  { icon: "🎬", title: "Watchlist", desc: "Tonight? AI picks for the mood and time." },
  { icon: "🍳", title: "Recipes", desc: "What's in the pantry? AI suggests dinner." },
  { icon: "🎶", title: "Our Songs", desc: "A shared Spotify playlist with stories." },
  { icon: "🗺️", title: "Travel", desc: "Pins for someday. AI drafts the day." },
  { icon: "💝", title: "Voice Letters", desc: "Audio sealed until the date you choose." },
  { icon: "📅", title: "Year in Review", desc: "An auto-written recap from everything." },
];

function Guarantee({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="muted text-sm mt-1">{body}</p>
    </div>
  );
}

function HeartField() {
  // Deterministic positions so SSR matches client; CSS animation handles the motion.
  const hearts = Array.from({ length: 12 }).map((_, i) => {
    const seed = (i * 73) % 100;
    return {
      left: `${seed}%`,
      delay: `${(i * 1.7) % 18}s`,
      duration: `${14 + ((i * 3) % 10)}s`,
      size: `${1 + ((i * 17) % 12) / 10}rem`,
    };
  });
  return (
    <div className="heart-field" aria-hidden>
      {hearts.map((h, i) => (
        <span
          key={i}
          style={{
            left: h.left,
            animationDelay: h.delay,
            animationDuration: h.duration,
            fontSize: h.size,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}
