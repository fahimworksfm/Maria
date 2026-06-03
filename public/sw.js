// Tether service worker: stale-while-revalidate app shell + module caching,
// plus Web Push handlers. Only GET is cached — POST (server actions, API
// writes) always hits the network, so online behavior is unchanged.

const CACHE = "tether-v4";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve cache immediately if present, refresh in the
// background. Falls back to the cached shell when offline with no match.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      // Only cache successful, basic (same-origin) responses.
      if (res && res.ok && res.type === "basic") {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    // Kick off revalidation but return the cached copy now.
    network;
    return cached;
  }
  const fresh = await network;
  if (fresh) return fresh;

  // Offline and uncached: for navigations, fall back to the app shell.
  if (request.mode === "navigate") {
    const shell = await cache.match("/");
    if (shell) return shell;
  }
  return new Response("", { status: 504, statusText: "Offline" });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch POST/PUT/DELETE (server actions, writes)

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // third-party: let the network handle it
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return; // dynamic: always network

  event.respondWith(staleWhileRevalidate(req));
});

// --- Web Push ---
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "Tether";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    vibrate: data.vibrate || [120, 60, 120],
    data: { url: data.url || "/pulse" },
    tag: data.tag || "tether-pulse",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) { w.navigate(target); return w.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
