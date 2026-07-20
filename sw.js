// Nome fisso: NON serve più cambiarlo ad ogni release. La freschezza dei
// contenuti è garantita dal 'cache: no-store' nelle fetch di rete qui sotto
// (bypassano la cache HTTP del browser, non solo la Cache Storage del SW).
// Questa versione va aggiornata SOLO se un giorno modifichi la logica
// di questo file (nuove strategie di cache, nuovi asset precaricati, ecc.) —
// non per i normali aggiornamenti di index.html.
const CACHE_NAME = 'youtubette-cache';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './192x192.png',
  './512x512.png'
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
    }) // Rimosso skipWaiting automatico per permettere l'aggiornamento forzato manuale da pulsante
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
  // cache: 'no-store' forza il bypass della cache HTTP del browser, non solo
  // della Cache Storage del SW: senza questo, la fetch "di rete" può comunque
  // restituire una risposta vecchia presa dal disco del browser invece che dal server.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
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
  // risponde subito dalla cache ma aggiorna in background con richiesta
  // di rete "vera" (no-store), non da cache HTTP del browser.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req, { cache: 'no-store' })
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

// Ascolto del messaggio manuale inviato al click del pulsante per forzare il rimpiazzo
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
