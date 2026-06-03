"use client";

// Offline write outbox backed by IndexedDB. When a write fails because the
// device is offline, the intent is stored and replayed against /api/outbox once
// connectivity returns. Online writes go through the normal server action and
// never touch this queue.

export type OutboxKind = "gratitude.add" | "mood.save";

export type OutboxIntent = {
  id: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  createdAt: number;
};

const DB_NAME = "tether-outbox";
const STORE = "intents";

function hasIDB(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// --- subscription so the UI can show the pending count ---
type Listener = (count: number) => void;
const listeners = new Set<Listener>();
let lastCount = 0;
let flushing = false;

async function notify() {
  try {
    lastCount = await count();
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(lastCount);
}

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  cb(lastCount);
  // Refresh the count asynchronously on first subscribe.
  count().then((c) => { lastCount = c; cb(c); }).catch(() => {});
  return () => listeners.delete(cb);
}

export function isFlushing(): boolean {
  return flushing;
}

export async function enqueue(kind: OutboxKind, payload: Record<string, unknown>): Promise<void> {
  if (!hasIDB()) throw new Error("Offline storage unavailable");
  const intent: OutboxIntent = { id: uuid(), kind, payload, createdAt: Date.now() };
  await tx("readwrite", (s) => s.add(intent));
  await notify();
}

export async function all(): Promise<OutboxIntent[]> {
  if (!hasIDB()) return [];
  const rows = await tx<OutboxIntent[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxIntent[]>);
  return (rows ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function count(): Promise<number> {
  if (!hasIDB()) return 0;
  return tx<number>("readonly", (s) => s.count());
}

/**
 * Replay queued intents against /api/outbox. Stops on transient failures
 * (offline / 5xx) and retries later; drops permanently-rejected intents (4xx
 * validation) so one bad item can't wedge the queue forever.
 */
export async function flush(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (!hasIDB()) return;
  flushing = true;
  await notify();
  try {
    const items = await all();
    for (const item of items) {
      let res: Response;
      try {
        res = await fetch("/api/outbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: item.kind, payload: item.payload }),
        });
      } catch {
        break; // network error — try again on next online event
      }
      const data = await res.json().catch(() => null) as { ok?: boolean } | null;
      if (res.ok && data?.ok) {
        await remove(item.id); // applied successfully
      } else if (res.status === 400 && data) {
        await remove(item.id); // permanent validation failure — drop, don't loop forever
      } else {
        break; // 401 redirect / 5xx / unparseable — stop and retry later
      }
    }
  } finally {
    flushing = false;
    await notify();
  }
}

/**
 * Run a write online via the provided server action; if offline (or the call
 * fails with the device offline), queue the intent for later replay.
 * Returns "done" when applied immediately, "queued" when stored for sync.
 */
export async function runOrQueue(
  kind: OutboxKind,
  payload: Record<string, unknown>,
  action: () => Promise<void>
): Promise<"done" | "queued"> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueue(kind, payload);
    return "queued";
  }
  try {
    await action();
    return "done";
  } catch (err) {
    // If we went offline mid-flight, queue it. Otherwise rethrow (real error).
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await enqueue(kind, payload);
      return "queued";
    }
    throw err;
  }
}

// Auto-replay when connectivity returns, and once on load if already online.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { flush(); });
  // Defer initial flush so it doesn't block first paint.
  setTimeout(() => { if (navigator.onLine) flush(); }, 1500);
}
