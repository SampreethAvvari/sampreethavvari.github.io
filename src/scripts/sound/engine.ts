// Site sound: a suite in eight movements, one per tab, synthesised in the
// browser (no audio files). Off until the visitor turns it on: the loading
// screen asks once per visit, the nav toggle changes it any time.
//
// The page talks to it through window events, so the loader and the React
// nav need no import:
//   sound:set        detail boolean        turn sound on or off (from a click)
//   sound:state      detail { on }         sent whenever that changes
//   journey:chapter  detail { index, id }  the home flight changed chapter
//   journey:progress detail { progress, velocity }
//   journey:words    detail { words, items, wordStagger, itemStagger, delay }
//   journey:jump     detail { from, to, direction, duration }  a jump between worlds starts
//   journey:ending   detail { scene, progress, beat }  a scene on the planet: exit, helmet, touch
//   writing:hero     detail { index, slug, accent } an article hero takes the screen
//   writing:transition detail { from, to, duration }
//   writing:hover    detail { slug }
//   architecture:focus detail { slug, title, discipline }   a system in focus
//   architecture:flow  detail { intensity }                  its traffic, 0..1
//   sound:duck       detail { amount, reason }  a clip with its own sound plays
//   astro:after-swap (document)            a new page is in: crossfade to its movement
//
// This file stays small: the instruments and movements load on first use.
import { movementFor } from "./ids";
import type { Movement, Studio } from "./suite";

type Suite = typeof import("./suite");

const PREF = "sound";
const ON = 0.7; // master level when on (about -3 dB): the score sits under the page
const phone =
  typeof matchMedia === "function" &&
  (matchMedia("(max-width: 767px), (pointer: coarse)").matches || ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) < 4);

let mounted = false;
let on = false;
let ctx: AudioContext | null = null;
let suite: Suite | null = null;
let suiteP: Promise<Suite> | null = null;
let studio: Studio | null = null;
let current: Movement | null = null;
let currentId = "";
const leaving: { m: Movement; until: number }[] = [];
let ticker = 0;

// the home flight, remembered so a movement built later can catch up
let jChapter = 0;
let jP = 0;
let jV = 0;
let journeySeen = false;
let jCount = 9;
let wordsTimer = 0;
// the architecture page and film clips, also remembered
let archFocus: { slug: string; title?: string; discipline?: string } | null = null;
let archFlow = 0;
let duckAmount = 0;

const loadSuite = () => (suiteP ??= import("./suite").then((s) => (suite = s)));
const pageId = () => movementFor(document.body?.dataset.tone, location.pathname);

function readPref(): boolean {
  try { return localStorage.getItem(PREF) === "on"; } catch { return false; }
}
function writePref(v: boolean) {
  try { localStorage.setItem(PREF, v ? "on" : "off"); } catch { /* private mode */ }
}
function announce() {
  document.documentElement.dataset.sound = on ? "on" : "off";
  window.dispatchEvent(new CustomEvent("sound:state", { detail: { on } }));
}

// ---- the audio context and the movements -------------------------------------

/** Must run inside a click or key press the first time. */
function ensureContext(): boolean {
  if (ctx) return true;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC({ latencyHint: "balanced" });
  } catch {
    return false;
  }
  return true;
}

async function boot() {
  await loadSuite();
  if (!ctx || !suite) return;
  if (!studio) {
    studio = new suite.Studio(ctx, phone);
    if (duckAmount) studio.duck(duckAmount);
  }
  if (on && !current) play(pageId(), false);
}

/** Start a page's movement; with handover, the one playing hands over to it. */
function play(id: string, handover: boolean) {
  if (!ctx || !suite || !studio) return;
  const t = ctx.currentTime + 0.06;
  const m = suite.createMovement(id, studio);
  const from = handover && current ? current : null;
  if (from) {
    m.start(t, 3, from.voicing);
    from.release(t, 3.2, m.chord);
    from.hush();
    leaving.push({ m: from, until: performance.now() + 6500 });
    // a third quick move: the oldest goes now
    while (leaving.length > 2) leaving.shift()!.m.dispose();
  } else {
    current?.dispose();
    m.start(t, 2.5, null);
  }
  current = m;
  currentId = id;
  if (id === "home") {
    m.chapter(jChapter);
    m.journey(jP, 0);
  }
  if (id === "architecture") {
    if (archFocus) m.focus(archFocus);
    if (archFlow) m.flow(archFlow);
  }
  if (!ticker) ticker = window.setInterval(tick, 50);
}

/** The conductor: schedule a little ahead on the audio clock. */
function tick() {
  if (!ctx || ctx.state !== "running") return;
  const until = ctx.currentTime + 0.32;
  current?.tick(until);
  const now = performance.now();
  for (let i = leaving.length - 1; i >= 0; i--) {
    const l = leaving[i];
    if (now > l.until) {
      l.m.dispose();
      leaving.splice(i, 1);
    } else l.m.tick(until);
  }
}

function start(seconds: number) {
  if (!ensureContext()) return;
  const c = ctx!;
  const go = () => boot().then(() => studio?.fade(ON, seconds));
  if (c.state !== "running") c.resume().then(go, () => {});
  else go();
}

function stop() {
  studio?.fade(0, 0.6);
  setTimeout(() => { if (!on && ctx) ctx.suspend().catch(() => {}); }, 700);
}

export function setSound(v: boolean) {
  on = v;
  writePref(v);
  if (v) start(2.5);
  else stop();
  announce();
}

// ---- the visitor ---------------------------------------------------------------

let px = 0.5, py = 0.5, pt = 0, speed = 0, lastM = 0, yawNow = 0;
let lastY = 0, vS = 0, lastFrame = 0, raf = 0, lastHover = 0;

function kick() {
  if (!raf && on && current) {
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

/** One frame of pointer and scroll, only while something is moving. */
function frame(now: number) {
  raf = 0;
  if (!on || !current || !ctx || ctx.state !== "running") return;
  const dt = Math.min(0.1, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  const h = Math.max(1, innerHeight);

  // scroll: speed in screens per second, smoothed; jumps (anchors, a new page) ignored
  const y = scrollY;
  let dy = (y - lastY) / h;
  lastY = y;
  if (Math.abs(dy) > 1.2) dy = 0;
  vS = vS * 0.8 + (dy / dt) * 0.2;
  if (Math.abs(vS) < 0.01) vS = 0;
  const intensity = 1 - Math.exp(-Math.abs(vS) / 2.2);
  const span = Math.max(1, document.documentElement.scrollHeight - h);
  const pageP = Math.min(1, Math.max(0, y / span));
  if (intensity > 0.003 || dy !== 0) current.scroll(intensity, vS >= 0 ? 1 : -1, pageP, dy, dt);
  // home without the journey's own events: the page position is the flight
  if (currentId === "home" && !journeySeen) {
    const p = pageP * (jCount - 1);
    current.journey(p, vS * (jCount - 1) * (h / span));
    const c = Math.round(p);
    if (c !== jChapter) {
      jChapter = c;
      current.chapter(c);
    }
  }

  // pointer: speed opens the sound, height tilts it, x turns the listener's head
  speed *= Math.pow(0.04, dt);
  const m = Math.min(1, speed / 1.8);
  if (Math.abs(m - lastM) > 0.004 || (m === 0 && lastM !== 0)) {
    lastM = m < 0.004 ? 0 : m;
    current.pointer(lastM, px, py);
  }
  const yaw = (px - 0.5) * 0.6;
  yawNow += (yaw - yawNow) * Math.min(1, dt * 4);
  studio?.yaw(yawNow);

  if (intensity > 0.003 || lastM > 0 || Math.abs(yaw - yawNow) > 0.003) raf = requestAnimationFrame(frame);
}

function onMove(e: PointerEvent) {
  const t = performance.now();
  const x = e.clientX / Math.max(1, innerWidth), y = e.clientY / Math.max(1, innerHeight);
  if (pt) {
    const v = Math.hypot((x - px) * innerWidth, (y - py) * innerHeight) / Math.max(8, t - pt);
    speed = speed * 0.7 + v * 0.3;
  }
  px = x;
  py = y;
  pt = t;
  kick();
}

const INTERACTIVE = "a, button, [role=button], summary, label, input, select, textarea";

function onDown(e: PointerEvent) {
  if (!on || !current) return;
  const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
  if (el) current.click(e.clientX / Math.max(1, innerWidth), e.clientY / Math.max(1, innerHeight));
}
function onKeyClick(e: MouseEvent) {
  // keyboard activation (Enter or Space) arrives as a click with no detail
  if (!on || !current || e.detail !== 0) return;
  const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
  if (!el) return;
  const r = el.getBoundingClientRect();
  current.click((r.left + r.width / 2) / Math.max(1, innerWidth), (r.top + r.height / 2) / Math.max(1, innerHeight));
}
function onOver(e: PointerEvent) {
  if (!on || !current || e.pointerType !== "mouse") return;
  const el = (e.target as Element | null)?.closest?.("a, button, [role=button], summary");
  if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
  const t = performance.now();
  if (t - lastHover < 110) return;
  lastHover = t;
  current.hover(e.clientX / Math.max(1, innerWidth), e.clientY / Math.max(1, innerHeight));
}

// ---- mount -------------------------------------------------------------------

export function mountSound() {
  if (mounted) return;
  mounted = true;
  // for local testing only; Vite drops this from production builds
  if (import.meta.env.DEV) {
    (window as unknown as { __sound: unknown }).__sound = {
      state: () => ({ ctx: ctx?.state ?? null, on, current: currentId, leaving: leaving.length, chapter: jChapter }),
    };
  }
  on = readPref();
  announce();
  lastY = scrollY;
  window.addEventListener("sound:set", (e) => setSound(!!(e as CustomEvent).detail));

  // A choice remembered from an earlier visit: browsers only let sound start
  // from a tap or a key, so wait for the first one. The suite loads now.
  if (on) {
    loadSuite();
    const kinds = ["pointerdown", "keydown", "touchend"];
    const wake = () => {
      if (!on) return kinds.forEach((k) => removeEventListener(k, wake, true));
      if (!ensureContext()) return;
      ctx!.resume().then(() => {
        if (ctx!.state === "running") {
          kinds.forEach((k) => removeEventListener(k, wake, true));
          boot().then(() => studio?.fade(ON, 2.5));
        }
      }, () => {});
    };
    kinds.forEach((k) => addEventListener(k, wake, true));
  }

  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerdown", onDown, { passive: true });
  addEventListener("pointerover", onOver, { passive: true });
  document.addEventListener("click", onKeyClick);
  addEventListener("scroll", kick, { passive: true });

  // the home flight
  addEventListener("journey:chapter", (e) => {
    const d = (e as CustomEvent).detail || {};
    jChapter = Number(d.index) || 0;
    if (currentId === "home") current?.chapter(jChapter);
  });
  addEventListener("journey:progress", (e) => {
    const d = (e as CustomEvent).detail || {};
    journeySeen = true;
    if (Number(d.count) > 1) jCount = Number(d.count);
    jP = Number(d.progress) || 0;
    jV = Number(d.velocity) || 0;
    if (currentId === "home") current?.journey(jP, jV);
  });
  addEventListener("journey:jump", (e) => {
    const d = (e as CustomEvent).detail || {};
    if (currentId !== "home" || !current) return;
    const to = Number(d.to);
    if (!Number.isFinite(to)) return;
    jChapter = to;
    current.jump(Number(d.from) || 0, to, Number(d.direction) || 1, jV, Number(d.duration) / 1000 || 1.4);
  });
  addEventListener("journey:ending", (e) => {
    const d = (e as CustomEvent).detail || {};
    if (currentId === "home") current?.ending(Number(d.progress) || 0, Number(d.beat) || 0, typeof d.scene === "string" ? d.scene : undefined);
  });
  // the writing tab's heroes
  addEventListener("writing:hero", (e) => {
    const d = (e as CustomEvent).detail;
    if (d?.slug && currentId === "writing") current?.heroFocus(d);
  });
  addEventListener("writing:transition", (e) => {
    const d = (e as CustomEvent).detail;
    if (d && currentId === "writing") current?.heroTransition(d);
  });
  addEventListener("writing:hover", (e) => {
    const d = (e as CustomEvent).detail;
    if (!d?.slug || currentId !== "writing" || !on) return;
    const t = performance.now();
    if (t - lastHover < 120) return;
    lastHover = t;
    current?.cardHover(String(d.slug));
  });
  addEventListener("journey:words", (e) => {
    const d = (e as CustomEvent).detail;
    if (!d || currentId !== "home" || !current) return;
    clearTimeout(wordsTimer);
    current.hush();
    // only the chapter the visitor settles on speaks: when they are flying
    // through, wait a moment and speak only if nothing newer came
    if (Math.abs(jV) < 0.9) current.words(d, 0);
    else wordsTimer = window.setTimeout(() => currentId === "home" && current?.words(d, 0.25), 250);
  });

  // the architecture observatory
  addEventListener("architecture:focus", (e) => {
    const d = (e as CustomEvent).detail;
    archFocus = d && d.slug ? d : null;
    if (currentId === "architecture") current?.focus(archFocus);
  });
  addEventListener("architecture:flow", (e) => {
    archFlow = Number((e as CustomEvent).detail?.intensity) || 0;
    if (currentId === "architecture") current?.flow(archFlow);
  });
  // a film clip with its own sound: step back, then return
  addEventListener("sound:duck", (e) => {
    duckAmount = Number((e as CustomEvent).detail?.amount) || 0;
    studio?.duck(duckAmount);
  });

  // a new page came in without a reload: hand over to its movement
  document.addEventListener("astro:after-swap", () => {
    announce(); // the swap resets attributes on <html>
    lastY = scrollY;
    vS = 0;
    journeySeen = false;
    clearTimeout(wordsTimer);
    const id = pageId();
    if (id !== "home") { jChapter = 0; jP = 0; }
    archFocus = null;
    archFlow = 0;
    if (duckAmount) { duckAmount = 0; studio?.duck(0); }
    if (!on || !ctx || !studio) {
      // silent: drop the old movement; the right one is built when sound comes on
      current?.dispose();
      current = null;
      currentId = "";
      return;
    }
    if (id !== currentId) play(id, true);
  });

  // leaving the site or reloading: fade instead of cutting
  addEventListener("pagehide", () => studio?.fade(0, 0.15));
  addEventListener("pageshow", (e) => {
    if ((e as PageTransitionEvent).persisted && on && ctx) ctx.resume().then(() => studio?.fade(ON, 1), () => {});
  });
  // a hidden tab goes quiet, and comes back where it was
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !on) return;
    if (document.hidden) {
      studio?.fade(0, 0.3);
      setTimeout(() => { if (document.hidden) ctx?.suspend().catch(() => {}); }, 350);
    } else ctx.resume().then(() => studio?.fade(ON, 1.2), () => {});
  });
}
