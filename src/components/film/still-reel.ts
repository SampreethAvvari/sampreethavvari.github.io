// A reel made from a film's own stills, for films whose clip has not
// arrived yet. One 2D canvas, treated like a clip: each still leads for a
// few seconds with a slow push in and a drift across the frame, then
// dissolves into the next, and the run loops. It draws only while it plays,
// and the reel's cut reads the canvas like a video frame.
//
// Many stills have letterbox bars baked in. When a still loads its true
// black top and bottom rows are measured, and the picture inside them is
// what fills the screen.

type Frame = { img: HTMLImageElement; y0: number; y1: number; ready: boolean };

const HOLD = 5.2; // seconds each still leads
const DISSOLVE = 1.3; // seconds of overlap into the next one
// Directions the picture drifts, one per still, so no two moves repeat.
const DRIFTS: Array<[number, number]> = [
  [-1, 0.35],
  [1, -0.2],
  [0.6, -0.5],
  [-0.7, 0.45],
  [0.9, -0.1],
];

export class StillReel {
  private ctx: CanvasRenderingContext2D | null;
  private frames: Frame[];
  private elapsed = 0;
  private last = 0;
  private raf = 0;
  private playing = false;
  private w = 1;
  private h = 1;
  private first = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    urls: string[],
    private opts: { phone: boolean; dprCap: number; loop?: boolean; onFirstFrame?: () => void },
  ) {
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.frames = urls.map((src) => {
      const img = new Image();
      img.decoding = "async";
      img.dataset.src = src;
      return { img, y0: 0, y1: 1, ready: false };
    });
    // Five or so stills: they all load now, so no dissolve waits on one.
    this.frames.forEach((_, i) => this.load(i));
  }

  /** Seconds, as if it were a clip. */
  get duration() {
    return Math.max(1, this.frames.length) * HOLD;
  }
  get ready() {
    return !!this.frames[0]?.ready;
  }

  private load(i: number) {
    const f = this.frames[i];
    if (!f || f.img.src) return;
    f.img.onload = () => {
      this.measure(f);
      f.ready = true;
      if (i === 0) this.fit();
      this.draw();
      if (i === 0 && !this.first) {
        this.first = true;
        this.opts.onFirstFrame?.();
      }
    };
    f.img.src = f.img.dataset.src || "";
  }

  // Rows at the top and bottom that are true black (bars, not a night sky)
  // are cut away. Baked bars here are never more than a fifth of the frame.
  private measure(f: Frame) {
    try {
      const c = document.createElement("canvas");
      c.width = 24;
      c.height = 96;
      const x = c.getContext("2d", { willReadFrequently: true });
      if (!x) return;
      x.drawImage(f.img, 0, 0, 24, 96);
      const data = x.getImageData(0, 0, 24, 96).data;
      const dark = (row: number) => {
        let sum = 0;
        for (let col = 0; col < 24; col++) {
          const k = (row * 24 + col) * 4;
          sum += data[k] + data[k + 1] + data[k + 2];
        }
        return sum / (24 * 3) < 4;
      };
      let top = 0;
      while (top < 20 && dark(top)) top++;
      let bottom = 95;
      while (bottom > 75 && dark(bottom)) bottom--;
      f.y0 = top > 0 ? (top + 1) / 96 : 0;
      f.y1 = bottom < 95 ? bottom / 96 : 1;
    } catch {
      /* a still from elsewhere would taint the canvas; draw it whole */
    }
  }

  fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.dprCap);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.w = w;
    this.h = h;
  }

  // Letterbox: slim bars, so the picture stays nearly full bleed.
  private bar() {
    return Math.round(this.h * 0.045);
  }

  private paint(f: Frame | undefined, local: number, slot: number, alpha: number) {
    const ctx = this.ctx;
    if (!ctx || !f?.ready) return;
    const { img } = f;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cy0 = f.y0 * ih;
    const ch = (f.y1 - f.y0) * ih;
    // The picture fills the screen; on phones it pans across its width.
    const bw = this.w;
    const bh = this.h;
    const t = Math.max(0, Math.min(1, local));
    const e = t * t * (3 - 2 * t) * 0.6 + t * 0.4;
    const zoom = (this.opts.phone ? 1.02 : 1.03) + 0.09 * e;
    const s = Math.max(bw / iw, bh / ch) * zoom;
    const ox = Math.max(0, (iw * s - bw) / 2);
    const oy = Math.max(0, (ch * s - bh) / 2);
    const [dx, dy] = DRIFTS[slot % DRIFTS.length];
    const sweep = (e - 0.5) * 2; // -1 to 1 across the hold
    const px = this.opts.phone ? dx * ox * 0.85 * sweep : dx * ox * 0.6 * sweep;
    const py = dy * oy * 0.6 * sweep;
    const x = this.w / 2 - (iw / 2) * s + px;
    const y = this.h / 2 - (cy0 + ch / 2) * s + py;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, iw * s, ih * s);
    ctx.globalAlpha = 1;
  }

  draw() {
    const ctx = this.ctx;
    const n = this.frames.length;
    if (!ctx || !n) return;
    const t = Math.max(0, Math.min(this.elapsed, this.duration - 0.001));
    const slot = Math.min(n - 1, Math.floor(t / HOLD));
    const into = t - slot * HOLD;
    const span = HOLD + DISSOLVE;
    ctx.fillStyle = "#050002";
    ctx.fillRect(0, 0, this.w, this.h);
    this.paint(this.frames[slot], into / span, slot, 1);
    if (slot > 0 && into < DISSOLVE) {
      this.paint(this.frames[slot - 1], (into + HOLD) / span, slot - 1, 1 - into / DISSOLVE);
    }
    const bar = this.bar();
    if (bar > 0) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, this.w, bar);
      ctx.fillRect(0, this.h - bar, this.w, bar);
    }
  }

  /** Play from where it stands at normal speed; at the end it stops, or
   *  starts over when it loops. */
  play() {
    if (this.playing) return;
    this.playing = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.playing) return;
      this.elapsed += Math.max(0, Math.min(0.1, (now - this.last) / 1000));
      this.last = now;
      if (this.elapsed >= this.duration && this.opts.loop) this.elapsed -= this.duration;
      if (this.elapsed >= this.duration) {
        this.elapsed = this.duration;
        this.draw();
        this.pause();
        return;
      }
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.pause();
    for (const f of this.frames) {
      f.img.onload = null;
      f.img.removeAttribute("src");
    }
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
