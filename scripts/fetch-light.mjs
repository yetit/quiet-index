// Ночной свет: NASA Black Marble VNP46A2 (gap-filled, BRDF- и лунно-скорректированная радиометрия DNB)
// через NASA GIBS без ключа. GIBS отдаёт палитровые PNG; значение восстанавливаем по цветовой карте
// (бины 0,1 нВт/(см²·ср), выше 38,2 — насыщение). Годовая картина — медиана по 24 ночам года (1-е и 15-е число).
// Результат: data/<id>/raw/light.bin (Float32, пиксели z8 Web Mercator) + light.json (окно).
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { getRegion } from '../regions.config.mjs';

const region = getRegion(process.argv[2]);
const YEAR = process.env.LIGHT_YEAR ?? '2025';
const LAYER = 'VIIRS_SNPP_GapFilled_BRDF_Corrected_DayNightBand_Radiance';
const Z = 8; // GoogleMapsCompatible_Level8 — максимум для слоя, ~450 м/пиксель на 42° с. ш.
const dir = `data/${region.id}/raw`;
mkdirSync(dir, { recursive: true });

// Цветовая карта GIBS: серый уровень → середина бина радиометрии.
const cmapXml = await (await fetch('https://gibs.earthdata.nasa.gov/colormaps/v1.3/VIIRS_DayNightBand_At_Sensor_Radiance.xml')).text();
const gray = new Map();
for (const m of cmapXml.matchAll(/rgb="(\d+),\d+,\d+"[^>]*value="\[([\d.]+),([\d.]+)[)\]]"/g)) {
  const [lo, hi] = [+m[2], +m[3]];
  gray.set(+m[1], hi > 1000 ? lo : (lo + hi) / 2);
}

const n = 2 ** Z;
const tx = (lon) => Math.floor(((lon + 180) / 360) * n);
const ty = (lat) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
const { west, south, east, north } = region.bbox;
const [x0, x1, y0, y1] = [tx(west), tx(east), ty(north), ty(south)];
const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;

const dates = [];
for (let m = 1; m <= 12; m++) for (const d of ['01', '15']) dates.push(`${YEAR}-${String(m).padStart(2, '0')}-${d}`);
const samples = Array.from({ length: W * H }, () => []);
for (const date of dates) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAYER}/default/${date}/GoogleMapsCompatible_Level8/${Z}/${y}/${x}.png`;
    const res = await fetch(url);
    if (!res.ok) { console.warn(`${date} ${y}/${x}: ${res.status}`); continue; }
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const k = (j * 256 + i) * 4;
      if (png.data[k + 3] === 0) continue; // nodata
      const v = gray.get(png.data[k]);
      if (v != null) samples[(y - y0) * 256 * W + j * W + (x - x0) * 256 + i].push(v);
    }
  }
  console.log(date);
}
const out = new Float32Array(W * H).fill(-1);
let filled = 0;
samples.forEach((s, i) => { if (s.length) { s.sort((a, b) => a - b); out[i] = s[s.length >> 1]; filled++; } });
writeFileSync(`${dir}/light.bin`, out);
writeFileSync(`${dir}/light.json`, JSON.stringify({ source: `GIBS ${LAYER}`, year: YEAR, dates: dates.length, z: Z, px0: x0 * 256, py0: y0 * 256, w: W, h: H }));
console.log(`${W}×${H} px, заполнено ${filled} → ${dir}/light.bin`);
