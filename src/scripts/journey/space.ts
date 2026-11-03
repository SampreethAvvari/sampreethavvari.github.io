// Deep space around the flight: a sky dome with nebula, a wrapped star field
// with real parallax, warp streaks, the light thread the ship follows, and
// the chapter set pieces (built in pieces.ts).

import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  Points,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type PerspectiveCamera,
  type Texture,
} from "three";
import { additive } from "./fx";
import { NOISE } from "./glsl";
import { travel, type FlightPath, type Landing } from "./path";
import { buildPieces, VIEW, type Piece, type PieceFrame, type PointerRay } from "./pieces";
import type { Surface } from "./surface";
import { rng } from "./textures";

export interface SpaceInput {
  p: number;
  /** Position along the path, in chapters. */
  q: number;
  /** 0..1, how far into a hyperspace jump. */
  warp: number;
  /** The pointer as a world ray. */
  ptr: PointerRay;
  /** +1 flying forward along the path, -1 after turning back. */
  heading: number;
  /** Landing phase 0..1 (touchdown at 0.84). */
  land: number;
  /** Surface progress: 0 landed, 1 first steps, 2 helmet, 3 touch. */
  s: number;
  /** Drawing buffer size. */
  width: number;
  height: number;
  /** The way the visitor is going, 1 or -1, its blend (0 on, 1 back), and chapters per second. */
  dir: number;
  back: number;
  v: number;
  time: number;
  dt: number;
  speed: number;
  boost: number;
  color: Color;
  camera: PerspectiveCamera;
  fwd: Vector3;
  reduced: boolean;
  /** Pixels per world unit at distance 1: drawing buffer height / (2 tan(fov / 2)). */
  pxScale: number;
  dpr: number;
}

export interface Flare {
  pos: Vector3;
  color: Color;
  strength: number;
}

export interface Space {
  /** Fog for the world in view, blended by its weight. */
  haze: { color: Color; density: number; weight: number };
  group: Group;
  update(s: SpaceInput): void;
  /** Brightest light source this frame, for the lens flare in post. */
  flare: Flare;
  /** Every set piece, so the engine can warm up their shaders. */
  pieces: Piece[];
  /** The live surface world. */
  surface: Surface | null;
  /** 1 while the planet's sky fills the view (last frame's value). */
  cover: number;
}

export interface Chapter {
  id: string;
  color: Color;
}

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w; // always at the far plane
}
`;

const SKY_FS = (octaves: number) => /* glsl */ `
#define OCTAVES ${octaves}
${NOISE}
uniform vec3 uColor;
uniform vec3 uDeep;
uniform float uNebula;
uniform float uWarm;
uniform vec3 uWarmDir;
uniform vec3 uWarmColor;
uniform vec3 uWarmUp;
uniform float uTime;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  // A broad faint band across the sky gives the dark some structure.
  float bd = dot(d, normalize(vec3(0.3, 1.0, 0.2))) * 2.4;
  float band = exp(-bd * bd);
  vec3 col = uDeep * (0.7 + band * 0.9);
  float n = fbm(d * 2.1 + vec3(3.1, 0.0, 1.7));
  float n2 = fbm(d * 4.7 + n * 1.8);
  float neb = smoothstep(0.38, 0.85, n) * (0.35 + 0.65 * n2);
  float wisps = smoothstep(0.55, 0.95, n2) * band;
  vec3 hue2 = mix(uColor, vec3(0.08, 0.1, 0.35), 0.55);
  col += uColor * neb * neb * uNebula * 0.075;
  col += hue2 * wisps * (0.01 + uNebula * 0.03);
  col += uColor * band * 0.008;
  // Faint distant stars: a hashed grid on the sphere of directions.
  vec3 g = d * 260.0;
  vec3 c = floor(g);
  float h = hash13(c);
  vec3 o = vec3(hash13(c + 7.1), hash13(c + 3.3), hash13(c + 5.7)) * 0.6 + 0.2;
  float sd = length(fract(g) - o);
  float star = step(0.93, h) * smoothstep(0.16, 0.0, sd) * (0.4 + 2.0 * hash13(c + 1.9));
  col += vec3(0.8, 0.86, 1.0) * star * 0.55;
  // Warm dawn glow toward a direction, used by the last chapter.
  float wd = max(dot(d, uWarmDir), 0.0);
  float hz = (dot(d, uWarmUp) + 0.02) * 16.0;
  col += uWarmColor * uWarm * exp(-hz * hz) * (0.03 + 0.12 * wd * wd);
  col += uWarmColor * uWarm * (pow(wd, 8.0) * 0.1 + pow(wd, 160.0) * 0.6);
  gl_FragColor = vec4(col, 1.0);
}
`;

const STAR_VS = /* glsl */ `
attribute float aSeed;
uniform vec3 uCam;
uniform vec3 uDrift;
uniform float uBox;
uniform float uPx;
uniform float uDpr;
uniform float uTime;
uniform vec3 uTint;
varying vec3 vCol;
varying float vA;
void main() {
  vec3 p = position * uBox;
  vec3 rel = mod(p - uCam - uDrift + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
  float dist = length(rel);
  float big = pow(fract(aSeed * 13.7), 7.0);
  float size = 0.35 + 1.6 * big;
  gl_PointSize = clamp(size * uPx / max(-mv.z, 1.0), 1.0 * uDpr, 6.0 * uDpr);
  float tw = 0.75 + 0.25 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 60.0);
  vA = (1.0 - smoothstep(0.36 * uBox, 0.5 * uBox, dist)) * tw * (0.35 + 0.65 * fract(aSeed * 7.3));
  float k = fract(aSeed * 3.1);
  vec3 c = k < 0.18 ? vec3(1.0, 0.82, 0.62) : (k < 0.55 ? vec3(0.78, 0.86, 1.0) : vec3(1.0));
  vCol = mix(c, uTint, 0.18) * (1.0 + 2.5 * big);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FS = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vCol * a * vA, 1.0);
}
`;

const STREAK_VS = /* glsl */ `
attribute vec3 aBase;
attribute vec2 aCorner;
attribute float aSeed;
uniform vec3 uCam;
uniform vec3 uDrift;
uniform vec3 uDir;
uniform float uLen;
uniform float uBox;
uniform float uWidth;
varying float vAlong;
varying float vEdge;
varying float vA;
void main() {
  vec3 p = aBase * uBox;
  vec3 rel = mod(p - uCam - uDrift + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec3 head = uCam + rel;
  vec3 tail = head + uDir * uLen * (0.5 + aSeed);
  vec4 h = viewMatrix * vec4(head, 1.0);
  vec4 t = viewMatrix * vec4(tail, 1.0);
  vec4 mv = mix(h, t, aCorner.x);
  vec3 dv = t.xyz - h.xyz;
  vec3 side = normalize(cross(dv + vec3(0.0, 0.0, 1e-4), mv.xyz));
  mv.xyz += side * aCorner.y * uWidth * max(-mv.z, 1.0);
  // Keep the corridor around the flight line clear so the ship stays readable.
  vec3 f = normalize(uDir);
  float lat = length(rel - dot(rel, f) * f);
  vA = smoothstep(14.0, 40.0, lat) * (1.0 - smoothstep(0.35 * uBox, 0.5 * uBox, length(rel))) * step(mv.z, -1.0);
  vAlong = aCorner.x;
  vEdge = aCorner.y;
  gl_Position = projectionMatrix * mv;
}
`;

const STREAK_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vAlong;
varying float vEdge;
varying float vA;
void main() {
  float a = (1.0 - abs(vEdge)) * pow(max(1.0 - vAlong, 0.0), 1.5) * vA * uAlpha;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.45) * a, 1.0);
}
`;

const THREAD_VS = /* glsl */ `
attribute vec3 color;
attribute float aP;
varying vec3 vCol;
varying float vP;
varying vec3 vN;
varying vec3 vV;
void main() {
  vCol = color;
  vP = aP;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const THREAD_FS = /* glsl */ `
uniform float uP;
uniform float uTime;
uniform float uGlow;
uniform float uPower;
varying vec3 vCol;
varying float vP;
varying vec3 vN;
varying vec3 vV;
void main() {
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(facing, uPower);
  float ahead = vP - uP;
  // Brightest just ahead of the ship, fading behind it and far ahead.
  float reach = smoothstep(-0.25, 0.02, ahead) * (0.35 + 0.65 * exp(-max(ahead, 0.0) * 1.1));
  float pulse = pow(0.5 + 0.5 * sin((vP * 7.0 - uTime * 0.45) * 6.2832), 18.0);
  float a = body * reach * (0.55 + 1.6 * pulse) * uGlow;
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

export function buildSpace(path: FlightPath, chapters: Chapter[], low: boolean, glowTex: Texture, cloudTex: Texture, landing: Landing, landWorld: number): Space {
  const group = new Group();
  const rand = rng(23);

  // Sky dome. It follows the camera and always draws at the far plane.
  const skyMat = new ShaderMaterial({
    vertexShader: SKY_VS,
    fragmentShader: SKY_FS(low ? 2 : 4),
    uniforms: {
      uColor: { value: new Color() },
      uDeep: { value: new Color(0.004, 0.006, 0.016) },
      uNebula: { value: 0.3 },
      uWarm: { value: 0 },
      uWarmDir: { value: new Vector3(0, 0, -1) },
      uWarmUp: { value: landing.up.clone() },
      uWarmColor: { value: new Color(1.0, 0.55, 0.22) },
      uTime: { value: 0 },
    },
    side: BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const sky = new Mesh(new SphereGeometry(100, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  group.add(sky);

  // Star field: unit cube positions, wrapped around the camera in the shader.
  const starCount = low ? 2600 : 7500;
  const sp = new Float32Array(starCount * 3);
  const ss = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    sp[i * 3] = rand();
    sp[i * 3 + 1] = rand();
    sp[i * 3 + 2] = rand();
    ss[i] = rand();
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute("position", new BufferAttribute(sp, 3));
  starGeo.setAttribute("aSeed", new BufferAttribute(ss, 1));
  const shared = {
    uCam: { value: new Vector3() },
    uDrift: { value: new Vector3() },
  };
  const starMat = additive(
    new ShaderMaterial({
      vertexShader: STAR_VS,
      fragmentShader: STAR_FS,
      uniforms: {
        ...shared,
        uBox: { value: 1400 },
        uPx: { value: 800 },
        uDpr: { value: 1 },
        uTime: { value: 0 },
        uTint: { value: new Color() },
      },
    }),
  );
  const stars = new Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -50;
  group.add(stars);

  // Warp streaks: thin quads that stretch with speed.
  const streakCount = low ? 160 : 460;
  const vb = new Float32Array(streakCount * 4 * 3);
  const vc = new Float32Array(streakCount * 4 * 2);
  const vs = new Float32Array(streakCount * 4);
  const si: number[] = [];
  for (let i = 0; i < streakCount; i++) {
    const x = rand();
    const y = rand();
    const z = rand();
    const seed = rand();
    const corners = [0, -1, 0, 1, 1, -1, 1, 1];
    for (let k = 0; k < 4; k++) {
      vb.set([x, y, z], (i * 4 + k) * 3);
      vc.set([corners[k * 2], corners[k * 2 + 1]], (i * 4 + k) * 2);
      vs[i * 4 + k] = seed;
    }
    const b = i * 4;
    si.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const streakGeo = new BufferGeometry();
  streakGeo.setAttribute("position", new BufferAttribute(new Float32Array(streakCount * 4 * 3), 3));
  streakGeo.setAttribute("aBase", new BufferAttribute(vb, 3));
  streakGeo.setAttribute("aCorner", new BufferAttribute(vc, 2));
  streakGeo.setAttribute("aSeed", new BufferAttribute(vs, 1));
  streakGeo.setIndex(si);
  const streakMat = additive(
    new ShaderMaterial({
      vertexShader: STREAK_VS,
      fragmentShader: STREAK_FS,
      uniforms: {
        ...shared,
        uDir: { value: new Vector3(0, 0, -1) },
        uLen: { value: 0 },
        uBox: { value: 520 },
        uWidth: { value: 0.0016 },
        uColor: { value: new Color() },
        uAlpha: { value: 0 },
      },
    }),
  );
  const streaks = new Mesh(streakGeo, streakMat);
  streaks.frustumCulled = false;
  streaks.renderOrder = -40;
  group.add(streaks);

  // The light thread: one tube along the whole flight, just under the ship,
  // that follows the landing approach down to the pad.
  const pStart = -0.6;
  const threadPts: Vector3[] = [];
  const threadP: number[] = [];
  const fp = new Vector3();
  const fu = new Vector3();
  const fr = new Vector3();
  const fq = new Quaternion();
  const perChapter = low ? 40 : 70;
  const qEnd = travel(path.n - 1 + 0.8, path.n) + 0.05;
  const STEPS = Math.max(2, Math.ceil((qEnd - pStart) * perChapter));
  for (let i = 0; i <= STEPS; i++) {
    const p = pStart + ((qEnd - pStart) * i) / STEPS;
    path.frame(p, fp, fq, fr, fu);
    threadPts.push(fp.clone().addScaledVector(fu, -9));
    threadP.push(p);
  }
  const threadCurve = new CatmullRomCurve3(threadPts, false, "catmullrom", 0.5);
  // Progress at each point along the thread, measured by arc length.
  const cum = [0];
  for (let i = 1; i < threadPts.length; i++) cum.push(cum[i - 1] + threadPts[i].distanceTo(threadPts[i - 1]));
  const total = cum[cum.length - 1];
  const pAtFraction = (fr: number) => {
    const d = fr * total;
    let lo = 0;
    while (lo < cum.length - 2 && cum[lo + 1] < d) lo++;
    const t = (d - cum[lo]) / Math.max(1e-6, cum[lo + 1] - cum[lo]);
    return threadP[lo] + (threadP[lo + 1] - threadP[lo]) * Math.min(1, Math.max(0, t));
  };
  const tubular = threadPts.length * 2;
  const makeThread = (radius: number, radial: number) => {
    const g = new TubeGeometry(threadCurve, tubular, radius, radial, false);
    const count = g.getAttribute("position").count;
    const col = new Float32Array(count * 3);
    const ap = new Float32Array(count);
    const c = new Color();
    for (let i = 0; i < count; i++) {
      const ring = Math.floor(i / (radial + 1));
      const p = pAtFraction(ring / tubular);
      chapterColor(chapters, p, c);
      col.set([c.r, c.g, c.b], i * 3);
      ap[i] = p;
    }
    g.setAttribute("color", new BufferAttribute(col, 3));
    g.setAttribute("aP", new BufferAttribute(ap, 1));
    return g;
  };
  const threadUniforms = { uP: { value: 0 }, uTime: { value: 0 } };
  const threadCore = new Mesh(
    makeThread(0.07, 6),
    additive(
      new ShaderMaterial({
        vertexShader: THREAD_VS,
        fragmentShader: THREAD_FS,
        uniforms: { ...threadUniforms, uGlow: { value: 1.5 }, uPower: { value: 0.6 } },
      }),
    ),
  );
  const threadHalo = new Mesh(
    makeThread(0.55, 8),
    additive(
      new ShaderMaterial({
        vertexShader: THREAD_VS,
        fragmentShader: THREAD_FS,
        uniforms: { ...threadUniforms, uGlow: { value: 0.16 }, uPower: { value: 3.0 } },
      }),
    ),
  );
  threadCore.frustumCulled = threadHalo.frustumCulled = false;
  threadCore.renderOrder = threadHalo.renderOrder = 2;
  group.add(threadCore, threadHalo);

  // Set pieces.
  const pieces = buildPieces({ path, chapters, low, glowTex, cloudTex, landing, landWorld });
  for (const pc of pieces) group.add(pc.group);

  const flare: Flare = { pos: new Vector3(), color: new Color(), strength: 0 };
  const skyColor = new Color();
  const haze = { color: new Color(), density: 0, weight: 0 };
  const frame: PieceFrame = { time: 0, dt: 0, p: 0, camera: null as unknown as PerspectiveCamera, ptr: { o: new Vector3(), d: new Vector3(), on: 0 }, land: 0, s: 0, pxScale: 800, dpr: 1, reduced: false, width: 1, height: 1, dir: 1, back: 0, v: 0 };

  function update(s: SpaceInput) {
    const { p, time, dt, camera } = s;
    sky.position.copy(camera.position);
    skyColor.copy(s.color);
    skyMat.uniforms.uColor.value.copy(skyColor);
    skyMat.uniforms.uTime.value = time;

    // Nebula strength and the dawn glow come from the set pieces in view.
    let neb = 0.22;
    let warm = 0;
    let cover = 0;
    flare.strength = 0;
    haze.weight = 0;
    VIEW.uPx.value = s.pxScale;
    VIEW.uDpr.value = s.dpr;
    VIEW.uRayO.value.copy(s.ptr.o);
    VIEW.uRayD.value.copy(s.ptr.d);
    VIEW.uRayOn.value = s.ptr.on;
    frame.time = time;
    frame.dt = dt;
    frame.p = p;
    frame.camera = camera;
    frame.ptr = s.ptr;
    frame.land = s.land;
    frame.s = s.s;
    frame.pxScale = s.pxScale;
    frame.dpr = s.dpr;
    frame.reduced = s.reduced;
    frame.width = s.width;
    frame.height = s.height;
    frame.dir = s.dir;
    frame.back = s.back;
    frame.v = s.v;
    for (const pc of pieces) {
      const w = pc.weight(p);
      const on = w > 0.001;
      pc.group.visible = on;
      pc.fade.value = w;
      if (!on) continue;
      neb += (pc.nebula ?? 0) * w;
      if (pc.warm) {
        warm += pc.warm.amount * w;
        skyMat.uniforms.uWarmDir.value.copy(pc.warm.dir);
      }
      pc.update?.(frame);
      if (pc.cover !== undefined) cover = Math.max(cover, pc.cover * w);
      if (pc.haze && w > haze.weight) {
        haze.weight = w;
        haze.color.copy(pc.haze.color);
        haze.density = pc.haze.density;
      }
      if (pc.flare && pc.flare.strength * w > flare.strength) {
        flare.strength = pc.flare.strength * w;
        flare.pos.copy(pc.flare.pos);
        flare.color.copy(pc.flare.color);
      }
    }
    // On the ground the deep space behind the sky is not drawn at all.
    const open = cover < 0.999;
    sky.visible = open;
    stars.visible = open;
    threadCore.visible = open;
    threadHalo.visible = open;
    out.cover = cover;
    skyMat.uniforms.uNebula.value = neb;
    skyMat.uniforms.uWarm.value = warm;

    // Stars drift past slowly even at rest, so the ship always feels under way.
    if (!s.reduced) shared.uDrift.value.addScaledVector(s.fwd, dt * 9 * s.heading);
    shared.uCam.value.copy(camera.position);
    starMat.uniforms.uPx.value = s.pxScale;
    starMat.uniforms.uDpr.value = s.dpr;
    starMat.uniforms.uTime.value = time;
    starMat.uniforms.uTint.value.copy(s.color);

    // Warp streaks only during a jump, and never with reduced motion.
    const warp = s.reduced ? 0 : s.warp;
    streaks.visible = warp > 0.01;
    streakMat.uniforms.uAlpha.value = Math.min(1, warp * 1.6) * 1.2;
    streakMat.uniforms.uLen.value = 10 + warp * 420;
    streakMat.uniforms.uDir.value.copy(s.fwd).multiplyScalar(s.speed >= 0 ? 1 : -1);
    streakMat.uniforms.uColor.value.copy(s.color);
    streakMat.uniforms.uWidth.value = 0.0011 * s.dpr;

    threadUniforms.uP.value = s.q;
    threadUniforms.uTime.value = time;
  }

  const out: Space = { group, update, flare, pieces, haze, surface: null, cover: 0 };
  out.surface = pieces.find((pc) => pc.surface)?.surface ?? null;
  return out;
}

/** Chapter light at progress p, eased between neighbours. */
export function chapterColor(chapters: Chapter[], p: number, out: Color) {
  const n = chapters.length;
  if (n === 0) return out.setRGB(0.36, 0.55, 0.94);
  const c = Math.max(0, Math.min(n - 1, p));
  const i = Math.min(n - 1, Math.floor(c));
  const j = Math.min(n - 1, i + 1);
  let f = c - i;
  // Hold each chapter's light for most of its span, blend near the middle.
  f = Math.max(0, Math.min(1, (f - 0.3) / 0.4));
  f = f * f * (3 - 2 * f);
  return out.copy(chapters[i].color).lerp(chapters[j].color, f);
}

