import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Service-role client. NEVER import from a client component.
export function supabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
