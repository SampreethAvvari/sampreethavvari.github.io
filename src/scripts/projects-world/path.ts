// Where everything is, and where the camera goes.
//
// The worlds really orbit, so nothing here is a fixed position. A camera key is
// written relative to its world in a frame that turns with the world's orbit:
// a is sideways along the orbit, b is up, c is outward from the star (so a
// negative c stands on the world's lit side). Every frame the keys become
// positions and a centripetal Catmull-Rom spline runs through them.
//
// The scroll runs in stage units: 0 to 1 is the whole system, 1 to 9 the eight
// worlds, 9 to 10 the belt. Inside a world, s = 0.30 is the first shot and
// s = 0.70 the second, with a slow drift between them. The stretch from one
// world's departure to the next one's arrival is the sling.

import { Vector3 } from "three";
import { clamp, lerp } from "./toolkit";

export interface Orbit {
  /** Semi major axis. */
  a: number;
  /** Eccentricity, with the star at one focus. */
  e: number;
  /** Angle at load. */
  phase: number;
  /** Tilt of the orbit's plane, and which way it tilts. */
  tilt: number;
  node: number;
  /** Angular speed multiplier. */
  speed: number;
}

// Set so the first screen opens with the worlds spread through its depth.
export const ORBITS: Orbit[] = [
  { a: 118, e: 0.0, phase: 1.72, tilt: 0.02, node: 0, speed: 1 }, // mirror
  { a: 172, e: 0.02, phase: -0.34, tilt: 0.03, node: 1, speed: 1 }, // ring
  { a: 226, e: 0.0, phase: 2.98, tilt: 0.015, node: 2, speed: 1 }, // listener
  { a: 288, e: 0.03, phase: 3.84, tilt: 0.05, node: 3, speed: 1 }, // disk
  { a: 346, e: 0.02, phase: 5.72, tilt: 0.02, node: 4, speed: 1 }, // geode
  { a: 402, e: 0.01, phase: 3.27, tilt: 0.03, node: 5, speed: 1 }, // arch
  { a: 462, e: 0.03, phase: 4.98, tilt: 0.02, node: 0.5, speed: 1 }, // nets
  { a: 440, e: 0.38, phase: 4.36, tilt: 0.2, node: 2.4, speed: 1.1 }, // comet
];
export const BELT_INNER = 540;
export const BELT_OUTER = 640;
export const BELT_R = 590;
/** Where along the belt the tour passes, in radians at load. */
export const BELT_START = 4.9;
export const BELT_SWEEP = 0.86;

const tv = new Vector3();
/** A point on an orbit at true anomaly `th`. */
export function orbitAt(o: Orbit, th: number, out = new Vector3()): Vector3 {
  const r = (o.a * (1 - o.e * o.e)) / (1 + o.e * Math.cos(th));
  out.set(Math.cos(th) * r, 0, Math.sin(th) * r);
  if (o.tilt) {
    // tip around the node line
    const c = Math.cos(o.tilt);
    const s = Math.sin(o.tilt);
    const nx = Math.cos(o.node);
    const nz = Math.sin(o.node);
    const along = out.x * nx + out.z * nz;
    tv.set(out.x - along * nx, 0, out.z - along * nz); // perpendicular part
    const len = tv.length();
    if (len > 1e-5) {
      tv.multiplyScalar(1 / len);
      const side = Math.sign(out.x * -nz + out.z * nx) || 1;
      out.set(along * nx + tv.x * len * c, side * len * s, along * nz + tv.z * len * c);
    }
  }
  return out;
}

export function angularSpeed(o: Orbit): number {
  // Kepler, then speeded up: nobody watches a page for a real year.
  return (o.speed * 3.1) / Math.pow(o.a, 1.15);
}

// ---------------------------------------------------------------- keys

export type V3 = [number, number, number];
export interface Key {
  s: number;
  /** a, b, c relative to the stage's body (or absolute for system and belt keys). */
  pos: V3;
  look?: V3;
  fov: number;
  roll?: number;
  /** Where the subject sits on screen, in fractions of the screen (+x right, +y up). */
  shift?: [number, number];
  /** On a phone: its own framing. */
  ps?: [number, number];
  ppos?: V3;
  plook?: V3;
  pfov?: number;
}

export interface Stage {
  id: string;
  /** Screens of scroll for this stage. */
  span: number;
  keys: Key[];
}

const K = (s: number, pos: V3, fov: number, more: Partial<Key> = {}): Key => ({ s, pos, fov, ...more });

// The shots. World radii are in the world files. Text on the page is placed
// against these: the subject's side of the screen is set by `shift`.
export const STAGES: Stage[] = [
  {
    id: "system",
    span: 2.1,
    keys: [
      K(0, [0, 340, 985], 31, { look: [0, 22, 66], roll: -0.03, ppos: [-40, 900, 1420], plook: [0, -40, 20], ps: [0, -0.09], pfov: 33 }),
      K(0.45, [-40, 280, 820], 31, { look: [10, 6, 40], roll: -0.05, ppos: [-60, 720, 1150], plook: [0, -30, 0], ps: [0, -0.06], pfov: 33 }),
    ],
  },
  // 1 Patient Dashboard: dead level with the mirror, then up over it
  {
    id: "mirror",
    span: 3.6,
    keys: [
      K(0.14, [-120, 26, -46], 30, { look: [0, 0, 0], roll: 0.04, ppos: [-210, 30, -40], ps: [0, 0.12], pfov: 32 }),
      K(0.3, [-112, 0.14, -8], 25, { look: [0, 0, 0], ppos: [-182, 2, -14], ps: [0, 0.2], pfov: 30 }),
      K(0.5, [-92, 14, -30], 27, { look: [0, 0, 0], ppos: [-170, 34, -28], ps: [0, 0.18], pfov: 30 }),
      K(0.7, [-66, 44, -46], 31, { look: [0, -1, 0], roll: -0.05, shift: [0, 0.02], ppos: [-128, 84, -48], ps: [0, 0.17], pfov: 32 }),
      K(0.86, [-92, 44, 10], 34, { look: [0, 0, 0], roll: -0.08, ppos: [-150, 70, 20], ps: [0, 0.1], pfov: 34 }),
    ],
  },
  // 2 Capacity Planner: inside the ring under its arch, then out to see all of it
  {
    id: "ring",
    span: 3.6,
    keys: [
      K(0.14, [36, 44, -68], 36, { look: [0, 0, 0], roll: 0.12, ppos: [90, 70, -130], ps: [0, 0.1] }),
      K(0.3, [11.5, -9.5, -7], 62, { look: [-11, 10, -5], roll: 0.2, shift: [0.17, 0.05], ppos: [72, -26, -86], plook: [0, 6, 0], ps: [0, 0.24], pfov: 36 }),
      K(0.5, [10, -2, -30], 44, { look: [-2, 3, -3], roll: 0.1, ppos: [30, 10, -62], ps: [0, 0.16], pfov: 46 }),
      K(0.7, [42, 21, -50], 30, { look: [0, -2, 0], roll: -0.12, shift: [0, 0.07], ppos: [112, 50, -142], ps: [0, 0.17] }),
      K(0.86, [66, 22, -6], 34, { look: [0, 0, 0], roll: -0.16, ppos: [130, 50, -30], ps: [0, 0.1] }),
    ],
  },
  // 3 Doc Coach: over its horizon with the star coming up, then the whole instrument to one side
  {
    id: "listener",
    span: 3.6,
    keys: [
      K(0.14, [-40, 26, -46], 34, { look: [0, 0, 0], roll: -0.08, ppos: [-80, 40, -90], ps: [0, 0.1] }),
      K(0.3, [1, 16, 1.5], 56, { look: [-12.2, 5.7, -23.4], roll: 0.02, ppos: [0.6, 15.6, 1.8], plook: [-16, 2.2, -24], ps: [0, 0], pfov: 66 }),
      K(0.5, [-16, 18, -24], 40, { look: [-1, 3, -6], roll: -0.08, ppos: [-20, 40, -56], ps: [0, 0.14] }),
      K(0.7, [-30, 7, -47], 28, { look: [0, 0, 0], roll: 0.1, shift: [0.18, 0], ppos: [-52, 12, -84], ps: [0, 0.17], pfov: 30 }),
      K(0.86, [-52, -14, -32], 32, { look: [0, 0, 0], roll: 0.14, ppos: [-96, -20, -50], ps: [0, 0.1] }),
    ],
  },
  // 4 NPC Coach: skimming the disk on a slant, then straight down the funnel
  {
    id: "disk",
    span: 3.6,
    keys: [
      K(0.14, [64, 24, -74], 34, { look: [0, 0, 0], roll: -0.2, ppos: [100, 40, -130], ps: [0, 0.12] }),
      K(0.3, [34, 4.8, -48], 32, { look: [2, -1, 0], roll: -0.3, shift: [0.05, 0.06], ppos: [66, 9, -96], ps: [0.02, 0.2], pfov: 34 }),
      K(0.5, [22, 26, -40], 36, { look: [0, 0, 0], roll: -0.18, ppos: [40, 50, -84], ps: [0, 0.18] }),
      K(0.7, [2.5, 66, -7], 36, { look: [0, 0, 0], roll: 0.4, ppos: [4, 122, -14], ps: [0, 0.16] }),
      K(0.86, [-46, 42, 30], 36, { look: [0, 0, 0], roll: 0.22, ppos: [-74, 78, 50], ps: [0, 0.1] }),
    ],
  },
  // 5 Treatment Estimator: the crystal whole, then from inside its shell
  {
    id: "geode",
    span: 3.6,
    keys: [
      K(0.14, [-48, 22, -52], 30, { look: [0, 0, 0], roll: 0.1, ppos: [-74, 34, -90], ps: [0, 0.12] }),
      K(0.3, [-15, 5, -58], 26, { look: [0, 0, 0], roll: 0.06, shift: [0.23, -0.01], ppos: [-20, 6, -84], ps: [0, 0.22], pfov: 28 }),
      K(0.5, [-7, 2, -26], 40, { look: [0, 0, 0], roll: 0.02, shift: [0.05, 0], ppos: [-12, 4, -50], ps: [0, 0.18] }),
      K(0.7, [3.2, -2.6, -7.6], 58, { look: [-1, 0.2, 2], roll: -0.05, ppos: [3, -2.4, -8.4], ps: [0, 0.14], pfov: 72 }),
      K(0.86, [16, 26, -24], 44, { look: [0, 0, 0], roll: -0.14, ppos: [26, 44, -44], ps: [0, 0.1] }),
    ],
  },
  // 6 Centralized Diagnostic Filter: straight down on the arch, then down among the stones
  {
    id: "arch",
    span: 3.6,
    keys: [
      K(0.14, [-40, 96, -22], 30, { look: [0, 0, 0], roll: 0.2, ppos: [-60, 190, -30], ps: [0, 0.1] }),
      K(0.3, [0, 128, 7], 30, { look: [0, 0, -1], roll: 0, shift: [0, -0.05], ppos: [0, 306, 14], plook: [0, 0, -2], ps: [0, 0.2], pfov: 30 }),
      K(0.5, [12, 58, 26], 36, { look: [0, 0, 2], roll: 0.1, ppos: [14, 104, 38], ps: [0, 0.16] }),
      K(0.7, [24, 2.4, 20], 44, { look: [-6, 5, -10], roll: -0.04, shift: [-0.14, 0], ppos: [30, 3.4, 34], plook: [-8, 5, -8], ps: [0, 0.14], pfov: 58 }),
      K(0.86, [44, 18, 34], 38, { look: [0, 2, 0], roll: -0.12, ppos: [64, 30, 54], ps: [0, 0.1] }),
    ],
  },
  // 7 Hybridge Forms: far back along the river, then inside the outer net
  {
    id: "nets",
    span: 3.6,
    keys: [
      K(0.14, [-150, -40, -44], 34, { look: [-30, -6, -6], roll: 0.1, ppos: [-150, -30, -130], ps: [0, 0.1] }),
      K(0.3, [-118, -30, -6], 30, { look: [-30, -10, -14], roll: 0.12, shift: [0.12, 0.05], ppos: [-120, -40, -100], plook: [-14, -6, -8], ps: [0.1, 0.22] }),
      K(0.5, [-52, -8, -26], 34, { look: [0, 0, 0], roll: 0.08, ppos: [-62, -12, -56], ps: [0, 0.16] }),
      K(0.7, [-6, 3, -14.2], 60, { look: [0, 0, 0], roll: -0.03, ppos: [-7, 3.4, -15.2], ps: [0, 0.14], pfov: 74 }),
      K(0.86, [18, 24, -30], 44, { look: [0, 0, 0], roll: -0.12, ppos: [30, 40, -50], ps: [0, 0.1] }),
    ],
  },
  // 8 JobPilot: side on with the head right and the tail across the frame, then head on
  {
    id: "comet",
    span: 3.6,
    keys: [
      K(0.14, [70, 24, -34], 36, { look: [0, 0, 16], roll: -0.08, ppos: [100, 30, -40], ps: [0, 0.04] }),
      K(0.3, [37, 4, 6], 40, { look: [0, 0, 18], roll: -0.1, shift: [0.2, -0.05], ppos: [66, 8, -4], plook: [0, 0, 24], ps: [0.06, -0.1] }),
      K(0.5, [26, 10, -22], 42, { look: [0, 0, 8], roll: -0.04, ppos: [40, 16, -34], ps: [0, 0.12] }),
      K(0.7, [0, 1.8, -30], 36, { look: [0, 0, 0], roll: 0.06, shift: [0.2, 0], ppos: [0, 2, -60], ps: [0, 0.16] }),
      K(0.86, [-26, 16, -30], 40, { look: [0, 0, 20], roll: 0.12, ppos: [-40, 24, -46], ps: [0, 0.1] }),
    ],
  },
  // 9 The belt: a is the fraction of the sweep, b height, c offset from the belt's middle
  {
    id: "belt",
    span: 8.5,
    keys: [
      K(0.07, [-0.03, 12, -4], 46, { look: [0.05, 1, 0], roll: 0.06 }),
      K(0.3, [0.26, 0.5, -1], 56, { look: [0.33, 1.5, 0], roll: -0.12 }),
      K(0.52, [0.54, -1.5, 1.5], 56, { look: [0.61, 0, 0], roll: 0.14 }),
      K(0.74, [0.82, 1, -1], 54, { look: [0.89, -0.5, 0], roll: -0.13 }),
      K(0.97, [1.1, 96, 66], 44, { look: [0.76, -10, -130], roll: 0, ps: [0, 0.04] }),
    ],
  },
];

export const STAGE_COUNT = STAGES.length;

// ---------------------------------------------------------------- monotone cubic

/** Fritsch-Carlson: smooth through the points, never overshooting them. */
export class Mono {
  private readonly m: number[] = [];
  constructor(private readonly xs: number[], private readonly ys: number[]) {
    const n = xs.length;
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    this.m = new Array(n).fill(0);
    this.m[0] = d[0] ?? 0;
    this.m[n - 1] = d[n - 2] ?? 0;
    for (let i = 1; i < n - 1; i++) this.m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        this.m[i] = this.m[i + 1] = 0;
        continue;
      }
      const a = this.m[i] / d[i];
      const b = this.m[i + 1] / d[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        this.m[i] = t * a * d[i];
        this.m[i + 1] = t * b * d[i];
      }
    }
  }
  at(x: number): number {
    const { xs, ys, m } = this;
    const n = xs.length;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    const h = xs[hi] - xs[lo];
    const t = (x - xs[lo]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  }
}

// ---------------------------------------------------------------- spline

/** Centripetal Catmull-Rom through four points. */
function crPoint(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, w: number, out: Vector3) {
  const d = (a: Vector3, b: Vector3) => Math.max(1e-3, Math.pow(a.distanceToSquared(b), 0.25));
  const t0 = 0;
  const t1 = t0 + d(p0, p1);
  const t2 = t1 + d(p1, p2);
  const t3 = t2 + d(p2, p3);
  const t = t1 + (t2 - t1) * w;
  const mix = (a: number, b: number, c: number, ta: number, tb: number) => ((tb - c) / (tb - ta)) * a + ((c - ta) / (tb - ta)) * b;
  for (const k of ["x", "y", "z"] as const) {
    const A1 = mix(p0[k], p1[k], t, t0, t1);
    const A2 = mix(p1[k], p2[k], t, t1, t2);
    const A3 = mix(p2[k], p3[k], t, t2, t3);
    const B1 = mix(A1, A2, t, t0, t2);
    const B2 = mix(A2, A3, t, t1, t3);
    out[k] = mix(B1, B2, t, t1, t2);
  }
  return out;
}

export interface FlatKey {
  g: number;
  stage: number;
  key: Key | null; // null: a sling point between two worlds
}

export interface PathState {
  pos: Vector3;
  look: Vector3;
  fov: number;
  roll: number;
  sx: number;
  sy: number;
}

/**
 * The whole path. `bodyAt(stage, out)` gives where a world is right now and
 * `solve` turns the scroll position into a camera, recomputing the keys it
 * needs from the live positions.
 */
export class CameraPath {
  private readonly keys: FlatKey[] = [];
  private readonly gToU: Mono;
  private readonly fov: Mono;
  private readonly roll: Mono;
  private readonly sx: Mono;
  private readonly sy: Mono;
  private readonly side = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly out = new Vector3();
  private readonly at = new Vector3();
  private readonly at2 = new Vector3();
  private readonly pts: Vector3[] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  private readonly lks: Vector3[] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];

  constructor(
    private readonly bodyAt: (stage: number, out: Vector3) => Vector3,
    private readonly beltAngle: () => number,
    private readonly phone: boolean,
  ) {
    STAGES.forEach((st, i) => {
      st.keys.forEach((k) => this.keys.push({ g: i + k.s, stage: i, key: k }));
      if (i >= 1 && i < STAGES.length - 1) {
        this.keys.push({ g: i + 1, stage: i, key: null }); // the sling to the next world
      }
    });
    const xs = this.keys.map((k) => k.g);
    this.gToU = new Mono(xs, xs.map((_, i) => i));
    const val = (f: (k: Key) => number, sling: number) => this.keys.map((k) => (k.key ? f(k.key) : sling));
    this.fov = new Mono(xs, val((k) => (phone ? k.pfov ?? k.fov : k.fov), 58));
    this.roll = new Mono(xs, val((k) => k.roll ?? 0, 0));
    this.sx = new Mono(xs, val((k) => (phone ? (k.ps ?? [0, 0])[0] : (k.shift ?? [0, 0])[0]), 0));
    this.sy = new Mono(xs, val((k) => (phone ? (k.ps ?? [0, 0])[1] : (k.shift ?? [0, 0])[1]), 0));
  }

  /** Turn stage-relative numbers into a position. */
  private place(stage: number, v: V3, out: Vector3): Vector3 {
    if (stage === 0) return out.set(v[0], v[1], v[2]);
    if (stage === STAGES.length - 1) {
      // belt keys: a is the fraction of the sweep, b height, c radial offset
      const ang = BELT_START + this.beltAngle() + v[0] * BELT_SWEEP;
      const r = BELT_R + v[2];
      return out.set(Math.cos(ang) * r, v[1], Math.sin(ang) * r);
    }
    this.bodyAt(stage, this.at);
    this.out.copy(this.at).setY(0).normalize();
    this.side.crossVectors(this.up, this.out).normalize();
    return out
      .copy(this.at)
      .addScaledVector(this.side, v[0])
      .addScaledVector(this.up, v[1])
      .addScaledVector(this.out, v[2]);
  }

  private keyPos(i: number, out: Vector3): Vector3 {
    const n = this.keys.length;
    const fk = this.keys[clampIdx(i, n)];
    if (fk.key) {
      const k = fk.key;
      if (this.phone && k.ppos) return this.place(fk.stage, k.ppos, out);
      return this.place(fk.stage, k.pos, out);
    }
    return this.sling(fk.stage, out);
  }

  private keyLook(i: number, out: Vector3): Vector3 {
    const n = this.keys.length;
    const fk = this.keys[clampIdx(i, n)];
    if (fk.key) {
      const k = fk.key;
      if (this.phone && k.plook) return this.place(fk.stage, k.plook, out);
      return this.place(fk.stage, k.look ?? [0, 0, 0], out);
    }
    // while slinging, look at where the next world will be
    const nextStage = fk.stage + 1;
    if (nextStage >= STAGES.length - 1) return this.place(nextStage, [0.05, 0, 0], out);
    return this.bodyAt(nextStage, out);
  }

  /** A point that swings around the star between two worlds, up off the plane. */
  private sling(stage: number, out: Vector3): Vector3 {
    this.bodyAt(stage, this.at);
    if (stage + 1 < STAGES.length - 1) this.bodyAt(stage + 1, this.at2);
    else this.place(stage + 1, [0, 0, 0], this.at2);
    const a0 = Math.atan2(this.at.z, this.at.x);
    let a1 = Math.atan2(this.at2.z, this.at2.x);
    let d = a1 - a0;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    a1 = a0 + d * 0.5;
    const r = lerp(Math.hypot(this.at.x, this.at.z), Math.hypot(this.at2.x, this.at2.z), 0.5) + 26 + Math.abs(d) * 18;
    const y = (stage % 2 === 0 ? 1 : -1) * (38 + Math.abs(d) * 40);
    return out.set(Math.cos(a1) * r, y, Math.sin(a1) * r);
  }

  solve(g: number, out: PathState) {
    const n = this.keys.length;
    const u = this.gToU.at(clamp(g, this.keys[0].g, this.keys[n - 1].g));
    const i = Math.min(n - 2, Math.floor(u));
    const w = u - i;
    for (let k = 0; k < 4; k++) {
      this.keyPos(i - 1 + k, this.pts[k]);
      this.keyLook(i - 1 + k, this.lks[k]);
    }
    // at the two ends of the path, mirror a point so the spline has four
    if (i === 0) this.pts[0].copy(this.pts[1]).multiplyScalar(2).sub(this.pts[2]);
    if (i + 2 >= n) this.pts[3].copy(this.pts[2]).multiplyScalar(2).sub(this.pts[1]);
    crPoint(this.pts[0], this.pts[1], this.pts[2], this.pts[3], w, out.pos);
    crPoint(this.lks[0], this.lks[1], this.lks[2], this.lks[3], w, out.look);
    out.fov = this.fov.at(g);
    out.roll = this.roll.at(g);
    out.sx = this.sx.at(g);
    out.sy = this.sy.at(g);
  }
}

const clampIdx = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);
