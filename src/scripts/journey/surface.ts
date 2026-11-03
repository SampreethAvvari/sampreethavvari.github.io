// The planet's surface: one live world that the landing, the first steps, the
// helmet and the touch all happen in. An arid desert under an orange sky, with
// wind, drifting sand, far dust, a dust devil and the first stars as the sun
// goes down. The camera moves through it on one continuous path.
//
// Site space: origin on the landing spot, +Y up, -Z toward the sun, +X right
// when facing the sun. Everything here lives in that frame.
//
// One unit is about 1.33 m, so a person stands about 1.35 tall.

import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  Points,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector3,
  type PerspectiveCamera,
  type Texture,
} from "three";
import type { Landing } from "./path";
import { rng } from "./textures";

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ ground

function hash2(a: number, b: number) {
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

/** Ground height in site space: a flat plain, low long dunes, a low ridge far off. */
export function groundHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  const n = fbm2(x * 0.0016, z * 0.0016);
  const w = x * 0.0075 + z * 0.0031 + n * 5.5;
  const crest = Math.pow(0.5 + 0.5 * Math.sin(w), 3);
  let h = crest * (0.5 + 3.2 * n);
  h += fbm2(x * 0.021, z * 0.021) * 0.35;
  // Flat where the lander stands and where he walks out to.
  h *= smooth(10, 70, r);
  const toStand = Math.hypot(x - STAND.x, z - STAND.z);
  h *= smooth(16, 90, toStand);
  // Low ridges that break the far horizon.
  const far = smooth(500, 2200, r);
  if (far > 0) h += far * (Math.pow(fbm2(x * 0.0009 + 3.1, z * 0.0009 + 7.7), 2.2) * 70 + crest * 8);
  return h - (r * r) / (2 * 90000);
}

/** A tiling map of wind ripples: RG hold the slope, B the height, for the raking light to catch. */
function rippleTexture(size: number): DataTexture {
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
      data[k + 3] = 255;
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ sky

const SKY_UNIFORMS = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uHorSun;
  uniform vec3 uHorAway;
  uniform vec3 uMid;
  uniform vec3 uTop;
  uniform vec3 uSunCol;
`;

/** The sky's colour in direction d, shared with the ground so the two meet at the horizon. */
const SKY_FN = /* glsl */ `
  vec3 skyColor(vec3 d) {
    float y = max(d.y, 0.0);
    vec2 hd = normalize(d.xz + 1e-5);
    vec2 hs = normalize(uSun.xz + 1e-5);
    float az = 0.5 + 0.5 * dot(hd, hs);
    vec3 hor = mix(uHorAway, uHorSun, pow(az, 1.6));
    vec3 c = mix(hor, uMid, smoothstep(0.0, 0.2, y));
    c = mix(c, uTop, smoothstep(0.1, 0.8, y));
    float mu = max(dot(d, uSun), 0.0);
    c += uSunCol * (0.1 * pow(mu, 5.0) + 0.3 * pow(mu, 40.0) + 0.9 * pow(mu, 500.0));
    return c;
  }
`;

const DOME_VS = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DOME_FS = /* glsl */ `
  ${SKY_UNIFORMS}
  uniform float uCover;
  uniform float uStars;
  uniform float uTime;
  uniform float uSunCos;
  varying vec3 vDir;
  ${SKY_FN}
  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash13(vec3(i, 1.0));
    float b = hash13(vec3(i + vec2(1.0, 0.0), 1.0));
    float c = hash13(vec3(i + vec2(0.0, 1.0), 1.0));
    float d = hash13(vec3(i + vec2(1.0, 1.0), 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  void main() {
    vec3 d = normalize(vDir);
    vec3 c = skyColor(d);
    // Long thin bands of high dust, drifting.
    float yy = max(d.y, 0.0);
    vec2 sp = vec2(atan(d.x, -d.z) * 2.4 + uTime * 0.004, yy * 26.0);
    float band = vnoise(sp) * 0.6 + vnoise(sp * vec2(2.3, 3.1) + 4.0) * 0.4;
    band = smoothstep(0.5, 0.86, band) * smoothstep(0.0, 0.05, yy) * (1.0 - smoothstep(0.2, 0.5, yy));
    c = mix(c, c * vec3(1.32, 1.16, 1.04), band * 0.65);
    // The sun.
    float mu = dot(d, uSun);
    float disc = smoothstep(uSunCos - 0.00006, uSunCos + 0.00006, mu);
    float limb = smoothstep(uSunCos, 1.0, mu);
    c += disc * vec3(4.6, 2.5, 0.95) * (0.6 + 0.4 * pow(limb, 0.3));
    // The first stars, where the sky has gone dark.
    if (uStars > 0.001 && yy > 0.02) {
      vec3 sd = d * 190.0;
      vec3 id = floor(sd);
      float h = hash13(id);
      if (h > 0.985) {
        vec3 f = fract(sd) - 0.5;
        float s = smoothstep(0.32, 0.0, length(f));
        float tw = 0.75 + 0.25 * sin(uTime * (1.0 + h * 4.0) + h * 60.0);
        c += vec3(1.0, 0.93, 0.85) * s * s * tw * (h - 0.985) * 180.0 * uStars * smoothstep(0.02, 0.2, yy);
      }
    }
    gl_FragColor = vec4(c, uCover);
  }
`;

// ------------------------------------------------------------------ dust

const WIND = new Vector3(1, 0, 0.22).normalize();

const MOTE_VS = /* glsl */ `
  attribute vec3 aSeed;
  uniform vec3 uCam;
  uniform vec3 uSun;
  uniform vec3 uWind;
  uniform float uTime;
  uniform float uPx;
  uniform float uDpr;
  uniform float uBox;
  varying float vA;
  varying float vLit;
  void main() {
    float speed = 0.5 + aSeed.x * 1.6;
    vec3 q = position * uBox + uWind * uTime * speed;
    q.x += sin(uTime * 0.31 + aSeed.y * 40.0) * 0.7;
    q.z += cos(uTime * 0.23 + aSeed.z * 40.0) * 0.7;
    vec3 p = vec3(mod(q.x - uCam.x, uBox) - uBox * 0.5 + uCam.x, 0.0, mod(q.z - uCam.z, uBox) - uBox * 0.5 + uCam.z);
    p.y = 0.03 + pow(position.y, 2.2) * 10.0 + sin(uTime * 0.5 + aSeed.x * 30.0) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.05);
    float size = (0.012 + aSeed.y * aSeed.y * 0.03) * uPx / dist;
    gl_PointSize = clamp(size, 1.0 * uDpr, 11.0 * uDpr);
    gl_Position = projectionMatrix * mv;
    vec3 toP = normalize(p - uCam);
    float mu = max(dot(toP, uSun), 0.0);
    vLit = 0.22 + 1.5 * pow(mu, 10.0) + 0.4 * pow(mu, 2.0);
    // Fade with distance and right at the lens.
    vA = smoothstep(0.15, 1.2, dist) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, dist));
  }
`;

const MOTE_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  varying float vA;
  varying float vLit;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.05, length(c));
    gl_FragColor = vec4(uColor * vLit * a * vA * uFade, 1.0);
  }
`;

const VEIL_VS = /* glsl */ `
  attribute vec4 aA; // x, z, height above ground, length
  attribute vec4 aB; // speed, thickness, phase, opacity
  uniform vec3 uCam;
  uniform vec3 uWind;
  uniform float uTime;
  uniform float uBox;
  uniform float uNear;
  varying vec2 vUv;
  varying float vA;
  varying float vSeed;
  void main() {
    vec3 q = vec3(aA.x, 0.0, aA.y) * uBox + uWind * uTime * aB.x;
    vec3 c = vec3(mod(q.x - uCam.x, uBox) - uBox * 0.5 + uCam.x, aA.z, mod(q.z - uCam.z, uBox) - uBox * 0.5 + uCam.z);
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    // Stretch along the wind as the camera sees it, stay level with the ground.
    vec3 wv = normalize((modelViewMatrix * vec4(uWind, 0.0)).xyz + vec3(1e-3, 0.0, 0.0));
    vec3 upv = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec2 along = normalize(vec2(wv.x, 0.0) + vec2(1e-3, 0.0));
    mv.xyz += vec3(along * position.x * aA.w, 0.0) + upv * position.y * aB.y;
    gl_Position = projectionMatrix * mv;
    vUv = position.xy * 0.5 + 0.5;
    vSeed = aB.z;
    float dist = length(c - uCam);
    // Each veil breathes in and out as gusts pass, and fades at the edge of its box.
    float gust = 0.5 + 0.5 * sin(uTime * (0.2 + aB.z * 0.35) + aB.z * 80.0);
    vA = aB.w * (0.25 + 0.75 * gust * gust) * smoothstep(uNear * 0.4, uNear * 1.6, dist) * (1.0 - smoothstep(uBox * 0.28, uBox * 0.5, dist));
  }
`;

const VEIL_FS = /* glsl */ `
  uniform sampler2D tCloud;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFade;
  varying vec2 vUv;
  varying float vA;
  varying float vSeed;
  void main() {
    vec2 uv = vUv;
    uv.x = uv.x * 0.8 + vSeed * 3.0 - uTime * 0.012;
    float t = texture2D(tCloud, vUv).a;
    float b = texture2D(tCloud, vec2(fract(uv.x), fract(uv.y * 0.7 + vSeed))).a;
    float a = t * (0.35 + 0.95 * b) * vA * uFade;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const DEVIL_VS = /* glsl */ `
  attribute vec3 aP; // t along the column, angle offset, size
  uniform vec3 uBase;
  uniform float uTime;
  uniform float uHeight;
  varying vec2 vUv;
  varying float vA;
  void main() {
    float t = aP.x;
    float rad = (1.2 + t * t * 15.0) * (0.75 + 0.25 * sin(uTime * 0.7 + aP.y));
    float ang = uTime * (2.4 - t * 1.1) + aP.y;
    vec3 c = uBase;
    c.x += sin(uTime * 0.05) * 18.0 + sin(t * 3.0 + uTime * 0.31) * 3.0 * t;
    c.z += cos(uTime * 0.04) * 12.0;
    c += vec3(cos(ang) * rad, t * uHeight, sin(ang) * rad);
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    float size = aP.z * (2.2 + t * 11.0);
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
    vUv = position.xy * 0.5 + 0.5;
    vA = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.6, 1.0, t));
  }
`;

const DEVIL_FS = /* glsl */ `
  uniform sampler2D tCloud;
  uniform vec3 uColor;
  uniform float uFade;
  varying vec2 vUv;
  varying float vA;
  void main() {
    float a = texture2D(tCloud, vUv).a * vA * 0.42 * uFade;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// ------------------------------------------------------------------ shots

export interface SurfaceShot {
  pos: Vector3;
  look: Vector3;
  fov: number;
  /** How far the pointer moves the camera, in units. */
  parallax: number;
}

/** Camera path through the world. Index 1 is the first steps, 2 the helmet, 3 the touch. */
const EXIT_POS = new Vector3(0, 1.3, 12.5);
const EXIT_LOOK = new Vector3(0, 2.1, -60);
const WIDE_POS = new Vector3(0, 0, -80); // height comes from the ground below
const WIDE_YAW = (-8 * Math.PI) / 180;
const WIDE_PITCH = (6.4 * Math.PI) / 180;

export interface SurfaceInput {
  time: number;
  dt: number;
  camera: PerspectiveCamera;
  /** 0 orbit, 1 on the ground. */
  cover: number;
  /** Surface progress: 0 landed, 1 first steps, 2 helmet, 3 touch. */
  s: number;
  pxScale: number;
  dpr: number;
  reduced: boolean;
}

export interface Surface {
  group: Group;
  /** Unit vector toward the sun, in world space. */
  sunWorld: Vector3;
  sunColor: Color;
  /** How the sky should light the craft. */
  skyLight: Color;
  groundLight: Color;
  /** Colour for the scene's fog. */
  hazeColor: Color;
  /** Where the camera should be at surface progress s, in world space. */
  shot(s: number, portrait: boolean, out: SurfaceShot): SurfaceShot;
  update(f: SurfaceInput): void;
}

export function buildSurface(o: { low: boolean; landing: Landing; cloudTex: Texture }): Surface {
  const { low, landing: l } = o;
  const group = new Group();
  group.position.copy(l.pad);
  group.quaternion.copy(l.quat);
  group.updateMatrixWorld(true);
  const inv = new Quaternion().copy(l.quat).invert();
  const r = rng(4242);

  // Shared by the sky and the ground.
  const sun = new Vector3(0, 0.1, -1).normalize();
  const skyU = {
    uSun: { value: sun },
    uHorSun: { value: new Color() },
    uHorAway: { value: new Color() },
    uMid: { value: new Color() },
    uTop: { value: new Color() },
    uSunCol: { value: new Color() },
  };
  const cover = { value: 0 };
  const camSite = { value: new Vector3() };
  const uTime = { value: 0 };

  // ------------------------------------------------------------ sky dome
  const domeMat = new ShaderMaterial({
    vertexShader: DOME_VS,
    fragmentShader: DOME_FS,
    uniforms: { ...skyU, uCover: cover, uStars: { value: 0 }, uTime, uSunCos: { value: Math.cos((2.3 * Math.PI) / 180) } },
    side: 1, // back side
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const dome = new Mesh(new SphereGeometry(8000, low ? 32 : 48, low ? 20 : 32), domeMat);
  dome.frustumCulled = false;
  dome.renderOrder = -60;
  group.add(dome);

  // ------------------------------------------------------------ ground
  const NR = low ? 92 : 170;
  const NS = low ? 120 : 240;
  const RK = low ? 0.105 : 0.057;
  const pos = new Float32Array((NR + 1) * NS * 3 + 3);
  const nor = new Float32Array(pos.length);
  const H = 0.6;
  const heightN = (x: number, z: number, out: number[], at: number) => {
    const e = Math.max(0.4, Math.hypot(x, z) * 0.01);
    const h0 = groundHeight(x, z);
    const hx = groundHeight(x + e, z);
    const hz = groundHeight(x, z + e);
    const nx = -(hx - h0) / e;
    const nz = -(hz - h0) / e;
    const len = Math.hypot(nx, 1, nz);
    out[at] = nx / len;
    out[at + 1] = 1 / len;
    out[at + 2] = nz / len;
    return h0;
  };
  const tmpN = [0, 0, 0];
  pos[1] = groundHeight(0, 0);
  nor[1] = 1;
  for (let i = 0; i <= NR; i++) {
    const rad = H * (Math.exp((i + 1) * RK) - 1);
    for (let j = 0; j < NS; j++) {
      const a = ((j + (i % 2) * 0.5) / NS) * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const k = 3 + (i * NS + j) * 3;
      const h = heightN(x, z, tmpN, 0);
      pos[k] = x;
      pos[k + 1] = h;
      pos[k + 2] = z;
      nor[k] = tmpN[0];
      nor[k + 1] = tmpN[1];
      nor[k + 2] = tmpN[2];
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < NS; j++) idx.push(0, 1 + (j + 1) % NS, 1 + j);
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NS; j++) {
      const a = 1 + i * NS + j;
      const b = 1 + i * NS + (j + 1) % NS;
      const c = 1 + (i + 1) * NS + j;
      const d = 1 + (i + 1) * NS + (j + 1) % NS;
      idx.push(a, b, c, b, d, c);
    }
  }
  const tg = new BufferGeometry();
  tg.setAttribute("position", new BufferAttribute(pos, 3));
  tg.setAttribute("normal", new BufferAttribute(nor, 3));
  tg.setIndex(idx);
  tg.computeBoundingSphere();

  const ripple = rippleTexture(low ? 256 : 512);
  const sand = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0, envMapIntensity: 0.0, transparent: true, fog: false });
  const sandU = { tRipple: { value: ripple }, uCamSite: camSite, uCover: cover, uHazeD: { value: 2600 }, uAmbient: { value: new Color() } };
  sand.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, skyU, sandU);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSite;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSite = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vSite;
        uniform sampler2D tRipple;
        uniform vec3 uCamSite;
        uniform float uCover;
        uniform float uHazeD;
        uniform vec3 uAmbient;
        uniform mat3 normalMatrix;
        ${SKY_UNIFORMS}
        ${SKY_FN}
        vec3 sandGrad;
        float sandH;`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        {
          float dist = length(vSite - uCamSite);
          vec2 uv = vSite.xz;
          // Three sizes of ripple, the finer ones gone by the middle distance.
          vec4 a = texture2D(tRipple, uv * 0.21);
          vec4 b = texture2D(tRipple, uv * vec2(0.067, 0.061) + 0.37);
          vec4 c = texture2D(tRipple, uv * 0.0127 + 0.71);
          float fa = 1.0 - smoothstep(10.0, 70.0, dist);
          float fb = 1.0 - smoothstep(60.0, 340.0, dist);
          float fc = 1.0 - smoothstep(600.0, 2600.0, dist);
          vec2 g = (a.xy - 0.5) * 1.0 * fa + (b.xy - 0.5) * 1.5 * fb + (c.xy - 0.5) * 1.1 * fc;
          sandGrad = vec3(g.x, 0.0, g.y) * 1.9;
          sandH = (a.z - 0.5) * fa * 0.5 + (b.z - 0.5) * fb * 0.8 + (c.z - 0.5) * fc * 0.9;
          diffuseColor.rgb = mix(vec3(0.47, 0.25, 0.135), vec3(0.72, 0.44, 0.25), clamp(0.5 + sandH * 0.8, 0.0, 1.0));
        }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
        normal = normalize(normal + normalMatrix * sandGrad);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uAmbient;`,
      )
      .replace(
        "#include <fog_fragment>",
        /* glsl */ `
        {
          // The air: the ground fades into exactly the sky colour at the horizon.
          vec3 rd = vSite - uCamSite;
          float dist = length(rd);
          vec3 dir = rd / max(dist, 1e-3);
          float k = 1.0 - exp(-pow(dist / uHazeD, 1.35));
          vec3 air = skyColor(normalize(vec3(dir.x, 0.012, dir.z)));
          // Sun glints on the ripple faces, a path of light toward the sun.
          vec3 ss = normalize(vec3(dir.x, 0.0, dir.z));
          float toward = pow(max(dot(ss, normalize(uSun)), 0.0), 18.0);
          float glitter = toward * smoothstep(-0.12, 0.34, sandH) * (1.0 - smoothstep(60.0, 900.0, dist));
          gl_FragColor.rgb += uSunCol * glitter * 0.22;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, air, k);
          gl_FragColor.a = uCover;
        }`,
      );
  };
  const ground = new Mesh(tg, sand);
  ground.receiveShadow = !low;
  ground.frustumCulled = false;
  ground.renderOrder = -50;
  group.add(ground);

  // ------------------------------------------------------------ wind and dust
  const dustFade = { value: 0 };
  const windTime = { value: 0 };

  // Motes: fine dust in the air, in front of and behind everything.
  const MN = low ? 280 : 900;
  const mp = new Float32Array(MN * 3);
  const ms = new Float32Array(MN * 3);
  for (let k = 0; k < MN; k++) {
    mp.set([r(), r(), r()], k * 3);
    ms.set([r(), r(), r()], k * 3);
  }
  const mg = new BufferGeometry();
  mg.setAttribute("position", new BufferAttribute(mp, 3));
  mg.setAttribute("aSeed", new BufferAttribute(ms, 3));
  const moteMat = new ShaderMaterial({
    vertexShader: MOTE_VS,
    fragmentShader: MOTE_FS,
    uniforms: {
      uCam: camSite,
      uSun: skyU.uSun,
      uWind: { value: WIND.clone().multiplyScalar(3.4) },
      uTime: windTime,
      uPx: { value: 800 },
      uDpr: { value: 1 },
      uBox: { value: 34 },
      uColor: { value: new Color(1.0, 0.72, 0.46) },
      uFade: dustFade,
    },
    transparent: true,
    depthWrite: false,
    blending: 2, // additive
  });
  const motes = new Points(mg, moteMat);
  motes.frustumCulled = false;
  motes.renderOrder = 6;
  group.add(motes);

  // Veils: sand blown low along the ground, near and far.
  const veil = (n: number, box: number, hMin: number, hMax: number, lenMin: number, lenMax: number, thMin: number, thMax: number, speed: number, op: number, near: number, order: number) => {
    const g = new InstancedBufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = new Float32Array(n * 4);
    const B = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      const th = thMin + r() * r() * (thMax - thMin);
      A.set([r(), r(), hMin + r() * (hMax - hMin) + th * 0.75, lenMin + r() * (lenMax - lenMin)], k * 4);
      B.set([speed * (0.7 + r() * 0.8), th, r(), op * (0.45 + r() * 0.55)], k * 4);
    }
    g.setAttribute("aA", new InstancedBufferAttribute(A, 4));
    g.setAttribute("aB", new InstancedBufferAttribute(B, 4));
    g.instanceCount = n;
    const mat = new ShaderMaterial({
      vertexShader: VEIL_VS,
      fragmentShader: VEIL_FS,
      uniforms: {
        uCam: camSite,
        uWind: { value: WIND },
        uTime: windTime,
        uBox: { value: box },
        uNear: { value: near },
        tCloud: { value: o.cloudTex },
        uColor: { value: new Color(0.9, 0.5, 0.27) },
        uFade: dustFade,
      },
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      premultipliedAlpha: true,
      side: DoubleSide,
    });
    const m = new Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = order;
    group.add(m);
    return mat;
  };
  const veils = [
    veil(low ? 26 : 70, 70, 0.0, 0.12, 2.5, 9, 0.05, 0.4, 3.2, 0.34, 2.0, 7), // close, ankle high
    veil(low ? 18 : 44, 340, 0.0, 0.5, 14, 46, 0.35, 2.4, 5.0, 0.3, 18, 4), // across the plain
    veil(low ? 10 : 22, 1900, 0.0, 6.0, 90, 330, 5, 26, 9.0, 0.34, 120, 3), // far off, along the horizon
  ];

  // A dust devil, far out on the left of the wide shot.
  const DN = low ? 22 : 54;
  const dg = new InstancedBufferGeometry();
  dg.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  dg.setIndex([0, 1, 2, 0, 2, 3]);
  const dp = new Float32Array(DN * 3);
  for (let k = 0; k < DN; k++) dp.set([k / (DN - 1), r() * Math.PI * 2, 0.7 + r() * 0.6], k * 3);
  dg.setAttribute("aP", new InstancedBufferAttribute(dp, 3));
  dg.instanceCount = DN;
  const devilX = -300;
  const devilZ = -620;
  const devilMat = new ShaderMaterial({
    vertexShader: DEVIL_VS,
    fragmentShader: DEVIL_FS,
    uniforms: {
      uBase: { value: new Vector3(devilX, groundHeight(devilX, devilZ), devilZ) },
      uTime: windTime,
      uHeight: { value: 76 },
      tCloud: { value: o.cloudTex },
      uColor: { value: new Color(0.62, 0.3, 0.16) },
      uFade: dustFade,
    },
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
  });
  const devil = new Mesh(dg, devilMat);
  devil.frustumCulled = false;
  devil.renderOrder = 2;
  group.add(devil);

  // ------------------------------------------------------------ camera path
  const site = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const gh = (x: number, z: number) => groundHeight(x, z);
  const widePos = site(WIDE_POS.x, gh(WIDE_POS.x, WIDE_POS.z) + 0.95, WIDE_POS.z);
  const wideDir = site(Math.sin(WIDE_YAW) * Math.cos(WIDE_PITCH), Math.sin(WIDE_PITCH), -Math.cos(WIDE_YAW) * Math.cos(WIDE_PITCH));
  const wideLook = widePos.clone().addScaledVector(wideDir, 60);
  const standY = gh(STAND.x, STAND.z);
  const touchPos = site(STAND.x - 1.5, standY + 0.82, STAND.z + 4.6);
  const touchLook = site(STAND.x - 0.6, standY + 0.72, STAND.z);
  const fly = new CatmullRomCurve3([EXIT_POS, site(0.6, 3.6, 10.5), site(0.8, 8.5, -4), site(0.4, 7.5, -34), site(0.1, 3.0, -62), widePos], false, "centripetal");
  const flyLook = new CatmullRomCurve3([EXIT_LOOK, site(0.2, -2, -50), site(0.2, -4, -70), site(0.1, 2, -100), wideLook.clone().add(site(0, 0, -6)), wideLook], false, "centripetal");
  const approach = new CatmullRomCurve3([widePos, site(-0.3, standY + 1.1, -100), site(-1.4, standY + 1.0, -114), touchPos], false, "centripetal");
  const approachLook = new CatmullRomCurve3([wideLook, site(-1.1, standY + 3.0, -140), site(-0.9, standY + 1.1, -128), touchLook], false, "centripetal");
  const landedLook = site(0, 2.0, -60);
  const landedPos = site(-6.5, l.stand + 1.9, 14);
  const tmp = new Vector3();

  function shot(s: number, portrait: boolean, out: SurfaceShot) {
    const fovExit = 30;
    const fovWide = 34;
    const fovTouch = 30;
    if (s <= 1) {
      out.pos.copy(landedPos).lerp(EXIT_POS, s);
      out.look.copy(landedLook).lerp(EXIT_LOOK, s);
      out.fov = lerp(42, fovExit, s);
      out.parallax = 0.16;
    } else if (s <= 2) {
      const t = s - 1;
      fly.getPoint(t, out.pos);
      flyLook.getPoint(t, out.look);
      out.fov = lerp(fovExit, fovWide, t);
      out.parallax = lerp(0.16, 0.3, t);
    } else {
      const t = Math.min(1, s - 2);
      approach.getPoint(t, out.pos);
      approachLook.getPoint(t, out.look);
      out.fov = lerp(fovWide, fovTouch, t);
      out.parallax = lerp(0.3, 0.06, t);
    }
    if (portrait) out.fov += 16;
    out.pos.applyMatrix4(group.matrixWorld);
    out.look.applyMatrix4(group.matrixWorld);
    return out;
  }

  // ------------------------------------------------------------ the light through the evening
  const sunWorld = new Vector3();
  const sunColor = new Color();
  const skyLight = new Color();
  const groundLight = new Color();
  const hazeColor = new Color();
  const c1 = new Color();
  const c2 = new Color();
  // Colour keys for dusk 0 (golden hour), 0.5 (the sun on the horizon), 1 (last light).
  const key3 = (t: number, a: number[], b: number[], c: number[], out: Color) => {
    if (t < 0.5) {
      c1.setRGB(a[0], a[1], a[2]);
      c2.setRGB(b[0], b[1], b[2]);
      return out.copy(c1).lerp(c2, t * 2);
    }
    c1.setRGB(b[0], b[1], b[2]);
    c2.setRGB(c[0], c[1], c[2]);
    return out.copy(c1).lerp(c2, t * 2 - 1);
  };

  function update(f: SurfaceInput) {
    const { time, dt, camera, s } = f;
    cover.value = f.cover;
    uTime.value = time;
    windTime.value += dt * (f.reduced ? 0.25 : 1);
    group.visible = f.cover > 0.001;
    if (!group.visible) return;

    camSite.value.copy(camera.position).sub(l.pad).applyQuaternion(inv);
    dome.position.copy(camSite.value);
    moteMat.uniforms.uPx.value = f.pxScale;
    moteMat.uniforms.uDpr.value = f.dpr;
    dustFade.value = f.cover;

    // The evening moves on with the story: golden at the lander, sun on the
    // horizon for the helmet, the last light and the first stars for the touch.
    const dusk = clamp(s < 2 ? lerp(0.1, 0.5, smooth(0, 2, s)) : lerp(0.5, 0.95, smooth(2, 3, s)), 0, 1);
    const el = lerp(0.1, -0.006, smooth(0.05, 0.98, dusk));
    const az = (8 * Math.PI) / 180;
    sun.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    sunWorld.copy(sun).applyQuaternion(l.quat);

    key3(dusk, [1.16, 0.4, 0.075], [1.2, 0.33, 0.045], [0.8, 0.19, 0.04], skyU.uHorSun.value);
    key3(dusk, [0.6, 0.22, 0.08], [0.52, 0.16, 0.055], [0.2, 0.06, 0.05], skyU.uHorAway.value);
    key3(dusk, [0.88, 0.3, 0.06], [0.82, 0.235, 0.045], [0.36, 0.09, 0.045], skyU.uMid.value);
    key3(dusk, [0.56, 0.17, 0.065], [0.46, 0.115, 0.055], [0.075, 0.026, 0.05], skyU.uTop.value);
    key3(dusk, [0.7, 0.3, 0.07], [0.72, 0.25, 0.04], [0.5, 0.14, 0.03], skyU.uSunCol.value);
    domeMat.uniforms.uStars.value = smooth(0.55, 0.95, dusk);

    key3(dusk, [3.4, 1.9, 1.0], [3.2, 1.5, 0.72], [1.5, 0.6, 0.3], sunColor);
    key3(dusk, [0.86, 0.46, 0.27], [0.74, 0.34, 0.2], [0.26, 0.12, 0.11], skyLight);
    key3(dusk, [0.2, 0.1, 0.055], [0.16, 0.07, 0.04], [0.05, 0.022, 0.016], groundLight);
    hazeColor.copy(skyU.uHorSun.value).lerp(skyU.uMid.value, 0.5).multiplyScalar(0.8);
    sandU.uAmbient.value.copy(skyLight).multiplyScalar(0.3);

    // The dust takes the light of the hour.
    const lit = 0.32 + 0.68 * (1 - dusk);
    for (const m of veils) m.uniforms.uColor.value.setRGB(0.95, 0.52, 0.27).multiplyScalar(lit);
    devilMat.uniforms.uColor.value.setRGB(0.62, 0.3, 0.16).multiplyScalar(lit);
    moteMat.uniforms.uColor.value.setRGB(1.0, 0.72, 0.46).multiplyScalar(lit);
    tmp.copy(sun);
  }

  return { group, sunWorld, sunColor, skyLight, groundLight, hazeColor, shot, update };
}
