// Centralized Diagnostic Filter: Gemini reads the panorex under the founder's
// own rules, and the clinic email waits for both reports.
//
// An arch of 32 stones, laid out the way a jaw is on a panoramic film, with one
// blade of light sweeping along it the way the film is made. Two small moons are
// the two reports: only when both have reached the gate does a beam leave for
// the clinic. Behind the crown, four tall stones (the four cases the founder
// narrated) and six linked nodes (six Gemini calls, one chain of retries). A
// dial of ticks reads 0 to 200, the doctor report's risk score.

import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from "three";
import { assemble, ball, beams, box, cyl, damp, faceted, glow, instanced, lerp, mat, rng, smooth, surface, tor, type BeamItem, type Part, type WorldBuilder } from "../toolkit";

const WX = 25;
const DZ = 21;
const ZC = 2;
const MAX = 1.82; // half the arch's sweep, in radians

const archAt = (phi: number, grow = 0, out = new Vector3()) => out.set(Math.sin(phi) * (WX + grow), 0, ZC - Math.cos(phi) * (DZ + grow));
const SPIN_Y = 0;

export const buildArch: WorldBuilder = (shared, sun) => {
  const group = new Group();
  const r = rng(606);
  const uSweep = { value: -MAX };
  const uRead = { value: 0 };
  const uPtr = { value: new Vector3(0, 999, 0) };
  const uPtrOn = { value: 0 };
  const uStones = { value: 0 };

  // ---- the stones
  const n = 32;
  const stoneMat = surface(shared, sun, {
    color: "#efe2cc",
    metal: 0.08,
    rough: 0.62,
    data: true,
    seed: true,
    uniforms: { uSweep, uRead, uPtr, uPtrOn, uStones },
    head: /* glsl */ `uniform float uSweep; uniform float uRead; uniform vec3 uPtr; uniform float uPtrOn; uniform float uStones; varying float vLit; varying float vGot; varying float vPtr;`,
    vertex: /* glsl */ `
    float phi = d.w;
    vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float dd = phi - uSweep;
    vLit = exp(-dd * dd * 90.0);
    vGot = step(phi, uSweep) * uRead;
    vPtr = smoothstep(7.0, 1.0, distance(c.xz, uPtr.xz)) * uPtrOn;
    // the stones lift where the pointer is, and as the blade passes
    if (p.y > 0.0) p.y += (vLit * 0.13 + vPtr * 0.26);
    `,
    fragHead: /* glsl */ `varying float vLit; varying float vGot; varying float vPtr; uniform float uStones;`,
    frag: /* glsl */ `
    // a cut groove up each stone, lit from inside when read
    float groove = 1.0 - smoothstep(0.06, 0.1, abs(vO.x));
    float front = smoothstep(0.1, 0.4, abs(vO.z));
    float h = vO.y + 0.5;
    glowCol = mix(vec3(0.72, 0.56, 1.5), vec3(2.2, 2.4, 3.8), vLit);
    glow = groove * front * (0.1 + vGot * 0.82 + vLit * 5.5 + vPtr * 1.7 + uStones * 0.9) * (0.4 + h * 0.6);
    glow += vLit * 0.12;
    base *= 0.62 + 0.38 * (h);
    `,
  });
  const stoneGeo = faceted(box(1, 1, 1));
  const stones = instanced(stoneGeo, stoneMat, n, (i, m, d) => {
    const t = (i + 0.5) / n;
    const phi = lerp(-MAX, MAX, t);
    const dist = Math.abs(phi) / MAX;
    const wid = lerp(1.6, 3.2, smooth(0.25, 0.95, dist)); // narrow at the crown, broad at the back
    const hgt = lerp(8.2, 5.2, smooth(0.1, 1, dist)) * (0.94 + r() * 0.12);
    const dep = lerp(1.6, 2.5, dist);
    const pos = archAt(phi);
    const tan = new Vector3(Math.cos(phi) * WX, 0, Math.sin(phi) * DZ).normalize();
    const out = new Vector3(tan.z, 0, -tan.x);
    m.makeBasis(tan, new Vector3(0, 1, 0), out);
    // lean a little inward, like real teeth do
    m.multiply(mat(0, 0, 0, 0.05 * (r() - 0.5), 0, 0.07 * (r() - 0.5)));
    m.scale(new Vector3(wid, hgt, dep));
    m.setPosition(pos.x, hgt / 2, pos.z);
    d[3] = phi;
  });
  group.add(stones);

  // ---- the plate they stand on, and fine lines around it
  const seg = 120;
  const pl = new Float32Array((seg + 1) * 2 * 3);
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const phi = lerp(-MAX - 0.05, MAX + 0.05, i / seg);
    const a = archAt(phi, 3.5);
    const b = archAt(phi, -3.4);
    pl.set([a.x, 0, a.z, b.x, 0, b.z], i * 6);
    if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const plateGeo = new BufferGeometry();
  plateGeo.setAttribute("position", new BufferAttribute(pl, 3));
  plateGeo.setIndex(idx);
  plateGeo.computeVertexNormals();
  const plate = new Mesh(plateGeo, surface(shared, sun, { color: "#2c2e36", metal: 0.74, rough: 0.46, side: DoubleSide, envI: 0.65 }));
  group.add(plate);
  const lineItems: BeamItem[] = [];
  const addArc = (grow: number, col: string, i: number, w: number) => {
    let prev = archAt(-MAX - 0.05, grow);
    for (let k = 1; k <= 90; k++) {
      const cur = archAt(lerp(-MAX - 0.05, MAX + 0.05, k / 90), grow);
      lineItems.push({ a: prev.clone().setY(0.03), b: cur.clone().setY(0.03), color: col, i, w });
      prev = cur;
    }
  };
  addArc(3.5, "#b8a6ff", 1.3, 0.035);
  addArc(-3.4, "#b8a6ff", 0.9, 0.03);
  addArc(6.2, "#8a7fe0", 0.42, 0.02);
  group.add(beams(lineItems, shared));

  // ---- the dial: 0 to 200, in ticks along the outer edge
  const dial: BeamItem[] = [];
  for (let i = 0; i <= 200; i++) {
    const phi = lerp(-MAX, MAX, i / 200);
    const major = i % 50 === 0;
    const a = archAt(phi, 7.3);
    const b = archAt(phi, major ? 9.1 : i % 10 === 0 ? 8.3 : 7.8);
    dial.push({ a: a.setY(0.03), b: b.setY(0.03), color: major ? "#efe9ff" : "#ad9ff0", i: major ? 2.4 : 0.9, w: major ? 0.05 : 0.02, seed: i / 200 });
  }
  const uDial = { value: 0 };
  const dialMesh = beams(dial, shared, {
    head: "uniform float uDial; uniform float uFill;",
    uniforms: { uDial, uFill: { value: 0 } },
    chunk: "i *= (0.32 + uDial * 1.2) + step(vS, uFill) * 1.15;",
  });
  group.add(dialMesh);

  // ---- the blade of light
  const bladeMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.time, uOn: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: /* glsl */ `
uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main() {
  float x = vUv.x;
  float y = vUv.y;
  float rise = (1.0 - y) * (1.0 - y);
  float a = smoothstep(0.0, 0.3, x) * smoothstep(1.0, 0.8, x);
  vec3 c = mix(vec3(0.72, 0.58, 1.55), vec3(1.9, 1.9, 2.8), y * 0.5 + rise * 0.5);
  gl_FragColor = vec4(c * a * rise * 0.2 * uOn, 1.0);
}`,
  });
  const bladeGeo = new PlaneGeometry(40, 11);
  bladeGeo.translate(20, 5.5, 0);
  const blade = new Mesh(bladeGeo, bladeMat);
  blade.frustumCulled = false;
  const bladeHold = new Group();
  bladeHold.position.set(0, 0, ZC);
  bladeHold.add(blade);
  group.add(bladeHold);
  const bladeEdge = beams([{ a: new Vector3(0, 0.1, 0), b: new Vector3(40, 0.1, 0), color: "#e6dcff", i: 0.9, w: 0.02 }], shared, { fade: 0.2 });
  bladeHold.add(bladeEdge);

  // ---- two reports, one gate
  const gateZ = 28;
  const gate = new Group();
  gate.position.set(0, 3.4, gateZ);
  const uGate = { value: 0 };
  gate.add(new Mesh(tor(3.2, 0.13, 8, 64), surface(shared, sun, { color: "#e8e3f5", metal: 0.8, rough: 0.26, glow: 0.4, uniforms: { uGate }, fragHead: "uniform float uGate;", frag: "glowCol = vec3(1.6, 1.5, 2.8); glow *= 1.0 + uGate * 8.0;" })));
  group.add(gate);
  const moonMat = surface(shared, sun, { color: "#f1eefa", metal: 0.12, rough: 0.45, glow: 0.62, frag: "glowCol = vec3(1.2, 1.2, 1.8);" });
  const reports = [0, 1].map((i) => {
    const g = new Group();
    g.add(new Mesh(ball(0.9, 20, 14), moonMat));
    g.add(glow("#d9d0ff", 4.2, { intensity: 0.5 }));
    group.add(g);
    return g;
    void i;
  });
  const shot = beams([{ a: new Vector3(0, 3.4, gateZ), b: new Vector3(0, 3.4, gateZ + 150), color: "#efe9ff", w: 0.22 }], shared, {
    head: "uniform float uShot;",
    uniforms: { uShot: { value: 0 } },
    chunk: "i *= uShot * 3.2 * (1.0 - t * 0.7);",
  });
  group.add(shot);
  const uShot = (shot.material as ShaderMaterial).uniforms.uShot;

  // ---- four cases: four tall stones at the crown's back
  const uCases = { value: 0 };
  const caseMat = surface(shared, sun, { color: "#3a3844", metal: 0.86, rough: 0.28, data: true, uniforms: { uCases }, fragHead: "uniform float uCases;", frag: "float ln = step(0.82, fract(vO.y * 22.0)) * step(abs(vO.x), 0.3); glowCol = vec3(1.6, 1.3, 2.9); glow = ln * (0.25 + uCases * 1.8);" });
  const casesM = instanced(faceted(box(1, 1, 1)), caseMat, 4, (i, m) => {
    const x = -9 + i * 6;
    m.makeScale(1.6, 15 + (i % 2) * 2.2, 0.9);
    m.setPosition(x, 7.5 + (i % 2) * 1.1, -28.5);
  });
  group.add(casesM);

  // ---- six calls, one chain
  const uChain = { value: 0 };
  const nodeMat = surface(shared, sun, { color: "#d9d6e8", metal: 0.7, rough: 0.3, data: true, seed: true, uniforms: { uChain }, fragHead: "uniform float uChain;", frag: "glowCol = vec3(1.7, 1.6, 3.0); glow = 0.8 + uChain * 2.2;" });
  const nodes: Vector3[] = [];
  const nodeM = instanced(ball(0.72, 16, 12), nodeMat, 6, (i, m) => {
    const a = (i / 5) * Math.PI - Math.PI / 2;
    const p = new Vector3(Math.sin(a) * 17, 13 + Math.cos(a) * 3, -34 + Math.cos(a) * 2.5);
    nodes.push(p.clone());
    m.setPosition(p);
  });
  group.add(nodeM);
  const chainLinks: BeamItem[] = [];
  for (let i = 0; i < 5; i++) chainLinks.push({ a: nodes[i], b: nodes[i + 1], color: "#c7bcff", i: 1.2, w: 0.05, seed: i / 5 });
  const chainMesh = beams(chainLinks, shared, { head: "uniform float uChain;", uniforms: { uChain }, chunk: "float cp = fract(t * 0.2 + vS - uTime * 0.28); i *= (0.4 + uChain) + pow(cp, 18.0) * 6.0;" });
  group.add(chainMesh);
  const ringParts = nodes.map((p) => ({ g: tor(1.25, 0.03, 5, 32), m: mat(p.x, p.y, p.z, 0.7, 0.3, 0), d: [1, 1, 1, 0.9] }));
  group.add(new Mesh(assemble(ringParts), surface(shared, sun, { color: "#dcd7f2", metal: 0.6, rough: 0.3, data: true, frag: "glowCol = vec3(1.4, 1.3, 2.4);" })));

  // ---- the 0.3 second return: a spark on a very short track
  const pad = new Group();
  pad.position.set(30, 0.1, 19);
  pad.add(new Mesh(cyl(2.6, 2.6, 0.14, 32), surface(shared, sun, { color: "#3a3b45", metal: 0.86, rough: 0.34 })));
  const spark = glow("#ffffff", 1.9, { intensity: 3 });
  pad.add(spark);
  const uPad = { value: 0 };
  void uPad;
  group.add(pad);

  group.add(glow("#b5a3ff", 90, { intensity: 0.014, power: 2.8 }));

  const parts: Part[] = [
    { key: "both", at: gate.position.clone(), r: 5 },
    { key: "calls", at: nodes[2].clone(), r: 8 },
    { key: "cases", at: new Vector3(-3, 10, -28.5), r: 7 },
    { key: "quick", at: pad.position.clone(), r: 4 },
    { key: "risk", at: new Vector3(), r: 7 },
    { key: "stones", at: new Vector3(), r: 7 },
  ];

  const tips = [archAt(-MAX).setY(2.6), archAt(MAX).setY(2.6)];
  const dock = [new Vector3(-1.05, 3.4, gateZ), new Vector3(1.05, 3.4, gateZ)];
  let clock = 0;

  return {
    group,
    radius: 34,
    parts,
    update(c) {
      const dt = c.dt;
      clock += dt * (c.reduced ? 0.12 : 1);
      const LOOP = 15;
      const q = (clock % LOOP) / LOOP;
      // 0 to 0.62: the blade crosses the arch and back to its start
      const sweepK = Math.min(1, q / 0.62);
      const phi = lerp(-MAX - 0.3, MAX + 0.3, sweepK);
      uSweep.value = phi;
      uRead.value = q < 0.93 ? 1 : 1 - (q - 0.93) / 0.07;
      // the blade stands square to the arch where it is
      bladeHold.rotation.y = -(Math.atan2(archAt(phi).x, -(archAt(phi).z - ZC)) - Math.PI / 2);
      (bladeMat.uniforms.uOn as { value: number }).value = sweepK < 1 ? smooth(0, 0.04, sweepK) * smooth(1, 0.96, sweepK) : 0;
      bladeEdge.visible = sweepK < 1;
      (dialMesh.material as ShaderMaterial).uniforms.uFill.value = sweepK * 0.64;

      // the reports: one is quick, one takes its time; the beam waits for both
      const e0 = smooth(0.44, 0.66, q);
      const e1 = smooth(0.56, 0.86, q);
      reports[0].position.lerpVectors(tips[0], dock[0], e0);
      reports[1].position.lerpVectors(tips[1], dock[1], e1);
      reports[0].position.y += Math.sin(e0 * Math.PI) * 5;
      reports[1].position.y += Math.sin(e1 * Math.PI) * 5;
      const both = e0 >= 1 && e1 >= 1;
      const fire = both ? smooth(0.86, 0.885, q) * smooth(0.99, 0.94, q) : 0;
      uShot.value = fire;
      uGate.value = damp(uGate.value, fire + c.heat[0] * 0.6, 8, dt);
      gate.rotation.z = c.t * 0.15;

      uPtrOn.value = damp(uPtrOn.value, c.ptrOn, 6, dt);
      uPtr.value.copy(c.ptr);
      uDial.value = damp(uDial.value, c.heat[4], 6, dt);
      uStones.value = damp(uStones.value, c.heat[5], 6, dt);
      uCases.value = damp(uCases.value, c.heat[2], 6, dt);
      uChain.value = damp(uChain.value, c.heat[1], 6, dt);

      // the spark makes its 0.3 second trip over and over
      const st = (c.t * (c.heat[3] > 0.1 ? 1.7 : 0.8)) % 1;
      const tri = st < 0.5 ? st * 2 : 2 - st * 2;
      spark.position.set(lerp(-2, 2, tri), 0.55 + Math.sin(tri * Math.PI) * 1.6, 0);

      archAt(0.95, 8.3, parts[4].at);
      archAt(-0.55, 0, parts[5].at).setY(6.4);
      void SPIN_Y;
    },
  };
};
