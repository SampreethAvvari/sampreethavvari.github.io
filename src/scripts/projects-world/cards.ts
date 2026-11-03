// The cards after the flight. They are the last bodies of the system: each one
// leaves the star, far off and small, and comes up the scroll toward the reader
// on a curve around it, until it locks into its lane, flat and readable. Going
// back up sends them back to the star. It is real perspective: a depth gives a
// scale, the card sits on the line from the star to its lane at that scale, and
// that line swings round the star while the card is still far out.
//
// A card's place comes from the scroll while the page moves, and it finishes the
// way on its own when the page stops, so what is on screen at rest can be read
// and clicked. Only transform and opacity change. Layout is read when it changes
// (a resize, a filter, an opened case study), never while scrolling, and a card
// only holds a compositor layer while it is moving.
//
// Without the scene, or with reduced motion, this is a plain grid with a filter
// and a search.

import { onPage } from "../lifecycle";

/** Where the star is on screen, in CSS pixels, written by the stage. Negative until it knows. */
export const cardsBridge = { x: -1, y: -1 };

const emit = (name: string, detail: Record<string, unknown>) => dispatchEvent(new CustomEvent(name, { detail }));
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const inst = { behavior: "instant" as ScrollBehavior };

// How far away a card starts: its size there is 1 / (1 + DEPTH).
const DEPTH = 14;
const PERSPECTIVE = 1100;
// How far round the star a card starts, in radians, for a card that has just left it.
const SWIRL = 2;
// How long the page has to be still before what is on screen finishes arriving.
const IDLE_MS = 220;
// Rates per second for a shown value chasing where it should be.
const FOLLOW = 15;
const DOCK = 4.6;
const LEAVE = 10;

type Body = {
  el: HTMLElement;
  card: boolean;
  /** Later in the page is further away. */
  i: number;
  seed: number;
  /** Layout box in page pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the arrival should be (0 far, 1 home), and where it is shown. */
  u: number;
  s: number;
  docking: boolean;
  /** It has been far out since it was last home. */
  fromFar: boolean;
  /** Passing overhead on its way off the top of the screen. */
  q: number;
  /** At rest, what has not arrived steps out of sight. */
  show: number;
  /** A filter's move: where it came from, relative to its new home. */
  fx: number;
  fy: number;
  ft: number;
  fms: number;
  leaving: boolean;
  /** Held back until this time, so a group comes in as a wave. */
  hold: number;
  /** Styles as last written, so an unchanged frame costs nothing. */
  tf: string;
  op: string;
  on: boolean;
  far: boolean;
  gone: boolean;
  /** The pointer's tilt, light and press. */
  face: HTMLElement | null;
  light: HTMLElement | null;
  hx: number;
  hy: number;
  hl: number;
  warm: boolean;
  faceTf: string;
  lightTf: string;
  lightOp: string;
};

export function mountCards() {
  onPage("projects-archive", (signal) => {
    const root = document.querySelector<HTMLElement>("[data-ax]");
    if (!root) return;
    const grid = root.querySelector<HTMLElement>("[data-ax-grid]")!;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".ac"));
    const chips = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-ax-f]"));
    const input = root.querySelector<HTMLInputElement>("[data-ax-q]")!;
    const count = root.querySelector<HTMLElement>("[data-ax-n]")!;
    const none = root.querySelector<HTMLElement>("[data-ax-none]")!;
    let filter = "all";

    const world = root.closest<HTMLElement>("[data-pw]");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    // The arrival needs the space behind it. The tilt needs a mouse as well.
    const flying = !!world?.classList.contains("is-live") && !reduced;
    const tilting = flying && !coarse;

    // ---- the bodies: the title and the tools lead, the cards follow, the closing panel is last
    const seedOf = (i: number) => {
      const v = Math.sin((i + 1) * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };
    const makeBody = (el: HTMLElement, card: boolean, i: number): Body => ({
      el,
      card,
      i,
      seed: seedOf(i),
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      u: 0,
      s: 0,
      docking: false,
      fromFar: false,
      q: 0,
      show: 1,
      fx: 0,
      fy: 0,
      ft: -1,
      fms: 1,
      leaving: false,
      hold: 0,
      tf: "",
      op: "",
      on: false,
      far: false,
      gone: false,
      face: card ? el.querySelector<HTMLElement>(".ac-face") : null,
      light: card ? el.querySelector<HTMLElement>(".ac-light") : null,
      hx: 0,
      hy: 0,
      hl: 0,
      warm: false,
      faceTf: "",
      lightTf: "",
      lightOp: "",
    });
    const cardBodies = cards.map((c, i) => makeBody(c, true, i));
    const byEl = new Map<Element, Body>(cardBodies.map((b) => [b.el, b]));
    const bodies: Body[] = [...cardBodies];
    const head = root.querySelector<HTMLElement>("[data-ax-head]");
    const tools = root.querySelector<HTMLElement>("[data-ax-tools]");
    const close = root.querySelector<HTMLElement>("[data-ax-close]");
    let headBody: Body | null = null;
    if (flying) {
      if (head) bodies.push((headBody = makeBody(head, false, -2)));
      if (tools) bodies.push(makeBody(tools, false, -1));
      if (close) bodies.push(makeBody(close, false, cards.length));
    }

    // ---- layout, read only when it changes
    let vw = document.documentElement.clientWidth;
    let vh = innerHeight;
    let reach = 1;
    let first = 0;
    let gridY = 0;
    const measure = () => {
      vw = document.documentElement.clientWidth;
      vh = innerHeight;
      // how far below the fold a card already shows, far off, in screens
      reach = vw < 640 ? 0.8 : 1.15;
      first = Infinity;
      gridY = 0;
      for (let e: HTMLElement | null = grid; e; e = e.offsetParent as HTMLElement | null) gridY += e.offsetTop;
      for (const b of bodies) {
        if (b.leaving || b.el.hidden) continue;
        let x = 0;
        let y = 0;
        for (let e: HTMLElement | null = b.el; e; e = e.offsetParent as HTMLElement | null) {
          x += e.offsetLeft;
          y += e.offsetTop;
        }
        b.x = x;
        b.y = y;
        b.w = b.el.offsetWidth;
        b.h = b.el.offsetHeight;
        if (y < first) first = y;
      }
    };

    // ---- the frame
    let raf = 0;
    let lastY = scrollY;
    let lastT = performance.now();
    let lastMove = 0;
    let dir = 1;
    let vpX = -1;
    let vpY = -1;
    // read in the scroll event, while the page is clean, never in a frame after a write
    let yNow = scrollY;
    const mounted = performance.now();
    const wake = () => {
      if (!raf && !signal.aborted) raf = requestAnimationFrame(tick);
    };
    const clear = (b: Body) => {
      if (b.tf) {
        b.el.style.transform = "";
        b.tf = "";
      }
      if (b.op) {
        b.el.style.opacity = "";
        b.op = "";
      }
      if (b.on) {
        b.el.style.willChange = "";
        b.on = false;
      }
      if (b.far) {
        b.el.removeAttribute("data-far");
        b.far = false;
      }
      if (b.gone) {
        b.el.style.visibility = "";
        b.gone = false;
      }
    };
    const place = (b: Body, now: number, y: number, idle: boolean, dt: number): boolean => {
      // the title and the tools travel as one thing, so they keep their places on the way in
      const lead = b.i === -1 ? headBody ?? b : b;
      const h2 = lead.h / 2;
      const cx = b.x + b.w / 2;
      const yc = lead.y + h2 - y;
      const top = yc - h2;
      const bottom = yc + h2;
      const myY = b.y + b.h / 2 - y;
      const moving = b.ft >= 0;
      // the lanes come in as a shallow wedge, the middle a little ahead of the sides
      const col = clamp((cx - vpX) / (vw * 0.5), -1, 1);
      const lag = b.card ? (Math.abs(col) * 0.07 + b.seed * 0.05) * vh : 0;
      const farY = vh * (1 + reach) + h2 - lag;
      const dockY = (b.card ? vh * 0.6 : vh * 0.42) - lag;

      if (!b.leaving && !moving) {
        // out of the window: nothing to draw, no style to hold
        if (top > farY - h2 + 60) {
          b.u = b.s = 0;
          b.q = 0;
          b.docking = false;
          clear(b);
          return false;
        }
        if (bottom < -vh * 0.3) {
          b.u = b.s = 1;
          b.q = 0;
          b.docking = false;
          clear(b);
          return false;
        }
      }

      // where it should be
      let want: number;
      if (b.leaving) want = 0;
      else if (now < b.hold) want = 0;
      else if (idle && top < vh * 0.985) want = 1;
      else if (dir > 0) want = Math.max(b.u, clamp((farY - yc) / (farY - dockY)));
      // Going up, one well on screen stays where it is, and the low ones start back.
      else want = Math.min(b.u, clamp((farY - yc) / (farY - (vh * 0.7 + h2 * 0.5))));
      if (want === 1 && b.u < 1 && idle) b.docking = true;
      b.u = want;
      if (b.s === 1) b.docking = false;
      const rate = b.leaving ? LEAVE : b.docking ? DOCK * (0.85 + b.seed * 0.3) : FOLLOW;
      b.s += (want - b.s) * (1 - Math.exp(-rate * dt));
      if (Math.abs(want - b.s) < 0.006) b.s = want;

      // over the camera on the way out of the top, and back the same way. A phone keeps
      // that layer for the cards still arriving.
      const wantQ = idle || !b.card || vw < 640 ? 0 : clamp(1 - bottom / (vh * 0.4));
      b.q += (wantQ - b.q) * (1 - Math.exp(-(idle ? DOCK : FOLLOW) * dt));
      if (Math.abs(wantQ - b.q) < 0.002) b.q = wantQ;

      // Once the page stops, what has not arrived is behind what has. It steps out of
      // sight, and gives its layer back, until the page moves again.
      const wantShow = idle && b.s < 1 && top >= vh * 0.985 && gridY - y < vh * 0.9 ? 0 : 1;
      b.show += (wantShow - b.show) * (1 - Math.exp(-(wantShow ? 12 : 5) * dt));
      if (Math.abs(wantShow - b.show) < 0.01) b.show = wantShow;

      // a filter's move
      let fxNow = 0;
      let fyNow = 0;
      let dipNow = 0;
      if (moving) {
        const t = (now - b.ft) / b.fms;
        if (t >= 1) b.ft = -1;
        else if (t > 0) {
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          fxNow = b.fx * (1 - e);
          fyNow = b.fy * (1 - e);
          dipNow = Math.sin(t * Math.PI);
        } else {
          fxNow = b.fx;
          fyNow = b.fy;
        }
      }

      const flat = b.s === 1 && b.q === 0 && b.show === 1 && b.ft < 0;
      if (flat) {
        // a card that has come in from far out marks the moment it locks into its lane
        if (b.fromFar) {
          b.fromFar = false;
          if (tilting) {
            const el = b.el;
            el.setAttribute("data-lit", "");
            setTimeout(() => el.removeAttribute("data-lit"), 420);
          }
        }
        clear(b);
        if (b.leaving) finishLeaving(b);
        return b.u !== b.s;
      }

      if (b.card && b.s < 0.72) b.fromFar = true;

      // ---- real perspective: the depth gives the scale, and the card sits on the line
      // from the star to its lane at that scale. Far out that line swings round the star,
      // so they arrive the way anything in this system moves: on a curve.
      const k = 1 - b.s;
      const sc0 = 1 / (1 + DEPTH * Math.pow(k, 2.2));
      const th = (b.card ? SWIRL * (0.8 + b.seed * 0.4) : SWIRL * 0.3) * k * k;
      const cos = Math.cos(th);
      const sin = Math.sin(th);
      const ox = (cx - vpX) * sc0;
      const oy = (myY - vpY) * sc0;
      const tx = vpX + ox * cos - oy * sin - cx + fxNow;
      const ty = vpY + ox * sin + oy * cos - myY + fyNow - b.q * 26;
      // it turns to face its lane as it comes in, and tips over the camera as it goes out
      const rx = (b.card ? 38 : 18) * Math.pow(k, 1.3) - b.q * 30 + dipNow * 3;
      const ry = -col * (b.card ? 34 : 8) * Math.pow(k, 1.2) - (fxNow / Math.max(1, vw)) * 26;
      const rz = b.card ? (b.seed - 0.5) * 22 * Math.pow(k, 1.5) + th * 16 : th * 8;
      const sc = sc0 * (1 + b.q * 0.08) * (1 - dipNow * 0.07);
      // words too small to read are not bodies: the title and the tools come in later
      const o = (b.card ? smooth(0, 0.17, b.s) : b.i === -2 ? smooth(0.1, 0.3, b.s) : smooth(0.3, 0.52, b.s)) * (1 - b.q * 0.6) * b.show;

      if (o < 0.004) {
        if (!b.gone) {
          b.el.style.visibility = "hidden";
          b.gone = true;
        }
        if (b.on) {
          b.el.style.willChange = "";
          b.on = false;
        }
        if (b.leaving && b.s < 0.03) finishLeaving(b);
        return b.u !== b.s || b.show !== wantShow;
      }
      if (b.gone) {
        b.el.style.visibility = "";
        b.gone = false;
      }
      if (!b.on) {
        b.el.style.willChange = "transform, opacity";
        b.on = true;
      }
      const far = b.s < 0.86;
      if (far !== b.far) {
        b.el.toggleAttribute("data-far", far);
        b.far = far;
      }
      const tf = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) perspective(${PERSPECTIVE}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      if (tf !== b.tf) {
        b.el.style.transform = tf;
        b.tf = tf;
      }
      const op = o.toFixed(3);
      if (op !== b.op) {
        b.el.style.opacity = op;
        b.op = op;
      }
      if (b.leaving && b.s < 0.03) finishLeaving(b);
      return b.s !== want || b.q !== wantQ || b.show !== wantShow || b.ft >= 0;
    };
    const finishLeaving = (b: Body) => {
      if (!b.leaving) return;
      b.leaving = false;
      b.el.hidden = true;
      b.el.style.position = "";
      b.el.style.left = "";
      b.el.style.top = "";
      b.el.style.width = "";
      b.el.style.height = "";
      clear(b);
      b.u = b.s = 0;
    };

    // ---- the pointer: a tilt that points at it, a light under it, a press that gives
    let hot: Body | null = null;
    let hotX = 0.5;
    let hotY = 0.5;
    let pressed = false;
    let movedAt = 0;
    const warmed = new Set<Body>();
    const tiltable = (b: Body | null) => !!b && b.s === 1 && !b.el.querySelector(".ac-more[open]");
    const warmStep = (now: number, dt: number) => {
      let busy = false;
      for (const b of warmed) {
        const live = b === hot && tiltable(b);
        // At rest under a still pointer it comes flat, so it can be read.
        const calm = now - movedAt > 800 ? 0 : 1;
        const tx = live ? (hotX - 0.5) * 14 * calm : 0;
        const ty = live ? (0.5 - hotY) * 10 * calm : 0;
        const tl = live ? (pressed ? 1.35 : 1) : 0;
        const r = 1 - Math.exp(-(live ? 13 : 7) * dt);
        b.hx += (tx - b.hx) * r;
        b.hy += (ty - b.hy) * r;
        b.hl += (tl - b.hl) * r;
        const done = !live && Math.abs(b.hx) < 0.01 && Math.abs(b.hy) < 0.01 && b.hl < 0.005;
        if (done) {
          warmed.delete(b);
          b.warm = false;
          b.hx = b.hy = b.hl = 0;
          if (b.face) {
            b.face.style.transform = "";
            b.face.style.willChange = "";
          }
          if (b.light) {
            b.light.style.opacity = "";
            b.light.style.transform = "";
            b.light.style.willChange = "";
          }
          b.faceTf = b.lightTf = b.lightOp = "";
          continue;
        }
        // the lift comes and goes with the tilt, so the words are sharp again at rest
        const lift = pressed && b === hot ? 0.985 : 1 + 0.002 * Math.min(8, Math.abs(b.hx) + Math.abs(b.hy));
        const flat = !(pressed && b === hot) && Math.abs(b.hx) + Math.abs(b.hy) < 0.02;
        const ftf = flat ? "none" : `perspective(${PERSPECTIVE}px) rotateX(${b.hy.toFixed(2)}deg) rotateY(${b.hx.toFixed(2)}deg) scale(${lift.toFixed(4)})`;
        if (b.face && ftf !== b.faceTf) {
          b.face.style.transform = ftf;
          b.faceTf = ftf;
        }
        if (b.light) {
          const ltf = `translate3d(${(hotX * b.w).toFixed(1)}px,${(hotY * b.h).toFixed(1)}px,0)`;
          if (b === hot && ltf !== b.lightTf) {
            b.light.style.transform = ltf;
            b.lightTf = ltf;
          }
          const lop = Math.min(1, b.hl * 0.82).toFixed(3);
          if (lop !== b.lightOp) {
            b.light.style.opacity = lop;
            b.lightOp = lop;
          }
        }
        if (!(live && Math.abs(tx - b.hx) + Math.abs(ty - b.hy) < 0.01 && Math.abs(tl - b.hl) < 0.004 && now - movedAt > 850)) busy = true;
      }
      return busy;
    };
    const setHot = (b: Body | null) => {
      if (b === hot) return;
      hot?.el.removeAttribute("data-hot");
      hot = b;
      if (!b) return;
      b.el.setAttribute("data-hot", "");
      if (!b.warm) {
        b.warm = true;
        warmed.add(b);
        if (b.face) b.face.style.willChange = "transform";
        if (b.light) b.light.style.willChange = "transform, opacity";
      }
      emit("projects:hover", { kind: "body", id: b.el.id, note: b.i });
    };

    function tick(now: number) {
      raf = 0;
      const y = yNow;
      const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
      lastT = now;
      const dy = y - lastY;
      // Scroll restored just after the page came in: nothing flies, it is simply there.
      if (now - mounted < 800 && Math.abs(dy) > vh * 0.5) {
        lastY = y;
        settleAll(y);
      } else if (Math.abs(dy) > 0.2) {
        // the page moving under the pointer ends the hover; the next move starts one
        if (hot) setHot(null);
        dir = dy > 0 ? 1 : -1;
        lastMove = now;
        lastY = y;
      }
      const idle = now - lastMove > IDLE_MS;

      // the point everything comes from: the star, or low in the middle until it is known
      const homeX = vw * 0.5;
      const homeY = vh * 0.76;
      const wantX = cardsBridge.x >= 0 ? clamp(cardsBridge.x, vw * 0.1, vw * 0.9) : homeX;
      const wantY = cardsBridge.x >= 0 ? clamp(cardsBridge.y, vh * 0.18, vh * 0.94) : homeY;
      if (vpX < 0) {
        vpX = wantX;
        vpY = wantY;
      } else {
        const r = 1 - Math.exp(-7 * dt);
        vpX += (wantX - vpX) * r;
        vpY += (wantY - vpY) * r;
      }

      let busy = !idle;
      for (const b of bodies) {
        if (b.el.hidden) continue;
        if (place(b, now, y, idle, dt)) busy = true;
      }
      if (warmed.size && warmStep(now, dt)) busy = true;
      if (busy) wake();
    }

    /** Everything goes straight to where it belongs, with no flight. */
    const settleAll = (y: number) => {
      for (const b of bodies) {
        if (b.el.hidden) continue;
        const top = b.y - y;
        const h2 = b.h / 2;
        const yc = top + h2;
        if (top < vh * 0.985) {
          b.u = b.s = 1;
          b.docking = false;
        } else {
          const farY = vh * (1 + reach) + h2;
          const dockY = vh * 0.6;
          b.u = b.s = clamp((farY - yc) / (farY - dockY));
        }
        b.q = 0;
        b.show = 1;
        clear(b);
      }
    };

    // ---- filter and search
    // No orphan on a short last row: at three across, one left over takes the
    // whole row and two left over share it.
    const tidy = () => {
      const shown = cards.filter((c) => !c.hidden && !byEl.get(c)!.leaving);
      cards.forEach((c) => c.classList.remove("is-w2", "is-w3", "is-w6"));
      const three = shown.length % 3;
      if (three === 1) shown[shown.length - 1]?.classList.add("is-w6");
      if (three === 2) shown.slice(-2).forEach((c) => c.classList.add("is-w3"));
      if (shown.length % 2 === 1) shown[shown.length - 1]?.classList.add("is-w2");
    };
    const matches = (c: HTMLElement) => {
      const q = input.value.trim().toLowerCase();
      const inGroup = filter === "all" || (filter === "live" ? c.dataset.live === "1" : c.dataset.group === filter);
      const hit = !q || q.split(/\s+/).every((w) => (c.dataset.q || "").includes(w));
      return inGroup && hit;
    };
    const apply = (animate = true) => {
      const y = (yNow = scrollY);
      const now = performance.now();
      const was = new Map<Body, { x: number; y: number; on: boolean }>();
      let n = 0;
      if (flying && animate) {
        for (const b of cardBodies) {
          if (b.el.hidden || b.leaving) continue;
          const t = b.ft >= 0 ? clamp((now - b.ft) / b.fms) : 1;
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          const px = b.x + b.fx * (1 - e) * (b.ft >= 0 ? 1 : 0);
          const py = b.y + b.fy * (1 - e) * (b.ft >= 0 ? 1 : 0);
          was.set(b, { x: px, y: py, on: py - y < vh && py + b.h - y > 0 });
        }
      }
      const entering: Body[] = [];
      for (const b of cardBodies) {
        const c = b.el;
        const on = matches(c);
        if (on) n++;
        if (on && (c.hidden || b.leaving)) {
          if (b.leaving) {
            b.leaving = false;
            c.style.position = c.style.left = c.style.top = c.style.width = c.style.height = "";
          }
          c.hidden = false;
          entering.push(b);
        } else if (!on && !c.hidden && !b.leaving) {
          const seen = flying && animate && b.y - y < vh && b.y + b.h - y > 0 && b.s > 0.02;
          if (seen) {
            // It stays on screen, out of the grid's flow, while it goes back to the star.
            b.leaving = true;
            c.style.left = `${c.offsetLeft}px`;
            c.style.top = `${c.offsetTop}px`;
            c.style.width = `${b.w}px`;
            c.style.height = `${b.h}px`;
            c.style.position = "absolute";
          } else {
            c.hidden = true;
            b.u = b.s = 0;
            clear(b);
          }
        }
      }
      count.textContent = String(n);
      none.hidden = n > 0;
      chips.forEach((ch) => ch.setAttribute("aria-pressed", ch.dataset.axF === filter ? "true" : "false"));
      tidy();
      if (!flying) {
        if (reduced && animate) entering.forEach((b) => b.el.animate({ opacity: [0, 1] }, { duration: 260, easing: "ease-out" }));
        return;
      }
      measure();
      if (!animate) return;
      // Those staying slide to their new lanes, dipping away from the reader as they go.
      // The ones that join come out of the distance, a wave at a time.
      let wave = 0;
      for (const b of entering) {
        const onScreen = b.y - y < vh && b.y + b.h - y > 0;
        if (onScreen) {
          b.u = 0;
          b.s = 0;
          b.show = 1;
          b.hold = now + 60 + wave * 34;
          wave++;
        }
      }
      was.forEach((p, b) => {
        if (b.el.hidden || b.leaving) return;
        const onNow = b.y - y < vh && b.y + b.h - y > 0;
        if (!p.on && !onNow) return;
        if (!p.on && onNow) {
          // from off screen to on it: more honest to come from the distance than from far below
          b.u = 0;
          b.s = 0;
          b.hold = now + 60 + wave * 34;
          wave++;
          return;
        }
        const dx = p.x - b.x;
        const dyy = p.y - b.y;
        if (Math.abs(dx) + Math.abs(dyy) < 1) return;
        b.fx = dx;
        b.fy = clamp(dyy, -vh * 1.1, vh * 1.1);
        b.ft = now + (b.seed * 50 + Math.min(120, Math.abs(dx) * 0.05));
        b.fms = 560 + b.seed * 120;
      });
      lastMove = now - IDLE_MS - 1;
      wake();
    };
    chips.forEach((b, i) =>
      b.addEventListener(
        "click",
        () => {
          filter = b.dataset.axF || "all";
          emit("projects:hover", { kind: "part", id: `filter:${filter}`, note: i });
          apply();
        },
        { signal },
      ),
    );
    input.addEventListener("input", () => apply(), { signal });
    root.querySelector("[data-ax-clear]")?.addEventListener(
      "click",
      () => {
        filter = "all";
        input.value = "";
        apply();
      },
      { signal },
    );

    // ---- the words a card opens, for the score
    root.addEventListener(
      "click",
      (e) => {
        const t = e.target as Element;
        const summary = t.closest?.("summary");
        const link = t.closest?.("a");
        if (t.closest?.("[data-ax-demos]")) emit("projects:open", { id: "demos" });
        else if ((link || (summary && !summary.parentElement?.hasAttribute("open"))) && t.closest?.(".ac")) emit("projects:open", { id: t.closest(".ac")!.id });
      },
      { signal },
    );

    // old links: #academic and friends set the filter; a project's own id opens its card
    const goTo = (el: HTMLElement, by: number) => {
      let top = 0;
      for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) top += e.offsetTop;
      scrollTo({ top: top - by, ...inst });
    };
    const readHash = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (!h) return;
      if (h === "more") filter = "industry";
      else if (chips.some((b) => b.dataset.axF === h)) filter = h;
      else {
        const card = cards.find((c) => c.id === h);
        if (card) {
          filter = "all";
          input.value = "";
          apply(false);
          card.querySelector("details")?.setAttribute("open", "");
          measure();
          goTo(card, 96);
        }
        return;
      }
      apply(false);
      goTo(root, 0);
    };
    addEventListener("hashchange", readHash, { signal });

    apply(false);
    readHash();
    if (!flying) return;

    // ---- the pointer
    measure();
    yNow = lastY = scrollY;
    settleAll(yNow);
    if (tilting) {
      grid.addEventListener(
        "pointermove",
        (e) => {
          if (e.pointerType !== "mouse") return;
          const el = (e.target as Element).closest?.(".ac");
          const b = el ? byEl.get(el) ?? null : null;
          if (!tiltable(b)) {
            setHot(null);
            wake();
            return;
          }
          setHot(b);
          hotX = clamp((e.clientX - b!.x) / b!.w);
          hotY = clamp((e.clientY - (b!.y - yNow)) / b!.h);
          movedAt = performance.now();
          wake();
        },
        { passive: true, signal },
      );
      grid.addEventListener(
        "pointerleave",
        () => {
          setHot(null);
          pressed = false;
          wake();
        },
        { signal },
      );
      grid.addEventListener(
        "pointerdown",
        (e) => {
          if (e.pointerType !== "mouse" || e.button !== 0) return;
          pressed = true;
          movedAt = performance.now();
          wake();
        },
        { passive: true, signal },
      );
      addEventListener(
        "pointerup",
        () => {
          if (!pressed) return;
          pressed = false;
          movedAt = performance.now();
          wake();
        },
        { passive: true, signal },
      );
    }

    // ---- keyboard: the browser scrolls by where a card looks, so a card in flight must
    // first come home, and the page goes to it if home is off screen
    grid.addEventListener(
      "focusin",
      (e) => {
        const el = e.target as HTMLElement;
        if (!el.matches?.(":focus-visible")) return;
        const b = byEl.get(el.closest(".ac") as Element);
        if (!b) return;
        const top = b.y - yNow;
        if (top < 72 || top + Math.min(b.h, vh * 0.6) > vh) goTo(b.el, 96);
        b.u = b.s = 1;
        b.q = 0;
        b.docking = false;
        b.fromFar = false;
        clear(b);
        emit("projects:hover", { kind: "body", id: b.el.id, note: b.i });
      },
      { signal },
    );

    // ---- what wakes it
    let near = false;
    const onScroll = () => {
      // through the flight the cards are far away, and this costs nothing
      const was = near;
      yNow = scrollY;
      near = yNow + vh * (2 + reach) >= first;
      // one last frame on the way out, to let go of what was still moving
      if (near || was) wake();
    };
    addEventListener("scroll", onScroll, { passive: true, signal });
    let sizedW = innerWidth;
    addEventListener(
      "resize",
      () => {
        // a phone's toolbar coming and going is not a new layout
        if (coarse && innerWidth === sizedW) return;
        sizedW = innerWidth;
        measure();
        wake();
      },
      { passive: true, signal },
    );
    const ro = new ResizeObserver(() => {
      measure();
      wake();
    });
    ro.observe(grid);
    wake();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      hot = null;
      warmed.clear();
    };
  });
}
