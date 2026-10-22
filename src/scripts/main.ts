import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/global.css';
import { cellOf } from '../core/grid.ts';
import { index, indexAll, scores, type Scores } from '../core/index.ts';
import { rawAt, type Grid } from '../core/layers.ts';
import { topSpots } from '../core/spots.ts';
import { regions } from '../../regions.config.mjs';
import { $, BASE, region, state, syncUrl } from './app.ts';
import { loadGrid, loadScores, type Data } from './data.ts';
import { lang, t, translate } from './i18n.ts';
import { initPwa } from './pwa.ts';
import { initPanel, showCell, showCompare, showEmpty, showOutside, showSpots, updateIndex, type Cell } from './ui/panel.ts';
import { initSearch } from './ui/search.ts';
import { initSheet, setSheet } from './ui/sheet.ts';

translate();
// Смена региона — перезагрузка с другими данными; остальные параметры ссылки сохраняются.
const sel = $<HTMLSelectElement>('.region');
sel.innerHTML = regions.map((r) => `<option value="${r.id}"${r.id === region.id ? ' selected' : ''}>${r.name[lang]}</option>`).join('');
sel.addEventListener('change', () => { const u = new URL(location.href); u.searchParams.set('r', sel.value); u.searchParams.delete('p'); u.searchParams.delete('a'); location.href = u.href; });
$<HTMLAnchorElement>('.lang').href = `?${new URLSearchParams({ ...Object.fromEntries(new URL(location.href).searchParams), lang: lang === 'ru' ? 'en' : 'ru' })}`;
$('.lang').textContent = lang === 'ru' ? 'EN' : 'RU';
initSheet();

// Карта (MapLibre ~250 КБ gzip) подгружается динамически после того, как панель и подсказка уже на экране.
let M: typeof import('./map/map.ts');
let data: Data;
let grid: Promise<Grid>; // измерения грузятся после первого кадра
let values: Uint8Array;
let cur: { i: number; s: Scores } | null = null;
let cmpA: Cell | null = null; // закреплённая точка A для сравнения

// Оценки клетки по координатам; null — вне маски.
const cellAt = async (p: [number, number]) => { const g = await grid; const c = cellOf(data.meta, p[0], p[1]); const i = c ? c.row * data.meta.cols + c.col : -1; return i >= 0 && data.mask[i] ? { i, s: scores(rawAt(g, i)) } : null; };
const pins = () => M.setPin([...(state.point ? [{ p: state.point, kind: 'b' }] : []), ...(state.compare ? [{ p: state.compare, kind: 'a' }] : [])]);
const renderSpots = () => { if (state.point) showSpots(topSpots(values, data.meta, state.point, state.spotsRadius), (s) => select(s.p, true)); };
const renderCompare = () => showCompare(cmpA, cur && state.point && state.compare && (state.point[0] !== state.compare[0] || state.point[1] !== state.compare[1]) ? { s: cur.s, idx: index(cur.s, state.weights) } : null);

const repaint = () => {
  if (state.view === 'index') indexAll(data.scores, data.mask, state.weights, values);
  else { const s = data.scores[state.view], m = data.mask; for (let i = 0; i < values.length; i++) values[i] = m[i] ? s[i] : 255; }
  M.paint(values);
};

async function select(p: [number, number], fly = false) {
  state.point = p;
  pins();
  if (fly) M.map.flyTo({ center: p, zoom: Math.max(M.map.getZoom(), 11), duration: 900 });
  setSheet(false);
  syncUrl();
  const c = await cellAt(p);
  if (state.point !== p) return; // пока грузились измерения, выбрали другую точку
  cur = c;
  if (!cur) showOutside();
  else { showCell(p, rawAt(await grid, cur.i), cur.s, index(cur.s, state.weights)); renderSpots(); renderCompare(); }
}

initPanel({
  weights: () => { repaint(); if (cur) updateIndex(index(cur.s, state.weights)); if (cmpA) cmpA.idx = index(cmpA.s, state.weights); renderSpots(); renderCompare(); syncUrl(); },
  view: () => { repaint(); renderSpots(); syncUrl(); },
  pick: (p) => select(p, true),
  radius: renderSpots,
});

try {
  data = await loadScores(BASE, region.id);
} catch (e) {
  $('.loading').textContent = t.loadError;
  console.error(e);
  throw e;
}
values = new Uint8Array(data.meta.cols * data.meta.rows);
$('.loading').hidden = true;
$('.built').textContent = `${data.meta.built} · ${data.meta.cells.toLocaleString(lang)} × ${data.meta.cell} m`;
const b = data.meta.bbox;
if (!state.point) showEmpty(); // подсказка — сразу, не дожидаясь карты
// Даём браузеру кадр показать панель до того, как главный поток займёт разбор MapLibre (~1 МБ JS).
// Вкладка без кадров (скрыта, свёрнута, фоновая панель) rAF не даёт — ждём не дольше 100 мс.
await new Promise((r) => { const t = setTimeout(r, 100); requestAnimationFrame(() => { clearTimeout(t); setTimeout(r, 0); }); });
M = await import('./map/map.ts');
M.initMap(data.meta, [b.west, b.south, b.east, b.north]);
repaint();
grid = loadGrid(BASE, region.id, data.meta);
grid.catch((e) => { $('.loading').hidden = false; $('.loading').textContent = t.loadError; console.error(e); });
M.map.on('click', (e) => select([e.lngLat.lng, e.lngLat.lat]));
const locate = M.addGeolocate((p) => { $('.geo-error').hidden = true; select(p, true); }, () => ($('.geo-error').hidden = false));
$('.locate').addEventListener('click', locate);
M.map.once('idle', initPwa);
M.map.on('load', async () => {
  if (state.compare) { const a = await cellAt(state.compare); cmpA = a && { s: a.s, idx: index(a.s, state.weights) }; if (!cmpA) state.compare = null; }
  if (state.point) select(state.point); else pins();
});
$('.compare-btn').addEventListener('click', () => { if (!cur || !state.point) return; state.compare = state.point; cmpA = { s: cur.s, idx: index(cur.s, state.weights) }; pins(); renderCompare(); syncUrl(); });
$('.compare-clear').addEventListener('click', () => { state.compare = null; cmpA = null; pins(); renderCompare(); syncUrl(); });
initSearch((p) => select(p, true));
$('.copy-link').addEventListener('click', async () => {
  await navigator.clipboard?.writeText(location.href);
  $('.copy-link').textContent = t.copied;
  setTimeout(() => ($('.copy-link').textContent = t.copyLink), 1500);
});
