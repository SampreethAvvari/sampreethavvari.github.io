// Site sound: a suite in eight movements, one per tab, synthesised in the
// browser (no audio files). Off until the visitor turns it on: the loading
// screen asks once per visit, the nav toggle changes it any time. While it is
// off, this file is all that is loaded and nothing here listens to the pointer.
//
// The page talks to it through window events, so the loader and the React
// nav need no import:
//   sound:set        detail boolean        turn sound on or off (from a click)
//   sound:state      detail { on }         sent whenever that changes
//   journey:chapter  detail { index, id }  the home flight changed chapter
//   journey:progress detail { progress, velocity }
//   journey:words    detail { words, items, wordStagger, itemStagger, delay }
//   journey:jump     detail { from, to, direction, duration }  a jump between worlds starts
//   journey:ending   detail { scene, progress, beat, direction, velocity }  a scene on the
//                    planet, following the scroll both ways: land, exit, helmet, touch
//   journey:interact detail { id, kind, x, y, strength }  hover, press, drag, release
//   journey:sky      detail { angle, up }  the night sky turning: how much of the galaxy is above the land
//   writing:hero     detail { index, slug, accent } an article hero takes the screen
//   writing:transition detail { kind: "hero", direction, from, to, duration }
//                    or { kind: "dive", direction: "in" | "out", tag }
//   writing:constellation detail { id, tag, action: "hover" | "open" | "close" }
//   writing:hover    detail { kind: "star", id, slug, tag, note } or { kind: "card", id, slug }
//   architecture:focus detail { slug, title, discipline }   a system in focus
//   architecture:flow  detail { intensity }                  its traffic, 0..1
//   sound:duck       detail { amount, reason }  a clip with its own sound plays
//   resume:sheet     detail { id, action: "hover" | "pick" | "flip" }
//   resume:stop      detail { index, id }
//   resume:transition detail { direction, from, to, duration }  duration in seconds
//   resume:hover     detail { kind, id, note }
//   projects:world   detail { index, id, accent }  a stage takes the screen
//   projects:transition detail { direction, from, to, duration }  duration in ms
//   projects:hover   detail { kind, id, note }
//   projects:open    detail { id }
//   work:bay         detail { id, action }  action is hover, open or close
//   work:spin        detail { velocity, section }  stops per second
//   work:stop        detail { index, id }
//   work:transition  detail { direction, from, to, duration }  duration in ms
//   work:hover       detail { kind, id, note }
//   post:section     detail { index, id }
//   post:hover       detail { kind, id, note }
//   post:figure      detail { id, action }
//   post:transition  detail { direction: "out" | "in", slug }
//   film:cut         detail { from, to, direction }
//   mind:fly         detail { speed }    mind:depth detail { near }
//   mind:focus       detail { id, kind } mind:hover detail { id, kind }   mind:filter detail { kind, on }
//   teaching:section detail { index, id } teaching:hover detail { kind, id } teaching:page detail { page, total }
//   demos:section, demos:hover, demos:step detail { index, total }
//   astro:after-swap (document)            a new page is in: crossfade to its movement
//
// This file stays small: the instruments, the movements and everything that
// answers the visitor (touch.ts) load on first use.
import { movementFor } from "./ids";
import type { Movement, Studio, Touch, Flight } from "./suite";

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
const flight: Flight = { chapter: 0, p: 0, v: 0, seen: false, t: 0, count: 9 };
let touch: Touch | null = null;
const touches = { hover: 0, click: 0, sky: 0, page: 0 };
let wordsTimer = 0;
// the architecture page and film clips, also remembered
let archFocus: { slug: string; title?: string; discipline?: string } | null = null;
let archFlow = 0;
let resumeStop = -1;
let projectsStage = -1;
let workStop: { index: number; id: string } | null = null;
let duckAmount = 0;

const loadSuite = () => (suiteP ??= import("./suite").then((s) => (suite = s)));
const pageId = () => movementFor(document.body?.dataset.tone, location.pathname);
const px = () => touch?.px ?? 0.5;

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
  // Everything in the score lives below about 9 kHz, so the context runs at
  // a lower rate than the device: a third less work for every node on a
  // laptop, half on a phone. Browsers that refuse get their own rate.
  try {
    ctx = new AC({ latencyHint: "balanced", sampleRate: phone ? 24000 : 32000 });
  } catch {
    try {
      ctx = new AC({ latencyHint: "balanced" });
    } catch {
      return false;
    }
  }
  return true;
}

async function boot() {
  await loadSuite();
  if (!ctx || !suite) return;
  if (!studio) {
    studio = new suite.Studio(ctx, phone);
    if (duckAmount) studio.duck(duckAmount);
    touch = new suite.Touch({
      movement: () => current,
      id: () => currentId,
      studio: () => studio,
      running: () => on && ctx?.state === "running",
      flight,
      counts: touches,
    });
  }
  if (on) touch?.attach();
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
    m.chapter(flight.chapter);
    m.journey(flight.p, 0);
  }
  if (id === "resume" && resumeStop >= 0) m.pageEvent("resume:stop", { index: resumeStop, quiet: true }, 0.5);
  if (id === "projects" && projectsStage >= 0) m.pageEvent("projects:world", { index: projectsStage, quiet: true }, 0.5);
  if (id === "work" && workStop) m.pageEvent("work:stop", { ...workStop, quiet: true }, 0.5);
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
  touch?.detach();
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

// ---- mount -------------------------------------------------------------------

export function mountSound() {
  if (mounted) return;
  mounted = true;
  // for local testing only; Vite drops this from production builds
  if (import.meta.env.DEV) {
    (window as unknown as { __sound: unknown }).__sound = {
      movement: () => current,
      studio: () => studio,
      state: () => ({ ctx: ctx?.state ?? null, on, current: currentId, leaving: leaving.length, chapter: flight.chapter, reading: !!(current as unknown as { reading?: boolean } | null)?.reading, scrollI: (current as unknown as { scrollI?: number } | null)?.scrollI ?? 0, stage: (current as unknown as { stage?: number } | null)?.stage ?? -1, ...touches }),
    };
  }
  on = readPref();
  announce();
  window.addEventListener("sound:set", (e) => setSound(!!(e as CustomEvent).detail));

  // A choice remembered from an earlier visit: browsers only let sound start
  // from a tap or a key, so wait for the first one. The suite loads now.
  if (on) {
    const rest = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (rest) rest(() => void loadSuite(), { timeout: 4000 });
    else setTimeout(() => void loadSuite(), 1500);
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

  // the home flight
  addEventListener("journey:chapter", (e) => {
    const d = (e as CustomEvent).detail || {};
    flight.chapter = Number(d.index) || 0;
    if (currentId === "home") current?.chapter(flight.chapter);
  });
  addEventListener("journey:progress", (e) => {
    const d = (e as CustomEvent).detail || {};
    flight.seen = true;
    flight.t = performance.now();
    if (Number(d.count) > 1) flight.count = Number(d.count);
    flight.p = Number(d.progress) || 0;
    flight.v = Number(d.velocity) || 0;
    if (currentId === "home") current?.journey(flight.p, flight.v);
  });
  addEventListener("journey:jump", (e) => {
    const d = (e as CustomEvent).detail || {};
    if (currentId !== "home" || !current) return;
    const to = Number(d.to);
    if (!Number.isFinite(to)) return;
    flight.chapter = to;
    current.jump(Number(d.from) || 0, to, Number(d.direction) || 1, flight.v, Number(d.duration) / 1000 || 1.4);
  });
  addEventListener("journey:sky", (e) => {
    if (currentId === "home") current?.skyUp(Number((e as CustomEvent).detail?.up) || 0);
  });
  addEventListener("journey:ending", (e) => {
    const d = (e as CustomEvent).detail || {};
    if (currentId === "home") current?.ending(Number(d.progress) || 0, Number(d.beat) || 0, typeof d.scene === "string" ? d.scene : undefined, Number(d.direction) || 0, Number(d.velocity) || 0);
  });
  // the writing tab's heroes
  addEventListener("writing:hero", (e) => {
    const d = (e as CustomEvent).detail;
    if (d?.slug && currentId === "writing") current?.heroFocus(d);
  });
  addEventListener("writing:transition", (e) => {
    const d = (e as CustomEvent).detail;
    if (!d || currentId !== "writing") return;
    if (d.kind === "dive") current?.dive(String(d.direction || "in"), String(d.tag || ""));
    else current?.heroTransition(d);
  });
  addEventListener("writing:constellation", (e) => {
    const d = (e as CustomEvent).detail;
    if (d && currentId === "writing") current?.constellation(d);
  });
  // stars can be traced quickly, so they get a shorter gap than cards
  let lastSky = 0;
  addEventListener("writing:hover", (e) => {
    const d = (e as CustomEvent).detail;
    if (!d || currentId !== "writing" || !on) return;
    const t = performance.now();
    if (t - lastSky < (d.kind === "star" ? 55 : 110)) return;
    lastSky = t;
    touches.sky++;
    current?.skyHover(d, px());
  });
  addEventListener("journey:words", (e) => {
    const d = (e as CustomEvent).detail;
    if (!d || currentId !== "home" || !current) return;
    clearTimeout(wordsTimer);
    current.hush();
    // only the chapter the visitor settles on speaks: when they are flying
    // through, wait a moment and speak only if nothing newer came
    if (Math.abs(flight.v) < 0.9) current.words(d, 0);
    else wordsTimer = window.setTimeout(() => currentId === "home" && current?.words(d, 0.25), 250);
  });

  // the star system on the projects tab
  for (const name of ["projects:world", "projects:transition", "projects:hover", "projects:open"]) {
    addEventListener(name, (e) => {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      if (name === "projects:world") projectsStage = Number(d.index);
      if (currentId === "projects") {
        if (name === "projects:hover") touches.page++;
        current?.pageEvent(name, d, px());
      }
    });
  }

  // the ring station on the work tab
  for (const name of ["work:bay", "work:spin", "work:stop", "work:transition", "work:hover"]) {
    addEventListener(name, (e) => {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      if (name === "work:stop") workStop = { index: Number(d.index), id: String(d.id) };
      if (currentId === "work") {
        if (name === "work:hover") touches.page++;
        current?.pageEvent(name, d, px());
      }
    });
  }

  // the resume, and the sounds of a single post
  for (const name of ["resume:sheet", "resume:stop", "resume:transition", "resume:hover"]) {
    addEventListener(name, (e) => {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      if (name === "resume:stop") resumeStop = Number(d.index);
      if (currentId === "resume") {
        if (name === "resume:hover" || name === "resume:sheet") touches.page++;
        current?.pageEvent(name, d, px());
      }
    });
  }
  for (const name of ["post:section", "post:hover", "post:figure", "post:transition"]) {
    addEventListener(name, (e) => {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      // the link spoke for itself, so the waiting tap is not needed
      if (name === "post:hover" && d.kind === "link") touch?.spoke();
      if (name === "post:hover") touches.page++;
      current?.post(name, d, px());
    });
  }

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
    touch?.swapped();
    flight.seen = false;
    clearTimeout(wordsTimer);
    const id = pageId();
    if (id !== "home") { flight.chapter = 0; flight.p = 0; }
    archFocus = null;
    archFlow = 0;
    resumeStop = -1;
    projectsStage = -1;
    workStop = null;
    if (duckAmount) { duckAmount = 0; studio?.duck(0); }
    if (!on || !ctx || !studio) {
      // silent: drop the old movement; the right one is built when sound comes on
      current?.dispose();
      current = null;
      currentId = "";
      return;
    }
    if (id !== currentId) play(id, true);
    else current?.swapped();
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
