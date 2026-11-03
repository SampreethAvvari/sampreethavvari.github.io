// The visitor: everything the score hears from the pointer, the finger, the
// wheel and the page. It loads with the suite and listens only while sound is
// on, so with sound off the site has no listeners at all from here.
//
// A shared layer runs on every page through delegation on the document. Hovering
// any link or button plays a round note in the current chord; pressing anything
// lands a low thump; scrolling leans on the floor; the pointer bends its filter.
// A phone gets the same from touch start, drag, lift and scroll. Page events add
// their own moments on top. All of it follows the chord and is rate limited.
//
// Every listener is passive, and nothing here reads layout except one rectangle
// when a key activates a control.
import { hashStr } from "./dsp";
import type { Movement } from "./movement";
import type { Studio } from "./studio";

export interface Flight {
  chapter: number;
  p: number;
  v: number;
  seen: boolean;
  t: number;
  count: number;
}

export interface Host {
  movement(): Movement | null;
  id(): string;
  studio(): Studio | null;
  running(): boolean;
  flight: Flight;
  counts: { hover: number; click: number; sky: number; page: number };
}

type Detail = Record<string, unknown>;

const INTERACTIVE = "a, button, [role=button], summary, label, input, select, textarea";
const HOVERS = "a, button, [role=button], summary, .journey-rail, [data-sound-hover], iframe, input, select, textarea, label";
// Not controls, but worth a very soft note under the pointer.
const BRUSH = "figure, img, video, pre, table, blockquote, h1, h2, h3";
// Elements that announce their own hover with a page event, so the generic tap
// would only double them: the writing sky, the post rail, sky and figures, the
// resume's sheets, sections, keys and chips, the parts on the star system, the
// cards, chips, doors and shelf on the ring station, the demos' index, the
// teaching cards and chapter stars.
const OWN_HOVER = ".ax-s, .ax-slot, .ax-c, .pw-c, .ww-card, .ww-chip, .ww-door, .ww-shelf a, #post-toc a, .pfx-sky-star, .pfx-day-star, .pfx-zp-run, [data-rw] [data-cell], [data-rw] [data-section], [data-rw] [data-jump], [data-rw] [data-key], [data-rw] [data-group], .rl-index a, .tb-card, .tr-star";
// A click that plays its own sound in place of the generic tap.
const OWN_CLICK = "[data-rw] [data-cell]";

/** Page events that go straight to the movement written for that page. */
const FORWARD: Record<string, string> = {
  "mind:fly": "mind", "mind:depth": "mind", "mind:focus": "mind", "mind:hover": "mind", "mind:filter": "mind",
  "teaching:section": "teaching", "teaching:hover": "teaching", "teaching:page": "teaching",
  "demos:section": "demos", "demos:hover": "demos", "demos:step": "demos",
  "film:cut": "film",
};

export class Touch {
  px = 0.5;
  py = 0.5;
  private pt = 0;
  private speed = 0;
  private lastM = 0;
  private yawNow = 0;
  private lastY = 0;
  private vS = 0;
  private lastFrame = 0;
  private raf = 0;
  private lastHover = 0;
  private linkWait = 0;
  private moving = false;
  private touchX = -1;
  private touchY = -1;
  private touchT = 0;
  private flyAt = 0;
  private ctrl: AbortController | null = null;

  constructor(private h: Host) {}

  private get live(): Movement | null {
    return this.h.running() ? this.h.movement() : null;
  }
  private get deep() {
    return this.h.studio()?.deep ?? null;
  }

  attach() {
    if (this.ctrl) return;
    this.ctrl = new AbortController();
    const signal = this.ctrl.signal;
    const o = { passive: true, signal };
    this.lastY = scrollY;
    addEventListener("pointermove", (e) => this.onMove(e), o);
    addEventListener("pointerdown", (e) => this.onDown(e), o);
    addEventListener("pointerup", (e) => this.onUp(e), o);
    addEventListener("pointerover", (e) => this.onOver(e), o);
    addEventListener("touchmove", (e) => this.onTouchMove(e), o);
    addEventListener("touchend", () => { this.touchX = -1; }, o);
    addEventListener("scroll", () => this.kick(), o);
    addEventListener("blur", () => this.onBlur(), o);
    document.addEventListener("click", (e) => this.onKeyClick(e), o);
    document.addEventListener("focusin", (e) => this.onFocus(e), o);
    for (const name in FORWARD) {
      addEventListener(name, (e) => {
        const d = (e as CustomEvent).detail;
        if (d) this.forward(name, d);
      }, o);
    }
    const on = (name: string, f: (d: Detail) => void) =>
      addEventListener(name, (e) => {
        const d = (e as CustomEvent).detail;
        if (d) f(d);
      }, o);
    on("journey:interact", (d) => this.journeyTouch(d));
    on("journey:progress", () => this.kick());
    on("work:spin", (d) => this.lean(Math.min(1, Math.abs(Number(d.velocity) || 0) / 1.4), Number(d.velocity) >= 0 ? 1 : -1));
    on("work:hover", () => this.body(0.7));
    on("projects:hover", () => this.body(0.7));
    on("resume:hover", () => this.body(0.6));
    on("writing:hover", () => this.body(0.6));
    on("post:hover", () => this.body(0.5));
    on("projects:open", () => { this.deep && this.deep.press(0.8, this.px, this.py); });
    on("writing:hero", () => {
      const t = this.now();
      if (t >= 0) this.deep?.hit(t + 0.02, 0.09, { from: 1.4, sweep: 0.3, dur: 1.2 });
    });
    on("writing:transition", (d) => {
      if (d.kind === "dive") return this.move(0.9, d.direction === "in" ? 1 : -1, 0.8);
      return this.move(Number(d.duration) / 1000 || 1, d.direction === "back" ? -1 : 1, 0.65);
    });
    on("writing:constellation", (d) => {
      if (d.action === "hover") this.body(0.7);
    });
    on("post:transition", (d) => this.move(0.78, d.direction === "in" ? -1 : 1, 0.6));
    on("post:section", () => {
      const t = this.now();
      if (t >= 0) this.deep?.hit(t + 0.01, 0.05, { oct: 1, from: 1.4, dur: 0.25 });
    });
    on("post:figure", () => this.deep?.press(0.42, this.px, this.py));
    on("resume:transition", (d) => this.move(Number(d.duration) || 1, Number(d.direction) >= 0 ? 1 : -1, 0.7));
    on("resume:sheet", (d) => {
      if (d.action === "pick") this.deep?.press(0.7, this.px, this.py);
      else if (d.action === "flip") this.deep?.press(0.45, this.px, this.py);
    });
    on("architecture:focus", (d) => {
      if (d.slug) this.deep?.press(0.75, this.px, this.py);
    });
    on("architecture:flow", (d) => {
      const t = this.now();
      const i = Number(d.intensity) || 0;
      if (t >= 0) this.deep?.leanOn({ growl: 8 * i, rumble: 9 * i, cut: 1 + 1.6 * i }, t, 0.4);
    });
  }

  detach() {
    this.ctrl?.abort();
    this.ctrl = null;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.linkWait);
    this.moving = false;
    this.vS = 0;
    this.speed = 0;
  }

  /** A new page came in. */
  swapped() {
    this.lastY = scrollY;
    this.vS = 0;
    clearTimeout(this.linkWait);
  }

  /** A post's link spoke for itself, so the waiting tap is not needed. */
  spoke() {
    clearTimeout(this.linkWait);
  }

  private now(): number {
    const s = this.h.studio();
    return s && this.h.running() ? s.ac.currentTime : -1;
  }

  /** The current movement's own moment, and what the floor does with it. */
  private forward(name: string, d: Detail) {
    const m = this.live;
    if (!m) return;
    const own = FORWARD[name] === this.h.id();
    if (name === "mind:fly") {
      const i = this.fly(Number(d.speed) || 0);
      if (own) m.pageEvent(name, { ...d, i }, this.px);
      return;
    }
    // the map sends nulls when the pointer or the card leaves a star
    if (name.startsWith("mind:") && "id" in d && d.id == null) return;
    if (own) m.pageEvent(name, d, this.px);
    if (name.endsWith(":hover")) this.body(name === "mind:hover" ? 0.28 : 0.7, d.id);
  }

  /** Flying is that page's scroll: speed 0..1, and 0 when it stops. */
  private fly(speed: number): number {
    const a = Math.min(1, Math.abs(speed));
    const i = a < 0.002 ? 0 : Math.pow(a, 0.8);
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0.005, (now - this.flyAt) / 1000));
    this.flyAt = now;
    if (i === 0) this.deep?.rest();
    else this.deep?.motion(i, 1, 0, dt);
    return i;
  }

  /** Something leaning on the floor that is not a real scroll: a ring turned by hand. */
  private lean(i: number, dir: number) {
    if (i < 0.01) this.deep?.rest();
    else this.deep?.motion(i, dir, 0, 0.05);
  }

  /** A note with body, under a hover the page announced itself. */
  private body(amt: number, id?: unknown) {
    if (!this.live) return;
    const pick = id ? (hashStr(String(id)) % 97) / 97 : this.px;
    this.deep?.hover(this.px, this.py, amt, pick);
  }

  /** A move between places on the page: quiet, something going past, then the low end lands. */
  private move(D: number, dir: number, size: number) {
    const s = this.h.studio();
    const t = this.now();
    if (!s || t < 0 || !this.live) return;
    const d = Math.max(0.3, Math.min(4, D));
    s.deep.swoop(t + 0.01, d, dir >= 0, size);
    s.deep.impact(t + 0.01 + d, size);
    s.pass(dir, Math.max(0.5, d), s.deep.where.pass, s.deep.note, size);
  }

  /** The people on the planet, and anything else the home scenes let you touch. */
  private journeyTouch(d: Detail) {
    const m = this.live;
    const deep = this.deep;
    if (!m || !deep) return;
    const x = (Number(d.x) + 1) / 2 || 0.5, y = 1 - ((Number(d.y) + 1) / 2 || 0.5);
    const a = Math.max(0, Math.min(1, Number(d.strength) || 0));
    const pick = d.id ? (hashStr(String(d.id)) % 97) / 97 : x;
    switch (d.kind) {
      case "hover":
        m.hover(x, y);
        deep.hover(x, y, 0.5 + 0.5 * a, pick);
        break;
      case "press":
        m.click(x, y);
        deep.press(0.5 + 0.5 * a, x, y);
        break;
      case "drag":
        deep.drag(a, x, y);
        break;
      case "release":
        deep.release(0.4 + 0.6 * a);
        deep.pointer(0, x, y);
        break;
    }
  }

  // ---- scroll and pointer, one frame at a time, only while something moves -----
  private kick() {
    if (!this.raf && this.live) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame((n) => this.frame(n));
    }
  }

  private frame(now: number) {
    this.raf = 0;
    const m = this.live;
    if (!m) return;
    const f = this.h.flight, id = this.h.id();
    const dt = Math.min(0.1, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    const h = Math.max(1, innerHeight);

    // scroll: speed in screens per second, smoothed; jumps (anchors, a new page) ignored
    const y = scrollY;
    let dy = (y - this.lastY) / h;
    this.lastY = y;
    if (Math.abs(dy) > 1.2) dy = 0;
    this.vS = this.vS * 0.8 + (dy / dt) * 0.2;
    if (Math.abs(this.vS) < 0.01) this.vS = 0;
    const intensity = 1 - Math.exp(-Math.abs(this.vS) / 2.2);
    const span = Math.max(1, document.documentElement.scrollHeight - h);
    const pageP = Math.min(1, Math.max(0, y / span));
    if (intensity > 0.003 || dy !== 0) m.scroll(intensity, this.vS >= 0 ? 1 : -1, pageP, dy, dt);
    // home without the journey's own events: the page position is the flight
    if (id === "home" && !f.seen) {
      const p = pageP * (f.count - 1);
      m.journey(p, this.vS * (f.count - 1) * (h / span));
      const c = Math.round(p);
      if (c !== f.chapter) {
        f.chapter = c;
        m.chapter(c);
      }
    }

    // the flight stopped: let the scroll swell fall quiet
    if (id === "home" && f.seen && f.v !== 0 && now - f.t > 160) {
      f.v = 0;
      m.journey(f.p, 0);
    }

    // the floor: a scroll, or the flight's own speed, leans on it
    const flightI = id === "home" && f.seen ? 1 - Math.exp(-Math.abs(f.v) / 0.7) : 0;
    const push = Math.max(intensity, flightI);
    const deep = this.deep;
    if (push > 0.003) {
      deep?.motion(push, this.vS >= 0 ? 1 : -1, dy, dt);
      this.moving = true;
    } else if (this.moving) {
      this.moving = false;
      deep?.rest();
    }

    // pointer: speed opens the sound, height tilts it, x turns the listener's head
    this.speed *= Math.pow(0.04, dt);
    const pm = Math.min(1, this.speed / 1.8);
    if (Math.abs(pm - this.lastM) > 0.004 || (pm === 0 && this.lastM !== 0)) {
      this.lastM = pm < 0.004 ? 0 : pm;
      m.pointer(this.lastM, this.px, this.py);
      deep?.pointer(this.lastM, this.px, this.py);
    }
    const yaw = (this.px - 0.5) * 0.6;
    this.yawNow += (yaw - this.yawNow) * Math.min(1, dt * 4);
    this.h.studio()?.yaw(this.yawNow);

    if (intensity > 0.003 || this.moving || this.lastM > 0 || Math.abs(yaw - this.yawNow) > 0.003) {
      this.raf = requestAnimationFrame((n) => this.frame(n));
    }
  }

  private onMove(e: PointerEvent) {
    const t = performance.now();
    const x = e.clientX / Math.max(1, innerWidth), y = e.clientY / Math.max(1, innerHeight);
    if (this.pt) {
      const v = Math.hypot((x - this.px) * innerWidth, (y - this.py) * innerHeight) / Math.max(8, t - this.pt);
      this.speed = this.speed * 0.7 + v * 0.3;
    }
    this.px = x;
    this.py = y;
    this.pt = t;
    this.kick();
  }

  /** A finger: the browser stops sending pointer moves once it scrolls, so read the touch. */
  private onTouchMove(e: TouchEvent) {
    const p = e.touches[0];
    if (!p) return;
    const t = performance.now();
    const x = p.clientX / Math.max(1, innerWidth), y = p.clientY / Math.max(1, innerHeight);
    if (this.touchX >= 0) {
      const v = Math.hypot((x - this.touchX) * innerWidth, (y - this.touchY) * innerHeight) / Math.max(8, t - this.touchT);
      this.speed = this.speed * 0.7 + v * 0.3;
    }
    this.touchX = this.px = x;
    this.touchY = this.py = y;
    this.touchT = t;
    this.kick();
  }

  private onDown(e: PointerEvent) {
    const m = this.live;
    if (!m) return;
    const x = e.clientX / Math.max(1, innerWidth), y = e.clientY / Math.max(1, innerHeight);
    const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
    if (el && !el.closest(OWN_CLICK)) {
      this.h.counts.click++;
      m.click(x, y);
    }
    // a press lands wherever it is, a control a little harder
    this.deep?.press(el ? 1 : 0.55, x, y);
    // no hover on a finger: the note comes with the touch
    if (el && e.pointerType !== "mouse") this.deep?.hover(x, y, 0.8);
  }

  private onUp(e: PointerEvent) {
    if (!this.live) return;
    if (e.pointerType !== "mouse" || (e.target as Element | null)?.closest?.(INTERACTIVE)) this.deep?.release(0.6);
  }

  private onKeyClick(e: MouseEvent) {
    // keyboard activation (Enter or Space) arrives as a click with no detail
    const m = this.live;
    if (!m || e.detail !== 0) return;
    const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (r.left + r.width / 2) / Math.max(1, innerWidth), y = (r.top + r.height / 2) / Math.max(1, innerHeight);
    m.click(x, y);
    this.deep?.press(0.9, x, y);
  }

  /** Tabbing through a page plays the same note as a hover. */
  private onFocus(e: FocusEvent) {
    const el = e.target as Element | null;
    if (!this.live || !el?.matches?.(":focus-visible") || !el.matches(INTERACTIVE)) return;
    this.deep?.hover(this.px, this.py, 0.7, (hashStr(el.tagName + (el.textContent || "").slice(0, 24)) % 97) / 97);
  }

  /** Clicking into an embedded app: the page never sees the press, only that it lost focus. */
  private onBlur() {
    if (this.live && document.activeElement?.tagName === "IFRAME") this.deep?.press(0.6, this.px, this.py);
  }

  private onOver(e: PointerEvent) {
    // a button held down is a drag: passing over a link on the way is not a hover
    const m = this.live;
    if (!m || e.pointerType !== "mouse" || e.buttons) return;
    // things sliding under a still pointer during a scroll are not a hover either
    if (Math.abs(this.vS) > 0.7) return;
    const target = e.target as Element | null;
    const x = e.clientX / Math.max(1, innerWidth), y = e.clientY / Math.max(1, innerHeight);
    const el = target?.closest?.(HOVERS);
    if (!el) {
      const b = target?.closest?.(BRUSH);
      if (b && !(e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) this.deep?.brush(x, y);
      return;
    }
    if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
    const own = !!el.closest(OWN_HOVER);
    // the page's own note plays over this one; here it only gets the body under it
    if (own) return;
    const t = performance.now();
    if (t - this.lastHover < 110) return;
    this.lastHover = t;
    // A post's internal link may show a card and speak for itself about 110 ms
    // later, and only some have one, so wait to see before tapping.
    clearTimeout(this.linkWait);
    if (el.matches("a[href^='/']") && el.closest("#post-prose-body")) {
      this.linkWait = window.setTimeout(() => {
        if (el.matches(":hover")) {
          this.h.counts.hover++;
          this.live?.hover(x, y);
          this.deep?.hover(x, y);
        }
      }, 150);
      return;
    }
    this.h.counts.hover++;
    m.hover(x, y);
    this.deep?.hover(x, y);
  }
}
