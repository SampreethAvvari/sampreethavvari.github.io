// NPC Coach: of 28,745 recordings the poller read, 690 were new patient calls
// worth grading. A sieve.
//
// A disk of dust falling into a black core, one grain per recording. 690 bright
// grains ride inward, through three gates standing on the disk (the hard gates),
// and into a scoring ring cut 40, 40 and 20 around the core. When one gets there
// a jet fires: the report goes out. The pointer stirs the disk.

import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, AdditiveBlending, Vector3 } from "three";
import { assemble, ball, beams, box, damp, glow, instanced, mat, pointCloud, pointsMaterial, rng, surface, tor, type Part, type WorldBuilder } from "../toolkit";

const INNER = 6.2;
const OUTER = 38;
const CORE = 4.7;
const GATES = [
  { r: 27, a: 2.5 },
  { r: 20, a: 4.7 },
  { r: 13.5, a: 0.8 },
];

export const buildDisk: WorldBuilder = (shared, sun) => {
  const group = new Group();
  const tilt = new Group();
  tilt.rotation.set(0.11, 0, -0.1);
  group.add(tilt);
  const r = rng(404);
  const uPtr = { value: new Vector3(0, 999, 0) };
  const uPtrOn = { value: 0 };
  const uDisk = { value: 0 };
  const uBright = { value: 0 };
  const uJet = { value: 0 };

  // ---- the disk: one grain per recording read
  const total = Math.round(28745 * (shared.low ? 0.45 : 1));
  const pos = new Float32Array(total * 3);
  const attr = new Float32Array(total * 4);
  for (let i = 0; i < total; i++) {
    const q = r();
    const rad = INNER + (OUTER - INNER) * Math.pow(q, 0.72);
    // two loose spiral arms, plenty of grains between them
    const arm = r() < 0.5 ? 0 : Math.PI;
    const spread = (r() + r() + r() - 1.5) * (0.42 + 1.1 * (1 - rad / OUTER));
    const a = arm + Math.log(rad) * 2.5 + spread + r() * 0.2;
    const thick = (0.15 + 0.05 * rad) * (r() + r() - 1) * (rad < 12 ? 0.5 : 1);
    attr.set([rad, a, thick, r()], i * 4);
  }
  const diskMat = pointsMaterial(shared, {
    head: /* glsl */ `attribute vec4 aD; uniform vec3 uPtr; uniform float uPtrOn; uniform float uDisk;`,
    uniforms: { uPtr, uPtrOn, uDisk },
    maxSize: 7,
    vertex: /* glsl */ `
    float rad = aD.x;
    float w = 5.2 / pow(rad, 1.25);
    float ang = aD.y + uTime * w * 0.18;
    pos = vec3(cos(ang) * rad, aD.z, sin(ang) * rad);
    // the pointer stirs the disk: grains swing around it and lift
    vec2 toP = pos.xz - uPtr.xz;
    float dd = length(toP);
    float k = smoothstep(9.0, 0.5, dd) * uPtrOn;
    float sw = k * 1.15;
    pos.xz = uPtr.xz + mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * toP;
    pos.y += k * 1.5 * sin(dd * 1.4 - uTime * 3.0);
    float t = clamp((rad - ${INNER.toFixed(1)}) / ${(OUTER - INNER).toFixed(1)}, 0.0, 1.0);
    vec3 hot = vec3(4.2, 2.6, 1.25);
    vec3 mid = vec3(1.45, 0.72, 0.34);
    vec3 far = vec3(0.32, 0.45, 0.82);
    col = t < 0.32 ? mix(hot, mid, t / 0.32) : mix(mid, far, (t - 0.32) / 0.68);
    // brighter on the side turning toward the viewer, as a real disk is
    size = 0.075 + aD.w * aD.w * 0.11;
    a = (0.34 + uDisk * 0.55) * (0.45 + aD.w * 0.9) * smoothstep(0.0, 0.05, t);
    `,
  });
  const dust = pointCloud(pos, { aD: [attr, 4] }, diskMat);
  tilt.add(dust);

  // a soft floor under the grains so the disk holds together from far away
  const floorMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: 2,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.time },
    vertexShader: "varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: /* glsl */ `
uniform float uTime;
varying vec2 vP;
void main() {
  float rad = length(vP);
  float a = atan(vP.y, vP.x);
  float t = clamp((rad - ${INNER.toFixed(1)}) / ${(OUTER - INNER).toFixed(1)}, 0.0, 1.0);
  float s = 0.5 + 0.5 * sin(a * 2.0 - log(rad + 1.0) * 5.0 + uTime * 0.03);
  float f = pow(1.0 - t, 2.1) * smoothstep(${CORE.toFixed(1)}, ${INNER.toFixed(1)}, rad) * (0.58 + s * 0.42);
  vec3 c = mix(vec3(0.9, 0.42, 0.18), vec3(3.0, 1.75, 0.8), pow(1.0 - t, 3.0));
  gl_FragColor = vec4(c * f * 0.24, 1.0);
}`,
  });
  const floor = new Mesh(new PlaneGeometry(OUTER * 2, OUTER * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  tilt.add(floor);

  // ---- 690 bright grains, each on its way in
  const n = 690;
  const bp = new Float32Array(n * 3);
  const ba = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) ba.set([r(), r() * 6.28, (r() - 0.5) * 0.5, r()], i * 4);
  const brightMat = pointsMaterial(shared, {
    head: "attribute vec4 aD; uniform float uBright;",
    uniforms: { uBright },
    maxSize: 9,
    vertex: /* glsl */ `
    float q = fract(aD.x + uTime * (0.012 + aD.w * 0.008));
    float rad = mix(${OUTER.toFixed(1)}, ${(INNER - 0.6).toFixed(1)}, pow(q, 0.72));
    float ang = aD.y + log(rad) * 2.5 + uTime * 0.05;
    pos = vec3(cos(ang) * rad, aD.z * (rad / ${OUTER.toFixed(1)}) * 2.0 + 0.1, sin(ang) * rad);
    col = mix(vec3(1.6, 1.9, 2.4), vec3(5.0, 4.0, 2.6), q);
    size = (0.085 + aD.w * 0.07) * (1.0 + uBright * 0.5);
    a = (1.3 + uBright * 2.0) * smoothstep(0.0, 0.05, q) * smoothstep(1.0, 0.96, q);
    `,
  });
  const bright = pointCloud(bp, { aD: [ba, 4] }, brightMat);
  tilt.add(bright);

  // ---- the core: nothing comes back
  const coreMat = new MeshBasicMaterial({ color: 0x000000 });
  const core = new Mesh(ball(CORE, 48, 32), coreMat);
  tilt.add(core);
  // the ring of light just outside it, facing the viewer always
  const haloMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.time, uJet },
    vertexShader: /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy * 2.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sc = length(modelMatrix[0].xyz);
  mv.xy += position.xy * sc;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime; uniform float uJet;
varying vec2 vP;
void main() {
  float rr = length(vP);
  float a = atan(vP.y, vP.x);
  float ring = exp(-pow((rr - 0.5) * 42.0, 2.0));
  float wide = exp(-max(rr - 0.5, 0.0) * 9.0) * step(0.49, rr);
  float side = 0.55 + 0.45 * cos(a - 0.4);
  vec3 c = vec3(6.0, 4.2, 2.6) * ring * side * 1.25 + vec3(1.2, 0.74, 0.42) * wide * side * 0.35;
  c *= 1.0 + uJet * 0.6;
  gl_FragColor = vec4(c * smoothstep(1.0, 0.8, rr), 1.0);
}`,
  });
  const halo = new Mesh(new PlaneGeometry(1, 1), haloMat);
  halo.scale.setScalar(CORE * 2 * 1.04 * 2);
  halo.frustumCulled = false;
  group.add(halo);

  // ---- the scoring ring: 40, 40, 20
  const arcCols: [number, number, string][] = [
    [0, 0.4, "#ffd8a8"],
    [0.4, 0.4, "#ffb066"],
    [0.8, 0.2, "#fff4e0"],
  ];
  const score = new Group();
  score.rotation.set(0.22, 0, 0.14);
  const uArc = { value: 0 };
  arcCols.forEach(([at, len, col]) => {
    const gap = 0.02;
    const span = (len - gap) * Math.PI * 2;
    const g = tor(9.3, 0.17, 8, 80, span).rotateX(Math.PI / 2);
    const m = surface(shared, sun, { color: col, metal: 0.3, rough: 0.3, glow: 1.7, uniforms: { uArc }, fragHead: "uniform float uArc;", frag: "glow *= 1.0 + uArc * 1.7; glowCol = base * 1.3;" });
    const mesh = new Mesh(g, m);
    mesh.rotation.y = -(at + gap / 2) * Math.PI * 2;
    score.add(mesh);
  });
  tilt.add(score);

  // ---- three gates on the disk
  const uGates = { value: 0 };
  const gateMat = surface(shared, sun, { color: "#d7deea", metal: 0.92, rough: 0.28, data: true, uniforms: { uGates }, fragHead: "uniform float uGates;", frag: "glowCol = vec3(2.6, 2.2, 3.4); glow *= 1.0 + uGates * 2.4;" });
  const gateGeo = assemble([
    { g: tor(3.6, 0.16, 8, 48, Math.PI), d: [1, 1, 1, 0] },
    { g: tor(3.05, 0.05, 6, 48, Math.PI), d: [1, 1, 1, 2.6] },
    { g: box(1.1, 0.34, 0.9), m: mat(3.6, 0.1), d: [1, 1, 1, 0] },
    { g: box(1.1, 0.34, 0.9), m: mat(-3.6, 0.1), d: [1, 1, 1, 0] },
  ]);
  const gates: Group[] = [];
  GATES.forEach((gt) => {
    const g = new Group();
    g.position.set(Math.cos(gt.a) * gt.r, 0, Math.sin(gt.a) * gt.r);
    g.rotation.y = -gt.a;
    g.add(new Mesh(gateGeo, gateMat));
    const lamp = glow("#d9d0ff", 4.4, { intensity: 0.9 });
    lamp.position.y = 3.6;
    g.add(lamp);
    tilt.add(g);
    gates.push(g);
  });

  // ---- the jet
  const jet = beams(
    [
      { a: new Vector3(0, CORE * 0.8, 0), b: new Vector3(0, 66, 0), color: "#ffe3c2", w: 0.26 },
      { a: new Vector3(0, -CORE * 0.8, 0), b: new Vector3(0, -66, 0), color: "#ffe3c2", w: 0.26 },
    ],
    shared,
    {
      head: "uniform float uJet;",
      uniforms: { uJet },
      chunk: /* glsl */ `
      float flow = 0.5 + 0.5 * sin(t * 26.0 - uTime * 4.0);
      i *= (0.1 + uJet * 2.2) * pow(1.0 - t, 2.2) * (0.5 + flow * 0.5);
      `,
    },
  );
  tilt.add(jet);

  // ---- 16 small satellites in a short arc
  const uDays = { value: 0 };
  const dayMat = surface(shared, sun, { color: "#dbe1ea", metal: 0.6, rough: 0.34, data: true, uniforms: { uDays }, fragHead: "uniform float uDays;", frag: "glowCol = vec3(1.6, 2.0, 2.8); glow = 0.4 + uDays * 2.4;" });
  const days = instanced(ball(0.085, 10, 8), dayMat, 16, (i, m) => {
    const a = -0.5 + (i / 15) * 1.3;
    m.setPosition(Math.cos(a) * 44, 3.4, Math.sin(a) * 44);
  });
  const dayGroup = new Group();
  dayGroup.add(days);
  const dayArc = new Mesh(tor(44, 0.012, 5, 64, 1.3).rotateX(Math.PI / 2).rotateY(0.5), surface(shared, sun, { color: "#ffffff", glow: 0.5, frag: "glowCol = vec3(1.2, 1.3, 1.6);" }));
  dayArc.position.y = 3.4;
  dayGroup.add(dayArc);
  tilt.add(dayGroup);

  group.add(glow("#ffa45e", 90, { intensity: 0.03, power: 2.6 }));

  const parts: Part[] = [
    { key: "graded", at: new Vector3(), r: 6 },
    { key: "minutes", at: new Vector3(), r: 7 },
    { key: "score", at: new Vector3(), r: 6 },
    { key: "days", at: new Vector3(), r: 7 },
    { key: "recordings", at: new Vector3(), r: 9 },
    { key: "gates", at: new Vector3(), r: 5 },
  ];
  const tv = new Vector3();
  const cc = new Color();
  void cc;
  let spinT = 0;
  let jetT = 0;

  return {
    group,
    radius: 40,
    parts,
    update(c) {
      const dt = c.dt;
      spinT += dt;
      score.rotation.y = c.t * 0.05;
      uPtrOn.value = damp(uPtrOn.value, c.ptrOn, 5, dt);
      uPtr.value.copy(c.ptr);
      uDisk.value = damp(uDisk.value, c.heat[4], 5, dt);
      uBright.value = damp(uBright.value, c.heat[0], 5, dt);
      uArc.value = damp(uArc.value, c.heat[2], 5, dt);
      uGates.value = damp(uGates.value, c.heat[5], 5, dt);
      uDays.value = damp(uDays.value, c.heat[3], 5, dt);
      dayGroup.rotation.y = c.t * 0.02;
      // the jet fires now and then, and holds while hovered
      jetT += dt;
      const beat = Math.pow(Math.max(0, Math.sin(jetT * 0.55)), 18);
      uJet.value = damp(uJet.value, Math.max(beat, c.heat[1]), 4, dt);

      const am = c.t * 0.05;
      parts[0].at.set(Math.cos(am + 1) * 11, 0.2, Math.sin(am + 1) * 11).applyEuler(tilt.rotation);
      parts[1].at.set(0, 24, 0).applyEuler(tilt.rotation);
      tv.set(Math.cos(-c.t * 0.05 + 2.2) * 9.3, 0, Math.sin(-c.t * 0.05 + 2.2) * 9.3);
      parts[2].at.copy(tv).applyEuler(score.rotation).applyEuler(tilt.rotation);
      const da = c.t * 0.02;
      parts[3].at.set(Math.cos(0.15 - da) * 44, 3.4, Math.sin(0.15 - da) * 44).applyEuler(tilt.rotation);
      parts[4].at.set(Math.cos(3.6) * 31, 0, Math.sin(3.6) * 31).applyEuler(tilt.rotation);
      parts[5].at.copy(gates[1].position).setY(3.6).applyEuler(tilt.rotation);
      void spinT;
    },
  };
};
