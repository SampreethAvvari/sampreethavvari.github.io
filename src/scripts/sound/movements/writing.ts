// IV. First Signals. Writing: case studies.
//
// Writing began as marks that carried a thought to someone who was not in
// the room. A felt piano speaks in sentences: a phrase rises and falls like
// a spoken line, ends on a comma (an open note) or a full stop (the chord's
// root), then leaves a breath of silence. Far behind the listener a two note
// signal repeats every few bars, like a light across water. G major moving
// through E minor, C and D.
import { Movement, type Section } from "../movement";
import { chords, deg, MODES as SCALE, snap, bassOf, tonesIn, type Chord } from "../theory";
import { Pad, Mono, Sampler, lead } from "../instruments";
import { piano, dbg, nm, kr, type RoomSpec } from "../dsp";

const A = chords("Em9 Cmaj9 G/B D69");
const B = chords("Cmaj7 Bm7 Am9 D9sus4");
const C = chords("Gmaj9 Em9 Cmaj9 D69");

// sentence rhythms, in sixteenths across two bars
const SENTENCES = [
  [0, 4, 6, 8, 12, 16, 20, 22, 24],
  [0, 2, 4, 8, 10, 12, 16, 24],
  [0, 3, 4, 8, 14, 16, 18, 20, 28],
  [0, 4, 8, 10, 11, 12, 16, 22],
];

interface Note { at: number; m: number; v: number }

export class Writing extends Movement {
  readonly id = "writing";
  bpm = 66;
  div = 4;
  beats = 4;
  protected bright = 2300;
  protected wet = 0.85;
  protected trim = 0.78;
  protected tapLo = 67;
  protected tapHi = 84;
  protected grainLo = 79;
  protected grainHi = 93;

  private keys!: Sampler;
  private bass!: Mono;
  private bassM = nm("G2");
  private hand!: GainNode;
  private signal!: GainNode;
  private paper!: GainNode;
  private phrase: Note[] = [];
  private phraseStart = -1;
  private stop = false;

  protected room(): RoomSpec {
    return { rt60: 1.7, length: 2.3, predelay: 0.016, early: 6, earlyLevel: 0.35, hi: 5000, lo: 900, damp: 0.45, lowCut: 90, bloom: 0, width: 0.85 };
  }

  protected setup() {
    const r = this.rng;
    this.sections = [
      { bars: 2, prog: A, layers: { pad: 0.8, bass: 0.5, left: 1, paper: 1 } },
      { bars: 8, prog: A, layers: { pad: 1, bass: 1, left: 1, piano: 1, signal: 1, paper: 1 } },
      { bars: 8, prog: B, layers: { pad: 1, bass: 1, left: 1, arps: 1, piano: 1, paper: 1 } },
      { bars: 8, prog: C, layers: { pad: 1, bass: 1, left: 1, piano: 1, answer: 1, signal: 1, paper: 1 } },
      { bars: 4, prog: A, layers: { pad: 0.85, left: 0.7, signal: 1, paper: 1 } },
    ];
    this.pads.push(new Pad(this, this.layer("pad", 0, this.bed), {
      wave: this.st.wave("air"), voices: this.phone ? 3 : 4, lo: 55, hi: 74, detune: 5, cutoff: 1500, level: 0.15, mode: "swap", xfade: 3, lfo: 0.05,
    }));
    this.bass = new Mono(this, this.layer("bass", 0.15), { wave: this.st.wave("air"), cutoff: 700, level: 0.2, sub: 0.3, lo: 38, hi: 52 });
    this.hand = this.layer("piano", 0, this.point(-0.35, 0, -1.1, 0.45));
    this.layers.left = this.gain(0, this.point(-0.5, -0.1, -1.2, 0.45));
    // far behind: distance does the rest
    this.signal = this.layer("signal", 0.9, this.point(0.6, 0.8, 6.5, 0.9));
    // the air of the room: pink noise in a soft paper band, very low
    const ac = this.ac;
    const src = this.src(ac.createBufferSource());
    src.buffer = this.st.noise;
    src.loop = true;
    const band = this.own(ac.createBiquadFilter());
    band.type = "bandpass";
    band.frequency.value = 1500;
    band.Q.value = 0.6;
    kr(band.frequency);
    this.paper = this.gain(dbg(-50));
    src.connect(band).connect(this.paper).connect(this.layer("paper", 0.6, this.air));
    src.start();

    this.keys = new Sampler(this, (sr, f) => piano(sr, f, 2.6, r), 24, 14);
    this.tap = new Sampler(this, (sr, f) => piano(sr, f, 0.5, r, 1.4), 12, 5);
    this.grains = this.keys;
    this.keys.warm([nm("G3"), nm("B3"), nm("D4"), nm("E4"), nm("G4"), nm("A4"), nm("B4"), nm("D5")]);
  }

  protected onChord(c: Chord, t: number) {
    this.bassM = bassOf(c, this.bassM, 38, 52);
    if (this.lv("bass")) this.bass.swell(this.bassM, t, 0.3, 0.8);
  }

  protected onSection(s: Section, t: number) {
    super.onSection(s, t);
    this.phraseStart = -1;
  }

  /** Write a sentence: rise toward the middle, fall to the end. */
  private sentence(bar: number) {
    const rhythm = this.pick(SENTENCES);
    this.stop = this.rng() < 0.55;
    const tonic = nm("G4");
    let d = this.pick([-3, -2, 0, 2]);
    const n = rhythm.length;
    this.phrase = rhythm.map((at, i) => {
      const x = i / (n - 1);
      if (i > 0) d += x < 0.45 ? this.pick([1, 1, 2, -1]) : this.pick([-1, -1, -2, 1]);
      const arc = Math.sin(Math.PI * Math.min(1, x * 1.2));
      return { at, m: deg(tonic, SCALE.major, d), v: 0.55 + 0.4 * arc };
    });
    this.phraseStart = bar;
  }

  protected onBar(_t: number) {
    const L = this.S.layers;
    // a sentence takes two bars, then one or two bars of breath
    if (L.piano && (this.phraseStart < 0 || this.bar - this.phraseStart >= (this.stop ? 4 : 3))) this.sentence(this.bar);
  }

  protected step(pos: number, t: number) {
    const L = this.S.layers;
    const r = this.rng;
    // the left hand: bass and a tenth, sometimes rolled
    if (L.left && pos === 0) {
      const b = this.bassM + 12;
      const tenth = tonesIn(this.chord, b + 7, b + 16)[0];
      this.keys.play(b, this.hum(t, 10), dbg(-22), this.layers.left);
      if (tenth) this.keys.play(tenth, this.hum(t + (L.arps ? this.stepDur * 2 : 0.03), 10), dbg(-25), this.layers.left);
      if (L.arps) {
        const up = tonesIn(this.chord, b + 12, b + 24);
        up.slice(0, 2).forEach((m, i) => this.keys.play(m, this.hum(t + this.stepDur * (4 + 2 * i), 12), dbg(-28), this.layers.left));
      }
    }
    // the sentence
    if (L.piano && this.phraseStart >= 0) {
      const at = (this.bar - this.phraseStart) * this.spb + pos;
      const k = this.phrase.findIndex((n) => n.at === at);
      if (k >= 0) {
        const n = this.phrase[k];
        let m = n.m;
        const last = k === this.phrase.length - 1;
        if (pos === 0 || last) m = snap(m, last && this.stop ? [this.chord.root] : this.chord.pcs);
        // a sentence slows into its last word
        const late = last ? 0.04 : 0;
        this.keys.play(m, this.hum(t + late, 14), dbg(-14) * n.v, this.hand);
      }
      // in the rests, a second voice answers an octave up
      if (L.answer && this.bar - this.phraseStart === 2 && (pos === 4 || pos === 10)) {
        const tones = tonesIn(this.chord, nm("D5"), nm("D6"));
        if (tones.length) this.keys.play(this.pick(tones), this.hum(t, 14), dbg(-21), this.hand);
      }
    }
    // the signal: a light across water, every eight bars
    if (L.signal && this.bar % 8 === 3 && (pos === 0 || pos === 6)) {
      const m = pos === 0 ? nm("D6") : nm("G5");
      lead(this, this.signal, m, t, pos === 0 ? 0.6 : 1.3, dbg(-20), { wave: this.st.wave("air"), attack: 0.25, release: 1.2, cutoff: 3000 });
    }
    void r;
  }

  protected onScroll(i: number, _dir: number, _dt: number, t: number) {
    // scrolling lifts the paper air a little
    this.paper.gain.setTargetAtTime(dbg(-50) * (1 + 3 * i), t, 0.2);
  }
}
