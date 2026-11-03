// Capacity Planner: staffing across three offices, a forward view of every day,
// read only from the mirror.
//
// A ring station standing like a wheel. Its inner floor is 360 day cells (3 rows
// of 120), the same count the engine reproduces from the old workbook, and each
// glows by how loaded it is. Three docks are the three offices, and a shuttle
// moves cover between them. Five spokes are the five keys a cover suggestion is
// ranked on. A light comes in along the axis in pulses (the sync) and nothing
// ever goes back out. 17 fins on the mast are the 17 days to production.

import { Group, Mesh, Vector3 } from "three";
import { NOISE, ball, beams, box, cyl, damp, faceted, glow, instanced, lerp, mat, rng, surface, tor, assemble, type Part, type WorldBuilder } from "../toolkit";

const R = 22;
const W = 6.4;

export const buildRing: WorldBuilder = (shared, sun) => {
  const group = new Group();
  const tilt = new Group();
  // standing like a wheel, its axis mostly along x
  tilt.rotation.set(0.05, 0.42, -0.08);
  group.add(tilt);
  const spin = new Group();
  tilt.add(spin);
  const r = rng(202);

  const uPtr = { value: new Vector3(0, 999, 0) };
  const uPtrOn = { value: 0 };
  const uCells = { value: 0 };
  const uBeam = { value: 0 };
  const uSpokes = { value: 0 };
  const uDocks = { value: 0 };
  const uFins = { value: 0 };

  const hullMat = surface(shared, sun, { color: "#7d8796", metal: 0.72, rough: 0.46, data: true, flat: true });

  // ---- the outer hull and the side walls: plates of uneven depth
  const nHull = shared.low ? 90 : 160;
  const hull = instanced(faceted(box(1, 1, 1)), hullMat, nHull * 3, (i, m, d) => {
    const k = i % nHull;
    const row = Math.floor(i / nHull);
    const a = (k / nHull) * Math.PI * 2;
    const arc = ((Math.PI * 2 * (R + 1)) / nHull) * 0.97;
    const dep = 0.5 + r() * 1.3 * (r() > 0.75 ? 1.5 : 0.7);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const wid = W * 0.34;
    const x = (row - 1) * W * 0.335;
    // the +z of the plate faces out from the axis
    m.makeBasis(new Vector3(0, -s, c), new Vector3(1, 0, 0), new Vector3(0, c, s));
    m.scale(new Vector3(arc, wid * (0.92 + r() * 0.08), dep));
    m.setPosition(x, c * (R + 1.1 + dep * 0.5), s * (R + 1.1 + dep * 0.5));
    d[0] = d[1] = d[2] = 0.5 + r() * 0.65;
    d[3] = r() > 0.97 ? 1.6 : 0;
  });
  spin.add(hull);

  // ---- the floor under the cells and the two rims
  const floorGeo = assemble([
    { g: cyl(R + 0.05, R + 0.05, W + 0.2, 120, true).rotateZ(Math.PI / 2), d: [0.3, 0.32, 0.36, 0] },
    { g: tor(R + 0.6, 0.62, 8, 160).rotateY(Math.PI / 2), m: mat(W / 2 + 0.4), d: [1, 1, 1, 0] },
    { g: tor(R + 0.6, 0.62, 8, 160).rotateY(Math.PI / 2), m: mat(-W / 2 - 0.4), d: [1, 1, 1, 0] },
    { g: tor(R - 1.5, 0.1, 6, 160).rotateY(Math.PI / 2), m: mat(W / 2 + 0.6), d: [1, 1, 1, 0.6] },
    { g: tor(R - 1.5, 0.1, 6, 160).rotateY(Math.PI / 2), m: mat(-W / 2 - 0.6), d: [1, 1, 1, 0.6] },
  ]);
  const floorMat = surface(shared, sun, { color: "#79808c", metal: 0.74, rough: 0.5, data: true, side: 2, frag: "glowCol = vec3(2.4, 1.5, 0.7);" });
  spin.add(new Mesh(floorGeo, floorMat));

  // ribs across the floor, one every twenty cells
  const ribs = instanced(faceted(box(1, 1, 1)), surface(shared, sun, { color: "#8a93a2", metal: 0.8, rough: 0.4, data: true, flat: true }), 36, (i, m) => {
    const a = (i / 36) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    m.makeBasis(new Vector3(1, 0, 0), new Vector3(0, -s, c), new Vector3(0, c, s));
    m.scale(new Vector3(W + 2.2, 0.26, 1.3));
    m.setPosition(0, c * (R - 0.7), s * (R - 0.7));
  });
  spin.add(ribs);

  // ---- 360 day cells on the inner floor: 3 rows of 120
  const cellMat = surface(shared, sun, {
    color: "#ffffff",
    metal: 0.2,
    rough: 0.4,
    data: true,
    seed: true,
    uniforms: { uPtr, uPtrOn, uCells },
    head: "uniform vec3 uPtr; uniform float uPtrOn; uniform float uCells;",
    placed: /* glsl */ `
    float near = smoothstep(8.0, 0.5, distance(q, uPtr)) * uPtrOn;
    q.yz *= 1.0 - near * 0.03;
    d.w = near;
    `,
    fragHead: "uniform float uCells;",
    frag: /* glsl */ `
    float col_ = vD.x * 120.0;
    float row = vD.y;
    // the load on each day: a wave around the ring, different per office
    float load = 0.5 + 0.5 * sin(col_ * 0.34 + row * 7.0 + uTime * 0.16) * sin(col_ * 0.13 - row * 3.1 - uTime * 0.09);
    load = pow(load, 1.6) + (vD.z > 0.93 ? 0.42 : 0.0);
    vec3 free_ = vec3(0.1, 0.34, 0.8);
    vec3 busy = vec3(1.9, 0.95, 0.3);
    vec3 hot = vec3(5.0, 2.0, 0.6);
    vec3 c = mix(free_, busy, smoothstep(0.1, 0.6, load));
    c = mix(c, hot, smoothstep(0.72, 1.05, load));
    base = vec3(0.012);
    // a wave of checks runs through every cell when hovered
    float check = smoothstep(0.86, 1.0, sin(col_ * 0.052 * 6.283 + row - uTime * 3.0)) * uCells;
    glowCol = mix(c, vec3(2.4, 4.4, 3.4), check);
    glow = (0.12 + load * 0.78 + vD.w * 1.8 + check * 2.0);
    `,
  });
  const cells = instanced(faceted(box(1, 1, 1)), cellMat, 360, (i, m, d) => {
    const col = i % 120;
    const row = Math.floor(i / 120);
    const a = ((col + 0.5) / 120) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = (row - 1) * (W / 3);
    m.makeBasis(new Vector3(1, 0, 0), new Vector3(0, -s, c), new Vector3(0, c, s));
    m.scale(new Vector3(W / 3 - 0.16, ((Math.PI * 2 * R) / 120) * 0.84, 0.16));
    m.setPosition(x, c * (R - 0.18), s * (R - 0.18));
    d[0] = col / 120;
    d[1] = row / 3;
    d[2] = r();
  });
  spin.add(cells);

  // ---- five spokes and the hub
  const spokeMat = surface(shared, sun, { color: "#a6aebb", metal: 0.85, rough: 0.38, data: true, uniforms: { uSpokes }, fragHead: "uniform float uSpokes;", frag: "glowCol = vec3(1.4, 2.1, 3.6); glow *= 1.0 + uSpokes * 2.2; glow += uSpokes * smoothstep(0.92, 1.0, sin(length(vL.yz) * 0.9 - uTime * 4.0)) * 1.4;" });
  const spokeParts: { g: ReturnType<typeof cyl>; m: ReturnType<typeof mat>; d?: number[] }[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const y = Math.cos(a);
    const z = Math.sin(a);
    const ang = Math.atan2(z, y);
    // two thin tubes per spoke with a truss of cross members
    spokeParts.push({ g: cyl(0.2, 0.28, R - 3, 8), m: mat(-0.5, (y * (R + 3)) / 2, (z * (R + 3)) / 2, ang, 0, 0), d: [1, 1, 1, 0.1] });
    spokeParts.push({ g: cyl(0.2, 0.28, R - 3, 8), m: mat(0.5, (y * (R + 3)) / 2, (z * (R + 3)) / 2, ang, 0, 0), d: [1, 1, 1, 0.1] });
    for (let k = 1; k < 7; k++) {
      const q = 3 + ((R - 3) * k) / 7;
      spokeParts.push({ g: box(1.3, 0.1, 0.1), m: mat(0, y * q, z * q, ang, 0, 0), d: [1, 1, 1, 0.7] });
    }
  }
  const spokeGeo = assemble(spokeParts);
  spin.add(new Mesh(spokeGeo, spokeMat));

  const hubMat = surface(shared, sun, { color: "#9aa3b1", metal: 0.86, rough: 0.34, data: true, flat: true });
  const hubGeo = assemble([
    { g: ball(3.1, 18, 12) },
    { g: cyl(0.8, 0.8, 22, 12).rotateZ(Math.PI / 2), m: mat(0) },
    { g: tor(4, 0.42, 8, 48).rotateY(Math.PI / 2), m: mat(0), d: [1, 1, 1, 0] },
    { g: cyl(2.1, 2.1, 1.1, 16).rotateZ(Math.PI / 2), m: mat(4.1) },
    { g: cyl(2.1, 2.1, 1.1, 16).rotateZ(Math.PI / 2), m: mat(-4.1) },
  ]);
  spin.add(new Mesh(hubGeo, hubMat));
  const hubGlow = glow("#ffcf96", 11, { intensity: 0.8 });
  spin.add(hubGlow);

  // ---- 17 fins along the mast
  const finMat = surface(shared, sun, { color: "#6d7482", metal: 0.86, rough: 0.34, data: true, uniforms: { uFins }, fragHead: "uniform float uFins;", frag: "glowCol = vec3(1.8, 1.25, 0.65); glow = (uFins * 2.6 + 0.14);" });
  const fins = instanced(faceted(box(1, 1, 1)), finMat, 17, (i, m) => {
    const x = -5.6 - i * 0.3;
    m.makeScale(0.05, 2.2 + Math.sin(i * 0.9) * 0.3, 1.25);
    m.setPosition(x, 0, 0);
  });
  tilt.add(fins);

  // ---- three docks on the rim, one per office
  const docks: Group[] = [];
  const dockGlow: Mesh[] = [];
  const dockMat = surface(shared, sun, { color: "#8c95a4", metal: 0.8, rough: 0.42, data: true, flat: true, uniforms: { uDocks }, fragHead: "uniform float uDocks;", frag: "glowCol = vec3(3.4, 1.9, 0.7); glow *= 1.0 + uDocks * 2.0;" });
  const dockGeo = assemble([
    { g: box(9.4, 1, 4.6) },
    { g: box(1, 5, 1.5), m: mat(-3.6, 2.6) },
    { g: box(1, 5, 1.5), m: mat(3.6, 2.6) },
    { g: box(8.4, 0.5, 0.6), m: mat(0, 5, 0), d: [1, 1, 1, 2.2] },
    { g: box(2.2, 2.6, 2.6), m: mat(-3.6, 5.5) },
    { g: box(2.2, 2.6, 2.6), m: mat(3.6, 5.5) },
    { g: cyl(0.1, 0.1, 4.6, 6), m: mat(-3.6, 8.6), d: [1, 1, 1, 0.6] },
    { g: cyl(0.1, 0.1, 4.6, 6), m: mat(3.6, 8.6), d: [1, 1, 1, 0.6] },
  ]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.9;
    const g = new Group();
    g.position.set(0, Math.cos(a) * (R + 2.2), Math.sin(a) * (R + 2.2));
    g.rotation.x = a;
    g.add(new Mesh(dockGeo, dockMat));
    const lamp = glow("#ffb26b", 7, { intensity: 1.2 });
    lamp.position.set(0, 7.4, 0);
    g.add(lamp);
    dockGlow.push(lamp);
    spin.add(g);
    docks.push(g);
  }

  // ---- shuttles moving cover between the docks
  const shuttleMat = surface(shared, sun, { color: "#e4e7ec", metal: 0.6, rough: 0.34, glow: 0, flat: true });
  const shuttleGeo = assemble([{ g: box(0.9, 0.6, 2.2) }, { g: box(2, 0.1, 0.8), m: mat(0, 0, -0.3) }]);
  const shuttles = [0, 1].map((k) => {
    const g = new Group();
    g.add(new Mesh(shuttleGeo, shuttleMat));
    const tail = glow("#ffcf96", 2.6, { intensity: 2.2 });
    tail.position.z = -1.2;
    g.add(tail);
    spin.add(g);
    return { g, phase: k * 0.5, from: k };
  });

  // ---- the sync: a line of light down the axis, inward only
  const beam = beams(
    [{ a: new Vector3(58, 0, 0), b: new Vector3(5, 0, 0), color: "#9cc4ff", w: 0.07 }],
    shared,
    {
      head: "uniform float uBeam;",
      uniforms: { uBeam },
      chunk: /* glsl */ `
      float pulse = fract(t - uTime * 0.16);
      float head = pow(pulse, 26.0);
      i *= (0.12 + uBeam * 1.1) * smoothstep(0.0, 0.3, t) + head * 7.0;
      `,
    },
  );
  tilt.add(beam);
  const intake = glow("#a9c8ff", 5, { intensity: 1.4 });
  intake.position.set(5, 0, 0);
  tilt.add(intake);

  group.add(glow("#ffb98a", 66, { intensity: 0.02, power: 3 }));

  const tv = new Vector3();
  const parts: Part[] = [
    { key: "cells", at: new Vector3(), r: 8 },
    { key: "sync", at: new Vector3(), r: 7 },
    { key: "valve", at: new Vector3(), r: 5 },
    { key: "days", at: new Vector3(), r: 5 },
    { key: "docks", at: new Vector3(), r: 6 },
    { key: "keys", at: new Vector3(), r: 5 },
  ];
  let rot = 0.3;
  let shuttleT = 0;
  void NOISE;
  void lerp;

  const toGroup = (v: Vector3, inSpin: boolean) => {
    if (inSpin) v.applyAxisAngle(tv.set(1, 0, 0), rot);
    return v.applyEuler(tilt.rotation);
  };

  return {
    group,
    radius: 27,
    parts,
    update(c) {
      const dt = c.dt;
      rot += dt * (c.reduced ? 0.004 : 0.034);
      spin.rotation.x = rot;
      uPtrOn.value = damp(uPtrOn.value, c.ptrOn, 6, dt);
      // pointer into the spinning frame
      uPtr.value.copy(c.ptr).applyEuler(tiltInverse(tilt)).applyAxisAngle(tv.set(1, 0, 0), -rot);
      uCells.value = damp(uCells.value, c.heat[0], 6, dt);
      uBeam.value = damp(uBeam.value, 0.4 + c.heat[1] * 2 + c.heat[2], 5, dt);
      uFins.value = damp(uFins.value, c.heat[3], 6, dt);
      uDocks.value = damp(uDocks.value, c.heat[4], 6, dt);
      uSpokes.value = damp(uSpokes.value, c.heat[5], 6, dt);
      hubGlow.scale.setScalar(11 + Math.sin(c.t * 0.9) * 0.6 + c.heat[2] * 5);
      dockGlow.forEach((l, i) => l.scale.setScalar(7 + c.heat[4] * 5 + Math.sin(c.t * 1.4 + i * 2) * 0.8));

      // shuttles: lift off a dock, arc around the rim, settle on the next
      shuttleT += dt * (c.reduced ? 0.008 : 0.05);
      shuttles.forEach((s) => {
        const q = shuttleT + s.phase;
        const k = Math.floor(q);
        const f = q - k;
        const e = f * f * (3 - 2 * f);
        const from = ((s.from + k) % 3) / 3;
        const a = (from + e / 3) * Math.PI * 2 + 0.9;
        const hgt = R + 8.5 + Math.sin(f * Math.PI) * 6;
        const x = Math.sin(f * Math.PI) * 3;
        s.g.position.set(x, Math.cos(a) * hgt, Math.sin(a) * hgt);
        s.g.rotation.x = a + Math.PI / 2;
      });

      const a0 = 0.4;
      parts[0].at.set(0, Math.cos(a0) * R, Math.sin(a0) * R);
      toGroup(parts[0].at, true);
      parts[1].at.set(52, 0, 0);
      toGroup(parts[1].at, false);
      parts[2].at.set(4.2, 0, 0);
      toGroup(parts[2].at, false);
      parts[3].at.set(-8.2, 1.2, 0);
      toGroup(parts[3].at, false);
      parts[4].at.copy(docks[0].position);
      toGroup(parts[4].at, true);
      const sa = 0.3 + (2 / 5) * Math.PI * 2;
      parts[5].at.set(0, Math.cos(sa) * 12, Math.sin(sa) * 12);
      toGroup(parts[5].at, true);
    },
  };
};

import { Euler, Quaternion } from "three";
const tq = new Quaternion();
const te = new Euler();
function tiltInverse(g: Group) {
  tq.setFromEuler(g.rotation).invert();
  return te.setFromQuaternion(tq);
}
