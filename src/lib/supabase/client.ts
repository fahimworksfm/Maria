"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

type BrowserClient = ReturnType<typeof createBrowserClient>;
let client: BrowserClient | null = null;

// Singleton so all components/hooks share one client (and one Realtime socket).
export function supabaseBrowser(): BrowserClient {
  if (!client) {
    client = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return client;
}
