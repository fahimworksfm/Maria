import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Mail,
  NotebookPen,
  Dices,
  Globe,
  Gift,
  Sparkles,
  Clapperboard,
  Utensils,
  Music,
  Map,
  Mic,
  CalendarRange,
  Heart,
} from "lucide-react";
import "./landing.css";
import { supabaseServer } from "@/lib/supabase/server";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata = { title: "Tether — a private space for two" };

export default async function Landing() {
  // Best-effort: if the user is already signed in, send them to the app. But never
  // let a slow/unreachable Supabase block the public landing page from rendering.
  let user = null;
  try {
    const supabase = await supabaseServer();
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) => setTimeout(() => resolve({ data: { user: null } }), 1500)),
    ]);
    user = result.data.user;
  } catch {
    user = null;
  }
  if (user) redirect("/home");

  return (
    <>
      <div className="landing-bg" />

      <main className="relative">
        {/* Top nav */}
        <header className="px-5 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/" className="font-bold text-xl tracking-[-0.01em] flex items-center gap-2.5 min-h-[44px]">
            <span
              className="grid place-items-center w-8 h-8 rounded-full text-sm font-bold"
              style={{ background: "rgb(var(--c-prim-bg))", color: "rgb(var(--c-prim-fg))" }}
              aria-hidden
            >
              T
            </span>
            Tether
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link className="btn btn-ghost" href="/login">Sign in</Link>
            <Link className="btn btn-primary" href="/signup">Get started</Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="px-5 max-w-6xl mx-auto pt-10 pb-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="label fade-up">For two. And only two.</p>
            <h1 className="text-[2.6rem] sm:text-6xl lg:text-7xl font-bold tracking-[-0.03em] leading-[1.02] mt-2 fade-up d1">
              Your <span style={{ color: "var(--c-accent-ink)" }}>private</span><br />space, together.
            </h1>
            <p className="mt-5 text-lg text-muted max-w-md leading-relaxed fade-up d2">
              Memories, a daily journal, dates, songs, recipes, secret gift planning. One app. Just the two of you.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 fade-up d3">
              <Link className="btn btn-primary text-base px-5 py-3" href="/signup">Create your Tether</Link>
              <Link className="btn text-base px-5 py-3" href="/login">I already have one</Link>
            </div>
            <p className="muted text-xs mt-5 fade-up d4">Free forever for the two of you. No ads.</p>
          </div>

          {/* The product in its own idiom: one conversation, with the app
              speaking up in the middle of it. Illustrative, so hidden from
              assistive tech. */}
          <div className="flex justify-center fade-up d3" aria-hidden="true">
            <div className="w-full max-w-sm card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
                <span
                  className="grid place-items-center w-10 h-10 shrink-0 rounded-full font-bold"
                  style={{ background: "rgb(var(--c-prim-bg))", color: "rgb(var(--c-prim-fg))" }}
                >
                  A
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-bold">You &amp; Alex</span>
                  <span className="text-[13px] text-muted">Alex is here</span>
                </span>
              </div>
              <div className="thread bg-bg p-4">
                <span className="day-mark">Today</span>
                <div className="bubble bubble-them flex items-center gap-2">
                  <Heart size={15} fill="currentColor" className="shrink-0" />
                  Thinking of you.
                </div>
                <span className="stamp">A pulse · just now</span>
                <div className="bubble bubble-me">You picked up that yellow leaf for me.</div>
                <span className="stamp self-end">Added to the Memory Jar</span>
                <div className="card p-3.5 mt-1 space-y-2">
                  <p className="label !mb-0">Tether asks you both</p>
                  <p className="font-bold leading-snug">What small thing did you appreciate about us this week?</p>
                  <span className="btn btn-primary w-full">Answer the prompt</span>
                </div>
                <div className="bubble bubble-them w-[62%] space-y-2">
                  <span className="block h-2.5 rounded-full bg-ink/15" />
                  <span className="block h-2.5 w-[70%] rounded-full bg-ink/15" />
                </div>
                <span className="stamp">Alex answered · hidden until yours is in</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-5 max-w-6xl mx-auto py-14">
          <p className="label text-center fade-up">What&apos;s inside</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-center mt-1 fade-up d1">A dozen tiny apps. One quiet space.</h2>
          <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`card p-4 flex items-start gap-3 fade-up d${(i % 6) + 1}`}>
                <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-panel2 text-accentInk">
                  <f.icon size={18} aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="muted mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section className="px-5 max-w-6xl mx-auto py-14">
          <div className="card p-6 sm:p-8 fade-up">
            <p className="label text-center">Private by design</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-center mt-1">No one else gets a key.</h2>
            <div className="mt-7 grid sm:grid-cols-3 gap-5 sm:text-center">
              <Guarantee title="Couple-scoped" body="Your data lives inside a couple container only the two of you can read. Enforced at the database, not just the app." />
              <Guarantee title="PIN-locked vault" body="Gift planning is private to its owner — your partner can&apos;t read it even if they&apos;re logged in on your phone." />
              <Guarantee title="No ads, no resale" body="We don&apos;t monetize your memories. Ever." />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 max-w-3xl mx-auto py-16 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-[-0.03em] fade-up">Ready to start your space?</h2>
          <p className="text-muted mt-3 fade-up d1">One sign-up. One link to send. You&apos;re paired.</p>
          <div className="mt-7 flex justify-center gap-3 fade-up d2">
            <Link className="btn btn-primary text-base px-6 py-3" href="/signup">Create your Tether</Link>
          </div>
        </section>

        {/* Install prompt — only renders on phone, hides if installed/dismissed */}
        <section className="px-5 max-w-2xl mx-auto pb-12">
          <InstallPrompt />
        </section>

        <footer className="px-5 py-8 max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 border-t border-line text-xs text-muted">
          <span>Tether · a private space for two</span>
          <nav className="flex gap-1">
            <Link href="/terms" className="inline-flex items-center min-h-[44px] px-2 hover:text-ink">Terms</Link>
            <Link href="/privacy" className="inline-flex items-center min-h-[44px] px-2 hover:text-ink">Privacy</Link>
            <Link href="/login" className="inline-flex items-center min-h-[44px] px-2 hover:text-ink">Sign in</Link>
          </nav>
        </footer>
      </main>
    </>
  );
}

const FEATURES = [
  { icon: Mail, title: "Memory Jar", desc: "Photos, voice notes, dated moments." },
  { icon: NotebookPen, title: "Journal", desc: "A daily AI prompt. Both answer, both reveal." },
  { icon: Dices, title: "Date Roulette", desc: "Spin tonight. AI generates fresh ideas." },
  { icon: Globe, title: "Bucket List", desc: "Dreams with progress. Tick them off." },
  { icon: Gift, title: "Gift Vault", desc: "PIN-locked. Surprises stay surprises." },
  { icon: Sparkles, title: "Quiz", desc: "How well do you actually know each other?" },
  { icon: Clapperboard, title: "Watchlist", desc: "Tonight? AI picks for the mood and time." },
  { icon: Utensils, title: "Recipes", desc: "What's in the pantry? AI suggests dinner." },
  { icon: Music, title: "Our Songs", desc: "A shared Spotify playlist with stories." },
  { icon: Map, title: "Travel", desc: "Pins for someday. AI drafts the day." },
  { icon: Mic, title: "Voice Letters", desc: "Audio sealed until the date you choose." },
  { icon: CalendarRange, title: "Year in Review", desc: "An auto-written recap from everything." },
];

function Guarantee({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="muted mt-1">{body}</p>
    </div>
  );
}

