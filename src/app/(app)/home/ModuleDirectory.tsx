"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Pin, Search, X } from "lucide-react";
import { GROUPS, MODULES, modulesInGroup, searchModules, type AppModule } from "@/lib/modules";

const STORE_KEY = "tether:home-groups";
const PIN_KEY = "tether:pinned";
const SEEN_KEY = "tether:seen";
const MAX_PINS = 6;
// When this device first started tracking. Anything older than this is not
// "new" — otherwise the whole list would light up on first run.
const SEEN_SINCE = "_since";

type Hit = { type: string; title: string; snippet: string | null; href: string };

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: works, just won't remember */ }
}

function ModuleRow({
  m, isNew, pinned, canPin, onOpen, onTogglePin,
}: {
  m: AppModule; isNew: boolean; pinned: boolean; canPin: boolean;
  onOpen: (href: string) => void; onTogglePin: (href: string) => void;
}) {
  const Icon = m.Icon;
  return (
    <div className="flex items-center rounded-xl2 hover:bg-panel2 transition">
      <Link
        href={m.href}
        onClick={() => onOpen(m.href)}
        className="flex items-center gap-3 flex-1 min-w-0 px-2 py-2 min-h-[56px] active:scale-[0.99] transition"
      >
        <span className="relative inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-panel2 text-accentInk">
          <Icon size={17} aria-hidden />
          {isNew && (
            <span
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-panel"
              style={{ background: "rgb(var(--c-prim-bg))" }}
            >
              <span className="sr-only">new</span>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`text-[15px] leading-snug truncate ${isNew ? "font-bold" : "font-semibold"}`}>{m.title}</span>
            {m.badge === "private" && <span className="pill shrink-0">PIN</span>}
            {m.badge === "yours" && <span className="pill shrink-0">yours</span>}
          </span>
          <span className="text-muted text-[13px] block truncate">{m.desc}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onTogglePin(m.href)}
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${m.title}` : `Pin ${m.title} to the top`}
        disabled={!pinned && !canPin}
        title={!pinned && !canPin ? `You can pin up to ${MAX_PINS}` : undefined}
        className={`grid place-items-center w-11 h-11 shrink-0 rounded-full transition disabled:opacity-30 ${pinned ? "text-accentInk" : "text-muted/60 hover:text-ink"}`}
      >
        <Pin size={15} fill={pinned ? "currentColor" : "none"} aria-hidden />
      </button>
    </div>
  );
}

export default function ModuleDirectory({ latest = {} }: { latest?: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Pins and "last opened" times live on this device. Both start empty so the
  // server render and the first client render agree; storage fills them in.
  const [pinned, setPinned] = useState<string[]>([]);
  const [seen, setSeen] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const p = readJson<string[]>(PIN_KEY);
    if (Array.isArray(p)) setPinned(p.filter((h) => MODULES.some((m) => m.href === h)).slice(0, MAX_PINS));
    let s = readJson<Record<string, string>>(SEEN_KEY);
    if (!s || typeof s !== "object" || !s[SEEN_SINCE]) {
      s = { ...(s && typeof s === "object" ? s : {}), [SEEN_SINCE]: new Date().toISOString() };
      writeJson(SEEN_KEY, s);
    }
    setSeen(s);
  }, []);

  const markOpened = useCallback((href: string) => {
    setSeen((prev) => {
      const next = { ...(prev ?? {}), [href]: new Date().toISOString() };
      if (!next[SEEN_SINCE]) next[SEEN_SINCE] = next[href]!;
      writeJson(SEEN_KEY, next);
      return next;
    });
  }, []);

  const togglePin = useCallback((href: string) => {
    setPinned((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : prev.length < MAX_PINS ? [...prev, href] : prev;
      writeJson(PIN_KEY, next);
      return next;
    });
  }, []);

  // New = your partner added something there after you last opened it here.
  const isNew = (href: string) => {
    const at = latest[href];
    if (!at || !seen) return false;
    const since = seen[href] ?? seen[SEEN_SINCE];
    return Boolean(since) && at > since!;
  };

  const row = (m: AppModule) => (
    <ModuleRow
      key={m.href}
      m={m}
      isNew={isNew(m.href)}
      pinned={pinned.includes(m.href)}
      canPin={pinned.length < MAX_PINS}
      onOpen={markOpened}
      onTogglePin={togglePin}
    />
  );
  const pinnedModules = pinned.map((h) => MODULES.find((m) => m.href === h)).filter((m): m is AppModule => Boolean(m));

  // Content search: what the two of you have written, fetched a beat after you
  // stop typing, with any slower earlier request thrown away.
  const [hits, setHits] = useState<Hit[]>([]);
  const [searchingContent, setSearchingContent] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); setSearchingContent(false); return; }
    const ctrl = new AbortController();
    setSearchingContent(true);
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json().catch(() => null)) as { hits?: Hit[] } | null;
        setHits(res.ok && Array.isArray(data?.hits) ? data.hits : []);
        setSearchingContent(false);
      } catch {
        // Aborted (a newer search took over) or offline: leave things as they are.
        if (!ctrl.signal.aborted) { setHits([]); setSearchingContent(false); }
      }
    }, 250);
    return () => { window.clearTimeout(id); ctrl.abort(); };
  }, [query]);

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
          className="input pl-9 pr-9 !rounded-full !bg-panel"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search spaces, memories, songs…"
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
        <div aria-live="polite" className="space-y-3">
          {results.length > 0 && (
            <div className="space-y-0.5">
              {results.map(row)}
            </div>
          )}
          {hits.length > 0 && (
            <div>
              <p className="label">In your content</p>
              <ul className="card px-3 py-1">
                {hits.map((h, i) => (
                  <li key={`${h.href}-${i}`} className="border-t border-line first:border-t-0">
                    <Link href={h.href} onClick={() => markOpened(h.href)} className="flex items-start justify-between gap-3 py-2.5 min-h-[48px] hover:text-accentInk transition">
                      <span className="min-w-0">
                        <span className="font-semibold text-[15px] leading-snug block truncate">{h.title}</span>
                        {h.snippet && <span className="text-muted text-[13px] block truncate">{h.snippet}</span>}
                      </span>
                      <span className="pill shrink-0 mt-0.5">{h.type}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {results.length === 0 && hits.length === 0 && (
            <p className="muted text-sm px-1 py-3">
              {searchingContent ? "Searching…" : `Nothing matches “${query.trim()}”.`}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {pinnedModules.length > 0 && (
            <section className="card px-3 py-2.5" aria-label="Pinned">
              <p className="label !mb-1 px-2">Pinned</p>
              <div className="space-y-0.5 sm:grid sm:grid-cols-2 sm:gap-x-2 sm:space-y-0">
                {pinnedModules.map(row)}
              </div>
            </section>
          )}
          {GROUPS.map((g) => {
            const items = modulesInGroup(g.key);
            return (
              <details key={g.key} data-group={g.key} open={g.defaultOpen} onToggle={persist} className="card px-3 py-2.5">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none select-none">
                  <span className="min-w-0">
                    <span className="font-semibold text-[15px]">{g.label}</span>
                    {items.some((m) => isNew(m.href)) && (
                      <span className="inline-block w-2 h-2 rounded-full ml-2 align-middle" style={{ background: "rgb(var(--c-prim-bg))" }}><span className="sr-only">has something new</span></span>
                    )}
                    <span className="text-muted text-[13px] block">{g.blurb}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="muted text-xs tabular-nums">{items.length}</span>
                    {/* Without this there is nothing to say the row opens — the
                        count alone reads as decoration. */}
                    <ChevronDown size={16} aria-hidden className="chev text-muted transition-transform" />
                  </span>
                </summary>
                <div className="mt-2 space-y-0.5 sm:grid sm:grid-cols-2 sm:gap-x-2 sm:space-y-0">
                  {items.map(row)}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
