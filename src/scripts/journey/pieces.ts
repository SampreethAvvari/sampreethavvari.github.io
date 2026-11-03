// Chapter set pieces. Each one is built around the flight path at its
// chapter, lit in its chapter's colour, and only drawn while it is near.
//
// Pieces are picked by chapter id when the id is known, otherwise by order.

import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Points,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  CircleGeometry,
  type Camera,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { additive, GlowBatch } from "./fx";
import { NOISE } from "./glsl";
import { landingPhase, type FlightPath, type Landing } from "./path";
import { rng } from "./textures";

export interface Piece {
  id: string;
  group: Group;
  /** 0..1, shared with this piece's shaders so it can fade in and out. */
  fade: { value: number };
  weight(p: number): number;
  /** How much this piece lifts the sky nebula. */
  nebula?: number;
  /** A warm glow in the sky toward a direction. */
  warm?: { amount: number; dir: Vector3 };
  /** A bright light that should throw a lens flare. */
  flare?: { pos: Vector3; color: Color; strength: number };
  update?(time: number, dt: number, p: number, camera: Camera, pxScale: number, dpr: number): void;
}

interface Ctx {
  path: FlightPath;
  chapters: { id: string; color: Color }[];
  low: boolean;
  glowTex: Texture;
  cloudTex: Texture;
  landing: Landing;
}

type Builder = (i: number, color: Color, ctx: Ctx) => Piece;

const ORDER = ["launch", "proof", "projects", "disciplines", "writing", "film", "mind", "contact"];

export function buildPieces(ctx: Ctx): Piece[] {
  const builders: Record<string, Builder> = { launch, proof, projects, disciplines, writing, film, mind, contact };
  const out: Piece[] = [];
  const used = new Set<string>();
  ctx.chapters.forEach((ch, i) => {
    let key = builders[ch.id] && !used.has(ch.id) ? ch.id : ORDER[i % ORDER.length];
    // The last chapter always lands on the horizon.
    if (i === ctx.chapters.length - 1 && !builders[ch.id]) key = "contact";
    used.add(key);
    out.push(builders[key](i, ch.color, ctx));
  });
  return out;
}

// ------------------------------------------------------------------ helpers

interface Frame {
  pos: Vector3;
  quat: Quaternion;
  right: Vector3;
  up: Vector3;
  fwd: Vector3;
}

function frameAt(path: FlightPath, p: number): Frame {
  const f: Frame = { pos: new Vector3(), quat: new Quaternion(), right: new Vector3(), up: new Vector3(), fwd: new Vector3() };
  path.frame(p, f.pos, f.quat, f.right, f.up, f.fwd);
  return f;
}

/** World point at progress p, offset sideways (x), up (y) and ahead (z). */
function place(path: FlightPath, p: number, x: number, y: number, z = 0, out = new Vector3()) {
  const f = frameAt(path, p);
  return out.copy(f.pos).addScaledVector(f.right, x).addScaledVector(f.up, y).addScaledVector(f.fwd, z);
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** On between a and b, easing in and out over ramp. */
function windowed(a: number, b: number, ramp: number) {
  return (p: number) => smooth(a - ramp, a, p) * (1 - smooth(b, b + ramp, p));
}

function hdr(c: Color, k: number) {
  return c.clone().multiplyScalar(k);
}

function standard(color: number, metalness: number, roughness: number, extra: Partial<MeshStandardMaterial> = {}) {
  const m = new MeshStandardMaterial({ color, metalness, roughness });
  Object.assign(m, extra);
  return m;
}

const SHARED_LIGHT = new Vector3(0.62, 0.42, 0.35).normalize();

// ------------------------------------------------------------------ shaders

const PLANET_VS = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
void main() {
  vObj = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const PLANET_FS = (oct: number) => /* glsl */ `
#define OCTAVES ${oct}
${NOISE}
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uAtmo;
uniform vec3 uLight;
uniform vec3 uCity;
uniform float uSeed;
uniform float uBands;
uniform float uBandMix;
uniform float uFade;
uniform float uDetail;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
void main() {
  float n = fbm(vObj * 2.4 + uSeed);
  float n2 = fbm(vObj * 8.0 + n * 2.2 + uSeed * 1.7);
  float bands = sin(vObj.y * uBands + n * 5.0 + n2 * 1.4) * 0.5 + 0.5;
  float m = clamp(mix(n * 1.7 - 0.35, bands, uBandMix), 0.0, 1.0);
  vec3 alb = mix(uA, uB, m) * (0.72 + 0.5 * n2);
  if (uDetail > 0.0) {
    // Dunes and ridges that only matter up close, on the landing world.
    float fine = vnoise(vObj * 700.0) * 0.6 + vnoise(vObj * 2300.0) * 0.4;
    float ridge = 1.0 - abs(vnoise(vObj * 160.0 + n) * 2.0 - 1.0);
    alb *= mix(1.0, 0.7 + 0.5 * fine + 0.25 * ridge * ridge, uDetail);
  }
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float ndl = dot(N, uLight);
  float day = smoothstep(-0.1, 0.65, ndl);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  vec3 col = alb * day * 1.15;
  col += uAtmo * fres * (0.18 + 1.3 * smoothstep(-0.3, 0.5, ndl));
  // City lights on the night side, for planets that have them.
  float city = step(0.6, n2) * step(0.5, hash13(floor(vObj * 180.0))) * (1.0 - smoothstep(-0.25, 0.05, ndl));
  col += uCity * city * 1.6;
  gl_FragColor = vec4(col * uFade, uFade);
}
`;

const ATMO_VS = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const ATMO_FS = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uFade;
uniform float uEdge;
uniform float uPower;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float k = clamp(-dot(N, V) / uEdge, 0.0, 1.0);
  float lit = 0.2 + 1.2 * smoothstep(-0.35, 0.6, dot(N, uLight));
  float a = pow(k, uPower) * lit;
  gl_FragColor = vec4(uColor * a * uFade, 1.0);
}
`;

const PUFF_VS = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aCol; // rgb, size
attribute float aRot;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  float c = cos(aRot);
  float s = sin(aRot);
  vec2 q = mat2(c, -s, s, c) * position.xy;
  mv.xy += q * aCol.a;
  vUv = position.xy * 0.5 + 0.5;
  vCol = aCol.rgb;
  float d = -mv.z;
  vA = smoothstep(aCol.a * 0.3, aCol.a * 1.4, d) * step(1.0, d);
  gl_Position = projectionMatrix * mv;
}
`;

const PUFF_FS = /* glsl */ `
uniform sampler2D tCloud;
uniform float uFade;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
void main() {
  float a = texture2D(tCloud, vUv).a;
  gl_FragColor = vec4(vCol * a * vA * uFade * uOpacity, 1.0);
}
`;

/** Soft nebula billboards in one draw call. */
function puffs(list: { pos: Vector3; size: number; color: Color; rot: number }[], cloud: Texture, fade: { value: number }, opacity: number) {
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const pos = new Float32Array(list.length * 3);
  const col = new Float32Array(list.length * 4);
  const rot = new Float32Array(list.length);
  list.forEach((p, i) => {
    pos.set([p.pos.x, p.pos.y, p.pos.z], i * 3);
    col.set([p.color.r, p.color.g, p.color.b, p.size], i * 4);
    rot[i] = p.rot;
  });
  g.setAttribute("aPos", new InstancedBufferAttribute(pos, 3));
  g.setAttribute("aCol", new InstancedBufferAttribute(col, 4));
  g.setAttribute("aRot", new InstancedBufferAttribute(rot, 1));
  g.instanceCount = list.length;
  const m = additive(
    new ShaderMaterial({
      vertexShader: PUFF_VS,
      fragmentShader: PUFF_FS,
      uniforms: { tCloud: { value: cloud }, uFade: fade, uOpacity: { value: opacity } },
      side: DoubleSide,
    }),
  );
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return mesh;
}

function planet(
  ctx: Ctx,
  fade: { value: number },
  o: { radius: number; a: Color; b: Color; atmo: Color; seed: number; bands?: number; bandMix?: number; city?: Color; light?: Vector3; segs?: number; detail?: number },
) {
  const g = new Group();
  const segs = o.segs ?? (ctx.low ? 40 : 72);
  const light = o.light ?? SHARED_LIGHT;
  const body = new Mesh(
    new SphereGeometry(o.radius, segs, Math.round(segs * 0.6)),
    new ShaderMaterial({
      vertexShader: PLANET_VS,
      fragmentShader: PLANET_FS(ctx.low ? 3 : 5),
      uniforms: {
        uA: { value: o.a },
        uB: { value: o.b },
        uAtmo: { value: o.atmo },
        uLight: { value: light },
        uCity: { value: o.city ?? new Color(0, 0, 0) },
        uSeed: { value: o.seed },
        uBands: { value: o.bands ?? 0 },
        uBandMix: { value: o.bandMix ?? 0 },
        uFade: fade,
        uDetail: { value: o.detail ?? 0 },
      },
      transparent: true,
    }),
  );
  const shell = new Mesh(
    new SphereGeometry(o.radius * 1.12, Math.round(segs * 0.7), Math.round(segs * 0.4)),
    additive(
      new ShaderMaterial({
        vertexShader: ATMO_VS,
        fragmentShader: ATMO_FS,
        uniforms: { uColor: { value: o.atmo }, uLight: { value: light }, uFade: fade, uEdge: { value: 0.47 }, uPower: { value: 2.4 } },
        side: BackSide,
      }),
    ),
  );
  g.add(body, shell);
  return g;
}

// ------------------------------------------------------------------ 1 launch

function launch(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const at = i + 0.2;
  const f = frameAt(path, at);
  group.position.copy(f.pos).addScaledVector(f.up, 1.5);
  group.quaternion.copy(f.quat);

  const R = 24;
  const ringMat = new MeshBasicMaterial({ color: hdr(color, 4.5) });
  const ring = new Mesh(new TorusGeometry(R, 0.42, 10, low ? 96 : 180), ringMat);
  const inner = new Mesh(new TorusGeometry(R - 1.3, 0.06, 6, low ? 96 : 180), new MeshBasicMaterial({ color: new Color(2.4, 2.5, 2.7) }));
  const halo = new Mesh(new TorusGeometry(R + 5.4, 0.08, 6, low ? 96 : 180), new MeshBasicMaterial({ color: hdr(color, 2.2) }));

  // The gate's machinery: armoured segments with lit gaps.
  const SEGS = low ? 18 : 28;
  const frame = new Group();
  const segGeo = new BoxGeometry(2 * Math.PI * (R + 2) / SEGS - 1.1, 2.6, 3.6);
  const segMat = standard(0x232934, 0.85, 0.32);
  const segs = new InstancedMesh(segGeo, segMat, SEGS);
  const capGeo = new BoxGeometry(2 * Math.PI * (R + 2) / SEGS - 2.2, 0.5, 2.8);
  const caps = new InstancedMesh(capGeo, standard(0xc9ced6, 0.4, 0.35), SEGS);
  const gapGeo = new BoxGeometry(0.5, 1.8, 3.9);
  const gaps = new InstancedMesh(gapGeo, new MeshBasicMaterial({ color: hdr(color, 3.2) }), SEGS);
  const m = new Matrix4();
  const q = new Quaternion();
  const z = new Vector3(0, 0, 1);
  const v = new Vector3();
  const one = new Vector3(1, 1, 1);
  for (let k = 0; k < SEGS; k++) {
    const a = (k / SEGS) * Math.PI * 2;
    q.setFromAxisAngle(z, a - Math.PI / 2);
    segs.setMatrixAt(k, m.compose(v.set(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2), 0), q, one));
    caps.setMatrixAt(k, m.compose(v.set(Math.cos(a) * (R + 3.5), Math.sin(a) * (R + 3.5), 0), q, one));
    const b = a + Math.PI / SEGS;
    q.setFromAxisAngle(z, b - Math.PI / 2);
    gaps.setMatrixAt(k, m.compose(v.set(Math.cos(b) * (R + 2), Math.sin(b) * (R + 2), 0), q, one));
  }
  frame.add(segs, caps, gaps);

  // The membrane of light inside the gate.
  const memMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        #define OCTAVES 3
        ${NOISE}
        uniform vec3 uColor; uniform float uTime; uniform float uFade; uniform float uNear;
        varying vec2 vUv;
        void main() {
          vec2 d = vUv - 0.5;
          float r = length(d) * 2.0;
          float ang = atan(d.y, d.x);
          float swirl = fbm(vec3(cos(ang) * 2.0 + r * 3.0, sin(ang) * 2.0 - uTime * 0.25, r * 2.0 - uTime * 0.15));
          float edge = pow(r, 7.0) * 0.9;
          float body = (0.015 + swirl * 0.06) * smoothstep(0.2, 0.95, r);
          float a = (edge + body) * smoothstep(1.0, 0.97, r) * uFade * uNear;
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
      uniforms: { uColor: { value: hdr(color, 1.4) }, uTime: { value: 0 }, uFade: fade, uNear: { value: 1 } },
      side: DoubleSide,
    }),
  );
  const membrane = new Mesh(new CircleGeometry(R - 0.5, low ? 48 : 96), memMat);
  membrane.renderOrder = 7;

  // Two smaller echo rings further along the line.
  const echoes = new Group();
  for (const [dz, r, k] of [
    [-80, 16, 2.4],
    [-170, 11, 1.6],
  ]) {
    const e = new Mesh(new TorusGeometry(r, 0.22, 8, 96), new MeshBasicMaterial({ color: hdr(color, k) }));
    e.position.z = dz;
    echoes.add(e);
  }

  const beacons = new GlowBatch(SEGS, fade);
  for (let k = 0; k < SEGS; k++) {
    const a = ((k + 0.5) / SEGS) * Math.PI * 2;
    beacons.add(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2), 2.2, 1.6, color.r, color.g, color.b, 1.6);
  }

  group.add(ring, inner, halo, frame, membrane, echoes, beacons.mesh);
  const local = new Vector3();
  return {
    id: "launch",
    group,
    fade,
    weight: windowed(-5, i + 0.85, 0.35),
    nebula: 0.1,
    update(time, dt, _p, camera) {
      frame.rotation.z += dt * 0.04;
      echoes.rotation.z -= dt * 0.06;
      memMat.uniforms.uTime.value = time;
      local.copy(camera.position);
      group.worldToLocal(local);
      memMat.uniforms.uNear.value = smooth(3, 26, Math.abs(local.z));
      for (let k = 0; k < SEGS; k++) beacons.setIntensity(k, 1.2 + 1.4 * Math.pow(0.5 + 0.5 * Math.sin(time * 2 - k * 0.7), 4));
      beacons.commit();
    },
  };
}

// ------------------------------------------------------------------ 2 proof

function shardGeometry(seed: number) {
  const r = rng(seed);
  const g = new IcosahedronGeometry(1, 0);
  const pos = g.getAttribute("position") as BufferAttribute;
  const jitter = new Map<string, number[]>();
  for (let k = 0; k < pos.count; k++) {
    const key = `${pos.getX(k).toFixed(3)},${pos.getY(k).toFixed(3)},${pos.getZ(k).toFixed(3)}`;
    if (!jitter.has(key)) jitter.set(key, [0.7 + r() * 0.6, 0.7 + r() * 0.6, 0.7 + r() * 0.6]);
    const j = jitter.get(key)!;
    pos.setXYZ(k, pos.getX(k) * j[0] * 0.55, pos.getY(k) * j[1] * 1.7, pos.getZ(k) * j[2] * 0.6);
  }
  g.computeVertexNormals();
  return g;
}

function proof(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const r = rng(101);
  const N = low ? 60 : 150;
  const variants = 3;
  const per = Math.ceil(N / variants);
  const rockMat = standard(0x3c4350, 0.55, 0.44, { flatShading: true });
  rockMat.emissive = hdr(color, 0.03);
  const meshes: InstancedMesh[] = [];
  for (let k = 0; k < variants; k++) {
    const im = new InstancedMesh(shardGeometry(7 + k), rockMat, per);
    im.frustumCulled = false;
    meshes.push(im);
    group.add(im);
  }
  interface Shard {
    pos: Vector3;
    axis: Vector3;
    speed: number;
    angle: number;
    scale: Vector3;
    mesh: number;
    slot: number;
  }
  const shards: Shard[] = [];
  const counts = new Array(variants).fill(0);
  for (let k = 0; k < N; k++) {
    const p = i - 0.5 + r() * 1.3;
    const th = r() * Math.PI * 2;
    const rad = 13 + Math.pow(r(), 1.5) * 130;
    const s = 0.9 + Math.pow(r(), 3) * 9;
    const mesh = k % variants;
    shards.push({
      pos: place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.75),
      axis: new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
      speed: (r() - 0.5) * 0.5,
      angle: r() * Math.PI * 2,
      scale: new Vector3(s, s * (0.8 + r() * 0.6), s),
      mesh,
      slot: counts[mesh]++,
    });
  }
  meshes.forEach((m, k) => (m.count = counts[k]));

  // Glowing crystals and the light filaments that join them.
  const CN = low ? 10 : 26;
  const crystals = new InstancedMesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ color: hdr(color, 3.2) }), CN);
  crystals.frustumCulled = false;
  const cpos: Vector3[] = [];
  const mm = new Matrix4();
  const qq = new Quaternion();
  for (let k = 0; k < CN; k++) {
    const p = i - 0.4 + r() * 1.2;
    const th = r() * Math.PI * 2;
    const rad = 16 + r() * 70;
    const pos = place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.7);
    cpos.push(pos);
    qq.setFromAxisAngle(new Vector3(r(), r(), r()).normalize(), r() * 3);
    const s = 0.35 + r() * 0.6;
    crystals.setMatrixAt(k, mm.compose(pos, qq, new Vector3(s * 0.6, s * 1.8, s * 0.6)));
  }
  group.add(crystals);

  const lp: number[] = [];
  const lt: number[] = [];
  const nodes = [...cpos, ...shards.filter((s) => s.scale.x < 3).map((s) => s.pos)];
  for (let a = 0; a < cpos.length; a++) {
    let links = 0;
    for (let b = 0; b < nodes.length && links < 3; b++) {
      if (nodes[b] === cpos[a]) continue;
      const d = cpos[a].distanceTo(nodes[b]);
      if (d < 55 && d > 6) {
        lp.push(cpos[a].x, cpos[a].y, cpos[a].z, nodes[b].x, nodes[b].y, nodes[b].z);
        const seed = r();
        lt.push(0, seed, 1, seed);
        links++;
      }
    }
  }
  const lg = new BufferGeometry();
  lg.setAttribute("position", new BufferAttribute(new Float32Array(lp), 3));
  lg.setAttribute("aT", new BufferAttribute(new Float32Array(lt), 2));
  const lineMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `attribute vec2 aT; varying vec2 vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uTime; uniform float uFade;
        varying vec2 vT;
        void main() {
          float pulse = pow(0.5 + 0.5 * sin((vT.x - uTime * 0.35 - vT.y * 7.0) * 6.2832), 10.0);
          float a = (0.22 + 1.4 * pulse) * uFade;
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
      uniforms: { uColor: { value: hdr(color, 1.6) }, uTime: { value: 0 }, uFade: fade },
    }),
  );
  const lines = new LineSegments(lg, lineMat);
  lines.frustumCulled = false;
  group.add(lines);

  const sc = new Vector3();
  return {
    id: "proof",
    group,
    fade,
    weight: windowed(i - 0.6, i + 1.0, 0.25),
    nebula: 0.15,
    update(time, dt) {
      lineMat.uniforms.uTime.value = time;
      for (const s of shards) {
        s.angle += s.speed * dt;
        qq.setFromAxisAngle(s.axis, s.angle);
        meshes[s.mesh].setMatrixAt(s.slot, mm.compose(s.pos, qq, sc.copy(s.scale)));
      }
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ 3 projects

function station(color: Color, low: boolean, scale: number) {
  const g = new Group();
  const seg = low ? 24 : 48;
  const light = standard(0xd5d9df, 0.45, 0.32);
  const metal = standard(0x8f99a6, 0.95, 0.3);
  const dark = standard(0x1a1f28, 0.7, 0.42);
  const panel = standard(0x0b1530, 0.9, 0.28);
  panel.emissive = hdr(color, 0.1);

  const lightParts: BufferGeometry[] = [];
  const metalParts: BufferGeometry[] = [];
  const darkParts: BufferGeometry[] = [];
  const panelParts: BufferGeometry[] = [];

  const hub = new CylinderGeometry(1.3, 1.3, 11, 20);
  hub.rotateX(Math.PI / 2);
  metalParts.push(hub);
  for (const zz of [-5.8, 5.8]) {
    const c = new CylinderGeometry(1.9, 1.9, 1.2, 20);
    c.rotateX(Math.PI / 2);
    c.translate(0, 0, zz);
    darkParts.push(c);
  }
  const ringGeo = new TorusGeometry(7.5, 0.85, 10, seg);
  lightParts.push(ringGeo);
  for (let k = 0; k < 4; k++) {
    const s = new CylinderGeometry(0.22, 0.22, 7, 6);
    s.rotateZ((k / 4) * Math.PI * 2);
    s.translate(Math.cos((k / 4) * Math.PI * 2 + Math.PI / 2) * 3.6, Math.sin((k / 4) * Math.PI * 2 + Math.PI / 2) * 3.6, 0);
    darkParts.push(s);
  }
  const mast = new BoxGeometry(22, 0.3, 0.3);
  mast.translate(0, 0, -3.5);
  metalParts.push(mast);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const pnl = new BoxGeometry(4.2, 0.08, 3.2);
      pnl.translate(sx * (5 + k * 4.6), 0, -3.5);
      panelParts.push(pnl);
    }
  }
  const dish = new CylinderGeometry(1.6, 0.2, 0.6, 16);
  dish.translate(0, 2.2, 4.6);
  lightParts.push(dish);

  const fix = (list: BufferGeometry[]) => mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)), false)!;
  const spin = new Group();
  spin.add(new Mesh(fix(lightParts), light));
  spin.add(new Mesh(fix(darkParts), dark));
  const still = new Group();
  still.add(new Mesh(fix(metalParts), metal));
  still.add(new Mesh(fix(panelParts), panel));
  const windows = new Mesh(new TorusGeometry(7.5, 0.12, 6, seg), new MeshBasicMaterial({ color: hdr(color, 3) }));
  windows.position.z = 0.75;
  spin.add(windows);
  g.add(spin, still);
  g.scale.setScalar(scale);
  return { group: g, spin };
}

function projects(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const spins: Group[] = [];
  const lights = new GlowBatch(32, fade);
  const lightIdx: number[] = [];
  const spots: [number, number, number, number, number][] = [
    [i + 0.0, -30, 12, 1.4, 0.4],
    [i + 0.38, 36, -4, 2.1, -0.3],
    [i + 0.72, -24, -16, 1.0, 0.8],
  ];
  for (const [p, x, y, s, tilt] of spots) {
    const f = frameAt(path, p);
    const st = station(color, low, s);
    st.group.position.copy(place(path, p, x, y));
    st.group.quaternion.copy(f.quat);
    st.group.rotateY(tilt);
    st.group.rotateX(tilt * 0.4);
    group.add(st.group);
    spins.push(st.spin);
    // Docking lights at both ends of the hub.
    for (const zz of [-7, 7]) {
      const w = new Vector3(0, 0, zz).applyMatrix4(st.group.matrixWorld.compose(st.group.position, st.group.quaternion, st.group.scale));
      lightIdx.push(lights.add(w.x, w.y, w.z, 1.2 * s, 1, 0.9, 0.8, 0));
    }
  }
  group.add(lights.mesh);

  const blue = color.clone();
  const big = planet(ctx, fade, {
    radius: 70,
    a: new Color(0.06, 0.09, 0.2),
    b: blue.clone().multiplyScalar(0.9),
    atmo: hdr(blue, 1.3),
    seed: 4.2,
    bands: 9,
    bandMix: 0.65,
  });
  big.position.copy(place(path, i + 0.65, 170, 46, 60));
  const moon = planet(ctx, fade, {
    radius: 15,
    a: new Color(0.12, 0.12, 0.14),
    b: new Color(0.42, 0.43, 0.47),
    atmo: hdr(blue, 0.5),
    seed: 9.1,
    segs: low ? 24 : 40,
  });
  moon.position.copy(place(path, i + 0.3, -95, 52));
  group.add(big, moon);

  return {
    id: "projects",
    group,
    fade,
    weight: windowed(i - 0.75, i + 1.0, 0.3),
    nebula: 0.2,
    update(time, dt) {
      for (let k = 0; k < spins.length; k++) spins[k].rotation.z += dt * (0.12 + k * 0.05);
      for (let k = 0; k < lightIdx.length; k++) lights.setIntensity(lightIdx[k], Math.pow(Math.max(0, Math.sin(time * 1.8 + k * 1.3)), 8) * 5);
      lights.commit();
    },
  };
}

// ------------------------------------------------------------------ 4 disciplines

const HUES = ["#F5A524", "#5B8DEF", "#34D399", "#A78BFA"];

function disciplines(i: number, _color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  // Four worlds on four sides of the line, passing close one after another.
  const spots: [number, number, number, number, number][] = [
    [i + 0.38, -96, 8, 40, 0],
    [i + 0.58, 10, 80, 36, 1],
    [i + 0.78, 104, -6, 46, 2],
    [i + 0.98, -14, -88, 40, 3],
  ];
  const lin = (hex: string) => new Color(hex);
  for (const [p, x, y, rad, h] of spots) {
    const c = lin(HUES[h]);
    const pl = planet(ctx, fade, {
      radius: rad,
      a: c.clone().multiplyScalar(0.12),
      b: c.clone().multiplyScalar(0.75),
      atmo: hdr(c, 1.5),
      seed: 2.3 + h * 3.1,
      bands: h === 0 ? 14 : h === 2 ? 0 : 6,
      bandMix: h === 0 ? 0.85 : h === 2 ? 0 : 0.4,
    });
    pl.position.copy(place(path, p, x, y));
    pl.rotation.set(0.3 * h, h, 0.2);
    group.add(pl);
    if (h === 0) {
      // Rings on the amber world.
      const ringMat = additive(
        new ShaderMaterial({
          vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: /* glsl */ `
            uniform vec3 uColor; uniform float uFade; uniform float uIn; uniform float uOut;
            varying vec3 vP;
            float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
            void main() {
              float r = (length(vP.xy) - uIn) / (uOut - uIn);
              float b = 0.5 + 0.5 * sin(r * 70.0) * sin(r * 23.0 + 1.0);
              float gap = smoothstep(0.42, 0.45, r) * (1.0 - smoothstep(0.5, 0.53, r));
              float a = b * (1.0 - gap) * smoothstep(0.0, 0.08, r) * (1.0 - smoothstep(0.9, 1.0, r)) * 0.55 * uFade;
              gl_FragColor = vec4(uColor * a, 1.0);
            }`,
          uniforms: { uColor: { value: c.clone().multiplyScalar(0.9) }, uFade: fade, uIn: { value: rad * 1.35 }, uOut: { value: rad * 2.3 } },
          side: DoubleSide,
        }),
      );
      const ring = new Mesh(new RingGeometry(rad * 1.35, rad * 2.3, low ? 64 : 128, 1), ringMat);
      ring.rotation.set(1.2, 0.3, 0);
      pl.add(ring);
    }
  }
  return {
    id: "disciplines",
    group,
    fade,
    weight: windowed(i - 0.75, i + 1.05, 0.3),
    nebula: 0.25,
    update(_t, dt) {
      for (const c of group.children) c.rotation.y += dt * 0.02;
    },
  };
}

// ------------------------------------------------------------------ 5 writing

function writing(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const r = rng(505);
  const list: { pos: Vector3; size: number; color: Color; rot: number }[] = [];
  const teal = new Color(0.1, 0.55, 0.6);
  const white = new Color(0.8, 1, 0.9);
  const PN = low ? 14 : 32;
  for (let k = 0; k < PN; k++) {
    const p = i - 0.35 + r() * 1.2;
    const th = r() * Math.PI * 2;
    const rad = 30 + r() * 170;
    const c = color.clone().lerp(r() < 0.3 ? teal : white, r() * 0.35).multiplyScalar(0.16 + r() * 0.12);
    list.push({ pos: place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.6), size: 70 + r() * 130, color: c, rot: r() * 6.28 });
  }
  group.add(puffs(list, ctx.cloudTex, fade, 0.45));

  // Pages of light drifting around the line.
  const PG = low ? 90 : 240;
  const pageGeo = new PlaneGeometry(1, 1.36);
  const seeds = new Float32Array(PG);
  const pageMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        varying vec2 vUv;
        varying float vA;
        void main() {
          vec3 p = position;
          float ang = uTime * (0.25 + aSeed * 0.5) + aSeed * 20.0;
          float c = cos(ang); float s = sin(ang);
          p = vec3(c * p.x, p.y, -s * p.x);
          p.z += sin(uTime * 1.8 + aSeed * 10.0 + position.x * 3.0) * 0.12;
          vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
          w.y += sin(uTime * 0.35 + aSeed * 30.0) * 0.9;
          vec4 mv = viewMatrix * w;
          vA = smoothstep(2.0, 9.0, -mv.z);
          vUv = uv;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uFade;
        varying vec2 vUv; varying float vA;
        float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
        void main() {
          vec2 d = abs(vUv - 0.5) * 2.0;
          float edge = smoothstep(0.84, 0.98, max(d.x, d.y)) * (1.0 - smoothstep(0.98, 1.0, max(d.x, d.y)));
          float row = floor(vUv.y * 11.0);
          float lines = step(0.55, fract(vUv.y * 11.0)) * step(0.16, vUv.x) * step(vUv.x, 0.84 - 0.35 * h(row)) * step(0.12, vUv.y) * step(vUv.y, 0.86);
          float a = (0.1 + lines * 0.55 + edge * 0.9) * uFade * vA;
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
      uniforms: { uColor: { value: hdr(color.clone().lerp(white, 0.35), 1.6) }, uFade: fade, uTime: { value: 0 } },
      side: DoubleSide,
    }),
  );
  const pages = new InstancedMesh(pageGeo, pageMat, PG);
  const m = new Matrix4();
  const q = new Quaternion();
  for (let k = 0; k < PG; k++) {
    const p = i - 0.25 + r() * 1.1;
    const th = r() * Math.PI * 2;
    const rad = 7 + Math.pow(r(), 1.4) * 70;
    q.setFromAxisAngle(new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), r() * 6);
    const s = 0.7 + r() * 1.4;
    pages.setMatrixAt(k, m.compose(place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.7), q, new Vector3(s, s, s)));
    seeds[k] = r();
  }
  pageGeo.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
  pages.frustumCulled = false;
  pages.renderOrder = 7;
  group.add(pages);

  return {
    id: "writing",
    group,
    fade,
    weight: windowed(i - 0.75, i + 1.0, 0.35),
    nebula: 1.1,
    update(time) {
      pageMat.uniforms.uTime.value = time;
    },
  };
}

// ------------------------------------------------------------------ 6 film

function film(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const r = rng(606);
  const f = frameAt(path, i + 0.2);
  const SUN_R = 150;
  const sunPos = f.pos.clone().addScaledVector(f.fwd, 1700).addScaledVector(f.up, 230).addScaledVector(f.right, -330);
  const sunMat = new ShaderMaterial({
    vertexShader: PLANET_VS,
    fragmentShader: /* glsl */ `
      #define OCTAVES ${low ? 3 : 4}
      ${NOISE}
      uniform vec3 uHot; uniform vec3 uDeep; uniform float uTime; uniform float uFade;
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float mu = max(dot(normalize(vN), V), 0.0);
        float n = fbm(vObj * 5.0 + vec3(uTime * 0.03, 0.0, uTime * 0.02));
        float n2 = fbm(vObj * 16.0 - vec3(0.0, uTime * 0.05, 0.0));
        vec3 col = mix(uDeep, uHot, clamp(n * 0.9 + n2 * 0.45, 0.0, 1.0)) * pow(mu, 0.4);
        gl_FragColor = vec4(col * uFade, 1.0);
      }`,
    uniforms: { uHot: { value: new Color(6.0, 2.2, 0.9) }, uDeep: { value: new Color(1.6, 0.12, 0.08) }, uTime: { value: 0 }, uFade: fade },
  });
  const sun = new Mesh(new SphereGeometry(SUN_R, low ? 32 : 64, low ? 20 : 40), sunMat);
  sun.position.copy(sunPos);
  group.add(sun);

  // The eclipsing world, closer to us, lit only around its rim.
  const toCam = f.pos.clone().sub(sunPos).normalize();
  const moonPos = sunPos.clone().addScaledVector(toCam, 420).addScaledVector(f.right, 34).addScaledVector(f.up, -26);
  const moonMat = new ShaderMaterial({
    vertexShader: PLANET_VS,
    fragmentShader: /* glsl */ `
      uniform vec3 uRim; uniform float uFade; uniform vec3 uSun;
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float f = pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float toward = smoothstep(-0.2, 0.9, dot(N, normalize(uSun - vW)));
        vec3 col = vec3(0.004, 0.002, 0.003) + uRim * f * (0.15 + 2.5 * toward);
        gl_FragColor = vec4(col * uFade, uFade);
      }`,
    uniforms: { uRim: { value: new Color(3.0, 0.5, 0.25) }, uFade: fade, uSun: { value: sunPos } },
    transparent: true,
  });
  const moon = new Mesh(new SphereGeometry(SUN_R * 0.82, low ? 32 : 64, low ? 20 : 40), moonMat);
  moon.position.copy(moonPos);
  group.add(moon);

  const corona = new GlowBatch(3, fade);
  corona.add(sunPos.x, sunPos.y, sunPos.z, SUN_R * 6.5, 1.0, 0.18, 0.12, 1.3);
  corona.add(sunPos.x, sunPos.y, sunPos.z, SUN_R * 2.6, 1.0, 0.5, 0.3, 1.6);
  corona.mesh.renderOrder = -10;
  group.add(corona.mesh);

  // Deep red nebula around the line.
  const list: { pos: Vector3; size: number; color: Color; rot: number }[] = [];
  const PN = low ? 12 : 28;
  const ember = new Color(1.0, 0.35, 0.15);
  for (let k = 0; k < PN; k++) {
    const p = i - 0.45 + r() * 1.3;
    const th = r() * Math.PI * 2;
    const rad = 40 + r() * 200;
    const c = color.clone().lerp(ember, r() * 0.4).multiplyScalar(0.14 + r() * 0.14);
    list.push({ pos: place(path, p, Math.cos(th) * rad, Math.sin(th) * rad * 0.55), size: 90 + r() * 170, color: c, rot: r() * 6.28 });
  }
  group.add(puffs(list, ctx.cloudTex, fade, 0.45));

  return {
    id: "film",
    group,
    fade,
    weight: windowed(i - 0.6, i + 0.62, 0.35),
    nebula: 1.0,
    flare: { pos: sunPos, color: new Color(1.0, 0.32, 0.2), strength: 1 },
    update(time) {
      sunMat.uniforms.uTime.value = time;
    },
  };
}

// ------------------------------------------------------------------ 7 mind

function mind(i: number, color: Color, ctx: Ctx): Piece {
  const { path, low } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const r = rng(707);
  const f = frameAt(path, i + 0.55);
  group.position.copy(f.pos).addScaledVector(f.up, -72).addScaledVector(f.fwd, 120);
  group.quaternion.copy(f.quat);
  group.rotateX(0.04);

  const N = low ? 9000 : 26000;
  const R = 520;
  const data = new Float32Array(N * 4);
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  for (let k = 0; k < N; k++) {
    let rad: number;
    let ang: number;
    let h: number;
    const kind = r();
    if (kind < 0.12) {
      rad = Math.pow(r(), 2) * 90;
      ang = r() * Math.PI * 2;
      h = gauss() * 22 * (1 - rad / 110);
    } else if (kind < 0.3) {
      rad = Math.pow(r(), 0.8) * R;
      ang = r() * Math.PI * 2;
      h = gauss() * 8;
    } else {
      const arm = Math.floor(r() * 4);
      const t = Math.pow(r(), 0.7);
      rad = 30 + t * (R - 30);
      ang = arm * (Math.PI / 2) + Math.log(1 + rad / 35) * 2.3 + gauss() * (0.42 - t * 0.2);
      h = gauss() * (4 + 10 * (1 - t));
    }
    data.set([rad, ang, h, r()], k * 4);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute("aG", new BufferAttribute(data, 4));
  const galMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aG;
        uniform float uTime; uniform float uPx; uniform float uDpr; uniform float uR;
        uniform vec3 uCore; uniform vec3 uArm; uniform vec3 uAlt;
        varying vec3 vCol; varying float vA;
        void main() {
          float rn = aG.x / uR;
          float ang = aG.y - uTime * 0.03 / (0.2 + rn);
          vec3 p = vec3(cos(ang) * aG.x, aG.z, sin(ang) * aG.x);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float big = pow(fract(aG.w * 7.13), 9.0);
          gl_PointSize = clamp((1.1 + 3.0 * big) * uPx / max(-mv.z, 1.0), 1.2 * uDpr, 6.0 * uDpr);
          float k = fract(aG.w * 13.1);
          vec3 c = mix(uCore, uArm, smoothstep(0.02, 0.4, rn));
          c = k < 0.06 ? vec3(1.0, 0.45, 0.85) : (k < 0.22 ? mix(c, uAlt, 0.6) : c);
          vCol = c * (0.6 + 1.6 * big) * (1.0 + 2.2 * (1.0 - smoothstep(0.0, 0.18, rn)));
          vA = (1.0 - smoothstep(0.82, 1.0, rn)) * (0.35 + 0.65 * fract(aG.w * 3.3));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        varying vec3 vCol; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vCol * a * a * vA * uFade, 1.0);
        }`,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: 800 },
        uDpr: { value: 1 },
        uR: { value: R },
        uCore: { value: new Color(1.0, 0.86, 0.95) },
        uArm: { value: color.clone() },
        uAlt: { value: new Color(0.45, 0.6, 1.0) },
        uFade: fade,
      },
    }),
  );
  const gal = new Points(g, galMat);
  gal.frustumCulled = false;
  group.add(gal);
  const core = new GlowBatch(3, fade);
  core.add(0, 0, 0, 120, 1.0, 0.75, 1.0, 1.2);
  core.add(0, 0, 0, 420, color.r, color.g, color.b, 0.35);
  group.add(core.mesh);

  return {
    id: "mind",
    group,
    fade,
    weight: windowed(i - 0.65, i + 0.72, 0.3),
    nebula: 0.45,
    update(time, _dt, _p, _camera, px, dpr) {
      galMat.uniforms.uTime.value = time;
      galMat.uniforms.uPx.value = px;
      galMat.uniforms.uDpr.value = dpr;
    },
  };
}

// ------------------------------------------------------------------ 8 contact

function contact(i: number, color: Color, ctx: Ctx): Piece {
  const { low, landing: l } = ctx;
  const fade = { value: 1 };
  const group = new Group();
  const R = 2600;
  const U = l.up;
  const F = l.fwd;
  const Rt = l.right;
  // The world's highest point is the pad, so the ground is flat around it.
  const center = l.pad.clone().addScaledVector(U, -(R + 0.6));
  const sunDir = F.clone().addScaledVector(U, 0.06).addScaledVector(Rt, 0.2).normalize();
  const sunPos = l.pad.clone().addScaledVector(sunDir, 5200);
  const warm = color.clone().lerp(new Color(1, 0.6, 0.3), 0.3);

  const body = planet(ctx, fade, {
    radius: R,
    a: new Color(0.03, 0.025, 0.035),
    b: new Color(0.16, 0.1, 0.075),
    atmo: hdr(warm, 1.1),
    seed: 12.5,
    bands: 3,
    bandMix: 0.2,
    light: sunDir,
    segs: low ? 96 : 160,
    detail: 1,
  });
  body.position.copy(center);
  body.quaternion.copy(l.quat);
  const shell = body.children[1] as Mesh;
  shell.scale.setScalar(1.0012 / 1.12);
  (shell.material as ShaderMaterial).uniforms.uEdge.value = 0.06;
  (shell.material as ShaderMaterial).uniforms.uPower.value = 2.0;
  (shell.material as ShaderMaterial).uniforms.uColor.value = hdr(warm, 2.4);
  group.add(body);

  const sun = new GlowBatch(3, fade);
  sun.add(sunPos.x, sunPos.y, sunPos.z, 380, 1.0, 0.82, 0.58, 1.8);
  sun.add(sunPos.x, sunPos.y, sunPos.z, 1400, warm.r, warm.g, warm.b, 0.26);
  sun.mesh.renderOrder = -10;
  group.add(sun.mesh);

  // The landing pad: a hexagonal deck with lit rings and corner beacons.
  const pad = new Group();
  pad.position.copy(l.pad);
  pad.quaternion.copy(l.quat);
  const deck = new CylinderGeometry(10, 11.2, 1.4, 6, 1);
  deck.translate(0, -0.7, 0);
  pad.add(new Mesh(deck, standard(0x272c35, 0.8, 0.38)));
  const plate = new CylinderGeometry(8.4, 8.4, 0.08, 6, 1);
  plate.translate(0, 0.04, 0);
  pad.add(new Mesh(plate, standard(0x15181e, 0.6, 0.5)));
  const markMat = new MeshBasicMaterial({ color: hdr(color, 2.4) });
  const marks: BufferGeometry[] = [];
  for (const [r, w] of [
    [6.4, 0.08],
    [3.5, 0.06],
  ]) {
    const t = new TorusGeometry(r, w, 4, 72);
    t.rotateX(Math.PI / 2);
    t.translate(0, 0.1, 0);
    marks.push(t.toNonIndexed());
    t.dispose();
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const bar = new BoxGeometry(0.1, 0.03, 2.2).toNonIndexed();
    bar.translate(0, 0.1, 7.6);
    bar.rotateY(a);
    marks.push(bar);
  }
  pad.add(new Mesh(mergeGeometries(marks, false)!, markMat));
  const beacons = new GlowBatch(24, fade);
  const corner: number[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    corner.push(beacons.add(Math.cos(a) * 10.4, 0.5, Math.sin(a) * 10.4, 0.9, color.r, color.g, color.b, 1));
  }
  const ringLights: number[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ringLights.push(beacons.add(Math.cos(a) * 6.4, 0.25, Math.sin(a) * 6.4, 0.4, color.r, color.g, color.b, 1));
  }
  pad.add(beacons.mesh);

  // Glowing dust thrown up by the braking jets.
  const DN = low ? 18 : 42;
  const r = rng(808);
  const dg = new InstancedBufferGeometry();
  dg.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  dg.setIndex([0, 1, 2, 0, 2, 3]);
  const dd = new Float32Array(DN * 4);
  for (let k = 0; k < DN; k++) dd.set([r() * Math.PI * 2, 1 + r() * 3.5, r(), 1.2 + r() * 2.2], k * 4);
  dg.setAttribute("aD", new InstancedBufferAttribute(dd, 4));
  dg.instanceCount = DN;
  const dustMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aD; // angle, start radius, seed, size
        uniform float uSpread; uniform float uTime;
        varying vec2 vUv; varying float vA;
        void main() {
          float a = aD.x + uTime * 0.25 * (aD.z - 0.5) + uSpread * (aD.z - 0.5) * 1.5;
          float rad = aD.y + uSpread * (4.0 + aD.z * 10.0);
          vec3 c = vec3(cos(a) * rad, 0.3 + uSpread * (0.3 + aD.z * 2.6), sin(a) * rad);
          vec4 mv = modelViewMatrix * vec4(c, 1.0);
          float size = aD.w * (0.7 + uSpread * 1.8);
          mv.xy += position.xy * size;
          vUv = position.xy * 0.5 + 0.5;
          vA = smoothstep(0.5, 3.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tCloud; uniform vec3 uColor; uniform float uAmt; uniform float uFade;
        varying vec2 vUv; varying float vA;
        void main() {
          float a = texture2D(tCloud, vUv).a;
          gl_FragColor = vec4(uColor * a * vA * uAmt * uFade, 1.0);
        }`,
      uniforms: {
        tCloud: { value: ctx.cloudTex },
        uColor: { value: new Color(1.0, 0.62, 0.36).lerp(color, 0.25).multiplyScalar(0.55) },
        uAmt: { value: 0 },
        uSpread: { value: 0 },
        uTime: { value: 0 },
        uFade: fade,
      },
      side: DoubleSide,
    }),
  );
  const dust = new Mesh(dg, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 8;
  pad.add(dust);
  group.add(pad);

  return {
    id: "contact",
    group,
    fade,
    weight: windowed(i - 0.55, i + 5, 0.35),
    nebula: 0.2,
    warm: { amount: 1, dir: sunDir },
    flare: { pos: sunPos, color: new Color(1.0, 0.7, 0.4), strength: 0.9 },
    update(time, _dt, p) {
      const L = landingPhase(l, p);
      dustMat.uniforms.uTime.value = time;
      dustMat.uniforms.uSpread.value = smooth(0.55, 1.0, L);
      dustMat.uniforms.uAmt.value = smooth(0.55, 0.74, L) * (1 - smooth(0.9, 1.0, L)) * 1.6;
      // Pad lights wake up as the ship comes in, then chase around the ring.
      const wake = 0.25 + 0.75 * smooth(0.1, 0.5, L);
      for (let k = 0; k < corner.length; k++) beacons.setIntensity(corner[k], wake * (0.6 + 3.4 * Math.pow(Math.max(0, Math.sin(time * 2.6 + k)), 8)));
      for (let k = 0; k < ringLights.length; k++) beacons.setIntensity(ringLights[k], wake * (0.4 + 2.6 * Math.pow(Math.max(0, Math.sin(time * 2.0 - k * 0.52)), 10)));
      beacons.commit();
    },
  };
}
