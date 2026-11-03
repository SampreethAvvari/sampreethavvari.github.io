// I. Fire and Hands. Projects: tools built for people who use them every day.
//
// A Dorian in a slow 12/8, the lilt of hands working. A low drone flickers
// like a fire in the middle of the room. Struck wood and stone keep an uneven
// hand drum pattern to the left; plucked gut strings play a small motif to
// the right, a rough draft at first that gets corrected one note per pass, the
// way a tool is refined over many tries. Sparks circle overhead.
import { Movement, type Section } from "../movement";
import { chords, deg, MODES as SCALE, snap, tonesIn, bassOf } from "../theory";
import { Pad, Mono, Sampler } from "../instruments";
import { pluck, modal, MODES, bell, BELLS, dbg, nm, type RoomSpec } from "../dsp";

const A = chords("Am9 D9/F# Cadd9 Em11");
const B = chords("Am9 G6/B Cmaj9 D9");
const C = chords("Am9 Em11");

export class Projects extends Movement {
  readonly id = "projects";
  bpm = 72;
  div = 3;
  beats = 4;
  protected bright = 2100;
  protected wet = 0.8;
  protected trim = 1.5;
  protected tapLo = 64;
  protected tapHi = 79;
  protected grainLo = 76;
  protected grainHi = 91;

  private gut!: Sampler;
  private frame!: Sampler;
  private stone!: Sampler;
  private spark!: Sampler;
  private bass!: Mono;
  private bassM = nm("A2");
  private handsL!: GainNode;
  private handsR!: GainNode;
  private strR!: GainNode;
  private strL!: GainNode;
  private sparkBus!: GainNode;
  // the motif in A Dorian degrees from A3, and the answer
  private final = [4, 3, 2, 3, 4, 6];
  private answer = [7, 6, 4, 5, 4];
  private callR = [0, 2, 3, 6, 9, 10];
  private answerR = [0, 3, 5, 6, 9];
  private draft: number[] = [];

  protected room(): RoomSpec {
    return { rt60: 1.4, length: 2.0, predelay: 0.012, early: 10, earlyLevel: 0.55, hi: 5200, lo: 1200, damp: 0.35, lowCut: 90, bloom: 0, width: 0.85 };
  }

  protected setup(t: number) {
    const r = this.rng;
    this.sections = [
      { bars: 4, prog: A, per: 2, layers: { fire: 1, pad: 0.75, sparks: 0.3 } },
      { bars: 8, prog: A, per: 2, layers: { fire: 1, pad: 1, hands: 0.65, strings: 1, sparks: 0.5, bass: 0.7 } },
      { bars: 8, prog: B, per: 2, layers: { fire: 1, pad: 0.9, hands: 0.85, strings: 1, bass: 1, sparks: 0.4 } },
      { bars: 8, prog: A, per: 2, layers: { fire: 1, pad: 1, hands: 1, strings: 1, high: 0.8, bass: 1, sparks: 0.6 } },
      { bars: 4, prog: C, per: 2, layers: { fire: 1, pad: 0.6, strings: 0.75, sparks: 0.9 } },
    ];

    // the fire: a low drone on A and E that flickers, never changes chord
    const fire = new Pad(this, this.layer("fire", 0, this.bed), {
      wave: this.st.wave("organ"), voices: 2, lo: 40, hi: 60, detune: 6, cutoff: 900, q: 0.7, level: 0.07, mode: "glide", lfo: 0.13,
    });
    fire.set([nm("A2"), nm("E3")], t);
    // the held chord
    this.pads.push(new Pad(this, this.layer("pad", 0, this.bed), {
      wave: this.st.wave("warm"), voices: this.phone ? 3 : 4, lo: 55, hi: 76, detune: 7, cutoff: 1500, level: 0.1, mode: "swap", xfade: 2.6, lfo: 0.06,
    }));
    this.bass = new Mono(this, this.layer("bass", 0.15), { wave: this.st.wave("warm"), cutoff: 900, level: 0.15, sub: 0.3, lo: 33, hi: 50 });

    // hands on the left, strings on the right, sparks circling above
    this.handsL = this.layer("hands", 0, this.point(-0.9, -0.3, -1.2, 0.35));
    this.handsR = this.layer("handsR", 0, this.point(0.5, -0.4, -1.4, 0.35, 0.8));
    this.strR = this.layer("strings", 0, this.point(0.9, 0.05, -1.1, 0.4));
    this.strL = this.layer("high", 0, this.point(-1.1, 0.4, 0.4, 0.55, 1, true));
    this.sparkBus = this.layer("sparks", 0, this.phone ? this.dry : this.orbit(1.8, 19, 1.2, 2.0, 0.7));

    this.gut = new Sampler(this, (sr, f) => pluck(sr, f, 1.8, { bright: 0.35, t60: 1.6, pick: 0.18 }, r), 20, 10, "motif");
    this.frame = new Sampler(this, (sr, f) => modal(sr, f, 0.6, MODES.frame, r), 4, 6, "hands");
    this.stone = new Sampler(this, (sr, f) => modal(sr, f, 0.3, MODES.stone, r), 4, 6, "hands");
    this.spark = new Sampler(this, (sr, f) => bell(sr, f, 0.9, BELLS.spark, r), 12, 6);
    this.tap = new Sampler(this, (sr, f) => modal(sr, f, 0.25, MODES.stone, r), 12, 5);
    this.grains = this.spark;
    this.gut.warm([57, 59, 60, 62, 64, 66, 67, 69, 71]);
  }

  protected onChord(c: import("../theory").Chord, _t: number) {
    this.bassM = bassOf(c, this.bassM, 38, 50);
  }

  protected onSection(s: Section, t: number) {
    super.onSection({ ...s, layers: { ...s.layers, handsR: s.layers.hands ?? 0 } }, t);
    // each new section starts from a rough draft of the motif
    this.draft = this.final.map((d) => (this.rng() < 0.4 ? d + this.pick([-2, -1, 1, 2]) : d));
  }

  protected step(pos: number, t: number) {
    const L = this.S.layers;
    const r = this.rng;
    if (L.hands) {
      if (pos === 0 || pos === 7) this.frame.play(pos === 0 ? nm("A2") : nm("E3"), this.hum(t), dbg(-17) * (0.85 + 0.15 * r()), this.handsL);
      else if ((pos === 4 || pos === 10) && r() < 0.5) this.frame.play(nm("E3"), this.hum(t, 12), dbg(-23), this.handsL);
      if (pos === 3 || pos === 6 || pos === 9) this.stone.play(pos === 6 ? nm("A5") : nm("E5"), this.hum(t), dbg(-21) * (0.8 + 0.2 * r()), this.handsR);
      else if (pos === 11 && r() < 0.35) this.stone.play(nm("B5"), this.hum(t, 12), dbg(-29), this.handsR);
    }
    if (L.bass) {
      if (pos === 0) this.bass.hit(this.bassM, t, 0.8, 1.4, 0.12);
      else if (pos === 8) this.bass.hit(this.bassM + (r() < 0.5 ? 12 : 7), t, 0.4, 0.7, 0.08);
    }
    if (L.strings) {
      const call = this.bar % 2 === 0;
      const rhythm = call ? this.callR : this.answerR;
      const k = rhythm.indexOf(pos);
      if (k >= 0) {
        const line = call ? this.draft : this.answer;
        let m = deg(nm("A3"), SCALE.dorian, line[k]);
        if (k === 0) m = snap(m, this.chord.pcs);
        const v = (k === 0 ? 1 : 0.72) * (0.9 + 0.1 * r());
        this.gut.play(m, this.hum(t, 10), dbg(-15) * v, this.strR);
        if (L.high) this.gut.play(m + 12, this.hum(t + this.stepDur, 10), dbg(-23) * v, this.strL);
      }
    }
    if (L.sparks && r() < 0.035 * L.sparks) {
      const tones = tonesIn(this.chord, 81, 93);
      if (tones.length) this.spark.play(this.pick(tones), this.hum(t, 60), dbg(-30) * (0.6 + 0.4 * r()), this.sparkBus);
    }
  }

  protected onBar(_t: number) {
    // after each call, one wrong note in the draft is put right
    if (this.bar % 2 === 1) {
      const wrong = this.draft.map((d, i) => (d !== this.final[i] ? i : -1)).filter((i) => i >= 0);
      if (wrong.length) {
        const i = this.pick(wrong);
        this.draft[i] = this.final[i];
      }
    }
  }
}
