// Longe & Perto — service worker.
// Página (navegação): rede primeiro, cache só sem internet — assim uma versão nova aparece ao recarregar.
// Demais arquivos do site: stale-while-revalidate. Os links do index.html levam ?v=N, então versão nova = URL nova.
// Nada fora deste site (Supabase, CDN do supabase-js, fontes) passa pelo cache.
const CACHE = "lp-v3-1";
const ARQUIVOS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "conquistas.js",
  "config.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n.startsWith("lp-") && n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Supabase, CDN, fontes: direto na rede

  if (req.mode === "navigate") {
    ev.respondWith(
      fetch(req)
        .then(res => { const copia = res.clone(); caches.open(CACHE).then(c => c.put("./", copia)); return res; })
        .catch(() => caches.match("./", { ignoreSearch: true }))
    );
    return;
  }

  ev.respondWith(
    caches.open(CACHE).then(async c => {
      const guardado = await c.match(req);
      const rede = fetch(req)
        .then(res => { if (res.ok) c.put(req, res.clone()); return res; })
        .catch(() => guardado);
      return guardado || rede;
    })
  );
});
