// Overture. The Long Flight. Home: the whole suite in eight rooms, one per
// chapter of the scroll.
//
//   01 launch       a breath and a heartbeat; one low D; far away, a plucked
//                   string thinks of the theme for the first time
//   02 proof        plucked strings count upward, one more each bar
//   03 projects     wood and stone struck by hand over a D pedal
//   04 disciplines  four instruments at four corners pass one line around
//   05 writing      the theme, told in full on a felt piano
//   06 film         D minor, the lament bass, a bowed string, a far bell
//   07 mind         D Lydian, the widest room, bells as stars around you
//   08 contact      the theme returns and resolves; the breath comes back calm
//
// Layers are mixed continuously from the scroll position, so moving between
// two chapters is a crossfade of two rooms. Harmony changes on the chapter.
// Scrolling fast makes a high choir of chord tones swell, like stars streaming
// past. When a chapter's headline arrives word by word, each word gets one
// soft tuned note, read from left to right.
//
// Each world holds for most of its chapter; the last fifth of the scroll is a
// jump to the next world, and the jump has its own gesture: a swell rising
// into the new harmony, a tape stop with a sub drop, a moment of muffled
// silence, then the new world arrives on a struck chord. Scrolling back plays
// it in reverse: a falling swell, the room muffling as if rewound, a sub that
// rises, a softer arrival.
import { Movement, type Section } from "../movement";
import { chords, tonesIn, bassOf, type Chord } from "../theory";
import { Pad, Mono, Sampler, Breath, lead, thud, glint } from "../instruments";
import { pluck, modal, MODES, bell, BELLS, piano, fm, dbg, nm, kr, mtof, type RoomSpec, type ModalSpec } from "../dsp";

interface Chapter { id: string; prog: Chord[]; per: number }
const CHAPTERS: Chapter[] = [
  { id: "launch", prog: chords("D5"), per: 4 },
  { id: "proof", prog: chords("Dsus2 Bm7 Gmaj9 Asus4"), per: 2 },
  { id: "projects", prog: chords("Dadd9 Cadd9/D G/D Dadd9"), per: 2 },
  { id: "disciplines", prog: chords("Dmaj9 F#m7 Gmaj9 A6"), per: 1 },
  { id: "writing", prog: chords("Bm9 Gmaj7 Dmaj9/F# Asus4"), per: 1 },
  { id: "film", prog: chords("Dm9 Dm/C Bbmaj7 A7b9"), per: 1 },
  { id: "mind", prog: chords("Dmaj7#11 Eadd9/D Bm11 Dmaj7#11"), per: 2 },
  { id: "contact", prog: chords("Gmaj9 Asus4 Bm9 Gadd9 Dadd9 Dadd9"), per: 1 },
];

// how present each layer is in each chapter
const MIX: Record<string, number[]> = {
  breath: [1, 0.35, 0, 0, 0, 0, 0.25, 0.7],
  heart: [1, 0.45, 0, 0, 0, 0.8, 0, 0.3],
  drone: [1, 1, 0.8, 0.6, 0.6, 1, 0.6, 1],
  pad: [0, 0.55, 0.8, 0.9, 0.75, 0.85, 1, 1],
  bass: [0, 0.4, 0.9, 0.9, 0.7, 0.9, 0.4, 0.8],
  tally: [0, 1, 0.35, 0, 0, 0, 0, 0],
  hands: [0, 0, 1, 0.35, 0, 0, 0, 0],
  quartet: [0, 0, 0, 1, 0.25, 0, 0, 0.25],
  theme: [1, 0, 0, 0, 1, 0, 0, 1],
  strings: [0, 0, 0, 0, 0, 1, 0, 0],
  toll: [0, 0, 0, 0, 0, 1, 0.3, 0],
  stars: [0, 0, 0, 0, 0.1, 0, 1, 0.35],
};
const BRIGHT = [1300, 1800, 2300, 3000, 2500, 1100, 3600, 2900];
const WET = [0.8, 0.8, 0.7, 0.75, 0.85, 1.05, 1.35, 1.0];

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
  contact: {
    bars: 6,
    ev: [
      [0, 0, "D4", 0.85], [0, 6, "A4", 0.7], [0, 8, "G4", 0.7], [0, 12, "E4", 0.75],
      [1, 0, "E4", 0.6], [1, 8, "D4", 0.55],
      [2, 0, "F#4", 0.8], [2, 4, "A4", 0.65], [2, 8, "B4", 0.7], [2, 12, "C#5", 0.6],
      [3, 0, "D5", 0.8], [3, 6, "B4", 0.6], [3, 8, "A4", 0.6],
      [4, 0, "D4", 0.85], [4, 6, "A4", 0.7], [4, 8, "G4", 0.7], [4, 12, "E4", 0.75],
      [5, 0, "F#4", 0.8], [5, 8, "D4", 0.9],
    ],
  },
};
// the bowed line in the film chapter, per bar of its progression
const STRINGS: [string, number, number][][] = [
  [["D3", 0, 6], ["A3", 6, 2], ["G3", 8, 4], ["F3", 12, 4]],
  [["E3", 0, 16]],
  [["D3", 0, 8], ["F3", 8, 8]],
  [["C#3", 0, 16]],
];
// the theme in Lydian, as four stars
const STAR_THEME = ["D5", "A5", "G#5", "E5"];

// a soft mallet on a tuned bar: the voice of the words
const WORD: ModalSpec = { ratios: [1, 2.0, 3.99], amps: [1, 0.16, 0.05], decays: [0.42, 0.14, 0.05], strike: 0.07, strikeCut: 1500 };

const syllables = (w: string) => Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length);
const letters = (w: string) => { let s = 0; for (let i = 0; i < w.length; i++) s += w.charCodeAt(i); return s; };

export class Home extends Movement {
  readonly id = "home";
  bpm = 60;
  div = 4;
  beats = 4;
  protected bright = 1300;
  protected wet = 0.8;
  protected tapLo = 74;
  protected tapHi = 88;

  private ch = 0;
  private chBar = -1;
  private cur: Record<string, number> = {};
  private lastMix = -1;
  private vel = 0;
  private bassM = nm("D2");

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
  private wordPan!: PannerNode;
  private wordBus!: GainNode;
  private pending: AudioScheduledSourceNode[] = [];
  // the jump: the whole movement runs through a tape stage
  private tape!: DelayNode;
  private tapeLow!: BiquadFilterNode;
  private tapeGain!: GainNode;
  private direct!: GainNode;
  private jumpUntil = 0;
  private stopCurve = new Float32Array(24);

  protected room(): RoomSpec {
    return { rt60: 3.2, length: 3.2, predelay: 0.03, early: 6, earlyLevel: 0.3, hi: 5200, lo: 1100, damp: 0.8, lowCut: 80, bloom: 0.05, width: 1 };
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
    this.pads.push(new Pad(this, L("pad", 0, this.bed), {
      wave: this.st.wave("choir"), voices: this.phone ? 3 : 5, lo: 50, hi: 74, detune: 8, cutoff: 1800, level: 0.17, mode: "swap", xfade: 2.8, lfo: 0.045,
    }));
    // stars streaming past: chord tones up high, louder the faster you go
    this.vchoir = new Pad(this, this.air, {
      wave: this.st.wave("air"), voices: this.phone ? 2 : 3, lo: 72, hi: 86, detune: 7, cutoff: 4000, level: 0, mode: "glide", glide: 1.5,
    });
    this.pads.push(this.vchoir);

    L("heart", 0.2, this.point(0, -0.6, -0.6, 0.2));
    L("tally", 0, this.point(0.9, 0.1, -1.1, 0.4));
    L("hands", 0, this.point(-0.9, -0.3, -1.2, 0.35));
    L("theme", 0, this.point(-0.3, 0.05, -1.1, 0.45));
    L("strings", 0, this.point(-1.0, -0.1, -1.3, 0.5));
    L("toll", 0, this.point(2.2, 0.6, 3.8, 0.9));
    this.buses.far = this.gain(0, this.point(0.4, 0.6, 5.5, 0.9));

    this.pluckS = new Sampler(this, (sr, f) => pluck(sr, f, 1.8, { bright: 0.45, t60: 1.5, pick: 0.16 }, r), 22, 10);
    this.frame = new Sampler(this, (sr, f) => modal(sr, f, 0.6, MODES.frame, r), 4, 6);
    this.stone = new Sampler(this, (sr, f) => modal(sr, f, 0.3, MODES.stone, r), 4, 6);
    this.keys = new Sampler(this, (sr, f) => piano(sr, f, 2.6, r), 20, 12);
    this.toll = new Sampler(this, (sr, f) => bell(sr, f, 6, BELLS.toll, r), 2, 2);
    this.star = new Sampler(this, (sr, f) => bell(sr, f, 3.0, BELLS.star, r), 16, 8);
    this.wordS = new Sampler(this, (sr, f) => modal(sr, f, 0.7, WORD, r), 20, 12);
    this.tap = new Sampler(this, (sr, f) => modal(sr, f, 0.22, MODES.key, r), 12, 5);
    this.grains = this.star;

    // the quartet: four instruments, four corners
    const q = this.gain(0);
    this.buses.quartet = this.layers.quartet = q;
    const corners: [number, number, number][] = this.phone
      ? [[-1.2, 0, -1], [1.2, 0, -1]]
      : [[-1.2, 0, -1.1], [1.2, 0, -1.1], [1.1, 0.25, 1.1], [-1.1, 0.25, 1.1]];
    const busses = corners.map((c) => { const g = this.gain(1, this.point(...c, 0.35, 1, c[2] > 0)); q.connect(g); return g; });
    const marimba = new Sampler(this, (sr, f) => modal(sr, f, 1.2, MODES.marimba, r), 14, 6);
    const fmBell = new Sampler(this, (sr, f) => fm(sr, f, 1.6, { ratio: 3.5, index: 1.4, indexDecay: 0.2, decay: 0.7 }), 14, 6);
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
    this.wordPan = this.panner();
    this.wordBus = this.gain(1, this.wordPan);
    this.wordPan.connect(this.dry);
    this.wordPan.connect(this.gain(0.35, this.verbIn));
    this.setPos(this.wordPan, 0, 0.1, -1.2);

    // the tape stage: out -> delay (bent for a tape stop) -> low pass -> gain
    const ac = this.ac;
    this.tape = this.own(ac.createDelay(1));
    this.tape.delayTime.value = 0;
    this.tapeLow = this.own(ac.createBiquadFilter());
    this.tapeLow.type = "lowpass";
    this.tapeLow.frequency.value = 18000;
    this.tapeLow.Q.value = 0.7;
    kr(this.tapeLow.frequency);
    this.tapeGain = this.gain(1, this.st.bus);
    this.out.disconnect();
    this.out.connect(this.tape).connect(this.tapeLow).connect(this.tapeGain);
    // the sub drop plays outside the tape, so it carries through the silence
    this.direct = this.gain(1, this.st.bus);

    this.mix(0, t);
    this.pluckS.warm([nm("D4"), nm("A4"), nm("G4"), nm("E4"), nm("F#4")]);
  }

  // ---- the flight ---------------------------------------------------------
  /** A chapter's world holds, then crosses to the next during the jump (the last fifth). */
  private at(arr: number[], p: number): number {
    const i = Math.max(0, Math.min(7, Math.floor(p)));
    const x = Math.max(0, Math.min(1, (p - i - 0.8) / 0.2));
    const f = x * x * (3 - 2 * x);
    return arr[i] * (1 - f) + arr[Math.min(7, i + 1)] * f;
  }
  private mix(p: number, t: number) {
    this.lastMix = t;
    for (const k in MIX) {
      const v = this.at(MIX[k], p);
      this.cur[k] = v;
      const g = k === "stars" ? null : this.buses[k];
      g?.gain.setTargetAtTime(v, t, 0.45);
    }
    for (const g of this.skyBuses) g.gain.setTargetAtTime(this.cur.stars, t, 0.45);
    // the far theme of the first chapter lives only at the very start
    this.buses.far.gain.setTargetAtTime(this.cur.theme * Math.max(0, 1 - p * 1.5), t, 0.45);
    this.bright = this.at(BRIGHT, p);
    this.brighten(t, 0.3);
    this.verbOut.gain.setTargetAtTime(this.at(WET, p), t, 0.6);
  }

  journey(p: number, v: number) {
    if (!this.out || this.disposed) return;
    const t = this.ac.currentTime;
    if (t - this.lastMix > 0.09) this.mix(p, t);
    const vi = 1 - Math.exp(-Math.abs(v) / 0.7);
    this.vel = this.vel * 0.75 + vi * 0.25;
    this.vchoir.out.gain.setTargetAtTime(this.vel * 0.07, t, 0.25);
  }

  release(t: number, seconds: number, next: Chord | null) {
    super.release(t, seconds, next);
    this.direct?.gain.setTargetAtTime(0, t, 0.3);
  }

  chapter(i: number) {
    if (!this.out || this.disposed || i === this.ch || i < 0 || i > 7) return;
    this.ch = i;
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
    if (CHAPTERS[this.ch].id === "launch") this.bass.release(t, 2);
  }

  protected onBar(t: number) {
    this.chBar++;
    if (this.cur.breath > 0.02) this.breath.breathe(t, 1.6, 2.6, 0.5);
    const id = CHAPTERS[this.ch].id;
    if (id === "film" && this.chBar % 4 === 0 && this.cur.toll > 0.05) this.toll.play(nm("D4"), this.hum(t, 20), dbg(-17), this.buses.toll);
    if (id === "mind" && this.chBar % 4 === 1 && this.cur.stars > 0.1) {
      STAR_THEME.forEach((n, i) => this.starAt(nm(n), t + i, dbg(-17)));
    }
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
    // counting: one more pluck each bar
    if (c.tally > 0.02 && pos % 2 === 0) {
      const count = (Math.max(0, this.chBar) % 8) + 1;
      const j = pos / 2;
      if (j < count) {
        const tones = tonesIn(this.chord, 62, 86);
        if (tones.length) this.pluckS.play(tones[j % tones.length], this.hum(t, 6), dbg(-15) * (j === 0 ? 1 : 0.7), this.buses.tally);
      }
    }
    // hands: wood and stone
    if (c.hands > 0.02) {
      if (pos === 0 || pos === 6 || pos === 10) this.frame.play(pos === 0 ? nm("D3") : nm("A2"), this.hum(t), dbg(-14) * (0.85 + 0.15 * r()), this.buses.hands);
      if (pos === 4 || pos === 12) this.stone.play(nm("A5"), this.hum(t), dbg(-21), this.buses.hands);
      else if ((pos === 3 || pos === 9 || pos === 14) && r() < 0.4) this.stone.play(nm("E5"), this.hum(t, 12), dbg(-29), this.buses.hands);
    }
    // the quartet: one line passed around four corners
    if (c.quartet > 0.02 && pos % 2 === 0) {
      const tones = tonesIn(this.chord, 62, 81);
      if (tones.length) {
        const m = tones[this.qWalk[(pos / 2) % 8] % tones.length];
        const v = this.quartet[this.qIdx++ % this.quartet.length];
        if (v.s) v.s.play(m + v.shift, this.hum(t, 6), v.level * (pos % 8 === 0 ? 1 : 0.8), v.bus);
        else lead(this, v.bus, m, t, 0.45, v.level, { wave: this.st.wave("reed"), attack: 0.03, release: 0.3, cutoff: 2200, vib: 4, vibRate: 5.5 });
      }
    }
    // the theme
    const th = THEME[id];
    if (th && c.theme > 0.02) {
      const bar = Math.max(0, this.chBar) % th.bars;
      for (const [b, s, n, v] of th.ev) {
        if (b !== bar || s !== pos) continue;
        if (id === "launch") this.pluckS.play(nm(n), this.hum(t, 15), dbg(-16) * v, this.buses.far);
        else this.keys.play(nm(n), this.hum(t, 14), dbg(-13) * v, this.buses.theme);
      }
      // the left hand under the theme
      if (id !== "launch" && pos === 0) this.keys.play(this.bassM + 12, this.hum(t, 10), dbg(-23), this.buses.theme);
    }
    // the bowed lament
    if (id === "film" && c.strings > 0.02) {
      for (const [n, s, len] of STRINGS[Math.max(0, this.chBar) % 4]) {
        if (s === pos) lead(this, this.buses.strings, nm(n), t, this.stepDur * len - 0.1, dbg(-16), {
          wave: this.st.wave("bowed"), attack: 0.6, release: 1.4, cutoff: 950, vib: 9, vibRate: 4.6, detune: 8,
        });
      }
    }
    // stars
    if (c.stars > 0.05 && r() < 0.07 * c.stars) {
      const tones = tonesIn(this.chord, 74, 91);
      if (tones.length) this.starAt(this.pick(tones), this.hum(t, 100), dbg(-18) * (0.5 + 0.5 * r()));
    }
  }

  // ---- the jump ------------------------------------------------------------
  jump(from: number, to: number, dir: number, speed: number) {
    if (!this.out || this.disposed || this.released || to < 0 || to > 7) return;
    const ac = this.ac;
    const now = ac.currentTime;
    // the new world's harmony starts now; the gesture carries the ear there
    this.chapter(to);
    if (now < this.jumpUntil) return;
    const v = Math.abs(speed);
    const s = 1 - Math.exp(-v / 1.2); // how hard the visitor is scrolling
    const total = Math.max(0.7, Math.min(2.0, 0.2 / Math.max(0.1, v)));
    const fwd = dir >= 0;
    const t0 = now + 0.03;
    const R = total * 0.6;
    const D = fwd ? Math.min(0.42, total * 0.25) : 0;
    const S = 0.09 + 0.08 * (1 - s);
    const tA = t0 + R; // the top of the swell
    const A = tA + D + S; // arrival
    this.jumpUntil = A + 0.05;
    const c = CHAPTERS[to].prog[0];
    const lvl = dbg(-22) * (0.55 + 0.45 * s);

    // the swell: the new chord's top notes, sliding up into tune (or down, in reverse)
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 0.8;
    kr(f.frequency);
    const g = ac.createGain();
    f.connect(g).connect(this.dry);
    g.gain.setValueAtTime(0, t0);
    if (fwd) {
      g.gain.setTargetAtTime(lvl, t0, R / 2.2);
      f.frequency.setValueAtTime(500, t0);
      f.frequency.exponentialRampToValueAtTime(3600, tA);
    } else {
      g.gain.linearRampToValueAtTime(lvl, t0 + 0.1);
      g.gain.setTargetAtTime(0, t0 + 0.12, R / 2.5);
      f.frequency.setValueAtTime(3600, t0);
      f.frequency.exponentialRampToValueAtTime(500, tA);
    }
    g.gain.setTargetAtTime(0, tA + D * 0.6, 0.03);
    const end = A + 0.1;
    const oscs: OscillatorNode[] = [];
    for (const m of tonesIn(c, 62, 81).slice(-3)) {
      for (const cents of this.phone ? [0] : [-7, 7]) {
        const o = ac.createOscillator();
        kr(o.frequency);
        o.setPeriodicWave(this.st.wave("bowed"));
        o.detune.value = cents;
        o.frequency.setValueAtTime(mtof(fwd ? m - 7 : m + 7), t0);
        o.frequency.exponentialRampToValueAtTime(mtof(m), tA);
        const og = ac.createGain();
        og.gain.value = this.phone ? 0.5 : 0.28;
        o.connect(og).connect(f);
        o.start(t0);
        o.stop(end);
        oscs.push(o);
        o.onended = () => {
          o.disconnect();
          og.disconnect();
        };
      }
    }
    if (oscs.length) oscs[0].addEventListener("ended", () => { f.disconnect(); g.disconnect(); });

    const tg = this.tapeGain.gain, dt = this.tape.delayTime, lp = this.tapeLow.frequency;
    if (fwd) {
      // tape stop: the read head falls behind, so the pitch sinks to nothing
      for (let k = 0; k < 24; k++) this.stopCurve[k] = 0.5 * D * (k / 23) * (k / 23);
      dt.cancelScheduledValues(now);
      dt.setValueAtTime(0, tA - 0.002);
      dt.setValueCurveAtTime(this.stopCurve, tA, D);
      lp.setTargetAtTime(700, tA, D / 2);
      tg.setTargetAtTime(0.0003, tA + D - 0.07, 0.02);
      thud(this, this.direct, tA, 82, 30, 0.9, dbg(-15) * (0.5 + 0.5 * s));
      // back to normal while nothing is heard
      dt.setValueAtTime(0, tA + D + 0.05);
    } else {
      // rewinding: the room muffles, then a short silence and a rising sub
      lp.setTargetAtTime(700, t0, R / 2);
      tg.setTargetAtTime(0.0003, tA - 0.05, 0.02);
      thud(this, this.direct, A - 0.3, 34, 74, 0.3, dbg(-17) * (0.5 + 0.5 * s));
    }
    lp.setValueAtTime(18000, A - 0.015);
    tg.setTargetAtTime(1, A, 0.012);

    // arrival: the new world's chord, struck
    const hit = dbg(-15) * (0.55 + 0.45 * s) * (fwd ? 1 : 0.6);
    tonesIn(c, 67, 86).slice(0, 3).forEach((m, i) => this.star.play(m, A + i * 0.012, hit * (i ? 0.7 : 1), this.dry));
    if (fwd) this.frame.play(nm("D3"), A, hit, this.dry);
    thud(this, this.dry, A, 120, 55, 0.35, hit * 0.8);
    // a reversed bell sucks the ear into the hit
    const pull = tonesIn(c, 72, 86)[0];
    if (pull !== undefined) this.star.play(pull, A, dbg(-25) * (0.5 + 0.5 * s), this.direct, { rev: true });
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
    const p = this.wordPan;
    if (p.positionX) {
      p.positionX.cancelScheduledValues(now);
      p.positionX.setValueAtTime(-1.1, base - 0.01);
      p.positionX.linearRampToValueAtTime(1.1, Math.max(base + 0.05, end));
    }
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
