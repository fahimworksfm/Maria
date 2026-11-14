import Link from "next/link";
import { Images, NotebookPen, Compass, Sprout, Inbox } from "lucide-react";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/media";
import { partnerNameFor, sideName, sideOf, type Side } from "@/lib/authorship";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ItemKind = "memory" | "journal" | "anniversary" | "gratitude";

const KIND_ICON: Record<ItemKind, typeof Images> = {
  memory: Images,
  journal: NotebookPen,
  anniversary: Compass,
  gratitude: Sprout,
};

type Item = {
  id: string;
  kind: ItemKind;
  label: string;
  title: string;
  snippet?: string | null;
  href: string;
  photo?: string | null;
  ym: string;
  sortTs: number;
  dayLabel: string;
  // Who wrote it. Null for things you did together or dates you set.
  side: Side;
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
      .select("id, title, body, happened_on, location_name, created_at, media_url, media_type, author_id")
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
      .select("id, text, created_at, author_id")
      .eq("couple_id", me.coupleId)
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const items: Item[] = [];

  for (const m of mems ?? []) {
    const d = fromDateOnly((m.happened_on ?? m.created_at).slice(0, 10));
    const photo =
      m.media_type === "image" && m.media_url ? await signedUrl(supabase, m.media_url, 60 * 60 * 12) : null;
    items.push({
      id: `mem-${m.id}`,
      kind: "memory",
      label: "Memory",
      title: m.title || "A moment",
      snippet: snip(m.body) ?? (m.location_name ? `at ${m.location_name}` : null),
      href: "/memories",
      photo,
      side: sideOf(m.author_id, me.userId),
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
      label: "Journal",
      title: info.prompt,
      snippet: "You both answered.",
      href: "/journal",
      side: null,
      ...d,
    });
  }

  for (const a of annivs ?? []) {
    const d = fromDateOnly(a.on_date.slice(0, 10));
    items.push({
      id: `ann-${a.id}`,
      kind: "anniversary",
      label: a.kind === "birthday" ? "Birthday" : "Anniversary",
      title: a.name,
      snippet: null,
      href: "/anniversaries",
      side: null,
      ...d,
    });
  }

  for (const g of grats ?? []) {
    const d = fromDateOnly(g.created_at.slice(0, 10));
    items.push({
      id: `grat-${g.id}`,
      kind: "gratitude",
      label: "Gratitude",
      title: snip(g.text, 120) || "A small thanks",
      snippet: null,
      href: "/gratitude",
      side: sideOf(g.author_id, me.userId),
      ...d,
    });
  }

  const partnerName = await partnerNameFor(supabase, me.userId);

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
          <div className="mark-box">
            <Inbox size={22} aria-hidden />
          </div>
          <p className="font-bold text-lg pt-1">Your story starts here.</p>
          <p className="muted">Add a memory, answer a prompt, or plant a gratitude — it&apos;ll all gather on this thread.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.ym} className="thread">
            {/* The month is a day-mark in the thread, pinned while its entries scroll. */}
            <h2 className="self-center sticky top-[72px] z-10 pill !bg-panel border border-line !text-ink !px-3 !py-1 my-1">
              {monthLabel(group.ym)}
            </h2>
            <ol className="contents">
              {group.items.map((it) => {
                const Icon = KIND_ICON[it.kind];

                // Dates you set rather than things either of you wrote: a quiet
                // centred mark, the way a thread notes an event.
                if (it.kind === "anniversary") {
                  return (
                    <li key={it.id} className="self-center">
                      <Link href={it.href} className="stamp inline-flex items-center gap-1.5 min-h-[44px] hover:text-ink">
                        <Icon size={14} className="text-accentInk" aria-hidden />
                        <span>{it.label} · <span className="text-ink font-semibold">{it.title}</span> · {it.dayLabel}</span>
                      </Link>
                    </li>
                  );
                }

                // Something one of you wrote: a bubble on that person's side.
                if (it.side) {
                  const mine = it.side === "me";
                  return (
                    <li key={it.id} className="contents">
                      <Link
                        href={it.href}
                        className={`bubble ${mine ? "bubble-me" : "bubble-them"} ${it.photo ? "!p-1.5 w-[80%]" : ""}`}
                      >
                        {it.photo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.photo} alt={it.title} className="w-full max-h-72 object-cover rounded-2xl" />
                        )}
                        <div className={it.photo ? "px-2 pt-1.5 pb-1" : ""}>
                          <p className="font-semibold leading-snug break-words">{it.title}</p>
                          {it.snippet && <p className="leading-snug mt-0.5 break-words opacity-90">{it.snippet}</p>}
                        </div>
                      </Link>
                      <span className={`stamp mb-1.5 flex items-center gap-1.5 ${mine ? "self-end" : ""}`}>
                        <Icon size={12} aria-hidden />
                        {sideName(it.side, partnerName)} · {it.label} · {it.dayLabel}
                      </span>
                    </li>
                  );
                }

                // Something you did together (a revealed journal day): a card
                // across the full width, belonging to neither side.
                return (
                  <li key={it.id} className="contents">
                    <Link
                      href={it.href}
                      className={`card card-hover block w-full overflow-hidden ${it.photo ? "p-1.5" : "p-3.5"}`}
                    >
                      {it.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.photo} alt={it.title} className="w-full max-h-72 object-cover rounded-2xl" />
                      )}
                      <div className={`flex gap-3 items-start ${it.photo ? "px-2 pt-2.5 pb-2" : ""}`}>
                        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-panel2 text-accentInk" aria-hidden>
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-snug break-words">{it.title}</p>
                          {it.snippet && <p className="text-muted text-[15px] leading-snug mt-0.5 break-words">{it.snippet}</p>}
                        </div>
                      </div>
                    </Link>
                    <span className="stamp mb-1.5">{it.label} · {it.dayLabel}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
