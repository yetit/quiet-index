// Плотность населения: WorldPop 2020, 100 м, unconstrained (CC BY 4.0) — один GeoTIFF на страну.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { getRegion } from '../regions.config.mjs';

const region = getRegion(process.argv[2]);
const dir = `data/${region.id}/raw`;
mkdirSync(dir, { recursive: true });
const file = `${dir}/pop.tif`;
if (existsSync(file) && !process.argv.includes('--force')) { console.log(`${file} уже есть`); process.exit(0); }
const code = region.worldpop.toLowerCase();
const url = `https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/${region.worldpop}/${code}_ppp_2020.tif`;
const res = await fetch(url);
if (!res.ok) throw new Error(`WorldPop ${res.status}: ${url}`);
writeFileSync(file, Buffer.from(await res.arrayBuffer()));
console.log(`${url} → ${file}`);
