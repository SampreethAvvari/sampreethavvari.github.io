// Streams the matted character plates: short frame sequences of the astronaut
// and the hand, played on cards inside the live world. Frames stay compressed
// until the playhead comes near; only a small window is ever decoded. Plates
// are fetched per chapter, so nothing loads until the story gets close.

import { LinearFilter, SRGBColorSpace, Texture } from "three";

export interface PlateMeta {
  id: string;
  frames: number;
  fps: number;
  loop: boolean;
  /** Source frame size, in pixels. */
  src: [number, number];
  /** The crop of the source frame these frames hold: x0, y0, x1, y1. */
  box: [number, number, number, number];
  /** Lowest point of the figure per frame in source pixels: x, y (feet, or the fingertip). */
  foot: [number, number][];
  /** Per frame: the scale that holds him to one size, and the source pixel that stays on his ground point. */
  stab?: [number, number, number][];
  /** Plays forward and back, for a stretch of a clip that does not loop by itself. */
  pingpong?: boolean;
  /** Where a lamp on the figure is per frame, in source pixels, when the plate has one. */
  lamp?: [number, number][];
  /** Height of the figure per frame in source pixels, steadied. */
  height?: number[];
  dir: { d: string; p: string };
}

interface Stream {
  meta: PlateMeta;
  blobs: (Blob | null)[];
  /** 0 none, 1 loading, 2 ready, 3 failed */
  state: Uint8Array;
  queue: number[];
  tex: Texture | null;
  shown: number;
}

/** Coarse to fine, so a plate that is only partly in still plays, in steps. */
function order(n: number): number[] {
  const out: number[] = [];
  const seen = new Uint8Array(n);
  for (const step of [12, 6, 3, 1]) {
    for (let i = 0; i < n; i += step) {
      if (!seen[i]) {
        seen[i] = 1;
        out.push(i);
      }
    }
  }
  return out;
}

export class PlateBank {
  private readonly base: URL;
  private readonly set: "d" | "p";
  private readonly streams = new Map<string, Stream>();
  private readonly decoded = new Map<string, ImageBitmap>();
  private readonly decoding = new Set<string>();
  private priority: string[] = [];
  private inflight = 0;
  private readonly conc: number;
  private readonly maxDecoded: number;
  private readonly aborter = new AbortController();
  private dead = false;
  private asked = false;
  private ready_ = false;

  constructor(url: string, phone: boolean) {
    this.base = new URL(url, location.href);
    this.set = phone ? "p" : "d";
    this.conc = phone ? 4 : 8;
    this.maxDecoded = phone ? 12 : 20;
  }

  get ready() {
    return this.ready_;
  }

  /** Ask for the manifest. Safe to call every frame. */
  begin() {
    if (this.asked) return;
    this.asked = true;
    fetch(this.base.href, { signal: this.aborter.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((m: { plates?: PlateMeta[] }) => {
        if (this.dead) return;
        for (const meta of m.plates || []) {
          this.streams.set(meta.id, { meta, blobs: new Array(meta.frames).fill(null), state: new Uint8Array(meta.frames), queue: order(meta.frames), tex: null, shown: -1 });
        }
        this.ready_ = this.streams.size > 0;
        this.pump();
      })
      .catch(() => {
        /* no plates: the world still lives without him */
      });
  }

  meta(id: string) {
    return this.streams.get(id)?.meta ?? null;
  }

  /** Which plates to fetch, most wanted first. */
  prefer(ids: string[]) {
    if (ids.length === this.priority.length && ids.every((v, i) => v === this.priority[i])) return;
    this.priority = ids;
    this.pump();
  }

  /** Next frame to fetch: the chapter's own two plates side by side, coarse frames first, then the rest. */
  private next(): [Stream, number] | null {
    const pass = (i: number) => (i % 12 === 0 ? 0 : i % 6 === 0 ? 1 : i % 3 === 0 ? 2 : 3);
    const near = this.priority.slice(0, 2);
    for (let want = 0; want < 4; want++) {
      for (const id of near) {
        const s = this.streams.get(id);
        if (!s) continue;
        while (s.queue.length && s.state[s.queue[0]]) s.queue.shift();
        if (s.queue.length && pass(s.queue[0]) <= want) return [s, s.queue.shift()!];
      }
    }
    for (const id of this.priority) {
      const s = this.streams.get(id);
      if (!s) continue;
      while (s.queue.length) {
        const i = s.queue.shift()!;
        if (!s.state[i]) return [s, i];
      }
    }
    return null;
  }

  private pump() {
    if (this.dead || !this.ready_) return;
    while (this.inflight < this.conc) {
      const job = this.next();
      if (!job) break;
      this.load(job[0], job[1]);
    }
  }

  private load(s: Stream, i: number) {
    s.state[i] = 1;
    this.inflight++;
    const url = new URL(`${s.meta.dir[this.set]}/${String(i).padStart(3, "0")}.webp`, this.base).href;
    fetch(url, { signal: this.aborter.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        s.blobs[i] = b;
        s.state[i] = 2;
      })
      .catch(() => {
        s.state[i] = 3;
      })
      .finally(() => {
        this.inflight--;
        this.pump();
      });
  }

  private decode(s: Stream, i: number) {
    const key = `${s.meta.id}:${i}`;
    if (i < 0 || i >= s.meta.frames || s.state[i] !== 2 || this.decoded.has(key) || this.decoding.has(key)) return;
    const b = s.blobs[i];
    if (!b) return;
    this.decoding.add(key);
    createImageBitmap(b, { premultiplyAlpha: "none", colorSpaceConversion: "none" }).then(
      (bmp) => {
        this.decoding.delete(key);
        if (this.dead) {
          bmp.close();
          return;
        }
        this.decoded.set(key, bmp);
        this.evict(s.meta.id, i);
      },
      () => {
        this.decoding.delete(key);
        s.state[i] = 3;
        s.blobs[i] = null;
      },
    );
  }

  private evict(id: string, near: number) {
    if (this.decoded.size <= this.maxDecoded) return;
    const cost = (k: string) => {
      const [sid, f] = k.split(":");
      return sid === id ? Math.abs(Number(f) - near) : 1e6;
    };
    const keys = Array.from(this.decoded.keys()).sort((a, b) => cost(b) - cost(a));
    for (const k of keys) {
      if (this.decoded.size <= this.maxDecoded) break;
      this.decoded.get(k)?.close();
      this.decoded.delete(k);
    }
  }

  /**
   * Put frame f of a plate on its texture and return the texture, or null if
   * nothing of the plate has arrived yet. If that frame is not decoded the
   * closest earlier one stands in, and the frames ahead are readied.
   */
  texture(id: string, f: number): Texture | null {
    const s = this.streams.get(id);
    if (!s) return null;
    const n = s.meta.frames;
    const at = ((f % n) + n) % n;
    for (let k = 0; k <= 6; k++) this.decode(s, s.meta.loop ? (at + k) % n : Math.min(n - 1, at + k));
    // Not arrived yet: bring it forward.
    if (!s.state[at]) {
      s.queue = [at, ...s.queue.filter((q) => q !== at)];
      if (!this.priority.includes(id)) this.priority = [id, ...this.priority];
      this.pump();
    }
    let use = -1;
    for (let k = 0; k < n; k++) {
      const i = at - k;
      if (i < 0) break;
      if (this.decoded.has(`${id}:${i}`)) {
        use = i;
        break;
      }
    }
    // The nearest frame that has arrived behind the playhead, decoded ready for next time.
    for (let i = at; i >= 0 && i > use; i--) {
      if (s.state[i] === 2) {
        this.decode(s, i);
        break;
      }
    }
    if (use < 0 && s.shown < 0) {
      // Nothing behind the playhead yet: anything decoded, or a loaded frame to decode.
      for (let i = at; i < n; i++) {
        if (this.decoded.has(`${id}:${i}`)) {
          use = i;
          break;
        }
        if (s.state[i] === 2) {
          this.decode(s, i);
          break;
        }
      }
    }
    if (use >= 0 && use !== s.shown) {
      const bmp = this.decoded.get(`${id}:${use}`)!;
      if (!s.tex) {
        const t = new Texture(bmp);
        t.flipY = false;
        t.premultiplyAlpha = false;
        t.generateMipmaps = false;
        t.minFilter = LinearFilter;
        t.magFilter = LinearFilter;
        t.colorSpace = SRGBColorSpace;
        s.tex = t;
      } else {
        s.tex.image = bmp;
      }
      s.tex.needsUpdate = true;
      s.shown = use;
    }
    return s.tex;
  }

  /** Which frame of this plate the texture holds right now. */
  shown(id: string) {
    const s = this.streams.get(id);
    return s ? s.shown : -1;
  }

  /** Does this plate have its first frame ready to show? */
  has(id: string) {
    const s = this.streams.get(id);
    return !!(s && s.tex);
  }

  destroy() {
    this.dead = true;
    this.aborter.abort();
    for (const b of this.decoded.values()) b.close();
    this.decoded.clear();
    for (const s of this.streams.values()) s.tex?.dispose();
    this.streams.clear();
  }
}
