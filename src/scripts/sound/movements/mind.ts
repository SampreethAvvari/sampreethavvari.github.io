// VI. Leaving the Ground. Mind: a star map of everything built.
//
// Each bell is a star. It appears at its own place around the listener
// (above, behind, to the side), rings and fades. Now and then a soft tone
// glides from one star's note to another's while it travels between their
// places: a line drawn between two stars. B Lydian, the brightest mode, its
// raised fourth never quite settling. Under everything a shimmer rises
// forever without getting higher (octaves fading in at the bottom as they
// fade out at the top). The room has no walls and no echoes, only a long
// slow bloom.
//
// The map is the main thing here, so the music stays calm and follows it. Flying
// is this page's scroll: a rush of air and an opening filter that settle when the
// visitor stops. Toward the centre of the map the bed gets fuller and warmer.
// Choosing a star plays a tone of its kind and the world leans in for a moment. A
// pointer crossing the map touches stars very softly, and filters thin or fill
// the stars a little.
import { Movement } from "../movement";
import { chords, tonesIn, bassOf, type Chord } from "../theory";
import { Pad, Mono, Sampler, Flutter, lead } from "../instruments";
import { bell, BELLS, dbg, nm, kr, mtof, hashStr, type RoomSpec } from "../dsp";

const A = chords("Bmaj9#11 C#9/B G#m9 F#maj9");
const B = chords("D#m7 G#m9 C#9 Bmaj9#11");

// the theme of the suite, in Lydian: B, F#, E#, C#
const MOTIF = ["B5", "F#6", "E#6", "C#6"];

export class Mind extends Movement {
  readonly id = "mind";
  bpm = 48;
  div = 2;
  beats = 4;
  protected bright = 3400;
  protected wet = 1.15;
  protected trim = 1.17;
  protected bedSend = 0.6;
  protected tapLevel = dbg(-20);
  protected tapLo = 79;
  protected tapHi = 91;
  protected grainLo = 78;
  protected grainHi = 93;

  private star!: Sampler;
  private skies: { bus: GainNode; pan: PannerNode }[] = [];
  private sky = 0;
  private deep!: Mono;
  private bassM = nm("B1");
  private line!: { bus: GainNode; pan: PannerNode };
  private last: { m: number; x: number; y: number; z: number } | null = null;
  private shep: { o: OscillatorNode; g: GainNode; end: number; base: number }[] = [];
  private shepBus!: GainNode;
  private window = new Float32Array(64);
  private rushG: GainNode | null = null;
  private rushF!: BiquadFilterNode;
  private near = 0;
  private sparkle = 1;
  private filters = new Set<string>();
  private soft = new Flutter(0.14, 0.05, 0.7, 0.8, 4);
  private touch!: GainNode;

  /** Stars are written for the far distance they ring at. */
  themeLevel(): number {
    return 1;
  }

  protected room(): RoomSpec {
    return { rt60: 4.2, length: 3.8, predelay: 0.04, early: 0, earlyLevel: 0, hi: 7000, lo: 1600, damp: 1.5, lowCut: 120, bloom: 0.3, width: 1 };
  }

  private sphere(): [number, number, number] {
    const az = this.rng() * Math.PI * 2, el = -0.15 + this.rng() * 1.1, r = 2.2 + this.rng() * 2.5;
    return [r * Math.sin(az) * Math.cos(el), r * Math.sin(el), -r * Math.cos(az) * Math.cos(el)];
  }

  protected setup(t: number) {
    const r = this.rng;
    this.sections = [
      { bars: 2, prog: A, per: 2, layers: { choir: 0.8, deep: 0.6, shepard: 0.5 } },
      { bars: 8, prog: A, per: 2, layers: { choir: 1, deep: 1, stars: 1, motif: 1, shepard: 0.6 } },
      { bars: 8, prog: B, per: 2, layers: { choir: 1, deep: 1, stars: 1, lines: 1, shepard: 0.8 } },
      { bars: 8, prog: A, per: 2, layers: { choir: 1, deep: 0.8, stars: 0.7, lines: 0.6, motif: 1, shepard: 1 } },
      { bars: 4, prog: B, per: 2, layers: { choir: 0.8, stars: 0.4, shepard: 1 } },
    ];
    this.pads.push(new Pad(this, this.layer("choir", 0, this.bed), {
      wave: this.st.wave("choir"), voices: this.phone ? 3 : 5, lo: 54, hi: 79, detune: 10, cutoff: 2000, level: 0.09, mode: "glide", glide: 4.5, lfo: 0.035,
    }));
    this.deep = new Mono(this, this.layer("deep", 0.2), { wave: this.st.wave("organ"), cutoff: 600, level: 0.05, sub: 0.25, lo: 35, hi: 47 });

    // a pool of places in the sky; each new star takes the next one
    const n = this.phone ? 2 : 4;
    for (let i = 0; i < n; i++) {
      const pan = this.panner(true);
      this.setPos(pan, ...this.sphere());
      const bus = this.gain(1, pan);
      pan.connect(this.dry);
      pan.connect(this.gain(0.7, this.verbIn));
      this.skies.push({ bus, pan });
    }
    {
      const pan = this.panner();
      const bus = this.layer("lines", 0, pan);
      pan.connect(this.dry);
      pan.connect(this.gain(0.8, this.verbIn));
      this.line = { bus, pan };
    }

    // the endless rise: six sines an octave apart, each climbing for six
    // octaves and fading in and out along the way
    this.shepBus = this.layer("shepard", 0.7, this.phone ? this.dry : this.orbit(1.6, 47, 1.4, 0, 0.7, 1, false));
    for (let i = 0; i < 64; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 63);
    const voices = this.phone ? 4 : 6;
    for (let k = 0; k < voices; k++) {
      const o = this.src(this.ac.createOscillator());
      kr(o.frequency);
      const g = this.gain(0, this.shepBus);
      o.connect(g);
      o.start(t);
      this.shep.push({ o, g, end: t, base: k / voices });
    }
    this.star = new Sampler(this, (sr, f) => bell(sr, f, 3.2, BELLS.star, r), 24, 10, "stars");
    this.tap = new Sampler(this, (sr, f) => bell(sr, f, 0.7, BELLS.spark, r), 12, 5);
    this.grains = this.star;
    this.star.warm([nm("B5"), nm("D#6"), nm("F#5"), nm("A#5"), nm("C#6")]);
    this.touch = this.bus(1, 0.6, undefined, true);
  }

  // ---- the map ---------------------------------------------------------------
  pageEvent(name: string, d: Record<string, unknown>, x: number) {
    if (!this.out || this.disposed) return;
    if (name === "mind:fly") this.fly(Number(d.i) || 0);
    else if (name === "mind:depth") this.depth(Number(d.near) || 0);
    else if (name === "mind:focus") this.focusOn(String(d.kind ?? ""), String(d.id ?? ""));
    else if (name === "mind:hover") this.brushStar(String(d.kind ?? ""), String(d.id ?? ""), x);
    else if (name === "mind:filter") this.filter(String(d.kind ?? ""), !!d.on);
  }

  /** Flying: air and light with the speed, gone again when the visitor stops. */
  private fly(i: number) {
    const ac = this.ac;
    const t = ac.currentTime;
    if (!this.rushG) {
      const src = this.src(ac.createBufferSource());
      src.buffer = this.st.noise;
      src.loop = true;
      this.rushF = this.own(ac.createBiquadFilter());
      this.rushF.type = "bandpass";
      this.rushF.Q.value = 0.7;
      kr(this.rushF.frequency);
      this.rushG = this.gain(0, this.air);
      src.connect(this.rushF).connect(this.rushG);
      src.start(t, 2.1);
    }
    this.rushG.gain.setTargetAtTime(dbg(-27) * Math.pow(i, 1.3), t, i > 0 ? 0.2 : 0.55);
    this.rushF.frequency.setTargetAtTime(420 + 2600 * i, t, 0.2);
    this.scrollI = i;
    this.brighten(t, i > 0 ? 0.2 : 0.6);
    this.shepBus.gain.setTargetAtTime(Math.max(this.lv("shepard"), 0.4) * (1 + i), t, 0.4);
  }

  /** Nearer the centre: a fuller bed, warmer on top, a closer room, more floor. */
  private depth(near: number) {
    const n = (this.near = Math.max(0, Math.min(1, near)));
    const t = this.ac.currentTime;
    this.bed.gain.setTargetAtTime(0.8 + 0.5 * n, t, 0.5);
    this.bright = 3400 - 1500 * n;
    this.brighten(t, 0.6);
    this.verbOut.gain.setTargetAtTime(this.wet * (1 - 0.22 * n), t, 0.8);
    this.st.deep.leanOn({ sub: 5 * n, growl: 14 * n, rumble: 5 * n, harm: 6 * n, hall: -3 * n }, t, 0.7);
  }

  private kindTone(kind: string, lo: number, hi: number, id = ""): number {
    const tones = tonesIn(this.chord, lo, hi);
    const k = hashStr(kind + id);
    return tones.length ? tones[k % tones.length] : lo;
  }

  /** A star or a planet chosen: a tone of its kind, and the world leans in. */
  private focusOn(kind: string, id: string) {
    const t = this.ac.currentTime + 0.01;
    const m = this.kindTone(kind, 72, 86);
    this.star.play(m, t, dbg(-21), this.touch, { force: true });
    this.star.play(this.kindTone(kind + id, 79, 91), t + 0.09, dbg(-29), this.touch, { force: true });
    lead(this, this.touch, m - 24, t, 1.1, dbg(-29), { wave: this.st.wave("air"), attack: 0.08, release: 1, cutoff: 1500 });
    this.st.deep.hit(t, dbg(-19), { oct: 1, from: 1.3, sweep: 0.12, dur: 0.9 });
    const g = this.bed.gain, f = this.bedLow.frequency;
    const base = 0.8 + 0.5 * this.near;
    g.setTargetAtTime(base * 0.62, t, 0.12);
    g.setTargetAtTime(base, t + 1.3, 0.7);
    f.setTargetAtTime(this.brightNow() * 0.5, t, 0.12);
    f.setTargetAtTime(this.brightNow(), t + 1.3, 0.8);
  }

  /** The pointer crossing the map: barely there, and it thins out as it goes. */
  private brushStar(kind: string, id: string, x: number) {
    const now = this.ac.currentTime;
    const v = this.soft.next(now);
    if (v <= 0) return;
    this.place(this.fxPan, x, 0.4, now);
    this.tap.play(this.kindTone(kind, 79, 93, id), now + 0.005, dbg(-34) * v, this.fx, { dur: 0.28, force: true });
  }

  /** A filter: a small change in how many stars there are, and two quiet notes. */
  private filter(kind: string, on: boolean) {
    if (on) this.filters.add(kind);
    else this.filters.delete(kind);
    this.sparkle = Math.max(0.5, 1 - 0.1 * this.filters.size);
    const t = this.ac.currentTime + 0.01;
    const m = this.kindTone(kind, 74, 86);
    this.tap.play(on ? m : m + 5, t, dbg(-31), this.fx, { dur: 0.3, force: true });
    this.tap.play(on ? m + 5 : m, t + 0.09, dbg(-33), this.fx, { dur: 0.35, force: true });
  }

  /** Keep each rising sine scheduled a cycle ahead. */
  private rise(t: number) {
    const voices = this.shep.length;
    const octaves = voices;
    const cycle = this.phone ? 160 : 240; // seconds to climb all the octaves
    const f0 = mtof(nm("B1"));
    const peak = dbg(-31);
    for (const s of this.shep) {
      if (s.end > t + 8) continue;
      const start = Math.max(s.end + 0.005, t);
      // the first lap starts part way up so the voices are spread out
      const frac = s.base;
      const len = cycle * (1 - frac);
      const p = s.o.frequency, g = s.g.gain;
      p.setValueAtTime(f0 * Math.pow(2, octaves * frac), start);
      p.exponentialRampToValueAtTime(f0 * Math.pow(2, octaves), start + len);
      const k0 = Math.floor(frac * 63);
      const curve = new Float32Array(64 - k0);
      for (let i = 0; i < curve.length; i++) curve[i] = this.window[k0 + i] * peak;
      g.setValueAtTime(curve[0], start);
      g.setValueCurveAtTime(curve, start + 0.001, len - 0.02);
      s.end = start + len;
      s.base = 0;
    }
  }

  protected onChord(c: Chord, t: number) {
    this.bassM = bassOf(c, this.bassM, 35, 47);
    this.deep.swell(this.bassM, t, 0.8, 3);
  }

  protected onBar(t: number) {
    this.rise(t);
    const L = this.S.layers;
    // a line between two stars, now and then
    if (L.lines && this.last && this.rng() < 0.4) {
      const to = this.pick(tonesIn(this.chord, 74, 86));
      const [x, y, z] = this.sphere();
      const at = t + this.stepDur * 2;
      const p = this.line.pan;
      this.setPos(p, this.last.x, this.last.y, this.last.z, at);
      if (p.positionX) {
        p.positionX.setTargetAtTime(x, at + 0.3, 0.9);
        p.positionY.setTargetAtTime(y, at + 0.3, 0.9);
        p.positionZ.setTargetAtTime(z, at + 0.3, 0.9);
      }
      lead(this, this.line.bus, to, at, 2.8, dbg(-24), { wave: this.st.wave("air"), attack: 0.6, release: 1.8, cutoff: 3000, key: "lines", glideFrom: this.last.m - 12 > 70 ? this.last.m - 12 : this.last.m, glideTime: 2.2 });
    }
    // the theme as a constellation: four stars, one per beat
    if (L.motif && this.secBar % 4 === 1) {
      MOTIF.forEach((name, i) => this.starAt(nm(name), t + i * (60 / this.bpm), dbg(-12) * L.motif));
    }
  }

  private starAt(m: number, t: number, level: number) {
    const s = this.skies[this.sky];
    this.sky = (this.sky + 1) % this.skies.length;
    const [x, y, z] = this.sphere();
    this.setPos(s.pan, x, y, z, t - 0.02);
    this.star.play(m, t, level, s.bus);
    this.last = { m, x, y, z };
  }

  protected step(_pos: number, t: number) {
    const L = this.S.layers;
    if (L.stars && this.rng() < 0.2 * L.stars * this.sparkle) {
      const tones = tonesIn(this.chord, 74, 91);
      if (tones.length) this.starAt(this.pick(tones), this.hum(t, 120), dbg(-11) * L.stars * (0.5 + 0.5 * this.rng()));
    }
  }

  protected onScroll(i: number, _dir: number, _dt: number, t: number) {
    if (i <= 0 && !this.scrollI) return;
    // scrolling brightens the endless rise, like stars streaming past
    this.shepBus.gain.setTargetAtTime(Math.max(this.lv("shepard"), 0.4) * (1 + 1.5 * i), t, 0.3);
  }
}
