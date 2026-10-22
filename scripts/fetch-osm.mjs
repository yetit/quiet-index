// Дороги по классам, железные дороги, аэропорты, вышки связи, здания и граница региона — из выгрузок Geofabrik
// (PBF страны и её соседей: у границы важны и чужие дороги; файлы общие, в data/pbf/). Два прохода по каждому файлу:
// relations (граница, аэродромы-мультиполигоны), затем узлы в bbox и way. Результат: data/<id>/raw/osm.json и
// buildings.bin (Float32 пары lon, lat).
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getRegion } from '../regions.config.mjs';
import { blocks, readBlock } from './pbf.mjs';

const region = getRegion(process.argv[2]);
const dir = `data/${region.id}/raw`;
mkdirSync(dir, { recursive: true });
mkdirSync('data/pbf', { recursive: true });
const pbfs = [];
for (const g of region.geofabrik) {
  const pbf = `data/pbf/${basename(g)}-latest.osm.pbf`;
  if (!existsSync(pbf) || process.argv.includes('--force')) {
    const url = `https://download.geofabrik.de/${g}-latest.osm.pbf`;
    console.log(`${url} …`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geofabrik ${res.status}: ${url}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(pbf));
  }
  pbfs.push(pbf);
}
const t0 = Date.now();
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s ${s}`);

// --- Проход 1: граница региона (relation по id или по тегу ISO3166-1) и аэродромы с кодом IATA как мультиполигоны.
const wantBoundary = (id, t) => (region.boundary.relation ? id === region.boundary.relation : t?.['ISO3166-1'] === region.boundary.iso && t.admin_level === '2');
const boundaryWays = new Set(), airWays = new Set();
let boundaryId = null;
for (const b of blocks(pbfs[0])) if (b.type === 'OSMData') readBlock(b.data, {
  onRelation(id, t, members) {
    if (wantBoundary(id, t)) { boundaryId = id; for (const m of members) if (m.type === 1 && m.role === 'outer') boundaryWays.add(m.ref); }
    else if (t?.aeroway === 'aerodrome' && t.iata) for (const m of members) if (m.type === 1 && m.role !== 'inner') airWays.add(m.ref);
  },
});
if (!boundaryId) throw new Error(`граница региона не найдена в ${pbfs[0]}`);
log(`граница: relation ${boundaryId}, ${boundaryWays.size} way; аэродромы-мультиполигоны: ${airWays.size} way`);

// --- Проход 2: по всем файлам узлы в bbox (с запасом под границу) в типизированные массивы, затем way.
const M = 0.5, { west, south, east, north } = region.bbox;
let cap = 1 << 20, n = 0, ids = new Float64Array(cap), lons = new Float32Array(cap), lats = new Float32Array(cap), sorted = true;
const towers = [];
const isTower = (t) => t && (t['tower:type'] === 'communication' || t['communication:mobile_phone'] === 'yes' || t.man_made === 'communications_tower');
const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
const cls = (h) => CLASSES.find((c) => h === c || h === `${c}_link`) ?? (h === 'residential' || h === 'unclassified' ? 'local' : null);
const roads = [], rail = [], air = [], boundary = [], bld = [];
const find = (id) => { let lo = 0, hi = n - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ids[m] < id) lo = m + 1; else if (ids[m] > id) hi = m - 1; else return m; } return -1; };
const coords = (refs) => { const out = []; for (const r of refs) { const i = find(r); if (i >= 0) out.push([+lons[i].toFixed(6), +lats[i].toFixed(6)]); } return out; };
const len = (c) => c.slice(1).reduce((s, p, i) => s + Math.hypot((p[0] - c[i][0]) * 111320 * Math.cos((p[1] * Math.PI) / 180), (p[1] - c[i][1]) * 111320), 0);
const near = (c, m) => c.some(([x, y]) => x >= west - m && x <= east + m && y >= south - m && y <= north + m);
const centroid = (c) => [c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length];
// Узлы всех файлов — до первого way; way каждого файла — после его узлов, поэтому сначала проход по узлам всех файлов.
for (const pbf of pbfs) for (const b of blocks(pbf)) if (b.type === 'OSMData') readBlock(b.data, {
  onNode(id, lon, lat, t) {
    if (lon < west - M || lon > east + M || lat < south - M || lat > north + M) return;
    if (n === cap) { cap *= 2; const a = new Float64Array(cap); a.set(ids); ids = a; const o = new Float32Array(cap); o.set(lons); lons = o; const l = new Float32Array(cap); l.set(lats); lats = l; }
    if (n && id < ids[n - 1]) sorted = false;
    ids[n] = id; lons[n] = lon; lats[n] = lat; n++;
    if (isTower(t)) towers.push([+lon.toFixed(6), +lat.toFixed(6)]);
  },
});
log(`узлов в bbox: ${n}${sorted ? '' : ' (не по порядку — сортируем)'}`);
if (!sorted) { const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => ids[a] - ids[b]); ids = Float64Array.from(idx, (i) => ids[i]); lons = Float32Array.from(idx, (i) => lons[i]); lats = Float32Array.from(idx, (i) => lats[i]); }
// Один way может лежать в нескольких выгрузках (границы, буферные зоны) — берём первое вхождение, иначе граница
// удваивает пересечения в заливке по чётности, а здания считаются дважды.
const seen = new Set();
for (const pbf of pbfs) for (const b of blocks(pbf)) if (b.type === 'OSMData') readBlock(b.data, {
  onWay(id, t, refs) {
    // Отбираем только нужные way и только вблизи bbox (дальше радиуса слышимости соседние страны не нужны):
    // всех way девяти выгрузок больше, чем вмещает Set, а в seen нужны лишь отобранные.
    if (!(boundaryWays.has(id) || airWays.has(id) || (t && (t.highway || t.railway || t.aeroway || t.building || isTower(t))))) return;
    if (seen.has(id)) return;
    const c = coords(refs);
    if (!c.length) return;
    const isAir = airWays.has(id) || (t && (t.aeroway === 'aerodrome' || t.aeroway === 'runway'));
    if (!boundaryWays.has(id) && !near(c, isAir || isTower(t) ? 0.3 : 0.15)) return;
    seen.add(id);
    if (boundaryWays.has(id) && c.length > 1) boundary.push(c);
    if (!t) return;
    const k = t.highway && cls(t.highway);
    if (k && c.length > 1) roads.push({ cls: k, coords: c });
    else if (t.railway === 'rail' && !t.service && c.length > 1) rail.push(c);
    if ((airWays.has(id) || (t.aeroway === 'aerodrome' && t.iata)) && c.length > 1) air.push(c);
    else if (t.aeroway === 'runway' && c.length > 1 && len(c) > 1500) air.push(c);
    if (t.building && t.building !== 'no') { const [x, y] = centroid(c); bld.push(x, y); }
    if (isTower(t)) { const [x, y] = centroid(c); towers.push([+x.toFixed(6), +y.toFixed(6)]); }
  },
});

const fetched = new Date().toISOString().slice(0, 10);
writeFileSync(`${dir}/osm.json`, JSON.stringify({ fetched, source: `Geofabrik ${region.geofabrik.join(', ')}`, roads, rail, air, towers, boundary }));
writeFileSync(`${dir}/buildings.bin`, new Float32Array(bld));
writeFileSync(`${dir}/buildings.json`, JSON.stringify({ fetched, count: bld.length / 2 }));
log(`дорог ${roads.length}, ж/д ${rail.length}, аэропорты ${air.length}, вышек ${towers.length}, зданий ${bld.length / 2}, граница ${boundary.length} way → ${dir}/osm.json`);
