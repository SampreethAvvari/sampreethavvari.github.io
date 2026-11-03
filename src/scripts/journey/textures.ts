// Procedural textures drawn once on a 2D canvas: hull panels, a soft glow
// sprite and a cloud puff. Nothing is fetched over the network.

import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, ClampToEdgeWrapping } from "three";

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

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  return { c, g };
}

export interface PanelSet {
  map: CanvasTexture;
  rough: CanvasTexture;
  glow: CanvasTexture;
}

/**
 * Hull panels. One subdivision drives three maps so the colour seams, the
 * rougher seams and the few glowing seams all line up.
 */
export function panelTextures(size: number, seed = 7): PanelSet {
  const r = rng(seed);
  const col = canvas(size);
  const rou = canvas(size);
  const glo = canvas(size);
  const s = size / 1024;

  col.g.fillStyle = "#e9ebef";
  col.g.fillRect(0, 0, size, size);
  rou.g.fillStyle = "rgb(105,105,105)";
  rou.g.fillRect(0, 0, size, size);
  glo.g.fillStyle = "#000";
  glo.g.fillRect(0, 0, size, size);

  type Rect = [number, number, number, number];
  const rects: Rect[] = [];
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    const stop = depth > 5 || (depth > 2 && r() < 0.22) || w < 40 * s || h < 40 * s;
    if (stop) {
      rects.push([x, y, w, h]);
      return;
    }
    if ((w > h && r() < 0.8) || r() < 0.35) {
      const k = Math.round(w * (0.3 + r() * 0.4));
      split(x, y, k, h, depth + 1);
      split(x + k, y, w - k, h, depth + 1);
    } else {
      const k = Math.round(h * (0.3 + r() * 0.4));
      split(x, y, w, k, depth + 1);
      split(x, y + k, w, h - k, depth + 1);
    }
  };
  split(0, 0, size, size, 0);

  for (const [x, y, w, h] of rects) {
    // Each panel gets a slightly different shade and finish.
    const shade = r();
    col.g.fillStyle = shade < 0.07 ? "rgba(70,78,90,0.22)" : `rgba(0,0,0,${shade * 0.045})`;
    col.g.fillRect(x, y, w, h);
    const rv = 80 + Math.floor(r() * 60);
    rou.g.fillStyle = `rgb(${rv},${rv},${rv})`;
    rou.g.fillRect(x, y, w, h);

    // Seams.
    col.g.strokeStyle = "rgba(18,22,30,0.5)";
    col.g.lineWidth = Math.max(1, 1.6 * s);
    col.g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    rou.g.strokeStyle = "rgb(210,210,210)";
    rou.g.lineWidth = Math.max(1, 3 * s);
    rou.g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Fasteners along some edges.
    if (r() < 0.35) {
      col.g.fillStyle = "rgba(20,24,32,0.5)";
      const n = Math.floor(w / (18 * s));
      for (let i = 1; i < n; i++) {
        col.g.fillRect(x + i * 18 * s, y + 5 * s, 2.4 * s, 2.4 * s);
        col.g.fillRect(x + i * 18 * s, y + h - 7 * s, 2.4 * s, 2.4 * s);
      }
    }
    // Vent slats on a few panels.
    if (r() < 0.1 && w > 60 * s && h > 40 * s) {
      col.g.fillStyle = "rgba(14,18,26,0.7)";
      for (let i = 0; i < 6; i++) col.g.fillRect(x + w * 0.2, y + h * 0.25 + i * 5 * s, w * 0.6, 2 * s);
    }
    // A few seams carry light.
    if (r() < 0.12) {
      glo.g.fillStyle = "#fff";
      const lw = Math.max(1, 2 * s);
      if (r() < 0.5) glo.g.fillRect(x + 6 * s, y + h * (0.3 + r() * 0.4), w - 12 * s, lw);
      else glo.g.fillRect(x + w * (0.3 + r() * 0.4), y + 6 * s, lw, h - 12 * s);
    }
    if (r() < 0.05) {
      glo.g.fillStyle = "#fff";
      glo.g.fillRect(x + w - 14 * s, y + 8 * s, 6 * s, 3 * s);
    }
  }

  const make = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new CanvasTexture(c);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  return { map: make(col.c, true), rough: make(rou.c, false), glow: make(glo.c, false) };
}

/** Soft round glow for sprites. White, so the material colour tints it. */
export function glowTexture(size = 128): CanvasTexture {
  const { c, g } = canvas(size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.12, "rgba(255,255,255,0.75)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.18)");
  grd.addColorStop(0.7, "rgba(255,255,255,0.04)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return t;
}

/** A soft cloud puff with fbm edges, used for nebula billboards. */
export function cloudTexture(size = 128, seed = 3): CanvasTexture {
  const r = rng(seed);
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  // Lattice noise in JS, four octaves.
  const grid = 16;
  const lat = new Float32Array((grid + 1) * (grid + 1) * 4);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const val = (x: number, y: number, o: number) => {
    const n = 4 << o;
    const fx = x * n;
    const fy = y * n;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const at = (a: number, b: number) => lat[(((a % grid) + (b % grid) * (grid + 1)) * 4 + o) % lat.length];
    const a = at(ix, iy);
    const b = at(ix + 1, iy);
    const cc = at(ix, iy + 1);
    const d = at(ix + 1, iy + 1);
    return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let n = 0;
      let amp = 0.5;
      for (let o = 0; o < 4; o++) {
        n += amp * val(u, v, o);
        amp *= 0.5;
      }
      const dx = u - 0.5;
      const dy = v - 0.5;
      const rad = Math.sqrt(dx * dx + dy * dy) * 2;
      const fall = Math.max(0, 1 - rad);
      const a = Math.max(0, Math.min(1, (n - 0.25) * 1.8)) * fall * fall;
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return t;
}
