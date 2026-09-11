// PERSEA OS — minimal, conservative service worker.
//
// Purpose: PWA installability polish only (a working service worker makes
// Chrome/Android's install prompt more reliable, and gives standalone mode
// a slightly more "app-like" launch feel). This is NOT an offline-first app
// and does not try to become one — PERSEA is a live, data-driven tool; a
// stale/offline copy of an agenda or a payment screen is actively wrong,
// not a convenience. Everything below is deliberately conservative:
//
//  - Never intercepts anything cross-origin (Supabase API calls, Edge
//    Functions, Google/SumUp/Autentique/Hubla requests, font CDN, Tailwind
//    CDN) — those already bypass this worker entirely (see the origin
//    check in fetch below) and are never cached.
//  - Application HTML (navigation requests) is always network-first: the
//    network response is what the browser gets whenever it's reachable at
//    all. Only a genuine network failure (offline) falls back to a cached
//    copy, and only if one happens to exist — never a stale-serves-first
//    strategy that could show yesterday's app shell over a fresh one.
//  - Same-origin CSS/JS is also network-first — the exact thing this pass
//    was asked to avoid ("do NOT make old JS/CSS remain stuck after
//    deployments") rules out caching those any more aggressively than that.
//  - Only genuinely immutable same-origin assets (icons, manifest.json) use
//    cache-first, since those rarely change and a cache hit there costs
//    nothing in correctness.
//  - CACHE_VERSION is the entire update mechanism: bump it on any real
//    change to what should be cached, and activate() deletes every
//    previous version's cache outright. skipWaiting()+clients.claim() make
//    a new worker take over immediately rather than waiting for every tab
//    to close first — combined with network-first everywhere else, this
//    means there is no realistic path to a stuck old JS/CSS bundle.

const CACHE_VERSION = 'persea-static-v1';
const IMMUTABLE_CACHE = `${CACHE_VERSION}-immutable`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`; // offline-fallback only, never served stale-first

// Safe to cache-first: rarely-changing static assets referenced by the
// manifest and every page's <head>. Deliberately does NOT include any
// page HTML, app JS, or app CSS.
const IMMUTABLE_URLS = [
  '/manifest.json',
  '/shared/assets/icons/icon-192.png',
  '/shared/assets/icons/icon-512.png',
  '/shared/assets/icons/icon-192-maskable.png',
  '/shared/assets/icons/icon-512-maskable.png',
  '/shared/assets/icons/apple-touch-icon.png',
  '/shared/assets/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(IMMUTABLE_CACHE)
      .then((cache) => cache.addAll(IMMUTABLE_URLS))
      .catch(() => {}) // never block install on a caching failure
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== IMMUTABLE_CACHE && n !== RUNTIME_CACHE).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Anything that should never be touched by this worker at all — Supabase
// (auth, database REST, Edge Functions, storage) and any cross-origin
// request (Google APIs, SumUp, Autentique, Hubla, font/CDN hosts). Not
// calling event.respondWith() lets the browser handle these exactly as if
// no service worker were installed.
function isNeverCache(url) {
  if (url.origin !== self.location.origin) return true;
  if (url.hostname.endsWith('supabase.co')) return true;
  if (url.pathname.startsWith('/functions/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept POST/PUT/etc — payments, invites, webhooks, auth actions
  const url = new URL(req.url);
  if (isNeverCache(url)) return;

  // Immutable static assets: cache-first, network fallback (and quietly
  // refreshes the cache entry in the background so a future icon/manifest
  // change still eventually lands, without ever blocking on that refresh).
  if (IMMUTABLE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.open(IMMUTABLE_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Everything else same-origin (HTML navigations, app JS/CSS, images) —
  // network-first, never served stale-first. A cache is kept purely as an
  // offline fallback, not as a performance layer, so a fresh deploy is
  // visible on the very next successful load.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error()))
  );
});
