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
   * The landing at the end of the flight. Over the last half chapter the
   * ship leaves the path, curves down onto a pad and settles on its legs.
   */
  landing(stand: number): Landing {
    if (this._landing && this._landing.stand === stand) return this._landing;
    const last = this.n - 1;
    const start = Math.max(0, last - 0.5);
    const pos = new Vector3();
    const quat = new Quaternion();
    const right = new Vector3();
    const up = new Vector3();
    const fwd = new Vector3();
    this.frame(last, pos, quat, right, up, fwd);
    const pad = pos.clone().addScaledVector(fwd, 95).addScaledVector(up, -130);
    const touch = pad.clone().addScaledVector(up, stand);
    const a = this.point(start, new Vector3());
    const fa = this.forward(start, new Vector3());
    const c1 = a.clone().addScaledVector(fa, 120);
    const c2 = touch.clone().addScaledVector(up, 55).addScaledVector(fwd, -35);
    this._landing = { start, last, pad, touch, quat, right, up, fwd, a, c1, c2, stand };
    return this._landing;
  }
  private _landing: Landing | null = null;
}

export interface Landing {
  start: number;
  last: number;
  pad: Vector3;
  touch: Vector3;
  quat: Quaternion;
  right: Vector3;
  up: Vector3;
  fwd: Vector3;
  a: Vector3;
  c1: Vector3;
  c2: Vector3;
  stand: number;
}

/** 0 before the landing starts, 1 once the page reaches the end. */
export function landingPhase(l: Landing, p: number) {
  if (l.last <= l.start) return p >= l.last ? 1 : 0;
  const x = (p - l.start) / (l.last - l.start);
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Where the ship is along the approach. u = 0 leaves the path, u = 1 stands on the pad. */
export function approachPoint(l: Landing, u: number, out: Vector3) {
  const v = 1 - u;
  return out
    .copy(l.a)
    .multiplyScalar(v * v * v)
    .addScaledVector(l.c1, 3 * v * v * u)
    .addScaledVector(l.c2, 3 * v * u * u)
    .addScaledVector(l.touch, u * u * u);
}

/** Approach progress for a landing phase: decelerates into touchdown at L = 0.84. */
export function approachU(L: number) {
  const x = Math.min(1, L / 0.84);
  return 1 - Math.pow(1 - x, 3);
}

const tmpUp = new Vector3();
const tmpBack = new Vector3();
const tmpC = new Vector3();
const tmpM = new Matrix4();
