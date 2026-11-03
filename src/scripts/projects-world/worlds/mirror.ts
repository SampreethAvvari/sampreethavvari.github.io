// Patient Dashboard: a read only mirror of the practice's records, and one row
// per patient.
//
// The world is built out of rows: thousands of small plates laid in latitude
// lines. Below a still plane of light hangs its exact reflection, turning a
// little behind the real one (the mirror trails). 453 field lines tie plates in
// the world to their twins in the reflection: the record links. A ring of 103
// beads with 81 lit (intakes that linked on their own) and 259 ticks on the
// plane (the first backfill) are the real counts. Four moons are the four ids
// one patient used to have.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  LineSegments,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { NOISE, ball, beams, box, damp, faceted, glow, instanced, placeAlong, rng, surface, type BeamItem, type Part, type WorldBuilder } from "../toolkit";

const R = 13;

export const buildMirror: WorldBuilder = (shared, sun) => {
  const group = new Group();
  const r = rng(101);
  const uPtr = { value: new Vector3(0, 100, 0) };
  const uPtrOn = { value: 0 };
  const uLag = { value: 0 };
  const uThread = { value: 0 };
  const uPlane = { value: 0 };

  // ---- the rows: one plate after another along lines of latitude
  const rows: { lat: number; lon: number; w: number; h: number; lit: number }[] = [];
  const nRows = shared.low ? 18 : 25;
  const step = (Math.PI / 2 - 0.09) / nRows;
  for (let j = 0; j < nRows; j++) {
    const lat = 0.075 + step * (j + 0.5);
    const ring = Math.cos(lat) * R * 2 * Math.PI;
    let lon = r() * 6.28;
    while (lon < 6.28 + 6) {
      const w = (0.4 + r() * r() * 1.5) * (shared.low ? 1.45 : 1);
      const dl = (w / ring) * Math.PI * 2;
      if (lon + dl > 6.28 + 6.0) break;
      const roll = r();
      rows.push({ lat, lon: lon + dl / 2, w: w - 0.07, h: step * R * 0.8, lit: roll > 0.975 ? 1 : roll > 0.9 ? 0.2 : 0 });
      lon += dl;
    }
  }
  const plateGeo = faceted(box(1, 1, 1));
  const shared_head = /* glsl */ `uniform vec3 uPtr; uniform float uPtrOn; uniform float uLag;`;
  const plateFill = (i: number, m: Matrix4, d: number[]) => {
    const t = rows[i];
    const n = new Vector3(Math.cos(t.lat) * Math.cos(t.lon), Math.sin(t.lat), Math.cos(t.lat) * Math.sin(t.lon));
    const dep = 0.34;
    m.lookAt(n, new Vector3(0, 0, 0), new Vector3(0, 1, 0));
    m.scale(new Vector3(t.w, t.h, dep));
    m.setPosition(n.multiplyScalar(R));
    d[0] = d[1] = d[2] = 0.5 + r() * 0.5;
    d[3] = t.lit * (0.35 + r() * 0.9);
  };
  const plateVertexPlaced = /* glsl */ `
  // the plates under the pointer rise toward it, row by row
  vec3 nrm = normalize(q);
  float near = smoothstep(7.5, 0.5, distance(q, uPtr)) * uPtrOn;
  float wave = sin(asin(nrm.y) * 9.0 + uTime * 0.5 + s * 1.3) * 0.06;
  q += nrm * (near * 2.4 + wave);
`;
  const upperMat = surface(shared, sun, {
    color: "#b5c4d8",
    metal: 0.82,
    rough: 0.34,
    data: true,
    seed: true,
    uniforms: { uPtr, uPtrOn, uLag },
    head: shared_head,
    placed: plateVertexPlaced,
    fragHead: /* glsl */ `uniform float uLag;`,
    frag: /* glsl */ `
    glowCol = vec3(0.72, 0.9, 1.5);
    // a soft lit edge on every row, facing the mirror
    float toPlane = smoothstep(2.2, 0.0, abs(vL.y));
    glow += toPlane * 0.14;
  `,
  });
  const spinA = new Group();
  const upper = instanced(plateGeo, upperMat, rows.length, plateFill);
  spinA.add(upper);
  group.add(spinA);

  // the reflection: same plates, same order, a moment behind, breathing like water
  const lowerMat = surface(shared, sun, {
    color: "#b8cae0",
    metal: 1,
    rough: 0.18,
    envI: 1.5,
    data: true,
    seed: true,
    uniforms: { uPtr, uPtrOn, uLag },
    head: shared_head,
    placed: /* glsl */ `
    ${plateVertexPlaced}
    q.xz += vec2(sin(q.y * 1.3 + uTime * 0.9), cos(q.y * 1.1 - uTime * 0.7)) * 0.05 * abs(q.y);
  `,
    fragHead: /* glsl */ `uniform vec3 uTint;`,
    frag: /* glsl */ `
    glowCol = vec3(0.45, 0.7, 1.4);
    glow *= 0.8;
    float depthFade = smoothstep(14.0, 0.0, abs(vL.y));
    base *= mix(0.25, 0.95, depthFade);
  `,
    after: /* glsl */ `col *= mix(0.32, 0.95, smoothstep(14.0, 0.0, abs(vL.y)));`,
  });
  const spinB = new Group();
  spinB.scale.y = -1;
  const lowerGeo = plateGeo.clone();
  const r2 = rng(101);
  void r2;
  const lower = instanced(lowerGeo, lowerMat, rows.length, (i, m, d) => {
    const t = rows[i];
    const n = new Vector3(Math.cos(t.lat) * Math.cos(t.lon), Math.sin(t.lat), Math.cos(t.lat) * Math.sin(t.lon));
    m.lookAt(n, new Vector3(0, 0, 0), new Vector3(0, 1, 0));
    m.scale(new Vector3(t.w, t.h, 0.34));
    m.setPosition(n.multiplyScalar(R));
    d[0] = d[1] = d[2] = 0.7;
    d[3] = t.lit * 1.4;
  });
  spinB.add(lower);
  group.add(spinB);

  // a dark body inside each half so nothing shows through the gaps
  const coreMat = surface(shared, sun, { color: "#04060b", metal: 0.2, rough: 0.8 });
  const core = new Mesh(ball(R - 0.25, 48, 32), coreMat);
  group.add(core);

  // ---- the plane of light
  const planeMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.time, uPtr, uPtrOn, uHeat: uPlane, tEnv: shared.env },
    vertexShader: /* glsl */ `
varying vec3 vL; varying vec3 vW;
void main() {
  vL = position.xzy * vec3(1.0, 1.0, 1.0);
  vL = vec3(position.x, 0.0, -position.y);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
${NOISE}
uniform float uTime; uniform vec3 uPtr; uniform float uPtrOn; uniform float uHeat;
uniform samplerCube tEnv;
varying vec3 vL; varying vec3 vW;
void main() {
  float d = length(vL.xz);
  float rr = d / 46.0;
  if (rr > 1.0) discard;
  float fade = pow(1.0 - rr, 2.0);
  // rings moving out from the world, and from the pointer
  float ripple = sin(d * 1.6 - uTime * 0.9) * 0.5 + 0.5;
  float pd = distance(vL.xz, uPtr.xz);
  float touch = uPtrOn * smoothstep(9.0, 0.0, pd) * (0.5 + 0.5 * sin(pd * 3.4 - uTime * 4.0));
  float rim = exp(-pow((d - ${R.toFixed(1)}) * 1.2, 2.0));
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = vec3(0.0, 1.0, 0.0);
  if (V.y < 0.0) N = -N;
  float F = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 env = textureCube(tEnv, reflect(-V, N)).rgb;
  vec3 c = env * (0.22 + 1.5 * F) * fade;
  c += vec3(0.3, 0.62, 1.25) * fade * (0.035 + 0.05 * ripple * ripple + uHeat * 0.28);
  c += vec3(1.0, 1.7, 3.2) * rim * (1.0 + uHeat * 2.0);
  c += vec3(0.7, 1.2, 2.4) * touch * fade * 0.9;
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const plane = new Mesh(new CircleGeometry(46, 96), planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.frustumCulled = false;
  group.add(plane);

  // ---- 453 field lines from the world to its reflection: the record links
  const nThreads = 453;
  const seg = shared.low ? 12 : 18;
  const tp = new Float32Array(nThreads * seg * 2 * 3);
  const ta = new Float32Array(nThreads * seg * 2 * 2);
  const threadR = rng(453);
  const threadAnchor = new Vector3();
  const pt = (lat: number, lon: number, u: number, bulge: number, out: Vector3) => {
    // u runs 0..1 from the plate down through the plane to its twin
    const y = Math.sin(lat) * R * (1 - 2 * u);
    const c = Math.cos(lat) * R;
    const b = c + Math.sin(Math.PI * u) * bulge;
    return out.set(Math.cos(lon) * b, y, Math.sin(lon) * b);
  };
  const a0 = new Vector3();
  const a1 = new Vector3();
  let wr = 0;
  for (let i = 0; i < nThreads; i++) {
    const lat = 0.3 + threadR() * 0.95;
    const lon = threadR() * 6.283;
    const bulge = 2.5 + threadR() * 8 + (lat > 0.9 ? 3 : 0);
    const seed = threadR();
    for (let k = 0; k < seg; k++) {
      pt(lat, lon, k / seg, bulge, a0);
      pt(lat, lon, (k + 1) / seg, bulge, a1);
      tp.set([a0.x, a0.y, a0.z, a1.x, a1.y, a1.z], wr * 3);
      ta.set([k / seg, seed, (k + 1) / seg, seed], wr * 2);
      wr += 2;
    }
    if (i === 40) pt(lat, lon, 0.25, bulge, threadAnchor);
  }
  const threadGeo = new BufferGeometry();
  threadGeo.setAttribute("position", new BufferAttribute(tp, 3));
  threadGeo.setAttribute("aT", new BufferAttribute(ta, 2));
  const threadMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.time, uHeat: uThread, uLag },
    vertexShader: /* glsl */ `
attribute vec2 aT; varying vec2 vT;
void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
uniform float uTime; uniform float uHeat;
varying vec2 vT;
void main() {
  float u = vT.x;
  float pulse = fract(u - uTime * (0.09 + vT.y * 0.1) + vT.y * 7.0);
  float head = smoothstep(0.86, 1.0, pulse);
  float env = sin(3.14159 * u);
  vec3 c = mix(vec3(0.22, 0.55, 1.3), vec3(2.6, 3.8, 6.4), head);
  c *= (0.3 + env * 0.5) * (0.35 + uHeat * 1.5) + head * 0.6;
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const threads = new LineSegments(threadGeo, threadMat);
  threads.frustumCulled = false;
  spinA.add(threads);

  // ---- 103 beads, 81 lit: intakes that linked on their own
  const ringGroup = new Group();
  const beadMat = surface(shared, sun, { color: "#ffffff", metal: 0.5, rough: 0.35, data: true, uniforms: { uHeat: { value: 0 } }, fragHead: "uniform float uHeat;", frag: "glowCol = vec3(0.9, 1.4, 2.6); glow *= 1.0 + uHeat * 1.6;" });
  const beadHeat = beadMat.uniforms.uHeat;
  const beadR = 21;
  const beadGeo = ball(0.13, 10, 8);
  const beads = instanced(beadGeo, beadMat, 103, (i, m, d) => {
    const a = (i / 103) * Math.PI * 2;
    m.setPosition(Math.cos(a) * beadR, 0, Math.sin(a) * beadR);
    if (i < 81) {
      d[3] = 1.3;
    } else {
      d[0] = d[1] = d[2] = 0.15;
      d[3] = 0;
    }
  });
  ringGroup.add(beads);
  ringGroup.position.y = 3.2;
  group.add(ringGroup);
  const ringMirror = ringGroup.clone();
  ringMirror.position.y = -3.2;
  group.add(ringMirror);

  // ---- 259 ticks on the plane: the first backfill
  const ticks: BeamItem[] = [];
  for (let i = 0; i < 259; i++) {
    const a = (i / 259) * Math.PI * 2;
    const long = i % 37 === 0;
    ticks.push({
      a: new Vector3(Math.cos(a) * 28.4, 0.02, Math.sin(a) * 28.4),
      b: new Vector3(Math.cos(a) * (long ? 31.4 : 29.5), 0.02, Math.sin(a) * (long ? 31.4 : 29.5)),
      color: "#9cc4ff",
      i: long ? 2.4 : 1.2,
      w: 0.035,
    });
  }
  const uTick = { value: 0 };
  const tickMesh = beams(ticks, shared, { head: "uniform float uHeat;", uniforms: { uHeat: uTick }, chunk: "i *= 0.6 + uHeat * 1.6;" });
  group.add(tickMesh);

  // ---- four moons: the four ids one patient used to have
  const moonMat = surface(shared, sun, { color: "#dfe6f1", metal: 0.12, rough: 0.55, flat: true, frag: "glowCol = vec3(0.5, 0.7, 1.2); glow = 0.05;" });
  const moonGeo = ball(1.15, 12, 8);
  const moonLens = surface(shared, sun, { color: "#ffffff", metal: 0, rough: 0.9, glow: 3, frag: "glowCol = vec3(0.8, 1.2, 2.4);" });
  const moons: { up: Group; down: Group; r: number; a: number; w: number; y: number }[] = [];
  const moonLinks: BeamItem[] = [];
  const mkMoon = () => {
    const g = new Group();
    const body = new Mesh(moonGeo, moonMat);
    g.add(body);
    const band = new Mesh(box(2.8, 0.1, 0.1), moonLens);
    g.add(band);
    g.add(glow("#a9c8ff", 3.4, { intensity: 0.5 }));
    return g;
  };
  for (let i = 0; i < 4; i++) {
    const up = mkMoon();
    const down = mkMoon();
    group.add(up, down);
    moons.push({ up, down, r: 26 + i * 3.2, a: (i / 4) * Math.PI * 2 + 0.5, w: 0.05 - i * 0.006, y: 7 + (i % 2) * 3 });
    moonLinks.push({ a: new Vector3(), b: new Vector3(), color: "#8db8ff", i: 0.8, w: 0.03 });
  }
  const moonLine = new BufferGeometry();
  const moonLineArr = new Float32Array(4 * 2 * 3);
  moonLine.setAttribute("position", new BufferAttribute(moonLineArr, 3));
  const moonLineMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uHeat: { value: 0 } },
    vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform float uHeat; void main(){gl_FragColor=vec4(vec3(0.35,0.62,1.3)*(0.5+uHeat*2.2),1.0);}",
  });
  const moonLines = new LineSegments(moonLine, moonLineMat);
  moonLines.frustumCulled = false;
  group.add(moonLines);

  group.add(glow("#6f9cff", 60, { intensity: 0.018, power: 3 }));

  // thread anchors for hover are in the turning part of the world
  const parts: Part[] = [
    { key: "links", at: threadAnchor.clone(), r: 8 },
    { key: "lag", at: new Vector3(-22, 0, 8), r: 8 },
    { key: "intakes", at: new Vector3(beadR, 3.2, 0), r: 5 },
    { key: "backfill", at: new Vector3(0, 0, 30), r: 5 },
    { key: "ids", at: new Vector3(26, 7, 0), r: 4 },
  ];
  const anchor0 = threadAnchor.clone();
  const tmp = new Vector3();
  let rot = 0;
  let lag = 0;

  return {
    group,
    radius: 20,
    parts,
    update(c) {
      const dt = c.dt;
      const speed = c.reduced ? 0.004 : 0.03 + c.ptrOn * 0.015;
      rot += dt * speed;
      // the mirror trails the real world by a small angle
      lag = damp(lag, c.heat[1] > 0.1 ? 0.42 : 0.1, 2, dt);
      spinA.rotation.y = rot;
      spinB.rotation.y = rot - lag;
      uLag.value = lag;
      uPtr.value.copy(c.ptr).applyAxisAngle(tmp.set(0, 1, 0), -rot);
      uPtrOn.value = damp(uPtrOn.value, c.ptrOn, 6, dt);
      uThread.value = damp(uThread.value, 0.25 + c.heat[0] * 1.5 + c.near * 0.1, 5, dt);
      uPlane.value = damp(uPlane.value, c.heat[1], 5, dt);
      beadHeat.value = damp(beadHeat.value, c.heat[2], 5, dt);
      ringGroup.rotation.y = -rot * 0.4;
      ringMirror.rotation.y = -rot * 0.4 + lag * 0.5;
      uTick.value = damp(uTick.value, c.heat[3], 5, dt);
      tickMesh.rotation.y = rot * 0.2;
      moonLineMat.uniforms.uHeat.value = damp(moonLineMat.uniforms.uHeat.value, c.heat[4], 5, dt);

      // moons drift above the plane and hang in it below, each with a line in
      const tim = c.reduced ? 0 : c.t;
      moons.forEach((m, i) => {
        const a = m.a + tim * m.w;
        const x = Math.cos(a) * m.r;
        const z = Math.sin(a) * m.r;
        const y = m.y + Math.sin(tim * 0.4 + i) * 0.6;
        m.up.position.set(x, y, z);
        m.down.position.set(x, -y, z);
        m.up.rotation.y = tim * 0.3 + i;
        m.down.rotation.y = tim * 0.3 + i;
        moonLineArr.set([x, y, z, x * 0.46, y * 0.5 + 4, z * 0.46], i * 6);
      });
      moonLine.getAttribute("position").needsUpdate = true;

      // the four part anchors follow what they stand for
      parts[0].at.copy(anchor0).applyAxisAngle(tmp.set(0, 1, 0), rot);
      const am = moons[0];
      parts[4].at.copy(am.up.position);
      const ba = -rot * 0.4 + 0.2;
      parts[2].at.set(Math.cos(ba) * beadR, 3.2, Math.sin(ba) * beadR);
      const ta = rot * 0.2 + 1.2;
      parts[3].at.set(Math.cos(ta) * 30, 0, Math.sin(ta) * 30);
      parts[1].at.set(-22, 0, 10);
    },
  };
};
