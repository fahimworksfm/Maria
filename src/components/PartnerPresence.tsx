"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Joins a presence channel for the couple, tracks the current user, and shows a
 * small "<name> is here" dot in the header when the partner is also present.
 */
export default function PartnerPresence({
  coupleId,
  myUserId,
  partnerName,
}: {
  coupleId: string;
  myUserId: string;
  partnerName: string;
}) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!coupleId) return;
    const supabase = supabaseBrowser();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (!active) return;

      channel = supabase.channel(`couple:${coupleId}`, {
        config: { presence: { key: myUserId } },
      });

      const computeOnline = () => {
        if (!channel) return;
        const state = channel.presenceState();
        // Present if any presence key belongs to someone other than me.
        setOnline(Object.keys(state).some((k) => k !== myUserId));
      };

      channel
        .on("presence", { event: "sync" }, computeOnline)
        .on("presence", { event: "join" }, computeOnline)
        .on("presence", { event: "leave" }, computeOnline)
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ online_at: new Date().toISOString() });
          }
        });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [coupleId, myUserId]);

  if (!online) return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" title={`${partnerName} is online`}>
      <span className="relative inline-flex">
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      {partnerName} is here
    </span>
  );
}
