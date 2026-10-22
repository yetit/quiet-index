// Слои-измерения растра: по одному байту на клетку. Расстояния — в шагах unit м (255 = дальше cap),
// свет и плотность — логарифмически, покрытие — в процентах с шагом 2 (клетка 250 м, точнее не нужно, а gzip вдвое меньше). Файл grid.gz: планарно, каждая строка —
// разности с соседом слева (так gzip сжимает плавные поля в несколько раз лучше).
export const PLANES = ['mask', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'local', 'rail', 'air', 'building', 'tower', 'light', 'pop', 'forest', 'water', 'open', 'screen'] as const;
// Биты плана screen: ближайший источник этого класса закрыт рельефом (нет линии видимости по DEM).
export const SCREEN_BITS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'local', 'rail', 'air'] as const;
export const screenBit = (k: (typeof SCREEN_BITS)[number]) => 1 << SCREEN_BITS.indexOf(k);
export type Plane = (typeof PLANES)[number];
export type Raw = Record<Exclude<Plane, 'mask'>, number>;

// Метров в одном шаге для планов-расстояний.
export const DIST_UNIT: Partial<Record<Plane, number>> = { motorway: 50, trunk: 50, primary: 50, secondary: 50, tertiary: 50, local: 25, rail: 50, air: 100, building: 50, tower: 100 };
export const distCap = (p: Plane) => 255 * DIST_UNIT[p]!;

const LIGHT_K = 10, LIGHT_MAX = 40; // нВт/(см²·ср): 0 → 0, 40 → 255
const POP_K = 18; // чел/км²: enc = 18·log2(1 + d), 10 000 чел/км² ≈ 239

export function encode(p: Plane, v: number): number {
  const u = DIST_UNIT[p];
  if (u) return Math.min(255, Math.round(v / u));
  if (p === 'light') return Math.round((255 * Math.log1p(Math.max(0, v) * LIGHT_K)) / Math.log1p(LIGHT_MAX * LIGHT_K));
  if (p === 'pop') return Math.min(255, Math.round(POP_K * Math.log2(1 + Math.max(0, v))));
  if (p === 'screen') return v & 255;
  return Math.max(0, Math.min(50, Math.round(v / 2))); // проценты, шаг 2
}

export function decode(p: Plane, b: number): number {
  const u = DIST_UNIT[p];
  if (u) return b * u;
  if (p === 'light') return (Math.expm1((b / 255) * Math.log1p(LIGHT_MAX * LIGHT_K))) / LIGHT_K;
  if (p === 'pop') return 2 ** (b / POP_K) - 1;
  if (p === 'screen') return b;
  return b * 2;
}

export const deltaEncode = (plane: Uint8Array, cols: number) => { const out = new Uint8Array(plane.length); for (let i = 0; i < plane.length; i++) out[i] = i % cols ? plane[i] - plane[i - 1] : plane[i]; return out; };
export const deltaDecode = (plane: Uint8Array, cols: number) => { const out = new Uint8Array(plane.length); for (let i = 0; i < plane.length; i++) out[i] = i % cols ? out[i - 1] + plane[i] : plane[i]; return out; };

export type Grid = { cols: number; rows: number; planes: Record<Plane, Uint8Array> };

// Планарный буфер с дельтами по строкам → массивы планов (общий код для grid.gz и scores.gz).
export function unpackPlanes<T extends string>(buf: Uint8Array, names: readonly T[], cols: number, rows: number): Record<T, Uint8Array> {
  const n = cols * rows;
  if (buf.length !== n * names.length) throw new Error(`планы: ${buf.length} байт, ожидалось ${n * names.length}`);
  const planes = {} as Record<T, Uint8Array>;
  names.forEach((p, i) => { planes[p] = deltaDecode(buf.subarray(i * n, (i + 1) * n), cols); });
  return planes;
}
export const packPlanes = <T extends string>(planes: Record<T, Uint8Array>, names: readonly T[], cols: number) => { const n = planes[names[0]].length, buf = new Uint8Array(n * names.length); names.forEach((p, i) => buf.set(deltaEncode(planes[p], cols), i * n)); return buf; };

export const splitPlanes = (buf: Uint8Array, cols: number, rows: number): Grid => ({ cols, rows, planes: unpackPlanes(buf, PLANES, cols, rows) });

export function rawAt(g: Grid, i: number): Raw {
  const r = {} as Raw;
  for (const p of PLANES) if (p !== 'mask') r[p] = decode(p, g.planes[p][i]);
  return r;
}
