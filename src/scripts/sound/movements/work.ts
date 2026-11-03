// III. Four Crafts, One Line. Work: AI engineering, forward deployed
// engineering, machine learning, software engineering.
//
// One melody, split note by note between four instruments that stand at the
// four corners of the room (a hocket), so the line travels around the
// listener's head and only exists when all four play their part:
//   software engineering   marimba, front left: exact, structural
//   forward deployed       nylon string, front right: warm, human, on site
//   AI engineering         FM bell, behind right: glassy, thinking
//   machine learning       a voice whose timbre learns: each bar its
//                          harmonics move a step closer to a target, from a
//                          rough buzz toward a clear reed, and start again
//                          when the section changes, like a model training.
// F major with added ninths: warm and unhurried.
import { Movement, type Section } from "../movement";
import { chords, deg, MODES as SCALE, snap, bassOf, type Chord } from "../theory";
import { Pad, Mono, Sampler, lead } from "../instruments";
import { pluck, modal, MODES, fm, WAVES, dbg, nm, type RoomSpec } from "../dsp";

const A = chords("Fmaj9 Dm9 Bbmaj9 C9sus4");
const B = chords("Am7 Bbmaj7#11 Gm9 C9sus4");
const C = chords("Dm9 Bbmaj9 Fmaj9/A Gm9");

const RHYTHMS = [
  [0, 3, 6, 8, 10, 12, 14],
  [0, 2, 4, 7, 8, 11, 12, 15],
  [0, 3, 4, 6, 8, 11, 14],
  [0, 2, 6, 8, 9, 12, 14],
];
// melodic contour in scale steps, varied a little each phrase
const CONTOUR = [1, 1, -2, 2, 1, -3, 1, 2];

export class Work extends Movement {
  readonly id = "work";
  bpm = 80;
  div = 4;
  beats = 4;
  protected bright = 2700;
  protected wet = 0.7;
  protected trim = 1.2;
  protected tapLo = 72;
  protected tapHi = 86;

  private voices: { play: (m: number, t: number, v: number) => void; bus: GainNode; name: string }[] = [];
  private bass!: Mono;
  private bassM = nm("F2");
  private contour = CONTOUR.slice();
  private rhythm = RHYTHMS[0];
  private order = [0, 1, 2, 3];
  private note = nm("A4");
  private k = 0;
  private learnAmps: number[] = [];
  private target: number[] = [];
  private learnWave!: PeriodicWave;

  protected room(): RoomSpec {
    return { rt60: 1.3, length: 1.8, predelay: 0.01, early: 8, earlyLevel: 0.45, hi: 6500, lo: 1500, damp: 0.3, lowCut: 100, bloom: 0, width: 0.9 };
  }

  protected setup() {
    const r = this.rng;
    this.sections = [
      { bars: 2, prog: A, layers: { pad: 0.8, bass: 0.6 } },
      { bars: 4, prog: A, layers: { pad: 1, bass: 1, se: 1, fde: 1 } },
      { bars: 8, prog: B, layers: { pad: 1, bass: 1, se: 1, fde: 1, aie: 1, mle: 1 } },
      { bars: 8, prog: C, layers: { pad: 1, bass: 1, se: 1, fde: 1, aie: 1, mle: 1, counter: 1 } },
      { bars: 4, prog: A, layers: { pad: 0.85, aie: 1, mle: 1 } },
    ];
    this.pads.push(new Pad(this, this.layer("pad", 0, this.bed), {
      wave: this.st.wave("warm"), voices: this.phone ? 3 : 4, lo: 53, hi: 72, detune: 6, cutoff: 1700, level: 0.17, mode: "swap", xfade: 1.6, lfo: 0.07,
    }));
    this.bass = new Mono(this, this.layer("bass", 0.12), { wave: this.st.wave("warm"), cutoff: 1000, level: 0.22, sub: 0.3, lo: 36, hi: 50 });

    const marimba = new Sampler(this, (sr, f) => modal(sr, f, 1.2, MODES.marimba, r), 18, 8);
    const nylon = new Sampler(this, (sr, f) => pluck(sr, f, 1.6, { bright: 0.45, t60: 1.3, pick: 0.13 }, r), 18, 8);
    const bellS = new Sampler(this, (sr, f) => fm(sr, f, 1.8, { ratio: 3.5, index: 1.6, indexDecay: 0.18, decay: 0.8 }), 18, 8);
    const corners: [number, number, number][] = this.phone
      ? [[-1.2, 0, -1], [1.2, 0, -1], [1.2, 0, -1], [-1.2, 0, -1]]
      : [[-1.2, 0, -1.1], [1.2, 0, -1.1], [1.1, 0.25, 1.1], [-1.1, 0.25, 1.1]];
    const busFor = (name: string, i: number) => this.layer(name, 0, this.point(...corners[i], 0.35));
    const se = busFor("se", 0), fde = busFor("fde", 1), aie = busFor("aie", 2), mle = busFor("mle", 3);
    this.voices = [
      { name: "se", bus: se, play: (m, t, v) => marimba.play(m, t, dbg(-12) * v, se) },
      { name: "fde", bus: fde, play: (m, t, v) => nylon.play(m - 12, t, dbg(-12) * v, fde) },
      { name: "aie", bus: aie, play: (m, t, v) => bellS.play(m, t, dbg(-16) * v, aie) },
      { name: "mle", bus: mle, play: (m, t, v) => lead(this, mle, m, t, this.stepDur * 1.6, dbg(-17) * v, { wave: this.learnWave, attack: 0.03, release: 0.25, cutoff: 2400, vib: 4, vibRate: 5.5 }) },
    ];
    this.layers.counter = this.gain(0, this.point(0, 0.4, -1.6, 0.4));
    this.tap = new Sampler(this, (sr, f) => modal(sr, f, 0.35, MODES.marimba, r), 12, 5);
    this.grains = bellS;
    this.relearn();
    marimba.warm([65, 67, 69, 70, 72, 74, 76, 77]);
    nylon.warm([53, 55, 57, 58, 60, 62, 64, 65]);
  }

  /** New target, start from a rough guess. */
  private relearn() {
    const goal = this.rng() < 0.5 ? WAVES.reed : WAVES.warm;
    this.target = Array.from({ length: 10 }, (_, i) => goal[i] ?? 0);
    this.learnAmps = Array.from({ length: 10 }, (_, i) => (i === 0 ? 1 : 0.15 + 0.55 * this.rng()));
    this.learnWave = this.ac.createPeriodicWave(new Float32Array(11), new Float32Array([0, ...this.learnAmps]));
  }
  /** One step of learning per bar: move a third of the way to the target. */
  private learn() {
    const noise = 0.05;
    this.learnAmps = this.learnAmps.map((a, i) => Math.max(0, a + 0.33 * (this.target[i] - a) + (this.rng() - 0.5) * noise));
    this.learnWave = this.ac.createPeriodicWave(new Float32Array(11), new Float32Array([0, ...this.learnAmps]));
  }

  protected onChord(c: Chord, _t: number) {
    this.bassM = bassOf(c, this.bassM, 36, 50);
  }

  protected onSection(s: Section, t: number) {
    super.onSection(s, t);
    this.relearn();
    this.rhythm = RHYTHMS[(this.sec + this.cycle) % RHYTHMS.length];
    const orders = [[0, 1, 2, 3], [0, 2, 1, 3], [3, 2, 1, 0], [1, 3, 0, 2]];
    this.order = orders[(this.sec + this.cycle * 2) % orders.length];
  }

  protected onBar(_t: number) {
    this.learn();
    // every second bar the phrase develops: one contour step changes
    if (this.bar % 2 === 0) {
      const i = Math.floor(this.rng() * this.contour.length);
      this.contour[i] = this.pick([-2, -1, 1, 2, 3]);
      if (this.bar % 8 === 0) this.contour = CONTOUR.slice();
    }
    // each phrase starts from a chord tone near the middle
    this.note = snap(nm("A4") + Math.round((this.rng() - 0.5) * 6), this.chord.pcs);
    this.k = 0;
  }

  protected step(pos: number, t: number) {
    const L = this.S.layers;
    if (L.bass) {
      if (pos === 0) this.bass.hit(this.bassM, t, 0.7, 1.0, 0.1);
      else if (pos === 10) this.bass.hit(this.bassM + 7, t, 0.35, 0.5, 0.08);
    }
    const idx = this.rhythm.indexOf(pos);
    if (idx < 0) return;
    // who is playing: the four crafts, in this section's order
    const active = this.order.filter((i) => (L[this.voices[i].name] ?? 0) > 0);
    if (!active.length) return;
    let m = this.note;
    if (idx > 0) {
      const steps = this.contour[(idx - 1) % this.contour.length];
      m = this.stepScale(this.note, steps);
      if (m > nm("E5")) m = this.stepScale(m, -4);
      if (m < nm("D4")) m = this.stepScale(m, 3);
    }
    if (pos === 0 || pos === 8) m = snap(m, this.chord.pcs);
    this.note = m;
    const v = this.voices[active[this.k % active.length]];
    this.k++;
    v.play(m, this.hum(t, 6), (pos % 4 === 0 ? 1 : 0.75) * (0.9 + 0.1 * this.rng()));
    // the counter line: the pad's top voice, sung softly, on the half bars
    if (L.counter && (pos === 0 || pos === 8)) {
      const top = this.voicing[this.voicing.length - 1] + 12;
      lead(this, this.layers.counter, top, t, this.stepDur * 7, dbg(-24), { wave: this.st.wave("air"), attack: 0.4, release: 0.8, cutoff: 2200, vib: 6, vibRate: 4.8 });
    }
  }

  private stepScale(m: number, steps: number): number {
    // find the degree of m in F major and move along the scale
    const tonic = nm("F4");
    let d = 0;
    for (let k = -14; k <= 14; k++) if (deg(tonic, SCALE.major, k) <= m) d = k;
    return deg(tonic, SCALE.major, d + steps);
  }
}
