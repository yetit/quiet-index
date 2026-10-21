import assert from 'node:assert/strict';
import { test } from 'node:test';
import { centerOf, gridFor } from '../src/core/grid.ts';
import { dirIndex, distBearing, topSpots } from '../src/core/spots.ts';

test('азимут и расстояние: восток — 90°, километр — километр', () => {
  const [d, b] = distBearing([19, 42.7], [19.0122, 42.7]);
  assert.ok(Math.abs(d - 1000) < 15, `${d}`);
  assert.ok(Math.abs(b - 90) < 0.1);
  assert.equal(dirIndex(b), 2);
  assert.equal(dirIndex(350), 0);
});

test('топ тихих мест: лучшие по значению, в радиусе, с разносом', () => {
  const g = gridFor({ west: 19, south: 42.5, east: 19.3, north: 42.8 }, 250);
  const v = new Uint8Array(g.cols * g.rows).fill(40);
  const at = (c: number, r: number) => r * g.cols + c;
  v[at(40, 40)] = 95; v[at(41, 40)] = 94; // сосед — отсеивается разносом 2 км
  v[at(60, 40)] = 90; // ~5 км восточнее
  v[at(40, 10)] = 99; // ~7,5 км севернее — за радиусом 6 км
  v[at(5, 5)] = 255; // вне маски
  const center = centerOf(g, 40, 40);
  const s = topSpots(v, g, center, 6000, 3);
  assert.deepEqual(s.slice(0, 2).map((x) => [x.col, x.row, x.value]), [[40, 40, 95], [60, 40, 90]]);
  assert.ok(s[2].value === 40 && s[2].dist >= 2000, 'третья — фон с разносом ≥ 2 км');
  assert.ok(s[1].dist > 4500 && s[1].dist < 5500 && dirIndex(s[1].bearing) === 2);
  assert.equal(topSpots(v, g, center, 10000, 1)[0].value, 99);
});
