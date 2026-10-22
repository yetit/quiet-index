import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INF, edt } from '../scripts/edt.mjs';

test('EDT: точное евклидово расстояние до ближайшего источника', () => {
  const w = 7, h = 5, f = new Float32Array(w * h).fill(INF);
  f[1 * w + 1] = 0; f[3 * w + 5] = 0;
  const src = new Int32Array(w * h).map((_, i) => (f[i] === 0 ? i : -1));
  edt(f, w, h, src);
  const d = (x: number, y: number) => Math.sqrt(f[y * w + x]);
  assert.equal(src[0 * w + 6], 3 * w + 5); // ближайший к (6,0) — источник (5,3)
  assert.equal(src[4 * w + 0], 1 * w + 1);
  assert.equal(src[1 * w + 1], 1 * w + 1);
  assert.equal(d(1, 1), 0);
  assert.ok(Math.abs(d(4, 1) - Math.hypot(1, 2)) < 1e-6); // ближе второй источник (5,3)
  assert.ok(Math.abs(d(3, 3) - Math.hypot(2, 0)) < 1e-6);
  assert.ok(Math.abs(d(0, 4) - Math.hypot(1, 3)) < 1e-6);
  assert.ok(Math.abs(d(6, 0) - Math.hypot(1, 3)) < 1e-6);
});
