// The belt at the edge of the system: thousands of rocks and a fine dust, and
// inside it the rest of the projects as small bodies you fly past, each shaped
// after what it does. Everything here is one group turning very slowly.

import { Group, Mesh, Vector3, ShaderMaterial, type BufferGeometry, type Matrix4 } from "three";
import {
  assemble,
  ball,
  beams,
  box,
  cone,
  cyl,
  damp,
  fibSphere,
  glow,
  ico,
  instanced,
  lerp,
  mat,
  pointCloud,
  pointsMaterial,
  rng,
  surface,
  tor,
  type Shared,
  type U,
} from "./toolkit";
import { BELT_INNER, BELT_OUTER, BELT_R, BELT_START, BELT_SWEEP } from "./path";

type Piece = { g: BufferGeometry; m?: Matrix4; d?: number[] };
const LIT = (i = 2.2): number[] => [1, 1, 1, i];
const DIM: number[] = [0.3, 0.32, 0.36, 0];

// Small bodies. Each is a picture of what the project does, kept to a few parts.
const SHAPES: Record<string, () => Piece[]> = {
  // up to 100 candidates reranked to 8 passages: a cloud of dots, 8 of them lit in a ring
  "enterprise-search": () => {
    const out: Piece[] = [];
    for (let i = 0; i < 100; i++) {
      const p = fibSphere(i, 100).multiplyScalar(4.2);
      out.push({ g: box(0.16, 0.16, 0.16), m: mat(p.x, p.y, p.z), d: DIM });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push({ g: box(0.62, 0.84, 0.08), m: mat(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0), d: LIT(1.8) });
    }
    return out;
  },
  // a moon being read, band by band
  "cbct-scan-validator": () => [{ g: ico(3.4, 3) }, { g: tor(4.5, 0.05, 6, 80), m: mat(0, 0, 0, 1.2, 0.2), d: LIT(1.8) }],
  // an ordered plan of visits: capsules in a chain, dates between them
  "treatment-sequence": () => {
    const out: Piece[] = [];
    for (let i = 0; i < 11; i++) {
      const x = (i - 5) * 1.12;
      const y = Math.sin(i * 0.7) * 1.3;
      out.push({ g: cyl(0.34, 0.34, 0.8, 10), m: mat(x, y, 0, 0, 0, Math.PI / 2), d: i === 4 ? LIT(2.2) : undefined });
      if (i < 10) out.push({ g: box(0.34, 0.05, 0.05), m: mat(x + 0.58, y + Math.cos(i * 0.7) * 0.32, 0, 0, 0, Math.cos(i * 0.7) * 0.7), d: LIT(1.2) });
    }
    return out;
  },
  // nine tabs over one snapshot: nine plates, one metric through them all
  "cowork-dashboard": () => {
    const out: Piece[] = [];
    for (let i = 0; i < 9; i++) out.push({ g: box(5 - i * 0.2, 0.09, 3.2), m: mat(0, (i - 4) * 0.5, 0, 0, i * 0.07), d: i === 3 ? LIT(1.4) : undefined });
    out.push({ g: cyl(0.05, 0.05, 5, 6), m: mat(0.8, 0, 0.5), d: LIT(3) });
    return out;
  },
  // a dish with a sweep: a radar on default risk
  "loan-radar": () => [
    { g: cone(2.8, 1.4, 22).rotateX(Math.PI), m: mat(0, 0.6) },
    { g: cyl(0.06, 0.06, 2.8, 6), m: mat(0, 1.8, 0), d: LIT(1.4) },
    { g: ball(0.28, 10, 8), m: mat(0, 3.1, 0), d: LIT(3) },
    { g: tor(3.4, 0.04, 5, 60).rotateX(Math.PI / 2), m: mat(0, -0.2), d: LIT(1.1) },
  ],
  // an argument: two cones point to point, one judged better
  "teaching-llama-to-argue-better": () => [
    { g: cone(1.6, 3.6, 10), m: mat(-1.9, 0, 0, 0, 0, -Math.PI / 2), d: LIT(0.5) },
    { g: cone(1.6, 3.6, 10), m: mat(1.9, 0, 0, 0, 0, Math.PI / 2) },
    { g: tor(2.6, 0.04, 5, 48).rotateY(Math.PI / 2), m: mat(0), d: LIT(1.6) },
  ],
  // two systems checked against each other, only the ones that disagree stand out
  reconciliation: () => {
    const out: Piece[] = [];
    for (let i = 0; i < 24; i++) {
      const y = 2.6 - (i % 8) * 0.74;
      const c = Math.floor(i / 8);
      const off = i === 13 || i === 6;
      out.push({ g: box(1.1, 0.5, 0.5), m: mat(-1.45 + c * 1.45, y, off ? 0.8 : 0), d: off ? LIT(3) : undefined });
    }
    return out;
  },
  // a forecast three months out, widening: a fan of plates
  "daily-sales-report": () => {
    const out: Piece[] = [];
    for (let i = 0; i < 3; i++) {
      out.push({ g: box(1.6, 0.8 + i * 1.3, 0.14), m: mat((i - 1) * 2.2, i * 0.72, 0), d: i === 0 ? LIT(1.4) : undefined });
      out.push({ g: box(1.6, 0.05, 0.16), m: mat((i - 1) * 2.2, i * 0.72 + 0.4 + i * 0.65, 0), d: LIT(2.4) });
    }
    return out;
  },
  // ten sources in one warehouse: ten thin discs in a stack
  "marketing-data-warehouse": () => {
    const out: Piece[] = [];
    for (let i = 0; i < 10; i++) out.push({ g: cyl(2.8, 2.8, 0.24, 26), m: mat(0, (i - 4.5) * 0.46, 0), d: i % 3 === 0 ? LIT(0.7) : undefined });
    return out;
  },
  // 13 boxes an owner ticks
  "marketing-data-connector": () => {
    const out: Piece[] = [];
    for (let i = 0; i < 13; i++) {
      const c = i % 5;
      const r = Math.floor(i / 5);
      out.push({ g: box(0.84, 0.84, 0.22), m: mat((c - 2) * 1.06, (1 - r) * 1.06, 0), d: i % 3 !== 1 ? LIT(1.1) : DIM });
    }
    return out;
  },
  // one key holder: a single ring with a single key
  "denticon-sync": () => [
    { g: tor(2.5, 0.42, 10, 40) },
    { g: box(0.42, 3, 0.42), m: mat(0, -3.5), d: LIT(1.2) },
    { g: box(1, 0.4, 0.4), m: mat(0.68, -4.6), d: LIT(1.2) },
    { g: box(0.8, 0.4, 0.4), m: mat(0.6, -3.9), d: LIT(1.2) },
  ],
  // five read only routes out of one hub
  "cdf-registry": () => {
    const out: Piece[] = [{ g: ico(1.5, 1) }];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      out.push({ g: cyl(0.1, 0.1, 3, 6), m: mat(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0, 0, 0, a - Math.PI / 2), d: LIT(1.3) });
      out.push({ g: box(0.74, 0.74, 0.74), m: mat(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0) });
    }
    return out;
  },
  // two pages coming off one press
  "pdf-renderer": () => [
    { g: box(2.8, 3.9, 0.07), m: mat(-1.2, 0, 0, 0.1, 0.5, 0.06), d: LIT(0.6) },
    { g: box(2.8, 3.9, 0.07), m: mat(1.2, 0.4, 0.5, -0.1, -0.5, -0.08), d: LIT(0.25) },
    { g: cyl(0.26, 0.26, 7.6, 12), m: mat(0, -2.4, 0, 0, 0, Math.PI / 2) },
  ],
  // a tweet is true, false or opinion: a sphere cut in three
  "fake-news-and-sentiment-analysis": () => [
    { g: ball(2.8, 22, 16), m: mat(0, 0.34, 0, 0, 0, 0, 1, 0.44, 1) },
    { g: ball(2.8, 22, 16), m: mat(0, -2.1, 0, 0, 0, 0, 1, 0.44, 1), d: LIT(0.6) },
    { g: ball(2.8, 22, 16), m: mat(0, 2.8, 0, 0, 0, 0, 1, 0.44, 1), d: DIM },
  ],
  // residual blocks with a skip over them
  "resnet-under-5m-parameters": () => {
    const out: Piece[] = [];
    for (let i = 0; i < 7; i++) out.push({ g: box(0.34, 3, 3), m: mat((i - 3) * 0.9, 0, 0) });
    for (let i = 0; i < 3; i++) out.push({ g: tor(1.2, 0.05, 5, 24, Math.PI), m: mat(-1.8 + i * 1.8, 1.5, 0), d: LIT(2.4) });
    return out;
  },
  // movie twins among 330,975 users: two lit dots in a cloud
  "customer-segmentation-and-recommendation-system": () => {
    const out: Piece[] = [];
    for (let i = 0; i < 90; i++) {
      const p = fibSphere(i, 90).multiplyScalar(2.8 + ((i * 7) % 10) * 0.16);
      out.push({ g: ico(0.12, 0), m: mat(p.x, p.y, p.z), d: DIM });
    }
    out.push({ g: ball(0.5, 12, 8), m: mat(-0.7, 0.3, 0), d: LIT(3) });
    out.push({ g: ball(0.5, 12, 8), m: mat(0.7, -0.2, 0), d: LIT(3) });
    return out;
  },
  // team automations on one platform: nodes linked into one graph
  "enterprise-data-project": () => {
    const out: Piece[] = [];
    const pts = [
      [-3, 0.6, 0],
      [-1, -1.4, 0.6],
      [0.8, 1.2, -0.4],
      [2.8, -0.4, 0.3],
    ];
    pts.forEach(([x, y, z]) => out.push({ g: box(1, 1, 1), m: mat(x, y, z) }));
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      out.push({ g: cyl(0.04, 0.04, len, 5), m: mat((ax + bx) / 2, (ay + by) / 2, 0, 0, 0, Math.atan2(by - ay, bx - ax) - Math.PI / 2), d: LIT(1.8) });
    }
    return out;
  },
  // two cases that are one case: parked, so quiet
  "case-intake": () => [{ g: box(2.5, 3.2, 0.4), m: mat(-0.5, 0, 0), d: DIM }, { g: box(2.5, 3.2, 0.4), m: mat(0.5, 0.3, 0.8), d: DIM }, { g: tor(2.9, 0.03, 5, 60), m: mat(0, 0, 0.4), d: LIT(0.5) }],
  // a door with five tabs: Submit Rx, Cases, Accounting, Resources, Account
  "doctor-portal": () => {
    const out: Piece[] = [
      { g: box(0.4, 6.4, 0.5), m: mat(-2.3) },
      { g: box(0.4, 6.4, 0.5), m: mat(2.3) },
      { g: box(5, 0.4, 0.5), m: mat(0, 3.2) },
    ];
    for (let i = 0; i < 5; i++) out.push({ g: box(0.7, 0.14, 0.1), m: mat((i - 2) * 0.82, 2.5), d: LIT(1.7) });
    return out;
  },
  // 38 projects on one board, 22 of them live
  launchpad: () => {
    const out: Piece[] = [];
    for (let i = 0; i < 38; i++) {
      const c = i % 7;
      const r = Math.floor(i / 7);
      out.push({ g: box(0.66, 0.66, 0.24), m: mat((c - 3) * 0.86, (2.5 - r) * 0.86, 0), d: i < 22 ? LIT(1.3) : DIM });
    }
    return out;
  },
  // six apps, one relay
  "feature-requests-relay": () => {
    const out: Piece[] = [{ g: ball(1.2, 16, 12), d: LIT(0.9) }];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push({ g: cyl(0.04, 0.04, 3, 5), m: mat(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0, 0, 0, a - Math.PI / 2), d: LIT(1.8) });
      out.push({ g: box(0.9, 0.9, 0.9), m: mat(Math.cos(a) * 4, Math.sin(a) * 4, 0) });
    }
    return out;
  },
  // two sites: two screens, side by side
  "hybridge-websites": () => [
    { g: box(3.2, 5.2, 0.14), m: mat(-1.8, 0, 0, 0, 0.3), d: LIT(0.25) },
    { g: box(3.2, 5.2, 0.14), m: mat(1.8, 0.5, -0.6, 0, -0.3), d: LIT(0.25) },
    { g: box(2.5, 1.2, 0.05), m: mat(-1.8, 1.4, 0.16, 0, 0.3), d: LIT(1.1) },
    { g: box(2.5, 1.2, 0.05), m: mat(1.8, 1.9, -0.44, 0, -0.3), d: LIT(1.1) },
  ],
};

export function buildBelt(shared: Shared, ids: string[]) {
  const group = new Group();
  const sweepers: Group[] = [];
  const r = rng(909);
  const sun: U<Vector3> = { value: new Vector3(0, 0, 1) };

  // ---- rocks
  const rockMat = surface(shared, sun, {
    color: "#6a6661",
    metal: 0.1,
    rough: 0.72,
    flat: true,
    data: true,
    seed: true,
    head: /* glsl */ `
    vec3 spinAround(vec3 v, vec3 ax, float a) { float c = cos(a); float s_ = sin(a); return v * c + cross(ax, v) * s_ + ax * dot(ax, v) * (1.0 - c); }`,
    vertex: /* glsl */ `
    float wob = sin(p.x * 3.1 + s * 40.0) * sin(p.y * 2.7 + s * 17.0) * sin(p.z * 3.3 + s * 29.0);
    float wob2 = sin(p.x * 9.0 + s * 21.0) * sin(p.y * 8.0 + s * 57.0) * sin(p.z * 7.0 + s * 13.0);
    p *= 1.0 + wob * 0.46 + wob2 * 0.12;
    p.y *= 0.62 + s * 0.6;
    p.x *= 0.8 + fract(s * 3.0) * 0.5;
    vec3 axis = normalize(vec3(s - 0.5, fract(s * 7.0) - 0.5, fract(s * 13.0) - 0.5));
    p = spinAround(p, axis, uTime * (0.03 + s * 0.11) + s * 20.0);
    `,
  });
  const rockN = Math.round(shared.low ? 1100 : 3600);
  const rocks = instanced(ico(1, shared.low ? 1 : 2), rockMat, rockN, (i, m, d) => {
    const a = r() * Math.PI * 2;
    let rad = lerp(BELT_INNER, BELT_OUTER, (r() + r()) / 2);
    let y = (r() + r() + r() - 1.5) * 34;
    const size = 0.26 + Math.pow(r(), 5.5) * 5.4;
    // the corridor the tour flies down stays clear of anything big
    const wrap = Math.PI * 2 * Math.floor((BELT_START - 0.12) / (Math.PI * 2));
    const inSweep = a > BELT_START - 0.12 - wrap && a < BELT_START + BELT_SWEEP * 1.14 - wrap;
    if (inSweep && size > 0.5 && Math.abs(rad - BELT_R) < 32 && Math.abs(y) < 22) {
      rad = BELT_R + Math.sign(rad - BELT_R || 1) * (32 + r() * 34);
    }
    m.makeScale(size, size, size);
    m.setPosition(Math.cos(a) * rad, y, Math.sin(a) * rad);
    const tone = 0.22 + r() * 0.6;
    d[0] = tone * (0.9 + r() * 0.22);
    d[1] = tone * 0.92;
    d[2] = tone * (0.86 + r() * 0.1);
    // a rock's sun depends on where it is; good enough to light from the star's side via uSun per frame
  });
  group.add(rocks);

  // ---- a few big dark rocks right by the lens of the first shot, in its corners
  if (!shared.low) {
    const cam = new Vector3(0, 340, 985);
    const f = new Vector3(0, 22, 66).sub(cam).normalize();
    const rt = new Vector3(1, 0, 0);
    const upc = new Vector3().crossVectors(rt, f).normalize();
    // distance along the view, sideways, up, size
    const near: [number, number, number, number][] = [
      [150, -70, -32, 15],
      [186, 92, -44, 22],
      [236, -116, 60, 15],
      [132, 58, 37, 5],
      [310, 148, 78, 26],
      [262, -142, -70, 25],
      [212, -104, -8, 3.6],
      [168, 84, 12, 2.8],
      [246, 124, -8, 5],
    ];
    const fore = instanced(ico(1, 2), rockMat, near.length, (i, m, d) => {
      const [dd, x, y, sz] = near[i];
      const p = cam.clone().addScaledVector(f, dd).addScaledVector(rt, x).addScaledVector(upc, -y);
      m.makeScale(sz, sz, sz);
      m.setPosition(p);
      d[0] = d[1] = d[2] = 0.72;
    });
    group.add(fore);
  }

  // ---- dust
  const n = shared.low ? 5000 : 15000;
  const pos = new Float32Array(n * 3);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ang = r() * Math.PI * 2;
    const rad = lerp(BELT_INNER - 30, BELT_OUTER + 30, (r() + r() + r()) / 3);
    pos.set([Math.cos(ang) * rad, (r() + r() - 1) * 30, Math.sin(ang) * rad], i * 3);
    a[i] = r();
  }
  const dustMat = pointsMaterial(shared, {
    head: "attribute float aS;",
    maxSize: 6,
    vertex: /* glsl */ `
    col = mix(vec3(0.46, 0.5, 0.6), vec3(0.76, 0.84, 1.1), aS);
    size = 0.2 + aS * 0.3;
    a = 0.13 * (0.4 + aS);
    `,
  });
  group.add(pointCloud(pos, { aS: [a, 1] }, dustMat));

  // ---- the named bodies
  const bodyMat = surface(shared, sun, {
    color: "#e4e8ef",
    metal: 0.3,
    rough: 0.32,
    data: true,
    frag: "glowCol = vec3(0.95, 1.3, 2.3);",
  });
  type Body = { id: string; hold: Group; world: Vector3; radius: number; spin: number; heat: number; halo: Mesh };
  const bodies: Body[] = [];
  // left and right of the lane, high and low, so each passes on its own
  const sides = [
    [13, 6.5],
    [-14, -7],
    [12, -8],
    [-13, 8],
    [15, 2.5],
    [-15, -3],
    [12.5, 8],
    [-12.5, -8],
  ];
  ids.forEach((id, i) => {
    const shape = SHAPES[id];
    if (!shape) return;
    const hold = new Group();
    const t = (i + 0.5) / ids.length;
    const ang = BELT_START + (0.03 + t * 0.92) * BELT_SWEEP * 1.05;
    const [dr, y] = sides[i % sides.length];
    hold.position.set(Math.cos(ang) * (BELT_R + dr), y, Math.sin(ang) * (BELT_R + dr));
    hold.rotation.set(r() * 0.5, r() * 6, r() * 0.5);
    const geo = assemble(shape());
    const mesh = new Mesh(geo, bodyMat);
    mesh.frustumCulled = false;
    hold.add(mesh);
    const halo = glow("#9cbcff", 18, { intensity: 0.1, power: 2.7 });
    hold.add(halo);
    if (id === "cbct-scan-validator") {
      // a blade of light goes over this moon, again and again
      const blade = beams([{ a: new Vector3(-5.6, 0, 0), b: new Vector3(5.6, 0, 0), color: "#dff0ff", i: 2.2, w: 0.09 }], shared, {
        chunk: "i *= 1.0 - abs(2.0 * t - 1.0) * 0.3;",
      });
      const sweep = new Group();
      sweep.add(blade);
      hold.add(sweep);
      sweepers.push(sweep);
    }
    group.add(hold);
    bodies.push({ id, hold, world: new Vector3(), radius: 5.5, spin: 0.04 + r() * 0.09, heat: 0, halo });
  });

  // two lines of small lights mark the lane
  {
    const lamps = 150;
    const lp = new Float32Array(lamps * 2 * 3);
    const la = new Float32Array(lamps * 2);
    for (let i = 0; i < lamps; i++) {
      const ang = BELT_START - 0.05 + (i / lamps) * BELT_SWEEP * 1.22;
      [-20, 20].forEach((off, k) => {
        lp.set([Math.cos(ang) * (BELT_R + off), -4.5, Math.sin(ang) * (BELT_R + off)], (i * 2 + k) * 3);
        la[i * 2 + k] = i;
      });
    }
    const lampMat = pointsMaterial(shared, {
      head: "attribute float aI;",
      maxSize: 7,
      vertex: /* glsl */ `
      // a pulse runs down the lane, the way the tour is going
      float p = fract(aI / 150.0 * 6.0 - uTime * 0.16);
      col = mix(vec3(0.22, 0.42, 1.0), vec3(1.5, 2.1, 3.4), pow(p, 12.0));
      size = 0.3;
      a = 1.4;
      `,
    });
    group.add(pointCloud(lp, { aI: [la, 1] }, lampMat));
  }

  const sunV = new Vector3();
  return {
    group,
    bodies,
    setAngle(a2: number) {
      group.rotation.y = -a2;
    },
    update(t: number, dt: number, cam: Vector3, hot: number) {
      // the belt's light always comes from the star; each rock takes the mean
      sunV.copy(cam).setY(0).negate().normalize();
      sun.value.copy(sunV);
      sweepers.forEach((s) => {
        s.position.y = Math.sin(t * 0.8) * 3.6;
        s.rotation.y = t * 0.2;
      });
      bodies.forEach((b, i) => {
        b.hold.rotation.y += dt * b.spin * (hot === i ? 3 : 1);
        b.heat = damp(b.heat, hot === i ? 1 : 0, 6, dt);
        const m = b.halo.material as ShaderMaterial;
        m.uniforms.uI.value = 0.1 + b.heat * 0.5;
        b.world.copy(b.hold.position).applyAxisAngle(yAxis, group.rotation.y);
      });
    },
  };
}

const yAxis = new Vector3(0, 1, 0);
