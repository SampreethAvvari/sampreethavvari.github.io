// The arithmetic of a signed distance field, with no page in sight, so it can run on
// another thread (field.worker.ts) as well as this one and give the same bytes.

// One dimensional squared distance transform (Felzenszwalb and Huttenlocher).
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

function edt(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
}

/** The field from a mask's RGBA pixels: its alpha is the shape. */
export function fieldFromPixels(a: Uint8ClampedArray, w: number, h: number, spread: number): Uint8Array {
  const INF = 1e20;
  const outside = new Float64Array(w * h);
  const inside = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = a[i * 4 + 3] / 255;
    // Sub pixel start from the mask's soft edge keeps the outline smooth.
    if (v >= 0.98) {
      outside[i] = 0;
      inside[i] = INF;
    } else if (v <= 0.02) {
      outside[i] = INF;
      inside[i] = 0;
    } else {
      const o = 0.5 - v;
      outside[i] = o > 0 ? o * o : 0;
      inside[i] = o < 0 ? o * o : 0;
    }
  }
  edt(outside, w, h);
  edt(inside, w, h);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const sd = Math.sqrt(inside[i]) - Math.sqrt(outside[i]);
    data[i] = Math.max(0, Math.min(255, Math.round((0.5 + sd / (2 * spread)) * 255)));
  }
  return data;
}
