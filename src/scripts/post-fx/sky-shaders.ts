import { loopCount } from "../gl-loop";
// The nebula and the star dust, shared by a post's opening and the Teaching pages.
// A file of its own, with no imports, so a page can have these without three.js.

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < ${loopCount(4)}; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}`;

export const SKY_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;

export const SKY_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime; uniform float uAspect; uniform float uA; uniform float uSeed; uniform float uWarp;
uniform vec3 uCol1; uniform vec3 uCol2; uniform vec2 uPointer;
${NOISE}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 q = p * 1.5 + vec2(uSeed * 3.7, uSeed * 1.9) + uPointer * 0.03;
  float n = fbm(q + vec2(uTime * 0.012, -uTime * 0.008));
  float m = fbm(q * 1.7 - n * 1.25 + vec2(-uTime * 0.01, uTime * 0.007) + 3.1);
  vec3 col = vec3(0.004, 0.006, 0.014);
  col += uCol1 * pow(smoothstep(0.28, 0.92, m), 1.7) * 0.8;
  col += uCol2 * pow(smoothstep(0.42, 1.0, n), 2.4) * 0.5;
  col += vec3(0.55, 0.6, 0.75) * pow(smoothstep(0.6, 1.0, m), 3.0) * 0.18;
  col *= 0.7 + 0.3 * smoothstep(0.18, 0.72, n);
  float r = length(p);
  col += uCol1 * uWarp * 0.3 * (1.0 - smoothstep(0.0, 0.85, r));
  col *= 1.0 - 0.5 * dot(p * 0.85, p * 0.85);
  gl_FragColor = vec4(col * uA, uA);
}`;

export const DUST_VS = /* glsl */ `
attribute float aSeed; attribute float aTail;
uniform float uTime; uniform float uStretch; uniform float uDpr; uniform vec2 uPointer;
varying float vA; varying float vSeed;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.11 + aSeed * 40.0) * 0.35 - uPointer.x * aSeed * 0.9;
  p.y += cos(uTime * 0.09 + aSeed * 23.0) * 0.25 - uPointer.y * aSeed * 0.6;
  p.z -= aTail * uStretch;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vA = clamp(1.5 - depth / 90.0, 0.0, 1.0) * smoothstep(0.5, 3.5, depth);
  vA *= 0.6 + 0.4 * sin(uTime * (0.6 + aSeed * 1.7) + aSeed * 50.0);
  vSeed = aSeed;
  gl_PointSize = clamp((0.7 + aSeed * 2.0) * 44.0 / depth * uDpr, 1.2, 9.0);
  gl_Position = projectionMatrix * mv;
}`;

export const DUST_FS = /* glsl */ `
precision mediump float;
uniform vec3 uTint; uniform float uLine; uniform float uGain;
varying float vA; varying float vSeed;
void main() {
  float a = vA * uGain;
  if (uLine < 0.5) {
    vec2 c = gl_PointCoord - 0.5;
    a *= smoothstep(0.5, 0.0, length(c));
  }
  vec3 col = mix(vec3(0.92, 0.95, 1.0), uTint, fract(vSeed * 7.31) * 0.7 + uLine * 0.3);
  gl_FragColor = vec4(col * a, a);
}`;
