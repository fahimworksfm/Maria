import Link from "next/link";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Item = {
  id: string;
  kind: "memory" | "journal" | "anniversary" | "gratitude";
  icon: string;
  label: string;
  title: string;
  snippet?: string | null;
  href: string;
  ym: string;
  sortTs: number;
  dayLabel: string;
};

function fromDateOnly(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const ts = Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  const dt = new Date(ts);
  return {
    ym: `${y}-${String(m).padStart(2, "0")}`,
    sortTs: ts,
    dayLabel: `${WEEKDAYS[dt.getUTCDay()]} ${dt.getUTCDate()}`,
  };
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

function snip(text: string | null | undefined, n = 140): string | null {
  if (!text) return null;
  const t = text.trim();
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
}

export default async function TimelinePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();

  const [{ data: mems }, { data: jrn }, { data: annivs }, { data: grats }] = await Promise.all([
    supabase
      .from("memories")
      .select("id, title, body, happened_on, location_name, created_at")
      .eq("couple_id", me.coupleId)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("journal_entries")
      .select("prompt, author_id, prompt_date")
      .eq("couple_id", me.coupleId)
      .order("prompt_date", { ascending: false })
      .limit(120),
    supabase
      .from("anniversaries")
      .select("id, name, on_date, kind")
      .eq("couple_id", me.coupleId),
    supabase
      .from("gratitudes")
      .select("id, text, created_at")
      .eq("couple_id", me.coupleId)
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const items: Item[] = [];

  for (const m of mems ?? []) {
    const d = fromDateOnly((m.happened_on ?? m.created_at).slice(0, 10));
    items.push({
      id: `mem-${m.id}`,
      kind: "memory",
      icon: "💌",
      label: "Memory",
      title: m.title || "A moment",
      snippet: snip(m.body) ?? (m.location_name ? `at ${m.location_name}` : null),
      href: "/memories",
      ...d,
    });
  }

  // Journal entries only appear once revealed (both partners answered that day).
  const byDate = new Map<string, { prompt: string; authors: Set<string> }>();
  for (const r of jrn ?? []) {
    if (!byDate.has(r.prompt_date)) byDate.set(r.prompt_date, { prompt: r.prompt, authors: new Set() });
    byDate.get(r.prompt_date)!.authors.add(r.author_id);
  }
  for (const [date, info] of byDate) {
    if (info.authors.size < 2) continue; // not revealed yet
    const d = fromDateOnly(date);
    items.push({
      id: `jrn-${date}`,
      kind: "journal",
      icon: "📔",
      label: "Journal",
      title: info.prompt,
      snippet: "You both answered.",
      href: "/journal",
      ...d,
    });
  }

  for (const a of annivs ?? []) {
    const d = fromDateOnly(a.on_date.slice(0, 10));
    items.push({
      id: `ann-${a.id}`,
      kind: "anniversary",
      icon: "🧭",
      label: a.kind === "birthday" ? "Birthday" : "Anniversary",
      title: a.name,
      snippet: null,
      href: "/anniversaries",
      ...d,
    });
  }

  for (const g of grats ?? []) {
    const d = fromDateOnly(g.created_at.slice(0, 10));
    items.push({
      id: `grat-${g.id}`,
      kind: "gratitude",
      icon: "🌳",
      label: "Gratitude",
      title: snip(g.text, 120) || "A small thanks",
      snippet: null,
      href: "/gratitude",
      ...d,
    });
  }

  items.sort((a, b) => b.sortTs - a.sortTs);

  // Group consecutively by month (items already sorted desc).
  const groups: Array<{ ym: string; items: Item[] }> = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.ym === it.ym) last.items.push(it);
    else groups.push({ ym: it.ym, items: [it] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Timeline</h1>
        <p className="muted">Everything you two have woven together, newest first.</p>
      </header>

      {groups.length === 0 ? (
        <div className="card p-6 text-center space-y-2">
          <div className="text-3xl">🧵</div>
          <p className="font-display text-lg">Your story starts here.</p>
          <p className="muted text-sm">Add a memory, answer a prompt, or plant a gratitude — it&apos;ll all gather on this thread.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.ym} className="space-y-3">
            <h2 className="font-display text-xl text-muted sticky top-[57px] bg-bg/80 backdrop-blur py-1 z-10">
              {monthLabel(group.ym)}
            </h2>
            <ol className="space-y-3">
              {group.items.map((it) => (
                <li key={it.id}>
                  <Link href={it.href} className="card card-hover p-4 flex gap-3 items-start">
                    <span className="text-2xl leading-none mt-0.5">{it.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="label !mb-0">{it.label}</span>
                        <span className="muted text-xs shrink-0">{it.dayLabel}</span>
                      </div>
                      <p className="font-medium mt-1 break-words">{it.title}</p>
                      {it.snippet && <p className="muted text-sm mt-0.5 break-words">{it.snippet}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
