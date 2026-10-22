// Загрузка данных региона: meta.json + scores.gz (маска и пять оценок — карта красится сразу),
// затем grid.gz с измерениями для панели. Оба файла — планарные uint8 с дельтами по строкам, gzip.
import { SCORE_PLANES, type Layer } from '../core/index.ts';
import type { GridMeta } from '../core/grid.ts';
import { splitPlanes, unpackPlanes, type Grid } from '../core/layers.ts';

export type Meta = GridMeta & { region: string; built: string; cells: number; sources: Record<string, unknown> };
export type Data = { meta: Meta; mask: Uint8Array; scores: Record<Layer, Uint8Array> };

async function gunzip(r: Response) {
  if (!r.ok) throw new Error(`${r.url}: ${r.status}`);
  const raw = new Uint8Array(await r.arrayBuffer());
  // Хостинг мог сам снять gzip (Content-Encoding) — тогда магии 1f 8b уже нет.
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) return raw;
  return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

export async function loadScores(base: string, id: string): Promise<Data> {
  const [meta, buf] = await Promise.all([
    fetch(`${base}data/${id}/meta.json`).then((r) => (r.ok ? (r.json() as Promise<Meta>) : Promise.reject(new Error(`meta ${r.status}`)))),
    fetch(`${base}data/${id}/scores.gz`).then(gunzip),
  ]);
  const { mask, ...scores } = unpackPlanes(buf, SCORE_PLANES, meta.cols, meta.rows);
  return { meta, mask, scores };
}

export const loadGrid = (base: string, id: string, meta: Meta): Promise<Grid> => fetch(`${base}data/${id}/grid.gz`).then(gunzip).then((buf) => splitPlanes(buf, meta.cols, meta.rows));
