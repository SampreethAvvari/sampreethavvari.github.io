// The page's title as stardust. Thousands of tiny stars take the shape of the
// words on a plane tipped back in space. They gather when the map is at rest,
// part around the pointer, and blow apart the moment the visitor starts flying
// or opens a star. The words stay behind everything on the map and each one goes
// dark on its own if a star or a label comes near, so they never cover the map.

import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  Euler,
  Matrix4,
  OneFactor,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type PerspectiveCamera,
} from "three";
import { breathe } from "../gl-warm";
import { rng, type Shared } from "./glsl";

export const MAX_WORDS = 8;

const VS = /* glsl */ `
attribute vec4 aSeed; // three seeds, word
uniform float uForm;
uniform float uLevel;
uniform float uTime;
uniform float uDpr;
uniform float uSize;
uniform float uMove;
uniform float uWords[${MAX_WORDS}];
uniform vec3 uPtr; // x, y on the plane, how much
varying float vA;
varying float vHot;
void main() {
  float delay = aSeed.x * 0.55;
  float f = clamp(uForm * 1.55 - delay, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 p = position;
  vec3 dir = normalize(aSeed.yzx * 2.0 - 1.0 + vec3(0.0, 0.0, 0.25));
  p += dir * (1.0 - f) * (0.1 + aSeed.y * 0.32) * uMove;
  // A slow breath, so the letters are alive without moving away.
  p.z += sin(uTime * 0.55 + aSeed.y * 6.283 + p.x * 3.0) * 0.0036 * uMove;
  // The pointer parts them like a hand through sand.
  vec2 dd = p.xy - uPtr.xy;
  float d2 = dot(dd, dd);
  float k = exp(-d2 / 0.0042) * uPtr.z;
  p.xy += (dd / (sqrt(d2) + 0.002)) * k * 0.024;
  p.z += k * 0.05;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.88 + 0.12 * sin(uTime * (0.5 + aSeed.z) + aSeed.x * 40.0);
  // A few are larger and very faint: they give the letters a soft body.
  float haze = step(aSeed.y, 0.1);
  float spark = step(0.93, aSeed.z);
  vA = f * f * uWords[int(aSeed.w)] * uLevel * tw * mix(1.0 + spark * 1.2, 0.12, haze);
  vHot = max(k, spark * 0.55);
  gl_PointSize = uSize * uDpr * (0.82 + aSeed.z * 0.26 + (1.0 - f) * 0.7 + spark * 0.35) * mix(1.0, 5.4, haze);
  if (vA <= 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const FS = /* glsl */ `
varying float vA;
varying float vHot;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-r * r * 3.2) * (1.0 - smoothstep(0.75, 1.0, r));
  vec3 c = mix(vec3(0.68, 0.6, 1.0), vec3(1.0, 0.97, 1.0), vHot);
  gl_FragColor = vec4(c * a * vA * 0.62 * (1.0 + vHot * 1.2), 1.0);
}`;

export interface WordBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface WordsFrame {
  form: number;
  level: number;
  per: number[];
  /** Where the plane sits, CSS pixels from the middle of the view. */
  ax: number;
  ay: number;
  width: number;
  tilt: number;
  /** A small lean toward the pointer, radians. */
  leanX: number;
  leanY: number;
  ptrX: number;
  ptrY: number;
  ptrOn: number;
}

export interface Words {
  points: Points;
  /** Each word's box on the plane, width 1. */
  boxes: WordBox[];
  aspect: number;
  update(f: WordsFrame, cam: PerspectiveCamera, focal: number, depth: number): void;
  dispose(): void;
}

const fitFont = (g: CanvasRenderingContext2D, lines: string[], font: (px: number) => string, maxW: number) => {
  let size = 200;
  g.font = font(size);
  const w = Math.max(...lines.map((l) => g.measureText(l).width));
  size *= maxW / w;
  g.font = font(size);
  return size;
};

/** Sample the lines into points. The text comes from the page, so these are the page's own words. */
export async function buildWords(s: Shared, lines: string[], fontFamily: string, stopped: () => boolean): Promise<Words> {
  const CW = s.low ? 1200 : 1800;
  const pad = 20;
  const cv = document.createElement("canvas");
  cv.width = CW;
  const measure = cv.getContext("2d", { willReadFrequently: true })!;
  const font = (px: number) => `600 ${px}px ${fontFamily}`;
  const size = fitFont(measure, lines, font, CW - pad * 2);
  const lineH = size * 1.08;
  const CH = Math.ceil(lineH * lines.length + pad * 2);
  cv.height = CH;
  const g = measure;
  g.font = font(size);
  g.fillStyle = "#fff";
  g.textBaseline = "alphabetic";
  const boxes: WordBox[] = [];
  const ranges: { line: number; a: number; b: number; word: number }[] = [];
  const asc = size * 0.76;
  const space = g.measureText(" ").width;
  let wi = 0;
  lines.forEach((line, li) => {
    const tw = g.measureText(line).width;
    let x = (CW - tw) / 2;
    const y = pad + li * lineH + asc + (lineH - size) * 0.5;
    for (const word of line.split(" ")) {
      const w = g.measureText(word).width;
      g.fillText(word, x, y);
      ranges.push({ line: li, a: x - space * 0.4, b: x + w + space * 0.4, word: wi });
      // the box of this word, as a share of the width, up from the middle
      boxes.push({
        x0: (x - CW / 2) / CW,
        x1: (x + w - CW / 2) / CW,
        y0: (CH / 2 - (y + size * 0.2)) / CW,
        y1: (CH / 2 - (y - asc)) / CW,
      });
      x += w + space;
      wi = Math.min(MAX_WORDS - 1, wi + 1);
    }
  });
  await breathe();
  const data = g.getImageData(0, 0, CW, CH).data;
  await breathe();
  let area = 0;
  for (let i = 3; i < data.length; i += 16) if (data[i] > 128) area += 4;
  const target = s.tier === "high" ? 21000 : s.tier === "mid" ? 15000 : 9000;
  const step = Math.max(1.4, Math.sqrt(area / target));
  const r = rng(99);
  const pos: number[] = [];
  const seed: number[] = [];
  let turn = performance.now();
  for (let y = 0; y < CH; y += step) {
    // The page gets a turn between rows.
    if (performance.now() - turn > 6) {
      await breathe();
      if (stopped()) break;
      turn = performance.now();
    }
    for (let x = 0; x < CW; x += step) {
      const jx = x + (r() - 0.5) * step * 0.55;
      const jy = y + (r() - 0.5) * step * 0.55;
      const xi = Math.max(0, Math.min(CW - 1, Math.round(jx)));
      const yi = Math.max(0, Math.min(CH - 1, Math.round(jy)));
      if (data[(yi * CW + xi) * 4 + 3] < 128) continue;
      const li = Math.max(0, Math.min(lines.length - 1, Math.floor((jy - pad) / lineH)));
      let word = 0;
      for (const q of ranges) if (q.line === li && jx >= q.a && jx < q.b) word = q.word;
      pos.push((jx - CW / 2) / CW, (CH / 2 - jy) / CW, (r() - 0.5) * 0.012);
      seed.push(r(), r(), r(), word);
    }
  }
  // the canvas has done its work
  cv.width = cv.height = 0;
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("aSeed", new BufferAttribute(new Float32Array(seed), 4));
  const uWords = { value: new Float32Array(MAX_WORDS).fill(1) };
  const uForm = { value: 0 };
  const uLevel = { value: 1 };
  const uPtr = { value: new Vector3() };
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    uniforms: {
      uForm,
      uLevel,
      uPtr,
      uWords,
      uTime: s.time,
      uDpr: s.dpr,
      uSize: { value: s.low ? 1.5 : 1.45 },
      uMove: { value: s.reduced ? 0 : 1 },
    },
    vertexShader: VS,
    fragmentShader: FS,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -45;
  points.matrixAutoUpdate = false;
  points.matrixWorldAutoUpdate = false;

  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const p = new Vector3();
  const sc = new Vector3();
  return {
    points,
    boxes,
    aspect: CH / CW,
    update(f, cam, focal, depth) {
      uForm.value = f.form;
      uLevel.value = f.level;
      for (let i = 0; i < MAX_WORDS; i++) uWords.value[i] = f.per[i] ?? 1;
      uPtr.value.set(f.ptrX, f.ptrY, f.ptrOn);
      points.visible = f.form > 0.002 && f.level > 0.002;
      if (!points.visible) return;
      // The plane rides with the camera at a depth behind the map, and scales so its
      // size on screen does not depend on that depth. That also puts planets in front.
      const k = depth / focal;
      p.set(f.ax * k, -f.ay * k, -depth);
      e.set(-f.tilt + f.leanX, f.leanY, 0);
      q.setFromEuler(e);
      sc.setScalar(f.width * k);
      m.compose(p, q, sc);
      points.matrixWorld.multiplyMatrices(cam.matrixWorld, m);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

