"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import SubmitButton from "@/components/SubmitButton";

type Suggestion = { label: string; name: string; lat: number; lng: number };

// Add a travel pin by searching for it, the same way Places does, instead of
// typing coordinates. The picked result fills hidden lat/lng fields that go to
// the page's existing server action. Typing coordinates by hand is still there,
// tucked away, for somewhere the search can't find.
export default function PinSearch({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(false);

  // Geocode suggestions as you type (debounced).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (skipNext.current) { skipNext.current = false; return; }
    if (name.trim().length < 3) { setSuggestions([]); setSearched(false); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(name.trim())}`);
        const data = (await res.json()) as { results?: Suggestion[] };
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
      setSearched(true);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [name]);

  function pick(s: Suggestion) {
    skipNext.current = true; // setting the name below shouldn't search again
    setName(s.name);
    setLat(String(s.lat));
    setLng(String(s.lng));
    setPicked(s.label);
    setOpen(false);
  }

  const latN = Number(lat);
  const lngN = Number(lng);
  const hasCoords =
    lat.trim() !== "" && lng.trim() !== "" &&
    Number.isFinite(latN) && Number.isFinite(lngN) &&
    Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;
  const ready = name.trim().length > 0 && hasCoords;

  async function submit(formData: FormData) {
    await action(formData);
    setName(""); setLat(""); setLng(""); setNotes(""); setPicked(null); setSuggestions([]); setSearched(false);
  }

  return (
    <form action={submit} className="card p-4 space-y-2 relative">
      <label className="label" htmlFor="pin-name">Add a pin</label>
      <input
        id="pin-name"
        className="input"
        name="name"
        placeholder="Search a city or place…"
        value={name}
        onChange={(e) => { setName(e.target.value); setPicked(null); }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
        required
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-4 right-4 top-[92px] bg-panel border border-line rounded-xl2 overflow-hidden shadow-lift max-h-60 overflow-y-auto">
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
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />

      <p className="text-muted text-[13px] min-h-[20px]" aria-live="polite">
        {picked ? (
          <span className="inline-flex items-center gap-1"><MapPin size={14} className="text-accentInk shrink-0" aria-hidden /> <span className="truncate">{picked}</span></span>
        ) : hasCoords ? (
          <span className="inline-flex items-center gap-1"><MapPin size={14} className="text-accentInk shrink-0" aria-hidden /> Coordinates set by hand.</span>
        ) : searched && suggestions.length === 0 ? (
          "No match. Try a nearby city, or enter coordinates by hand below."
        ) : (
          "Type at least three letters, then pick a result."
        )}
      </p>

      <label className="sr-only" htmlFor="pin-notes">Why here?</label>
      <textarea id="pin-notes" className="input" name="notes" rows={2} placeholder="Why here?" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <details>
        <summary className="inline-flex items-center min-h-[44px] text-[13px] font-semibold text-muted cursor-pointer select-none hover:text-ink">Enter coordinates manually</summary>
        <div className="grid grid-cols-2 gap-2 pb-1">
          <div>
            <label className="label" htmlFor="pin-lat">Latitude</label>
            <input id="pin-lat" className="input" type="number" step="any" inputMode="decimal" placeholder="38.722" value={lat} onChange={(e) => { setLat(e.target.value); setPicked(null); }} />
          </div>
          <div>
            <label className="label" htmlFor="pin-lng">Longitude</label>
            <input id="pin-lng" className="input" type="number" step="any" inputMode="decimal" placeholder="-9.139" value={lng} onChange={(e) => { setLng(e.target.value); setPicked(null); }} />
          </div>
          <p className="col-span-2 text-muted text-[13px]">In Google or Apple Maps, long-press a place to copy its coordinates.</p>
        </div>
      </details>

      <SubmitButton className="btn btn-primary w-full" disabled={!ready}>Add pin</SubmitButton>
    </form>
  );
}
