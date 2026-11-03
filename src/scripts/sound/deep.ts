// The deep layer: the floor of the score. It belongs to the studio, so it never
// stops when a movement ends. It slides to the next piece's root across a tab
// change and takes on that page's character (places.ts). The current chord's
// bass note is always its root.
//
//   sub (a sine, 30 to 58 Hz) + rumble (noise in a moving low pass) + growl (a
//   mid bass with harmonics) -> swell -> pump -> duck -> film duck -> out, mono
//   and centred
//
//   the same bed -> a saturator -> a band from 150 to 400 Hz -> out. Laptop and
//   phone speakers play next to nothing under about 180 Hz, so the bed's upper
//   harmonics carry the sense of the note where the note itself cannot be heard.
//
//   hits and drops -> the low frequency effects bus (a low pass at 120 Hz), kept
//   apart from the music's own bass, with its own harmonic path and a send to
//   the long hall.
//
// Scrolling leans on it, the pointer bends it, a press lands on it. A hit ducks
// the bed under itself, and a big arrival goes quiet first so it has room to land.
import { dbg, kr, mtof } from "./dsp";
import { bassOf, tonesIn, type Chord } from "./theory";
import { Flutter } from "./instruments";
import { PLACES, type Place } from "./places";
import type { Studio } from "./studio";

const saw = Array.from({ length: 24 }, (_, i) => 1 / (i + 1));
const square = Array.from({ length: 24 }, (_, i) => (i % 2 ? 0.02 : 1 / (i + 1)));

/** Additions to the current place, in dB: a scene or a page leaning on the floor. */
export interface Lean {
  sub?: number;
  rumble?: number;
  growl?: number;
  harm?: number;
  cut?: number; // a multiplier
  hall?: number;
}

export class Deep {
  /** The movement whose chords the floor follows. */
  owner: object | null = null;
  private s: Place = PLACES.home;
  private lean: Lean = {};
  private ac: BaseAudioContext;
  private phone: boolean;

  private subO: OscillatorNode;
  private subG: GainNode;
  private sub2O: OscillatorNode | null = null;
  private sub2G: GainNode | null = null;
  private rumbleG: GainNode;
  private rumbleF: BiquadFilterNode[] = [];
  private rumbleSweep: GainNode;
  private growlA: OscillatorNode;
  private growlB: OscillatorNode | null = null;
  private growlAG: GainNode;
  private growlBG: GainNode | null = null;
  private growlF: BiquadFilterNode;
  private growlG: GainNode;
  private lfo: OscillatorNode;
  private lfoR: OscillatorNode;
  private breath: GainNode;
  private breathDepth: GainNode;
  private cutDepth: GainNode;
  private panDepth: GainNode;
  private pump: GainNode;
  private duckG: GainNode;
  private filmBed: GainNode;
  private filmLfe: GainNode;
  private harmG: GainNode;
  private harmPan: StereoPannerNode;
  private lfeIn: GainNode;
  private live = 0;

  private root = 0;
  private glideNext = 0;
  private chordNow: Chord | null = null;

  // the visitor
  private heavy = 0;
  private pm = 0;
  private px = 0.5;
  private py = 0.5;
  private dir = 1;
  private travel = 0;
  private peak = 0;
  private lastApply = 0;
  private lastPress = -1;
  private lastKnock = -1;
  private lastSettle = -1;
  private lastRelease = -1;
  private lastBrush = -1;
  private sweep = new Flutter(0.07, 0.03, 0.5, 0.6, 5);
  private passLast = -1;

  constructor(private st: Studio, out: AudioNode) {
    const ac = (this.ac = st.ac);
    const phone = (this.phone = st.phone);
    const g = (v: number) => {
      const n = ac.createGain();
      n.gain.value = v;
      return n;
    };
    // on a low or high pass, Q is in dB: -3 is a flat Butterworth
    const f = (type: BiquadFilterType, hz: number, q = -3) => {
      const n = ac.createBiquadFilter();
      n.type = type;
      n.frequency.value = hz;
      n.Q.value = q;
      kr(n.frequency);
      return n;
    };

    // the output of the bed: swell, pump, duck, the film's duck
    const sum = g(1);
    this.breath = g(1);
    this.pump = g(1);
    this.duckG = g(1);
    this.filmBed = g(1);
    sum.connect(this.breath).connect(this.pump).connect(this.duckG).connect(this.filmBed).connect(out);

    // the sub
    this.subO = ac.createOscillator();
    this.subO.frequency.value = 36.7;
    kr(this.subO.frequency, this.subO.detune);
    this.subG = g(0);
    this.subO.connect(this.subG).connect(sum);
    this.subO.start();
    if (!phone) {
      this.sub2O = ac.createOscillator();
      this.sub2O.frequency.value = 73.4;
      kr(this.sub2O.frequency);
      this.sub2G = g(0);
      this.sub2O.connect(this.sub2G).connect(sum);
      this.sub2O.start();
    }

    // the rumble: the shared noise in a moving low pass, loud enough to feel
    const noise = ac.createBufferSource();
    noise.buffer = st.noise;
    noise.loop = true;
    this.rumbleG = g(0);
    const r1 = f("lowpass", 55, -1), r2 = f("lowpass", 55, -3);
    this.rumbleF = [r1, r2];
    noise.connect(r1).connect(r2).connect(this.rumbleG).connect(sum);
    noise.start(0, 1.7);
    this.lfoR = ac.createOscillator();
    this.lfoR.frequency.value = 0.05;
    kr(this.lfoR.frequency);
    this.rumbleSweep = g(10);
    this.lfoR.connect(this.rumbleSweep);
    this.rumbleSweep.connect(r1.frequency);
    this.rumbleSweep.connect(r2.frequency);
    this.lfoR.start();

    // the growl
    this.growlF = f("lowpass", 170, 2);
    kr(this.growlF.Q);
    this.growlG = g(0);
    this.growlF.connect(this.growlG).connect(sum);
    this.growlA = ac.createOscillator();
    this.growlA.setPeriodicWave(st.wave("deep-saw", saw));
    this.growlA.frequency.value = 73.4;
    kr(this.growlA.frequency, this.growlA.detune);
    this.growlAG = g(1);
    this.growlA.connect(this.growlAG).connect(this.growlF);
    this.growlA.start();
    if (!phone) {
      this.growlB = ac.createOscillator();
      this.growlB.setPeriodicWave(st.wave("deep-square", square));
      this.growlB.frequency.value = 73.4;
      kr(this.growlB.frequency, this.growlB.detune);
      this.growlBG = g(0);
      this.growlB.connect(this.growlBG).connect(this.growlF);
      this.growlB.start();
    }

    // slow motion: the swell of the bed, the growl's filter, the harmonics' travel
    this.lfo = ac.createOscillator();
    this.lfo.frequency.value = 0.05;
    kr(this.lfo.frequency);
    this.breathDepth = g(0);
    this.cutDepth = g(0);
    this.panDepth = g(0);
    this.lfo.connect(this.breathDepth).connect(this.breath.gain);
    this.lfo.connect(this.cutDepth).connect(this.growlF.frequency);
    this.lfo.start();

    // the harmonic path
    const drive = g(phone ? 34 : 30);
    const shaper = ac.createWaveShaper();
    shaper.curve = saturator(1.15, 0.32);
    const hp1 = f("highpass", 150), hp2 = f("highpass", 150), lp = f("lowpass", 400);
    this.harmG = g(0);
    this.harmPan = ac.createStereoPanner();
    kr(this.harmPan.pan);
    this.pump.connect(drive).connect(shaper).connect(hp1).connect(hp2).connect(lp).connect(this.harmG).connect(this.harmPan).connect(this.filmBed);
    this.lfo.connect(this.panDepth).connect(this.harmPan.pan);

    // the low frequency effects bus
    this.lfeIn = g(1);
    const l1 = f("lowpass", 120), l2 = f("lowpass", 120);
    this.filmLfe = g(1);
    this.lfeIn.connect(l1).connect(l2).connect(this.filmLfe).connect(out);
    const lfeDrive = g(phone ? 5 : 3.2);
    const lfeShape = ac.createWaveShaper();
    lfeShape.curve = saturator(1.5, 0.25);
    const lh = f("highpass", 130), ll = f("lowpass", 720);
    const lfeRead = g(dbg(phone ? -15 : -19));
    this.lfeIn.connect(lfeDrive).connect(lfeShape).connect(lh).connect(ll).connect(lfeRead).connect(this.filmLfe);
    // what a hit leaves in the room: its upper part only, so the tail stays clean
    const send = g(dbg(-14));
    lh.connect(send).connect(st.hallIn);
  }

  // ---- places ------------------------------------------------------------------
  /** A new movement takes over. The floor keeps going and slides to the new piece. */
  enter(owner: object, id: string, t: number, seconds: number, handover: boolean) {
    this.owner = owner;
    this.lean = {};
    this.heavy = 0;
    this.peak = 0;
    if (handover) this.glideNext = Math.max(seconds * 0.8, 1.6);
    this.place(PLACES[id] ?? PLACES.home, t, handover ? seconds : 0.4);
  }

  /** Move to a place, over some seconds. A world or a stop calls this too. */
  place(s: Place, t: number, seconds = 0.8) {
    this.s = s;
    const tau = Math.max(0.03, seconds / 3);
    this.lfo.frequency.setTargetAtTime(s.swellRate, t, tau);
    this.lfoR.frequency.setTargetAtTime(s.rumbleRate, t, tau);
    this.breathDepth.gain.setTargetAtTime(s.swell, t, tau);
    this.panDepth.gain.setTargetAtTime(this.phone ? s.orbit * 0.4 : s.orbit, t, tau);
    this.growlF.Q.setTargetAtTime(s.q * 3.5, t, tau);
    this.growlAG.gain.setTargetAtTime(this.growlBG ? 1 - s.odd : 1, t, tau);
    this.growlBG?.gain.setTargetAtTime(s.odd, t, tau);
    this.growlA.detune.setTargetAtTime(-s.det, t, tau);
    this.growlB?.detune.setTargetAtTime(s.det, t, tau);
    if (!s.pulse) this.pump.gain.setTargetAtTime(1, t, tau);
    this.apply(t, tau, true);
    if (this.root) this.tune(t, seconds * 0.8);
  }

  /** A scene or a page leaning on the floor. Stays until the next call. */
  leanOn(l: Lean, t: number, tau = 0.25) {
    this.lean = l;
    this.apply(t, tau, true);
  }

  /** Set everything that depends on the place and on what the visitor is doing. */
  private apply(t: number, tau: number, force = false) {
    if (!force && t - this.lastApply < 0.03) return;
    this.lastApply = t;
    const s = this.s, l = this.lean, m = this.heavy, pm = this.pm, w = s.weight;
    // a phone's speaker has no sub to give: less of it, more of the harmonics
    this.subG.gain.setTargetAtTime(dbg(s.sub + (l.sub ?? 0) + 1.2 * m * w - (this.phone ? 4 : 0)), t, tau);
    this.sub2G?.gain.setTargetAtTime(dbg(s.sub2 + (l.sub ?? 0)), t, tau);
    this.rumbleG.gain.setTargetAtTime(dbg(s.rumble + (l.rumble ?? 0) + 13 * m * w), t, tau);
    this.growlG.gain.setTargetAtTime(dbg(s.growl + 5 + (l.growl ?? 0) + (6 * m + 2.5 * pm) * w), t, tau);
    const cut = s.cut * (l.cut ?? 1) * (1 + 2.1 * m * w + 0.9 * pm) * (0.78 + 0.5 * (1 - this.py));
    this.growlF.frequency.setTargetAtTime(Math.min(1800, cut), t, tau * 0.6);
    this.cutDepth.gain.setTargetAtTime(s.cut * 0.3 * s.swell * 2, t, tau);
    this.harmG.gain.setTargetAtTime(dbg(s.harm + 11 + (l.harm ?? 0) + (3 * m + 1.5 * pm) * w + (this.phone ? 3 : 0)), t, tau);
    const mid = (s.rumbleLo + s.rumbleHi) / 2;
    for (const r of this.rumbleF) r.frequency.setTargetAtTime(mid * (1 + 1.6 * m), t, tau);
    this.rumbleSweep.gain.setTargetAtTime(((s.rumbleHi - s.rumbleLo) / 2) * (1 + m), t, tau);
    this.harmPan.pan.setTargetAtTime((this.px - 0.5) * 0.5, t, 0.2);
    this.st.hallTo(dbg(s.hall - 6 + (l.hall ?? 0)), t, Math.max(tau, 0.3));
  }

  // ---- harmony -----------------------------------------------------------------
  chord(c: Chord, t: number) {
    this.chordNow = c;
    const first = !this.root;
    const s = this.s;
    this.root = bassOf(c, this.root || Math.round((s.lo + s.hi) / 2), s.lo, s.hi);
    this.tune(t, first ? 0.01 : this.glideNext || s.glide);
    this.glideNext = 0;
  }

  private tune(t: number, seconds: number) {
    const hz = mtof(this.root);
    const tau = Math.max(0.004, seconds / 3);
    const { oct, ratio } = this.s;
    this.subO.frequency.setTargetAtTime(hz, t, tau);
    this.sub2O?.frequency.setTargetAtTime(hz * ratio, t, tau);
    const up = hz * Math.pow(2, oct);
    this.growlA.frequency.setTargetAtTime(up, t, tau);
    this.growlB?.frequency.setTargetAtTime(up, t, tau);
  }

  /** One step of the movement's grid: the bed pumps where this place says. */
  step(beat: number, t: number) {
    const s = this.s;
    if (!s.pulse) return;
    for (const b of s.pulse) if (Math.abs(b - beat) < 0.02) return this.pulseAt(t, 1);
  }

  /** One pump of the bed, on the grid or from a heartbeat. */
  pulseAt(t: number, amt = 1) {
    const s = this.s;
    const d = (s.pulse ? s.pulseDepth : 0.35) * amt;
    const g = this.pump.gain;
    g.setTargetAtTime(1, t, 0.01);
    g.setTargetAtTime(1 - d, t + 0.04, (s.pulse ? s.pulseDecay : 0.28) / 2.2);
  }

  // ---- hits --------------------------------------------------------------------
  /**
   * A low hit in the current key, on the low frequency effects bus. It starts
   * above the note and falls onto it. oct moves it up octaves from the sub.
   */
  hit(t: number, level: number, o: { from?: number; to?: number; sweep?: number; dur?: number; oct?: number; root?: number } = {}) {
    if (this.live >= (this.phone ? 3 : 6)) return;
    const ac = this.ac;
    const hz = mtof(o.root || this.root || 33) * Math.pow(2, o.oct ?? 0);
    const dur = o.dur ?? 0.4;
    const osc = ac.createOscillator();
    kr(osc.frequency);
    osc.frequency.setValueAtTime(hz * (o.from ?? 2.2), t);
    osc.frequency.exponentialRampToValueAtTime(hz * (o.to ?? 1), t + (o.sweep ?? 0.09));
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.012, dur / 3);
    osc.connect(g).connect(this.lfeIn);
    osc.start(t);
    osc.stop(t + dur * 2.6 + 0.05);
    this.live++;
    osc.onended = () => {
      this.live--;
      osc.disconnect();
      g.disconnect();
    };
  }

  /** The bed gets out of the way of a hit, and comes back. */
  private under(t: number, amount: number, back: number) {
    const g = this.duckG.gain;
    g.setTargetAtTime(1 - amount, t, 0.008);
    g.setTargetAtTime(1, t + 0.04, back / 3);
  }

  /**
   * A big arrival. If there is time the world goes quiet first, so the hit has
   * somewhere to land, then the floor drops out from the note above.
   */
  impact(at: number, size = 1, c?: Chord) {
    const now = this.ac.currentTime;
    const w = size * this.s.weight;
    const lead = at - now;
    const root = c ? this.rootOf(c) : this.root;
    if (lead > 0.22) {
      const from = at - Math.min(lead, 0.42);
      this.duckG.gain.setTargetAtTime(1 - 0.72 * Math.min(1, w), from, 0.07);
      this.st.dip(from, at, 0.45 * Math.min(1, w));
    }
    this.under(at, 0.55, 1.1);
    this.hit(at, dbg(-5.5) * w, { from: 3.2, sweep: 0.16, dur: 1.5 + 0.7 * w, root });
    this.hit(at, dbg(-15) * w, { oct: 1, from: 2.2, sweep: 0.05, dur: 0.34, root });
  }

  /** The note falling or climbing across a move between places. */
  swoop(t: number, D: number, up: boolean, size = 1) {
    if (this.live >= (this.phone ? 3 : 6)) return;
    const ac = this.ac;
    const w = size * this.s.weight;
    const hz = mtof(this.root || 33);
    const osc = ac.createOscillator();
    kr(osc.frequency);
    osc.frequency.setValueAtTime(hz * (up ? 1 : 3.4), t);
    osc.frequency.exponentialRampToValueAtTime(hz * (up ? 3.4 : 0.8), t + D);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dbg(-15) * w, t + D * 0.8);
    g.gain.linearRampToValueAtTime(0, t + D);
    osc.connect(g).connect(this.lfeIn);
    osc.start(t);
    osc.stop(t + D + 0.03);
    this.live++;
    osc.onended = () => {
      this.live--;
      osc.disconnect();
      g.disconnect();
    };
  }

  /** The chord tone a touch plays: position across the chord, low enough to have body. */
  private tone(x: number, lo = 48, hi = 64): number {
    const tones = this.chordNow ? tonesIn(this.chordNow, lo, hi) : [];
    if (!tones.length) return this.root ? this.root + 24 : 48;
    return tones[Math.min(tones.length - 1, Math.floor(Math.max(0, Math.min(0.999, x)) * tones.length))];
  }

  // ---- the visitor -------------------------------------------------------------
  /**
   * A hover: a short round note in the current chord, with body, panned where
   * the pointer is. Sweeping across many links thins into a flutter.
   */
  hover(x: number, _y: number, amt = 1, pick = x) {
    const now = this.ac.currentTime;
    const f = this.sweep.next(now);
    if (f <= 0) return;
    const ac = this.ac;
    const t = now + 0.004;
    const osc = ac.createOscillator();
    osc.setPeriodicWave(this.st.wave("warm"));
    osc.frequency.value = mtof(this.tone(pick));
    const lp = ac.createBiquadFilter();
    lp.frequency.value = 900;
    const g = ac.createGain();
    const lv = dbg(-26) * f * amt * (0.5 + 0.5 * this.s.weight);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lv, t + 0.008);
    g.gain.setTargetAtTime(0, t + 0.02, 0.075);
    const pan = ac.createStereoPanner();
    pan.pan.value = (x - 0.5) * 1.1;
    osc.connect(lp).connect(g).connect(pan).connect(this.st.bus);
    osc.start(t);
    osc.stop(t + 0.5);
    osc.onended = () => {
      osc.disconnect();
      lp.disconnect();
      g.disconnect();
      pan.disconnect();
    };
  }

  /** Something that is not a control under the pointer: very soft, and not often. */
  brush(x: number, y: number) {
    const now = this.ac.currentTime;
    if (now - this.lastBrush < 0.5 || this.heavy > 0.15) return;
    this.lastBrush = now;
    this.hover(x, y, 0.4);
  }

  /** A press: a low thump in the key, and the bed ducks under it. */
  press(strength: number, x: number, y: number) {
    const now = this.ac.currentTime;
    if (now - this.lastPress < 0.07) return;
    this.lastPress = now;
    const t = now + 0.004;
    const w = strength * this.s.weight;
    this.px = x;
    this.py = y;
    this.under(t, 0.4 * Math.min(1, w), 0.3);
    this.hit(t, dbg(-13) * w, { oct: 1, from: 2.4, sweep: 0.07, dur: 0.26 });
  }

  /** Letting go of something held: a small soft settle. */
  release(strength: number) {
    const now = this.ac.currentTime;
    if (now - this.lastRelease < 0.12) return;
    this.lastRelease = now;
    this.hit(now + 0.004, dbg(-24) * strength * this.s.weight, { oct: 1, from: 1.3, sweep: 0.05, dur: 0.16 });
  }

  /** Dragging something: the strain goes into the growl. */
  drag(strength: number, x: number, y: number) {
    this.pointer(strength, x, y);
  }

  /** Pointer speed and position bend the low filter. */
  pointer(m: number, x: number, y: number) {
    const rising = m > this.pm;
    this.pm = m;
    this.px = x;
    this.py = y;
    this.apply(this.ac.currentTime, rising ? 0.08 : 0.25);
  }

  /**
   * Scrolling. i is speed 0..1, dy is how far in screens, dt the frame. The
   * floor has inertia: it takes a moment to get going and longer to stop, and
   * coming to rest after a hard scroll lands with a soft weight.
   */
  motion(i: number, dir: number, dy: number, dt: number) {
    const now = this.ac.currentTime;
    const up = i > this.heavy;
    this.heavy += (i - this.heavy) * (1 - Math.exp(-dt / (up ? 0.16 : 0.42)));
    if (this.heavy < 0.002) this.heavy = 0;
    this.dir = dir;
    this.peak = Math.max(i, this.peak * Math.exp(-dt / 0.7));
    this.apply(now, up ? 0.07 : 0.28);
    const w = this.s.weight;
    // pitch leans with the direction, as if pushing something heavy
    const lean = this.dir * this.heavy * -22;
    this.growlA.detune.setTargetAtTime(-this.s.det + lean, now, 0.18);
    this.growlB?.detune.setTargetAtTime(this.s.det + lean, now, 0.18);
    // reading pace: a low knock every half screen, gear teeth going past
    this.travel += Math.abs(dy);
    if (this.travel > 0.5) {
      this.travel = 0;
      if (i > 0.03 && i < 0.7 && now - this.lastKnock > 0.2) {
        this.lastKnock = now;
        this.hit(now + 0.004, dbg(-23) * (0.5 + 0.5 * i) * w, { oct: 1, from: 1.5, sweep: 0.04, dur: 0.13 });
      }
    }
    // stopping: the weight settles
    if (i < 0.04 && this.peak > 0.28 && now - this.lastSettle > 0.9) {
      this.lastSettle = now;
      this.peak = 0;
      this.hit(now + 0.004, dbg(-17) * w, { from: 1.7, sweep: 0.1, dur: 0.5 });
    }
    // fast: something passes by now and then
    if (i > 0.55 && now - this.passLast > 1.5 && w > 0.55) {
      this.passLast = now;
      this.st.pass(dir >= 0 ? 1 : -1, 0.9, this.s.pass, this.root, 0.7 * i, Math.random() < 0.5 ? -1 : 1);
    }
  }

  /** A clip with its own sound: the floor steps well back, and comes back with the score. */
  film(a: number) {
    const t = this.ac.currentTime;
    const tau = a > 0 ? 0.15 : 0.35;
    this.filmBed.gain.setTargetAtTime(1 - 0.92 * a, t, tau);
    this.filmLfe.gain.setTargetAtTime(1 - 0.75 * a, t, tau);
  }

  /** The scroll has stopped: everything falls back. */
  rest() {
    const now = this.ac.currentTime;
    if (this.peak > 0.28 && now - this.lastSettle > 0.9) {
      this.lastSettle = now;
      this.hit(now + 0.004, dbg(-17) * this.s.weight, { from: 1.7, sweep: 0.1, dur: 0.5 });
    }
    this.peak = 0;
    this.heavy = 0;
    this.apply(now, 0.42, true);
    this.growlA.detune.setTargetAtTime(-this.s.det, now, 0.4);
    this.growlB?.detune.setTargetAtTime(this.s.det, now, 0.4);
  }

  get note(): number {
    return this.root;
  }
  get where(): Place {
    return this.s;
  }
  /** The root a chord will give, for a hit that lands as it arrives. */
  rootOf(c: Chord): number {
    return bassOf(c, this.root || Math.round((this.s.lo + this.s.hi) / 2), this.s.lo, this.s.hi);
  }

  /** For measuring the music alone. */
  mute() {
    const t = this.ac.currentTime;
    this.filmBed.gain.setValueAtTime(0, t);
    this.filmLfe.gain.setValueAtTime(0, t);
    this.film = () => {};
  }
}

/** A soft saturator, a little lopsided so it makes even harmonics too. */
function saturator(k: number, bias: number): Float32Array {
  const n = 2048;
  const c = new Float32Array(n);
  const off = Math.tanh(bias);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * 4 * k + bias) - off;
  }
  return c;
}
