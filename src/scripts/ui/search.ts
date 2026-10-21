// Поиск места (Photon, без ключа) в пределах bbox региона: Photon трактует bbox мягко, ответ фильтруем повторно.
import { $, region } from '../app.ts';
import { lang, t } from '../i18n.ts';

export function initSearch(pick: (lonlat: [number, number]) => void) {
  const input = $<HTMLInputElement>('.search');
  const results = $('.search-results');
  const { west, south, east, north } = region.bbox;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let feats: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] = [];
  const close = () => { results.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (input.value.trim().length < 3) { close(); return; }
    timer = setTimeout(async () => {
      const [lon, lat] = [(west + east) / 2, (south + north) / 2];
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(input.value.trim())}&lat=${lat}&lon=${lon}&bbox=${west},${south},${east},${north}&limit=8&lang=${lang === 'en' ? 'en' : 'default'}`;
      const res = await fetch(url).then((r) => r.json()).catch(() => null);
      feats = (res?.features ?? []).filter((f: typeof feats[number]) => { const [x, y] = f.geometry.coordinates; return x >= west && x <= east && y >= south && y <= north; }).slice(0, 6);
      results.innerHTML = feats.length
        ? feats.map((f, i) => { const p = f.properties; return `<button type="button" role="option" data-i="${i}">${[p.name, p.street, p.housenumber].filter(Boolean).join(' ') || p.city}<small>${[p.city ?? p.county, p.country].filter(Boolean).join(', ')}</small></button>`; }).join('')
        : `<span>${t.nothing}</span>`;
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      results.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); close(); pick(feats[+b.dataset.i!].geometry.coordinates); }));
    }, 350);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && feats[0]) { close(); pick(feats[0].geometry.coordinates); } if (e.key === 'Escape') close(); });
  input.addEventListener('blur', close);
}
