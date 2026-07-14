// Nome fisso: non serve bumpare nulla a mano. Il browser rileva da solo
// (byte per byte) quando sw.js cambia, e le strategie qui sotto (network-first /
// stale-while-revalidate) tengono aggiornati i contenuti in cache automaticamente.
const CACHE_NAME = 'youtubette-cache';

const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Domini che NON vanno mai serviti dalla cache (API dinamiche)
const NEVER_CACHE_HOSTS = [
  'googleapis.com',
  'youtube.com',
  'ytimg.com',
  'ggpht.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 'reload' forza il bypass della cache HTTP del browser durante il precache
      return Promise.all(
        ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Solo richieste GET possono essere gestite dalla cache
  if (req.method !== 'GET') return;

  // Mai intercettare le chiamate verso YouTube/Google API: sempre rete diretta,
  // niente cache, per evitare risultati di ricerca "vecchi".
  if (NEVER_CACHE_HOSTS.some((host) => url.hostname.includes(host))) {
    e.respondWith(fetch(req));
    return;
  }

  // Navigazioni (apertura app / index.html): network-first.
  // Così l'utente vede sempre l'ultima versione quando è online,
  // e ha comunque un fallback offline dalla cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  // Altri asset statici propri (manifest, ecc.): stale-while-revalidate,
  // risponde subito dalla cache ma aggiorna in background.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Tutto il resto (risorse esterne generiche): passa dritto alla rete.
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
