// Service Worker — network-first para HTML, cache-first para assets imutáveis.
// Bumpe CACHE_VERSION a cada deploy para forçar invalidação nos clientes.
const CACHE_VERSION = "v2";
const CACHE = `nutrir-shell-${CACHE_VERSION}`;

// Assets de build do Vite têm hash no nome — são imutáveis, ok cachear para sempre.
const isImmutableAsset = (url) =>
  url.pathname.startsWith("/assets/") && /\.[a-f0-9]{8,}\.(js|css)/.test(url.pathname);

self.addEventListener("install", (event) => {
  // Pré-cacheia só o manifest (não o HTML — usamos network-first para ele).
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/manifest.webmanifest"]).catch(() => null)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Apaga TODOS os caches de versões anteriores.
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

  // Assets imutáveis do Vite → cache-first (nunca mudam, URL muda a cada build).
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const resp = await fetch(req);
        if (resp.ok) cache.put(req, resp.clone());
        return resp;
      }),
    );
    return;
  }

  // HTML e rotas do app → network-first para sempre pegar a versão mais recente.
  // Fallback para cache apenas se offline.
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok) {
          caches.open(CACHE).then((c) => c.put(req, resp.clone()));
        }
        return resp;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(req)) || (await cache.match("/app")) || cache.match("/");
      }),
  );
});
