// Правая панель: переключатель слоёв, результат по клетке (оценка, разбивка, подробности), ползунки весов.
import { DEFAULT_WEIGHTS, LAYERS, NOISE_RANGE, bortle, type Layer, type Scores } from '../../core/index.ts';
import { dirIndex, type Spot } from '../../core/spots.ts';
import { distCap, screenBit, type Raw } from '../../core/layers.ts';
import { $, region, state, type View } from '../app.ts';
import { lang, t } from '../i18n.ts';
import { cssGradient } from '../map/map.ts';

const VIEWS: View[] = ['index', ...LAYERS];
const ROADS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'local'] as const;

export type Cell = { s: Scores; idx: number };
const RADII = [10, 30, 100]; // км

export function initPanel(on: { weights: () => void; view: () => void; pick: (p: [number, number]) => void; radius: () => void }) {
  $('.examples').innerHTML = (region.examples ?? []).map((e, i) => `<button type="button" class="example" data-i="${i}">${e.name[lang]}</button>`).join('');
  $('.examples').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.example'); if (b) on.pick(region.examples[+b.dataset.i!].p as [number, number]); });
  $('.spots-radius').innerHTML = RADII.map((km) => `<button type="button" class="chip" role="radio" data-km="${km}" aria-checked="${km * 1000 === state.spotsRadius}">${t.radius(km)}</button>`).join('');
  $('.spots-radius').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-km]');
    if (!b) return;
    state.spotsRadius = +b.dataset.km! * 1000;
    $('.spots-radius').querySelectorAll('[data-km]').forEach((el) => el.setAttribute('aria-checked', String(el === b)));
    on.radius();
  });
  $('.views').innerHTML = VIEWS.map((v) => `<button type="button" class="chip" role="radio" data-view="${v}" aria-checked="${v === state.view}">${t.views[v]}</button>`).join('');
  $('.views').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
    if (!b) return;
    state.view = b.dataset.view as View;
    $('.views').querySelectorAll('[data-view]').forEach((el) => el.setAttribute('aria-checked', String(el === b)));
    updateLegend();
    on.view();
  });
  $('.weights-list').innerHTML = LAYERS.map((k) => `<label class="w-row" title="${t.hints[k]}"><span>${t.views[k]}</span><input type="range" min="0" max="100" step="5" data-w="${k}" value="${state.weights[k]}" aria-label="${t.views[k]}" /><output>${state.weights[k]}</output></label>`).join('');
  $('.weights-list').addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    state.weights[el.dataset.w as Layer] = +el.value;
    el.nextElementSibling!.textContent = el.value;
    on.weights();
  });
  $('.reset').addEventListener('click', () => {
    Object.assign(state.weights, DEFAULT_WEIGHTS);
    $('.weights-list').querySelectorAll<HTMLInputElement>('input').forEach((el) => { el.value = String(state.weights[el.dataset.w as Layer]); el.nextElementSibling!.textContent = el.value; });
    on.weights();
  });
  $('.legend-bar').style.background = cssGradient();
  updateLegend();
}

function updateLegend() {
  const v = state.view;
  const [lo, hi] = v === 'index' ? [t.legendLow, t.legendHigh] : t.legendLayer[v];
  $('.legend-title').textContent = t.views[v];
  $('.legend-min').textContent = lo;
  $('.legend-max').textContent = hi;
}

// Подробности слоя из сырых измерений клетки.
function detail(k: Layer, r: Raw): string {
  switch (k) {
    case 'noise': {
      const near = ROADS.map((c) => ({ c, d: r[c] })).sort((a, b) => a.d - b.d)[0];
      const sc = (k: Parameters<typeof screenBit>[0]) => (r.screen & screenBit(k) ? ` (${t.screened})` : '');
      const parts = [near.d < distCap(near.c) ? t.roadAt(near.d, t.road[near.c], distCap(near.c)) + sc(near.c) : t.noRoad];
      if (r.rail < NOISE_RANGE.rail * 2) parts.push(t.railAt(r.rail, distCap('rail')) + sc('rail'));
      if (r.air < NOISE_RANGE.air * 2) parts.push(t.airAt(r.air, distCap('air')) + sc('air'));
      return parts.join(', ');
    }
    case 'dark': return `${t.light(r.light)} · ${t.bortle(bortle(r.light))}`;
    case 'remote': return t.remote(r.pop, r.building, distCap('building'));
    case 'nature': return t.nature(r.forest, r.water, r.open);
    case 'signal': return t.tower(r.tower, distCap('tower'));
  }
}

export function showCell(point: [number, number], raw: Raw, s: Scores, idx: number) {
  $('.empty').hidden = true;
  $('.outside').hidden = true;
  const res = $('.result');
  res.hidden = false;
  $('.score').textContent = String(idx);
  $('.verdict').textContent = t.verdict(idx);
  $('.place').textContent = `${point[1].toFixed(4)}, ${point[0].toFixed(4)}`;
  $('.breakdown').innerHTML = LAYERS.map((k) => `<li class="layer-row" data-layer="${k}"><div class="l-head"><b>${t.views[k]}</b><span class="l-val">${s[k]}</span><small class="l-w">× ${state.weights[k]}</small></div><i class="l-bar"><i style="width:${s[k]}%"></i></i><small class="l-detail">${detail(k, raw)}</small></li>`).join('');
}

export function updateIndex(idx: number) {
  $('.score').textContent = String(idx);
  $('.verdict').textContent = t.verdict(idx);
  LAYERS.forEach((k) => ($(`.layer-row[data-layer="${k}"] .l-w`).textContent = `× ${state.weights[k]}`));
}

// Список «тише рядом»: значение, расстояние и направление, вердикт.
export function showSpots(spots: Spot[], onPick: (s: Spot) => void) {
  const list = $('.spots-list');
  list.innerHTML = spots.length
    ? spots.map((s, i) => `<li><button type="button" data-i="${i}"><b>${s.value}</b><span>${t.verdict(s.value)}</span><small>${t.away(s.dist, t.dirs[dirIndex(s.bearing)])}</small></button></li>`).join('')
    : `<li class="note">${t.spotsNone}</li>`;
  list.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => onPick(spots[+b.dataset.i!])));
}

// Сравнение: A — закреплённая точка, B — текущая. Без B (или B = A) — подсказка кликнуть вторую.
export function showCompare(a: Cell | null, b: Cell | null) {
  const box = $('.compare');
  box.hidden = !a;
  $('.compare-btn').hidden = !!a;
  if (!a) return;
  $('.compare-hint').hidden = !!b;
  const table = $('.compare-table');
  table.hidden = !b;
  if (!b) return;
  const row = (name: string, x: number, y: number) => `<tr><td>${name}</td><td class="${x > y ? 'best' : ''}">${x}</td><td class="${y > x ? 'best' : ''}">${y}</td></tr>`;
  table.innerHTML = `<thead><tr><th></th><th>A</th><th>B</th></tr></thead><tbody>${row(t.indexName, a.idx, b.idx)}${LAYERS.map((k) => row(t.views[k], a.s[k], b.s[k])).join('')}</tbody>`;
}

export function showOutside() {
  $('.empty').hidden = true;
  $('.result').hidden = true;
  $('.outside').hidden = false;
}

export function showEmpty() {
  $('.empty').hidden = false;
  $('.result').hidden = true;
  $('.outside').hidden = true;
}
