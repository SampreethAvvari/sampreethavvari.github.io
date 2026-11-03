// JobPilot: open source, watching 163 company boards, 1,008 runs.
//
// The only body on a long tilted orbit of its own. A small dark rock with 163
// needles standing off it, each tip a board being watched, pulsing as it is
// polled. Its tail, as a comet's does, always streams directly away from the
// star: 1,008 bright grains (the runs) in a much finer dust. A fence of 16 arcs
// stands around the needles (the patterns that drop a job before any model sees
// it), and 11 small dishes further out are the eleven sources.

import { Group, Mesh, Vector3 } from "three";
import { assemble, ball, cone, cyl, damp, faceted, fibSphere, glow, ico, instanced, mat, placeAlong, pointCloud, pointsMaterial, rng, surface, tor, type Part, type WorldBuilder, NOISE } from "../toolkit";

const NUC = 5;

export const buildComet: WorldBuilder = (shared, sun) => {
  const group = new Group();
  const spin = new Group();
  group.add(spin);
  const r = rng(808);
  const uPtr = { value: new Vector3(0, 999, 0) };
  const uPtrOn = { value: 0 };
  const uNeedles = { value: 0 };
  const uRuns = { value: 0 };

  // ---- the rock
  const rock = new Mesh(ico(NUC, 32), surface(shared, sun, {
    color: "#2c2622",
    metal: 0.1,
    rough: 0.86,
    flat: true,
    head: NOISE,
    vertex: /* glsl */ `
    vec3 dir = normalize(p);
    float big = fbm3(dir * 1.7 + 3.0);
    float fine = fbm3(dir * 9.0);
    p += dir * ((big - 0.5) * 3.8 + (fine - 0.5) * 0.9);
    `,
    frag: /* glsl */ `
    // ice in the low places, catching the star
    float h = length(vL);
    float ice = smoothstep(4.7, 4.1, h);
    base = mix(base, vec3(0.74, 0.86, 1.0), ice * 0.62);
    metal = mix(metal, 0.46, ice);
    rough = mix(rough, 0.34, ice);
    `,
  }));
  spin.add(rock);

  // ---- 163 needles, one per company board
  const needleDirs: Vector3[] = [];
  const needleMat = surface(shared, sun, {
    color: "#9aa4b3",
    metal: 0.9,
    rough: 0.36,
    data: true,
    seed: true,
    uniforms: { uPtr, uPtrOn, uNeedles },
    head: "uniform vec3 uPtr; uniform float uPtrOn; uniform float uNeedles;",
    vertex: /* glsl */ `
    // needles bend away from the pointer, like grass, and sway
    vec3 tip = (instanceMatrix * vec4(0.0, 0.5, 0.0, 1.0)).xyz;
    vec3 away = tip - uPtr;
    float near = smoothstep(9.0, 1.0, length(away)) * uPtrOn;
    float h = p.y + 0.5;
    d.w = near;
    `,
    placed: /* glsl */ `
    vec3 away2 = q - uPtr;
    float near2 = smoothstep(9.0, 1.0, length(away2)) * uPtrOn;
    float hh = clamp((vO.y + 0.5), 0.0, 1.0);
    q += normalize(away2 + vec3(0.001)) * near2 * hh * hh * 3.0;
    q += vec3(sin(uTime * 0.6 + s * 40.0), cos(uTime * 0.5 + s * 30.0), sin(uTime * 0.4 + s * 50.0)) * hh * hh * 0.2;
    `,
    fragHead: "uniform float uNeedles;",
    frag: /* glsl */ `
    float hh = vO.y + 0.5;
    base *= mix(0.4, 1.0, hh);
    glowCol = vec3(1.0, 1.25, 1.9);
    glow = hh * hh * (0.22 + uNeedles * 1.2);
    `,
  });
  const nGeo = cyl(0.012, 0.085, 1, 6);
  const needles = instanced(nGeo, needleMat, 163, (i, m) => {
    const dir = fibSphere(i, 163, new Vector3());
    dir.x += (r() - 0.5) * 0.12;
    dir.y += (r() - 0.5) * 0.12;
    dir.z += (r() - 0.5) * 0.12;
    dir.normalize();
    const len = 8 + r() * r() * 9;
    needleDirs.push(dir.clone().multiplyScalar(NUC * 0.82 + len));
    placeAlong(m, dir.clone().multiplyScalar(NUC * 0.82 + len / 2), dir, 1, len, 1);
  });
  spin.add(needles);

  // the tips, as lights that pulse when their board is polled
  const tipPos = new Float32Array(163 * 3);
  const tipA = new Float32Array(163);
  needleDirs.forEach((p, i) => {
    tipPos.set([p.x, p.y, p.z], i * 3);
    tipA[i] = r();
  });
  const tipMat = pointsMaterial(shared, {
    head: "attribute float aS; uniform float uNeedles; uniform vec3 uPtr; uniform float uPtrOn;",
    uniforms: { uNeedles, uPtr, uPtrOn },
    maxSize: 14,
    vertex: /* glsl */ `
    float beat = pow(0.5 + 0.5 * sin(uTime * (0.5 + aS * 0.7) + aS * 80.0), 26.0);
    vec3 away = pos - uPtr;
    float near = smoothstep(9.0, 1.0, length(away)) * uPtrOn;
    pos += normalize(away + vec3(0.001)) * near * 3.0;
    col = mix(vec3(1.3, 1.6, 2.5), vec3(5.0, 4.4, 3.2), beat);
    size = (0.11 + beat * 0.3) * (1.0 + uNeedles * 0.5);
    a = 1.05 + beat * 2.2 + uNeedles * 2.0;
    `,
  });
  const tips = pointCloud(tipPos, { aS: [tipA, 1] }, tipMat);
  spin.add(tips);

  // ---- the tail streams straight away from the star, along +z
  const mkTail = (n: number, sizeBase: number, sizeVar: number, bright: number, col0: string, col1: string, lenK: number) => {
    const p = new Float32Array(n * 3);
    const a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) a.set([r(), r() + r() - 1, r() + r() - 1, r()], i * 4);
    const uH = { value: 0 };
    const m = pointsMaterial(shared, {
      head: "attribute vec4 aD; uniform float uH;",
      uniforms: { uH },
      maxSize: 7,
      vertex: /* glsl */ `
      float t = fract(aD.x + uTime * (0.011 + aD.w * 0.007));
      float L = ${lenK.toFixed(1)};
      float z = t * t * L + t * 12.0 + 4.0;
      // the dust falls a little behind the orbit, so the tail curves
      float bend = t * t * L * 0.15;
      float w = 1.2 + t * L * 0.15;
      pos = vec3(aD.y * w - bend, aD.z * w, z);
      col = mix(${col0}, ${col1}, t);
      size = ${sizeBase.toFixed(2)} + aD.w * ${sizeVar.toFixed(2)};
      a = ${bright.toFixed(2)} * (1.0 + uH * 2.0) * smoothstep(0.0, 0.03, t) * pow(1.0 - t, 1.4);
      `,
    });
    return { p: pointCloud(p, { aD: [a, 4] }, m), uH };
  };
  const dust = mkTail(shared.low ? 5000 : 15000, 0.06, 0.13, 0.62, "vec3(0.72, 0.92, 1.4)", "vec3(0.3, 0.46, 0.92)", 190);
  const runs = mkTail(1008, 0.12, 0.13, 2.1, "vec3(2.2, 2.6, 3.2)", "vec3(0.9, 1.3, 2.1)", 170);
  group.add(dust.p, runs.p);

  // the coma
  group.add(glow("#bcd6ff", 40, { intensity: 0.16, power: 3.1 }));
  group.add(glow("#e8f1ff", 14, { intensity: 0.2, power: 2.4 }));

  // ---- a fence of 16 arcs
  const uFence = { value: 0 };
  const fenceMat = surface(shared, sun, { color: "#dbe6f7", metal: 0.74, rough: 0.28, data: true, uniforms: { uFence }, fragHead: "uniform float uFence;", frag: "glowCol = vec3(1.4, 1.8, 2.8); glow = (0.5 + uFence * 2.4);" });
  const fenceParts = [];
  for (let i = 0; i < 16; i++) {
    const arc = ((Math.PI * 2) / 16) * 0.8;
    fenceParts.push({ g: tor(21, 0.075, 6, 16, arc), m: mat(0, 0, 0, 0, 0, (i / 16) * Math.PI * 2) });
  }
  const fence = new Mesh(assemble(fenceParts), fenceMat);
  fence.rotation.set(1.18, 0.24, 0);
  group.add(fence);

  // ---- 11 small dishes
  const uDish = { value: 0 };
  const dishGeo = assemble([
    { g: cone(0.62, 0.3, 14).rotateX(Math.PI), m: mat(0, 0.16) },
    { g: cyl(0.03, 0.03, 0.66, 6), m: mat(0, 0.5), d: [1, 1, 1, 1.2] },
  ]);
  const dishMat = surface(shared, sun, { color: "#d6dde8", metal: 0.86, rough: 0.34, data: true, flat: true, uniforms: { uDish }, fragHead: "uniform float uDish;", frag: "glowCol = vec3(2.2, 2.0, 1.6); glow = (glow + 0.12) * (1.0 + uDish * 4.0);" });
  const dishes = new Group();
  const dishItems: Group[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const g = new Group();
    g.position.set(Math.cos(a) * 26, Math.sin(a * 3) * 2.6, Math.sin(a) * 26);
    g.lookAt(0, 0, 0);
    g.rotateX(Math.PI / 2);
    g.add(new Mesh(dishGeo, dishMat));
    dishes.add(g);
    dishItems.push(g);
  }
  dishes.rotation.set(0.86, 0, -0.34);
  group.add(dishes);

  const parts: Part[] = [
    { key: "boards", at: new Vector3(), r: 7 },
    { key: "runs", at: new Vector3(0, 0, 44), r: 9 },
    { key: "patterns", at: new Vector3(), r: 5 },
    { key: "sources", at: new Vector3(), r: 4 },
  ];
  const yA = new Vector3(0, 1, 0);
  const tv = new Vector3();
  let rot = 0;
  void ball;
  void faceted;

  return {
    group,
    radius: 22,
    parts,
    update(c) {
      const dt = c.dt;
      rot += dt * (c.reduced ? 0.004 : 0.03);
      spin.rotation.y = rot;
      spin.rotation.x = Math.sin(rot * 0.4) * 0.2;
      uPtrOn.value = damp(uPtrOn.value, c.ptrOn, 5, dt);
      uPtr.value.copy(c.ptr).applyAxisAngle(yA, -rot);
      uNeedles.value = damp(uNeedles.value, c.heat[0], 6, dt);
      runs.uH.value = damp(runs.uH.value, c.heat[1], 6, dt);
      uFence.value = damp(uFence.value, c.heat[2], 6, dt);
      uDish.value = damp(uDish.value, c.heat[3], 6, dt);
      fence.rotation.z = c.t * 0.03;
      dishes.rotation.y = c.t * 0.016;

      tv.copy(needleDirs[20]).applyAxisAngle(yA, rot);
      parts[0].at.copy(tv);
      parts[2].at.set(21, 0, 0).applyAxisAngle(tv.set(0, 0, 1), c.t * 0.03).applyEuler(fence.rotation);
      parts[3].at.copy(dishItems[2].position).applyEuler(dishes.rotation);
    },
  };
};
