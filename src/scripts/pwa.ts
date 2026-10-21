// Офлайн-режим: service worker (public/sw.js) кэширует оболочку, сетку и подложку. Всё, что страница уже
// загрузила до того, как воркер взял её под контроль, докладываем в кэш сами — иначе первый визит
// не делает карту офлайновой. Пометка «офлайн» — по navigator.onLine.
import { BASE } from './app.ts';

export const CACHE = 'qi-v1'; // то же имя, что в sw.js

export function initPwa() {
  const upd = () => document.body.classList.toggle('offline', !navigator.onLine);
  addEventListener('online', upd);
  addEventListener('offline', upd);
  upd();
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${BASE}sw.js`).then(async () => {
    await navigator.serviceWorker.ready;
    const urls = new Set(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.startsWith(location.origin) || n.includes('tiles.openfreemap.org')));
    const c = await caches.open(CACHE);
    await Promise.allSettled([...urls].map((u) => c.add(u)));
    performance.mark('qi:cached');
  }).catch(() => {});
}
