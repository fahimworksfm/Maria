"use client";

import { useEffect, useRef } from "react";

export type ChapterMemory = { title: string; date: string | null; place: string | null };
export type Chapter = {
  key: string;
  label: string;
  plate: string;
  memories: ChapterMemory[];
  journalCount: number;
};

const MAX_LISTED = 6;

export default function YearChapters({ chapters, year }: { chapters: Chapter[]; year: number }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>(".chapter"));

    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (calm || typeof IntersectionObserver === "undefined") {
      sections.forEach((s) => s.classList.add("is-in"));
      return;
    }

    // `ready` is what arms the hidden start state, so the chapters stay visible
    // if this effect never runs — a reveal animation must not be the only thing
    // standing between someone and their own year.
    root.classList.add("ready");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
    );

    for (const s of sections) {
      // Anything already on screen is revealed in this same frame rather than
      // waiting for the observer's first callback, which would flash it out.
      if (s.getBoundingClientRect().top < window.innerHeight * 0.9) s.classList.add("is-in");
      else io.observe(s);
    }
    return () => io.disconnect();
  }, [chapters]);

  return (
    <div ref={rootRef} className="chapters space-y-5">
      {chapters.map((c) => (
        <section key={c.key} className="chapter">
          <div className="chapter-plate">
            <img src={c.plate} alt="" loading="lazy" decoding="async" width={1200} height={896} />
            <div className="chapter-plate-label">
              <span className="font-display text-2xl">{c.label}</span>
              <span className="text-xs tracking-widest opacity-80">{year}</span>
            </div>
          </div>

          <div className="pt-3">
            {c.memories.length === 0 && c.journalCount === 0 ? (
              <p className="muted text-sm">Nothing logged this season.</p>
            ) : (
              <>
                <p className="muted text-xs mb-2">
                  {c.memories.length} {c.memories.length === 1 ? "memory" : "memories"}
                  {c.journalCount > 0 && ` · ${c.journalCount} journal ${c.journalCount === 1 ? "entry" : "entries"}`}
                </p>
                <ul className="space-y-1.5">
                  {c.memories.slice(0, MAX_LISTED).map((m, i) => (
                    <li key={`${m.title}-${i}`} className="flex gap-2 text-sm">
                      <span className="muted tabular-nums shrink-0 w-14">{m.date ?? ""}</span>
                      <span className="min-w-0">
                        {m.title}
                        {m.place && <span className="muted"> · {m.place}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {c.memories.length > MAX_LISTED && (
                  <p className="muted text-xs mt-2">+{c.memories.length - MAX_LISTED} more</p>
                )}
              </>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
