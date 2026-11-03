// How the page's length maps to the story. The flight keeps three screens of
// scroll per chapter. From the end of the last jump on there are no steps and
// no timers: the landing, the walk, the helmet and the touch are all read from
// the scroll position, and this table says how many screens each one gets.
//
// A ship world's free stretch is (TRAVEL_END - ARRIVE) * SHIP_SPAN = 1.53 screens:
// about 14 wheel notches at 900 px, about 1290 px of finger on a phone. Every
// human beat here gets more than that.
//
// Progress p is still counted in chapters (0 .. 8), so the words, the rail and
// the score keep their meaning. This file is imported by the page itself, so it
// stays free of the 3D code.

export const SHIP_SPAN = 3;
export const LAND_WORLD = 5;
export const LAST = 8;
export const ARRIVE = 0.04;
export const TRAVEL_END = 0.55;

/** Where each thing happens, in progress. */
export const SCENE = {
  /** The lander leaves the dock, comes down, touches down, settles. */
  landA: 5.04,
  landB: 5.3,
  /** He is on the ground and the ramp is shut: the first rest. */
  landRest: 5.33,
  rampA: 5.36,
  rampB: 5.5,
  /** Out of the door, down the ramp, onto the sand. */
  walkA: 5.5,
  walkB: 6.2,
  walkRest: 6.25,
  /** The camera flies out over the plain to the wide shot. */
  flyA: 6.3,
  flyB: 6.8,
  /** Helmet off. */
  helmA: 6.8,
  helmB: 7.2,
  helmRest: 7.25,
  /** The wrist lamp comes on as the night does. */
  lampA: 7.4,
  lampB: 7.48,
  /** The camera runs in while he walks to the sapling and kneels. */
  nearA: 7.3,
  /** He sets off once the camera is already coming, so it never falls behind him. */
  nearWalkA: 7.335,
  nearWalkB: 7.5,
  kneelB: 7.56,
  nearB: 7.6,
  /** The camera comes to rest on the sand and the hand comes down to the leaf. */
  camDown: 7.72,
  touchA: 7.6,
  reachA: 7.66,
  contact: 7.86,
  touchB: 7.96,
} as const;

/** Screens of scroll per stretch of the story, from the end of the last jump. */
const STRETCHES: [number, number][] = [
  [SCENE.landB, 2.2],
  [SCENE.rampA, 0.35],
  [SCENE.rampB, 0.55],
  [SCENE.walkB, 2.4],
  [SCENE.flyA, 0.35],
  [SCENE.flyB, 1.1],
  [SCENE.helmB, 2.2],
  [SCENE.nearA, 0.35],
  [SCENE.nearB, 1.3],
  [SCENE.touchB, 2.0],
  [LAST, 0.15],
];

/** Knots of the page: progress against screens of scroll. */
const KNOTS: [number, number][] = (() => {
  const k: [number, number][] = [
    [0, 0],
    [SCENE.landA, SCENE.landA * SHIP_SPAN],
  ];
  let y = SCENE.landA * SHIP_SPAN;
  for (const [p, screens] of STRETCHES) {
    y += screens;
    k.push([p, y]);
  }
  return k;
})();

/** Screens of scroll the whole journey takes. */
export const TOTAL_SCREENS = KNOTS[KNOTS.length - 1][1];

/** Screens of scroll at progress p. */
export function yOf(p: number) {
  if (p <= 0) return 0;
  for (let i = 1; i < KNOTS.length; i++) {
    const [p1, y1] = KNOTS[i];
    if (p <= p1) {
      const [p0, y0] = KNOTS[i - 1];
      return y0 + ((p - p0) / (p1 - p0)) * (y1 - y0);
    }
  }
  return TOTAL_SCREENS;
}

/** Progress at this many screens of scroll. */
export function pOf(y: number) {
  if (y <= 0) return 0;
  for (let i = 1; i < KNOTS.length; i++) {
    const [p1, y1] = KNOTS[i];
    if (y <= y1) {
      const [p0, y0] = KNOTS[i - 1];
      return p0 + ((y - y0) / (y1 - y0)) * (p1 - p0);
    }
  }
  return LAST;
}

/** Screens of scroll per chapter of progress at p. */
export function screensPerP(p: number) {
  for (let i = 1; i < KNOTS.length; i++) {
    if (p <= KNOTS[i][0]) return (KNOTS[i][1] - KNOTS[i - 1][1]) / (KNOTS[i][0] - KNOTS[i - 1][0]);
  }
  return SHIP_SPAN;
}

// ------------------------------------------------------------------ the words

/** Where each chapter's words are up, in progress. */
const WORDS: [number, number][] = [
  [0, TRAVEL_END],
  [1 + ARRIVE, 1 + TRAVEL_END],
  [2 + ARRIVE, 2 + TRAVEL_END],
  [3 + ARRIVE, 3 + TRAVEL_END],
  [4 + ARRIVE, 4 + TRAVEL_END],
  [SCENE.landA, 5.46],
  [SCENE.rampB, 6.36],
  [6.78, 7.33],
  [7.64, LAST],
];

/** Where the chapter's words come up. */
export const arriveAt = (i: number) => WORDS[Math.max(0, Math.min(WORDS.length - 1, i))][0];
/** Where the chapter's words leave. */
export const travelEnd = (i: number) => WORDS[Math.max(0, Math.min(WORDS.length - 1, i))][1];

/** Where a link or the index lands: the flight's worlds at their start, the human ones where the scene has come to rest. */
export function restAt(i: number) {
  if (i <= 0) return 0;
  if (i < LAND_WORLD) return i + ARRIVE;
  if (i === LAND_WORLD) return SCENE.landRest;
  if (i === 6) return SCENE.walkRest;
  if (i === 7) return SCENE.helmRest;
  return LAST;
}

/** The world whose words hold at p, or -1 between them. */
export function worldAt(p: number, eps = 0.006) {
  for (let i = 0; i < WORDS.length; i++) if (p >= WORDS[i][0] - eps && p <= WORDS[i][1] + eps) return i;
  return -1;
}

/** Between two worlds of the flight (the only place a jump runs by itself)? From the landing on, the scroll carries everything. */
export const inJumpGap = (p: number) => p < SCENE.landA - 0.006 && worldAt(p) < 0;

/** Where the human chapters come to rest, for the page keys. */
export const RESTS = [SCENE.landA, SCENE.landRest, SCENE.walkRest, SCENE.helmRest, LAST];

// ------------------------------------------------------------------ the steps

// How long each step takes him, in the walk's own measure. His feet are planted
// between steps, so the page can let him finish one when the scroll stops.
export const WALK_OUT: number[] = [0.95, 0.76, 0.76, 0.76, 0.76, 0.76, 0.7, 0.7, 0.7, 0.92];
export const WALK_ON: number[] = [0.7, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.7, 0.86];

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const plants = (list: number[], a: number, b: number) => {
  const out: number[] = [];
  const total = sum(list);
  let t = 0;
  for (const d of list) {
    out.push(a + (t / total) * (b - a));
    t += d;
  }
  out.push(b);
  return out;
};
const STEP_STOPS = [...plants(WALK_OUT, SCENE.walkA, SCENE.walkB), ...plants(WALK_ON, SCENE.nearWalkA, SCENE.nearWalkB)];

/**
 * Where the page should come to rest after the scroll stops at p, moving in
 * direction dir, or null to stay. Near a scene's rest it eases onto it. In the
 * middle of a walk he finishes the step he is on. Everywhere else it stays.
 */
export function settleAt(p: number, dir: number): number | null {
  const y = yOf(p);
  for (const r of [SCENE.landRest, SCENE.walkRest, SCENE.helmRest]) {
    if (Math.abs(yOf(r) - y) < 0.3) return r;
  }
  if (LAST - p < 0.04 + 1e-6 && yOf(LAST) - y < 0.3) return LAST;
  const inWalk = (p > SCENE.walkA && p < SCENE.walkB) || (p > SCENE.nearWalkA && p < SCENE.nearWalkB);
  if (!inWalk) return null;
  let best: number | null = null;
  for (const q of STEP_STOPS) {
    if (dir > 0 && q >= p - 1e-4 && (best === null || q < best)) best = q;
    if (dir < 0 && q <= p + 1e-4 && (best === null || q > best)) best = q;
  }
  return best;
}

// ------------------------------------------------------------------ the scenes

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const seg = (x: number, a: number, b: number) => clamp((x - a) / (b - a), 0, 1);
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Landing phase from the scroll: 0 docked, 0.84 touchdown, 1 settled. */
export const landAt = (p: number) => seg(p, SCENE.landA, SCENE.landB);

/** How far the ramp is open. */
export const rampAt = (p: number) => seg(p, SCENE.rampA, SCENE.rampB);

/** Surface progress, which carries the camera and the hour: 0 landed, 1 first steps, 2 helmet, 3 touch. */
export function surfaceAt(p: number) {
  if (p <= SCENE.landB) return 0;
  if (p <= SCENE.walkB) return 0.96 * smooth(seg(p, SCENE.landB, SCENE.walkB));
  if (p <= SCENE.flyA) return 0.96 + 0.04 * seg(p, SCENE.walkB, SCENE.flyA);
  if (p <= SCENE.flyB) return 1 + smooth(seg(p, SCENE.flyA, SCENE.flyB));
  // The camera does not move at all for the helmet, nor while he stands bare headed after it.
  if (p <= SCENE.nearA) return 2;
  // Then a slow push in that only ever gets closer, and down to the sand.
  if (p <= SCENE.camDown) return 2 + 0.97 * smooth(Math.pow(seg(p, SCENE.nearA, SCENE.camDown), 1.15));
  return 2.97 + 0.03 * seg(p, SCENE.camDown, LAST);
}
