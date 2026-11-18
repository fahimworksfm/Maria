import PinSearch from "./PinSearch";
import { ClaimForm } from "@/components/ClaimButtons";
import { claimRow, insertAuthored, isClaimWho, partnerNameFor, sideClass, sideName, sideOf } from "@/lib/authorship";
import { revalidatePath } from "next/cache";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { aiEnabled, chat } from "@/lib/groq";
import { MapPin } from "lucide-react";

export default async function TravelPage({ searchParams }: { searchParams: Promise<{ plan_for?: string }> }) {
  const me = await requireCoupled();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: pins } = await supabase
    .from("travel_pins")
    .select("*") // includes author_id once migration 0014 has run
    .eq("couple_id", me.coupleId)
    .order("visited", { ascending: true })
    .order("created_at", { ascending: false });

  let itinerary: string | null = null;
  if (sp.plan_for && aiEnabled()) {
    const list = (pins ?? []).filter((p) => p.name.toLowerCase().includes(sp.plan_for!.toLowerCase()));
    if (list.length > 0) {
      itinerary = await chat({
        system: "Plan a tight one-day itinerary for a couple from a list of pinned places. Be concrete, give times, walking notes, and one wildcard.",
        user: `City filter: ${sp.plan_for}\nPins: ${JSON.stringify(list.map((p) => p.name))}`,
        temperature: 0.7,
        maxTokens: 500,
      });
    }
  }

  async function add(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const supabase = await supabaseServer();
    const name = String(formData.get("name") || "").trim();
    // Blank coordinates mean nothing was picked: don't file the pin at 0,0.
    const latRaw = String(formData.get("lat") ?? "").trim();
    const lngRaw = String(formData.get("lng") ?? "").trim();
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!name || !latRaw || !lngRaw || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    await insertAuthored(supabase, "travel_pins", {
      couple_id: me.coupleId,
      name,
      lat,
      lng,
      notes: String(formData.get("notes") || "").trim() || null,
    }, me.userId);
    revalidatePath("/travel");
  }

  async function visit(formData: FormData) {
    "use server";
    const id = String(formData.get("id") || "");
    const supabase = await supabaseServer();
    await supabase
      .from("travel_pins")
      .update({ visited: true, visited_on: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    revalidatePath("/travel");
  }

  async function claim(formData: FormData) {
    "use server";
    const me = await requireCoupled();
    const who = formData.get("who");
    if (!isClaimWho(who)) return;
    const supabase = await supabaseServer();
    await claimRow(supabase, "travel_pins", String(formData.get("id") || ""), who, me);
    revalidatePath("/travel");
  }

  const partnerName = await partnerNameFor(supabase, me.userId);
  const side = (a: unknown) => sideOf(a, me.userId);
  const who = (a: unknown) => sideName(side(a), partnerName);

  return (
    <div className="space-y-6">
      <header><h1 className="h1">Travel</h1><p className="muted">Pins for now and someday.</p></header>

      <PinSearch action={add} />

      <form className="card p-4 space-y-2">
        <h3 className="label">Plan a day</h3>
        <input className="input" name="plan_for" placeholder="City or filter (e.g. Lisbon)" aria-label="City or filter" defaultValue={sp.plan_for ?? ""} />
        <button className="btn w-full" type="submit" disabled={!aiEnabled()}>{aiEnabled() ? "Draft itinerary from matching pins" : "Set GROQ_API_KEY to enable"}</button>
        {itinerary && (
          <div className="rounded-xl2 bg-panel2 p-3.5 space-y-1">
            <p className="label !mb-0">Tether&apos;s draft</p>
            <p className="whitespace-pre-wrap text-[15px] leading-snug">{itinerary}</p>
          </div>
        )}
      </form>

      <section className="space-y-2">
        <h3 className="label">Pins ({pins?.length ?? 0})</h3>
        {(pins ?? []).map((p) => (
          <div key={p.id} className={`card px-4 py-3 flex justify-between items-center gap-3 ${sideClass(side(p.author_id))}`}>
            <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-panel2 text-accentInk" aria-hidden><MapPin size={17} /></span>
            <div className="min-w-0 flex-1">
              {who(p.author_id) && <div className="text-xs text-muted mb-0.5">{who(p.author_id)}</div>}
              <div className="font-semibold">{p.name}</div>
              <div className="text-muted text-[13px]">{p.lat.toFixed(3)}, {p.lng.toFixed(3)}{p.visited && p.visited_on ? ` · visited ${p.visited_on}` : ""}</div>
              {p.notes && <p className="text-[15px] leading-snug mt-1">{p.notes}</p>}
              {!p.author_id && <ClaimForm action={claim} id={p.id} partnerName={partnerName} />}
            </div>
            {!p.visited && (
              <form action={visit}><input type="hidden" name="id" value={p.id} /><button className="btn btn-ghost text-sm" type="submit">Been</button></form>
            )}
          </div>
        ))}
        {pins && pins.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><MapPin size={22} aria-hidden /></div>
            <p className="font-bold text-lg pt-2">No pins yet.</p>
            <p className="muted">Search for a place in the box at the top and tap Add pin.</p>
            <p className="text-muted text-[13px]">For example: the city you keep saying you&apos;ll visit together.</p>
          </div>
        )}
      </section>
    </div>
  );
}
