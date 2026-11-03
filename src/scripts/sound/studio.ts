// The studio: the part of the sound that lives as long as the page does.
// Movements come and go (one per tab, crossfading on navigation); they all
// play into this one bus, which ends in a gentle tone shaping stage, the
// on/off fader and a safety limiter.
//
//   movements -> bus -> duck (gain and low pass, for film clips with their
//             own sound) -> high pass 40 Hz -> high shelf -3 dB at 7 kHz
//             -> low pass 15 kHz -> master fader -> limiter -> trim -> out
import { WAVES, makeWave, cosWave, pink, mulberry, dbg, kr } from "./dsp";

export class Studio {
  readonly ac: BaseAudioContext;
  readonly phone: boolean;
  readonly bus: GainNode;
  readonly master: GainNode;
  readonly limiter: DynamicsCompressorNode;
  /** Sample rate for rendered notes. Nothing we render lives above 9 kHz. */
  readonly bufRate: number;
  private waves = new Map<string, PeriodicWave>();
  private _noise: AudioBuffer | null = null;
  private _cos: PeriodicWave | null = null;
  private yawNow = 0;
  private duckGain: GainNode;
  private duckLow: BiquadFilterNode;
  private ducked = 0;

  constructor(ac: BaseAudioContext, phone: boolean, dest: AudioNode = ac.destination) {
    this.ac = ac;
    this.phone = phone;
    this.bufRate = Math.min(ac.sampleRate, phone ? 24000 : 32000);
    this.bus = ac.createGain();
    this.duckGain = ac.createGain();
    this.duckLow = ac.createBiquadFilter();
    this.duckLow.type = "lowpass";
    this.duckLow.frequency.value = 16000;
    this.duckLow.Q.value = 0.5;
    kr(this.duckLow.frequency);
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 40;
    hp.Q.value = 0.7;
    const shelf = ac.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 7000;
    shelf.gain.value = -3;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 15000;
    lp.Q.value = 0.5;
    this.master = ac.createGain();
    this.master.gain.value = 0;
    // A safety limiter, not a sound: the score is mixed to peak well below
    // it. The compressor adds a little make up gain of its own, so the trim
    // after it brings the ceiling back under -1 dBFS.
    this.limiter = ac.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 2;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.22;
    const trim = ac.createGain();
    trim.gain.value = dbg(-2.5);
    this.bus.connect(this.duckGain).connect(this.duckLow).connect(hp).connect(shelf).connect(lp).connect(this.master).connect(this.limiter).connect(trim).connect(dest);
    const L = ac.listener;
    if (L.forwardX) {
      L.positionX.value = 0;
      L.positionY.value = 0;
      L.positionZ.value = 0;
      L.forwardX.value = 0;
      L.forwardY.value = 0;
      L.forwardZ.value = -1;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
      kr(L.forwardX, L.forwardZ);
    } else {
      L.setPosition(0, 0, 0);
      L.setOrientation(0, 0, -1, 0, 1, 0);
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
    this.duckLow.frequency.setTargetAtTime(16000 * Math.pow(1100 / 16000, a), t, tau);
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
}
