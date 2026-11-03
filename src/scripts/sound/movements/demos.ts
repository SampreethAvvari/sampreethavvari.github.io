// Interlude. The Working Model. Demos: things you can run.
//
// A demo is a model running in front of you, so this runs too. F sharp minor on
// a steady clock in a small dry room: a bass that ticks over on the eighths, soft
// keys that step through the chord from side to side, and one line that climbs a
// note each time the demo takes a step. It sits between Projects, which orbits,
// and Work, which pumps: it is smaller and tighter than either, and it never
// leaves the bench.
import { Movement, type Section } from "../movement";
import { chords, tonesIn, bassOf, type Chord } from "../theory";
import { Pad, Mono, Sampler, Flutter, ringAt } from "../instruments";
import { modal, MODES, fm, dbg, nm, hashStr, type RoomSpec } from "../dsp";

const A = chords("F#m9 Dmaj7 Bm9 C#7sus4");
const B = chords("Amaj9 F#m9 Dmaj7#11 C#7sus4");
const C = chords("Bm9 C#7b9 F#m9 F#m9");

export class Demos extends Movement {
  readonly id = "demos";
  bpm = 108;
  div = 2;
  beats = 4;
  protected bright = 2200;
  protected wet = 0.55;
  protected trim = 1.3;
  protected tapLo = 71;
  protected tapHi = 86;

  private keys!: Sampler;
  private bell!: Sampler;
  private bass!: Mono;
  private bassM = nm("F#2");
  private left!: GainNode;
  private right!: GainNode;
  private touch!: GainNode;
  private sweep = new Flutter();
  private k = 0;
  private climb = 0;

  protected room(): RoomSpec {
    return { rt60: 0.9, length: 1.3, predelay: 0.006, early: 10, earlyLevel: 0.55, hi: 5200, lo: 1500, damp: 0.2, lowCut: 150, bloom: 0, width: 0.7 };
  }

  protected setup() {
    const r = this.rng;
    this.sections = [
      { bars: 2, prog: [A[0]], per: 2, layers: { bed: 0.8, bass: 0.6 } },
      { bars: 8, prog: A, per: 2, layers: { bed: 1, bass: 1, keys: 1 } },
      { bars: 8, prog: B, per: 2, layers: { bed: 1, bass: 1, keys: 1 } },
      { bars: 4, prog: C, per: 1, layers: { bed: 0.9, bass: 1, keys: 0.7 } },
    ];
    this.pads.push(new Pad(this, this.layer("bed", 0, this.bed), {
      wave: this.st.wave("reed"), voices: this.phone ? 3 : 4, lo: 54, hi: 72, detune: 3, cutoff: 1500, level: 0.09, mode: "swap", xfade: 0.9, lfo: 0.07,
    }));
    this.bass = new Mono(this, this.layer("bass", 0.05), { wave: this.st.wave("warm"), cutoff: 900, level: 0.13, sub: 0.3, lo: 38, hi: 50 });
    this.left = this.layer("keys", 0.2, this.point(-1, 0, -1, 0.2));
    this.right = this.gain(1, this.point(1, 0, -1, 0.2));
    this.touch = this.bus(1, 0.2, undefined, true);
    this.keys = new Sampler(this, (sr, f) => modal(sr, f, 0.5, MODES.key, r), 16, 8, "keys");
    this.bell = new Sampler(this, (sr, f) => fm(sr, f, 1.0, { ratio: 2, index: 1.1, indexDecay: 0.2, decay: 0.45 }), 12, 6);
    this.tap = this.keys;
    this.grains = this.bell;
  }

  protected onChord(c: Chord, _t: number) {
    this.bassM = bassOf(c, this.bassM, 38, 50);
  }

  protected onSection(s: Section, t: number) {
    super.onSection(s, t);
    this.right.gain.setTargetAtTime(s.layers.keys ?? 0, t, 0.3);
  }

  protected step(pos: number, t: number) {
    const L = this.S.layers;
    if (L.bass && pos % 2 === 0) this.bass.hit(this.bassM, t, pos === 0 ? 0.7 : 0.45, 0.32, 0.08);
    if (!L.keys || pos % 8 === 7) return;
    const tones = tonesIn(this.chord, 62, 81);
    if (!tones.length) return;
    const n = this.k++;
    this.keys.play(tones[[0, 2, 1, 3, 2, 4, 3][n % 7] % tones.length], this.hum(t, 3), dbg(-17) * (n % 7 === 0 ? 1 : 0.72), n % 2 ? this.right : this.left);
  }

  // ---- the page ------------------------------------------------------------
  pageEvent(name: string, d: Record<string, unknown>, x: number) {
    if (!this.out || this.disposed) return;
    const t = this.ac.currentTime + 0.008;
    if (name === "demos:step") {
      // the line climbs one note a step, and each step lands
      const total = Math.max(1, Number(d.total) || 8);
      const i = Math.max(0, Number(d.index) || 0);
      const tones = tonesIn(this.chord, 69, 93);
      if (tones.length) {
        this.climb = Math.floor((i / total) * tones.length) % tones.length;
        ringAt(this, this.bell, this.touch, tones[this.climb], t, dbg(-24), -0.4 + (0.8 * i) / total, 0.6);
      }
      this.st.deep.hit(t, dbg(-14), { oct: 1, from: 2, sweep: 0.05, dur: 0.3 });
    } else if (name === "demos:section") {
      this.sec = 1 + (Math.max(0, Math.round(Number(d.index) || 0)) % (this.sections.length - 1));
      this.secBar = -1;
      this.alignBar();
      this.arrivalBar = this.bar + 1;
      const tones = tonesIn(this.S.prog[0], 66, 84);
      tones.slice(0, 3).forEach((m, n) => ringAt(this, this.bell, this.touch, m, t + n * 0.02, dbg(-26) * (n ? 0.75 : 1), -0.3 + n * 0.3, 0.8));
      this.st.deep.hit(t, dbg(-13), { from: 2.4, sweep: 0.08, dur: 0.6 });
    } else if (name === "demos:hover") {
      const v = this.sweep.next(t);
      if (v <= 0) return;
      const tones = tonesIn(this.chord, this.tapLo, this.tapHi);
      if (tones.length) ringAt(this, this.keys, this.touch, tones[hashStr(String(d.id ?? d.kind ?? "")) % tones.length], t, dbg(-29) * v, (x - 0.5) * 1.3, 0.14);
    }
  }
}
