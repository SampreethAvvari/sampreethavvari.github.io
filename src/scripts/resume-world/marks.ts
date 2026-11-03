// Lit marks: a logo or a line of type becomes a solid object.
//
// The flat picture is reduced to one mask, a distance field is computed from
// it, and the shape is drawn as a stack of thin layers that the shader cuts
// out with the field. From the side the stack reads as a real thickness, and
// the field's slope gives the bevel its normal, so any flat image gets a
// machined edge that catches the light.

import { BufferAttribute, BufferGeometry } from "three";
import { fieldFromPixels } from "./field-math";
import FieldWorker from "./field.worker.ts?worker";

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

export type Field = { data: Uint8Array; width: number; height: number; spread: number; aspect: number };

/** A mask's pixels with a margin, so the bevel has room. */
function padded(mask: HTMLCanvasElement, spread: number) {
  const pad = Math.ceil(spread) + 2;
  const w = mask.width + pad * 2;
  const h = mask.height + pad * 2;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d", { willReadFrequently: true })!;
  c.drawImage(mask, pad, pad);
  return { pixels: c.getImageData(0, 0, w, h).data, w, h };
}

/**
 * Signed distance fields of several masks. The arithmetic takes up to a second of a
 * phone's time, so it runs on another thread and the page keeps its turn; a browser
 * that cannot do that does it here. The same bytes either way.
 */
export async function distanceFields(jobs: { mask: HTMLCanvasElement; spread: number }[]): Promise<Field[]> {
  const inputs = jobs.map(({ mask, spread }) => ({ ...padded(mask, spread), spread }));
  const field = (i: number, data: Uint8Array): Field => {
    const { w, h, spread } = inputs[i];
    return { data, width: w, height: h, spread, aspect: w / h };
  };
  const here = (i: number) => {
    const { pixels, w, h, spread } = inputs[i];
    return field(i, fieldFromPixels(pixels, w, h, spread));
  };
  let worker: Worker;
  try {
    worker = new FieldWorker();
  } catch {
    return inputs.map((_, i) => here(i));
  }
  const out = await new Promise<(Field | null)[]>((done) => {
    const got: (Field | null)[] = inputs.map(() => null);
    let left = inputs.length;
    if (!left) return done(got);
    worker.onmessage = (e: MessageEvent<{ id: number; data: Uint8Array }>) => {
      got[e.data.id] = field(e.data.id, e.data.data);
      if (--left === 0) done(got);
    };
    worker.onerror = () => done(got);
    inputs.forEach((job, id) => {
      // The worker has its own copy: a field that fails there can still be made here.
      const pixels = job.pixels.slice();
      worker.postMessage({ id, pixels, w: job.w, h: job.h, spread: job.spread }, [pixels.buffer]);
    });
  });
  worker.terminate();
  return out.map((f, i) => f ?? here(i));
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
