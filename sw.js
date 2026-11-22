// Service worker del Turnario Turno A.
// Strategia: NETWORK-FIRST su tutto. Quando c'e' rete usa sempre la versione
// online (bypass totale della cache); la cache serve solo da fallback offline.
// A ogni modifica importante: aggiornare CACHE qui sotto e la APP_VERSION in js/config.js.
const CACHE = "turnario-ta-v1.4.2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request, { cache: "no-store" });
      if (res && res.ok && new URL(e.request.url).origin === location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(e.request, res.clone());
      }
      return res;
    } catch {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      const fallback = await caches.match("./index.html");
      if (fallback) return fallback;
      return new Response("Offline e nessuna copia in cache.", { status: 503 });
    }
  })());
});
