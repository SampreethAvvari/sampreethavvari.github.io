// Lit marks: a logo or a line of type becomes a solid object.
//
// The flat picture is reduced to one mask, a distance field is computed from
// it, and the shape is drawn as a stack of thin layers that the shader cuts
// out with the field. From the side the stack reads as a real thickness, and
// the field's slope gives the bevel its normal, so any flat image gets a
// machined edge that catches the light.

import { BufferAttribute, BufferGeometry } from "three";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** A logo as white on transparent: ink stays, the paper colour goes. */
export async function logoMask(src: string, width: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const ar = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = Math.max(8, Math.round(width / ar));
  const c = cv.getContext("2d", { willReadFrequently: true })!;
  c.imageSmoothingQuality = "high";
  c.drawImage(img, 0, 0, cv.width, cv.height);
  const px = c.getImageData(0, 0, cv.width, cv.height);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.min(d[i], d[i + 1], d[i + 2]) / 255;
    const keep = (d[i + 3] / 255) * (1 - smooth(0.62, 0.9, m));
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = keep * 255;
  }
  c.putImageData(px, 0, 0);
  return cv;
}

/** Lines of type as a mask. */
export function typeMask(lines: string[], fontPx: number, weight: number, track: number): HTMLCanvasElement {
  const probe = document.createElement("canvas").getContext("2d")! as CanvasRenderingContext2D & { letterSpacing?: string };
  const f = `${weight} ${fontPx}px Inter, "Inter Fallback", Arial, sans-serif`;
  probe.font = f;
  if ("letterSpacing" in probe) probe.letterSpacing = `${track}px`;
  const w = Math.max(...lines.map((l) => probe.measureText(l).width));
  const lh = fontPx * 0.98;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w + fontPx * 0.1);
  cv.height = Math.ceil(lh * lines.length + fontPx * 0.14);
  const c = cv.getContext("2d")! as CanvasRenderingContext2D & { letterSpacing?: string };
  c.font = f;
  if ("letterSpacing" in c) c.letterSpacing = `${track}px`;
  c.fillStyle = "#fff";
  c.textBaseline = "alphabetic";
  lines.forEach((l, i) => c.fillText(l, fontPx * 0.04, fontPx * 0.82 + i * lh));
  return cv;
}

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

export type Field = { data: Uint8Array; width: number; height: number; spread: number; aspect: number };

/** Signed distance field of a mask, with a margin so the bevel has room. */
export function distanceField(mask: HTMLCanvasElement, spread: number): Field {
  const pad = Math.ceil(spread) + 2;
  const w = mask.width + pad * 2;
  const h = mask.height + pad * 2;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d", { willReadFrequently: true })!;
  c.drawImage(mask, pad, pad);
  const a = c.getImageData(0, 0, w, h).data;
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
  return { data, width: w, height: h, spread, aspect: w / h };
}

/** A stack of quads, front layer first so the depth test saves work. */
export function layeredQuads(layers: number): BufferGeometry {
  const pos = new Float32Array(layers * 4 * 3);
  const uv = new Float32Array(layers * 4 * 2);
  const lay = new Float32Array(layers * 4);
  const idx = new Uint16Array(layers * 6);
  for (let i = 0; i < layers; i++) {
    const l = layers > 1 ? 1 - i / (layers - 1) : 1;
    const b = i * 4;
    const corners = [
      [-0.5, -0.5, 0, 1],
      [0.5, -0.5, 1, 1],
      [0.5, 0.5, 1, 0],
      [-0.5, 0.5, 0, 0],
    ];
    corners.forEach((co, k) => {
      pos.set([co[0], co[1], 0], (b + k) * 3);
      uv.set([co[2], co[3]], (b + k) * 2);
      lay[b + k] = l;
    });
    idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setAttribute("aLayer", new BufferAttribute(lay, 1));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}
