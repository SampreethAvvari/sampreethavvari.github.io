// The flight path. Progress is measured in chapters; chapter i sits SEG
// units further along than chapter i-1. The curve weaves gently so the ship
// arcs, climbs and dives between scenes, then flattens out for the landing.

import { CatmullRomCurve3, Vector3, Matrix4, Quaternion } from "three";

export const SEG = 320;

/** Hand shaped offsets per half chapter: [x, y]. Extra entries repeat softly. */
const SHAPE: [number, number][] = [
  [0, 0], // 0 launch
  [6, 4],
  [-26, 12], // 1 proof
  [-40, 2],
  [-18, -22], // 2 projects (dive)
  [22, -14],
  [36, 4], // 3 disciplines
  [20, 10],
  [-12, 16], // 4 writing
  [-34, 20],
  [-22, 8], // 5 film
  [6, -14],
  [26, -30], // 6 mind (low over the spiral)
  [14, -14],
  [0, -6], // 7 contact
];

const LEAD = 2; // control points before chapter 0
const TAIL = 4; // control points after the last chapter

const _a = new Vector3();
const _b = new Vector3();
const _up = new Vector3(0, 1, 0);

export class FlightPath {
  readonly n: number;
  readonly curve: CatmullRomCurve3;
  private readonly k: number; // number of half chapter steps in the curve

  constructor(chapters: number) {
    this.n = Math.max(1, chapters);
    const halfSteps = (this.n - 1) * 2;
    const pts: Vector3[] = [];
    for (let k = -LEAD; k <= halfSteps + TAIL; k++) {
      const p = k / 2;
      let x = 0;
      let y = 0;
      if (k >= 0 && k <= halfSteps) {
        const s = SHAPE[k % SHAPE.length];
        x = s[0];
        y = s[1];
        // Calm the last half chapter so the landing reads as level flight.
        if (k === halfSteps) {
          x *= 0.3;
          y *= 0.3;
        }
      } else if (k > halfSteps) {
        const s = SHAPE[halfSteps % SHAPE.length];
        x = s[0] * 0.3;
        y = s[1] * 0.3;
      }
      pts.push(new Vector3(x, y, -p * SEG));
    }
    this.curve = new CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    this.k = pts.length - 1;
  }

  private t(p: number) {
    const t = (p * 2 + LEAD) / this.k;
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  /** Point on the path at progress p (chapters). */
  point(p: number, out: Vector3) {
    return this.curve.getPoint(this.t(p), out);
  }

  /** Unit forward direction at p. */
  forward(p: number, out: Vector3) {
    this.point(p - 0.01, _a);
    this.point(p + 0.01, _b);
    return out.subVectors(_b, _a).normalize();
  }

  /**
   * Orientation frame at p as a quaternion (object forward is -Z), plus the
   * sideways curvature so callers can bank into turns.
   */
  frame(p: number, outPos: Vector3, outQuat: Quaternion, outRight?: Vector3, outUp?: Vector3, outFwd?: Vector3) {
    this.point(p, outPos);
    const f = this.forward(p, _a);
    const right = (outRight ?? _b).crossVectors(f, _up).normalize();
    const up = (outUp ?? tmpUp).crossVectors(right, f).normalize();
    if (outFwd) outFwd.copy(f);
    tmpBack.copy(f).negate();
    tmpM.makeBasis(right, up, tmpBack);
    outQuat.setFromRotationMatrix(tmpM);
    return outPos;
  }

  /** Sideways bend of the path at p: positive means curving to the right. */
  bend(p: number, right: Vector3) {
    this.point(p - 0.12, _a);
    this.point(p + 0.12, _b);
    this.point(p, tmpC);
    _a.add(_b).addScaledVector(tmpC, -2);
    return _a.dot(right);
  }

  /** Vertical bend at p: positive means the path is pulling up. */
  lift(p: number, up: Vector3) {
    this.point(p - 0.12, _a);
    this.point(p + 0.12, _b);
    this.point(p, tmpC);
    _a.add(_b).addScaledVector(tmpC, -2);
    return _a.dot(up);
  }

  /**
   * The landing in the last world. The mothership holds position at the end
   * of the path while its lander undocks and comes down onto the dunes below
   * and behind it, so the closing shot looks past the lander toward the ship
   * and the dawn.
   */
  landing(stand: number): Landing {
    if (this._landing && this._landing.stand === stand) return this._landing;
    const pos = new Vector3();
    const quat = new Quaternion();
    const right = new Vector3();
    const up = new Vector3();
    const fwd = new Vector3();
    this.frame(travel(this.n - 1 + REST, this.n), pos, quat, right, up, fwd);
    const park = pos.clone();
    const pad = park.clone().addScaledVector(fwd, -150).addScaledVector(up, -95).addScaledVector(right, -55);
    const touch = pad.clone().addScaledVector(up, stand);
    const last = this.n - 1;
    this._landing = { start: last + LAND_START, end: last + LAND_END, pad, touch, park, quat, right, up, fwd, stand };
    return this._landing;
  }
  private _landing: Landing | null = null;
}

export interface Landing {
  start: number;
  end: number;
  pad: Vector3;
  touch: Vector3;
  park: Vector3;
  quat: Quaternion;
  right: Vector3;
  up: Vector3;
  fwd: Vector3;
  stand: number;
}

// Pacing. Every world rests at i + REST. The jump to the next world runs
// from i + JUMP_A to i + JUMP_B and crosses over (flash, new world) at
// i + CROSS, the middle of a glide from one rest point to the next. The last
// world has no jump; its landing runs from LAND_START to LAND_END past it.
export const REST = 0.35;
export const JUMP_A = 0.62;
export const JUMP_B = 1.08;
export const CROSS = 0.85;
const LAND_START = CROSS - 1 + 0.02;
const LAND_END = 0.3;
const IN_A = JUMP_B - 1; // where travel inside a world starts
const IN_RATE = 0.28 / (JUMP_A - IN_A); // path chapters per unit of progress inside a world

/** 0 before the landing starts, 1 once the page reaches the end. */
export function landingPhase(l: Landing, p: number) {
  const x = (p - l.start) / (l.end - l.start);
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Descent progress for a landing phase: decelerates into touchdown at L = 0.84. */
export function approachU(L: number) {
  const x = Math.min(1, L / 0.84);
  return x * x * (3 - 2 * x) * 0.35 + (1 - Math.pow(1 - x, 3)) * 0.65;
}

/** 0 before touchdown, 1 once the lander has settled and the dust is down. */
export function landedAt(p: number, n: number) {
  const L = (p - (n - 1 + LAND_START)) / (LAND_END - LAND_START);
  const t = Math.max(0, Math.min(1, (L - 0.84) / 0.14));
  return t * t * (3 - 2 * t);
}

/** Progress to path position: slow inside a world, fast through a jump. */
export function travel(p: number, n: number) {
  const x = p - JUMP_A;
  const i = Math.floor(x);
  const f = x - i;
  const span = JUMP_B - JUMP_A;
  if (i >= 0 && i < n - 1 && f < span) {
    // Inside a jump: ends match the slow travel speed on both sides.
    const u = f / span;
    const a = IN_RATE * span / (1 + 0.02 - 0.3);
    const g = a * u + (1 - a) * u * u * (3 - 2 * u);
    return i + 0.3 + (1 + 0.02 - 0.3) * g;
  }
  // Inside world w: starts at w + 0.02 when the previous jump ends.
  const w = Math.max(0, Math.min(n - 1, Math.floor(p - IN_A)));
  return w + 0.02 + IN_RATE * (p - (w + IN_A));
}

/** The jump in progress at p, or null while inside a world. */
export function jumpAt(p: number, n: number): { from: number; to: number; amount: number } | null {
  const x = p - JUMP_A;
  const i = Math.floor(x);
  const f = x - i;
  const span = JUMP_B - JUMP_A;
  if (i < 0 || i >= n - 1 || f >= span) return null;
  return { from: i, to: i + 1, amount: f / span };
}

/** Which world is on screen at p (it changes at the middle of each jump). */
export function worldAt(p: number, n: number) {
  return Math.max(0, Math.min(n - 1, Math.floor(p + 1 - CROSS)));
}

const tmpUp = new Vector3();
const tmpBack = new Vector3();
const tmpC = new Vector3();
const tmpM = new Matrix4();
