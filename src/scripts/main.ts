import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/global.css';
import { GeolocateControl } from 'maplibre-gl';
import { cellOf } from '../core/grid.ts';
import { index, indexAll, scores, type Scores } from '../core/index.ts';
import { rawAt } from '../core/layers.ts';
import { topSpots } from '../core/spots.ts';
import { $, BASE, region, state, syncUrl } from './app.ts';
import { loadData, type Data } from './data.ts';
import { lang, t, translate } from './i18n.ts';
import { initMap, map, paint, setPin } from './map/map.ts';
import { initPwa } from './pwa.ts';
import { initPanel, showCell, showCompare, showEmpty, showOutside, showSpots, updateIndex, type Cell } from './ui/panel.ts';
import { initSearch } from './ui/search.ts';
import { initSheet, setSheet } from './ui/sheet.ts';

translate();
$('.region-name').textContent = region.name[lang];
$<HTMLAnchorElement>('.lang').href = `?${new URLSearchParams({ ...Object.fromEntries(new URL(location.href).searchParams), lang: lang === 'ru' ? 'en' : 'ru' })}`;
$('.lang').textContent = lang === 'ru' ? 'EN' : 'RU';
initSheet();

let data: Data;
let values: Uint8Array;
let cur: { i: number; s: Scores } | null = null;
let cmpA: Cell | null = null; // закреплённая точка A для сравнения

// Оценки клетки по координатам; null — вне маски.
const cellAt = (p: [number, number]) => { const c = cellOf(data.meta, p[0], p[1]); const i = c ? c.row * data.meta.cols + c.col : -1; return i >= 0 && data.grid.planes.mask[i] ? { i, s: scores(rawAt(data.grid, i)) } : null; };
const pins = () => setPin([...(state.point ? [{ p: state.point, kind: 'b' }] : []), ...(state.compare ? [{ p: state.compare, kind: 'a' }] : [])]);
const renderSpots = () => { if (state.point) showSpots(topSpots(values, data.meta, state.point, state.spotsRadius), (s) => select(s.p, true)); };
const renderCompare = () => showCompare(cmpA, cur && state.point && state.compare && (state.point[0] !== state.compare[0] || state.point[1] !== state.compare[1]) ? { s: cur.s, idx: index(cur.s, state.weights) } : null);

const repaint = () => {
  if (state.view === 'index') indexAll(data.scores, data.grid.planes.mask, state.weights, values);
  else { const s = data.scores[state.view], m = data.grid.planes.mask; for (let i = 0; i < values.length; i++) values[i] = m[i] ? s[i] : 255; }
  paint(values);
};

function select(p: [number, number], fly = false) {
  state.point = p;
  pins();
  cur = cellAt(p);
  if (!cur) showOutside();
  else { showCell(p, rawAt(data.grid, cur.i), cur.s, index(cur.s, state.weights)); renderSpots(); renderCompare(); }
  if (fly) map.flyTo({ center: p, zoom: Math.max(map.getZoom(), 11), duration: 900 });
  setSheet(false);
  syncUrl();
}

initPanel({
  weights: () => { repaint(); if (cur) updateIndex(index(cur.s, state.weights)); if (cmpA) cmpA.idx = index(cmpA.s, state.weights); renderSpots(); renderCompare(); syncUrl(); },
  view: () => { repaint(); renderSpots(); syncUrl(); },
  pick: (p) => select(p, true),
  radius: renderSpots,
});

try {
  data = await loadData(BASE, region.id);
} catch (e) {
  $('.loading').textContent = t.loadError;
  console.error(e);
  throw e;
}
values = new Uint8Array(data.meta.cols * data.meta.rows);
$('.loading').hidden = true;
$('.built').textContent = `${data.meta.built} · ${data.meta.cells.toLocaleString(lang)} × ${data.meta.cell} m`;
const b = data.meta.bbox;
initMap(data.meta, [b.west, b.south, b.east, b.north]);
repaint();
map.on('click', (e) => select([e.lngLat.lng, e.lngLat.lat]));
// «Где я»: стандартный контрол MapLibre (точка пользователя на карте) и кнопка в панели, которая его дёргает.
const geo = new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 12 } });
map.addControl(geo, 'bottom-right');
geo.on('geolocate', (e) => { $('.geo-error').hidden = true; select([e.coords.longitude, e.coords.latitude], true); });
geo.on('error', () => ($('.geo-error').hidden = false));
$('.locate').addEventListener('click', () => geo.trigger());
map.once('idle', initPwa);
map.on('load', () => {
  if (state.compare) { const a = cellAt(state.compare); cmpA = a && { s: a.s, idx: index(a.s, state.weights) }; if (!cmpA) state.compare = null; }
  if (state.point) select(state.point); else { showEmpty(); pins(); }
});
$('.compare-btn').addEventListener('click', () => { if (!cur || !state.point) return; state.compare = state.point; cmpA = { s: cur.s, idx: index(cur.s, state.weights) }; pins(); renderCompare(); syncUrl(); });
$('.compare-clear').addEventListener('click', () => { state.compare = null; cmpA = null; pins(); renderCompare(); syncUrl(); });
initSearch((p) => select(p, true));
$('.copy-link').addEventListener('click', async () => {
  await navigator.clipboard?.writeText(location.href);
  $('.copy-link').textContent = t.copied;
  setTimeout(() => ($('.copy-link').textContent = t.copyLink), 1500);
});
