// II. The Machine, Drawn First. Architecture: drawings of how each system is
// built.
//
// Chords stacked in fourths, an even geometry with no sweetness added, that
// slide from shape to shape like lines being redrawn. A glass arpeggio traces
// the chord in seven beats (2, 2, 3). At each group the pen jumps to a
// different fixed point around the listener, like boxes on a diagram, and a
// ping pong echo carries it across the room the way a request travels between
// services. A held high line enters later, drawn with a ruler.
//
// The page can answer back. When a system is brought into focus it gets its
// own signature: a short motif, a timbre and a place in the room, all derived
// from its name so the same system always sounds the same. As its replayed
// traffic rises, soft packets of glass fill the gaps between the beats and
// the room brightens; when traffic falls, they thin out again.
import { Movement } from "../movement";
import { chords, tonesIn, bassOf, type Chord } from "../theory";
import { Pad, Mono, Sampler, lead, glint } from "../instruments";
import { bell, BELLS, modal, MODES, fm, pluck, mulberry, dbg, nm, type RoomSpec } from "../dsp";

/** A stable number from a name (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const A = chords("Bq/E F#q/C# C#q/A G#q/B");
const B = chords("A#q/E D#q/G# C#q/A G#q/B");

export class Architecture extends Movement {
  readonly id = "architecture";
  bpm = 104;
  div = 2;
  beats = 3.5; // seven eighths a bar
  protected bright = 3000;
  protected wet = 0.75;
  protected trim = 1.25;
  protected tapLo = 76;
  protected tapHi = 91;

  private pen!: Sampler;
  private bass!: Mono;
  private bassM = nm("E2");
  private nodes: GainNode[] = [];
  private node = 0;
  private walk = 0;
  private echoIn!: GainNode;
  private beam!: GainNode;
  private sigPan!: PannerNode;
  private sigBus!: GainNode;
  private sigVoices: Sampler[] = [];
  private sig: { motif: number[]; rhythm: number[]; voice: Sampler; lift: number; since: number } | null = null;
  private flowI = 0;

  protected room(): RoomSpec {
    return { rt60: 2.0, length: 2.6, predelay: 0.018, early: 12, earlyLevel: 0.6, hi: 7500, lo: 2000, damp: 0.6, lowCut: 120, bloom: 0, width: 1 };
  }

  protected setup() {
    const r = this.rng;
    this.sections = [
      { bars: 4, prog: A, per: 2, layers: { grid: 0.8, bass: 0.6 } },
      { bars: 8, prog: A, per: 2, layers: { grid: 1, bass: 1, pen: 0.75, echo: 0.6 } },
      { bars: 8, prog: B, per: 2, layers: { grid: 1, bass: 1, pen: 1, all: 1, echo: 1 } },
      { bars: 8, prog: A, per: 2, layers: { grid: 1, bass: 1, pen: 1, all: 1, echo: 0.8, beam: 1, ruler: 1 } },
      { bars: 4, prog: B, per: 2, layers: { grid: 0.8, beam: 1, echo: 0.5 } },
    ];

    this.pads.push(new Pad(this, this.layer("grid", 0, this.bed), {
      wave: this.st.wave("glass"), voices: 4, lo: 52, hi: 77, detune: 5, cutoff: 2600, level: 0.2, mode: "glide", glide: 1.4, lfo: 0.05,
    }));
    this.bass = new Mono(this, this.layer("bass", 0.1), { wave: this.st.wave("air"), cutoff: 800, level: 0.24, sub: 0.3, lo: 36, hi: 52 });

    // the ping pong echo: a dotted eighth each way, darkening as it repeats
    const ac = this.ac;
    const d = (60 / this.bpm) * 0.75;
    this.echoIn = this.gain(0);
    this.layers.echo = this.echoIn;
    const dl = this.own(ac.createDelay(1)), dr = this.own(ac.createDelay(1));
    dl.delayTime.value = d;
    dr.delayTime.value = d;
    const lp = this.own(ac.createBiquadFilter());
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    const merge = this.own(ac.createChannelMerger(2));
    this.echoIn.connect(dl);
    dl.connect(merge, 0, 0);
    dl.connect(dr);
    dr.connect(merge, 0, 1);
    dr.connect(this.gain(0.42)).connect(lp).connect(dl);
    const ret = this.gain(0.5, this.dry);
    merge.connect(ret);
    ret.connect(this.gain(0.3, this.verbIn));

    // fixed points, like boxes on a diagram; each note goes to one of them
    const spots: [number, number, number][] = this.phone
      ? [[-1.2, 0.2, -1], [1.2, 0.2, -1]]
      : [[-1.3, 0.3, -1.1], [1.3, 0.1, -0.9], [1.0, 0.6, 1.2], [-1.1, -0.1, 1.0]];
    for (const [x, y, z] of spots) {
      const g = this.gain(1, this.point(x, y, z, 0.3));
      g.connect(this.echoIn);
      this.nodes.push(g);
    }
    this.beam = this.layer("beam", 0.6, this.point(0, 1.6, -1.4, 0.6));
    this.layers.ruler = this.gain(0, this.dry);

    this.pen = new Sampler(this, (sr, f) => bell(sr, f, 1.3, BELLS.glass, r), 24, 14);
    this.tap = new Sampler(this, (sr, f) => modal(sr, f, 0.2, MODES.key, r), 12, 5);
    this.grains = this.pen;
    this.pen.warm([64, 69, 71, 74, 76, 78, 81, 83]);
    this.fx.connect(this.gain(0.35, this.echoIn));

    // a focused system's signature voice, placed where its name puts it
    this.sigPan = this.panner();
    this.sigBus = this.gain(1, this.sigPan);
    this.sigPan.connect(this.dry);
    this.sigPan.connect(this.gain(0.4, this.verbIn));
    this.sigPan.connect(this.gain(0.25, this.echoIn));
    this.setPos(this.sigPan, 0, 0.3, -1.4);
    this.sigVoices = [
      this.pen,
      new Sampler(this, (sr, f) => bell(sr, f, 1.4, BELLS.tine, r), 12, 6),
      new Sampler(this, (sr, f) => fm(sr, f, 1.4, { ratio: 2.0, index: 1.2, indexDecay: 0.25, decay: 0.6 }), 12, 6),
      new Sampler(this, (sr, f) => pluck(sr, f, 1.4, { bright: 0.4, t60: 1.1, pick: 0.2 }, r), 12, 6),
    ];
  }

  focus(d: { slug: string; title?: string; discipline?: string } | null) {
    if (!this.out || this.disposed) return;
    if (!d || !d.slug) {
      this.sig = null;
      return;
    }
    const h = hash(d.slug);
    const rr = mulberry(h);
    const len = 4 + (h % 3);
    const motif = Array.from({ length: len }, () => Math.floor(rr() * 7));
    const slots = [0, 1, 2, 3, 4, 5, 6].filter((p) => p === 0 || rr() < 0.55).slice(0, len);
    for (let p = 1; slots.length < len && p < 7; p++) if (!slots.includes(p)) slots.push(p);
    slots.sort((a, b) => a - b);
    const az = (((h >>> 8) % 300) / 300) * 2.4 - 1.2, el = (((h >>> 16) % 100) / 100) * 0.6 - 0.1;
    this.setPos(this.sigPan, 1.6 * Math.sin(az) * Math.cos(el), 1.6 * Math.sin(el), -1.6 * Math.cos(az) * Math.cos(el), this.ac.currentTime);
    this.sig = { motif, rhythm: slots, voice: this.sigVoices[h % this.sigVoices.length], lift: (h >>> 4) % 2 ? 12 : 0, since: this.bar };
    // say it once now, so the focus is heard the moment it happens
    const t = this.ac.currentTime + 0.05;
    slots.forEach((p, k) => this.sigNote(k, t + (p * 60) / this.bpm / this.div, 1));
  }

  flow(i: number) {
    if (!this.out || this.disposed) return;
    this.flowI = Math.max(0, Math.min(1, i || 0));
    this.bright = 3000 * (0.85 + 0.55 * this.flowI);
    this.brighten(this.ac.currentTime, 0.4);
  }

  private sigNote(k: number, t: number, v: number) {
    const s = this.sig;
    if (!s) return;
    const stack = this.voicing.concat(this.voicing.map((m) => m + 12));
    let m = stack[s.motif[k] % stack.length] + s.lift;
    while (m > nm("E6")) m -= 12;
    while (m < nm("E4")) m += 12;
    s.voice.play(m, t, dbg(-17) * v, this.sigBus);
  }

  protected onChord(c: Chord, t: number) {
    this.bassM = bassOf(c, this.bassM, 36, 52);
    if (this.lv("beam")) {
      const top = tonesIn(c, 79, 91);
      if (top.length) lead(this, this.beam, top[top.length - 1], t, (60 / this.bpm) * 3.5 * 2 - 0.4, dbg(-30), { wave: this.st.wave("air"), attack: 1.8, release: 1.6, cutoff: 3000, vib: 3, vibRate: 0.7 });
    }
  }

  protected step(pos: number, t: number) {
    const L = this.S.layers;
    const groupStart = pos === 0 || pos === 2 || pos === 4;
    // the pulse of the plan: bass on the group starts
    if (L.bass && groupStart) this.bass.hit(pos === 4 ? this.bassM + 7 : this.bassM, t, pos === 0 ? 0.5 : 0.3, 0.5, 0.18);
    if (L.pen && (groupStart || L.all)) {
      // each group jumps to the next point on the drawing
      if (groupStart) this.node = (this.node + 1 + (this.rng() < 0.25 ? 1 : 0)) % this.nodes.length;
      // the line climbs two groups, then turns back down for three
      const stack = this.voicing.concat(this.voicing.map((m) => m + 12));
      this.walk += pos < 4 ? 1 : -1;
      if (this.walk < 0) this.walk = 2;
      if (this.walk >= stack.length) this.walk = stack.length - 3;
      const m = stack[this.walk];
      const v = groupStart ? 1 : 0.6;
      this.pen.play(m + (m < 64 ? 12 : 0), this.hum(t, 3), dbg(-17) * v * L.pen * (0.9 + 0.1 * this.rng()), this.nodes[this.node]);
    }
    // the focused system's signature, every other bar
    const s = this.sig;
    if (s && (this.bar - s.since) % 2 === 1) {
      const k = s.rhythm.indexOf(pos);
      if (k >= 0) this.sigNote(k, this.hum(t, 4), 0.85);
    }
    // traffic: soft packets between the beats, more as the flow rises
    const f = this.flowI;
    if (f > 0.04 && this.rng() < f * 0.8) {
      const tones = tonesIn(this.chord, 76, 91);
      if (tones.length) {
        const at = this.rng() < 0.5 ? t : t + this.stepDur / 2;
        this.pen.play(this.pick(tones), this.hum(at, 3), dbg(-27) * (0.4 + 0.6 * f), this.nodes[Math.floor(this.rng() * this.nodes.length)], { dur: 0.14 });
      }
    }
    if (L.ruler) glint(this, this.layers.ruler, nm("E6") + (pos % 2 ? 0 : -5), t, dbg(groupStart ? -40 : -46), 0.03);
  }
}
