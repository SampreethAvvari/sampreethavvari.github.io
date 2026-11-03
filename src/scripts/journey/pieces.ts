// The worlds. Each one is built around the flight path at its chapter, lit
// in its chapter's colour, and drawn only while the ship is in it: a world
// appears at the middle of the jump that brings the ship there and goes at
// the middle of the jump that leaves. Every world has things that live and
// move, and some that answer the pointer. The last 3D world is the landing:
// a desert forest planet under a red eclipse, which stays on as the calm
// hold behind the chapters that follow it.

import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  LatheGeometry,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Points,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Camera,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { additive, GlowBatch } from "./fx";
import { NOISE } from "./glsl";
import { CROSS, landingPhase, type FlightPath, type Landing } from "./path";
import { rng } from "./textures";

/** The pointer as a ray in world space. on: 0 when there is no pointer. */
export interface PointerRay {
  o: Vector3;
  d: Vector3;
  on: number;
}

export interface PieceFrame {
  time: number;
  dt: number;
  p: number;
  camera: Camera;
  ptr: PointerRay;
}

export interface Piece {
  id: string;
  group: Group;
  /** 0..1, shared with this piece's shaders so it can fade in and out. */
  fade: { value: number };
  weight(p: number): number;
  /** How much this piece lifts the sky nebula. */
  nebula?: number;
  /** A warm glow in the sky toward a direction. */
  warm?: { amount: number; dir: Vector3 };
  /** A bright light that should throw a lens flare. */
  flare?: { pos: Vector3; color: Color; strength: number };
  /** Air in this world: fog colour and density. */
  haze?: { color: Color; density: number };
  update?(f: PieceFrame): void;
}

/** Shared shader inputs: the pointer ray and the pixel scale for points. */
export const VIEW = {
  uRayO: { value: new Vector3() },
  uRayD: { value: new Vector3(0, 0, -1) },
  uRayOn: { value: 0 },
  uPx: { value: 800 },
  uDpr: { value: 1 },
};

interface Ctx {
  path: FlightPath;
  chapters: { id: string; color: Color }[];
  low: boolean;
  glowTex: Texture;
  cloudTex: Texture;
  landing: Landing;
  /** Index of the landing world; chapters after it have no world of their own. */
  landWorld: number;
  ray: { uRayO: { value: Vector3 }; uRayD: { value: Vector3 }; uRayOn: { value: number } };
}

type Builder = (i: number, color: Color, ctx: Ctx) => Piece;

const ORDER = ["launch", "proof", "projects", "disciplines", "writing"];

export function buildPieces(c: Omit<Ctx, "ray">): Piece[] {
  const ctx: Ctx = { ...c, ray: { uRayO: VIEW.uRayO, uRayD: VIEW.uRayD, uRayOn: VIEW.uRayOn } };
  const builders: Record<string, Builder> = { launch, proof, projects, disciplines, writing };
  const out: Piece[] = [];
  const used = new Set<string>();
  for (let i = 0; i <= ctx.landWorld && i < ctx.chapters.length; i++) {
    const ch = ctx.chapters[i];
    if (i === ctx.landWorld) {
      out.push(landingWorld(i, ch.color, ctx));
      break;
    }
    const key = builders[ch.id] && !used.has(ch.id) ? ch.id : ORDER[i % ORDER.length];
    used.add(key);
    out.push(builders[key](i, ch.color, ctx));
  }
  return out;
}

// ------------------------------------------------------------------ helpers

interface Frame {
  pos: Vector3;
  quat: Quaternion;
  right: Vector3;
  up: Vector3;
  fwd: Vector3;
}

function frameAt(path: FlightPath, p: number): Frame {
  const f: Frame = { pos: new Vector3(), quat: new Quaternion(), right: new Vector3(), up: new Vector3(), fwd: new Vector3() };
  path.frame(p, f.pos, f.quat, f.right, f.up, f.fwd);
  return f;
}

/** World point at path position p, offset sideways (x), up (y) and ahead (z). */
function place(path: FlightPath, p: number, x: number, y: number, z = 0, out = new Vector3()) {
  const f = frameAt(path, p);
  return out.copy(f.pos).addScaledVector(f.right, x).addScaledVector(f.up, y).addScaledVector(f.fwd, z);
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** On between a and b with near instant edges: worlds swap under the jump's flash. */
function hard(a: number, b: number) {
  const e = 0.012;
  return (p: number) => smooth(a - e, a + e, p) * (1 - smooth(b - e, b + e, p));
}

function hdr(c: Color, k: number) {
  return c.clone().multiplyScalar(k);
}

function standard(color: number, metalness: number, roughness: number, extra: Partial<MeshStandardMaterial> = {}) {
  const m = new MeshStandardMaterial({ color, metalness, roughness });
  Object.assign(m, extra);
  return m;
}

const SHARED_LIGHT = new Vector3(0.62, 0.42, 0.35).normalize();
const _h = new Vector3();

/** How close a world point is to the pointer ray: 1 on the ray, 0 beyond ang radians. */
function hover(ptr: PointerRay, w: Vector3, ang: number) {
  if (ptr.on <= 0) return 0;
  _h.subVectors(w, ptr.o);
  const t = _h.dot(ptr.d);
  if (t <= 0) return 0;
  _h.addScaledVector(ptr.d, -t);
  return ptr.on * Math.max(0, 1 - _h.length() / (t * ang));
}

/** Move a point away from the pointer ray by amount (world units). */
function pushAway(ptr: PointerRay, w: Vector3, amount: number, out: Vector3) {
  out.copy(w);
  if (amount <= 0.0001) return out;
  _h.subVectors(w, ptr.o);
  const t = _h.dot(ptr.d);
  _h.addScaledVector(ptr.d, -t);
  const l = _h.length() || 1;
  return out.addScaledVector(_h, amount / l);
}

/** The same two ideas for shaders: hover strength and a push away from the ray. */
const HOVER_GLSL = /* glsl */ `
uniform vec3 uRayO;
uniform vec3 uRayD;
uniform float uRayOn;
float hoverAt(vec3 w, float ang) {
  vec3 v = w - uRayO;
  float t = dot(v, uRayD);
  if (t <= 0.0) return 0.0;
  vec3 c = v - uRayD * t;
  return uRayOn * clamp(1.0 - length(c) / (t * ang), 0.0, 1.0);
}
vec3 pushFrom(vec3 w, vec3 centre, float ang, float amount) {
  vec3 v = centre - uRayO;
  float t = dot(v, uRayD);
  if (t <= 0.0) return w;
  vec3 c = v - uRayD * t;
  float k = uRayOn * clamp(1.0 - length(c) / (t * ang), 0.0, 1.0);
  return w + normalize(c + vec3(1e-4, 0.0, 0.0)) * k * k * amount * t * 0.08;
}
`;

// ------------------------------------------------------------------ shaders

const PLANET_VS = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
void main() {
  vObj = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const PLANET_FS = (oct: number) => /* glsl */ `
#define OCTAVES ${oct}
${NOISE}
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uAtmo;
uniform vec3 uLight;
uniform float uSeed;
uniform float uBands;
uniform float uBandMix;
uniform float uFade;
uniform float uDetail;
uniform float uTime;
uniform float uStorm;
uniform vec3 uAurora;
uniform float uHover;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
void main() {
  float n = fbm(vObj * 2.4 + uSeed);
  float n2 = fbm(vObj * 8.0 + n * 2.2 + uSeed * 1.7);
  float bands = sin(vObj.y * uBands + n * 5.0 + n2 * 1.4) * 0.5 + 0.5;
  float m = clamp(mix(n * 1.7 - 0.35, bands, uBandMix), 0.0, 1.0);
  vec3 alb = mix(uA, uB, m) * (0.72 + 0.5 * n2);
  if (uDetail > 0.0) {
    float fine = vnoise(vObj * 700.0) * 0.6 + vnoise(vObj * 2300.0) * 0.4;
    float ridge = 1.0 - abs(vnoise(vObj * 160.0 + n) * 2.0 - 1.0);
    alb *= mix(1.0, 0.7 + 0.5 * fine + 0.25 * ridge * ridge, uDetail);
  }
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float ndl = dot(N, uLight);
  float day = smoothstep(-0.1, 0.65, ndl);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  vec3 col = alb * day * 1.15;
  col += uAtmo * fres * (0.18 + 1.3 * smoothstep(-0.3, 0.5, ndl)) * (1.0 + uHover * 1.6);
  if (uStorm > 0.0) {
    // Lightning: cells that flicker on for a moment at random.
    vec3 cell = floor(vObj * 9.0);
    float h = hash13(cell + floor(uTime * 2.5) * 13.1);
    float flick = step(0.985, h) * (0.5 + 0.5 * sin(uTime * 70.0 + h * 40.0));
    float spot = smoothstep(0.5, 0.0, length(fract(vObj * 9.0) - 0.5));
    col += vec3(0.75, 0.8, 1.0) * flick * spot * uStorm * 4.0;
  }
  float lat = abs(vObj.y);
  float aur = smoothstep(0.7, 0.86, lat) * (1.0 - smoothstep(0.93, 1.0, lat));
  aur *= 0.45 + 0.55 * sin(atan(vObj.z, vObj.x) * 9.0 + uTime * 0.8 + n * 6.0);
  col += uAurora * max(aur, 0.0) * (0.65 + 0.35 * sin(uTime * 1.3));
  gl_FragColor = vec4(col * uFade, uFade);
}
`;

const ATMO_VS = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const ATMO_FS = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uFade;
uniform float uEdge;
uniform float uPower;
uniform float uHover;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float k = clamp(-dot(N, V) / uEdge, 0.0, 1.0);
  float lit = 0.2 + 1.2 * smoothstep(-0.35, 0.6, dot(N, uLight));
  float a = pow(k, uPower) * lit * (1.0 + uHover * 1.5);
  gl_FragColor = vec4(uColor * a * uFade, 1.0);
}
`;

const PUFF_VS = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aCol; // rgb, size
attribute float aRot;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  float c = cos(aRot);
  float s = sin(aRot);
  vec2 q = mat2(c, -s, s, c) * position.xy;
  mv.xy += q * aCol.a;
  vUv = position.xy * 0.5 + 0.5;
  vCol = aCol.rgb;
  float d = -mv.z;
  vA = smoothstep(aCol.a * 0.3, aCol.a * 1.4, d) * step(1.0, d);
  gl_Position = projectionMatrix * mv;
}
`;

const PUFF_FS = /* glsl */ `
uniform sampler2D tCloud;
uniform float uFade;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
void main() {
  float a = texture2D(tCloud, vUv).a;
  gl_FragColor = vec4(vCol * a * vA * uFade * uOpacity, 1.0);
}
`;

/** Soft nebula billboards in one draw call. */
function puffs(list: { pos: Vector3; size: number; color: Color; rot: number }[], cloud: Texture, fade: { value: number }, opacity: number) {
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const pos = new Float32Array(list.length * 3);
  const col = new Float32Array(list.length * 4);
  const rot = new Float32Array(list.length);
  list.forEach((p, i) => {
    pos.set([p.pos.x, p.pos.y, p.pos.z], i * 3);
    col.set([p.color.r, p.color.g, p.color.b, p.size], i * 4);
    rot[i] = p.rot;
  });
  g.setAttribute("aPos", new InstancedBufferAttribute(pos, 3));
  g.setAttribute("aCol", new InstancedBufferAttribute(col, 4));
  g.setAttribute("aRot", new InstancedBufferAttribute(rot, 1));
  g.instanceCount = list.length;
  const m = additive(
    new ShaderMaterial({ vertexShader: PUFF_VS, fragmentShader: PUFF_FS, uniforms: { tCloud: { value: cloud }, uFade: fade, uOpacity: { value: opacity } }, side: DoubleSide }),
  );
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return mesh;
}

interface PlanetOpts {
  radius: number;
  a: Color;
  b: Color;
  atmo: Color;
  seed: number;
  bands?: number;
  bandMix?: number;
  light?: Vector3;
  segs?: number;
  detail?: number;
  storm?: number;
  aurora?: Color;
}

/** A shaded world with an atmosphere shell. userData.uniforms holds uTime and uHover. */
function planet(ctx: Ctx, fade: { value: number }, o: PlanetOpts) {
  const g = new Group();
  const segs = o.segs ?? (ctx.low ? 40 : 72);
  const light = o.light ?? SHARED_LIGHT;
  const shared = { uTime: { value: 0 }, uHover: { value: 0 } };
  const body = new Mesh(
    new SphereGeometry(o.radius, segs, Math.round(segs * 0.6)),
    new ShaderMaterial({
      vertexShader: PLANET_VS,
      fragmentShader: PLANET_FS(ctx.low ? 3 : 5),
      uniforms: {
        ...shared,
        uA: { value: o.a },
        uB: { value: o.b },
        uAtmo: { value: o.atmo },
        uLight: { value: light },
        uSeed: { value: o.seed },
        uBands: { value: o.bands ?? 0 },
        uBandMix: { value: o.bandMix ?? 0 },
        uFade: fade,
        uDetail: { value: o.detail ?? 0 },
        uStorm: { value: o.storm ?? 0 },
        uAurora: { value: o.aurora ?? new Color(0, 0, 0) },
      },
      transparent: true,
    }),
  );
  const shell = new Mesh(
    new SphereGeometry(o.radius * 1.12, Math.round(segs * 0.7), Math.round(segs * 0.4)),
    additive(
      new ShaderMaterial({
        vertexShader: ATMO_VS,
        fragmentShader: ATMO_FS,
        uniforms: { uHover: shared.uHover, uColor: { value: o.atmo }, uLight: { value: light }, uFade: fade, uEdge: { value: 0.47 }, uPower: { value: 2.4 } },
        side: BackSide,
      }),
    ),
  );
  g.add(body, shell);
  g.userData.uniforms = shared;
  return g;
}

// ------------------------------------------------------------------ living things

/** Small craft on looping paths, each with a body, a nav light and an engine glow. */
class Traffic {
  readonly group = new Group();
  readonly count: number;
  private readonly mesh: InstancedMesh;
  private readonly glows: GlowBatch;
  private readonly paths: { c: Vector3; a: Vector3; b: Vector3; r: number; w: number; ph: number }[] = [];
  private readonly m = new Matrix4();
  private readonly pos = new Vector3();
  private readonly ahead = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly scale = new Vector3(1, 1, 1);

  constructor(n: number, color: Color, fade: { value: number }) {
    this.count = n;
    const parts = [new BoxGeometry(0.5, 0.32, 1.7), new BoxGeometry(1.6, 0.06, 0.5).translate(0, 0, 0.35), new BoxGeometry(0.3, 0.3, 0.3).translate(0, 0.2, -0.5)].map((g) => g.toNonIndexed());
    const geo = mergeGeometries(parts, false)!;
    this.mesh = new InstancedMesh(geo, standard(0xd8dbe0, 0.4, 0.45), n);
    this.mesh.frustumCulled = false;
    this.glows = new GlowBatch(n * 2, fade);
    for (let k = 0; k < n; k++) {
      this.glows.add(0, 0, 0, 0.9, color.r * 0.6 + 0.4, color.g * 0.6 + 0.4, color.b * 0.6 + 0.4, 1.8);
      this.glows.add(0, 0, 0, 0.35, k % 2 ? 1 : 0.3, k % 2 ? 0.2 : 1, 0.3, 1.4);
      this.paths.push({ c: new Vector3(), a: new Vector3(1, 0, 0), b: new Vector3(0, 0, 1), r: 20, w: 0.2, ph: k });
    }
    this.group.add(this.mesh, this.glows.mesh);
  }

  /** Loop craft k around centre c in the plane of a and b, tilted a little. */
  orbit(k: number, c: Vector3, a: Vector3, b: Vector3, r: number, w: number, ph: number, tilt: number) {
    const p = this.paths[k];
    p.c.copy(c);
    p.a.copy(a).normalize();
    p.b.copy(b).normalize().applyAxisAngle(p.a, (k % 2 ? 1 : -1) * tilt);
    p.r = r;
    p.w = (k % 2 ? 1 : -1) * w;
    p.ph = ph;
  }

  update(time: number) {
    for (let k = 0; k < this.count; k++) {
      const p = this.paths[k];
      const t = time * p.w + p.ph;
      this.pos.copy(p.c).addScaledVector(p.a, Math.cos(t) * p.r).addScaledVector(p.b, Math.sin(t) * p.r * 0.7);
      this.ahead.copy(p.c).addScaledVector(p.a, Math.cos(t + 0.05 * Math.sign(p.w)) * p.r).addScaledVector(p.b, Math.sin(t + 0.05 * Math.sign(p.w)) * p.r * 0.7);
      this.m.lookAt(this.ahead, this.pos, this.up);
      this.m.setPosition(this.pos);
      this.m.scale(this.scale);
      this.mesh.setMatrixAt(k, this.m);
      // Engine glow behind, nav light on top.
      this.ahead.sub(this.pos).normalize();
      this.glows.setPos(k * 2, this.pos.x - this.ahead.x * 1.0, this.pos.y - this.ahead.y * 1.0, this.pos.z - this.ahead.z * 1.0);
      this.glows.setPos(k * 2 + 1, this.pos.x, this.pos.y + 0.3, this.pos.z);
      this.glows.setIntensity(k * 2 + 1, Math.pow(Math.max(0, Math.sin(time * 4 + k)), 12) * 3);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.glows.commit();
  }
}

const COMET_VS = /* glsl */ `
attribute vec2 aCorner;
attribute vec3 aHead;
attribute vec4 aDir; // direction, length
varying float vAlong;
varying float vEdge;
void main() {
  vec3 tail = aHead - aDir.xyz * aDir.w;
  vec4 h = viewMatrix * vec4(aHead, 1.0);
  vec4 t = viewMatrix * vec4(tail, 1.0);
  vec4 mv = mix(h, t, aCorner.x);
  vec3 side = normalize(cross(t.xyz - h.xyz + vec3(0.0, 0.0, 1e-4), mv.xyz));
  mv.xyz += side * aCorner.y * mix(0.9, 0.05, aCorner.x) * (0.004 * max(-mv.z, 1.0) + 0.6);
  vAlong = aCorner.x;
  vEdge = aCorner.y;
  gl_Position = projectionMatrix * mv;
}
`;

const COMET_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying float vAlong;
varying float vEdge;
void main() {
  float a = (1.0 - abs(vEdge)) * pow(max(1.0 - vAlong, 0.0), 2.0) * uFade;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

/** Comets on long straight crossings, each with a glowing head and a tapering tail. */
class Comets {
  readonly group = new Group();
  private readonly heads: GlowBatch;
  private readonly aHead: InstancedBufferAttribute;
  private readonly aDir: InstancedBufferAttribute;
  private readonly runs: { s: Vector3; d: Vector3; len: number; period: number; ph: number }[] = [];
  private readonly r: () => number;

  constructor(n: number, color: Color, fade: { value: number }, r: () => number) {
    this.r = r;
    const g = new InstancedBufferGeometry();
    g.setAttribute("aCorner", new BufferAttribute(new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), 2));
    g.setAttribute("position", new BufferAttribute(new Float32Array(12), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    this.aHead = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.aHead.setUsage(DynamicDrawUsage);
    this.aDir = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
    g.setAttribute("aHead", this.aHead);
    g.setAttribute("aDir", this.aDir);
    g.instanceCount = n;
    const tails = new Mesh(g, additive(new ShaderMaterial({ vertexShader: COMET_VS, fragmentShader: COMET_FS, uniforms: { uColor: { value: color.clone().lerp(new Color(1, 1, 1), 0.4).multiplyScalar(1.6) }, uFade: fade }, side: DoubleSide })));
    tails.frustumCulled = false;
    tails.renderOrder = 6;
    this.heads = new GlowBatch(n, fade);
    for (let k = 0; k < n; k++) {
      this.heads.add(0, 0, 0, 2.2, 0.9, 0.95, 1, 0);
      this.runs.push({ s: new Vector3(), d: new Vector3(1, 0, 0), len: 300, period: 12, ph: 0 });
    }
    this.group.add(tails, this.heads.mesh);
  }

  /** Lay out crossings around a centre, mostly across the view. */
  scatter(c: Vector3, right: Vector3, up: Vector3, fwd: Vector3, radius: number) {
    const r = this.r;
    this.runs.forEach((run, k) => {
      const side = r() < 0.5 ? -1 : 1;
      run.s.copy(c).addScaledVector(right, side * radius * (0.8 + r() * 0.6)).addScaledVector(up, (r() - 0.3) * radius).addScaledVector(fwd, (r() - 0.5) * radius);
      run.d.copy(right).multiplyScalar(-side).addScaledVector(up, (r() - 0.5) * 0.6).addScaledVector(fwd, (r() - 0.5) * 0.8).normalize();
      run.len = radius * (2 + r());
      run.period = 9 + r() * 10;
      run.ph = r();
      this.aDir.setXYZW(k, run.d.x, run.d.y, run.d.z, 18 + r() * 30);
    });
    this.aDir.needsUpdate = true;
  }

  update(time: number) {
    this.runs.forEach((run, k) => {
      const f = (time / run.period + run.ph) % 1;
      const x = run.s.x + run.d.x * run.len * f;
      const y = run.s.y + run.d.y * run.len * f;
      const z = run.s.z + run.d.z * run.len * f;
      this.aHead.setXYZ(k, x, y, z);
      this.heads.setPos(k, x, y, z);
      this.heads.setIntensity(k, Math.sin(Math.PI * f) * 2.4);
    });
    this.aHead.needsUpdate = true;
    this.heads.commit();
  }
}

const MOTE_VS = /* glsl */ `
${HOVER_GLSL}
attribute float aSeed;
uniform float uTime;
uniform float uPx;
uniform float uDpr;
uniform float uSize;
varying float vA;
void main() {
  vec3 p = position + vec3(sin(uTime * 0.21 + aSeed * 40.0), sin(uTime * 0.17 + aSeed * 23.0) * 0.6, cos(uTime * 0.19 + aSeed * 31.0)) * 2.5;
  vec4 w = modelMatrix * vec4(p, 1.0);
  w.xyz = pushFrom(w.xyz, w.xyz, 0.1, 2.0);
  vec4 mv = viewMatrix * w;
  gl_PointSize = clamp(uSize * uPx / max(-mv.z, 1.0), 1.0 * uDpr, 5.0 * uDpr);
  vA = (0.4 + 0.6 * fract(aSeed * 7.3)) * (0.6 + 0.4 * sin(uTime * (0.8 + aSeed) + aSeed * 50.0));
  gl_Position = projectionMatrix * mv;
}
`;

const MOTE_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * a * a * vA * uFade, 1.0);
}
`;

/** Drifting motes of light or dust in a ball around a centre; they part around the pointer. */
class Motes {
  readonly points: Points;
  private readonly mat: ShaderMaterial;
  constructor(ctx: Ctx, n: number, c: Vector3, radius: number, color: Color, fade: { value: number }, size: number) {
    const r = rng(n * 7 + 3);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = Math.cbrt(r()) * radius;
      const s = Math.sqrt(1 - u * u);
      pos.set([c.x + Math.cos(th) * s * rad, c.y + u * rad * 0.6, c.z + Math.sin(th) * s * rad], k * 3);
      seed[k] = r();
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new BufferAttribute(seed, 1));
    this.mat = additive(
      new ShaderMaterial({
        vertexShader: MOTE_VS,
        fragmentShader: MOTE_FS,
        uniforms: { ...ctx.ray, uPx: VIEW.uPx, uDpr: VIEW.uDpr, uTime: { value: 0 }, uSize: { value: size }, uColor: { value: color }, uFade: fade },
      }),
    );
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }
  update(time: number) {
    this.mat.uniforms.uTime.value = time;
  }
}

// ------------------------------------------------------------------ 1 launch

/** Departure: the ship has just come through a gate of light, which stays behind it. */
function launch(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const f = frameAt(path, i - 0.01);
  group.position.copy(f.pos);
  group.quaternion.copy(f.quat);

  const R = 24;
  const ringMat = new MeshBasicMaterial({ color: hdr(color, 4.5) });
  const ring = new Mesh(new TorusGeometry(R, 0.42, 10, low ? 96 : 180), ringMat);
  const inner = new Mesh(new TorusGeometry(R - 1.3, 0.06, 6, low ? 96 : 180), new MeshBasicMaterial({ color: new Color(2.4, 2.5, 2.7) }));
  const halo = new Mesh(new TorusGeometry(R + 5.4, 0.08, 6, low ? 96 : 180), new MeshBasicMaterial({ color: hdr(color, 2.2) }));

  // The gate's machinery: armoured segments with lit gaps.
  const SEGS = low ? 18 : 28;
  const frame = new Group();
  const segGeo = new BoxGeometry((2 * Math.PI * (R + 2)) / SEGS - 1.1, 2.6, 3.6);
  const segs = new InstancedMesh(segGeo, standard(0x232934, 0.85, 0.32), SEGS);
  const capGeo = new BoxGeometry((2 * Math.PI * (R + 2)) / SEGS - 2.2, 0.5, 2.8);
  const caps = new InstancedMesh(capGeo, standard(0xc9ced6, 0.4, 0.35), SEGS);
  const gaps = new InstancedMesh(new BoxGeometry(0.5, 1.8, 3.9), new MeshBasicMaterial({ color: hdr(color, 3.2) }), SEGS);
  const m = new Matrix4();
  const q = new Quaternion();
  const z = new Vector3(0, 0, 1);
  const v = new Vector3();
  const one = new Vector3(1, 1, 1);
  for (let k = 0; k < SEGS; k++) {
    const a = (k / SEGS) * Math.PI * 2;
    q.setFromAxisAngle(z, a - Math.PI / 2);
    segs.setMatrixAt(k, m.compose(v.set(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2), 0), q, one));
    caps.setMatrixAt(k, m.compose(v.set(Math.cos(a) * (R + 3.5), Math.sin(a) * (R + 3.5), 0), q, one));
    const b = a + Math.PI / SEGS;
    q.setFromAxisAngle(z, b - Math.PI / 2);
    gaps.setMatrixAt(k, m.compose(v.set(Math.cos(b) * (R + 2), Math.sin(b) * (R + 2), 0), q, one));
  }
  frame.add(segs, caps, gaps);

  const memMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        #define OCTAVES 3
        ${NOISE}
        uniform vec3 uColor; uniform float uTime; uniform float uFade; uniform float uNear;
        varying vec2 vUv;
        void main() {
          vec2 d = vUv - 0.5;
          float r = length(d) * 2.0;
          float ang = atan(d.y, d.x);
          float swirl = fbm(vec3(cos(ang) * 2.0 + r * 3.0, sin(ang) * 2.0 - uTime * 0.25, r * 2.0 - uTime * 0.15));
          float edge = pow(r, 7.0) * 0.9;
          float body = (0.015 + swirl * 0.06) * smoothstep(0.2, 0.95, r);
          float a = (edge + body) * smoothstep(1.0, 0.97, r) * uFade * uNear;
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
      uniforms: { uColor: { value: hdr(color, 1.4) }, uTime: { value: 0 }, uFade: fade, uNear: { value: 1 } },
      side: DoubleSide,
    }),
  );
  const membrane = new Mesh(new CircleGeometry(R - 0.5, low ? 48 : 96), memMat);
  membrane.renderOrder = 7;

  // A tunnel of smaller rings behind it, the way the ship came.
  const echoes = new Group();
  for (const [dz, r, k] of [
    [70, 18, 2.4],
    [150, 13, 1.6],
    [240, 9, 1.0],
  ]) {
    const e = new Mesh(new TorusGeometry(r, 0.22, 8, 96), new MeshBasicMaterial({ color: hdr(color, k) }));
    e.position.z = dz;
    echoes.add(e);
  }
  const beacons = new GlowBatch(SEGS, fade);
  for (let k = 0; k < SEGS; k++) {
    const a = ((k + 0.5) / SEGS) * Math.PI * 2;
    beacons.add(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2), 2.2, 1.6, color.r, color.g, color.b, 1.6);
  }
  group.add(ring, inner, halo, frame, membrane, echoes, beacons.mesh);

  // Far off, a pale blue world the voyage leaves behind.
  const home = planet(ctx, fade, {
    radius: 260,
    a: new Color(0.02, 0.05, 0.12),
    b: new Color(0.18, 0.32, 0.55),
    atmo: hdr(color, 1.2),
    seed: 1.7,
    bands: 2,
    bandMix: 0.15,
    light: new Vector3(0.7, 0.4, -0.5).normalize(),
  });
  home.position.copy(place(path, i - 0.4, 260, -420, 0));
  const outer = new Group();
  outer.add(group, home);

  // Small craft come and go through the gate.
  const craft = new Traffic(low ? 6 : 12, color, fade);
  const gateC = f.pos.clone();
  for (let k = 0; k < craft.count; k++) craft.orbit(k, gateC, f.up, f.fwd, 30 + (k % 4) * 9, 0.12 + (k % 3) * 0.05, k * 1.7, 0.35);
  outer.add(craft.group);

  // Beacons brighten when the pointer passes near them.
  group.updateMatrixWorld(true);
  const beaconWorld: Vector3[] = [];
  for (let k = 0; k < SEGS; k++) beaconWorld.push(new Vector3(beacons.pos[k * 3], beacons.pos[k * 3 + 1], beacons.pos[k * 3 + 2]).applyMatrix4(group.matrixWorld));
  const hot = new Float32Array(SEGS);

  const local = new Vector3();
  return {
    id: "launch",
    group: outer,
    fade,
    weight: hard(-10, i + CROSS),
    nebula: 0.12,
    update({ time, dt, camera, ptr }) {
      frame.rotation.z += dt * 0.04;
      echoes.rotation.z -= dt * 0.06;
      memMat.uniforms.uTime.value = time;
      local.copy(camera.position);
      group.worldToLocal(local);
      memMat.uniforms.uNear.value = smooth(3, 26, Math.abs(local.z));
      for (let k = 0; k < SEGS; k++) {
        hot[k] = Math.max(hover(ptr, beaconWorld[k], 0.07), hot[k] - dt * 1.5);
        beacons.setIntensity(k, 1.2 + 1.4 * Math.pow(0.5 + 0.5 * Math.sin(time * 2 - k * 0.7), 4) + hot[k] * 7);
      }
      beacons.commit();
      craft.update(time);
    },
  };
}

// ------------------------------------------------------------------ 2 proof

function shardGeometry(seed: number) {
  const r = rng(seed);
  const g = new IcosahedronGeometry(1, 0);
  const pos = g.getAttribute("position") as BufferAttribute;
  const jitter = new Map<string, number[]>();
  for (let k = 0; k < pos.count; k++) {
    const key = `${pos.getX(k).toFixed(3)},${pos.getY(k).toFixed(3)},${pos.getZ(k).toFixed(3)}`;
    if (!jitter.has(key)) jitter.set(key, [0.7 + r() * 0.6, 0.7 + r() * 0.6, 0.7 + r() * 0.6]);
    const j = jitter.get(key)!;
    pos.setXYZ(k, pos.getX(k) * j[0] * 0.55, pos.getY(k) * j[1] * 1.7, pos.getZ(k) * j[2] * 0.6);
  }
  g.computeVertexNormals();
  return g;
}

/** A field of dark glassy crystal shards, some lit from within, joined by threads of light. */
function proof(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const r = rng(101);
  const N = low ? 60 : 150;
  const variants = 3;
  const per = Math.ceil(N / variants);
  const rockMat = standard(0x1a2029, 0.55, 0.22, { flatShading: true });
  rockMat.emissive = hdr(color, 0.02);
  rockMat.envMapIntensity = 1.3;
  const meshes: InstancedMesh[] = [];
  for (let k = 0; k < variants; k++) {
    const im = new InstancedMesh(shardGeometry(7 + k), rockMat, per);
    im.frustumCulled = false;
    meshes.push(im);
    group.add(im);
  }
  interface Shard {
    pos: Vector3;
    axis: Vector3;
    speed: number;
    angle: number;
    scale: Vector3;
    mesh: number;
    slot: number;
  }
  const shards: Shard[] = [];
  const counts = new Array(variants).fill(0);
  let placedCount = 0;
  while (placedCount < N) {
    const p = i - 0.2 + r() * 0.75;
    const th = r() * Math.PI * 2;
    const rad = 14 + Math.pow(r(), 1.4) * 140;
    // Keep the camera's side of the ship clear.
    if (Math.cos(th) > 0.35 && rad < 120) continue;
    const s = 0.9 + Math.pow(r(), 3) * 9;
    const mesh = placedCount % variants;
    shards.push({
      pos: place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.8),
      axis: new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
      speed: (r() - 0.5) * 0.4,
      angle: r() * Math.PI * 2,
      scale: new Vector3(s, s * (0.8 + r() * 0.6), s),
      mesh,
      slot: counts[mesh]++,
    });
    placedCount++;
  }
  meshes.forEach((mm, k) => (mm.count = counts[k]));

  const CN = low ? 12 : 30;
  const crystals = new InstancedMesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: hdr(color, 2.6) }), CN);
  crystals.frustumCulled = false;
  const cpos: Vector3[] = [];
  const mm = new Matrix4();
  const qq = new Quaternion();
  let c = 0;
  while (c < CN) {
    const p = i - 0.15 + r() * 0.65;
    const th = r() * Math.PI * 2;
    const rad = 16 + r() * 80;
    if (Math.cos(th) > 0.35 && rad < 120) continue;
    const pos = place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.75);
    cpos.push(pos);
    qq.setFromAxisAngle(new Vector3(r(), r(), r()).normalize(), r() * 3);
    const s = 0.35 + r() * 0.6;
    crystals.setMatrixAt(c, mm.compose(pos, qq, new Vector3(s * 0.6, s * 1.8, s * 0.6)));
    c++;
  }
  group.add(crystals);

  const lp: number[] = [];
  const lt: number[] = [];
  const nodes = [...cpos, ...shards.filter((s) => s.scale.x < 3).map((s) => s.pos)];
  for (let a = 0; a < cpos.length; a++) {
    let links = 0;
    for (let b = 0; b < nodes.length && links < 3; b++) {
      if (nodes[b] === cpos[a]) continue;
      const d = cpos[a].distanceTo(nodes[b]);
      if (d < 55 && d > 6) {
        lp.push(cpos[a].x, cpos[a].y, cpos[a].z, nodes[b].x, nodes[b].y, nodes[b].z);
        const seed = r();
        lt.push(0, seed, 1, seed);
        links++;
      }
    }
  }
  const lg = new BufferGeometry();
  lg.setAttribute("position", new BufferAttribute(new Float32Array(lp), 3));
  lg.setAttribute("aT", new BufferAttribute(new Float32Array(lt), 2));
  const lineMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `attribute vec2 aT; varying vec2 vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uTime; uniform float uFade;
        varying vec2 vT;
        void main() {
          float pulse = pow(0.5 + 0.5 * sin((vT.x - uTime * 0.35 - vT.y * 7.0) * 6.2832), 10.0);
          float a = (0.2 + 1.3 * pulse) * uFade;
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
      uniforms: { uColor: { value: hdr(color, 1.5) }, uTime: { value: 0 }, uFade: fade },
    }),
  );
  const lines = new LineSegments(lg, lineMat);
  lines.frustumCulled = false;
  group.add(lines);

  // Comets cross the field now and then.
  const comets = new Comets(low ? 2 : 4, color, fade, rng(111));
  const cf = frameAt(path, i + 0.15);
  comets.scatter(cf.pos, cf.right, cf.up, cf.fwd, 260);
  group.add(comets.group);

  // Shards drift away from the pointer and catch a little light as they do.
  const base = new Color(1, 1, 1);
  const lit = new Color().copy(color).lerp(new Color(1, 1, 1), 0.5).multiplyScalar(3);
  const push = new Float32Array(shards.length);
  for (const s of shards) meshes[s.mesh].setColorAt(s.slot, base);
  const sc = new Vector3();
  const off = new Vector3();
  const tint = new Color();
  return {
    id: "proof",
    group,
    fade,
    weight: hard(i - 1 + CROSS, i + CROSS),
    nebula: 0.18,
    update({ time, dt, ptr }) {
      lineMat.uniforms.uTime.value = time;
      shards.forEach((s, n) => {
        s.angle += s.speed * dt;
        qq.setFromAxisAngle(s.axis, s.angle);
        const h = hover(ptr, s.pos, 0.09);
        push[n] += (h - push[n]) * Math.min(1, dt * 3);
        pushAway(ptr, s.pos, push[n] * 9, off);
        meshes[s.mesh].setMatrixAt(s.slot, mm.compose(off, qq, sc.copy(s.scale)));
        meshes[s.mesh].setColorAt(s.slot, tint.copy(base).lerp(lit, push[n]));
      });
      for (const me of meshes) {
        me.instanceMatrix.needsUpdate = true;
        if (me.instanceColor) me.instanceColor.needsUpdate = true;
      }
      comets.update(time);
    },
  };
}

// ------------------------------------------------------------------ 3 projects

/** A tall truss station: stacked modules on a spine with wide solar wings. */
function station(color: Color, low: boolean, scale: number) {
  const g = new Group();
  const seg = low ? 12 : 20;
  const light = standard(0xd9dcdf, 0.35, 0.4);
  const metal = standard(0x8f99a6, 0.95, 0.3);
  const dark = standard(0x15181e, 0.6, 0.5);
  const panel = standard(0x0b1530, 0.85, 0.3);
  panel.emissive = hdr(color, 0.06);
  const L: BufferGeometry[] = [];
  const M: BufferGeometry[] = [];
  const D: BufferGeometry[] = [];
  const P: BufferGeometry[] = [];
  const nonIdx = (x: BufferGeometry) => (x.index ? x.toNonIndexed() : x);
  // Spine truss.
  for (const [x, z] of [
    [0.35, 0.35],
    [-0.35, 0.35],
    [0.35, -0.35],
    [-0.35, -0.35],
  ])
    M.push(nonIdx(new BoxGeometry(0.08, 18, 0.08).translate(x, 0, z)));
  for (let y = -8.5; y <= 8.5; y += 1.2) M.push(nonIdx(new BoxGeometry(0.75, 0.06, 0.06).translate(0, y, 0.35)), nonIdx(new BoxGeometry(0.75, 0.06, 0.06).translate(0, y, -0.35)));
  // Modules.
  for (const [y, r, h] of [
    [5.5, 1.3, 3.2],
    [1.5, 1.6, 3.6],
    [-3.2, 1.2, 2.8],
  ]) {
    L.push(nonIdx(new CylinderGeometry(r, r, h, seg, 1).translate(0, y, 0)));
    D.push(nonIdx(new CylinderGeometry(r + 0.05, r + 0.05, 0.12, seg, 1).translate(0, y + h / 2 - 0.2, 0)));
  }
  // Solar wings on a cross boom.
  M.push(nonIdx(new BoxGeometry(26, 0.18, 0.18).translate(0, -6.5, 0)));
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) P.push(nonIdx(new BoxGeometry(3.4, 0.06, 5.2).translate(sx * (3.2 + k * 3.6), -6.5, 0)));
  // Radiators.
  for (const sx of [-1, 1]) D.push(nonIdx(new BoxGeometry(0.05, 4, 2.2).translate(sx * 1.9, 1.5, 0)));
  const merge = (list: BufferGeometry[]) => mergeGeometries(list, false)!;
  g.add(new Mesh(merge(L), light), new Mesh(merge(M), metal), new Mesh(merge(D), dark), new Mesh(merge(P), panel));
  const windows = new Mesh(new TorusGeometry(1.62, 0.05, 4, seg * 2).rotateX(Math.PI / 2).translate(0, 1.5, 0), new MeshBasicMaterial({ color: hdr(color, 2.2) }));
  g.add(windows);
  g.scale.setScalar(scale);
  return g;
}

/** Workshops in orbit: truss stations hanging below the line over a banded world. */
function projects(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const lights = new GlowBatch(16, fade);
  const lightIdx: number[] = [];
  const spots: [number, number, number, number, number][] = [
    [i - 0.08, -34, -28, 1.6, 0.3],
    [i + 0.16, 40, -40, 2.2, -0.5],
    [i + 0.42, -20, -52, 1.2, 0.9],
    [i + 0.3, 58, -14, 1.0, 1.4],
  ];
  const stations: Group[] = [];
  for (const [p, x, y, s, tilt] of spots) {
    const f = frameAt(path, p);
    const st = station(color, low, s);
    st.position.copy(place(path, p, x, y));
    st.quaternion.copy(f.quat);
    st.rotateZ(0.5 + tilt);
    st.rotateX(1.2);
    group.add(st);
    stations.push(st);
    st.updateMatrixWorld(true);
    for (const yy of [-9, 9]) {
      const w = new Vector3(0, yy, 0).applyMatrix4(st.matrixWorld);
      lightIdx.push(lights.add(w.x, w.y, w.z, 1.0 * s, 1, 0.85, 0.7, 0));
    }
  }
  group.add(lights.mesh);
  const blue = color.clone();
  const world = planet(ctx, fade, {
    radius: 150,
    a: new Color(0.05, 0.08, 0.18),
    b: blue.clone().multiplyScalar(0.85),
    atmo: hdr(blue, 1.3),
    seed: 4.2,
    bands: 9,
    bandMix: 0.65,
    light: new Vector3(0.3, 0.8, -0.4).normalize(),
  });
  world.position.copy(place(path, i + 0.35, 60, -330));
  const moon = planet(ctx, fade, {
    radius: 18,
    a: new Color(0.12, 0.12, 0.14),
    b: new Color(0.42, 0.43, 0.47),
    atmo: hdr(blue, 0.5),
    seed: 9.1,
    segs: low ? 24 : 40,
    light: new Vector3(0.3, 0.8, -0.4).normalize(),
  });
  moon.position.copy(place(path, i + 0.05, -110, -120));
  group.add(world, moon);

  // Shuttles working between the stations.
  const craft = new Traffic(low ? 8 : 16, color, fade);
  const hubF = frameAt(path, i + 0.15);
  const hubC = place(path, i + 0.15, 10, -36);
  for (let k = 0; k < craft.count; k++) craft.orbit(k, hubC, hubF.up, hubF.right, 26 + (k % 5) * 8, 0.1 + (k % 4) * 0.04, k * 2.3, 0.6);
  group.add(craft.group);
  const stationPos = stations.map((s) => s.position.clone());
  const hot = new Float32Array(stations.length);

  return {
    id: "projects",
    group,
    fade,
    weight: hard(i - 1 + CROSS, i + CROSS),
    nebula: 0.2,
    update({ time, dt, ptr }) {
      for (let k = 0; k < stations.length; k++) {
        stations[k].rotateY(dt * (0.05 + k * 0.02));
        hot[k] = Math.max(hover(ptr, stationPos[k], 0.1), hot[k] - dt);
      }
      for (let k = 0; k < lightIdx.length; k++) {
        const s = Math.floor(k / 2);
        lights.setIntensity(lightIdx[k], Math.pow(Math.max(0, Math.sin(time * 1.8 + k * 1.3)), 8) * 4 + hot[s] * 6);
      }
      lights.commit();
      craft.update(time);
    },
  };
}

// ------------------------------------------------------------------ 4 disciplines

const HUES = ["#F5A524", "#5B8DEF", "#34D399", "#A78BFA"];

/** Four worlds hanging overhead, seen from below as the ship passes under them. */
function disciplines(i: number, _color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const spots: [number, number, number, number, number][] = [
    [i - 0.22, -70, 70, 34, 0],
    [i - 0.05, 30, 95, 30, 1],
    [i + 0.12, 95, 58, 38, 2],
    [i + 0.3, -25, 120, 32, 3],
  ];
  const light = new Vector3(0.3, -0.55, -0.78).normalize();
  const worlds: { g: Group; u: Record<string, { value: number }>; pos: Vector3; rad: number }[] = [];
  const moons: { m: Group; c: Vector3; r: number; w: number; ph: number; ax: Vector3; bx: Vector3 }[] = [];
  for (const [p, x, y, rad, h] of spots) {
    const c = new Color(HUES[h]);
    const pl = planet(ctx, fade, {
      radius: rad,
      a: c.clone().multiplyScalar(0.12),
      b: c.clone().multiplyScalar(0.75),
      atmo: hdr(c, 1.5),
      seed: 2.3 + h * 3.1,
      bands: h === 0 ? 14 : h === 2 ? 0 : 6,
      bandMix: h === 0 ? 0.85 : h === 2 ? 0 : 0.4,
      light,
      // Lightning in the banded giant, auroras on the violet world.
      storm: h === 0 ? 1 : 0,
      aurora: h === 3 ? new Color(0.4, 1.6, 0.9) : h === 1 ? new Color(0.5, 0.9, 1.8) : undefined,
    });
    pl.position.copy(place(path, p, x, y));
    pl.rotation.set(0.3 * h, h, 0.2);
    group.add(pl);
    worlds.push({ g: pl, u: pl.userData.uniforms, pos: pl.position.clone(), rad });
    // A small moon or two in orbit.
    for (let k = 0; k < (h === 0 ? 2 : 1); k++) {
      const mr = rad * (0.08 + 0.05 * k);
      const moon = planet(ctx, fade, { radius: mr, a: new Color(0.1, 0.1, 0.11), b: new Color(0.45, 0.44, 0.42), atmo: hdr(c, 0.3), seed: 5 + h + k, segs: low ? 16 : 24, light });
      group.add(moon);
      const ax = new Vector3(1, 0.2 * k, 0).normalize();
      moons.push({ m: moon, c: pl.position.clone(), r: rad * (1.9 + k * 0.6), w: 0.12 / (1 + k), ph: h + k * 2, ax, bx: new Vector3(0, 0.35, 1).normalize() });
    }
    if (h === 0) {
      const ringMat = additive(
        new ShaderMaterial({
          vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: /* glsl */ `
            uniform vec3 uColor; uniform float uFade; uniform float uIn; uniform float uOut;
            varying vec3 vP;
            void main() {
              float r = (length(vP.xy) - uIn) / (uOut - uIn);
              float b = 0.5 + 0.5 * sin(r * 70.0) * sin(r * 23.0 + 1.0);
              float gap = smoothstep(0.42, 0.45, r) * (1.0 - smoothstep(0.5, 0.53, r));
              float a = b * (1.0 - gap) * smoothstep(0.0, 0.08, r) * (1.0 - smoothstep(0.9, 1.0, r)) * 0.5 * uFade;
              gl_FragColor = vec4(uColor * a, 1.0);
            }`,
          uniforms: { uColor: { value: c.clone().multiplyScalar(0.9) }, uFade: fade, uIn: { value: rad * 1.35 }, uOut: { value: rad * 2.3 } },
          side: DoubleSide,
        }),
      );
      const ring = new Mesh(new RingGeometry(rad * 1.35, rad * 2.3, low ? 64 : 128, 1), ringMat);
      ring.rotation.set(1.2, 0.3, 0);
      pl.add(ring);
    }
  }
  return {
    id: "disciplines",
    group,
    fade,
    weight: hard(i - 1 + CROSS, i + CROSS),
    nebula: 0.25,
    update({ time, dt, ptr }) {
      for (const w of worlds) {
        w.g.rotation.y += dt * 0.02;
        w.u.uTime.value = time;
        // Hovering a world brightens its atmosphere.
        const h = hover(ptr, w.pos, 0.18);
        w.u.uHover.value += (h - w.u.uHover.value) * Math.min(1, dt * 4);
      }
      for (const m of moons) {
        const a = time * m.w + m.ph;
        m.m.position.copy(m.c).addScaledVector(m.ax, Math.cos(a) * m.r).addScaledVector(m.bx, Math.sin(a) * m.r);
      }
    },
  };
}

// ------------------------------------------------------------------ 5 writing

const MONO_VS = /* glsl */ `
${HOVER_GLSL}
attribute float aSeed;
uniform float uTime;
varying vec3 vN;
varying vec3 vW;
varying vec3 vObj;
varying float vSeed;
varying float vHover;
void main() {
  float a = uTime * (0.02 + aSeed * 0.04) + aSeed * 10.0;
  float c = cos(a);
  float s = sin(a);
  mat3 rot = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
  vec3 p = rot * position;
  vec3 n = rot * normal;
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  w.y += sin(uTime * 0.15 + aSeed * 20.0) * 1.4;
  // Slabs lean away from the pointer and light up as it passes.
  vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vHover = hoverAt(centre, 0.12);
  w.xyz = pushFrom(w.xyz, centre, 0.12, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  vObj = position;
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const MONO_FS = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uFade;
varying vec3 vN;
varying vec3 vW;
varying vec3 vObj;
varying float vSeed;
varying float vHover;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float ndv = abs(dot(N, V));
  float fres = pow(1.0 - ndv, 3.0);
  vec3 R = reflect(-V, N);
  float glint = pow(max(dot(R, uLight), 0.0), 90.0);
  float sheen = pow(max(dot(R, uLight), 0.0), 6.0);
  vec3 e = 0.5 - abs(vObj);
  float edge = 1.0 - smoothstep(0.0, 0.02, min(min(e.x + step(0.49, abs(vObj.x)), e.y + step(0.49, abs(vObj.y))), e.z + step(0.49, abs(vObj.z))));
  // Thin layered bands, like the edges of pages, caught by the light.
  float bands = smoothstep(0.86, 1.0, sin(vObj.y * 70.0 + vSeed * 30.0)) * 0.5 + smoothstep(0.97, 1.0, sin(vObj.y * 23.0 + vSeed * 9.0));
  vec3 deep = vec3(0.002, 0.008, 0.007);
  vec3 col = deep + uColor * (fres * 0.5 + bands * (0.05 + vHover * 1.2) + sheen * 0.08) + uColor * edge * (0.45 + vHover * 2.5) + vec3(1.0, 0.98, 0.92) * glint * 2.2;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

const RIBBON_VS = /* glsl */ `
attribute vec2 aUV;
attribute vec3 aNrm;
uniform float uTime;
varying vec2 vUV;
void main() {
  vUV = aUV;
  vec3 p = position + aNrm * sin(aUV.x * 14.0 - uTime * 0.4) * 1.2;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const RIBBON_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uFade;
varying vec2 vUV;
void main() {
  float across = 1.0 - abs(vUV.y);
  float core = pow(max(across, 0.0), 6.0);
  float soft = pow(max(across, 0.0), 1.5) * 0.25;
  float flow = 0.55 + 0.45 * sin(vUV.x * 60.0 - uTime * 0.9);
  float ends = smoothstep(0.0, 0.08, vUV.x) * smoothstep(1.0, 0.92, vUV.x);
  float a = (core * flow + soft) * ends * uFade;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

/** A vast emerald library: dark glass monoliths catching light like pages, and slow luminous ribbons. */
function writing(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const r = rng(505);

  // Soft nebula behind it all.
  const list: { pos: Vector3; size: number; color: Color; rot: number }[] = [];
  const teal = new Color(0.1, 0.55, 0.6);
  const PN = low ? 12 : 26;
  for (let k = 0; k < PN; k++) {
    const p = i - 0.3 + r() * 0.9;
    const th = r() * Math.PI * 2;
    const rad = 60 + r() * 200;
    const c = color.clone().lerp(teal, r() * 0.4).multiplyScalar(0.12 + r() * 0.12);
    list.push({ pos: place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.6), size: 90 + r() * 150, color: c, rot: r() * 6.28 });
  }
  group.add(puffs(list, ctx.cloudTex, fade, 0.4));

  // Monoliths: tall thin slabs standing in loose rows around the line.
  const MN = low ? 22 : 52;
  const mono = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new ShaderMaterial({
      vertexShader: MONO_VS,
      fragmentShader: MONO_FS,
      uniforms: { ...ctx.ray, uColor: { value: color.clone().multiplyScalar(1.1) }, uLight: { value: new Vector3(-0.5, 0.6, 0.6).normalize() }, uFade: fade, uTime: { value: 0 } },
      transparent: true,
    }),
    MN,
  );
  const seeds = new Float32Array(MN);
  const m = new Matrix4();
  const q = new Quaternion();
  let k = 0;
  while (k < MN) {
    const p = i - 0.25 + r() * 0.8;
    const th = r() * Math.PI * 2;
    const rad = 18 + Math.pow(r(), 1.2) * 110;
    const pos = place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.7);
    const f = frameAt(path, p);
    q.copy(f.quat).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), r() * Math.PI)).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (r() - 0.5) * 0.5));
    const h = 7 + r() * 18;
    m.compose(pos, q, new Vector3(0.18 + r() * 0.25, h, h * (0.3 + r() * 0.25)));
    mono.setMatrixAt(k, m);
    seeds[k] = r();
    k++;
  }
  mono.geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
  mono.frustumCulled = false;
  group.add(mono);

  // Ribbons of light winding slowly between them.
  const RN = low ? 3 : 6;
  const ribbonMat = additive(
    new ShaderMaterial({
      vertexShader: RIBBON_VS,
      fragmentShader: RIBBON_FS,
      uniforms: { uColor: { value: color.clone().lerp(new Color(1, 1, 1), 0.2).multiplyScalar(0.9) }, uTime: { value: 0 }, uFade: fade },
      side: DoubleSide,
    }),
  );
  const up = new Vector3(0, 1, 0);
  for (let n = 0; n < RN; n++) {
    const pts: Vector3[] = [];
    const th0 = r() * Math.PI * 2;
    const rad0 = 25 + r() * 60;
    for (let s = 0; s < 7; s++) {
      const p = i - 0.3 + s * 0.14;
      const th = th0 + s * (r() - 0.5) * 1.2;
      const rad = rad0 + (r() - 0.5) * 30;
      pts.push(place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.6));
    }
    const curve = new CatmullRomCurve3(pts);
    const SAMPLES = low ? 80 : 160;
    const width = 0.45 + r() * 0.8;
    const pos: number[] = [];
    const uvs: number[] = [];
    const nrm: number[] = [];
    const idx: number[] = [];
    const t = new Vector3();
    const side = new Vector3();
    const nn = new Vector3();
    for (let s = 0; s <= SAMPLES; s++) {
      const u = s / SAMPLES;
      const c = curve.getPointAt(u);
      curve.getTangentAt(u, t);
      side.crossVectors(t, up).normalize();
      nn.crossVectors(side, t).normalize();
      const twist = Math.sin(u * 6 + n) * 0.8;
      side.applyAxisAngle(t, twist);
      nn.applyAxisAngle(t, twist);
      pos.push(c.x - side.x * width, c.y - side.y * width, c.z - side.z * width, c.x + side.x * width, c.y + side.y * width, c.z + side.z * width);
      uvs.push(u, -1, u, 1);
      nrm.push(nn.x, nn.y, nn.z, nn.x, nn.y, nn.z);
      if (s < SAMPLES) {
        const b = s * 2;
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aUV", new BufferAttribute(new Float32Array(uvs), 2));
    g.setAttribute("aNrm", new BufferAttribute(new Float32Array(nrm), 3));
    g.setIndex(idx);
    const ribbon = new Mesh(g, ribbonMat);
    ribbon.frustumCulled = false;
    ribbon.renderOrder = 7;
    group.add(ribbon);
  }

  // Motes of light drifting between the slabs; they part around the pointer.
  const motes = new Motes(ctx, low ? 160 : 420, place(path, i + 0.15, 0, 0), 80, color.clone().lerp(new Color(1, 1, 1), 0.4).multiplyScalar(1.6), fade, 0.35);
  group.add(motes.points);

  return {
    id: "writing",
    group,
    fade,
    weight: hard(i - 1 + CROSS, i + CROSS),
    nebula: 0.9,
    update({ time }) {
      (mono.material as ShaderMaterial).uniforms.uTime.value = time;
      ribbonMat.uniforms.uTime.value = time;
      motes.update(time);
    },
  };
}

// ------------------------------------------------------------------ landing world

/** Simple 2D value noise for the dunes, deterministic. */
function noise2(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const h = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = h(ix, iz);
  const b = h(ix + 1, iz);
  const c = h(ix, iz + 1);
  const d = h(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm2(x: number, z: number) {
  return noise2(x, z) * 0.55 + noise2(x * 2.1 + 5.2, z * 2.1 + 1.3) * 0.3 + noise2(x * 4.3 + 9.1, z * 4.3 + 7.7) * 0.15;
}

/** Dune height in the landing site's frame; flat where the lander touches down. */
function dune(x: number, z: number) {
  const n1 = fbm2(x * 0.006, z * 0.006);
  const w = x * 0.03 + z * 0.011 + n1 * 6;
  const crest = Math.pow(0.5 + 0.5 * Math.sin(w), 2.4);
  let h = crest * (3.5 + 9 * n1) + fbm2(x * 0.035, z * 0.035) * 1.6;
  const r = Math.hypot(x, z);
  h *= smooth(6, 30, r);
  return h;
}

/**
 * The landing world: a desert forest under a red eclipse low on the horizon.
 * Dunes around the site, sparse strange trees, small glowing plants, cloud
 * banks the lander comes down through, dust in the air, a pale moon, and the
 * mothership waiting in the sky.
 */
function landingWorld(i: number, color: Color, ctx: Ctx): Piece {
  const { low, landing: l } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const R = 2600;
  const U = l.up;
  const F = l.fwd;
  const Rt = l.right;
  const center = l.pad.clone().addScaledVector(U, -(R + 2.5));
  const sunDir = F.clone().addScaledVector(U, 0.085).addScaledVector(Rt, 0.3).normalize();
  const sunPos = l.pad.clone().addScaledVector(sunDir, 5200);
  const amber = new Color(1.0, 0.45, 0.22).lerp(color, 0.25);

  const body = planet(ctx, fade, {
    radius: R,
    a: new Color(0.1, 0.055, 0.03),
    b: new Color(0.4, 0.24, 0.13),
    atmo: hdr(amber, 1.0),
    seed: 12.5,
    bands: 3,
    bandMix: 0.15,
    light: sunDir,
    segs: low ? 96 : 160,
    detail: 1,
  });
  body.position.copy(center);
  body.quaternion.copy(l.quat);
  const shell = body.children[1] as Mesh;
  shell.scale.setScalar(1.0012 / 1.12);
  (shell.material as ShaderMaterial).uniforms.uEdge.value = 0.06;
  (shell.material as ShaderMaterial).uniforms.uPower.value = 2.0;
  (shell.material as ShaderMaterial).uniforms.uColor.value = hdr(amber, 2.4);
  group.add(body);

  // The site: everything below is in a frame where Y is up and -Z faces the dawn.
  const site = new Group();
  site.position.copy(l.pad);
  site.quaternion.copy(l.quat);
  group.add(site);
  const ground = (x: number, z: number) => dune(x, z) - (x * x + z * z) / (2 * R);

  // Dunes, following the curve of the world so the horizon stays true.
  const TS = low ? 96 : 180;
  const SIZE = 820;
  const tg = new PlaneGeometry(SIZE, SIZE, TS, TS);
  tg.rotateX(-Math.PI / 2);
  const tp = tg.getAttribute("position") as BufferAttribute;
  const tc = new Float32Array(tp.count * 3);
  const crest = new Color(0.5, 0.26, 0.13);
  const trough = new Color(0.12, 0.05, 0.03);
  const cc = new Color();
  for (let k = 0; k < tp.count; k++) {
    const x = tp.getX(k);
    const z = tp.getZ(k);
    const h = ground(x, z);
    tp.setY(k, h);
    const d = dune(x, z);
    cc.copy(trough).lerp(crest, Math.min(1, 0.2 + d / 9) * (0.8 + 0.4 * noise2(x * 0.2, z * 0.2)));
    tc.set([cc.r, cc.g, cc.b], k * 3);
  }
  tg.setAttribute("color", new BufferAttribute(tc, 3));
  tg.computeVertexNormals();
  const sand = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.2 });
  const terrain = new Mesh(tg, sand);
  terrain.receiveShadow = !low;
  site.add(terrain);

  // Trees: umbrella crowns on twisted trunks, and tall spires hung with pods.
  const r = rng(808);
  const tube = (pts: Vector3[], rad: number, seg = 10) => new TubeGeometry(new CatmullRomCurve3(pts), seg, rad, 6, false).toNonIndexed();
  const barkA: BufferGeometry[] = [tube([new Vector3(0, -0.3, 0), new Vector3(0.15, 1.4, 0.05), new Vector3(0.35, 2.8, -0.1), new Vector3(0.3, 3.4, 0.05)], 0.24)];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    barkA.push(tube([new Vector3(0.3, 3.3, 0.05), new Vector3(0.3 + Math.cos(a) * 0.8, 3.9, 0.05 + Math.sin(a) * 0.8), new Vector3(0.3 + Math.cos(a) * 1.7, 4.4, 0.05 + Math.sin(a) * 1.7)], 0.07, 6));
  }
  const crownA = new SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(2.5, 0.75, 2.5).translate(0.3, 4.3, 0.05).toNonIndexed();
  const barkB = new LatheGeometry([new Vector2(0.4, -0.3), new Vector2(0.32, 1.5), new Vector2(0.22, 3.6), new Vector2(0.12, 5.6), new Vector2(0.02, 7.4)], 8).toNonIndexed();
  const pods: BufferGeometry[] = [];
  for (const [y, s, a] of [
    [2.4, 0.5, 0],
    [3.8, 0.42, 2.1],
    [5.0, 0.34, 4.2],
    [6.1, 0.26, 1.0],
  ])
    pods.push(new SphereGeometry(s, 10, 8).scale(1, 1.4, 1).translate(Math.cos(a) * 0.35, y, Math.sin(a) * 0.35).toNonIndexed());
  const podB = mergeGeometries(pods, false)!;
  const barkMat = standard(0x1c120c, 0.1, 0.85);
  const crownMat = standard(0x10201b, 0.05, 0.75);
  crownMat.emissive = new Color(0.0, 0.02, 0.018);
  const podMat = standard(0x0d2a28, 0.1, 0.4);
  podMat.emissive = new Color(0.05, 0.35, 0.3);
  const TN = low ? 26 : 70;
  const SN = low ? 12 : 30;
  const trunks = new InstancedMesh(mergeGeometries(barkA, false)!, barkMat, TN);
  const crowns = new InstancedMesh(crownA, crownMat, TN);
  const spires = new InstancedMesh(barkB, barkMat, SN);
  const podsM = new InstancedMesh(podB, podMat, SN);
  for (const m of [trunks, crowns, spires, podsM]) {
    m.castShadow = !low;
    m.frustumCulled = false;
  }
  const m4 = new Matrix4();
  const q4 = new Quaternion();
  const yAxis = new Vector3(0, 1, 0);
  const plantPos: Vector3[] = [];
  const spot = (minR: number) => {
    for (;;) {
      // Most trees stand ahead of the closing shot, toward the eclipse.
      const a = r() < 0.7 ? Math.PI * 1.15 + r() * Math.PI * 0.7 : r() * Math.PI * 2;
      const rad = minR + Math.pow(r(), 0.8) * 340;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      // Keep the view from the camera to the lander clear.
      if (z > -14 && rad < 70) continue;
      return new Vector3(x, ground(x, z), z);
    }
  };
  for (let k = 0; k < TN; k++) {
    const p = spot(22);
    const s = 0.9 + r() * 1.0;
    q4.setFromAxisAngle(yAxis, r() * Math.PI * 2);
    m4.compose(p, q4, new Vector3(s, s * (0.8 + r() * 0.5), s));
    trunks.setMatrixAt(k, m4);
    crowns.setMatrixAt(k, m4);
    if (k % 3 === 0) plantPos.push(p.clone().add(new Vector3(r() * 3 - 1.5, 0.3, r() * 3 - 1.5)));
  }
  const tipPos: Vector3[] = [];
  for (let k = 0; k < SN; k++) {
    const p = spot(26);
    const s = 0.8 + r() * 0.9;
    q4.setFromAxisAngle(yAxis, r() * Math.PI * 2);
    m4.compose(p, q4, new Vector3(s, s * (0.9 + r() * 0.6), s));
    spires.setMatrixAt(k, m4);
    podsM.setMatrixAt(k, m4);
    tipPos.push(new Vector3(0, 7.4, 0).applyMatrix4(m4));
  }
  site.add(trunks, crowns, spires, podsM);

  // Small glowing plants on the ground and at the spire tips. They brighten under the pointer.
  for (let k = 0; k < (low ? 10 : 26); k++) {
    const a = r() * Math.PI * 2;
    const rad = 9 + r() * 60;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (z > -6 && Math.abs(x) < 12) continue;
    plantPos.push(new Vector3(x, ground(x, z) + 0.25, z));
  }
  const plants = new GlowBatch(plantPos.length + tipPos.length, fade);
  plantPos.forEach((p) => plants.add(p.x, p.y, p.z, 0.9, 0.25, 1.0, 0.85, 1.2));
  tipPos.forEach((p) => plants.add(p.x, p.y, p.z, 1.4, 0.4, 1.0, 0.9, 1.4));
  site.add(plants.mesh);
  site.updateMatrixWorld(true);
  const plantWorld = [...plantPos, ...tipPos].map((p) => p.clone().applyMatrix4(site.matrixWorld));
  const plantHot = new Float32Array(plantWorld.length);

  // Three marker beacons a probe left around the site.
  const marks = new GlowBatch(3, fade);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    marks.add(Math.cos(a) * 14, 0.5, Math.sin(a) * 14, 0.7, 1, 0.6, 0.25, 1);
  }
  site.add(marks.mesh);

  // Dust hanging in the dawn air.
  const air = new Motes(ctx, low ? 120 : 320, new Vector3(0, 8, -30), 70, new Color(1.0, 0.62, 0.32).multiplyScalar(0.9), fade, 0.25);
  site.add(air.points);

  // A pale moon high on the left of the sun.
  const moonB = planet(ctx, fade, { radius: 70, a: new Color(0.3, 0.26, 0.2), b: new Color(0.85, 0.78, 0.66), atmo: hdr(amber, 0.3), seed: 6.1, light: sunDir, segs: low ? 24 : 40 });
  moonB.position.copy(l.pad).addScaledVector(F.clone().addScaledVector(Rt, -0.12).addScaledVector(U, 0.34).normalize(), 2600);
  group.add(moonB);

  // The red eclipse: a sun low on the horizon with a dark world across it.
  const SUN_R = 300;
  const sunMat = new ShaderMaterial({
    vertexShader: PLANET_VS,
    fragmentShader: /* glsl */ `
      #define OCTAVES ${low ? 3 : 4}
      ${NOISE}
      uniform vec3 uHot; uniform vec3 uDeep; uniform float uTime; uniform float uFade;
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float mu = max(dot(normalize(vN), V), 0.0);
        float n = fbm(vObj * 5.0 + vec3(uTime * 0.03, 0.0, uTime * 0.02));
        float n2 = fbm(vObj * 16.0 - vec3(0.0, uTime * 0.05, 0.0));
        vec3 col = mix(uDeep, uHot, clamp(n * 0.9 + n2 * 0.45, 0.0, 1.0)) * pow(mu, 0.4);
        gl_FragColor = vec4(col * uFade, 1.0);
      }`,
    uniforms: { uHot: { value: new Color(6.0, 2.2, 0.9) }, uDeep: { value: new Color(1.6, 0.12, 0.08) }, uTime: { value: 0 }, uFade: fade },
  });
  const sunBall = new Mesh(new SphereGeometry(SUN_R, low ? 32 : 64, low ? 20 : 40), sunMat);
  sunBall.position.copy(sunPos);
  group.add(sunBall);
  const eclMat = new ShaderMaterial({
    vertexShader: PLANET_VS,
    fragmentShader: /* glsl */ `
      uniform vec3 uRim; uniform float uFade; uniform vec3 uSun;
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float f = pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float toward = smoothstep(-0.2, 0.9, dot(N, normalize(uSun - vW)));
        vec3 col = vec3(0.004, 0.002, 0.003) + uRim * f * (0.15 + 2.5 * toward);
        gl_FragColor = vec4(col * uFade, uFade);
      }`,
    uniforms: { uRim: { value: new Color(3.0, 0.5, 0.25) }, uFade: fade, uSun: { value: sunPos } },
    transparent: true,
  });
  const ecl = new Mesh(new SphereGeometry(SUN_R * 0.8, low ? 32 : 64, low ? 20 : 40), eclMat);
  ecl.position.copy(l.pad).addScaledVector(sunDir.clone().addScaledVector(U, 0.012).addScaledVector(Rt, -0.01).normalize(), 4300);
  group.add(ecl);
  const sun = new GlowBatch(3, fade);
  sun.add(sunPos.x, sunPos.y, sunPos.z, SUN_R * 6, 1.0, 0.2, 0.12, 1.3);
  sun.add(sunPos.x, sunPos.y, sunPos.z, SUN_R * 2.4, 1.0, 0.5, 0.3, 1.5);
  sun.mesh.renderOrder = -10;
  group.add(sun.mesh);

  // Cloud banks over the site that the lander comes down through.
  const cl: { pos: Vector3; size: number; color: Color; rot: number }[] = [];
  const cloudCol = new Color(1.0, 0.5, 0.32).lerp(color, 0.3);
  for (let k = 0; k < (low ? 14 : 34); k++) {
    const a = r() * Math.PI * 2;
    const rad = 20 + Math.sqrt(r()) * 260;
    const pos = l.pad.clone().addScaledVector(Rt, Math.cos(a) * rad).addScaledVector(F, Math.sin(a) * rad - 60).addScaledVector(U, 38 + r() * 30);
    cl.push({ pos, size: 40 + r() * 60, color: cloudCol.clone().multiplyScalar(0.18 + r() * 0.16), rot: r() * 6.28 });
  }
  group.add(puffs(cl, ctx.cloudTex, fade, 0.9));

  // Dust thrown up by the braking jets.
  const DN = low ? 18 : 42;
  const dg = new InstancedBufferGeometry();
  dg.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  dg.setIndex([0, 1, 2, 0, 2, 3]);
  const dd = new Float32Array(DN * 4);
  for (let k = 0; k < DN; k++) dd.set([r() * Math.PI * 2, 1 + r() * 3.5, r(), 1.2 + r() * 2.2], k * 4);
  dg.setAttribute("aD", new InstancedBufferAttribute(dd, 4));
  dg.instanceCount = DN;
  const dustMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aD; // angle, start radius, seed, size
        uniform float uSpread; uniform float uTime;
        varying vec2 vUv; varying float vA;
        void main() {
          float a = aD.x + uTime * 0.25 * (aD.z - 0.5) + uSpread * (aD.z - 0.5) * 1.5;
          float rad = aD.y + uSpread * (4.0 + aD.z * 10.0);
          vec3 c = vec3(cos(a) * rad, 0.3 + uSpread * (0.3 + aD.z * 2.6), sin(a) * rad);
          vec4 mv = modelViewMatrix * vec4(c, 1.0);
          float size = aD.w * (0.7 + uSpread * 1.8);
          mv.xy += position.xy * size;
          vUv = position.xy * 0.5 + 0.5;
          vA = smoothstep(0.5, 3.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tCloud; uniform vec3 uColor; uniform float uAmt; uniform float uFade;
        varying vec2 vUv; varying float vA;
        void main() {
          float a = texture2D(tCloud, vUv).a;
          gl_FragColor = vec4(uColor * a * vA * uAmt * uFade, 1.0);
        }`,
      uniforms: {
        tCloud: { value: ctx.cloudTex },
        uColor: { value: new Color(1.0, 0.6, 0.34).lerp(color, 0.2).multiplyScalar(0.6) },
        uAmt: { value: 0 },
        uSpread: { value: 0 },
        uTime: { value: 0 },
        uFade: fade,
      },
      side: DoubleSide,
    }),
  );
  const dust = new Mesh(dg, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 8;
  site.add(dust);

  return {
    id: "contact",
    group,
    fade,
    weight: hard(i - 1 + CROSS, i + 100),
    nebula: 0.15,
    warm: { amount: 1.3, dir: sunDir },
    flare: { pos: sunPos, color: new Color(1.0, 0.35, 0.2), strength: 0.9 },
    haze: { color: new Color(0.17, 0.06, 0.035), density: 0.0024 },
    update({ time, dt, p, ptr }) {
      const L = landingPhase(l, p);
      dustMat.uniforms.uTime.value = time;
      dustMat.uniforms.uSpread.value = smooth(0.55, 1.0, L);
      dustMat.uniforms.uAmt.value = smooth(0.55, 0.74, L) * (1 - smooth(0.9, 1.0, L)) * 1.6;
      for (let k = 0; k < plantWorld.length; k++) {
        plantHot[k] = Math.max(hover(ptr, plantWorld[k], 0.05), plantHot[k] - dt * 0.8);
        plants.setIntensity(k, 0.9 + 0.35 * Math.sin(time * 1.3 + k * 1.7) + plantHot[k] * 4);
      }
      plants.commit();
      for (let k = 0; k < 3; k++) marks.setIntensity(k, Math.pow(Math.max(0, Math.sin(time * 1.6 + k * 2.1)), 10) * 3 + 0.3);
      marks.commit();
      air.update(time);
      sunMat.uniforms.uTime.value = time;
    },
  };
}
