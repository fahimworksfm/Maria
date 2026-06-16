"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

type Values = { trigger: string; feeling: string; need: string; repair: string };

const STEPS: Array<{
  key: keyof Values;
  title: string;
  hint: string;
  placeholder: string;
}> = [
  { key: "trigger", title: "What set it off?", hint: "The moment things tipped — small or big.", placeholder: "e.g. We were both tired and a plan fell through…" },
  { key: "feeling", title: "How did you feel?", hint: "Name it for yourself. No need to justify it.", placeholder: "e.g. Unseen. A little anxious." },
  { key: "need", title: "What did you need?", hint: "The thing underneath the feeling.", placeholder: "e.g. To feel like we were a team about it." },
  { key: "repair", title: "One small repair", hint: "A tiny next step toward each other — not a fix for everything.", placeholder: "e.g. A hug, and five minutes to redo the plan together." },
];

export default function RepairFlow({
  action,
  aiEnabled,
}: {
  action: (fd: FormData) => Promise<void>;
  aiEnabled: boolean;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({ trigger: "", feeling: "", need: "", repair: "" });
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  // Soften panel state (only used on the "trigger" step)
  const [softening, setSoftening] = useState(false);
  const [softened, setSoftened] = useState<string | null>(null);
  const [softenErr, setSoftenErr] = useState<string | null>(null);

  const current = STEPS[step]!;
  const value = values[current.key];
  const isLast = step === STEPS.length - 1;
  const canAdvance = current.key === "trigger" ? value.trim().length > 0 : true;

  function set(key: keyof Values, v: string) {
    setValues((s) => ({ ...s, [key]: v }));
  }

  function resetSoften() {
    setSoftened(null);
    setSoftenErr(null);
  }

  async function soften() {
    setSoftenErr(null);
    setSoftened(null);
    if (!values.trigger.trim()) return;
    setSoftening(true);
    try {
      const res = await fetch("/api/repair/soften", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: values.trigger }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Couldn't soften that");
      setSoftened(String(data.softened || ""));
    } catch (e) {
      setSoftenErr(e instanceof Error ? e.message : "Couldn't soften that");
    } finally {
      setSoftening(false);
    }
  }

  function next() {
    resetSoften();
    if (isLast) return submit();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    resetSoften();
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    const fd = new FormData();
    fd.set("trigger", values.trigger.trim());
    fd.set("feeling", values.feeling.trim());
    fd.set("need", values.need.trim());
    fd.set("repair", values.repair.trim());
    start(async () => {
      try {
        await action(fd);
        setValues({ trigger: "", feeling: "", need: "", repair: "" });
        setStep(0);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {
        /* leave values so they can retry */
      }
    });
  }

  return (
    <div className="card p-5 space-y-4">
      {/* progress dots */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>

      <div>
        <div className="muted text-xs">Step {step + 1} of {STEPS.length}</div>
        <h2 className="h2 mt-1">{current.title}</h2>
        <p className="muted text-sm">{current.hint}</p>
      </div>

      <textarea
        className="input"
        rows={3}
        placeholder={current.placeholder}
        value={value}
        onChange={(e) => { set(current.key, e.target.value); if (current.key === "trigger") resetSoften(); }}
      />

      {/* Soften affordance on the trigger step */}
      {current.key === "trigger" && (
        <div className="space-y-3">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={soften}
            disabled={!aiEnabled || softening || !value.trim()}
          >
            {!aiEnabled ? (
              "Soften (set GROQ_API_KEY)"
            ) : softening ? (
              "Softening…"
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={16} className="text-accent" aria-hidden />
                Soften this — kinder, first person
              </span>
            )}
          </button>
          {softenErr && <p className="text-accent text-xs">{softenErr}</p>}

          {softened && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Choice
                label="Yours"
                text={values.trigger}
                onPick={() => resetSoften()}
                cta="Keep mine"
              />
              <Choice
                label="Softer"
                text={softened}
                highlight
                onPick={() => { set("trigger", softened); resetSoften(); }}
                cta="Use this"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {step > 0 && (
          <button type="button" className="btn flex-1" onClick={back} disabled={pending}>Back</button>
        )}
        <button
          type="button"
          className="btn btn-primary flex-1 cta-glow"
          onClick={next}
          disabled={!canAdvance || pending}
        >
          {isLast ? (pending ? "Saving…" : "Save this repair") : "Next"}
        </button>
      </div>

      {saved && <p className="muted text-xs text-center">Saved. Be gentle with yourself. 🤍</p>}
    </div>
  );
}

function Choice({
  label,
  text,
  cta,
  onPick,
  highlight,
}: {
  label: string;
  text: string;
  cta: string;
  onPick: () => void;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl2 border p-3 space-y-2 ${highlight ? "border-accent/40 bg-accent/5" : "border-line bg-panel2"}`}>
      <div className="label">{label}</div>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
      <button type="button" className="btn btn-ghost text-xs w-full" onClick={onPick}>{cta}</button>
    </div>
  );
}
