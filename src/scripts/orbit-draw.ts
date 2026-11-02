// The hero's orbit rings: three tilted ellipses around the portrait, each with
// a comet running its track. The near half of every ring draws on the front
// canvas (over the photo) and the far half on the back one (behind it).
// Shared by the worker (src/scripts/orbit.worker.ts) and the page, which
// draws here itself when it cannot hand canvases to a worker.

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** What the rings follow: the pointer, a hover boost, and the sky's colours. */
export type OrbitInput = {
  targetX: number;
  targetY: number;
  targetBoost: number;
  c1: string;
  c2: string;
};

export type Orbit = {
  resize: (size: number, dpr: number) => void;
  /** Advance by the time since the last frame (ms) and draw. */
  frame: (dtMs: number, input: OrbitInput) => void;
  draw: (input: OrbitInput) => void;
};

// Radii are fractions of the box; rot is the ring's lean in radians.
const RINGS = [
  { rx: 0.4, ry: 0.12, rot: -0.38, speed: 0.34, phase: 0.6, col: 1, width: 1.2 },
  { rx: 0.47, ry: 0.16, rot: 0.22, speed: -0.24, phase: 2.4, col: 2, width: 1.2 },
  { rx: 0.49, ry: 0.07, rot: -0.04, speed: 0.17, phase: 4.2, col: 0, width: 1 },
];
const TRAIL = 22;

export function createOrbit(back: Canvas, front: Canvas): Orbit | null {
  const bctx = back.getContext("2d") as Ctx | null;
  const fctx = front.getContext("2d") as Ctx | null;
  if (!bctx || !fctx) return null;

  let size = 0;
  let dpr = 1;
  let tiltX = 0;
  let tiltY = 0;
  let boost = 0;
  let time = 0;

  const colourFor = (k: number, input: OrbitInput) => (k === 1 ? input.c1 : k === 2 ? input.c2 : "245,245,247");

  // A point on a ring: x, y in px, and z, its depth (+1 nearest).
  const at = (ring: (typeof RINGS)[number], a: number) => {
    const rot = ring.rot + tiltX * 0.16;
    const rx = ring.rx * size;
    const ry = ring.ry * size * (1 + tiltY * 0.35);
    const px = rx * Math.cos(a);
    const py = ry * Math.sin(a);
    return {
      x: size / 2 + px * Math.cos(rot) - py * Math.sin(rot),
      y: size / 2 + px * Math.sin(rot) + py * Math.cos(rot),
      z: Math.sin(a),
    };
  };

  const draw = (input: OrbitInput) => {
    for (const ctx of [bctx, fctx]) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
    }
    for (const ring of RINGS) {
      const rgb = colourFor(ring.col, input);
      // The ring itself, in short segments so its near half can sit in
      // front of the portrait and its far half behind it.
      const steps = 120;
      let prev = at(ring, 0);
      for (let i = 1; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const p = at(ring, a);
        const near = (prev.z + p.z) / 2 > 0;
        const ctx = near ? fctx : bctx;
        ctx.strokeStyle = `rgba(${rgb},${near ? 0.42 : 0.2})`;
        ctx.lineWidth = ring.width;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        prev = p;
      }

      // The comet: a bright head and a trail that fades behind it.
      const head = ring.phase + time * ring.speed;
      const dir = Math.sign(ring.speed) || 1;
      for (let j = TRAIL; j >= 0; j--) {
        const a = head - dir * j * 0.035;
        const p = at(ring, a);
        const ctx = p.z > 0 ? fctx : bctx;
        const f = 1 - j / TRAIL;
        ctx.fillStyle = `rgba(${rgb},${(0.08 + 0.55 * f * f).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.7 + 2 * f, 0, Math.PI * 2);
        ctx.fill();
      }
      const h = at(ring, head);
      const ctx = h.z > 0 ? fctx : bctx;
      const glow = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 18);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.3, `rgba(${rgb},0.55)`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  return {
    resize(s, d) {
      size = s;
      dpr = d;
      for (const cv of [back, front]) {
        cv.width = Math.round(size * dpr);
        cv.height = Math.round(size * dpr);
      }
    },
    frame(dtMs, input) {
      const dt = Math.min(0.05, dtMs / 1000);
      // Ease toward the cursor and the hover boost, so nothing snaps.
      tiltX += (input.targetX - tiltX) * 0.06;
      tiltY += (input.targetY - tiltY) * 0.06;
      boost += (input.targetBoost - boost) * 0.05;
      time += dt * (1 + boost * 0.7);
      draw(input);
    },
    draw,
  };
}
