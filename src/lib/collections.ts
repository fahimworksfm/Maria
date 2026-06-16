// Whitelist for the generic optimistic CRUD API (/api/collection/[table]).
// Only these tables and columns are writable through it; the scope column is set
// server-side from the session, never trusted from the client.

export type CollectionConfig = {
  scope: "couple" | "owner"; // couple_id vs owner_id
  setAuthor?: boolean; // also stamp author_id = current user
  columns: string[]; // client-supplied insert columns that are allowed
  updatable?: string[]; // columns allowed via PATCH
};

export const COLLECTIONS: Record<string, CollectionConfig> = {
  places: { scope: "couple", columns: ["name", "kind", "notes", "lat", "lng"], updatable: ["visited", "rating", "name", "kind", "notes"] },
  gratitudes: { scope: "couple", setAuthor: true, columns: ["text"] },
  bucket_items: { scope: "couple", columns: ["title", "notes", "category", "target_date"], updatable: ["completed_at", "title", "notes"] },
  watchlist: { scope: "couple", columns: ["title", "kind", "notes", "runtime_min", "mood_tags"], updatable: ["watched_at", "rating", "notes"] },
};

export function collectionConfig(table: string): CollectionConfig | null {
  return COLLECTIONS[table] ?? null;
}
