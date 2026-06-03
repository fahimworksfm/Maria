import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import GratitudeForm from "@/components/GratitudeForm";

export default async function GratitudePage() {
  const me = await requireCoupled();
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("gratitudes")
    .select("id, author_id, text, created_at")
    .eq("couple_id", me.coupleId)
    .order("created_at", { ascending: false });

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const text = String(formData.get("text") || "").trim();
    if (!text) return;
    await supabase.from("gratitudes").insert({ couple_id: me.coupleId, author_id: me.userId, text });
    revalidatePath("/gratitude");
  }

  const items = rows ?? [];
  const { data: partner } = await supabase
    .from("profiles")
    .select("display_name")
    .neq("user_id", me.userId)
    .limit(1)
    .maybeSingle();
  const partnerName = partner?.display_name ?? "partner";

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Gratitude Tree</h1><p className="muted">A leaf grows for each thanks.</p></header>

      <div className="card p-2">
        <Tree count={items.length} leaves={items.slice(0, 40).map((g, i) => ({ idx: i, text: g.text, mine: g.author_id === me.userId }))} />
      </div>

      <GratitudeForm action={add} />

      {items.length === 0 ? (
        <div className="card p-5 text-center space-y-1">
          <div className="text-3xl">🌱</div>
          <p className="font-display text-base">An empty tree, waiting.</p>
          <p className="muted text-sm">Plant a small thing and watch it grow.</p>
        </div>
      ) : (
        <section className="space-y-1">
          <h3 className="label">Recent ({items.length})</h3>
          {items.slice(0, 30).map((g) => (
            <div key={g.id} className="card p-3 text-sm">
              <span className="muted text-xs mr-2">by {g.author_id === me.userId ? "you" : partnerName}</span>
              {g.text}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Tree({ leaves, count }: { count: number; leaves: Array<{ idx: number; text: string; mine: boolean }> }) {
  const w = 360, h = 360;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="auto" aria-label="Gratitude tree">
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="100%" r="80%">
          <stop offset="0%" stopColor="#1d1d27" />
          <stop offset="100%" stopColor="#0b0b10" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#bgGrad)" />

      {/* trunk */}
      <path d={`M ${w / 2} ${h} C ${w / 2 - 4} ${h - 80}, ${w / 2 + 4} ${h - 120}, ${w / 2} ${h - 180}`}
            stroke="#5a3a2a" strokeWidth="10" fill="none" strokeLinecap="round" />
      {/* branches */}
      {BRANCHES.map((b, i) => (
        <path key={i}
          d={`M ${w / 2} ${h - 180} Q ${w / 2 + b.cx} ${h - 180 + b.cy}, ${w / 2 + b.x} ${h - 180 + b.y}`}
          stroke="#5a3a2a" strokeWidth={b.sw} fill="none" strokeLinecap="round" />
      ))}

      {/* leaves */}
      {leaves.map(({ idx, mine }) => {
        const pos = leafPos(idx, w, h);
        return (
          <g key={idx} transform={`translate(${pos.x} ${pos.y}) rotate(${pos.r})`}>
            <ellipse rx="8" ry="14" fill={mine ? "#f97373" : "#f9c873"} opacity="0.9" />
          </g>
        );
      })}

      <text x={w - 12} y={h - 12} textAnchor="end" fontFamily="ui-serif, Georgia, serif" fill="#9a9aaa" fontSize="12">
        {count} {count === 1 ? "leaf" : "leaves"}
      </text>
    </svg>
  );
}

const BRANCHES: Array<{ cx: number; cy: number; x: number; y: number; sw: number }> = [
  { cx: -40, cy: -20, x: -90, y: -50, sw: 6 },
  { cx: 40, cy: -20, x: 100, y: -40, sw: 6 },
  { cx: -10, cy: -40, x: -30, y: -90, sw: 5 },
  { cx: 20, cy: -50, x: 50, y: -100, sw: 5 },
  { cx: -60, cy: 10, x: -130, y: 10, sw: 4 },
  { cx: 60, cy: 10, x: 130, y: 0, sw: 4 },
];

function leafPos(i: number, w: number, h: number) {
  const angle = (i * 137.5 * Math.PI) / 180; // golden angle
  const r = 60 + (i % 6) * 18 + Math.floor(i / 8) * 6;
  const x = w / 2 + Math.cos(angle) * r;
  const y = h - 180 + Math.sin(angle) * r * 0.7 - Math.min(i, 30);
  const rot = (Math.cos(angle) * 30);
  return { x, y, r: rot };
}
