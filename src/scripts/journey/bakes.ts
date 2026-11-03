// The planet's slowest arithmetic: the ground, the sand and the moons, worked out from
// nothing but numbers. No three.js and no page in here, so it runs on another thread
// (bake.worker.ts) as well as this one, and gives the same bytes on either.

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Small seeded random source so every visit builds the same ship. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ ground

export function hash2(a: number, b: number) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise2(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm2(x: number, z: number) {
  return noise2(x, z) * 0.55 + noise2(x * 2.1 + 5.2, z * 2.1 + 1.3) * 0.3 + noise2(x * 4.3 + 9.1, z * 4.3 + 7.7) * 0.15;
}

/** Where he stands for the helmet and the touch, far out on the flat. */
export const STAND = { x: -1, z: -124 };

/** Ground height in site space: broad soft swells on the plain, long dunes beyond it, low ridges far off. */
export function groundHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  const toStand = Math.hypot(x - STAND.x, z - STAND.z);
  const n = fbm2(x * 0.0016, z * 0.0016);
  const w = x * 0.0075 + z * 0.0031 + n * 5.5;
  const crest = Math.pow(0.5 + 0.5 * Math.sin(w), 3);
  // A second set of dunes at another angle, so no two ridges run the same way.
  const n2 = fbm2(x * 0.0009 + 11.0, z * 0.0009 + 4.0);
  const w2 = x * -0.0031 + z * 0.0062 + n2 * 7.0;
  const crest2 = Math.pow(0.5 + 0.5 * Math.sin(w2), 2.4);
  let h = (crest * (0.8 + 5.8 * n) + crest2 * (0.5 + 7.5 * n2)) * smooth(30, 300, r) * smooth(30, 160, toStand);
  // Soft swells across the plain, flat only right where the lander and he stand.
  const swell = fbm2(x * 0.0093 + 2.3, z * 0.0141 + 8.1) - 0.5;
  h += swell * 3.0 * smooth(6, 34, r) * smooth(14, 44, toStand);
  // Low ridges that break the far horizon.
  const far = smooth(500, 2200, r);
  if (far > 0) h += far * (Math.pow(fbm2(x * 0.0009 + 3.1, z * 0.0009 + 7.7), 2.2) * 45 + crest * 6);
  return h - (r * r) / (2 * 90000);
}

export type Grid = { d: Float32Array; cx: number; cz: number; half: number; cell: number };
export type GroundGrids = { N: number; fine: Grid; wide: Grid };

/** The ground baked to two grids, one fine around the story and one for the far land. */
export function groundGrids(low: boolean): GroundGrids {
  const N = low ? 128 : 256;
  const mk = (cx: number, cz: number, half: number): Grid => {
    const d = new Float32Array((N + 1) * (N + 1));
    const cell = (half * 2) / N;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) d[j * (N + 1) + i] = groundHeight(cx - half + i * cell, cz - half + j * cell);
    return { d, cx, cz, half, cell };
  };
  return { N, fine: mk(0, -110, 210), wide: mk(0, 0, 6400) };
}

/** Height anywhere, read from the two grids. */
export function groundSampler({ N, fine, wide }: GroundGrids) {
  const at = (g: Grid, x: number, z: number) => {
    const u = clamp((x - g.cx + g.half) / g.cell, 0, N - 0.001);
    const v = clamp((z - g.cz + g.half) / g.cell, 0, N - 0.001);
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    const m = N + 1;
    const a = g.d[j * m + i];
    const b = g.d[j * m + i + 1];
    const c = g.d[(j + 1) * m + i];
    const e = g.d[(j + 1) * m + i + 1];
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + e) * fu * fv;
  };
  return (x: number, z: number) => (Math.abs(x) < 200 && Math.abs(z + 110) < 200 ? at(fine, x, z) : at(wide, x, z));
}

// ------------------------------------------------------------------ sand

/** A tiling map of wind ripples: RG hold the slope, B the height, for the raking light to catch. */
export function rippleData(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const h = new Float32Array(size * size);
  const TAU = Math.PI * 2;
  // Periodic noise so the warp tiles.
  const pn = (x: number, y: number, f: number, s: number) => {
    const X = x * f;
    const Y = y * f;
    const ix = Math.floor(X);
    const iy = Math.floor(Y);
    const fx = X - ix;
    const fy = Y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (a: number, b: number) => hash2(((a % f) + f) % f + s, ((b % f) + f) % f + s * 1.7);
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const c = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size;
      const v = j / size;
      const warp = (pn(u, v, 4, 1) - 0.5) * 0.9 + (pn(u, v, 11, 2) - 0.5) * 0.25;
      // Ridges mostly across the wind, sharper on the lee side.
      const a = (v * 26 + u * 2 + warp * 5.5) * TAU;
      const s = 0.5 + 0.5 * Math.sin(a + 0.6 * Math.sin(a));
      const breakup = 0.55 + 0.45 * pn(u, v, 7, 3);
      h[j * size + i] = Math.pow(s, 1.4) * breakup + (pn(u, v, 64, 4) - 0.5) * 0.1;
    }
  }
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const hL = h[j * size + ((i + size - 1) % size)];
      const hR = h[j * size + ((i + 1) % size)];
      const hD = h[((j + size - 1) % size) * size + i];
      const hU = h[((j + 1) % size) * size + i];
      const k = (j * size + i) * 4;
      data[k] = clamp(128 + (hR - hL) * 300, 0, 255);
      data[k + 1] = clamp(128 + (hU - hD) * 300, 0, 255);
      data[k + 2] = clamp(h[j * size + i] * 255, 0, 255);
      const u = i / size;
      const v = j / size;
      data[k + 3] = clamp((pn(u, v, 5, 7) * 0.6 + pn(u, v, 13, 8) * 0.3 + pn(u, v, 29, 9) * 0.1) * 255, 0, 255);
    }
  }
  return data;
}

/** One tile of close sand, how high a grain stands, and the small ripples. */
export const GRAIN_T = 0.045;
export const GRAIN_A = 0.0004;
export const GRAIN_SLOPE = 1.4;

/** Sand up close, one tile: B the height of each grain, RG its slope, A each grain's own tone. */
export function grainData(size: number, cells: number): Uint8Array {
  const h = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  // One grain per cell: where it sits, how big it is, its tone. Baked first, so each pixel only looks them up.
  const pts = new Float32Array(cells * cells * 4);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const k = (cy * cells + cx) * 4;
      pts[k] = hash2(cx + 0.31, cy + 0.17);
      pts[k + 1] = hash2(cx + 7.13, cy + 3.71);
      pts[k + 2] = hash2(cx + 2.41, cy + 9.23);
      pts[k + 3] = hash2(cx + 5.57, cy + 1.93);
    }
  }
  for (let j = 0; j < size; j++) {
    const v = (j / size) * cells;
    const iv = Math.floor(v);
    for (let i = 0; i < size; i++) {
      const u = (i / size) * cells;
      const iu = Math.floor(u);
      let best = 0;
      let t = 0.5;
      for (let b = -1; b <= 1; b++) {
        const cy = (iv + b + cells) % cells;
        for (let a = -1; a <= 1; a++) {
          const cx = (iu + a + cells) % cells;
          const k = (cy * cells + cx) * 4;
          const big = pts[k + 2];
          const rad = 0.5 + 0.42 * big;
          const dx = u - (iu + a + pts[k]);
          const dy = v - (iv + b + pts[k + 1]);
          const d2 = (dx * dx + dy * dy) / (rad * rad);
          if (d2 < 1) {
            const dome = Math.sqrt(1 - d2) * (0.55 + 0.45 * big);
            if (dome > best) {
              best = dome;
              t = pts[k + 3];
            }
          }
        }
      }
      h[j * size + i] = best;
      tone[j * size + i] = t;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const texel = GRAIN_T / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (h[j * size + ((i + 1) % size)] - h[j * size + ((i + size - 1) % size)]) * GRAIN_A / (2 * texel);
      const dy = (h[((j + 1) % size) * size + i] - h[((j + size - 1) % size) * size + i]) * GRAIN_A / (2 * texel);
      const k = (j * size + i) * 4;
      data[k] = clamp(128 + (dx / GRAIN_SLOPE) * 127, 0, 255);
      data[k + 1] = clamp(128 + (dy / GRAIN_SLOPE) * 127, 0, 255);
      data[k + 2] = clamp(h[j * size + i] * 255, 0, 255);
      data[k + 3] = clamp(tone[j * size + i] * 255, 0, 255);
    }
  }
  return data;
}

// ------------------------------------------------------------------ moons

/** A moon's surface, baked once: RG hold the slope, B the brightness. Maria, craters and rays. */
export function moonData(w: number, seed: number): Uint8Array {
  const h = w >> 1;
  const hgt = new Float32Array(w * h);
  const alb = new Float32Array(w * h);
  const r = rng(seed * 991 + 7);
  const TAU = Math.PI * 2;
  // Unit sphere direction per texel, so nothing pinches at the poles.
  const dx = new Float32Array(w * h);
  const dy = new Float32Array(w * h);
  const dz = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const th = ((j + 0.5) / h) * Math.PI;
    for (let i = 0; i < w; i++) {
      const ph = ((i + 0.5) / w) * TAU;
      const k = j * w + i;
      dx[k] = Math.sin(th) * Math.cos(ph);
      dy[k] = Math.cos(th);
      dz[k] = Math.sin(th) * Math.sin(ph);
      // Broad dark seas and fine mottling.
      const n = fbm2(dx[k] * 1.7 + dz[k] * 1.1 + seed, dy[k] * 1.9 + dz[k] * 0.8 + seed * 2);
      const f = fbm2(dx[k] * 9 + dy[k] * 4 + seed, dz[k] * 9 - dy[k] * 3);
      alb[k] = 0.56 + 0.2 * f - 0.14 * smooth(0.4, 0.66, n);
      hgt[k] = f * 0.03;
    }
  }
  const CR = Math.round(40 + (w / 512) * 50);
  for (let c = 0; c < CR; c++) {
    const u = r() * 2 - 1;
    const a = r() * TAU;
    const s = Math.sqrt(1 - u * u);
    const cx = s * Math.cos(a);
    const cy = u;
    const cz = s * Math.sin(a);
    const big = r() > 0.94;
    const rad = big ? 0.1 + r() * 0.14 : 0.012 + Math.pow(r(), 2.6) * 0.09;
    const depth = rad * 0.5;
    const cosR = Math.cos(rad * 2.6);
    const bright = 0.05 + r() * 0.1;
    for (let k = 0; k < w * h; k++) {
      const dot = dx[k] * cx + dy[k] * cy + dz[k] * cz;
      if (dot < cosR) continue;
      const q = Math.acos(Math.min(1, dot)) / rad;
      if (q < 1) {
        hgt[k] += -depth * (1 - q * q) + depth * 0.5 * Math.pow(q, 8);
        alb[k] -= 0.05 * (1 - q);
      } else if (q < 1.5) {
        hgt[k] += depth * 0.5 * (1 - (q - 1) * 2);
        alb[k] += bright * 0.6 * (1 - (q - 1) * 2);
      } else {
        alb[k] += (big ? bright : bright * 0.3) * (1 - (q - 1.5) / 1.1) * 0.5;
      }
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const hl = hgt[j * w + ((i + w - 1) % w)];
      const hr = hgt[j * w + ((i + 1) % w)];
      const hd = hgt[Math.max(0, j - 1) * w + i];
      const hu = hgt[Math.min(h - 1, j + 1) * w + i];
      const scale = w / 4;
      data[k * 4] = clamp(128 + (hl - hr) * scale * 127, 0, 255);
      data[k * 4 + 1] = clamp(128 + (hd - hu) * scale * 127, 0, 255);
      data[k * 4 + 2] = clamp(alb[k] * 255, 0, 255);
      data[k * 4 + 3] = 255;
    }
  }
  return data;
}
