// Точное евклидово преобразование расстояния (Felzenszwalb & Huttenlocher, 2012): O(n) парабол по строкам и столбцам.
// f — Float32Array w×h: 0 у источников, INF иначе; на выходе — квадраты расстояний в клетках (в том же массиве).
// src (необязательно) — Int32Array w×h с индексом клетки-источника (у источников — свой индекс): на выходе в нём
// индекс ближайшего источника для каждой клетки.
export const INF = 1e20;

export function edt(f, w, h, src) {
  const n = Math.max(w, h);
  const v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n), gi = new Int32Array(n);
  const pass = (len, stride, off) => {
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      const fq = f[off + q * stride] + q * q;
      let s = (fq - (f[off + v[k] * stride] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (fq - (f[off + v[k] * stride] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; g[q] = (q - v[k]) * (q - v[k]) + f[off + v[k] * stride]; if (src) gi[q] = src[off + v[k] * stride]; }
    for (let q = 0; q < len; q++) { f[off + q * stride] = g[q]; if (src) src[off + q * stride] = gi[q]; }
  };
  for (let x = 0; x < w; x++) pass(h, w, x);
  for (let y = 0; y < h; y++) pass(w, 1, y * w);
  return f;
}
