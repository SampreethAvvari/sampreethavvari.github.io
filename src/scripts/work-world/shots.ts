// Every camera position in the Work world, written as data. Screens differ on
// purpose: distance, angle, lens and roll all change from stop to stop, and
// the words on the page go wherever the subject leaves room.
//
// A track is a list of keys; some keys are stops, the rest shape the move
// between them. Scroll position in stops maps through a soft ease onto the
// keys, so the camera lingers near each stop and moves hard in between.

import { CatmullRomCurve3, Vector3 } from "three";
import { BAY_IDS, type BayId } from "./bays";
import { SUN_DIR } from "./sky";
import { FACE_Z, RC, bayAngle } from "./station";
import { BODY, GIANT_R, zAt } from "./trail";
import { DEG, clamp, inOut, lerp, smoother } from "./util";

export interface Key {
  p: Vector3;
  l: Vector3;
  /** Roll in degrees. */
  r: number;
  /** Vertical field of view in degrees. */
  f: number;
  /** Ring angle in radians. */
  a: number;
  /** World up for this key (defaults to +Y). */
  up?: Vector3;
  stop?: number;
  /** Comet position along the trail. */
  u?: number;
  /** Size of the star. */
  sun?: number;
  /** Brightness of the sky. */
  sky?: number;
}

export interface Pose {
  p: Vector3;
  l: Vector3;
  up: Vector3;
  r: number;
  f: number;
  a: number;
  u: number;
  sun: number;
  sky: number;
}

export const newPose = (): Pose => ({ p: new Vector3(), l: new Vector3(0, 0, -1), up: new Vector3(0, 1, 0), r: 0, f: 40, a: 0, u: 0, sun: 1, sky: 1 });

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Ring angle that puts bay i at the given clock angle in the world. */
const ringFor = (i: number, phi: number) => phi - bayAngle(i);

/** World from bay local, for a bay sitting at clock angle phi. */
export function bayToWorld(phi: number, v: Vector3, out = new Vector3()) {
  const rot = phi + Math.PI / 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  out.set(v.x * c - v.y * s + Math.cos(phi) * RC, v.x * s + v.y * c + Math.sin(phi) * RC, v.z + FACE_Z);
  return out;
}

export function worldToBay(phi: number, v: Vector3, out = new Vector3()) {
  const rot = phi + Math.PI / 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const x = v.x - Math.cos(phi) * RC;
  const y = v.y - Math.sin(phi) * RC;
  out.set(x * c + y * s, -x * s + y * c, v.z - FACE_Z);
  return out;
}

export const bayUp = (phi: number, out = new Vector3()) => {
  const rot = phi + Math.PI / 2;
  return out.set(-Math.sin(rot), Math.cos(rot), 0);
};

const bayShot = (i: number, phiDeg: number, p: [number, number, number], l: [number, number, number], r: number, f: number): Key => {
  const phi = phiDeg * DEG;
  return { p: bayToWorld(phi, V(...p)), l: bayToWorld(phi, V(...l)), r, f, a: ringFor(i, phi), up: bayUp(phi), u: 1, sun: 1, sky: 1 };
};

export const STATION_PHI = [-68, -102, -84, -58];
// The dock's hall leans along its boom, so the walk goes where the boom goes.
const leanFde = (v: [number, number, number]): [number, number, number] => (v[2] > 0 ? [v[0] + v[2] * 0.333, v[1] - v[2] * 0.136, v[2]] : v);

// What each stop on /work looks at. Bays first, then the trail.
export function indexKeys(curveAt: (u: number) => Vector3, uAtZ: (z: number) => number, wide: boolean): Key[] {
  const k: Key[] = [];
  const P = (o: Partial<Key> & { p: Vector3; l: Vector3 }) => k.push({ r: 0, f: 40, a: 0, up: new Vector3(0, 1, 0), u: 1, sun: 1, sky: 1, ...o } as Key);
  const s = wide ? 1 : 1.5; // phones stand further back

  const a1 = ringFor(0, STATION_PHI[0] * DEG);

  // 0 Hero. Low under the near rim, looking up across the ring into the star.
  P({ p: wide ? V(190, -150, 540) : V(70, -210, 960), l: wide ? V(-74, -46, 0) : V(-50, -210, 0), r: wide ? -12 : -6, f: wide ? 38 : 40, a: a1 - 58 * DEG, stop: 0 });
  P({ p: V(70, -300, 330), l: V(-60, -220, 10), r: -8, f: 40, a: a1 - 22 * DEG });

  // 1 AI: three quarters from the left, the room off to the right of frame.
  k.push({ ...bayShot(0, STATION_PHI[0], wide ? [-24, -8, 92] : [-8, -20, 150], wide ? [-18, 0, -60] : [0, 10, -40], 3, wide ? 36 : 44), stop: 1 });
  P({ p: bayToWorld(STATION_PHI[0] * DEG, V(-120, -60, 180)), l: V(-30, -240, 0), r: 6, f: 38, a: a1 + 40 * DEG });

  // 2 Forward deployed: far out among the pods, looking back through the open
  // bay at the star.
  {
    const phi = STATION_PHI[1] * DEG;
    const m = bayToWorld(phi, V(0, 0, 0));
    const cam = m.clone().addScaledVector(SUN_DIR, wide ? -470 : -620);
    cam.x += wide ? 6 : 2;
    cam.y += wide ? -14 : -30;
    const look = m.clone().addScaledVector(SUN_DIR, 26);
    look.x += wide ? -28 : 0;
    look.y += wide ? 14 : 34;
    k.push({ p: cam, l: look, r: wide ? -6 : -3, f: wide ? 30 : 40, a: ringFor(1, phi), up: bayUp(phi), u: 1, sun: 1, sky: 1, stop: 2 });
  }
  P({ p: V(120, -420, 240), l: V(10, -220, 20), r: 10, f: 42, a: ringFor(1, STATION_PHI[1] * DEG) + 52 * DEG });

  // 3 Machine learning: tight on the iris, nearly filling the frame.
  k.push({ ...bayShot(2, STATION_PHI[2], wide ? [40, -13, 92] : [0, -16, 106], wide ? [30, -7, -20] : [0, 6, -10], wide ? -7 : -4, wide ? 40 : 50), stop: 3 });
  P({ p: V(260, -350, 230), l: V(70, -210, 20), r: -8, f: 40, a: ringFor(2, STATION_PHI[2] * DEG) + 50 * DEG });

  // 4 Software: low along the face of the ring, the doors seen edge on, the
  // hull running away to the horizon behind them.
  k.push({ ...bayShot(3, STATION_PHI[3], wide ? [70, -30, 74] : [8, -30, 140], wide ? [-36, 12, -12] : [0, 12, -20], wide ? -7 : -2, wide ? 40 : 44), stop: 4 });
  P({ p: V(330, -130, 420), l: V(120, -60, 20), r: -5, f: 44, a: ringFor(3, STATION_PHI[3] * DEG) + 26 * DEG });

  // 5 The whole station at last, dead on, the trail running out of its hub
  // and past the camera. Then the long pull back: time runs in reverse.
  const a5 = ringFor(3, STATION_PHI[3] * DEG) + 40 * DEG;
  P({ p: V(70, -46, wide ? 1030 : 1560), l: V(-40, 14, 0), r: -3, f: 38, a: a5, u: 1, stop: 5, sun: 1, sky: 1 });

  // The reverse dolly: straight back along the path, looking at where you were.
  const ahead = (z: number, y = 26, x = 30) => {
    const q = curveAt(uAtZ(z));
    return V(q.x + x, q.y + y, z);
  };
  const stationLook = V(0, 0, 0);
  P({ p: ahead(zAt(2025.1), 40, 40), l: stationLook, r: -2, f: 48, a: a5 + 8 * DEG, u: 0.82, sun: 0.82, sky: 0.9 });
  P({ p: ahead(zAt(2023.0), 30, 60), l: V(0, 0, zAt(2024.8)), r: 3, f: 56, a: a5 + 12 * DEG, u: 0.46, sun: 0.56, sky: 0.8 });
  P({ p: ahead(zAt(2019.4), 30, 40), l: V(100, 60, zAt(2021.4)), r: -2, f: 52, a: a5 + 14 * DEG, u: 0.14, sun: 0.26, sky: 0.68 });

  // 6 2017: a thin crescent, small in a lot of black, the comet leaving it.
  const moon = BODY.moon;
  {
    const back = wide ? 840 : 1120;
    // A hair off the line to the star, so a bead of it shows past the limb.
    const cam = moon.clone().addScaledVector(SUN_DIR, -back).add(V(wide ? 62 : 74, wide ? 44 : 50, 0));
    const look = moon.clone().add(wide ? V(-190, -44, 0) : V(0, -84, 0));
    P({ p: cam, l: look, r: wide ? 6 : 2, f: 30, u: 0.02, stop: 6, sun: 0.74, sky: 0.74 });
  }
  P({ p: V(moon.x - 110, moon.y + 130, moon.z - 260), l: V(190, 40, zAt(2019)), r: -9, f: 46, u: 0.06, sun: 0.28, sky: 0.66 });
  P({ p: ahead(zAt(2019.2), 14, 20), l: ahead(zAt(2020.6), 10, 0), r: -16, f: 62, u: 0.16, sun: 0.3, sky: 0.68 });

  // 7 2021: dead centre on the axis of the tuned gate, all of it stacked in
  // front of you.
  const g = BODY.gate;
  P({ p: V(g.x, g.y, g.z + (wide ? 430 : 620)), l: V(g.x, g.y + (wide ? -6 : -40), g.z), r: 0, f: 36, u: uAtZ(g.z + 4), stop: 7, sun: 0.36, sky: 0.7 });
  P({ p: V(g.x, g.y, g.z + 40), l: V(g.x + 4, g.y - 4, g.z - 120), r: 20, f: 70, u: uAtZ(g.z - 30), sun: 0.4, sky: 0.72 });
  P({ p: V(g.x + 20, g.y - 10, g.z - 330), l: V(-80, 100, zAt(2022.7)), r: -8, f: 60, u: uAtZ(g.z - 340), sun: 0.42, sky: 0.74 });
  P({ p: ahead(zAt(2022.7), 10, 10), l: ahead(zAt(2023.25), 0, 80), r: -24, f: 66, u: uAtZ(zAt(2022.8)), sun: 0.46, sky: 0.76 });

  // 8 2023: skimming the giant. A burning limb across the bottom of the frame,
  // the star coming up behind it.
  {
    const gi = BODY.giant;
    const dir = V(-0.74, 0.67, 0).normalize();
    const camP = gi.clone().addScaledVector(dir, GIANT_R + 150);
    camP.z += 620;
    const lookP = gi.clone().addScaledVector(dir, GIANT_R + 420);
    lookP.z -= 900;
    lookP.x += -170;
    P({ p: camP, l: lookP, r: 41, f: wide ? 42 : 54, u: uAtZ(zAt(2023.42)), stop: 8, sun: 0.5, sky: 0.8 });
  }
  P({ p: BODY.giant.clone().add(V(-712, 644, -120)), l: V(-240, 110, BODY.iris.z), r: 18, f: 72, u: uAtZ(zAt(2023.72)), sun: 0.56, sky: 0.82 });

  // 9 2024: a lens at three quarters, shoved to the left of frame.
  const ir = BODY.iris;
  P({ p: V(ir.x + 290, ir.y - 36, ir.z + (wide ? 560 : 880)), l: V(ir.x + (wide ? 150 : 10), ir.y + 2, ir.z), r: wide ? 6 : 2, f: wide ? 30 : 36, u: uAtZ(ir.z + 6), stop: 9, sun: 0.6, sky: 0.86 });
  P({ p: V(ir.x, ir.y, ir.z + 40), l: V(ir.x - 6, ir.y + 8, ir.z - 200), r: -14, f: 74, u: uAtZ(ir.z - 10), sun: 0.62, sky: 0.86 });
  P({ p: V(ir.x - 40, ir.y + 60, ir.z - 220), l: V(BODY.binary.x, BODY.binary.y, BODY.binary.z), r: -20, f: 58, u: uAtZ(ir.z - 240), sun: 0.66, sky: 0.88 });

  // 10 2024: from directly above the pair, the disc turning, rolled hard.
  const b = BODY.binary;
  P({ p: V(b.x + 40, b.y + (wide ? 430 : 840), b.z + (wide ? 420 : 460)), l: V(b.x + (wide ? -150 : 0), b.y, b.z + (wide ? -10 : 30)), r: wide ? 24 : 6, f: 40, u: uAtZ(b.z + 4), stop: 10, sun: 0.72, sky: 0.9 });
  P({ p: V(b.x - 120, b.y - 170, b.z - 260), l: V(120, -60, zAt(2025.4)), r: 12, f: 60, u: uAtZ(b.z - 280), sun: 0.8, sky: 0.94 });
  P({ p: V(180, -20, zAt(2025.5)), l: V(0, 0, 200), r: 4, f: 54, u: uAtZ(zAt(2025.45)), sun: 0.9, sky: 1 });

  // 11 Now: from far out to the side, the whole line at once, the station big
  // at the end of it.
  P({ p: wide ? V(-720, -400, -530) : V(-860, -620, -760), l: wide ? V(-30, 20, 40) : V(30, -200, 40), r: wide ? 10 : 6, f: wide ? 36 : 44, a: a5 + 34 * DEG, u: 1, stop: 11, sun: 1, sky: 1 });
  return k;
}

export class Track {
  private pos: CatmullRomCurve3;
  private look: CatmullRomCurve3;
  private stops: number[] = [];
  private n: number;
  constructor(public keys: Key[]) {
    this.n = keys.length;
    this.pos = new CatmullRomCurve3(keys.map((k) => k.p), false, "centripetal");
    this.look = new CatmullRomCurve3(keys.map((k) => k.l), false, "centripetal");
    keys.forEach((k, i) => {
      if (k.stop !== undefined) this.stops[k.stop] = i;
    });
  }
  get count() {
    return this.stops.length;
  }
  private keyFloat(q: number) {
    const last = this.stops.length - 1;
    const c = clamp(q, 0, last);
    const i = Math.min(last - 1, Math.floor(c));
    if (last <= 0) return this.stops[0] ?? 0;
    const f = c - i;
    // Soft at both ends: this is the feel of arriving and of the pull at a stop.
    const e = lerp(f, smoother(f), 0.72);
    return lerp(this.stops[i], this.stops[i + 1], e);
  }
  at(q: number, o: Pose) {
    const kf = this.keyFloat(q);
    const t = this.n > 1 ? kf / (this.n - 1) : 0;
    this.pos.getPoint(t, o.p);
    this.look.getPoint(t, o.l);
    const i = Math.min(this.n - 2, Math.floor(kf));
    const j = Math.max(0, i);
    const f = kf - j;
    const A = this.keys[j];
    const B = this.keys[Math.min(this.n - 1, j + 1)];
    const e = inOut(f);
    o.r = lerp(A.r, B.r, e);
    o.f = lerp(A.f, B.f, e);
    o.a = lerp(A.a, B.a, e);
    o.u = lerp(A.u ?? 1, B.u ?? 1, f);
    o.sun = lerp(A.sun ?? 1, B.sun ?? 1, e);
    o.sky = lerp(A.sky ?? 1, B.sky ?? 1, e);
    o.up.copy(A.up ?? UP).lerp(B.up ?? UP, e).normalize();
    return o;
  }
  /** The pose at rest at a stop. */
  stopPose(i: number, o: Pose) {
    return this.at(i, o);
  }
}
const UP = new Vector3(0, 1, 0);

// ---------------------------------------------------------------- inside a bay

/** A pose in bay local space. */
export interface LocalShot {
  p: [number, number, number];
  l: [number, number, number];
  r?: number;
  f?: number;
}

// One list per bay: arrive, how I work, what I bring, projects (as many as the
// groups need), the writing, the way out. Written long, then cut to the number
// of stops the page has.
export const INTERIOR: Record<BayId, LocalShot[]> = {
  aie: [
    { p: [10, -7, -6], l: [-4, 2, -100], r: -2, f: 52 },
    { p: [-12, 4, -56], l: [14, -2, -130], r: 3, f: 44 },
    { p: [16, 10, -96], l: [-12, -4, -170], r: -4, f: 46 },
    { p: [-4, -10, -128], l: [6, 8, -200], r: 2, f: 50 },
    { p: [12, 2, -150], l: [-8, -2, -228], r: -3, f: 42 },
    { p: [-10, -4, -172], l: [0, 2, -240], r: 2, f: 46 },
    { p: [6, 12, -188], l: [-2, -6, -240], r: -3, f: 48 },
    { p: [-6, -8, -150], l: [4, 4, -240], r: 1, f: 44 },
  ],
  fde: [
    { p: [8, 2, -32], l: [-6, -6, 140], r: 2, f: 50 },
    { p: [-28, 2, 70], l: [14, -8, 210], r: -3, f: 44 },
    { p: [26, 24, 112], l: [-20, -14, 280], r: 5, f: 46 },
    { p: [-36, -28, 236], l: [-10, 40, -30], r: -6, f: 50 },
    { p: [52, -44, 292], l: [-34, 34, -10], r: 5, f: 46 },
    { p: [-44, 42, 330], l: [30, -6, -30], r: -4, f: 46 },
    { p: [22, 14, 410], l: [-14, 44, -20], r: 3, f: 44 },
    { p: [-60, -44, 520], l: [-40, 44, -10], r: -2, f: 42 },
  ],
  mle: [
    { p: [6, -5, -8], l: [-2, 0, -70], r: -6, f: 56 },
    { p: [-8, 8, -22], l: [4, -2, -70], r: 6, f: 48 },
    { p: [9, -8, -44], l: [0, 2, -92], r: -10, f: 56 },
    { p: [-10, 6, -82], l: [2, -2, -150], r: 12, f: 50 },
    { p: [8, 8, -118], l: [-4, -4, -196], r: -14, f: 50 },
    { p: [-7, -9, -146], l: [2, 2, -218], r: 16, f: 46 },
    { p: [4, 8, -176], l: [0, 0, -224], r: -6, f: 46 },
    { p: [0, 0, -168], l: [0, 0, -228], r: 0, f: 46 },
  ],
  sde: [
    { p: [-10, 6, -8], l: [4, -2, -120], r: 2, f: 50 },
    { p: [10, -8, -30], l: [-16, 4, -60], r: -3, f: 44 },
    { p: [-4, 14, -64], l: [14, -8, -100], r: 4, f: 50 },
    { p: [0, -6, -100], l: [-16, -6, -150], r: -2, f: 44 },
    { p: [6, 8, -134], l: [18, -2, -190], r: 3, f: 46 },
    { p: [-8, -4, -162], l: [0, 2, -230], r: -2, f: 48 },
    { p: [4, 10, -178], l: [0, 0, -230], r: 2, f: 44 },
    { p: [2, -8, -158], l: [0, 2, -232], r: 0, f: 40 },
  ],
};

/** Clock angle a bay sits at on its own page: straight down, floor at the bottom. */
export const INSIDE_PHI = -90 * DEG;

export function interiorKeys(id: BayId, stops: number): Key[] {
  const i = BAY_IDS.indexOf(id);
  const list = INTERIOR[id];
  const a = ringFor(i, INSIDE_PHI);
  const up = bayUp(INSIDE_PHI);
  const keys: Key[] = [];
  for (let s = 0; s < stops; s++) {
    // Spread the page's stops over the hall, always using the first and last.
    const t = stops > 1 ? (s / (stops - 1)) * (list.length - 1) : 0;
    const j = Math.min(list.length - 2, Math.floor(t));
    const k = t - j;
    const A = list[j];
    const B = list[j + 1];
    const mix3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    const pm = mix3(A.p, B.p);
    const lm = mix3(A.l, B.l);
    const pv = id === "fde" ? leanFde(pm) : pm;
    const lv = id === "fde" ? leanFde(lm) : lm;
    keys.push({
      p: bayToWorld(INSIDE_PHI, V(...pv)),
      l: bayToWorld(INSIDE_PHI, V(...lv)),
      r: lerp(A.r ?? 0, B.r ?? 0, k),
      f: lerp(A.f ?? 46, B.f ?? 46, k),
      a,
      up,
      u: 1,
      sun: 1,
      sky: 1,
      stop: s,
    });
  }
  return keys;
}

