"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";

const HIDE_KEY = "tether:first-week-hidden";

export type FirstWeekDone = { city: boolean; visit: boolean; memory: boolean; prompt: boolean };

/**
 * A short list of the things that make the app feel like yours. It disappears
 * on its own once everything is done, or when you hide it.
 */
export default function FirstWeek({ done }: { done: FirstWeekDone }) {
  // Hidden until the client has checked storage, so it never flashes in for
  // someone who dismissed it.
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [notifications, setNotifications] = useState(false);

  useEffect(() => {
    try { setHidden(window.localStorage.getItem(HIDE_KEY) === "1"); } catch { /* storage blocked: just show it */ }
    try { setNotifications(typeof Notification !== "undefined" && Notification.permission === "granted"); } catch { /* unsupported */ }
    setReady(true);
  }, []);

  const steps = [
    { key: "city", label: "Set your city", href: "/together", done: done.city },
    { key: "visit", label: "Add your next visit", href: "/together", done: done.visit },
    { key: "notifications", label: "Turn on notifications", href: "/pulse", done: notifications },
    { key: "memory", label: "Drop your first memory", href: "/memories", done: done.memory },
    { key: "prompt", label: "Answer a daily prompt", href: "/journal", done: done.prompt },
  ];
  const left = steps.filter((s) => !s.done).length;

  if (!ready || hidden || left === 0) return null;

  function hide() {
    setHidden(true);
    try { window.localStorage.setItem(HIDE_KEY, "1"); } catch { /* it will simply come back next time */ }
  }

  return (
    <section className="card p-4 space-y-2" aria-label="Getting started">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label !mb-0">Getting started</p>
          <p className="text-muted text-[13px]">{steps.length - left} of {steps.length} done</p>
        </div>
        <button type="button" onClick={hide} aria-label="Hide getting started" className="grid place-items-center w-11 h-11 -mt-2 -mr-2 rounded-full text-muted hover:text-ink hover:bg-panel2 transition">
          <X size={16} aria-hidden />
        </button>
      </div>
      <ul>
        {steps.map((s) => (
          <li key={s.key} className="border-t border-line first:border-t-0">
            {s.done ? (
              <span className="flex items-center gap-3 min-h-[44px] text-muted">
                <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-panel2 text-accentInk"><Check size={14} aria-hidden /></span>
                <span className="line-through">{s.label}</span>
                <span className="sr-only">done</span>
              </span>
            ) : (
              <Link href={s.href} className="flex items-center gap-3 min-h-[44px] hover:text-accentInk transition">
                <span className="w-6 h-6 shrink-0 rounded-full border-2 border-line" aria-hidden />
                <span className="flex-1 font-semibold text-[15px]">{s.label}</span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
