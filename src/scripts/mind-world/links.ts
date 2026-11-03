// Connections as light that travels. Each link is a thin filament bent a little
// toward the heart of the map, with pulses running along it from one star to
// the other. The same ribbon draws the dotted axes and the comets' tails. All of
// it is one instanced draw call and runs in the vertex shader.

import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  ShaderMaterial,
} from "three";
import type { Shared } from "./glsl";

/** Style of a ribbon: 0 a filament with pulses, 1 dotted, 2 a comet's tail. */
export const STYLE = { link: 0, dotted: 1, comet: 2 } as const;

const VS = /* glsl */ `
attribute vec3 iA;
attribute vec3 iB;
attribute vec3 iCA;
attribute vec3 iCB;
attribute vec4 iL; // opacity, width in CSS pixels, seed, bend
attribute vec2 iK; // style, pulses a second
uniform vec2 uView;
uniform float uDpr;
uniform vec2 uHaze;
varying float vT;
varying float vSide;
varying vec3 vCol;
varying float vOp;
varying float vSeed;
varying vec2 vK;
vec3 curve(float t) {
  vec3 m = (iA + iB) * 0.5;
  vec3 c = m * (1.0 - iL.w);
  float u = 1.0 - t;
  return u * u * iA + 2.0 * u * t * c + t * t * iB;
}
void main() {
  float t = position.x;
  vT = t;
  vSide = position.y;
  vCol = mix(iCA, iCB, t);
  vOp = iL.x;
  vSeed = iL.z;
  vK = iK;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  if (iL.x <= 0.003) return;
  float e = 0.012;
  vec4 c0 = projectionMatrix * viewMatrix * vec4(curve(t), 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(curve(t + (t < 0.99 ? e : -e)), 1.0);
  // Behind the camera it is not drawn: nothing smears across the lens.
  if (c0.w < 8.0 || c1.w < 8.0) { vOp = 0.0; return; }
  vec2 a = c0.xy / c0.w;
  vec2 b = c1.xy / c1.w;
  vec2 d = (b - a) * uView;
  if (t >= 0.99) d = -d;
  float l = length(d);
  vec2 n = l > 1e-4 ? vec2(-d.y, d.x) / l : vec2(0.0, 1.0);
  // Crisp at every depth, a little quieter toward the far side.
  vOp *= mix(1.0, 0.66, clamp((c0.w - uHaze.x) / uHaze.y, 0.0, 1.0));
  float w = iL.y * uDpr * (iK.x > 1.5 ? (0.14 + 0.86 * t * t) : 1.0);
  c0.xy += n * vSide * w * 2.0 / uView * c0.w;
  gl_Position = c0;
}`;

const FS = /* glsl */ `
uniform float uTime;
uniform float uFlow;
varying float vT;
varying float vSide;
varying vec3 vCol;
varying float vOp;
varying float vSeed;
varying vec2 vK;
void main() {
  if (vOp <= 0.003) discard;
  float across = 1.0 - abs(vSide);
  float core = across * across;
  float style = vK.x;
  vec3 c;
  if (style > 1.5) {
    // a comet's tail: hot at the head, gone by the end
    float f = vT * vT;
    c = mix(vCol, vec3(1.0), f * f * 0.5) * core * f * 1.05;
  } else if (style > 0.5) {
    float dots = fract(vT * 110.0);
    float dot2 = exp(-pow((dots - 0.5) * 6.0, 2.0));
    float ends = smoothstep(0.0, 0.18, vT) * (1.0 - smoothstep(0.82, 1.0, vT));
    c = vec3(0.6, 0.78, 1.0) * dot2 * ends * core * 0.72;
  } else {
    // the filament itself stays faint; the light travelling on it is what you see
    float ends = smoothstep(0.0, 0.03, vT) * (1.0 - smoothstep(0.97, 1.0, vT));
    float x = fract(vT * 1.0 - uTime * vK.y * uFlow + vSeed);
    float pulse = pow(x, 18.0) * 2.4 + pow(x, 90.0) * 3.6;
    float y = fract(vT * 1.0 - uTime * vK.y * uFlow * 0.62 + vSeed * 3.7);
    pulse += pow(y, 26.0) * 1.0;
    c = vCol * (0.46 + 0.44 * core + pulse * core) * ends * mix(0.4, 1.0, core);
  }
  gl_FragColor = vec4(c * vOp, 1.0);
}`;

export interface LinkBatch {
  mesh: Mesh;
  iA: InstancedBufferAttribute;
  iB: InstancedBufferAttribute;
  iCA: InstancedBufferAttribute;
  iCB: InstancedBufferAttribute;
  iL: InstancedBufferAttribute;
  iK: InstancedBufferAttribute;
  capacity: number;
  dispose(): void;
}

export function makeLinkBatch(s: Shared, capacity: number, segments: number): LinkBatch {
  const verts = (segments + 1) * 2;
  const pos = new Float32Array(verts * 3);
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pos.set([t, -1, 0, t, 1, 0], i * 6);
    if (i < segments) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const base = new BufferGeometry();
  base.setAttribute("position", new BufferAttribute(pos, 3));
  base.setIndex(idx);
  const g = new InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  const attr = (n: number) => new InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(DynamicDrawUsage);
  const iA = attr(3);
  const iB = attr(3);
  const iCA = attr(3);
  const iCB = attr(3);
  const iL = attr(4);
  const iK = attr(2);
  g.setAttribute("iA", iA);
  g.setAttribute("iB", iB);
  g.setAttribute("iCA", iCA);
  g.setAttribute("iCB", iCB);
  g.setAttribute("iL", iL);
  g.setAttribute("iK", iK);
  g.instanceCount = 0;
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    uniforms: { uView: s.view, uDpr: s.dpr, uTime: s.time, uHaze: s.haze, uFlow: { value: s.reduced ? 0.25 : 1 } },
    vertexShader: VS,
    fragmentShader: FS,
  });
  const mesh = new Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -25;
  return {
    mesh,
    iA,
    iB,
    iCA,
    iCB,
    iL,
    iK,
    capacity,
    dispose() {
      base.dispose();
      g.dispose();
      mat.dispose();
    },
  };
}
