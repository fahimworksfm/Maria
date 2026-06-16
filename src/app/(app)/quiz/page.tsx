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
        <h1 className="h1">How Well Do You Know Me?</h1>
        <p className="muted">Both answer. The person it&apos;s about answers truthfully. The other one guesses.</p>
      </header>

      <section className="card p-4 space-y-3">
        <form action={generateQuestions}>
          <SubmitButton className="btn btn-primary w-full" disabled={!aiEnabled()} pendingLabel="Generating…">
            {aiEnabled() ? "Generate 6 questions with AI" : "Set GROQ_API_KEY to enable"}
          </SubmitButton>
        </form>
        <form action={addQuestion} className="space-y-2">
          <input className="input" name="question" placeholder="Ask a question..." required />
          <select className="input" name="about" defaultValue="me">
            <option value="me">About me</option>
            <option value="partner">About my partner</option>
          </select>
          <SubmitButton className="btn w-full">Add question</SubmitButton>
        </form>
      </section>

      <section className="space-y-3">
        {(questions ?? []).map((q) => {
          const list = byQ.get(q.id) ?? [];
          const truthAuthor = list.find((a) => a.answerer_id === q.about_user);
          const guessAuthor = list.find((a) => a.answerer_id !== q.about_user);
          const myAnswer = list.find((a) => a.answerer_id === me.userId);
          const bothAnswered = Boolean(truthAuthor && guessAuthor);
          const aboutMe = q.about_user === me.userId;

          return (
            <article key={q.id} className="card p-4 space-y-2">
              <div className="muted text-xs">{aboutMe ? "About you" : "About your partner"}</div>
              <h3 className="font-medium">{q.question}</h3>
              {myAnswer ? (
                <p className="text-sm muted">You answered.</p>
              ) : (
                <form action={answer} className="space-y-2">
                  <input type="hidden" name="question_id" value={q.id} />
                  <input className="input" name="answer" placeholder={aboutMe ? "The truth" : "Your guess"} required />
                  <SubmitButton className="btn w-full">Submit</SubmitButton>
                </form>
              )}
              {bothAnswered && (
                <div className="pt-2 border-t border-line space-y-1 text-sm">
                  <div><span className="muted">Truth: </span>{truthAuthor!.answer}</div>
                  <div><span className="muted">Guess: </span>{guessAuthor!.answer}</div>
                </div>
              )}
            </article>
          );
        })}
        {questions && questions.length === 0 && <p className="muted">No questions yet. Generate some with AI above.</p>}
      </section>
    </div>
  );
}
