// Service worker офлайн-режима. Генерируется при сборке: имя кэша приложения содержит идентификатор сборки,
// при активации новой версии старые кэши приложения удаляются; кэш тайлов подложки живёт между версиями.
import type { APIRoute } from 'astro';

const sw = `
// Навигация — сеть, при отказе оболочка из кэша; data/* — из кэша с обновлением в фоне (версия данных — в query);
// остальное своё и тайлы/стиль/шрифты OpenFreeMap — из кэша, иначе из сети с сохранением. Тайлов храним не больше ~2000.
const APP = 'qi-app-${__BUILD__}';
const TILES_CACHE = 'qi-tiles';
const SHELL = self.registration.scope;
const TILES = 'tiles.openfreemap.org';
const cacheFor = (url) => (new URL(url).hostname === TILES ? TILES_CACHE : APP);

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(APP).then((c) => c.add(SHELL)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== TILES_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function put(req, res) {
  const c = await caches.open(cacheFor(typeof req === 'string' ? req : req.url));
  await c.put(req, res);
  if (c === (await caches.open(TILES_CACHE)) && Math.random() < 0.02) {
    const tiles = (await c.keys()).filter((k) => k.url.includes('/planet/'));
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
`;

export const GET: APIRoute = () => new Response(sw, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } });
