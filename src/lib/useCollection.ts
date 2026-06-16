"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Row = { id: string; [k: string]: unknown };

type Opts<T> = {
  table: string;
  initial: T[];
  coupleId?: string | null;
  realtime?: boolean;
  sort?: (a: T, b: T) => number;
};

// Optimistic collection: instant add (placeholder swapped for the saved row),
// delete-with-undo (the real delete is deferred until the undo window closes),
// and optional Realtime so a partner's changes stream in. RLS still governs
// what the API and Realtime allow.
export function useCollection<T extends Row>(opts: Opts<T>) {
  const [items, setItems] = useState<T[]>(opts.initial);
  const [removed, setRemoved] = useState<{ item: T; index: number } | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const resort = useCallback(
    (list: T[]) => (opts.sort ? [...list].sort(opts.sort) : list),
    [opts.sort]
  );

  const add = useCallback(
    async (payload: Record<string, unknown>, optimistic: Omit<T, "id">) => {
      const tempId = `temp-${Math.random().toString(36).slice(2)}`;
      const temp = { ...(optimistic as object), id: tempId } as T;
      setItems((prev) => resort([temp, ...prev]));
      try {
        const res = await fetch(`/api/collection/${opts.table}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as { row?: T; error?: string } | null;
        if (!res.ok || !data?.row) throw new Error(data?.error || "Save failed");
        setItems((prev) => resort(prev.map((i) => (i.id === tempId ? (data.row as T) : i))));
        return true;
      } catch {
        setItems((prev) => prev.filter((i) => i.id !== tempId)); // rollback
        return false;
      }
    },
    [opts.table, resort]
  );

  const update = useCallback(
    async (id: string, fields: Partial<T>) => {
      let prevSnapshot: T | undefined;
      setItems((prev) => {
        prevSnapshot = prev.find((i) => i.id === id);
        return resort(prev.map((i) => (i.id === id ? ({ ...i, ...fields } as T) : i)));
      });
      try {
        const res = await fetch(`/api/collection/${opts.table}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, fields }),
        });
        const data = (await res.json().catch(() => null)) as { row?: T; error?: string } | null;
        if (!res.ok || !data?.row) throw new Error(data?.error || "Update failed");
        setItems((prev) => resort(prev.map((i) => (i.id === id ? (data.row as T) : i))));
        return true;
      } catch {
        if (prevSnapshot) setItems((prev) => resort(prev.map((i) => (i.id === id ? (prevSnapshot as T) : i))));
        return false;
      }
    },
    [opts.table, resort]
  );

  const removeWithUndo = useCallback((id: string) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.id === id);
      if (index === -1) return prev;
      setRemoved({ item: prev[index]!, index });
      return prev.filter((i) => i.id !== id);
    });
    const t = setTimeout(() => {
      timers.current.delete(id);
      setRemoved((r) => (r && r.item.id === id ? null : r));
      fetch(`/api/collection/${opts.table}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    }, 5000);
    timers.current.set(id, t);
  }, [opts.table]);

  const undo = useCallback(() => {
    setRemoved((r) => {
      if (!r) return null;
      const t = timers.current.get(r.item.id);
      if (t) { clearTimeout(t); timers.current.delete(r.item.id); }
      setItems((prev) => {
        const next = [...prev];
        next.splice(Math.min(r.index, next.length), 0, r.item);
        return resort(next);
      });
      return null;
    });
  }, [resort]);

  const dismissUndo = useCallback(() => setRemoved(null), []);

  // Realtime: merge partner changes (and our own, deduped by id).
  useEffect(() => {
    if (!opts.realtime || !opts.coupleId) return;
    const supabase = supabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (!active) return;
      channel = supabase
        .channel(`coll:${opts.table}:${opts.coupleId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: opts.table, filter: `couple_id=eq.${opts.coupleId}` }, (payload) => {
          const row = payload.new as T;
          setItems((prev) => (prev.some((i) => i.id === row.id) ? prev : resort([row, ...prev])));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: opts.table, filter: `couple_id=eq.${opts.coupleId}` }, (payload) => {
          const row = payload.new as T;
          setItems((prev) => resort(prev.map((i) => (i.id === row.id ? row : i))));
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: opts.table, filter: `couple_id=eq.${opts.coupleId}` }, (payload) => {
          const old = payload.old as { id?: string };
          if (old?.id) setItems((prev) => prev.filter((i) => i.id !== old.id));
        })
        .subscribe();
    })();
    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, [opts.realtime, opts.coupleId, opts.table, resort]);

  return { items, add, update, removeWithUndo, undo, dismissUndo, removed };
}
