// The instruments every movement draws from. Each one owns its nodes and
// cleans up after itself: notes disconnect when they end, pads stop their old
// oscillators once a crossfade is over.
import { mtof, kr } from "./dsp";
import type { Movement } from "./movement";

type Render = (sr: number, f: number, midi: number) => Float32Array;

/**
 * A rendered instrument. Each pitch is synthesised once, on first use, into a
 * small mono buffer and then replayed. The cache is capped so a long visit
 * does not grow memory.
 */
export class Sampler {
  private cache = new Map<number, AudioBuffer>();
  private rcache = new Map<number, AudioBuffer>();
  active = 0;
  constructor(private m: Movement, private render: Render, private max = 18, private poly = 10) {}

  buffer(midi: number, rev = false): AudioBuffer {
    const map = rev ? this.rcache : this.cache;
    let b = map.get(midi);
    if (b) return b;
    const sr = this.m.st.bufRate;
    let d: Float32Array;
    if (rev) {
      const fwd = this.buffer(midi);
      d = new Float32Array(fwd.length);
      fwd.copyFromChannel(d, 0);
      d.reverse();
    } else d = this.render(sr, mtof(midi), midi);
    b = this.m.ac.createBuffer(1, d.length, sr);
    b.getChannelData(0).set(d);
    if (map.size >= this.max) map.delete(map.keys().next().value as number);
    map.set(midi, b);
    return b;
  }

  /** Render a few notes ahead of time, a little at a time. */
  warm(midis: number[]) {
    const list = midis.slice();
    const next = () => {
      const m = list.shift();
      if (m === undefined || this.m.disposed) return;
      this.buffer(m);
      if (list.length) setTimeout(next, 30);
    };
    setTimeout(next, 60);
  }

  /**
   * Play a note. t is when it sounds; for a reversed note, t is when the
   * swell arrives. dur cuts the note short with a soft release.
   */
  play(midi: number, t: number, gain: number, dest: AudioNode, o?: { dur?: number; rate?: number; rev?: boolean; fade?: number }): AudioBufferSourceNode | null {
    if (this.active >= this.poly || gain <= 0.00001) return null;
    const ac = this.m.ac;
    const buf = this.buffer(midi, !!o?.rev);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const rate = o?.rate ?? 1;
    if (rate !== 1) src.playbackRate.value = rate;
    const g = ac.createGain();
    let start = t, offset = 0;
    if (o?.rev) {
      start = t - buf.duration / rate;
      if (start < ac.currentTime) {
        offset = (ac.currentTime - start) * rate;
        start = ac.currentTime;
      }
    }
    const fade = o?.fade ?? (offset > 0 ? 0.05 : 0);
    if (fade > 0) {
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + fade);
    } else g.gain.value = gain;
    let end = start + (buf.duration - offset) / rate;
    if (o?.dur) {
      const stopAt = start + o.dur;
      g.gain.setTargetAtTime(0, stopAt, Math.max(0.015, o.dur * 0.25));
      end = Math.min(end, stopAt + Math.max(0.1, o.dur * 1.5));
    }
    src.connect(g).connect(dest);
    src.start(start, offset);
    src.stop(end + 0.02);
    this.active++;
    src.onended = () => {
      this.active--;
      src.disconnect();
      g.disconnect();
    };
    return src;
  }
}

// ---------------------------------------------------------------------------

export interface PadOpts {
  wave: PeriodicWave;
  voices: number;
  lo: number;
  hi: number;
  detune: number; // cents between the left and right copy of each voice
  cutoff: number;
  q?: number;
  level: number;
  mode: "swap" | "glide";
  xfade?: number; // seconds, swap mode
  glide?: number; // seconds, glide mode
  lfo?: number; // Hz, slow breathing of level and brightness
}

interface Bank {
  gain: GainNode;
  oscs: OscillatorNode[];
  gains: GainNode[];
  merger: ChannelMergerNode;
}

/**
 * A held chord. Each voice is two oscillators, one in each ear, detuned
 * against each other, so the chord is wide without any stereo effect on top.
 * In swap mode each new chord is a fresh bank that crossfades in, like a
 * section of players changing bow together; in glide mode the voices slide.
 */
export class Pad {
  readonly out: GainNode;
  readonly filter: BiquadFilterNode;
  notes: number[] = [];
  private bank: Bank | null = null;
  private two: boolean;

  constructor(private m: Movement, dest: AudioNode, readonly o: PadOpts) {
    const ac = m.ac;
    this.two = !m.phone;
    this.filter = m.own(ac.createBiquadFilter());
    this.filter.type = "lowpass";
    this.filter.frequency.value = o.cutoff;
    this.filter.Q.value = o.q ?? 0.5;
    kr(this.filter.frequency, this.filter.Q);
    this.out = m.own(ac.createGain());
    this.out.gain.value = o.level;
    this.filter.connect(this.out).connect(dest);
    if (o.lfo) {
      const l1 = m.src(ac.createOscillator());
      l1.frequency.value = o.lfo;
      const d1 = m.own(ac.createGain());
      d1.gain.value = o.level * 0.18;
      l1.connect(d1).connect(this.out.gain);
      const l2 = m.src(ac.createOscillator());
      l2.frequency.value = o.lfo * 0.71;
      const d2 = m.own(ac.createGain());
      d2.gain.value = o.cutoff * 0.28;
      l2.connect(d2).connect(this.filter.frequency);
      l1.start();
      l2.start();
    }
  }

  get n() {
    return this.o.voices;
  }

  private makeBank(notes: number[], t: number): Bank {
    const ac = this.m.ac;
    const merger = ac.createChannelMerger(2);
    const gain = ac.createGain();
    gain.gain.value = 0;
    merger.connect(gain).connect(this.filter);
    const oscs: OscillatorNode[] = [], gains: GainNode[] = [];
    const per = 1 / notes.length;
    notes.forEach((midi, i) => {
      const sides = this.two ? [0, 1] : [-1];
      for (const side of sides) {
        const o = ac.createOscillator();
        kr(o.frequency, o.detune);
        o.setPeriodicWave(this.o.wave);
        o.frequency.value = mtof(midi);
        o.detune.value = side === -1 ? 0 : (side ? 1 : -1) * this.o.detune * (0.6 + 0.4 * ((i * 7) % 5) / 4);
        this.m.bend.connect(o.detune);
        const g = ac.createGain();
        g.gain.value = per * (side === -1 ? 0.7 : 0.5);
        o.connect(g);
        if (side === -1) {
          g.connect(merger, 0, 0);
          g.connect(merger, 0, 1);
        } else g.connect(merger, 0, side);
        o.start(t);
        oscs.push(o);
        gains.push(g);
      }
    });
    return { gain, oscs, gains, merger };
  }

  private drop(b: Bank, at: number) {
    for (const o of b.oscs) o.stop(at);
    b.oscs[0].onended = () => {
      for (const o of b.oscs) {
        o.disconnect();
        try { this.m.bend.disconnect(o.detune); } catch { /* already gone */ }
      }
      for (const g of b.gains) g.disconnect();
      b.merger.disconnect();
      b.gain.disconnect();
    };
  }

  /** Move to new notes at time t. */
  set(notes: number[], t: number) {
    this.notes = notes;
    if (this.o.mode === "glide" && this.bank) {
      const tau = (this.o.glide ?? 2) / 3;
      const b = this.bank;
      notes.forEach((midi, i) => {
        const k = this.two ? 2 : 1;
        for (let s = 0; s < k; s++) b.oscs[i * k + s]?.frequency.setTargetAtTime(mtof(midi), t, tau);
      });
      return;
    }
    const x = this.o.xfade ?? 3;
    const old = this.bank;
    const b = this.makeBank(notes, t);
    b.gain.gain.setValueAtTime(0, t);
    b.gain.gain.setTargetAtTime(1, t, old ? x / 4 : x / 3);
    if (old) {
      old.gain.gain.setTargetAtTime(0, t + x * 0.1, x / 3);
      this.drop(old, t + x * 2.2);
    }
    this.bank = b;
  }

  stop(at: number) {
    if (this.bank) this.drop(this.bank, at);
    this.bank = null;
  }
}

// ---------------------------------------------------------------------------

/**
 * One persistent voice for bass lines and drones: it glides between notes and
 * its envelope is drawn on a single gain, so it never stacks up.
 */
export class Mono {
  readonly out: GainNode;
  readonly osc: OscillatorNode;
  readonly sub: OscillatorNode | null;
  readonly filter: BiquadFilterNode;
  readonly lo: number;
  readonly hi: number;
  note = 0;

  constructor(m: Movement, dest: AudioNode, o: { wave: PeriodicWave; cutoff: number; level: number; sub?: number; lo: number; hi: number }) {
    const ac = m.ac;
    this.lo = o.lo;
    this.hi = o.hi;
    this.osc = m.src(ac.createOscillator());
    this.osc.setPeriodicWave(o.wave);
    this.filter = m.own(ac.createBiquadFilter());
    this.filter.type = "lowpass";
    this.filter.frequency.value = o.cutoff;
    this.filter.Q.value = 0.6;
    kr(this.osc.frequency, this.osc.detune, this.filter.frequency);
    this.out = m.own(ac.createGain());
    this.out.gain.value = 0;
    const lvl = m.own(ac.createGain());
    lvl.gain.value = o.level;
    this.osc.connect(this.filter);
    if (o.sub) {
      this.sub = m.src(ac.createOscillator());
      this.sub.type = "sine";
      kr(this.sub.frequency);
      const sg = m.own(ac.createGain());
      sg.gain.value = o.sub;
      this.sub.connect(sg).connect(this.filter);
      this.sub.start();
    } else this.sub = null;
    this.filter.connect(this.out).connect(lvl).connect(dest);
    this.osc.start();
  }

  glide(midi: number, t: number, seconds = 0.3) {
    this.note = midi;
    const f = mtof(midi);
    this.osc.frequency.setTargetAtTime(f, t, seconds / 3);
    this.sub?.frequency.setTargetAtTime(f, t, seconds / 3);
  }
  /** A struck note: quick rise, then decay toward a held level. */
  hit(midi: number, t: number, vel: number, decay: number, hold = 0) {
    this.glide(midi, t, 0.06);
    const g = this.out.gain;
    g.setTargetAtTime(vel, t, 0.012);
    g.setTargetAtTime(vel * hold, t + 0.05, decay / 3);
  }
  /** A held note that swells in. */
  swell(midi: number, t: number, vel: number, seconds: number) {
    this.glide(midi, t, seconds * 0.5);
    this.out.gain.setTargetAtTime(vel, t, seconds / 3);
  }
  release(t: number, seconds: number) {
    this.out.gain.setTargetAtTime(0, t, seconds / 3);
  }
}

// ---------------------------------------------------------------------------

export interface LeadOpts {
  wave: PeriodicWave;
  attack: number;
  release: number;
  cutoff: number;
  vib?: number; // cents
  vibRate?: number;
  detune?: number; // cents, adds a second oscillator
  glideFrom?: number; // MIDI note to slide from
  glideTime?: number;
}

/** A live note with its own envelope and a vibrato that arrives late. */
export function lead(m: Movement, dest: AudioNode, midi: number, t: number, dur: number, vel: number, o: LeadOpts) {
  const ac = m.ac;
  const end = t + dur + o.release * 4;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = o.cutoff;
  kr(f.frequency);
  f.Q.value = 0.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.setTargetAtTime(vel, t, o.attack / 3);
  g.gain.setTargetAtTime(0, t + dur, o.release / 3);
  f.connect(g).connect(dest);
  const oscs: OscillatorNode[] = [];
  const count = o.detune && !m.phone ? 2 : 1;
  let lfo: OscillatorNode | null = null, depth: GainNode | null = null;
  if (o.vib) {
    lfo = ac.createOscillator();
    lfo.frequency.value = o.vibRate ?? 5;
    depth = ac.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.setTargetAtTime(o.vib, t + Math.min(0.6, dur * 0.4), 0.4);
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(end);
  }
  for (let i = 0; i < count; i++) {
    const osc = ac.createOscillator();
    kr(osc.frequency, osc.detune);
    osc.setPeriodicWave(o.wave);
    const hz = mtof(midi);
    if (o.glideFrom !== undefined) {
      osc.frequency.setValueAtTime(mtof(o.glideFrom), t);
      osc.frequency.exponentialRampToValueAtTime(hz, t + (o.glideTime ?? 0.4));
    } else osc.frequency.value = hz;
    if (count === 2) osc.detune.value = (i ? 1 : -1) * (o.detune ?? 0) * 0.5;
    depth?.connect(osc.detune);
    const sg = ac.createGain();
    sg.gain.value = 1 / count;
    osc.connect(sg).connect(f);
    osc.start(t);
    osc.stop(end);
    oscs.push(osc);
    osc.onended = () => {
      osc.disconnect();
      sg.disconnect();
      if (i === 0) {
        f.disconnect();
        g.disconnect();
        lfo?.disconnect();
        depth?.disconnect();
      }
    };
  }
}

/** A soft low thud with a falling pitch: heartbeats and distant drums. */
export function thud(m: Movement, dest: AudioNode, t: number, f0: number, f1: number, dur: number, level: number) {
  const ac = m.ac;
  const o = ac.createOscillator();
  kr(o.frequency);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const o2 = ac.createOscillator();
  kr(o2.frequency);
  o2.frequency.setValueAtTime(f0 * 2, t);
  o2.frequency.exponentialRampToValueAtTime(f1 * 2, t + dur);
  const g2 = ac.createGain();
  g2.gain.value = 0.42;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.012);
  g.gain.setTargetAtTime(0, t + 0.02, dur / 3);
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(dest);
  o.start(t);
  o2.start(t);
  o.stop(t + dur * 2.5);
  o2.stop(t + dur * 2.5);
  o.onended = () => {
    o.disconnect();
    o2.disconnect();
    g2.disconnect();
    g.disconnect();
  };
}

/** A tiny sine glint: the hover sound. */
export function glint(m: Movement, dest: AudioNode, midi: number, t: number, level: number, dur = 0.07) {
  const ac = m.ac;
  const o = ac.createOscillator();
  o.frequency.value = mtof(midi);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.004);
  g.gain.setTargetAtTime(0, t + 0.006, dur / 3);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur * 2.5);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

/**
 * Breath: pink noise through a moving vocal band. Each breath is drawn as an
 * inhale and a longer exhale, the band rising and falling with it.
 */
export class Breath {
  readonly out: GainNode;
  private band: BiquadFilterNode;
  private env: GainNode;
  constructor(m: Movement, dest: AudioNode, private centre = 700) {
    const ac = m.ac;
    const src = m.src(ac.createBufferSource());
    src.buffer = m.st.noise;
    src.loop = true;
    this.band = m.own(ac.createBiquadFilter());
    this.band.type = "bandpass";
    this.band.frequency.value = centre;
    this.band.Q.value = 0.9;
    kr(this.band.frequency);
    const lp = m.own(ac.createBiquadFilter());
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    this.env = m.own(ac.createGain());
    this.env.gain.value = 0;
    this.out = m.own(ac.createGain());
    src.connect(this.band).connect(lp).connect(this.env).connect(this.out).connect(dest);
    src.start();
  }
  breathe(t: number, inhale: number, exhale: number, level: number) {
    const g = this.env.gain, f = this.band.frequency;
    g.setTargetAtTime(level, t, inhale / 2.5);
    f.setTargetAtTime(this.centre * 1.5, t, inhale / 2);
    g.setTargetAtTime(level * 0.04, t + inhale, exhale / 3);
    f.setTargetAtTime(this.centre * 0.7, t + inhale, exhale / 2);
  }
}
