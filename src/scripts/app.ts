// Состояние приложения и его отражение в URL: ?r=регион&p=lat,lon&w=веса&l=слой&lang=.
import { getRegion } from '../../regions.config.mjs';
import { DEFAULT_WEIGHTS, type Layer, parseWeights, weightsParam, type Weights } from '../core/index.ts';
import { lang } from './i18n.ts';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
export const BASE = import.meta.env.BASE_URL;
export type View = 'index' | Layer;

const url = new URL(location.href);
export const region = getRegion(url.searchParams.get('r') ?? '');
const pt = (k: string): [number, number] | null => { const v = url.searchParams.get(k)?.split(',').map(Number); return v && v.length === 2 && v.every(Number.isFinite) ? [v[1], v[0]] : null; }; // внутри — [lon, lat]
const l = url.searchParams.get('l');

export const state: { weights: Weights; view: View; point: [number, number] | null; compare: [number, number] | null; spotsRadius: number } = {
  weights: parseWeights(url.searchParams.get('w')) ?? { ...DEFAULT_WEIGHTS },
  view: (['index', 'noise', 'dark', 'remote', 'nature', 'signal'] as View[]).includes(l as View) ? (l as View) : 'index',
  point: pt('p'),
  compare: pt('a'), // точка A для сравнения
  spotsRadius: 30_000, // м
};

export function syncUrl() {
  const u = new URL(location.href);
  const set = (k: string, v: string | null) => (v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v));
  set('r', region.id);
  const ll = (p: [number, number] | null) => (p ? `${p[1].toFixed(4)},${p[0].toFixed(4)}` : null);
  set('p', ll(state.point));
  set('a', ll(state.compare));
  set('w', weightsParam(state.weights) === weightsParam(DEFAULT_WEIGHTS) ? null : weightsParam(state.weights));
  set('l', state.view === 'index' ? null : state.view);
  set('lang', lang);
  history.replaceState(null, '', u.pathname + '?' + u.searchParams.toString().replace(/%2C/g, ',')); // запятая в p= читаемая
}
