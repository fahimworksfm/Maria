"use client";

import { useRealtime } from "@/lib/useRealtime";

// Thin client wrapper so server components can opt into live refresh by dropping
// <RealtimeRefresh table="nudges" coupleId={...} /> into their tree.
export default function RealtimeRefresh({ table, coupleId }: { table: string; coupleId: string | null }) {
  useRealtime(table, coupleId);
  return null;
}
