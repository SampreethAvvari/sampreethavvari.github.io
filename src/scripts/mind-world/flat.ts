// The map drawn with canvas 2D. It is the first map on screen, up within a moment
// of the page, while the 3D world gets ready behind it; and it is the whole map
// when there is no GPU or the GPU is lost. Every glow is drawn once into a small
// image and reused, so a frame is mostly image copies, which phones handle well.
// It keeps all the same controls and data: only the world around it is plainer.

export type V3 = [number, number, number];

/** How much bigger a planet draws than its data radius, so its ring reads from afar. */
export const PLANET_SCALE = 3.6;

export interface Projected {
  px: number;
  py: number;
  pz: number;
  ps: number;
}

export interface FlatComet {
  p: V3;
  v: V3;
  len: number;
  w: number;
  color: string;
  age: number;
  life: number;
}

export interface FlatNode {
  type: string;
  color: string;
  px: number;
  py: number;
  pz: number;
  ps: number;
  /** Radius on screen and brightness, worked out by the page. */
  R: number;
  op: number;
  foc: number;
  big: boolean;
  major: boolean;
}

const SPACE_TINTS = ["#A78BFA", "#5B8DEF", "#22D3EE", "#34D399", "#F5A524", "#F43F5E"];
const DUST_TINTS = ["#EEF2FF", "#CFE0FF", ...SPACE_TINTS];
const PLANET = new Set(["discipline", "category"]);
const SPIKED = new Set(["project", "repo"]);
const NEAR = 28;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function toRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const rgbCache = new Map<string, string>();
export function rgbOf(hex: string): string {
  let v = rgbCache.get(hex);
  if (v) return v;
  const { r, g, b } = toRgb(hex);
  v = `${r},${g},${b}`;
  rgbCache.set(hex, v);
  return v;
}
export function mix(a: string, b: string, t: number): string {
  const A = toRgb(a);
  const B = toRgb(b);
  const r = Math.round(lerp(A.r, B.r, t));
  const g = Math.round(lerp(A.g, B.g, t));
  const bl = Math.round(lerp(A.b, B.b, t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}
const hexA = (hex: string, a: number) => `rgba(${rgbOf(hex)},${clamp(a, 0, 1).toFixed(3)})`;

export class Flat {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly reduced: boolean;
  private readonly phone: boolean;
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private dust: { x: number; y: number; z: number; size: number; tint: number; tw: number; sx: number; sy: number }[] = [];
  private nebulae: { dir: V3; size: number; color: string }[] = [];
  private clouds: { dir: V3; size: number; blobs: { ox: number; oy: number; r: number; color: string; ph: number; sp: number }[] }[] = [];

  constructor(ctx: CanvasRenderingContext2D, reduced: boolean, phone: boolean) {
    this.ctx = ctx;
    this.reduced = reduced;
    this.phone = phone;
  }

  private sprite(kind: "glow" | "core" | "spike" | "soft", color: string): HTMLCanvasElement {
    const key = kind + color;
    const hit = this.sprites.get(key);
    if (hit) return hit;
    const S = 128;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const rgb = rgbOf(color);
    const hot = rgbOf(mix(color, "#ffffff", 0.7));
    if (kind === "glow" || kind === "soft") {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      if (kind === "glow") {
        grd.addColorStop(0, `rgba(${hot},1)`);
        grd.addColorStop(0.08, `rgba(${rgb},0.8)`);
        grd.addColorStop(0.22, `rgba(${rgb},0.36)`);
        grd.addColorStop(0.5, `rgba(${rgb},0.1)`);
      } else {
        grd.addColorStop(0, `rgba(${rgb},0.55)`);
        grd.addColorStop(0.4, `rgba(${rgb},0.2)`);
        grd.addColorStop(0.7, `rgba(${rgb},0.06)`);
      }
      grd.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
    } else if (kind === "core") {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.28, `rgba(${hot},0.95)`);
      grd.addColorStop(0.55, `rgba(${rgb},0.45)`);
      grd.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
    } else {
      for (const [w, h] of [[S, 3], [3, S]]) {
        const grd = w > h ? g.createLinearGradient(0, 0, S, 0) : g.createLinearGradient(0, 0, 0, S);
        grd.addColorStop(0, `rgba(${rgb},0)`);
        grd.addColorStop(0.4, `rgba(${rgb},0.35)`);
        grd.addColorStop(0.5, `rgba(${hot},1)`);
        grd.addColorStop(0.6, `rgba(${rgb},0.35)`);
        grd.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grd;
        g.fillRect((S - w) / 2, (S - h) / 2, w, h);
      }
    }
    this.sprites.set(key, c);
    return c;
  }

  private blit(img: HTMLCanvasElement, x: number, y: number, r: number, a: number) {
    if (a <= 0.004 || r < 0.3) return;
    this.ctx.globalAlpha = Math.min(a, 1);
    this.ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  }

  /** Lay out the sky around the map. Only called when the plain sky is really wanted. */
  buildSky(worldR: number) {
    const reduced = this.reduced;
    const phone = this.phone;
    const N = reduced ? 320 : phone ? 760 : 1400;
    const R = Math.random;
    this.dust = Array.from({ length: N }, () => ({
      x: R() * 2 - 1,
      y: R() * 2 - 1,
      z: R() * 2 - 1,
      size: 0.45 + R() ** 3 * 1.9,
      tint: R() < 0.82 ? (R() < 0.6 ? 0 : 1) : 2 + ((R() * SPACE_TINTS.length) | 0),
      tw: R() * Math.PI * 2,
      sx: NaN,
      sy: NaN,
    }));
    const onSphere = (): V3 => {
      const a = R() * Math.PI * 2;
      const e = Math.asin(R() * 2 - 1) * 0.8;
      return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
    };
    this.nebulae = Array.from({ length: 5 }, (_, i) => ({ dir: onSphere(), size: 0.55 + R() * 0.45, color: SPACE_TINTS[i % SPACE_TINTS.length] }));
    this.clouds = Array.from({ length: phone ? 4 : 6 }, (_, i) => ({
      dir: onSphere(),
      size: 0.4 + R() * 0.3,
      blobs: Array.from({ length: 5 }, (_, j) => ({
        ox: (R() - 0.5) * 1.1,
        oy: (R() - 0.5) * 0.7,
        r: 0.35 + R() * 0.45,
        color: SPACE_TINTS[(i * 2 + j) % SPACE_TINTS.length],
        ph: R() * Math.PI * 2,
        sp: 0.05 + R() * 0.08,
      })),
    }));
  }

  /** The plain sky, by the same rule as the world's: colour only outside the map, faint stars everywhere. */
  drawSky(v: {
    W: number;
    H: number;
    time: number;
    fade: number;
    worldR: number;
    box: number;
    dustQ: number;
    speed: number;
    cam: V3;
    proj: (x: number, y: number, z: number) => Projected;
    fast: (x: number, y: number, z: number) => Projected;
    mapX: number;
    mapY: number;
    mapR: number;
  }) {
    const { W, H, time, fade, box, cam, proj, fast, dustQ } = v;
    const ctx = this.ctx;
    const reduced = this.reduced;
    ctx.globalCompositeOperation = "lighter";
    const far = box * 0.95;
    const farPt = (d: V3, f: number) => proj(cam[0] * 0.5 + d[0] * f, cam[1] * 0.5 + d[1] * f, cam[2] * 0.5 + d[2] * f);
    // A cloud's light, faded to nothing before it reaches the map.
    const clear = (x: number, y: number, r: number) => clamp((Math.hypot(x - v.mapX, y - v.mapY) - v.mapR - r) / (r * 0.6 + 90), 0, 1);
    for (const n of this.nebulae) {
      const q = farPt(n.dir, far);
      if (q.pz < NEAR) continue;
      const nr = clamp(far * n.size * q.ps, 80, Math.max(W, H) * 1.6);
      this.blit(this.sprite("soft", n.color), q.px, q.py, nr, 0.2 * fade * clear(q.px, q.py, nr * 0.6));
    }
    for (const cl of this.clouds) {
      const q = farPt(cl.dir, far * 0.9);
      if (q.pz < NEAR) continue;
      const R = clamp(far * cl.size * q.ps, 40, Math.max(W, H) * 1.1);
      if (q.px < -R * 1.6 || q.px > W + R * 1.6 || q.py < -R * 1.6 || q.py > H + R * 1.6) continue;
      for (const b of cl.blobs) {
        const t = reduced ? 0 : time * b.sp;
        const x = q.px + (b.ox + Math.sin(t + b.ph) * 0.18) * R;
        const y = q.py + (b.oy + Math.cos(t * 0.8 + b.ph) * 0.12) * R;
        const r = R * b.r * (1 + Math.sin(t * 1.3 + b.ph) * 0.1);
        this.blit(this.sprite("soft", b.color), x, y, r, (0.075 + Math.sin(t * 1.1 + b.ph * 2) * 0.03) * fade * clear(x, y, r * 0.7));
      }
    }
    // stars in a box that wraps around the target, so the field never ends
    const half = box;
    const fog = box * 1.7;
    const streak = !reduced && v.speed > 0.5;
    let tint = -1;
    for (const d of this.dust) {
      let x = d.x * half - cam[0];
      let y = d.y * half - cam[1];
      let z = d.z * half - cam[2];
      x = ((((x + half) % (2 * half)) + 2 * half) % (2 * half)) - half;
      y = ((((y + half) % (2 * half)) + 2 * half) % (2 * half)) - half;
      z = ((((z + half) % (2 * half)) + 2 * half) % (2 * half)) - half;
      const q = fast(x + cam[0], y + cam[1], z + cam[2]);
      if (q.pz < NEAR || q.px < -20 || q.px > W + 20 || q.py < -20 || q.py > H + 20) {
        d.sx = NaN;
        continue;
      }
      const near = clamp(1 - q.pz / fog, 0, 1);
      const tw = reduced ? 1 : 0.7 + Math.sin(time * 1.4 + d.tw) * 0.3;
      const a = clamp(0.22 + near * near * 1.2, 0, 1) * tw * fade * dustQ;
      const r = clamp(d.size * (0.7 + q.ps * 1.8), 0.6, 3.8);
      const color = DUST_TINTS[d.tint];
      if (d.tint !== tint) {
        tint = d.tint;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
      }
      const moved = Math.hypot(q.px - d.sx, q.py - d.sy);
      ctx.globalAlpha = a;
      if (streak && moved > 1.5 && moved < 180) {
        ctx.lineWidth = Math.max(r * 0.8, 0.7);
        ctx.beginPath();
        ctx.moveTo(d.sx, d.sy);
        ctx.lineTo(q.px, q.py);
        ctx.stroke();
      } else {
        ctx.fillRect(q.px - r * 0.5, q.py - r * 0.5, r, r);
        if (d.size > 1.3) {
          this.blit(this.sprite("glow", color), q.px, q.py, r * 5.5, a * 0.7);
          ctx.globalAlpha = a;
          ctx.fillStyle = color;
        }
      }
      d.sx = q.px;
      d.sy = q.py;
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "source-over";
  }

  /** A comet: a tail of short segments that taper and fade behind the head. */
  drawComet(c: FlatComet, fade: number, proj: (x: number, y: number, z: number) => Projected) {
    const ctx = this.ctx;
    const spd = Math.hypot(c.v[0], c.v[1], c.v[2]) || 1;
    const dir: V3 = [c.v[0] / spd, c.v[1] / spd, c.v[2] / spd];
    const life = c.age / c.life;
    const env = clamp(life / 0.12, 0, 1) * clamp((1 - life) / 0.18, 0, 1) * fade;
    if (env <= 0.01) return;
    const SEG = 10;
    let prev = proj(c.p[0], c.p[1], c.p[2]);
    const head = prev;
    const rgb = rgbOf(c.color);
    const hot = rgbOf(mix(c.color, "#ffffff", 0.6));
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1;
    for (let i = 1; i <= SEG; i++) {
      const k = (i / SEG) * c.len;
      const q = proj(c.p[0] - dir[0] * k, c.p[1] - dir[1] * k, c.p[2] - dir[2] * k);
      if (prev.pz > NEAR && q.pz > NEAR) {
        const f = 1 - (i - 1) / SEG;
        ctx.strokeStyle = `rgba(${i === 1 ? hot : rgb},${(0.9 * f * f * env).toFixed(3)})`;
        ctx.lineWidth = clamp(c.w * prev.ps * 1.7 * f, 0.6, 9);
        ctx.beginPath();
        ctx.moveTo(prev.px, prev.py);
        ctx.lineTo(q.px, q.py);
        ctx.stroke();
      }
      prev = q;
    }
    if (head.pz > NEAR) {
      const R = clamp(c.w * head.ps * 10, 3, 70);
      this.blit(this.sprite("glow", c.color), head.px, head.py, R, env);
      this.blit(this.sprite("core", c.color), head.px, head.py, R * 0.32, env);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** One line between two stars on screen. */
  line(ax: number, ay: number, bx: number, by: number, rgb: string, op: number, width: number) {
    if (op < 0.01) return;
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(${rgb},${(op * 0.16).toFixed(3)})`;
    ctx.lineWidth = width * 3.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${op.toFixed(3)})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  /** A star: a soft halo and a hot core, added as light. A planet: a lit sphere with a ring. */
  drawStar(p: FlatNode, W: number, H: number, near: number, out: number) {
    const ctx = this.ctx;
    const op = clamp(p.op, 0, 1.5);
    if (op <= 0.01) return;
    const R = p.R;
    const x = p.px;
    const y = p.py;
    const big = p.big;
    const focus = p.foc > 0.5;
    const o = focus ? 0 : out;
    const haloMax = Math.max(W, H) * (this.phone ? 0.45 : 0.8);
    // A planet's radius is already scaled up for its ring; its glow should not be too.
    const hr = PLANET.has(p.type) ? R / PLANET_SCALE : R;
    const halo = Math.min(haloMax, big ? Math.max(hr * 8 + lerp(16, 6, o), lerp(26, 11, o)) : Math.max(hr * 4.6 + 4, lerp(8, 5, o)));
    this.blit(this.sprite("glow", p.color), x, y, halo, op * (big ? lerp(0.72, 0.5, o) : 0.42));
    if ((SPIKED.has(p.type) || (big && !p.major)) && o < 0.85) this.blit(this.sprite("spike", p.color), x, y, Math.max(R * 7 + 20, lerp(30, 12, o)), op * 0.55 * (1 - o));
    const core = Math.max(R * (big ? 1.45 : 0.95), big ? lerp(2.6, 1.7, o) : 1.2);
    const hotHue = p.type === "repo" || p.type === "tech" || p.type === "language";
    const coreLift = hotHue ? 0.45 : p.type === "project" ? 0.55 : 1;
    this.blit(this.sprite("core", p.color), x, y, core * 1.8, Math.min(1, op * 0.92 * coreLift));
    ctx.globalAlpha = 1;
    if (PLANET.has(p.type) && R > 2.6) {
      ctx.globalCompositeOperation = "source-over";
      const g = ctx.createRadialGradient(x - R * 0.38, y - R * 0.42, R * 0.08, x, y, R);
      g.addColorStop(0, hexA(mix(p.color, "#ffffff", 0.7), Math.min(1, op)));
      g.addColorStop(0.5, hexA(p.color, Math.min(1, op * 0.92)));
      g.addColorStop(1, hexA(mix(p.color, "#000000", 0.55), Math.min(1, op * 0.95)));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hexA(mix(p.color, "#ffffff", 0.3), Math.min(1, op * 0.75));
      ctx.lineWidth = Math.max(1, R * 0.14);
      ctx.beginPath();
      ctx.ellipse(x, y, R * 2.15, R * 0.6, -0.38, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.major && R > 7) {
      const bubble = clamp((R - 7) / 10, 0, 1) * clamp(near + 0.2, 0, 1);
      if (bubble > 0.02) {
        const g1 = ctx.createRadialGradient(x, y, R * 0.7, x, y, R);
        g1.addColorStop(0, hexA(p.color, 0));
        g1.addColorStop(0.75, hexA(p.color, 0.18 * op * bubble));
        g1.addColorStop(0.92, hexA(mix(p.color, "#ffffff", 0.4), 0.75 * op * bubble));
        g1.addColorStop(1, hexA(p.color, 0));
        ctx.fillStyle = g1;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (focus) {
      ctx.strokeStyle = hexA(p.color, Math.min(1, 0.85 * op));
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(R * 1.7, 9) + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
