const CACHE = 'medicare-static-v1';
const SHELL = [
  '/offline.html',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

function isLocalDev(url) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
}

function isPrivate(request, url) {
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith('/api')) return true;
  if (request.headers.has('authorization')) return true;
  return false;
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/images/')
    || /\.(?:js|css|svg|png|jpe?g|webp|woff2?)$/.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isPrivate(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.match('/offline.html');
      return cached || Response.error();
    }));
    return;
  }

  if (isLocalDev(url) || !isStaticAsset(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => cached || Response.error());
    return cached || network;
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = String(data.title || 'HopeCare').slice(0, 80);
  const body = String(data.body || 'Ouvrez HopeCare pour voir le détail.').slice(0, 140);
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/dashboard';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((window) => window.url.includes(self.location.origin));
    if (existing) {
      existing.focus();
      if ('navigate' in existing) return existing.navigate(target);
      return existing;
    }
    return self.clients.openWindow(target);
  }));
});
