// Hamdard Welfare Society — offline service worker
// Bump VERSION whenever you change any file, so phones pick up the update.
const VERSION = 'hamdard-v1';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './maskable-512.png', './apple-touch-icon.png'
];
// Third-party files the app uses (PDF export + Urdu font). Cached on first online visit.
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&family=Poppins:wght@400;600&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    // best effort: a failure here (offline install) must not break installation
    await Promise.all(CDN.map(u => fetch(u).then(r => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never intercept WhatsApp / SMS style links
  if (!/^https?:$/.test(url.protocol) || url.hostname === 'wa.me') return;

  // Page navigations: cached app shell first (instant + offline), refreshed in background
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const cached = await c.match('./index.html');
      const net = fetch(req).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => null);
      return cached || (await net) || Response.error();
    })());
    return;
  }

  // Everything else: cache first, fall back to network, and remember what we fetched
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    } catch (err) {
      return hit || Response.error();
    }
  })());
});
