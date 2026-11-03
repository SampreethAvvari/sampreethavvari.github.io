// Doc Coach: every consult graded from its Zoom transcript against seven
// criteria, with a real quote behind each rationale.
//
// A world that is an instrument. Seven bands of bars run around a dark sphere,
// one per criterion, moving like two voices in a room; each band has its colour,
// as the report does. 25 beads on the rails between them are the sub checks. A
// reading head walks around the sphere. Outside, 471 bright sparks (consults
// scored live) and 392 dim ones (older consults regraded). Now and then a small
// report leaves the sphere and flies off.

import { Color, Group, Mesh, Vector3 } from "three";
import { assemble, ball, box, damp, faceted, glow, instanced, mat, pointCloud, pointsMaterial, rng, surface, tor, type Part, type WorldBuilder } from "../toolkit";

const R = 10.9;
const BAND = [-1.14, -0.76, -0.38, 0, 0.38, 0.76, 1.14];
const PALETTE = ["#ff5f4a", "#ff8d3e", "#ffc24a", "#e8f0d0", "#62e0bf", "#3fb6e8", "#6a84ff"];

export const buildListener: WorldBuilder = (shared, sun) => {
  const group = new Group();
  const spin = new Group();
  group.add(spin);
  const r = rng(303);
  const uPtr = { value: new Vector3(0, 999, 0) };
  const uPtrOn = { value: 0 };
  const uHead = { value: 0 };
  const uBands = { value: 0 };
  const uFocus = { value: 0 };

  const core = new Mesh(ball(R - 0.15, 72, 48), surface(shared, sun, {
    color: "#14171f",
    metal: 0.55,
    rough: 0.45,
    envI: 0.8,
    frag: /* glsl */ `
    // fine lines of latitude, so the surface reads at any distance
    float lat = asin(clamp(normalize(vL).y, -1.0, 1.0));
    float lines = smoothstep(0.82, 1.0, sin(lat * 80.0));
    base += vec3(0.08) * lines;
    `,
  }));
  spin.add(core);

  // ---- the bars
  const list: { band: number; lon: number }[] = [];
  const pitch = shared.low ? 0.58 : 0.4;
  BAND.forEach((lat, b) => {
    const rows = shared.low ? 3 : 5;
    for (let q = 0; q < rows; q++) {
      const la = lat + (q - (rows - 1) / 2) * 0.052;
      const n = Math.floor((Math.cos(la) * R * Math.PI * 2) / pitch);
      for (let k = 0; k < n; k++) list.push({ band: b + q / 100, lon: (k / n) * Math.PI * 2 + ((q % 2) * Math.PI) / n });
    }
  });
  const pal = PALETTE.map((h) => new Color(h));
  const barMat = surface(shared, sun, {
    metal: 0.25,
    rough: 0.42,
    data: true,
    seed: true,
    uniforms: { uPtr, uPtrOn, uHead, uBands, uFocus, uPal: { value: pal } },
    head: /* glsl */ `
    uniform vec3 uPtr; uniform float uPtrOn; uniform float uHead; uniform float uBands; uniform float uFocus;
    varying float vH;
    float voice(float lon, float band, float t) {
      // two people talking: one speaks, then the other, each with their own shape
      float a = abs(sin(lon * 5.0 + t * 1.2 + band)) * abs(sin(lon * 11.0 - t * 1.9 + band * 2.0));
      float b = abs(sin(lon * 3.0 - t * 1.5 + band * 1.5)) * abs(sin(lon * 17.0 + t * 2.4));
      float turn = smoothstep(-0.2, 0.2, sin(t * 0.4 + band * 1.3));
      return mix(a, b, turn);
    }`,
    vertex: /* glsl */ `
    vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float lon = d.y;
    float band = d.x;
    float v = voice(lon, floor(band), uTime * (0.45 + uFocus * 0.35));
    v = pow(v, 0.8);
    float dHead = abs(mod(lon - uHead + 3.14159, 6.28318) - 3.14159);
    float head = exp(-dHead * dHead * 90.0);
    float near = smoothstep(7.0, 0.8, distance(c, uPtr)) * uPtrOn;
    float h = 0.09 + v * 2.15 * (0.42 + uFocus * 0.58 + uBands * 0.35) + head * 1.5 + near * 2.2;
    h *= 0.74 + s * 0.42;
    p.y = (p.y + 0.5) * h;
    d.z = h;
    d.w = head + near * 0.9 + v * 0.5;
    `,
    fragHead: "uniform vec3 uPal[7]; uniform float uBands;",
    frag: /* glsl */ `
    int bi = int(floor(vD.x));
    vec3 pc = uPal[bi];
    float along = clamp(vO.y + 0.5, 0.0, 1.0);
    base = pc * 0.24 * (0.3 + along * 0.7);
    // the tip of a bar burns, its foot sits in the dark
    glowCol = pc;
    glow = (0.08 + along * along * 2.2 * (0.45 + vD.w)) * (1.0 + uBands * 1.4);
    `,
  });
  const barGeo = faceted(box(pitch * 0.56, 1, pitch * 0.56));
  const bars = instanced(barGeo, barMat, list.length, (i, m, d) => {
    const it = list[i];
    const b = Math.floor(it.band);
    const q = Math.round((it.band - b) * 100);
    const rows = shared.low ? 3 : 5;
    const la = BAND[b] + (q - (rows - 1) / 2) * 0.052;
    const n = new Vector3(Math.cos(la) * Math.cos(it.lon), Math.sin(la), Math.cos(la) * Math.sin(it.lon));
    const up = new Vector3(0, 1, 0);
    const xx = new Vector3().crossVectors(up, n).normalize();
    const zz = new Vector3().crossVectors(xx, n).normalize();
    m.makeBasis(xx, n, zz);
    m.setPosition(n.multiplyScalar(R));
    d[0] = b + 0.5;
    d[1] = it.lon;
  });
  spin.add(bars);

  // ---- rails between the bands with 25 beads
  const railParts = [];
  const rails: number[] = [];
  for (let i = 0; i < 6; i++) {
    const la = (BAND[i] + BAND[i + 1]) / 2;
    rails.push(la);
    const rr = Math.cos(la) * (R + 0.28);
    railParts.push({ g: tor(rr, 0.035, 5, 128).rotateX(Math.PI / 2), m: mat(0, Math.sin(la) * (R + 0.28), 0) });
  }
  const railGeo = assemble(railParts);
  spin.add(new Mesh(railGeo, surface(shared, sun, { color: "#c8d2e3", metal: 0.9, rough: 0.3, data: true })));
  const beadSpots: Vector3[] = [];
  const uBeads = { value: 0 };
  const beadMat = surface(shared, sun, { color: "#ffffff", metal: 0.4, rough: 0.3, data: true, seed: true, uniforms: { uBeads }, fragHead: "uniform float uBeads;", frag: "glowCol = vec3(2.6, 2.9, 3.4); glow = 0.9 + uBeads * 2.2 + 1.3 * smoothstep(0.7, 1.0, sin(uTime * 0.7 + vS * 24.0));" });
  const beads = instanced(ball(0.17, 10, 8), beadMat, 25, (i, m) => {
    const rail = i % 6;
    const la = rails[rail];
    const lon = (i / 25) * Math.PI * 2 * 3.7 + rail;
    const p = new Vector3(Math.cos(la) * Math.cos(lon), Math.sin(la), Math.cos(la) * Math.sin(lon)).multiplyScalar(R + 0.28);
    beadSpots.push(p.clone());
    m.setPosition(p);
  });
  spin.add(beads);

  // ---- the reading head: a meridian arc that walks round the sphere
  const headMat = surface(shared, sun, { color: "#ffffff", metal: 0.2, rough: 0.3, glow: 1.2, frag: "glowCol = vec3(1.6, 1.8, 2.2);" });
  const head = new Group();
  const headArc = new Mesh(tor(R + 3.6, 0.028, 6, 120, Math.PI * 0.86).rotateZ(-Math.PI * 0.43), headMat);
  head.add(headArc);
  const headCap = glow("#ffffff", 3.4, { intensity: 1.2 });
  headCap.position.set(R + 3.6, 0, 0);
  head.add(headCap);
  spin.add(head);

  // ---- sparks: 471 consults scored live, 392 older ones regraded
  const makeRing = (n: number, r0: number, r1: number, bright: number, size: number, seed: number) => {
    const rr = rng(seed);
    const pos = new Float32Array(n * 3);
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rr() * 0.01;
      const rad = r0 + (r1 - r0) * Math.pow(rr(), 1.4);
      pos.set([Math.cos(ang) * rad, (rr() - 0.5) * 0.22, Math.sin(ang) * rad], i * 3);
      a.set([bright * (0.55 + rr() * 0.8), size * (0.75 + rr() * 0.7), rr()], i * 3);
    }
    const uH = { value: 0 };
    const m = pointsMaterial(shared, {
      head: "attribute vec3 aA; uniform float uHeat;",
      uniforms: { uHeat: uH },
      maxSize: 5,
      vertex: /* glsl */ `
      size = aA.y * (1.0 + uHeat * 0.6);
      a = aA.x * (1.0 + uHeat * 1.8) * (0.8 + 0.2 * sin(uTime * 1.3 + aA.z * 40.0));
      col = mix(vec3(0.75, 0.86, 1.2), vec3(1.4, 1.05, 0.8), aA.z);
      `,
    });
    const pc = pointCloud(pos, { aA: [a, 3] }, m);
    return { pc, uH };
  };
  const live = makeRing(471, 17.4, 20.6, 2.1, 0.13, 471);
  const older = makeRing(392, 22.2, 24.8, 0.7, 0.09, 392);
  const sparks = new Group();
  sparks.rotation.set(0.16, 0, -0.26);
  sparks.add(live.pc, older.pc);
  group.add(sparks);

  // ---- the report that goes out
  const plate = new Group();
  const plateMesh = new Mesh(faceted(box(1.5, 2, 0.08)), surface(shared, sun, { color: "#eef2f8", metal: 0.1, rough: 0.5, glow: 0.9 }));
  plate.add(plateMesh);
  const stripes = instanced(faceted(box(1.1, 0.13, 0.03)), surface(shared, sun, { color: "#ffffff", data: true, rough: 0.6 }), 7, (i, m, d) => {
    const c = pal[i];
    m.setPosition(0, 0.74 - i * 0.24, 0.06);
    d[0] = c.r;
    d[1] = c.g;
    d[2] = c.b;
    d[3] = 1.6;
  });
  plate.add(stripes);
  plate.add(glow("#ffffff", 4.5, { intensity: 0.35 }));
  group.add(plate);

  group.add(glow("#ff9a78", 50, { intensity: 0.02, power: 3 }));

  const parts: Part[] = [
    { key: "live", at: new Vector3(), r: 6 },
    { key: "fast", at: new Vector3(), r: 5 },
    { key: "bands", at: new Vector3(), r: 7 },
    { key: "older", at: new Vector3(), r: 6 },
    { key: "quote", at: new Vector3(), r: 5 },
  ];
  let rot = 0;
  let headAng = 0;
  const yAxis = new Vector3(0, 1, 0);
  const tmp = new Vector3();

  return {
    group,
    radius: 20,
    parts,
    update(c) {
      const dt = c.dt;
      rot += dt * (c.reduced ? 0.004 : 0.022);
      spin.rotation.y = rot;
      headAng += dt * (c.reduced ? 0.01 : 0.34 + c.heat[4] * 0.6);
      head.rotation.y = -headAng;
      uHead.value = (headAng % (Math.PI * 2)) * 1 + 0;
      uPtrOn.value = damp(uPtrOn.value, c.ptrOn, 6, dt);
      uPtr.value.copy(c.ptr).applyAxisAngle(yAxis, -rot);
      uBands.value = damp(uBands.value, c.heat[2], 6, dt);
      uBeads.value = damp(uBeads.value, c.heat[2], 6, dt);
      uFocus.value = damp(uFocus.value, c.near, 3, dt);
      live.uH.value = damp(live.uH.value, c.heat[0], 6, dt);
      older.uH.value = damp(older.uH.value, c.heat[3], 6, dt);
      sparks.rotation.y = c.t * 0.012;

      // a report leaves every few seconds
      const cycle = c.t * 0.11 + (c.heat[1] > 0.2 ? c.t * 0.05 : 0);
      const f = cycle - Math.floor(cycle);
      const up = f < 0.08 ? 0 : (f - 0.08) / 0.92;
      const e = up * up * (3 - 2 * up);
      plate.visible = f > 0.03;
      const a = 0.8 + Math.floor(cycle) * 2.1;
      const rad = R + 2 + e * 32;
      plate.position.set(Math.cos(a) * rad, 2 + e * 15, Math.sin(a) * rad);
      plate.rotation.set(0.3, -a + c.t * 0.4, 0.2);
      plate.scale.setScalar(Math.min(1, f * 20) * (1 - Math.pow(up, 8)));

      const sAng = c.t * 0.012 + 0.9;
      parts[0].at.set(Math.cos(sAng) * 19, 0, Math.sin(sAng) * 19).applyEuler(sparks.rotation);
      parts[3].at.set(Math.cos(sAng + 1.1) * 23.5, 0, Math.sin(sAng + 1.1) * 23.5).applyEuler(sparks.rotation);
      parts[1].at.copy(plate.position);
      parts[2].at.set(Math.cos(0.3) * R * 0.92, Math.sin(0.38) * R, Math.sin(0.3) * R * 0.92).applyAxisAngle(yAxis, rot);
      tmp.set(R + 3.6, 3, 0).applyAxisAngle(yAxis, rot - headAng);
      parts[4].at.copy(tmp);
    },
  };
};
