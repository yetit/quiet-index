// Синтетические сцены для ядра: оценки слоёв, индекс, кодирование планов.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_WEIGHTS, LAYERS, index, indexAll, parseWeights, scores, weightsParam } from '../src/core/index.ts';
import { PLANES, decode, deltaDecode, deltaEncode, distCap, encode, rawAt, splitPlanes, type Raw } from '../src/core/layers.ts';
import { cellOf, centerOf, gridFor, metersPerCell } from '../src/core/grid.ts';

// Глушь: всё далеко, темно, пусто, лес.
const wild: Raw = { motorway: 12750, trunk: 12750, primary: 6375, secondary: 6375, tertiary: 6375, rail: 12750, air: 25500, building: 6375, tower: 25500, light: 0.1, pop: 0, forest: 90, water: 5, open: 5 };

test('глушь: все оценки у максимума, связи нет', () => {
  const s = scores(wild);
  assert.deepEqual(s, { noise: 100, dark: 100, remote: 100, nature: 98, signal: 0 });
  assert.equal(index(s, DEFAULT_WEIGHTS), 100);
});

test('у автомагистрали шумно, даже если остальное идеально', () => {
  const s = scores({ ...wild, motorway: 0 });
  assert.equal(s.noise, 0);
  s.noise = scores({ ...wild, motorway: 1250 }).noise;
  assert.equal(s.noise, 50);
  // Слабейший источник не улучшает оценку: tertiary в 400 м — тишина, motorway в 1250 м — всё ещё 50.
  assert.equal(scores({ ...wild, motorway: 1250, tertiary: 400 }).noise, 50);
});

test('центр города: светло, людно, нет природы, связь есть', () => {
  const s = scores({ ...wild, secondary: 0, light: 60, pop: 12000, building: 0, tower: 300, forest: 2, water: 0, open: 3 });
  assert.deepEqual(s, { noise: 0, dark: 0, remote: 0, nature: 4, signal: 100 });
  assert.equal(index(s, DEFAULT_WEIGHTS), 1);
});

test('темнота: лог-шкала между 0,25 и 50 нВт', () => {
  assert.equal(scores({ ...wild, light: 0.25 }).dark, 100);
  assert.equal(scores({ ...wild, light: Math.sqrt(0.25 * 50) }).dark, 50);
  assert.equal(scores({ ...wild, light: 50 }).dark, 0);
});

test('индекс: взвешенное среднее, нулевые веса — простое среднее', () => {
  const s = { noise: 100, dark: 0, remote: 50, nature: 50, signal: 100 };
  assert.equal(index(s, { noise: 1, dark: 1, remote: 0, nature: 0, signal: 0 }), 50);
  assert.equal(index(s, { noise: 3, dark: 1, remote: 0, nature: 0, signal: 0 }), 75);
  assert.equal(index(s, { noise: 0, dark: 0, remote: 0, nature: 0, signal: 0 }), 60);
});

test('веса в URL: туда и обратно, мусор отвергается', () => {
  assert.equal(weightsParam(DEFAULT_WEIGHTS), '35-25-20-20-0');
  assert.deepEqual(parseWeights('35-25-20-20-0'), DEFAULT_WEIGHTS);
  assert.equal(parseWeights('1-2-3'), null);
  assert.equal(parseWeights('1-2-3-4-101'), null);
  assert.equal(LAYERS.length, 5);
});

test('кодирование планов: расстояния с шагом, свет и плотность логарифмически, потолок 255', () => {
  assert.equal(decode('secondary', encode('secondary', 330)), 350);
  assert.equal(encode('motorway', 1e6), 255);
  assert.equal(decode('motorway', 255), distCap('motorway'));
  assert.ok(Math.abs(decode('light', encode('light', 1)) - 1) < 0.05);
  assert.ok(Math.abs(decode('light', encode('light', 20)) - 20) < 0.6);
  assert.ok(Math.abs(decode('pop', encode('pop', 100)) - 100) < 3);
  assert.equal(encode('pop', 1e9), 255);
  assert.equal(encode('forest', 101), 50);
  assert.equal(decode('forest', encode('forest', 63)), 64);
});

test('планы: дельты по строкам обратимы, разбор буфера возвращает значения клетки', () => {
  const cols = 4, rows = 2, n = cols * rows;
  const buf = new Uint8Array(n * PLANES.length);
  PLANES.forEach((p, i) => { const plane = new Uint8Array(n).map((_, k) => (p === 'mask' ? 1 : (k * 37 + i * 11) & 255)); buf.set(deltaEncode(plane, cols), i * n); });
  const plane = new Uint8Array([5, 250, 3, 3, 7, 0, 255, 128]);
  assert.deepEqual(deltaDecode(deltaEncode(plane, cols), cols), plane);
  const g = splitPlanes(buf, cols, rows);
  assert.equal(g.planes.mask[3], 1);
  assert.equal(g.planes.primary[5], (5 * 37 + 3 * 11) & 255);
  assert.equal(rawAt(g, 5).primary, 50 * ((5 * 37 + 3 * 11) & 255));
  assert.throws(() => splitPlanes(buf.subarray(1), cols, rows));
});

test('сетка: квадратные клетки в Mercator, центр клетки попадает в ту же клетку', () => {
  const g = gridFor({ west: 18.4, south: 41.8, east: 20.4, north: 43.6 }, 250);
  assert.ok(Math.abs(metersPerCell(g, 0) - 250) < 5 && Math.abs(metersPerCell(g, g.rows - 1) - 250) < 5);
  assert.ok(g.bbox.south <= 41.8 && g.bbox.south > 41.79);
  for (const [c, r] of [[0, 0], [g.cols - 1, g.rows - 1], [100, 200]]) assert.deepEqual(cellOf(g, ...centerOf(g, c, r)), { col: c, row: r });
  assert.equal(cellOf(g, 0, 0), null);
});

test('indexAll: клетки вне маски — 255, остальные как index()', () => {
  const s = { noise: new Uint8Array([100, 20]), dark: new Uint8Array([0, 20]), remote: new Uint8Array([50, 20]), nature: new Uint8Array([50, 20]), signal: new Uint8Array([100, 20]) };
  const out = indexAll(s, new Uint8Array([1, 0]), { noise: 3, dark: 1, remote: 0, nature: 0, signal: 0 }, new Uint8Array(2));
  assert.deepEqual([...out], [75, 255]);
  assert.equal(indexAll(s, new Uint8Array([1, 1]), { noise: 0, dark: 0, remote: 0, nature: 0, signal: 0 }, new Uint8Array(2))[0], 60);
});
