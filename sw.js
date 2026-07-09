const CACHE_NAME = 'ipcalc-pwa-v4';
const OUI_DB_PATH = '/ipcalc/oui-db.json';

const PRECACHE_URLS = [
  './',
  './index.html',
  './oui-db.json',
  './manifest.json',
  './icon.svg',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

async function fetchOuiDbNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const networkRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
    mode: request.mode,
    credentials: request.credentials,
    redirect: request.redirect,
    cache: 'reload'
  });

  try {
    const response = await fetch(networkRequest);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    return cache.match('./oui-db.json');
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname === OUI_DB_PATH || requestUrl.pathname.endsWith('/oui-db.json')) {
    event.respondWith(fetchOuiDbNetworkFirst(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('./index.html');
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        });
      })
  );
});
