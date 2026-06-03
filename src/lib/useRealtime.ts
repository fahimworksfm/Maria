"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Subscribes to Postgres changes for `table` scoped to a couple and calls
 * router.refresh() on INSERT/UPDATE so the server component re-renders with the
 * new data. Realtime respects RLS, so a subscriber only receives rows their
 * policies allow them to SELECT (e.g. only shared mood check-ins).
 *
 * Refreshes are debounced so a burst of events triggers a single re-render.
 */
export function useRealtime(table: string, coupleId: string | null | undefined) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!coupleId) return;
    const supabase = supabaseBrowser();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };

    (async () => {
      // Pass the user's access token so Realtime can apply RLS for this user.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (!active) return;

      const filter = `couple_id=eq.${coupleId}`;
      channel = supabase
        .channel(`rt:${table}:${coupleId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, scheduleRefresh)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, scheduleRefresh)
        .subscribe();
    })();

    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, coupleId, router]);
}
