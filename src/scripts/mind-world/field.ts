// What keeps the dark reading as space, and gives speed something to streak. Very
// faint, fine stars in a box that wraps around the camera, so space never ends, and a
// few motes in a box scaled to how close the camera is, seen only while flying: at
// rest they are gone. Each draws where it was a frame ago to where it is now: it is
// true motion blur, so turning, flying and zooming all streak the right way. Reduced
// motion keeps them as points.

import {
  AddEquation,
  Color,
  CustomBlending,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Matrix4,
  Mesh,
  OneFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import { lightUniforms, rng, WORLD_LIGHT, type Shared } from "./glsl";

const VS = /* glsl */ `
attribute vec3 iP;
attribute vec4 iM; // size, brightness, seed, tier
attribute vec3 iC;
uniform vec3 uCam;
uniform vec2 uBox;
uniform vec2 uTierA;
uniform mat4 uPrevVP;
uniform float uStreak;
uniform float uMaxLen;
uniform float uLum;
uniform float uTw;
uniform float uTime;
uniform float uDpr;
uniform float uFocal;
uniform vec2 uView;
uniform vec2 uDof;
uniform float uFogK;
varying vec2 vUv;
varying vec3 vC;
varying float vLen;
varying float vDisc;
${WORLD_LIGHT}
void main() {
  float box = iM.w < 0.5 ? uBox.x : uBox.y;
  float tier = iM.w < 0.5 ? uTierA.x : uTierA.y;
  vec3 rel = mod(iP * box - uCam + 0.5 * box, box) - 0.5 * box;
  vec3 wp = uCam + rel;
  vec4 clip = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  vUv = position.xy * 2.0;
  vLen = 0.0;
  vDisc = 0.0;
  vC = vec3(0.0);
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  if (clip.w < box * 0.012 || tier < 0.002) return;
  vec4 prev = uPrevVP * vec4(wp, 1.0);
  vec2 cur = clip.xy / clip.w;
  vec2 pre = prev.w > 0.01 ? prev.xy / prev.w : cur;
  vec2 dpx = (cur - pre) * 0.5 * uView;
  float moved = length(dpx);
  // A star that wrapped around the box jumped: it did not move that far.
  float len = moved > uView.y * 0.3 ? 0.0 : min(moved * uStreak, uMaxLen * uDpr);
  float ps = uFocal / clip.w;
  float s = clamp(iM.x * (0.65 + ps * 1.6), 0.55, 3.2) * uDpr * 0.72;
  float coc = min(abs(clip.w - uDof.x) / clip.w * uDof.y * 0.45, 3.2) * uDpr;
  float size = s + coc;
  vec2 dir = len > 0.4 ? dpx / moved : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float halfLen = size + len * 0.5;
  vec2 off = dir * position.x * 2.0 * halfLen + nrm * position.y * 2.0 * size - dir * len * 0.5;
  clip.xy += off * 2.0 / uView * clip.w;
  gl_Position = clip;
  vLen = len / halfLen * 0.5;
  vDisc = coc / size;
  float dist = length(rel);
  float fog = 1.0 - smoothstep(box * 0.34, box * 0.5, dist);
  float near = smoothstep(0.0, box * 0.05, clip.w);
  float tw = 1.0 + uTw * 0.16 * sin(uTime * 1.1 + iM.z * 40.0);
  float a = (0.26 + pow(max(0.0, 1.0 - clip.w / (box * uFogK)), 2.0) * 1.15) * iM.y * tw * fog * near * tier * uLum;
  // A streak spreads its light along its length, kept visible so speed reads.
  a *= mix(1.0, 0.72, min(1.0, len / (size * 6.0 + 1.0)));
  float thin = s / size;
  vC = worldLight(wp, iC) * a * thin * thin;
}`;

const FS = /* glsl */ `
varying vec2 vUv;
varying vec3 vC;
varying float vLen;
varying float vDisc;
void main() {
  float x = vUv.x;
  float y = vUv.y;
  float r2 = x * x + y * y;
  float dotA = mix(exp(-r2 * 5.0), (1.0 - smoothstep(0.62, 0.95, sqrt(r2))) * 0.85, vDisc);
  float line = exp(-y * y * 7.0) * smoothstep(1.0, 0.72, abs(x)) * (0.36 + 0.64 * (x * 0.5 + 0.5));
  float a = mix(dotA, line, smoothstep(0.02, 0.2, vLen));
  gl_FragColor = vec4(vC * a, 1.0);
}`;

export interface Fields {
  deep: Mesh;
  motes: Mesh;
  update(f: { cam: Vector3; prevVP: Matrix4; worldR: number; dist: number; lum: number; moteLum: number; fly: number }): void;
  dispose(): void;
}

export function buildFields(s: Shared): Fields {
  const r = rng(7741);
  const tints = ["#EEF2FF", "#CFE0FF", "#D9D3FF"].map((h) => new Color(h));

  const make = (n: number, tiers: boolean, sizeOf: () => number, brightOf: () => number, tintOf: () => number) => {
    const base = new PlaneGeometry(1, 1);
    const g = new InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    g.instanceCount = n;
    const p = new Float32Array(n * 3);
    const m = new Float32Array(n * 4);
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p.set([r(), r(), r()], i * 3);
      m.set([sizeOf(), brightOf(), r(), tiers && i % 2 ? 1 : 0], i * 4);
      const t = tints[tintOf()];
      c.set([t.r, t.g, t.b], i * 3);
    }
    g.setAttribute("iP", new InstancedBufferAttribute(p, 3));
    g.setAttribute("iM", new InstancedBufferAttribute(m, 4));
    g.setAttribute("iC", new InstancedBufferAttribute(c, 3));
    return g;
  };

  const shared = { uCam: { value: new Vector3() }, uPrevVP: { value: new Matrix4() } };
  const makeMat = (o: { box: number[]; tier: number[]; streak: number; maxLen: number; fogK: number }) => {
    return new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      uniforms: {
        ...shared,
        uBox: { value: { x: o.box[0], y: o.box[1] } },
        uTierA: { value: { x: o.tier[0], y: o.tier[1] } },
        uStreak: { value: s.reduced ? 0 : o.streak },
        uMaxLen: { value: o.maxLen },
        uLum: { value: 1 },
        uTw: { value: s.reduced ? 0 : 1 },
        uTime: s.time,
        uDpr: s.dpr,
        uFocal: s.focal,
        uView: s.view,
        uDof: { value: { x: 1, y: 0 } },
        uFogK: { value: o.fogK },
        ...lightUniforms(s),
      },
      vertexShader: VS,
      fragmentShader: FS,
    });
  };

  const deepN = s.tier === "high" ? 3000 : s.tier === "mid" ? 2200 : 1200;
  const deepGeo = make(
    deepN,
    false,
    () => 0.3 + r() ** 4 * 0.8,
    () => 0.32 + r() * 0.5,
    () => {
      const u = r();
      return u < 0.55 ? 0 : u < 0.85 ? 1 : 2;
    },
  );
  const deepMat = makeMat({ box: [4000, 4000], tier: [1, 1], streak: 1.8, maxLen: 130, fogK: 0.9 });
  const deep = new Mesh(deepGeo, deepMat);
  deep.frustumCulled = false;
  deep.renderOrder = -55;

  const moteN = s.tier === "high" ? 240 : s.tier === "mid" ? 180 : 110;
  const moteGeo = make(
    moteN,
    true,
    () => 0.3 + r() ** 2 * 0.8,
    () => 0.22 + r() * 0.4,
    () => (r() < 0.8 ? 1 : 2),
  );
  const moteMat = makeMat({ box: [1, 2], tier: [0.5, 0.5], streak: 2.4, maxLen: 300, fogK: 0.55 });
  const motes = new Mesh(moteGeo, moteMat);
  motes.frustumCulled = false;
  motes.renderOrder = -50;

  return {
    deep,
    motes,
    update(f) {
      shared.uCam.value.copy(f.cam);
      shared.uPrevVP.value.copy(f.prevVP);
      // Streaks are for flying: the slow turn at rest leaves points, not little dashes.
      const moving = s.reduced ? 0 : Math.min(1, Math.max(0, (f.fly - 0.05) / 0.16));
      deepMat.uniforms.uStreak.value = 1.8 * moving;
      moteMat.uniforms.uStreak.value = 2.4 * moving;
      const db = f.worldR * 4.6;
      deepMat.uniforms.uBox.value.x = db;
      deepMat.uniforms.uBox.value.y = db;
      deepMat.uniforms.uLum.value = f.lum;
      // The motes' box doubles every doubling of distance, in two layers that trade places.
      const l = Math.log2(Math.max(f.dist * 1.5, 1));
      const lo = Math.floor(l);
      const k = l - lo;
      const a = Math.pow(2, lo);
      const fade = k * k * (3 - 2 * k);
      const even = lo % 2 === 0;
      const uB = moteMat.uniforms.uBox.value;
      const uT = moteMat.uniforms.uTierA.value;
      // The layers alternate so a box never changes size while it shows.
      uB.x = even ? a : a * 2;
      uB.y = even ? a * 2 : a;
      uT.x = even ? 1 - fade : fade;
      uT.y = even ? fade : 1 - fade;
      moteMat.uniforms.uLum.value = f.moteLum;
    },
    dispose() {
      deepGeo.dispose();
      moteGeo.dispose();
      deepMat.dispose();
      moteMat.dispose();
    },
  };
}
