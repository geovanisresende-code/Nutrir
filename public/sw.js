// Service Worker simples — cache "stale-while-revalidate" para o shell e fallback offline.
const CACHE = "nutrir-shell-v3";
const SHELL = ["/", "/app", "/manifest.webmanifest", "/icon-512.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => null));
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
  // Só cacheia GET no mesmo origin (evita interferir em chamadas Supabase).
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Não cacheia rotas dinâmicas/assets de build (Vite faz versionamento próprio).
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((resp) => {
          if (resp.ok) cache.put(req, resp.clone());
          return resp;
        })
        .catch(() => cached || cache.match("/app") || cache.match("/"));
      return cached || network;
    }),
  );
});
