// Сетка расчёта в Web Mercator: клетки квадратные в проекции (точно ложатся image-источником MapLibre),
// на земле ~cell м с разницей cos(lat) по широте (для Черногории ±1,5 %).
export type Bbox = { west: number; south: number; east: number; north: number };
export type GridMeta = { bbox: Bbox; cols: number; rows: number; cell: number; dLon: number };

const R = 6378137;
const rad = (d: number) => (d * Math.PI) / 180;
export const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));
export const mercLat = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

// Шаг по долготе берётся так, чтобы клетка была ~cell м на средней широте; юг bbox сдвигается до целого числа рядов.
export function gridFor(bbox: Bbox, cell: number): GridMeta {
  const mid = (bbox.south + bbox.north) / 2;
  const cols = Math.ceil(((bbox.east - bbox.west) * rad(1) * R * Math.cos(rad(mid))) / cell);
  const dLon = (bbox.east - bbox.west) / cols;
  const rows = Math.ceil((mercY(bbox.north) - mercY(bbox.south)) / rad(dLon));
  const south = mercLat(mercY(bbox.north) - rows * rad(dLon));
  return { bbox: { ...bbox, south }, cols, rows, cell, dLon };
}

export function cellOf(g: GridMeta, lon: number, lat: number): { col: number; row: number } | null {
  const col = Math.floor((lon - g.bbox.west) / g.dLon);
  const row = Math.floor((mercY(g.bbox.north) - mercY(lat)) / rad(g.dLon));
  return col >= 0 && col < g.cols && row >= 0 && row < g.rows ? { col, row } : null;
}

export const centerOf = (g: GridMeta, col: number, row: number): [number, number] => [g.bbox.west + (col + 0.5) * g.dLon, mercLat(mercY(g.bbox.north) - (row + 0.5) * rad(g.dLon))];

// Размер клетки в метрах на данной строке.
export const metersPerCell = (g: GridMeta, row: number) => rad(g.dLon) * R * Math.cos(rad(centerOf(g, 0, row)[1]));
