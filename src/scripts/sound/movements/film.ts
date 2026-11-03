// V. Night Fire. Film: a crime drama and other films, dark and red.
//
// The oldest stories were told at night, and most were about danger. The
// bass walks down C, B flat, A flat, G, the descending lament that has meant
// grief for four hundred years; a bowed low string carries it. A second
// string leans on semitones (G against A flat) for unease, and in the middle
// section the harmony slips to D flat, the flat second, the interval that
// makes a scene feel wrong. A heartbeat sits under it and quickens when the
// visitor scrolls. A bell tolls far behind. The hall is long and dark: highs
// are absorbed, so everything feels close and far at once.
import { Movement } from "../movement";
import { chords, bassOf, tonesIn, type Chord } from "../theory";
import { Pad, Sampler, lead, thud } from "../instruments";
import { bell, BELLS, pluck, dbg, nm, type RoomSpec } from "../dsp";

const A = chords("Cmadd9 Cm/Bb Abmaj7 G7b9");
const B = chords("Cm Dbmaj7 Abmaj7 G7b9");
const C = chords("Fm9 Dbmaj7#11 G7b9 Cmadd9");

// the second string: [note, start step, length in steps] per bar, per progression
type Line = [string, number, number][][];
const VIOLA: Record<string, Line> = {
  A: [[["G4", 0, 8], ["Ab4", 8, 8]], [["G4", 0, 16]], [["Eb4", 0, 8], ["C4", 8, 8]], [["D4", 0, 10], ["B3", 10, 6]]],
  B: [[["Eb4", 0, 8], ["G4", 8, 8]], [["F4", 0, 16]], [["Eb4", 0, 8], ["C4", 8, 8]], [["D4", 0, 8], ["B3", 8, 8]]],
  C: [[["Ab4", 0, 8], ["G4", 8, 8]], [["F4", 0, 16]], [["F4", 0, 8], ["D4", 8, 8]], [["Eb4", 0, 12], ["D4", 12, 4]]],
};

export class Film extends Movement {
  readonly id = "film";
  bpm = 52;
  div = 4;
  beats = 4;
  protected bright = 1300;
  protected wet = 1.0;
  protected bedSend = 0.45;
  protected tapLo = 55;
  protected tapHi = 67;
  protected grainLo = 67;
  protected grainHi = 82;

  private toll!: Sampler;
  private cello!: GainNode;
  private viola!: GainNode;
  private heart!: GainNode;
  private drum!: GainNode;
  private tollBus!: GainNode;
  private bassM = nm("C3");
  private nextBeat = 0;
  private prog = "A";

  protected room(): RoomSpec {
    return { rt60: 3.5, length: 3.4, predelay: 0.035, early: 5, earlyLevel: 0.25, hi: 3400, lo: 500, damp: 0.6, lowCut: 60, bloom: 0.02, width: 1 };
  }

  protected setup(t: number) {
    const r = this.rng;
    this.sections = [
      { bars: 2, prog: A, layers: { pad: 0.8, heart: 0.8 } },
      { bars: 8, prog: A, layers: { pad: 1, heart: 1, cello: 1, toll: 1 } },
      { bars: 8, prog: B, layers: { pad: 1, heart: 1, cello: 1, viola: 1, drum: 1, toll: 1 } },
      { bars: 8, prog: C, layers: { pad: 1, heart: 0.7, cello: 1, viola: 1, tension: 1, drum: 1, toll: 1 } },
      { bars: 4, prog: A, layers: { pad: 0.7, heart: 1, toll: 1, tension: 0.6 } },
    ];
    this.pads.push(new Pad(this, this.layer("pad", 0, this.bed), {
      wave: this.st.wave("choir"), voices: this.phone ? 3 : 4, lo: 48, hi: 68, detune: 9, cutoff: 750, level: 0.2, mode: "swap", xfade: 3.5, lfo: 0.04,
    }));
    // a high held note that trembles, the sound of waiting
    this.pads.push(new Pad(this, this.layer("tension", 0.8, this.bed), {
      wave: this.st.wave("air"), voices: 1, lo: 74, hi: 86, detune: 4, cutoff: 2400, level: 0.035, mode: "glide", glide: 3, lfo: 4.6,
    }));
    this.cello = this.layer("cello", 0.5, this.point(-1.0, -0.2, -1.3, 0.5));
    this.viola = this.layer("viola", 0.55, this.point(1.0, 0.1, -1.4, 0.55));
    this.heart = this.layer("heart", 0.25, this.point(0, -0.6, -0.6, 0.25));
    this.drum = this.layer("drum", 0.6, this.dry);
    this.tollBus = this.layer("toll", 0.9, this.point(-2.4, 0.6, 3.6, 0.9, 1, true));
    this.toll = new Sampler(this, (sr, f) => bell(sr, f, 6, BELLS.toll, r), 4, 3, "toll");
    this.tap = new Sampler(this, (sr, f) => pluck(sr, f, 0.45, { bright: 0.08, t60: 0.35, pick: 0.3 }, r), 12, 5);
    this.grains = new Sampler(this, (sr, f) => bell(sr, f, 1.6, BELLS.glass, r), 14, 8);
    this.nextBeat = t + 0.5;
    this.toll.warm([nm("C4")]);
  }

  protected onChord(c: Chord, t: number) {
    this.bassM = bassOf(c, this.bassM, 43, 55);
    this.prog = this.S.prog === B ? "B" : this.S.prog === C ? "C" : "A";
    // the lament: one long bowed note per chord, on the bass
    if (this.lv("cello")) {
      lead(this, this.cello, this.bassM, t, this.stepDur * this.spb - 0.25, dbg(-22), {
        wave: this.st.wave("bowed"), attack: 0.9, release: 1.6, cutoff: 950, vib: 9, vibRate: 4.6, detune: 8,
      });
    }
  }

  protected onBar(t: number) {
    const L = this.S.layers;
    // the bell, every four bars, very far away
    if (L.toll && this.bar % 4 === 0) this.toll.play(nm("C4"), this.hum(t, 20), dbg(-16), this.tollBus);
    // a low drum at the top of each phrase and the turn of the fourth bar
    if (L.drum && (this.secBar % 4 === 0 || this.secBar % 4 === 3)) {
      const at = this.secBar % 4 === 0 ? t : t + this.stepDur * 12;
      thud(this, this.drum, at, 92, 50, 0.55, dbg(-17));
    }
  }

  protected step(pos: number, t: number) {
    const L = this.S.layers;
    // the heartbeat runs on its own clock: 52 at rest, faster as you scroll
    if (L.heart) {
      while (this.nextBeat < t + this.stepDur) {
        const at = this.nextBeat;
        const lvl = dbg(-17);
        thud(this, this.heart, at, 98, 56, 0.16, lvl);
        thud(this, this.heart, at + 0.27, 86, 50, 0.13, lvl * 0.62);
        this.nextBeat += 60 / (52 + 26 * this.scrollI);
      }
    } else this.nextBeat = t + this.stepDur;
    if (L.viola) {
      const line = VIOLA[this.prog][this.secBar % 4];
      for (const [name, at, len] of line) {
        if (at === pos) lead(this, this.viola, nm(name), t, this.stepDur * len - 0.1, dbg(-21), {
          wave: this.st.wave("bowed"), attack: 0.6, release: 1.1, cutoff: 1500, vib: 11, vibRate: 5.2, detune: 6, key: "viola",
        });
      }
    }
  }

  protected onClick(t: number, x: number) {
    // a muted low string, and the faint shudder of a door
    const tones = tonesIn(this.chord, this.tapLo, this.tapHi);
    if (!tones.length) return;
    this.tap.play(tones[Math.min(tones.length - 1, Math.floor(x * tones.length))], t, this.tapLevel * 1.4, this.fx);
    thud(this, this.fx, t, 110, 60, 0.08, dbg(-30));
  }
}
