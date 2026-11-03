// Treatment Estimator: every saved line keeps the price it was quoted.
//
// A cut crystal with amber fire inside. The shell is real facets, each one
// flat, and they drift open under the pointer. Inside hang five forms for the
// five pricing model kinds. Everything turns except four frost rings and the
// lines hung on them: price, tier, label and price book version, frozen where
// they were saved. Around it, 14 and a half ticks: the hours to v1.0.0.

import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, Vector3 } from "three";
import { assemble, ball, beams, box, cone, cyl, damp, faceted, glow, ico, instanced, mat, rng, surface, tor, fibSphere, type BeamItem, type Part, type WorldBuilder } from "../toolkit";

const R = 12;

export const buildGeode: WorldBuilder = (shared, sun) => {
  const group = new Group();
  const shellSpin = new Group();
  group.add(shellSpin);
  const r = rng(505);
  const uPtr = { value: new Vector3(0, 999, 0) };
  const uPtrOn = { value: 0 };
  const uOpen = { value: 0.1 };
  const uFire = { value: 0.5 };
  const uInside = { value: 0 };

  // ---- facets: a real cut stone. Each face is a plane, clipped against every
  // other plane, so edges are straight and the faces meet.
  const nSeeds = shared.low ? 44 : 68;
  const seeds: Vector3[] = [];
  const planeD: number[] = [];
  for (let i = 0; i < nSeeds; i++) {
    const v = fibSphere(i, nSeeds, new Vector3());
    v.x += (r() - 0.5) * 0.34;
    v.y += (r() - 0.5) * 0.34;
    v.z += (r() - 0.5) * 0.34;
    seeds.push(v.normalize());
    planeD.push(R * (0.92 + r() * 0.13));
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const center: number[] = [];
  const edge: number[] = [];
  seeds.forEach((n, i) => {
    const o = n.clone().multiplyScalar(planeD[i]);
    const u = new Vector3(0.3, 1, 0.2).cross(n).normalize();
    const v = new Vector3().crossVectors(n, u);
    let poly: Vector3[] = [
      o.clone().addScaledVector(u, -40).addScaledVector(v, -40),
      o.clone().addScaledVector(u, 40).addScaledVector(v, -40),
      o.clone().addScaledVector(u, 40).addScaledVector(v, 40),
      o.clone().addScaledVector(u, -40).addScaledVector(v, 40),
    ];
    seeds.forEach((m, j) => {
      if (j === i || poly.length < 3) return;
      const next: Vector3[] = [];
      for (let k = 0; k < poly.length; k++) {
        const p0 = poly[k];
        const p1 = poly[(k + 1) % poly.length];
        const d0 = p0.dot(m) - planeD[j];
        const d1 = p1.dot(m) - planeD[j];
        if (d0 <= 0) next.push(p0);
        if ((d0 < 0 && d1 > 0) || (d0 > 0 && d1 < 0)) next.push(p0.clone().lerp(p1, d0 / (d0 - d1)));
      }
      poly = next;
    });
    if (poly.length < 3) return;
    const c0 = poly.reduce((acc, p) => acc.add(p), new Vector3()).multiplyScalar(1 / poly.length);
    const rand = r();
    for (let k = 0; k < poly.length; k++) {
      const p0 = poly[k];
      const p1 = poly[(k + 1) % poly.length];
      // keep the winding facing out
      const flip = new Vector3().subVectors(p0, c0).cross(new Vector3().subVectors(p1, c0)).dot(n) < 0;
      const tri = flip ? [c0, p1, p0] : [c0, p0, p1];
      tri.forEach((t, q) => {
        pos.push(t.x, t.y, t.z);
        nor.push(n.x, n.y, n.z);
        center.push(n.x, n.y, n.z, rand);
        edge.push(q === 0 ? 1 : 0);
      });
    }
  });
  const shellGeo = new BufferGeometry();
  shellGeo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  shellGeo.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  shellGeo.setAttribute("aCenter", new BufferAttribute(new Float32Array(center), 4));
  shellGeo.setAttribute("aEdge", new BufferAttribute(new Float32Array(edge), 1));

  const shellMat = surface(shared, sun, {
    color: "#a8c8e8",
    metal: 0.85,
    rough: 0.06,
    additive: true,
    side: DoubleSide,
    envI: 1.4,
    uniforms: { uPtr, uPtrOn, uOpen, uFire, uInside },
    head: /* glsl */ `attribute vec4 aCenter; attribute float aEdge; uniform vec3 uPtr; uniform float uPtrOn; uniform float uOpen; varying float vEdge; varying float vOpen; varying vec3 vCtr; varying float vSc; varying float vR;`,
    vertex: /* glsl */ `
    vec3 cdir = aCenter.xyz;
    float nearP = smoothstep(9.0, 0.5, distance(cdir * ${R.toFixed(1)}, uPtr)) * uPtrOn;
    float open = uOpen * (0.5 + aCenter.w * 0.9) + nearP * (1.1 + aCenter.w * 1.1);
    // each facet swings a little as it lifts away
    float sw = open * 0.06 * (aCenter.w - 0.5);
    vec3 rel = p - cdir * dot(p, cdir);
    p += cross(cdir, rel) * sw;
    p += cdir * open * 2.3;
    vEdge = aEdge;
    vOpen = open;
    vCtr = modelMatrix[3].xyz;
    vSc = length(modelMatrix[0].xyz);
    vR = aCenter.w;
    `,
    fragHead: /* glsl */ `varying float vEdge; varying float vOpen; uniform float uFire; uniform float uInside; varying vec3 vCtr; varying float vSc; varying float vR;`,
    frag: /* glsl */ `
    base = vec3(0.68, 0.82, 1.0);
    `,
    after: /* glsl */ `
    float e = 1.0 - smoothstep(0.0, 0.05, vEdge);
    // follow the view ray through the facet: how close does it pass the fire?
    vec3 rd = refract(-V, N, 0.76 + vR * 0.06);
    vec3 oc = vW - vCtr;
    float tca = -dot(oc, rd);
    float miss = length(oc + rd * max(tca, 0.0)) / vSc;
    float fire = exp(-miss * miss * 0.14) * (0.42 + uFire * 0.7);
    float sparkle = 0.55 + 0.45 * sin(vR * 60.0 + uTime * 0.3);
    vec3 thru = textureCube(tEnv, rd).rgb * vec3(0.8, 0.9, 1.0) * 0.9;
    col = col * (0.04 + F * 0.7) + thru * (0.2 - uInside * 0.16);
    col += vec3(3.4, 1.5, 0.36) * fire * fire * sparkle * 0.9;
    col += vec3(0.006, 0.012, 0.026);
    col += vec3(0.7, 0.95, 1.45) * e * (0.42 + vOpen * 0.3);
    // a slow glint crossing each face, so a flat facet is never a flat colour
    float glint = pow(max(dot(reflect(-V, N), normalize(vec3(0.5, 0.7, -0.4))), 0.0), 26.0);
    col += vec3(0.8, 0.95, 1.3) * glint * 0.55;
    `,
  });
  const shell = new Mesh(shellGeo, shellMat);
  shell.frustumCulled = false;
  shell.renderOrder = 3;
  shellSpin.add(shell);

  // ---- the fire
  const fireMat = surface(shared, sun, { color: "#ff9b3d", metal: 0.2, rough: 0.5, flat: true, glow: 1.5, frag: "glowCol = vec3(1.0, 0.42, 0.08); float nvv = max(dot(N, V), 0.0); glow *= (0.16 + nvv * nvv * nvv * 1.5) * (0.86 + 0.14 * sin(uTime * 0.7));" });
  const coreSpin = new Group();
  group.add(coreSpin);
  coreSpin.add(new Mesh(ico(1.9, 1), fireMat));
  const fireGlow = glow("#ffa64a", 22, { intensity: 0.32, power: 2.4 });
  group.add(fireGlow);
  group.add(glow("#ffd9a8", 7, { intensity: 0.34, power: 2.4 }));

  // ---- five forms for five pricing kinds, circling the fire
  const uKinds = { value: 0 };
  const kindMat = surface(shared, sun, { color: "#c66f18", metal: 0.96, rough: 0.16, rim: 0, envI: 1.6, data: true, flat: true, uniforms: { uKinds }, fragHead: "uniform float uKinds;", frag: "glowCol = vec3(2.4, 1.05, 0.22); float toFire = max(dot(N, -normalize(vL)), 0.0); glow = (glow + 0.04 + toFire * toFire * 0.42) * (1.0 + uKinds * 2.4);" });
  const kindGeos = [
    // flat: one plain slab
    assemble([{ g: box(2.6, 0.36, 1.9) }]),
    // tiered: steps
    assemble([{ g: box(2.5, 0.4, 2.5) }, { g: box(1.7, 0.4, 1.7), m: mat(0, 0.4) }, { g: box(0.9, 0.4, 0.9), m: mat(0, 0.8) }]),
    // tiered by zone: a grid of steps, each its own height
    assemble([
      { g: box(0.82, 0.5, 0.82), m: mat(-0.5, 0.25, -0.5) },
      { g: box(0.82, 1.0, 0.82), m: mat(0.5, 0.5, -0.5) },
      { g: box(0.82, 1.5, 0.82), m: mat(-0.5, 0.75, 0.5) },
      { g: box(0.82, 2.1, 0.82), m: mat(0.5, 1.05, 0.5) },
    ]),
    // price range: a low and a high, with a span between
    assemble([
      { g: cone(0.9, 1.4, 6), m: mat(0, 1.2, 0, Math.PI) },
      { g: cone(0.9, 1.4, 6), m: mat(0, -1.2) },
      { g: cyl(0.09, 0.09, 1.2, 8) },
      { g: ball(0.28, 12, 8), m: mat(0, 0.1), d: [1, 1, 1, 2.6] },
    ]),
    // per surface: many faces
    assemble([{ g: ico(1.25, 1) }]),
  ];
  const kinds = kindGeos.map((g, i) => {
    const m = new Mesh(g, kindMat);
    const hold = new Group();
    const ang = (i / 5) * Math.PI * 2;
    hold.position.set(Math.cos(ang) * 6.4, Math.sin(ang * 2) * 1.4, Math.sin(ang) * 6.4);
    hold.add(m);
    coreSpin.add(hold);
    return { hold, m };
  });

  // ---- four frost rings that never turn, with saved lines hung on them
  const uFrozen = { value: 0 };
  const frostMat = surface(shared, sun, { color: "#e7f1ff", metal: 0.4, rough: 0.2, glow: 0.5, uniforms: { uFrozen }, fragHead: "uniform float uFrozen;", frag: "glowCol = vec3(1.05, 1.35, 2.0); glow *= 1.0 + uFrozen * 2.2;" });
  const frozen = new Group();
  const ringAxes: [number, number, number][] = [
    [0.5, 0, 0.3],
    [1.2, 0.5, -0.4],
    [2.1, 1.1, 0.5],
    [2.8, 1.9, -0.6],
  ];
  const lines: BeamItem[] = [];
  ringAxes.forEach(([x, y, z], i) => {
    const rad = 10.2 + i * 0.42;
    const m = new Mesh(tor(rad, 0.022, 5, 128), frostMat);
    m.rotation.set(x, y, z);
    m.updateMatrix();
    frozen.add(m);
    for (let k = 0; k < 16; k++) {
      const an = (k / 16) * Math.PI * 2 + i;
      const pa = new Vector3(Math.cos(an) * rad, Math.sin(an) * rad, 0).applyMatrix4(m.matrix);
      const pb = pa.clone().multiplyScalar(0.84 + r() * 0.1);
      lines.push({ a: pa, b: pb, color: "#cfe2ff", i: 0.55, w: 0.012 });
    }
  });
  frozen.add(beams(lines, shared));
  const crumbs = instanced(ball(0.05, 8, 6), surface(shared, sun, { color: "#ffffff", data: true, glow: 1.2, frag: "glowCol = vec3(1.2, 1.5, 2.2);" }), lines.length, (i, m) => m.setPosition(lines[i].a));
  frozen.add(crumbs);
  group.add(frozen);

  // ---- 14 and a half hours on an outer dial
  const uDial = { value: 0 };
  const dialItems: BeamItem[] = [];
  const dialR = 17.4;
  for (let i = 0; i < 15; i++) {
    const an = -1.5 + i * 0.22;
    const half = i === 14;
    dialItems.push({
      a: new Vector3(Math.cos(an) * dialR, Math.sin(an) * dialR, 0),
      b: new Vector3(Math.cos(an) * (dialR + (half ? 0.9 : 1.8)), Math.sin(an) * (dialR + (half ? 0.9 : 1.8)), 0),
      color: "#ffe0b8",
      i: 2.3,
      w: 0.055,
    });
  }
  const dial = beams(dialItems, shared, { head: "uniform float uDial;", uniforms: { uDial }, chunk: "i *= 0.6 + uDial * 1.8;" });
  const dialGroup = new Group();
  dialGroup.rotation.set(0.25, 0.35, 0);
  dialGroup.add(dial);
  group.add(dialGroup);

  // ---- nine decisions before any code: nine small slabs in a line
  const uNine = { value: 0 };
  const nine = instanced(faceted(box(0.56, 0.08, 0.84)), surface(shared, sun, { color: "#f0e7da", metal: 0.65, rough: 0.3, data: true, uniforms: { uNine }, fragHead: "uniform float uNine;", frag: "glowCol = vec3(2.2, 1.5, 0.7); glow = 0.25 + uNine * 2.2;" }), 9, (i, m) => {
    const an = 2.1 + i * 0.09;
    m.setPosition(Math.cos(an) * 18.6, -3 + i * 0.14, Math.sin(an) * 18.6);
  });
  const nineGroup = new Group();
  nineGroup.add(nine);
  group.add(nineGroup);

  // ---- the cost: one small coin of a moon
  const uCoin = { value: 0 };
  const coin = new Group();
  coin.add(new Mesh(cyl(1, 1, 0.14, 28).rotateX(Math.PI / 2), surface(shared, sun, { color: "#e5ddcd", metal: 0.9, rough: 0.24, uniforms: { uCoin }, fragHead: "uniform float uCoin;", frag: "glowCol = vec3(2.2, 1.6, 0.8); glow = uCoin * 2.2;" })));
  coin.add(glow("#ffd9a8", 3.2, { intensity: 0.34 }));
  group.add(coin);

  group.add(glow("#7fb0ff", 50, { intensity: 0.016, power: 3 }));

  const parts: Part[] = [
    { key: "hours", at: new Vector3(), r: 5 },
    { key: "fields", at: new Vector3(), r: 6 },
    { key: "kinds", at: new Vector3(), r: 3.5 },
    { key: "cost", at: new Vector3(), r: 2.6 },
    { key: "decisions", at: new Vector3(), r: 3 },
  ];
  const yA = new Vector3(0, 1, 0);
  let rot = 0;
  let coreRot = 0;

  return {
    group,
    radius: 16,
    parts,
    update(c) {
      const dt = c.dt;
      rot += dt * (c.reduced ? 0.003 : 0.018);
      coreRot += dt * (c.reduced ? 0.004 : 0.09);
      shellSpin.rotation.y = rot;
      shellSpin.rotation.x = Math.sin(rot * 0.7) * 0.1;
      coreSpin.rotation.y = coreRot;
      kinds.forEach((k, i) => {
        k.m.rotation.y = c.t * (0.2 + i * 0.05);
        k.m.rotation.x = Math.sin(c.t * 0.3 + i) * 0.2;
        const s = 1 + c.heat[2] * 0.22;
        k.m.scale.setScalar(s);
      });
      // open as the camera comes in
      const camD = c.cam.length();
      const want = 0.12 + 0.9 * (1 - Math.min(1, Math.max(0, (camD - 13) / 12)));
      uOpen.value = damp(uOpen.value, want, 3, dt);
      uInside.value = damp(uInside.value, camD < 14 ? 1 : 0, 3, dt);
      uPtrOn.value = damp(uPtrOn.value, c.ptrOn, 6, dt);
      uPtr.value.copy(c.ptr).applyAxisAngle(yA, -rot);
      uFire.value = damp(uFire.value, 0.6 + c.heat[2] * 0.8 + c.ptrOn * 0.5, 4, dt);
      fireGlow.scale.setScalar(24 + Math.sin(c.t * 0.8) * 1.4 + c.ptrOn * 3);
      uFrozen.value = damp(uFrozen.value, c.heat[1], 6, dt);
      uKinds.value = damp(uKinds.value, c.heat[2], 6, dt);
      uDial.value = damp(uDial.value, c.heat[0], 6, dt);
      uNine.value = damp(uNine.value, c.heat[4], 6, dt);
      uCoin.value = damp(uCoin.value, c.heat[3], 6, dt);
      nineGroup.rotation.y = c.t * 0.02;
      const ca = c.t * 0.03 + 4.2;
      coin.position.set(Math.cos(ca) * 19.5, 4.5, Math.sin(ca) * 19.5);
      coin.rotation.y = c.t * 0.3;

      parts[0].at.set(Math.cos(0) * (dialR + 1), Math.sin(0) * (dialR + 1), 0).applyEuler(dialGroup.rotation);
      parts[1].at.set(10.2, 0, 0).applyEuler(frozen.children[0].rotation);
      parts[2].at.copy(kinds[1].hold.position).applyAxisAngle(yA, coreRot);
      parts[3].at.copy(coin.position);
      parts[4].at.set(Math.cos(2.46 - c.t * 0.02) * 18.6, -2.4, Math.sin(2.46 - c.t * 0.02) * 18.6);
    },
  };
};
