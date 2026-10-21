import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/global.css';
import { cellOf } from '../core/grid.ts';
import { index, indexAll, scores, type Scores } from '../core/index.ts';
import { rawAt } from '../core/layers.ts';
import { $, BASE, region, state, syncUrl } from './app.ts';
import { loadData, type Data } from './data.ts';
import { lang, t, translate } from './i18n.ts';
import { initMap, map, paint, setPin } from './map/map.ts';
import { initPanel, showCell, showEmpty, showOutside, updateIndex } from './ui/panel.ts';
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

const repaint = () => {
  if (state.view === 'index') indexAll(data.scores, data.grid.planes.mask, state.weights, values);
  else { const s = data.scores[state.view], m = data.grid.planes.mask; for (let i = 0; i < values.length; i++) values[i] = m[i] ? s[i] : 255; }
  paint(values);
};

function select(p: [number, number], fly = false) {
  state.point = p;
  setPin(p);
  const c = cellOf(data.meta, p[0], p[1]);
  const i = c ? c.row * data.meta.cols + c.col : -1;
  if (i < 0 || !data.grid.planes.mask[i]) { cur = null; showOutside(); }
  else { cur = { i, s: scores(rawAt(data.grid, i)) }; showCell(p, rawAt(data.grid, i), cur.s, index(cur.s, state.weights)); }
  if (fly) map.flyTo({ center: p, zoom: Math.max(map.getZoom(), 11), duration: 900 });
  setSheet(false);
  syncUrl();
}

initPanel({
  weights: () => { repaint(); if (cur) updateIndex(index(cur.s, state.weights)); syncUrl(); },
  view: () => { repaint(); syncUrl(); },
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
map.on('load', () => { if (state.point) select(state.point); else showEmpty(); });
initSearch((p) => select(p, true));
$('.copy-link').addEventListener('click', async () => {
  await navigator.clipboard?.writeText(location.href);
  $('.copy-link').textContent = t.copied;
  setTimeout(() => ($('.copy-link').textContent = t.copyLink), 1500);
});
