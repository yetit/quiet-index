// Офлайн-режим. Версия кэша в имени: при смене старые кэши удаляются.
// Навигация — сеть, при отказе оболочка из кэша; data/* — из кэша с обновлением в фоне; остальное своё
// и тайлы/стиль/шрифты OpenFreeMap — из кэша, иначе из сети с сохранением. Тайлов храним не больше ~2000.
const CACHE = 'qi-v1';
const SHELL = self.registration.scope;
const TILES = 'tiles.openfreemap.org';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function put(req, res) {
  const c = await caches.open(CACHE);
  await c.put(req, res);
  if (new URL(req.url).hostname === TILES && Math.random() < 0.02) {
    const tiles = (await c.keys()).filter((k) => k.url.includes(`${TILES}/planet/`));
    if (tiles.length > 2000) await Promise.all(tiles.slice(0, 400).map((k) => c.delete(k)));
  }
}

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  const own = u.origin === self.location.origin;
  if (e.request.method !== 'GET' || !(own || u.hostname === TILES)) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) put(SHELL, r.clone()); return r; }).catch(() => caches.match(SHELL, { ignoreVary: true })));
    return;
  }
  const refresh = own && u.pathname.includes('/data/');
  // ignoreVary: сервер отдаёт Vary: Accept-Encoding, а запросы страницы и cache.add различаются заголовками.
  e.respondWith(caches.match(e.request, { ignoreVary: true }).then((hit) => {
    const net = fetch(e.request).then((r) => { if (r.ok) put(e.request, r.clone()); return r; });
    if (hit) { if (refresh) net.catch(() => {}); return hit; }
    return net;
  }));
});
