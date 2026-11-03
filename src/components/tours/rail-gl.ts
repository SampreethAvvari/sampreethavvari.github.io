// The launch rail: a mass driver in open space, the world of /demos. A long run
// of magnet coils along one axis, each demo a capsule docked inside it with its
// art on a glass face. Scrolling flies the camera down the bore; a capsule that
// has had its turn lifts out of the way and comes back when you scroll up, and
// the energy in the coils runs the way you are travelling. Launching a capsule
// fires it down the rail with every coil lighting in turn.
//
// All of it is one instanced ring set that follows the camera, a few long rails,
// and one body and one glass face per capsule, so a phone draws the same world.
// Only this file imports three, and only after the page has painted.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  LineSegments,
  Matrix4,
  Mesh,
  NoBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Scene,
  ShaderMaterial,
  Shape,
  Texture,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { Governor } from "../../scripts/gl-governor";
import { breathe, decodedTexture, prelink, quietShaderChecks } from "../../scripts/gl-warm";
import { loopCount } from "../../scripts/gl-loop";

export type RailState = {
  /** Which stop the camera is at, continuous. */
  path: number;
  /** Scroll speed, 0 to 1. */
  speed: number;
  /** Which way the visitor is travelling, -1 back to 1 onward, smoothed. */
  dir: number;
  /** Pointer, smoothed, -1 to 1. */
  px: number;
  py: number;
  /** Pointer over the capsule in focus, 0 to 1. */
  hover: number;
  /** Tour step, smoothed: each one is a run down the bore. */
  step: number;
};

export type Capsule = {
  /** Picture for its glass face. */
  url?: string;
  /** The stop at which this capsule is in focus. */
  stop: number;
};

export type RailOptions = {
  capsules: Capsule[];
  /** How many stops there are in all, the outside view included when `outside`. */
  stops: number;
  /** Stop 0 looks at the whole rail from outside; otherwise it starts in the bore. */
  outside: boolean;
  /** The stop looking straight down the bore at what is ahead, if there is one. */
  lookahead?: number;
};

export type RailGL = {
  draw: (now: number) => void;
  resize: () => void;
  stop: () => void;
  /** Fires the capsule down the rail. */
  launch: (i: number) => void;
  /** A burst of energy down the coils, the way of travel. */
  pulse: () => void;
  /** The capsule's glass face on screen, in CSS pixels. */
  faceRect: (i: number) => { left: number; top: number; right: number; bottom: number };
};

const W = 16;
const H = 9.14;
const R_IN = 15;
const R_OUT = 17.3;
const MOUTH_Z = 62;
const TAU = Math.PI * 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const outCubic = (v: number) => 1 - Math.pow(1 - v, 3);
const inCubic = (v: number) => v * v * v;

const WAVE = /* glsl */ `
uniform float uIdleZ; uniform float uIdleA; uniform float uFireZ; uniform float uFireA; uniform float uIgnZ; uniform float uStart; uniform float uEnd;
float wave(float z) {
  return exp(-pow((z - uIdleZ) / 9.0, 2.0)) * uIdleA + exp(-pow((z - uFireZ) / 15.0, 2.0)) * uFireA;
}
float lit(float z) { return smoothstep(uIgnZ - 26.0, uIgnZ, z); }`;

const METAL_VS = /* glsl */ `
uniform float uStart; uniform float uEnd;
varying vec3 vW; varying vec3 vL;
void main() {
  #ifdef USE_INSTANCING
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vL = (instanceMatrix * vec4(position, 1.0)).xyz;
    // The ring set follows the camera; past either end of the rail it is not there.
    float ring = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
    if (ring > uStart || ring < uEnd) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vW = w.xyz; return; }
  #else
    vec4 w = modelMatrix * vec4(position, 1.0);
    vL = position;
  #endif
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const METAL_FS = /* glsl */ `
uniform vec3 uTone; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uRimGain; uniform float uTime; uniform float uDim;
varying vec3 vW; varying vec3 vL;
${WAVE}
void main() {
  // Flat shaded from the surface itself: crisp machined edges with no extra vertices.
  vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  float d = length(cameraPosition - vW);
  float a = wave(vW.z) * lit(vW.z);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 key = normalize(vec3(0.34, 0.82, 0.46));
  float diff = 0.26 + 0.74 * pow(max(dot(N, key), 0.0), 1.4);
  vec3 col = vec3(0.075, 0.085, 0.11) * diff;
  // Light thrown by the coil's own lit edge onto faces toward the bore.
  vec2 out2 = normalize(vL.xy + 1e-4);
  float facing = max(dot(N.xy, -out2), 0.0);
  float r = length(vL.xy);
  col += uTone * facing * (0.13 + 0.9 * a) * lit(vW.z) * smoothstep(19.0, 15.0, r) * 0.55;
  #ifdef MACHINED
    float ang = atan(vL.y, vL.x) / 6.28318;
    float seg = fract(ang * 24.0);
    col *= 0.45 + 0.55 * smoothstep(0.0, 0.03, seg) * smoothstep(1.0, 0.97, seg);
    float lamp = smoothstep(0.018, 0.0, abs(fract(ang * 8.0) - 0.5) / 8.0) * step(16.6, r);
    col += uTone * lamp * (0.5 + a * 2.0) * lit(vW.z);
  #endif
  #ifdef HOUSING
    // A window of light along each housing, and a thin seam around it.
    vec2 q = abs(vL.xy);
    float winL = smoothstep(0.1, 0.0, abs(fract(vW.z * 0.3 + atan(vL.y, vL.x) * 1.3) - 0.5) - 0.34);
    col += uTone * winL * step(18.25, length(vL.xy)) * (0.34 + a * 2.0) * lit(vW.z);
  #endif
  col += uTone * fres * uRimGain * (0.5 + a) * lit(vW.z);
  col *= uDim;
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, 1.0);
}`;

// The lit edge of each coil: a thin bright core and a soft halo that stands in
// for bloom, both in one additive pass.
const EDGE_VS = /* glsl */ `
uniform float uStart; uniform float uEnd;
varying vec3 vW; varying float vFace;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  float ring = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
  vW = w.xyz;
  vec3 N = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vFace = abs(dot(N, normalize(cameraPosition - w.xyz)));
  gl_Position = (ring > uStart || ring < uEnd) ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * w;
}`;

const EDGE_FS = /* glsl */ `
uniform vec3 uTone; uniform float uFogFar; uniform float uGain; uniform float uTime;
varying vec3 vW; varying float vFace;
${WAVE}
void main() {
  float d = length(cameraPosition - vW);
  float a = wave(vW.z);
  float l = lit(vW.z);
  float idle = 0.78 + 0.14 * sin(vW.z * 0.09 + uTime * 0.7);
  float e = (idle + a * 3.2) * l * uGain;
  float glow = pow(vFace, 3.0);
  vec3 hot = mix(uTone, vec3(0.86, 0.92, 1.0), clamp(a * 0.9 + 0.34, 0.0, 1.0));
  float far = 1.0 - smoothstep(uFogFar * 0.42, uFogFar, d);
  gl_FragColor = vec4(hot * e * glow * far, 1.0);
}`;

const RAIL_VS = /* glsl */ `
varying vec3 vW; varying vec3 vL;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vL = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const RAIL_FS = /* glsl */ `
uniform vec3 uTone; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uFlow; uniform float uTime;
varying vec3 vW; varying vec3 vL;
${WAVE}
void main() {
  float d = length(cameraPosition - vW);
  float a = wave(vW.z) * lit(vW.z);
  // The running lights go the way the visitor is going.
  float dash = smoothstep(0.86, 0.97, fract(vW.z * 0.045 + uFlow));
  float strip = smoothstep(0.42, 0.1, abs(vL.x));
  vec3 col = vec3(0.05, 0.056, 0.074);
  col += uTone * strip * (0.1 + dash * 1.7 + a * 2.4) * lit(vW.z);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, 1.0);
}`;

const FACE_VS = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vView = cameraPosition - wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FACE_FS = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
uniform sampler2D uTex; uniform vec2 uCrop; uniform vec3 uTone; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;
uniform float uHas; uniform float uOn; uniform float uLit; uniform float uSweep; uniform float uChroma; uniform float uHover; uniform vec2 uPointer; uniform float uAA;
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float asp = ${(W / H).toFixed(4)};
  vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
  float dd = box(p, vec2(asp * 0.5, 0.5), 0.05);
  float inside = 1.0 - smoothstep(-uAA, uAA, dd);
  if (inside < 0.01) discard;
  vec3 glass = vec3(0.012, 0.018, 0.034) + uTone * 0.035;
  vec3 col = glass;
  if (uHas > 0.5) {
    vec2 t = 0.5 + (vUv - 0.5) * uCrop;
    // Bright things sit nearer than the dark behind them.
    float depth = dot(texture2D(uTex, t, 5.0).rgb, vec3(0.3, 0.59, 0.11));
    vec2 duv = clamp(t + uPointer * (depth * 1.6 - 0.22) * 0.032, 0.002, 0.998);
    vec2 dir = vUv - 0.5;
    float c = uChroma * 0.022;
    vec3 art = vec3(texture2D(uTex, duv + dir * c).r, texture2D(uTex, duv).g, texture2D(uTex, duv - dir * c).b);
    // The screen comes on from the top with a bright line.
    float y = 1.0 - vUv.y;
    float shown = smoothstep(uOn - 0.015, uOn - 0.03, y);
    col = mix(glass, art * uLit, shown);
    col += uTone * smoothstep(0.03, 0.0, abs(y - uOn)) * step(uOn, 0.999) * 1.6;
  }
  vec3 V = normalize(vView);
  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
  float edge = 1.0 - smoothstep(0.0, 0.012, -dd);
  float edgeIn = 1.0 - smoothstep(0.0, 0.1, -dd);
  float rim = 0.55 + 0.45 * uLit + uHover * 0.5;
  col += uTone * fres * 0.45 * rim;
  col += uTone * edgeIn * 0.16 * rim;
  col += (uTone * 0.8 + 0.34) * edge * 0.95 * rim;
  col.r += edge * 0.24 * rim * step(0.0, p.x);
  col.b += edge * 0.24 * rim * step(p.x, 0.0);
  float band = exp(-pow((vUv.x + (1.0 - vUv.y) * 0.42 - uSweep) * 9.0, 2.0));
  col += (vec3(0.13) + uTone * 0.2) * band * rim;
  float d = length(vView);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
  gl_FragColor = vec4(col, 1.0);
}`;

// Soft light that always faces the camera.
const GLOW_VS = /* glsl */ `
uniform float uSize; varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 mv = viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FS = /* glsl */ `
uniform vec3 uCol; uniform float uA; varying vec2 vP;
void main() {
  float r = length(vP) * 2.0;
  float f = pow(max(1.0 - r, 0.0), 2.6);
  gl_FragColor = vec4(uCol * f * uA, 1.0);
}`;

const SKY_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const SKY_FS = /* glsl */ `
varying vec2 vUv;
uniform float uTime; uniform float uAspect; uniform vec2 uOff; uniform vec3 uCol1; uniform vec3 uCol2; uniform float uWarp;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < ${loopCount("OCTAVES")}; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 q = p * 1.45 + uOff;
  float n = fbm(q + vec2(uTime * 0.01, -uTime * 0.007));
  float m = fbm(q * 1.7 - n * 1.25 + vec2(-uTime * 0.008, uTime * 0.006) + 3.1);
  vec3 col = vec3(0.004, 0.006, 0.016);
  col += uCol1 * pow(smoothstep(0.26, 0.9, m), 1.6) * 0.86;
  col += uCol2 * pow(smoothstep(0.4, 0.96, n), 2.2) * 0.6;
  col *= 0.7 + 0.3 * smoothstep(0.18, 0.72, n);
  col += uCol1 * uWarp * 0.16 * (1.0 - smoothstep(0.0, 0.8, length(p)));
  col *= 1.0 - 0.45 * dot(p * 0.85, p * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

const STAR_VS = /* glsl */ `
attribute float aSeed; uniform float uTime; uniform float uDpr;
varying float vA;
void main() {
  vec4 mv = viewMatrix * vec4(position + cameraPosition, 1.0);
  vA = (0.42 + 0.58 * fract(aSeed * 91.7)) * (0.72 + 0.28 * sin(uTime * (0.5 + aSeed) + aSeed * 40.0));
  gl_PointSize = (0.9 + aSeed * aSeed * 2.2) * uDpr;
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FS = /* glsl */ `
varying float vA;
void main() {
  float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5)) * vA;
  gl_FragColor = vec4(vec3(0.86, 0.91, 1.0) * a, 1.0);
}`;

const DUST_VS = /* glsl */ `
attribute float aSeed; attribute float aTail;
uniform float uTime; uniform float uStretch; uniform float uDpr; uniform float uSpan; uniform vec2 uPointer;
varying float vA; varying float vSeed;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.11 + aSeed * 40.0) * 0.4 - uPointer.x * aSeed * 1.2;
  p.y += cos(uTime * 0.09 + aSeed * 23.0) * 0.3 - uPointer.y * aSeed * 0.8;
  // Endless: the dust wraps around wherever the camera is.
  p.z = mod(p.z - cameraPosition.z, uSpan) + cameraPosition.z - uSpan * 0.86;
  p.z -= aTail * uStretch;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vA = clamp(1.5 - depth / 120.0, 0.0, 1.0) * smoothstep(0.6, 5.0, depth);
  vA *= 0.6 + 0.4 * sin(uTime * (0.6 + aSeed * 1.7) + aSeed * 50.0);
  vSeed = aSeed;
  gl_PointSize = clamp((0.7 + aSeed * 2.0) * 52.0 / max(depth, 1.0) * uDpr, 1.1, 7.0);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FS = /* glsl */ `
uniform vec3 uTint; uniform float uLine; uniform float uGain;
varying float vA; varying float vSeed;
void main() {
  float a = vA * uGain;
  if (uLine < 0.5) a *= smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  vec3 col = mix(vec3(0.9, 0.94, 1.0), uTint, fract(vSeed * 7.31) * 0.7 + uLine * 0.3);
  gl_FragColor = vec4(col * a, 1.0);
}`;

type Shot = { p: Vector3; l: Vector3; fov: number; via?: Vector3 };

export async function mountRail(
  canvas: HTMLCanvasElement,
  opts: RailOptions,
  state: RailState,
  onReady: () => void,
  onLost: () => void,
  signal: AbortSignal,
): Promise<RailGL | null> {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const high = !coarse && cores >= 8;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: !coarse,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  quietShaderChecks(renderer);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x010205, 1);
  renderer.sortObjects = true;
  const baseDpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75);
  let dpr = baseDpr;
  renderer.setPixelRatio(dpr);

  const disposers: Array<{ dispose: () => void }> = [];
  const keep = <T extends { dispose: () => void }>(o: T): T => {
    disposers.push(o);
    return o;
  };

  // Making the context is the one big job here. The page gets a turn after it,
  // and again between the parts of the world.
  const give = async () => {
    await breathe();
    return !signal.aborted;
  };
  const abandon = () => {
    disposers.forEach((d) => d.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    return null;
  };
  if (!(await give())) return abandon();

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 16 / 9, 0.5, 1400);
  const tone = new Color(91 / 255, 141 / 255, 239 / 255);
  const partner = new Color(0.34, 0.3, 0.86);
  const fog = new Color(0.008, 0.012, 0.03);
  const pointer = new Vector2();

  const shared = {
    uTone: { value: tone },
    uFog: { value: fog },
    uFogNear: { value: 60 },
    uFogFar: { value: 300 },
    uTime: { value: 0 },
    uIdleZ: { value: 0 },
    uIdleA: { value: 0 },
    uFireZ: { value: 0 },
    uFireA: { value: 0 },
    uIgnZ: { value: 200 },
    uStart: { value: MOUTH_Z },
    uEnd: { value: -500 },
  };

  // Where things stand. A narrow screen needs the capsule further off to fit it,
  // so everything along the rail is spaced by how far off the camera sits.
  let aspect = 16 / 9;
  let portrait = false;
  const capsuleDistance = () => {
    if (portrait) {
      const fov = 46;
      return (W / 2 / 0.92) / (Math.tan((fov / 2) * (Math.PI / 180)) * aspect);
    }
    return 34 * Math.max(1, 1.5 / aspect);
  };
  let gap = 46;
  const n = opts.capsules.length;
  const zOf = (i: number) => -i * gap;

  // Sky
  const skyMat = keep(
    new ShaderMaterial({
      vertexShader: SKY_VS,
      fragmentShader: SKY_FS,
      defines: { OCTAVES: coarse ? 3 : 4 },
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
      uniforms: {
        uTime: shared.uTime,
        uAspect: { value: 1.6 },
        uOff: { value: new Vector2() },
        uCol1: { value: tone },
        uCol2: { value: partner },
        uWarp: { value: 0 },
      },
    }),
  );
  const sky = new Mesh(keep(new PlaneGeometry(2, 2)), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  scene.add(sky);

  // Far stars, carried with the camera.
  let starU: Record<string, { value: unknown }> | null = null;
  {
    const count = high ? 1500 : coarse ? 600 : 900;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const c = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - c * c);
      pos[i * 3] = Math.cos(a) * s * 900;
      pos[i * 3 + 1] = c * 900;
      pos[i * 3 + 2] = Math.sin(a) * s * 900;
      seed[i] = Math.random();
    }
    const g = keep(new BufferGeometry());
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new BufferAttribute(seed, 1));
    const m = keep(
      new ShaderMaterial({
        vertexShader: STAR_VS,
        fragmentShader: STAR_FS,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: shared.uTime, uDpr: { value: dpr } },
      }),
    );
    const stars = new Points(g, m);
    stars.frustumCulled = false;
    stars.renderOrder = -10;
    scene.add(stars);
    starU = m.uniforms;
  }

  if (!(await give())) return abandon();

  // The coils. One ring set that always sits around the camera, snapped to the
  // spacing so the motion past it reads as flying down one long rail.
  const SPACING = coarse ? 9.5 : 7.5;
  const COILS = coarse ? 30 : 40;
  const coilGroup = new Group();
  scene.add(coilGroup);
  const seg = coarse ? 48 : 72;
  const dz = 0.85;
  const profile = [
    [R_IN + 0.3, -dz],
    [R_IN, -dz + 0.3],
    [R_IN, dz - 0.3],
    [R_IN + 0.3, dz],
    [R_OUT - 0.5, dz],
    [R_OUT, dz - 0.5],
    [R_OUT, -dz + 0.5],
    [R_OUT - 0.5, -dz],
    [R_IN + 0.3, -dz],
  ].map(([r, y]) => new Vector2(r, y));
  const coilGeo = keep(new LatheGeometry(profile, seg));
  coilGeo.rotateX(Math.PI / 2);
  const metalU = { ...shared, uRimGain: { value: 0.42 }, uDim: { value: 1 } };
  const coilMat = keep(
    new ShaderMaterial({ vertexShader: METAL_VS, fragmentShader: METAL_FS, defines: { MACHINED: 1 }, uniforms: metalU, side: 2 }),
  );
  const coils = new InstancedMesh(coilGeo, coilMat, COILS);
  coils.frustumCulled = false;
  const m4 = new Matrix4();
  const qIdent = new Quaternion();
  const vScale = new Vector3(1, 1, 1);
  const vPos = new Vector3();
  for (let i = 0; i < COILS; i++) coils.setMatrixAt(i, m4.compose(vPos.set(0, 0, -i * SPACING), qIdent, vScale));
  coilGroup.add(coils);
  keep({ dispose: () => coils.dispose() });

  // The housings bolted around each coil.
  const BLOCKS = coarse ? 5 : 8;
  const blockGeo = keep(new BoxGeometry(5.2, 1.8, 2.6));
  const blockMat = keep(new ShaderMaterial({ vertexShader: METAL_VS, fragmentShader: METAL_FS, defines: { HOUSING: 1 }, uniforms: metalU }));
  const blocks = new InstancedMesh(blockGeo, blockMat, COILS * BLOCKS);
  blocks.frustumCulled = false;
  {
    const q = new Quaternion();
    const zAxis = new Vector3(0, 0, 1);
    for (let i = 0; i < COILS; i++) {
      for (let b = 0; b < BLOCKS; b++) {
        const a = (b / BLOCKS) * TAU + (i % 2) * (TAU / BLOCKS / 2);
        q.setFromAxisAngle(zAxis, a + Math.PI / 2);
        vPos.set(Math.cos(a) * (R_OUT + 0.7), Math.sin(a) * (R_OUT + 0.7), -i * SPACING);
        blocks.setMatrixAt(i * BLOCKS + b, m4.compose(vPos, q, vScale));
      }
    }
  }
  coilGroup.add(blocks);
  keep({ dispose: () => blocks.dispose() });

  // The lit inner edge: a thin core and its halo.
  const edgeU = { ...shared, uGain: { value: 1 } };
  const edgeMat = keep(
    new ShaderMaterial({
      vertexShader: EDGE_VS,
      fragmentShader: EDGE_FS,
      uniforms: edgeU,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const coreGeo = keep(new TorusGeometry(R_IN - 0.05, 0.1, 6, seg));
  const core = new InstancedMesh(coreGeo, edgeMat, COILS);
  core.frustumCulled = false;
  const haloU = { ...shared, uGain: { value: 0.3 } };
  const haloMat = keep(
    new ShaderMaterial({
      vertexShader: EDGE_VS,
      fragmentShader: EDGE_FS,
      uniforms: haloU,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const haloGeo = keep(new TorusGeometry(R_IN - 0.05, 0.62, 8, seg));
  const halo = new InstancedMesh(haloGeo, haloMat, COILS);
  halo.frustumCulled = false;
  for (let i = 0; i < COILS; i++) {
    m4.compose(vPos.set(0, 0, -i * SPACING), qIdent, vScale);
    core.setMatrixAt(i, m4);
    halo.setMatrixAt(i, m4);
  }
  core.renderOrder = 4;
  halo.renderOrder = 5;
  coilGroup.add(core, halo);
  keep({ dispose: () => core.dispose() });
  keep({ dispose: () => halo.dispose() });

  // The rails: three, the full length of the driver.
  const railU = { ...shared, uFlow: { value: 0 } };
  const railMat = keep(new ShaderMaterial({ vertexShader: RAIL_VS, fragmentShader: RAIL_FS, uniforms: railU }));
  const railLen = 1;
  const railGeo = keep(new BoxGeometry(0.9, 0.5, railLen));
  const RAIL_ANGLES = [Math.PI / 2, Math.PI * 1.16, Math.PI * 1.84];
  const rails = RAIL_ANGLES.map((a) => {
    const m = new Mesh(railGeo, railMat);
    m.position.set(Math.cos(a) * (R_IN - 0.55), Math.sin(a) * (R_IN - 0.55), 0);
    m.rotation.z = a - Math.PI / 2;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });

  // Light at the far end of the bore.
  const glowGeo = keep(new PlaneGeometry(1, 1));
  const farGlowMat = keep(
    new ShaderMaterial({
      vertexShader: GLOW_VS,
      fragmentShader: GLOW_FS,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      uniforms: { uSize: { value: 420 }, uCol: { value: tone }, uA: { value: 0.32 } },
    }),
  );
  const farGlow = new Mesh(glowGeo, farGlowMat);
  farGlow.frustumCulled = false;
  farGlow.renderOrder = -5;
  scene.add(farGlow);

  if (!(await give())) return abandon();

  // Capsules
  const bodyShape = new Shape();
  {
    const w = W + 0.9;
    const h = H + 0.9;
    const r = 0.8;
    bodyShape.moveTo(-w / 2 + r, -h / 2);
    bodyShape.lineTo(w / 2 - r, -h / 2);
    bodyShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    bodyShape.lineTo(w / 2, h / 2 - r);
    bodyShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    bodyShape.lineTo(-w / 2 + r, h / 2);
    bodyShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    bodyShape.lineTo(-w / 2, -h / 2 + r);
    bodyShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  }
  const bodyGeo = keep(
    new ExtrudeGeometry(bodyShape, { depth: 1.5, bevelEnabled: true, bevelSize: 0.14, bevelThickness: 0.14, bevelSegments: 2, curveSegments: coarse ? 4 : 8 }),
  );
  bodyGeo.translate(0, 0, -1.72);
  const bodyU = { ...shared, uRimGain: { value: 0.6 }, uDim: { value: 1 } };
  const bodyMat = keep(new ShaderMaterial({ vertexShader: METAL_VS, fragmentShader: METAL_FS, uniforms: bodyU }));
  const armGeo = keep(new BoxGeometry(0.34, 0.34, 1));
  armGeo.translate(0, 0, 0.5);
  const faceGeo = keep(new PlaneGeometry(W, H));
  const capGlowMat = keep(
    new ShaderMaterial({
      vertexShader: GLOW_VS,
      fragmentShader: GLOW_FS,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uSize: { value: 46 }, uCol: { value: tone }, uA: { value: 0.3 } },
    }),
  );

  type Cap = {
    group: Group;
    face: Mesh;
    mat: ShaderMaterial;
    u: Record<string, { value: unknown }>;
    tex: Texture | null;
    asked: boolean;
    on: number;
    lit: number;
    glow: Mesh;
    glowU: Record<string, { value: unknown }>;
  };
  const caps: Cap[] = opts.capsules.map(() => {
    const group = new Group();
    const body = new Mesh(bodyGeo, bodyMat);
    group.add(body);
    // Held by three arms out to the rails.
    for (const a of RAIL_ANGLES) {
      const arm = new Mesh(armGeo, bodyMat);
      const from = new Vector3(Math.cos(a) * (W / 2) * 0.72, Math.sin(a) * (H / 2) * 1.02, -0.8);
      const to = new Vector3(Math.cos(a) * (R_IN - 0.6), Math.sin(a) * (R_IN - 0.6), -0.8);
      arm.position.copy(from);
      arm.lookAt(to);
      arm.scale.z = from.distanceTo(to);
      group.add(arm);
    }
    const u = {
      uTex: { value: null as Texture | null },
      uCrop: { value: new Vector2(1, 1) },
      uTone: { value: tone },
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uHas: { value: 0 },
      uOn: { value: 0 },
      uLit: { value: 0.4 },
      uSweep: { value: -1 },
      uChroma: { value: 0 },
      uHover: { value: 0 },
      uPointer: { value: new Vector2() },
      uAA: { value: 0.004 },
    };
    const mat = keep(new ShaderMaterial({ vertexShader: FACE_VS, fragmentShader: FACE_FS, uniforms: u }));
    const face = new Mesh(faceGeo, mat);
    face.position.z = 0.0;
    group.add(face);
    const glowU = { uSize: { value: 46 }, uCol: { value: tone }, uA: { value: 0.3 } };
    const glow = new Mesh(glowGeo, capGlowMat.clone());
    (glow.material as ShaderMaterial).uniforms = glowU;
    keep(glow.material as ShaderMaterial);
    glow.position.z = -3;
    glow.renderOrder = 6;
    glow.frustumCulled = false;
    group.add(glow);
    scene.add(group);
    return { group, face, mat, u, tex: null, asked: false, on: 0, lit: 0.4, glow, glowU };
  });

  if (!(await give())) return abandon();

  // Star dust, with streaks at speed.
  const dustCount = high ? 1100 : coarse ? 380 : 640;
  const DUST_SPAN = 240;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const a = Math.random() * TAU;
    const r = 2 + Math.pow(Math.random(), 0.55) * 42;
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = Math.sin(a) * r;
    dustPos[i * 3 + 2] = Math.random() * DUST_SPAN;
    dustSeed[i] = Math.random();
  }
  const dustU = {
    uTime: shared.uTime,
    uStretch: { value: 0 },
    uDpr: { value: dpr },
    uSpan: { value: DUST_SPAN },
    uPointer: { value: pointer },
    uTint: { value: tone },
    uLine: { value: 0 },
    uGain: { value: 0.9 },
  };
  const dustGeo = keep(new BufferGeometry());
  dustGeo.setAttribute("position", new BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("aSeed", new BufferAttribute(dustSeed, 1));
  dustGeo.setAttribute("aTail", new BufferAttribute(new Float32Array(dustCount), 1));
  const dustMat = keep(
    new ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: dustU, transparent: true, depthWrite: false, blending: AdditiveBlending }),
  );
  const dust = new Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 50;
  scene.add(dust);

  const linePos = new Float32Array(dustCount * 6);
  const lineSeed = new Float32Array(dustCount * 2);
  const lineTail = new Float32Array(dustCount * 2);
  for (let i = 0; i < dustCount; i++) {
    for (let k = 0; k < 2; k++) {
      linePos.set([dustPos[i * 3], dustPos[i * 3 + 1], dustPos[i * 3 + 2]], i * 6 + k * 3);
      lineSeed[i * 2 + k] = dustSeed[i];
      lineTail[i * 2 + k] = k;
    }
  }
  const lineU = { ...dustU, uLine: { value: 1 }, uGain: { value: 0 }, uStretch: { value: 0 } };
  const lineGeo = keep(new BufferGeometry());
  lineGeo.setAttribute("position", new BufferAttribute(linePos, 3));
  lineGeo.setAttribute("aSeed", new BufferAttribute(lineSeed, 1));
  lineGeo.setAttribute("aTail", new BufferAttribute(lineTail, 1));
  const lineMat = keep(
    new ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: lineU, transparent: true, depthWrite: false, blending: AdditiveBlending }),
  );
  const streaks = new LineSegments(lineGeo, lineMat);
  streaks.frustumCulled = false;
  streaks.renderOrder = 51;
  scene.add(streaks);

  // ---- The camera's stops ----------------------------------------------------
  let shots: Shot[] = [];
  const stationShot = (z: number): Shot => {
    const d = capsuleDistance();
    if (portrait) {
      const vis = d * Math.tan((46 / 2) * (Math.PI / 180));
      return { p: new Vector3(0, -1.2, z + d), l: new Vector3(0, -vis * 0.5, z), fov: 46 };
    }
    return { p: new Vector3(-3.4, 1, z + d), l: new Vector3(-8.2, 0.1, z), fov: 38 };
  };
  const buildShots = () => {
    const d = capsuleDistance();
    gap = Math.max(46, d * 1.72);
    shots = [];
    const byStop = new Map<number, number>();
    opts.capsules.forEach((c, i) => byStop.set(c.stop, i));
    for (let s = 0; s < opts.stops; s++) {
      const cap = byStop.get(s);
      if (cap != null) {
        shots.push(stationShot(zOf(cap)));
      } else if (s === 0 && opts.outside) {
        shots.push(
          portrait
            ? { p: new Vector3(-7, -12, 182), l: new Vector3(-1, -27, 0), fov: 44 }
            : { p: new Vector3(-23, -8.5, 148), l: new Vector3(-11.5, -0.5, 0), fov: 34 },
        );
      } else if (s === opts.lookahead) {
        // Straight down the bore, at everything still to come.
        const next = opts.capsules.findIndex((c) => c.stop > s);
        const z = zOf(Math.max(0, next)) + (portrait ? d * 0.92 : 34);
        shots.push({ p: new Vector3(portrait ? 0 : -1.6, portrait ? -3 : 0.8, z), l: new Vector3(portrait ? 0 : -4.2, portrait ? 2 : 0.2, z - 60), fov: portrait ? 56 : 44 });
      } else {
        // Past the last one: the end of the rail and open space beyond.
        const z = zOf(n - 1) - gap * 0.9;
        shots.push({ p: new Vector3(portrait ? 0 : -2, 0.5, z), l: new Vector3(portrait ? 0 : -6, 0.5, z - 60), fov: portrait ? 56 : 44 });
      }
    }
    // Going in: round to the mouth of the bore, then down it.
    if (opts.outside && shots[1]) shots[1].via = new Vector3(0, 0, MOUTH_Z + 26);
    // The index reaches the end of the rail; a tour page never sees it.
    const farEnd = zOf(n - 1) - gap * (opts.outside ? 2.2 : 14);
    shared.uEnd.value = farEnd;
    for (const r of rails) {
      r.scale.z = MOUTH_Z - farEnd;
      r.position.z = (MOUTH_Z + farEnd) / 2;
    }
    caps.forEach((c, i) => c.group.position.set(0, 0, zOf(i)));
  };

  // ---- Size ------------------------------------------------------------------
  let vw = 1;
  let vh = 1;
  const resize = () => {
    vw = Math.max(1, canvas.clientWidth);
    vh = Math.max(1, canvas.clientHeight);
    aspect = vw / vh;
    portrait = aspect < 1;
    camera.aspect = aspect;
    renderer.setSize(vw, vh, false);
    skyMat.uniforms.uAspect.value = aspect;
    buildShots();
    camera.updateProjectionMatrix();
  };
  resize();
  const governor = new Governor({
    steps: [1, 0.85, 0.72],
    apply: (scale) => {
      dpr = Math.max(0.8, baseDpr * scale);
      renderer.setPixelRatio(dpr);
      dustU.uDpr.value = dpr;
      if (starU) starU.uDpr.value = dpr;
      renderer.setSize(vw, vh, false);
    },
  });

  // ---- Textures: the capsule in view and its neighbours ----------------------
  let disposed = false;
  let loading = 0;
  const wantTextures = () => {
    if (loading >= 2) return;
    let best = -1;
    let bestD = 2.6;
    opts.capsules.forEach((c, i) => {
      if (caps[i].asked || !c.url) return;
      const d = Math.abs(c.stop - state.path);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) return;
    const cap = caps[best];
    cap.asked = true;
    loading++;
    decodedTexture(opts.capsules[best].url!)
      .then((tex) => {
        loading--;
        if (disposed) {
          (tex.image as ImageBitmap | null)?.close?.();
          tex.dispose();
          return;
        }
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const img = tex.image as { width: number; height: number };
        const ia = img.width / img.height;
        const ta = W / H;
        (cap.u.uCrop.value as Vector2).set(ia > ta ? ta / ia : 1, ia > ta ? 1 : ia / ta);
        cap.tex = tex;
        cap.u.uTex.value = tex;
        cap.u.uHas.value = 1;
        cap.on = 0;
      })
      .catch(() => {
        loading--;
      });
  };

  // ---- Frames ----------------------------------------------------------------
  const born = performance.now();
  let lastNow = born;
  let flow = 0;
  let idleAt = born + 900;
  let firedAt = -1e9;
  let firedFrom = 0;
  let launched = -1;
  let launchedAt = 0;
  let frames = 0;
  // A tour page: the capsule is still arriving when the page comes up.
  const arriving = !opts.outside;
  const camPos = new Vector3();
  const camLook = new Vector3();

  function draw(now: number) {
    const prevNow = lastNow;
    lastNow = now;
    const dtMs = now - prevNow;
    const time = (now - born) / 1000;
    shared.uTime.value = time;
    pointer.set(state.px, -state.py);
    frames++;
    if (frames % 12 === 1) wantTextures();

    // Ignition: the coils light in turn, from the mouth down the rail.
    const ign = 1 - Math.pow(1 - clamp01(time / 2.4), 2);
    const ignZ = MOUTH_Z + 30 - ign * (MOUTH_Z + 30 - shared.uEnd.value + 60);
    shared.uIgnZ.value = ignZ;

    // Camera along its path.
    const last = shots.length - 1;
    const x = Math.max(0, Math.min(last, state.path));
    const k = Math.min(last, Math.floor(x));
    const f = x - k;
    const a = shots[k];
    const b = shots[Math.min(last, k + 1)];
    if (b.via && f > 0) {
      // Round the mouth of the bore on the way in.
      const u = 1 - f;
      camPos
        .copy(a.p)
        .multiplyScalar(u * u)
        .addScaledVector(b.via, 2 * u * f)
        .addScaledVector(b.p, f * f);
    } else {
      camPos.lerpVectors(a.p, b.p, f);
      // Between two stations, swing wide of the capsule going by.
      const arc = Math.sin(f * Math.PI);
      if (a !== b && !portrait) {
        camPos.x -= arc * 3.2;
        camPos.y += arc * 1.4;
      }
    }
    camLook.lerpVectors(a.l, b.l, f);
    const stepRun = state.step * (coarse ? 26 : 19);
    camPos.z -= stepRun;
    camLook.z -= stepRun;
    camPos.x += state.px * 1.1;
    camPos.y -= state.py * 0.6;
    camLook.x += state.px * 0.3;
    camLook.y -= state.py * 0.18;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const fov = a.fov + (b.fov - a.fov) * f + state.speed * 7;
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Coils around the camera, snapped to their spacing.
    const snap = Math.ceil((camPos.z + SPACING * 3) / SPACING) * SPACING;
    coilGroup.position.z = Math.min(snap, Math.floor(MOUTH_Z / SPACING) * SPACING);
    farGlow.position.set(0, 0, Math.max(camPos.z - 360, shared.uEnd.value - 60));

    // Energy. An idle pulse runs every few seconds, the way of travel.
    const dir = state.dir >= 0 ? 1 : -1;
    if (now > idleAt) idleAt = now + 3400;
    const idleP = 1 - (idleAt - now) / 3400;
    shared.uIdleZ.value = camPos.z + (dir > 0 ? 20 - idleP * 260 : -240 + idleP * 260);
    shared.uIdleA.value = 0.42 * Math.sin(Math.min(1, idleP * 1.4) * Math.PI);
    const firedT = (now - firedAt) / 1000;
    if (firedT < 1.3) {
      const e = firedT / 1.3;
      shared.uFireZ.value = firedFrom + (dir > 0 ? -1 : 1) * e * e * 420;
      shared.uFireA.value = 1.5 * (1 - e) * (1 - e);
    } else shared.uFireA.value = 0;
    flow += ((state.dir * -0.5 - state.speed * state.dir * 2.4) * dtMs) / 1000;
    railU.uFlow.value = flow;

    // Capsules.
    const launchT = launched >= 0 ? (now - launchedAt) / 1000 : 0;
    const speedChroma = state.speed;
    caps.forEach((c, i) => {
      const stop = opts.capsules[i].stop;
      const u = state.path - stop;
      // Past its turn it lifts up out of the bore; scrolling back brings it down.
      const out = smooth(0.2, 0.96, u);
      const gone = !opts.outside ? smooth(0.1, 0.9, u) : out;
      let z = zOf(i);
      let y = gone * 36;
      let rotY = portrait ? 0 : -0.3 + state.px * 0.1 * (1 - Math.min(1, Math.abs(u) * 1.4));
      let rotX = gone * 0.9 + state.py * 0.05 * (1 - Math.min(1, Math.abs(u) * 1.4));
      y += Math.sin(time * 0.5 + i) * 0.1;
      if (arriving) {
        const p = clamp01((time - 0.08) / 1.45);
        z -= (1 - outCubic(p)) * 170;
      }
      if (launched === i) {
        const p = clamp01(launchT / 0.62);
        z -= inCubic(p) * 300;
        rotY *= 1 - p;
      }
      c.group.position.z = z;
      c.group.position.y = y;
      c.group.rotation.set(rotX, rotY, 0);
      c.group.visible = gone < 0.995 && z - camPos.z < 12;

      const focus = 1 - smooth(0, 0.7, Math.abs(u));
      // The next one along is already bright; those further off, less so.
      const ahead = u < 0 ? Math.max(0.6, 1 - Math.abs(u) * 0.2) : 0.28;
      const litTarget = ahead + (1 - ahead) * focus;
      c.lit += (litTarget - c.lit) * 0.12;
      c.u.uLit.value = c.lit;
      c.u.uHover.value = focus * state.hover;
      c.u.uChroma.value = speedChroma * focus;
      (c.u.uPointer.value as Vector2).set(state.px * focus, -state.py * focus);
      // The light crosses every so often.
      c.u.uSweep.value = ((time * 0.085 + i * 0.37) % 1) * 3.6 - 1.1;
      if (c.tex && c.on < 1.02) {
        c.on = Math.min(1.02, c.on + dtMs / 650);
        c.u.uOn.value = c.on;
      }
      c.glowU.uA.value = (0.1 + focus * 0.22 + state.hover * focus * 0.14) * (shared.uIgnZ.value < z + 40 ? 1 : 0.2);
      // One pixel, in the face's own units, for a clean edge at any distance.
      const dist = Math.max(4, Math.abs(z - camPos.z));
      const facePx = (H / (dist * 2 * Math.tan((camera.fov / 2) * (Math.PI / 180)))) * vh;
      c.u.uAA.value = 0.75 / Math.max(1, facePx);
    });

    // Sky drifts with where the camera looks and how far it has come.
    (skyMat.uniforms.uOff.value as Vector2).set(camPos.z * 0.0012 + state.px * 0.03, state.py * 0.02);
    skyMat.uniforms.uWarp.value = state.speed * 0.9;

    lineU.uGain.value = Math.min(1, state.speed * 1.6);
    lineU.uStretch.value = state.speed * 26 * (state.dir >= 0 ? 1 : -1);

    renderer.render(scene, camera);
    if (dtMs > 0) governor.frame(dtMs, state.speed > 0.02);
  }

  // ---- Ready, and the GPU going away -----------------------------------------
  let lost = false;
  const lostContext = (e: Event) => {
    e.preventDefault();
    lost = true;
    onLost();
  };
  const restored = () => {
    lost = false;
    prelink(renderer, scene, camera, null).then(() => {
      if (disposed || lost) return;
      draw(performance.now());
      onReady();
    });
  };
  canvas.addEventListener("webglcontextlost", lostContext);
  canvas.addEventListener("webglcontextrestored", restored);

  // Shaders link in the background; the first frame is drawn before the canvas
  // is shown, so nothing has to wait in front of the visitor.
  prelink(renderer, scene, camera, null).then(async () => {
    if (disposed || lost) return;
    await breathe();
    if (disposed || lost) return;
    draw(performance.now());
    onReady();
  });

  const v0 = new Vector3();
  return {
    draw: (now) => {
      if (!lost) draw(now);
    },
    resize,
    launch(i) {
      launched = i;
      launchedAt = performance.now();
      firedAt = launchedAt;
      firedFrom = caps[i]?.group.position.z ?? 0;
    },
    pulse() {
      firedAt = performance.now();
      firedFrom = camPos.z + 10;
    },
    faceRect(i) {
      const c = caps[i];
      let left = 1e9;
      let top = 1e9;
      let right = -1e9;
      let bottom = -1e9;
      if (!c) return { left: 0, top: 0, right: 0, bottom: 0 };
      c.group.updateMatrixWorld();
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        v0.set((sx * W) / 2, (sy * H) / 2, 0).applyMatrix4(c.group.matrixWorld).project(camera);
        const px = ((v0.x + 1) / 2) * vw;
        const py = ((1 - v0.y) / 2) * vh;
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
      }
      return { left, top, right, bottom };
    },
    stop() {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", lostContext);
      canvas.removeEventListener("webglcontextrestored", restored);
      caps.forEach((c) => {
        (c.tex?.image as ImageBitmap | null)?.close?.();
        c.tex?.dispose();
      });
      disposers.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
