// Загрузка растра региона (grid.gz + meta.json) и разовый расчёт оценок всех клеток по слоям.
import { LAYERS, scores, type Layer } from '../core/index.ts';
import type { GridMeta } from '../core/grid.ts';
import { rawAt, splitPlanes, type Grid } from '../core/layers.ts';

export type Meta = GridMeta & { region: string; built: string; cells: number; sources: Record<string, unknown> };
export type Data = { meta: Meta; grid: Grid; scores: Record<Layer, Uint8Array> };

export async function loadData(base: string, id: string): Promise<Data> {
  const [meta, buf] = await Promise.all([
    fetch(`${base}data/${id}/meta.json`).then((r) => (r.ok ? (r.json() as Promise<Meta>) : Promise.reject(new Error(`meta ${r.status}`)))),
    fetch(`${base}data/${id}/grid.gz`).then(async (r) => {
      if (!r.ok) throw new Error(`grid ${r.status}`);
      const raw = new Uint8Array(await r.arrayBuffer());
      // Хостинг мог сам снять gzip (Content-Encoding) — тогда магии 1f 8b уже нет.
      if (raw[0] !== 0x1f || raw[1] !== 0x8b) return raw;
      return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    }),
  ]);
  const grid = splitPlanes(buf, meta.cols, meta.rows);
  const n = meta.cols * meta.rows;
  const out = Object.fromEntries(LAYERS.map((k) => [k, new Uint8Array(n)])) as Record<Layer, Uint8Array>;
  const mask = grid.planes.mask;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const s = scores(rawAt(grid, i));
    for (const k of LAYERS) out[k][i] = s[k];
  }
  return { meta, grid, scores: out };
}
