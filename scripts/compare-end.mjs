// Сверка слоя «Тишина» с картами шума ЕС (END, Lden от дорог; EEA, обновление апреля 2026, ImageServer EPSG:3035, 10 м).
// Окно региона выгружается в 2 раза мельче сетки, в центре каждой клетки берётся класс Lden:
// 1: 55–59, 2: 60–64, 3: 65–69, 4: 70–74, 5: ≥ 75 дБ; 0 — вне контуров (тише 55 дБ или не картировано: END
// покрывает только крупные дороги > 3 млн машин в год и агломерации). Отчёт — docs/end-check.md.
// Запуск: node scripts/compare-end.mjs <регион>.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fromArrayBuffer } from 'geotiff';
import { getRegion } from '../regions.config.mjs';
import { centerOf } from '../src/core/grid.ts';
import { SCORE_PLANES } from '../src/core/index.ts';
import { unpackPlanes } from '../src/core/layers.ts';

const region = getRegion(process.argv[2]);
const meta = JSON.parse(readFileSync(`public/data/${region.id}/meta.json`, 'utf8'));
const sc = unpackPlanes(gunzipSync(readFileSync(`public/data/${region.id}/scores.gz`)), SCORE_PLANES, meta.cols, meta.rows);
const { west, south, east, north } = meta.bbox;
const W = meta.cols * 2, H = meta.rows * 2;
const S = 'https://noise.discomap.eea.europa.eu/arcgis/rest/services/noiseStoryMap/NoiseContours_road_lden/ImageServer/exportImage';
const url = `${S}?bbox=${west},${south},${east},${north}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=tiff&pixelType=U8&noData=0&interpolation=RSP_NearestNeighbor&renderingRule=${encodeURIComponent(JSON.stringify({ rasterFunction: 'None' }))}&f=image`;
const res = await fetch(url);
if (!res.ok) throw new Error(`EEA ${res.status}`);
const img = await (await fromArrayBuffer(await res.arrayBuffer())).getImage();
const [lden] = await img.readRasters();
const [ox, , , oy] = img.getBoundingBox(), [rx, ry] = img.getResolution();

const BANDS = ['< 55 / нет контура', '55–59', '60–64', '65–69', '70–74', '≥ 75'];
const by = BANDS.map(() => []);
for (let r = 0; r < meta.rows; r++) for (let c = 0; c < meta.cols; c++) {
  const i = r * meta.cols + c;
  if (!sc.mask[i]) continue;
  const [lon, lat] = centerOf(meta, c, r);
  const px = Math.floor((lon - ox) / rx), py = Math.floor((oy - lat) / -ry);
  const k = px >= 0 && px < img.getWidth() && py >= 0 && py < img.getHeight() ? lden[py * img.getWidth() + px] : 0;
  by[Math.min(5, k)].push(sc.noise[i]);
}
const q = (a, p) => a[Math.floor(p * (a.length - 1))];
const rows = by.map((a, k) => { a.sort((x, y) => x - y); return a.length ? `| ${BANDS[k]} | ${a.length} | ${q(a, 0.1)} | ${q(a, 0.5)} | ${q(a, 0.9)} | ${Math.round((100 * a.filter((v) => v >= 60).length) / a.length)} % |` : `| ${BANDS[k]} | 0 | — | — | — | — |`; });
const inContours = by.slice(1).flat();
const md = `# Сверка с END: ${region.name.ru} (${new Date().toISOString().slice(0, 10)})

Источник: EEA, контуры Lden от дорог (noiseStoryMap/NoiseContours_road_lden, обновление апреля 2026), выборка в центрах клеток ${meta.cell} м.
Наша оценка «Тишина» 0–100: 100 — ни одного источника в пределах радиуса, 0 — на дороге.

| Lden, дБ | клеток | p10 | медиана | p90 | «тихо» (≥ 60) |
|---|---|---|---|---|---|
${rows.join('\n')}

Клеток внутри контуров END: ${inContours.length} из ${by.flat().length} суши (${((100 * inContours.length) / by.flat().length).toFixed(1)} %).
END картирует только крупные дороги (> 3 млн машин в год) и агломерации, поэтому строка «нет контура» смешивает по-настоящему тихие места и некартированные дороги.
`;
mkdirSync('docs', { recursive: true });
writeFileSync(`docs/end-check-${region.id}.md`, md);
console.log(md);
