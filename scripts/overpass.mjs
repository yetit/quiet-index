// Запрос к Overpass с повтором по зеркалам и растущей паузой: публичные серверы часто отвечают 5xx/429.
const MIRRORS = [
  process.env.OVERPASS,
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
].filter(Boolean);

export async function overpass(query, tries = 3) {
  let err;
  for (let attempt = 0; attempt < tries; attempt++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': 'quiet-index/0.1 (github.com/yetit)', Accept: 'application/json' }, body: new URLSearchParams({ data: query }) });
        const text = await res.text();
        if (res.ok && text.startsWith('{')) return JSON.parse(text).elements;
        err = new Error(`Overpass ${res.status} (${url}): ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
      } catch (e) {
        err = new Error(`Overpass (${url}): ${e.message}`);
      }
      console.warn(err.message);
    }
    await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
  }
  throw err;
}

export const bboxStr = ({ south, west, north, east }) => `${south},${west},${north},${east}`;
export const line = (geom) => geom.map((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)]);
