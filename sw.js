const CACHE_NAME = 'ipcalc-pwa-v7';
const OUI_DB_PATH = '/ipcalc/oui-db.json';
const THEME_STYLESHEET = './theme-overrides.css';
const RANGE_STYLESHEET = './range-controls.css';
const UI_ENHANCEMENTS = './ui-enhancements.js';
const RANGE_CONTROLS = './range-controls.js';

const PRECACHE_URLS = [
  './',
  './index.html',
  './oui-db.json',
  './manifest.json',
  './icon.svg',
  './icon-192.svg',
  './icon-512.svg',
  THEME_STYLESHEET,
  RANGE_STYLESHEET,
  UI_ENHANCEMENTS,
  RANGE_CONTROLS
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
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    return cache.match('./oui-db.json');
  }
}

async function withUnifiedTheme(response) {
  if (!response || !response.ok) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const tags = [
    ['theme-overrides.css', '<link rel="stylesheet" href="./theme-overrides.css">', '</head>'],
    ['range-controls.css', '<link rel="stylesheet" href="./range-controls.css">', '</head>'],
    ['ui-enhancements.js', '<script src="./ui-enhancements.js" defer></script>', '</body>'],
    ['range-controls.js', '<script src="./range-controls.js" defer></script>', '</body>']
  ];

  tags.forEach(([needle, tag, closingTag]) => {
    if (html.includes(needle)) return;
    html = html.includes(closingTag)
      ? html.replace(closingTag, `  ${tag}\n${closingTag}`)
      : `${html}\n${tag}`;
  });

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function fetchDocumentNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    const themedResponse = await withUnifiedTheme(networkResponse);
    if (themedResponse && themedResponse.ok) await cache.put(request, themedResponse.clone());
    return themedResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    const fallback = await cache.match('./index.html');
    return withUnifiedTheme(fallback);
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

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(fetchDocumentNetworkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      });
    })
  );
});
