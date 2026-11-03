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
  PlaneGeometry,
  Points,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector3,
  Vector4,
  type PerspectiveCamera,
  type Texture,
} from "three";
import type { Landing } from "./path";
import { PlateBank, type PlateMeta } from "./plates";
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

/** Ground height in site space: broad soft swells on the plain, long dunes beyond it, low ridges far off. */
export function groundHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  const toStand = Math.hypot(x - STAND.x, z - STAND.z);
  const n = fbm2(x * 0.0016, z * 0.0016);
  const w = x * 0.0075 + z * 0.0031 + n * 5.5;
  const crest = Math.pow(0.5 + 0.5 * Math.sin(w), 3);
  // A second set of dunes at another angle, so no two ridges run the same way.
  const n2 = fbm2(x * 0.0009 + 11.0, z * 0.0009 + 4.0);
  const w2 = x * -0.0031 + z * 0.0062 + n2 * 7.0;
  const crest2 = Math.pow(0.5 + 0.5 * Math.sin(w2), 2.4);
  let h = (crest * (0.8 + 5.8 * n) + crest2 * (0.5 + 7.5 * n2)) * smooth(30, 300, r) * smooth(30, 160, toStand);
  // Soft swells across the plain, flat only right where the lander and he stand.
  const swell = fbm2(x * 0.0093 + 2.3, z * 0.0141 + 8.1) - 0.5;
  h += swell * 3.0 * smooth(6, 34, r) * smooth(14, 44, toStand);
  // Low ridges that break the far horizon.
  const far = smooth(500, 2200, r);
  if (far > 0) h += far * (Math.pow(fbm2(x * 0.0009 + 3.1, z * 0.0009 + 7.7), 2.2) * 70 + crest * 8);
  return h - (r * r) / (2 * 90000);
}

/** The ground baked to two grids, one fine around the story and one for the far land. */
function bakeGround(low: boolean) {
  const N = low ? 128 : 256;
  const mk = (cx: number, cz: number, half: number) => {
    const d = new Float32Array((N + 1) * (N + 1));
    const cell = (half * 2) / N;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) d[j * (N + 1) + i] = groundHeight(cx - half + i * cell, cz - half + j * cell);
    return { d, cx, cz, half, cell };
  };
  const fine = mk(0, -110, 210);
  const wide = mk(0, 0, 6400);
  const at = (g: typeof fine, x: number, z: number) => {
    const u = clamp((x - g.cx + g.half) / g.cell, 0, N - 0.001);
    const v = clamp((z - g.cz + g.half) / g.cell, 0, N - 0.001);
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    const m = N + 1;
    const a = g.d[j * m + i];
    const b = g.d[j * m + i + 1];
    const c = g.d[(j + 1) * m + i];
    const e = g.d[(j + 1) * m + i + 1];
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + e) * fu * fv;
  };
  return (x: number, z: number) => (Math.abs(x) < 200 && Math.abs(z + 110) < 200 ? at(fine, x, z) : at(wide, x, z));
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
      const u = i / size;
      const v = j / size;
      data[k + 3] = clamp((pn(u, v, 5, 7) * 0.6 + pn(u, v, 13, 8) * 0.3 + pn(u, v, 29, 9) * 0.1) * 255, 0, 255);
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

// ------------------------------------------------------------------ moons

/** A moon's surface, baked once: RG hold the slope, B the brightness. Maria, craters and rays. */
function moonTexture(w: number, seed: number): DataTexture {
  const h = w >> 1;
  const hgt = new Float32Array(w * h);
  const alb = new Float32Array(w * h);
  const r = rng(seed * 991 + 7);
  const TAU = Math.PI * 2;
  // Unit sphere direction per texel, so nothing pinches at the poles.
  const dx = new Float32Array(w * h);
  const dy = new Float32Array(w * h);
  const dz = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const th = ((j + 0.5) / h) * Math.PI;
    for (let i = 0; i < w; i++) {
      const ph = ((i + 0.5) / w) * TAU;
      const k = j * w + i;
      dx[k] = Math.sin(th) * Math.cos(ph);
      dy[k] = Math.cos(th);
      dz[k] = Math.sin(th) * Math.sin(ph);
      // Broad dark seas and fine mottling.
      const n = fbm2(dx[k] * 1.7 + dz[k] * 1.1 + seed, dy[k] * 1.9 + dz[k] * 0.8 + seed * 2);
      const f = fbm2(dx[k] * 9 + dy[k] * 4 + seed, dz[k] * 9 - dy[k] * 3);
      alb[k] = 0.56 + 0.2 * f - 0.14 * smooth(0.4, 0.66, n);
      hgt[k] = f * 0.03;
    }
  }
  const CR = Math.round(40 + (w / 512) * 50);
  for (let c = 0; c < CR; c++) {
    const u = r() * 2 - 1;
    const a = r() * TAU;
    const s = Math.sqrt(1 - u * u);
    const cx = s * Math.cos(a);
    const cy = u;
    const cz = s * Math.sin(a);
    const big = r() > 0.94;
    const rad = big ? 0.1 + r() * 0.14 : 0.012 + Math.pow(r(), 2.6) * 0.09;
    const depth = rad * 0.5;
    const cosR = Math.cos(rad * 2.6);
    const bright = 0.05 + r() * 0.1;
    for (let k = 0; k < w * h; k++) {
      const dot = dx[k] * cx + dy[k] * cy + dz[k] * cz;
      if (dot < cosR) continue;
      const q = Math.acos(Math.min(1, dot)) / rad;
      if (q < 1) {
        hgt[k] += -depth * (1 - q * q) + depth * 0.5 * Math.pow(q, 8);
        alb[k] -= 0.05 * (1 - q);
      } else if (q < 1.5) {
        hgt[k] += depth * 0.5 * (1 - (q - 1) * 2);
        alb[k] += bright * 0.6 * (1 - (q - 1) * 2);
      } else {
        alb[k] += (big ? bright : bright * 0.3) * (1 - (q - 1.5) / 1.1) * 0.5;
      }
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const hl = hgt[j * w + ((i + w - 1) % w)];
      const hr = hgt[j * w + ((i + 1) % w)];
      const hd = hgt[Math.max(0, j - 1) * w + i];
      const hu = hgt[Math.min(h - 1, j + 1) * w + i];
      const scale = w / 4;
      data[k * 4] = clamp(128 + (hl - hr) * scale * 127, 0, 255);
      data[k * 4 + 1] = clamp(128 + (hd - hu) * scale * 127, 0, 255);
      data[k * 4 + 2] = clamp(alb[k] * 255, 0, 255);
      data[k * 4 + 3] = 255;
    }
  }
  const t = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType);
  t.wrapS = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
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
  uniform float uBandW;
`;

/** The sky's colour in direction d, shared with the ground so the two meet at the horizon. */
const SKY_FN = /* glsl */ `
  vec3 skyColor(vec3 d) {
    float y = max(d.y, 0.0);
    vec2 hd = normalize(d.xz + 1e-5);
    vec2 hs = normalize(uSun.xz + 1e-5);
    float az = 0.5 + 0.5 * dot(hd, hs);
    vec3 hor = mix(uHorAway, uHorSun, pow(az, 1.6));
    vec3 c = mix(hor, uMid, smoothstep(0.0, uBandW, y));
    c = mix(c, uTop, smoothstep(0.12, 0.7, y));
    // A thin band of haze lying on the horizon.
    c = mix(c, hor * vec3(0.92, 0.82, 0.7), exp(-y * 46.0) * 0.55);
    float mu = clamp(dot(d, uSun), 0.0, 1.0);
    c += uSunCol * (0.12 * pow(mu, 6.0) + 0.3 * pow(mu, 48.0) + 0.55 * pow(mu, 420.0));
    return c;
  }
`;

const MOON_VS = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vCenter;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vView = cameraPosition - wp.xyz;
    vCenter = modelMatrix[3].xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const MOON_FS = /* glsl */ `
  uniform sampler2D tMoon;
  uniform vec3 uSunW;
  uniform float uSoft;
  uniform float uCover;
  uniform vec3 uArc;
  uniform vec3 uShade;
  // x crescent softness, y arc strength, z rim softness, w how far the dark side reaches
  uniform vec4 uLook;
  uniform float uBody;
  uniform float uK;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vCenter;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vView);
    // Both moons are lit by the one sun. A moon close to the sun in the sky is
    // lit from behind and shows a thin arc; further from it the arc fills out.
    // The apparent angle is stretched so the phases read at this scale, but
    // the side that is lit always faces the sun's true position.
    vec3 d = normalize(vCenter);
    float cosE = clamp(dot(d, uSunW), -1.0, 1.0);
    float e = acos(cosE);
    vec3 t = normalize(uSunW - d * cosE + vec3(1e-5));
    float ph = min(e * 3.2, 2.6);
    vec3 L = d * cos(ph) + t * sin(ph);
    float lit = dot(n, L);
    float arc = pow(smoothstep(0.0, uLook.x, lit), 1.25);
    float hint = texture2D(tMoon, vUv, 1.5 + uSoft * 3.0).z;
    arc *= 0.9 + (hint - 0.5) * 0.3;
    // No hard outline: the disc thins out toward its rim, and its night side
    // fades away from the arc into the sky.
    float facing = max(dot(n, v), 0.0);
    float soft = uLook.z + uSoft * 0.5;
    float edge = smoothstep(0.0, soft, facing);
    float night = uBody * smoothstep(-uLook.w, 0.1, lit) * edge;
    float a = max(arc * uLook.y * smoothstep(0.0, soft * 0.6, facing), night) * uCover * uK;
    vec3 col = mix(uShade, uArc, smoothstep(0.0, 0.25, arc));
    gl_FragColor = vec4(col, a);
  }
`;

const DOME_VS = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DOME_FS = (layers: number) => /* glsl */ `
  #define STAR_LAYERS ${layers}
  #define DUST_LAYERS ${layers >= 4 ? 3 : 2}
  ${SKY_UNIFORMS}
  uniform float uCover;
  uniform float uStars;
  uniform float uTime;
  uniform float uSunCos;
  uniform vec3 uRingN;
  uniform vec3 uRingA;
  uniform vec3 uRingB;
  uniform float uRing;
  uniform float uMilky;
  uniform vec3 uGalN;
  uniform vec3 uGalA;
  uniform vec3 uGalB;
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
    // A faint ring around the planet, a thin arc high across the sky, with
    // something catching the light as it travels along it.
    float rr = dot(d, uRingN);
    float ringFade = smoothstep(0.015, 0.16, yy);
    float ringW = abs(rr + 0.012);
    float ring = smoothstep(0.016, 0.0, ringW) * (0.45 + 0.55 * sin(rr * 620.0) * sin(rr * 240.0 + 1.0));
    ring += smoothstep(0.0028, 0.0, abs(rr - 0.006)) * 0.9;
    float along = atan(dot(d, uRingA), dot(d, uRingB));
    float glint = pow(0.5 + 0.5 * sin(along * 26.0 - uTime * 0.05), 900.0) * smoothstep(0.004, 0.0, abs(rr - 0.006));
    c += (mix(vec3(0.42, 0.46, 0.6), vec3(1.0, 0.6, 0.32), uRing * uRing) * max(ring, 0.0) * 0.075 + vec3(1.1, 0.85, 0.6) * glint * 0.35) * ringFade * uRing;
    // The sun: low, dim, a disc you could almost look at. It reddens toward the horizon.
    float mu = dot(d, uSun);
    float disc = smoothstep(uSunCos - 0.0011, uSunCos + 0.0006, mu);
    float limb = smoothstep(uSunCos, 1.0, mu);
    // Thin bands of dust cross it, and low down the haze takes it altogether.
    vec2 dp = vec2(atan(d.x, -d.z) * 7.0 + uTime * 0.006, d.y * 90.0);
    float streak = vnoise(dp) * 0.6 + vnoise(dp * vec2(2.1, 2.7) + 3.0) * 0.4;
    float swallow = smoothstep(0.0, 0.085, d.y);
    vec3 sunDisc = mix(vec3(0.96, 0.33, 0.06), vec3(1.26, 0.58, 0.16), smoothstep(0.02, 0.14, d.y)) * (0.84 + 0.2 * pow(limb, 0.5));
    c = mix(c, sunDisc, disc * (0.28 + 0.62 * swallow) * (0.72 + 0.28 * smoothstep(0.34, 0.66, streak)));
    // The Milky Way: a band of light with dust lanes, warmer at the core.
    float bandK = 0.0;
    if (uMilky > 0.001 && d.y > -0.05) {
      float g = dot(d, uGalN);
      float lon = atan(dot(d, uGalA), dot(d, uGalB));
      vec2 wp = vec2(lon * 2.2, g * 6.0);
      float w1 = vnoise(wp + 11.0) - 0.5;
      float w2 = vnoise(wp * 2.3 + 4.0) - 0.5;
      float gg = g + w1 * 0.05 + w2 * 0.018;
      float core = exp(-lon * lon / 0.5);
      float body = exp(-gg * gg / (0.012 + 0.032 * core));
      float halo = exp(-g * g / 0.07);
      // Dust lanes: dark, branching, fractal, thickest along the centre line.
      vec2 lp = vec2(lon * 11.0 + w2 * 3.0, gg * 34.0 + w1 * 2.0);
      float n1 = vnoise(lp);
      float n2 = vnoise(lp * 2.1 + 3.7);
      float n3 = vnoise(lp * 4.3 + 1.3);
      float n4 = vnoise(lp * 8.9 + 8.1);
      float lanes = n1 * 0.46 + n2 * 0.28 + n3 * 0.17 + n4 * 0.09;
      float lane = smoothstep(0.43, 0.6, lanes) * exp(-gg * gg / 0.009);
      // Soft mottling of unresolved stars.
      vec2 cp = vec2(lon * 26.0, g * 64.0);
      float cloud = vnoise(cp + 5.0) * 0.5 + vnoise(cp * 2.3 + 2.0) * 0.3 + vnoise(cp * 5.1 + 9.0) * 0.2;
      float dens = body * (0.5 + 0.9 * core) * (0.45 + 1.1 * cloud);
      float glow = (dens + halo * 0.05) * (1.0 - lane * 0.9);
      vec3 mw = mix(vec3(0.5, 0.58, 0.86), vec3(0.98, 0.86, 0.72), core * 0.85);
      // A little colour here and there: faint rose knots and blue edges.
      float tint = vnoise(vec2(lon * 13.0, g * 40.0) + 21.0);
      mw = mix(mw, vec3(0.95, 0.5, 0.6), smoothstep(0.66, 0.86, tint) * 0.42 * body);
      mw = mix(mw, vec3(0.42, 0.6, 1.0), smoothstep(0.6, 0.86, 1.0 - tint) * 0.32);
      float above = smoothstep(-0.02, 0.1, d.y);
      c += mw * glow * 0.15 * uMilky * above;
      // Star dust: thousands of tiny points, thick where the band is thick and gone in the lanes.
      float dustK = clamp(dens * 1.5 + halo * 0.12, 0.0, 1.0) * (1.0 - lane * 0.95);
      for (int k = 0; k < DUST_LAYERS; k++) {
        float scale = 760.0 + float(k) * 520.0;
        vec3 did = floor(d * scale);
        float dh = hash13(did + float(k) * 41.0);
        if (dh > 0.995 - dustK * 0.26) {
          float pw2 = hash13(did + 7.7);
          c += mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.86, 0.68), hash13(did + 3.3)) * (0.02 + pw2 * pw2 * 0.34) * uMilky * above;
        }
      }
      bandK = clamp(body * (1.0 - lane * 0.9) + halo * 0.15, 0.0, 1.0) * uMilky;
    }
    // Stars: the first ones through the upper sky, then all of them, thick along the band.
    if (uStars > 0.001 && yy > 0.004) {
      float fade = smoothstep(0.004, 0.09, yy) * mix(smoothstep(0.1, 0.5, yy), 1.0, smoothstep(0.5, 1.0, uStars));
      for (int i = 0; i < STAR_LAYERS; i++) {
        float fi = float(i);
        float dens = 150.0 + fi * 140.0;
        vec3 sd = d * dens;
        vec3 id = floor(sd);
        float h = hash13(id + fi * 17.0);
        float thr = 0.984 - fi * 0.006 - bandK * 0.13;
        if (h > thr) {
          vec3 q = fract(sd) - 0.5;
          vec3 off = vec3(hash13(id + 3.1), hash13(id + 5.7), hash13(id + 9.3)) - 0.5;
          float sz = 0.34 - fi * 0.04;
          float st = smoothstep(sz, 0.0, length(q - off * 0.3));
          float pw = (h - thr) / (1.0 - thr);
          float tw = 0.8 + 0.2 * sin(uTime * (1.0 + h * 4.0) + h * 60.0);
          vec3 tintS = mix(vec3(0.74, 0.82, 1.0), vec3(1.0, 0.82, 0.62), hash13(id + 13.7));
          c += tintS * st * st * tw * (0.07 + pw * pw * 2.2) * uStars * fade * (fi > 1.5 ? 0.6 : 1.0);
        }
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
const EXIT_POS = new Vector3(0, 1.3, 20);
const EXIT_LOOK = new Vector3(-9.7, 4.6, -60);
const WIDE_POS = new Vector3(0, 0, -80); // height comes from the ground below
const WIDE_YAW = (-8 * Math.PI) / 180;
const WIDE_PITCH = (6.4 * Math.PI) / 180;
const MOON_ANCHOR = new Vector3(0, 0, -80);
/** The ramp in the first steps: where he starts from, how far it drops, and his distance from the camera at the start. */
const HATCH_Z = 1.9;
const RAMP_FOOT_Z = 4.25;
const RAMP_DROP = 0.91;
const EXIT_D0 = 18.1;
/** One source pixel of the helmet plate, in units: he stands about 1.35 tall. */
const HELMET_PU = 1.35 / 700;
/** One source pixel of the hand plate: a macro frame about 23 cm tall. */
const HAND_PU = 0.303 / 1080;
/** Seconds for the hand to come down to the leaf. */
const HAND_REACH = 2.4;

const CARD_VS = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = vec2(uv.x, 1.0 - uv.y);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const CARD_FS = /* glsl */ `
  uniform sampler2D tMap;
  uniform float uOp;
  uniform vec3 uShadow;
  uniform vec3 uHigh;
  uniform float uKeep;
  uniform float uGain;
  uniform vec3 uLampCol;
  uniform vec3 uLampWorld;
  uniform float uLampR;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vec4 t = texture2D(tMap, vUv);
    float a = t.a * uOp;
    if (a < 0.004) discard;
    vec3 c = t.rgb;
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    // The shadows take the colour of the sky; what stays of the plate's own
    // warm light is what the hour still has.
    vec3 relit = l * uShadow * 1.2;
    vec3 kept = c * uHigh;
    vec3 col = mix(relit, kept, uKeep * smoothstep(0.015, 0.2, l)) * uGain;
    // The small lamp lights what is near it.
    vec3 dl = vWorld - uLampWorld;
    float lamp = exp(-dot(dl, dl) / (uLampR * uLampR));
    col += (l * 2.2 + 0.018) * uLampCol * lamp;
    gl_FragColor = vec4(col, a);
  }
`;

const CARD_DEPTH_FS = /* glsl */ `
  uniform sampler2D tMap;
  varying vec2 vUv;
  void main() {
    if (texture2D(tMap, vUv).a < 0.6) discard;
    gl_FragColor = vec4(0.0);
  }
`;

const SAP_VS = /* glsl */ `
  uniform float uTime;
  uniform float uTouch;
  attribute float aBend;
  varying vec3 vN;
  varying vec3 vP;
  varying float vT;
  void main() {
    vec3 p = position;
    float k = aBend;
    // Wind, in gusts, and the small dip when the finger touches, springing back.
    float gust = sin(uTime * 1.1) * 0.5 + sin(uTime * 2.7 + 1.0) * 0.3 + sin(uTime * 6.1) * 0.08;
    float bend = k * k * (0.0065 + 0.0065 * gust);
    p.x += bend;
    p.z += k * k * 0.002 * sin(uTime * 1.7 + 2.0);
    float dip = uTouch * uTouch * sin(uTouch * 18.0) * 0.0035 + uTouch * 0.003;
    p.y -= k * k * dip;
    p.x -= k * k * uTouch * 0.002;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vP = (w.xyz);
    vN = normalize(mat3(modelMatrix) * normal);
    vT = k;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const SAP_FS = /* glsl */ `
  uniform vec3 uAmb;
  uniform vec3 uKey;
  uniform vec3 uSunDir;
  uniform vec3 uLampCol;
  uniform vec3 uLampSite;
  varying vec3 vN;
  varying vec3 vP;
  varying float vT;
  void main() {
    vec3 green = mix(vec3(0.16, 0.2, 0.05), vec3(0.3, 0.42, 0.09), vT);
    vec3 n = normalize(vN);
    float nl = abs(dot(n, normalize(uSunDir)));
    vec3 col = green * (uAmb + uKey * (0.35 + nl));
    // Light through the leaves from behind.
    col += green * uKey * 0.9 * vT;
    // The small lamp, close and warm.
    col += green * uLampCol * 3.2;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** A seedling, in its own space: base at the origin, y up, two small leaves at the top. */
function saplingGeometry(H: number) {
  const P: number[] = [];
  const N: number[] = [];
  const B: number[] = [];
  const I: number[] = [];
  const add = (x: number, y: number, z: number, nx: number, ny: number, nz: number, b: number) => {
    P.push(x, y, z);
    N.push(nx, ny, nz);
    B.push(b);
    return P.length / 3 - 1;
  };
  // Stem: a thin tapered tube with a slight lean.
  const STEM = 8;
  const SIDES = 5;
  for (let i = 0; i <= STEM; i++) {
    const t = i / STEM;
    const lean = t * t * H * 0.1;
    const rad = lerp(0.0014, 0.0007, t);
    for (let j = 0; j < SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2;
      add(Math.cos(a) * rad + lean, t * H * 0.82, Math.sin(a) * rad, Math.cos(a), 0, Math.sin(a), t * 0.86);
    }
  }
  for (let i = 0; i < STEM; i++) {
    for (let j = 0; j < SIDES; j++) {
      const a = i * SIDES + j;
      const b = i * SIDES + ((j + 1) % SIDES);
      I.push(a, b, a + SIDES, b, b + SIDES, a + SIDES);
    }
  }
  // Two leaves, opposite each other, arching out from the top of the stem.
  const leaf = (dirX: number, dirZ: number, len: number, wid: number, rise: number) => {
    const RES = 8;
    const start = P.length / 3;
    const topX = H * 0.1;
    for (let i = 0; i <= RES; i++) {
      const t = i / RES;
      const along = t * len;
      const w = Math.sin(Math.PI * Math.pow(t, 0.8)) * wid * (1 - t * 0.2);
      const y = H * 0.82 + rise * Math.sin(t * Math.PI * 0.62) * len - t * t * len * 0.24;
      for (const side of [-1, 0, 1]) {
        const cross = side * w;
        const cup = (1 - Math.abs(side)) * -w * 0.22;
        add(topX + dirX * along + -dirZ * cross * 0.72, y + cup + side * w * 0.62, dirZ * along + dirX * cross * 0.72, 0, 1, 0, 0.86 + t * 0.14);
      }
    }
    for (let i = 0; i < RES; i++) {
      for (let j = 0; j < 2; j++) {
        const a = start + i * 3 + j;
        I.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      }
    }
  };
  leaf(0.94, 0.34, H * 0.46, H * 0.2, 0.5);
  leaf(-0.92, -0.3, H * 0.4, H * 0.18, 0.6);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(P), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(N), 3));
  g.setAttribute("aBend", new BufferAttribute(new Float32Array(B), 1));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

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
  /** Landing phase 0..1 (touchdown at 0.84). */
  land: number;
}

export interface Surface {
  group: Group;
  /** 1 to 0 as the ground goes out of focus in the closeup: softens the moons. */
  setSoft(v: number): void;
  /** Unit vector toward the sun, in world space. */
  sunWorld: Vector3;
  sunColor: Color;
  /** How the sky should light the craft. */
  skyLight: Color;
  groundLight: Color;
  /** Colour for the scene's fog. */
  hazeColor: Color;
  dispose(): void;
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
    uBandW: { value: 0.16 },
  };
  const cover = { value: 0 };
  const camSite = { value: new Vector3() };
  const uTime = { value: 0 };

  // ------------------------------------------------------------ sky dome
  // The plane of the ring, tilted so the arc crosses the upper sky on the sun's side.
  const ringN = new Vector3(0.14, 0.92, 0.37).normalize();
  const ringA = new Vector3(1, 0, 0).addScaledVector(ringN, -ringN.x).normalize();
  const ringB = new Vector3().crossVectors(ringN, ringA);
  // The plane of the galaxy: it climbs from low on the left to high on the right
  // of the closing shot, its core above the hand, away from the words.
  const skyDir = (azD: number, elD: number) => {
    const a = (azD * Math.PI) / 180;
    const e = (elD * Math.PI) / 180;
    return new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
  };
  const galFrom = skyDir(-14, 0);
  const galCore = skyDir(11, 23);
  const galN = new Vector3().crossVectors(galFrom, galCore).normalize();
  const galB = galCore.clone().addScaledVector(galN, -galCore.dot(galN)).normalize();
  const galA = new Vector3().crossVectors(galN, galB).normalize();
  const domeMat = new ShaderMaterial({
    vertexShader: DOME_VS,
    fragmentShader: DOME_FS(low ? 2 : 4),
    uniforms: {
      ...skyU,
      uCover: cover,
      uStars: { value: 0 },
      uTime,
      uSunCos: { value: Math.cos((2.6 * Math.PI) / 180) },
      uRingN: { value: ringN },
      uRingA: { value: ringA },
      uRingB: { value: ringB },
      uRing: { value: 1 },
      uMilky: { value: 0 },
      uGalN: { value: galN },
      uGalA: { value: galA },
      uGalB: { value: galB },
    },
    side: 1, // back side
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const dome = new Mesh(new SphereGeometry(8000, low ? 32 : 48, low ? 20 : 32), domeMat);
  dome.frustumCulled = false;
  dome.renderOrder = -60;
  group.add(dome);

  // ------------------------------------------------------------ moons
  // Two real spheres, wide apart, each with its own crescent, tilt, fade and
  // tint. The large far one is soft and thin; the small near one is crisper
  // and moves more with the camera. Both stay right of the words.
  const moonSoft = { value: 0 };
  const moonSun = { value: new Vector3() };
  const moon = (o: { radius: number; dist: number; az: number; el: number; seed: number; tex: number; drift: number; body: number; look: [number, number, number, number]; pale: number; shade: number }) => {
    const map = moonTexture(o.tex, o.seed);
    const uArc = { value: new Color() };
    const uShade = { value: new Color() };
    const uK = { value: 1 };
    const mat = new ShaderMaterial({
      vertexShader: MOON_VS,
      fragmentShader: MOON_FS,
      uniforms: {
        tMoon: { value: map },
        uSunW: moonSun,
        uSoft: moonSoft,
        uCover: cover,
        uBody: { value: o.body },
        uK,
        uArc,
        uShade,
        uLook: { value: new Vector4(o.look[0], o.look[1], o.look[2], o.look[3]) },
      },
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const mesh = new Mesh(new SphereGeometry(o.radius, low ? 48 : 80, low ? 32 : 56), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -58;
    mesh.rotation.set(0.5 + o.seed, o.seed * 2.1, 0.3);
    group.add(mesh);
    return { mesh, map, mat, uArc, uShade, uK, pale: o.pale, shade: o.shade, dist: o.dist, az: (o.az * Math.PI) / 180, el: (o.el * Math.PI) / 180, drift: o.drift };
  };
  const moonList = [
    // Near: larger, a little crisper. Further from the sun in the sky, so its arc is fuller.
    moon({ radius: 62, dist: 700, az: -2.5, el: 16.5, seed: 7, tex: low ? 128 : 256, drift: 0.0009, body: 0.2, look: [0.3, 0.72, 0.14, 0.5], pale: 0.82, shade: 0.66 }),
    // Far: smaller, hazier, close to the sun, so only a thin arc shows.
    moon({ radius: 72, dist: 1650, az: 14.5, el: 9.5, seed: 19, tex: low ? 96 : 128, drift: -0.0016, body: 0.1, look: [0.22, 0.42, 0.32, 0.9], pale: 0.56, shade: 0.8 }),
  ];

  // ------------------------------------------------------------ ground
  const NR = low ? 92 : 170;
  const NS = low ? 120 : 240;
  const RK = low ? 0.1 : 0.0535;
  const VN = (NR + 1) * NS + 1;
  const pos = new Float32Array(VN * 3);
  const nor = new Float32Array(VN * 3);
  const shadeA = new Float32Array(VN);
  const H = 0.6;
  const baked = bakeGround(low);
  // How far ahead the land blocks a low sun: the long shadows behind each dune.
  const sunAz = (8 * Math.PI) / 180;
  const sdx = Math.sin(sunAz);
  const sdz = -Math.cos(sunAz);
  const SUN_TAN = Math.tan(0.07);
  const setVertex = (k: number, x: number, z: number) => {
    const e = Math.max(0.5, Math.hypot(x, z) * 0.012);
    const h0 = baked(x, z);
    const nx = -(baked(x + e, z) - h0) / e;
    const nz = -(baked(x, z + e) - h0) / e;
    const len = Math.hypot(nx, 1, nz);
    pos.set([x, h0, z], k * 3);
    nor.set([nx / len, 1 / len, nz / len], k * 3);
    let top = -1;
    let t = 3;
    for (let q = 0; q < 12; q++) {
      const sl = (baked(x + sdx * t, z + sdz * t) - h0) / t;
      if (sl > top) top = sl;
      t *= 1.55;
    }
    shadeA[k] = 1 - smooth(SUN_TAN - 0.012, SUN_TAN + 0.03, top);
  };
  setVertex(0, 0, 0);
  for (let i = 0; i <= NR; i++) {
    const rad = H * (Math.exp((i + 1) * RK) - 1);
    for (let j = 0; j < NS; j++) {
      const a = ((j + (i % 2) * 0.5) / NS) * Math.PI * 2;
      setVertex(1 + i * NS + j, Math.cos(a) * rad, Math.sin(a) * rad);
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
  tg.setAttribute("aShade", new BufferAttribute(shadeA, 1));
  tg.setIndex(idx);
  tg.computeBoundingSphere();

  const ripple = rippleTexture(low ? 256 : 512);
  const sand = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0, envMapIntensity: 0.0, transparent: true, fog: false });
  const sandU = { tRipple: { value: ripple }, uCamSite: camSite, uCover: cover, uHazeD: { value: 2400 }, uAmbient: { value: new Color() }, uSunK: { value: 1 }, uNight: { value: 0 }, uLampSite: { value: new Vector3() }, uLampCol: { value: new Color(0, 0, 0) } };
  sand.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, skyU, sandU);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSite;\nattribute float aShade;\nvarying float vShade;\nvarying vec3 vSiteN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSite = position;\nvShade = aShade;\nvSiteN = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vSite;
        varying float vShade;
        varying vec3 vSiteN;
        uniform sampler2D tRipple;
        uniform vec3 uCamSite;
        uniform float uCover;
        uniform float uHazeD;
        uniform vec3 uAmbient;
        uniform float uSunK;
        uniform float uNight;
        uniform vec3 uLampSite;
        uniform vec3 uLampCol;
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
          vec3 toFrag = vSite - uCamSite;
          float dist = length(toFrag);
          // How steeply this bit of ground is seen. At a low angle ripples turn
          // into long streaks, so far and middle ground stays smooth.
          float steep = abs(toFrag.y) / max(dist, 1e-3);
          float seen = smoothstep(0.035, 0.17, steep);
          vec2 uv = vSite.xz;
          // Slow fields decide where the ripples run, how big they are and where the sand lies smooth.
          float f1 = texture2D(tRipple, uv * 0.00173 + 0.13).a;
          float f2 = texture2D(tRipple, uv.yx * 0.00071 + 0.57).a;
          float f3 = texture2D(tRipple, uv * 0.0127 + 0.31).a;
          float field = f1 * 0.6 + f2 * 0.4;
          vec2 warp = (vec2(f1, f3) - 0.5) * 14.0;
          float ang = (f2 - 0.5) * 2.2 + (f3 - 0.5) * 0.5;
          float ca = cos(ang);
          float sa = sin(ang);
          vec2 ruv = mat2(ca, -sa, sa, ca) * (uv + warp);
          float scale = mix(0.7, 1.5, smoothstep(0.35, 0.65, field));
          float patchy = smoothstep(0.38, 0.62, f3);
          vec4 a = texture2D(tRipple, ruv * 0.21 * scale);
          vec4 b = texture2D(tRipple, ruv * vec2(0.067, 0.061) * scale + 0.37);
          float high = 1.0 - 0.7 * smoothstep(6.0, 60.0, uCamSite.y);
          float fa = seen * (1.0 - smoothstep(4.0, 40.0, dist)) * mix(0.35, 1.0, patchy) * high;
          float fb = seen * (1.0 - smoothstep(14.0, 120.0, dist)) * mix(0.2, 1.0, patchy) * high;
          // Sand grain, right at the lens only.
          float gn = (texture2D(tRipple, uv * 2.7).a - 0.5) + (texture2D(tRipple, uv * 11.0).a - 0.5) * 1.2;
          float fg = 1.0 - smoothstep(0.3, 5.0, dist);
          // Rotate the slopes back into site space.
          vec2 g1 = (a.xy - 0.5) * 0.8 * fa + (b.xy - 0.5) * 0.6 * fb;
          vec2 g = vec2(ca * g1.x + sa * g1.y, -sa * g1.x + ca * g1.y);
          sandGrad = vec3(g.x, 0.0, g.y) * 1.25;
          sandH = (a.z - 0.5) * fa * 0.28 + (b.z - 0.5) * fb * 0.2 + (field - 0.5) * 0.7 + gn * fg * 0.5;
          diffuseColor.rgb = mix(vec3(0.44, 0.2, 0.085), vec3(0.72, 0.38, 0.16), clamp(0.5 + sandH * 0.8, 0.0, 1.0));
          // Broad forms: faces toward the low sun lift, lee sides and long shadows sink.
          float face = dot(normalize(vSiteN.xz + 1e-4) * length(vSiteN.xz), normalize(uSun.xz + 1e-4));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.34))) * vec3(0.84, 0.92, 1.16), uNight);
          diffuseColor.rgb *= mix(1.0, clamp(0.84 + face * 7.5, 0.5, 1.45) * mix(0.46, 1.0, vShade), max(uSunK, 0.25));
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
        totalEmissiveRadiance += diffuseColor.rgb * uAmbient;
        // The small lamp's pool on the sand.
        {
          vec3 lv = uLampSite - vSite;
          float ld2 = dot(lv, lv);
          float nl = max(normalize(lv).y + (sandGrad.x * lv.x + sandGrad.z * lv.z) * 2.0, 0.0);
          totalEmissiveRadiance += vec3(0.9, 0.82, 0.74) * uLampCol * nl * 0.0065 / (ld2 + 0.0035);
        }`,
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
          float glitter = toward * smoothstep(-0.1, 0.3, sandH) * (1.0 - smoothstep(30.0, 300.0, dist));
          gl_FragColor.rgb += uSunCol * glitter * 0.5;
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
  const widePos = site(WIDE_POS.x, Math.max(gh(STAND.x, STAND.z), gh(WIDE_POS.x, WIDE_POS.z)) + 0.95, WIDE_POS.z);
  const wideDir = site(Math.sin(WIDE_YAW) * Math.cos(WIDE_PITCH), Math.sin(WIDE_PITCH), -Math.cos(WIDE_YAW) * Math.cos(WIDE_PITCH));
  const wideLook = widePos.clone().addScaledVector(wideDir, 60);
  const standY = gh(STAND.x, STAND.z);
  // The closing shot: down on the sand ahead of where he stood, looking back toward the last light,
  // a sapling and his hand low on the right, the sky filling the rest.
  const sapY = gh(STAND.x, STAND.z - 3);
  const touchPos = site(STAND.x - 0.06, sapY + 0.05, STAND.z - 3 + 0.44);
  const closeYaw = (-3.5 * Math.PI) / 180;
  const closePitch = (9.1 * Math.PI) / 180;
  const touchLook = touchPos.clone().add(site(Math.sin(closeYaw) * Math.cos(closePitch), Math.sin(closePitch), -Math.cos(closeYaw) * Math.cos(closePitch)).multiplyScalar(2));
  const fly = new CatmullRomCurve3([EXIT_POS, site(0.6, 4.4, 17), site(0.8, 9.5, 2), site(0.4, 8, -30), site(0.1, 3.2, -62), widePos], false, "centripetal");
  const flyLook = new CatmullRomCurve3([EXIT_LOOK, site(-5, 0, -40), site(-1, -4, -70), site(-2, 2, -100), wideLook.clone().add(site(0, 0, -6)), wideLook], false, "centripetal");
  // A long low run toward him, up and over his shoulder, then down to the sand in front of him.
  const approach = new CatmullRomCurve3([widePos, site(-0.5, standY + 1.5, -104), site(-0.95, standY + 2.5, -121), site(-1.02, standY + 1.25, -124.9), site(-1.05, sapY + 0.3, -126.1), touchPos], false, "centripetal");
  const approachLook = new CatmullRomCurve3([wideLook, site(-1.4, standY + 3.0, -142), site(-1.6, standY + 0.9, -134), site(-1.5, sapY + 0.4, -129), touchLook.clone().add(site(0, 0.02, 0.2)), touchLook], false, "centripetal");
  const landedLook = site(-6.0, l.stand + 3.6, -40);
  const landedPos = site(-4.2, l.stand + 1.7, 14.5);

  function shot(s: number, portrait: boolean, out: SurfaceShot) {
    const fovExit = 30;
    const fovWide = 34;
    const fovTouch = 38;
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
      out.parallax = lerp(0.3, 0.012, smooth(0.4, 1, t));
    }
    if (portrait) {
      out.fov += 16;
      // On a tall screen the frame is narrow: turn toward what matters in it.
      const yaw = (s <= 1 ? lerp(4, 7, s) : s <= 2 ? lerp(7, 9, s - 1) : lerp(9, 8, s - 2)) * (Math.PI / 180);
      const dx = out.look.x - out.pos.x;
      const dz = out.look.z - out.pos.z;
      const ca = Math.cos(yaw);
      const sa = Math.sin(yaw);
      out.look.x = out.pos.x + dx * ca - dz * sa;
      out.look.z = out.pos.z + dx * sa + dz * ca;
    }
    out.pos.applyMatrix4(group.matrixWorld);
    out.look.applyMatrix4(group.matrixWorld);
    return out;
  }

  // ------------------------------------------------------------ him: matted plates on cards
  // A card shows a plate in the world: anchored at one source pixel on one world
  // point, turning to face the camera, relit by the hour. A second pass writes
  // depth where he is solid, so dust behind him stays behind him.
  const bank = new PlateBank("/story/plates/manifest.json", low);
  const planeG = new PlaneGeometry(1, 1);
  const shared = {
    uShadow: { value: new Color() },
    uHigh: { value: new Color() },
    uKeep: { value: 1 },
    uGain: { value: 1 },
    uLampCol: { value: new Color(0, 0, 0) },
    uLampWorld: { value: new Vector3() },
    uLampR: { value: 0.12 },
  };
  const makeCard = () => {
    const tMap = { value: null as Texture | null };
    const uOp = { value: 1 };
    const mat = new ShaderMaterial({
      vertexShader: CARD_VS,
      fragmentShader: CARD_FS,
      uniforms: { tMap, uOp, ...shared },
      transparent: true,
      depthWrite: false,
      fog: false,
      side: DoubleSide,
    });
    const depthMat = new ShaderMaterial({
      vertexShader: CARD_VS,
      fragmentShader: CARD_DEPTH_FS,
      uniforms: { tMap },
      colorWrite: false,
      transparent: true,
      side: DoubleSide,
    });
    const depth = new Mesh(planeG, depthMat);
    depth.renderOrder = 4;
    depth.frustumCulled = false;
    const mesh = new Mesh(planeG, mat);
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    group.add(depth, mesh);
    return { mesh, depth, tMap, uOp };
  };

  // Long soft shadow on the ground, away from the sun, plus a small dark core at the feet.
  const shadowMat = new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float along = vUv.y;
        float across = abs(vUv.x - 0.5) * 2.0;
        float width = mix(0.5, 0.95, along);
        float a = smoothstep(width, width * 0.15, across) * smoothstep(0.0, 0.02, along) * pow(1.0 - along, 1.6);
        gl_FragColor = vec4(uColor, a * uStrength);
      }`,
    uniforms: { uStrength: { value: 0 }, uColor: { value: new Color(0.03, 0.012, 0.008) } },
    transparent: true,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const shadowG = new PlaneGeometry(1, 1);
  shadowG.translate(0, 0.5, 0);
  shadowG.rotateX(-Math.PI / 2);
  shadowG.scale(1, 1, -1);
  const shadowMesh = new Mesh(shadowG, shadowMat);
  shadowMesh.renderOrder = -44;
  shadowMesh.frustumCulled = false;
  shadowMesh.material.side = DoubleSide;
  group.add(shadowMesh);

  const blobMat = new ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aC;
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        vec3 p = vec3(position.x * aC.z + aC.x, position.y, position.z * aC.z + aC.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float a = smoothstep(1.0, 0.0, length(vUv));
        gl_FragColor = vec4(uColor, a * a * uStrength);
      }`,
    uniforms: { uStrength: { value: 0 }, uColor: { value: new Color(0.02, 0.009, 0.006) } },
    transparent: true,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  // Contact shadows under the landed craft: the hull and each foot.
  const contactG = new InstancedBufferGeometry();
  {
    const base = new PlaneGeometry(1, 1);
    base.rotateX(-Math.PI / 2);
    contactG.setAttribute("position", base.getAttribute("position"));
    contactG.setAttribute("uv", base.getAttribute("uv"));
    contactG.setIndex(base.getIndex());
    const feet = [
      [0, 0, 6.2],
      [1.04, -1.05, 1.2],
      [-1.04, -1.05, 1.2],
      [1.04, 1.15, 1.2],
      [-1.04, 1.15, 1.2],
      [0, 4.1, 1.5],
    ];
    const ac = new Float32Array(feet.length * 3);
    feet.forEach((v, k) => ac.set(v, k * 3));
    contactG.setAttribute("aC", new InstancedBufferAttribute(ac, 3));
    contactG.instanceCount = feet.length;
  }
  const contact = new Mesh(contactG, blobMat);
  contact.position.y = 0.01;
  contact.frustumCulled = false;
  contact.renderOrder = -46;
  group.add(contact);

  const card = makeCard();

  // ------------------------------------------------------------ the sapling
  // Real geometry, a few centimetres tall: a thin stem and two small leaves.
  const SAP = site(STAND.x, groundHeight(STAND.x, STAND.z - 3), STAND.z - 3);
  const SAP_H = 0.046;
  const sapU = {
    uTime: windTime,
    uTouch: { value: 0 },
    uAmb: { value: new Color() },
    uKey: { value: new Color() },
    uSunDir: skyU.uSun,
    uLampCol: shared.uLampCol,
    uLampSite: { value: new Vector3() },
  };
  const sapG = saplingGeometry(SAP_H);
  const sapMat = new ShaderMaterial({ vertexShader: SAP_VS, fragmentShader: SAP_FS, uniforms: sapU, side: DoubleSide, fog: false });
  const sapling = new Mesh(sapG, sapMat);
  sapling.position.copy(SAP);
  sapling.frustumCulled = false;
  sapling.renderOrder = 3;
  group.add(sapling);
  // The tip the finger comes to rest on, just above the upper leaf.
  const TOUCH_AT = SAP.clone().add(site(0.006, SAP_H * 1.04, 0));

  // The small lamp on his wrist: a warm glint, and the pool it throws.
  const lampGlow = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        uniform vec3 uCenter;
        uniform float uSize;
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          vec4 mv = modelViewMatrix * vec4(uCenter, 1.0);
          mv.xy += position.xy * uSize * 2.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float r = length(vUv);
          float a = exp(-r * r * 22.0) + 0.16 * exp(-r * r * 3.0);
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
      uniforms: { uCenter: { value: new Vector3() }, uSize: { value: 0.03 }, uColor: { value: new Color(0, 0, 0) } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: 2,
      fog: false,
    }),
  );
  lampGlow.frustumCulled = false;
  lampGlow.renderOrder = 8;
  group.add(lampGlow);

  // ------------------------------------------------------------ the three performances
  type Stage = { perf: string; idle: string; state: number; t: number; dur: number; scene: "exit" | "helmet" | "touch"; beats: number[]; sent: number };
  const stages: Stage[] = [
    { perf: "exitP", idle: "exitI", state: 0, t: 0, dur: 8, scene: "exit", beats: [0, 0.36, 0.55], sent: -1 },
    { perf: "helmetP", idle: "helmetI", state: 0, t: 0, dur: 8, scene: "helmet", beats: [0, 0.42, 0.56, 0.68], sent: -1 },
    { perf: "handP", idle: "handI", state: 0, t: 0, dur: 8, scene: "touch", beats: [0, 0.03, HAND_REACH / 8, 0.6], sent: -1 },
  ];
  const zone = (s: number) => (s < 1.5 ? 0 : s < 2.72 ? 1 : 2);
  let curZone = -1;
  let settled = 0;
  let touch = 0;
  let touched = false;

  function stepStages(s: number, dt: number, reduced: boolean) {
    stages.forEach((st, k) => {
      const at = k + 1;
      if (reduced) {
        // A still world: he has already done it, and stands there.
        st.state = s >= at - 0.5 ? 2 : 0;
        st.t = 0;
        return;
      }
      if (s < at - 0.25 && st.state !== 0) {
        st.state = 0;
        st.t = 0;
        st.sent = -1;
      } else if (st.state === 0 && Math.abs(s - at) < 0.012) {
        st.state = 1;
        st.t = 0;
      } else if (st.state === 1 && s > at + 0.12) {
        st.state = 2;
        st.t = 0;
      }
      if (st.state === 1) {
        st.t += dt;
        const p = Math.min(1, st.t / st.dur);
        let beat = 0;
        st.beats.forEach((b, i) => {
          if (p >= b) beat = i;
        });
        if (Math.abs(p - st.sent) > 0.01 || p >= 1) {
          st.sent = p;
          window.dispatchEvent(new CustomEvent("journey:ending", { detail: { scene: st.scene, progress: p, beat } }));
        }
        if (st.t >= st.dur) {
          st.state = 2;
          st.t = 0;
        }
      } else if (st.state === 2) {
        st.t += dt;
      }
    });
  }

  const _right = new Vector3();
  const _p = new Vector3();
  const tmpV = new Vector3();
  const tmpV2 = new Vector3();
  const anchorW = new Vector3();

  function placeCard(st: Stage, anchor: Vector3, ax: number, ay: number, pu: number, offR: number, offU: number) {
    // Which frame: a performance plays through, then the idle loop runs for ever.
    const useIdle = st.state === 2 && bank.meta(st.idle);
    const id = useIdle ? st.idle : st.perf;
    const m = bank.meta(id);
    card.mesh.visible = card.depth.visible = false;
    if (!m) return null;
    const f = st.state === 0 ? 0 : st.state === 1 ? Math.floor(st.t * m.fps) : Math.floor(st.t * m.fps);
    const tex = bank.texture(id, Math.min(f, m.loop ? f : m.frames - 1));
    if (!tex) return null;
    card.tMap.value = tex;
    const [x0, y0, x1, y1] = m.box;
    const w = (x1 - x0) * pu;
    const h = (y1 - y0) * pu;
    const yaw = Math.atan2(camSite.value.x - anchor.x, camSite.value.z - anchor.z);
    _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const cx = (x0 + x1) * 0.5;
    const cy = (y0 + y1) * 0.5;
    _p.copy(anchor)
      .addScaledVector(_right, (cx - ax) * pu + offR)
      .add(tmpV.set(0, (ay - cy) * pu + offU, 0));
    for (const o of [card.mesh, card.depth]) {
      o.position.copy(_p);
      o.rotation.set(0, yaw, 0);
      o.scale.set(w, h, 1);
      o.visible = true;
    }
    // The depth pass sits a hair behind so the colour pass always passes.
    card.depth.position.addScaledVector(tmpV.set(Math.sin(yaw), 0, Math.cos(yaw)), -0.0005);
    return m;
  }

  // Median of the lowest point over the end of a performance: where the feet or fingertip come to rest.
  const footRest = (id: string) => {
    const m = bank.meta(id);
    if (!m) return null;
    const list = m.foot.slice(Math.floor(m.foot.length * 0.6));
    const xs = list.map((v) => v[0]).sort((a, b) => a - b);
    const ys = list.map((v) => v[1]).sort((a, b) => a - b);
    return [xs[xs.length >> 1], ys[ys.length >> 1]];
  };

  // ------------------------------------------------------------ time passing: sunset to full night
  const sunWorld = new Vector3();
  const sunColor = new Color();
  const skyLight = new Color();
  const groundLight = new Color();
  const hazeColor = new Color();
  const dustCol = new Color();
  const c1 = new Color();
  const c2 = new Color();
  // The four skies: s = 0 landing, 1 first steps, 2 helmet off, 3 the touch.
  // Every value blends from one to the next as the camera travels, either way.
  const blend = (s: number, table: number[][], out: Color) => {
    const i = Math.min(2, Math.floor(s));
    const f = clamp(s - i, 0, 1);
    const t = f * f * (3 - 2 * f);
    const a = table[i];
    const b = table[i + 1];
    return out.setRGB(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  };
  const blend1 = (s: number, table: number[]) => {
    const i = Math.min(2, Math.floor(s));
    const f = clamp(s - i, 0, 1);
    return lerp(table[i], table[i + 1], f * f * (3 - 2 * f));
  };
  const SKY = {
    horSun: [[0.86, 0.3, 0.04], [0.72, 0.19, 0.03], [0.74, 0.2, 0.05], [0.014, 0.014, 0.03]],
    horAway: [[0.5, 0.15, 0.03], [0.3, 0.075, 0.03], [0.1, 0.04, 0.095], [0.009, 0.01, 0.026]],
    mid: [[0.86, 0.26, 0.032], [0.5, 0.115, 0.03], [0.13, 0.05, 0.17], [0.008, 0.01, 0.028]],
    top: [[0.58, 0.145, 0.034], [0.21, 0.05, 0.045], [0.03, 0.018, 0.085], [0.0035, 0.0045, 0.014]],
    sun: [[0.34, 0.14, 0.025], [0.3, 0.085, 0.014], [0.14, 0.035, 0.01], [0, 0, 0]],
    key: [[2.3, 1.06, 0.42], [1.9, 0.68, 0.22], [0.42, 0.14, 0.09], [0.05, 0.07, 0.14]],
    fill: [[0.82, 0.32, 0.09], [0.54, 0.18, 0.07], [0.18, 0.09, 0.2], [0.05, 0.068, 0.135]],
    bounce: [[0.2, 0.08, 0.03], [0.13, 0.045, 0.02], [0.04, 0.02, 0.04], [0.005, 0.006, 0.012]],
    dust: [[0.86, 0.38, 0.13], [0.56, 0.2, 0.075], [0.2, 0.11, 0.2], [0.035, 0.04, 0.07]],
    mote: [[1.0, 0.62, 0.32], [0.82, 0.4, 0.2], [0.42, 0.3, 0.46], [0.2, 0.22, 0.32]],
    // How the plates are relit: the shadows take the sky, the highlights the last light.
    plateShadow: [[0.62, 0.36, 0.24], [0.55, 0.3, 0.22], [0.34, 0.27, 0.5], [0.4, 0.5, 0.86]],
    plateHigh: [[1.02, 0.72, 0.52], [1.0, 0.6, 0.42], [0.92, 0.45, 0.44], [0.5, 0.6, 0.95]],
  };
  const SUN_EL = [0.082, 0.03, -0.034, -0.24];
  const BAND_W = [0.16, 0.12, 0.05, 0.1];
  const STARS = [0.1, 0.16, 0.72, 1];
  const MILKY = [0, 0, 0.03, 1];
  const MOON_K = [1, 0.86, 0.55, 0.12];
  const PLATE_GAIN = [1, 0.9, 0.62, 1.7];
  const PLATE_KEEP = [1, 1, 0.8, 0];
  const SUN_K = [1, 0.8, 0.14, 0];

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

    // ---- the hour, from the journey's progress
    const el = blend1(s, SUN_EL);
    const az = (8 * Math.PI) / 180;
    sun.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    sunWorld.copy(sun).applyQuaternion(l.quat);
    moonSun.value.copy(sunWorld);
    blend(s, SKY.horSun, skyU.uHorSun.value);
    blend(s, SKY.horAway, skyU.uHorAway.value);
    blend(s, SKY.mid, skyU.uMid.value);
    blend(s, SKY.top, skyU.uTop.value);
    blend(s, SKY.sun, skyU.uSunCol.value);
    skyU.uBandW.value = blend1(s, BAND_W);
    domeMat.uniforms.uStars.value = blend1(s, STARS);
    domeMat.uniforms.uMilky.value = blend1(s, MILKY);
    domeMat.uniforms.uRing.value = 1 - 0.5 * smooth(1.5, 3, s);
    blend(s, SKY.key, sunColor);
    blend(s, SKY.fill, skyLight);
    blend(s, SKY.bounce, groundLight);
    hazeColor.copy(skyU.uHorSun.value).lerp(skyU.uMid.value, 0.5).multiplyScalar(0.8);
    const night = smooth(2.25, 3, s);
    sandU.uNight.value = night;
    sandU.uAmbient.value.copy(skyLight).multiplyScalar(0.3 + 0.75 * night);
    blend(s, SKY.dust, dustCol);
    for (const m of veils) m.uniforms.uColor.value.copy(dustCol);
    devilMat.uniforms.uColor.value.copy(dustCol).multiplyScalar(0.62);
    devil.visible = s < 2.7;
    blend(s, SKY.mote, moteMat.uniforms.uColor.value);
    sandU.uSunK.value = blend1(s, SUN_K);

    // The moons take the colour of the air and dim as night falls.
    const moonK = blend1(s, MOON_K);
    moonSoft.value = smooth(2.6, 3, s);
    for (const m of moonList) {
      c1.setRGB(1.25, 0.84, 0.56).lerp(c2.setRGB(0.72, 0.68, 0.9), smooth(1.2, 2.6, s));
      m.uArc.value.copy(skyU.uHorSun.value).lerp(c1, m.pale).multiplyScalar(lerp(0.5, 1, moonK));
      m.uShade.value.copy(skyU.uMid.value).multiplyScalar(m.shade);
      m.uK.value = moonK;
      const a = m.az + (f.reduced ? 0 : time * m.drift * 0.02);
      const ce = Math.cos(m.el);
      m.mesh.position.set(MOON_ANCHOR.x + Math.sin(a) * ce * m.dist, MOON_ANCHOR.y + Math.sin(m.el) * m.dist, MOON_ANCHOR.z - Math.cos(a) * ce * m.dist);
      if (!f.reduced) m.mesh.rotation.y += dt * 0.004;
    }

    // ---- contact and the dust settling around the legs
    blobMat.uniforms.uStrength.value = 0.62 * smooth(0.82, 0.98, f.land) * (1 - smooth(1.6, 2.2, s));
    contact.visible = blobMat.uniforms.uStrength.value > 0.002;
    blobMat.uniforms.uColor.value.copy(sunColor).multiplyScalar(0.006);

    // ---- plates: fetch what the story needs next
    bank.begin();
    const z = zone(s);
    if (z !== curZone) {
      curZone = z;
      bank.prefer(z === 0 ? ["exitP", "exitI", "helmetP", "helmetI", "handP", "handI"] : z === 1 ? ["helmetP", "helmetI", "handP", "handI", "exitP", "exitI"] : ["handP", "handI", "helmetI", "helmetP"]);
    }
    stepStages(s, dt, f.reduced);

    // ---- relight for the hour
    blend(s, SKY.plateShadow, shared.uShadow.value);
    blend(s, SKY.plateHigh, shared.uHigh.value);
    shared.uGain.value = blend1(s, PLATE_GAIN);
    shared.uKeep.value = blend1(s, PLATE_KEEP);

    // ---- which performance is on stage, and where
    let m: PlateMeta | null = null;
    let shadowAt: Vector3 | null = null;
    let shadowLen = 0;
    const camZ = camSite.value.z;
    const zStand = STAND.z;
    if (bank.ready && s > 0.25 && s < 1.46) {
      const st = stages[0];
      const perf = bank.meta(st.perf);
      if (perf && perf.height) {
        // How much bigger he has grown in the plate says how far he has come.
        const fr = st.state === 0 ? 0 : st.state === 1 ? Math.min(perf.frames - 1, Math.floor(st.t * perf.fps)) : perf.frames - 1;
        const h0 = perf.height[0];
        const rho = perf.height[fr] / h0;
        const D = EXIT_D0 / Math.max(rho, 0.5);
        const z = EXIT_POS.z - D;
        const onRamp = clamp((RAMP_FOOT_Z - z) / (RAMP_FOOT_Z - HATCH_Z), 0, 1);
        const y = groundHeight(0, z) + RAMP_DROP * onRamp;
        anchorW.set(((perf.foot[fr][0] - perf.foot[0][0]) * 1.35) / perf.height[fr], y, z);
        const idle = st.state === 2 ? bank.meta(st.idle) : null;
        if (idle && idle.height) {
          const fi = Math.floor(st.t * idle.fps) % idle.frames;
          m = placeCard(st, anchorW, idle.foot[fi][0], idle.foot[fi][1], 1.35 / idle.height[fi], 0, 0);
        } else {
          m = placeCard(st, anchorW, perf.foot[fr][0], perf.foot[fr][1], 1.35 / perf.height[fr], 0, 0);
        }
        if (m && onRamp < 0.04) {
          shadowAt = tmpV2.set(anchorW.x, groundHeight(anchorW.x, anchorW.z), anchorW.z);
          shadowLen = 7;
        }
      }
    } else if (bank.ready && s >= 1.46 && s < 2.8 && camZ > zStand - 0.2) {
      const rest = footRest("helmetP");
      if (rest) {
        anchorW.set(STAND.x, groundHeight(STAND.x, STAND.z), STAND.z);
        m = placeCard(stages[1], anchorW, rest[0], rest[1], HELMET_PU, 0, 0);
        if (m) {
          shadowAt = tmpV2.copy(anchorW);
          shadowLen = 8;
        }
      }
    } else if (bank.ready && s >= 2.72) {
      const rest = footRest("handP");
      if (rest) {
        const st = stages[2];
        // The arm comes in from above and to the right, and the finger comes to rest on the leaf.
        const reach = st.state === 0 ? 0 : st.state === 1 ? clamp(st.t / HAND_REACH, 0, 1) : 1;
        const e = 1 - Math.pow(1 - reach, 3);
        const arrive = smooth(2.72, 3, s);
        m = placeCard(st, TOUCH_AT, rest[0], rest[1], HAND_PU, (1 - e) * 0.2 + (1 - arrive) * 0.1, (1 - e) * 0.22 + (1 - arrive) * 0.1);
        if (reach >= 1 && !touched) {
          touched = true;
          touch = 1;
        }
        if (st.state === 0) touched = false;
        // The small lamp at his wrist.
        const lampK = smooth(2.5, 3, s);
        if (m) {
          const wrist = tmpV.copy(_right).multiplyScalar((1490 - rest[0]) * HAND_PU + (1 - e) * 0.2).add(tmpV2.set(0, (rest[1] - 305) * HAND_PU + (1 - e) * 0.22, 0)).add(TOUCH_AT);
          lampGlow.material.uniforms.uCenter.value.copy(wrist);
          lampGlow.material.uniforms.uColor.value.setRGB(1.6, 1.15, 0.72).multiplyScalar(lampK);
          lampGlow.visible = lampK > 0.01;
        }
        const pool = 0.9 * lampK;
        shared.uLampCol.value.setRGB(1.0 * pool, 0.72 * pool, 0.44 * pool);
        sandU.uLampSite.value.copy(SAP).add(tmpV.set(0.05, 0.1, -0.02));
        sapU.uLampSite.value.copy(sandU.uLampSite.value);
        shared.uLampWorld.value.copy(sandU.uLampSite.value).applyMatrix4(group.matrixWorld);
      }
    }
    if (!m) {
      card.mesh.visible = card.depth.visible = false;
    }
    if (s < 2.5) {
      shared.uLampCol.value.setRGB(0, 0, 0);
      lampGlow.visible = false;
    }
    sandU.uLampCol.value.copy(shared.uLampCol.value);

    // His shadow, away from the sun, and gone when the sun is.
    const sunK = blend1(s, SUN_K);
    if (shadowAt) {
      const yaw = Math.atan2(-sun.x, -sun.z);
      shadowMesh.position.copy(shadowAt);
      shadowMesh.rotation.set(0, yaw, 0);
      shadowMesh.scale.set(0.9, 1, shadowLen);
      shadowMat.uniforms.uStrength.value = 0.62 * Math.max(sunK, 0.3);
      shadowMesh.visible = true;
    } else {
      shadowMesh.visible = false;
    }

    // ---- the sapling
    sapling.visible = s > 2.45;
    touch = Math.max(0, touch - dt * 0.6);
    sapU.uTouch.value = touch;
    sapU.uAmb.value.copy(skyLight).multiplyScalar(0.6);
    sapU.uKey.value.copy(sunColor).multiplyScalar(0.2);
  }

  return {
    group,
    setSoft(v: number) {
      moonSoft.value = v;
    },
    sunWorld,
    sunColor,
    skyLight,
    groundLight,
    hazeColor,
    shot,
    update,
    dispose() {
      bank.destroy();
    },
  };
}
