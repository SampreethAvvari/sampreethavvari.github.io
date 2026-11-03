// A title card for a film with no footage on the site yet, drawn on one 2D
// canvas so the reel's cut can read it like a frame of film. It is plainly
// a card: the title set in type on a red field between letterbox bars, the
// year above and my credits below, with an eclipse and fine dust. While it
// is on screen the field breathes slowly (the nebula drifts, the corona
// turns, the dust twinkles); off screen it draws nothing.

const TAU = Math.PI * 2;

// A small seeded random, so each film's card always looks the same.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;

type Mote = { x: number; y: number; r: number; a: number; tw: number; red: boolean };

export class TitleCard {
  private ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private raf = 0;
  private playing = false;
  private t0 = performance.now();
  private motes: Mote[];
  private sun: { x: number; y: number; r: number };
  private glow: { x: number; y: number };
  private fontReady = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private card: { title: string; year: string; roles: string },
    private opts: { phone: boolean; dprCap: number; onFirstFrame?: () => void },
  ) {
    this.ctx = canvas.getContext("2d", { alpha: false });
    const rnd = seeded(hash(card.title));
    this.motes = Array.from({ length: opts.phone ? 70 : 140 }, () => ({
      x: rnd(),
      y: rnd(),
      r: rnd() ** 2.4 * 1.6 + 0.4,
      a: 0.25 + rnd() * 0.7,
      tw: rnd() * TAU,
      red: rnd() < 0.35,
    }));
    // The card's own type and its eclipse sit right of centre (low on a
    // phone), clear of the reel's caption on the left.
    this.sun = { x: 0.56 + rnd() * 0.2, y: 0.34 + rnd() * 0.32, r: 0.17 + rnd() * 0.05 };
    this.glow = { x: rnd(), y: rnd() };
    this.fit();
    this.draw();
    // The title is set in Inter; draw again once the face is in.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.load) {
      fonts.load('600 64px "Inter"').then(() => {
        this.fontReady = true;
        this.draw();
      }, () => {});
    }
    queueMicrotask(() => opts.onFirstFrame?.());
  }

  get ready() {
    return true;
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

  draw(now = performance.now()) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { w, h } = this;
    const t = (now - this.t0) / 1000;
    const bar = this.opts.phone ? Math.round(h * 0.07) : Math.max(Math.round(h * 0.07), Math.round((h - w / 2.39) / 2));
    const fh = h - 2 * bar;
    const m = Math.min(w, fh);

    // The field: near black, warmed by two slow crimson clouds.
    ctx.fillStyle = "#070103";
    ctx.fillRect(0, 0, w, h);
    const cloud = (x: number, y: number, r: number, rgb: string, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(0.35, `rgba(${rgb},${a * 0.55})`);
      g.addColorStop(0.7, `rgba(${rgb},${a * 0.16})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, bar, w, fh);
    };
    const drift = Math.sin(t * 0.07) * 0.04;
    cloud((this.glow.x * 0.6 + 0.2 + drift) * w, bar + (this.glow.y * 0.5 + 0.25) * fh, Math.max(w, fh) * 0.55, "190,24,60", 0.42);
    cloud((0.8 - this.glow.x * 0.6 - drift) * w, bar + (0.75 - this.glow.y * 0.5) * fh, Math.max(w, fh) * 0.45, "120,10,40", 0.38);

    // Dust.
    for (const d of this.motes) {
      const y = bar + d.y * fh;
      const tw = 0.55 + 0.45 * Math.sin(t * 1.3 + d.tw);
      ctx.globalAlpha = d.a * tw;
      ctx.fillStyle = d.red ? "#ff6f88" : "#ffe9ed";
      ctx.beginPath();
      ctx.arc(d.x * w, y, d.r * (w / 1440 + 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The eclipse: a dark disc with a lit rim and a turning corona.
    const sx = (this.opts.phone ? 0.5 + (this.sun.x - 0.66) : this.sun.x) * w;
    const sy = bar + (this.opts.phone ? 0.68 : this.sun.y) * fh;
    const sr = this.sun.r * m * 1.6;
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.9, sx, sy, sr * 2.1);
    halo.addColorStop(0, "rgba(244,63,94,0.32)");
    halo.addColorStop(0.4, "rgba(244,63,94,0.1)");
    halo.addColorStop(1, "rgba(244,63,94,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sx - sr * 2.2, sy - sr * 2.2, sr * 4.4, sr * 4.4);
    const rim = ctx.createRadialGradient(sx, sy, sr * 0.96, sx, sy, sr * 1.08);
    rim.addColorStop(0, "rgba(255,190,200,0.95)");
    rim.addColorStop(0.35, "rgba(255,99,122,0.6)");
    rim.addColorStop(1, "rgba(244,63,94,0)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 1.08, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t * 0.05);
    for (let k = 0; k < 4; k++) {
      ctx.rotate(TAU / 4);
      ctx.strokeStyle = `rgba(255,170,185,${0.28 + 0.12 * Math.sin(t * 0.6 + k)})`;
      ctx.lineWidth = Math.max(1, sr * 0.025);
      ctx.beginPath();
      ctx.arc(0, 0, sr * 1.03, 0, 0.55);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#050002";
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 0.97, 0, TAU);
    ctx.fill();

    // A soft light that passes across now and then.
    const pass = ((t * 0.08) % 1.6) - 0.3;
    if (pass > -0.3 && pass < 1.3) {
      const lx = pass * w;
      const lg = ctx.createLinearGradient(lx - w * 0.12, 0, lx + w * 0.12, 0);
      lg.addColorStop(0, "rgba(255,200,210,0)");
      lg.addColorStop(0.5, "rgba(255,200,210,0.05)");
      lg.addColorStop(1, "rgba(255,200,210,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, bar, w, fh);
    }

    // The words: year above, title, credits in the lower bar.
    const font = this.fontReady ? '"Inter", "Inter Fallback", system-ui, sans-serif' : '"Inter Fallback", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.round(Math.min(w * (this.opts.phone ? 0.1 : 0.058), fh * 0.18));
    const cx = this.opts.phone ? w / 2 : w * 0.66;
    ctx.font = `600 ${size}px ${font}`;
    const words = this.card.title;
    let lines = [words];
    if (ctx.measureText(words).width > w * (this.opts.phone ? 0.84 : 0.5) && words.includes(" ")) {
      const parts = words.split(" ");
      const mid = Math.ceil(parts.length / 2);
      lines = [parts.slice(0, mid).join(" "), parts.slice(mid).join(" ")];
    }
    const lh = size * 1.02;
    const cy = bar + fh * (this.opts.phone ? 0.74 : 0.5);
    ctx.shadowColor = "rgba(244,63,94,0.55)";
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = "#ffffff";
    lines.forEach((ln, i) => {
      // A touch of negative tracking, the way the site sets display type.
      const letter = (ctx as CanvasRenderingContext2D & { letterSpacing?: string });
      if ("letterSpacing" in ctx) letter.letterSpacing = `${-size * 0.04}px`;
      ctx.fillText(ln, cx, cy + (i - (lines.length - 1) / 2) * lh);
    });
    ctx.shadowBlur = 0;
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
    ctx.font = `500 ${Math.round(size * 0.24)}px ${font}`;
    ctx.fillStyle = "rgba(245,245,247,0.7)";
    ctx.fillText(this.card.year, cx, cy - (lines.length * lh) / 2 - size * 0.42);

    // Letterbox bars, credits in the lower one.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
    ctx.font = `500 ${Math.max(10, Math.round(bar * 0.2))}px ${font}`;
    ctx.fillStyle = "rgba(245,245,247,0.6)";
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.max(1, bar * 0.02)}px`;
    ctx.fillText(this.card.roles, w / 2, h - bar / 2);
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    const tick = (now: number) => {
      if (!this.playing) return;
      this.draw(now);
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
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
