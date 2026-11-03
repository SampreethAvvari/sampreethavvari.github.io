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
  Camera,
  CatmullRomCurve3,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  PlaneGeometry,
  Points,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { Landing } from "./path";
import { breathe } from "../gl-warm";
import { buildFigure, PLAIN_FACE, type FigureFrame } from "./figure";
import { LAST, SCENE } from "./plan";
import { PlateBank } from "./plates";
import type { PointerRay } from "./pieces";
import { GRAIN_A, GRAIN_SLOPE, GRAIN_T, grainData, groundGrids, groundHeight, groundSampler, hash2, moonData, rippleData, rng, STAND, type GroundGrids } from "./bakes";
import BakeWorker from "./bake.worker.ts?worker";
import { loopCount } from "../gl-loop";

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ the baked pictures
// (the arithmetic is in bakes.ts)

const sandMap = (data: Uint8Array, size: number) => {
  const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};
const rippleTexture = (size: number) => sandMap(rippleData(size), size);
const grainTexture = (size: number, cells: number) => sandMap(grainData(size, cells), size);
const bakeGround = (low: boolean) => groundSampler(groundGrids(low));

// ------------------------------------------------------------------ moons

const moonMap = (data: Uint8Array, w: number) => {
  const t = new DataTexture(data, w, w >> 1, RGBAFormat, UnsignedByteType);
  t.wrapS = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
};

// ------------------------------------------------------------------ sky

const SKY_UNIFORMS = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uHorSun;
  uniform vec3 uHorAway;
  uniform vec3 uMid;
  uniform vec3 uTop;
  uniform vec3 uSunCol;
  uniform float uBandW;
  uniform float uAirglow;
  uniform vec2 uRiseDir;
  uniform float uRise;
  uniform vec3 uRiseCol;
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
    // At night a soft airglow lies low down, and the galaxy lights the horizon ahead of its rising.
    c += vec3(0.0075, 0.0165, 0.0115) * exp(-y * 15.0) * uAirglow;
    c += uRiseCol * exp(-y * 10.0) * pow(max(dot(hd, uRiseDir), 0.0), 5.0) * uRise;
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
  #define DETAIL ${layers >= 4 ? 1 : 0}
  ${SKY_UNIFORMS}
  uniform float uCover;
  uniform float uStars;
  uniform float uTime;
  uniform float uSunCos;
  uniform vec3 uRingN;
  uniform vec3 uRingA;
  uniform vec3 uRingB;
  uniform sampler2D tNoise;
  uniform vec2 uRes;
  uniform float uTall;
  uniform float uRing;
  uniform float uMilky;
  uniform vec3 uGalN;
  uniform vec3 uGalA;
  uniform vec3 uGalB;
  uniform mat3 uSkyRot;
  uniform vec3 uShift;
  uniform float uTwinkle;
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
    return texture2D(tNoise, (i + f + 0.5) / 256.0).r;
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
    // Behind the words the sky drops back so they stay readable.
    vec2 scr = gl_FragCoord.xy / uRes;
    float copyDim = mix(0.28, 1.0, uTall > 0.5 ? smoothstep(0.42, 0.66, scr.y) : smoothstep(0.26, 0.56, scr.x));
    // And in the corner behind the chapter list.
    if (uTall < 0.5) copyDim *= 1.0 - 0.6 * smoothstep(0.76, 0.9, scr.x) * smoothstep(0.42, 0.62, scr.y);
    float bandK = 0.0;
    // Everything fixed to the stars turns with the planet. The ground, drawn after, hides what has gone under it.
    vec3 sd = uSkyRot * d;
    float pxD = length(fwidth(d));
    if (uMilky > 0.001 && d.y > -0.05) {
      float g = dot(sd, uGalN);
      float lon = atan(dot(sd, uGalA), dot(sd, uGalB));
      vec2 wp = vec2(lon * 2.0, g * 5.0);
      float w1 = vnoise(wp + 11.0) - 0.5;
      float w2 = vnoise(wp * 2.3 + 4.0) - 0.5;
      float gg = g + w1 * 0.018 + w2 * 0.006;
      float core = exp(-lon * lon / 0.45);
      // It thins out around the far side of the sky, so that it can truly set.
      float reach = exp(-lon * lon / 1.2);
      float body = exp(-gg * gg / (0.016 + 0.032 * core));
      float halo = exp(-g * g / 0.2) * reach;
      float bulge = exp(-lon * lon / 0.16 - gg * gg / 0.013);
      // Dust along the centre line: mottled and soft, branching and fraying, nothing long or streaked.
      vec2 lp = vec2(lon * 17.0 + w2 * 3.0, gg * 27.0 + w1 * 2.5);
      vec2 lw = vec2(vnoise(lp * 0.55 + 17.0), vnoise(lp * 0.55 + 43.0)) - 0.5;
      vec2 lq = lp + lw * 1.5;
      float n1 = vnoise(lq);
      float n2 = vnoise(lq * 2.07 + 3.7);
      float n3 = vnoise(lq * 4.3 + 1.3);
      #if DETAIL
      float lanes = n1 * 0.46 + n2 * 0.26 + n3 * 0.15 + vnoise(lq * 8.9 + 8.1) * 0.08 + vnoise(lq * 18.1 + 5.3) * 0.05;
      #else
      float lanes = n1 * 0.52 + n2 * 0.3 + n3 * 0.18;
      #endif
      float thread = 1.0 - abs(2.0 * n2 - 1.0);
      float lane = clamp(smoothstep(0.42, 0.66, lanes) * exp(-gg * gg / (0.0048 + 0.007 * core)) * (0.75 + 0.5 * thread), 0.0, 1.0);
      // Light reddens where it comes through the edge of the dust.
      float rimDust = smoothstep(0.3, 0.5, lanes) * (1.0 - smoothstep(0.5, 0.66, lanes)) * exp(-gg * gg / 0.012);
      // Soft mottling of stars too small to see one by one.
      float cloud = vnoise(vec2(lon * 24.0, g * 36.0) + 5.0) * 0.5 + vnoise(vec2(lon * 55.0, g * 80.0) + 2.0) * 0.3 + vnoise(vec2(lon * 120.0, g * 170.0) + 9.0) * 0.2;
      float dens = (body * 0.55 + body * body * 0.45) * (0.42 * reach + 0.95 * core) * (0.72 + 0.56 * cloud);
      float glow = (dens + halo * 0.05 + bulge * 0.62) * (1.0 - lane * 0.8);
      // Cool at the edges, warm toward the core, a soft gold at its heart.
      vec3 mw = mix(vec3(0.32, 0.45, 1.0), vec3(1.0, 0.68, 0.38), core * smoothstep(0.08, 0.9, body));
      mw = mix(mw, vec3(1.0, 0.74, 0.42), bulge);
      float tint = vnoise(vec2(lon * 9.0, g * 26.0) + 21.0);
      mw = mix(mw, vec3(0.95, 0.44, 0.5), smoothstep(0.58, 0.86, tint) * 0.36 * body);
      mw = mix(mw, vec3(0.6, 0.74, 1.0), smoothstep(0.14, 0.42, 0.5 - abs(tint - 0.5)) * 0.14 * body * (1.0 - core));
      mw *= mix(vec3(1.0), vec3(1.08, 0.76, 0.56), rimDust * 0.5);
      // It runs right down to the land, dimmed by the air it comes through low down.
      float above = smoothstep(-0.008, 0.03, d.y) * (0.5 + 0.5 * smoothstep(0.0, 0.2, d.y));
      // Dark and calm: on a tall screen the lens sees less sky at once, so it holds back a little more.
      c += mw * glow * (uTall > 0.5 ? 0.082 : 0.112) * uMilky * above * copyDim;
      #if DETAIL
      // Small pink knots of gas along the band.
      float knot = smoothstep(0.7, 0.92, vnoise(vec2(lon * 46.0, g * 130.0) + 7.0));
      c += vec3(0.9, 0.36, 0.42) * knot * knot * body * (1.0 - lane) * 0.014 * uMilky * above * copyDim;
      #endif
      // Star dust: thousands of tiny points, thickest in the band, thinner in the lanes.
      float dustK = clamp(dens * 1.3 + halo * 0.06, 0.0, 1.0) * (1.0 - lane * 0.7);
      for (int k = 0; k < ${loopCount("DUST_LAYERS")}; k++) {
        float scale = 1000.0 + float(k) * 640.0;
        vec3 did = floor(sd * scale);
        float dh = hash13(did + float(k) * 41.0);
        if (dh > 0.9965 - dustK * 0.085) {
          float pw2 = hash13(did + 7.7);
          vec3 qq = fract(sd * scale) - 0.5;
          // Never finer than a pixel, so a slow turn does not make them crawl.
          float rr = max(0.5, pxD * scale * 0.75);
          float dot2 = smoothstep(rr, rr * 0.16, length(qq)) * min(1.0, 0.25 / (rr * rr));
          c += mix(vec3(0.74, 0.8, 1.0), vec3(1.0, 0.86, 0.68), hash13(did + 3.3)) * dot2 * (0.007 + pw2 * pw2 * pw2 * pw2 * 0.5) * uMilky * above * copyDim;
        }
      }
      bandK = clamp(body * (1.0 - lane * 0.9) * (0.4 + 0.6 * reach) + halo * 0.15, 0.0, 1.0) * uMilky;
    }
    // Stars: the first ones through the upper sky, then all of them, thick along the band.
    if (uStars > 0.001 && yy > 0.004) {
      float fade = smoothstep(0.004, 0.09, yy) * mix(smoothstep(0.1, 0.5, yy), 1.0, smoothstep(0.5, 1.0, uStars));
      // They twinkle only low down, where there is air to look through.
      float airy = exp(-yy * 9.0) * uTwinkle;
      for (int i = 0; i < ${loopCount("STAR_LAYERS")}; i++) {
        float fi = float(i);
        float dens = 150.0 + fi * 140.0;
        // The nearest of them shift a little against the rest as the pointer moves: there is depth up there.
        vec3 sdn = uSkyRot * normalize(d + uShift * (1.0 - fi * 0.3));
        vec3 sdv = sdn * dens;
        vec3 id = floor(sdv);
        float h = hash13(id + fi * 17.0);
        float thr = 0.989 - fi * 0.003 - bandK * 0.012;
        if (h > thr) {
          vec3 q = fract(sdv) - 0.5;
          vec3 off = vec3(hash13(id + 3.1), hash13(id + 5.7), hash13(id + 9.3)) - 0.5;
          float sz = max(0.34 - fi * 0.04, pxD * dens * 1.1);
          float st = smoothstep(sz, 0.0, length(q - off * 0.3));
          float pw = (h - thr) / (1.0 - thr);
          float tw = mix(1.0, 0.5 + 0.5 * sin(uTime * (1.5 + h * 5.0) + h * 60.0), airy);
          vec3 tintS = mix(vec3(0.74, 0.82, 1.0), vec3(1.0, 0.82, 0.62), hash13(id + 13.7));
          c += tintS * st * st * tw * (0.06 + pw * pw * 1.5) * uStars * fade * (fi > 1.5 ? 0.6 : 1.0) * mix(1.0, copyDim, smoothstep(0.5, 1.0, uStars));
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
    gl_PointSize = clamp(size, 1.0 * uDpr, 5.0 * uDpr);
    gl_Position = projectionMatrix * mv;
    vec3 toP = normalize(p - uCam);
    float mu = max(dot(toP, uSun), 0.0);
    vLit = 0.14 + 0.5 * pow(mu, 10.0) + 0.2 * pow(mu, 2.0);
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
const EXIT_POS = new Vector3(0, 1.0, 18);
const EXIT_LOOK = new Vector3(-9.7, 4.6, -60);
const WIDE_POS = new Vector3(0, 0, -94); // height comes from the ground below
const WIDE_YAW = (-8 * Math.PI) / 180;
const WIDE_PITCH = (6.4 * Math.PI) / 180;
const MOON_ANCHOR = new Vector3(0, 0, -80);
/** One source pixel of the hand plate: a macro frame about 23 cm tall. */
const HAND_PU = 0.0002;
/** The closing camera: its height over the sand and its distance from the sapling. */
const CLOSE_H = 0.06;
const CLOSE_D = 0.48;
/** The hand leans over, turned in the frame around the fingertip, in radians. */
const HAND_TILT = (-29 * Math.PI) / 180;
/** How far the lamp sits in front of the hand, along the view, so it can throw the hand's shadow. */
const LAMP_FRONT = 0.07;
/** The small lamp on the wrist ring in the night plate, in source pixels. */
const WRIST_LED = [1365, 272];
/** The arm past the edge of the night plate, in source pixels: two points just inside its edges, where it heads, how far. */
const ARM_L = [1465, 120];
const ARM_R = [1615, 365];
const ARM_DIR = [0.7, -0.714];
const ARM_LEN = 2600;
/** Where the hand starts from out of frame, and the way it leaves: right and up from the fingertip, in units, then how far the wrist swings. */
const HAND_IN = [0.34, 0.22];
const HAND_OUT = [0.25, 0.34, -0.62];

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
  uniform vec3 uRim;
  uniform vec2 uTexel;
  uniform vec2 uFocus;
  uniform float uBlur;
  uniform float uFall;
  uniform float uEdge;
  uniform vec3 uLampDir;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    // Depth of field on the card: sharp at the focus, softer away from it, never finer than a screen pixel.
    float px = max(fwidth(vUv.x), fwidth(vUv.y));
    float rad = max(uBlur * smoothstep(0.08, 0.6, distance(vUv, uFocus)), px * 0.62);
    vec4 t = texture2D(tMap, vUv);
    if (rad > 0.0002) {
      vec4 acc = t;
      for (int i = 0; i < 6; i++) {
        float ang = float(i) * 1.0472;
        acc += texture2D(tMap, vUv + vec2(cos(ang), sin(ang)) * rad);
      }
      t = acc / 7.0;
    }
    // The matte's edge, softened a little.
    float a = smoothstep(0.1, 0.92, t.a) * uOp;
    a *= mix(1.0, smoothstep(0.0, 0.1, vUv.y) * smoothstep(0.0, 0.07, 1.0 - vUv.x), uEdge);
    if (a < 0.004) discard;
    vec3 c = t.rgb;
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    // The shadows take the colour of the sky; what stays of the plate's own
    // light is what the hour still has.
    vec3 relit = l * uShadow * 1.2;
    vec3 kept = c * uHigh;
    vec3 col = mix(relit, kept, uKeep * smoothstep(0.015, 0.2, l)) * uGain;
    // Starlight on what the lamp misses. The wrist lamp falls away with distance from it,
    // and shines down along the hand, not back up the arm.
    col *= uFall;
    vec3 dl = vWorld - uLampWorld;
    float dd = dot(dl, dl);
    float cone = smoothstep(-0.1, 0.45, dot(dl / max(sqrt(dd), 1e-4), uLampDir));
    float lamp = uLampR * uLampR / (uLampR * uLampR + dd) * cone;
    // What the plate holds of the surface keeps its shape; its colour cast goes.
    col += (mix(c, vec3(l), 0.6) * 1.6 + 0.004) * uLampCol * lamp;
    // A thin rim where the sky's light wraps his edge.
    float aR = texture2D(tMap, vUv + vec2(uTexel.x, 0.0)).a;
    float aL = texture2D(tMap, vUv - vec2(uTexel.x, 0.0)).a;
    float aD = texture2D(tMap, vUv + vec2(0.0, uTexel.y)).a;
    float aU = texture2D(tMap, vUv - vec2(0.0, uTexel.y)).a;
    float na = min(min(aR, aL), min(aD, aU));
    float rim = clamp((t.a - na) * 2.2, 0.0, 1.0);
    // Close up the sky's light only catches the edges that face up, and never the plate's cut edges.
    float up = smoothstep(-0.2, 0.7, (aD - aU) * 2.0 - (aR - aL) * 0.9);
    rim *= mix(1.0, up * smoothstep(0.08, 0.22, vUv.y) * smoothstep(0.06, 0.2, 1.0 - vUv.x), uEdge);
    col += uRim * rim;
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

// Wind, in gusts, and the small dip when the finger touches, springing back. The shadow pass moves with it.
const SAP_SWAY = /* glsl */ `
  uniform float uTime;
  uniform float uTouch;
  uniform vec2 uPress;
  vec3 swayed(vec3 q, float k) {
    // The leaf under his finger goes where the fingertip takes it.
    q.xy += uPress * smoothstep(0.0026, 0.0105, q.x);
    float gust = sin(uTime * 1.1) * 0.5 + sin(uTime * 2.7 + 1.0) * 0.3 + sin(uTime * 6.1) * 0.08;
    float bend = k * k * (0.0022 + 0.0022 * gust);
    q.x += bend;
    q.z += k * k * 0.0008 * sin(uTime * 1.7 + 2.0);
    float dip = uTouch * uTouch * sin(uTouch * 18.0) * 0.0016 + uTouch * 0.0014;
    q.y -= k * k * dip;
    q.x -= k * k * uTouch * 0.0018;
    return q;
  }
`;

const SAP_VS = /* glsl */ `
  ${SAP_SWAY}
  uniform vec3 uSapOrigin;
  uniform vec3 uLampSite;
  uniform vec3 uCamSite;
  attribute float aBend;
  attribute vec2 aLeaf;
  varying vec2 vLeaf;
  varying vec3 vN;
  varying vec3 vL;
  varying vec3 vV;
  varying float vT;
  void main() {
    vec3 p = swayed(position, aBend);
    vec3 site = p + uSapOrigin;
    vL = uLampSite - site;
    vV = uCamSite - site;
    vN = normal;
    vT = aBend;
    vLeaf = aLeaf;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// The seedling flattened onto the sand along the rays from the lamp, into a small patch around its foot.
const SAP_SHADOW_VS = /* glsl */ `
  ${SAP_SWAY}
  uniform vec3 uSapOrigin;
  uniform vec3 uLampSite;
  uniform float uPatch;
  attribute float aBend;
  void main() {
    vec3 site = swayed(position, aBend) + uSapOrigin;
    float over = (uLampSite.y - uSapOrigin.y) / max(uLampSite.y - site.y, 1e-4);
    vec3 g = uLampSite + (site - uLampSite) * over;
    gl_Position = vec4((g.xz - uSapOrigin.xz) / uPatch, 0.0, 1.0);
  }
`;

const SAP_FS = /* glsl */ `
  uniform vec3 uAmb;
  uniform vec3 uKey;
  uniform vec3 uSunDir;
  uniform vec3 uLampCol;
  uniform vec3 uCool;
  varying vec3 vN;
  varying vec3 vL;
  varying vec3 vV;
  varying float vT;
  varying vec2 vLeaf;
  void main() {
    float leaf = smoothstep(0.84, 0.88, vT);
    // A pale midrib, side veins, a darker edge: fine detail on a tiny leaf.
    float across = abs(vLeaf.y);
    float midrib = smoothstep(0.16, 0.0, across);
    float veins = smoothstep(0.86, 1.0, sin(vLeaf.x * 26.0 - across * 7.0)) * (1.0 - across);
    vec3 leafCol = mix(vec3(0.14, 0.24, 0.05), vec3(0.24, 0.36, 0.08), 1.0 - across);
    leafCol = mix(leafCol, vec3(0.34, 0.44, 0.13), midrib * 0.8 + veins * 0.32);
    leafCol = mix(leafCol, vec3(0.1, 0.14, 0.035), smoothstep(0.72, 1.0, across) * 0.7);
    vec3 green = mix(vec3(0.075, 0.09, 0.035), leafCol, leaf);
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    if (dot(n, v) < 0.0) n = -n;
    float nl = abs(dot(n, normalize(uSunDir)));
    vec3 col = green * (uAmb * 1.1 + uKey * (0.3 + nl));
    // Sun through the leaves while there still is any.
    col += green * uKey * 0.7 * leaf;
    // The wrist lamp, by the same falloff as the sand.
    vec3 L = normalize(vL);
    float e = 0.0085 / (dot(vL, vL) + 0.0016);
    float ndl = dot(n, L);
    // The side toward it lit, the stem wrapped a little.
    col += green * uLampCol * mix(max(ndl * 0.6 + 0.4, 0.0), max(ndl, 0.0), leaf) * e * 1.6;
    // Through the thin leaf when it is lit from the far side, brightest where the blade is thinnest.
    float thin = 1.0 - 0.5 * midrib;
    col += leafCol * vec3(1.5, 1.75, 0.6) * uLampCol * leaf * (max(-ndl, 0.0) * 1.5 + 0.28) * thin * e * 1.6;
    // A small bright glint on the leaf.
    vec3 h = normalize(L + v);
    col += uLampCol * pow(max(dot(n, h), 0.0), 90.0) * leaf * e * 0.7;
    // The dark side, rimmed faintly by cool starlight.
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col += uCool * (0.35 + fres) * (1.0 - smoothstep(0.0, 0.5, ndl * e));
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** A seedling, in its own space: base at the origin, y up, two small leaves at the top. */
function saplingGeometry(H: number) {
  const P: number[] = [];
  const N: number[] = [];
  const B: number[] = [];
  const I: number[] = [];
  const U: number[] = [];
  const add = (x: number, y: number, z: number, nx: number, ny: number, nz: number, b: number, ua = 0, ub = 0) => {
    P.push(x, y, z);
    N.push(nx, ny, nz);
    B.push(b);
    U.push(ua, ub);
    return P.length / 3 - 1;
  };
  // Stem: a thin tapered tube with a slight lean.
  const STEM = 8;
  const SIDES = 5;
  for (let i = 0; i <= STEM; i++) {
    const t = i / STEM;
    const lean = t * t * H * 0.1;
    const rad = lerp(0.00042, 0.00024, t);
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
    const RES = 10;
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
        add(topX + dirX * along + -dirZ * cross * 0.72, y + cup + side * w * 0.62, dirZ * along + dirX * cross * 0.72, 0, 1, 0, 0.86 + t * 0.14, t, side);
      }
    }
    for (let i = 0; i < RES; i++) {
      for (let j = 0; j < 2; j++) {
        const a = start + i * 3 + j;
        I.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      }
    }
  };
  leaf(0.94, 0.34, H * 0.4, H * 0.13, 0.46);
  leaf(-0.92, -0.3, H * 0.34, H * 0.115, 0.56);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(P), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(N), 3));
  g.setAttribute("aBend", new BufferAttribute(new Float32Array(B), 1));
  g.setAttribute("aLeaf", new BufferAttribute(new Float32Array(U), 2));
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
  /** Drawing buffer size. */
  width: number;
  height: number;
  /** The journey's progress, which decides every pose. */
  p: number;
  /** The way the visitor is going, 1 or -1, and the blend that turns on it: 0 going on, 1 coming back. */
  dir: number;
  back: number;
  /** Chapters per second, signed. */
  v: number;
}

export interface Surface {
  group: Group;
  /** Hidden until the story needs them, and worth linking ahead with everything else. */
  warmParts: Group[] | Mesh[] | (Group | Mesh)[];
  /** Made ahead of when the story needs them, so they can go to the GPU ahead too. */
  lateTextures: Texture[];
  /** 1 to 0 as the ground goes out of focus in the closeup: softens the moons. */
  setSoft(v: number): void;
  /** Unit vector toward the sun, in world space. */
  sunWorld: Vector3;
  /** Where the ground's light comes from now: the sun, then at night the galaxy, wherever it has turned to. */
  keyWorld: Vector3;
  sunColor: Color;
  /** How the sky should light the craft. */
  skyLight: Color;
  groundLight: Color;
  /** Colour for the scene's fog. */
  hazeColor: Color;
  dispose(): void;
  /** The ground at the seedling, where the closing shot is focused. */
  focusWorld: Vector3;
  /** Draws the seedling's shadow from the wrist lamp. Call before the frame. */
  lampPass(renderer: WebGLRenderer): void;
  /** Where the camera should be at surface progress s, in world space. */
  shot(s: number, portrait: boolean, out: SurfaceShot): SurfaceShot;
  update(f: SurfaceInput): void;
  /** The visitor, on the scene: x and y from -1 to 1, and the pointer's ray in world space. */
  interact(kind: "hover" | "press" | "drag" | "release", x: number, y: number, ray: PointerRay): void;
  /** For checks in development: where his feet are and which are down. */
  debug(): unknown;
  /** Where he is, in world space. */
  figureAt(out: Vector3): Vector3;
  arms(): unknown;
  /** For checks in development: force the sky's turn, and read it. */
  setSky(a: number): void;
  skyNow(): unknown;
}

// The two slowest pictures to compute, made ahead of the rest with the page's
// turn between them. buildSurface takes them from here.
let readyGround: ReturnType<typeof bakeGround> | null = null;
let readyRipple: DataTexture | null = null;
let readyGrain: DataTexture | null = null;
const readyMoons = new Map<string, DataTexture>();
type Baked = { ground: GroundGrids; ripple: Uint8Array; grain: Uint8Array; moons: Uint8Array[] };
// Kept for the next time the world is built on this visit, so coming back to the page does not work it all out again.
let baked: { low: boolean; out: Baked } | null = null;

function bakeAway(low: boolean, ripple: number, grain: [number, number], moons: [number, number][]): Promise<Baked | null> {
  return new Promise((done) => {
    let w: Worker;
    try {
      w = new BakeWorker();
    } catch {
      done(null);
      return;
    }
    const finish = (out: Baked | null) => {
      clearTimeout(cap);
      w.terminate();
      done(out);
    };
    const cap = window.setTimeout(() => finish(null), 15000);
    w.onmessage = (e: MessageEvent<Baked>) => finish(e.data);
    w.onerror = () => finish(null);
    w.postMessage({ low, ripple, grain, moons });
  });
}
export async function prepareSurface(low: boolean) {
  const ripple = low ? 256 : 512;
  const grain: [number, number] = [low ? 384 : 512, low ? 40 : 52];
  const moons: [number, number][] = [[low ? 128 : 256, 7], [low ? 96 : 128, 19]];
  // Away from this thread where the browser can, with the page's turn kept; here if not.
  if (!baked || baked.low !== low) {
    const out = await bakeAway(low, ripple, grain, moons);
    if (out) baked = { low, out };
  }
  if (baked) {
    const { ground, ripple: r, grain: g, moons: m } = baked.out;
    readyGround = groundSampler(ground);
    readyRipple = sandMap(r, ripple);
    readyGrain = sandMap(g, grain[0]);
    moons.forEach(([w, seed], i) => readyMoons.set(`${w}:${seed}`, moonMap(m[i], w)));
    return;
  }
  readyGround = bakeGround(low);
  await breathe();
  readyRipple = rippleTexture(ripple);
  await breathe();
  readyGrain = grainTexture(grain[0], grain[1]);
  await breathe();
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
    uAirglow: { value: 0 },
    uRiseDir: { value: new Vector2(0, -1) },
    uRise: { value: 0 },
    uRiseCol: { value: new Color(0.058, 0.044, 0.036) },
  };
  const cover = { value: 0 };
  const camSite = { value: new Vector3() };
  const uTime = { value: 0 };

  // ------------------------------------------------------------ sky dome
  const noiseTex = (() => {
    const N = 256;
    const d = new Uint8Array(N * N * 4);
    for (let k = 0; k < N * N; k++) d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = d[k * 4 + 3] = Math.floor(r() * 256);
    const t = new DataTexture(d, N, N, RGBAFormat, UnsignedByteType);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.magFilter = LinearFilter;
    t.minFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  })();
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
      tNoise: { value: noiseTex },
      uRes: { value: new Vector2(1, 1) },
      uTall: { value: 0 },
      uRing: { value: 1 },
      uMilky: { value: 0 },
      uGalN: { value: galN },
      uGalA: { value: galA },
      uGalB: { value: galB },
      uSkyRot: { value: new Matrix3() },
      uShift: { value: new Vector3() },
      uTwinkle: { value: 1 },
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
    const key = `${o.tex}:${o.seed}`;
    const map = readyMoons.get(key) ?? moonMap(moonData(o.tex, o.seed), o.tex);
    readyMoons.delete(key);
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
    moon({ radius: 44, dist: 700, az: -3, el: 11, seed: 7, tex: low ? 128 : 256, drift: 0.0009, body: 0.2, look: [0.3, 0.72, 0.14, 0.5], pale: 0.82, shade: 0.66 }),
    // Far: smaller, hazier, close to the sun, so only a thin arc shows.
    moon({ radius: 63, dist: 1650, az: 9.7, el: 13.2, seed: 19, tex: low ? 96 : 128, drift: -0.0016, body: 0.1, look: [0.22, 0.42, 0.32, 0.9], pale: 0.56, shade: 0.8 }),
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
  const baked = readyGround ?? bakeGround(low);
  readyGround = null;
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

  const ripple = readyRipple ?? rippleTexture(low ? 256 : 512);
  readyRipple = null;
  const sand = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0, envMapIntensity: 0.0, transparent: true, fog: false });
  const sandU = { tRipple: { value: ripple }, uCamSite: camSite, uCover: cover, uHazeD: { value: 2400 }, uAmbient: { value: new Color() }, uSunK: { value: 1 }, uFormK: { value: 1 }, uNight: { value: 0 }, uLampSite: { value: new Vector3() }, uLampCol: { value: new Color(0, 0, 0) }, uRipK: { value: 1 }, uLongK: { value: 0 }, uSapO: { value: new Vector3() }, uLampDir: { value: new Vector3(0, -1, 0) }, tGrain: { value: null as DataTexture | null }, tSapShadow: { value: null as Texture | null }, uSapPatch: { value: 0.09 }, tHand: { value: null as Texture | null }, uHandOn: { value: 0 }, uHandC: { value: new Vector3() }, uHandR: { value: new Vector3() }, uHandU: { value: new Vector3() }, uHandN: { value: new Vector3() }, uHandK: { value: new Vector2() } };
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
        uniform float uFormK;
        uniform float uNight;
        uniform vec3 uLampSite;
        uniform vec3 uLampCol;
        uniform float uRipK;
        uniform float uLongK;
        uniform vec3 uSapO;
        uniform vec3 uLampDir;
        uniform sampler2D tGrain;
        uniform sampler2D tSapShadow;
        uniform float uSapPatch;
        uniform sampler2D tHand;
        uniform float uHandOn;
        uniform vec3 uHandC;
        uniform vec3 uHandR;
        uniform vec3 uHandU;
        uniform vec3 uHandN;
        uniform vec2 uHandK;
        uniform mat3 normalMatrix;
        ${SKY_UNIFORMS}
        ${SKY_FN}
        vec3 sandGrad;
        vec3 sandLit;
        float sandH;
        float sandGrain;
        float sandTone;
        vec2 sandSlope;
        vec2 sandQ;
        vec2 sandQx;
        vec2 sandQy;
        const mat2 RIP_M = mat2(0.82, 0.57, -0.57, 0.82);
        const float GRAIN_T = ${GRAIN_T.toFixed(4)};
        const float GRAIN_A = ${GRAIN_A.toFixed(5)};
        const float RIP_F = 1.1;
        const float RIP_A = 0.0011;
        // How high the sand stands at a point: grains on small ripples.
        float reliefH(vec2 q) {
          return textureGrad(tGrain, q / GRAIN_T, sandQx / GRAIN_T, sandQy / GRAIN_T).b * GRAIN_A
            + textureGrad(tRipple, RIP_M * q * RIP_F, RIP_M * sandQx * RIP_F, RIP_M * sandQy * RIP_F).b * RIP_A;
        }`,
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
          // Right down on the sand the ripples are far too big to read: it lies calm.
          float calm = smoothstep(0.05, 0.5, abs(toFrag.y));
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
          float fa = seen * (1.0 - smoothstep(4.0, 40.0, dist)) * mix(0.35, 1.0, patchy) * high * calm * uRipK;
          float fb = seen * (1.0 - smoothstep(14.0, 120.0, dist)) * mix(0.2, 1.0, patchy) * high * calm * uRipK;
          // Sand grain, right at the lens only.
          float gn = (texture2D(tRipple, uv * 2.7).a - 0.5) * 0.7 + (texture2D(tRipple, uv * 11.0).a - 0.5) * 0.9 + (texture2D(tRipple, uv * 31.0).a - 0.5) * 1.3;
          float fg = (1.0 - smoothstep(0.3, 2.6, dist)) * calm * (1.0 - smoothstep(0.2, 0.55, uNight));
          // The sand itself, close up: grains on small ripples, real relief for the lamp to rake across.
          sandQ = vSite.xz - uSapO.xz;
          sandQx = dFdx(sandQ);
          sandQy = dFdy(sandQ);
          sandSlope = vec2(0.0);
          sandGrain = 0.0;
          sandTone = 0.5;
          float gk = (1.0 - smoothstep(0.1, 0.24, abs(toFrag.y))) * (1.0 - smoothstep(0.55, 1.5, dist)) * smoothstep(0.05, 0.16, dist);
          float rk = 1.0 - smoothstep(0.9, 2.4, dist);
          if (rk > 0.002) {
            vec4 gt = textureGrad(tGrain, sandQ / GRAIN_T, sandQx / GRAIN_T, sandQy / GRAIN_T);
            vec4 rt = textureGrad(tRipple, RIP_M * sandQ * RIP_F, RIP_M * sandQx * RIP_F, RIP_M * sandQy * RIP_F);
            vec2 rs = (rt.xy * 255.0 - 128.0) / 300.0 * RIP_A * ${(low ? 256 : 512).toFixed(1)} * RIP_F * 0.5;
            sandSlope = ((gt.xy * 255.0 - 128.0) / 127.0 * ${GRAIN_SLOPE.toFixed(2)} + transpose(RIP_M) * rs) * rk;
            sandTone = gt.a;
            sandGrain = (gt.a - 0.5) * gk;
          }
          // Rotate the slopes back into site space.
          vec2 g1 = (a.xy - 0.5) * 0.8 * fa + (b.xy - 0.5) * 0.6 * fb;
          vec2 g = vec2(ca * g1.x + sa * g1.y, -sa * g1.x + ca * g1.y);
          sandGrad = vec3(g.x, 0.0, g.y) * 1.25;
          sandH = (a.z - 0.5) * fa * 0.28 + (b.z - 0.5) * fb * 0.2 + (field - 0.5) * 0.7 + gn * fg * mix(0.5, 1.1, uNight);
          diffuseColor.rgb = mix(vec3(0.5, 0.27, 0.11), vec3(0.8, 0.48, 0.2), clamp(0.5 + sandH * 0.8, 0.0, 1.0));
          sandLit = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.34))), 0.38);
          // Broad forms: faces toward the low sun lift, lee sides and long shadows sink.
          float face = dot(normalize(vSiteN.xz + 1e-4) * length(vSiteN.xz), normalize(uSun.xz + 1e-4));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.34))) * vec3(0.84, 0.92, 1.16) * (1.0 + 1.5 * gn * fg), uNight);
          diffuseColor.rgb *= mix(1.0, clamp(0.84 + face * 9.5, 0.5, 1.5) * mix(0.5, 1.0, vShade), uFormK);
          // Long soft forms lying across the plain, and the ground falling away from the lens, faint at dusk.
          float longF = texture2D(tRipple, uv * vec2(0.0052, 0.031) + 0.7).a * 0.6 + texture2D(tRipple, uv * vec2(0.0023, 0.013) + 0.2).a * 0.4;
          diffuseColor.rgb *= 1.0 + ((longF - 0.5) * 1.1 + (smoothstep(2.0, 90.0, dist) - 1.0) * 0.28) * uLongK;
          // Fine grains, close to the lens.
          diffuseColor.rgb *= 1.0 + gn * fg * 1.15 + sandGrain * 0.9;
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
        {
        totalEmissiveRadiance += diffuseColor.rgb * uAmbient;
        // The wrist lamp: one small light, its falloff by distance and angle, nothing painted.
        if (uLampCol.r > 0.0005) {
          vec3 toL = uLampSite - vSite;
          float d2 = dot(toL, toL);
          if (d2 < 1.6) {
            vec3 L = toL / sqrt(d2);
            vec3 nr = normalize(vec3(-sandSlope.x, 1.0, -sandSlope.y));
            float ndl = max(dot(nr, L), 0.0);
            // It points down along the hand, with an edge too wide to ever see.
            float beam = mix(0.35, 1.0, smoothstep(-0.2, 0.75, dot(-L, uLampDir)));
            // Tiny shadows on the far side of every grain and ripple: walk toward the lamp and see what stands in the way.
            float micro = 1.0;
            vec2 run = L.xz / max(L.y, 0.03);
            float h0 = reliefH(sandQ);
            for (int i = 1; i <= ${low ? 2 : 4}; i++) {
              float rise = 0.00016 * float(i * i) * ${low ? "2.0" : "1.0"};
              float over = reliefH(sandQ + run * rise) - (h0 + rise);
              micro = min(micro, 1.0 - smoothstep(0.0, 0.00018 + rise * 0.4, over));
            }
            // The hand's shadow: the ray from here to the lamp, through the plate that holds his hand.
            float hand = 0.0;
            if (uHandOn > 0.5) {
              float den = dot(toL, uHandN);
              float t = abs(den) > 1e-5 ? dot(uHandC - vSite, uHandN) / den : -1.0;
              if (t > 0.0 && t < 1.0) {
                vec3 hp = vSite + toL * t - uHandC;
                vec2 huv = vec2(dot(hp, uHandR), dot(hp, uHandU)) + 0.5;
                huv.y = 1.0 - huv.y;
                if (huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0) {
                  // The lamp has a size, so the further the sand is below the hand the softer the edge.
                  vec2 pr = uHandK * 0.009 * max(t, 0.3);
                  float occ = textureLod(tHand, huv, 0.0).a;
                  for (int i = 0; i < ${low ? 4 : 8}; i++) {
                    float a = float(i) * 2.399963;
                    float rr = sqrt((float(i) + 0.5) / ${low ? "4.0" : "8.0"});
                    occ += textureLod(tHand, huv + vec2(cos(a), sin(a)) * pr * rr, 0.0).a;
                  }
                  hand = occ / ${low ? "5.0" : "9.0"} * smoothstep(0.0, 0.05, t * length(toL)) * 0.92;
                }
              }
            }
            // The seedling's shadow, drawn from its own swaying geometry, softer the further it falls from the stem.
            float plant = 0.0;
            vec2 suv = sandQ / uSapPatch * 0.5 + 0.5;
            if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {
              float along = length(sandQ);
              float pr = mix(0.0002, 0.0024, smoothstep(0.0, 0.03, along)) / (2.0 * uSapPatch);
              float occ = textureLod(tSapShadow, suv, 0.0).r;
              for (int i = 0; i < ${low ? 4 : 8}; i++) {
                float a = float(i) * 2.399963;
                float rr = sqrt((float(i) + 0.5) / ${low ? "4.0" : "8.0"});
                occ += textureLod(tSapShadow, suv + vec2(cos(a), sin(a)) * pr * rr, 0.0).r;
              }
              plant = occ / ${low ? "5.0" : "9.0"};
              plant = max(plant, smoothstep(0.0026, 0.0006, along) * 0.75);
            }
            float seen = (1.0 - hand) * (1.0 - plant) * micro;
            float e = 0.0085 * ndl * beam * seen / (d2 + 0.0016) * (1.0 - smoothstep(0.7, 1.26, sqrt(d2)));
            totalEmissiveRadiance += sandLit * (0.75 + sandTone * 0.5) * uLampCol * e;
            // Here and there a grain throws the lamp back.
            vec3 hv = normalize(L + normalize(uCamSite - vSite));
            float glint = pow(max(dot(nr, hv), 0.0), 60.0) * smoothstep(0.72, 0.9, sandTone);
            totalEmissiveRadiance += uLampCol * glint * 0.012 * beam * seen / (d2 + 0.0016);
          }
        }
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
  const widePos = site(WIDE_POS.x, Math.max(gh(STAND.x, STAND.z), gh(WIDE_POS.x, WIDE_POS.z)) + 0.34, WIDE_POS.z);
  const wideDir = site(Math.sin(WIDE_YAW) * Math.cos(WIDE_PITCH), Math.sin(WIDE_PITCH), -Math.cos(WIDE_YAW) * Math.cos(WIDE_PITCH));
  const wideLook = widePos.clone().addScaledVector(wideDir, 60);
  const standY = gh(STAND.x, STAND.z);
  // The closing shot: down on the sand ahead of where he stood, looking back toward the last light,
  // a sapling and his hand low on the right, the sky filling the rest.
  const sapY = gh(STAND.x, STAND.z - 3);
  const touchPos = site(STAND.x, sapY + CLOSE_H, STAND.z - 3 + CLOSE_D);
  const closeYaw = (-3.1 * Math.PI) / 180;
  const closePitch = (6.6 * Math.PI) / 180;
  const touchLook = touchPos.clone().add(site(Math.sin(closeYaw) * Math.cos(closePitch), Math.sin(closePitch), -Math.cos(closeYaw) * Math.cos(closePitch)).multiplyScalar(2));
  const fly = new CatmullRomCurve3([EXIT_POS, site(0.6, 4.4, 17), site(0.8, 9.5, 2), site(0.4, 8, -30), site(0.1, 3.2, -62), widePos], false, "centripetal");
  const flyLook = new CatmullRomCurve3([EXIT_LOOK, site(-5, 0, -40), site(-1, -4, -70), site(-2, 2, -100), wideLook.clone().add(site(0, 0, -6)), wideLook], false, "centripetal");
  // A long low run toward him, staying off to his left and well back while he walks and kneels,
  // past him and down to the sand in front of the sapling, with him going out of frame on the right.
  const approach = new CatmullRomCurve3([widePos, site(-0.5, standY + 0.45, -104), site(-1.1, standY + 0.55, -113), site(-1.9, standY + 0.75, -120.5), site(-1.8, sapY + 0.42, -124.9), touchPos], false, "centripetal");
  const approachLook = new CatmullRomCurve3([wideLook, site(-7.5, standY + 5.8, -170), site(-4.5, standY + 3.5, -158), site(-2.2, standY + 2.0, -141), site(-2.3, sapY + 0.62, -130.9), touchLook], false, "centripetal");
  const landedLook = site(-7.8, l.stand + 3.6, -40);
  const landedPos = site(-3, l.stand + 1.7, 14.5);

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
      // The words sit in the lower half of a tall screen, so the subject moves up, clear of them.
      const drop = (s <= 1 ? lerp(1, 5, s) : s <= 2 ? lerp(5, 9, s - 1) : lerp(9, 14, smooth(0.45, 1, s - 2))) * (Math.PI / 180);
      out.look.y -= Math.hypot(dx, dz) * Math.tan(drop);
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
    uLampR: { value: 0.06 },
    uLampDir: { value: new Vector3(0, -1, 0) },
    uEdge: { value: 0 },
    uRim: { value: new Color() },
    uFall: { value: 1 },
    uBlur: { value: 0 },
    uFocus: { value: new Vector2(0.5, 0.5) },
    uTexel: { value: new Vector2(0.002, 0.002) },
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
    depth.renderOrder = 5.5;
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
        float a = smoothstep(width, width * 0.15, across) * smoothstep(0.0, 0.02, along) * pow(max(1.0 - along, 0.0), 1.6);
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
  const SAP_H = 0.024;
  const sapU = {
    uPress: { value: new Vector2() },
    uCamSite: camSite,
    uCool: { value: new Color(0.0035, 0.0045, 0.009) },
    uTime: windTime,
    uTouch: { value: 0 },
    uAmb: { value: new Color() },
    uKey: { value: new Color() },
    uSunDir: skyU.uSun,
    uLampCol: shared.uLampCol,
    uLampSite: sandU.uLampSite,
    uSapOrigin: sandU.uSapO,
  };
  const sapG = saplingGeometry(SAP_H);
  const sapMat = new ShaderMaterial({ vertexShader: SAP_VS, fragmentShader: SAP_FS, uniforms: sapU, side: DoubleSide, fog: false });
  const sapling = new Mesh(sapG, sapMat);
  sapling.position.copy(SAP);
  sapling.frustumCulled = false;
  sapling.renderOrder = 3;
  group.add(sapling);
  // The tip the finger comes to rest on, just above the upper leaf.
  const TOUCH_AT = SAP.clone().add(site(0.0078, SAP_H * 0.96, 0));

  sandU.uSapO.value.copy(SAP);
  // The pass that lays the seedling flat along the lamp's rays.
  const sapShadowMat = new ShaderMaterial({
    vertexShader: SAP_SHADOW_VS,
    fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(1.0); }`,
    uniforms: { uTime: windTime, uTouch: sapU.uTouch, uPress: sapU.uPress, uSapOrigin: sandU.uSapO, uLampSite: sandU.uLampSite, uPatch: sandU.uSapPatch },
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const sapShadowScene = new Scene();
  const sapShadow = new Mesh(sapG, sapShadowMat);
  sapShadow.frustumCulled = false;
  sapShadowScene.add(sapShadow);
  const sapShadowCam = new Camera();
  let sapRT: WebGLRenderTarget | null = null;
  const grain = readyGrain ?? grainTexture(low ? 384 : 512, low ? 40 : 52);
  readyGrain = null;
  const focusWorld = new Vector3();

  // Sand motes in the air around him: dark until they cross the lamp's light.
  const BEAM_N = low ? 30 : 90;
  const beamSeed = new Float32Array(BEAM_N * 3);
  for (let k = 0; k < BEAM_N * 3; k++) beamSeed[k] = hash2(k + 0.37, k * 0.61 + 4.1);
  const beamG = new BufferGeometry();
  beamG.setAttribute("position", new BufferAttribute(beamSeed, 3));
  const beamMat = new ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPx;
      uniform float uDpr;
      uniform vec3 uLampSite;
      uniform vec3 uLampCol;
      uniform vec3 uSapO;
      varying vec3 vC;
      void main() {
        vec3 a = position;
        vec3 q;
        q.x = fract(a.x + uTime * (0.006 + 0.014 * a.y)) - 0.5;
        q.y = fract(a.y + 0.03 * sin(uTime * 0.4 + a.z * 30.0) + uTime * 0.004 * (a.z - 0.35));
        q.z = fract(a.z + 0.02 * sin(uTime * 0.3 + a.x * 40.0)) - 0.5;
        vec3 p = uSapO + q * vec3(0.5, 0.2, 0.5);
        vec3 dl = uLampSite - p;
        float edge = smoothstep(0.0, 0.08, q.y) * smoothstep(1.0, 0.85, q.y) * (1.0 - smoothstep(0.38, 0.5, abs(q.x))) * (1.0 - smoothstep(0.38, 0.5, abs(q.z)));
        float tw = 0.55 + 0.45 * sin(uTime * (1.0 + a.x * 3.0) + a.y * 60.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vC = uLampCol * 0.0009 / (dot(dl, dl) + 0.001) * edge * tw * smoothstep(0.06, 0.18, -mv.z);
        gl_PointSize = clamp(0.0007 * uPx / -mv.z, 1.0, 3.5) * uDpr;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float d = smoothstep(0.5, 0.12, length(q));
        gl_FragColor = vec4(vC * d, 1.0);
      }`,
    uniforms: { uTime: windTime, uPx: { value: 1 }, uDpr: { value: 1 }, uLampSite: sandU.uLampSite, uLampCol: shared.uLampCol, uSapO: sandU.uSapO },
    transparent: true,
    depthWrite: false,
    blending: 2,
    fog: false,
  });
  const beam = new Points(beamG, beamMat);
  beam.frustumCulled = false;
  beam.renderOrder = 7;
  beam.visible = false;
  group.add(beam);

  // Small stones on the sand around the sapling: real shapes, so the lamp lights one side of each,
  // and each lays its own little shadow along the lamp's rays.
  const STONES = low ? 60 : 180;
  const stoneBase = new IcosahedronGeometry(1, low ? 0 : 1);
  {
    const pa = stoneBase.getAttribute("position") as BufferAttribute;
    for (let k = 0; k < pa.count; k++) {
      const x = pa.getX(k);
      const y = pa.getY(k);
      const z = pa.getZ(k);
      const nudge = 0.72 + 0.56 * hash2(x * 3.1 + z * 1.7, y * 2.3 + 0.5);
      pa.setXYZ(k, x * nudge, y * nudge, z * nudge);
    }
    stoneBase.computeVertexNormals();
  }
  const stoneAt = new Float32Array(STONES * 4); // x, y, z, radius
  const stoneShape = new Float32Array(STONES * 3); // yaw, squash, tone
  {
    let k = 0;
    let tries = 0;
    while (k < STONES && tries < STONES * 8) {
      tries++;
      const a = r() * Math.PI * 2;
      const rad = 0.035 + Math.pow(r(), 0.65) * 0.74;
      const x = SAP.x + Math.cos(a) * rad;
      const z = SAP.z + Math.sin(a) * rad;
      // Clear of the lens.
      if (Math.hypot(x - SAP.x, z - (SAP.z + CLOSE_D)) < 0.26) continue;
      const big = r();
      const size = 0.0005 + big * big * big * 0.0021;
      stoneAt.set([x, groundHeight(x, z) + size * 0.22, z, size], k * 4);
      stoneShape.set([r() * 6.28, 0.5 + r() * 0.45, r()], k * 3);
      k++;
    }
  }
  const makeStones = (mat: ShaderMaterial, order: number) => {
    const g = new InstancedBufferGeometry();
    g.setAttribute("position", stoneBase.getAttribute("position"));
    g.setAttribute("normal", stoneBase.getAttribute("normal"));
    g.setAttribute("aAt", new InstancedBufferAttribute(stoneAt, 4));
    g.setAttribute("aShape", new InstancedBufferAttribute(stoneShape, 3));
    g.instanceCount = STONES;
    const m = new Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = order;
    m.visible = false;
    group.add(m);
    return m;
  };
  const STONE_PLACE = /* glsl */ `
    attribute vec4 aAt;
    attribute vec3 aShape;
    vec3 stoneSpot(vec3 q) {
      float c = cos(aShape.x);
      float s = sin(aShape.x);
      vec3 r = vec3(c * q.x - s * q.z, q.y * aShape.y, s * q.x + c * q.z);
      return aAt.xyz + r * aAt.w;
    }
  `;
  const stoneU = { uSkyDir: { value: new Vector3(0, 1, 0) } };
  const stones = makeStones(
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        ${STONE_PLACE}
        uniform vec3 uLampSite;
        varying vec3 vN;
        varying vec3 vL;
        varying float vTone;
        void main() {
          vec3 p = stoneSpot(position);
          float c = cos(aShape.x);
          float s = sin(aShape.x);
          vN = normalize(vec3(c * normal.x - s * normal.z, normal.y / aShape.y, s * normal.x + c * normal.z));
          vL = uLampSite - p;
          vTone = aShape.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLampCol;
        uniform vec3 uAmb;
        uniform vec3 uKey;
        uniform vec3 uSkyDir;
        varying vec3 vN;
        varying vec3 vL;
        varying float vTone;
        void main() {
          vec3 n = normalize(vN);
          float d2 = dot(vL, vL);
          float dist = sqrt(d2);
          float ndl = max(dot(n, vL / max(dist, 1e-4)), 0.0);
          // The same small light as the sand, by the same falloff.
          float e = 0.0085 * ndl / (d2 + 0.0016) * (1.0 - smoothstep(0.7, 1.26, dist));
          vec3 alb = mix(vec3(0.3, 0.25, 0.2), vec3(0.62, 0.53, 0.43), vTone);
          float sky = max(dot(n, uSkyDir), 0.0) * 0.7 + 0.3 * max(n.y, 0.0);
          gl_FragColor = vec4(alb * (uLampCol * e * 1.3 + uAmb * (0.3 + 0.5 * max(n.y, 0.0)) + uKey * sky * 1.6), 1.0);
        }`,
      uniforms: { uLampCol: shared.uLampCol, uLampSite: sandU.uLampSite, uAmb: sapU.uAmb, uKey: sapU.uKey, uSkyDir: stoneU.uSkyDir },
      fog: false,
    }),
    2,
  );
  const stoneShadow = makeStones(
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        ${STONE_PLACE}
        uniform vec3 uLampSite;
        varying float vA;
        void main() {
          vec3 p = stoneSpot(position);
          float ground = aAt.y - aAt.w * 0.22;
          float over = (uLampSite.y - ground) / max(uLampSite.y - p.y, 1e-4);
          vec3 g = uLampSite + (p - uLampSite) * over;
          g.y = ground + 0.0003;
          vA = 1.0 - smoothstep(0.45, 1.05, length(g - uLampSite));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(g, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLampCol;
        varying float vA;
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.62 * vA * min(uLampCol.r * 3.0, 1.0));
        }`,
      uniforms: { uLampSite: sandU.uLampSite, uLampCol: shared.uLampCol },
      transparent: true,
      depthWrite: false,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    -45,
  );

  // The small lamp on his wrist: a small glint, and the light it throws.
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
      uniforms: { uCenter: { value: new Vector3() }, uSize: { value: 0.0085 }, uColor: { value: new Color(0, 0, 0) } },
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

  // The arm past the plate's edge, in the plate's own pixels: it carries on out of the frame, in the dark.
  const armG = new BufferGeometry();
  {
    const wx = ARM_R[0] - ARM_L[0];
    const wy = ARM_R[1] - ARM_L[1];
    const ex = ARM_DIR[0] * ARM_LEN;
    const ey = ARM_DIR[1] * ARM_LEN;
    armG.setAttribute("position", new BufferAttribute(new Float32Array([ARM_L[0], -ARM_L[1], 0, ARM_R[0], -ARM_R[1], 0, ARM_L[0] + ex - wx * 0.14, -(ARM_L[1] + ey - wy * 0.14), 0, ARM_R[0] + ex + wx * 0.14, -(ARM_R[1] + ey + wy * 0.14), 0]), 3));
    armG.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), 2));
    armG.setIndex([0, 1, 2, 1, 3, 2]);
  }
  const sleeveRim = new Color(0.012, 0.016, 0.03);
  const sleeve = new Mesh(
    armG,
    new ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uRim;
        uniform vec3 uLamp;
        varying vec2 vUv;
        void main() {
          float across = abs(vUv.y - 0.5) * 2.0;
          // It runs out of focus the further it goes.
          float soft = mix(0.06, 0.34, smoothstep(0.0, 0.5, vUv.x));
          float a = smoothstep(1.0, 1.0 - soft, across);
          // A faint cool line of starlight along its upper edge.
          float rim = smoothstep(0.03, 0.12, vUv.y) * smoothstep(0.26, 0.12, vUv.y) * (1.0 - 0.7 * smoothstep(0.0, 0.5, vUv.x));
          // Suit cloth: a round sleeve in soft folds with a seam down it, and the wrist lamp spilling up it, fading with distance.
          float x = vUv.x;
          float form = 1.0 - across * across;
          float folds = 0.5 + 0.5 * sin(x * 58.0 + sin(x * 17.0 + vUv.y * 4.0) * 2.8 + vUv.y * 5.0);
          folds = folds * folds * (1.0 - smoothstep(0.1, 0.45, x));
          float seam = smoothstep(0.05, 0.0, abs(vUv.y - 0.34)) * (1.0 - smoothstep(0.1, 0.5, x));
          float spill = exp(-x * 22.0) * (0.35 + 0.65 * form);
          vec3 cloth = uColor * (0.7 + 0.6 * form + 0.9 * folds - 0.5 * seam);
          cloth += uLamp * spill * (0.01 + 0.03 * folds + 0.008 * form);
          gl_FragColor = vec4(cloth + uRim * rim, a);
        }`,
      uniforms: { uColor: { value: new Color(0.0052, 0.0056, 0.0078) }, uRim: { value: new Color(0.012, 0.016, 0.03) }, uLamp: shared.uLampCol },
      transparent: true,
      depthWrite: false,
      fog: false,
      side: DoubleSide,
    }),
  );
  sleeve.frustumCulled = false;
  sleeve.renderOrder = 4;
  sleeve.visible = false;
  group.add(sleeve);

  // He is one real figure in the world, on the real ramp and sand, from the hatch to the sapling.
  // He kneels just to the right of where the closing shot looks, which is where the arm comes from.
  const KNEEL = { x: STAND.x + 0.62, z: STAND.z - 3 + 0.05 };
  const figure = buildFigure(low, !low, (x, z) => groundHeight(x, z), { standX: STAND.x, standZ: STAND.z, kneelX: KNEEL.x, kneelZ: KNEEL.z });
  group.add(figure.group);
  const fig: FigureFrame = {
    walk: 0,
    t: 0,
    back: 0,
    turnBy: Math.PI,
    helm: 0,
    helmBack: 0,
    kneel: 0,
    reach: 0,
    reachAt: new Vector3(),
    lookAt: new Vector3(),
    lookW: 0,
    time: 0,
    dt: 0,
    reduced: false,
    rim: new Color(),
    gust: 0,
    lampCol: new Color(0, 0, 0),
    lampView: new Vector3(),
  };

  // ------------------------------------------------------------ dust that things kick up
  // A press on the sand, a boot coming down. A small pool that stays allocated; the shader
  // works out each puff's age, so nothing is written per frame.
  const PUFFS = 6;
  const PER = low ? 3 : 4;
  const puffG = new InstancedBufferGeometry();
  puffG.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  puffG.setIndex([0, 1, 2, 0, 2, 3]);
  const puffA = new Float32Array(PUFFS * PER * 4); // x, y, z, born
  const puffB = new Float32Array(PUFFS * PER * 4); // size, strength, angle, speed
  for (let k = 0; k < PUFFS * PER; k++) puffA[k * 4 + 3] = -100;
  const puffAttrA = new InstancedBufferAttribute(puffA, 4);
  const puffAttrB = new InstancedBufferAttribute(puffB, 4);
  puffG.setAttribute("aA", puffAttrA);
  puffG.setAttribute("aB", puffAttrB);
  puffG.instanceCount = PUFFS * PER;
  const puffMat = new ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec4 aA;
      attribute vec4 aB;
      uniform float uNow;
      uniform vec3 uWind;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float age = clamp((uNow - aA.w) / (1.5 + aB.w), 0.0, 1.0);
        float k = 1.0 - pow(1.0 - age, 2.4);
        vec3 c = aA.xyz + vec3(cos(aB.z), 0.0, sin(aB.z)) * aB.x * (0.5 + aB.w) * k + vec3(0.0, aB.x * (0.25 + 0.5 * aB.w) * k, 0.0) + uWind * aB.x * age * 0.7;
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        mv.xy += position.xy * aB.x * (0.28 + 0.62 * k);
        gl_Position = projectionMatrix * mv;
        vUv = position.xy * 0.5 + 0.5;
        vA = aB.y * smoothstep(0.0, 0.05, age) * pow(1.0 - age, 1.5) * step(age, 0.999);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tCloud;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float a = texture2D(tCloud, vUv).a * vA;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    uniforms: { uNow: { value: 0 }, uWind: { value: WIND }, tCloud: { value: o.cloudTex }, uColor: { value: new Color(0.6, 0.3, 0.14) } },
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    side: DoubleSide,
    fog: false,
  });
  const puffs = new Mesh(puffG, puffMat);
  puffs.frustumCulled = false;
  puffs.renderOrder = 6;
  puffs.visible = false;
  group.add(puffs);
  let puffNext = 0;
  let puffUntil = -1;
  function kick(x: number, y: number, z: number, size: number, strength: number) {
    const now = windTime.value;
    const base = puffNext * PER;
    puffNext = (puffNext + 1) % PUFFS;
    for (let k = 0; k < PER; k++) {
      const i = (base + k) * 4;
      puffA[i] = x;
      puffA[i + 1] = y + size * 0.05;
      puffA[i + 2] = z;
      puffA[i + 3] = now + k * 0.03;
      puffB[i] = size * (0.8 + 0.5 * hash2(now, k));
      puffB[i + 1] = strength * (0.6 + 0.4 * hash2(k, now));
      puffB[i + 2] = hash2(now * 3.1, k + 2) * Math.PI * 2;
      puffB[i + 3] = 0.2 + hash2(k + 5, now * 1.7) * 0.8;
    }
    puffAttrA.needsUpdate = true;
    puffAttrB.needsUpdate = true;
    puffUntil = now + 3;
  }

  // ------------------------------------------------------------ the visitor
  // On the plain and at the ramp his head follows the pointer. In the last chapter the wrist lamp
  // does, so the real shadows of the sapling and the hand swing. A press on the sand kicks dust and
  // he glances at it. A press near the sapling brings the finger to it. None of it is needed.
  let lookHold = 0;
  let lookK = 0;
  let lampWantX = 0;
  let lampWantY = 0;
  let lampHold = 0;
  let lampX = 0;
  let lampY = 0;
  let held = false;
  let heldSap = false;
  let heldId = "sand";
  let pressK = 0;
  let hoverSent = 0;
  let lastHX = 0;
  let lastHY = 0;
  let nowP = 0;
  let nowS = 0;
  const siteO = new Vector3();
  const siteD = new Vector3();
  const hit = new Vector3();
  const sendInteract = (id: string, kind: string, x: number, y: number, strength: number) =>
    window.dispatchEvent(new CustomEvent("journey:interact", { detail: { id, kind, x: clamp(x, -1, 1), y: clamp(y, -1, 1), strength: clamp(strength, 0, 1) } }));

  /** Where the ray meets the ground in site space, or false. */
  function groundHit(out: Vector3) {
    if (siteD.y > -0.001) return false;
    let t = (groundHeight(siteO.x, siteO.z) - siteO.y) / siteD.y;
    for (let k = 0; k < 3; k++) {
      out.copy(siteO).addScaledVector(siteD, t);
      t = (groundHeight(out.x, out.z) - siteO.y) / siteD.y;
      if (t < 0 || t > 600) return false;
    }
    out.copy(siteO).addScaledVector(siteD, t);
    return true;
  }

  function interact(kind: "hover" | "press" | "drag" | "release", x: number, y: number, ray: PointerRay) {
    if (nowP < SCENE.landA) return;
    siteO.copy(ray.o).sub(l.pad).applyQuaternion(inv);
    siteD.copy(ray.d).applyQuaternion(inv);
    const close = nowS > 2.8;
    if (kind === "release") {
      if (held) sendInteract(heldId, "release", x, y, pressK);
      held = false;
      heldSap = false;
      return;
    }
    if (close) {
      lampWantX = x;
      lampWantY = y;
      lampHold = kind === "hover" ? 8 : 2.5;
    } else if (figure.group.visible) {
      // What he looks at: the point the pointer is over, as far off as he is.
      const pp = figure.pelvis.position;
      fig.lookAt.copy(siteO).addScaledVector(siteD, siteO.distanceTo(pp));
      lookHold = kind === "hover" ? 5 : 3;
    }
    if (kind === "press") {
      held = true;
      pressK = 0;
      if (close) {
        // The tip of the plant, as seen along the ray.
        tmpV.copy(TOUCH_AT).sub(siteO);
        const along = tmpV.dot(siteD);
        const off = Math.sqrt(Math.max(tmpV.lengthSq() - along * along, 0)) / Math.max(along, 1e-3);
        heldSap = along > 0 && off < 0.085;
      }
      heldId = heldSap ? "sapling" : close ? "lamp" : "sky";
      if (heldSap) sendInteract("sapling", "press", x, y, 0.5);
      else if (groundHit(hit)) {
        heldId = "sand";
        const dist = siteO.distanceTo(hit);
        kick(hit.x, hit.y, hit.z, clamp(dist * 0.11, 0.05, 2.6), 0.85);
        if (figure.group.visible && !close) {
          fig.lookAt.copy(hit);
          lookHold = 3;
        }
        sendInteract("sand", "press", x, y, 0.6);
      } else sendInteract(heldId, "press", x, y, 0.2);
      return;
    }
    // Hover and drag: only when something is listening, and not more than the eye can use.
    const now = performance.now();
    if (now - hoverSent < 66 && kind === "hover") return;
    const moved = Math.hypot(x - lastHX, y - lastHY);
    lastHX = x;
    lastHY = y;
    hoverSent = now;
    if (close || figure.group.visible) sendInteract(close ? "lamp" : "figure", kind, x, y, clamp(moved * 6, 0, 1));
  }

  // ------------------------------------------------------------ the sound's contract
  // journey:ending, on every change of progress, both ways: { scene, progress, beat, direction, velocity }.
  // velocity is the scene's own progress per second, signed.
  // land: the whole descent and the ramp opening; beats 0 undock, 1 braking, 2 touchdown, 3 ramp opening.
  // exit: progress is distance walked, as ever; beats 0 start, 1 off the ramp, 2 stopped.
  // helmet: beats 0 start, 1 seal, 2 lifts, 3 clear.
  // touch: beats 0 start, 1 the hand on its way, 2 the finger meets the sapling, 3 after.
  const landSpan = SCENE.rampB - SCENE.landA;
  const landP = (L: number) => (L * (SCENE.landB - SCENE.landA)) / landSpan;
  const SEND = [
    { scene: "land", beats: [0, landP(0.32), landP(0.84), (SCENE.rampA - SCENE.landA) / landSpan], a: SCENE.landA, b: SCENE.rampB, sent: -1 },
    { scene: "exit", beats: [0, figure.rampEndP, 1], a: SCENE.walkA, b: SCENE.walkB, sent: -1 },
    { scene: "helmet", beats: [0, 0.42, 0.56, 0.68], a: SCENE.helmA, b: SCENE.helmB, sent: -1 },
    { scene: "touch", beats: [0, 0.03, 0.375, 0.6], a: SCENE.touchA, b: LAST, sent: -1 },
  ];
  /** The touch runs on two rates, so that the finger meets the sapling at beat two. */
  const touchProgress = (p: number) => (p < SCENE.contact ? 0.375 * clamp((p - SCENE.touchA) / (SCENE.contact - SCENE.touchA), 0, 1) : 0.375 + 0.625 * clamp((p - SCENE.contact) / (LAST - SCENE.contact), 0, 1));
  let sentFirst = false;
  function sendScenes(f: SurfaceInput, contactNow: boolean, wasContact: boolean) {
    for (let k = 0; k < SEND.length; k++) {
      const c = SEND[k];
      const pr = k === 3 ? touchProgress(f.p) : clamp((f.p - c.a) / (c.b - c.a), 0, 1);
      if (!sentFirst) {
        c.sent = pr;
        continue;
      }
      const edge = k === 3 && contactNow !== wasContact;
      if (Math.abs(pr - c.sent) < 0.0004 && !edge) continue;
      c.sent = pr;
      let beat = 0;
      for (let i = 0; i < c.beats.length; i++) if (pr >= c.beats[i]) beat = i;
      if (k === 3 && contactNow) beat = Math.max(beat, 2);
      const rate = k === 3 ? (f.p < SCENE.contact ? 0.375 / (SCENE.contact - SCENE.touchA) : 0.625 / (LAST - SCENE.contact)) : 1 / (c.b - c.a);
      window.dispatchEvent(new CustomEvent("journey:ending", { detail: { scene: c.scene, progress: pr, beat, direction: f.dir, velocity: f.v * rate } }));
    }
    sentFirst = true;
  }

  // ------------------------------------------------------------ the hand on the leaf
  const _right = new Vector3();
  const _p = new Vector3();
  const tmpV = new Vector3();
  const tmpV2 = new Vector3();
  const ledAt = new Vector3();
  const plateLamp = new Vector3();
  /** The source pixel the card was anchored by, last time it was placed. */
  const cardAt = [0, 0];
  let contactWas = false;
  let touch = 0;
  let sapX = 0;
  let sapY_ = 0;
  let sapVX = 0;
  let sapVY = 0;
  let lastStep = -1;
  let lastWalk = -1;
  let stepGap = 0;

  /** Median of the lowest point over the plate: where the fingertip comes to rest. */
  let fingerRest: number[] | null = null;
  const footRest = () => {
    if (fingerRest) return fingerRest;
    const m = bank.meta("handR");
    if (!m) return null;
    const list = m.foot.slice(Math.floor(m.foot.length * 0.6));
    const xs = list.map((v) => v[0]).sort((a, b) => a - b);
    const ys = list.map((v) => v[1]).sort((a, b) => a - b);
    fingerRest = [xs[xs.length >> 1], ys[ys.length >> 1]];
    return fingerRest;
  };

  /** The hand plate, placed so that one source pixel sits at the fingertip's point, tilted about it, moved off by offR and offU. */
  function placeHand(reduced: boolean, anchor: Vector3, ax: number, ay: number, pu: number, offR: number, offU: number, rz: number) {
    const m = bank.meta("handR");
    card.mesh.visible = card.depth.visible = false;
    if (!m) return null;
    let frame = 0;
    if (!reduced) {
      const span = 2 * (m.frames - 1);
      const q = Math.floor(windTime.value * m.fps) % span;
      frame = q < m.frames ? q : span - q;
    }
    const tex = bank.texture("handR", frame);
    if (!tex) return null;
    // Whatever the clip's camera did, this frame is held to one size on one point.
    const shownF = bank.shown("handR");
    const lock = m.stab && shownF >= 0 ? m.stab[shownF] : null;
    if (lock) {
      pu *= lock[0];
      ax = lock[1];
      ay = lock[2];
    }
    card.tMap.value = tex;
    shared.uBlur.value = 0.008;
    shared.uEdge.value = 1;
    cardAt[0] = ax;
    cardAt[1] = ay;
    shared.uFocus.value.set((ax - m.box[0]) / (m.box[2] - m.box[0]), (ay - m.box[1]) / (m.box[3] - m.box[1]));
    shared.uTexel.value.set(1.6 / (m.box[2] - m.box[0]), 1.6 / (m.box[3] - m.box[1]));
    const [x0, y0, x1, y1] = m.box;
    const w = (x1 - x0) * pu;
    const h = (y1 - y0) * pu;
    const yaw = Math.atan2(camSite.value.x - anchor.x, camSite.value.z - anchor.z);
    _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const cx = (x0 + x1) * 0.5;
    const cy = (y0 + y1) * 0.5;
    const cz = Math.cos(rz);
    const sz = Math.sin(rz);
    const dx = (cx - ax) * pu;
    const dy = (ay - cy) * pu;
    _p.copy(anchor)
      .addScaledVector(_right, dx * cz - dy * sz + offR)
      .add(tmpV.set(0, dx * sz + dy * cz + offU, 0));
    for (const o of [card.mesh, card.depth]) {
      o.position.copy(_p);
      o.rotation.set(0, yaw, rz);
      o.scale.set(w, h, 1);
      o.visible = true;
    }
    sandU.tHand.value = tex;
    sandU.uHandOn.value = 1;
    sandU.uHandC.value.copy(_p);
    sandU.uHandR.value.copy(_right).multiplyScalar(cz).add(tmpV.set(0, sz, 0)).multiplyScalar(1 / w);
    sandU.uHandU.value.copy(_right).multiplyScalar(-sz).add(tmpV.set(0, cz, 0)).multiplyScalar(1 / h);
    sandU.uHandN.value.set(Math.sin(yaw), 0, Math.cos(yaw));
    sandU.uHandK.value.set(1 / w, 1 / h);
    return m;
  }

  // ------------------------------------------------------------ the planet turns
  // At the last chapter the night sky goes round one tilted axis. The pole stands low behind the viewer, so
  // what is ahead wheels round a point just under the horizon in front: the band moves left to right, sinks
  // behind the land inside the frame, goes under it, and comes up again on the left, in the frame too.
  // The turn runs on the wall clock, so a tab left alone finds it further along. It only runs at the
  // last chapter and keeps its angle if the visitor scrolls away and comes back.
  const SKY_TURN_MS = 9 * 60 * 1000;
  const POLE = new Vector3(0.06, 0.17, 0.98).normalize();
  let skyTurn = 0;
  let skyWall = 0;
  let skyUp = 1;
  let skyChecked = 0;
  let skySent = 0;
  const skyQ = new Quaternion();
  const skyQinv = new Quaternion();
  const skyM4 = new Matrix4();
  const coreNow = new Vector3();
  const keyWorld = new Vector3();
  const skyProbe = new Vector3();
  // Where the band's light is along its circle, to weigh how much of it is above the land.
  const PROBES = 36;
  const probeDir: Vector3[] = [];
  const probeW: number[] = [];
  let probeSum = 0;
  for (let k = 0; k < PROBES; k++) {
    const lon = -Math.PI + ((k + 0.5) / PROBES) * Math.PI * 2;
    probeDir.push(galB.clone().multiplyScalar(Math.cos(lon)).addScaledVector(galA, Math.sin(lon)));
    const w = 0.42 * Math.exp((-lon * lon) / 1.2) + 0.95 * Math.exp((-lon * lon) / 0.45);
    probeW.push(w);
    probeSum += w;
  }
  const skyUpNow = () => {
    let sum = 0;
    for (let k = 0; k < PROBES; k++) {
      skyProbe.copy(probeDir[k]).applyQuaternion(skyQinv);
      sum += probeW[k] * smooth(-0.01, 0.06, skyProbe.y);
    }
    return sum / probeSum;
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
    horSun: [[0.84, 0.23, 0.022], [0.72, 0.19, 0.03], [0.74, 0.2, 0.05], [0.014, 0.014, 0.03]],
    horAway: [[0.5, 0.125, 0.024], [0.3, 0.075, 0.03], [0.1, 0.04, 0.095], [0.009, 0.01, 0.026]],
    mid: [[0.8, 0.185, 0.018], [0.5, 0.115, 0.03], [0.13, 0.05, 0.17], [0.008, 0.01, 0.028]],
    top: [[0.54, 0.115, 0.026], [0.21, 0.05, 0.045], [0.03, 0.018, 0.085], [0.0035, 0.0045, 0.014]],
    sun: [[0.34, 0.14, 0.025], [0.3, 0.085, 0.014], [0.14, 0.035, 0.01], [0, 0, 0]],
    key: [[2.1, 1.14, 0.5], [1.8, 0.8, 0.3], [0.34, 0.13, 0.16], [0.03, 0.04, 0.08]],
    fill: [[0.82, 0.36, 0.1], [0.56, 0.23, 0.08], [0.2, 0.115, 0.27], [0.03, 0.04, 0.078]],
    bounce: [[0.2, 0.08, 0.03], [0.13, 0.045, 0.02], [0.04, 0.02, 0.04], [0.005, 0.006, 0.012]],
    dust: [[0.86, 0.38, 0.13], [0.56, 0.2, 0.075], [0.2, 0.11, 0.2], [0.035, 0.04, 0.07]],
    mote: [[1.0, 0.62, 0.32], [0.82, 0.4, 0.2], [0.2, 0.14, 0.22], [0.1, 0.11, 0.16]],
    // How the plates are relit: the shadows take the sky, the highlights the last light.
    plateShadow: [[0.72, 0.46, 0.32], [0.72, 0.44, 0.3], [0.5, 0.38, 0.72], [0.5, 0.56, 0.8]],
    plateRim: [[0.62, 0.3, 0.1], [0.74, 0.3, 0.1], [0.85, 0.34, 0.24], [0.05, 0.065, 0.12]],
    plateHigh: [[1.02, 0.78, 0.58], [1.04, 0.72, 0.52], [0.92, 0.45, 0.44], [1.0, 0.97, 0.92]],
  };
  const SUN_EL = [0.082, 0.03, -0.034, -0.24];
  const BAND_W = [0.16, 0.12, 0.05, 0.1];
  const STARS = [0.1, 0.16, 0.72, 1];
  const MILKY = [0, 0, 0.03, 1];
  const MOON_K = [1, 0.86, 0.55, 0.12];
  const PLATE_GAIN = [1.1, 1.25, 1.0, 1.0];
  const PLATE_KEEP = [1, 1, 0.8, 0.25];
  const SUN_K = [1, 0.8, 0.14, 0.05];
  const FORM_K = [1, 1, 0.95, 0.15];
  const RIP_K = [1, 1, 0.1, 0];
  const LONG_K = [0, 0.1, 1, 0];
  const HAZE_D = [2400, 2200, 1100, 70];

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
    domeMat.uniforms.uRes.value.set(f.width, f.height);
    domeMat.uniforms.uTall.value = f.height > f.width ? 1 : 0;
    domeMat.uniforms.uMilky.value = blend1(s, MILKY);
    domeMat.uniforms.uRing.value = 1 - 0.8 * smooth(1.5, 3, s);
    blend(s, SKY.key, sunColor);
    blend(s, SKY.fill, skyLight);
    blend(s, SKY.bounce, groundLight);

    // The planet turns, and the land takes its light from what is really up there. The lamp is not part of this.
    const nightK = smooth(2.6, 3, s);
    const wall = Date.now();
    if (f.reduced) skyTurn = 0;
    else if (skyWall) skyTurn = (skyTurn + ((wall - skyWall) / SKY_TURN_MS) * smooth(SCENE.touchA + 0.04, SCENE.camDown, f.p)) % 1;
    skyWall = wall;
    skyQ.setFromAxisAngle(POLE, skyTurn * Math.PI * 2);
    domeMat.uniforms.uSkyRot.value.setFromMatrix4(skyM4.makeRotationFromQuaternion(skyQ));
    skyQinv.copy(skyQ).invert();
    coreNow.copy(galCore).applyQuaternion(skyQinv);
    if (wall - skyChecked > 120 || wall < skyChecked) {
      skyChecked = wall;
      skyUp = skyUpNow();
      if (wall - skySent > 240 && smooth(SCENE.touchA + 0.04, SCENE.camDown, f.p) > 0.01 && !f.reduced) {
        skySent = wall;
        window.dispatchEvent(new CustomEvent("journey:sky", { detail: { angle: skyTurn, up: skyUp } }));
      }
    }
    const glowK = smooth(0.03, 0.62, skyUp);
    const lightK = lerp(1, lerp(0.42, 1.12, glowK), nightK);
    const coolR = lerp(1, lerp(0.72, 1, glowK), nightK);
    const coolB = lerp(1, lerp(1.5, 1, glowK), nightK);
    const skyK = lerp(1, lerp(0.66, 1.04, glowK), nightK);
    skyU.uHorSun.value.multiplyScalar(skyK);
    skyU.uHorAway.value.multiplyScalar(skyK);
    skyU.uMid.value.multiplyScalar(skyK);
    skyU.uTop.value.multiplyScalar(skyK);
    sunColor.multiplyScalar(lightK);
    sunColor.r *= coolR;
    sunColor.b *= coolB;
    skyLight.multiplyScalar(lightK);
    skyLight.r *= coolR;
    skyLight.b *= coolB;
    groundLight.multiplyScalar(lightK);
    // Airglow low down, and before the band rises, or just after it sets, the horizon there lifts a little.
    const coreEl = Math.asin(clamp(coreNow.y, -1, 1));
    const coreLen = Math.max(Math.hypot(coreNow.x, coreNow.z), 1e-3);
    skyU.uAirglow.value = nightK;
    skyU.uRiseDir.value.set(coreNow.x / coreLen, coreNow.z / coreLen);
    skyU.uRise.value = nightK * smooth(-0.62, -0.1, coreEl) * (1 - smooth(0.02, 0.26, coreEl));
    keyWorld.copy(sunWorld).lerp(tmpV.copy(coreNow).applyQuaternion(l.quat), nightK).normalize();
    stoneU.uSkyDir.value.copy(coreNow);
    stones.visible = stoneShadow.visible = s > 2.55;
    // The nearest stars shift a touch with the pointer: depth against the band behind them.
    domeMat.uniforms.uShift.value.set(lampX * 0.0028 * nightK, -lampY * 0.0018 * nightK, 0);
    domeMat.uniforms.uTwinkle.value = f.reduced ? 0 : 1;
    sapU.uCool.value.setRGB(0.0035, 0.0045, 0.009).multiplyScalar(lerp(0.5, 1.15, glowK));

    hazeColor.copy(skyU.uHorSun.value).lerp(skyU.uMid.value, 0.5).multiplyScalar(0.8);
    const night = smooth(1.15, 3, s);
    sandU.uNight.value = night;
    sandU.uFormK.value = blend1(s, FORM_K);
    sandU.uRipK.value = blend1(s, RIP_K) * (f.height > f.width ? 0.55 : 1);
    sandU.uLongK.value = blend1(s, LONG_K);
    sandU.uHazeD.value = blend1(s, HAZE_D);
    sandU.uAmbient.value.copy(skyLight).multiplyScalar(0.3 + 0.16 * night * night);
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
      const clearOfCount = m === moonList[0] && f.height > f.width ? (-7 * Math.PI * (1 - smooth(0.6, 1.6, s))) / 180 : 0;
      const a = m.az + clearOfCount + (f.reduced ? 0 : time * m.drift * 0.02);
      const elNow = m.el - 0.42 * smooth(2.25, 3, s) - (f.height > f.width ? 0.14 * (1 - smooth(0.6, 1.6, s)) : 0);
      const ce = Math.cos(elNow);
      m.mesh.position.set(MOON_ANCHOR.x + Math.sin(a) * ce * m.dist, MOON_ANCHOR.y + Math.sin(elNow) * m.dist, MOON_ANCHOR.z - Math.cos(a) * ce * m.dist);
      if (!f.reduced) m.mesh.rotation.y += dt * 0.004;
    }

    // ---- contact and the dust settling around the legs
    blobMat.uniforms.uStrength.value = 0.62 * smooth(0.82, 0.98, f.land) * (1 - smooth(1.6, 2.2, s));
    contact.visible = blobMat.uniforms.uStrength.value > 0.002;
    blobMat.uniforms.uColor.value.copy(sunColor).multiplyScalar(0.006);

    // ---- relight for the hour
    blend(s, SKY.plateShadow, shared.uShadow.value);
    blend(s, SKY.plateHigh, shared.uHigh.value);
    shared.uGain.value = blend1(s, PLATE_GAIN);
    shared.uKeep.value = blend1(s, PLATE_KEEP);
    blend(s, SKY.plateRim, shared.uRim.value);
    shared.uRim.value.multiplyScalar(lightK);
    (sleeve.material as ShaderMaterial).uniforms.uRim.value.copy(sleeveRim).multiplyScalar(lerp(0.4, 1.15, glowK));
    shared.uFall.value = lerp(1, 0.22, smooth(2.6, 3, s));

    // The close sand and the lamp's shadow are only made when the story gets near them.
    focusWorld.copy(SAP).applyMatrix4(group.matrixWorld);
    beamMat.uniforms.uPx.value = f.pxScale;
    beamMat.uniforms.uDpr.value = f.dpr;
    if (s > 2.2 && !sapRT) {
      sandU.tGrain.value = grain;
      sapRT = new WebGLRenderTarget(low ? 128 : 256, low ? 128 : 256, { depthBuffer: false });
      sandU.tSapShadow.value = sapRT.texture;
    }
    sandU.uHandOn.value = 0;

    // ---- the scenes, read from where the scroll is and which way it is going
    const S = SCENE;
    const p = f.p;
    const B = f.back;
    nowP = p;
    nowS = s;
    const nearLander = s < 1.46;
    const onShow = nearLander ? p > S.walkA - 0.002 : p < S.camDown + 0.012;
    figure.group.visible = onShow;

    // How he stands to the visitor, a moment at a time.
    lookHold = Math.max(0, lookHold - dt);
    lampHold = Math.max(0, lampHold - dt);
    lookK += ((lookHold > 0 ? 1 : 0) - lookK) * (1 - Math.exp(-dt * 3));
    if (held) pressK = Math.min(1, pressK + dt * 2.6);
    else pressK = Math.max(0, pressK - dt * 2.2);
    const gust = Math.pow(0.5 + 0.5 * Math.sin(windTime.value * 0.37 + 1.3) * Math.sin(windTime.value * 0.83), 2);

    // ---- the lamp comes on as the night does
    const lampOn = smooth(S.lampA, S.lampB, p);

    // ---- the hand comes down to the leaf, and leaves it its own way
    if (s > 1.2) bank.begin();
    if (bank.ready) bank.prefer(["handR"]);
    const reachBy = clamp((p - S.reachA) / (S.contact - S.reachA), 0, 1);
    const pressReach = heldSap && reachBy > 0.15 ? pressK : 0;
    const reachNow = Math.max(reachBy, pressReach);
    const contactNow = reachNow >= 0.999;
    const eReach = 1 - Math.pow(1 - reachNow, 2.2);
    const handK = smooth(S.reachA, S.reachA + 0.06, p);
    let handOn = false;
    const offR = lerp(HAND_IN[0], HAND_OUT[0], B) * (1 - eReach);
    let offU = lerp(HAND_IN[1], HAND_OUT[1], B) * (1 - eReach);
    // The lamp goes where the visitor is, a little: the hand turns on its fingertip.
    const wantLX = lampHold > 0 ? lampWantX : Math.sin(windTime.value * 0.17) * 0.12;
    const wantLY = lampHold > 0 ? lampWantY : Math.sin(windTime.value * 0.11 + 1.0) * 0.12;
    const lampRate = 1 - Math.exp(-dt * (lampHold > 0 ? 3.2 : 0.9));
    lampX = f.reduced ? 0 : lampX + (wantLX - lampX) * lampRate;
    lampY = f.reduced ? 0 : lampY + (wantLY - lampY) * lampRate;
    const swingK = smooth(0.7, 1, reachNow);
    const rz = HAND_TILT + B * HAND_OUT[2] * (1 - eReach) - lampX * 0.2 * swingK;
    offU -= (contactNow ? 0.0012 : 0) * pressK * (heldSap ? 1 : 0);
    sandU.uHandOn.value = 0;
    if (bank.ready && p > S.reachA - 0.004) {
      const rest = footRest();
      if (rest) {
        const m = placeHand(f.reduced, TOUCH_AT, rest[0], rest[1], HAND_PU, offR, offU, rz);
        if (m) {
          handOn = true;
          const cz = Math.cos(rz);
          const sz = Math.sin(rz);
          const yaw = card.mesh.rotation.y;
          // The leaf is under the fingertip: it goes where it goes, and gives a little when it presses.
          const at0 = Math.max(bank.shown("handR"), 0);
          const tx = (m.foot[at0][0] - cardAt[0]) * HAND_PU;
          const ty = (cardAt[1] - m.foot[at0][1]) * HAND_PU;
          const on = smooth(0.86, 1, reachNow);
          const pressWantX = (tx * cz - ty * sz) * on;
          const pressWantY = (tx * sz + ty * cz - 0.0011 - 0.0012 * pressK * (heldSap ? 1 : 0)) * on;
          if (f.reduced) {
            sapX = pressWantX;
            sapY_ = pressWantY;
            sapVX = sapVY = 0;
          } else {
            // It springs back: a stiff little stem, under-damped.
            const w = 26;
            const zeta = 0.17;
            const h = Math.min(dt, 1 / 30);
            sapVX += (w * w * (pressWantX - sapX) - 2 * zeta * w * sapVX) * h;
            sapVY += (w * w * (pressWantY - sapY_) - 2 * zeta * w * sapVY) * h;
            sapX += sapVX * h;
            sapY_ += sapVY * h;
          }
          sapU.uPress.value.set(sapX, sapY_);
          // Where the plate's sleeve leaves off, the dark arm carries on, behind it.
          const ox = -cardAt[0] * HAND_PU;
          const oy = cardAt[1] * HAND_PU;
          sleeve.position
            .copy(TOUCH_AT)
            .addScaledVector(_right, ox * cz - oy * sz + offR)
            .add(tmpV.set(0, ox * sz + oy * cz + offU, 0))
            .addScaledVector(tmpV.set(Math.sin(yaw), 0, Math.cos(yaw)), -0.001);
          sleeve.rotation.set(0, yaw, rz);
          sleeve.scale.set(HAND_PU, HAND_PU, 1);
          sleeve.visible = true;
          // The wrist lamp, one light in the scene: found on the plate frame by frame, turned with the hand.
          const led = (m.lamp && m.lamp[at0]) || WRIST_LED;
          const lx = (led[0] - cardAt[0]) * HAND_PU;
          const ly = (cardAt[1] - led[1]) * HAND_PU;
          ledAt.copy(TOUCH_AT).addScaledVector(_right, lx * cz - ly * sz + offR).add(tmpV.set(0, lx * sz + ly * cz + offU, 0));
          // A little toward the camera along the same line of sight: on the plate's lamp, and off the plane of the hand.
          // The visitor moves it along that line too, so it stays on the wrist while the shadows swing.
          tmpV.copy(ledAt).sub(camSite.value);
          plateLamp.copy(camSite.value).addScaledVector(tmpV, 1 - (LAMP_FRONT + lampY * 0.04 * swingK) / Math.max(tmpV.length(), 0.05));
        }
      }
    }
    if (!handOn) {
      card.mesh.visible = card.depth.visible = false;
      sleeve.visible = false;
      sapU.uPress.value.set(0, 0);
    }
    if (contactNow !== contactWas) {
      if (contactNow) touch = 1;
      else touch = Math.max(touch, 0.5);
    }

    // ---- him
    if (onShow) {
      if (nearLander) {
        fig.walk = 0;
        fig.t = clamp((p - S.walkA) / (S.walkB - S.walkA), 0, 1) * figure.duration;
        fig.back = B;
        fig.turnBy = Math.PI;
        fig.helm = 0;
        fig.helmBack = 0;
        fig.kneel = 0;
        fig.reach = 0;
      } else {
        const h = clamp((p - S.helmA) / (S.helmB - S.helmA), 0, 1);
        const tn = clamp((p - S.nearWalkA) / (S.nearWalkB - S.nearWalkA), 0, 1);
        fig.walk = 1;
        fig.t = tn * figure.durationOn;
        fig.helm = h;
        fig.helmBack = B;
        // Coming back he walks facing the way he goes, stops, faces the light again for the helmet,
        // and last of all turns toward the lander.
        fig.back = B * (p < S.nearWalkA ? 1 - smooth(0, 0.16, h) : smooth(0, 0.3, tn));
        // At the end of the helmet he turns all the way to face the lander; walking back he turns right round.
        fig.turnBy = p < S.nearWalkA ? -PLAIN_FACE : Math.PI;
        fig.kneel = smooth(S.nearWalkB, S.kneelB, p);
        fig.reach = smooth(S.kneelB - 0.03, S.nearB + 0.03, p);
        fig.reachAt.set(SAP.x + 0.2, SAP.y + 0.06, SAP.z + 0.02);
      }
      fig.time = time;
      fig.dt = dt;
      fig.reduced = f.reduced;
      fig.gust = gust;
      fig.lookW = lookK * (nearLander ? 0.35 + 0.65 * smooth(0.5, 0.75, fig.t / figure.duration) : 1) * (1 - fig.kneel);
      fig.rim.copy(skyU.uHorSun.value).multiplyScalar(nearLander ? 0.5 : 0.3).add(c1.copy(skyU.uMid.value).multiplyScalar(0.14));
      figure.update(fig);
      // A boot coming down on the sand raises a little dust, whichever way he is going.
      stepGap += dt;
      const w = figure.walks[fig.walk];
      let idx = 0;
      while (idx < w.steps && fig.t >= w.T[idx + 1]) idx++;
      if (lastWalk === fig.walk && idx !== lastStep && !f.reduced && stepGap > 0.14) {
        const onSand = fig.walk === 1 || idx >= 6;
        if (onSand) {
          const foot = figure.feet[idx % 2 === 0 ? 1 : 0];
          kick(foot.x, foot.y, foot.z, 0.2, 0.32);
          stepGap = 0;
        }
      }
      lastStep = idx;
      lastWalk = fig.walk;
    }

    // ---- the one light of the last chapter: on his wrist while he is far, on the plate's wrist when the plate comes in
    const flutter = f.reduced ? 1 : 1 + 0.012 * Math.sin(time * 29.3) + 0.009 * Math.sin(time * 47.7 + 1.3) - 0.05 * Math.pow(Math.max(0, Math.sin(time * 1.7 + 2 * Math.sin(time * 0.43))), 40);
    const pool = lampOn * flutter;
    shared.uLampCol.value.setRGB(1.0 * pool, 0.93 * pool, 0.82 * pool);
    if (lampOn > 0.001) {
      const useHand = handOn ? handK : 0;
      const lampSite = sandU.uLampSite.value;
      if (onShow && useHand < 1) lampSite.copy(figure.wrist);
      if (handOn) lampSite.lerp(plateLamp, onShow ? useHand : 1);
      sandU.uLampDir.value.copy(TOUCH_AT).sub(lampSite).normalize();
      shared.uLampWorld.value.copy(handOn ? ledAt : lampSite).applyMatrix4(group.matrixWorld);
      shared.uLampDir.value.copy(sandU.uLampDir.value).transformDirection(group.matrixWorld);
      lampGlow.material.uniforms.uCenter.value.copy(handOn ? ledAt : lampSite);
      lampGlow.material.uniforms.uColor.value.setRGB(0.66, 0.62, 0.54).multiplyScalar(lampOn * (handOn ? handK : 0));
      lampGlow.visible = handOn && handK > 0.01;
      beam.visible = s > 2.6;
      // The same light on his suit.
      fig.lampCol.copy(shared.uLampCol.value);
      tmpV2.copy(lampSite).applyMatrix4(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      fig.lampView.copy(tmpV2);
    } else {
      lampGlow.visible = false;
      beam.visible = false;
      fig.lampCol.setRGB(0, 0, 0);
    }
    sandU.uLampCol.value.copy(shared.uLampCol.value);

    // His long shadow, away from the sun, and gone when the sun is.
    const sunK = blend1(s, SUN_K);
    if (onShow && !nearLander && s < 2.7) {
      const yaw = Math.atan2(-sun.x, -sun.z);
      const at = figure.pelvis.position;
      shadowMesh.position.set(at.x, groundHeight(at.x, at.z), at.z);
      shadowMesh.rotation.set(0, yaw, 0);
      shadowMesh.scale.set(0.9, 1, 8);
      shadowMat.uniforms.uStrength.value = 0.62 * Math.max(sunK, 0.3) * (1 - smooth(2.3, 2.7, s));
      shadowMesh.visible = true;
    } else {
      shadowMesh.visible = false;
    }

    // ---- what the wind and the visitor kick up
    puffMat.uniforms.uNow.value = windTime.value;
    puffs.visible = windTime.value < puffUntil;
    if (puffs.visible) puffMat.uniforms.uColor.value.copy(dustCol).multiplyScalar(1.5).add(c2.copy(shared.uLampCol.value).multiplyScalar(s > 2.6 ? 0.1 : 0));

    // ---- the sapling
    sapling.visible = s > 2.45;
    touch = Math.max(0, touch - dt * 0.6);
    sapU.uTouch.value = f.reduced ? 0 : touch;
    sapU.uAmb.value.copy(skyLight).multiplyScalar(0.6);
    sapU.uKey.value.copy(sunColor).multiplyScalar(0.2);

    sendScenes(f, contactNow, contactWas);
    contactWas = contactNow;
  }

  return {
    group,
    warmParts: [figure.group, puffs, stones, stoneShadow],
    setSoft(v: number) {
      moonSoft.value = v;
    },
    sunWorld,
    keyWorld,
    sunColor,
    skyLight,
    groundLight,
    hazeColor,
    shot,
    update,
    interact,
    arms: () => figure.armsNow(),
    setSky(a: number) {
      skyTurn = a;
    },
    skyNow: () => ({ angle: skyTurn, up: skyUp, coreEl: Math.asin(clamp(coreNow.y, -1, 1)) }),
    figureAt(out: Vector3) {
      return out.copy(figure.pelvis.position).applyMatrix4(group.matrixWorld);
    },
    debug() {
      return { feet: figure.feet.map((v) => ({ ...v })), lift: [...figure.lift], visible: figure.group.visible, sapPress: [sapX, sapY_], contact: contactWas, kneel: fig.kneel, back: fig.back, helm: fig.helm, t: fig.t, walk: fig.walk, wrist: figure.wrist.toArray(), lamp: sandU.uLampSite.value.toArray() };
    },
    focusWorld,
    lateTextures: [grain],
    lampPass(r: WebGLRenderer) {
      if (!sapRT || !sapling.visible || shared.uLampCol.value.r < 0.0005) return;
      const was = r.getRenderTarget();
      r.getClearColor(c1);
      const alpha = r.getClearAlpha();
      r.setRenderTarget(sapRT);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(sapShadowScene, sapShadowCam);
      r.setRenderTarget(was);
      r.setClearColor(c1, alpha);
    },
    dispose() {
      bank.destroy();
      figure.dispose();
      puffG.dispose();
      puffMat.dispose();
      stoneBase.dispose();
      stones.geometry.dispose();
      stoneShadow.geometry.dispose();
      (stones.material as ShaderMaterial).dispose();
      (stoneShadow.material as ShaderMaterial).dispose();
      grain.dispose();
      sapRT?.dispose();
      sapShadowMat.dispose();
      beamG.dispose();
      beamMat.dispose();
      ripple.dispose();
      noiseTex.dispose();
      for (const m of moonList) m.map.dispose();
      planeG.dispose();
      shadowG.dispose();
    },
  };
}
