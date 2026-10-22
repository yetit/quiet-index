// Карта: светлая подложка OpenFreeMap Positron, поверх — растр индекса canvas-источником по bbox сетки
// (сетка в Web Mercator, поэтому четыре угла ложатся точно; canvas вместо PNG через dataURL — без кодирования
// картинки на главном потоке), маркер выбранной точки.
import { GeolocateControl, Map, NavigationControl, setWorkerUrl, type CanvasSource, type GeoJSONSource } from 'maplibre-gl';
import type { GridMeta } from '../../core/grid.ts';
import { BASE } from '../app.ts';

setWorkerUrl(`${BASE}maplibre/maplibre-gl-worker.mjs`);

// Шкала 0 → 100: тёплый песок → зелень. 255 — прозрачно.
const STOPS: [number, string][] = [[0, '#e7bfa6'], [30, '#ead9b4'], [55, '#cadcb0'], [80, '#8cc4a4'], [100, '#2f8a72']];
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const LUT = new Uint8Array(101 * 3);
for (let v = 0; v <= 100; v++) {
  const j = STOPS.findIndex(([s]) => s >= v), [a, ca] = STOPS[Math.max(0, j - 1)], [b, cb] = STOPS[j];
  const f = b === a ? 0 : (v - a) / (b - a);
  hex(ca).forEach((x, k) => (LUT[v * 3 + k] = Math.round(x + (hex(cb)[k] - x) * f)));
}
export const cssGradient = () => `linear-gradient(90deg, ${STOPS.map(([s, c]) => `${c} ${s}%`).join(', ')})`;

export let map: Map;
let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, img: ImageData;
let ready = false, pending: Uint8Array | null = null;

export function initMap(g: GridMeta, bounds: [number, number, number, number]) {
  map = new Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/positron',
    bounds: [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
    // На телефоне низ карты закрыт свёрнутым листом (--sheet-peek).
    fitBoundsOptions: { padding: { top: 24, left: 24, right: 24, bottom: innerWidth <= 720 ? 192 : 24 } },
    attributionControl: { compact: true },
    canvasContextAttributes: { preserveDrawingBuffer: import.meta.env.DEV },
  });
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  canvas = document.createElement('canvas');
  canvas.width = g.cols; canvas.height = g.rows;
  ctx = canvas.getContext('2d')!;
  img = ctx.createImageData(g.cols, g.rows);
  const { west, south, east, north } = g.bbox;
  map.on('load', () => {
    map.addSource('index', { type: 'canvas', canvas, animate: false, coordinates: [[west, north], [east, north], [east, south], [west, south]] });
    const labels = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
    map.addLayer({ id: 'index', type: 'raster', source: 'index', paint: { 'raster-opacity': 0.68, 'raster-fade-duration': 0 } }, labels);
    map.addSource('pin', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    // B (текущая точка) — тёмная, A (закреплённая для сравнения) — зелёная.
    map.addLayer({ id: 'pin', type: 'circle', source: 'pin', paint: { 'circle-radius': 7, 'circle-color': ['match', ['get', 'kind'], 'a', '#2f8a72', '#1f2421'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });
    ready = true;
    if (pending) paint(pending);
    map.once('idle', () => performance.mark('qi:painted'));
  });
  map.getCanvas().style.cursor = 'crosshair';
  if (import.meta.env.DEV) (window as unknown as { map: Map }).map = map; // для отладки в консоли
  return map;
}

// values: 0–100 на клетку, 255 — прозрачно.
export function paint(values: Uint8Array) {
  if (!ready) { pending = values; return; }
  const d = img.data;
  for (let i = 0, j = 0; i < values.length; i++, j += 4) {
    const v = values[i];
    if (v > 100) { d[j + 3] = 0; continue; }
    d[j] = LUT[v * 3]; d[j + 1] = LUT[v * 3 + 1]; d[j + 2] = LUT[v * 3 + 2]; d[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // animate: false читает canvas один раз; после перерисовки просим прочитать заново на ближайшем кадре.
  const src = map.getSource('index') as CanvasSource;
  src.play();
  map.once('render', () => src.pause());
}

// «Где я»: стандартный контрол MapLibre (точка пользователя на карте); возвращает функцию-триггер для кнопки в панели.
export function addGeolocate(onPos: (p: [number, number]) => void, onError: () => void) {
  const geo = new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 12 } });
  map.addControl(geo, 'bottom-right');
  geo.on('geolocate', (e) => onPos([e.coords.longitude, e.coords.latitude]));
  geo.on('error', onError);
  return () => geo.trigger();
}

export function setPin(pts: { p: [number, number]; kind: string }[]) {
  (map.getSource('pin') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pts.map(({ p, kind }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { kind } })) });
}
