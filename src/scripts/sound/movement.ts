// A movement: one tab's piece of music. The base class gives every movement
// the same skeleton so each piece only has to compose:
//
//   - a clock on the audio timeline (steps, bars, a form made of sections
//     that bring layers in and out, each with its own chord progression),
//   - its own room (a procedural impulse response) and spatial buses that
//     sit or orbit around the listener,
//   - a bed bus for held sounds, which the pointer and scrolling bend
//     (filter, a resonant tilt, a few cents of pitch),
//   - interaction sounds placed where the pointer is,
//   - a musical handover when the visitor changes tab: the outgoing piece
//     moves its held chord onto the incoming piece's first chord as it fades,
//     so the two overlap on the same harmony in two different rooms.
import type { Studio } from "./studio";
import { room, type RoomSpec, mulberry, type Rng, dbg, kr, BELLS, bell, MODES, modal } from "./dsp";
import { type Chord, voice, tonesIn, common } from "./theory";
import { Sampler, Pad, Mono, glint } from "./instruments";

export interface Section {
  bars: number;
  prog: Chord[];
  per?: number; // bars per chord
  layers: Record<string, number>;
}

/** Fit a voicing to n voices (when the piece before had more or fewer). */
function fit(from: number[], n: number): number[] {
  if (from.length === n) return from.slice();
  if (from.length > n) return Array.from({ length: n }, (_, i) => from[Math.round((i * (from.length - 1)) / Math.max(1, n - 1))]);
  const out = from.slice();
  while (out.length < n) out.push(out[out.length - 1] + 5);
  return out;
}

export abstract class Movement {
  abstract readonly id: string;
  readonly ac: BaseAudioContext;
  readonly st: Studio;
  readonly phone: boolean;
  readonly rng: Rng;

  // graph
  out!: GainNode;
  dry!: GainNode;
  verbIn!: GainNode;
  verbOut!: GainNode;
  bed!: GainNode;
  bedLow!: BiquadFilterNode;
  tilt!: BiquadFilterNode;
  fx!: GainNode;
  fxPan!: PannerNode;
  air!: GainNode;
  bend!: ConstantSourceNode;
  private keep: AudioNode[] = [];
  private srcs: AudioScheduledSourceNode[] = [];
  private hrtf: number;

  // clock and form
  bpm = 60;
  div = 4;
  beats = 4;
  protected sections: Section[] = [];
  protected loopFrom = 1;
  protected sec = 0;
  protected secBar = -1;
  protected cycle = 0;
  protected bar = -1;
  protected stepI = 0;
  protected nextT = 0;
  released = false;
  disposed = false;

  // harmony
  chord!: Chord;
  protected pads: Pad[] = [];
  protected basses: Mono[] = [];
  protected layers: Record<string, GainNode> = {};

  // touch
  protected tap!: Sampler;
  protected tapLo = 74;
  protected tapHi = 88;
  protected tapLevel = dbg(-27);
  protected grains!: Sampler;
  protected grainLo = 74;
  protected grainHi = 89;
  protected bright = 2600;
  protected wet = 0.9;
  /** Output trim, so every movement sits at about the same loudness. */
  protected trim = 1;
  protected bedSend = 0.35;
  protected scrollI = 0;
  protected scrollDir = 1;
  protected pageP = 0;
  protected pointerM = 0;
  private grainAcc = 0;
  private grainIdx = 0;
  private travel = 0;
  private lastBright = 0;

  constructor(st: Studio, seed = (Math.random() * 1e9) | 0) {
    this.st = st;
    this.ac = st.ac;
    this.phone = st.phone;
    this.rng = mulberry(seed);
    // HRTF panning costs real CPU, so it goes to sources that move, sit
    // behind or above the listener; fixed side points pan by level
    this.hrtf = st.phone ? 2 : 5;
  }

  // ---- what each movement writes ------------------------------------------
  protected abstract room(): RoomSpec;
  /** Build the layers. Called once, at start. */
  protected abstract setup(t: number): void;
  /** Called on every step of the grid; pos is the step inside the bar. */
  protected abstract step(pos: number, t: number): void;
  protected onBar(_t: number): void {}
  protected onChord(_c: Chord, _t: number): void {}
  protected onSection(s: Section, t: number): void {
    for (const k in this.layers) this.layers[k].gain.setTargetAtTime(s.layers[k] ?? 0, t, 1.4);
  }

  // ---- helpers ------------------------------------------------------------
  own<T extends AudioNode>(n: T): T {
    this.keep.push(n);
    return n;
  }
  src<T extends AudioScheduledSourceNode>(n: T): T {
    this.keep.push(n);
    this.srcs.push(n);
    return n;
  }
  gain(v: number, dest?: AudioNode | AudioParam): GainNode {
    const g = this.own(this.ac.createGain());
    g.gain.value = v;
    if (dest instanceof AudioParam) g.connect(dest);
    else if (dest) g.connect(dest);
    return g;
  }
  /** A bus that plays dry and into the room. */
  bus(level: number, send: number, dest: AudioNode = this.dry): GainNode {
    const g = this.gain(level, dest);
    if (send > 0) g.connect(this.gain(send, this.verbIn));
    return g;
  }
  /** A named layer: its level follows the form. */
  layer(name: string, send: number, dest?: AudioNode): GainNode {
    const g = this.bus(0, send, dest);
    this.layers[name] = g;
    return g;
  }
  protected get S(): Section {
    return this.sections[this.sec];
  }
  protected lv(name: string): number {
    return this.sections.length ? this.S.layers[name] ?? 0 : 0;
  }
  protected get spb(): number {
    return this.div * this.beats;
  }
  protected get stepDur(): number {
    return 60 / this.bpm / this.div;
  }
  /** A little human looseness in time. */
  protected hum(t: number, ms = 8): number {
    return t + ((this.rng() - 0.5) * 2 * ms) / 1000;
  }
  protected pick<T>(a: T[]): T {
    return a[Math.floor(this.rng() * a.length)];
  }
  get voicing(): number[] {
    return this.pads[0]?.notes.length ? this.pads[0].notes : tonesIn(this.chord, 55, 72);
  }

  protected panner(hrtf = false): PannerNode {
    const p = this.own(this.ac.createPanner());
    p.panningModel = hrtf && this.hrtf-- > 0 ? "HRTF" : "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = 1;
    p.rolloffFactor = 0.7;
    p.maxDistance = 40;
    kr(p.positionX, p.positionY, p.positionZ);
    return p;
  }
  protected setPos(p: PannerNode, x: number, y: number, z: number, t?: number) {
    if (p.positionX) {
      if (t === undefined) {
        p.positionX.value = x;
        p.positionY.value = y;
        p.positionZ.value = z;
      } else {
        p.positionX.setTargetAtTime(x, t, 0.012);
        p.positionY.setTargetAtTime(y, t, 0.012);
        p.positionZ.setTargetAtTime(z, t, 0.012);
      }
    } else p.setPosition(x, y, z);
  }
  /** A source fixed at a point around the listener (metres; -z is ahead). */
  point(x: number, y: number, z: number, send = 0.3, level = 1, hrtf = false): GainNode {
    const p = this.panner(hrtf);
    this.setPos(p, x, y, z);
    const g = this.gain(level);
    g.connect(p);
    p.connect(this.dry);
    if (send > 0) p.connect(this.gain(send, this.verbIn));
    return g;
  }
  /** A source that circles the listener: radius, seconds a lap, height, phase. */
  orbit(r: number, period: number, y: number, phase: number, send = 0.4, level = 1, hrtf = true): GainNode {
    const p = this.panner(hrtf);
    const ac = this.ac;
    const g = this.gain(level);
    g.connect(p);
    p.connect(this.dry);
    if (send > 0) p.connect(this.gain(send, this.verbIn));
    if (!p.positionX) {
      p.setPosition(Math.cos(phase) * r, y, Math.sin(phase) * r);
      return g;
    }
    p.positionX.value = 0;
    p.positionY.value = y;
    p.positionZ.value = 0;
    const c = Math.cos(phase), s = Math.sin(phase);
    const wx = ac.createPeriodicWave(new Float32Array([0, c]), new Float32Array([0, s]), { disableNormalization: true });
    const wz = ac.createPeriodicWave(new Float32Array([0, -s]), new Float32Array([0, c]), { disableNormalization: true });
    const ox = this.src(ac.createOscillator()), oz = this.src(ac.createOscillator());
    ox.setPeriodicWave(wx);
    oz.setPeriodicWave(wz);
    ox.frequency.value = oz.frequency.value = 1 / period;
    ox.connect(this.gain(r, p.positionX));
    oz.connect(this.gain(r, p.positionZ));
    ox.start();
    oz.start();
    return g;
  }
  /** Screen position (0..1) to a place on a sphere in front of the listener. */
  protected place(p: PannerNode, x: number, y: number, t: number, r = 1.4) {
    const az = (x - 0.5) * 1.6, el = (0.5 - y) * 0.7;
    this.setPos(p, r * Math.sin(az) * Math.cos(el), r * Math.sin(el), -r * Math.cos(az) * Math.cos(el), t);
  }

  // ---- life ---------------------------------------------------------------
  start(t: number, fadeIn: number, from: number[] | null) {
    const ac = this.ac;
    this.out = this.gain(0, this.st.bus);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.setTargetAtTime(this.trim, t, fadeIn / 3.5);
    this.dry = this.gain(1, this.out);

    // the room
    const spec = { ...this.room() };
    if (this.phone) {
      spec.length = Math.min(spec.length, 2.6);
      spec.rt60 = Math.min(spec.rt60, 2.2);
      spec.early = Math.min(spec.early, 6);
    }
    const [L, R] = room(ac.sampleRate, spec, mulberry(11 + this.id.length));
    const ir = ac.createBuffer(2, L.length, ac.sampleRate);
    ir.getChannelData(0).set(L);
    ir.getChannelData(1).set(R);
    const conv = this.own(ac.createConvolver());
    conv.normalize = false;
    conv.buffer = ir;
    this.verbIn = this.gain(1);
    this.verbOut = this.gain(this.wet, this.out);
    this.verbIn.connect(conv).connect(this.verbOut);

    // the bed: held sounds, bent by pointer and scroll
    this.bed = this.gain(1);
    this.bedLow = this.own(ac.createBiquadFilter());
    this.bedLow.type = "lowpass";
    this.bedLow.frequency.value = this.bright;
    this.bedLow.Q.value = 0.6;
    this.tilt = this.own(ac.createBiquadFilter());
    this.tilt.type = "peaking";
    this.tilt.frequency.value = 900;
    this.tilt.Q.value = 0.9;
    this.tilt.gain.value = 0;
    kr(this.bedLow.frequency, this.tilt.frequency, this.tilt.gain);
    this.bed.connect(this.bedLow).connect(this.tilt).connect(this.dry);
    this.tilt.connect(this.gain(this.bedSend, this.verbIn));
    this.bend = this.src(ac.createConstantSource());
    this.bend.offset.value = 0;
    this.bend.start(t);

    // touch sounds sit where the pointer is; scroll shimmer circles overhead
    this.fxPan = this.panner(true);
    this.place(this.fxPan, 0.5, 0.5, t);
    this.fx = this.gain(1);
    this.fx.connect(this.fxPan);
    this.fxPan.connect(this.dry);
    this.fxPan.connect(this.gain(0.32, this.verbIn));
    this.air = this.phone ? this.bus(0.8, 0.6) : this.orbit(2.4, 31, 0.9, 0.5, 0.65, 0.8);

    const r = this.rng;
    this.tap = new Sampler(this, (sr, f) => modal(sr, f, 0.22, MODES.key, r), 14, 6);
    this.grains = new Sampler(this, (sr, f) => bell(sr, f, 1.6, BELLS.star, r), 14, 10);

    this.setup(t);
    // the first section's layers are already in place; the output fade is
    // the only fade in, so a handover has no hole in the middle
    // arriving from another tab skips the intro: the music is already going
    if (from && this.sections.length > 1) this.sec = 1;
    const first = this.S.layers;
    if (Object.keys(first).length) for (const k in this.layers) this.layers[k].gain.setValueAtTime(first[k] ?? 0, t);
    this.harmony(this.S.prog[0], t, from);
    if (from) this.arrive(t, from);
    this.nextT = t + 0.03;
    this.stepI = 0;
  }

  /** Fade out. With a next chord, held voices move onto it as they go. */
  release(t: number, seconds: number, next: Chord | null) {
    if (this.released || !this.out) return;
    if (next) this.harmony(next, t);
    this.released = true;
    // hold for a moment while the next piece rises, then let go
    this.out.gain.setTargetAtTime(0, t + 0.35, seconds / 3.5);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const t = this.ac.currentTime;
    for (const p of this.pads) p.stop(t);
    for (const s of this.srcs) {
      try { s.stop(); } catch { /* never started */ }
    }
    for (const n of this.keep) {
      try { n.disconnect(); } catch { /* gone */ }
    }
    this.keep.length = 0;
    this.srcs.length = 0;
  }

  /** Schedule everything due before a time on the audio clock. */
  tick(until: number) {
    if (this.disposed || !this.out) return;
    const sd = this.stepDur;
    const now = this.ac.currentTime;
    if (this.nextT < now - 0.15) {
      const k = Math.ceil((now - this.nextT) / sd);
      this.nextT += k * sd;
      this.stepI += k;
    }
    let guard = 0;
    while (this.nextT < until && guard++ < 96) {
      const pos = this.stepI % this.spb;
      if (pos === 0) this.barStart(this.nextT);
      this.step(pos, this.nextT);
      this.stepI++;
      this.nextT += sd;
    }
  }

  private barStart(t: number) {
    this.bar++;
    if (!this.sections.length) return this.onBar(t);
    this.secBar++;
    let S = this.sections[this.sec];
    if (this.secBar >= S.bars) {
      this.secBar = 0;
      this.sec++;
      if (this.sec >= this.sections.length) {
        this.sec = Math.min(this.loopFrom, this.sections.length - 1);
        this.cycle++;
      }
      S = this.sections[this.sec];
    }
    if (this.secBar === 0) this.onSection(S, t);
    const per = S.per ?? 1;
    if (!this.released && this.secBar % per === 0) {
      const c = S.prog[Math.floor(this.secBar / per) % S.prog.length];
      if (c !== this.chord) this.harmony(c, t);
    }
    this.onBar(t);
  }

  /** Change chord: every pad voice leads to its nearest new note. */
  protected harmony(c: Chord, t: number, from?: number[] | null) {
    this.chord = c;
    for (const p of this.pads) {
      const prev = from ? fit(from, p.n) : p.notes.length ? p.notes : null;
      p.set(voice(c, p.n, prev, p.o.lo, p.o.hi), t);
    }
    this.onChord(c, t);
  }

  /** Arriving from another tab: a soft bell on a note both pieces share. */
  protected arrive(t: number, from: number[]) {
    const shared = common(from, tonesIn(this.chord, this.grainLo - 12, this.grainHi - 6));
    const m = shared.length ? shared[Math.floor(shared.length / 2)] : tonesIn(this.chord, 72, 84)[0];
    if (m !== undefined) this.grains.play(m, t + 0.25, dbg(-27), this.air);
  }

  // ---- the visitor --------------------------------------------------------
  click(x: number, y: number) {
    if (!this.out || this.disposed) return;
    const t = this.ac.currentTime + 0.004;
    this.place(this.fxPan, x, y, t);
    this.onClick(t, x, y);
  }
  protected onClick(t: number, x: number, _y: number) {
    const tones = tonesIn(this.chord, this.tapLo, this.tapHi);
    if (!tones.length) return;
    this.tap.play(tones[Math.min(tones.length - 1, Math.floor(x * tones.length))], t, this.tapLevel, this.fx);
  }
  hover(x: number, y: number) {
    if (!this.out || this.disposed) return;
    const t = this.ac.currentTime + 0.004;
    this.place(this.fxPan, x, y, t);
    const tones = tonesIn(this.chord, this.tapLo + 12, this.tapHi + 10);
    if (tones.length) glint(this, this.fx, tones[Math.min(tones.length - 1, Math.floor(x * tones.length))], t, dbg(-44), 0.05);
  }
  /** Scrolling: i is speed 0..1, dir is +1 down, p how far down the page. */
  scroll(i: number, dir: number, p: number, dy: number, dt: number) {
    if (!this.out || this.disposed) return;
    this.scrollI = i;
    this.scrollDir = dir;
    this.pageP = p;
    const t = this.ac.currentTime;
    this.brighten(t, 0.18);
    this.onScroll(i, dir, dt, t);
    // reading pace: a soft detent every third of a screen
    this.travel += Math.abs(dy);
    if (this.travel > 0.34) {
      this.travel = 0;
      if (i < 0.45) this.detent(t, dir);
    }
    // faster: a shimmer of chord tones, rising as you go down the page
    this.grainAcc += Math.max(0, i - 0.15) * 10 * dt;
    while (this.grainAcc >= 1) {
      this.grainAcc -= 1;
      this.grain(t + this.rng() * 0.05, dir, i);
    }
  }
  protected onScroll(_i: number, _dir: number, _dt: number, _t: number) {}
  protected detent(t: number, dir: number) {
    const tones = tonesIn(this.chord, this.tapLo + 7, this.tapHi + 7);
    if (!tones.length) return;
    this.grainIdx = (this.grainIdx + (dir >= 0 ? 1 : -1) + tones.length * 4) % tones.length;
    glint(this, this.air, tones[this.grainIdx], t, dbg(-41), 0.09);
  }
  protected grain(t: number, dir: number, i: number) {
    const tones = tonesIn(this.chord, this.grainLo, this.grainHi);
    if (!tones.length) return;
    this.grainIdx = (this.grainIdx + (dir >= 0 ? 1 : -1) + tones.length * 4) % tones.length;
    this.grains.play(tones[this.grainIdx], t, dbg(-33) * (0.45 + 0.55 * i), this.air, { dur: 0.22 + 0.3 * this.rng() });
  }
  pointer(m: number, _x: number, y: number) {
    if (!this.out || this.disposed) return;
    this.pointerM = m;
    const t = this.ac.currentTime;
    this.brighten(t, 0.12);
    this.tilt.frequency.setTargetAtTime(320 + (1 - y) * 1500, t, 0.1);
    this.tilt.gain.setTargetAtTime(m * 4.5, t, 0.15);
    this.bend.offset.setTargetAtTime(m * 8, t, m > 0.04 ? 0.08 : 0.5);
  }
  /** Move the bed's brightness, skipping changes too small to hear. */
  protected brighten(t: number, tau: number) {
    const b = this.brightNow();
    if (Math.abs(b - this.lastBright) < this.lastBright * 0.02) return;
    this.lastBright = b;
    this.bedLow.frequency.setTargetAtTime(b, t, tau);
  }
  protected brightNow(): number {
    return Math.min(9000, this.bright * (1 + 0.9 * this.pointerM + 1.1 * this.scrollI));
  }
  /** The home flight: continuous progress 0..7 and its speed. */
  journey(_p: number, _v: number) {}
  chapter(_i: number) {}
  /** A headline arriving word by word (home only). */
  words(_d: { words: string[]; items: number; wordStagger: number; itemStagger: number; delay: number }, _late?: number) {}
  /** Cancel word notes that have not sounded yet. */
  hush() {}
  /** Architecture: a system was brought into focus (null clears it). */
  focus(_d: { slug: string; title?: string; discipline?: string } | null) {}
  /** Architecture: replayed traffic, 0..1. */
  flow(_i: number) {}
  /** Home: the jump between two worlds; speed in chapters a second. */
  jump(_from: number, _to: number, _dir: number, _speed: number) {}
  /** Make the next scheduled step the first of a new bar. */
  protected alignBar() {
    const spb = this.spb;
    if (this.stepI % spb !== 0) this.stepI += spb - (this.stepI % spb);
  }
}
