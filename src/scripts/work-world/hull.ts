// The hull: one physical material with its plating drawn in the shader, so it
// stays sharp at any distance and costs no texture memory. Plates at three
// scales with analytic seams, a little height for the light to catch, window
// bands in the warm light of the people inside, and the name painted on it.

import { MeshStandardMaterial, Vector4, type IUniform, type Texture } from "three";

export interface HullOptions {
  /** "polar" lays the plates around the Z axis (the ring), "box" along each face. */
  mode: "polar" | "box";
  color?: number;
  rough?: number;
  metal?: number;
  /** World units of the largest plate. */
  plate?: number;
  /** Window bands, as a fraction of plates that glow. 0 for none. */
  windows?: number;
  /** Size of a window, 1 for the ring's. */
  windowScale?: number;
  /** Radius the polar plates are measured at. */
  r0?: number;
  /** Holes cut in the front and back faces: angle, radius, half width, half height. */
  mouths?: Vector4[];
  /** Painted lettering, polar: a texture wrapped around one band of the front face. */
  livery?: { tex: Texture; r0: number; r1: number };
  envIntensity?: number;
}

const COMMON = /* glsl */ `
varying vec3 vL;
varying vec3 vLN;
uniform float uTime;
uniform float uPlate;
uniform float uWindows;
uniform float uWinScale;
uniform float uR0;
float hh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 hullBump(vec3 N, float h, float amt) {
  vec3 p = -vViewPosition;
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec2 dH = vec2(dFdx(h), dFdy(h)) * amt;
  vec3 g = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * N - g);
}
`;

export function hullMaterial(o: HullOptions) {
  const mat = new MeshStandardMaterial({
    color: o.color ?? 0x8a8378,
    roughness: o.rough ?? 0.56,
    metalness: o.metal ?? 0.82,
    envMapIntensity: o.envIntensity ?? 1,
  });
  const uniforms: Record<string, IUniform> = {
    uTime: { value: 0 },
    uPlate: { value: o.plate ?? 26 },
    uWindows: { value: o.windows ?? 0 },
    uWinScale: { value: o.windowScale ?? 1 },
    uR0: { value: o.r0 ?? 270 },
  };
  if (o.livery) {
    uniforms.tLivery = { value: o.livery.tex };
    uniforms.uLiv = { value: [o.livery.r0, o.livery.r1] };
  }
  const defines: string[] = [];
  if (o.mode === "polar") defines.push("#define HULL_POLAR");
  if (o.windows) defines.push("#define HULL_WINDOWS");
  if (o.livery) defines.push("#define HULL_LIVERY");
  if (o.mouths) {
    defines.push(`#define HULL_MOUTHS ${o.mouths.length}`);
    uniforms.uMouth = { value: o.mouths };
  }

  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vL;\nvarying vec3 vLN;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvL = position;\nvLN = normal;`);
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
${defines.join("\n")}
${COMMON}
#ifdef HULL_LIVERY
uniform sampler2D tLivery; uniform vec2 uLiv;
#endif
#ifdef HULL_MOUTHS
uniform vec4 uMouth[HULL_MOUTHS];
#endif
float hullH; vec3 hullE; float hullR; float hullM;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
  {
    vec3 ln = normalize(vLN);
    vec2 uv; float wf; bool front = false;
#ifdef HULL_POLAR
    float a = atan(vL.y, vL.x);
    float a2 = atan(vL.y, -vL.x);
    float rr = length(vL.xy);
    front = abs(ln.z) > 0.6;
    uv = vec2(a * uR0, front ? rr : vL.z);
    float da = min(fwidth(a), fwidth(a2)) * uR0;
    vec2 fw = vec2(da, fwidth(uv.y));
#ifdef HULL_MOUTHS
    if (front) {
      for (int i = 0; i < HULL_MOUTHS; i++) {
        vec4 m = uMouth[i];
        float dd = abs(mod(a - m.x + PI, 2.0 * PI) - PI) * m.y;
        if (dd < m.z && abs(rr - m.y) < m.w && (vL.z > 0.0 || i == 1)) discard;
      }
    }
#endif
#else
    vec3 an = abs(ln);
    if (an.z > an.x && an.z > an.y) uv = vL.xy;
    else if (an.x > an.y) uv = vL.zy;
    else uv = vL.xz;
    vec2 fw = fwidth(uv);
#endif
    // Large plates, staggered like courses of steel.
    float tone = 1.0;
    vec2 s1 = vec2(uPlate, uPlate * 0.72);
    vec2 q1 = uv / s1;
    float row = floor(q1.y);
    q1.x += mod(row, 2.0) * 0.5;
    vec2 id1 = floor(q1);
    vec2 f1 = fract(q1);
    vec2 d1 = min(f1, 1.0 - f1) * s1;
    float r1 = hh(id1 + 3.1);
    float r2 = hh(id1 + 7.7);
    float seam1 = smoothstep(0.1, 0.1 + fw.x + fw.y + 0.12, min(d1.x, d1.y));
    float k1 = clamp(1.0 - (fw.x + fw.y) / (uPlate * 0.16), 0.0, 1.0);
    // Some plates break into medium ones, and a few of those into small ones.
    vec2 s2 = s1 / vec2(3.0, 2.0);
    vec2 q2 = uv / s2 + vec2(r1 * 11.0, 0.0);
    vec2 id2 = floor(q2);
    vec2 f2 = fract(q2);
    vec2 d2 = min(f2, 1.0 - f2) * s2;
    float use2 = step(0.32, r2);
    float r3 = hh(id2 + 11.3 + id1);
    float seam2 = mix(1.0, smoothstep(0.05, 0.05 + fw.x + fw.y + 0.06, min(d2.x, d2.y)), use2 * clamp(1.0 - (fw.x + fw.y) / (s2.x * 0.4), 0.0, 1.0));
    vec2 s3 = s2 / vec2(4.0, 3.0);
    vec2 q3 = uv / s3 + vec2(r3 * 7.0, 0.0);
    vec2 id3 = floor(q3);
    vec2 f3 = fract(q3);
    vec2 d3 = min(f3, 1.0 - f3) * s3;
    float use3 = use2 * step(0.74, r3);
    float r4 = hh(id3 + 5.9);
    float seam3 = mix(1.0, smoothstep(0.03, 0.03 + fw.x + fw.y + 0.03, min(d3.x, d3.y)), use3 * clamp(1.0 - (fw.x + fw.y) / (s3.x * 0.45), 0.0, 1.0));
    tone = 0.82 + 0.3 * r1 * k1 + use2 * (r3 - 0.5) * 0.24 * k1 + use3 * (r4 - 0.5) * 0.22 * k1;
    float seam = mix(1.0, seam1, k1) * seam2 * seam3;
    // Fine engraved lines and rows of fasteners, for when the camera comes close.
    vec2 s4 = vec2(uPlate * 0.11, uPlate * 0.11);
    vec2 q4 = uv / s4;
    vec2 f4 = abs(fract(q4) - 0.5);
    float kf = clamp(1.0 - (fw.x + fw.y) / (s4.x * 0.3), 0.0, 1.0);
    float fine = 1.0 - (1.0 - smoothstep(0.0, 0.05 + (fw.x + fw.y) / s4.x, 0.5 - max(f4.x, f4.y))) * step(0.74, hh(floor(q4 * vec2(0.25, 0.5)) + id1)) * 0.2 * kf;
    float edgeD = min(d1.x, d1.y);
    vec2 rq = fract(uv / 0.9) - 0.5;
    float rivet = (1.0 - smoothstep(0.1, 0.17, length(rq))) * step(edgeD, 0.8) * step(0.26, edgeD) * clamp(1.0 - (fw.x + fw.y) / 0.5, 0.0, 1.0);
    seam *= fine;
    // Long stains running away from the seams: a working hull.
    float stain = hh(vec2(floor(uv.x / 1.3), id1.x)) * smoothstep(s1.y * 0.7, 0.0, f1.y * s1.y) * step(0.6, hh(vec2(floor(uv.x / 3.1), id1.y)));

    // Plate to plate, the steel is never quite the same.
    float scuff = hh(floor(uv * 3.0) + id1) * 0.08 * k1;
    diffuseColor.rgb *= tone * (0.3 + 0.7 * seam) * (1.0 - scuff) * (1.0 - stain * 0.2 * k1) * (1.0 + rivet * 0.5);
    hullR = roughnessFactor * (0.78 + 0.5 * r3 * k1 + (r1 - 0.5) * 0.2);
    hullM = mix(1.0, 0.72 + 0.28 * r2, k1);
    hullH = (seam * 0.6 + use2 * r3 * 0.25 + r1 * 0.25 + rivet * 0.2) * 0.5;
    hullE = vec3(0.0);
#ifdef HULL_WINDOWS
    // Rows of windows, some lit. From far away they melt into a warm grain.
    vec2 ws = vec2(1.1, 1.5) * uWinScale;
    float bands = 0.0;
#ifdef HULL_POLAR
    if (front) bands = step(mod(uv.y + 6.0, 11.0), 1.5);
    else bands = step(mod(uv.y + 40.0, 9.0), 1.5);
#else
    bands = step(mod(uv.y + 20.0, 7.0 * uWinScale), 1.5 * uWinScale);
#endif
    float bandFar = clamp(fwidth(uv.y) / 1.6, 0.0, 1.0);
    bands = mix(bands, 0.14, bandFar);
    vec2 wq = uv / ws;
    vec2 wid = floor(wq);
    vec2 wf2 = fract(wq);
    float lit = step(1.0 - uWindows, hh(wid + floor(wid.x / 13.0) * 3.0)) * step(0.28, hh(floor(wid / vec2(13.0, 3.0)) + 9.0));
    float flick = 0.7 + 0.3 * sin(uTime * 0.2 + hh(wid) * 40.0);
    float rect = smoothstep(0.34, 0.27, abs(wf2.x - 0.5)) * smoothstep(0.42, 0.35, abs(wf2.y - 0.5));
    float far = clamp((fw.x + fw.y) / (ws.x * 0.9), 0.0, 1.0);
    float w = mix(rect * lit, uWindows * 0.3, far);
    vec3 wc = mix(vec3(1.0, 0.56, 0.2), vec3(1.0, 0.82, 0.58), hh(wid + 1.7));
    hullE += wc * w * bands * flick * 1.9;
    diffuseColor.rgb *= 1.0 - bands * 0.6 * (1.0 - far);
#endif
#ifdef HULL_LIVERY
    if (front && vL.z > 0.0 && rr > uLiv.x && rr < uLiv.y) {
      vec2 luv = vec2(fract(a / (2.0 * PI) + 0.5), (rr - uLiv.x) / (uLiv.y - uLiv.x));
      float paint = textureGrad(tLivery, luv, vec2(dFdx(a2) / (2.0 * PI), dFdx(luv.y)), vec2(dFdy(a2) / (2.0 * PI), dFdy(luv.y))).r;
      paint = smoothstep(0.38, 0.62, paint);
      // Worn paint: the plate seams and a little noise bite into it.
      paint *= 0.72 + 0.28 * seam;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.53, 0.42), paint * 0.94);
      hullR = mix(hullR, 0.62, paint);
      hullM = mix(hullM, 0.18, paint);
    }
#endif
    roughnessFactor = clamp(hullR, 0.06, 1.0);
  }`,
      )
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>\nmetalnessFactor *= hullM;`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\nnormal = hullBump(normal, hullH, 0.55);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\ntotalEmissiveRadiance += hullE;`);
  };
  mat.customProgramCacheKey = () => defines.join("|");
  return { mat, uniforms };
}
