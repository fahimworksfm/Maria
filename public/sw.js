// Tether service worker.
// Caching rules kept deliberately conservative so an installed (standalone) PWA
// never breaks: we NEVER serve a redirected response for a navigation (that
// throws ERR_FAILED in standalone webviews), and we don't precache auth-gated
// HTML like "/". Only GET is touched — POST (server actions, writes) always
// hits the network.

const CACHE = "tether-v5";
// Static, non-redirecting assets only. NOT "/", which redirects when signed in.
const SHELL = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Navigations: network-first. Recreate redirected responses to clear the
// `redirected` flag (otherwise standalone PWA navigations fail). Fall back to a
// cached copy only if it isn't itself a redirect.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.redirected) {
      const body = await res.blob();
      return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
    }
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached && !cached.redirected) return cached;
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"font-family:system-ui;background:#0b0b10;color:#e9e9f0;display:grid;place-items:center;height:100vh;margin:0\"><p>You're offline. Reconnect and try again.</p></body>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
    );
  }
}

// Static assets: stale-while-revalidate (assets never redirect).
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok && res.type === "basic" && !res.redirected) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch writes / server actions
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // third-party: passthrough
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return; // dynamic: network

  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(req));
    return;
  }
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
