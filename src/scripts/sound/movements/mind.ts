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
import { Movement } from "../movement";
import { chords, tonesIn, bassOf, type Chord } from "../theory";
import { Pad, Mono, Sampler, lead } from "../instruments";
import { bell, BELLS, dbg, nm, kr, mtof, type RoomSpec } from "../dsp";

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

  protected room(): RoomSpec {
    return { rt60: 6.0, length: 7.0, predelay: 0.04, early: 0, earlyLevel: 0, hi: 7000, lo: 1600, damp: 1.5, lowCut: 120, bloom: 0.3, width: 1 };
  }

  private sphere(): [number, number, number] {
    const az = this.rng() * Math.PI * 2, el = -0.15 + this.rng() * 1.1, r = 2.2 + this.rng() * 2.5;
    return [r * Math.sin(az) * Math.cos(el), r * Math.sin(el), -r * Math.cos(az) * Math.cos(el)];
  }

  protected setup(t: number) {
    const r = this.rng;
    this.sections = [
      { bars: 2, prog: A, per: 2, layers: { choir: 0.8, deep: 0.6, shepard: 0.5 } },
      { bars: 8, prog: A, per: 2, layers: { choir: 1, deep: 1, stars: 1, shepard: 0.6 } },
      { bars: 8, prog: B, per: 2, layers: { choir: 1, deep: 1, stars: 1, lines: 1, shepard: 0.8 } },
      { bars: 8, prog: A, per: 2, layers: { choir: 1, deep: 0.8, stars: 0.7, lines: 0.6, motif: 1, shepard: 1 } },
      { bars: 4, prog: B, per: 2, layers: { choir: 0.8, stars: 0.4, shepard: 1 } },
    ];
    this.pads.push(new Pad(this, this.layer("choir", 0, this.bed), {
      wave: this.st.wave("choir"), voices: this.phone ? 3 : 5, lo: 54, hi: 79, detune: 10, cutoff: 2000, level: 0.16, mode: "glide", glide: 4.5, lfo: 0.035,
    }));
    this.deep = new Mono(this, this.layer("deep", 0.2), { wave: this.st.wave("organ"), cutoff: 600, level: 0.07, sub: 0.25, lo: 35, hi: 47 });

    // a pool of places in the sky; each new star takes the next one
    const n = this.phone ? 2 : 4;
    for (let i = 0; i < n; i++) {
      const pan = this.panner();
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
    this.shepBus = this.layer("shepard", 0.7, this.phone ? this.dry : this.orbit(1.6, 47, 1.4, 0, 0.7));
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
    this.star = new Sampler(this, (sr, f) => bell(sr, f, 3.2, BELLS.star, r), 24, 10);
    this.tap = new Sampler(this, (sr, f) => bell(sr, f, 0.7, BELLS.spark, r), 12, 5);
    this.grains = this.star;
    this.star.warm([nm("B5"), nm("D#6"), nm("F#5"), nm("A#5"), nm("C#6")]);
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
      lead(this, this.line.bus, to, at, 2.8, dbg(-24), { wave: this.st.wave("air"), attack: 0.6, release: 1.8, cutoff: 3000, glideFrom: this.last.m - 12 > 70 ? this.last.m - 12 : this.last.m, glideTime: 2.2 });
    }
    // the theme as a constellation: four stars, one per beat
    if (L.motif && this.secBar % 4 === 1) {
      MOTIF.forEach((name, i) => this.starAt(nm(name), t + i * (60 / this.bpm), dbg(-17) * L.motif));
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
    if (L.stars && this.rng() < 0.2 * L.stars) {
      const tones = tonesIn(this.chord, 74, 91);
      if (tones.length) this.starAt(this.pick(tones), this.hum(t, 120), dbg(-18) * L.stars * (0.5 + 0.5 * this.rng()));
    }
  }

  protected onScroll(i: number, _dir: number, _dt: number, t: number) {
    // scrolling brightens the endless rise, like stars streaming past
    this.shepBus.gain.setTargetAtTime(Math.max(this.lv("shepard"), 0.4) * (1 + 1.5 * i), t, 0.3);
  }
}
