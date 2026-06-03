import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chat } from "@/lib/groq";
import Confetti from "@/components/Confetti";
import RealtimeRefresh from "@/components/RealtimeRefresh";

export default async function JournalPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);

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
    await supabase
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
    revalidatePath("/journal");
  }

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="journal_entries" coupleId={me.coupleId} />
      <header>
        <h1 className="h1">Journal</h1>
        <p className="muted">Both answer. Both reveal together.</p>
      </header>

      <section className="card p-5 space-y-3">
        <div className="muted text-xs">Today, {today}</div>
        <h2 className="h2">{prompt}</h2>
        {myEntry ? (
          <p className="text-sm">You answered. {bothAnswered ? "Both of you are in — see below." : "Waiting on your partner."}</p>
        ) : (
          <form action={saveEntry} className="space-y-3">
            <input type="hidden" name="prompt" value={prompt} />
            <textarea className="input" name="body" rows={4} placeholder="Your answer..." required />
            <button className="btn btn-primary w-full" type="submit">Lock in my answer</button>
          </form>
        )}
      </section>

      {bothAnswered && <Confetti trigger={today} once={`journal-${today}`} />}
      {bothAnswered && (
        <section className="card p-5 space-y-4">
          <h3 className="label">Today, revealed</h3>
          <div>
            <div className="muted text-xs mb-1">You</div>
            <p className="whitespace-pre-wrap">{myEntry!.body}</p>
          </div>
          <div>
            <div className="muted text-xs mb-1">Partner</div>
            <p className="whitespace-pre-wrap">{partnerEntry!.body}</p>
          </div>
        </section>
      )}

      <section>
        <h3 className="label">History</h3>
        {history && history.length > 0 ? (
          <div className="space-y-3">
            {Object.entries(groupByDate(history)).map(([date, entries]) => (
              <div key={date} className="card p-4 space-y-2">
                <div className="muted text-xs">{date}</div>
                <p className="font-medium">{entries[0]!.prompt}</p>
                {entries.map((e, i) => (
                  <p key={i} className="text-sm whitespace-pre-wrap">
                    <span className="muted">{e.author_id === me.userId ? "You: " : "Partner: "}</span>
                    {e.body}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No past entries yet.</p>
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
