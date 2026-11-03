// Shared parts for the star system on /projects: one surface shader that every
// solid thing uses (lit by the system's star, reflecting the baked sky), glows,
// camera facing beams, soft points, and small geometry helpers. Everything is
// linear HDR; post.ts tone maps at the end.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  FrontSide,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Blending,
  type Side,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type U<T = any> = { value: T };

/** What every world shares: the clock and the baked sky. */
export interface Shared {
  time: U<number>;
  env: U<Texture | null>;
  low: boolean;
  /** Scales particle and instance counts (1 on high, about 0.5 on phones). */
  density: number;
  reduced: boolean;
}

/** A seeded random stream, so every visit builds the same worlds. */
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

export const NOISE = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1., 0., 0.)), f.x), mix(hash13(i + vec3(0., 1., 0.)), hash13(i + vec3(1., 1., 0.)), f.x), f.y),
    mix(mix(hash13(i + vec3(0., 0., 1.)), hash13(i + vec3(1., 0., 1.)), f.x), mix(hash13(i + vec3(0., 1., 1.)), hash13(i + vec3(1., 1., 1.)), f.x), f.y),
    f.z);
}
float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(17.1, 9.2, 3.7); a *= 0.5; }
  return s;
}
float fbm5(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(17.1, 9.2, 3.7); a *= 0.5; }
  return s;
}
`;

export interface SurfaceOpts {
  color?: string | Color;
  metal?: number;
  rough?: number;
  glow?: number;
  envI?: number;
  /** Faceted shading from screen derivatives. */
  flat?: boolean;
  /** Geometry or instances carry aData (rgb tint, a glow). */
  data?: boolean;
  /** Geometry or instances carry aSeed. */
  seed?: boolean;
  uniforms?: Record<string, U>;
  /** Vertex declarations. */
  head?: string;
  /** Vertex: edit p and n (object space), d (rgba data), s (seed) before instancing. */
  vertex?: string;
  /** Vertex: edit q (group space, after instancing). */
  placed?: string;
  /** Fragment declarations. */
  fragHead?: string;
  /** Fragment: edit base, glow, glowCol, metal, rough, alpha and N. vL is group space. */
  frag?: string;
  /** Fragment: last word on col before output. */
  after?: string;
  transparent?: boolean;
  additive?: boolean;
  side?: Side;
  depthWrite?: boolean;
  depthTest?: boolean;
  defines?: Record<string, string>;
}

/** The one surface shader. `sun` is the direction to the star in world space. */
export function surface(shared: Shared, sun: U<Vector3>, o: SurfaceOpts = {}): ShaderMaterial {
  const defines: Record<string, string> = { ...(o.defines || {}) };
  if (o.flat) defines.FLAT = "1";
  if (o.data) defines.DATA = "1";
  if (o.seed) defines.SEED = "1";
  return new ShaderMaterial({
    defines,
    transparent: !!o.transparent || !!o.additive,
    blending: (o.additive ? AdditiveBlending : NormalBlending) as Blending,
    side: o.side ?? FrontSide,
    depthWrite: o.depthWrite ?? !(o.transparent || o.additive),
    depthTest: o.depthTest ?? true,
    uniforms: {
      uTime: shared.time,
      tEnv: shared.env,
      uSun: sun,
      uColor: { value: new Color(o.color ?? "#ffffff") },
      uMetal: { value: o.metal ?? 0.2 },
      uRough: { value: o.rough ?? 0.6 },
      uGlow: { value: o.glow ?? 0 },
      uEnvI: { value: o.envI ?? 1 },
      ...(o.uniforms || {}),
    },
    vertexShader: /* glsl */ `
uniform float uTime;
#ifdef DATA
attribute vec4 aData;
#endif
#ifdef SEED
attribute float aSeed;
#endif
varying vec3 vW; varying vec3 vN; varying vec3 vL; varying vec3 vO; varying vec4 vD; varying float vS;
${o.head || ""}
void main() {
  vec3 p = position;
  vec3 n = normal;
  vec4 d = vec4(1.0, 1.0, 1.0, 0.0);
  float s = 0.0;
#ifdef DATA
  d = aData;
#endif
#ifdef SEED
  s = aSeed;
#endif
  vO = p;
  ${o.vertex || ""}
  vec4 lp = vec4(p, 1.0);
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp;
  n = mat3(instanceMatrix) * n;
#endif
  vec3 q = lp.xyz;
  ${o.placed || ""}
  vL = q;
  vec4 wp = modelMatrix * vec4(q, 1.0);
  vW = wp.xyz;
  vN = mat3(modelMatrix) * n;
  vD = d;
  vS = s;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor; uniform vec3 uSun; uniform float uMetal; uniform float uRough; uniform float uGlow; uniform float uEnvI; uniform float uTime;
uniform samplerCube tEnv;
varying vec3 vW; varying vec3 vN; varying vec3 vL; varying vec3 vO; varying vec4 vD; varying float vS;
${o.fragHead || ""}
const vec3 SUN = vec3(2.15, 2.7, 3.7);
const vec3 BOUNCE = vec3(0.016, 0.022, 0.05);
void main() {
#ifdef FLAT
  vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
#else
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
#endif
  vec3 V = normalize(cameraPosition - vW);
#ifdef FLAT
  if (dot(N, V) < 0.0) N = -N;
#endif
  vec3 base = uColor * vD.rgb;
  float glow = uGlow + vD.a;
  vec3 glowCol = base;
  float metal = uMetal;
  float rough = uRough;
  float alpha = 1.0;
  ${o.frag || ""}
  float ndl = dot(N, uSun);
  float wrap = max((ndl + 0.18) / 1.18, 0.0);
  vec3 H = normalize(uSun + V);
  float shin = mix(420.0, 10.0, rough);
  float spec = pow(max(dot(N, H), 0.0), shin) * (shin + 8.0) / 42.0 * step(0.0, ndl + 0.1);
  float nv = max(dot(N, V), 0.0);
  float F = pow(1.0 - nv, 5.0);
  vec3 f0 = mix(vec3(0.04), base, metal);
  vec3 env = textureCubeLodEXT(tEnv, reflect(-V, N), rough * 6.0).rgb;
  vec3 col = base * (1.0 - metal) * (SUN * wrap * wrap * 0.82 + BOUNCE * (1.0 + max(-ndl, 0.0) * 2.0));
  col += SUN * spec * f0 * (1.0 - rough * 0.5);
  col += env * (f0 + (1.0 - f0) * F) * uEnvI * (1.0 - rough * 0.6) * 1.8;
  // a thin line of star light on the limb
  col += SUN * pow(1.0 - nv, 4.0) * max(ndl + 0.3, 0.0) * 0.1;
  col += glowCol * glow;
  ${o.after || ""}
  gl_FragColor = vec4(col, alpha);
}`,
  });
}

/** Set per instance data: rgb tint and glow, and a seed. */
export function instanced(geo: BufferGeometry, material: ShaderMaterial, n: number, fill: (i: number, m: Matrix4, d: number[]) => void): InstancedMesh {
  const mesh = new InstancedMesh(geo, material, n);
  const data = new Float32Array(n * 4);
  const seed = new Float32Array(n);
  const m = new Matrix4();
  const d = [1, 1, 1, 0];
  let r = 0.37;
  for (let i = 0; i < n; i++) {
    d[0] = d[1] = d[2] = 1;
    d[3] = 0;
    m.identity();
    fill(i, m, d);
    mesh.setMatrixAt(i, m);
    data.set(d, i * 4);
    r = ((r * 233280 * 9301 + 49297) % 233280) / 233280;
    seed[i] = r;
  }
  mesh.instanceMatrix.needsUpdate = true;
  const g = mesh.geometry;
  g.setAttribute("aData", new InstancedBufferAttribute(data, 4));
  g.setAttribute("aSeed", new InstancedBufferAttribute(seed, 1));
  mesh.frustumCulled = false;
  return mesh;
}

const tmpQ = new Quaternion();
const tmpV = new Vector3();
const tmpS = new Vector3();
const UPY = new Vector3(0, 1, 0);
/** Point the object's +Y along dir, at pos, with scale (sx, sy, sz). */
export function placeAlong(m: Matrix4, pos: Vector3, dir: Vector3, sx: number, sy: number, sz: number) {
  tmpQ.setFromUnitVectors(UPY, tmpV.copy(dir).normalize());
  m.compose(pos, tmpQ, tmpS.set(sx, sy, sz));
}

// ---------------------------------------------------------------- glows

/** A camera facing additive glow. */
export function glow(color: string | Color, size: number, o: { power?: number; intensity?: number; depthTest?: boolean } = {}): Mesh {
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(color) },
      uI: { value: o.intensity ?? 1 },
      uPow: { value: o.power ?? 2.4 },
    },
    vertexShader: /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy * 2.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sc = length(modelMatrix[0].xyz);
  mv.xy += position.xy * sc;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor; uniform float uI; uniform float uPow;
varying vec2 vP;
void main() {
  float r = length(vP);
  float f = pow(max(1.0 - r, 0.0), uPow);
  gl_FragColor = vec4(uColor * f * uI, 1.0);
}`,
  });
  const m = new Mesh(new PlaneGeometry(1, 1), material);
  m.scale.setScalar(size);
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- beams

export interface BeamItem {
  a: Vector3;
  b: Vector3;
  color: Color | string;
  i?: number;
  w?: number;
  seed?: number;
}

/** Many thin camera facing lines in one draw. Width is in group units. */
export function beams(items: BeamItem[], shared: Shared, o: { chunk?: string; head?: string; uniforms?: Record<string, U>; fade?: number; depthTest?: boolean; minPx?: number } = {}): Mesh {
  const base = new PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);
  const geo = new InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.instanceCount = items.length;
  const A = new Float32Array(items.length * 4);
  const B = new Float32Array(items.length * 4);
  const C = new Float32Array(items.length * 4);
  const col = new Color();
  items.forEach((it, i) => {
    A.set([it.a.x, it.a.y, it.a.z, it.w ?? 0.05], i * 4);
    B.set([it.b.x, it.b.y, it.b.z, it.seed ?? (i * 0.618) % 1], i * 4);
    col.set(it.color);
    C.set([col.r, col.g, col.b, it.i ?? 1], i * 4);
  });
  geo.setAttribute("aA", new InstancedBufferAttribute(A, 4));
  geo.setAttribute("aB", new InstancedBufferAttribute(B, 4));
  geo.setAttribute("aC", new InstancedBufferAttribute(C, 4));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.time, uFade: { value: o.fade ?? 0 }, ...(o.uniforms || {}) },
    vertexShader: /* glsl */ `
attribute vec4 aA; attribute vec4 aB; attribute vec4 aC;
uniform float uTime;
varying vec2 vP; varying vec4 vC; varying float vS;
void main() {
  vec3 a = (modelMatrix * vec4(aA.xyz, 1.0)).xyz;
  vec3 b = (modelMatrix * vec4(aB.xyz, 1.0)).xyz;
  float t = position.y;
  vec3 c = mix(a, b, t);
  vec3 dir = normalize(b - a);
  vec3 side = normalize(cross(dir, cameraPosition - c));
  float sc = length(modelMatrix[0].xyz);
  // never thinner than about a pixel, whatever the distance
  float dist = distance(cameraPosition, c);
  float w = max(aA.w * sc, dist * ${(o.minPx ?? 0.0011).toFixed(5)});
  c += side * position.x * w * 2.0;
  vP = vec2(position.x * 2.0, t);
  vC = aC;
  vS = aB.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(c, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uFade; uniform float uTime;
varying vec2 vP; varying vec4 vC; varying float vS;
${o.head || ""}
void main() {
  float x = 1.0 - abs(vP.x);
  float k = x * x;
  float t = vP.y;
  float a = 1.0;
  if (uFade > 0.0) a = smoothstep(0.0, uFade, t) * smoothstep(0.0, uFade, 1.0 - t);
  float i = vC.a;
  ${o.chunk || ""}
  gl_FragColor = vec4(vC.rgb * k * a * i, 1.0);
}`,
  });
  const m = new Mesh(geo, material);
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- points

/** Round soft points. Attributes the caller adds are read in `vertex`. */
export function pointsMaterial(shared: Shared, o: {
  head?: string;
  /** Set vec3 pos, vec3 col, float size, float a. */
  vertex?: string;
  frag?: string;
  uniforms?: Record<string, U>;
  additive?: boolean;
  maxSize?: number;
}): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: (o.additive === false ? NormalBlending : AdditiveBlending) as Blending,
    uniforms: { uTime: shared.time, uPx: pxScale, ...(o.uniforms || {}) },
    vertexShader: /* glsl */ `
uniform float uTime; uniform float uPx;
varying vec3 vC; varying float vA;
${o.head || ""}
void main() {
  vec3 pos = position;
  vec3 col = vec3(1.0);
  float size = 1.0;
  float a = 1.0;
  ${o.vertex || ""}
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float sc = length(modelMatrix[0].xyz);
  float ps = size * sc * uPx / max(-mv.z, 0.1);
  // a point that would go below a pixel dims instead of vanishing
  a *= min(1.0, ps * ps + 0.04);
  gl_PointSize = clamp(ps, 1.0, ${(o.maxSize ?? 48).toFixed(1)});
  vC = col;
  vA = a;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float f = 1.0 - r;
  f = f * f * (3.0 - 2.0 * f);
  ${o.frag || ""}
  gl_FragColor = vec4(vC * f * vA, 1.0);
}`,
  });
}

/** Pixels per world unit at distance 1; the engine keeps it current on resize. */
export const pxScale: U<number> = { value: 800 };

/** A Points object from positions plus named attributes. */
export function pointCloud(positions: Float32Array, attrs: Record<string, [Float32Array, number]>, material: ShaderMaterial): Points {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(positions, 3));
  for (const [k, [arr, n]] of Object.entries(attrs)) g.setAttribute(k, new BufferAttribute(arr, n));
  const p = new Points(g, material);
  p.frustumCulled = false;
  return p;
}

// ---------------------------------------------------------------- geometry

/** Hard edged normals, so instanced boxes and shards catch light per face. */
export function faceted(g: BufferGeometry): BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  n.computeVertexNormals();
  return n;
}

export const box = (x: number, y: number, z: number) => new BoxGeometry(x, y, z);
export const cyl = (r0: number, r1: number, h: number, n = 8, open = false) => new CylinderGeometry(r0, r1, h, n, 1, open);
export const ball = (r: number, a = 24, b = 16) => new SphereGeometry(r, a, b);
export const ico = (r: number, d = 1) => new IcosahedronGeometry(r, d);
export const tor = (r: number, t: number, a = 10, b = 96, arc = Math.PI * 2) => new TorusGeometry(r, t, a, b, arc);
export const cone = (r: number, h: number, n = 8) => new ConeGeometry(r, h, n);

const tmpE = new Euler();
const tmpR = new Matrix4();
/** Compose a matrix from position, euler angles and scale. */
export function mat(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): Matrix4 {
  const m = new Matrix4().makeScale(sx, sy, sz);
  tmpE.set(rx, ry, rz);
  m.premultiply(tmpR.makeRotationFromEuler(tmpE));
  m.setPosition(px, py, pz);
  return m;
}

/** Merge geometries after moving each by a matrix; tints go in aData. */
export function assemble(parts: { g: BufferGeometry; m?: Matrix4; d?: number[] }[]): BufferGeometry {
  const list = parts.map(({ g, m, d }) => {
    const c = (g.index ? g.toNonIndexed() : g.clone()) as BufferGeometry;
    if (m) c.applyMatrix4(m);
    for (const k of Object.keys(c.attributes)) if (k !== "position" && k !== "normal") c.deleteAttribute(k);
    const n = c.getAttribute("position").count;
    const arr = new Float32Array(n * 4);
    const dd = d || [1, 1, 1, 0];
    for (let i = 0; i < n; i++) arr.set(dd, i * 4);
    c.setAttribute("aData", new BufferAttribute(arr, 4));
    return c;
  });
  return mergeGeometries(list, false)!;
}

export function fibSphere(i: number, n: number, out = new Vector3()): Vector3 {
  const y = 1 - ((i + 0.5) / n) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const a = i * 2.39996323;
  return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
}

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Move toward target with a time constant, frame rate independent. */
export const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** A part of a world that stands for a real feature. `at` is in the world's group space, kept current by update. */
export interface Part {
  key: string;
  at: Vector3;
  /** Rough size in group units, for picking. */
  r: number;
}

/** What a world gets each frame. */
export interface WorldCtx {
  t: number;
  dt: number;
  /** 0 far away, 1 when the camera is at this world. */
  near: number;
  /** Pointer on the world's bounding sphere, in world group space. */
  ptr: Vector3;
  ptrOn: number;
  /** How lit each part is (0..1), by index. */
  heat: number[];
  /** Where the camera is, in world group space. */
  cam: Vector3;
  /** Direction to the star. */
  sun: Vector3;
  /** 1 at the far view of the whole system. */
  overview: number;
  reduced: boolean;
}

export interface World {
  group: Group;
  radius: number;
  parts: Part[];
  update(c: WorldCtx): void;
}

export type WorldBuilder = (shared: Shared, sun: U<Vector3>) => World;

