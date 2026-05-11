import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { WORKSHEETS } from "@/lib/worksheets";

export default async function WorksheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sheet = WORKSHEETS.find((w) => w.id === id);
  if (!sheet) return notFound();
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: mine } = await supabase
    .from("worksheet_responses")
    .select("answers, completed_at")
    .eq("user_id", me.userId)
    .eq("worksheet_id", id)
    .maybeSingle();
  const myAnswers = (mine?.answers ?? {}) as Record<string, string>;
  const completed = Boolean(mine?.completed_at);

  const { data: partnerRow } = await supabase
    .from("worksheet_responses")
    .select("answers, completed_at")
    .eq("worksheet_id", id)
    .neq("user_id", me.userId)
    .maybeSingle();
  const partnerAnswers = (partnerRow?.answers ?? {}) as Record<string, string>;
  const partnerDone = Boolean(partnerRow?.completed_at);

  async function save(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const sheet = WORKSHEETS.find((w) => w.id === id);
    if (!sheet) return;
    const answers: Record<string, string> = {};
    for (const q of sheet.questions) {
      const v = String(formData.get(q.id) || "").trim();
      if (v) answers[q.id] = v;
    }
    const finish = formData.get("finish") === "1";
    await supabase
      .from("worksheet_responses")
      .upsert(
        {
          user_id: me.userId,
          couple_id: me.coupleId,
          worksheet_id: id,
          answers,
          completed_at: finish ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,worksheet_id" }
      );
    revalidatePath(`/worksheets/${id}`);
    if (finish) redirect(`/worksheets/${id}`);
  }

  async function reset() {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    await supabase.from("worksheet_responses").delete().eq("user_id", me.userId).eq("worksheet_id", id);
    revalidatePath(`/worksheets/${id}`);
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/worksheets" className="muted text-sm">← All worksheets</Link>
        <h1 className="h1 mt-1">{sheet.title}</h1>
        <p className="muted">{sheet.intro}</p>
      </header>

      {completed && (
        <section className="card p-4 space-y-2">
          <h3 className="label">Your result</h3>
          <p className="font-display text-xl">{sheet.summarize(myAnswers)}</p>
          {partnerDone && (
            <>
              <h3 className="label mt-3">Partner&apos;s result</h3>
              <p className="font-display text-xl">{sheet.summarize(partnerAnswers)}</p>
            </>
          )}
          <p className="muted text-sm mt-2">{sheet.outro}</p>
          <form action={reset} className="pt-2">
            <button className="btn btn-ghost text-xs" type="submit">Retake</button>
          </form>
        </section>
      )}

      {!completed && (
        <form action={save} className="space-y-4">
          {sheet.questions.map((q) => (
            <div key={q.id} className="card p-4 space-y-2">
              <h3 className="font-medium">{q.text}</h3>
              {q.kind === "choice" ? (
                <div className="space-y-1">
                  {q.options.map((opt) => (
                    <label key={opt.value} className="block cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.value}
                        defaultChecked={myAnswers[q.id] === opt.value}
                        className="peer sr-only"
                        required
                      />
                      <div className="px-3 py-2 rounded-lg border border-line bg-panel2 text-sm peer-checked:bg-accent/20 peer-checked:border-accent/40">
                        {opt.label}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea className="input" name={q.id} rows={2} defaultValue={myAnswers[q.id] ?? ""} placeholder={q.placeholder} />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn flex-1" type="submit" name="finish" value="0">Save progress</button>
            <button className="btn btn-primary flex-1 cta-glow" type="submit" name="finish" value="1">Finish</button>
          </div>
        </form>
      )}
    </div>
  );
}
