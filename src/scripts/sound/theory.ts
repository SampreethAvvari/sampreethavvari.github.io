// Harmony. Chords are written the way a musician would write them ("Am9",
// "D9/F#", "Bbmaj7#11") and voiced automatically with real voice leading:
// every voice moves to the nearest note of the next chord, voices do not
// cross, and low notes are kept apart so the bottom stays clear.

const ROOT: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Chord tones in order of importance: the first ones are kept when a pad has
// fewer voices than the chord has notes.
const QUALITY: Record<string, number[]> = {
  "": [4, 7, 0],
  m: [3, 7, 0],
  "5": [7, 0, 2],
  sus2: [2, 7, 0],
  sus4: [5, 7, 0, 2],
  add9: [4, 2, 7, 0],
  madd9: [3, 2, 7, 0],
  "6": [4, 9, 7, 0],
  "69": [4, 9, 2, 7, 0],
  maj7: [4, 11, 7, 0],
  maj9: [4, 11, 2, 7, 0],
  "maj7#11": [4, 11, 6, 7, 0],
  "maj9#11": [4, 11, 6, 2, 7],
  "7": [4, 10, 7, 0],
  "9": [4, 10, 2, 7, 0],
  "7sus4": [5, 10, 7, 0],
  "9sus4": [5, 10, 2, 7, 0],
  "7b9": [4, 10, 1, 7, 0],
  m7: [3, 10, 7, 0],
  m9: [3, 10, 2, 7, 0],
  m11: [3, 10, 5, 2, 7],
  m7b5: [3, 10, 6, 0],
  mmaj9: [3, 11, 2, 7, 0],
  // quartal: stacked fourths, voiced as a stack
  q: [0, 5, 10, 3, 8],
};

export interface Chord {
  name: string;
  root: number; // pitch class
  pcs: number[]; // pitch classes, most important first
  bass: number; // pitch class of the bass
  quartal: boolean;
}

export function chord(sym: string): Chord {
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
  if (!m) throw new Error("bad chord " + sym);
  const acc = (s: string) => (s === "#" ? 1 : s === "b" ? -1 : 0);
  const root = (ROOT[m[1]] + acc(m[2]) + 12) % 12;
  const q = QUALITY[m[3]];
  if (!q) throw new Error("bad quality " + sym);
  const bass = m[4] ? (ROOT[m[4]] + acc(m[5] || "") + 12) % 12 : root;
  return { name: sym, root, pcs: q.map((i) => (root + i) % 12), bass, quartal: m[3] === "q" };
}
export const chords = (s: string): Chord[] => s.trim().split(/\s+/).map(chord);

// Every ordering of n items, made once.
const PERMS: number[][][] = [];
function perms(n: number): number[][] {
  if (PERMS[n]) return PERMS[n];
  const out: number[][] = [];
  const a = Array.from({ length: n }, (_, i) => i);
  const c = new Array(n).fill(0);
  out.push(a.slice());
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const k = i % 2 ? c[i] : 0;
      [a[k], a[i]] = [a[i], a[k]];
      out.push(a.slice());
      c[i]++;
      i = 0;
    } else c[i++] = 0;
  }
  return (PERMS[n] = out);
}

function nearestPc(target: number, pc: number, lo: number, hi: number): number {
  let m = target - ((((target - pc) % 12) + 12) % 12);
  if (target - m > 6) m += 12;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

/**
 * Voice a chord for n voices between lo and hi, moving as little as possible
 * from prev. With no prev, the voices start evenly spread.
 */
export function voice(c: Chord, n: number, prev: number[] | null, lo: number, hi: number): number[] {
  if (!prev || prev.length !== n) {
    prev = Array.from({ length: n }, (_, i) => Math.round(lo + 5 + ((hi - lo - 8) * i) / Math.max(1, n - 1)));
  }
  if (c.quartal) {
    // a stack of fourths from the root nearest the old bottom voice
    let base = nearestPc(prev[0], c.root, lo, hi);
    if (base + 5 * (n - 1) > hi + 2) base -= 12;
    if (base < lo - 2) base += 12;
    return Array.from({ length: n }, (_, i) => base + 5 * i);
  }
  const targets: number[] = c.pcs.slice(0, n);
  // doubling: root first, then the fifth, then whatever is next
  const dbl = [c.root, (c.root + 7) % 12, ...c.pcs];
  for (let i = 0; targets.length < n; i++) targets.push(dbl[i % dbl.length]);
  let best: number[] = [], bestCost = Infinity;
  const cand = new Array<number>(n);
  for (const p of perms(n)) {
    let cost = 0;
    for (let i = 0; i < n; i++) {
      cand[i] = nearestPc(prev[i], targets[p[i]], lo, hi);
      cost += Math.abs(cand[i] - prev[i]);
    }
    const s = cand.slice().sort((a, b) => a - b);
    for (let i = 1; i < n; i++) {
      const gap = s[i] - s[i - 1];
      if (gap === 0) cost += 7;
      else if (gap < 3 && s[i - 1] < 55) cost += 5;
      else if (gap === 1) cost += 1.5;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = s;
    }
  }
  return best;
}

/** The bass note: the chord's bass, nearest the last one, inside the range. */
export function bassOf(c: Chord, prev: number | null, lo: number, hi: number): number {
  return nearestPc(prev ?? Math.round((lo + hi) / 2), c.bass, lo, hi);
}

/** Pitch classes common to two sets: the pivot when one movement hands to the next. */
export function common(a: number[], b: number[]): number[] {
  const s = new Set(a.map((x) => ((x % 12) + 12) % 12));
  return b.filter((x) => s.has(((x % 12) + 12) % 12));
}

// Scales, as pitch classes from the tonic.
export const MODES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

/** A scale degree (any integer, negative goes down) to a MIDI note. */
export function deg(tonic: number, mode: number[], d: number): number {
  const n = mode.length;
  const o = Math.floor(d / n);
  return tonic + 12 * o + mode[((d % n) + n) % n];
}

/** Nearest note to m whose pitch class is in pcs. */
export function snap(m: number, pcs: number[]): number {
  let best = m, bd = 99;
  for (let d = 0; d <= 6; d++) {
    for (const s of [m - d, m + d]) {
      if (pcs.includes(((s % 12) + 12) % 12) && d < bd) {
        best = s;
        bd = d;
      }
    }
    if (bd < 99) break;
  }
  return best;
}

/** Chord tones of a chord across a register, low to high. */
export function tonesIn(c: Chord, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (c.pcs.includes(m % 12)) out.push(m);
  return out;
}
