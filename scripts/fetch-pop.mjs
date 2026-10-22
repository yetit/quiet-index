// Плотность населения: WorldPop 2020, 100 м, unconstrained (CC BY 4.0) — один GeoTIFF на страну.
import { existsSync, mkdirSync } from 'node:fs';
import { getRegion } from '../regions.config.mjs';
import { download } from './download.mjs';

const region = getRegion(process.argv[2]);
const dir = `data/${region.id}/raw`;
mkdirSync(dir, { recursive: true });
const file = `${dir}/pop.tif`;
if (existsSync(file) && !process.argv.includes('--force')) { console.log(`${file} уже есть`); process.exit(0); }
const code = region.worldpop.toLowerCase();
const url = `https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/${region.worldpop}/${code}_ppp_2020.tif`;
await download(url, file);
console.log(`${url} → ${file}`);
