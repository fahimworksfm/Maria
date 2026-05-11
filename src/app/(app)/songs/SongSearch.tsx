"use client";

import { useState, useTransition } from "react";

type Track = {
  id: string;
  uri: string;
  name: string;
  artists: string;
  url: string | null;
  image: string | null;
};

type Props = {
  addAction: (formData: FormData) => Promise<void>;
};

export default function SongSearch({ addAction }: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Track[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Track | null>(null);
  const [why, setWhy] = useState("");
  const [adding, startAdd] = useTransition();
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Search failed");
      setItems(data.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  function handleAdd() {
    if (!picked) return;
    const fd = new FormData();
    fd.set("uri", picked.uri);
    fd.set("title", picked.name);
    fd.set("artist", picked.artists);
    fd.set("url", picked.url ?? "");
    fd.set("why", why);
    startAdd(async () => {
      await addAction(fd);
      setAdded((s) => new Set([...s, picked.id]));
      setPicked(null);
      setWhy("");
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Search Spotify..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !q.trim()}>{busy ? "..." : "Search"}</button>
      </form>
      {err && <p className="text-accent text-sm">{err}</p>}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((t) => {
            const isPicked = picked?.id === t.id;
            const isAdded = added.has(t.id);
            return (
              <li key={t.id} className="bg-panel2 border border-line rounded-lg p-2 flex items-center gap-3">
                {t.image && <img src={t.image} alt="" className="w-10 h-10 rounded" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{t.name}</div>
                  <div className="muted text-xs truncate">{t.artists}</div>
                </div>
                {isAdded ? (
                  <span className="pill">Added</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() => setPicked(isPicked ? null : t)}
                  >
                    {isPicked ? "Cancel" : "Pick"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {picked && (
        <div className="card p-3 space-y-2">
          <div className="text-sm">Adding: <span className="font-medium">{picked.name}</span> · {picked.artists}</div>
          <textarea
            className="input"
            rows={2}
            placeholder="Why this song made it in (optional)"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
          <button className="btn btn-primary w-full" type="button" onClick={handleAdd} disabled={adding}>
            {adding ? "Adding..." : "Add to playlist"}
          </button>
        </div>
      )}
    </div>
  );
}
