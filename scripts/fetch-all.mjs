// npm run fetch -- <регион> [--force]: все выгрузки (уже скачанные неизменные наборы пропускаются), затем сборка растра.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { getRegion } from '../regions.config.mjs';

const id = process.argv[2] ?? '';
const force = process.argv.includes('--force');
const raw = `data/${getRegion(id).id}/raw`;
const need = (file, script) => (force || !existsSync(`${raw}/${file}`) ? [script] : []);
for (const s of [...need('osm.json', 'fetch-osm.mjs'), ...need('buildings.bin', 'fetch-buildings.mjs'), ...need('light.bin', 'fetch-light.mjs'), ...need('pop.tif', 'fetch-pop.mjs'), ...need('landcover.bin', 'fetch-landcover.mjs'), ...need('dem.bin', 'fetch-dem.mjs'), 'build-grid.ts']) {
  console.log(`\n== ${s}`);
  execFileSync('node', [`scripts/${s}`, id], { stdio: 'inherit' });
}
