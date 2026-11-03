// Shared shader snippets for the Mind world, plus the uniforms every material in
// it reads from one place: one clock, one lens, one light from the heart of the map,
// one chosen star, and the map's own bounds, which everything else keeps clear of.

import { Color, Data3DTexture, LinearFilter, RedFormat, RepeatWrapping, UnsignedByteType, Vector2, Vector3, Vector4 } from "three";

export type U<T> = { value: T };

export interface Shared {
  tier: "high" | "mid" | "low";
  low: boolean;
  reduced: boolean;
  time: U<number>;
  dpr: U<number>;
  /** CSS pixels per world unit at distance 1. */
  focal: U<number>;
  /** Drawing buffer size. */
  view: U<Vector2>;
  /** The chosen star: xyz, how much it holds the light. */
  focus: U<Vector4>;
  focusCol: U<Color>;
  focusR: U<number>;
  /** A wave of light leaving it: radius, strength. */
  wave: U<Vector2>;
  waveW: U<number>;
  /** Focus distance, and how far a star away from it spreads, in CSS pixels. */
  dof: U<Vector2>;
  /** The heart's light falls to half at this distance. */
  coreR: U<number>;
  /** Depth where far things start to sink, and over what range. */
  haze: U<Vector2>;
  /** The map's bounds as the camera sees them: its direction, half angle, fade angle. */
  mapDir: U<Vector3>;
  mapA: U<number>;
  mapFade: U<number>;
  /** Random values on a small 3D grid: all noise reads this. */
  noise: U<Data3DTexture>;
}

/**
 * Noise from a texture instead of hashing in the shader. It is cheaper on a phone,
 * and it is what makes the shaders quick to link: on Windows every hash is unrolled
 * and compiled by the graphics driver, which is most of the wait for a world.
 */
function makeNoise(): Data3DTexture {
  const S = 32;
  const data = new Uint8Array(S * S * S);
  const r = rng(1103);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(r() * 256);
  const t = new Data3DTexture(data, S, S, S);
  t.format = RedFormat;
  t.type = UnsignedByteType;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = RepeatWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

export function makeShared(tier: Shared["tier"], reduced: boolean): Shared {
  return {
    tier,
    low: tier === "low",
    reduced,
    time: { value: 0 },
    dpr: { value: 1 },
    focal: { value: 800 },
    view: { value: new Vector2(1, 1) },
    focus: { value: new Vector4(0, 0, 0, 0) },
    focusCol: { value: new Color(1, 1, 1) },
    focusR: { value: 300 },
    wave: { value: new Vector2(0, 0) },
    waveW: { value: 120 },
    dof: { value: new Vector2(1000, 0) },
    coreR: { value: 900 },
    haze: { value: new Vector2(1000, 1000) },
    mapDir: { value: new Vector3(0, 0, -1) },
    mapA: { value: 0.5 },
    mapFade: { value: 0.3 },
    noise: { value: makeNoise() },
  };
}

/** The uniform entries for worldLight, ready to spread into a material. */
export const lightUniforms = (s: Shared) => ({
  uFocus: s.focus,
  uFocusCol: s.focusCol,
  uFocusR: s.focusR,
  uWave: s.wave,
  uWaveW: s.waveW,
});

export const mapUniforms = (s: Shared) => ({
  uMapDir: s.mapDir,
  uMapA: s.mapA,
  uMapFade: s.mapFade,
});

/**
 * How the chosen star lights what is around it. Things near it take its colour,
 * the far world steps back, and a wave of light passes through once when it
 * opens. Runs per vertex, so the whole sky changes for almost nothing.
 */
export const WORLD_LIGHT = /* glsl */ `
uniform vec4 uFocus;
uniform vec3 uFocusCol;
uniform float uFocusR;
uniform vec2 uWave;
uniform float uWaveW;
vec3 worldLight(vec3 wp, vec3 col) {
  vec3 rel = wp - uFocus.xyz;
  float d2 = dot(rel, rel);
  float near = 1.0 / (1.0 + d2 / (uFocusR * uFocusR));
  float lit = uFocus.w * near;
  float y = dot(col, vec3(0.3333));
  vec3 c = mix(col, uFocusCol * (y * 0.7 + 0.06), lit * 0.85);
  c *= 1.0 - uFocus.w * 0.74 + lit * 0.95;
  if (uWave.y > 0.001) {
    float dw = (sqrt(d2) - uWave.x) / uWaveW;
    c += (col * 0.4 + uFocusCol * y) * exp(-dw * dw) * uWave.y * 1.4;
  }
  return c;
}
`;

/**
 * Whether a direction from the camera is clear of the map. 0 inside its bounds as
 * the camera sees them, up to 1 well outside. It is an angle, not a place on screen,
 * so it holds from any view, turned, flown in or flown far out.
 */
export const OUTSIDE_MAP = /* glsl */ `
uniform vec3 uMapDir;
uniform float uMapA;
uniform float uMapFade;
float outsideMap(vec3 dir, float extra) {
  float th = acos(clamp(dot(dir, uMapDir), -1.0, 1.0));
  return smoothstep(0.0, uMapFade, th - uMapA - extra);
}
`;

/** The heart's light: the same falloff on planets, rings and stars. */
export const CORE_LIGHT = /* glsl */ `
uniform float uCoreR;
float coreLight(vec3 p) {
  return 1.0 / (1.0 + dot(p, p) / (uCoreR * uCoreR));
}
`;

export const NOISE = /* glsl */ `
uniform highp sampler3D uNoise;
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return textureLod(uNoise, (i + f + 0.5) / 32.0, 0.0).r;
}
float fbm2(vec3 p) {
  return vnoise(p) * 0.5 + vnoise(p * 2.03 + vec3(17.1, 9.2, 3.7)) * 0.25;
}
float fbm3(vec3 p) {
  return fbm2(p) + vnoise(p * 4.12 + vec3(51.8, 27.9, 11.2)) * 0.125;
}
float fbm5(vec3 p) {
  return fbm3(p) + vnoise(p * 8.37 + vec3(122.0, 65.0, 33.0)) * 0.0625 + vnoise(p * 17.0 + vec3(263.0, 141.0, 74.0)) * 0.03125;
}
`;

/** A small seeded random source, so the world is the same on every visit. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const gaussFrom = (r: () => number) => () => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-4))) * Math.cos(r() * Math.PI * 2);
