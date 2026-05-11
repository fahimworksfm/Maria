import { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "tether-media";

export async function signedUrl(supabase: SupabaseClient, path: string, expiresIn = 60 * 60): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export function userScopedPath(userId: string, filename: string) {
  const stamp = Date.now();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${stamp}-${safe}`;
}
