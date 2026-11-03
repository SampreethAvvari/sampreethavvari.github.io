// VII. Memory, Handed On. Teaching: guides.
//
// The last movement looks back: what is learned is only kept by handing it
// on. A celesta on the left plays a short phrase; a music box on the right
// answers, almost the same. Sometimes the answer has a wrong note, and the
// next time it is put right. Then the two play together in thirds. In the
// closing section the roles turn: the student leads and the teacher answers.
// E flat major in a small warm room, and before each lesson a phrase plays
// backwards, swelling in, like a memory rewinding.
import { Movement, type Section } from "../movement";
import { chords, deg, MODES as SCALE, bassOf, type Chord } from "../theory";
import { Pad, Mono, Sampler } from "../instruments";
import { bell, BELLS, dbg, nm, type RoomSpec } from "../dsp";

const A = chords("Ebmaj9 Cm9 Abmaj9 Bb69");
const B = chords("Fm9 Bb9sus4 Gm7 Cm9");
const C = chords("Abmaj9 Bb9sus4 Ebadd9 Ebadd9");

const RHYTHMS = [[0, 1, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 3, 4, 5, 6], [0, 2, 4, 5, 6]];

export class Teaching extends Movement {
  readonly id = "teaching";
  bpm = 72;
  div = 2;
  beats = 4;
  protected bright = 2400;
  protected wet = 0.7;
  protected tapLo = 75;
  protected tapHi = 89;

  private celesta!: Sampler;
  private box!: Sampler;
  private bass!: Mono;
  private bassM = nm("Eb2");
  private left!: GainNode;
  private right!: GainNode;
  private phrase: number[] = [];
  private rhythm = RHYTHMS[0];
  private slip = -1; // index of the wrong note, if the student slips
  private lesson = 0;

  protected room(): RoomSpec {
    return { rt60: 1.1, length: 1.6, predelay: 0.008, early: 10, earlyLevel: 0.5, hi: 5500, lo: 1400, damp: 0.25, lowCut: 110, bloom: 0, width: 0.8 };
  }

  protected setup() {
    const r = this.rng;
    this.sections = [
      { bars: 2, prog: A, layers: { pad: 0.8, bass: 0.6 } },
      { bars: 8, prog: A, layers: { pad: 1, bass: 1, lesson: 1 } },
      { bars: 8, prog: B, layers: { pad: 1, bass: 1, lesson: 1, memory: 1 } },
      { bars: 8, prog: C, layers: { pad: 1, bass: 1, lesson: 1, memory: 1, together: 1 } },
      { bars: 4, prog: A, layers: { pad: 0.9, lesson: 1, turn: 1, memory: 1 } },
    ];
    this.pads.push(new Pad(this, this.layer("pad", 0, this.bed), {
      wave: this.st.wave("choir"), voices: this.phone ? 3 : 4, lo: 55, hi: 74, detune: 6, cutoff: 1400, level: 0.15, mode: "swap", xfade: 2.4, lfo: 0.05,
    }));
    this.bass = new Mono(this, this.layer("bass", 0.15), { wave: this.st.wave("air"), cutoff: 700, level: 0.22, sub: 0.3, lo: 36, hi: 50 });
    this.left = this.layer("lesson", 0, this.point(-1.1, 0.1, -1.0, 0.35));
    this.right = this.gain(1, this.point(1.1, 0.1, -1.0, 0.35));
    this.layers.memory = this.gain(0, this.point(0, 0.8, -1.8, 0.8));
    this.celesta = new Sampler(this, (sr, f) => bell(sr, f, 2.0, BELLS.celesta, r), 24, 10);
    this.box = new Sampler(this, (sr, f) => bell(sr, f, 1.6, BELLS.tine, r), 24, 10);
    this.tap = new Sampler(this, (sr, f) => bell(sr, f, 0.45, BELLS.tine, r), 12, 5);
    this.grains = this.box;
    this.newPhrase();
    this.celesta.warm(this.phrase.map((d) => this.note(d)));
  }

  /** Eb major pentatonic: safe over every chord here, like a first lesson. */
  private note(d: number): number {
    return deg(nm("Eb4"), SCALE.pentatonic, d);
  }

  private newPhrase() {
    this.rhythm = this.pick(RHYTHMS);
    let d = this.pick([2, 3, 4, 5]);
    this.phrase = this.rhythm.map((_, i) => (i === 0 ? d : (d = Math.max(0, Math.min(8, d + this.pick([-2, -1, 1, 1, 2]))))));
  }
  /** Vary the old phrase: two notes change, the shape stays. */
  private vary() {
    for (let k = 0; k < 2; k++) {
      const i = 1 + Math.floor(this.rng() * (this.phrase.length - 1));
      this.phrase[i] = Math.max(0, Math.min(8, this.phrase[i] + this.pick([-1, 1])));
    }
  }

  protected onChord(c: Chord, t: number) {
    this.bassM = bassOf(c, this.bassM, 36, 50);
    if (this.lv("bass")) this.bass.swell(this.bassM, t, 0.22, 0.6);
  }

  protected onSection(s: Section, t: number) {
    super.onSection(s, t);
    this.right.gain.setTargetAtTime(s.layers.lesson ?? 0, t, 1.4);
  }

  protected onBar(t: number) {
    const L = this.S.layers;
    if (!L.lesson) return;
    // a lesson is four bars: teach, answer, teach again, then together
    const k = this.secBar % 4;
    if (k === 0) {
      this.lesson++;
      if (this.lesson % 3 === 0) this.newPhrase();
      else this.vary();
      this.slip = this.rng() < 0.45 ? 1 + Math.floor(this.rng() * (this.phrase.length - 1)) : -1;
      if (L.memory) {
        // the phrase's first note, played backwards, arriving on the downbeat
        this.celesta.play(this.note(this.phrase[0]) + 12, t, dbg(-24), this.layers.memory, { rev: true });
      }
    }
  }

  protected step(pos: number, t: number) {
    const L = this.S.layers;
    if (L.bass && pos === 0) this.bass.hit(this.bassM, t, 0.45, 1.6, 0.25);
    if (!L.lesson) return;
    const i = this.rhythm.indexOf(pos);
    if (i < 0) return;
    const k = this.secBar % 4;
    const turn = !!L.turn;
    const teacher = turn ? (m: number, at: number, v: number) => this.box.play(m + 12, at, dbg(-15) * v, this.right) : (m: number, at: number, v: number) => this.celesta.play(m, at, dbg(-13) * v, this.left);
    const student = turn ? (m: number, at: number, v: number) => this.celesta.play(m, at, dbg(-14) * v, this.left) : (m: number, at: number, v: number) => this.box.play(m + 12, at, dbg(-16) * v, this.right);
    const m = this.note(this.phrase[i]);
    const v = (i === 0 ? 1 : 0.78) * (0.9 + 0.1 * this.rng());
    if (k === 0 || k === 2) teacher(m, this.hum(t, 8), v);
    else if (k === 1) {
      // the answer: a little late, sometimes with a wrong note
      const wrong = i === this.slip ? this.note(this.phrase[i] + this.pick([-1, 1])) : m;
      student(wrong, this.hum(t + 0.02, 18), v * 0.92);
    } else if (k === 3) {
      teacher(m, this.hum(t, 8), v * 0.9);
      // together: the student a third above, now with every note right
      if (L.together) student(deg(nm("Eb4"), SCALE.major, this.majorDegree(m) + 2), this.hum(t + 0.01, 10), v * 0.8);
      else student(m, this.hum(t + 0.015, 10), v * 0.85);
    }
  }

  private majorDegree(m: number): number {
    let d = 0;
    for (let k = -10; k <= 20; k++) if (deg(nm("Eb4"), SCALE.major, k) <= m) d = k;
    return d;
  }
}
