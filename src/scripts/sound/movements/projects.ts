// I. Fire and Hands. Projects: a star system toured by scroll, one world per
// project, then a belt of smaller bodies.
//
// The system itself is the home key: A Dorian in a slow 12/8, a low drone that
// flickers like a fire, wood and stone struck by hand, and a plucked motif that
// starts rough and gets one note closer to right on every pass. Each world then
// has its own key, tempo, floor and colour, so flying from one to the next is
// arriving somewhere new:
//
//   mirror    D flat Lydian, slow. Glass, and every note answered by its
//             reflection in the other ear
//   ring      quartal, a machine's tempo. A turning that goes round the listener
//   listener  E flat major. Two voices taking turns over a hand drum
//   disk      F sharp Phrygian, hardly moving. A deep low pull: bowed notes
//             sliding down over very little else
//   geode     B flat Lydian, fast. Crystal, one chord refracted across octaves
//             and across the room
//   arch      E major. A sweep of light over 32 stones, up and over
//   nets      A minor, quick. Sparks caught on the steps of a climbing line
//   comet     F minor, slow. One bright head and a long rushing tail
//   belt      E Dorian, slow. Sparse, rocky, wide
//
// The layers are the same as the home flight. A bed for each world, a flight
// between them that holds the rhythm and lands on arrival, a theme that plays
// whole for two bars and then comes and goes, and interaction in front. While
// the camera flies, the generic scroll shimmer stays out of the gesture's way;
// at free travel inside a world, a swell of the world's own chord follows the
// speed of the scroll.
import { Movement, type Section } from "../movement";
import { chords, deg, MODES as SCALE, snap, tonesIn, bassOf, type Chord } from "../theory";
import { Pad, Mono, Sampler, Flutter, lead, thud, ringAt, rush, type PadOpts } from "../instruments";
import { pluck, modal, MODES, bell, BELLS, dbg, nm, type RoomSpec, type ModalSpec } from "../dsp";
import { PROJECT_WORLDS } from "../places";

interface Stage {
  id: string;
  prog: Chord[];
  per: number;
  bpm: number;
  bed: Omit<PadOpts, "wave"> & { wave: string };
  fire: number; // how much of the low drone
  bass: number; // how much of the plucked bass
  bright: number;
  wet: number;
  theme: number; // how loud this world's theme sits
}

const STAGES: Stage[] = [
  { id: "system", theme: dbg(-12.5), prog: chords("Am9 D9/F# Cadd9 Em11"), per: 2, bpm: 72, fire: 1, bass: 0.8, bright: 2100, wet: 0.8,
    bed: { wave: "warm", voices: 4, lo: 55, hi: 76, detune: 7, cutoff: 1500, level: 0.1, mode: "swap", xfade: 2.6, lfo: 0.06 } },
  { id: "mirror", theme: dbg(-13), prog: chords("Dbmaj7#11 Abmaj9"), per: 2, bpm: 54, fire: 0, bass: 0.4, bright: 3400, wet: 1.0,
    bed: { wave: "glass", voices: 4, lo: 62, hi: 84, detune: 3, cutoff: 3400, level: 0.09, mode: "glide", glide: 2, lfo: 0.05 } },
  { id: "ring", theme: dbg(-12), prog: chords("Aq Bq"), per: 2, bpm: 66, fire: 0.4, bass: 0.5, bright: 1800, wet: 0.7,
    bed: { wave: "warm", voices: 3, lo: 50, hi: 67, detune: 5, cutoff: 1100, level: 0.09, mode: "glide", glide: 1.6, lfo: 0.3, lfoDepth: 0.3 } },
  { id: "listener", theme: dbg(-21), prog: chords("Ebmaj7 Cm7 Abmaj9 Bb6"), per: 1, bpm: 96, fire: 0.5, bass: 0.7, bright: 2400, wet: 0.75,
    bed: { wave: "reed", voices: 4, lo: 55, hi: 72, detune: 6, cutoff: 1700, level: 0.08, mode: "swap", xfade: 2, lfo: 0.06 } },
  { id: "disk", theme: dbg(-13.5), prog: chords("F#m9 Gmaj7/F#"), per: 4, bpm: 40, fire: 0.8, bass: 0, bright: 900, wet: 1.1,
    bed: { wave: "bowed", voices: 4, lo: 38, hi: 58, detune: 10, cutoff: 520, level: 0.155, mode: "swap", xfade: 3.5, lfo: 0.03 } },
  { id: "geode", theme: dbg(-15), prog: chords("Bbmaj7#11 Cadd9/Bb"), per: 2, bpm: 110, fire: 0, bass: 0, bright: 4000, wet: 1.2,
    bed: { wave: "glass", voices: 4, lo: 72, hi: 91, detune: 4, cutoff: 4000, level: 0.085, mode: "glide", glide: 3, lfo: 0.09 } },
  { id: "arch", theme: dbg(-9), prog: chords("Eadd9 B6/D# C#m9 Amaj9"), per: 2, bpm: 60, fire: 0.3, bass: 0.5, bright: 2600, wet: 0.95,
    bed: { wave: "air", voices: 4, lo: 57, hi: 79, detune: 5, cutoff: 2200, level: 0.11, mode: "swap", xfade: 3, lfo: 0.05 } },
  { id: "nets", theme: dbg(-16), prog: chords("Am9 G6 Fmaj9 Em11"), per: 1, bpm: 120, fire: 0.3, bass: 0.6, bright: 2200, wet: 0.8,
    bed: { wave: "warm", voices: 3, lo: 52, hi: 69, detune: 5, cutoff: 1200, level: 0.08, mode: "swap", xfade: 1.6, lfo: 0.08 } },
  { id: "comet", theme: dbg(-17), prog: chords("Fm11 Dbmaj9"), per: 4, bpm: 46, fire: 0, bass: 0, bright: 3000, wet: 1.2,
    bed: { wave: "choir", voices: 4, lo: 60, hi: 84, detune: 12, cutoff: 2400, level: 0.13, mode: "glide", glide: 4, lfo: 0.035 } },
  { id: "belt", theme: dbg(-9), prog: chords("Em11 Asus4"), per: 4, bpm: 50, fire: 0.5, bass: 0, bright: 1200, wet: 0.9,
    bed: { wave: "air", voices: 3, lo: 48, hi: 64, detune: 4, cutoff: 900, level: 0.125, mode: "swap", xfade: 3.5, lfo: 0.03 } },
];

// a small tuned stone, for the arch and the belt
const PEBBLE: ModalSpec = { ratios: [1, 2.31, 3.89], amps: [1, 0.4, 0.15], decays: [0.1, 0.05, 0.03], strike: 0.2, strikeCut: 2400 };

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
  private glass!: Sampler;
  private wood!: Sampler;
  private pebble!: Sampler;
  private bass!: Mono;
  private bassM = nm("A2");
  private fig!: GainNode; // the themes: on the music path
  private touch!: GainNode; // hover, flight and arrival: in front
  private fire!: Pad;
  private swell!: Pad;
  private world: Pad | null = null;

  stage = 0;
  private wanted = 0;
  private onPage = 0;
  private wantedAt = -1;
  private moveEnd = -1;
  private lastApply = -1;
  private stageBar = -1;
  private sweep = new Flutter();
  private opened = -1;

  // the system's motif, in A Dorian degrees from A3, and its answer
  private final = [4, 3, 2, 3, 4, 6];
  private answer = [7, 6, 4, 5, 4];
  private callR = [0, 2, 3, 6, 9, 10];
  private answerR = [0, 3, 5, 6, 9];
  private draft: number[] = [];
  private k = 0;
  private sweepAt = 0;
  private sweepI = 32;

  protected room(): RoomSpec {
    return { rt60: 1.9, length: 2.2, predelay: 0.016, early: 8, earlyLevel: 0.4, hi: 5500, lo: 1300, damp: 0.5, lowCut: 90, bloom: 0, width: 0.95 };
  }

  private section(i: number): Section {
    const s = STAGES[i];
    return { bars: s.prog.length * s.per, prog: s.prog, per: s.per, layers: {} };
  }
  protected onSection(_s: Section, _t: number) {
    // levels follow the stage, not a form
  }

  protected setup(t: number) {
    const r = this.rng;
    this.sections = [this.section(0)];
    this.loopFrom = 0;
    // the first stop's theme plays whole too, past the fade in
    this.arrivalBar = 1;
    this.fire = new Pad(this, this.layer("fire", 0, this.bed), {
      wave: this.st.wave("organ"), voices: 2, lo: 40, hi: 60, detune: 6, cutoff: 900, q: 0.7, level: 0.07, mode: "glide", glide: 2.4, lfo: 0.13,
    });
    this.fire.set([nm("A2"), nm("E3")], t);
    this.layer("pad", 0, this.bed);
    this.layers.pad.gain.value = 1;
    this.bass = new Mono(this, this.layer("bass", 0.15), { wave: this.st.wave("warm"), cutoff: 900, level: 0.11, sub: 0.3, lo: 33, hi: 50 });
    this.fig = this.bus(1, 0.5);
    this.touch = this.bus(1, 0.42, undefined, true);
    // at free travel: a swell of the world's own chord, following the scroll
    this.swell = new Pad(this, this.air, {
      wave: this.st.wave("air"), voices: this.phone ? 2 : 3, lo: 69, hi: 88, detune: 7, cutoff: 3000, level: 0, mode: "glide", glide: 1.4,
    });
    this.pads.push(this.swell);

    this.gut = new Sampler(this, (sr, f) => pluck(sr, f, 1.8, { bright: 0.35, t60: 1.6, pick: 0.18 }, r), 20, 10, "theme");
    this.frame = new Sampler(this, (sr, f) => modal(sr, f, 0.6, MODES.frame, r), 4, 6, "theme");
    this.stone = new Sampler(this, (sr, f) => modal(sr, f, 0.3, MODES.stone, r), 6, 6, "theme");
    this.glass = new Sampler(this, (sr, f) => bell(sr, f, 1.5, BELLS.glass, r), 16, 12, "theme");
    this.wood = new Sampler(this, (sr, f) => modal(sr, f, 0.35, MODES.wood, r), 8, 6, "theme");
    this.spark = new Sampler(this, (sr, f) => bell(sr, f, 0.9, BELLS.spark, r), 14, 12, "theme");
    this.pebble = new Sampler(this, (sr, f) => modal(sr, f, 0.25, PEBBLE, r), 12, 16, "theme");
    this.tap = new Sampler(this, (sr, f) => modal(sr, f, 0.25, MODES.stone, r), 12, 5);
    this.grains = this.spark;
    this.gut.warm([57, 59, 60, 62, 64, 66, 67, 69, 71]);
    this.setBed(0, t);
    this.st.deep.place(PROJECT_WORLDS[0], t, 0.4);
    this.draft = this.final.map((d) => (r() < 0.4 ? d + this.pick([-2, -1, 1, 2]) : d));
    this.layers.fire.gain.value = STAGES[0].fire;
    this.layers.bass.gain.value = STAGES[0].bass;
  }

  /** Each world's theme has its own level, so all of them stand the same way over their beds. */
  themeLevel() {
    return STAGES[this.stage].theme;
  }

  /** A world's bed arrives at a time; the one before fades out under it. */
  private setBed(i: number, at: number) {
    const b = STAGES[i].bed;
    const old = this.world;
    const p = new Pad(this, this.layers.pad, {
      ...b,
      wave: this.st.wave(b.wave),
      voices: this.phone ? Math.min(3, b.voices) : b.voices,
      startAt: at,
    });
    if (old) {
      this.pads = this.pads.filter((x) => x !== old);
      old.destroy(at, 1.2);
    }
    this.pads.unshift(p);
    this.world = p;
  }

  /** Move to a stage: from a time, a new bed, drone and room, and the theme arrives. */
  private applyStage(i: number, at: number) {
    if (i === this.stage) return;
    this.stage = i;
    this.lastApply = this.ac.currentTime;
    const s = STAGES[i];
    this.sections = [this.section(i)];
    this.sec = 0;
    this.secBar = -1;
    this.stageBar = -1;
    this.alignBar();
    this.arrivalBar = this.bar + 1;
    this.bpm = s.bpm;
    this.setBed(i, at);
    if (this.st.deep.owner === this) this.st.deep.place(PROJECT_WORLDS[i], at, 0.9);
    this.layers.fire.gain.setTargetAtTime(s.fire, at, 0.5);
    this.layers.bass.gain.setTargetAtTime(s.bass, at, 0.3);
    this.verbOut.gain.setTargetAtTime(s.wet, at, 0.6);
    this.bright = s.bright;
    this.brighten(at, 0.4);
    const base = bassOf(s.prog[0], this.bassM, 40, 52);
    if (s.fire > 0) this.fire.set([base, base + 7], at);
    this.draft = this.final.map((d) => (this.rng() < 0.4 ? d + this.pick([-2, -1, 1, 2]) : d));
    this.sweepI = 32;
    this.k = 0;
  }

  protected onChord(c: Chord, _t: number) {
    this.bassM = bassOf(c, this.bassM, 38, 50);
  }

  protected onBar(t: number) {
    this.stageBar++;
    // a flight's length is an estimate, and a visitor can turn back halfway:
    // the page's last word on where we are wins, once it has settled
    const now = this.ac.currentTime;
    if (now > this.moveEnd + 4) this.wanted = this.onPage;
    if (this.wanted !== this.stage && now > this.moveEnd + 0.2 && now > this.wantedAt + 0.4) {
      this.applyStage(this.wanted, t);
      // this bar's harmony has already gone by: bring the new bed in on its chord now
      this.secBar = 0;
      this.stageBar = 0;
      this.harmony(STAGES[this.stage].prog[0], t);
    }
    // after each call, one wrong note in the draft is put right
    if (this.bar % 2 === 1) {
      const wrong = this.draft.map((d, i) => (d !== this.final[i] ? i : -1)).filter((i) => i >= 0);
      if (wrong.length) {
        const i = this.pick(wrong);
        this.draft[i] = this.final[i];
      }
    }
    if (STAGES[this.stage].id === "arch" && this.stageBar % 2 === 0) {
      this.sweepAt = t;
      this.sweepI = 0;
    }
  }

  /** A theme note at its own place in the room. It thins out with the rest of the theme. */
  private note(s: Sampler, m: number, t: number, level: number, x: number, dur?: number) {
    ringAt(this, s, this.fig, m, t, level, x, dur, false);
  }
  /** While the rhythm holds for a flight, nothing new starts. */
  protected step(pos: number, t: number) {
    const s = STAGES[this.stage];
    if (s.bass > 0) {
      if (pos === 0) this.bass.hit(this.bassM, t, 0.8, 1.4, 0.12);
      else if (pos === 8) this.bass.hit(this.bassM + (this.rng() < 0.5 ? 12 : 7), t, 0.4, 0.7, 0.08);
    }
    switch (s.id) {
      case "system": return this.figSystem(pos, t);
      case "mirror": return this.figMirror(pos, t);
      case "ring": return this.figRing(pos, t);
      case "listener": return this.figListener(pos, t);
      case "disk": return this.figDisk(pos, t);
      case "geode": return this.figGeode(pos, t);
      case "arch": return this.figArch(t);
      case "nets": return this.figNets(pos, t);
      case "comet": return this.figComet(pos, t);
      case "belt": return this.figBelt(pos, t);
    }
  }

  // ---- what each stage plays ----------------------------------------------
  private figSystem(pos: number, t: number) {
    const r = this.rng;
    if (pos === 0 || pos === 7) this.note(this.frame, pos === 0 ? nm("A2") : nm("E3"), this.hum(t), dbg(-12) * (0.85 + 0.15 * r()), -0.6);
    else if ((pos === 4 || pos === 10) && r() < 0.5) this.note(this.frame, nm("E3"), this.hum(t, 12), dbg(-19), -0.6);
    if (pos === 3 || pos === 6 || pos === 9) this.note(this.stone, pos === 6 ? nm("A5") : nm("E5"), this.hum(t), dbg(-17) * (0.8 + 0.2 * r()), 0.3);
    const call = this.bar % 2 === 0;
    const rhythm = call ? this.callR : this.answerR;
    const k = rhythm.indexOf(pos);
    if (k >= 0) {
      let m = deg(nm("A3"), SCALE.dorian, (call ? this.draft : this.answer)[k]);
      if (k === 0) m = snap(m, this.chord.pcs);
      this.note(this.gut, m, this.hum(t, 10), dbg(-11) * (k === 0 ? 1 : 0.72) * (0.9 + 0.1 * r()), 0.65);
    }
    if (r() < 0.02) {
      const tones = tonesIn(this.chord, 81, 93);
      if (tones.length) this.note(this.spark, this.pick(tones), this.hum(t, 60), dbg(-24) * (0.6 + 0.4 * r()), r() * 1.6 - 0.8);
    }
  }

  /** Every note, then its reflection around the middle of the chord, in the other ear. */
  private figMirror(pos: number, t: number) {
    if (this.bar % 2 !== 0 || pos % 3 !== 0) return;
    const tones = tonesIn(this.chord, 67, 86);
    if (!tones.length) return;
    const m = tones[[0, 2, 1, 3][pos / 3] % tones.length];
    const axis = tones[tones.length >> 1];
    this.note(this.glass, m, this.hum(t, 4), dbg(-10), -0.7, 1.3);
    this.note(this.glass, snap(axis * 2 - m, this.chord.pcs), t + this.stepDur * 2, dbg(-13), 0.7, 1.3);
  }

  /** A slow turning: one tooth a beat, going round the listener every four bars. */
  private figRing(pos: number, t: number) {
    if (pos % 3 !== 0) return;
    const tones = tonesIn(this.chord, 52, 72);
    if (!tones.length) return;
    const n = this.k++;
    const x = Math.sin((2 * Math.PI * n) / 16) * 0.8;
    this.note(this.wood, tones[[0, 2, 1, 2][n % 4] % tones.length], t, dbg(n % 4 === 0 ? -10 : -13), x);
    if (n % 4 === 0) this.note(this.frame, this.bassM + 12, t, dbg(-15), x);
  }

  /** Two voices taking turns over a hand drum. */
  private figListener(pos: number, t: number) {
    if (pos === 0 || pos === 6) this.note(this.frame, pos === 0 ? nm("Eb3") : nm("Bb2"), this.hum(t), dbg(-14), 0);
    if (pos === 3 || pos === 9) this.note(this.stone, nm("Bb5"), this.hum(t), dbg(-21), 0);
    const tones = tonesIn(this.chord, 62, 79);
    if (!tones.length) return;
    if (this.bar % 2 === 0) {
      const k = [0, 3, 4, 6].indexOf(pos);
      if (k >= 0) lead(this, this.fig, tones[[1, 2, 3, 2][k] % tones.length], t, this.stepDur * 1.6, dbg(-15), { wave: this.st.wave("reed"), attack: 0.04, release: 0.3, cutoff: 2200, vib: 5, vibRate: 5, key: "theme" });
    } else {
      const k = [1, 3, 4, 7].indexOf(pos);
      if (k >= 0) this.note(this.gut, tones[[2, 1, 2, 0][k] % tones.length], this.hum(t, 8), dbg(-11), 0.65);
    }
  }

  /** A deep low pull: one bowed note every two bars, sliding down a fifth. */
  private figDisk(pos: number, t: number) {
    if (pos !== 0 || this.bar % 2 !== 0) return;
    const m = bassOf(this.chord, null, 45, 57);
    lead(this, this.fig, m, t, this.stepDur * 18, dbg(-11), { wave: this.st.wave("bowed"), attack: 1, release: 1.6, cutoff: 800, vib: 5, vibRate: 3.5, detune: 9, glideFrom: m + 7, glideTime: 3, key: "theme" });
    this.note(this.glass, m + 36, t + 0.5, dbg(-22), -0.6, 1.4);
  }

  /** Crystal: the chord broken across octaves and across the room. */
  private figGeode(pos: number, t: number) {
    if (![0, 1, 3, 4, 6, 8, 9, 11].includes(pos) || this.rng() > 0.7) return;
    const tones = tonesIn(this.chord, 72, 93);
    if (!tones.length) return;
    this.note(this.spark, this.pick(tones), this.hum(t, 8), dbg(-11) * (0.6 + 0.4 * this.rng()), this.rng() * 1.6 - 0.8);
  }

  /** A sweep of light over 32 stones: up and over, left to right. */
  private figArch(t: number) {
    if (this.sweepI >= 32) return;
    const end = t + this.stepDur;
    const tones = tonesIn(this.chord, 60, 88);
    if (!tones.length) return;
    while (this.sweepI < 32) {
      const at = this.sweepAt + this.sweepI * 0.075;
      if (at >= end) break;
      const a = Math.sin((Math.PI * this.sweepI) / 31);
      this.note(this.pebble, tones[Math.floor(a * (tones.length - 1))], at, dbg(-13) * (0.35 + 0.65 * a), -0.85 + (1.7 * this.sweepI) / 31, 0.12);
      this.sweepI++;
    }
  }

  /** Sparks caught on the steps of a climbing line. */
  private figNets(pos: number, t: number) {
    const tones = tonesIn(this.chord, 69, 91);
    if (!tones.length) return;
    if (pos === 0) this.note(this.gut, this.bassM + 12, this.hum(t), dbg(-13), 0);
    if (pos % 2 === 0 && this.rng() < 0.6) {
      const n = this.k++ % tones.length;
      this.note(this.spark, tones[n], t, dbg(-13) * (0.7 + 0.3 * this.rng()), ((n % 4) / 3) * 1.2 - 0.6, 0.5);
    }
  }

  /** One bright head and a long rushing tail. */
  private figComet(pos: number, t: number) {
    if (pos !== 0) return;
    const top = tonesIn(this.chord, 79, 91);
    if (this.bar % 4 === 0 && top.length && this.allow("theme")) {
      const m = top[top.length - 1];
      this.note(this.glass, m, t, dbg(-10), -0.75, 1.3);
      rush(this, this.fig, t + 0.05, 3.4, false, dbg(-2) * this.themeLevel());
      lead(this, this.fig, m - 5, t + 0.1, 3, dbg(-14), { wave: this.st.wave("air"), attack: 0.5, release: 1.6, cutoff: 3000, glideFrom: m, glideTime: 2.8, key: "theme" });
    } else if (this.bar % 4 === 2) this.note(this.gut, this.bassM + 12, t, dbg(-14), 0.5);
  }

  /** Sparse and rocky: stones somewhere out there, and a lot of room. */
  private figBelt(pos: number, t: number) {
    const r = this.rng;
    if (pos === 0 && this.bar % 4 === 0) this.note(this.gut, this.bassM + 12, t, dbg(-13), -0.3);
    if (r() < 0.11) {
      const tones = tonesIn(this.chord, 50, 76);
      if (tones.length) this.note(this.pebble, this.pick(tones), this.hum(t, 40), dbg(-8) * (0.5 + 0.5 * r()), r() * 1.8 - 0.9);
    }
  }

  // ---- the page -----------------------------------------------------------
  pageEvent(name: string, d: Record<string, unknown>, x: number) {
    if (!this.out || this.disposed) return;
    if (name === "projects:world") this.worldEvent(Number(d.index) || 0, !!d.quiet);
    else if (name === "projects:transition") this.fly(Number(d.direction) || 1, Number(d.from), Number(d.to), Number(d.duration));
    else if (name === "projects:hover") this.hoverEvent(String(d.kind), Number(d.note) || 0, x);
    else if (name === "projects:open") this.lift();
  }

  private worldEvent(i: number, quiet: boolean) {
    const k = Math.max(0, Math.min(STAGES.length - 1, Math.round(i)));
    this.wanted = k;
    this.onPage = k;
    const now = this.ac.currentTime;
    this.wantedAt = now;
    // crossing stages in flight changes nothing: the flight already knows where it lands
    if (now < this.moveEnd + 0.1) return;
    if (k === this.stage) return;
    if (quiet) return this.applyStage(k, Math.max(this.nextT, now + 0.02));
    if (now - this.lastApply < 0.25) return; // scrubbing past several: the next bar catches up
    const at = Math.max(this.nextT, now + 0.02);
    this.applyStage(k, at);
    this.land(k, at, 0.6);
    this.st.deep.impact(at, 0.55, STAGES[k].prog[0]);
  }

  /** The flight between stages. The rhythm holds, and the new world lands on arrival. */
  private fly(direction: number, from: number, to: number, ms: number) {
    // already there: the music has arrived, so nothing lands twice
    if (!Number.isFinite(to) || to === from || to < 0 || to >= STAGES.length || to === this.stage) return;
    const now = this.ac.currentTime;
    const t = now + 0.01;
    const D = Math.max(0.3, Math.min(3.5, (ms || 900) / 1000));
    const A = t + D;
    const up = direction >= 0;
    const size = Math.min(1, 0.55 + D / 3);
    const c = STAGES[to].prog[0];
    this.moveEnd = A;
    this.wanted = to;
    this.nextT = A;
    this.applyStage(to, A);
    this.transit(D, up ? 1 : -1, size, c);
    // the air of the flight
    rush(this, this.touch, t, D, up, dbg(-17) * size);
    // the new world's notes, sliding into tune as it arrives
    if (D > 0.45) {
      tonesIn(c, 62, 81).slice(-3).forEach((m) =>
        lead(this, this.touch, m, t, D * 0.9, dbg(-33) * size, { wave: this.st.wave("bowed"), attack: D * 0.55, release: 0.22, cutoff: 2400, detune: 8, glideFrom: up ? m - 7 : m + 7, glideTime: D * 0.85 }),
      );
    }
    // a bell played backwards pulls the ear into the arrival
    const pull = tonesIn(c, 72, 86)[0];
    if (pull !== undefined) this.glass.play(pull, A, dbg(-28) * size, this.touch, { rev: true, force: true });
    this.land(to, A, up ? size : size * 0.7);
  }

  /** Arrival: the new world's chord struck in its own material. */
  private land(i: number, A: number, amt: number) {
    const s = STAGES[i];
    const c = s.prog[0];
    const v = s.id === "belt" || s.id === "ring" || s.id === "arch" ? this.pebble : s.id === "geode" || s.id === "nets" ? this.spark : s.id === "system" || s.id === "listener" ? this.gut : this.glass;
    const lo = s.id === "belt" || s.id === "disk" ? 55 : 64;
    tonesIn(c, lo, lo + 22).slice(0, 3).forEach((m, n) => ringAt(this, v, this.touch, m, A + n * 0.014, dbg(-24) * amt * (n ? 0.7 : 1), -0.3 + n * 0.3, 1.2));
    thud(this, this.touch, A, 110, 58, 0.26, dbg(-27) * amt);
  }

  /** One note, pitched by note, in the current world's chord. A sweep thins into a flutter. */
  private hoverEvent(kind: string, note: number, x: number) {
    const now = this.ac.currentTime;
    const g = this.sweep.next(now);
    if (g <= 0) return;
    const t = now + 0.004 + this.rng() * 0.014;
    const pan = (x - 0.5) * 1.5;
    const pickTone = (lo: number, hi: number) => {
      const tones = tonesIn(this.chord, lo, hi);
      return tones.length ? tones[((Math.round(note) % tones.length) + tones.length) % tones.length] : lo;
    };
    if (kind === "star") ringAt(this, this.glass, this.touch, pickTone(62, 74), t, dbg(-29) * g, pan, 1);
    else if (kind === "world") ringAt(this, this.glass, this.touch, pickTone(72, 91), t, dbg(-31) * g, pan, 0.8);
    else if (kind === "part") ringAt(this, this.wood, this.touch, pickTone(64, 84), t, dbg(-29) * g, pan, 0.14);
    else if (kind === "body") ringAt(this, this.pebble, this.touch, pickTone(55, 84), t, dbg(-28) * g, pan, 0.14);
  }

  /** Opening a write up: a short lift. */
  private lift() {
    const now = this.ac.currentTime;
    if (now - this.opened < 0.5) return;
    this.opened = now;
    const t = now + 0.01;
    rush(this, this.touch, t, 0.3, true, dbg(-22));
    tonesIn(this.chord, 72, 91).slice(0, 3).forEach((m, n) => ringAt(this, this.glass, this.touch, m, t + 0.06 + n * 0.055, dbg(-29), -0.2 + n * 0.2, 0.7));
  }

  // ---- scrolling ----------------------------------------------------------
  /** The camera is flying: the gesture owns the sound, so the shimmer waits. */
  protected travelling(): boolean {
    return this.ac.currentTime < this.moveEnd + 0.35;
  }
  protected onScroll(i: number, _dir: number, _dt: number, t: number) {
    const v = this.travelling() ? 0 : i;
    this.swell.out.gain.setTargetAtTime(v * (this.phone ? 0.05 : 0.12), t, v > 0 ? 0.18 : 0.4);
    this.swell.filter.frequency.setTargetAtTime(700 + 3000 * v, t, 0.2);
  }
}
