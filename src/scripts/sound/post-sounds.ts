// The sounds of a single post. Reading comes first, so all of this is small:
// a section passing is barely there, a hover is one soft note. The figures have
// more character, because the reader chose to touch them: coins stack, a band
// locks on a small chord, a permission gate knocks twice when it blocks, and the
// day sky pings as its services fire. Everything is tuned to whatever chord the
// page's movement is playing, so it belongs to the music underneath.
//
// Any movement can host this, since it only needs the movement's chord and room.
import type { Movement } from "./movement";
import { Sampler, Flutter, lead, thud, ringAt, rush } from "./instruments";
import { bell, modal, BELLS, MODES, dbg, hashStr, nm, type ModalSpec } from "./dsp";
import { tonesIn } from "./theory";

// a small coin on a stack: bright for a moment, then gone
const COIN: ModalSpec = { ratios: [1, 2.32, 3.7, 5.1], amps: [1, 0.5, 0.3, 0.12], decays: [0.16, 0.08, 0.05, 0.03], strike: 0.25, strikeCut: 3200 };

type Voice = "chime" | "tap" | "wood" | "coin";
const HOVERS: Record<string, { voice: Voice; lo: number; hi: number; level: number; dur: number }> = {
  star: { voice: "chime", lo: 76, hi: 91, level: -30, dur: 0.5 },
  link: { voice: "tap", lo: 67, hi: 84, level: -30, dur: 0.1 },
  code: { voice: "wood", lo: 55, hi: 72, level: -31, dur: 0.09 },
  coin: { voice: "coin", lo: 76, hi: 90, level: -29, dur: 0.2 },
  frame: { voice: "wood", lo: 62, hi: 79, level: -31, dur: 0.09 },
  band: { voice: "chime", lo: 72, hi: 88, level: -29, dur: 0.4 },
  run: { voice: "tap", lo: 60, hi: 79, level: -31, dur: 0.1 },
  service: { voice: "chime", lo: 79, hi: 93, level: -31, dur: 0.3 },
  document: { voice: "wood", lo: 60, hi: 76, level: -31, dur: 0.1 },
};

export class PostSounds {
  private out: GainNode;
  private chime: Sampler;
  private far: Sampler;
  private key: Sampler;
  private wood: Sampler;
  private coin: Sampler;
  private stone: Sampler;
  private hovers = new Flutter();
  private pings = new Flutter(0.09, 0.03, 0.6, 0.5);
  private sections = new Flutter(1.2, 0, 2, 0);

  constructor(private m: Movement) {
    const r = m.rng;
    this.out = m.bus(1, 0.4, undefined, true);
    this.chime = new Sampler(m, (sr, f) => bell(sr, f, 1.2, BELLS.glass, r), 16, 8);
    this.far = new Sampler(m, (sr, f) => bell(sr, f, 2.4, BELLS.star, r), 12, 6);
    this.key = new Sampler(m, (sr, f) => modal(sr, f, 0.22, MODES.key, r), 14, 6);
    this.wood = new Sampler(m, (sr, f) => modal(sr, f, 0.25, MODES.wood, r), 12, 6);
    this.coin = new Sampler(m, (sr, f) => modal(sr, f, 0.45, COIN, r), 12, 10);
    this.stone = new Sampler(m, (sr, f) => modal(sr, f, 0.3, MODES.stone, r), 4, 4);
  }

  private get now() {
    return this.m.ac.currentTime + 0.004;
  }
  private voice(v: Voice): Sampler {
    return v === "chime" ? this.chime : v === "tap" ? this.key : v === "wood" ? this.wood : this.coin;
  }
  /** A stable small number to a chord tone in a register. */
  private tone(n: number, lo: number, hi: number): number {
    const tones = tonesIn(this.m.chord, lo, hi);
    if (!tones.length) return lo;
    return tones[((Math.round(n) % tones.length) + tones.length) % tones.length];
  }

  on(name: string, d: Record<string, unknown>, x: number) {
    if (name === "post:section") this.section(Number(d.index) || 0);
    else if (name === "post:hover") this.hover(String(d.kind), Number(d.note) || 0, x);
    else if (name === "post:figure") this.figure(String(d.id), String(d.action));
    else if (name === "post:transition") this.transition(String(d.direction), String(d.slug ?? ""));
  }

  /** A new section is reached while reading: barely there. */
  private section(i: number) {
    const t = this.now;
    if (this.sections.next(t) <= 0) return;
    this.far.play(this.tone(i, 74, 88), t, dbg(-42), this.out, { dur: 1.2 });
  }

  private hover(kind: string, note: number, x: number) {
    const t = this.now;
    const v = this.hovers.next(t);
    if (v <= 0) return;
    const pan = (x - 0.5) * 1.5;
    if (kind === "sky") {
      // the sky at the end of a post plays like the writing sky: root, then climbing
      const tones = tonesIn(this.m.chord, nm("G4"), nm("G6"));
      if (!tones.length) return;
      const root = Math.max(0, tones.findIndex((m) => m % 12 === this.m.chord.root));
      const span = tones.length - 1 - root;
      const n = Math.max(0, Math.round(note));
      const k = span > 0 ? (n % (span * 2) <= span ? n % (span * 2) : span * 2 - n % (span * 2)) : 0;
      ringAt(this.m, this.chime, this.out, tones[root + k], t, dbg(-27) * v, pan, 0.8);
      return;
    }
    const h = HOVERS[kind];
    if (!h) return;
    ringAt(this.m, this.voice(h.voice), this.out, this.tone(note, h.lo, h.hi), t + this.m.rng() * 0.012, dbg(h.level) * v, pan, h.dur);
  }

  private figure(id: string, action: string) {
    const [verb, arg] = action.split(":");
    const t = this.now;
    if (id === "viewer") this.viewer(verb === "open", t);
    else if (id.startsWith("code-") && verb === "copy") this.copied(t);
    else if (id === "cost-stacks") this.cost(verb, arg ?? "", t);
    else if (id === "referee-line") this.referee(verb, Number(arg), t);
    else if (id === "minhash") this.minhash(verb, Number(arg), t);
    else if (id === "zero-params") this.zero(verb, Number(arg), t);
    else if (id === "day-sky") this.day(verb, arg ?? "", t);
    else if (id === "permission-gate") this.gate(verb, t);
  }

  private viewer(open: boolean, t: number) {
    rush(this.m, this.out, t, open ? 0.32 : 0.26, open, dbg(-24));
    this.chime.play(this.tone(open ? 3 : 0, open ? 76 : 69, open ? 91 : 84), t + (open ? 0.2 : 0.02), dbg(-33), this.out, { dur: 0.7 });
  }

  /** Copied: a quick pair of keys rising. */
  private copied(t: number) {
    this.key.play(this.tone(1, 72, 86), t, dbg(-29), this.out, { dur: 0.1 });
    this.key.play(this.tone(3, 72, 86), t + 0.08, dbg(-27), this.out, { dur: 0.14 });
  }

  /** Coins stacking: uneven clinks that climb, the last settling on the pile. */
  private stack(t: number, n: number, rising: boolean, level: number, start: number) {
    const tones = tonesIn(this.m.chord, 74, 91);
    if (!tones.length) return t;
    let at = t;
    for (let i = 0; i < n; i++) {
      const k = start + (rising ? i : n - 1 - i);
      const v = rising ? 0.72 + (i / n) * 0.28 : 1 - (i / n) * 0.45;
      ringAt(this.m, this.coin, this.out, tones[k % tones.length], at, dbg(level) * v, -0.25 + 0.5 * this.m.rng(), 0.3);
      at += 0.058 + this.m.rng() * 0.05 + (i === n - 2 ? 0.03 : 0);
    }
    return at;
  }
  private cost(verb: string, arg: string, t: number) {
    if (verb === "project") {
      // one coin dropped on the pile: it bounces once
      const k = hashStr(arg) % 8;
      this.stack(t, 2, true, -28, k);
      return;
    }
    if (arg === "never") {
      // the bill that never comes: a short stack comes down, and something hollow is left
      const end = this.stack(t, 3, false, -29, 2);
      thud(this.m, this.out, end, 140, 95, 0.09, dbg(-35));
    } else if (arg === "apps") {
      this.stack(t, 4, true, -29, 3);
    } else {
      const end = this.stack(t, 6, true, -29, 0);
      thud(this.m, this.out, end, 160, 105, 0.08, dbg(-33));
    }
  }

  /** A line moved across four verdicts: open, then tighter, then shut. */
  private referee(verb: string, n: number, t: number) {
    const root = this.tone(0, 60, 72);
    if (verb === "verdict") {
      if (n === 0) {
        // everyone passes: a clean third
        this.key.play(root + 12, t, dbg(-29), this.out, { dur: 0.3 });
        this.chime.play(this.tone(1, root + 13, root + 24), t, dbg(-32), this.out, { dur: 0.5 });
      } else if (n === 1) {
        // the wrong one passes: a suspended second, left hanging
        this.key.play(root + 12, t, dbg(-30), this.out, { dur: 0.25 });
        this.key.play(root + 14, t + 0.03, dbg(-31), this.out, { dur: 0.25 });
      } else if (n === 2) {
        // stopped, along with real ones: a soft rub
        this.wood.play(root, t, dbg(-29), this.out, { dur: 0.16 });
        this.key.play(root + 13, t + 0.02, dbg(-33), this.out, { dur: 0.2 });
      } else {
        // nobody passes: shut
        this.stone.play(nm("E3"), t, dbg(-29), this.out);
      }
    } else if (verb === "tried-all") {
      // no bar does both: three notes that stay unresolved
      [0, 5, 7].forEach((s, i) => this.far.play(root + 12 + s, t + i * 0.06, dbg(-37), this.out, { dur: 1.2 }));
    } else if (verb === "voice-clear") {
      this.chime.play(this.tone(2, 79, 91), t, dbg(-31), this.out, { dur: 0.6 });
    }
  }

  /** Bands agreeing: a small click, then one note of the chord per band locked. */
  private minhash(verb: string, n: number, t: number) {
    if (verb === "band") {
      const locked = Math.max(0, Math.min(6, Math.round(n) || 0));
      if (!locked) {
        // nothing locks: one open note
        this.key.play(this.tone(1, 67, 79), t, dbg(-33), this.out, { dur: 0.16 });
        return;
      }
      this.key.play(this.tone(0, 84, 96), t, dbg(-34), this.out, { dur: 0.05 });
      const tones = tonesIn(this.m.chord, 60, 84);
      for (let i = 0; i < locked && tones.length; i++) {
        this.chime.play(tones[Math.round((i * (tones.length - 1)) / Math.max(1, 5))], t + 0.025, dbg(-37) * (1 - i * 0.06), this.out, { dur: 0.7 });
      }
    } else if (verb === "new-users") {
      [0, 1, 2].forEach((i) => this.chime.play(this.tone(i * 2, 74, 88), t + i * 0.07, dbg(-37), this.out, { dur: 0.35 }));
    }
  }

  private zero(verb: string, n: number, t: number) {
    if (verb === "stop") {
      this.key.play(this.tone(0, 72, 84), t, dbg(-31), this.out, { dur: 0.08 });
      this.chime.play(this.tone((Math.round(n) || 0) * 2, 74, 91), t + 0.02, dbg(-30), this.out, { dur: 0.6 });
    } else if (verb === "load") {
      thud(this.m, this.out, t, 130, 80, 0.14, dbg(-30));
      [0, 1, 2].forEach((i) => this.key.play(this.tone(i, 67, 84), t + 0.06 + i * 0.09, dbg(-31), this.out, { dur: 0.1 }));
    }
  }

  /** The day sky: soft pings as services fire, and the 6 AM burst thins by itself. */
  private day(verb: string, arg: string, t: number) {
    if (verb === "fire") {
      const v = this.pings.next(t);
      if (v <= 0) return;
      const h = hashStr(arg);
      ringAt(this.m, this.chime, this.out, this.tone(h % 7, 79, 93), t + this.m.rng() * 0.02, dbg(-33) * v, ((h >>> 3) % 100) / 100 - 0.5, 0.25);
    } else if (verb === "play" || verb === "pause") {
      const up = verb === "play";
      this.key.play(this.tone(up ? 1 : 3, 67, 84), t, dbg(-31), this.out, { dur: 0.1 });
      this.key.play(this.tone(up ? 3 : 1, 67, 84), t + 0.08, dbg(-31), this.out, { dur: 0.14 });
    } else if (verb === "day") {
      // each kind of day has its own height
      const lo = arg === "monday" ? 79 : arg === "wednesday" ? 72 : 64;
      [0, 1, 2].forEach((i) => this.chime.play(this.tone(i, lo, lo + 14), t + i * 0.05, dbg(-38), this.out, { dur: 0.5 }));
    }
  }

  private gate(verb: string, t: number) {
    if (verb === "run") {
      this.key.play(this.tone(0, 67, 79), t, dbg(-30), this.out, { dur: 0.08 });
      lead(this.m, this.out, this.tone(1, 62, 74), t + 0.02, 0.5, dbg(-34), { wave: this.m.st.wave("air"), attack: 0.2, release: 0.4, cutoff: 2000 });
    } else if (verb === "blocked") {
      // a clear block: a door knocked twice, low and firm, in no chord at all
      this.stone.play(nm("E3"), t, dbg(-24), this.out);
      thud(this.m, this.out, t, 125, 58, 0.2, dbg(-26));
      this.stone.play(nm("E3"), t + 0.11, dbg(-27), this.out);
      thud(this.m, this.out, t + 0.11, 110, 52, 0.22, dbg(-29));
    } else if (verb === "answered") {
      // answered: falls home to the root
      const root = this.tone(0, 72, 84);
      this.chime.play(root + 7 > 91 ? root - 5 : root + 7, t, dbg(-34), this.out, { dur: 0.5 });
      this.chime.play(root, t + 0.14, dbg(-33), this.out, { dur: 0.8 });
    } else if (verb === "no-model") {
      // no model was called, so nothing answers: one hollow note, and air
      lead(this.m, this.out, this.tone(0, 55, 67), t, 0.4, dbg(-33), { wave: this.m.st.wave("air"), attack: 0.08, release: 0.5, cutoff: 900 });
    }
  }

  /** Between posts: the same family as the writing sky's dive. */
  private transition(direction: string, slug: string) {
    const t = this.now;
    if (direction === "out") {
      const D = 0.78;
      rush(this.m, this.out, t, D, true, dbg(-20));
      const m = this.tone(hashStr(slug) % 5, 74, 88);
      this.far.play(m, t + D, dbg(-31), this.out, { rev: true });
    } else {
      rush(this.m, this.out, t, 0.5, false, dbg(-20));
      const start = hashStr(slug) % 3;
      [0, 1, 2].forEach((i) => this.far.play(this.tone(start + i, 67, 86), t + 0.08 + i * 0.05, dbg(-35) * (i ? 0.8 : 1), this.out, { dur: 1.4 }));
    }
  }
}
