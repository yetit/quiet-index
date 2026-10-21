// Рельеф: Copernicus DEM GLO-90 (AWS Open Data, COG-тайлы 1°×1°, 3″ ≈ 90 м) — окно bbox через range-запросы.
// Нужен только для проверки линии видимости до дорог (экранирование хребтами), 90 м достаточно.
// Результат: data/<id>/raw/dem.bin (Int16, метры, -32768 — нет данных) + dem.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fromUrl } from 'geotiff';
import { getRegion } from '../regions.config.mjs';

const region = getRegion(process.argv[2]);
const { bbox } = region;
const STEP = 3 / 3600;
const NODATA = -32768;
const dir = `data/${region.id}/raw`;
mkdirSync(dir, { recursive: true });
const cols = Math.round((bbox.east - bbox.west) / STEP), rows = Math.round((bbox.north - bbox.south) / STEP);
const out = new Int16Array(cols * rows).fill(NODATA);
const name = (lat, lon) => `Copernicus_DSM_COG_30_${lat >= 0 ? 'N' : 'S'}${String(Math.abs(lat)).padStart(2, '0')}_00_${lon >= 0 ? 'E' : 'W'}${String(Math.abs(lon)).padStart(3, '0')}_00_DEM`;

for (let lat = Math.floor(bbox.south); lat < bbox.north; lat++) for (let lon = Math.floor(bbox.west); lon < bbox.east; lon++) {
  const n = name(lat, lon);
  let img;
  try { img = await (await fromUrl(`https://copernicus-dem-90m.s3.amazonaws.com/${n}/${n}.tif`)).getImage(); } catch { console.warn(`${n}: нет тайла (море?)`); continue; }
  // PixelIsPoint: начало — центр первого пикселя на целом градусе.
  const [x0, y1] = img.getOrigin(), [rx, ry] = img.getResolution(), W = img.getWidth(), H = img.getHeight();
  const fx = (l) => (l - x0) / rx, fy = (l) => (y1 - l) / -ry;
  const px0 = Math.max(0, Math.floor(fx(bbox.west))), px1 = Math.min(W, Math.ceil(fx(bbox.east)) + 1);
  const py0 = Math.max(0, Math.floor(fy(bbox.north))), py1 = Math.min(H, Math.ceil(fy(bbox.south)) + 1);
  if (px0 >= px1 || py0 >= py1) continue;
  const [band] = await img.readRasters({ window: [px0, py0, px1, py1] });
  const ww = px1 - px0;
  for (let r = 0; r < rows; r++) {
    const y = Math.round(fy(bbox.north - (r + 0.5) * STEP));
    if (y < py0 || y >= py1) continue;
    for (let c = 0; c < cols; c++) {
      const x = Math.round(fx(bbox.west + (c + 0.5) * STEP));
      if (x < px0 || x >= px1) continue;
      const v = band[(y - py0) * ww + (x - px0)];
      if (Number.isFinite(v)) out[r * cols + c] = Math.round(v);
    }
  }
  console.log(`${n}: окно ${ww}×${py1 - py0}`);
}
writeFileSync(`${dir}/dem.bin`, out);
writeFileSync(`${dir}/dem.json`, JSON.stringify({ source: 'Copernicus DEM GLO-90', step: STEP, west: bbox.west, north: bbox.north, cols, rows }));
console.log(`${cols}×${rows} → ${dir}/dem.bin`);
