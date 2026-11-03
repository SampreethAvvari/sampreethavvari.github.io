// Hybridge Forms: built around one rule, no submission is ever lost.
//
// A river of sparks comes out of the dark and hits a world of three nested nets.
// The first catches it (Firestore). When that net fails it opens a hole, and the
// next one down catches it instead (a private bucket). The innermost is the
// visitor's own device, 15 ticks around it for the 15 seconds of retries. A sweep
// goes round and round. Nothing reaches the far side. One moon, perfectly dark,
// is the log: nothing in it. 67 beads are the leads that got their missing fields.
// Move the pointer over the nets and it throws sparks where you point.

import { AdditiveBlending, BufferAttribute, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, Vector3, Vector4 } from "three";
import { ball, beams, box, cyl, damp, faceted, glow, ico, instanced, placeAlong, pointCloud, pointsMaterial, rng, surface, tor, type BeamItem, type Part, type U, type WorldBuilder } from "../toolkit";

const SHELLS = [17, 12.4, 8];
const MAX_HITS = 8;

const netFrag = (col: string) => /* glsl */ `
    vec3 bar = vBary;
    vec3 fw = fwidth(bar);
    vec3 th = smoothstep(vec3(0.0), fw * 1.2 + 0.006, bar);
    // from far off a net is mostly lines: keep it from turning into a solid ball
    float dense = 1.0 - 0.72 * smoothstep(0.03, 0.2, max(fw.x, max(fw.y, fw.z)));
    float wire = 1.0 - min(th.x, min(th.y, th.z));
    vec3 dir = normalize(vL);
    float ripple = 0.0;
    float flash = 0.0;
    for (int i = 0; i < ${MAX_HITS}; i++) {
      vec4 h = uHits[i];
      if (h.w < 0.0) continue;
      float ang = acos(clamp(dot(dir, h.xyz), -1.0, 1.0));
      float front = h.w * 1.5;
      float x = (ang - front) * 9.0;
      ripple += exp(-x * x) * (1.0 - smoothstep(0.1, 1.0, h.w));
      flash += exp(-ang * ang * 40.0) * (1.0 - smoothstep(0.0, 0.3, h.w));
    }
    float hole = 0.0;
    if (uHole.w > 0.001) {
      float ang = acos(clamp(dot(dir, uHole.xyz), -1.0, 1.0));
      hole = 1.0 - smoothstep(uHole.w * 0.7, uHole.w, ang);
    }
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 2.4);
    vec3 c = ${col};
    vec3 net = c * wire * dense * (uBase * 0.55 + fres * 0.42 + ripple * 2.4 + uHeat * 0.8) * (1.0 - uInside * 0.94);
    net *= 1.0 - hole;
    vec3 rim = vec3(3.0, 3.6, 3.0) * smoothstep(0.0, 1.0, wire) * flash * 3.0;
    vec3 skin = c * fres * 0.012;
    float rimHole = uHole.w > 0.001 ? exp(-pow((acos(clamp(dot(dir, uHole.xyz), -1.0, 1.0)) - uHole.w) * 18.0, 2.0)) : 0.0;
    gl_FragColor = vec4(net + rim + skin + vec3(3.2, 1.8, 0.7) * rimHole * wire * 2.0, 1.0);
`;

export const buildNets: WorldBuilder = (shared, sun) => {
  const group = new Group();
  const r = rng(707);
  const hitUniforms: U<Vector4[]>[] = [];
  const holeUniforms: U<Vector4>[] = [];
  const heatUniforms: U<number>[] = [];
  const nets: Mesh[] = [];
  const insideU = SHELLS.map(() => ({ value: 0 }));
  const palette = ["vec3(0.46, 1.15, 1.05)", "vec3(0.4, 0.86, 1.3)", "vec3(1.3, 1.02, 0.66)"];
  SHELLS.forEach((rad, i) => {
    const detail = i === 0 ? (shared.low ? 6 : 9) : i === 1 ? (shared.low ? 5 : 7) : 4;
    const geo = ico(rad, detail);
    const n = geo.getAttribute("position").count;
    const bary = new Float32Array(n * 3);
    for (let t = 0; t < n; t += 3) bary.set([1, 0, 0, 0, 1, 0, 0, 0, 1], t * 3);
    geo.setAttribute("aBary", new BufferAttribute(bary, 3));
    const uHits = { value: Array.from({ length: MAX_HITS }, () => new Vector4(0, 1, 0, -1)) };
    const uHole = { value: new Vector4(1, 0, 0, 0) };
    const uHeat = { value: 0 };
    hitUniforms.push(uHits);
    holeUniforms.push(uHole);
    heatUniforms.push(uHeat);
    const m = surface(shared, sun, {
      additive: true,
      side: DoubleSide,
      uniforms: { uHits, uHole, uHeat, uInside: insideU[i], uBase: { value: i === 0 ? 0.32 : i === 1 ? 0.4 : 0.62 } },
      head: "attribute vec3 aBary; varying vec3 vBary;",
      vertex: "vBary = aBary;",
      fragHead: `varying vec3 vBary; uniform vec4 uHits[${MAX_HITS}]; uniform vec4 uHole; uniform float uHeat; uniform float uBase; uniform float uInside;`,
      after: netFrag(palette[i]) + "\n  return;",
    });
    const mesh = new Mesh(geo, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4 + (2 - i);
    group.add(mesh);
    nets.push(mesh);
  });

  // ---- what they protect: a warm core, the worker that delivers
  const coreMat = surface(shared, sun, { color: "#3a2c20", metal: 0.86, rough: 0.3, flat: true, frag: "vec3 ab = abs(vO) / 1.55; float ed = smoothstep(0.86, 1.0, max(min(ab.x, ab.y), max(min(ab.y, ab.z), min(ab.x, ab.z)))); glowCol = vec3(2.8, 1.5, 0.5); glow = 0.1 + ed * 2.4;" });
  const core = new Mesh(faceted(box(3.1, 3.1, 3.1)), coreMat);
  group.add(core);
  group.add(glow("#ffb56b", 19, { intensity: 0.34, power: 2.4 }));

  // ---- the river: sparks falling along one long curve
  const nRiver = shared.low ? 1300 : 3400;
  const rp = new Float32Array(nRiver * 3);
  const ra = new Float32Array(nRiver * 4);
  for (let i = 0; i < nRiver; i++) ra.set([r(), r(), (r() + r() - 1), (r() + r() - 1)], i * 4);
  const uRiver = { value: 0.4 };
  const riverMat = pointsMaterial(shared, {
    head: "attribute vec4 aD; uniform float uRiver;",
    uniforms: { uRiver },
    maxSize: 6,
    vertex: /* glsl */ `
    float k = fract(aD.x + uTime * (0.028 + aD.y * 0.012));
    // from far off in the dark, curving into the world
    vec3 A = vec3(-132.0, -62.0, -118.0);
    vec3 B = vec3(-78.0, -10.0, -92.0);
    vec3 C = vec3(-46.0, 12.0, -30.0);
    vec3 E = normalize(vec3(-0.72, -0.1, -0.68)) * 17.0;
    float u = 1.0 - k;
    pos = u * u * u * A + 3.0 * u * u * k * B + 3.0 * u * k * k * C + k * k * k * E;
    float spread = 0.8 + u * 13.0;
    pos += vec3(aD.z, aD.w, aD.z * aD.w) * spread;
    col = mix(vec3(0.44, 0.82, 1.15), vec3(2.3, 2.8, 2.5), k);
    size = 0.2 + aD.y * 0.3;
    a = uRiver * 1.8 * (0.5 + aD.y) * smoothstep(0.0, 0.1, k) * smoothstep(1.0, 0.99, k);
    `,
  });
  const river = pointCloud(rp, { aD: [ra, 4] }, riverMat);
  group.add(river);

  // ---- bright submissions you can follow, one instanced streak each
  const N = 22;
  const streakMat = surface(shared, sun, {
    additive: true,
    frag: "",
    after: "float tl = smoothstep(-0.5, 0.5, vO.y); gl_FragColor = vec4(vec3(2.4, 3.6, 3.2) * tl * tl * 2.4, 1.0); return;",
  });
  const streaks = new InstancedMesh(cyl(0.035, 0.11, 1, 6), streakMat, N);
  streaks.frustumCulled = false;
  group.add(streaks);
  type Spark = { p: Vector3; to: Vector3; from: Vector3; t: number; dur: number; shell: number; active: boolean; wait: number };
  const sparks: Spark[] = Array.from({ length: N }, (_, i) => ({ p: new Vector3(), to: new Vector3(), from: new Vector3(), t: 0, dur: 1, shell: 0, active: false, wait: i * 0.24 }));

  // ---- the sweep
  const uSweep = { value: 0 };
  const sweepHold = new Group();
  sweepHold.add(new Mesh(tor(SHELLS[0] + 1.2, 0.05, 6, 120, Math.PI).rotateZ(-Math.PI / 2), surface(shared, sun, { color: "#ffffff", glow: 2.8, uniforms: { uSweep }, fragHead: "uniform float uSweep;", frag: "glowCol = vec3(1.5, 2.6, 2.2); glow *= 1.0 + uSweep * 1.2;" })));
  sweepHold.rotation.z = 0.32;
  group.add(sweepHold);

  // ---- 15 ticks on the innermost net: the 15 seconds of retries
  const uTicks = { value: 0 };
  const tickItems: BeamItem[] = [];
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2;
    tickItems.push({ a: new Vector3(Math.cos(a) * 8.7, 0, Math.sin(a) * 8.7), b: new Vector3(Math.cos(a) * 10, 0, Math.sin(a) * 10), color: "#ffd9a8", i: 2.4, w: 0.06 });
  }
  const tickRing = beams(tickItems, shared, { head: "uniform float uTicks;", uniforms: { uTicks }, chunk: "i *= 0.7 + uTicks * 1.8;" });
  const tickHold = new Group();
  tickHold.rotation.set(0.5, 0, 0.3);
  tickHold.add(tickRing);
  group.add(tickHold);

  // ---- the log moon: a perfect dark, nothing on it
  const uLog = { value: 0 };
  const logMoon = new Group();
  logMoon.add(new Mesh(ball(2.3, 28, 20), surface(shared, sun, { color: "#010102", metal: 0, rough: 1, envI: 0 })));
  logMoon.add(new Mesh(tor(3.2, 0.03, 5, 64).rotateX(1.2), surface(shared, sun, { color: "#ffffff", glow: 1, uniforms: { uLog }, fragHead: "uniform float uLog;", frag: "glowCol = vec3(1.0, 1.4, 1.5); glow *= 0.8 + uLog * 3.0;" })));
  group.add(logMoon);

  // ---- 67 beads: the leads that got their missing fields
  const uLeads = { value: 0 };
  const leadHold = new Group();
  const leadMat = surface(shared, sun, { color: "#ffffff", data: true, seed: true, rough: 0.4, uniforms: { uLeads }, fragHead: "uniform float uLeads;", frag: "glowCol = vec3(2.2, 1.8, 1.0); glow = 0.56 + uLeads * 2.4;" });
  const leads = instanced(ball(0.2, 8, 6), leadMat, 67, (i, m) => {
    const col = i % 10;
    const row = Math.floor(i / 10);
    m.setPosition(col * 0.68 - 3.1, row * 0.68 - 2.2, 0);
  });
  const board = new Mesh(faceted(box(7.8, 5.8, 0.1)), surface(shared, sun, { color: "#272a30", metal: 0.7, rough: 0.4 }));
  board.position.z = -0.25;
  leadHold.add(board, leads);
  group.add(leadHold);
  const link = beams([{ a: new Vector3(0, 0, 0), b: new Vector3(1, 0, 0), color: "#ffd9a8", i: 0.7, w: 0.05 }], shared);
  void link;

  // ---- the cost: one small coin
  const uCoin = { value: 0 };
  const coin = new Group();
  coin.add(new Mesh(cyl(1.15, 1.15, 0.15, 28).rotateX(Math.PI / 2), surface(shared, sun, { color: "#dfe7df", metal: 0.92, rough: 0.26, uniforms: { uCoin }, fragHead: "uniform float uCoin;", frag: "glowCol = vec3(1.7, 2.3, 1.9); glow = uCoin * 2.0;" })));
  coin.add(glow("#c8ffe9", 3.6, { intensity: 0.26 }));
  group.add(coin);

  group.add(glow("#6fe0cf", 70, { intensity: 0.018, power: 3 }));

  const parts: Part[] = [
    { key: "retry", at: new Vector3(), r: 4 },
    { key: "logs", at: new Vector3(), r: 3.2 },
    { key: "leads", at: new Vector3(), r: 4 },
    { key: "cost", at: new Vector3(), r: 2.6 },
    { key: "nets", at: new Vector3(), r: 6 },
    { key: "sweep", at: new Vector3(), r: 5 },
  ];

  const yA = new Vector3(0, 1, 0);
  let hitIdx = [0, 0, 0];
  let holeT = 0;
  const tmp = new Vector3();
  const dir = new Vector3();
  const mt = new Matrix4();
  const hit = (shell: number, d: Vector3) => {
    const arr = hitUniforms[shell].value;
    arr[hitIdx[shell]].set(d.x, d.y, d.z, 0);
    hitIdx[shell] = (hitIdx[shell] + 1) % MAX_HITS;
  };
  const RFROM = new Vector3(-78, -10, -92);
  let aimT = 0;

  const launch = (s: Spark, aim: Vector3 | null) => {
    if (aim) s.to.copy(aim).normalize();
    else {
      // aim at the side the river comes from, with a spread
      s.to.set(-0.72 + (r() - 0.5) * 1.2, -0.1 + (r() - 0.5) * 1.2, -0.68 + (r() - 0.5) * 1.2).normalize();
    }
    s.from.copy(RFROM).addScaledVector(s.to, 24);
    s.from.x += (r() - 0.5) * 16;
    s.from.y += (r() - 0.5) * 16;
    s.shell = 0;
    s.t = 0;
    s.dur = 1.4 + r() * 0.9;
    s.active = true;
  };

  return {
    group,
    radius: 20,
    parts,
    update(c) {
      const dt = c.dt;
      const t = c.t;
      // from inside a net it would hide everything, so it dims
      const camR = c.cam.length();
      insideU.forEach((u, i) => {
        u.value = damp(u.value, camR < SHELLS[i] + 0.5 ? 1 : 0, 4, dt);
      });
      nets[0].rotation.y = t * 0.012;
      nets[1].rotation.y = -t * 0.018;
      nets[1].rotation.x = t * 0.008;
      nets[2].rotation.y = t * 0.03;
      core.rotation.set(t * 0.1, t * 0.16, t * 0.05);

      // an outage every so often: the outer net opens toward the river
      holeT += dt;
      const q = (holeT % 13) / 13;
      const open = q < 0.38 ? Math.sin((q / 0.38) * Math.PI) : 0;
      const hole = holeUniforms[0].value;
      // the hole is on a fixed world direction, the shell turns underneath it
      dir.set(-0.72, -0.1, -0.68).normalize().applyAxisAngle(yA, -nets[0].rotation.y);
      hole.set(dir.x, dir.y, dir.z, c.reduced ? 0 : open * 0.92 + c.heat[4] * 0.3);

      // age the ripples
      hitUniforms.forEach((u) => {
        u.value.forEach((h) => {
          if (h.w >= 0) {
            h.w += dt * 0.82;
            if (h.w > 1.2) h.w = -1;
          }
        });
      });

      // sparks
      aimT += dt;
      sparks.forEach((s, i) => {
        if (!s.active) {
          s.wait -= dt * (c.reduced ? 0.15 : 1);
          if (s.wait <= 0) launch(s, c.ptrOn > 0.3 && aimT > 0.18 ? ((aimT = 0), c.ptr) : null);
        }
        if (s.active) {
          s.t += dt / s.dur;
          const k = Math.min(1, s.t);
          const end = tmp.copy(s.to).multiplyScalar(SHELLS[s.shell]);
          s.p.lerpVectors(s.from, end, k * k * (1.8 - 0.8 * k));
          if (k >= 1) {
            // caught, unless this net has a hole here
            const dHole = s.shell === 0 ? Math.acos(Math.min(1, Math.max(-1, s.to.dot(dir.set(-0.72, -0.1, -0.68).normalize())))) : 9;
            const through = s.shell === 0 && dHole < hole.w;
            if (through) {
              s.from.copy(end);
              s.shell = 1;
              s.t = 0;
              s.dur = 0.35;
            } else {
              // ripple on the shell's own turning skin
              tmp.copy(s.to);
              if (s.shell === 0) tmp.applyAxisAngle(yA, -nets[0].rotation.y);
              else if (s.shell === 1) {
                tmp.applyAxisAngle(yA, nets[1].rotation.y * -1);
              }
              hit(s.shell, tmp);
              s.active = false;
              s.wait = 0.4 + r() * 2.2;
              s.p.set(0, 0, 0);
            }
          }
        }
        // draw it as a streak along its way
        if (s.active) {
          const to = tmp.copy(s.to).multiplyScalar(SHELLS[s.shell]).sub(s.p);
          const len = to.length();
          placeAlong(mt, s.p, to, 1, Math.min(6, 1.2 + len * 0.08), 1);
        } else mt.makeScale(0, 0, 0);
        streaks.setMatrixAt(i, mt);
      });
      streaks.instanceMatrix.needsUpdate = true;

      sweepHold.rotation.y = t * (c.reduced ? 0.1 : 0.5);
      uSweep.value = damp(uSweep.value, c.heat[5], 6, dt);
      uTicks.value = damp(uTicks.value, c.heat[0], 6, dt);
      uLog.value = damp(uLog.value, c.heat[1], 6, dt);
      uLeads.value = damp(uLeads.value, c.heat[2], 6, dt);
      uCoin.value = damp(uCoin.value, c.heat[3], 6, dt);
      heatUniforms.forEach((u, i) => {
        u.value = damp(u.value, c.heat[4] * (i === 0 ? 1 : 0.7), 5, dt);
      });
      uRiver.value = damp(uRiver.value, 0.42 + c.ptrOn * 0.34, 3, dt);
      river.visible = c.near > 0.001 || c.overview > 0.2;
      tickHold.rotation.y = t * 0.11;

      const la = t * 0.03 + 3.4;
      logMoon.position.set(Math.cos(la) * 27, 8, Math.sin(la) * 27);
      const ba = t * 0.018 + 0.5;
      leadHold.position.set(Math.cos(ba) * 26, -7, Math.sin(ba) * 26);
      leadHold.rotation.y = -ba + Math.PI / 2 + Math.PI;
      const ca = t * 0.04 + 5.2;
      coin.position.set(Math.cos(ca) * 23, 13, Math.sin(ca) * 23);
      coin.rotation.y = t * 0.34;

      parts[0].at.set(9.4, 0, 0).applyEuler(tickHold.rotation);
      parts[1].at.copy(logMoon.position);
      parts[2].at.copy(leadHold.position);
      parts[3].at.copy(coin.position);
      parts[4].at.set(-12, -1.5, -11.5);
      parts[5].at.set(0, SHELLS[0] + 1.2, 0).applyEuler(sweepHold.rotation);
    },
  };
};

void AdditiveBlending;
