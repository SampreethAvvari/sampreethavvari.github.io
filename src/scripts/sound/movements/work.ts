// III. Four Crafts, One Line. Work: AI engineering, forward deployed
// engineering, machine learning, software engineering.
//
// A huge amber ring station with four bays, then a trail back through the years.
//
// On the ring, one melody is split note by note between four instruments that
// stand at the four corners of the room (a hocket), so the line travels around
// the listener's head and only exists when all four play their part:
//   software engineering   marimba, front left: exact, structural
//   forward deployed       nylon string, front right: warm, human, on site
//   AI engineering         FM bell, behind right: glassy, thinking
//   machine learning       a voice whose timbre learns: each bar its
//                          harmonics move a step closer to a target, from a
//                          rough buzz toward a clear reed, and start again
//                          when the section changes, like a model training.
//
// Each bay gives its own craft the lead, with its own figure: streaming bells in
// the reading room, a telescoping boom at the dock, two turning rings in the
// scanner, a running wave along the keel. The trail goes back to 2017 with one
// bell in the dark, and every year forward adds a player, a harmony of its own
// and more of the time, so Now, in the home key, is the fullest moment.
//
// The layers are the same as the home flight: a bed for each stop, a flight that
// lands on arrival, a theme that plays whole for two bars and then comes and
// goes, and interaction in front. Scrolling or dragging turns the ring: a low
// mechanical turn that follows the speed and stops dead with it, and a comet's
// rush along the trail. That turn stands in for the generic scroll sound here.
import { Movement, type Section } from "../movement";
import { chords, deg, MODES as SCALE, snap, bassOf, tonesIn, type Chord } from "../theory";
import { Pad, Mono, Sampler, Flutter, lead, thud, ringAt, rush, type PadOpts } from "../instruments";
import { pluck, modal, MODES, fm, WAVES, dbg, kr, mtof, nm, type ModalSpec, type RoomSpec } from "../dsp";

const RHYTHMS = [
  [0, 3, 6, 8, 10, 12, 14],
  [0, 2, 4, 7, 8, 11, 12, 15],
  [0, 3, 4, 6, 8, 11, 14],
  [0, 2, 6, 8, 9, 12, 14],
];
// melodic contour in scale steps, varied a little each phrase
const CONTOUR = [1, 1, -2, 2, 1, -3, 1, 2];
const CRAFTS = ["se", "fde", "aie", "mle"];
const SE = 0, FDE = 1, AIE = 2, MLE = 3;
const BAYS = ["aie", "fde", "mle", "sde"];
// a bay's craft, in the order of the bays
const BAY_CRAFT = [AIE, FDE, MLE, SE];

interface Stop {
  id: string;
  prog: Chord[];
  per: number;
  tonic: string; // the key the line moves in
  crafts: number[]; // who plays the line
  fill: number; // how much of the line sounds
  density: number; // how much of the time the theme is there, once it has arrived
  fig: string; // this stop's own figure
  theme: number; // how loud the theme sits
  arrive: number; // how loud the arrival is struck
  bass: number;
  counter?: number;
  bright: number;
  wet: number;
  bed: Omit<PadOpts, "wave"> & { wave: string };
}

const STOPS: Stop[] = [
  // the hub
  { id: "station", prog: chords("Fmaj9 Dm9 Bbmaj9 C9sus4"), per: 1, tonic: "F4", crafts: [SE, FDE], fill: 0.7, density: 0.38, fig: "", theme: dbg(-3), arrive: dbg(-27), bass: 0.6, bright: 2400, wet: 0.7,
    bed: { wave: "warm", voices: 4, lo: 48, hi: 72, detune: 6, cutoff: 1500, level: 0.11, mode: "swap", xfade: 1.6, lfo: 0.07 } },
  // the bays
  { id: "aie", prog: chords("Am9 Fmaj9"), per: 2, tonic: "C4", crafts: [AIE], fill: 0.4, density: 0.5, fig: "stream", theme: dbg(-10), arrive: dbg(-27), bass: 0.5, bright: 3000, wet: 0.6,
    bed: { wave: "air", voices: 4, lo: 60, hi: 79, detune: 5, cutoff: 2400, level: 0.1, mode: "glide", glide: 2, lfo: 0.06 } },
  { id: "fde", prog: chords("Cadd9 G6/B Am7 Fmaj9"), per: 1, tonic: "C4", crafts: [FDE], fill: 0.6, density: 0.5, fig: "boom", theme: dbg(-5), arrive: dbg(-27), bass: 0.7, bright: 2200, wet: 0.9,
    bed: { wave: "warm", voices: 3, lo: 50, hi: 69, detune: 6, cutoff: 1300, level: 0.1, mode: "swap", xfade: 1.6, lfo: 0.07 } },
  { id: "mle", prog: chords("Dm9 Bbmaj7#11"), per: 2, tonic: "F4", crafts: [MLE], fill: 0.5, density: 0.5, fig: "rings", theme: dbg(-13), arrive: dbg(-27), bass: 0.5, bright: 2400, wet: 0.6,
    bed: { wave: "reed", voices: 3, lo: 52, hi: 71, detune: 4, cutoff: 1500, level: 0.085, mode: "glide", glide: 2, lfo: 0.3, lfoDepth: 0.25 } },
  { id: "sde", prog: chords("Bbmaj9 Gm9 Dm9 C9sus4"), per: 1, tonic: "F4", crafts: [SE], fill: 0.4, density: 0.5, fig: "wave", theme: dbg(-10), arrive: dbg(-27), bass: 0.7, bright: 1800, wet: 0.45,
    bed: { wave: "bowed", voices: 3, lo: 41, hi: 62, detune: 7, cutoff: 800, level: 0.13, mode: "swap", xfade: 1.6, lfo: 0.05 } },
  // the whole ring: everyone, at a distance
  { id: "trail", prog: chords("Am7 Bbmaj7#11 Gm9 C9sus4"), per: 1, tonic: "F4", crafts: [SE, FDE, AIE, MLE], fill: 0.85, density: 0.5, fig: "", theme: dbg(-8), arrive: dbg(-27), bass: 0.7, bright: 2600, wet: 1,
    bed: { wave: "choir", voices: 4, lo: 57, hi: 81, detune: 10, cutoff: 2300, level: 0.09, mode: "glide", glide: 2.5, lfo: 0.05 } },
  // the years: a player and a harmony of their own, and more of the time, each one forward
  { id: "t2017", prog: chords("Dm9 Bbmaj7"), per: 4, tonic: "F4", crafts: [AIE], fill: 0.3, density: 0.3, fig: "eclipse", theme: dbg(-13.5), arrive: dbg(-32), bass: 0, bright: 1100, wet: 1.15,
    bed: { wave: "air", voices: 3, lo: 50, hi: 69, detune: 4, cutoff: 1000, level: 0.055, mode: "swap", xfade: 3.5, lfo: 0.03 } },
  { id: "t2021", prog: chords("Am9 Cmaj9"), per: 2, tonic: "C4", crafts: [AIE, SE], fill: 0.45, density: 0.38, fig: "tuned", theme: dbg(-10.5), arrive: dbg(-30), bass: 0.3, bright: 2800, wet: 0.95,
    bed: { wave: "glass", voices: 4, lo: 60, hi: 81, detune: 3, cutoff: 2600, level: 0.085, mode: "glide", glide: 3, lfo: 0.06 } },
  { id: "t2023", prog: chords("Gm9 Ebmaj9"), per: 2, tonic: "Bb3", crafts: [AIE, SE, FDE], fill: 0.6, density: 0.46, fig: "giant", theme: dbg(-12), arrive: dbg(-29), bass: 0.6, bright: 1200, wet: 1,
    bed: { wave: "bowed", voices: 4, lo: 38, hi: 62, detune: 9, cutoff: 650, level: 0.15, mode: "swap", xfade: 3.5, lfo: 0.03 } },
  { id: "t2024v", prog: chords("Dmaj9 Bm9"), per: 2, tonic: "D4", crafts: [AIE, SE, FDE, MLE], fill: 0.75, density: 0.55, fig: "iris", theme: dbg(-10), arrive: dbg(-28), bass: 0.6, bright: 3200, wet: 0.85,
    bed: { wave: "air", voices: 4, lo: 62, hi: 86, detune: 6, cutoff: 3200, level: 0.1, mode: "glide", glide: 2, lfo: 0.06 } },
  { id: "t2024r", prog: chords("Am9 Dm9 Bbmaj9 C9sus4"), per: 1, tonic: "F4", crafts: [SE, FDE, AIE, MLE], fill: 0.9, density: 0.7, fig: "binary", theme: dbg(-10.5), arrive: dbg(-27), bass: 0.85, bright: 2400, wet: 0.8,
    bed: { wave: "warm", voices: 4, lo: 50, hi: 74, detune: 6, cutoff: 1700, level: 0.1, mode: "swap", xfade: 1.8, lfo: 0.07 } },
  // Now: the home key, the station lit whole, everyone playing
  { id: "t2025", prog: chords("Fmaj9 C/E Dm9 Bbmaj9"), per: 1, tonic: "F4", crafts: [SE, FDE, AIE, MLE], fill: 1, density: 0.9, fig: "now", theme: dbg(-10), arrive: dbg(-27), bass: 0.85, counter: 1, bright: 3000, wet: 0.9,
    bed: { wave: "warm", voices: 5, lo: 45, hi: 81, detune: 7, cutoff: 2300, level: 0.13, mode: "swap", xfade: 1.8, lfo: 0.07 } },
];
const STOP_OF: Record<string, number> = Object.fromEntries(STOPS.map((s, i) => [s.id, i]));
// a slatted door, a boom, a ring of teeth
const PLATE: ModalSpec = { ratios: [1, 2.76, 5.4], amps: [1, 0.5, 0.2], decays: [0.11, 0.06, 0.03], strike: 0.25, strikeCut: 3000 };

const bayOfPath = () => {
  if (typeof location === "undefined") return -1;
  const m = location.pathname.match(/^\/work\/([a-z]+)\/?$/);
  return m ? BAYS.indexOf(m[1]) : -1;
};

export class Work extends Movement {
  readonly id = "work";
  bpm = 80;
  div = 4;
  beats = 4;
  protected bright = 2400;
  protected wet = 0.7;
  protected trim = 1.7;
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

  private marimba!: Sampler;
  private nylon!: Sampler;
  private bellS!: Sampler;
  private plate!: Sampler;
  private fig!: GainNode; // figures, on the music path
  private touch!: GainNode; // doors, flights, hover: in front
  private world: Pad | null = null;

  stage = 0;
  private moveEnd = -1;
  private run = 0;

  // ---- the ring turning
  private turnOsc: OscillatorNode[] = [];
  private turnF!: BiquadFilterNode;
  private turnG!: GainNode;
  private rumbleF!: BiquadFilterNode;
  private rumbleG!: GainNode;
  private cometF!: BiquadFilterNode;
  private cometP!: StereoPannerNode;
  private cometG!: GainNode;
  private spinSeen = false;
  private spinning = false;
  private spinAt = 0;
  private teeth = 0;
  private toothX = 1;
  private rewindAt = -9;

  // ---- doors and hovers
  private sweep = new Flutter();
  private doorOpen = [false, false, false, false];
  private doorAt = [-9, -9, -9, -9];
  private lightAt = [-9, -9, -9, -9];
  private anyDoor = -9;

  protected room(): RoomSpec {
    return { rt60: 1.7, length: 2, predelay: 0.012, early: 8, earlyLevel: 0.42, hi: 6000, lo: 1400, damp: 0.35, lowCut: 100, bloom: 0, width: 0.95 };
  }

  private section(i: number): Section {
    const s = STOPS[i];
    const layers: Record<string, number> = { pad: 1, bass: s.bass, counter: s.counter ?? 0 };
    for (const c of s.crafts) layers[CRAFTS[c]] = 1;
    return { bars: s.prog.length * s.per, prog: s.prog, per: s.per, layers };
  }

  protected setup(t: number) {
    const r = this.rng;
    // a bay page opened directly starts inside its bay
    const b = bayOfPath();
    this.stage = b >= 0 ? b + 1 : 0;
    this.sections = [this.section(this.stage)];
    this.loopFrom = 0;
    this.density = STOPS[this.stage].density;
    this.bright = STOPS[this.stage].bright;
    // the first stop's theme plays whole too, past the fade in
    this.arrivalBar = 1;
    this.layer("pad", 0, this.bed);
    this.bass = new Mono(this, this.layer("bass", 0.12), { wave: this.st.wave("warm"), cutoff: 1000, level: 0.11, sub: 0.3, lo: 36, hi: 50 });
    this.fig = this.bus(1, 0.45);
    this.touch = this.bus(1, 0.4, undefined, true);

    this.marimba = new Sampler(this, (sr, f) => modal(sr, f, 1.2, MODES.marimba, r), 22, 14, "line");
    this.nylon = new Sampler(this, (sr, f) => pluck(sr, f, 1.6, { bright: 0.45, t60: 1.3, pick: 0.13 }, r), 18, 10, "line");
    this.bellS = new Sampler(this, (sr, f) => fm(sr, f, 1.8, { ratio: 3.5, index: 1.6, indexDecay: 0.18, decay: 0.8 }), 22, 14, "line");
    this.plate = new Sampler(this, (sr, f) => modal(sr, f, 0.2, PLATE, r), 12, 16);
    const marimba = this.marimba, nylon = this.nylon, bellS = this.bellS;
    const corners: [number, number, number][] = this.phone
      ? [[-1.2, 0, -1], [1.2, 0, -1], [1.2, 0, -1], [-1.2, 0, -1]]
      : [[-1.2, 0, -1.1], [1.2, 0, -1.1], [1.1, 0.25, 1.1], [-1.1, 0.25, 1.1]];
    const busFor = (name: string, i: number) => this.layer(name, 0, this.point(...corners[i], 0.35, 1, corners[i][2] > 0));
    const se = busFor("se", 0), fde = busFor("fde", 1), aie = busFor("aie", 2), mle = busFor("mle", 3);
    this.voices = [
      { name: "se", bus: se, play: (m, t, v) => marimba.play(m, t, dbg(-12) * v, se) },
      { name: "fde", bus: fde, play: (m, t, v) => nylon.play(m - 12, t, dbg(-12) * v, fde) },
      { name: "aie", bus: aie, play: (m, t, v) => bellS.play(m, t, dbg(-16) * v, aie) },
      { name: "mle", bus: mle, play: (m, t, v) => lead(this, mle, m, t, this.stepDur * 1.6, dbg(-17) * v, { wave: this.learnWave, attack: 0.03, release: 0.25, cutoff: 2400, vib: 4, vibRate: 5.5, key: "line" }) },
    ];
    this.layers.counter = this.gain(0, this.point(0, 0.4, -1.6, 0.4));
    this.tap = new Sampler(this, (sr, f) => modal(sr, f, 0.35, MODES.marimba, r), 12, 5);
    this.grains = bellS;
    this.relearn();
    this.setBed(this.stage, t);
    this.buildTurn(t);
    marimba.warm([65, 67, 69, 70, 72, 74, 76, 77]);
    nylon.warm([53, 55, 57, 58, 60, 62, 64, 65]);
  }

  /** Each stop's theme has its own level: the years grow as they come forward. */
  themeLevel() {
    return STOPS[this.stage].theme;
  }

  private setBed(i: number, at: number) {
    const b = STOPS[i].bed;
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

  /** Move to a stop: from a time, a new bed, a new room and key, and the theme arrives. */
  private applyStage(i: number, at: number) {
    if (i === this.stage) return;
    this.stage = i;
    const s = STOPS[i];
    this.sections = [this.section(i)];
    this.sec = 0;
    this.secBar = -1;
    this.alignBar();
    this.arrivalBar = this.bar + 1;
    this.density = s.density;
    this.setBed(i, at);
    const L = this.S.layers;
    for (const k in this.layers) this.layers[k].gain.setTargetAtTime(L[k] ?? 0, at, 0.35);
    this.verbOut.gain.setTargetAtTime(s.wet, at, 0.6);
    this.bright = s.bright;
    this.brighten(at, 0.4);
    this.run = 0;
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

  protected onChord(c: Chord, t: number) {
    this.bassM = bassOf(c, this.bassM, 36, 50);
    // the ring turns on the root of the chord
    for (const o of this.turnOsc) o.frequency.setTargetAtTime(mtof(this.bassM), t, 0.3);
  }

  protected onSection(_s: Section, _t: number) {
    // levels follow the stop; each time round, the line starts learning again
    this.relearn();
    this.rhythm = RHYTHMS[(this.stage + this.cycle) % RHYTHMS.length];
    const orders = [[0, 1, 2, 3], [0, 2, 1, 3], [3, 2, 1, 0], [1, 3, 0, 2]];
    this.order = orders[(this.stage + this.cycle * 2) % orders.length];
  }

  protected onBar(t: number) {
    // a page opened from a link with no flight of its own: go there on the next bar
    const b = bayOfPath();
    if (b >= 0 && b + 1 !== this.stage && this.ac.currentTime > this.moveEnd + 0.3) {
      this.applyStage(b + 1, t);
      this.secBar = 0;
      this.harmony(STOPS[this.stage].prog[0], t);
    }
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
    const s = STOPS[this.stage];
    const L = this.S.layers;
    if (L.bass) {
      if (pos === 0) this.bass.hit(this.bassM, t, 0.7, 1.0, 0.1);
      else if (pos === 10) this.bass.hit(this.bassM + 7, t, 0.35, 0.5, 0.08);
    }
    this.figure(s.fig, pos, t);
    const idx = this.rhythm.indexOf(pos);
    if (idx < 0) return;
    // who is playing: the crafts of this stop, in this section's order
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
    if (this.rng() < s.fill) v.play(m, this.hum(t, 6), (pos % 4 === 0 ? 1 : 0.75) * (0.9 + 0.1 * this.rng()));
    // the counter line: the pad's top voice, sung softly, on the half bars
    if (L.counter && (pos === 0 || pos === 8)) {
      const top = this.voicing[this.voicing.length - 1];
      lead(this, this.layers.counter, top > 76 ? top : top + 12, t, this.stepDur * 7, dbg(-22), { wave: this.st.wave("air"), attack: 0.4, release: 0.8, cutoff: 2200, vib: 6, vibRate: 4.8, key: "line" });
    }
  }

  private stepScale(m: number, steps: number): number {
    // find the degree of m in this stop's key and move along the scale
    const tonic = nm(STOPS[this.stage].tonic);
    let d = 0;
    for (let k = -14; k <= 14; k++) if (deg(tonic, SCALE.major, k) <= m) d = k;
    return deg(tonic, SCALE.major, d + steps);
  }

  // ---- what each stop plays besides the line ------------------------------
  private ring(s: Sampler, m: number, t: number, level: number, x: number, dur?: number) {
    ringAt(this, s, this.fig, m, t, level, x, dur, false);
  }
  private figure(fig: string, pos: number, t: number) {
    switch (fig) {
      case "stream": return this.stream(pos, t, dbg(-13));
      case "boom": return this.boom(pos, t);
      case "rings": return this.rings(pos, t);
      case "wave": return this.wave(pos, t, dbg(-13));
      case "eclipse": return this.eclipse(pos, t);
      case "tuned": return this.tuned(pos, t);
      case "giant": return this.giant(pos, t);
      case "iris": return this.iris(pos, t);
      case "binary": return this.binary(pos, t);
      case "now":
        this.stream(pos, t, dbg(-19));
        if (!this.phone) this.wave(pos, t, dbg(-21));
        return this.rings(pos, t);
    }
  }
  /** Streaming lines: a run of bells across the room, every other bar. */
  private stream(pos: number, t: number, level: number) {
    if (this.bar % 2 !== 0 || pos % 2 !== 0) return;
    const tones = tonesIn(this.chord, 74, 96);
    if (!tones.length) return;
    const a = pos / 16;
    this.ring(this.bellS, tones[Math.floor(a * tones.length)], this.hum(t, 4), level * (0.55 + 0.45 * a), -0.8 + 1.6 * a, 0.7);
  }
  /** A telescoping boom: each section reaching a step further out. */
  private boom(pos: number, t: number) {
    if (this.bar % 2 !== 0 || pos % 2 !== 0 || pos > 6) return;
    const tones = tonesIn(this.chord, 52, 76);
    if (!tones.length) return;
    const n = pos / 2;
    this.ring(this.nylon, tones[Math.min(tones.length - 1, n * 2)], this.hum(t, 6), dbg(-11) * (1 - n * 0.1), -0.2 + n * 0.28);
  }
  /** Two rings turning at different speeds, three against four. */
  private rings(pos: number, t: number) {
    const tones = tonesIn(this.chord, 67, 88);
    if (!tones.length) return;
    if (pos % 4 === 0) {
      const n = this.run++;
      this.ring(this.bellS, tones[n % tones.length], t, dbg(-14), Math.sin((2 * Math.PI * n) / 8) * 0.8, 0.8);
    }
    if (pos % 3 === 0 && pos < 15) {
      const n = Math.floor(this.bar * 5 + pos / 3);
      this.ring(this.marimba, tones[(tones.length - 1) - (n % tones.length)] - 12, t, dbg(-18), -Math.sin((2 * Math.PI * n) / 10) * 0.8, 0.3);
    }
  }
  /** A running wave along the keel. */
  private wave(pos: number, t: number, level: number) {
    const tones = tonesIn(this.chord, 60, 84);
    if (!tones.length) return;
    const a = (Math.sin((2 * Math.PI * (pos + this.bar * 4)) / 16) + 1) / 2;
    this.ring(this.marimba, tones[Math.round(a * (tones.length - 1))], this.hum(t, 3), level * (0.5 + 0.5 * a), a * 1.4 - 0.7, 0.25);
  }
  /** 2017: one note going dark, and a bell a long way off. */
  private eclipse(pos: number, t: number) {
    if (pos !== 0) return;
    if (this.bar % 2 === 0) {
      const m = bassOf(this.chord, null, 53, 65);
      lead(this, this.fig, m, t, this.stepDur * 22, dbg(-19), { wave: this.st.wave("air"), attack: 1.6, release: 2, cutoff: 1100, detune: 6, key: "line" });
    }
    if (this.bar % 4 === 1) {
      const top = tonesIn(this.chord, 79, 91);
      if (top.length) this.ring(this.bellS, top[0], t, dbg(-14), -0.5, 1.4);
    }
  }
  /** 2021: tuned rings, struck in order up the chord. */
  private tuned(pos: number, t: number) {
    if (pos % 4 !== 0 || this.bar % 2 !== 0) return;
    const tones = tonesIn(this.chord, 62, 86);
    if (!tones.length) return;
    this.ring(this.marimba, tones[Math.min(tones.length - 1, pos / 2)], t, dbg(-14), -0.6 + (pos / 12) * 1.2, 0.8);
  }
  /** 2023: a gas giant, huge and slow, under the line. */
  private giant(pos: number, t: number) {
    if (pos !== 0 || this.bar % 2 !== 0) return;
    const m = bassOf(this.chord, null, 41, 53);
    lead(this, this.fig, m, t, this.stepDur * 26, dbg(-15), { wave: this.st.wave("bowed"), attack: 1.4, release: 2, cutoff: 600, detune: 11, key: "line" });
    const top = tonesIn(this.chord, 72, 84);
    if (top.length) this.ring(this.bellS, top[top.length - 1], t + 0.3, dbg(-20), 0.6, 1.4);
  }
  /** 2024, the lens: a chord opening outward from its middle. */
  private iris(pos: number, t: number) {
    if (pos % 2 !== 0) return;
    const tones = tonesIn(this.chord, 62, 91);
    if (!tones.length) return;
    const mid = tones.length >> 1;
    const n = pos / 2;
    const off = (n % 2 ? 1 : -1) * Math.ceil(n / 2);
    const m = tones[Math.max(0, Math.min(tones.length - 1, mid + off))];
    this.ring(this.bellS, m, this.hum(t, 3), dbg(-17) * (0.65 + n * 0.05), off * 0.22, 0.7);
  }
  /** 2024, the pair: two bodies circling, each note answered in the other ear. */
  private binary(pos: number, t: number) {
    if (pos % 4 !== 0) return;
    const tones = tonesIn(this.chord, 67, 86);
    if (!tones.length) return;
    const n = this.run++;
    const x = Math.sin((2 * Math.PI * n) / 8) * 0.8;
    const m = tones[n % tones.length];
    this.ring(this.bellS, m, t, dbg(-15), x, 0.8);
    this.ring(this.marimba, tones[(n + 2) % tones.length], t + this.stepDur, dbg(-16), -x, 0.5);
  }

  // ---- the ring turning ---------------------------------------------------
  private buildTurn(t: number) {
    const ac = this.ac;
    const bus = this.bus(1, 0.18, undefined, true);
    this.turnF = this.own(ac.createBiquadFilter());
    this.turnF.type = "lowpass";
    this.turnF.frequency.value = 220;
    this.turnF.Q.value = 0.6;
    kr(this.turnF.frequency);
    this.turnG = this.gain(0, bus);
    this.turnF.connect(this.turnG);
    const organ = this.st.wave("organ");
    for (let i = 0; i < (this.phone ? 1 : 2); i++) {
      const o = this.src(ac.createOscillator());
      o.setPeriodicWave(organ);
      o.frequency.value = mtof(this.bassM);
      o.detune.value = i ? 7 : -7;
      kr(o.frequency, o.detune);
      o.connect(this.turnF);
      o.start(t);
      this.turnOsc.push(o);
    }
    const noise = (): AudioBufferSourceNode => {
      const s = this.src(ac.createBufferSource());
      s.buffer = this.st.noise;
      s.loop = true;
      s.start(t, this.rng() * 4);
      return s;
    };
    // the weight of it: a band of noise low down
    this.rumbleF = this.own(ac.createBiquadFilter());
    this.rumbleF.type = "bandpass";
    this.rumbleF.Q.value = 0.9;
    this.rumbleF.frequency.value = 200;
    kr(this.rumbleF.frequency);
    this.rumbleG = this.gain(0, bus);
    noise().connect(this.rumbleF).connect(this.rumbleG);
    // along the trail: a comet's rush
    this.cometF = this.own(ac.createBiquadFilter());
    this.cometF.type = "bandpass";
    this.cometF.Q.value = 0.8;
    this.cometF.frequency.value = 900;
    kr(this.cometF.frequency);
    this.cometP = this.own(ac.createStereoPanner());
    kr(this.cometP.pan);
    this.cometG = this.gain(0, bus);
    noise().connect(this.cometF).connect(this.cometP).connect(this.cometG);
  }

  private setTurn(a: number, v: number, section: string, t: number) {
    const dead = a < 0.04;
    // it stops dead when the hand does
    const tau = dead ? 0.02 : 0.06;
    const body = section === "bay" ? 0.55 : section === "trail" ? 0.6 : 1;
    this.turnG.gain.setTargetAtTime(dead ? 0 : Math.pow(a, 1.2) * 0.018 * body, t, tau);
    this.turnF.frequency.setTargetAtTime(170 + 520 * a, t, 0.08);
    for (const o of this.turnOsc) o.detune.setTargetAtTime((o === this.turnOsc[0] ? -7 : 7) + Math.max(-1, Math.min(1, v)) * 40, t, 0.1);
    this.rumbleG.gain.setTargetAtTime(dead ? 0 : Math.pow(a, 1.4) * 0.036 * body, t, tau);
    this.rumbleF.frequency.setTargetAtTime(140 + 420 * a, t, 0.08);
    this.cometG.gain.setTargetAtTime(section === "trail" && !dead ? Math.pow(a, 1.1) * 0.06 : 0, t, tau);
    this.cometF.frequency.setTargetAtTime(600 + 4600 * a, t, 0.1);
    this.cometP.pan.setTargetAtTime(Math.max(-1, Math.min(1, v)) * 0.45, t, 0.2);
  }

  private spinEvent(v: number, section: string) {
    const now = this.ac.currentTime;
    const dt = Math.min(0.12, now - this.spinAt);
    this.spinAt = now;
    this.spinSeen = true;
    const a = Math.min(1, Math.abs(v) / 1.4);
    this.spinning = a >= 0.04;
    this.setTurn(a, v, section, now);
    // leaving the whole ring toward the years is always the rewind, even when the
    // hand carries it most of the way and the page has no glide to announce
    if (this.stage === STOP_OF.trail && v > 0.3 && now - this.rewindAt > 3) this.rewind(now + 0.01, 1.5);
    if (section === "trail" || !this.spinning) return;
    // the teeth of the ring going past: slow, and heavy
    this.teeth += Math.abs(v) * dt * 5;
    while (this.teeth >= 1) {
      this.teeth -= 1;
      this.toothX = -this.toothX;
      ringAt(this, this.plate, this.touch, this.bassM + 12, now + 0.005, dbg(section === "bay" ? -35 : -31) * (0.45 + 0.55 * a), this.toothX * 0.35, 0.09);
    }
  }

  /** If the page goes quiet mid turn (a swap, a hidden tab), the ring still stops. */
  tick(until: number) {
    super.tick(until);
    if (this.spinning && !this.disposed && this.out && this.ac.currentTime - this.spinAt > 0.6) {
      this.spinning = false;
      this.setTurn(0, 0, "station", this.ac.currentTime);
    }
  }
  /** The turn of the ring is this page's scroll sound. */
  protected travelling(): boolean {
    return this.spinSeen;
  }
  swapped() {
    if (!this.turnG) return;
    this.spinning = false;
    this.setTurn(0, 0, "station", this.ac.currentTime);
  }

  // ---- the page -----------------------------------------------------------
  pageEvent(name: string, d: Record<string, unknown>, x: number) {
    if (!this.out || this.disposed) return;
    if (name === "work:spin") this.spinEvent(Number(d.velocity) || 0, String(d.section));
    else if (name === "work:stop") this.stopEvent(Number(d.index) || 0, String(d.id), !!d.quiet);
    else if (name === "work:transition") this.fly(String(d.direction), String(d.from), String(d.to), Number(d.duration));
    else if (name === "work:bay") this.bayEvent(String(d.id), String(d.action), x);
    else if (name === "work:hover") this.hoverEvent(String(d.kind), Number(d.note) || 0, x);
  }

  private stopEvent(index: number, id: string, quiet: boolean) {
    const now = this.ac.currentTime;
    const k = STOP_OF[id];
    if (k === undefined) {
      // a stop inside a bay page: the same world, and the theme arrives again
      this.arrivalBar = this.bar + 1;
      if (!quiet) {
        const tones = tonesIn(this.chord, 67, 88);
        if (tones.length) ringAt(this, this.voiceOf(this.stage), this.touch, tones[index % tones.length], now + 0.01, dbg(-29), 0.3, 0.9);
        thud(this, this.touch, now + 0.01, 100, 60, 0.18, dbg(-33));
      }
      return;
    }
    if (k === this.stage) return;
    const at = Math.max(this.nextT, now + 0.02);
    this.applyStage(k, at);
    if (!quiet) this.land(k, at, 0.7);
  }

  private voiceOf(stage: number): Sampler {
    const c = STOPS[stage].crafts[0];
    return c === SE ? this.marimba : c === FDE ? this.nylon : this.bellS;
  }

  /** The move between stops. The rhythm holds, and the new stop lands on arrival. */
  private fly(direction: string, from: string, to: string, ms: number) {
    const now = this.ac.currentTime;
    const t = now + 0.01;
    const D = Math.max(0.35, Math.min(direction === "rewind" ? 4 : 3, (ms || 1200) / 1000));
    const A = t + D;
    const k = STOP_OF[to];
    if (k === undefined) {
      // inside a bay page: a short move through the same world
      this.sweepAir(t, D, direction === "back" ? 1500 : 500, direction === "back" ? 500 : 1500, dbg(-31), -0.2, 0.2);
      return;
    }
    if (direction === "out") {
      // flying out of a bay: the stop the page comes to rest on decides the music
      this.seal(t, dbg(-30), true);
      rush(this, this.touch, t, D, false, dbg(-21));
      tonesIn(this.chord, 60, 79).slice(-3).forEach((m) =>
        lead(this, this.touch, m, t, D * 0.8, dbg(-35), { wave: this.st.wave("bowed"), attack: 0.1, release: 0.35, cutoff: 2300, detune: 8, glideFrom: m + 5, glideTime: D * 0.7 }),
      );
      return;
    }
    // flying into the bay you are already in front of still flies; a stop already reached does not
    const flown = direction === "in" || direction === "across";
    if (k === this.stage && !flown) return;
    const c = STOPS[k].prog[0];
    const back = direction === "back";
    this.moveEnd = A;
    this.nextT = A;
    this.applyStage(k, A);
    this.arrivalBar = this.bar + 1;
    if (direction === "rewind") {
      // the trail's first turn may already have started it
      if (now - this.rewindAt > 3) this.rewind(t, D);
    } else if (direction === "across") this.across(t, D);
    else rush(this, this.touch, t, D, !back, dbg(direction === "in" ? -21 : -24));
    // the new stop's notes sliding into tune as it arrives
    if (D > 0.45 && direction !== "rewind") {
      tonesIn(c, 60, 79).slice(-3).forEach((m) =>
        lead(this, this.touch, m, t, D * 0.9, dbg(-34), { wave: this.st.wave("bowed"), attack: D * 0.55, release: 0.22, cutoff: 2300, detune: 8, glideFrom: back ? m + 7 : m - 7, glideTime: D * 0.85 }),
      );
    }
    const pull = tonesIn(c, 72, 86)[0];
    if (pull !== undefined) this.bellS.play(pull, A, dbg(-31), this.touch, { rev: true, force: true });
    if (direction === "in" || direction === "across") this.seal(A, dbg(-31), false);
    this.land(k, A, back ? 0.75 : 1);
  }

  /** Back through the years: the ghost of each year falling past, played backward. */
  private rewind(t: number, D: number) {
    this.rewindAt = this.ac.currentTime;
    rush(this, this.touch, t, D, false, dbg(-21));
    const tones = tonesIn(this.chord, 62, 91);
    const years = 9;
    for (let i = 0; i < years; i++) {
      const at = t + D * Math.pow((i + 1) / years, 0.8);
      const m = tones.length ? tones[Math.max(0, tones.length - 1 - i)] : 72 - i;
      this.bellS.play(m, at, dbg(-33) * (1 - i * 0.05), this.touch, { rev: true, force: true });
      ringAt(this, this.plate, this.touch, m, at, dbg(-33), Math.sin(i * 2.2) * 0.6, 0.06);
    }
    const top = tonesIn(this.chord, 76, 88).slice(-1)[0];
    if (top !== undefined) lead(this, this.touch, top - 19, t, D, dbg(-31), { wave: this.st.wave("bowed"), attack: D * 0.2, release: 0.35, cutoff: 2400, detune: 9, glideFrom: top, glideTime: D * 0.95 });
  }

  /** From one bay around the ring to another: an arc from one side to the other. */
  private across(t: number, D: number) {
    this.sweepAir(t, D * 0.55, 400, 2600, dbg(-25), -0.8, 0.1);
    this.sweepAir(t + D * 0.45, D * 0.55, 2600, 500, dbg(-27), 0.1, 0.8);
    const tones = tonesIn(this.chord, 60, 76);
    for (let i = 0; i < 3 && tones.length; i++) ringAt(this, this.plate, this.touch, tones[i % tones.length], t + D * (0.3 + i * 0.2), dbg(-29), -0.5 + i * 0.5, 0.1);
  }

  /** Arrival: the new stop's chord struck by its own players. Now is struck by all of them. */
  private land(i: number, A: number, amt: number) {
    const s = STOPS[i];
    const tones = tonesIn(s.prog[0], 62, 84);
    const players = s.crafts;
    tones.slice(0, Math.max(3, players.length + 1)).forEach((m, n) => {
      const c = players[n % players.length];
      const v = c === SE ? this.marimba : c === FDE ? this.nylon : this.bellS;
      ringAt(this, v, this.touch, c === FDE ? m - 12 : m, A + n * 0.016, s.arrive * amt * (n ? 0.7 : 1), -0.45 + n * 0.25, 1.2);
    });
    thud(this, this.touch, A, 110, 55, 0.3, s.arrive * amt * 0.8);
  }

  // ---- doors ---------------------------------------------------------------
  /** A band of noise moving, from one place to another. */
  private sweepAir(t: number, D: number, f0: number, f1: number, level: number, x0: number, x1: number, q = 1.1) {
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    kr(bp.frequency);
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + D);
    const p = ac.createStereoPanner();
    kr(p.pan);
    p.pan.setValueAtTime(x0, t);
    p.pan.linearRampToValueAtTime(x1, t + D);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + D * 0.45);
    g.gain.setTargetAtTime(0, t + D * 0.6, D * 0.14);
    src.connect(bp).connect(p).connect(g).connect(this.touch);
    src.start(t, this.rng() * 4);
    src.stop(t + D + 0.6);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      p.disconnect();
      g.disconnect();
    };
  }

  /** A heavy seal: the weight landing, and air let out. Reversed, the seal letting go. */
  private seal(t: number, level: number, release: boolean) {
    if (release) {
      this.sweepAir(t, 0.22, 2200, 5200, level * 0.5, 0, 0, 0.8);
      thud(this, this.touch, t + 0.16, 62, 96, 0.22, level * 0.8);
    } else {
      thud(this, this.touch, t, 94, 44, 0.36, level);
      this.sweepAir(t + 0.02, 0.2, 5200, 2200, level * 0.45, 0, 0, 0.8);
    }
  }

  private bayEvent(id: string, action: string, x: number) {
    const b = BAYS.indexOf(id);
    if (b < 0) return;
    const now = this.ac.currentTime;
    const t = now + 0.01;
    if (action === "hover") {
      if (now - this.lightAt[b] < 0.8) return;
      this.lightAt[b] = now;
      this.light(b, t, x);
    } else if (action === "open") {
      if (this.doorOpen[b]) return;
      this.doorOpen[b] = true;
      // a sweep past the doors leaves most of them shut
      if (now - this.doorAt[b] < 0.7 || now - this.anyDoor < 0.55) return;
      this.doorAt[b] = now;
      this.anyDoor = now;
      this.doors(b, t, true);
    } else if (action === "close") {
      if (!this.doorOpen[b]) return;
      this.doorOpen[b] = false;
      if (now - this.doorAt[b] < 0.45 || now - this.anyDoor < 0.55) return;
      this.doorAt[b] = now;
      this.anyDoor = now;
      this.doors(b, t, false);
    }
  }

  /** The light coming on: two rising notes in the bay's own voice. */
  private light(b: number, t: number, x: number) {
    const tones = tonesIn(this.chord, 72, 88);
    if (!tones.length) return;
    const c = BAY_CRAFT[b];
    const v = c === SE ? this.marimba : c === FDE ? this.nylon : this.bellS;
    const pan = (x - 0.5) * 1.4;
    const i = b % tones.length;
    const shift = c === FDE ? -12 : 0;
    const level = dbg(c === FDE ? -28 : -33);
    ringAt(this, v, this.touch, tones[i] + shift, t, level, pan, 0.5);
    ringAt(this, v, this.touch, tones[Math.min(tones.length - 1, i + 2)] + shift, t + 0.07, level * 0.8, pan, 0.7);
  }

  private doors(b: number, t: number, opening: boolean) {
    const tones = tonesIn(this.chord, 64, 91);
    if (!tones.length) return;
    const at = (i: number) => tones[Math.max(0, Math.min(tones.length - 1, i))];
    const L = dbg(-27);
    if (b === 0) {
      // slatted doors: each slat in turn, then a line of light
      const n = 7;
      for (let i = 0; i < n; i++) {
        const k = opening ? i : n - 1 - i;
        ringAt(this, this.plate, this.touch, at(k * 2), t + i * (opening ? 0.05 : 0.04), L * (0.7 + 0.3 * (k / n)), -0.6 + (i / (n - 1)) * 1.2, 0.07);
      }
      if (opening) this.seal(t + 0.38, dbg(-29), false);
      else this.seal(t + 0.3, dbg(-33), false);
    } else if (b === 1) {
      // clamshell doors swinging, and a boom running out on three sections
      const f0 = opening ? 180 : 900, f1 = opening ? 900 : 180;
      this.sweepAir(t, 0.6, f0, f1, dbg(-23), -0.5, -0.2);
      this.sweepAir(t + 0.03, 0.6, f0, f1, dbg(-23), 0.5, 0.2);
      for (let i = 0; i < 3; i++) ringAt(this, this.plate, this.touch, at(opening ? 1 + i * 2 : 5 - i * 2), t + (opening ? 0.42 + i * 0.14 : i * 0.12), L, 0.3, 0.09);
      if (opening) this.seal(t + 0.86, dbg(-27), false);
      else this.seal(t + 0.66, dbg(-31), false);
    } else if (b === 2) {
      // an iris: blades going round, faster as it opens
      const n = 11;
      for (let i = 0; i < n; i++) {
        const u = opening ? Math.pow(i / n, 0.7) : Math.pow(i / n, 1.4);
        ringAt(this, this.plate, this.touch, at((opening ? i : n - i) % 6 + 2), t + u * 0.6, L * 0.8, Math.sin((i / n) * 4 * Math.PI) * 0.7, 0.06);
      }
      if (opening) this.seal(t + 0.64, dbg(-29), false);
      else this.seal(t + 0.62, dbg(-33), false);
    } else {
      // blast doors: all the weight, then a wave running along the keel
      if (opening) {
        this.seal(t, dbg(-30), true);
        this.sweepAir(t + 0.1, 0.75, 90, 340, dbg(-20), -0.15, 0.15, 0.9);
        this.seal(t + 0.82, dbg(-26), false);
        for (let i = 0; i < 5; i++) ringAt(this, this.marimba, this.touch, at(i * 2), t + 0.92 + i * 0.07, dbg(-30), -0.5 + i * 0.25, 0.25);
      } else {
        this.sweepAir(t, 0.7, 340, 90, dbg(-21), 0.15, -0.15, 0.9);
        this.seal(t + 0.72, dbg(-29), false);
      }
    }
  }

  // ---- hover --------------------------------------------------------------
  /** One note, pitched by note, in the current chord. A sweep thins into a flutter. */
  private hoverEvent(kind: string, note: number, x: number) {
    const now = this.ac.currentTime;
    const g = this.sweep.next(now);
    if (g <= 0) return;
    const t = now + 0.004 + this.rng() * 0.014;
    const pan = (x - 0.5) * 1.5;
    const tone = (lo: number, hi: number) => {
      const tones = tonesIn(this.chord, lo, hi);
      return tones.length ? tones[((Math.round(note) % tones.length) + tones.length) % tones.length] : lo;
    };
    switch (kind) {
      case "bay": ringAt(this, this.bellS, this.touch, tone(70, 86), t, dbg(-31) * g, pan, 0.6); break;
      case "part": ringAt(this, this.plate, this.touch, tone(67, 91), t, dbg(-27) * g, pan, 0.1); break;
      case "body": ringAt(this, this.bellS, this.touch, tone(60, 76), t, dbg(-30) * g, pan, 1); break;
      case "stat": ringAt(this, this.marimba, this.touch, tone(69, 86), t, dbg(-30) * g, pan, 0.25); break;
      case "card": ringAt(this, this.nylon, this.touch, tone(62, 79), t, dbg(-28) * g, pan, 0.5); break;
      case "chip": ringAt(this, this.marimba, this.touch, tone(74, 93), t, dbg(-30) * g, pan, 0.14); break;
      case "point": ringAt(this, this.nylon, this.touch, tone(60, 76), t, dbg(-27) * g, pan, 0.35); break;
      case "door":
        ringAt(this, this.marimba, this.touch, tone(55, 67), t, dbg(-31) * g, pan, 0.4);
        thud(this, this.touch, t, 100, 58, 0.16, dbg(-37) * g);
        break;
    }
  }
}
