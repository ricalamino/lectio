// Minimal service worker. Caches the app shell so /capture is reachable
// offline; everything else falls through to the network.
const CACHE = "lectio-shell-v1";
const SHELL = ["/", "/capture", "/inbox", "/manifest.webmanifest"];
const SYNC_TAG = "sync-captures";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    caches.match(req).then((cached) => cached ?? fetch(req).catch(() => caches.match("/"))),
  );
});

// Background Sync — when connectivity is restored, notify open clients to
// flush their offline capture queues.
self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length === 0) return; // no open tab — queue will flush on next page load
      for (const client of clients) {
        client.postMessage({ type: "FLUSH_OFFLINE_QUEUE" });
      }
    }),
  );
});
