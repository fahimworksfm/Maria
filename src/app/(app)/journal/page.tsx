import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chat } from "@/lib/groq";
import Confetti from "@/components/Confetti";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StreakLine from "@/components/StreakLine";
import { Lock, NotebookPen } from "lucide-react";
import { partnerNameFor } from "@/lib/authorship";
import { friendlyDate, relativeDate } from "@/lib/dates";
import { sendToUser, pushEnabled } from "@/lib/push";
import { getTogetherStreak } from "@/lib/streak";

export default async function JournalPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const streak = await getTogetherStreak(supabase, me.coupleId);

  // Today's prompt: persisted in daily_prompts so it doesn't regenerate per visit
  // (saves Groq calls and keeps the prompt stable until at least one partner answers).
  const prompt = await ensurePromptForToday(me.coupleId, today);

  // Both partners' answers for today
  const { data: todays } = await supabase
    .from("journal_entries")
    .select("body, author_id, created_at")
    .eq("couple_id", me.coupleId)
    .eq("prompt_date", today);

  const myEntry = (todays ?? []).find((e) => e.author_id === me.userId);
  const partnerEntry = (todays ?? []).find((e) => e.author_id !== me.userId);
  const bothAnswered = Boolean(myEntry && partnerEntry);

  const { data: history } = await supabase
    .from("journal_entries")
    .select("prompt, body, author_id, prompt_date")
    .eq("couple_id", me.coupleId)
    .neq("prompt_date", today)
    .order("prompt_date", { ascending: false })
    .limit(20);

  async function saveEntry(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const body = String(formData.get("body") || "").trim();
    const promptText = String(formData.get("prompt") || "").trim();
    if (!body || !promptText) return;
    const day = new Date().toISOString().slice(0, 10);
    // Who has answered already, so we know whether this save is a first answer
    // (worth telling your partner about) or an edit (not).
    const { data: before } = await supabase
      .from("journal_entries")
      .select("author_id")
      .eq("couple_id", me.coupleId)
      .eq("prompt_date", day);
    const firstTime = !(before ?? []).some((e) => e.author_id === me.userId);
    const partnerAnswered = (before ?? []).some((e) => e.author_id !== me.userId);
    const { error: saveError } = await supabase
      .from("journal_entries")
      .upsert(
        {
          couple_id: me.coupleId,
          author_id: me.userId,
          prompt: promptText,
          prompt_date: new Date().toISOString().slice(0, 10),
          body,
        },
        { onConflict: "couple_id,prompt_date,author_id" }
      );
    // Nudge your partner. The answer itself never goes in a notification, and
    // a push failure must never get in the way of saving.
    if (!saveError && firstTime) {
      try {
        if (pushEnabled()) {
          const { data: p } = await supabase.from("profiles").select("user_id").neq("user_id", me.userId).limit(1).maybeSingle();
          if (p?.user_id) {
            const name = me.displayName ?? "Your partner";
            await sendToUser(p.user_id, {
              title: `${name} answered today's prompt`,
              body: partnerAnswered ? "Both answers are in — tap to read them." : "Your turn — answer to reveal both.",
              url: "/journal",
            });
          }
        }
      } catch {
        /* notification is best-effort */
      }
    }
    revalidatePath("/journal");
  }

  const partnerName = await partnerNameFor(supabase, me.userId);

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="journal_entries" coupleId={me.coupleId} />
      <header>
        <div className="flex items-center justify-between gap-3">
          <h1 className="h1">Journal</h1>
          <StreakLine days={streak} />
        </div>
        <p className="muted">Both answer. Both reveal together.</p>
      </header>

      <section className="thread" aria-label="Today">
        <p className="day-mark">Today · {friendlyDate(today)}</p>
        <div className="card p-4 space-y-2">
          <p className="label !mb-0">Tether asks you both</p>
          <h2 className="h2">{prompt}</h2>
        </div>

        {/* Their side. Sealed until yours is in, so neither answer leans on the other. */}
        {partnerEntry && !myEntry && (
          <>
            <div className="bubble bubble-them w-[70%] space-y-2" aria-label={`${partnerName} has answered. Hidden until you answer.`}>
              <span className="block h-2.5 rounded-full bg-ink/15" />
              <span className="block h-2.5 w-[85%] rounded-full bg-ink/15" />
              <span className="block h-2.5 w-[55%] rounded-full bg-ink/15" />
            </div>
            <span className="stamp flex items-center gap-1.5"><Lock size={12} aria-hidden /> {partnerName} answered · hidden until yours is in</span>
          </>
        )}
        {bothAnswered && (
          <>
            <div className="bubble bubble-them">{partnerEntry!.body}</div>
            <span className="stamp">{partnerName}</span>
          </>
        )}

        {/* Your side. */}
        {myEntry && (
          <>
            <div className="bubble bubble-me">{myEntry.body}</div>
            <span className="stamp self-end">{bothAnswered ? "You · both revealed" : `You · waiting on ${partnerName}`}</span>
            <details className="self-end w-full max-w-[85%]">
              <summary className="stamp cursor-pointer underline underline-offset-2 hover:text-ink min-h-[44px] flex items-center justify-end">Edit my answer</summary>
              <form action={saveEntry} className="card p-3.5 space-y-2.5 mt-1">
                <input type="hidden" name="prompt" value={prompt} />
                <label htmlFor="journal-edit" className="label">Your answer</label>
                <textarea id="journal-edit" className="input" name="body" rows={4} defaultValue={myEntry.body} required />
                <button className="btn btn-primary w-full" type="submit">Save changes</button>
              </form>
            </details>
          </>
        )}
      </section>

      {!myEntry && (
        <form action={saveEntry} className="card p-3.5 space-y-2.5">
          <input type="hidden" name="prompt" value={prompt} />
          <label htmlFor="journal-body" className="sr-only">Your answer</label>
          <textarea id="journal-body" className="input" name="body" rows={4} placeholder={`Start anywhere. Only ${partnerName} will read this.`} required />
          <button className="btn btn-primary w-full" type="submit">Lock in my answer</button>
        </form>
      )}

      {bothAnswered && <Confetti trigger={today} once={`journal-${today}`} />}

      <section className="space-y-3">
        <h3 className="label">Earlier days</h3>
        {history && history.length > 0 ? (
          <div className="space-y-3">
            {Object.entries(groupByDate(history)).map(([date, entries]) => (
              <div key={date} className="thread">
                <p className="day-mark">{relativeDate(date)}</p>
                <div className="card px-4 py-3 font-semibold text-[15px] leading-snug">{entries[0]!.prompt}</div>
                {entries.map((e, i) => {
                  const mine = e.author_id === me.userId;
                  return (
                    <div key={i} className="contents">
                      <div className={`bubble ${mine ? "bubble-me" : "bubble-them"}`}>{e.body}</div>
                      <span className={`stamp ${mine ? "self-end" : ""}`}>{mine ? "You" : partnerName}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center space-y-2">
            <span className="mark-box"><NotebookPen size={20} aria-hidden /></span>
            <p className="font-bold text-lg pt-1">No earlier days yet.</p>
            <p className="muted">Answer today&apos;s prompt above, even in one line, like &ldquo;The coffee you left out for me.&rdquo; Each day you both answer is kept here.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function groupByDate<T extends { prompt_date: string }>(rows: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) (out[r.prompt_date] ||= []).push(r);
  return out;
}

async function ensurePromptForToday(coupleId: string, today: string): Promise<string> {
  const supabase = await supabaseServer();
  const { data: existing } = await supabase
    .from("daily_prompts")
    .select("prompt")
    .eq("couple_id", coupleId)
    .eq("prompt_date", today)
    .maybeSingle();
  if (existing?.prompt) return existing.prompt;
  const prompt = await pickPromptForToday(coupleId);
  await supabase
    .from("daily_prompts")
    .upsert({ couple_id: coupleId, prompt_date: today, prompt }, { onConflict: "couple_id,prompt_date" });
  return prompt;
}

async function pickPromptForToday(coupleId: string): Promise<string> {
  const fallback = pickRandom([
    "What small thing did you appreciate about us this week?",
    "What's something you've been holding back from saying?",
    "Describe a moment recently that made you feel close.",
    "If we had one free day this weekend, what would you want to do?",
    "What's something you'd like to learn together?",
    "What's a comfort I bring you that you don't talk about?",
    "What would you change about how we spend evenings?",
    "What recent argument do you still think about?",
    "When did you feel most yourself recently?",
    "What does a great Sunday look like to you right now?",
  ]);
  if (!aiEnabled()) return fallback;
  try {
    const supabase = await supabaseServer();
    const [{ data: recent }, { data: mems }, { data: annivs }] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("prompt")
        .eq("couple_id", coupleId)
        .order("prompt_date", { ascending: false })
        .limit(14),
      supabase
        .from("memories")
        .select("title, happened_on, created_at")
        .eq("couple_id", coupleId)
        .order("happened_on", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("anniversaries")
        .select("name, on_date, recurring")
        .eq("couple_id", coupleId),
    ]);

    const seen = (recent ?? []).map((r) => `- ${r.prompt}`).join("\n");

    // Build optional "real life" context: recent memory titles + next upcoming date.
    const memoryTitles = (mems ?? [])
      .map((m) => (m.title ?? "").trim())
      .filter((t) => t.length > 0)
      .slice(0, 3);
    const upcoming = nextUpcomingAnniversary(annivs ?? []);

    const hasContext = memoryTitles.length > 0 || Boolean(upcoming);
    // ~1 in 3 days, invite the model to gently reference real life (only when we have any).
    const referenceRealLife = hasContext && Math.random() < 0.34;

    let system =
      "You write daily journal prompts for couples. Prompts should be warm, specific, emotionally open, never cheesy, never preachy, never list-style, under 18 words, and end with a question mark.";
    let user = `Write today's prompt. Do not repeat any of these recent prompts:\n${seen}\n\nReturn only the prompt, no quotes, no preamble.`;

    if (referenceRealLife) {
      const bits: string[] = [];
      if (memoryTitles.length) bits.push(`Recent moments: ${memoryTitles.join("; ")}`);
      if (upcoming) bits.push(`Coming up: ${upcoming.name} in ${upcoming.days} day${upcoming.days === 1 ? "" : "s"}`);
      system +=
        " You may gently reference one detail from the couple's real life provided below if it fits naturally — lightly, as a touchstone, never forced and never inventing facts beyond what's given.";
      user =
        `Write today's prompt, gently referencing one of these real details if it fits naturally:\n${bits.join("\n")}\n\n` +
        `Do not repeat any of these recent prompts:\n${seen}\n\nReturn only the prompt, no quotes, no preamble.`;
    }

    const text = await chat({
      system,
      user,
      temperature: 0.9,
      maxTokens: 80,
    });
    const clean = text.trim().replace(/^["']|["']$/g, "");
    return clean.length > 0 && clean.length <= 200 ? clean : fallback;
  } catch {
    return fallback;
  }
}

// Nearest future occurrence among the couple's anniversaries (recurring rolls to next year).
function nextUpcomingAnniversary(
  annivs: Array<{ name: string; on_date: string; recurring: boolean }>
): { name: string; days: number } | null {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let best: { name: string; days: number } | null = null;
  for (const a of annivs) {
    const parts = a.on_date.split("-").map(Number);
    const m = parts[1];
    const d = parts[2];
    if (!m || !d) continue;
    let occurs = new Date(now.getFullYear(), m - 1, d);
    let days = Math.round((occurs.getTime() - startToday) / 86_400_000);
    if (days < 0 && a.recurring) {
      occurs = new Date(now.getFullYear() + 1, m - 1, d);
      days = Math.round((occurs.getTime() - startToday) / 86_400_000);
    }
    if (days < 0) continue;
    if (!best || days < best.days) best = { name: a.name, days };
  }
  return best;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
