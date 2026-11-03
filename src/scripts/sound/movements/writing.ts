// IV. First Signals. Writing: case studies.
//
// Writing began as marks that carried a thought to someone who was not in
// the room. A felt piano speaks in sentences: a phrase rises and falls like
// a spoken line, ends on a comma (an open note) or a full stop (the chord's
// root), then leaves a breath of silence. Far behind the listener a two note
// signal repeats every few bars, like a light across water. G major moving
// through E minor, C and D.
//
// When the page shows its articles one at a time, each hero gets its own
// sentence, drawn from its name so the same article always speaks the same
// way, and later sentences are variations of it. A change of hero turns a
// page: a breath of paper air that sweeps up and down, and a piano note played
// backwards that arrives exactly when the new hero lands.
import { Movement, type Section } from "../movement";
import { chords, deg, MODES as SCALE, snap, bassOf, tonesIn, type Chord } from "../theory";
import { Pad, Mono, Sampler, lead } from "../instruments";
import { piano, dbg, nm, kr, mulberry, hashStr, type Rng, type RoomSpec } from "../dsp";

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
  private voiceRng: Rng | null = null;
  private heroSeed = 0;
  private sweep!: BiquadFilterNode;
  private sweepGain!: GainNode;

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
    this.signal = this.layer("signal", 0.9, this.point(0.6, 0.8, 6.5, 0.9, 1, true));
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

    // a page turning: the same paper air, swept and swelled for a transition
    const turnSrc = this.src(ac.createBufferSource());
    turnSrc.buffer = this.st.noise;
    turnSrc.loop = true;
    this.sweep = this.own(ac.createBiquadFilter());
    this.sweep.type = "bandpass";
    this.sweep.frequency.value = 700;
    this.sweep.Q.value = 0.9;
    kr(this.sweep.frequency);
    this.sweepGain = this.gain(0);
    turnSrc.connect(this.sweep).connect(this.sweepGain).connect(this.air);
    turnSrc.start(0, 1.7);

    this.keys = new Sampler(this, (sr, f) => piano(sr, f, 2.6, r), 24, 14, "piano");
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
    // a hero's sentences come from its own name, so each article has a voice
    const rr = this.voiceRng ?? this.rng;
    const pick = <T,>(a: T[]) => a[Math.floor(rr() * a.length)];
    const rhythm = pick(SENTENCES);
    this.stop = rr() < 0.55;
    const tonic = nm("G4");
    let d = pick([-3, -2, 0, 2]);
    const n = rhythm.length;
    this.phrase = rhythm.map((at, i) => {
      const x = i / (n - 1);
      if (i > 0) d += x < 0.45 ? pick([1, 1, 2, -1]) : pick([-1, -1, -2, 1]);
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
  }

  heroFocus(d: { index?: number; slug: string; accent?: string }) {
    if (!this.out || this.disposed) return;
    this.heroSeed = hashStr(d.slug);
    // the first sentence is the hero's own; the ones after vary it a little
    this.voiceRng = mulberry(this.heroSeed);
    this.phraseStart = -1;
    // its name as a chord: a soft roll on the current harmony, starting from its own note
    const t = this.ac.currentTime + 0.05;
    const tones = tonesIn(this.chord, nm("G3"), nm("D5"));
    const start = this.heroSeed % Math.max(1, tones.length - 2);
    tones.slice(start, start + 3).forEach((m, i) => this.keys.play(m, t + i * 0.05, dbg(-22) * (i ? 0.8 : 1), this.front, { force: true }));
    this.arrivalBar = this.bar + 1;
    setTimeout(() => {
      // later sentences wander from the hero's voice
      if (this.voiceRng && !this.disposed) this.voiceRng = mulberry(this.heroSeed + 1 + Math.floor(Math.random() * 3));
    }, 9000);
  }

  heroTransition(d: { from?: number; to?: number; duration?: number }) {
    if (!this.out || this.disposed) return;
    const t = this.ac.currentTime + 0.02;
    const D = Math.max(0.3, Math.min(3, (Number(d.duration) || 900) / 1000));
    const up = (d.to ?? 1) >= (d.from ?? 0);
    // a page turning: paper air that sweeps across and settles as the new hero lands
    const f = this.sweep.frequency, g = this.sweepGain.gain;
    f.setValueAtTime(up ? 600 : 2400, t);
    f.exponentialRampToValueAtTime(up ? 2400 : 600, t + D * 0.6);
    f.exponentialRampToValueAtTime(900, t + D);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(dbg(-30), t + D * 0.55);
    g.setTargetAtTime(0, t + D * 0.6, D * 0.15);
    // a piano note played backwards, arriving with the new hero, then the hero's low note
    const tones = tonesIn(this.chord, nm("D5"), nm("D6"));
    if (tones.length) this.keys.play(tones[(d.to ?? 0) % tones.length], t + D, dbg(-22), this.front, { rev: true, force: true });
    this.keys.play(this.bassM + 12, t + D, dbg(-24), this.front, { force: true });
  }

  cardHover(slug: string) {
    if (!this.out || this.disposed) return;
    const tones = tonesIn(this.chord, nm("G4"), nm("G5"));
    if (!tones.length) return;
    this.tap.play(tones[hashStr(slug) % tones.length], this.ac.currentTime + 0.004, dbg(-31), this.fx, { dur: 0.25 });
  }

  protected onScroll(i: number, _dir: number, _dt: number, t: number) {
    // scrolling lifts the paper air a little
    this.paper.gain.setTargetAtTime(dbg(-50) * (1 + 3 * i), t, 0.2);
  }
}
