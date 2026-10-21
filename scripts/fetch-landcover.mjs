// Покрытие земли: ESA WorldCover 2021 v200 (10 м, CC BY 4.0), COG на AWS. Читаем обзорный уровень 3 (80 м)
// только в окне региона range-запросами. Результат: data/<id>/raw/landcover.bin (Uint8 классы) + landcover.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fromUrl } from 'geotiff';
import { getRegion } from '../regions.config.mjs';

const region = getRegion(process.argv[2]);
const LEVEL = 3; // 36000 px / 2^3 = 4500 px на 3° → 0,000667° ≈ 80 м
const RES = 3 / 4500;
const { west, south, east, north } = region.bbox;
const dir = `data/${region.id}/raw`;
mkdirSync(dir, { recursive: true });

const W = Math.ceil((east - west) / RES), H = Math.ceil((north - south) / RES);
const out = new Uint8Array(W * H);
for (const tile of region.worldcover) {
  const lat0 = +tile.slice(1, 3) * (tile[0] === 'N' ? 1 : -1), lon0 = +tile.slice(4, 7) * (tile[3] === 'E' ? 1 : -1);
  const [tw, ts, te, tn] = [Math.max(west, lon0), Math.max(south, lat0), Math.min(east, lon0 + 3), Math.min(north, lat0 + 3)];
  if (tw >= te || ts >= tn) continue;
  const tiff = await fromUrl(`https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${tile}_Map.tif`);
  const img = await tiff.getImage(LEVEL);
  const window = [Math.floor((tw - lon0) / RES), Math.floor((lat0 + 3 - tn) / RES), Math.ceil((te - lon0) / RES), Math.ceil((lat0 + 3 - ts) / RES)];
  const [data] = await img.readRasters({ window });
  const w = window[2] - window[0], h = window[3] - window[1];
  const ox = Math.round((lon0 + window[0] * RES - west) / RES), oy = Math.round((north - (lat0 + 3 - window[1] * RES)) / RES);
  for (let j = 0; j < h; j++) {
    const y = oy + j;
    if (y < 0 || y >= H) continue;
    for (let i = 0; i < w; i++) { const x = ox + i; if (x >= 0 && x < W) out[y * W + x] = data[j * w + i]; }
  }
  console.log(`${tile}: окно ${w}×${h}`);
}
writeFileSync(`${dir}/landcover.bin`, out);
writeFileSync(`${dir}/landcover.json`, JSON.stringify({ source: 'ESA WorldCover 2021 v200', res: RES, west, north, w: W, h: H }));
console.log(`${W}×${H} px → ${dir}/landcover.bin`);
