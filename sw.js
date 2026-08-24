const CACHE_PREFIX = 'ndr-offline-core-';
const CACHE_NAME = `${CACHE_PREFIX}v20260824-growth1`;

const CORE_PATHS = Object.freeze([
  '/',
  '/index.html',
  '/styles.css',
  '/themes.css',
  '/account.css',
  '/mobile.css',
  '/community.css',
  '/custom.css',
  '/shortcut-toolbar.css',
  '/favicon.svg',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/site.webmanifest',
  '/js/app.js',
  '/vendor/dice-box-1.1.4/dice-box.es.min.js',
  '/vendor/dice-box-1.1.4/Dice.min.js',
  '/vendor/dice-box-1.1.4/world.none.min.js',
  '/vendor/dice-box-1.1.4/world.offscreen.min.js',
  '/vendor/dice-box-1.1.4/world.onscreen.min.js',
  '/vendor/dice-box-1.1.4/assets/ammo/ammo.wasm.wasm',
  '/vendor/dice-box-1.1.4/assets/themes/default/default.json',
  '/vendor/dice-box-1.1.4/assets/themes/default/theme.config.json',
  '/vendor/dice-box-1.1.4/assets/themes/default/diffuse-dark.png',
  '/vendor/dice-box-1.1.4/assets/themes/default/diffuse-light.png',
  '/vendor/dice-box-1.1.4/assets/themes/default/normal.png',
  '/vendor/dice-box-1.1.4/assets/themes/default/specular.jpg',
]);
const CORE_SET = new Set(CORE_PATHS);
const NETWORK_ONLY_PREFIXES = Object.freeze(['/api/', '/.netlify/']);

function isNetworkOnly(pathname) {
  return NETWORK_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function cachedCore(request, pathname) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(pathname);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(pathname, response.clone());
  return response;
}

async function rootNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/', response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match('/') || await cache.match('/index.html');
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_PATHS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNetworkOnly(url.pathname)) return;

  if (request.mode === 'navigate') {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      event.respondWith(rootNavigation(request));
    }
    return;
  }

  if (CORE_SET.has(url.pathname)) {
    event.respondWith(cachedCore(request, url.pathname));
  }
});
