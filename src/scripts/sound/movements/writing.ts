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
// backwards that arrives exactly when the new hero lands. Its size follows how
// long the change takes, its direction follows the scroll, and each hero
// arrives in the colour of its slab: warm slabs on low piano and strings,
// green on the felt piano, blue on glass, violet on far bells.
//
// The sky of posts answers too. Every star is a glass chime from the chord
// playing at that moment, so the melody always fits the bed: the brightest
// star is the root and the rest climb from it and turn back, so tracing a
// constellation plays a small melody, each note ringing where the pointer
// was. Each constellation has a chord of its own (Architecture opens in Lydian, MLOps
// on an open six nine, Research on a borrowed E flat...), heard as a faint
// shimmer when the pointer arrives. Opening one dives in: a rising rush of
// air, the whole bed moves to that constellation's chord as it blooms, and a
// sparkle follows each card out. Closing pulls back the same way, in reverse.
import { Movement, type Section } from "../movement";
import { chord, chords, deg, MODES as SCALE, snap, bassOf, tonesIn, type Chord } from "../theory";
import { Pad, Mono, Sampler, lead } from "../instruments";
import { piano, bell, BELLS, dbg, nm, kr, mulberry, hashStr, type Rng, type RoomSpec } from "../dsp";

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

// each constellation's own colour of the harmony
const TAG_CHORDS: Record<string, string> = {
  architecture: "Cmaj7#11",
  systems: "D9sus4",
  mlops: "D69",
  process: "Am9",
  aie: "Bm11",
  research: "Ebmaj9",
  personal: "Gadd9",
  essay: "Em9",
  backend: "Fmaj7#11",
};
const SPARE = chords("Cmaj9 Em9 Am9 D69 Gmaj9 Bm7");
// noise loses most of its level in a narrow band, so these sit far above the notes
const RUSH = dbg(-16);
const PAGE = dbg(-15);
/** Freeze a param where it is, so a new move starts from there with no jump. */
function holdAt(p: AudioParam, t: number) {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else p.cancelScheduledValues(t);
}
function tagChord(tag: string): Chord {
  const name = TAG_CHORDS[tag.trim().toLowerCase()];
  return name ? chord(name) : SPARE[hashStr(tag) % SPARE.length];
}

/** "rgb(52, 211, 153)" or "#34d399" to hue (degrees) and lightness (0..1). */
function hueOf(accent: string | undefined): { h: number; l: number } | null {
  if (!accent) return null;
  let r = 0, g = 0, b = 0;
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(accent);
  if (m) [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if (/^#[0-9a-f]{6}$/i.test(accent.trim())) {
    const n = parseInt(accent.trim().slice(1), 16);
    [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else return null;
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, l: (max + min) / 2 };
}

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
  // the sky
  private chime!: Sampler;
  private far!: Sampler;
  private skyBus!: GainNode;

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
    // the sky: glass for stars, far bells for shimmer, panned where the pointer is
    this.chime = new Sampler(this, (sr, f) => bell(sr, f, 1.5, BELLS.glass, r), 24, 10);
    this.far = new Sampler(this, (sr, f) => bell(sr, f, 2.4, BELLS.star, r), 16, 10);
    this.skyBus = this.bus(1, 0.45, undefined, true);
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
        this.keys.play(m, this.hum(t + late, 14), dbg(-19) * n.v, this.hand);
      }
      // in the rests, a second voice answers an octave up
      if (L.answer && this.bar - this.phraseStart === 2 && (pos === 4 || pos === 10)) {
        const tones = tonesIn(this.chord, nm("D5"), nm("D6"));
        if (tones.length) this.keys.play(this.pick(tones), this.hum(t, 14), dbg(-25), this.hand);
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
    // its name as a chord, in the colour of its slab: a soft roll on the current harmony
    const t = this.ac.currentTime + 0.05;
    const c = hueOf(d.accent);
    const hue = c ? c.h : 150;
    const warm = hue < 55 || hue >= 330, green = hue >= 55 && hue < 170, blue = hue >= 170 && hue < 250;
    const lo = warm ? nm("D3") : green ? nm("G3") : blue ? nm("D4") : nm("G4");
    const tones = tonesIn(this.chord, lo, lo + 19);
    const start = this.heroSeed % Math.max(1, tones.length - 2);
    const roll = tones.slice(start, start + 3);
    roll.forEach((m, i) => {
      const at = t + i * (warm ? 0.07 : 0.045);
      const v = dbg(-25) * (i ? 0.8 : 1);
      if (warm || green) this.keys.play(m, at, v, this.skyBus, { force: true });
      else if (blue) this.chime.play(m + 12, at, v * 0.9, this.skyBus);
      else this.far.play(m + 12, at, v, this.skyBus);
    });
    // warm slabs get a low bowed swell under the roll
    if (warm && roll.length) lead(this, this.skyBus, roll[0] - 12, t + 0.05, 2.4, dbg(-30), { wave: this.st.wave("bowed"), attack: 0.6, release: 1.6, cutoff: 900, detune: 8 });
    // and the room takes the slab's light: brighter slabs, a brighter bed
    if (c) {
      this.bright = 1600 + 1600 * c.l;
      this.brighten(t, 0.6);
    }
    this.arrivalBar = this.bar + 1;
    setTimeout(() => {
      // later sentences wander from the hero's voice
      if (this.voiceRng && !this.disposed) this.voiceRng = mulberry(this.heroSeed + 1 + Math.floor(Math.random() * 3));
    }, 9000);
  }

  heroTransition(d: { kind?: string; direction?: string; from?: number; to?: number; duration?: number }) {
    if (!this.out || this.disposed) return;
    const t = this.ac.currentTime + 0.02;
    const D = Math.max(0.25, Math.min(2.5, (Number(d.duration) || 900) / 1000));
    const up = d.direction ? d.direction !== "back" : (d.to ?? 1) >= (d.from ?? 0);
    // bigger for a slow, deliberate change; lighter for a quick one
    const size = Math.min(1, 0.45 + D / 2.5);
    // a page turning: paper air that sweeps across and settles as the new hero lands
    const f = this.sweep.frequency, g = this.sweepGain.gain;
    const quiet = g.value < 0.002;
    holdAt(f, t);
    holdAt(g, t);
    if (quiet) {
      f.setValueAtTime(up ? 600 : 2400, t);
      g.setValueAtTime(0, t);
    }
    f.exponentialRampToValueAtTime(up ? 2400 : 600, t + D * 0.6);
    f.exponentialRampToValueAtTime(900, t + D);
    g.linearRampToValueAtTime(PAGE * size, t + D * 0.55);
    g.setTargetAtTime(0, t + D * 0.6, D * 0.15);
    // a streak of light: a soft tone sliding across the field, up for next, down for back
    const top = tonesIn(this.chord, nm("G5"), nm("G6"));
    if (top.length && D > 0.5) {
      const to = up ? top[top.length - 1] : top[0];
      const pan = this.ac.createStereoPanner();
      kr(pan.pan);
      pan.pan.setValueAtTime(up ? -0.7 : 0.7, t);
      pan.pan.linearRampToValueAtTime(up ? 0.7 : -0.7, t + D);
      pan.connect(this.skyBus);
      lead(this, pan, to, t, D * 0.8, dbg(-33) * size, { wave: this.st.wave("air"), attack: D * 0.4, release: D * 0.4, cutoff: 3200, glideFrom: up ? to - 7 : to + 7, glideTime: D * 0.8 });
      setTimeout(() => pan.disconnect(), (D * 2.5 + 1) * 1000);
    }
    // a piano note played backwards, arriving with the new hero, then the hero's low note
    const tones = tonesIn(this.chord, nm("D5"), nm("D6"));
    if (tones.length) this.keys.play(tones[(d.to ?? 0) % tones.length] - (up ? 0 : 12), t + D, dbg(-25) * size, this.skyBus, { rev: true, force: true });
    this.keys.play(this.bassM + 12, t + D, dbg(-27) * size, this.skyBus, { force: true });
  }

  // ---- the sky ------------------------------------------------------------
  /** A glass note at its own place in the field; its tail stays where it rang. */
  private ring(m: number, t: number, level: number, x: number, dur?: number) {
    const sp = this.ac.createStereoPanner();
    sp.pan.value = Math.max(-0.85, Math.min(0.85, x));
    sp.connect(this.skyBus);
    const src = this.chime.play(m, t, level, sp, dur ? { dur } : undefined);
    if (src) src.addEventListener("ended", () => sp.disconnect());
    else sp.disconnect();
  }

  skyHover(d: { kind?: string; slug?: string; tag?: string; note?: number }, x: number) {
    if (!this.out || this.disposed) return;
    const t = this.ac.currentTime + 0.004;
    if (d.kind === "star") {
      // the brightest star is the chord's root; the others climb from it and turn back
      const tones = tonesIn(this.chord, nm("G4"), nm("G6"));
      if (!tones.length) return;
      const root = Math.max(0, tones.findIndex((m) => m % 12 === this.chord.root));
      const span = tones.length - 1 - root;
      const n = Math.max(0, Math.round(Number(d.note) || 0));
      const k = span > 0 ? (n % (span * 2) <= span ? n % (span * 2) : span * 2 - n % (span * 2)) : 0;
      this.ring(tones[root + k], t, dbg(-25) * (n === 0 ? 1 : 0.85), (x - 0.5) * 1.7, 0.9);
      return;
    }
    // a card: a muted tap, quieter than a star
    const tones = tonesIn(this.chord, nm("G4"), nm("G5"));
    if (tones.length) this.tap.play(tones[hashStr(d.slug || "") % tones.length], t, dbg(-27), this.fx, { dur: 0.12 });
  }

  constellation(d: { tag?: string; action?: string }) {
    if (!this.out || this.disposed) return;
    const tag = String(d.tag || "");
    const t = this.ac.currentTime + 0.02;
    const c = tagChord(tag);
    if (d.action === "hover") {
      // a faint shimmer swell in this constellation's colour
      const tones = tonesIn(c, nm("D5"), nm("D7"));
      tones.slice(0, 4).forEach((m, i) => this.far.play(m, t + 0.05 + i * 0.09, dbg(-31) * (0.7 + 0.1 * i), this.air));
      tones.slice(0, 3).forEach((m, i) => lead(this, this.air, m, t + i * 0.04, 0.6, dbg(-34), { wave: this.st.wave("air"), attack: 0.45, release: 1.2, cutoff: 3600, detune: 6 }));
      return;
    }
    if (d.action === "open") {
      // the bed moves to the constellation's chord as it blooms, and stays until it closes
      this.holdHarmony = true;
      this.harmony(c, t + 0.55);
      tonesIn(c, nm("G3"), nm("G5")).slice(0, 5).forEach((m, i) => this.keys.play(m, t + 0.6 + i * 0.035, dbg(-28) * (i ? 0.8 : 1), this.skyBus, { force: true }));
      tonesIn(c, nm("D5"), nm("A5")).slice(0, 3).forEach((m, i) =>
        lead(this, this.skyBus, m, t + 0.55, 2.2, dbg(-35), { wave: this.st.wave("air"), attack: 0.3 + i * 0.1, release: 2.0, cutoff: 3000, detune: 7 }),
      );
      // a sparkle for each card as it flies out of its star
      const sparks = tonesIn(c, nm("A5"), nm("E7"));
      for (let i = 0; i < 6 && sparks.length; i++) this.ring(sparks[i % sparks.length], t + 0.3 + i * 0.075, dbg(-33) * (1 - i * 0.07), (i / 5) * 1.2 - 0.3, 0.6);
      return;
    }
    if (d.action === "close") {
      // the reverse: the sparkles fall, the bloom swells in backwards, the bed returns
      const sparks = tonesIn(c, nm("A5"), nm("E7")).reverse();
      for (let i = 0; i < 4 && sparks.length; i++) this.ring(sparks[i % sparks.length], t + i * 0.07, dbg(-35), 0.6 - i * 0.3, 0.45);
      tonesIn(c, nm("G3"), nm("G5")).slice(0, 3).forEach((m, i) => this.keys.play(m, t + 0.6 + i * 0.03, dbg(-30), this.skyBus, { rev: true, force: true }));
      this.holdHarmony = false;
      const S = this.S;
      this.harmony(S.prog[Math.floor(Math.max(0, this.secBar) / (S.per ?? 1)) % S.prog.length], t + 0.65);
    }
  }

  /** Leaving for another writing page with a panel open: the form takes the chord back. */
  swapped() {
    this.holdHarmony = false;
  }

  /** The camera dives into a constellation (a rising rush of air) or pulls back (falling). */
  dive(direction: string, _tag: string) {
    if (!this.out || this.disposed) return;
    const ac = this.ac;
    const t = ac.currentTime + 0.01;
    const inward = direction !== "out";
    const D = 0.7;
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    kr(bp.frequency);
    bp.frequency.setValueAtTime(inward ? 420 : 2600, t);
    bp.frequency.exponentialRampToValueAtTime(inward ? 2600 : 420, t + D);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(RUSH, t + D * (inward ? 0.75 : 0.25));
    g.gain.setTargetAtTime(0, t + D * (inward ? 0.8 : 0.35), inward ? 0.06 : 0.18);
    src.connect(bp).connect(g).connect(this.skyBus);
    src.start(t, this.rng() * 4);
    src.stop(t + D + 1);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
  }

  protected onScroll(i: number, _dir: number, _dt: number, t: number) {
    // scrolling lifts the paper air a little
    this.paper.gain.setTargetAtTime(dbg(-50) * (1 + 3 * i), t, 0.2);
  }
}
