// Предрасчёт растра региона из сырых выгрузок data/<id>/raw → public/data/<id>/grid.gz + meta.json.
// Расстояния: дороги/точки растрируются на подсетке в 5 раз мельче клетки (~50 м), затем точное EDT и выборка в центрах клеток.
// Плотность и покрытие: суммы по окну ~2×2 км вокруг центра клетки через интегральные таблицы.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fromFile } from 'geotiff';
import { getRegion } from '../regions.config.mjs';
import { centerOf, gridFor, mercLat, mercY, metersPerCell, type GridMeta } from '../src/core/grid.ts';
import { LAYERS, NOISE_RANGE, SCORE_PLANES, scores } from '../src/core/index.ts';
import { PLANES, SCREEN_BITS, encode, packPlanes, rawAt, screenBit, type Plane } from '../src/core/layers.ts';
import { INF, edt } from './edt.mjs';

const region = getRegion(process.argv[2]);
const raw = `data/${region.id}/raw`;
const out = `public/data/${region.id}`;
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const log = (s: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`);

const osm = JSON.parse(readFileSync(`${raw}/osm.json`, 'utf8'));
// Buffer маленького файла — срез общего пула Node: типизированный массив строим по смещению и длине.
const typed = <T>(file: string, C: { new (b: ArrayBuffer, o: number, n: number): T; BYTES_PER_ELEMENT: number }) => { const b = readFileSync(file); return new C(b.buffer, b.byteOffset, b.byteLength / C.BYTES_PER_ELEMENT); };
const bld = typed(`${raw}/buildings.bin`, Float32Array);
const lightMeta = JSON.parse(readFileSync(`${raw}/light.json`, 'utf8'));
const light = typed(`${raw}/light.bin`, Float32Array);
const lcMeta = JSON.parse(readFileSync(`${raw}/landcover.json`, 'utf8'));
const lc = typed(`${raw}/landcover.bin`, Uint8Array);
// Рельеф для линии видимости — если выгружен (fetch-dem.mjs); без него план screen пустой.
const dem = existsSync(`${raw}/dem.bin`) ? { meta: JSON.parse(readFileSync(`${raw}/dem.json`, 'utf8')), z: typed(`${raw}/dem.bin`, Int16Array) } : null;
const elev = (lon: number, lat: number) => { if (!dem) return 0; const x = Math.floor((lon - dem.meta.west) / dem.meta.step), y = Math.floor((dem.meta.north - lat) / dem.meta.step); const v = x >= 0 && x < dem.meta.cols && y >= 0 && y < dem.meta.rows ? dem.z[y * dem.meta.cols + x] : -32768; return v === -32768 ? 0 : v; };

const g: GridMeta = gridFor(region.bbox, region.cell);
const { cols, rows } = g;
const N = cols * rows;
const rad = (d: number) => (d * Math.PI) / 180;
const Y0 = mercY(g.bbox.north);
const planes = Object.fromEntries(PLANES.map((p) => [p, new Uint8Array(N)])) as Record<Plane, Uint8Array>;
log(`сетка ${cols}×${rows} = ${N} клеток, bbox ${JSON.stringify(g.bbox)}`);

// --- Маска: внутри границы региона (чётность пересечений рёбер, порядок way не важен) и не вода по WorldCover.
const edges: number[][] = [];
for (const way of osm.boundary) for (let i = 1; i < way.length; i++) edges.push([way[i - 1][0], way[i - 1][1], way[i][0], way[i][1]]);
const lcAt = (lon: number, lat: number) => { const x = Math.floor((lon - lcMeta.west) / lcMeta.res), y = Math.floor((lcMeta.north - lat) / lcMeta.res); return x >= 0 && x < lcMeta.w && y >= 0 && y < lcMeta.h ? lc[y * lcMeta.w + x] : 0; };
let inside = 0;
for (let r = 0; r < rows; r++) {
  const lat = centerOf(g, 0, r)[1];
  const xs: number[] = [];
  for (const [x1, y1, x2, y2] of edges) if (y1 <= lat !== y2 <= lat) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
  xs.sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const c0 = Math.max(0, Math.ceil((xs[i] - g.bbox.west) / g.dLon - 0.5)), c1 = Math.min(cols - 1, Math.floor((xs[i + 1] - g.bbox.west) / g.dLon - 0.5));
    for (let c = c0; c <= c1; c++) { const k = lcAt(...centerOf(g, c, r)); if (k !== 0 && k !== 80) { planes.mask[r * cols + c] = 1; inside++; } }
  }
}
log(`маска: ${inside} клеток суши внутри границы`);

// --- Расстояния: подсетка F×, EDT, выборка в центре клетки. Метры — по размеру клетки на строке.
const F = 5, W = cols * F, H = rows * F;
const field = new Float32Array(W * H);
const srcIdx = new Int32Array(W * H);
// Линия видимости между центром клетки (1,5 м над землёй) и точкой источника (0,5 м): рельеф по DEM с шагом ~90 м.
function blocked(a: [number, number], b: [number, number], distM: number) {
  const n = Math.min(60, Math.ceil(distM / 90));
  if (n < 2) return false;
  const za = elev(a[0], a[1]) + 1.5, zb = elev(b[0], b[1]) + 0.5;
  for (let k = 1; k < n; k++) { const f = k / n; if (elev(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f) > za + (zb - za) * f + 1) return true; }
  return false;
}
const subCenter = (si: number): [number, number] => { const sy = Math.floor(si / W), sx = si % W; return [g.bbox.west + ((sx + 0.5) / F) * g.dLon, mercLat(Y0 - ((sy + 0.5) / F) * rad(g.dLon))]; };
let screened = 0;
const sx = (lon: number) => ((lon - g.bbox.west) / g.dLon) * F;
const sy = (lat: number) => ((Y0 - mercY(lat)) / rad(g.dLon)) * F;
const mark = (x: number, y: number) => { if (x >= 0 && x < W && y >= 0 && y < H) { const i = (y | 0) * W + (x | 0); field[i] = 0; srcIdx[i] = i; } };
function distancePlane(p: Plane, lines: number[][][], pts: ArrayLike<number>) {
  field.fill(INF);
  srcIdx.fill(-1);
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const [x1, y1, x2, y2] = [sx(l[i - 1][0]), sy(l[i - 1][1]), sx(l[i][0]), sy(l[i][1])];
    const n = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2) || 1;
    for (let k = 0; k <= n; k++) mark(x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n);
  }
  for (let i = 0; i < pts.length; i += 2) mark(sx(pts[i]), sy(pts[i + 1]));
  const noiseKey = (SCREEN_BITS as readonly string[]).includes(p) ? (p as keyof typeof NOISE_RANGE) : null;
  edt(field, W, H, dem && noiseKey ? srcIdx : undefined);
  let shadow = 0;
  for (let r = 0; r < rows; r++) {
    const m = metersPerCell(g, r) / F;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c, si = (r * F + 2) * W + c * F + 2, d = Math.sqrt(field[si]) * m;
      planes[p][i] = encode(p, d);
      // Экранирование считаем только там, где оно меняет оценку: источник слышен (d < радиус), но не вплотную.
      if (dem && noiseKey && planes.mask[i] && d > 150 && d < NOISE_RANGE[noiseKey] && srcIdx[si] >= 0 && blocked(centerOf(g, c, r), subCenter(srcIdx[si]), d)) { planes.screen[i] |= screenBit(noiseKey); shadow++; }
    }
  }
  screened += shadow;
  log(`${p}: ${lines.length} линий, ${pts.length / 2} точек${noiseKey && dem ? `, за хребтом ${shadow}` : ''}`);
}
for (const k of ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'local'] as const) distancePlane(k, osm.roads.filter((r: { cls: string }) => r.cls === k).map((r: { coords: number[][] }) => r.coords), []);
distancePlane('rail', osm.rail, []);
distancePlane('air', osm.air, []);
distancePlane('building', [], bld);
distancePlane('tower', [], osm.towers.flat());

// --- Ночной свет: ближайший пиксель композита z8 (~450 м).
const n8 = 256 * 2 ** lightMeta.z;
let lit = 0;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const [lon, lat] = centerOf(g, c, r);
  const px = Math.floor(((lon + 180) / 360) * n8) - lightMeta.px0, py = Math.floor(((1 - mercY(lat) / Math.PI) / 2) * n8) - lightMeta.py0;
  const v = px >= 0 && px < lightMeta.w && py >= 0 && py < lightMeta.h ? light[py * lightMeta.w + px] : -1;
  if (v >= 0) lit++;
  planes.light[r * cols + c] = encode('light', Math.max(0, v));
}
log(`свет: ${lit} клеток с данными`);

// --- Интегральная таблица для сумм по окну.
const sat = (w: number, h: number, at: (i: number) => number) => {
  const s = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) s[y * (w + 1) + x] = at((y - 1) * w + x - 1) + s[(y - 1) * (w + 1) + x] + s[y * (w + 1) + x - 1] - s[(y - 1) * (w + 1) + x - 1];
  return (x0: number, y0: number, x1: number, y1: number) => { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1); return x1 <= x0 || y1 <= y0 ? 0 : s[y1 * (w + 1) + x1] - s[y0 * (w + 1) + x1] - s[y1 * (w + 1) + x0] + s[y0 * (w + 1) + x0]; };
};
const BOX = 1000; // м: полуширина окна

// --- Плотность населения: WorldPop, люди на пиксель → чел/км² в окне.
const tiff = await fromFile(`${raw}/pop.tif`);
const img = await tiff.getImage();
const [pw, ph] = [img.getWidth(), img.getHeight()], [pwest, , , pnorth] = img.getBoundingBox(), pres = img.getResolution()[0];
const [pop] = (await img.readRasters()) as unknown as [Float32Array];
const popSum = sat(pw, ph, (i) => (pop[i] > 0 ? pop[i] : 0));
for (let r = 0; r < rows; r++) {
  const lat = centerOf(g, 0, r)[1];
  const mx = 111320 * Math.cos(rad(lat)) * pres, my = 111320 * pres;
  const nx = Math.round(BOX / mx), ny = Math.round(BOX / my);
  const area = (2 * nx + 1) * (2 * ny + 1) * mx * my * 1e-6;
  for (let c = 0; c < cols; c++) {
    const [lon] = centerOf(g, c, r);
    const px = Math.floor((lon - pwest) / pres), py = Math.floor((pnorth - lat) / pres);
    planes.pop[r * cols + c] = encode('pop', popSum(px - nx, py - ny, px + nx + 1, py + ny + 1) / area);
  }
}
log('плотность населения');

// --- Покрытие земли: доли леса (10), воды (80) и открытых естественных земель (20, 30, 60, 70, 90, 100) в окне; 0 — нет данных.
const OPEN = new Set([20, 30, 60, 70, 90, 100]);
const forestSum = sat(lcMeta.w, lcMeta.h, (i) => (lc[i] === 10 ? 1 : 0));
const waterSum = sat(lcMeta.w, lcMeta.h, (i) => (lc[i] === 80 ? 1 : 0));
const openSum = sat(lcMeta.w, lcMeta.h, (i) => (OPEN.has(lc[i]) ? 1 : 0));
const validSum = sat(lcMeta.w, lcMeta.h, (i) => (lc[i] ? 1 : 0));
for (let r = 0; r < rows; r++) {
  const lat = centerOf(g, 0, r)[1];
  const nx = Math.round(BOX / (111320 * Math.cos(rad(lat)) * lcMeta.res)), ny = Math.round(BOX / (111320 * lcMeta.res));
  for (let c = 0; c < cols; c++) {
    const [lon] = centerOf(g, c, r);
    const px = Math.floor((lon - lcMeta.west) / lcMeta.res), py = Math.floor((lcMeta.north - lat) / lcMeta.res);
    const box = [px - nx, py - ny, px + nx + 1, py + ny + 1] as const;
    const valid = validSum(...box);
    const i = r * cols + c;
    if (!valid) { planes.mask[i] = 0; continue; }
    planes.forest[i] = encode('forest', (100 * forestSum(...box)) / valid);
    planes.water[i] = encode('water', (100 * waterSum(...box)) / valid);
    planes.open[i] = encode('open', (100 * openSum(...box)) / valid);
  }
}
log('покрытие земли');

// --- Запись: планарно, дельты по строкам, gzip. grid.gz — измерения, scores.gz — маска и готовые оценки для первого кадра.
const buf = packPlanes(planes, PLANES, cols);
const gz = gzipSync(buf, { level: 9 });
writeFileSync(`${out}/grid.gz`, gz);
const sc = Object.fromEntries(SCORE_PLANES.map((p) => [p, p === 'mask' ? planes.mask : new Uint8Array(N)])) as Record<(typeof SCORE_PLANES)[number], Uint8Array>;
for (let i = 0; i < N; i++) if (planes.mask[i]) { const s = scores(rawAt({ cols, rows, planes }, i)); for (const k of LAYERS) sc[k][i] = s[k]; }
const sgz = gzipSync(packPlanes(sc, SCORE_PLANES, cols), { level: 9 });
writeFileSync(`${out}/scores.gz`, sgz);
const stats: Record<string, number> = {};
for (const p of PLANES) { let s = 0, n = 0; for (let i = 0; i < N; i++) if (planes.mask[i]) { s += planes[p][i]; n++; } stats[p] = +(s / n).toFixed(1); }
const meta = {
  region: region.id, bbox: g.bbox, cols, rows, cell: region.cell, dLon: g.dLon, planes: PLANES, built: new Date().toISOString().slice(0, 10),
  sources: { dem: dem?.meta.source ?? null, osm: osm.fetched, buildings: JSON.parse(readFileSync(`${raw}/buildings.json`, 'utf8')), light: lightMeta, landcover: lcMeta.source, pop: 'WorldPop 2020 unconstrained 100 m' },
  cells: inside, screened, bytes: gz.length, scoresBytes: sgz.length, meanEncoded: stats,
};
writeFileSync(`${out}/meta.json`, JSON.stringify(meta, null, 1));
log(`${out}/grid.gz: ${(gz.length / 1024).toFixed(0)} КБ (${(buf.length / 1024).toFixed(0)} КБ без сжатия), scores.gz: ${(sgz.length / 1024).toFixed(0)} КБ`);
