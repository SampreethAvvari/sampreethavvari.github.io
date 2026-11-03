// Interlude. Paper and Metal. Resume: one document, coming apart in zero gravity.
//
// A resume is the plainest thing anyone writes, so this is the plainest music
// on the site. It stays on the white keys of the piano, C major and its
// neighbours, so the monochrome of the page is literal. Struck silver bars
// (the free bar's own ratios, 1, 2.76, 5.4, 8.93) and paper: soft air in a
// moving band that flutters and turns. Over them a thin, cold chord slides
// slowly from stop to stop, one chord per stop, with very little beneath it.
//
// A sheet drifts when the pointer finds it, snaps when picked, turns over with
// a rustle when flipped. Flying between stops the page comes apart: a flutter
// of paper crosses the room in the direction of travel, a cold tone slides
// toward the next chord, and a bar struck backwards lands exactly on arrival.
// Sweeping through the skills reads as a flutter of loose slips.
import { Movement } from "../movement";
import { chords, deg, MODES as SCALE, bassOf, tonesIn, type Chord } from "../theory";
import { Pad, Mono, Sampler, Flutter, lead, thud, ringAt } from "../instruments";
import { bell, modal, dbg, nm, kr, type RoomSpec, type BellSpec, type ModalSpec } from "../dsp";

// One chord per stop, all on the white keys.
const STOPS = chords("Cadd9 Am9 Fmaj7#11 Dm9 Em7 G6 Fmaj9 Cmaj9");

const SILVER: BellSpec = { ratios: [1, 2.76, 5.4, 8.93], amps: [1, 0.32, 0.12, 0.04], decays: [2.2, 0.8, 0.3, 0.12], beat: 0.5, attack: 0.0015, strike: 0.04 };
// a slip of paper against metal: dry, tuned, gone at once
const SLIP: ModalSpec = { ratios: [1, 2.76], amps: [1, 0.2], decays: [0.14, 0.05], strike: 0.22, strikeCut: 2400 };

// How each kind of hover speaks: where its scale starts, how far note reaches, how loud.
const HOVERS: Record<string, { from: number; wrap: number; step: number; level: number; dur: number; slip: boolean }> = {
  section: { from: 5, wrap: 3, step: 2, level: -27, dur: 0.8, slip: false },
  key: { from: 5, wrap: 10, step: 1, level: -28, dur: 0.14, slip: true },
  group: { from: 3, wrap: 11, step: 1, level: -28, dur: 0.6, slip: false },
  skill: { from: 6, wrap: 10, step: 1, level: -29, dur: 0.1, slip: true },
  mark: { from: 4, wrap: 6, step: 1, level: -29, dur: 0.5, slip: false },
  line: { from: 2, wrap: 12, step: 1, level: -30, dur: 0.12, slip: true },
};
const SHEETS = ["aie", "fde", "mle", "sde"];

export class Resume extends Movement {
  readonly id = "resume";
  bpm = 56;
  div = 4;
  beats = 4;
  protected bright = 3000;
  protected wet = 1.05;
  protected bedSend = 0.6;
  protected tapLo = 72;
  protected tapHi = 88;
  protected grainLo = 79;
  protected grainHi = 93;

  private plate!: Sampler;
  private slip!: Sampler;
  private drone!: Mono;
  private bassM = nm("C2");
  private touch!: GainNode;
  private leftBar!: GainNode;
  private rightBar!: GainNode;
  private sweep = new Flutter();
  private stopI = 0;

  protected room(): RoomSpec {
    // a large white room with nothing in it
    return { rt60: 2.6, length: 2.6, predelay: 0.03, early: 4, earlyLevel: 0.2, hi: 6500, lo: 2000, damp: 0.9, lowCut: 140, bloom: 0.05, width: 1 };
  }

  private section(i: number) {
    return { bars: 4, prog: [STOPS[i]], per: 4, layers: { pad: 1, drone: 1 } };
  }

  protected setup() {
    const r = this.rng;
    this.sections = [this.section(0)];
    this.loopFrom = 0;
    this.pads.push(new Pad(this, this.layer("pad", 0, this.bed), {
      wave: this.st.wave("glass"), voices: this.phone ? 3 : 4, lo: 60, hi: 84, detune: 7, cutoff: 3000, level: 0.06, mode: "glide", glide: 5, lfo: 0.04,
    }));
    this.drone = new Mono(this, this.layer("drone", 0.3), { wave: this.st.wave("air"), cutoff: 500, level: 0.045, sub: 0.2, lo: 36, hi: 48 });
    this.touch = this.bus(1, 0.42, undefined, true);
    this.leftBar = this.point(-1.0, 0.3, -1.4, 0.6);
    this.rightBar = this.point(1.0, 0.1, -1.4, 0.6);
    this.plate = new Sampler(this, (sr, f) => bell(sr, f, 2.2, SILVER, r), 18, 10, "plate");
    this.slip = new Sampler(this, (sr, f) => modal(sr, f, 0.3, SLIP, r), 16, 8);
    this.tap = this.slip;
    this.grains = this.plate;
    this.plate.warm([nm("C5"), nm("E5"), nm("G5"), nm("D5")]);
  }

  protected onChord(c: Chord, t: number) {
    this.bassM = bassOf(c, this.bassM, 36, 48);
    this.drone.swell(this.bassM, t, 0.8, 3);
  }

  protected step(pos: number, t: number) {
    // the silver figure: four bars struck over two bars, then rests
    if (this.bar % 2 !== 0) return;
    const k = [0, 6, 8, 12].indexOf(pos);
    if (k < 0) return;
    const tones = tonesIn(this.chord, nm("G4"), nm("G6"));
    if (!tones.length) return;
    this.plate.play(tones[[0, 2, 1, 3][k] % tones.length], this.hum(t, 8), dbg(-8) * (k ? 0.8 : 1), k % 2 ? this.rightBar : this.leftBar);
  }

  // ---- paper ---------------------------------------------------------------
  /** Paper in the air: a band of soft noise that moves, optionally in flutters. */
  private paper(t: number, dur: number, level: number, f0: number, f1: number, x: number, x1 = x, flutters = 0) {
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this.st.noise;
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    kr(bp.frequency);
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    if (flutters > 1) {
      for (let i = 0; i < flutters; i++) {
        const a = t + (i * dur) / flutters, w = dur / flutters;
        const p = level * (0.55 + 0.45 * this.rng());
        g.gain.linearRampToValueAtTime(p, a + w * 0.4);
        g.gain.linearRampToValueAtTime(p * 0.35, a + w);
      }
    } else g.gain.linearRampToValueAtTime(level, t + dur * 0.3);
    g.gain.setTargetAtTime(0, t + dur, Math.max(0.02, dur * 0.18));
    const pan = ac.createStereoPanner();
    kr(pan.pan);
    pan.pan.setValueAtTime(x, t);
    if (x1 !== x) pan.pan.linearRampToValueAtTime(x1, t + dur);
    src.connect(bp).connect(g).connect(pan).connect(this.touch);
    src.start(t, this.rng() * 4);
    src.stop(t + dur + Math.max(0.2, dur));
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
      pan.disconnect();
    };
  }

  // ---- the page ------------------------------------------------------------
  pageEvent(name: string, d: Record<string, unknown>, x: number) {
    if (!this.out || this.disposed) return;
    if (name === "resume:stop") this.stop(Number(d.index) || 0, !!d.quiet);
    else if (name === "resume:transition") this.flight(Number(d.direction) || 1, Number(d.to), Number(d.duration));
    else if (name === "resume:sheet") this.sheet(String(d.id), String(d.action));
    else if (name === "resume:hover") this.slipOver(String(d.kind), Number(d.note) || 0, x);
  }

  /** Arrival at a stop: the bed slides to its chord, and a chord of bars is struck. */
  private stop(i: number, quiet: boolean) {
    const k = Math.max(0, Math.min(STOPS.length - 1, Math.round(i)));
    const t = this.ac.currentTime + 0.02;
    if (k !== this.stopI || quiet) {
      this.stopI = k;
      this.sections = [this.section(k)];
      this.sec = 0;
      this.secBar = -1;
      this.alignBar();
      this.arrivalBar = this.bar + 1;
    }
    if (quiet) return;
    const tones = tonesIn(STOPS[k], nm("C4"), nm("C6"));
    tones.slice(0, 3).forEach((m, n) => ringAt(this, this.plate, this.touch, m, t + n * 0.03, dbg(-29) * (n ? 0.75 : 1), -0.3 + n * 0.3, 1.8));
    // the page settling back together
    this.paper(t, 0.5, dbg(-23), 1900, 700, 0);
    thud(this, this.touch, t, 90, 58, 0.22, dbg(-31));
  }

  /** The flight between stops, exactly as long as the camera takes. */
  private flight(direction: number, to: number, seconds: number) {
    const t = this.ac.currentTime + 0.02;
    const D = Math.max(0.25, Math.min(4, seconds || 1));
    const dir = direction < 0 ? -1 : 1;
    const size = Math.min(1, 0.5 + D / 3);
    const next = STOPS[Math.max(0, Math.min(STOPS.length - 1, Number.isFinite(to) ? Math.round(to) : this.stopI))];
    // the page comes apart: a flutter of paper crosses the room the way the camera goes
    this.paper(t, D, dbg(-18) * size, dir > 0 ? 800 : 2600, dir > 0 ? 2600 : 800, -0.7 * dir, 0.7 * dir, Math.max(3, Math.round(D * 5)));
    // a cold tone slides toward the next chord
    const top = tonesIn(next, nm("G5"), nm("G6"));
    if (top.length && D > 0.4) {
      const m = dir > 0 ? top[top.length - 1] : top[0];
      lead(this, this.touch, m, t, D * 0.8, dbg(-33) * size, { wave: this.st.wave("glass"), attack: D * 0.5, release: D * 0.3, cutoff: 3400, glideFrom: dir > 0 ? m - 5 : m + 5, glideTime: D * 0.8 });
    }
    // a bar struck backwards lands on arrival
    const land = tonesIn(next, nm("C5"), nm("C6"))[0];
    if (land !== undefined) this.plate.play(land, t + D, dbg(-30) * size, this.touch, { rev: true, force: true });
  }

  /** The four sheets, side by side across the room. */
  private sheet(id: string, action: string) {
    const t = this.ac.currentTime + 0.004;
    const i = Math.max(0, SHEETS.indexOf(id));
    const x = -0.55 + (i / 3) * 1.1;
    const tones = tonesIn(this.chord, nm("C5"), nm("C6"));
    const m = tones.length ? tones[i % tones.length] : nm("C5");
    if (action === "hover") {
      // it drifts
      this.paper(t, 0.75, dbg(-21), 800, 1500, x, x + 0.1);
      ringAt(this, this.plate, this.touch, m, t + 0.06, dbg(-32), x, 1.2);
    } else if (action === "pick") {
      // a crisp snap, and the bar rings
      this.paper(t, 0.07, dbg(-17), 2000, 2800, x);
      thud(this, this.touch, t, 150, 90, 0.07, dbg(-30));
      ringAt(this, this.plate, this.touch, m, t + 0.01, dbg(-28), x, 1.6);
      ringAt(this, this.plate, this.touch, m + 12, t + 0.05, dbg(-35), x, 1);
    } else if (action === "flip") {
      // it turns over in the air, with a rustle up and back down
      this.paper(t, 0.24, dbg(-18), 900, 3000, x, x + 0.2);
      this.paper(t + 0.2, 0.3, dbg(-20), 3000, 1100, x + 0.2, x - 0.1);
      ringAt(this, this.plate, this.touch, m, t + 0.2, dbg(-33), x, 1);
    }
  }

  /** One note per hover, pitched by note. A sweep thins into a flutter. */
  private slipOver(kind: string, note: number, x: number) {
    const h = HOVERS[kind];
    if (!h) return;
    const now = this.ac.currentTime;
    const v = this.sweep.next(now);
    if (v <= 0) return;
    const n = ((Math.round(note) % h.wrap) + h.wrap) % h.wrap;
    const m = deg(nm("C4"), SCALE.pentatonic, h.from + n * h.step);
    // a little looseness, so a sweep never ticks like a clock
    const t = now + 0.004 + this.rng() * 0.018;
    ringAt(this, h.slip ? this.slip : this.plate, this.touch, m, t, dbg(h.level) * v, (x - 0.5) * 1.5, h.dur);
  }
}
