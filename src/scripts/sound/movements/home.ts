// Overture. The Long Flight. Home: the whole story in nine worlds, one per
// chapter of the scroll, each with its own instruments, register and space.
//
//   01 launch       D, open fifths. Ignition: a low rumble opens, an organ's
//                   fifth rises an octave, a breath and a heartbeat; far away a
//                   plucked string tries the theme for the first time
//   02 proof        A major, quick. Glass pulses count upward, bouncing from ear
//                   to ear
//   03 projects     G mixolydian. Two machines interlock, three against four,
//                   over an engine that pumps in eighths
//   04 disciplines  E major, walking. Four instruments at four corners pass one
//                   line around
//   05 writing      B minor, slow. The theme in full on a felt piano, the air of
//                   paper
//   06 film         D minor, a heartbeat. The landing at sunset: down through
//                   the atmosphere on low bowed strings, an engine, then
//                   touchdown. Going back up is the lift off.
//   07 mind         A mixolydian. The exit, the last of the sun: a high choir,
//                   steps on a metal ramp, then sand, one of the four notes on
//                   each step on the sand, and a wind that sings
//   08 contact      G minor, very slow. The helmet at dusk: the seal releases,
//                   the world opens from muffled to wide, a first breath of cold
//                   air, and the theme a long way off, a note at a time
//   09 connect      D again, almost still. The touch, under the Milky Way: nearly
//                   nothing, no third in the chord at all, until the hand meets
//                   the sapling on a warm D major ninth, the theme falls home to
//                   D, and a few stars
//
// So no world shares a key, a pace or a floor with the one before it (places.ts
// has each world's deep layer).
//
// From 06 to 09 the sky falls from sunset to full night, and the score follows
// it: fewer notes, less low end, a bigger and emptier room. The touch is the one
// warm moment in it.
//
// The flight is stepped: each scroll glides from one world to the next in about
// 1.4 seconds, and the new world's clock starts on the arrival, a downbeat at its
// own tempo. The jump has its own gesture: a swell that peaks at the halfway
// point, a tape stop as the floor falls away, a moment of muffled silence, then
// the new world arrives on a struck chord with the biggest low hit on the site.
// Backwards, the ship turns around: its hum swings across the field with a
// doppler bend. Clicks and hovers snap to a fine grid on the same clock. When a
// headline arrives word by word, each word gets one soft tuned note, read from
// left to right.
//
// The last four worlds are scenes the visitor scrubs: the page reports their
// progress as it follows the scroll, in either direction, and it can stop dead.
// So nothing here runs on a timer. A footfall sounds when progress crosses it,
// either way, and the seal, the touch and the touchdown each have a reverse.
import { Movement, type Section } from "../movement";
import { chord, chords, tonesIn, bassOf, type Chord } from "../theory";
import type { PadOpts } from "../instruments";
import { Pad, Mono, Sampler, Breath, lead, thud, glint, rush } from "../instruments";
import { pluck, modal, MODES, bell, BELLS, piano, fm, dbg, nm, ns, kr, mtof, type RoomSpec, type ModalSpec } from "../dsp";
import { HOME_WORLDS } from "../places";

interface Chapter { id: string; prog: Chord[]; per: number; bpm: number }
const CHAPTERS: Chapter[] = [
  { id: "launch", prog: chords("D5"), per: 4, bpm: 60 / 0.7 },
  { id: "proof", prog: chords("Asus2 F#m7 Dmaj9/A Esus4"), per: 2, bpm: 118 },
  { id: "projects", prog: chords("Gadd9 Fadd9/G C/G Gadd9"), per: 2, bpm: 98 },
  { id: "disciplines", prog: chords("Emaj9 G#m7 Amaj9 B6"), per: 1, bpm: 76 },
  { id: "writing", prog: chords("Bm9 Gmaj7 Dmaj9/F# Asus4"), per: 1, bpm: 62 },
  { id: "film", prog: chords("Dm9 Dm/C Bbmaj7 A7b9"), per: 1, bpm: 52 },
  { id: "mind", prog: chords("Aadd9 G6/A Em7/A Aadd9"), per: 2, bpm: 72 },
  { id: "contact", prog: chords("Gm11 Dm11 Csus4 Dm11"), per: 2, bpm: 46 },
  // the night holds D with no third: the third arrives with the touch
  { id: "connect", prog: chords("Dsus2"), per: 4, bpm: 40 },
];
const LAST = CHAPTERS.length - 1;

// how present each layer is in each world
const MIX: Record<string, number[]> = {
  breath: [1, 0, 0, 0, 0, 0, 0, 0, 0],
  heart: [1, 0, 0, 0, 0, 0.85, 0, 0, 0],
  ignite: [1, 0, 0, 0, 0, 0, 0, 0, 0],
  drone: [1, 0.5, 0.7, 0.4, 0.4, 0.6, 0.4, 0.25, 0.15],
  pad: [1, 1, 1, 1, 1, 1, 0.9, 0.8, 1],
  bass: [0, 0.4, 0.7, 0.9, 0.6, 0.9, 0.2, 0.08, 0],
  tally: [0, 1, 0, 0, 0, 0, 0, 0, 0],
  tallyR: [0, 1, 0, 0, 0, 0, 0, 0, 0],
  hands: [0, 0, 1, 0, 0, 0, 0, 0, 0],
  handsR: [0, 0, 1, 0, 0, 0, 0, 0, 0],
  paper: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  quartet: [0, 0, 0, 1, 0, 0, 0, 0, 0],
  theme: [1, 0, 0, 0, 1, 0, 0, 1, 0],
  strings: [0, 0, 0, 0, 0, 1, 0, 0, 0],
  toll: [0, 0, 0, 0, 0, 1, 0, 0, 0],
  stars: [0, 0, 0, 0, 0, 0, 0.35, 0.12, 0.08],
};

// each world's own bed: instrument, register, width and motion
const ENGINE = 98 / 60; // the machines' beats a second
const BEDS: (Omit<PadOpts, "wave"> & { wave: string })[] = [
  // launch: an organ's open fifth, rising an octave at ignition
  { wave: "organ", voices: 2, lo: 38, hi: 57, detune: 5, cutoff: 900, level: 0.17, mode: "glide", glide: 3.5, lfo: 0.08 },
  // proof: thin glass, high and narrow
  { wave: "glass", voices: 3, lo: 67, hi: 86, detune: 3, cutoff: 4200, level: 0.08, mode: "swap", xfade: 1.6, lfo: 0.11 },
  // projects: a low warm engine that pumps in eighths
  { wave: "warm", voices: 3, lo: 45, hi: 64, detune: 6, cutoff: 1100, level: 0.13, mode: "swap", xfade: 1.2, lfo: ENGINE * 2, lfoDepth: 0.5 },
  // disciplines: an open reed chord in the middle, wide
  { wave: "reed", voices: 4, lo: 55, hi: 74, detune: 9, cutoff: 1900, level: 0.13, mode: "swap", xfade: 2, lfo: 0.06 },
  // writing: soft air, dark and close
  { wave: "air", voices: 4, lo: 55, hi: 72, detune: 4, cutoff: 1300, level: 0.16, mode: "swap", xfade: 2.6, lfo: 0.05 },
  // film, the landing at sunset: low bowed strings, very dark
  { wave: "bowed", voices: 4, lo: 41, hi: 62, detune: 10, cutoff: 650, level: 0.13, mode: "swap", xfade: 3, lfo: 0.04 },
  // mind, the exit: a choir, high and very wide, sliding between chords
  { wave: "choir", voices: 5, lo: 60, hi: 84, detune: 14, cutoff: 2600, level: 0.095, mode: "glide", glide: 4, lfo: 0.035 },
  // contact, the helmet at dusk: the choir thins and climbs, nothing low left
  { wave: "choir", voices: 4, lo: 62, hi: 86, detune: 8, cutoff: 2200, level: 0.095, mode: "swap", xfade: 3.5, lfo: 0.035 },
  // connect, the night: a thin breath of air, nearly nothing, so the chord can bloom
  { wave: "air", voices: 3, lo: 62, hi: 81, detune: 4, cutoff: 2000, level: 0.11, mode: "swap", xfade: 3, lfo: 0.03 },
];
// how far each world's theme sits under its written level. Most take the full
// 5 dB; those that already sit low keep their level so they stay recognisable
const THEME_TRIM = [0, -5, 0, -5, -5, 0, 0, -14, 0].map(dbg);
const BRIGHT = [1300, 1800, 2300, 3000, 2500, 1100, 3400, 3200, 2600];
const WET = [0.8, 0.8, 0.7, 0.75, 0.85, 1.05, 1.15, 1.3, 1.45];
const NIGHT_BELLS = [1, 1, 1, 1, 1, 1, 0.6, 0.3, 0.2];
// the jump keeps its shape going into the night, at a level that fits it
const NIGHT_JUMP = [1, 1, 1, 1, 1, 1, 1, 0.7, 0.5];

// the theme: D A G E, the four notes the suite keeps coming back to
type Ev = [number, number, string, number];
const THEME: Record<string, { bars: number; ev: Ev[] }> = {
  launch: { bars: 4, ev: [[1, 0, "D4", 0.8], [1, 6, "A4", 0.6], [1, 8, "G4", 0.6], [1, 12, "E4", 0.7]] },
  writing: {
    bars: 4,
    ev: [
      [0, 0, "D4", 0.9], [0, 6, "A4", 0.7], [0, 8, "G4", 0.65], [0, 12, "E4", 0.8],
      [1, 0, "F#4", 0.8], [1, 4, "G4", 0.6], [1, 8, "B4", 0.75], [1, 12, "A4", 0.65],
      [2, 0, "A4", 0.8], [2, 6, "F#4", 0.65], [2, 8, "E4", 0.6], [2, 12, "D4", 0.7],
      [3, 0, "E4", 0.75],
    ],
  },
  // dusk: the four notes a long way off, each on its own, a bar after arrival.
  // Then a long rest.
  contact: { bars: 7, ev: [[1, 0, "D5", 0.8], [1, 12, "A5", 0.6], [2, 8, "G5", 0.6], [3, 4, "E5", 0.7]] },
};
// the bowed line in the landing, per bar of its progression
const STRINGS: [string, number, number][][] = [
  [["D3", 0, 6], ["A3", 6, 2], ["G3", 8, 4], ["F3", 12, 4]],
  [["E3", 0, 16]],
  [["D3", 0, 8], ["F3", 8, 8]],
  [["C#3", 0, 16]],
];
// the theme as four stars in the last of the sun
const STAR_THEME = ["D5", "A5", "G5", "E5"];
// the chord of the touch: D major with a ninth, warm and open
const TOUCH = chord("Dmaj9");

// The planet's scenes, as the page reports them. Each one's progress follows the
// scroll, both ways, and these are the moments along it.
const SCENE_CHAPTER: Record<string, number> = { land: 5, exit: 6, helmet: 7, touch: 8 };
// The landing's beats, as the page sends them: undock, braking, touchdown, the ramp opening.
const BRAKING = 1, TOUCHDOWN = 2, RAMP = 3;
// The touch: the finger meets the sapling.
const CONTACT = 2;
// Where each foot lands, walking out: six on the ramp, then four on the sand.
const FOOTFALLS = [0.122, 0.22, 0.318, 0.416, 0.514, 0.611, 0.701, 0.792, 0.882, 1];
const ON_RAMP = 6;
const SAND_NOTES = ["D5", "A5", "G5", "E5"];
const HELMET_RELEASE = 0.42, HELMET_LIFT = 0.56, HELMET_OFF = 0.68;
const HAND_MOVES = 0.03;
const smooth = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// a soft mallet on a tuned bar: the voice of the words
const WORD: ModalSpec = { ratios: [1, 2.0, 3.99], amps: [1, 0.16, 0.05], decays: [0.42, 0.14, 0.05], strike: 0.07, strikeCut: 1500 };
// a soft boot on a metal tread
const TREAD: ModalSpec = { ratios: [1, 2.41, 3.87, 5.6], amps: [1, 0.55, 0.3, 0.12], decays: [0.2, 0.13, 0.08, 0.05], strike: 0.12, strikeCut: 1900 };

const syllables = (w: string) => Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length);
const letters = (w: string) => { let s = 0; for (let i = 0; i < w.length; i++) s += w.charCodeAt(i); return s; };

export class Home extends Movement {
  readonly id = "home";
  bpm = 60 / 0.7;
  div = 4;
  beats = 4;
  protected bright = 1300;
  protected wet = 0.8;
  protected tapLo = 74;
  protected tapHi = 88;

  private ch = 0;
  private skyLevel = 1;
  private chBar = -1;
  private cur: Record<string, number> = {};
  private lastMix = -1;
  private vel = 0;
  private bassM = nm("D2");
  private droneM = nm("D2");

  private breath!: Breath;
  private drone!: Mono;
  private bass!: Mono;
  private vchoir!: Pad;
  private pluckS!: Sampler;
  private frame!: Sampler;
  private stone!: Sampler;
  private keys!: Sampler;
  private toll!: Sampler;
  private star!: Sampler;
  private wordS!: Sampler;
  private quartet: { s: Sampler | null; bus: GainNode; shift: number; level: number }[] = [];
  private qIdx = 0;
  private qWalk = [0, 2, 1, 3, 2, 4, 3, 5];
  private buses: Record<string, GainNode> = {};
  private skies: PannerNode[] = [];
  private skyBuses: GainNode[] = [];
  private sky = 0;
  private wordPan!: StereoPannerNode;
  private wordBus!: GainNode;
  private pending: AudioScheduledSourceNode[] = [];
  // the jump: the whole movement runs through a tape stage
  private tape!: DelayNode;
  private tapeLow!: BiquadFilterNode;
  private tapeGain!: GainNode;
  private direct!: GainNode;
  private jumpUntil = 0;
  private gestureUntil = 0;
  private lastP = 0;
  private stopCurve = new Float32Array(24);
  // the ending
  private end: { wind: GainNode; sand: GainNode; sing: GainNode; helmet: GainNode; breath: Breath; air: Breath; steps: GainNode; motif: GainNode; whistles: BiquadFilterNode[] } | null = null;
  private scene = "";
  private endP = 0;
  private endV = 0;
  private endDir = 1;
  private endT = 0;
  private endBeat = 0;
  private endDuck = 0;
  private lastStep = -1;
  private stepSide = 1;
  // the lander's engine, and the timed landing used when the page sends no scene
  private roarBus: GainNode | null = null;
  private roarF!: BiquadFilterNode;
  private roarG!: GainNode;
  private roarTone!: GainNode;
  private roarOsc: OscillatorNode[] = [];
  private roarOn = 0;
  private landSeen = false;
  private fallback: GainNode | null = null;
  private fallbackDown = -1;
  private treadS: Sampler | null = null;
  private touch: GainNode | null = null;
  private shimmer = 0;
  private world: Pad | null = null;
  private glassS!: Sampler;
  private igniteLow!: BiquadFilterNode;
  private paperBand!: BiquadFilterNode;
  private extra: AudioBufferSourceNode | null = null;

  protected room(): RoomSpec {
    return { rt60: 2.8, length: 2.6, predelay: 0.03, early: 6, earlyLevel: 0.3, hi: 5200, lo: 1100, damp: 0.8, lowCut: 80, bloom: 0.05, width: 1 };
  }

  private section(i: number): Section {
    const c = CHAPTERS[i];
    return { bars: c.prog.length * c.per, prog: c.prog, per: c.per, layers: {} };
  }

  protected setup(t: number) {
    const r = this.rng;
    this.sections = [this.section(0)];
    this.loopFrom = 0;
    const L = (name: string, send: number, dest?: AudioNode) => (this.buses[name] = this.layer(name, send, dest));

    this.breath = new Breath(this, L("breath", 0.3, this.point(0, -0.1, -0.5, 0.3)), 650);
    this.drone = new Mono(this, L("drone", 0.25), { wave: this.st.wave("organ"), cutoff: 700, level: 0.08, sub: 0.25, lo: 30, hi: 45 });
    this.drone.swell(nm("D2"), t, 1, 3);
    this.bass = new Mono(this, L("bass", 0.15), { wave: this.st.wave("warm"), cutoff: 900, level: 0.2, sub: 0.3, lo: 38, hi: 52 });
    L("pad", 0, this.bed);
    // stars streaming past: chord tones up high, louder the faster you go
    this.vchoir = new Pad(this, this.air, {
      wave: this.st.wave("air"), voices: 2, lo: 72, hi: 86, detune: 7, cutoff: 4000, level: 0, mode: "glide", glide: 1.5,
    });
    this.pads.push(this.vchoir);

    L("heart", 0.2, this.point(0, -0.6, -0.6, 0.2));
    // proof: glass pulses that bounce left and right as they count
    L("tally", 0.3, this.point(-1.1, 0.25, -0.9, 0.4));
    L("tallyR", 0.3, this.point(1.1, 0.25, -0.9, 0.4));
    // projects: two machines interlocking, one each side
    L("hands", 0, this.point(-1.0, -0.3, -1.1, 0.3));
    L("handsR", 0, this.point(1.0, -0.2, -1.1, 0.3));
    L("theme", 0, this.point(-0.3, 0.05, -1.1, 0.45));
    L("strings", 0, this.point(-1.0, -0.1, -1.3, 0.5));
    L("toll", 0, this.point(2.2, 0.6, 3.8, 0.9));
    this.buses.far = this.gain(0, this.point(0.4, 0.5, 3, 0.9));

    this.pluckS = new Sampler(this, (sr, f) => pluck(sr, f, 1.8, { bright: 0.45, t60: 1.5, pick: 0.16 }, r), 22, 10, "melody");
    this.frame = new Sampler(this, (sr, f) => modal(sr, f, 0.6, MODES.frame, r), 4, 6, "rhythm");
    this.stone = new Sampler(this, (sr, f) => modal(sr, f, 0.3, MODES.stone, r), 4, 6, "rhythm");
    this.keys = new Sampler(this, (sr, f) => piano(sr, f, 2.6, r), 20, 12, "melody");
    this.toll = new Sampler(this, (sr, f) => bell(sr, f, 6, BELLS.toll, r), 2, 2, "toll");
    this.star = new Sampler(this, (sr, f) => bell(sr, f, 3.0, BELLS.star, r), 16, 8);
    this.wordS = new Sampler(this, (sr, f) => modal(sr, f, 0.7, WORD, r), 20, 12);
    this.glassS = new Sampler(this, (sr, f) => bell(sr, f, 1.1, BELLS.glass, r), 16, 10, "melody");
    this.tap = new Sampler(this, (sr, f) => modal(sr, f, 0.22, MODES.key, r), 12, 5);
    this.grains = this.star;

    // the quartet: four instruments, four corners
    const q = this.gain(0);
    this.buses.quartet = this.layers.quartet = q;
    const corners: [number, number, number][] = this.phone
      ? [[-1.2, 0, -1], [1.2, 0, -1]]
      : [[-1.2, 0, -1.1], [1.2, 0, -1.1], [1.1, 0.25, 1.1], [-1.1, 0.25, 1.1]];
    const busses = corners.map((c) => { const g = this.gain(1, this.point(...c, 0.35, 1, c[2] > 0)); q.connect(g); return g; });
    const marimba = new Sampler(this, (sr, f) => modal(sr, f, 1.2, MODES.marimba, r), 14, 6, "melody");
    const fmBell = new Sampler(this, (sr, f) => fm(sr, f, 1.6, { ratio: 3.5, index: 1.4, indexDecay: 0.2, decay: 0.7 }), 14, 6, "melody");
    this.quartet = [
      { s: marimba, bus: busses[0], shift: 0, level: dbg(-13) },
      { s: this.pluckS, bus: busses[1 % busses.length], shift: -12, level: dbg(-12) },
      { s: fmBell, bus: busses[2 % busses.length], shift: 0, level: dbg(-17) },
      { s: null, bus: busses[3 % busses.length], shift: 0, level: dbg(-18) },
    ];
    // the stars: a pool of places in the sky
    const n = this.phone ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const pan = this.panner(true);
      const g = this.gain(0, pan);
      pan.connect(this.dry);
      pan.connect(this.gain(0.7, this.verbIn));
      this.skies.push(pan);
      this.skyBuses.push(g);
    }
    // the words read left to right
    this.wordPan = this.own(this.ac.createStereoPanner());
    kr(this.wordPan.pan);
    this.wordBus = this.gain(1, this.wordPan);
    this.wordPan.connect(this.front);
    this.wordPan.connect(this.gain(0.35, this.frontVerb));

    // the tape stage: out -> delay (bent for a tape stop) -> low pass -> gain
    const ac = this.ac;
    this.tape = this.own(ac.createDelay(1));
    this.tape.delayTime.value = 0;
    this.tapeLow = this.own(ac.createBiquadFilter());
    this.tapeLow.type = "lowpass";
    this.tapeLow.frequency.value = this.tapeOpen;
    this.tapeLow.Q.value = 0.7;
    kr(this.tapeLow.frequency);
    this.tapeGain = this.gain(1, this.st.bus);
    this.out.disconnect();
    this.out.connect(this.tape).connect(this.tapeLow).connect(this.tapeGain);
    // the sub drop plays outside the tape, so it carries through the silence
    this.direct = this.gain(1, this.st.bus);

    // launch: ignition, a low rumble that opens as the fifth rises
    this.igniteLow = this.own(ac.createBiquadFilter());
    this.igniteLow.type = "lowpass";
    this.igniteLow.frequency.value = 160;
    this.igniteLow.Q.value = 1.1;
    kr(this.igniteLow.frequency);
    this.igniteLow.connect(this.gain(dbg(-23), L("ignite", 0.25)));
    // writing: the air of paper, very low
    this.paperBand = this.own(ac.createBiquadFilter());
    this.paperBand.type = "bandpass";
    this.paperBand.frequency.value = 1600;
    this.paperBand.Q.value = 0.6;
    this.paperBand.connect(this.gain(dbg(-44), L("paper", 0.6, this.air)));
    this.setWorld(0, t);
    this.st.deep.place(HOME_WORLDS[0], t, 0.4);

    this.mix(0, t);
    this.pluckS.warm([nm("D4"), nm("A4"), nm("G4"), nm("E4"), nm("F#4")]);
  }

  // ---- the flight ---------------------------------------------------------
  /** A chapter's world holds, then crosses to the next during the jump (the last fifth). */
  private at(arr: number[], p: number): number {
    const n = arr.length - 1;
    const i = Math.max(0, Math.min(n, Math.floor(p)));
    const x = Math.max(0, Math.min(1, (p - i - 0.8) / 0.2));
    const f = x * x * (3 - 2 * x);
    return arr[i] * (1 - f) + arr[Math.min(n, i + 1)] * f;
  }
  private mix(p: number, t: number, tau = 0.45) {
    this.lastMix = t;
    // the ending's scene: the flight's layers step back
    const duck = 1 - 0.65 * this.endDuck;
    for (const k in MIX) {
      const v = this.at(MIX[k], p) * duck;
      this.cur[k] = v;
      const g = k === "stars" ? null : this.buses[k];
      g?.gain.setTargetAtTime(v, t, tau);
    }
    const sky = Math.max(this.cur.stars, this.touch ? 1.6 : 0);
    for (const g of this.skyBuses) g.gain.setTargetAtTime(sky, t, tau);
    // the far theme of the first chapter lives only at the very start
    this.buses.far.gain.setTargetAtTime(this.cur.theme * Math.max(0, 1 - p * 1.5), t, tau);
    this.bright = this.at(BRIGHT, p);
    this.brighten(t, Math.min(0.3, tau));
    this.verbOut.gain.setTargetAtTime(this.at(WET, p), t, Math.max(tau, 0.2));
  }

  journey(p: number, v: number) {
    if (!this.out || this.disposed) return;
    const t = this.ac.currentTime;
    this.lastP = p;
    // during a jump the mix is already set for the arrival
    if (t > this.jumpUntil && t - this.lastMix > 0.09) this.mix(p, t);
    const vi = 1 - Math.exp(-Math.abs(v) / 0.35);
    this.vel = this.vel * 0.7 + vi * 0.3;
    if (this.vel < 0.004) this.vel = 0;
    this.vchoir.out.gain.setTargetAtTime(this.vel * 0.11, t, this.vel > 0 ? 0.18 : 0.5);
    this.vchoir.filter.frequency.setTargetAtTime(600 + 3600 * this.vel, t, 0.2);
  }

  release(t: number, seconds: number, next: Chord | null) {
    super.release(t, seconds, next);
    this.direct?.gain.setTargetAtTime(0, t, 0.3);
  }

  themeLevel(): number {
    return THEME_TRIM[this.ch] ?? THEME_TRIM[1];
  }

  /** The dusk theme is only a few notes a long way off, so all of them play. */
  allow(key: string): boolean {
    return CHAPTERS[this.ch].id === "contact" || super.allow(key);
  }

  dispose() {
    try { this.extra?.stop(); } catch { /* not started */ }
    this.extra?.disconnect();
    this.extra = null;
    super.dispose();
  }

  /** A world's bed arrives at a time; the one before fades out under it. */
  private setWorld(i: number, at: number) {
    const b = BEDS[i];
    const old = this.world;
    const p = new Pad(this, this.buses.pad, {
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
    // a world's own noise runs only while that world plays
    if (this.extra) {
      const x = this.extra;
      x.stop(at + 3);
      x.onended = () => x.disconnect();
      this.extra = null;
    }
    if (i === 0 || i === 4) {
      const src = this.ac.createBufferSource();
      src.buffer = this.st.noise;
      src.loop = true;
      src.connect(i === 0 ? this.igniteLow : this.paperBand);
      src.start(Math.max(this.ac.currentTime, at - 0.5), i === 0 ? 1.3 : 3.1);
      this.extra = src;
    }
    if (i === 0) {
      // ignition: the open fifth starts an octave down and rises; the rumble opens with it
      p.set([nm("D1"), nm("A1")], at);
      this.igniteLow.frequency.setValueAtTime(110, at);
      this.igniteLow.frequency.setTargetAtTime(420, at + 0.2, 1.0);
      this.igniteLow.frequency.setTargetAtTime(170, at + 3.5, 1.5);
    }
  }

  chapter(i: number) {
    if (!this.out || this.disposed || i === this.ch || i < 0 || i > LAST) return;
    this.ch = i;
    if (this.skyLevel < 1) {
      this.skyLevel = 1;
      if (this.st.deep.owner === this) this.st.deep.leanOn({}, this.ac.currentTime, 1.5);
    }
    this.arrivalBar = this.bar + 1;
    const at = Math.max(this.nextT, this.ac.currentTime + 0.02);
    this.setWorld(i, at);
    this.bpm = CHAPTERS[i].bpm;
    if (this.st.deep.owner === this) this.st.deep.place(HOME_WORLDS[i], at, 0.9);
    this.sections = [this.section(i)];
    this.sec = 0;
    this.secBar = -1;
    this.chBar = -1;
    // start a new bar at the next step, so the harmony turns with the page
    this.alignBar();
  }

  protected onSection(_s: Section, _t: number) {
    // levels follow the scroll, not the form
  }

  protected onChord(c: Chord, t: number) {
    this.bassM = bassOf(c, this.bassM, 38, 50);
    this.droneM = bassOf(c, this.droneM, 38, 49);
    this.drone.glide(this.droneM, t, 1.2);
    if (CHAPTERS[this.ch].id === "launch") this.bass.release(t, 2);
  }

  protected onBar(t: number) {
    this.chBar++;
    if (this.cur.breath > 0.02) this.breath.breathe(t, 1.1, 1.6, 0.28);
    // inside the helmet: faster on the walk, slower kneeling, held at the touch
    const e = this.end;
    if (e && (this.scene === "exit" || (this.scene === "helmet" && this.endP < HELMET_RELEASE))) {
      e.breath.breathe(t, 1.0, 1.7, this.scene === "exit" ? 0.6 : 0.45);
    }
    const id = CHAPTERS[this.ch].id;
    if (id === "film" && this.chBar % 4 === 0 && this.cur.toll > 0.05) this.toll.play(nm("D4"), this.hum(t, 20), dbg(-17), this.buses.toll);
    // the sun is still up: the four notes in the stars only come once the walk is over
    if (id === "mind" && this.chBar % 16 === 5 && this.cur.stars > 0.1) {
      STAR_THEME.forEach((n, i) => this.starAt(nm(n), t + i, dbg(-17)));
    }
  }

  /** The far bells thin out as the night falls. */
  protected distant(t: number) {
    const keep = NIGHT_BELLS[this.ch] ?? 1;
    if (keep >= 1 || this.rng() < keep) super.distant(t);
  }

  private starAt(m: number, t: number, level: number) {
    const k = this.sky;
    this.sky = (k + 1) % this.skies.length;
    const az = this.rng() * Math.PI * 2, el = -0.1 + this.rng() * 1.0, r = 2.2 + this.rng() * 2;
    this.setPos(this.skies[k], r * Math.sin(az) * Math.cos(el), r * Math.sin(el), -r * Math.cos(az) * Math.cos(el), t - 0.02);
    this.star.play(m, t, level, this.skyBuses[k]);
  }

  protected step(pos: number, t: number) {
    const c = this.cur;
    const r = this.rng;
    const id = CHAPTERS[this.ch].id;
    // heart: lub dub on every beat
    if (c.heart > 0.02 && pos % 4 === 0) {
      thud(this, this.buses.heart, t, 98, 56, 0.16, dbg(-18));
      thud(this, this.buses.heart, t + 0.27, 86, 50, 0.13, dbg(-22));
    }
    if (c.bass > 0.02) {
      if (pos === 0) this.bass.hit(this.bassM, t, 0.6, 1.2, 0.12);
      else if (pos === 8) this.bass.hit(this.bassM + 7, t, 0.3, 0.6, 0.08);
    }
    // proof: glass pulses count up, one more each bar, bouncing left and right
    if (c.tally > 0.02 && pos % 2 === 0) {
      const count = (Math.max(0, this.chBar) % 8) + 1;
      const j = pos / 2;
      if (j < count) {
        const tones = tonesIn(this.chord, 74, 91);
        if (tones.length) this.glassS.play(tones[j % tones.length], t, dbg(-17) * (j === 0 ? 1 : 0.72), j % 2 ? this.buses.tallyR : this.buses.tally, { dur: 0.3 });
      }
    }
    // projects: interlocking machines, three against four, one each side
    if (c.hands > 0.02) {
      if (pos % 3 === 0) this.frame.play(pos === 0 ? nm("G2") : nm("D3"), this.hum(t, 3), dbg(-13) * (pos === 0 ? 1 : 0.8), this.buses.hands);
      if (pos % 4 === 2) this.stone.play(nm("D6"), this.hum(t, 3), dbg(-18), this.buses.handsR);
      if (pos % 4 === 1) this.tap.play(nm("A6"), t, dbg(-31) * (0.8 + 0.2 * r()), this.buses.handsR);
    }
    // the quartet: one line passed around four corners
    if (c.quartet > 0.02 && pos % 2 === 0) {
      const tones = tonesIn(this.chord, 62, 81);
      if (tones.length) {
        const m = tones[this.qWalk[(pos / 2) % 8] % tones.length];
        const v = this.quartet[this.qIdx++ % this.quartet.length];
        if (v.s) v.s.play(m + v.shift, this.hum(t, 6), v.level * (pos % 8 === 0 ? 1 : 0.8), v.bus);
        else lead(this, v.bus, m, t, 0.45, v.level, { wave: this.st.wave("reed"), attack: 0.03, release: 0.3, cutoff: 2200, vib: 4, vibRate: 5.5, key: "melody" });
      }
    }
    // the theme
    const th = THEME[id];
    if (th && c.theme > 0.02) {
      const bar = Math.max(0, this.chBar) % th.bars;
      for (const [b, s, n, v] of th.ev) {
        if (b !== bar || s !== pos) continue;
        if (id === "launch") this.pluckS.play(nm(n), this.hum(t, 15), dbg(-8) * v, this.buses.far);
        else this.keys.play(nm(n), this.hum(t, 14), dbg(-13) * v, this.buses.theme);
      }
      // the left hand under the theme
      if (id === "writing" && pos === 0) this.keys.play(this.bassM + 12, this.hum(t, 10), dbg(-23), this.buses.theme);
    }
    // the bowed lament
    if (id === "film" && c.strings > 0.02) {
      for (const [n, s, len] of STRINGS[Math.max(0, this.chBar) % 4]) {
        if (s === pos) lead(this, this.buses.strings, nm(n), t, this.stepDur * len - 0.1, dbg(-16), {
          wave: this.st.wave("bowed"), attack: 0.6, release: 1.4, cutoff: 950, vib: 9, vibRate: 4.6, detune: 8, key: "melody",
        });
      }
    }
    // stars
    if (c.stars > 0.05 && r() < 0.07 * c.stars) {
      const tones = tonesIn(this.chord, 74, 91);
      if (tones.length) this.starAt(this.pick(tones), this.hum(t, 100), dbg(-18) * (0.5 + 0.5 * r()));
    }
    // after the touch, a few stars that thin out into the night again
    if (this.shimmer > 0.01) {
      if (r() < this.shimmer) this.starAt(this.pick(tonesIn(TOUCH, 79, 93)), this.hum(t, 40), dbg(-31) * (0.6 + 0.4 * r()));
      this.shimmer = Math.max(0.012, this.shimmer * 0.975);
    }
  }

  // ---- touch, on the grid ----------------------------------------------------
  /** The next point on a fine grid (a sixth of a beat) of the movement's clock. */
  private grid(t: number): number {
    const q = 60 / this.bpm / 6;
    const ref = this.nextT;
    return ref + Math.ceil((t - ref) / q - 1e-6) * q;
  }
  protected onClick(t: number, x: number, y: number) {
    super.onClick(this.grid(t), x, y);
  }
  protected onHover(t: number, x: number, y: number) {
    super.onHover(this.grid(t), x, y);
  }

  // ---- the jump ------------------------------------------------------------
  /**
   * The jump between worlds lasts exactly as long as the page's glide. The
   * swell peaks halfway, then a tape stop and a sub drop, a moment of muffled
   * silence, and the new world lands on the downbeat of arrival.
   */
  jump(from: number, to: number, dir: number, _speed: number, duration = 1.4) {
    if (!this.out || this.disposed || this.released || to < 0 || to > LAST) return;
    const ac = this.ac;
    const now = ac.currentTime;
    const D = Math.max(0.6, Math.min(3, duration || 1.4));
    const t0 = now + 0.01;
    const P = t0 + D / 2; // the peak
    const A = t0 + D; // arrival, a downbeat
    const fwd = dir >= 0;
    if (from >= 5 && to < 5) this.leaveEnding(now);
    else {
      if (from === LAST && to < LAST && this.touch) this.letGo(now);
      // the next scene's first report sets its own levels; one already played sends none
      if (this.scene) {
        this.end?.helmet.gain.setTargetAtTime(0, now, 0.3);
        this.quietEngine(now);
        this.scene = "";
      }
    }
    // the new world begins on the bar that starts at arrival
    this.nextT = A;
    this.chapter(to);
    this.nextT = A;
    this.jumpUntil = A + 0.02;
    this.mix(to, A - 0.02, 0.05);
    const c = CHAPTERS[to].prog[0];
    const deep = this.st.deep;
    // a jump that starts inside another only moves the arrival
    if (now < this.gestureUntil) {
      this.land(c, A, 0.5, true);
      deep.impact(A, 0.5, c);
      return;
    }
    this.gestureUntil = A;
    const night = NIGHT_JUMP[to] ?? 1;
    const lvl = dbg(-22) * night;

    // the swell: the new chord's top notes, sliding into tune at the peak (down, in reverse)
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 0.8;
    kr(f.frequency);
    const g = ac.createGain();
    f.connect(g).connect(this.front);
    g.gain.setValueAtTime(0, t0);
    if (fwd) {
      g.gain.setTargetAtTime(lvl, t0, D / 7);
      f.frequency.setValueAtTime(500, t0);
      f.frequency.exponentialRampToValueAtTime(3600, P);
    } else {
      g.gain.linearRampToValueAtTime(lvl, t0 + 0.08);
      g.gain.setTargetAtTime(0, t0 + 0.1, D / 6);
      f.frequency.setValueAtTime(3600, t0);
      f.frequency.exponentialRampToValueAtTime(500, P);
    }
    g.gain.setTargetAtTime(0, P + D * 0.18, 0.03);
    const oscs: OscillatorNode[] = [];
    for (const m of tonesIn(c, 62, 81).slice(-3)) {
      for (const cents of this.phone ? [0] : [-7, 7]) {
        const o = ac.createOscillator();
        kr(o.frequency);
        o.setPeriodicWave(this.st.wave("bowed"));
        o.detune.value = cents;
        o.frequency.setValueAtTime(mtof(fwd ? m - 7 : m + 7), t0);
        o.frequency.exponentialRampToValueAtTime(mtof(m), P);
        const og = ac.createGain();
        og.gain.value = this.phone ? 0.5 : 0.28;
        o.connect(og).connect(f);
        o.start(t0);
        o.stop(A);
        oscs.push(o);
        o.onended = () => {
          o.disconnect();
          og.disconnect();
        };
      }
    }
    if (oscs.length) oscs[0].addEventListener("ended", () => { f.disconnect(); g.disconnect(); });

    const tg = this.tapeGain.gain, dt = this.tape.delayTime, lp = this.tapeLow.frequency;
    const stop = D * 0.28; // the tape stop, after the peak
    const hush = P + stop; // the muffled silence, until arrival
    if (fwd) {
      // tape stop: the read head falls behind, so the pitch sinks to nothing
      for (let k = 0; k < 24; k++) this.stopCurve[k] = 0.5 * stop * (k / 23) * (k / 23);
      dt.cancelScheduledValues(now);
      dt.setValueAtTime(0, P - 0.002);
      dt.setValueCurveAtTime(this.stopCurve, P, stop);
      lp.setTargetAtTime(700, P, stop / 2);
      tg.setTargetAtTime(0.0003, hush - 0.06, 0.02);
      thud(this, this.direct, P, 82, 30, D * 0.6, dbg(-15) * night);
      // the floor falls with the tape
      deep.swoop(P, A - P, false, night);
      // back to normal while nothing is heard
      dt.setValueAtTime(0, hush + 0.04);
    } else {
      // the ship turns around: its hum swings across the field, bending as it passes
      this.turn(t0, P + D * 0.1);
      // rewinding: the room muffles, a short silence, then a sub that rises into arrival
      lp.setTargetAtTime(700, t0, D / 5);
      tg.setTargetAtTime(0.0003, hush - 0.06, 0.02);
      thud(this, this.direct, A - 0.3, 34, 74, 0.3, dbg(-17));
      deep.swoop(t0, D, true, 0.7 * night);
    }
    // something passes the ship: from ahead to behind going forward, the other way going back
    this.st.pass(fwd ? 1 : -1, D, deep.where.pass, deep.rootOf(c), night, this.rng() < 0.5 ? -1 : 1);
    deep.impact(A, (fwd ? 1 : 0.7) * night, c);
    lp.setValueAtTime(this.tapeOpen, A - 0.015);
    tg.setTargetAtTime(1, A, 0.01);
    this.land(c, A, (fwd ? 1 : 0.6) * night, fwd);
    if (fwd && to === 5 && !this.landSeen) this.descend(A);
  }

  /**
   * The landing: down through the atmosphere at sunset. A roar of
   * air rises and darkens, a low burn swells under it, and eight beats after
   * arrival the lander touches down.
   */
  private descend(A: number) {
    const ac = this.ac;
    const down = A + 5.6;
    // the page may start reporting the landing itself: then all of this steps aside
    const bus = (this.fallback = this.gain(1, this.front));
    this.fallbackDown = down;
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    src.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.9;
    kr(lp.frequency);
    lp.frequency.setValueAtTime(260, A);
    lp.frequency.exponentialRampToValueAtTime(1100, A + 3.2);
    lp.frequency.exponentialRampToValueAtTime(240, down);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, A);
    g.gain.setTargetAtTime(dbg(-22), A, 1.1);
    g.gain.setTargetAtTime(0, down - 0.05, 0.06);
    src.connect(lp).connect(g).connect(bus);
    g.connect(this.gain(0.3, this.frontVerb));
    src.start(A, 0.9);
    src.stop(down + 0.6);
    src.onended = () => { src.disconnect(); lp.disconnect(); g.disconnect(); };
    // the retro burn: a low open fifth that swells in the last seconds
    lead(this, bus, nm("D2"), A + 2.2, down - A - 2.3, dbg(-24), { wave: this.st.wave("bowed"), attack: 2.2, release: 0.15, cutoff: 600, detune: 12 });
    lead(this, bus, nm("A2"), A + 2.6, down - A - 2.7, dbg(-27), { wave: this.st.wave("bowed"), attack: 2.0, release: 0.15, cutoff: 600, detune: 12 });
    // touchdown: weight, dust, and the strings take over
    thud(this, bus, down, 78, 32, 1.0, dbg(-15));
    this.frame.play(nm("D2"), down, dbg(-17), bus, { force: true });
    this.dust(down, bus);
  }

  /** Dust settling: a soft, darkening breath of noise. */
  private dust(t: number, dest: AudioNode = this.front) {
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    kr(lp.frequency);
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 1.6);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dbg(-27), t + 0.03);
    g.gain.setTargetAtTime(0, t + 0.1, 0.5);
    src.connect(lp).connect(g).connect(dest);
    src.start(t, 2.2);
    src.stop(t + 2.4);
    src.onended = () => { src.disconnect(); lp.disconnect(); g.disconnect(); };
  }

  /** A doppler swing from right to left: pitch above as it comes, below as it goes. */
  private turn(t0: number, t1: number) {
    const ac = this.ac;
    const mid = (t0 + t1) / 2;
    const pan = ac.createStereoPanner();
    kr(pan.pan);
    pan.pan.setValueAtTime(0.95, t0);
    pan.pan.linearRampToValueAtTime(-0.95, t1);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    kr(lp.frequency);
    lp.frequency.setValueAtTime(500, t0);
    lp.frequency.exponentialRampToValueAtTime(2600, mid);
    lp.frequency.exponentialRampToValueAtTime(450, t1);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(dbg(-20), mid);
    g.gain.linearRampToValueAtTime(0, t1 + 0.05);
    lp.connect(g).connect(pan).connect(this.front);
    const nodes: AudioNode[] = [pan, lp, g];
    for (const [m, lv] of [[nm("D3"), 0.5], [nm("A3"), 0.35], [nm("D4"), 0.2]] as [number, number][]) {
      const o = ac.createOscillator();
      kr(o.frequency, o.detune);
      o.setPeriodicWave(this.st.wave("organ"));
      o.frequency.value = mtof(m);
      o.detune.setValueAtTime(70, t0);
      o.detune.linearRampToValueAtTime(-70, t1);
      const og = ac.createGain();
      og.gain.value = lv;
      o.connect(og).connect(lp);
      o.start(t0);
      o.stop(t1 + 0.1);
      nodes.push(o, og);
      if (m === nm("D3")) o.onended = () => nodes.forEach((n) => n.disconnect());
    }
    // the air it pushes, moving with it
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 1.2;
    const ng = ac.createGain();
    ng.gain.value = 0.35;
    src.connect(bp).connect(ng).connect(lp);
    src.start(t0, this.rng() * 3);
    src.stop(t1 + 0.1);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      ng.disconnect();
    };
  }

  /** Arrival: the new world's chord, struck on the downbeat. */
  private land(c: Chord, A: number, amt: number, drum: boolean) {
    const hit = dbg(-17) * amt;
    tonesIn(c, 67, 86).slice(0, 3).forEach((m, i) => this.star.play(m, A + i * 0.012, hit * (i ? 0.7 : 1), this.front));
    if (drum) this.frame.play(bassOf(c, null, 45, 57), A, hit, this.front, { force: true });
    thud(this, this.front, A, 120, 55, 0.35, hit * 0.8);
    // a reversed bell pulls the ear into the hit
    const pull = tonesIn(c, 72, 86)[0];
    if (pull !== undefined) this.star.play(pull, A, dbg(-25) * amt, this.direct, { rev: true, force: true });
  }

  // ---- the planet: three scenes in real time --------------------------------
  /** The tape stage wide open: as high as this context's rate allows. */
  private get tapeOpen(): number {
    return Math.min(18000, this.ac.sampleRate * 0.49);
  }

  private buildEnding(t: number) {
    const ac = this.ac;
    // wind: two loops of noise, each in its own slowly moving band, with gusts
    const wind = this.gain(0);
    const windTrim = this.gain(dbg(5), this.dry);
    windTrim.connect(this.gain(0.35, this.verbIn));
    wind.connect(windTrim);
    const sand = this.gain(0, this.dry);
    // the alien part: the same air through two narrow bands tuned to F sharp
    // and C sharp, so the wind sings in the key
    const sing = this.gain(0, this.dry);
    sing.connect(this.gain(0.6, this.verbIn));
    const whistles: BiquadFilterNode[] = [];
    for (const side of [-1, 1]) {
      const src = this.src(ac.createBufferSource());
      src.buffer = this.st.noise;
      src.loop = true;
      const band = this.own(ac.createBiquadFilter());
      band.type = "bandpass";
      band.frequency.value = side < 0 ? 420 : 560;
      band.Q.value = 0.7;
      kr(band.frequency);
      const sweep = this.src(ac.createOscillator());
      sweep.frequency.value = side < 0 ? 0.07 : 0.051;
      sweep.connect(this.gain(side < 0 ? 170 : 230, band.frequency));
      const gust = this.gain(0.7);
      const gusts = this.src(ac.createOscillator());
      gusts.frequency.value = side < 0 ? 0.13 : 0.09;
      gusts.connect(this.gain(0.3, gust.gain));
      const pan = this.own(ac.createStereoPanner());
      pan.pan.value = side * 0.75;
      src.connect(band).connect(gust).connect(pan).connect(wind);
      const whistle = this.own(ac.createBiquadFilter());
      whistle.type = "bandpass";
      whistle.frequency.value = side < 0 ? mtof(nm("F#5")) : mtof(nm("C#6"));
      whistle.Q.value = 9;
      kr(whistle.frequency);
      whistles.push(whistle);
      sweep.connect(this.gain(side < 0 ? 18 : 26, whistle.frequency));
      const wp = this.own(ac.createStereoPanner());
      wp.pan.value = -side * 0.6;
      src.connect(whistle).connect(wp).connect(sing);
      if (side > 0) {
        // sand: a thin high band riding the same gusts
        const hi = this.own(ac.createBiquadFilter());
        hi.type = "bandpass";
        hi.frequency.value = 2600;
        hi.Q.value = 0.9;
        const sg = this.gain(0.7, sand);
        gusts.connect(this.gain(0.4, sg.gain));
        src.connect(hi).connect(sg);
      }
      sweep.start(t);
      gusts.start(t);
      src.start(t, side > 0 ? 2.7 : 0);
    }
    // a breath inside a helmet: close, muffled, one small hard resonance
    const helmet = this.gain(0);
    const lp = this.own(ac.createBiquadFilter());
    lp.type = "lowpass";
    lp.frequency.value = 1100;
    lp.Q.value = 0.6;
    const res = this.own(ac.createBiquadFilter());
    res.type = "peaking";
    res.frequency.value = 1350;
    res.Q.value = 4;
    res.gain.value = 5;
    helmet.connect(lp).connect(res).connect(this.front);
    res.connect(this.gain(0.06, this.frontVerb));
    const breath = new Breath(this, helmet, 480);
    // the first breath of open air plays outside the muffle, soft and warm
    const open = this.gain(0.5);
    const warm = this.own(ac.createBiquadFilter());
    warm.type = "lowpass";
    warm.frequency.value = 1500;
    warm.Q.value = 0.5;
    open.connect(warm).connect(this.direct);
    const air = new Breath(this, open, 560);
    const steps = this.gain(1, this.front);
    steps.connect(this.gain(0.25, this.frontVerb));
    // the theme comes from ahead, where the sapling is
    const motif = this.gain(1, this.point(0, 0.2, -3.2, 0.7, 1, false, true));
    this.end = { wind, sand, sing, helmet, breath, air, steps, motif, whistles };
    this.treadS = new Sampler(this, (sr, f) => modal(sr, f, 0.5, TREAD, this.rng), 8, 4);
    this.treadS.warm([nm("A3"), nm("A3") - 1, nm("A3") - 2, nm("A3") - 3, nm("A3") - 4, nm("A3") - 5]);
  }

  /**
   * The last chapter's sky turns over minutes. With the galaxy under the land the
   * floor thins and darkens, and it fills again as the galaxy rises.
   */
  skyUp(up: number) {
    if (!this.out || this.disposed || this.released || this.ch !== LAST || this.st.deep.owner !== this) return;
    const u = Math.max(0, Math.min(1, up));
    if (Math.abs(u - this.skyLevel) < 0.02) return;
    this.skyLevel = u;
    const dark = 1 - u;
    this.st.deep.leanOn({ rumble: -6 * dark, growl: -5 * dark, harm: -3 * dark, cut: 1 - 0.35 * dark, hall: -2 * dark }, this.ac.currentTime, 4);
  }

  /**
   * A scene on the planet, with its progress 0..1. Progress follows the scroll,
   * so it can run either way and stop anywhere: everything below is decided by
   * where it is now and where it was a moment ago.
   */
  ending(p: number, beat: number, scene?: string, dir = 0, vel = 0) {
    if (!this.out || this.disposed || this.released) return;
    const t = this.ac.currentTime;
    if (!this.end) this.buildEnding(t);
    p = Math.max(0, Math.min(1, p || 0));
    const sc = scene && scene in SCENE_CHAPTER ? scene : this.ch === 5 ? "land" : this.ch === 6 ? "exit" : this.ch === 7 ? "helmet" : "touch";
    const going0 = dir || 1;
    // a scene that has just run out at its far end is not one being entered
    if (sc !== this.scene && ((going0 < 0 && p <= 0.002) || (going0 > 0 && p >= 0.998))) return;
    // a scene plays in its own world, whichever event got here first
    if (SCENE_CHAPTER[sc] !== this.ch) {
      this.chapter(SCENE_CHAPTER[sc]);
      this.lastP = SCENE_CHAPTER[sc];
      this.mix(this.lastP, t, 0.5);
    }
    const entering = sc !== this.scene;
    const going = dir || (entering ? 1 : Math.sign(p - this.endP) || this.endDir);
    // coming in going back up, it starts from the end of the scene
    const prev = entering ? (going < 0 ? 1 : 0) : this.endP;
    const prevBeat = entering ? (going < 0 ? 9 : -1) : this.endBeat;
    if (entering) this.enterScene(sc, t, p);
    // the page's velocity is in its own unit, so also read the speed off the progress
    const seen = entering ? 0 : Math.abs(p - prev) / Math.max(0.01, t - this.endT);
    this.endV = 1 - Math.exp(-Math.max(Math.abs(vel), seen) * 2.2);
    this.endT = t;
    this.endP = p;
    this.endDir = going;
    this.endBeat = beat;
    if (sc === "land") this.landScene(p, beat, prevBeat, t);
    else if (sc === "exit") this.exitScene(p, prev, t);
    else if (sc === "helmet") this.helmetScene(p, prev, t);
    else this.touchScene(p, prev, beat, prevBeat, t);
  }

  /** The visitor stopped, so the engine falls to its idle. */
  tick(until: number) {
    super.tick(until);
    if (this.disposed || !this.out) return;
    const now = this.ac.currentTime;
    // the timed landing: its low hit is only committed just before it lands
    if (this.fallbackDown > 0 && now > this.fallbackDown - 0.6) {
      this.st.deep.impact(this.fallbackDown, 1);
      this.fallbackDown = -1;
    }
    if (this.scene === "land" && this.endV > 0 && now - this.endT > 0.18) {
      this.endV = 0;
      this.engine(now);
    }
  }

  private enterScene(sc: string, t: number, p: number) {
    const e = this.end!;
    const was = this.scene;
    this.scene = sc;
    this.endP = p;
    if (this.touch) this.letGo(t);
    if (was === "land" || sc === "land") this.quietEngine(t);
    const set = (g: GainNode, v: number, tau = 0.6) => g.gain.setTargetAtTime(v, t, tau);
    if (sc === "land") {
      // only the engine and the strings: the air of the planet comes later
      set(e.wind, 0);
      set(e.sing, 0);
      set(e.sand, 0);
      set(e.helmet, 0, 0.2);
      this.endDuck = 0;
      this.landSeen = true;
      this.buildEngine(t);
      // the timed landing steps aside
      if (this.fallback) {
        this.fallback.gain.setTargetAtTime(0, t, 0.08);
        this.fallback = null;
        this.fallbackDown = -1;
      }
    } else if (sc === "exit") {
      // the last of the sun: a wind that sings, a helmet still on
      this.windSings("F#5", "C#6", t);
      set(e.wind, dbg(-28));
      set(e.sing, dbg(-32));
      set(e.sand, dbg(-42));
      set(e.helmet, dbg(-21));
      this.endDuck = 0.3;
    } else if (sc === "helmet") {
      // muffled at first, as heard from inside the helmet
      this.windSings("D5", "A5", t);
      set(e.wind, dbg(-29));
      set(e.sing, dbg(-36));
      set(e.sand, dbg(-44));
      this.endDuck = 0;
    } else {
      // the night: everything hushes, and only a thread of the wind still sings
      this.windSings("A5", "D6", t);
      set(e.wind, dbg(-37), 1);
      set(e.sing, dbg(-44), 1);
      set(e.sand, 0, 1);
      set(e.helmet, 0, 0.3);
      this.tapeLow.frequency.setTargetAtTime(this.tapeOpen, t, 0.2);
      this.endDuck = 0.75;
    }
    this.mix(this.lastP, t, 0.5);
  }

  /** The wind sings in the key of whichever world it is blowing through. */
  private windSings(a: string, b: string, t: number) {
    const w = this.end!.whistles;
    w[0].frequency.setTargetAtTime(mtof(nm(a)), t, 1.2);
    w[1].frequency.setTargetAtTime(mtof(nm(b)), t, 1.2);
  }

  // ---- the landing ----------------------------------------------------------
  private buildEngine(t: number) {
    if (this.roarBus) return;
    const ac = this.ac;
    const bus = (this.roarBus = this.gain(1, this.front));
    bus.connect(this.gain(0.3, this.frontVerb));
    this.roarF = this.own(ac.createBiquadFilter());
    this.roarF.type = "lowpass";
    this.roarF.Q.value = 0.9;
    this.roarF.frequency.value = 200;
    kr(this.roarF.frequency);
    this.roarG = this.gain(0, bus);
    this.roarF.connect(this.roarG);
    const src = this.src(ac.createBufferSource());
    src.buffer = this.st.noise;
    src.loop = true;
    src.connect(this.roarF);
    src.start(t, 0.9);
    // the burn: a low open fifth with a hard edge
    this.roarTone = this.gain(0, bus);
    const lp = this.own(ac.createBiquadFilter());
    lp.type = "lowpass";
    lp.frequency.value = 620;
    lp.connect(this.roarTone);
    const notes = this.phone ? [nm("D2")] : [nm("D2"), nm("A2")];
    for (const m of notes) {
      const o = this.src(ac.createOscillator());
      kr(o.frequency, o.detune);
      o.setPeriodicWave(this.st.wave("bowed"));
      o.frequency.value = mtof(m);
      o.connect(lp);
      o.start(t);
      this.roarOsc.push(o);
    }
  }

  /** Set the engine from where the lander is and how fast it is moving. */
  private engine(t: number) {
    if (!this.roarBus) return;
    const v = this.endV, up = this.endDir < 0, on = this.roarOn;
    // it hangs on a low idle when the visitor stops, and going up it strains
    const level = on * (0.34 + 0.66 * v) * (up ? 1.2 : 1);
    this.roarG.gain.setTargetAtTime(dbg(-18) * level, t, v > 0 ? 0.1 : 0.3);
    this.roarF.frequency.setTargetAtTime(170 + (up ? 1600 : 950) * on * (0.2 + 0.8 * v), t, 0.12);
    this.roarTone.gain.setTargetAtTime(dbg(-23) * level, t, v > 0 ? 0.12 : 0.35);
    const bend = up ? 90 * v : -45 * v;
    for (const o of this.roarOsc) o.detune.setTargetAtTime(bend, t, 0.15);
    this.st.deep.leanOn({ sub: 5 * level, rumble: 15 * level, growl: 9 * level, harm: 5 * level, cut: 1 + 1.4 * level }, t, 0.16);
  }

  private quietEngine(t: number) {
    if (!this.roarBus) return;
    this.roarOn = 0;
    this.roarG.gain.setTargetAtTime(0, t, 0.25);
    this.roarTone.gain.setTargetAtTime(0, t, 0.25);
    this.st.deep.leanOn({}, t, 0.5);
  }

  private landScene(p: number, beat: number, prevBeat: number, t: number) {
    // the engine lights near the top, leans in when braking, and cuts at the ground
    this.roarOn = beat >= TOUCHDOWN ? 0 : smooth(0, 0.04, p) * (beat >= BRAKING ? 1 : 0.62);
    this.engine(t);
    if (prevBeat < TOUCHDOWN && beat >= TOUCHDOWN) this.touchdown(t);
    else if (prevBeat >= TOUCHDOWN && prevBeat <= RAMP && beat < TOUCHDOWN) this.liftOff(t);
    if ((prevBeat < RAMP && beat >= RAMP) || (prevBeat === RAMP && beat < RAMP)) this.ramp(t);
  }

  /** The ramp, down or back up: hydraulics, and the weight of it coming to rest. */
  private ramp(t: number) {
    this.servo(t);
    this.servo(t + 0.24);
    this.treadS?.play(nm("A2"), t + 0.5, dbg(-26), this.front, { force: true });
    this.st.deep.hit(t + 0.5, dbg(-14), { oct: 1, from: 1.9, sweep: 0.07, dur: 0.5 });
  }

  /** Weight, dust, a frame ringing, and the strings take over. */
  private touchdown(t: number) {
    this.st.deep.impact(t + 0.005, 1.05);
    thud(this, this.direct, t, 78, 32, 1.0, dbg(-15));
    this.frame.play(nm("D2"), t, dbg(-17), this.front, { force: true });
    this.dust(t);
  }

  /** The other way: the engine catches, and the ground lets go. */
  private liftOff(t: number) {
    this.st.deep.impact(t + 0.005, 1);
    this.frame.play(nm("D2"), t, dbg(-19), this.front, { force: true });
    rush(this, this.front, t, 1.1, true, dbg(-20));
    this.dust(t);
  }

  // ---- the walk -------------------------------------------------------------
  /** A foot lands when progress crosses it, either way, and never when it is still. */
  private exitScene(p: number, prev: number, t: number) {
    if (p === prev) return;
    const lo = Math.min(p, prev), hi = Math.max(p, prev);
    let crossed: number[] = [];
    FOOTFALLS.forEach((f, i) => {
      if (f > lo && f <= hi) crossed.push(i);
    });
    if (!crossed.length) return;
    if (p < prev) crossed.reverse();
    // a fast scrub walks fast, but the steps never pile up
    crossed = crossed.slice(-2);
    crossed.forEach((i, k) => {
      const at = t + 0.004 + k * 0.08;
      if (at - this.lastStep < 0.075) return;
      this.lastStep = at;
      if (i < ON_RAMP) {
        this.rampStep(at, i);
        if (i % 2 === 1) this.servo(at + 0.06);
      } else {
        this.sandStep(at, 1);
        // far ahead, the four notes, one for each step on the sand
        this.keys.play(nm(SAND_NOTES[i - ON_RAMP]), at, dbg(-28), this.end!.motif, { force: true });
      }
    });
  }

  // ---- the helmet -----------------------------------------------------------
  private helmetScene(p: number, prev: number, t: number) {
    const e = this.end!;
    // how open the world is depends only on how far the helmet has come
    const x = Math.max(0, Math.min(1, (p - HELMET_RELEASE) / (HELMET_OFF - HELMET_RELEASE)));
    const open = p < HELMET_RELEASE ? 650 : p >= HELMET_OFF ? this.tapeOpen : 650 * Math.pow(this.tapeOpen / 650, x * x);
    this.tapeLow.frequency.setTargetAtTime(open, t, 0.12);
    e.helmet.gain.setTargetAtTime(p < HELMET_RELEASE ? dbg(-20) : 0, t, 0.15);
    if (prev < HELMET_RELEASE && p >= HELMET_RELEASE) this.seal(t + 0.004);
    else if (prev >= HELMET_RELEASE && p < HELMET_RELEASE) this.reseal(t + 0.004);
    // the first breath of open air starts as it lifts, and it is cold
    if (prev < HELMET_LIFT + 0.04 && p >= HELMET_LIFT + 0.04) e.air.breathe(t + 0.02, 2.2, 3.2, 0.3);
  }

  /** The helmet seal releases: a hiss of pressure, a click, then open air. */
  private seal(t: number) {
    const ac = this.ac;
    const e = this.end!;
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    const hp = ac.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.value = 2400;
    hp.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dbg(-27), t + 0.015);
    g.gain.setTargetAtTime(0, t + 0.05, 0.22);
    src.connect(hp).connect(g).connect(this.direct);
    src.start(t, 1.1);
    src.stop(t + 1.4);
    src.onended = () => { src.disconnect(); hp.disconnect(); g.disconnect(); };
    this.tap.play(nm("A4"), t, dbg(-26), this.direct);
    this.st.deep.hit(t, dbg(-17), { oct: 1, from: 2.1, sweep: 0.05, dur: 0.3 });
    e.helmet.gain.setTargetAtTime(0, t, 0.15);
    e.sing.gain.setTargetAtTime(dbg(-31), t + 0.5, 1.2);
  }

  /** The helmet going back on: the air drawn in, the collar locks, and the world closes. */
  private reseal(t: number) {
    const ac = this.ac;
    const e = this.end!;
    const lock = t + 0.32;
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.7;
    kr(bp.frequency);
    bp.frequency.setValueAtTime(1300, t);
    bp.frequency.exponentialRampToValueAtTime(3300, lock);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dbg(-27), lock - 0.01);
    g.gain.setTargetAtTime(0, lock, 0.012);
    src.connect(bp).connect(g).connect(this.direct);
    src.start(t, 1.1);
    src.stop(lock + 0.2);
    src.onended = () => { src.disconnect(); bp.disconnect(); g.disconnect(); };
    this.tap.play(nm("A3"), lock, dbg(-24), this.direct);
    this.st.deep.hit(lock, dbg(-15), { oct: 1, from: 1.9, sweep: 0.05, dur: 0.34 });
    e.sing.gain.setTargetAtTime(dbg(-36), t, 0.4);
  }

  // ---- the touch ------------------------------------------------------------
  private touchScene(p: number, prev: number, beat: number, prevBeat: number, t: number) {
    // the arm starts to come in: cloth on sand, and the line waits on its last note
    if (prev < HAND_MOVES && p >= HAND_MOVES) {
      this.sandStep(t, 0.45);
      this.keys.play(nm("E5"), t + 0.5, dbg(-29), this.end!.motif, { force: true });
    }
    // the hand meets the sapling as the finger comes to rest
    if (prevBeat < CONTACT && beat >= CONTACT) this.touchPlant(t + 0.005);
    else if (prevBeat >= CONTACT && beat < CONTACT && this.touch) this.fallAway(t + 0.005);
  }

  /** Going back: the warm moment falls away. */
  private fallAway(t: number) {
    this.letGo(t);
    this.st.deep.swoop(t, 1.8, false, 0.7);
    this.keys.play(nm("A4"), t, dbg(-33), this.end!.motif, { force: true });
  }

  /** The suit's servos: a short mechanical whirr that rises and settles. */
  private servo(t: number) {
    const ac = this.ac;
    const o = ac.createOscillator();
    kr(o.frequency);
    o.setPeriodicWave(this.st.wave("warm"));
    const f0 = 240 + 60 * this.rng();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.1, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 0.3);
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1000;
    bp.Q.value = 2.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dbg(-42), t + 0.03);
    g.gain.setTargetAtTime(0, t + 0.22, 0.05);
    const pan = ac.createStereoPanner();
    pan.pan.value = (this.rng() - 0.5) * 0.6;
    o.connect(bp).connect(g).connect(pan).connect(this.end!.steps);
    o.start(t);
    o.stop(t + 0.5);
    o.onended = () => { o.disconnect(); bp.disconnect(); g.disconnect(); pan.disconnect(); };
  }

  /** A soft boot on a metal tread, a little lower on each tread on the way down. */
  private rampStep(t: number, i: number) {
    const e = this.end;
    if (!e) return;
    this.stepSide = -this.stepSide;
    const lvl = dbg(-35) * (0.85 + 0.15 * this.rng());
    const pan = this.ac.createStereoPanner();
    pan.pan.value = this.stepSide * 0.18;
    pan.connect(e.steps);
    const src = this.treadS!.play(nm("A3") - i, t, lvl, pan, { dur: 0.22, force: true });
    if (src) src.addEventListener("ended", () => pan.disconnect());
    else pan.disconnect();
    thud(this, e.steps, t + 0.004, 82, 52, 0.08, dbg(-40));
    // metal, and a suit's weight on it
    this.st.deep.hit(t, dbg(-22), { oct: 1, from: 1.6, sweep: 0.04, dur: 0.17 });
  }

  /** A soft step on sand: a short breath of grit and a low press. */
  private sandStep(t: number, amt: number) {
    const e = this.end;
    if (!e) return;
    const ac = this.ac;
    this.stepSide = -this.stepSide;
    const lvl = dbg(-34) * amt * (0.85 + 0.15 * this.rng());
    // the crunch: a short burst of sand
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400 + 600 * this.rng();
    bp.Q.value = 1.1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.012);
    g.gain.setTargetAtTime(0, t + 0.02, 0.035);
    const pan = ac.createStereoPanner();
    pan.pan.value = this.stepSide * 0.18;
    src.connect(bp).connect(g).connect(pan).connect(e.steps);
    src.start(t, this.rng() * 4);
    src.stop(t + 0.25);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
      pan.disconnect();
    };
    // and the weight: a soft low press
    thud(this, e.steps, t + 0.008, 90, 55, 0.09, lvl * 0.9);
    this.st.deep.hit(t + 0.006, dbg(-27) * amt, { oct: 1, from: 1.3, sweep: 0.03, dur: 0.14 });
  }

  private touchPlant(t: number) {
    this.touch?.gain.setTargetAtTime(0, t, 0.3);
    const g = this.gain(0, this.front);
    g.connect(this.gain(0.8, this.frontVerb));
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(1, t, 0.02);
    this.touch = g;
    // the whole room moves to the chord and stays there
    this.holdHarmony = true;
    this.harmony(TOUCH, t);
    // and the floor comes up under it, warm: the only time at night there is any
    const deep = this.st.deep;
    deep.leanOn({ sub: 10, growl: 36, rumble: 6, harm: 18, cut: 1 }, t, 0.8);
    deep.hit(t, dbg(-13), { from: 1.5, sweep: 0.35, dur: 2.6 });
    // struck, rolled from the bottom
    ns("D2 A2 F#3 C#4 E4 A4").forEach((m, i) => this.keys.play(m, t + i * 0.028, dbg(i < 2 ? -33 : -35), g, { force: true }));
    // warm strings swell under it and hold: the first low notes and the first third in a long while
    ([[nm("D2"), -38], [nm("D3"), -36], [nm("A3"), -38], [nm("F#4"), -39]] as [number, number][]).forEach(([m, lv]) =>
      lead(this, g, m, t + 0.05, 9, dbg(lv), { wave: this.st.wave("bowed"), attack: 1.4, release: 4, cutoff: 1500, vib: 5, vibRate: 4.4, detune: 6 }),
    );
    // a light opens above
    ns("A5 D6 F#6").forEach((m, i) => this.starAt(m, t + 0.18 + i * 0.09, dbg(-29) * (i === 2 ? 0.8 : 1)));
    // and the theme, at last, comes to rest: F sharp falls to D
    this.keys.play(nm("F#5"), t + 1.4, dbg(-34), g, { force: true });
    this.keys.play(nm("D5"), t + 2.1, dbg(-33), g, { force: true });
    this.shimmer = 0.3;
    this.mix(this.lastP, t, 0.3);
  }

  private letGo(t: number) {
    this.touch?.gain.setTargetAtTime(0, t, 0.6);
    this.touch = null;
    this.shimmer = 0;
    this.holdHarmony = false;
    this.harmony(CHAPTERS[this.ch].prog[0], t);
    this.st.deep.leanOn({}, t, 0.9);
  }

  private leaveEnding(t: number) {
    const e = this.end;
    if (this.touch) this.letGo(t);
    this.quietEngine(t);
    this.scene = "";
    this.endP = 0;
    this.endDuck = 0;
    if (!e) return;
    for (const g of [e.wind, e.sand, e.sing, e.helmet]) g.gain.setTargetAtTime(0, t, 0.3);
  }

  // ---- the words ----------------------------------------------------------
  hush() {
    const now = this.ac.currentTime;
    for (const s of this.pending) {
      try { s.stop(now); } catch { /* done */ }
    }
    this.pending.length = 0;
  }

  /**
   * One soft tuned note per word, read left to right, then lighter grace
   * notes for the list items. Letters choose the step, syllables the length.
   */
  words(d: { words: string[]; items: number; wordStagger: number; itemStagger: number; delay: number }, late = 0) {
    if (!this.out || this.disposed || !d.words?.length) return;
    this.hush();
    const now = this.ac.currentTime;
    const ws = d.wordStagger || 0.07, is = d.itemStagger || 0.08;
    let base = now + (d.delay ?? 0.18) - late;
    if (base < now + 0.03) base = now + 0.03;
    const id = CHAPTERS[this.ch].id;
    const dark = id === "film", high = id === "mind";
    const tones = tonesIn(this.chord, dark ? 57 : 64, dark ? 76 : high ? 88 : 84);
    if (!tones.length) return;
    const words = d.words.slice(0, 14);
    const n = words.length;
    const end = base + ws * (n - 1);
    // the reading position: left to right across the phrase
    const pan = this.wordPan.pan;
    pan.cancelScheduledValues(now);
    pan.setValueAtTime(-0.75, base - 0.01);
    pan.linearRampToValueAtTime(0.75, Math.max(base + 0.05, end));
    let idx = Math.floor(tones.length / 2) - 1 + (letters(words[0]) % 3);
    words.forEach((w, i) => {
      if (i > 0) idx += (letters(w) % 5) - 2;
      idx = Math.max(0, Math.min(tones.length - 1, idx));
      let m = tones[idx];
      // the line ends on the chord's root or fifth, like a full stop
      if (i === n - 1 && n > 1) {
        const rest = tones.filter((x) => x % 12 === this.chord.root || x % 12 === (this.chord.root + 7) % 12);
        if (rest.length) m = rest.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
      }
      const syl = syllables(w);
      const v = dbg(-24) * (0.75 + 0.06 * Math.min(4, syl)) * (i === 0 ? 1.1 : 1);
      const src = this.wordS.play(m, base + i * ws, v, this.wordBus, { dur: 0.1 + 0.05 * Math.min(4, syl) });
      if (src) this.pending.push(src);
    });
    // the items: grace notes, an octave up, rising, lighter
    const up = tonesIn(this.chord, 76, 93);
    for (let j = 0; j < Math.min(d.items || 0, 8) && up.length; j++) {
      const at = end + 0.12 + j * is;
      glint(this, this.air, up[(j * 2) % up.length], at, dbg(-38), 0.12);
    }
  }
}
