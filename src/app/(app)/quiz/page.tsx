import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chatJson } from "@/lib/groq";
import SubmitButton from "@/components/SubmitButton";

export default async function QuizPage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question, about_user, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const ids = (questions ?? []).map((q) => q.id);
  const { data: answers } = ids.length
    ? await supabase.from("quiz_answers").select("question_id, answerer_id, answer").in("question_id", ids)
    : { data: [] };

  const byQ = new Map<string, Array<{ answerer_id: string; answer: string }>>();
  for (const a of answers ?? []) {
    if (!byQ.has(a.question_id)) byQ.set(a.question_id, []);
    byQ.get(a.question_id)!.push({ answerer_id: a.answerer_id, answer: a.answer });
  }

  async function addQuestion(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const text = String(formData.get("question") || "").trim();
    const aboutSelf = formData.get("about") === "me";
    if (!text) return;
    // about_user = the person the question is *about*. If "me" -> me, else partner.
    let aboutUser = me.userId;
    if (!aboutSelf) {
      const { data: partner } = await supabase
        .from("profiles")
        .select("user_id")
        .neq("user_id", me.userId)
        .limit(1)
        .maybeSingle();
      if (partner?.user_id) aboutUser = partner.user_id;
    }
    await supabase.from("quiz_questions").insert({
      couple_id: me.coupleId,
      question: text,
      about_user: aboutUser,
    });
    revalidatePath("/quiz");
  }

  async function generateQuestions() {
    "use server";
    if (!aiEnabled()) return;
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const { data: partner } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .neq("user_id", me.userId)
      .limit(1)
      .maybeSingle();
    const { data: recent } = await supabase
      .from("quiz_questions")
      .select("question")
      .eq("couple_id", me.coupleId)
      .order("created_at", { ascending: false })
      .limit(40);
    const seen = (recent ?? []).map((r) => `- ${r.question}`).join("\n");
    type Gen = { questions: Array<{ about: "me" | "partner"; question: string }> };
    const out = await chatJson<Gen>({
      system:
        "You write playful 'how well do you know me' quiz questions for a couple. Output strict JSON: {\"questions\":[{\"about\":\"me\"|\"partner\",\"question\":string}]}. 6 total, mixing about=me and about=partner. Specific, never generic. Under 20 words each.",
      user: `Avoid duplicates of these:\n${seen}\n\nMake half about each person.`,
      maxTokens: 600,
    });
    const rows = (out.questions ?? []).slice(0, 6).map((q) => ({
      couple_id: me.coupleId,
      question: String(q.question).slice(0, 240),
      about_user: q.about === "me" ? me.userId : (partner?.user_id ?? me.userId),
    }));
    if (rows.length) await supabase.from("quiz_questions").insert(rows);
    revalidatePath("/quiz");
  }

  async function answer(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const question_id = String(formData.get("question_id") || "");
    const text = String(formData.get("answer") || "").trim();
    if (!question_id || !text) return;
    await supabase.from("quiz_answers").upsert(
      { question_id, answerer_id: me.userId, answer: text },
      { onConflict: "question_id,answerer_id" }
    );
    revalidatePath("/quiz");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Know Me</h1>
        <p className="muted">Both answer. The person it&apos;s about answers truthfully. The other one guesses.</p>
      </header>

      <section className="card p-3.5 space-y-3">
        <form action={addQuestion} className="space-y-2.5">
          <div>
            <label className="label" htmlFor="quiz-question">Ask a question</label>
            <input id="quiz-question" className="input" name="question" placeholder="e.g. What's my comfort meal?" required />
          </div>
          <div>
            <label className="label" htmlFor="quiz-about">Who is it about?</label>
            <select id="quiz-about" className="input" name="about" defaultValue="me">
              <option value="me">About me</option>
              <option value="partner">About my partner</option>
            </select>
          </div>
          <SubmitButton className="btn btn-primary w-full">Add question</SubmitButton>
        </form>
        <form action={generateQuestions}>
          <SubmitButton className="btn w-full" disabled={!aiEnabled()} pendingLabel="Generating…">
            {aiEnabled() ? "Generate 6 questions with AI" : "Set GROQ_API_KEY to enable"}
          </SubmitButton>
        </form>
      </section>

      <section className="space-y-6">
        {(questions ?? []).map((q) => {
          const list = byQ.get(q.id) ?? [];
          const truthAuthor = list.find((a) => a.answerer_id === q.about_user);
          const guessAuthor = list.find((a) => a.answerer_id !== q.about_user);
          const myAnswer = list.find((a) => a.answerer_id === me.userId);
          const bothAnswered = Boolean(truthAuthor && guessAuthor);
          const aboutMe = q.about_user === me.userId;

          return (
            <article key={q.id} className="thread">
              {/* The question is the app speaking; the two answers are yours and theirs. */}
              <div className="card px-4 py-3 space-y-1">
                <p className="label !mb-0">{aboutMe ? "About you" : "About your partner"}</p>
                <h3 className="font-semibold text-[15px] leading-snug">{q.question}</h3>
              </div>
              {bothAnswered ? (
                <>
                  {[truthAuthor!, guessAuthor!].map((a) => {
                    const mine = a.answerer_id === me.userId;
                    const isTruth = a === truthAuthor;
                    return (
                      <div key={a.answerer_id} className="contents">
                        <div className={`bubble ${mine ? "bubble-me" : "bubble-them"}`}>{a.answer}</div>
                        <span className={`stamp ${mine ? "self-end" : ""}`}>
                          {mine ? "You" : "Partner"} · {isTruth ? "the truth" : "the guess"}
                        </span>
                      </div>
                    );
                  })}
                </>
              ) : myAnswer ? (
                <span className="stamp self-end">You answered · waiting on your partner</span>
              ) : null}
              {!myAnswer && (
                <form action={answer} className="flex gap-2 pt-1">
                  <input type="hidden" name="question_id" value={q.id} />
                  <input className="input min-w-0" name="answer" aria-label={aboutMe ? "The truth" : "Your guess"} placeholder={aboutMe ? "The truth" : "Your guess"} required />
                  <SubmitButton className="btn btn-primary shrink-0">Send</SubmitButton>
                </form>
              )}
            </article>
          );
        })}
        {questions && questions.length === 0 && <p className="muted text-center">No questions yet. Add one above or generate some with AI.</p>}
      </section>
    </div>
  );
}
