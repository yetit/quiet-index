// Самые тихие клетки вокруг точки: по текущим значениям растра (индекс или один слой), в радиусе,
// с минимальным разносом между найденными, чтобы список не состоял из соседних клеток одного леса.
import { centerOf, mercY, metersPerCell, type GridMeta } from './grid.ts';

export type Spot = { col: number; row: number; value: number; dist: number; bearing: number; p: [number, number] };

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
// Расстояние (м) и азимут (° от севера) между точками [lon, lat] — плоское приближение, для десятков км достаточно.
export function distBearing(a: [number, number], b: [number, number]): [number, number] {
  const x = rad(b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2)) * R, y = rad(b[1] - a[1]) * R;
  return [Math.hypot(x, y), ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360];
}
export const DIRS = 8;
export const dirIndex = (bearing: number) => Math.round(bearing / (360 / DIRS)) % DIRS;

export function topSpots(values: Uint8Array, g: GridMeta, center: [number, number], radius: number, n = 8, minSep = 2000): Spot[] {
  const col0 = Math.floor((center[0] - g.bbox.west) / g.dLon), row0 = Math.floor((mercY(g.bbox.north) - mercY(center[1])) / rad(g.dLon));
  const rc = Math.ceil(radius / metersPerCell(g, Math.max(0, Math.min(g.rows - 1, row0)))) + 1;
  const found: Spot[] = [];
  for (let r = Math.max(0, row0 - rc); r <= Math.min(g.rows - 1, row0 + rc); r++) for (let c = Math.max(0, col0 - rc); c <= Math.min(g.cols - 1, col0 + rc); c++) {
    const v = values[r * g.cols + c];
    if (v > 100) continue;
    const p = centerOf(g, c, r), [dist, bearing] = distBearing(center, p);
    if (dist <= radius) found.push({ col: c, row: r, value: v, dist, bearing, p });
  }
  found.sort((a, b) => b.value - a.value || a.dist - b.dist);
  const out: Spot[] = [];
  for (const s of found) {
    if (out.length >= n) break;
    if (out.every((o) => distBearing(o.p, s.p)[0] >= minSep)) out.push(s);
  }
  return out;
}
