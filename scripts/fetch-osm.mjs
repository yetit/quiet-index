// Дороги по классам, железные дороги, аэропорты, вышки связи и граница региона — из OSM через Overpass.
// Результат: data/<id>/raw/osm.json. Здания — отдельно (fetch-buildings.mjs), их на порядки больше.
import { mkdirSync, writeFileSync } from 'node:fs';
import { getRegion } from '../regions.config.mjs';
import { bboxStr, line, overpass } from './overpass.mjs';

const region = getRegion(process.argv[2]);
const bbox = bboxStr(region.bbox);
const head = `[out:json][timeout:300][bbox:${bbox}];`;
const dir = `data/${region.id}/raw`;
mkdirSync(dir, { recursive: true });

const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
// Съезды (motorway_link и т. п.) относим к классу основной дороги; residential и unclassified — один класс local.
const cls = (t) => CLASSES.find((c) => t.highway === c || t.highway === `${c}_link`) ?? 'local';

console.log('дороги…');
const roadEls = await overpass(`${head}way["highway"~"^(${CLASSES.join('|')})(_link)?$"];out geom;`);
const roads = roadEls.filter((w) => w.geometry).map((w) => ({ cls: cls(w.tags), coords: line(w.geometry) }));
// Улицы и проезды — отдельными запросами: их в разы больше, чем дорог классом выше.
for (const h of ['residential', 'unclassified']) {
  console.log(`${h}…`);
  const els = await overpass(`${head}way["highway"="${h}"];out geom;`);
  for (const w of els) if (w.geometry) roads.push({ cls: 'local', coords: line(w.geometry) });
}

console.log('железные дороги…');
const railEls = await overpass(`${head}way["railway"="rail"]["service"!~"."];out geom;`);
const rail = railEls.filter((w) => w.geometry).map((w) => line(w.geometry));

// Аэропорты: только аэродромы с кодом IATA (регулярные рейсы) и ВПП длиннее 1,5 км — лётные поля малой авиации не шумят.
console.log('аэропорты…');
const airEls = await overpass(`${head}(nwr["aeroway"="aerodrome"]["iata"];way["aeroway"="runway"];);out geom;`);
const len = (c) => c.slice(1).reduce((s, p, i) => s + Math.hypot((p[0] - c[i][0]) * 82000, (p[1] - c[i][1]) * 111000), 0);
const air = [];
for (const e of airEls) {
  if (e.type === 'way' && e.geometry) {
    const c = line(e.geometry);
    if (e.tags.aeroway === 'aerodrome' || len(c) > 1500) air.push(c);
  } else if (e.type === 'relation') for (const m of e.members ?? []) if (m.geometry) air.push(line(m.geometry));
}

// Вышки связи: в OSM отмечены далеко не все — слой «связь» считается по ним честно приблизительным.
console.log('вышки…');
const towerEls = await overpass(`${head}(nwr["tower:type"="communication"];nwr["communication:mobile_phone"="yes"];nwr["man_made"="communications_tower"];);out center;`);
const towers = towerEls.map((e) => (e.center ? [e.center.lon, e.center.lat] : [e.lon, e.lat])).filter((p) => p[0] != null).map((p) => [+p[0].toFixed(6), +p[1].toFixed(6)]);

console.log('граница…');
const relEls = await overpass(`[out:json][timeout:120];rel(${region.osmRelation});out geom;`);
const boundary = (relEls[0]?.members ?? []).filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry).map((m) => line(m.geometry));

const out = { fetched: new Date().toISOString().slice(0, 10), roads, rail, air, towers, boundary };
writeFileSync(`${dir}/osm.json`, JSON.stringify(out));
console.log(`дорог ${roads.length}, ж/д ${rail.length}, аэропорты ${air.length}, вышек ${towers.length}, граница ${boundary.length} way → ${dir}/osm.json`);
