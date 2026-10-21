// Индекс тихого места: пять оценок 0–100 из сырых измерений клетки и их взвешенное среднее.
// Все пороги здесь — эвристики, они видны пользователю (README → «Как считается»).
import type { Raw } from './layers.ts';

export const LAYERS = ['noise', 'dark', 'remote', 'nature', 'signal'] as const;
export type Layer = (typeof LAYERS)[number];
export type Weights = Record<Layer, number>;
export type Scores = Record<Layer, number>;

export const DEFAULT_WEIGHTS: Weights = { noise: 35, dark: 25, remote: 20, nature: 20, signal: 0 };

// Шум: за этим расстоянием (м) источник считается неслышным; ближе — линейно до 0 у самой дороги.
export const NOISE_RANGE = { motorway: 2500, trunk: 2000, primary: 1200, secondary: 700, tertiary: 400, local: 150, rail: 1000, air: 4000 } as const; // local — residential и unclassified: улицы и проезды
export const LIGHT_DARK = 0.25, LIGHT_BRIGHT = 50; // нВт/(см²·ср): темно ≤ 0,25, город ≥ 50 (лог-шкала)
export const POP_MAX = 5000; // чел/км²: такая плотность и выше — 0 (лог-шкала)
export const BUILDING_FAR = 1000; // м до ближайшего здания, где «безлюдье» по домам = 100
export const TOWER_NEAR = 1000, TOWER_FAR = 8000; // м до вышки: связь 100 … 0

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(100 * clamp01(x));

export function scores(r: Raw): Scores {
  let noise = 1;
  for (const k of Object.keys(NOISE_RANGE) as (keyof typeof NOISE_RANGE)[]) noise = Math.min(noise, r[k] / NOISE_RANGE[k]);
  const dark = 1 - Math.log(Math.max(r.light, LIGHT_DARK) / LIGHT_DARK) / Math.log(LIGHT_BRIGHT / LIGHT_DARK);
  const people = 1 - Math.log10(1 + r.pop) / Math.log10(1 + POP_MAX);
  const remote = (clamp01(people) + clamp01(r.building / BUILDING_FAR)) / 2;
  // Природа: лес и вода полностью, открытые естественные земли (кусты, луга, скалы, снег) — наполовину; пашня и застройка — 0.
  const nature = (r.forest + r.water + 0.5 * r.open) / 100;
  const signal = 1 - (r.tower - TOWER_NEAR) / (TOWER_FAR - TOWER_NEAR);
  return { noise: pct(noise), dark: pct(dark), remote: pct(remote), nature: pct(nature), signal: pct(signal) };
}

export function index(s: Scores, w: Weights): number {
  let sum = 0, wsum = 0;
  for (const k of LAYERS) { sum += w[k] * s[k]; wsum += w[k]; }
  return wsum ? Math.round(sum / wsum) : Math.round(LAYERS.reduce((a, k) => a + s[k], 0) / LAYERS.length);
}

export const parseWeights = (s: string | null): Weights | null => {
  const v = s?.split('-').map(Number);
  if (!v || v.length !== LAYERS.length || v.some((x) => !Number.isInteger(x) || x < 0 || x > 100)) return null;
  return Object.fromEntries(LAYERS.map((k, i) => [k, v[i]])) as Weights;
};
export const weightsParam = (w: Weights) => LAYERS.map((k) => w[k]).join('-');

// Индекс для всех клеток растра: out[i] = 0–100, 255 — вне маски (прозрачно).
export function indexAll(s: Record<Layer, Uint8Array>, mask: Uint8Array, w: Weights, out: Uint8Array) {
  const ws = LAYERS.map((k) => w[k]), wsum = ws.reduce((a, b) => a + b, 0);
  const planes = LAYERS.map((k) => s[k]);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) { out[i] = 255; continue; }
    let sum = 0;
    for (let k = 0; k < planes.length; k++) sum += (wsum ? ws[k] : 1) * planes[k][i];
    out[i] = Math.round(sum / (wsum || planes.length));
  }
  return out;
}
