/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — service-worker.js
   PWA Service Worker für Offline-Support und Caching

   v1.5.2: App-Shell (HTML/JS/CSS) jetzt „network-first":
   online kommt immer die aktuelle Version vom Server, der Cache
   dient nur noch als Offline-Fallback. Nach einem Update muss der
   Service-Worker-Cache nicht mehr manuell geleert werden.
   ═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'music-shuffle-v1.6.4';
const STATIC_ASSETS = [
  '/music-shuffle/',
  '/music-shuffle/index.html',
  '/music-shuffle/style.css',
  '/music-shuffle/sideforge-tokens.css',
  '/music-shuffle/js/core.js',
  '/music-shuffle/js/sync.js',
  '/music-shuffle/js/player.js',
  '/music-shuffle/js/shuffle.js',
  '/music-shuffle/js/lists.js',
  '/music-shuffle/js/ui.js',
  '/music-shuffle/js/changelog.js',
  '/music-shuffle/app.js',
  '/music-shuffle/i18n.js',
  '/music-shuffle/spotify-api.js',
  '/music-shuffle/manifest.json',
  '/music-shuffle/favicon.svg',
  '/music-shuffle/favicon.ico',
  '/music-shuffle/icons/icon-192.png',
  '/music-shuffle/icons/icon-512.png',
  '/music-shuffle/icons/apple-touch-icon.png',
];

// ── INSTALL ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── HELPERS ───────────────────────────────────────────────
function putInCache(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
  }
  return response;
}

// Netzwerk zuerst, bei Fehler (offline) aus dem Cache
// (Navigations-Requests dürfen nicht mit Init-Optionen neu gebaut werden → TypeError;
//  für alles andere „no-cache", damit auch der HTTP-Cache des Browsers revalidiert.)
function networkFirst(request, fallbackUrl) {
  const net = request.mode === 'navigate' ? fetch(request) : fetch(request.url, { cache: 'no-cache' });
  return net
    .then(response => putInCache(fallbackUrl || request, response))
    .catch(() => caches.match(fallbackUrl || request).then(cached => cached || Response.error()));
}

// Cache zuerst (für Bilder/Icons — ändern sich praktisch nie)
function cacheFirst(request) {
  return caches.match(request).then(cached => cached || fetch(request).then(r => putInCache(request, r)));
}

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nur eigene Dateien — Spotify, SDK (scdn.co) und Sync-Server nie anfassen
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Seitenaufruf (inkl. Login-Callback ?code=…): immer aktuelle index.html
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, '/music-shuffle/index.html'));
    return;
  }

  // App-Code + Styles + Config: network-first
  if (/\.(js|css|json)$/.test(url.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Bilder/Icons: cache-first
  if (/\.(png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  }
});
