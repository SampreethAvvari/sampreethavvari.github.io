// Signal math for the score. Everything here is plain number crunching into
// Float32Arrays: rooms (impulse responses), plucked strings, bells, struck
// wood and stone, FM tones and a felt piano. Rendering in plain JS instead of
// running live oscillators keeps the audio thread light: a rendered note costs
// one buffer source while it plays.
//
// Partials use a rotating phasor (two multiplies a sample) instead of
// Math.sin, and every envelope is a per sample multiply, so a three second
// bell renders in a couple of milliseconds.

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const dbg = (db: number): number => Math.pow(10, db / 20);

/**
 * Run params once per 128 sample block instead of every sample. A moving
 * pitch or filter at audio rate costs about ten times more CPU, and for slow
 * glides, bends and sweeps nobody can hear the difference.
 */
export function kr(...ps: (AudioParam | undefined)[]) {
  for (const p of ps) {
    if (!p) continue;
    try { (p as AudioParam & { automationRate: string }).automationRate = "k-rate"; } catch { /* fixed rate or unsupported */ }
  }
}

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4" to a MIDI note number. */
export function nm(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error("bad note " + name);
  return 12 * (Number(m[3]) + 1) + LETTER[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
/** "D3 A3 E4" to MIDI note numbers. */
export const ns = (s: string): number[] => s.trim().split(/\s+/).map(nm);

export type Rng = () => number;
/** Small seeded generator, so a score can be rendered twice the same way. */
export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Finishing touches every rendered buffer gets: no DC, no click at either end,
// peak at a known level.

export function finish(d: Float32Array, sr: number, peak = 0.9, tail = 0.04, lp = 8000): Float32Array {
  // two gentle one pole low passes: no rendered note keeps a hard edge on top
  if (lp < sr * 0.45) {
    const a = 1 - Math.exp((-2 * Math.PI * lp) / sr);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < d.length; i++) {
      s1 += a * (d[i] - s1);
      s2 += a * (s1 - s2);
      d[i] = s2;
    }
  }
  // one pole DC blocker
  let x1 = 0, y1 = 0;
  const r = 1 - (2 * Math.PI * 18) / sr;
  for (let i = 0; i < d.length; i++) {
    const y = d[i] - x1 + r * y1;
    x1 = d[i];
    y1 = y;
    d[i] = y;
  }
  const n = Math.min(d.length, Math.floor(tail * sr));
  for (let i = 0; i < n; i++) d[d.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) {
    const g = peak / m;
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Additive voices.

export interface Part {
  f: number; // Hz
  a: number; // amplitude
  decay: number; // seconds to fall to 1/e
  attack?: number; // seconds
  phase?: number;
}

/** Sum of exponentially decaying partials. Partials near Nyquist are skipped. */
export function additive(sr: number, dur: number, parts: Part[], into?: Float32Array): Float32Array {
  const n = Math.ceil(sr * dur);
  const d = into ?? new Float32Array(n);
  const limit = Math.min(sr * 0.42, 9500);
  for (const p of parts) {
    if (p.f <= 0 || p.f >= limit || p.a === 0) continue;
    const w = (2 * Math.PI * p.f) / sr;
    const cw = Math.cos(w), sw = Math.sin(w);
    let c = Math.cos(p.phase ?? 0), s = Math.sin(p.phase ?? 0);
    const k = Math.exp(-1 / (p.decay * sr));
    const att = Math.max(1, Math.floor((p.attack ?? 0.002) * sr));
    let e = p.a;
    for (let i = 0; i < n; i++) {
      const env = i < att ? e * (0.5 - 0.5 * Math.cos((Math.PI * i) / att)) : e;
      d[i] += s * env;
      const c2 = c * cw - s * sw;
      s = s * cw + c * sw;
      c = c2;
      e *= k;
      if (e < 2e-5 && i > att) break;
    }
  }
  return d;
}

/** A short burst of lowpassed noise: the felt, the finger, the mallet. */
export function thump(d: Float32Array, sr: number, rng: Rng, level: number, ms: number, cutoff: number) {
  const n = Math.min(d.length, Math.floor((ms / 1000) * sr));
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const env = Math.sin((Math.PI * i) / n);
    lp += a * ((rng() * 2 - 1) - lp);
    lp2 += a * (lp - lp2);
    d[i] += lp2 * env * level;
  }
}

export interface BellSpec {
  ratios: number[];
  amps: number[];
  decays: number[]; // seconds, at 440 Hz; scaled by pitch
  beat?: number; // Hz of slow beating between paired partials
  attack?: number;
  strike?: number; // level of a soft strike transient
}

export function bell(sr: number, f: number, dur: number, spec: BellSpec, rng: Rng): Float32Array {
  const parts: Part[] = [];
  const scale = Math.pow(440 / f, 0.35);
  for (let i = 0; i < spec.ratios.length; i++) {
    const pf = f * spec.ratios[i];
    const decay = spec.decays[i] * scale;
    const a = spec.amps[i];
    if (spec.beat && i < 3) {
      parts.push({ f: pf - spec.beat * 0.5, a: a * 0.5, decay, attack: spec.attack, phase: rng() * 6.28 });
      parts.push({ f: pf + spec.beat * 0.5, a: a * 0.5, decay, attack: spec.attack, phase: rng() * 6.28 });
    } else parts.push({ f: pf, a, decay, attack: spec.attack, phase: rng() * 6.28 });
  }
  const d = additive(sr, dur, parts);
  if (spec.strike) thump(d, sr, rng, spec.strike, 4, Math.min(4000, f * 3));
  return finish(d, sr);
}

// Bell families. Ratios are partials relative to the played note.
export const BELLS: Record<string, BellSpec> = {
  // clear glass: almost pure, a twelfth and a little shimmer
  glass: { ratios: [1, 2.0, 3.0, 4.16], amps: [1, 0.18, 0.12, 0.04], decays: [2.6, 1.2, 0.7, 0.35], beat: 0.6, attack: 0.002 },
  // a star: soft attack, long, two inharmonic partials that make it float
  star: { ratios: [1, 2.0, 2.76, 5.4], amps: [1, 0.22, 0.16, 0.05], decays: [3.6, 1.8, 1.3, 0.5], beat: 0.35, attack: 0.012 },
  // celesta: harmonic, quick upper partials, a felt strike
  celesta: { ratios: [1, 2, 3, 4], amps: [1, 0.3, 0.08, 0.05], decays: [1.8, 0.6, 0.25, 0.15], attack: 0.002, strike: 0.08 },
  // music box tine: bright second mode, short
  tine: { ratios: [1, 5.93, 2.0], amps: [1, 0.12, 0.08], decays: [1.4, 0.18, 0.5], attack: 0.0015, strike: 0.05 },
  // a church bell far away: hum below, minor third, fifth, nominal
  toll: { ratios: [0.5, 1, 1.19, 1.5, 2.0, 2.52], amps: [0.6, 1, 0.55, 0.3, 0.35, 0.12], decays: [7, 4.5, 3.6, 2.2, 1.8, 1.0], beat: 0.25, attack: 0.004, strike: 0.04 },
  // a spark from a fire: tiny and high
  spark: { ratios: [1, 2.32, 4.1], amps: [1, 0.3, 0.1], decays: [0.5, 0.18, 0.08], attack: 0.001 },
};

// Struck wood, stone and bars: modal synthesis, a few damped modes.
export interface ModalSpec { ratios: number[]; amps: number[]; decays: number[]; strike: number; strikeCut: number }
export const MODES: Record<string, ModalSpec> = {
  frame: { ratios: [1, 1.59, 2.14, 2.65], amps: [1, 0.45, 0.25, 0.12], decays: [0.32, 0.16, 0.09, 0.06], strike: 0.25, strikeCut: 900 },
  stone: { ratios: [1, 2.31, 3.89, 5.2], amps: [1, 0.5, 0.25, 0.1], decays: [0.09, 0.05, 0.03, 0.02], strike: 0.35, strikeCut: 2600 },
  wood: { ratios: [1, 2.57, 4.21], amps: [1, 0.35, 0.12], decays: [0.18, 0.07, 0.04], strike: 0.2, strikeCut: 1800 },
  marimba: { ratios: [1, 3.93, 9.2], amps: [1, 0.22, 0.04], decays: [0.9, 0.22, 0.06], strike: 0.06, strikeCut: 1500 },
  // the click: a soft key, short and tuned
  key: { ratios: [1, 2.0, 3.01], amps: [1, 0.16, 0.05], decays: [0.07, 0.035, 0.02], strike: 0.12, strikeCut: 2200 },
};

export function modal(sr: number, f: number, dur: number, spec: ModalSpec, rng: Rng): Float32Array {
  const scale = Math.pow(220 / f, 0.25);
  const parts: Part[] = spec.ratios.map((r, i) => ({ f: f * r, a: spec.amps[i], decay: spec.decays[i] * scale, attack: 0.0008, phase: 0 }));
  const d = additive(sr, dur, parts);
  thump(d, sr, rng, spec.strike, 3, spec.strikeCut);
  return finish(d, sr, 0.9, 0.01);
}

// ---------------------------------------------------------------------------
// Plucked string: Karplus Strong with a tuned allpass, a soft pick and a
// two tap loop filter. bright 0..1, t60 seconds at the fundamental.

export function pluck(sr: number, f: number, dur: number, o: { bright: number; t60: number; pick: number }, rng: Rng): Float32Array {
  const n = Math.ceil(sr * dur);
  const out = new Float32Array(n);
  const P = sr / f;
  const b = 0.5 - 0.22 * o.bright; // loop filter tap, 0.5 is darkest
  const want = P - b;
  const N = Math.max(2, Math.floor(want - 0.15));
  const frac = want - N;
  const C = (1 - frac) / (1 + frac);
  const g = Math.pow(0.001, 1 / (f * o.t60));
  const buf = new Float32Array(N);
  // excitation: noise through two soft one poles and a smooth window (a
  // finger more than a pick), then a pick position comb
  const a = 0.06 + 0.5 * o.bright;
  let lp = 0, lp2 = 0, mean = 0;
  for (let i = 0; i < N; i++) {
    lp += a * ((rng() * 2 - 1) - lp);
    lp2 += a * (lp - lp2);
    buf[i] = lp2 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / N));
    mean += buf[i];
  }
  mean /= N;
  for (let i = 0; i < N; i++) buf[i] -= mean;
  const pk = Math.max(1, Math.round(o.pick * N));
  for (let i = N - 1; i >= pk; i--) buf[i] -= buf[i - pk];
  let idx = 0, prev = 0, apx = 0, apy = 0;
  for (let i = 0; i < n; i++) {
    const x = buf[idx];
    out[i] = x;
    const l = (1 - b) * x + b * prev;
    prev = x;
    const y = C * l + apx - C * apy;
    apx = l;
    apy = y;
    buf[idx] = y * g;
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  // a short fade in takes the edge off the first sample of noise
  const fi = Math.floor(sr * 0.0015);
  for (let i = 0; i < fi; i++) out[i] *= i / fi;
  return finish(out, sr);
}

// ---------------------------------------------------------------------------
// Two operator FM: a glassy, thinking bell. The index falls faster than the
// tone, so the attack is complex and the tail is nearly pure.

export function fm(sr: number, f: number, dur: number, o: { ratio: number; index: number; indexDecay: number; decay: number }): Float32Array {
  const n = Math.ceil(sr * dur);
  const d = new Float32Array(n);
  // keep sidebands under about 7 kHz
  const index = o.index * Math.min(1, 1300 / (f * o.ratio));
  const wc = (2 * Math.PI * f) / sr, wm = (2 * Math.PI * f * o.ratio) / sr;
  const ki = Math.exp(-1 / (o.indexDecay * sr)), ke = Math.exp(-1 / (o.decay * sr));
  let pc = 0, pm = 0, I = index, e = 1;
  const att = Math.floor(sr * 0.003);
  for (let i = 0; i < n; i++) {
    const env = i < att ? e * (i / att) : e;
    d[i] = Math.sin(pc + I * Math.sin(pm)) * env;
    pc += wc;
    pm += wm;
    if (pc > 6.283185307179586) pc -= 6.283185307179586;
    if (pm > 6.283185307179586) pm -= 6.283185307179586;
    I *= ki;
    e *= ke;
  }
  return finish(d, sr);
}

// ---------------------------------------------------------------------------
// Felt piano: slightly stretched partials, two strings per note beating
// slowly, upper partials soft and short, a felt thump on the attack.

export function piano(sr: number, f: number, dur: number, rng: Rng, soft = 1): Float32Array {
  const B = 0.00035;
  const T = 2.4 * Math.pow(261.6 / f, 0.35);
  const parts: Part[] = [];
  for (let k = 1; k <= 11; k++) {
    const pf = k * f * Math.sqrt(1 + B * k * k);
    if (pf > 5200) break;
    const a = Math.pow(k, -(1.5 + 0.6 * soft)) * (k === 1 ? 1 : 0.9);
    const decay = T / (1 + 0.55 * (k - 1));
    parts.push({ f: pf * (1 - 0.00025), a: a * 0.5, decay, attack: 0.003, phase: rng() * 6.28 });
    parts.push({ f: pf * (1 + 0.00025), a: a * 0.5, decay: decay * 0.92, attack: 0.003, phase: rng() * 6.28 });
  }
  const d = additive(sr, dur, parts);
  thump(d, sr, rng, 0.05, 6, 700);
  return finish(d, sr);
}

// ---------------------------------------------------------------------------
// Noise for breath and air. Pink, so it has no hiss on top.

export function pink(sr: number, seconds: number, rng: Rng): Float32Array {
  const n = Math.ceil(sr * seconds);
  const d = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  // loop point: crossfade the end into the start
  const x = Math.floor(sr * 0.05);
  for (let i = 0; i < x; i++) {
    const t = i / x;
    d[i] = d[i] * t + d[n - x + i] * (1 - t);
  }
  return d.subarray(0, n - x);
}

// ---------------------------------------------------------------------------
// Rooms. A procedural impulse response: a few early reflections off near
// walls, then a dense tail whose high end dies faster than its body, the way
// air and soft surfaces swallow treble. Left and right are drawn from
// different noise so the tail is wide and does not collapse in the middle.

export interface RoomSpec {
  rt60: number; // seconds to fall 60 dB
  length: number; // seconds of buffer
  predelay: number; // seconds before the tail
  early: number; // count of early reflections
  earlyLevel: number;
  hi: number; // Hz, tail cutoff at the start
  lo: number; // Hz, tail cutoff at the end
  damp: number; // seconds for the cutoff to fall
  lowCut: number; // Hz
  bloom: number; // seconds for the tail to swell in (0 for a hard room)
  width: number; // 0 mono to 1 fully wide
}

export function room(sr: number, o: RoomSpec, rng: Rng): [Float32Array, Float32Array] {
  const n = Math.ceil(sr * o.length);
  const chans: Float32Array[] = [new Float32Array(n), new Float32Array(n)];
  const pre = Math.floor(o.predelay * sr);
  const kd = Math.exp(Math.log(0.001) / (o.rt60 * sr));
  const aLow = 1 - Math.exp((-2 * Math.PI * o.lowCut) / sr);
  for (const d of chans) {
    let lp = 0, lp2 = 0, hs = 0, env = 1, a = 0.5, bl = 1;
    for (let i = pre; i < n; i++) {
      if (((i - pre) & 63) === 0) {
        const t = (i - pre) / sr;
        const fc = o.lo + (o.hi - o.lo) * Math.exp(-t / o.damp);
        a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
        bl = o.bloom > 0 ? 1 - Math.exp(-t / o.bloom) : 1;
      }
      lp += a * ((rng() * 2 - 1) * env * bl - lp);
      lp2 += a * (lp - lp2);
      hs += aLow * (lp2 - hs);
      d[i] = lp2 - hs;
      env *= kd;
    }
    // early reflections, each smeared a little: walls are not mirrors
    for (let e = 0; e < o.early; e++) {
      const at = Math.floor((0.003 + Math.pow(rng(), 1.4) * Math.max(0.01, o.predelay * 1.6 + 0.02)) * sr);
      const amp = o.earlyLevel * Math.pow(1 - e / (o.early + 1), 1.5) * (rng() < 0.5 ? -1 : 1);
      const w = 6 + Math.floor(rng() * 18);
      for (let j = 0; j < w && at + j < n; j++) d[at + j] += (amp * Math.sin((Math.PI * (j + 0.5)) / w)) / (w * 0.5);
    }
  }
  const [L, R] = chans;
  // width: shrink the side signal
  if (o.width < 1) {
    for (let i = 0; i < n; i++) {
      const m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5 * o.width;
      L[i] = m + s;
      R[i] = m - s;
    }
  }
  // fade the last tenth and normalise the energy so the wet level is the
  // same from room to room
  const f = Math.floor(n * 0.1);
  let eL = 0, eR = 0;
  for (let i = 0; i < n; i++) {
    if (i > n - f) {
      const g = 0.5 + 0.5 * Math.cos((Math.PI * (i - (n - f))) / f);
      L[i] *= g;
      R[i] *= g;
    }
    eL += L[i] * L[i];
    eR += R[i] * R[i];
  }
  const g = 1 / Math.sqrt(Math.max(1e-9, (eL + eR) * 0.5));
  for (let i = 0; i < n; i++) {
    L[i] *= g;
    R[i] *= g;
  }
  return [L, R];
}

// ---------------------------------------------------------------------------
// Wavetables for the live voices, as harmonic amplitudes from the first up.

export const WAVES: Record<string, number[]> = {
  // a soft choir: formant humps near the third and fifth harmonics
  choir: [1, 0.42, 0.62, 0.26, 0.38, 0.12, 0.08, 0.05, 0.03, 0.02],
  // warm: falls off like a triangle but keeps its even harmonics
  warm: [1, 0.3, 0.13, 0.07, 0.045, 0.03, 0.02, 0.014],
  // glass: nearly a sine, a hollow twelfth on top
  glass: [1, 0.04, 0.14, 0.0, 0.05, 0.0, 0.02],
  // reed: odd harmonics lead, for the learning voice's goal
  reed: [1, 0.08, 0.42, 0.05, 0.22, 0.03, 0.1, 0.02, 0.05],
  // bowed: a filtered saw with a body resonance around the fourth harmonic
  bowed: [1, 0.55, 0.42, 0.4, 0.3, 0.2, 0.15, 0.12, 0.09, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.015],
  // air: a sine with a touch of colour
  air: [1, 0.12, 0.04],
  // organ: low drawbars, the drone under everything
  organ: [1, 0.5, 0.3, 0.14, 0.0, 0.07, 0.0, 0.04],
};

export function makeWave(ac: BaseAudioContext, amps: number[]): PeriodicWave {
  const real = new Float32Array(amps.length + 1);
  const imag = new Float32Array(amps.length + 1);
  for (let i = 0; i < amps.length; i++) imag[i + 1] = amps[i];
  return ac.createPeriodicWave(real, imag);
}
/** A cosine, for orbits: a sine and this one together trace a circle. */
export function cosWave(ac: BaseAudioContext): PeriodicWave {
  return ac.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]), { disableNormalization: true });
}
