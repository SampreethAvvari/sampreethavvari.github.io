// The studio: the part of the sound that lives as long as the page does.
// Movements come and go (one per tab, crossfading on navigation); they all
// play into this one bus. The deep layer, the long hall and whatever passes by
// live here too, so none of them stop when a tab changes.
//
//   movements -> bus -> dip (a breath before a big arrival) -> film duck (gain
//             and low pass) -> high pass 48 Hz -> high shelf -> low pass
//             -> lows to mono -> glue -> sum
//   movements' chosen sends -> long hall -> sum
//   deep bed, low frequency effects bus -> sum
//   sum -> DC block -> master fader -> limiter -> trim -> ceiling -> out
//
// The music keeps its old level. It has only lost what sat under the deep layer.
// The bed runs quiet so hits have headroom, and the limiter stage only touches
// the biggest hits: a compressor as a fast look ahead limiter, then a hard soft
// clip that can never pass the ceiling. The glue only sees the music, so a sub
// hit cannot pump it.
import { WAVES, makeWave, cosWave, pink, mulberry, dbg, kr, room, mtof } from "./dsp";
import { Deep } from "./deep";

const CEILING = dbg(-1.6);

export class Studio {
  readonly ac: BaseAudioContext;
  readonly phone: boolean;
  readonly bus: GainNode;
  readonly master: GainNode;
  readonly limiter: DynamicsCompressorNode;
  readonly glue: DynamicsCompressorNode | null = null;
  readonly deep: Deep;
  /** The long dark hall: selected sends only. */
  readonly hallIn: GainNode;
  /** Sample rate for rendered notes. Nothing we render lives above 9 kHz. */
  readonly bufRate: number;
  private waves = new Map<string, PeriodicWave>();
  private _noise: AudioBuffer | null = null;
  private _cos: PeriodicWave | null = null;
  private yawNow = 0;
  private dipG: GainNode;
  private duckGain: GainNode;
  private duckLow: BiquadFilterNode;
  private ducked = 0;
  private duckTop: number;
  private hallOut: GainNode;
  private passes = 0;
  private lastPass = -1;

  constructor(ac: BaseAudioContext, phone: boolean, dest: AudioNode = ac.destination) {
    this.ac = ac;
    this.phone = phone;
    this.bufRate = Math.min(ac.sampleRate, phone ? 24000 : 32000);
    // the context may run below the device rate, so stay under its Nyquist
    const nyq = ac.sampleRate * 0.49;
    this.duckTop = Math.min(16000, nyq);
    this.bus = ac.createGain();
    this.dipG = ac.createGain();
    this.duckGain = ac.createGain();
    this.duckLow = ac.createBiquadFilter();
    this.duckLow.type = "lowpass";
    this.duckLow.frequency.value = this.duckTop;
    this.duckLow.Q.value = 0.5;
    kr(this.duckLow.frequency);
    // below this the deep layer owns the room
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 48;
    hp.Q.value = -3;
    const shelf = ac.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 7000;
    shelf.gain.value = -3;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(15000, nyq);
    lp.Q.value = 0.5;
    // always two channels from here, whatever is playing at the moment
    lp.channelCount = 2;
    lp.channelCountMode = "explicit";
    lp.channelInterpretation = "speakers";
    const sum = ac.createGain();
    this.bus.connect(this.dipG).connect(this.duckGain).connect(this.duckLow).connect(hp).connect(shelf).connect(lp);

    if (phone) {
      // a phone's pads are already mono in the low notes, and its speaker is small
      lp.connect(sum);
    } else {
      // the pads' two detuned sides would smear the low notes between the ears: below 130 Hz the side signal goes
      const out = lowsToMono(ac, lp);
      // glue: slow enough that every attack gets through, and it only ever takes a little
      const glue = ac.createDynamicsCompressor();
      glue.threshold.value = -24;
      glue.knee.value = 14;
      glue.ratio.value = 1.5;
      glue.attack.value = 0.035;
      glue.release.value = 0.32;
      this.glue = glue;
      // the compressor adds its own make up, so bring the music back to its level
      const glueTrim = ac.createGain();
      glueTrim.gain.value = dbg(-3.2);
      out.connect(glue).connect(glueTrim).connect(sum);
    }

    // the long hall: late, dark, a lot of size in the early reflections
    this.hallIn = ac.createGain();
    this.hallOut = ac.createGain();
    this.hallOut.gain.value = dbg(-8);
    const spec = phone
      ? { rt60: 3.4, length: 3.2, predelay: 0.05, early: 6, earlyLevel: 0.5, hi: 1600, lo: 300, damp: 0.9, lowCut: 140, bloom: 0.05, width: 1 }
      : { rt60: 6, length: 5.6, predelay: 0.06, early: 16, earlyLevel: 0.75, hi: 2100, lo: 340, damp: 1.3, lowCut: 140, bloom: 0.09, width: 1 };
    const [L, R] = room(ac.sampleRate, spec, mulberry(29));
    const ir = ac.createBuffer(phone ? 1 : 2, L.length, ac.sampleRate);
    ir.getChannelData(0).set(L);
    if (!phone) ir.getChannelData(1).set(R);
    const hall = ac.createConvolver();
    hall.normalize = false;
    hall.buffer = ir;
    this.hallIn.connect(hall).connect(this.hallOut).connect(sum);

    this.deep = new Deep(this, sum);

    // DC goes, and anything below hearing, and nothing else
    const dc = ac.createBiquadFilter();
    dc.type = "highpass";
    dc.frequency.value = 18;
    dc.Q.value = -3;
    this.master = ac.createGain();
    this.master.gain.value = 0;
    // The limiter stage. The compressor brings the biggest hits under the
    // ceiling with a few milliseconds of look ahead and a release too slow to
    // ripple on a 40 Hz wave. It adds a make up gain of its own, so the trim
    // takes that back.
    this.limiter = ac.createDynamicsCompressor();
    this.limiter.threshold.value = -5;
    this.limiter.knee.value = 3;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.2;
    const trim = ac.createGain();
    trim.gain.value = dbg(-1.8);
    const ceiling = ac.createWaveShaper();
    ceiling.curve = softCeiling(CEILING);
    sum.connect(dc).connect(this.master).connect(this.limiter).connect(trim).connect(ceiling).connect(dest);

    const LS = ac.listener;
    if (LS.forwardX) {
      LS.positionX.value = 0;
      LS.positionY.value = 0;
      LS.positionZ.value = 0;
      LS.forwardX.value = 0;
      LS.forwardY.value = 0;
      LS.forwardZ.value = -1;
      LS.upX.value = 0;
      LS.upY.value = 1;
      LS.upZ.value = 0;
      kr(LS.forwardX, LS.forwardZ);
    } else {
      LS.setPosition(0, 0, 0);
      LS.setOrientation(0, 0, -1, 0, 1, 0);
    }
  }

  wave(name: keyof typeof WAVES | string, amps?: number[]): PeriodicWave {
    let w = this.waves.get(name);
    if (!w) {
      w = makeWave(this.ac, amps ?? WAVES[name]);
      this.waves.set(name, w);
    }
    return w;
  }
  get cos(): PeriodicWave {
    return (this._cos ??= cosWave(this.ac));
  }
  /** Six seconds of pink noise, made once, looped by breath and air. */
  get noise(): AudioBuffer {
    if (!this._noise) {
      const d = pink(this.bufRate, 6, mulberry(7));
      this._noise = this.ac.createBuffer(1, d.length, this.bufRate);
      this._noise.getChannelData(0).set(d);
    }
    return this._noise;
  }

  /** Fade the whole score to a level over some seconds. */
  fade(to: number, seconds: number) {
    const g = this.master.gain;
    const t = this.ac.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + Math.max(0.02, seconds));
  }

  /**
   * Step back while something else on the page speaks (a film clip): down
   * in level and softer on top, by amount 0..1. Comes back over a second.
   */
  duck(amount: number) {
    const a = Math.max(0, Math.min(1, amount || 0));
    const t = this.ac.currentTime;
    const tau = a > this.ducked ? 0.15 : 0.3;
    this.ducked = a;
    this.duckGain.gain.setTargetAtTime(1 - 0.85 * a, t, tau);
    this.duckLow.frequency.setTargetAtTime(this.duckTop * Math.pow(1100 / this.duckTop, a), t, tau);
    this.deep.film(a);
  }

  /** The music draws back just before a big arrival, and is there again when it lands. */
  dip(from: number, at: number, amount: number) {
    const g = this.dipG.gain;
    g.setTargetAtTime(1 - amount, from, 0.06);
    g.setTargetAtTime(1, at, 0.02);
  }

  hallTo(level: number, t: number, tau: number) {
    this.hallOut.gain.setTargetAtTime(level, t, tau);
  }

  /**
   * Something passes the listener. It travels on a straight line from far off
   * to far off, side from the middle by a little, so it swings across the head:
   * its level follows its distance, the air takes its top when it is far, and
   * its pitch falls as it goes by. HRTF on a desktop, two at once at most; a
   * phone uses an equal power pan.
   */
  pass(dir: number, D: number, kind: [string, number, number], root: number, amt = 1, side = 1) {
    const ac = this.ac;
    const now = ac.currentTime;
    if (now - this.lastPass < 0.3 || this.passes >= 3) return;
    this.lastPass = now;
    this.passes++;
    const t = now + 0.01;
    const [wave, band, db] = kind;
    const panner = ac.createPanner();
    const hrtf = !this.phone && this.passes <= 2;
    panner.panningModel = hrtf ? "HRTF" : "equalpower";
    panner.distanceModel = "inverse";
    panner.refDistance = 1.6;
    panner.rolloffFactor = 1.1;
    panner.maxDistance = 60;
    // ahead to behind going forward, behind to ahead going back
    const reach = 15;
    const z0 = dir >= 0 ? -reach : reach, z1 = -z0;
    const x0 = side * 1.1, x1 = side * 2.4, y0 = 0.9, y1 = -0.2;
    kr(panner.positionX, panner.positionY, panner.positionZ);
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x0, t);
      panner.positionX.linearRampToValueAtTime(x1, t + D);
      panner.positionY.setValueAtTime(y0, t);
      panner.positionY.linearRampToValueAtTime(y1, t + D);
      panner.positionZ.setValueAtTime(z0, t);
      panner.positionZ.linearRampToValueAtTime(z1, t + D);
    } else panner.setPosition(x1, y0, 0);

    // along the line: distance, so the pitch and the air can follow it
    const N = 32;
    const dist = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      dist[i] = Math.hypot(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z0 + (z1 - z0) * u);
    }
    const SOUND = 95; // slower than real air, so the fall in pitch can be heard
    const cents = new Float32Array(N);
    const air = new Float32Array(N);
    const nyq = ac.sampleRate * 0.45;
    for (let i = 0; i < N; i++) {
      const v = ((dist[i + 1] - dist[i]) * N) / D; // metres a second, positive going away
      cents[i] = 1200 * Math.log2(SOUND / (SOUND + v));
      air[i] = Math.min(nyq, 300 + 9000 / (1 + dist[i] * 0.55));
    }
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.5;
    kr(lp.frequency);
    lp.frequency.setValueCurveAtTime(air, t, D);
    const g = ac.createGain();
    const level = dbg(db) * amt;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + D * 0.2);
    g.gain.setValueAtTime(level, t + D * 0.8);
    g.gain.linearRampToValueAtTime(0, t + D + 0.02);
    lp.connect(g).connect(panner);
    panner.connect(this.bus);
    const send = ac.createGain();
    send.gain.value = 0.5;
    panner.connect(send).connect(this.hallIn);
    // the body: two notes of the chord's root, pitched by its travel
    const midi = root ? root + 24 : 57;
    const oscs: OscillatorNode[] = [];
    for (const [m, lv] of (this.phone ? [[midi, 0.6]] : [[midi, 0.5], [midi + 7, 0.28]]) as [number, number][]) {
      const o = ac.createOscillator();
      kr(o.frequency, o.detune);
      o.setPeriodicWave(this.wave(wave));
      o.frequency.value = mtof(m);
      o.detune.setValueCurveAtTime(cents, t, D);
      const og = ac.createGain();
      og.gain.value = lv;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + D + 0.05);
      oscs.push(o);
      o.addEventListener("ended", () => { o.disconnect(); og.disconnect(); });
    }
    // and the air it pushes
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = band;
    bp.Q.value = 0.8;
    const ng = ac.createGain();
    ng.gain.value = 0.9;
    src.connect(bp).connect(ng).connect(lp);
    src.start(t, Math.random() * 4);
    src.stop(t + D + 0.05);
    src.onended = () => {
      this.passes--;
      src.disconnect();
      bp.disconnect();
      ng.disconnect();
      lp.disconnect();
      g.disconnect();
      panner.disconnect();
      send.disconnect();
    };
  }

  /** Turn the listener's head: radians, positive looks right. */
  yaw(rad: number) {
    if (Math.abs(rad - this.yawNow) < 0.002) return;
    this.yawNow = rad;
    const L = this.ac.listener;
    const x = Math.sin(rad), z = -Math.cos(rad);
    if (L.forwardX) {
      const t = this.ac.currentTime;
      L.forwardX.setTargetAtTime(x, t, 0.08);
      L.forwardZ.setTargetAtTime(z, t, 0.08);
    } else L.setOrientation(x, 0, z, 0, 1, 0);
  }

  /** For measuring the deep layer alone. */
  muteMusic() {
    this.bus.gain.value = 0;
    this.hallOut.gain.value = 0;
    this.hallTo = () => {};
  }
}

/** Stereo in, stereo out: the side signal under about 130 Hz is taken out. */
function lowsToMono(ac: BaseAudioContext, from: AudioNode): AudioNode {
  const split = ac.createChannelSplitter(2);
  const merge = ac.createChannelMerger(2);
  from.connect(split);
  const side = ac.createGain();
  side.channelCount = 1;
  side.channelCountMode = "explicit";
  const lg = ac.createGain();
  lg.gain.value = 0.5;
  const rg = ac.createGain();
  rg.gain.value = -0.5;
  split.connect(lg, 0);
  split.connect(rg, 1);
  lg.connect(side);
  rg.connect(side);
  const lp1 = ac.createBiquadFilter();
  lp1.frequency.value = 130;
  lp1.Q.value = -3;
  const lp2 = ac.createBiquadFilter();
  lp2.frequency.value = 130;
  lp2.Q.value = -3;
  side.connect(lp1).connect(lp2);
  // L - side, R + side
  const l = ac.createGain(), r = ac.createGain();
  l.channelCount = r.channelCount = 1;
  l.channelCountMode = r.channelCountMode = "explicit";
  split.connect(l, 0);
  split.connect(r, 1);
  const neg = ac.createGain();
  neg.gain.value = -1;
  lp2.connect(neg).connect(l);
  lp2.connect(r);
  l.connect(merge, 0, 0);
  r.connect(merge, 0, 1);
  return merge;
}

/** Straight up to about -4 dBFS, then bends into a ceiling it can never pass. */
function softCeiling(c: number): Float32Array {
  const n = 4097;
  const curve = new Float32Array(n);
  const a = 0.62;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const m = Math.abs(x);
    const y = m <= a ? m : a + (c - a) * Math.tanh((m - a) / (c - a));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}
