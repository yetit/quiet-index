// npm run fetch -- <регион> [--force]: все выгрузки, затем сборка растра. Без --force пропускается всё, что уже скачано;
// с --force заново берутся меняющиеся наборы (OSM, ночной свет), а неизменные (WorldPop 2020, WorldCover 2021, DEM) — нет.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { getRegion } from '../regions.config.mjs';

const id = process.argv[2] ?? '';
const force = process.argv.includes('--force');
const raw = `data/${getRegion(id).id}/raw`;
const need = (file, script, changing = false) => ((force && changing) || !existsSync(`${raw}/${file}`) ? [script] : []);
for (const s of [...need('osm.json', 'fetch-osm.mjs', true), ...need('light.bin', 'fetch-light.mjs', true), ...need('pop.tif', 'fetch-pop.mjs'), ...need('landcover.bin', 'fetch-landcover.mjs'), ...need('dem.bin', 'fetch-dem.mjs'), 'build-grid.ts']) {
  console.log(`\n== ${s}`);
  execFileSync('node', [`scripts/${s}`, id, ...(force ? ['--force'] : [])], { stdio: 'inherit' });
}
