import type { SupabaseClient } from "@supabase/supabase-js";

// Shared lists record who added each row in `author_id`, so the app can put
// yours on one side and your partner's on the other. The column arrived in
// migration 0014; rows from before it (and AI-generated rows) have no author
// and render as neutral, full-width items.

type Row = Record<string, unknown>;

/** True when PostgREST rejected a write because `author_id` isn't there yet. */
function authorColumnMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || error.code === "42703" || /author_id/.test(error.message ?? "");
}

/**
 * Insert rows stamped with the current user as author. If the database has not
 * been migrated yet, the same rows are inserted without the stamp, so adding
 * to a list keeps working either way.
 */
export async function insertAuthored(supabase: SupabaseClient, table: string, rows: Row | Row[], authorId: string) {
  const list = Array.isArray(rows) ? rows : [rows];
  const first = await supabase.from(table).insert(list.map((r) => ({ ...r, author_id: authorId }))).select();
  if (authorColumnMissing(first.error)) return supabase.from(table).insert(list).select();
  return first;
}

export type Side = "me" | "them" | null;

/** Which side of the thread a row belongs on; null when its author is unknown. */
export function sideOf(authorId: unknown, myUserId: string): Side {
  if (typeof authorId !== "string" || !authorId) return null;
  return authorId === myUserId ? "me" : "them";
}

/** Classes that pull a card to its author's side. Empty for unknown authors. */
export function sideClass(side: Side): string {
  return side === "me" ? "side-me" : side === "them" ? "side-them" : "";
}

/** The name to show for a side, or null when there is nothing to say. */
export function sideName(side: Side, partnerName: string): string | null {
  return side === "me" ? "You" : side === "them" ? partnerName : null;
}

/** Your partner's display name, for labelling their side. */
export async function partnerNameFor(supabase: SupabaseClient, myUserId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").neq("user_id", myUserId).limit(1).maybeSingle();
  return data?.display_name ?? "Partner";
}
