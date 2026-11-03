// The trail: the career as a comet's path, with years as depth. Eleven hundred
// units of Z to the year, so the early years are long empty stretches and the
// recent ones come quickly. Six bodies stand along it, one per chapter:
//
//   2017  a small dark moon, where the comet starts
//   2021  a tuned gate, rings of a standing sound wave (Shure makes audio gear)
//   2023  a gas giant with rings, the long swing of graduate school
//   2024  a lens with a working iris (video producer)
//   2024  a binary pair, a model and the judge it trained against (research)
//   2025  the station itself, with one light for each of 45 live services

import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Material,
} from "three";
import { SUN_DIR } from "./sky";
import { DEG, TAU, box, cyl, clamp, lerp, merge, place, rng, smooth } from "./util";

export const NOW_YEAR = 2026.85;
export const PER_YEAR = 1100;
export const zAt = (year: number) => (NOW_YEAR - year) * PER_YEAR;

export const BODY = {
  moon: new Vector3(430, -190, zAt(2017.5)),
  gate: new Vector3(-240, 160, zAt(2021.6)),
  giant: new Vector3(1180, -1120, zAt(2023.6)),
  iris: new Vector3(-250, 110, zAt(2024.0)),
  binary: new Vector3(420, 470, zAt(2024.4)),
  now: new Vector3(0, 0, 0),
};
export const MOON_R = 86;
export const GIANT_R = 960;
export const IRIS_R = 150;

const AMBER = new Color(1, 0.62, 0.26);

const NOISE = /* glsl */ `
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < OCT; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(17.1, 9.2, 3.7); a *= 0.5; } return s; }
`;

const BODY_VS = /* glsl */ `
varying vec3 vN; varying vec3 vO; varying vec3 vW;
void main() {
  vO = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// ---------------------------------------------------------------- moon

function buildMoon(low: boolean) {
  const mat = new ShaderMaterial({
    defines: { OCT: low ? 4 : 6 },
    uniforms: { uSun: { value: SUN_DIR }, uHot: { value: 0 }, uTime: { value: 0 } },
    vertexShader: BODY_VS,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform mat4 modelMatrix;
      uniform vec3 uSun; uniform float uHot, uTime;
      varying vec3 vN, vO, vW;
      float crater(vec3 p, float scale) {
        vec3 g = p * scale;
        vec3 i = floor(g);
        float h = 0.0;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
          vec3 c = i + vec3(float(x), float(y), float(z));
          vec3 o = hash33(c);
          float r = 0.16 + 0.3 * o.x * o.x;
          float d = length(g - (c + o)) / r;
          if (o.y > 0.45) h += smoothstep(1.15, 0.86, d) * (smoothstep(0.1, 0.9, d) - 0.9) * (0.5 + o.z);
        }
        return h;
      }
      float height(vec3 p) {
        return fbm(p * 3.2) * 0.7 + crater(p, 3.0) * 0.26 + crater(p + 4.1, 7.0) * 0.1 + crater(p + 1.3, 17.0) * 0.04;
      }
      void main() {
        vec3 n = normalize(vO);
        vec3 wn = normalize(vN);
        float e = 0.012;
        vec3 t = normalize(cross(n, vec3(0.3, 1.0, 0.2)));
        vec3 b = cross(n, t);
        float h0 = height(n);
        float hx = height(normalize(n + t * e));
        float hy = height(normalize(n + b * e));
        vec3 pert = normalize(wn - (mat3(modelMatrix) * t * (hx - h0) + mat3(modelMatrix) * b * (hy - h0)) / e * 0.22);
        float nl = clamp(dot(pert, uSun), 0.0, 1.0);
        float soft = smoothstep(-0.05, 0.16, dot(wn, uSun));
        vec3 alb = mix(vec3(0.17, 0.15, 0.13), vec3(0.42, 0.37, 0.31), fbm(n * 5.0 + 3.0)) * (0.78 + h0 * 0.5);
        vec3 c = alb * vec3(1.0, 0.72, 0.45) * nl * soft * 3.4;
        // A trace of light from the comet being born on its dark side.
        c += alb * vec3(1.0, 0.6, 0.24) * pow(clamp(dot(wn, normalize(vec3(-0.2, 0.34, 1.0))), 0.0, 1.0), 5.0) * (0.03 + uHot * 0.34);
        c += vec3(1.0, 0.56, 0.2) * step(0.9985, hash13(floor(n * 180.0))) * uHot * 5.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new Mesh(new SphereGeometry(MOON_R, low ? 64 : 128, low ? 48 : 96), mat);
  m.position.copy(BODY.moon);
  m.rotation.set(0.4, 0.8, 0.1);
  return { mesh: m, mat };
}

// ---------------------------------------------------------------- the tuned gate

function buildGate(low: boolean) {
  const group = new Group();
  group.position.copy(BODY.gate);
  const RN = 13;
  const seg = low ? 72 : 128;
  const steel = new MeshStandardMaterial({ color: 0x8a8378, roughness: 0.36, metalness: 0.95 });
  const glowMats: MeshBasicMaterial[] = [];
  const rings = Array.from({ length: RN }, (_, i) => {
    const k = i / (RN - 1);
    // A horn: wide at both ends, a throat in the middle.
    const r = 56 + 92 * Math.pow(Math.abs(k - 0.5) * 2, 1.7);
    const g = new Group();
    const z = (k - 0.5) * 340;
    g.position.z = z;
    const tube = new Mesh(new TorusGeometry(r, 1.3 + 0.8 * (i % 3 === 0 ? 1 : 0), 8, seg), steel);
    g.add(tube);
    const parts: ReturnType<typeof box>[] = [];
    const spokes = i % 2 ? 12 : 6;
    for (let s = 0; s < spokes; s++) {
      const a = (s / spokes) * TAU;
      parts.push(place(box(14, 1.2, 3.4), Math.cos(a) * (r + 7), Math.sin(a) * (r + 7), 0, 0, 0, a));
    }
    g.add(new Mesh(merge(parts), steel));
    const gm = new MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(3) });
    glowMats.push(gm);
    const line = new Mesh(new TorusGeometry(r - 2, 0.28, 5, seg), gm);
    g.add(line);
    group.add(g);
    return { g, z, r, line, gm };
  });
  // Long stringers holding the rings true.
  const st: ReturnType<typeof box>[] = [];
  for (let s = 0; s < 6; s++) {
    const a = (s / 6) * TAU + 0.26;
    for (let i = 0; i < RN - 1; i++) {
      const A = rings[i];
      const B = rings[i + 1];
      const pa = new Vector3(Math.cos(a) * (A.r + 14), Math.sin(a) * (A.r + 14), A.z);
      const pb = new Vector3(Math.cos(a) * (B.r + 14), Math.sin(a) * (B.r + 14), B.z);
      const d = new Vector3().subVectors(pb, pa);
      const mid = new Vector3().addVectors(pa, pb).multiplyScalar(0.5);
      const b = box(1.3, 1.3, d.length());
      const m = new Matrix4().lookAt(pb, pa, new Vector3(0, 1, 0));
      m.setPosition(mid);
      b.applyMatrix4(m);
      st.push(b);
    }
  }
  group.add(new Mesh(merge(st), steel));
  const hit = new Mesh(new SphereGeometry(200, 16, 12), new MeshBasicMaterial({ visible: false }));
  group.add(hit);
  return {
    group,
    hit,
    update(t: number, hot: number) {
      rings.forEach((o, i) => {
        // A standing wave: nodes hold still, antinodes breathe.
        const w = Math.sin(i * 0.9 - t * 1.7) * (1 + hot * 1.4);
        o.g.position.z = o.z + w * 3.2;
        const l = Math.max(0, w);
        o.gm.color.copy(AMBER).multiplyScalar(1.2 + l * l * (5 + hot * 12));
      });
    },
    dispose() {
      steel.dispose();
      glowMats.forEach((m) => m.dispose());
    },
  };
}

// ---------------------------------------------------------------- gas giant

function buildGiant(low: boolean) {
  const group = new Group();
  group.position.copy(BODY.giant);
  group.rotation.set(0.32, 0.5, -0.32);
  const mat = new ShaderMaterial({
    defines: { OCT: low ? 3 : 5 },
    uniforms: { uSun: { value: SUN_DIR }, uTime: { value: 0 }, uHot: { value: 0 } },
    vertexShader: BODY_VS,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform vec3 uSun; uniform float uTime, uHot;
      varying vec3 vN, vO, vW;
      void main() {
        vec3 n = normalize(vO);
        vec3 wn = normalize(vN);
        vec3 view = normalize(cameraPosition - vW);
        float lat = n.y;
        // Latitude bands, pushed around by turbulence that shears with latitude.
        float shear = sin(lat * 13.0) * 0.5;
        vec3 sp = vec3(n.x * cos(shear + uTime * 0.01) - n.z * sin(shear + uTime * 0.01), n.y, n.x * sin(shear + uTime * 0.01) + n.z * cos(shear + uTime * 0.01));
        float w1 = fbm(sp * vec3(3.2, 13.0, 3.2) + 4.0);
        float w2 = fbm(sp * vec3(9.0, 38.0, 9.0) + w1 * 3.0);
        float b = lat * 9.0 + (w1 - 0.5) * 1.3 + (w2 - 0.5) * 0.45;
        float bands = 0.5 + 0.5 * sin(b * 3.1);
        float fine = 0.5 + 0.5 * sin(b * 11.0 + w2 * 3.0);
        vec3 pale = vec3(0.94, 0.72, 0.46);
        vec3 rust = vec3(0.44, 0.19, 0.07);
        vec3 deep = vec3(0.18, 0.07, 0.03);
        vec3 alb = mix(rust, pale, smoothstep(0.2, 0.85, bands));
        alb = mix(alb, deep, smoothstep(0.55, 1.0, fine) * 0.35);
        // One long storm.
        vec3 st = normalize(vec3(0.62, -0.2, 0.76));
        vec2 sq = vec2(acos(clamp(dot(normalize(n * vec3(1.0, 1.0, 1.0)), st), -1.0, 1.0)), 0.0);
        float stormD = length(vec2((n.y - st.y) * 7.0, (atan(n.z, n.x) - atan(st.z, st.x)) * 2.6));
        float storm = smoothstep(1.0, 0.25, stormD + (w2 - 0.5) * 0.8);
        alb = mix(alb, mix(vec3(0.95, 0.5, 0.2), vec3(0.3, 0.1, 0.04), smoothstep(0.1, 0.9, sin(stormD * 9.0 - uTime * 0.2) * 0.5 + 0.5)), storm);
        float nl = dot(wn, uSun);
        float day = smoothstep(-0.12, 0.6, nl);
        vec3 c = alb * day * vec3(1.0, 0.76, 0.5) * 2.4;
        // Limb darkening and a thin bright rim of air against the star.
        float vn = clamp(dot(wn, view), 0.0, 1.0);
        c *= 0.35 + 0.65 * pow(vn, 0.45);
        float rim = pow(1.0 - vn, 3.4);
        c += vec3(1.0, 0.54, 0.2) * rim * smoothstep(-0.32, 0.26, nl) * 3.4;
        c += alb * vec3(0.5, 0.26, 0.1) * 0.05;
        gl_FragColor = vec4(c, 1.0);
        void(sq);
      }`.replace("void(sq);", ""),
  });
  const sphere = new Mesh(new SphereGeometry(GIANT_R, low ? 96 : 192, low ? 64 : 128), mat);
  group.add(sphere);
  // The air, beyond the limb.
  const airMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: BackSide,
    uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: BODY_VS,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; varying vec3 vN, vO, vW;
      void main() {
        vec3 wn = normalize(vN);
        vec3 view = normalize(cameraPosition - vW);
        float vn = clamp(-dot(wn, view), 0.0, 1.0);
        float a = pow(smoothstep(0.0, 0.42, vn), 3.2);
        gl_FragColor = vec4(vec3(1.0, 0.5, 0.18) * a * 1.6 * smoothstep(-0.4, 0.3, dot(wn, uSun)), 1.0);
      }`,
  });
  const air = new Mesh(new SphereGeometry(GIANT_R * 1.07, 96, 64), airMat);
  group.add(air);
  // Rings.
  const R0 = GIANT_R * 1.34;
  const R1 = GIANT_R * 2.15;
  const ringMat = new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uSun: { value: SUN_DIR }, uCentre: { value: BODY.giant }, uR: { value: GIANT_R }, uHot: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vL; varying vec3 vW; void main(){ vL=position; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun, uCentre; uniform float uR, uHot; varying vec3 vL; varying vec3 vW;
      float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }
      float n1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(h(i),h(i+1.0),f); }
      void main() {
        float r = length(vL.xy);
        float t = (r - ${R0.toFixed(1)}) / ${(R1 - R0).toFixed(1)};
        float d = n1(t * 90.0) * 0.5 + n1(t * 260.0) * 0.32 + n1(t * 800.0) * 0.18;
        float a = smoothstep(0.26, 0.75, d) * smoothstep(0.0, 0.03, t) * smoothstep(1.0, 0.94, t);
        a *= 1.0 - 0.85 * smoothstep(0.54, 0.56, t) * smoothstep(0.6, 0.58, t);
        // The planet's shadow falls across the ring.
        vec3 toC = uCentre - vW;
        float along = dot(toC, -uSun);
        float off = length(toC + uSun * along);
        float lit = 1.0 - (1.0 - smoothstep(uR * 0.96, uR * 1.03, off)) * step(along, 0.0);
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a * lit * 0.62, 1.0);
      }`,
  });
  const ring = new Mesh(new RingGeometry(R0, R1, low ? 128 : 256, 1), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const hit = new Mesh(new SphereGeometry(GIANT_R, 24, 16), new MeshBasicMaterial({ visible: false }));
  group.add(hit);
  return {
    group,
    hit,
    update(t: number, hot: number, scale: number) {
      mat.uniforms.uTime.value = t * (1 + hot * 3);
      group.scale.setScalar(scale);
    },
    dispose() {
      [mat, airMat, ringMat].forEach((m) => m.dispose());
    },
  };
}

// ---------------------------------------------------------------- lens

function buildIris(low: boolean) {
  const group = new Group();
  group.position.copy(BODY.iris);
  group.rotation.set(0.1, -0.5, 0.08);
  const seg = low ? 96 : 200;
  const barrelMat = new MeshStandardMaterial({ color: 0x4a463f, roughness: 0.42, metalness: 0.92 });
  const steel = new MeshStandardMaterial({ color: 0x8a8378, roughness: 0.3, metalness: 0.98 });
  const blackMat = new MeshStandardMaterial({ color: 0x14120f, roughness: 0.3, metalness: 0.92 });
  const R = IRIS_R;
  // Barrel: stepped rings, knurled like a lens.
  const rings: ReturnType<typeof box>[] = [];
  const addRing = (r: number, tube: number, z: number) => rings.push(place(new TorusGeometry(r, tube, 10, seg), 0, 0, z));
  addRing(R + 6, 9, 0);
  addRing(R + 10, 5, 22);
  addRing(R + 13, 7, -24);
  addRing(R + 6, 4, 44);
  addRing(R + 14, 4, -50);
  const barrel = new Mesh(merge(rings), barrelMat);
  group.add(barrel);
  const knurlN = low ? 80 : 180;
  const knurl: ReturnType<typeof box>[] = [];
  for (let i = 0; i < knurlN; i++) {
    const a = (i / knurlN) * TAU;
    knurl.push(place(box(2, 2.4, 13), Math.cos(a) * (R + 19), Math.sin(a) * (R + 19), -24, 0, 0, a));
  }
  group.add(new Mesh(merge(knurl), steel));
  // Index marks in light around the front, like stops on a lens.
  const ticks: ReturnType<typeof box>[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const long = i % 6 === 0;
    ticks.push(place(box(long ? 8 : 4, 0.5, 0.4), Math.cos(a) * (R + 10 + (long ? 4 : 2)), Math.sin(a) * (R + 10 + (long ? 4 : 2)), 12, 0, 0, a));
  }
  const tickMat = new MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(5) });
  group.add(new Mesh(merge(ticks), tickMat));
  // The blades.
  const N = 12;
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(R * 1.28, -R * 0.08);
  s.lineTo(R * 1.2, R * 0.6);
  s.quadraticCurveTo(R * 0.62, R * 0.44, 0, 0);
  const geo = new ExtrudeGeometry(s, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.3, bevelSegments: 1, curveSegments: 16 });
  const pivots = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * TAU;
    const p = new Group();
    p.position.set(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2), i * 0.34);
    p.rotation.z = a + Math.PI;
    const inner = new Group();
    const mesh = new Mesh(geo, blackMat);
    inner.add(mesh);
    p.add(inner);
    group.add(p);
    return inner;
  });
  const hit = new Mesh(new SphereGeometry(R + 30, 16, 12), new MeshBasicMaterial({ visible: false }));
  group.add(hit);
  return {
    group,
    hit,
    /** open: 0 almost shut, 1 wide. */
    update(open: number) {
      const e = lerp(6, 62, open) * DEG;
      pivots.forEach((p) => (p.rotation.z = -e));
    },
    dispose() {
      [barrelMat, steel, blackMat, tickMat].forEach((m) => m.dispose());
    },
  };
}

// ---------------------------------------------------------------- binary

function buildBinary(low: boolean) {
  const group = new Group();
  group.position.copy(BODY.binary);
  group.rotation.set(0.5, 0, 0.18);
  const starMat = (scale: number, tint: Color) =>
    new ShaderMaterial({
      defines: { OCT: low ? 3 : 5 },
      uniforms: { uTime: { value: 0 }, uTint: { value: tint }, uScale: { value: scale } },
      vertexShader: BODY_VS,
      fragmentShader: /* glsl */ `
        ${NOISE}
        uniform float uTime, uScale; uniform vec3 uTint; varying vec3 vN, vO, vW;
        void main() {
          vec3 n = normalize(vO);
          vec3 view = normalize(cameraPosition - vW);
          float vn = clamp(dot(normalize(vN), view), 0.0, 1.0);
          float g = fbm(n * uScale + vec3(uTime * 0.07, 0.0, -uTime * 0.05));
          float g2 = fbm(n * uScale * 3.2 + g * 3.0);
          float cells = smoothstep(0.3, 0.72, g2);
          vec3 c = uTint * (0.5 + g * 1.0 + cells * 1.25) * (0.42 + 0.85 * pow(vn, 0.7));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
  const aMat = starMat(5.2, new Color(1, 0.46, 0.14));
  const bMat = starMat(8.2, new Color(1, 0.7, 0.38));
  const A = new Mesh(new SphereGeometry(58, 64, 48), aMat);
  const B = new Mesh(new SphereGeometry(30, 48, 32), bMat);
  group.add(A, B);
  // A soft glow around each.
  const glowMat = (size: number, c: Color) =>
    new ShaderMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      uniforms: { uSize: { value: size }, uC: { value: c } },
      vertexShader: `uniform float uSize; varying vec2 vP; void main(){ vP=position.xy*2.0; vec3 c=(modelViewMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; gl_Position=projectionMatrix*vec4(c+vec3(position.xy*uSize*2.0,0.0),1.0); }`,
      fragmentShader: `uniform vec3 uC; varying vec2 vP; void main(){ float r=length(vP); float a=exp(-max(r-0.28,0.0)*6.0)*0.5*(1.0-smoothstep(0.8,1.0,r)); gl_FragColor=vec4(uC*a,1.0); }`,
    });
  const haloA = new Mesh(new PlaneGeometry(1, 1), glowMat(210, new Color(1, 0.46, 0.14)));
  const haloB = new Mesh(new PlaneGeometry(1, 1), glowMat(110, new Color(1, 0.62, 0.3)));
  haloA.frustumCulled = false;
  haloB.frustumCulled = false;
  haloA.renderOrder = 2;
  haloB.renderOrder = 2;
  A.add(haloA);
  B.add(haloB);
  // The stream between them, and a disc of what they have thrown off.
  const N = low ? 3000 : 16000;
  const R = rng(5150);
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    seed[i * 3] = R();
    seed[i * 3 + 1] = R();
    seed[i * 3 + 2] = R();
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("aS", new BufferAttribute(seed, 3));
  const dustMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uA: { value: new Vector3() }, uB: { value: new Vector3() }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aS; uniform float uTime, uPx; uniform vec3 uA, uB; varying float vB;
      void main() {
        float k = fract(aS.x + uTime * (0.015 + aS.y * 0.02));
        // Half the dust spirals around the pair; the rest runs from one star to the other.
        vec3 p;
        if (aS.z < 0.55) {
          float r = 120.0 + pow(aS.y, 1.2) * 520.0;
          // Two arms, wound tight.
          float arm = step(0.5, fract(aS.x * 7.3)) * 3.14159;
          float a = arm + (aS.x - 0.5) * 0.9 + uTime * (3.0 / (r * 0.05 + 2.0)) + log(r) * 3.4;
          p = vec3(cos(a) * r, (aS.z - 0.27) * 16.0 * (1.0 + r * 0.004), sin(a) * r);
          vB = 0.34 + 1.1 * pow(1.0 - aS.y, 2.0);
        } else {
          vec3 d = uB - uA;
          float s = sin(k * 3.14159);
          float a = k * 12.0 + aS.y * 6.28;
          vec3 side = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
          p = mix(uA, uB, k) + side * cos(a) * s * 11.0 + vec3(0.0, sin(a) * s * 11.0, 0.0);
          vB = 1.8 * s + 0.2;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * clamp(900.0 / -mv.z, 1.0, 5.0);
      }`,
    fragmentShader: `varying float vB; void main(){ float a=smoothstep(0.5,0.08,length(gl_PointCoord-0.5)); gl_FragColor=vec4(vec3(1.0,0.66,0.32)*vB*a,1.0); }`,
  });
  const dust = new Points(geo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);
  const hitA = new Mesh(new SphereGeometry(90, 16, 12), new MeshBasicMaterial({ visible: false }));
  const hitB = new Mesh(new SphereGeometry(70, 16, 12), new MeshBasicMaterial({ visible: false }));
  A.add(hitA);
  B.add(hitB);
  let phase = 0;
  return {
    group,
    hitA,
    hitB,
    update(t: number, dt: number, hot: number) {
      phase += dt * (0.16 + hot * 0.7);
      const sep = 118;
      A.position.set(Math.cos(phase) * sep * 0.35, 0, Math.sin(phase) * sep * 0.35);
      B.position.set(-Math.cos(phase) * sep * 0.95, 0, -Math.sin(phase) * sep * 0.95);
      aMat.uniforms.uTime.value = t;
      bMat.uniforms.uTime.value = t;
      dustMat.uniforms.uTime.value = t;
      dustMat.uniforms.uA.value.copy(A.position);
      dustMat.uniforms.uB.value.copy(B.position);
    },
    worldA: A,
    worldB: B,
    dispose() {
      [aMat, bMat, dustMat, haloA.material as Material, haloB.material as Material].forEach((m) => m.dispose());
    },
  };
}

// ---------------------------------------------------------------- the path

function pathPoints() {
  const P = (x: number, y: number, y0: number) => new Vector3(x, y, zAt(y0));
  const g = BODY.giant;
  const toGate = new Vector3(BODY.gate.x - g.x, BODY.gate.y - g.y, 0).normalize();
  const limb = (off: number, year: number, spin: number) => {
    const v = toGate.clone().applyAxisAngle(new Vector3(0, 0, 1), spin).multiplyScalar(GIANT_R + off);
    return new Vector3(g.x + v.x, g.y + v.y, zAt(year));
  };
  return [
    new Vector3(BODY.moon.x - 30, BODY.moon.y + 40, BODY.moon.z + MOON_R * 0.92),
    new Vector3(BODY.moon.x - 90, BODY.moon.y + 120, BODY.moon.z - 240),
    P(190, 40, 2019),
    P(-60, 120, 2020.4),
    P(-220, 170, 2021.2),
    new Vector3(BODY.gate.x, BODY.gate.y, BODY.gate.z),
    new Vector3(BODY.gate.x + 10, BODY.gate.y - 6, BODY.gate.z - 500),
    P(-80, 100, 2022.6),
    limb(180, 2023.25, 0.34),
    limb(46, 2023.55, -0.02),
    limb(120, 2023.78, -0.42),
    new Vector3(BODY.iris.x + 80, BODY.iris.y - 40, BODY.iris.z + 150),
    new Vector3(BODY.iris.x, BODY.iris.y, BODY.iris.z),
    new Vector3(BODY.iris.x - 40, BODY.iris.y + 50, BODY.iris.z - 200),
    P(240, 360, 2024.28),
    new Vector3(BODY.binary.x, BODY.binary.y, BODY.binary.z),
    new Vector3(BODY.binary.x - 180, BODY.binary.y - 200, BODY.binary.z - 300),
    P(120, -60, 2025.4),
    P(-30, -40, 2026.1),
    new Vector3(0, 0, 128),
  ];
}

export const trailCurve = () => new CatmullRomCurve3(pathPoints(), false, "centripetal");

const RIBBON_VS = /* glsl */ `
attribute vec3 aT; attribute float aSide; attribute float aU;
uniform float uHead, uPx, uBase;
varying float vS; varying float vU; varying float vK; varying float vD;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 vt = normalize((modelViewMatrix * vec4(aT, 0.0)).xyz);
  vec3 sideV = normalize(cross(vt, normalize(mv.xyz)));
  float dist = -mv.z;
  vD = dist;
  float back = uHead - aU;
  // Wider toward the comet behind it, a thin thread ahead of it.
  float k = back >= 0.0 ? 1.0 : 0.0;
  float world = k * (uBase + 3.4 * exp(-back * 400.0) + 1.3 * exp(-back * 34.0)) + (1.0 - k) * 0.7;
  float minW = 1.3 * dist / uPx;
  float w = max(world, minW);
  vec3 p = mv.xyz + sideV * w * aSide;
  vS = aSide; vU = aU; vK = back;
  gl_Position = projectionMatrix * vec4(p, 1.0);
}`;
const RIBBON_FS = /* glsl */ `
uniform float uTime, uGain;
varying float vS; varying float vU; varying float vK; varying float vD;
float h(float x){ return fract(sin(x * 91.17) * 43758.5453); }
float n1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(h(i),h(i+1.0),f); }
void main() {
  float s = vS * vS;
  float core = exp(-s * 26.0);
  float halo = exp(-s * 5.0) * 0.42;
  float lens = smoothstep(14.0, 260.0, vD);
  if (vK >= 0.0) {
    float flow = 0.72 + 0.28 * n1(vU * 900.0 - uTime * 2.2) + 0.3 * n1(vU * 180.0 + uTime * 0.3);
    float near = 1.0 + 2.0 * exp(-vK * 90.0);
    vec3 c = vec3(1.0, 0.6, 0.24) * (core * 2.6 + halo * 0.8) * flow * near * uGain * lens;
    gl_FragColor = vec4(c, 1.0);
  } else {
    float dash = step(0.46, fract(vU * 620.0));
    gl_FragColor = vec4(vec3(1.0, 0.68, 0.36) * core * 0.9 * dash * uGain * lens, 1.0);
  }
}`;

export function buildTrail(opts: { low: boolean; font: string }) {
  const { low } = opts;
  const group = new Group();
  const curve = trailCurve();
  curve.arcLengthDivisions = 2400;
  const N = low ? 1200 : 2600;
  const pos = new Float32Array((N + 1) * 2 * 3);
  const tan = new Float32Array((N + 1) * 2 * 3);
  const side = new Float32Array((N + 1) * 2);
  const us = new Float32Array((N + 1) * 2);
  const idx = new Uint32Array(N * 6);
  const a = new Vector3();
  const b = new Vector3();
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    curve.getPointAt(u, a);
    curve.getTangentAt(u, b);
    for (let k = 0; k < 2; k++) {
      const v = i * 2 + k;
      pos.set([a.x, a.y, a.z], v * 3);
      tan.set([b.x, b.y, b.z], v * 3);
      side[v] = k ? 1 : -1;
      us[v] = u;
    }
    if (i < N) idx.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
  }
  const rg = new BufferGeometry();
  rg.setAttribute("position", new BufferAttribute(pos, 3));
  rg.setAttribute("aT", new BufferAttribute(tan, 3));
  rg.setAttribute("aSide", new BufferAttribute(side, 1));
  rg.setAttribute("aU", new BufferAttribute(us, 1));
  rg.setIndex(new BufferAttribute(idx, 1));
  const ribbonMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    vertexShader: RIBBON_VS,
    fragmentShader: RIBBON_FS,
    uniforms: { uHead: { value: 0 }, uTime: { value: 0 }, uPx: { value: 800 }, uBase: { value: 0.9 }, uGain: { value: 1 } },
  });
  const ribbon = new Mesh(rg, ribbonMat);
  ribbon.frustumCulled = false;
  ribbon.renderOrder = 4;
  group.add(ribbon);

  // Dust shed along the way.
  const DN = low ? 3000 : 14000;
  const R = rng(2024);
  const dp = new Float32Array(DN * 3);
  const du = new Float32Array(DN * 2);
  const p = new Vector3();
  for (let i = 0; i < DN; i++) {
    const u = R();
    curve.getPointAt(u, p);
    const spread = 6 + 60 * R() * R() * R();
    dp.set([p.x + (R() - 0.5) * spread * 2, p.y + (R() - 0.5) * spread * 2, p.z + (R() - 0.5) * spread * 2], i * 3);
    du.set([u, R()], i * 2);
  }
  const dg = new BufferGeometry();
  dg.setAttribute("position", new BufferAttribute(dp, 3));
  dg.setAttribute("aU", new BufferAttribute(du, 2));
  const dustMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    uniforms: { uHead: { value: 0 }, uPx: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec2 aU; uniform float uHead, uPx, uTime; varying float vB;
      void main() {
        float back = uHead - aU.x;
        float lit = step(0.0, back);
        vB = lit * (0.12 + 0.5 * aU.y * aU.y + 2.2 * exp(-back * 60.0)) + (1.0 - lit) * 0.03;
        vB *= 0.7 + 0.3 * sin(uTime * 0.7 + aU.y * 40.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * clamp(240.0 / -mv.z, 1.0, 7.0);
      }`,
    fragmentShader: `varying float vB; void main(){ float a=smoothstep(0.5,0.1,length(gl_PointCoord-0.5)); gl_FragColor=vec4(vec3(1.0,0.66,0.32)*vB*a,1.0); }`,
  });
  const dust = new Points(dg, dustMat);
  dust.frustumCulled = false;
  group.add(dust);

  // The comet: a hard small body in a bright head of gas.
  const head = new Group();
  const nucleus = new Mesh(new IcosahedronGeometry(2.8, 2), new MeshBasicMaterial({ color: new Color(1, 0.8, 0.54).multiplyScalar(12) }));
  head.add(nucleus);
  const comaMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    uniforms: { uSize: { value: 34 }, uTime: { value: 0 } },
    vertexShader: `uniform float uSize; varying vec2 vP; void main(){ vP=position.xy*2.0; vec3 c=(modelViewMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; gl_Position=projectionMatrix*vec4(c+vec3(position.xy*uSize*2.0,0.0),1.0); }`,
    fragmentShader: `varying vec2 vP; void main(){ float r=length(vP); float a=exp(-r*9.0)*1.7+exp(-r*3.0)*0.2; a*=1.0-smoothstep(0.8,1.0,r); gl_FragColor=vec4(vec3(1.0,0.66,0.32)*a,1.0); }`,
  });
  const coma = new Mesh(new PlaneGeometry(1, 1), comaMat);
  coma.frustumCulled = false;
  coma.renderOrder = 5;
  head.add(coma);
  group.add(head);

  // Years: a thin arc across the path and its number, standing in space.
  const yearGroup = new Group();
  group.add(yearGroup);
  const yearFrom = 2018;
  const yearTo = 2026;
  const lut: { z: number; u: number }[] = [];
  for (let i = 0; i <= 1600; i++) {
    const u = i / 1600;
    curve.getPointAt(u, p);
    lut.push({ z: p.z, u });
  }
  const uAtZ = (z: number) => {
    let best = 0;
    let d = 1e9;
    for (const e of lut) {
      const k = Math.abs(e.z - z);
      if (k < d) {
        d = k;
        best = e.u;
      }
    }
    return best;
  };
  const arcGeoFor = (r: number, span: number) => new TorusGeometry(r, 0.34, 4, 72, span);
  const numMat: Material[] = [];
  const textures: CanvasTexture[] = [];
  const arcMat = new MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(2.2) });
  for (let y = yearFrom; y <= yearTo; y++) {
    const u = uAtZ(zAt(y));
    curve.getPointAt(u, p);
    curve.getTangentAt(u, b);
    const yg = new Group();
    yg.position.copy(p);
    yg.lookAt(p.x - b.x, p.y - b.y, p.z - b.z);
    const span = (150 + ((y * 47) % 80)) * DEG;
    const arc = new Mesh(arcGeoFor(52, span), arcMat);
    arc.rotation.z = ((y * 83) % 360) * DEG;
    yg.add(arc);
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 192;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.textBaseline = "middle";
    x.font = `600 168px ${opts.font}`;
    (x as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "-8px";
    x.fillText(String(y), 6, 100);
    const tex = new CanvasTexture(c);
    tex.anisotropy = low ? 2 : 8;
    textures.push(tex);
    const nm = new MeshBasicMaterial({ map: tex, transparent: true, blending: AdditiveBlending, depthWrite: false, color: AMBER.clone().multiplyScalar(1.5) });
    numMat.push(nm);
    const plane = new Mesh(new PlaneGeometry(58, 21.75), nm);
    // Each number on its own side of the path.
    const ang = ((y * 139) % 360) * DEG;
    plane.position.set(Math.cos(ang) * 70, Math.sin(ang) * 46, 0);
    plane.renderOrder = 3;
    yg.add(plane);
    yearGroup.add(yg);
  }

  // Bodies.
  const moon = buildMoon(low);
  const gate = buildGate(low);
  const giant = buildGiant(low);
  const iris = buildIris(low);
  const binary = buildBinary(low);
  group.add(moon.mesh, gate.group, giant.group, iris.group, binary.group);

  // Forty five services, one light each, in loose orbits around the station.
  const services = new InstancedMesh(new IcosahedronGeometry(1.5, 0), new MeshBasicMaterial({ color: new Color(1, 0.74, 0.42).multiplyScalar(16) }), 45);
  services.frustumCulled = false;
  services.instanceMatrix.setUsage(DynamicDrawUsage);
  const SR = rng(45);
  const orbit = Array.from({ length: 45 }, () => ({
    r: 330 + SR() * 210,
    y: (SR() - 0.5) * 0.5,
    a: SR() * TAU,
    v: (0.03 + SR() * 0.05) * (SR() < 0.5 ? -1 : 1),
    z: 30 + SR() * 130,
  }));
  group.add(services);

  const hits: { mesh: Mesh; stop: string; read: (m: Mesh) => { id: string; note: number } }[] = [
    { mesh: moon.mesh, stop: "t2017", read: () => ({ id: "moon", note: 0 }) },
    { mesh: gate.hit, stop: "t2021", read: () => ({ id: "gate", note: 1 }) },
    { mesh: giant.hit, stop: "t2023", read: () => ({ id: "giant", note: 2 }) },
    { mesh: iris.hit, stop: "t2024v", read: () => ({ id: "iris", note: 3 }) },
    { mesh: binary.hitA, stop: "t2024r", read: () => ({ id: "model", note: 4 }) },
    { mesh: binary.hitB, stop: "t2024r", read: () => ({ id: "judge", note: 5 }) },
  ];

  const hotOf: Record<string, number> = {};
  const m4 = new Matrix4();
  const q4 = new Quaternion();
  const s4 = new Vector3();
  const p4 = new Vector3();
  const headP = new Vector3();

  return {
    group,
    curve,
    hits,
    uAtZ,
    headPosition: headP,
    setHot(stop: string, v: number) {
      hotOf[stop] = v;
    },
    /** Move the comet to path position u and set everything going. */
    update(t: number, dt: number, u: number, dpr: number, heightPx: number, fov: number, opts2: { servicesOn: number; irisOpen: number; giantScale: number; cam: Vector3; speed: number }) {
      gate.group.visible = gate.group.position.distanceTo(opts2.cam) < 1500;
      iris.group.visible = iris.group.position.distanceTo(opts2.cam) < 1700;
      binary.group.visible = binary.group.position.distanceTo(opts2.cam) < 1900;
      moon.mesh.visible = moon.mesh.position.distanceTo(opts2.cam) < 4600;
      yearGroup.children.forEach((yg, i) => {
        const d = yg.position.distanceTo(opts2.cam);
        const k = (1 - smooth((d - 360) / 620)) * smooth(opts2.speed / 0.22);
        yg.visible = k > 0.01;
        (numMat[i] as MeshBasicMaterial).color.copy(AMBER).multiplyScalar(1.5 * k);
      });
      const uh = clamp(u, 0, 1);
      ribbonMat.uniforms.uHead.value = uh;
      ribbonMat.uniforms.uTime.value = t;
      ribbonMat.uniforms.uPx.value = (heightPx * dpr * 0.5) / Math.tan((fov * DEG) / 2);
      dustMat.uniforms.uHead.value = uh;
      dustMat.uniforms.uPx.value = dpr;
      dustMat.uniforms.uTime.value = t;
      curve.getPointAt(uh, headP);
      head.position.copy(headP);
      nucleus.rotation.y = t * 0.4;
      moon.mat.uniforms.uHot.value = hotOf.t2017 ?? 0;
      gate.update(t, hotOf.t2021 ?? 0);
      giant.update(t, hotOf.t2023 ?? 0, opts2.giantScale);
      iris.update(clamp(opts2.irisOpen + (hotOf.t2024v ?? 0) * 0.35));
      binary.update(t, dt, hotOf.t2024r ?? 0);
      const on = opts2.servicesOn;
      services.visible = on > 0.001;
      if (services.visible) {
        for (let i = 0; i < 45; i++) {
          const o = orbit[i];
          const a = o.a + t * o.v;
          p4.set(Math.cos(a) * o.r, Math.sin(a) * o.r * (0.92 + o.y * 0.1), o.z);
          const birth = smooth(on * 2 - (i / 45));
          q4.identity();
          m4.compose(p4, q4, s4.setScalar(birth));
          services.setMatrixAt(i, m4);
        }
        services.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      group.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      ribbonMat.dispose();
      dustMat.dispose();
      comaMat.dispose();
      arcMat.dispose();
      numMat.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      moon.mat.dispose();
      gate.dispose();
      giant.dispose();
      iris.dispose();
      binary.dispose();
      (services.material as Material).dispose();
      (nucleus.material as Material).dispose();
    },
  };
}
export type Trail = ReturnType<typeof buildTrail>;
void cyl;
