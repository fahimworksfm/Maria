"use client";

import { ClaimButtons } from "@/components/ClaimButtons";
import { sideClass, sideName, sideOf } from "@/lib/authorship";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, X } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import UndoToast from "@/components/UndoToast";
import SwipeRow from "@/components/SwipeRow";

const PlacesMap = dynamic(() => import("./PlacesMap"), { ssr: false });

export type Place = {
  id: string;
  name: string;
  kind: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  visited: boolean;
  rating: number | null;
  created_at: string;
  author_id?: string | null;
};

type Suggestion = { label: string; name: string; lat: number; lng: number };

const sortPlaces = (a: Place, b: Place) =>
  Number(a.visited) - Number(b.visited) || (a.created_at < b.created_at ? 1 : -1);

export default function PlacesBoard({ initial, coupleId, meId, partnerName }: { initial: Place[]; coupleId: string; meId: string; partnerName: string }) {
  // Whose it is decides which side it sits on; rows with no author stay neutral.
  const side = (a: unknown) => sideOf(a, meId);
  const who = (a: unknown) => sideName(side(a), partnerName);
  const { items, add, update, claim, removeWithUndo, undo, dismissUndo, removed } = useCollection<Place>({
    table: "places",
    initial,
    coupleId,
    realtime: true,
    sort: sortPlaces,
  });

  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Geocode suggestions as you type (debounced).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (name.trim().length < 3) { setSuggestions([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(name.trim())}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch { setSuggestions([]); }
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [name]);

  function pick(s: Suggestion) {
    setName(s.name);
    setCoords({ lat: s.lat, lng: s.lng });
    setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setName(""); setKind(""); setNotes(""); setExpanded(false); setOpen(false);
    const c = coords;
    setCoords(null);
    await add(
      { name: n, kind: kind.trim() || null, notes: notes.trim() || null, lat: c?.lat ?? null, lng: c?.lng ?? null },
      { name: n, kind: kind.trim() || null, notes: notes.trim() || null, lat: c?.lat ?? null, lng: c?.lng ?? null, visited: false, rating: null, created_at: new Date().toISOString(), author_id: meId }
    );
  }

  const toGo = items.filter((p) => !p.visited);
  const been = items.filter((p) => p.visited);
  const mapPins = items
    .filter((p) => p.lat != null && p.lng != null && !String(p.id).startsWith("temp-"))
    .map((p) => ({ id: p.id, name: p.name, lat: p.lat as number, lng: p.lng as number, visited: p.visited }));

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-4 space-y-2 relative">
        <input
          className="input"
          placeholder="Add a place…"
          aria-label="Add a place"
          value={name}
          onChange={(e) => { setName(e.target.value); setCoords(null); }}
          onFocus={() => suggestions.length && setOpen(true)}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-20 left-4 right-4 top-16 bg-panel border border-line rounded-xl2 overflow-hidden shadow-lift max-h-60 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => pick(s)} className="w-full text-left px-3.5 py-2.5 min-h-[44px] hover:bg-panel2 text-[15px] border-b border-line last:border-0">
                  <span className="font-semibold">{s.name}</span>
                  <span className="muted block text-xs truncate">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {coords && <p className="text-muted text-[13px] inline-flex items-center gap-1"><MapPin size={16} className="text-accentInk" aria-hidden /> location attached</p>}
        {expanded && (
          <div className="space-y-2">
            <input className="input" placeholder="Type (cafe, dinner, park)" aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)} />
            <textarea className="input" placeholder="Why this one?" aria-label="Why this one?" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Less" : "Details"}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={!name.trim()}>Add</button>
        </div>
      </form>

      {mapPins.length > 0 && <PlacesMap pins={mapPins} />}

      <section className="space-y-2">
        <h3 className="label">Want to go ({toGo.length})</h3>
        {toGo.map((p) => (
          <SwipeRow key={p.id} onDelete={() => removeWithUndo(p.id)}>
            <div className={`collection-item card px-4 py-3 flex justify-between items-start gap-3 ${sideClass(side(p.author_id))}`}>
              <div className="min-w-0">
                {who(p.author_id) && <div className="text-xs text-muted mb-0.5">{who(p.author_id)}</div>}
                <div className="font-semibold leading-snug">{p.name}</div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                  {p.kind && <span className="pill">{p.kind}</span>}
                  {p.lat != null && p.lng != null && (
                    <a className="text-accentInk text-[13px] font-semibold underline underline-offset-2" target="_blank" rel="noreferrer"
                       href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}>Open in Maps</a>
                  )}
                </div>
                {p.notes && <p className="text-muted text-[13px] mt-1.5 leading-relaxed">{p.notes}</p>}
                {!p.author_id && !String(p.id).startsWith("temp-") && (
                  <ClaimButtons partnerName={partnerName} onClaim={(w) => claim(p.id, w, w === "me" ? meId : "partner")} />
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <select
                  className="input !w-auto text-sm"
                  aria-label="Rating"
                  defaultValue=""
                  onChange={(e) => update(p.id, { visited: true, rating: Number(e.target.value) || null } as Partial<Place>)}
                >
                  <option value="">Been…</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </select>
                <button type="button" className="grid place-items-center w-11 h-11 shrink-0 rounded-full text-muted hover:bg-panel2 hover:text-ink transition" onClick={() => removeWithUndo(p.id)} aria-label="Delete"><X size={16} aria-hidden /></button>
              </div>
            </div>
          </SwipeRow>
        ))}
        {toGo.length === 0 && been.length === 0 && (
          <div className="card p-5 text-center space-y-1">
            <div className="mark-box"><MapPin size={22} aria-hidden /></div>
            <p className="font-bold text-lg pt-2">Nowhere saved yet.</p>
            <p className="muted">Search for a spot in the box above and tap Add. It lands on the map too.</p>
            <p className="text-muted text-[13px]">For example: the ramen place one of you keeps mentioning.</p>
          </div>
        )}
        {toGo.length === 0 && been.length > 0 && <p className="muted">You&apos;ve been everywhere on the list. Add the next one above.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="label">Been ({been.length})</h3>
        {been.map((p) => (
          <div key={p.id} className={`collection-item card px-4 py-3 flex justify-between items-start gap-3 opacity-90 ${sideClass(side(p.author_id))}`}>
            <div className="min-w-0">
              {who(p.author_id) && <div className="text-xs text-muted mb-0.5">{who(p.author_id)}</div>}
                <div className="font-semibold">{p.name} {p.rating ? `· ${"★".repeat(p.rating)}` : ""}</div>
              {p.notes && <p className="text-muted text-[13px] mt-1 leading-relaxed">{p.notes}</p>}
            </div>
            <button type="button" className="grid place-items-center w-11 h-11 shrink-0 rounded-full text-muted hover:bg-panel2 hover:text-ink transition" onClick={() => removeWithUndo(p.id)} aria-label="Delete"><X size={16} aria-hidden /></button>
          </div>
        ))}
      </section>

      <UndoToast show={Boolean(removed)} label="Place removed" onUndo={undo} onDismiss={dismissUndo} />
    </div>
  );
}
