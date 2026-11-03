// The look of the world: paper, machined marks, dust. All of it lit by one
// white studio that lives in the shaders, and by the light on the pointer.

const STUDIO = /* glsl */ `
uniform float uEnv;
vec3 studio(vec3 r) {
  float ca = cos(uEnv), sa = sin(uEnv);
  r = vec3(ca * r.x + sa * r.z, r.y, -sa * r.x + ca * r.z);
  // a long box overhead, a tall strip on one side, a small window on the other
  float top = smoothstep(0.42, 0.62, r.y) * smoothstep(1.05, 0.55, abs(r.x + 0.12));
  float strip = smoothstep(0.13, 0.03, abs(r.x + 0.66 + 0.08 * r.y)) * smoothstep(0.86, 0.34, abs(r.y));
  float win = smoothstep(0.13, 0.08, abs(r.x - 0.72)) * smoothstep(0.34, 0.26, abs(r.y - 0.08));
  float hor = exp(-r.y * r.y * 24.0) * 0.07;
  float floorb = smoothstep(-0.25, -0.95, r.y) * 0.1;
  return vec3(0.93, 0.96, 1.0) * (top * 3.2 + strip * 5.0 + win * 2.2 + hor + floorb);
}`;

const NOISE = /* glsl */ `
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

export const PAPER_VS = /* glsl */ `
attribute float aFace;   // 0 front, 1 back, 2 the cut edge
attribute vec4 aUvA;     // where this sits on the page
attribute vec4 aUvB;     // its sharp copy, or the sheet's back
attribute vec2 aSize;    // size in page widths
attribute vec4 aState;   // sharp copy mix, light, edge glare, seed
attribute vec4 aFlex;    // bend around y, bend around x, twist, ripple
uniform float uTime;
uniform float uThick;
varying vec3 vN;
varying vec3 vW;
varying vec2 vL;
varying vec4 vUvA;
varying vec4 vUvB;
varying vec4 vState;
varying float vFace;
varying vec2 vSize;

vec3 fold(vec2 q, vec4 f, float ph) {
  float z = f.y * q.y * q.y + f.z * q.x * q.y
    + f.w * (sin(q.x * 3.1 + q.y * 2.3 + uTime * 0.7 + ph) + 0.6 * sin(q.x * -2.2 + q.y * 3.7 + uTime * 0.53 + ph * 1.7));
  vec3 p = vec3(q, z);
  if (abs(f.x) > 0.001) {
    float r = 1.0 / f.x;
    float a = q.x * f.x;
    p = vec3(sin(a) * (r + z), q.y, cos(a) * (r + z) - r);
  }
  return p;
}

void main() {
  vec2 q = position.xy * aSize;
  float ph = aState.w * 6.283;
  vec3 a = fold(q, aFlex, ph);
  vec3 bx = fold(q + vec2(0.004, 0.0), aFlex, ph);
  vec3 by = fold(q + vec2(0.0, 0.004), aFlex, ph);
  vec3 tx = normalize(bx - a);
  vec3 ty = normalize(by - a);
  vec3 n = normalize(cross(tx, ty));
  vec3 p = a + n * position.z * uThick;
  vec3 nl = aFace < 0.5 ? n : (aFace < 1.5 ? -n : normalize(tx * normal.x + ty * normal.y));
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(p, 1.0);
  vN = normalize(mat3(m) * nl);
  vW = w.xyz;
  vL = position.xy + 0.5;
  vUvA = aUvA;
  vUvB = aUvB;
  vState = aState;
  vFace = aFace;
  vSize = aSize;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const PAPER_FS = /* glsl */ `
precision highp float;
uniform sampler2D tPage;
uniform sampler2D tAlt;
uniform sampler2D tBack;
uniform sampler2D tBehind;
uniform vec2 uRes;
uniform vec3 uCursor;
uniform vec3 uKeyDir;
uniform float uCursorI;
uniform float uHasAlt;
uniform float uHasBack;
uniform float uBehind;
uniform float uLuminous;
uniform float uTime;
varying vec3 vN;
varying vec3 vW;
varying vec2 vL;
varying vec4 vUvA;
varying vec4 vUvB;
varying vec4 vState;
varying float vFace;
varying vec2 vSize;
${NOISE}
${STUDIO}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float nv = max(dot(N, V), 0.0);
  vec2 L = vL;
  bool edge = vFace > 1.5;
  bool back = !edge && vFace > 0.5;
  vec2 pageUv = vUvA.xy + vec2(L.x, 1.0 - L.y) * vUvA.zw;

  // what is printed here
  vec3 pr = vec3(1.0);
  float otherInk = 1.0;
  if (back) {
    if (uHasBack > 0.5) {
      pr = texture2D(tBack, vUvB.xy + vec2(1.0 - L.x, 1.0 - L.y) * vUvB.zw).rgb;
      otherInk = texture2D(tPage, vec2(1.0 - L.x, 1.0 - L.y)).r;
    }
  } else if (!edge) {
    pr = texture2D(tPage, pageUv).rgb;
    if (uHasAlt > 0.5 && vState.x > 0.002) pr = mix(pr, texture2D(tAlt, vUvB.xy + vec2(L.x, 1.0 - L.y) * vUvB.zw).rgb, vState.x);
    if (uHasBack > 0.5) otherInk = texture2D(tBack, vUvB.xy + vec2(1.0 - L.x, 1.0 - L.y) * vUvB.zw).r;
  }

  // the sheet is not perfectly flat: slow waves in its surface make the glare wander
  vec2 sp = pageUv * vec2(5.0, 6.4) + vState.w * 9.0;
  vec3 wob = vec3(vnoise(sp) - 0.5, vnoise(sp + 17.3) - 0.5, 0.0);
  vec3 Np = normalize(N + wob * 0.05);

  vec3 Lc = uCursor - vW;
  float dc2 = dot(Lc, Lc);
  vec3 lc = Lc / sqrt(max(dc2, 1e-4));
  float cAtt = uCursorI / (1.0 + dc2 * 0.1);
  float ndk = dot(Np, uKeyDir);
  float ndc = dot(Np, lc);

  // paper: light on the face, a glow from behind that makes the sheet luminous
  // (brightest at its heart, falling off to its corners), and the print on the
  // other side showing faintly where the light comes through
  vec2 c = (L - 0.5) * vec2(1.0, 1.15);
  float heart = 1.0 - smoothstep(0.1, 0.92, length(c + wob.xy * 0.22));
  float dist = length(cameraPosition - vW);
  float air = smoothstep(0.7, 3.2, dist) * (1.0 - smoothstep(16.0, 60.0, dist) * 0.8);
  float face = 0.05 + 0.34 * smoothstep(-0.3, 1.0, ndk) + max(ndc, 0.0) * cAtt * 0.62;
  float glow = uLuminous * (0.22 + 0.66 * heart);
  float through = max(-ndk, 0.0) * 0.2 + max(-ndc, 0.0) * cAtt * 0.36 + glow * 0.34;
  vec3 albedo = vec3(pow(pr.r, 2.2)) * vec3(0.95, 0.955, 0.965);
  vec3 col = albedo * (face + glow + through * mix(1.0, otherInk, 0.7));

  // what stands behind glows softly through the sheet
  if (uBehind > 0.001 && !edge) {
    vec2 suv = gl_FragCoord.xy / uRes + N.xy * 0.03;
    col += albedo * texture2D(tBehind, suv).rgb * uBehind;
  }

  // a satin coat that catches the room; less of it over the ink, so words stay black
  vec3 R = reflect(-V, Np);
  vec3 env = studio(R);
  float F = 0.03 + 0.97 * pow(1.0 - nv, 5.0);
  float inkKeep = mix(0.3, 1.0, pr.r);
  col += env * F * 0.42 * inkKeep;

  vec3 H = normalize(lc + V);
  float nh = max(dot(Np, H), 0.0);
  col += cAtt * (pow(nh, 26.0) * 0.08 + pow(nh, 240.0) * 0.5) * inkKeep;

  // stamped foil: gloss black. Only the pointer's light makes it flash.
  float foil = 1.0 - pr.g;
  if (foil > 0.01) {
    vec3 f = vec3(0.012) + min(env * 0.22, vec3(0.14)) + cAtt * (pow(nh, 90.0) * 3.2);
    col = mix(col, f, foil);
  }

  // the cut edge, a hair of light around the sheet
  vec2 eL = min(L, 1.0 - L) * vSize;
  float ed = min(eL.x, eL.y);
  float aa = fwidth(ed) * 1.3;
  float rim = 1.0 - smoothstep(0.0, aa + 0.0005, ed);
  col += rim * vState.z * (env * 0.8 + vec3(0.32) + cAtt * 0.7);
  if (edge) col = mix(col, vec3(0.5) + env * 1.3 + cAtt * 2.0, vState.z);

  col *= vState.y * air;
  gl_FragColor = vec4(col, 1.0);
}`;

export const MARK_VS = /* glsl */ `
attribute float aLayer;
uniform vec2 uSize;
uniform float uDepth;
varying vec2 vUv;
varying float vLayer;
varying vec3 vW;
void main() {
  vUv = uv;
  vLayer = aLayer;
  vec3 p = vec3(position.xy * uSize, (aLayer - 1.0) * uDepth);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const MARK_FS = /* glsl */ `
precision highp float;
uniform sampler2D tField;
uniform vec2 uTexel;
uniform float uSpread;
uniform float uBevelPx;
uniform float uBase;
uniform float uLit;
uniform float uSweep;
uniform vec3 uCursor;
uniform vec3 uKeyDir;
uniform float uCursorI;
uniform mat3 uAxes;
uniform vec2 uRes;
uniform vec4 uShade[4];
uniform float uShadeOn;
varying vec2 vUv;
varying float vLayer;
varying vec3 vW;
${NOISE}
${STUDIO}
void main() {
  float s = texture2D(tField, vUv).r;
  float d = (s - 0.5) * 2.0 * uSpread;
  float aa = max(fwidth(d) * 0.75, 0.001);
  float cov = smoothstep(-aa, aa, d);
  if (cov < 0.04) discard;

  vec2 g = vec2(
    texture2D(tField, vUv + vec2(uTexel.x, 0.0)).r - texture2D(tField, vUv - vec2(uTexel.x, 0.0)).r,
    texture2D(tField, vUv - vec2(0.0, uTexel.y)).r - texture2D(tField, vUv + vec2(0.0, uTexel.y)).r
  );
  float gl = length(g);
  g = gl > 1e-5 ? g / gl : vec2(0.0);

  // the front is flat with a bevelled rim; the layers behind it are the wall
  float front = step(0.985, vLayer);
  float bevel = clamp(d / uBevelPx, 0.0, 1.0);
  float slope = (1.0 - bevel) * (1.0 - bevel);
  vec3 nl = front > 0.5 ? normalize(vec3(-g * slope * 1.6, 1.0)) : normalize(vec3(-g, 0.08));
  vec3 N = normalize(uAxes * nl);
  vec3 V = normalize(cameraPosition - vW);
  vec3 R = reflect(-V, N);
  vec3 env = studio(R);

  vec3 Lc = uCursor - vW;
  float dc2 = dot(Lc, Lc);
  vec3 lc = Lc / sqrt(max(dc2, 1e-4));
  float cAtt = uCursorI / (1.0 + dc2 * 0.08);
  float ndc = max(dot(N, lc), 0.0);
  vec3 H = normalize(lc + V);
  float nh = max(dot(N, H), 0.0);

  // satin metal: a body that always reads, with the room and the pointer's light on top
  float key = 0.45 + 0.55 * max(dot(N, uKeyDir), 0.0);
  vec3 body = vec3(0.86, 0.88, 0.92) * uBase * key;
  vec3 col = body + env * (front > 0.5 ? mix(0.5, 0.26, bevel) : 0.75);
  col += cAtt * (ndc * 0.5 + pow(nh, 40.0) * 1.2 + pow(nh, 300.0) * 3.0);
  // a band of light crosses it on arrival
  float band = exp(-pow((vUv.x + vUv.y * 0.35 - uSweep) * 7.0, 2.0));
  col += band * vec3(1.6);
  // the wall falls into shadow away from the front
  if (front < 0.5) col *= mix(0.3, 1.0, vLayer);
  if (uShadeOn > 0.5) {
    vec2 sc = gl_FragCoord.xy / uRes;
    float sh = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 r = uShade[i];
      vec2 q = abs(sc - r.xy) - r.zw;
      float dq = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      sh = max(sh, 1.0 - smoothstep(-0.015, 0.05, dq));
    }
    col *= 1.0 - sh * 0.82;
  }
  col *= uLit;
  gl_FragColor = vec4(col, cov);
}`;

export const DUST_VS = /* glsl */ `
attribute float aSeed;
attribute float aTail;
uniform float uTime;
uniform float uStretch;
uniform float uDpr;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.11 + aSeed * 40.0) * 0.3;
  p.y += cos(uTime * 0.09 + aSeed * 23.0) * 0.22;
  p.z += aTail * uStretch;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vA = clamp(1.4 - depth / 58.0, 0.0, 1.0) * smoothstep(0.4, 2.6, depth);
  vA *= 0.55 + 0.45 * sin(uTime * (0.5 + aSeed * 1.6) + aSeed * 50.0);
  gl_PointSize = clamp((0.7 + aSeed * 1.9) * 34.0 / depth * uDpr, 1.0, 8.0);
  gl_Position = projectionMatrix * mv;
}`;

export const DUST_FS = /* glsl */ `
precision mediump float;
uniform float uGain;
uniform float uLine;
varying float vA;
void main() {
  float a = vA * uGain;
  if (uLine < 0.5) a *= smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vec3(0.82, 0.86, 0.92) * a, a * 0.8);
}`;
