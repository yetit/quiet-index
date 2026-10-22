// Продукт региона согласован: scores.gz совпадает с оценками, посчитанными из grid.gz, маска одна и та же.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { regions } from '../regions.config.mjs';
import { LAYERS, SCORE_PLANES, scores } from '../src/core/index.ts';
import { rawAt, splitPlanes, unpackPlanes } from '../src/core/layers.ts';

for (const { id } of regions) {
  test(`${id}: scores.gz = scores(grid.gz) на выборке клеток`, { skip: !existsOr(id) }, () => {
    const meta = JSON.parse(readFileSync(`public/data/${id}/meta.json`, 'utf8'));
    const grid = splitPlanes(gunzipSync(readFileSync(`public/data/${id}/grid.gz`)), meta.cols, meta.rows);
    const sc = unpackPlanes(gunzipSync(readFileSync(`public/data/${id}/scores.gz`)), SCORE_PLANES, meta.cols, meta.rows);
    assert.deepEqual(sc.mask, grid.planes.mask);
    let n = 0;
    const step = Math.max(1, Math.floor((meta.cols * meta.rows) / 2000));
    for (let i = 0; i < meta.cols * meta.rows; i += step) {
      if (!grid.planes.mask[i]) continue;
      const s = scores(rawAt(grid, i));
      for (const k of LAYERS) assert.equal(sc[k][i], s[k], `${k} в клетке ${i}`);
      n++;
    }
    assert.ok(n > 100, `проверено ${n} клеток`);
    assert.equal(meta.cells, grid.planes.mask.reduce((a: number, b: number) => a + b, 0));
  });
}
function existsOr(id: string) { try { readFileSync(`public/data/${id}/scores.gz`); return true; } catch { return false; } }

import { cellOf } from '../src/core/grid.ts';
for (const r of regions) {
  test(`${r.id}: примеры-точки лежат на суше внутри маски`, { skip: !existsOr(r.id) }, () => {
    const meta = JSON.parse(readFileSync(`public/data/${r.id}/meta.json`, 'utf8'));
    const sc = unpackPlanes(gunzipSync(readFileSync(`public/data/${r.id}/scores.gz`)), SCORE_PLANES, meta.cols, meta.rows);
    for (const e of r.examples) {
      const c = cellOf(meta, e.p[0], e.p[1]);
      assert.ok(c && sc.mask[c.row * meta.cols + c.col] === 1, `${e.name.ru} (${e.p}) вне маски`);
    }
  });
}
