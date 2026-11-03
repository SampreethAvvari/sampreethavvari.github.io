// Procedural surfaces for the ship, drawn once on a 2D canvas: off white
// composite panels with seams and grime, crinkled insulation foil (as a
// normal map) and solar cells. Nothing is fetched over the network.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { rng } from "./textures";

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return { c, g: c.getContext("2d")! };
}

export interface CompositeSet {
  map: CanvasTexture;
  rough: CanvasTexture;
}

/** Off white composite skin: seams, fasteners, labels, a few hazard stripes and grime. */
export function compositeTextures(size: number, seed = 21): CompositeSet {
  const r = rng(seed);
  const col = canvas(size);
  const rou = canvas(size);
  const s = size / 1024;
  col.g.fillStyle = "#e6e3dc";
  col.g.fillRect(0, 0, size, size);
  rou.g.fillStyle = "rgb(140,140,140)";
  rou.g.fillRect(0, 0, size, size);

  type Rect = [number, number, number, number];
  const rects: Rect[] = [];
  const split = (x: number, y: number, w: number, h: number, d: number) => {
    if (d > 4 || (d > 1 && r() < 0.25) || w < 90 * s || h < 90 * s) {
      rects.push([x, y, w, h]);
      return;
    }
    if (w > h) {
      const k = Math.round(w * (0.35 + r() * 0.3));
      split(x, y, k, h, d + 1);
      split(x + k, y, w - k, h, d + 1);
    } else {
      const k = Math.round(h * (0.35 + r() * 0.3));
      split(x, y, w, k, d + 1);
      split(x, y + k, w, h - k, d + 1);
    }
  };
  split(0, 0, size, size, 0);
  for (const [x, y, w, h] of rects) {
    const t = r();
    col.g.fillStyle = t < 0.1 ? "rgba(170,160,145,0.25)" : t < 0.5 ? `rgba(255,255,255,${0.03 + r() * 0.04})` : `rgba(0,0,0,${0.03 + r() * 0.04})`;
    col.g.fillRect(x, y, w, h);
    const rv = 120 + Math.floor(r() * 50);
    rou.g.fillStyle = `rgb(${rv},${rv},${rv})`;
    rou.g.fillRect(x, y, w, h);
    col.g.strokeStyle = "rgba(60,58,54,0.55)";
    col.g.lineWidth = Math.max(1, 1.5 * s);
    col.g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    rou.g.strokeStyle = "rgb(220,220,220)";
    rou.g.lineWidth = Math.max(1, 2 * s);
    rou.g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (r() < 0.5) {
      col.g.fillStyle = "rgba(70,66,60,0.5)";
      for (let i = 1; i < Math.floor(w / (26 * s)); i++) {
        col.g.fillRect(x + i * 26 * s, y + 6 * s, 3 * s, 3 * s);
        col.g.fillRect(x + i * 26 * s, y + h - 9 * s, 3 * s, 3 * s);
      }
    }
    if (r() < 0.25) {
      col.g.fillStyle = "rgba(40,40,44,0.65)";
      col.g.fillRect(x + w * 0.12, y + h * 0.2, Math.min(60 * s, w * 0.4), 7 * s);
      col.g.fillRect(x + w * 0.12, y + h * 0.2 + 11 * s, Math.min(36 * s, w * 0.3), 5 * s);
    }
    if (r() < 0.12) {
      col.g.strokeStyle = "rgba(50,50,50,0.5)";
      col.g.beginPath();
      col.g.arc(x + w * 0.7, y + h * 0.6, 12 * s, 0, Math.PI * 2);
      col.g.stroke();
    }
    if (r() < 0.07 && w > 80 * s) {
      const sw = Math.min(w * 0.6, 140 * s);
      const sh = 16 * s;
      const sx = x + w * 0.2;
      const sy = y + h - sh - 14 * s;
      col.g.save();
      col.g.beginPath();
      col.g.rect(sx, sy, sw, sh);
      col.g.clip();
      col.g.fillStyle = "#1c1c1c";
      col.g.fillRect(sx, sy, sw, sh);
      col.g.fillStyle = "#e3b322";
      for (let i = -2; i < sw / (12 * s) + 2; i++) {
        col.g.beginPath();
        col.g.moveTo(sx + i * 12 * s, sy + sh);
        col.g.lineTo(sx + i * 12 * s + 6 * s, sy + sh);
        col.g.lineTo(sx + i * 12 * s + 6 * s + sh, sy);
        col.g.lineTo(sx + i * 12 * s + sh, sy);
        col.g.fill();
      }
      col.g.restore();
    }
  }
  // Grime: soft blotches and a few streaks, a little rougher where it gathers.
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = (8 + r() * 60) * s;
    const a = 0.03 + r() * 0.07;
    const g = col.g.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(84,76,64,${a})`);
    g.addColorStop(1, "rgba(84,76,64,0)");
    col.g.fillStyle = g;
    col.g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    const rg = rou.g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, `rgba(230,230,230,${a * 2})`);
    rg.addColorStop(1, "rgba(230,230,230,0)");
    rou.g.fillStyle = rg;
    rou.g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * size;
    const y = r() * size;
    const len = (40 + r() * 160) * s;
    const g = col.g.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, "rgba(70,64,56,0.09)");
    g.addColorStop(1, "rgba(70,64,56,0)");
    col.g.fillStyle = g;
    col.g.fillRect(x, y, (1 + r() * 3) * s, len);
  }
  const make = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new CanvasTexture(c);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  return { map: make(col.c, true), rough: make(rou.c, false) };
}

/** Crinkled foil as a normal map: flat facets tilted at random with creases between them. */
export function foilNormal(size: number, seed = 31): CanvasTexture {
  const r = rng(seed);
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  const cells = 22;
  const cs = size / cells;
  const n = cells * cells;
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sx[i] = r();
    sy[i] = r();
    const a = r() * Math.PI * 2;
    const tilt = 0.15 + r() * 0.55;
    nx[i] = Math.cos(a) * tilt;
    ny[i] = Math.sin(a) * tilt;
  }
  const crease = 1.5 * (size / 512);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cs);
      const cy = Math.floor(y / cs);
      let best = 1e9;
      let second = 1e9;
      let bi = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = (cx + ox + cells) % cells;
          const gy = (cy + oy + cells) % cells;
          const i = gy * cells + gx;
          const px = (cx + ox + sx[i]) * cs;
          const py = (cy + oy + sy[i]) * cs;
          const d = (px - x) * (px - x) + (py - y) * (py - y);
          if (d < best) {
            second = best;
            best = d;
            bi = i;
          } else if (d < second) second = d;
        }
      }
      const edge = Math.sqrt(second) - Math.sqrt(best) < crease;
      const vx = edge ? -nx[bi] * 0.6 : nx[bi];
      const vy = edge ? -ny[bi] * 0.6 : ny[bi];
      const vz = Math.sqrt(Math.max(0.05, 1 - vx * vx - vy * vy));
      const o = (y * size + x) * 4;
      img.data[o] = Math.round((vx * 0.5 + 0.5) * 255);
      img.data[o + 1] = Math.round((vy * 0.5 + 0.5) * 255);
      img.data[o + 2] = Math.round((vz * 0.5 + 0.5) * 255);
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Solar cells: dark blue squares with thin bright gaps. */
export function solarTexture(size = 256): CanvasTexture {
  const { c, g } = canvas(size);
  g.fillStyle = "#b9c0c9";
  g.fillRect(0, 0, size, size);
  const n = 8;
  const cs = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 18 + ((x * 7 + y * 13) % 5) * 3;
      g.fillStyle = `rgb(${v},${v + 12},${v + 46})`;
      g.fillRect(x * cs + 1.5, y * cs + 1.5, cs - 3, cs - 3);
      g.strokeStyle = "rgba(120,140,190,0.25)";
      g.beginPath();
      g.moveTo(x * cs + cs / 2, y * cs + 2);
      g.lineTo(x * cs + cs / 2, y * cs + cs - 2);
      g.stroke();
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}
