// Star names, drawn from an atlas. Each name is set once, with its soft dark halo,
// into one shared canvas, and from then on a frame only copies pieces of it. So
// hundreds of names cost no layout, no text shaping and no shadow per frame, and
// they stay sharp over the bloom because they sit on a canvas of their own.

export interface LabelSprite {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Size to draw at full scale, in CSS pixels. */
  w: number;
  h: number;
  /** Where the text starts inside the sprite, in CSS pixels. */
  pad: number;
}

const FONT = 'Inter, -apple-system, "SF Pro Display", sans-serif';
const PAD = 7;

export class LabelAtlas {
  readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly scale: number;
  private readonly map = new Map<string, LabelSprite>();
  private x = 1;
  private y = 1;
  private rowH = 0;
  private left = 0;
  private readonly perFrame: number;

  constructor(dpr: number, phone: boolean) {
    // A little over the screen's own density: a name drawn slightly smaller stays crisp.
    this.scale = dpr * 1.2;
    this.perFrame = phone ? 6 : 12;
    this.canvas = document.createElement("canvas");
    this.canvas.width = phone ? 1024 : 2048;
    this.canvas.height = phone ? 1024 : 1536;
    this.g = this.canvas.getContext("2d")!;
    this.g.textBaseline = "top";
    this.g.textAlign = "left";
  }

  /** The start of a frame: a few new names may be set now, so a burst never stalls one frame. */
  begin() {
    this.left = this.perFrame;
  }

  private reset() {
    this.map.clear();
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.x = this.y = 1;
    this.rowH = 0;
  }

  /** The sprite for a name. Null means not yet: it gets a turn on a later frame. */
  get(text: string, size: number, weight: number, color: string, now = false): LabelSprite | null {
    const key = `${weight}|${size}|${color}|${text}`;
    const hit = this.map.get(key);
    if (hit) return hit;
    if (!now && this.left <= 0) return null;
    this.left--;
    const g = this.g;
    const s = this.scale;
    const font = `${weight} ${size * s}px ${FONT}`;
    g.font = font;
    const tw = g.measureText(text).width;
    const sw = Math.ceil(tw + PAD * 2 * s);
    const sh = Math.ceil((size * 1.3 + PAD * 2) * s);
    if (this.x + sw > this.canvas.width - 1) {
      this.x = 1;
      this.y += this.rowH + 2;
      this.rowH = 0;
    }
    if (this.y + sh > this.canvas.height - 1) this.reset();
    g.font = font;
    const x = this.x + PAD * s;
    const y = this.y + PAD * s;
    // The halo is what lets a name read on anything: dark, soft, drawn twice.
    g.shadowColor = "rgba(0,0,0,0.92)";
    g.shadowBlur = 5 * s;
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.shadowBlur = 2.5 * s;
    g.fillText(text, x, y);
    g.shadowBlur = 0;
    g.fillText(text, x, y);
    const sprite: LabelSprite = { sx: this.x, sy: this.y, sw, sh, w: sw / s, h: sh / s, pad: PAD };
    this.map.set(key, sprite);
    this.x += sw + 2;
    this.rowH = Math.max(this.rowH, sh);
    return sprite;
  }

  dispose() {
    this.canvas.width = this.canvas.height = 0;
    this.map.clear();
  }
}
