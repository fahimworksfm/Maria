"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { GROUPS, MODULES, modulesInGroup, searchModules, type AppModule } from "@/lib/modules";

const STORE_KEY = "tether:home-groups";

function ModuleRow({ m }: { m: AppModule }) {
  const Icon = m.Icon;
  return (
    <Link
      href={m.href}
      className="flex items-center gap-3 rounded-xl2 px-2 py-2 border border-transparent hover:border-line hover:bg-panel2 transition active:scale-[0.99]"
    >
      <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-xl2 bg-accent/12 text-accent">
        <Icon size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display font-medium leading-snug truncate">{m.title}</span>
          {m.badge === "private" && <span className="pill shrink-0">PIN</span>}
          {m.badge === "yours" && <span className="pill shrink-0">yours</span>}
        </span>
        <span className="muted text-xs block truncate">{m.desc}</span>
      </span>
    </Link>
  );
}

export default function ModuleDirectory() {
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Restore which groups were left open. Written on toggle rather than held in
  // React state so <details> keeps working before hydration, and without JS.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let open: string[] | null = null;
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) open = JSON.parse(raw) as string[];
    } catch {
      open = null;
    }
    if (!Array.isArray(open)) return;
    for (const el of Array.from(root.querySelectorAll<HTMLDetailsElement>("details[data-group]"))) {
      el.open = open.includes(el.dataset.group ?? "");
    }
  }, []);

  function persist() {
    const root = rootRef.current;
    if (!root) return;
    const open = Array.from(root.querySelectorAll<HTMLDetailsElement>("details[data-group]"))
      .filter((el) => el.open)
      .map((el) => el.dataset.group ?? "");
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(open));
    } catch {
      // Private mode or blocked storage — the directory still works, it just
      // won't remember.
    }
  }

  const results = searchModules(query);
  const searching = query.trim().length > 0;

  return (
    <div ref={rootRef} className="space-y-3">
      <div className="relative">
        <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          className="input pl-9 pr-9"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${MODULES.length} spaces…`}
          aria-label="Search everything in Tether"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-panel2 transition"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>

      {searching ? (
        <div aria-live="polite">
          {results.length === 0 ? (
            <p className="muted text-sm px-1 py-3">Nothing matches “{query.trim()}”.</p>
          ) : (
            <div className="space-y-0.5">
              {results.map((m) => <ModuleRow key={m.href} m={m} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {GROUPS.map((g) => {
            const items = modulesInGroup(g.key);
            return (
              <details key={g.key} data-group={g.key} open={g.defaultOpen} onToggle={persist} className="card px-3 py-2.5">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none select-none">
                  <span className="min-w-0">
                    <span className="font-display font-medium">{g.label}</span>
                    <span className="muted text-xs block">{g.blurb}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="muted text-xs tabular-nums">{items.length}</span>
                    {/* Without this there is nothing to say the row opens — the
                        count alone reads as decoration. */}
                    <ChevronDown size={16} aria-hidden className="chev text-muted transition-transform" />
                  </span>
                </summary>
                <div className="mt-2 space-y-0.5 sm:grid sm:grid-cols-2 sm:gap-x-2 sm:space-y-0">
                  {items.map((m) => <ModuleRow key={m.href} m={m} />)}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
