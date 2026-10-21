// Центры всех зданий региона из OSM: Overpass по тайлам 0,25° (целиком страна не пролезает в лимиты).
// Результат — data/<id>/raw/buildings.bin: Float32 пары [lon, lat].
import { mkdirSync, writeFileSync } from 'node:fs';
import { getRegion } from '../regions.config.mjs';
import { overpass } from './overpass.mjs';

const region = getRegion(process.argv[2]);
const { west, south, east, north } = region.bbox;
const STEP = region.buildingTile ?? 0.25;
const dir = `data/${region.id}/raw`;
mkdirSync(dir, { recursive: true });

const pts = [];
let tiles = 0, total = Math.ceil((east - west) / STEP) * Math.ceil((north - south) / STEP);
for (let s = south; s < north; s += STEP) {
  for (let w = west; w < east; w += STEP) {
    const bbox = `${s},${w},${Math.min(s + STEP, north)},${Math.min(w + STEP, east)}`;
    const els = await overpass(`[out:json][timeout:180][bbox:${bbox}];nwr["building"];out center;`);
    for (const e of els) {
      const p = e.center ?? e;
      if (p.lon != null) pts.push(p.lon, p.lat);
    }
    console.log(`тайл ${++tiles}/${total} (${bbox}): ${els.length} зданий`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}
writeFileSync(`${dir}/buildings.bin`, new Float32Array(pts));
writeFileSync(`${dir}/buildings.json`, JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), count: pts.length / 2 }));
console.log(`${pts.length / 2} зданий → ${dir}/buildings.bin`);
