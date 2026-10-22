// Офлайн-режим: service worker (public/sw.js) кэширует оболочку, сетку и подложку. Всё, что страница уже
// загрузила до того, как воркер взял её под контроль, докладываем в кэш сами — иначе первый визит
// не делает карту офлайновой. Пометка «офлайн» — по navigator.onLine.
import { BASE } from './app.ts';

export const CACHE = `qi-app-${__BUILD__}`; // то же имя, что в sw.js.ts
export const TILES_CACHE = 'qi-tiles';

export function initPwa() {
  const upd = () => document.body.classList.toggle('offline', !navigator.onLine);
  addEventListener('online', upd);
  addEventListener('offline', upd);
  upd();
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${BASE}sw.js`).then(async () => {
    await navigator.serviceWorker.ready;
    const urls = new Set(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.startsWith(location.origin) || n.includes('tiles.openfreemap.org')));
    const [app, tiles] = await Promise.all([caches.open(CACHE), caches.open(TILES_CACHE)]);
    await Promise.allSettled([...urls].map((u) => (u.includes('tiles.openfreemap.org') ? tiles : app).add(u)));
    performance.mark('qi:cached');
  }).catch(() => {});
}
