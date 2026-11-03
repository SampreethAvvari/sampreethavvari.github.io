// What the map is made of, all in one light. The heart of the map lights the
// planets and their rings, and sets how hot the stars burn, with one falloff shared
// by all of them. Far bodies sink back into the dark and near ones come forward.
//
// Every star is one instanced quad: a tight core with soft light falling away from
// it, sized by its weight, in a colour from the palette. Tools and case studies are
// quiet stars of the same family. Up close a star is a sphere with a surface of its
// own. Disciplines and stacks are real planets: lit spheres with soft weather and a
// thin rim of air, and fine rings in true 3D that each throw a shadow on the other.

import {
  AddEquation,
  Color,
  CustomBlending,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { PLANET_SCALE } from "./flat";
import { CORE_LIGHT, lightUniforms, NOISE, type Shared } from "./glsl";

export const KIND = { tool: 0, star: 1, planet: 2, comet: 3, shown: 4 } as const;
export { PLANET_SCALE };

/** The colour things turn as they sink into the distance. */
const HAZE = /* glsl */ `vec3(0.5, 0.46, 0.86)`;

const STAR_VS = /* glsl */ `
${CORE_LIGHT}
attribute vec3 iPos;
attribute vec3 iCol;
attribute vec4 iS; // world radius, opacity, focus, kind
attribute float iSeed;
uniform float uFocal;
uniform float uDpr;
uniform vec2 uView;
uniform float uTime;
uniform float uTw;
uniform vec2 uDof;
uniform vec2 uHaze;
varying vec2 vUv;
varying vec3 vCol;
varying vec4 vI; // body radius in the quad, opacity, focus, kind
varying float vSeed;
varying float vDetail;
varying float vFine;
varying vec2 vRing;
void main() {
  vUv = position.xy * 2.0;
  vSeed = iSeed;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  float d = max(-mv.z, 1.0);
  float kind = iS.w;
  bool shown = kind > 3.5;
  float Rcss = iS.x * uFocal / d;
  // The lens: a star away from the focus spreads and thins.
  float coc = (kind > 2.5) ? 0.0 : min(abs(d - uDof.x) / d * uDof.y * 0.32, 5.0) * (1.0 - iS.z);
  float R = sqrt(Rcss * Rcss + coc * coc);
  float thin = (Rcss + 1.2) / (R + 1.2);
  float floorPx = (kind < 0.5 ? 0.65 : 1.15) + iS.z * 2.2;
  float Rd = max(R, floorPx) * uDpr;
  float reach = kind < 0.5 ? 6.0 : kind < 1.5 ? 10.0 : kind < 2.5 ? 2.0 : shown ? 3.0 : 6.0;
  float minHalo = (kind < 0.5 ? 4.0 : kind < 1.5 ? 15.0 : kind < 2.5 ? 0.0 : shown ? 0.0 : 10.0) * uDpr;
  float size = min(max(Rd * reach, minHalo), max(uView.x, uView.y) * 0.9);
  vec4 clip = projectionMatrix * mv;
  clip.xy += position.xy * 2.0 * size * 2.0 / uView * clip.w;
  gl_Position = clip;
  // Colour: from the palette, softened toward starlight, more so for the quiet ones.
  vec3 col = kind < 0.5 ? mix(iCol, vec3(0.8, 0.8, 0.96), 0.2) : mix(iCol, vec3(0.82, 0.86, 1.0), 0.14);
  // Far bodies sink back; a star in hand does not.
  float hz = shown ? 0.0 : clamp((d - uHaze.x) / uHaze.y, 0.0, 1.0) * (1.0 - iS.z);
  vCol = mix(col, ${HAZE} * dot(col, vec3(0.3333)) * 1.3, hz * 0.4);
  // The heart sets how hot it burns, the same falloff the planets are lit by.
  float E = shown ? 1.0 : mix(0.72 + 0.6 * coreLight(iPos), 1.05, iS.z);
  float tw = 1.0 + uTw * 0.09 * (0.62 * sin(uTime * (0.7 + iSeed * 0.9) + iSeed * 40.0) + 0.38 * sin(uTime * (1.6 + iSeed * 2.1) + iSeed * 71.0));
  vI = vec4(Rd / size, iS.y * tw * thin * thin * E * mix(1.04, 0.5, hz), iS.z, kind);
  vDetail = smoothstep(3.5, 9.0, Rcss);
  vFine = smoothstep(14.0, 46.0, Rcss);
  // A planet has a ring of its own already.
  vRing = vec2(kind > 1.5 && kind < 2.5 ? 0.0 : iS.z * (1.0 - smoothstep(12.0, 34.0, Rcss)), size / uDpr);
  if (iS.y <= 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const STAR_FS = (low: boolean) => /* glsl */ `
${NOISE}
uniform float uTime;
varying vec2 vUv;
varying vec3 vCol;
varying vec4 vI;
varying float vSeed;
varying float vDetail;
varying float vFine;
varying vec2 vRing;
void main() {
  float r = length(vUv);
  if (r >= 1.0) discard;
  float rc = vI.x;
  float op = vI.y;
  float foc = vI.z;
  float kind = vI.w;
  float x = r / max(rc, 0.0015);
  float edge = (1.0 - r) * (1.0 - r);
  vec3 c = vec3(0.0);
  if (kind > 1.5 && kind < 2.5) {
    // A planet's air: only the part outside the sphere shows, thin, in the gas's colour.
    float air = exp(-max(x - 1.0, 0.0) * 5.5);
    c = mix(vCol, vec3(0.6, 0.55, 1.0), 0.55) * air * edge * 0.2;
  } else {
    // A tight core, then soft light falling away. Nothing with an edge.
    vec3 hot = mix(vCol, vec3(1.0, 0.98, 0.95), kind < 0.5 ? 0.38 : 0.6);
    float core = exp(-x * x * 1.25);
    float soft = exp(-x * 0.95) * sqrt(edge);
    float far = edge / (1.0 + x * x * 0.16);
    if (kind < 0.5) c = hot * core * 0.82 + vCol * soft * 0.36 + vCol * far * 0.035;
    else c = hot * core * 1.8 + vCol * soft * 0.56 + vCol * far * 0.09;
    if (vDetail > 0.001 && x < 1.06) {
      // Close up it is a sphere with a surface of its own.
      float rr = min(x, 1.0);
      vec3 n = vec3(vUv / max(rc, 0.0015), sqrt(max(0.0, 1.0 - rr * rr)));
      float t = uTime * 0.09;
      float g = ${low ? "fbm2" : "fbm3"}(n * 5.2 + vec3(vSeed * 19.0, t, -t * 0.7));
      float g2 = fbm2(n * 15.0 + vec3(-t, vSeed * 7.0, t * 1.4));
      float limb = pow(n.z, 0.55);
      // Small in the frame it is a smooth hot ball; the boiling surface comes with size.
      float heat = smoothstep(0.26, 0.74, g * 0.72 + mix(0.2, g2 * 0.42, vFine));
      heat = mix(0.55, heat, 0.3 + 0.7 * vFine);
      vec3 surf = mix(vCol * 0.86, hot * 1.3, heat);
      surf *= limb * 0.9 + 0.22;
      float k = vDetail * (1.0 - smoothstep(0.97, 1.06, x));
      // Close up the quiet ones glow too: a sphere is never a dull disc.
      c = mix(c, surf * (max(op, 0.72) / max(op, 0.05)), k);
    }
    if (kind > 0.5 && kind < 1.5) {
      // The faintest spikes of a real lens, stronger on the star in hand.
      vec2 u = vUv;
      float a = exp(-abs(u.y) * 190.0) * exp(-abs(u.x) * 6.0) + exp(-abs(u.x) * 190.0) * exp(-abs(u.y) * 6.0);
      c += mix(vCol, vec3(1.0), 0.3) * a * (0.3 + foc * 0.9);
    }
  }
  if (vRing.x > 0.002) {
    // The focus: a thin ring of its own light, a little off the body.
    float rr = max(rc * 1.9, 0.2);
    float ring = exp(-pow((r - rr) * vRing.y / 1.1, 2.0)) * vRing.x;
    float dash = 0.65 + 0.35 * sin(atan(vUv.y, vUv.x) * 3.0 + uTime * 0.8);
    c += mix(vCol, vec3(1.0), 0.35) * ring * dash * 1.3;
  }
  gl_FragColor = vec4(c * op, 1.0);
}`;

export interface StarBatch {
  mesh: Mesh;
  iPos: InstancedBufferAttribute;
  iCol: InstancedBufferAttribute;
  iS: InstancedBufferAttribute;
  iSeed: InstancedBufferAttribute;
  dispose(): void;
}

/** A batch of star quads. Geometry is a single draw call however many it holds. */
export function makeStarBatch(s: Shared, capacity: number): StarBatch {
  const base = new PlaneGeometry(1, 1);
  const g = new InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  const iPos = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
  const iCol = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
  const iS = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);
  const iSeed = new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
  g.setAttribute("iPos", iPos);
  g.setAttribute("iCol", iCol);
  g.setAttribute("iS", iS);
  g.setAttribute("iSeed", iSeed);
  g.instanceCount = 0;
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    uniforms: {
      uFocal: s.focal,
      uDpr: s.dpr,
      uView: s.view,
      uTime: s.time,
      uDof: s.dof,
      uTw: { value: s.reduced ? 0 : 1 },
      uHaze: s.haze,
      uCoreR: s.coreR,
      uNoise: s.noise,
    },
    vertexShader: STAR_VS,
    fragmentShader: STAR_FS(s.low),
  });
  const mesh = new Mesh(g, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    iPos,
    iCol,
    iS,
    iSeed,
    dispose() {
      g.dispose();
      mat.dispose();
    },
  };
}

// ---- planets ------------------------------------------------------------------

const PLANET_VS = /* glsl */ `
varying vec3 vN;     // object space, for the weather
varying vec3 vWN;    // world space
varying vec3 vWP;
void main() {
  vN = position;
  vWN = normalize(mat3(modelMatrix) * position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const PLANET_FS = (low: boolean) => /* glsl */ `
${NOISE}
${CORE_LIGHT}
uniform vec3 uCol;
uniform vec3 uAir;
uniform vec3 uLight;
uniform vec3 uRingN;
uniform float uSeed;
uniform float uOp;
uniform float uLift;
uniform float uTime;
uniform float uE;
uniform vec3 uCenter;
uniform float uR;
uniform vec2 uHaze;
uniform vec4 uFocus;
uniform vec3 uFocusCol;
varying vec3 vN;
varying vec3 vWN;
varying vec3 vWP;
float bandsAt(vec3 n) {
  float lat = n.y;
  float w = ${low ? "fbm2" : "fbm3"}(vec3(n.x * 1.7 + uSeed, lat * 4.5, n.z * 1.7 - uSeed) + uTime * 0.012);
  float b = sin(lat * (9.0 + uSeed * 0.4) + w * 5.0 + uSeed * 3.0);
  float fine = fbm2(vec3(n.x * 3.0, lat * 22.0, n.z * 3.0) + uSeed * 2.0);
  return 0.5 + 0.2 * b + 0.34 * (fine - 0.42);
}
void main() {
  vec3 n = normalize(vN);
  vec3 N = normalize(vWN);
  vec3 toCam = cameraPosition - vWP;
  float camD = length(toCam);
  vec3 V = toCam / max(camD, 1.0);
  float bands = clamp(bandsAt(n), 0.0, 1.0);
  // Soft weather in the planet's own colour, leaning toward the gas around it.
  vec3 tint = uCol + vec3(0.0, uCol.g * 0.42, uCol.b * 0.5);
  vec3 deep = mix(tint, uAir, 0.4) * 0.3;
  vec3 mid = mix(tint, uAir, 0.08) * 0.68;
  vec3 pale = mix(tint, vec3(1.0, 0.97, 0.92), 0.36) * 0.84;
  vec3 alb = mix(mix(deep, mid, smoothstep(0.18, 0.6, bands)), pale, smoothstep(0.62, 0.96, bands) * 0.7);
  float nl = dot(N, uLight);
  float dif = max(0.0, (nl + 0.14) / 1.14);
  dif = pow(dif, 1.35);
  // The ring's shadow, thrown across the sphere.
  float sh = 1.0;
  float dn = dot(uLight, uRingN);
  if (abs(dn) > 0.001) {
    vec3 P = vWP - uCenter;
    float t = -dot(P, uRingN) / dn;
    if (t > 0.0) {
      float rr = length(P + uLight * t) / uR;
      sh = 1.0 - 0.5 * smoothstep(1.5, 1.58, rr) * (1.0 - smoothstep(2.28, 2.42, rr));
    }
  }
  // One light from the heart, with the same falloff as everything else, and a low
  // bounce from the dark around it so the night side belongs to the same sky.
  float E = uE > 0.0 ? uE : coreLight(vWP) * 2.0;
  vec3 c = alb * vec3(1.0, 0.95, 0.88) * dif * sh * E * 1.55;
  c += alb * (uAir * 0.16 + uCol * 0.1);
  if (uFocus.w > 0.002) {
    vec3 L2 = uFocus.xyz - vWP;
    float d2 = dot(L2, L2);
    float amt = max(dot(N, normalize(L2)), 0.0) * uFocus.w * 7e4 / (d2 + 4e4);
    c += alb * uFocusCol * amt;
  }
  // A thin rim of air, brightest on the lit limb.
  float nv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - nv, 4.6);
  c += mix(uAir * 1.25, uCol, 0.35) * fres * (0.16 + 0.8 * dif * E) * (1.0 + uLift * 0.5);
  // Far ones sink back into the dark.
  float hz = uE > 0.0 ? 0.0 : clamp((camD - uHaze.x) / uHaze.y, 0.0, 1.0) * (1.0 - uLift);
  c = mix(c, ${HAZE} * dot(c, vec3(0.3333)) * 1.15, hz * 0.3) * mix(1.0, 0.72, hz);
  // Dimmed, it fades into the sky behind it instead of turning into a black disc.
  gl_FragColor = vec4(c * uOp, min(1.0, uOp * 2.6));
}`;

const RING_VS = /* glsl */ `
varying vec3 vP;
varying vec3 vWP;
void main() {
  vP = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const RING_FS = /* glsl */ `
${NOISE}
${CORE_LIGHT}
uniform vec3 uCol;
uniform vec3 uAir;
uniform vec3 uLight;
uniform float uSeed;
uniform float uOp;
uniform float uLift;
uniform float uE;
uniform vec3 uCenter;
uniform float uR;
uniform vec2 uHaze;
uniform vec4 uFocus;
uniform vec3 uFocusCol;
varying vec3 vP;
varying vec3 vWP;
void main() {
  float r = length(vP.xy);
  float t = (r - 1.54) / (2.36 - 1.54);
  // Many fine lines, not a thick band. As they get smaller than a pixel they fade
  // into their average, instead of shimmering.
  float fw = fwidth(t);
  float fineK = 1.0 - smoothstep(0.008, 0.04, fw);
  float broad = smoothstep(0.24, 0.8, vnoise(vec3(t * 7.0 + uSeed, uSeed, 0.0)));
  float lines = vnoise(vec3(t * 46.0, uSeed, 0.0)) * 0.6 + vnoise(vec3(t * 120.0, uSeed * 2.0, 1.0)) * 0.4;
  float a = mix(0.42 + broad * 0.18, broad * 0.5 + lines * 0.7, fineK);
  a *= smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.78, 1.0, t));
  a *= 1.0 - (1.0 - smoothstep(0.0, 0.012 + fw, abs(t - 0.62))) * 0.9;
  a *= 0.34;
  // The planet's shadow lies across the far side.
  vec3 P = vWP - uCenter;
  float b = dot(P, uLight);
  float sh = 1.0;
  if (b < 0.0) {
    float perp = length(P - uLight * b);
    sh = smoothstep(uR * 0.94, uR * 1.08, perp);
  }
  float E = uE > 0.0 ? uE : coreLight(vWP) * 2.0;
  vec3 c = mix(uCol, vec3(1.0, 0.96, 0.9), 0.3 + t * 0.2) * vec3(1.0, 0.94, 0.86) * (0.08 + 0.92 * sh) * E * 0.7;
  c += uAir * 0.05 + uAir * uLift * 0.1;
  if (uFocus.w > 0.002) {
    vec3 L2 = uFocus.xyz - vWP;
    c += uFocusCol * uFocus.w * 3e4 / (dot(L2, L2) + 4e4) * 0.4;
  }
  float hz = uE > 0.0 ? 0.0 : clamp((length(cameraPosition - vWP) - uHaze.x) / uHaze.y, 0.0, 1.0) * (1.0 - uLift);
  c = mix(c, ${HAZE} * dot(c, vec3(0.3333)) * 1.15, hz * 0.3) * mix(1.0, 0.72, hz);
  float o = a * uOp;
  gl_FragColor = vec4(c * o, o);
}`;

export interface Planet {
  group: Group;
  body: Mesh;
  ring: Mesh;
  ringNormal: Vector3;
  set(x: number, y: number, z: number, r: number, color: string, seed: number): void;
  /** Where it is and how big, for one that moves. */
  place(x: number, y: number, z: number, r: number): void;
  update(op: number, lift: number, light: Vector3): void;
  /** A planet held in the card: the same look, in a light of its own. */
  fixedLight(e: number): void;
  visible(on: boolean): void;
}

export interface Planets {
  list: Planet[];
  dispose(): void;
}

// The gas around each planet: it picks up a little of it.
const AIR = [new Color(0.46, 0.4, 0.92), new Color(0.36, 0.46, 0.95), new Color(0.54, 0.38, 0.86), new Color(0.38, 0.52, 0.86)];

export function buildPlanets(s: Shared, n: number): Planets {
  const sphere = s.low ? new SphereGeometry(1, 40, 28) : new SphereGeometry(1, 72, 48);
  const ringGeo = new RingGeometry(1.54, 2.36, s.low ? 96 : 180, 1);
  const bodyBase = new ShaderMaterial({
    uniforms: {},
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    vertexShader: PLANET_VS,
    fragmentShader: PLANET_FS(s.low),
  });
  const ringBase = new ShaderMaterial({
    uniforms: {},
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    vertexShader: RING_VS,
    fragmentShader: RING_FS,
  });
  const list: Planet[] = [];
  for (let i = 0; i < n; i++) {
    const uniforms = {
      uCol: { value: new Color() },
      uAir: { value: AIR[i % AIR.length].clone() },
      uLight: { value: new Vector3(0, 1, 0) },
      uRingN: { value: new Vector3(0, 1, 0) },
      uSeed: { value: i * 1.7 + 0.3 },
      uOp: { value: 1 },
      uLift: { value: 0 },
      uE: { value: 0 },
      uTime: s.time,
      uCenter: { value: new Vector3() },
      uR: { value: 1 },
      uHaze: s.haze,
      uCoreR: s.coreR,
      uNoise: s.noise,
      ...lightUniforms(s),
    };
    const bodyMat = bodyBase.clone();
    bodyMat.uniforms = uniforms;
    const ringMat = ringBase.clone();
    ringMat.uniforms = uniforms;
    const body = new Mesh(sphere, bodyMat);
    const ring = new Mesh(ringGeo, ringMat);
    body.frustumCulled = ring.frustumCulled = false;
    body.renderOrder = -30;
    ring.renderOrder = -20;
    const group = new Group();
    group.add(body, ring);
    const q = new Quaternion();
    const ringNormal = new Vector3(0, 0, 1);
    list.push({
      group,
      body,
      ring,
      ringNormal,
      set(x, y, z, r, color, seed) {
        group.position.set(x, y, z);
        group.scale.setScalar(r);
        uniforms.uCol.value.set(color);
        uniforms.uCenter.value.set(x, y, z);
        uniforms.uR.value = r;
        uniforms.uSeed.value = seed;
        // Each planet leans its own way, so the four never look stamped.
        const a = 1.25 + Math.sin(seed * 12.9) * 0.28;
        const b = Math.sin(seed * 7.3) * 0.42;
        const c = seed * 2.4;
        q.setFromEuler(new Euler(a, b, c));
        ring.quaternion.copy(q);
        ringNormal.set(0, 0, 1).applyQuaternion(q);
        uniforms.uRingN.value.copy(ringNormal);
        // the weather lines up with the ring
        body.quaternion.copy(q).multiply(new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0)));
      },
      place(x, y, z, r) {
        group.position.set(x, y, z);
        group.scale.setScalar(r);
        uniforms.uCenter.value.set(x, y, z);
        uniforms.uR.value = r;
      },
      update(op, lift, light) {
        uniforms.uOp.value = op;
        uniforms.uLift.value = lift;
        uniforms.uLight.value.copy(light);
        group.visible = op > 0.004;
        // Once it is see through, the stars behind it should show through too.
        (body.material as ShaderMaterial).depthWrite = op > 0.34;
      },
      fixedLight(e) {
        uniforms.uE.value = e;
      },
      visible(on) {
        group.visible = on;
      },
    });
  }
  return {
    list,
    dispose() {
      sphere.dispose();
      ringGeo.dispose();
      for (const p of list) {
        (p.body.material as ShaderMaterial).dispose();
        (p.ring.material as ShaderMaterial).dispose();
      }
      bodyBase.dispose();
      ringBase.dispose();
    },
  };
}
