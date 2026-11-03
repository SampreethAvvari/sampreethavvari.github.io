// Page scripts and client side navigation.
//
// The site moves between pages without reloading (Astro view transitions),
// so the document, the sound and every module script live for the whole
// visit. A module runs once; a page's own work has to start each time the
// page is shown and stop when it is swapped away. That is what onPage() is
// for:
//
//   onPage("posts", (signal) => {
//     const grid = document.getElementById("wr-grid");
//     if (!grid) return; // not this page
//     addEventListener("scroll", onScroll, { passive: true, signal });
//     const io = new IntersectionObserver(seen);
//     return () => io.disconnect();
//   });
//
// The setup runs on the first load and again after every navigation, and
// before the next swap its signal is aborted and the function it returned
// is called. Every setup registered so far runs on every page, so each one
// looks for its own elements first and returns when they are not there.
//
// This file also carries what lives on <html> and <body> across a swap:
// classes and data attributes that run once scripts put on <html>, and
// layers they appended to <body> (marked with keepAcrossPages).

export type Teardown = () => void;
export type Setup = (signal: AbortSignal) => void | Teardown;

type Entry = { setup: Setup; phase: number; ran: number; stop: Teardown | null };
type Life = {
  gen: number; // bumped at every swap, so a setup runs once per page shown
  live: boolean; // the current page has loaded and its setups have run
  entries: Map<string, Entry>;
  hooked: boolean;
};

const w = window as Window & { __life?: Life };
const life: Life = (w.__life ??= { gen: 0, live: false, entries: new Map(), hooked: false });

// Layers appended to <body> by run once scripts. A swap replaces <body>, so
// these move into the incoming one first. react-modal mounts its portal on
// <body> once, from the persisted nav's search.
const KEEP = ":scope > [data-keep], :scope > .ReactModalPortal, :scope > .fx-cursor, :scope > .fx-cursor-dot";

function start(e: Entry) {
  if (e.ran === life.gen) return;
  e.ran = life.gen;
  const visit = new AbortController();
  let done: void | Teardown;
  try {
    done = e.setup(visit.signal);
  } catch (err) {
    console.error(err);
  }
  e.stop = () => {
    visit.abort();
    if (typeof done === "function") {
      try {
        done();
      } catch (err) {
        console.error(err);
      }
    }
  };
}

function startAll() {
  life.live = true;
  [...life.entries.values()].sort((a, b) => a.phase - b.phase).forEach(start);
}

function stopAll() {
  life.live = false;
  for (const e of life.entries.values()) {
    const stop = e.stop;
    e.stop = null;
    stop?.();
  }
  life.gen++;
}

// Classes and data attributes on <html> that run once scripts set (the dark
// theme, the sky being on, the glass, the sound state) would be dropped by
// the swap, which copies the incoming page's <html> attributes. Page scripts
// remove their own in their teardown, which has run by the time this does.
function carryRoot(next: Document) {
  const from = document.documentElement;
  const to = next.documentElement;
  from.classList.forEach((c) => to.classList.add(c));
  for (const a of Array.from(from.attributes)) {
    if (!a.name.startsWith("data-") || a.name.startsWith("data-astro-")) continue;
    if (!to.hasAttribute(a.name)) to.setAttribute(a.name, a.value);
  }
  next.body.append(...Array.from(document.body.querySelectorAll(KEEP)));
}

if (!life.hooked) {
  life.hooked = true;
  document.addEventListener("astro:before-swap", (ev) => {
    stopAll();
    // Wrap the swap itself, so this runs after every other before-swap
    // listener has cleaned up.
    const e = ev as Event & { newDocument: Document; swap: () => void };
    const swap = e.swap;
    e.swap = () => {
      carryRoot(e.newDocument);
      swap();
    };
  });
  document.addEventListener("astro:page-load", startAll);
  // The first page: module scripts run after the document is parsed, and
  // DOMContentLoaded waits for all of them, so every setup on the page has
  // registered by then. astro:page-load for the first page comes later (on
  // window load) and finds them already run.
  if (document.readyState === "complete") queueMicrotask(startAll);
  else document.addEventListener("DOMContentLoaded", startAll, { once: true });
}

/** Run `setup` on every page shown, starting with this one. `key` names it,
 *  so a module that is evaluated again replaces its entry instead of adding
 *  a second one. `phase` orders setups on a page (lower first). */
export function onPage(key: string, setup: Setup, phase = 0): void {
  const prev = life.entries.get(key);
  const entry: Entry = { setup, phase, ran: prev?.ran ?? -1, stop: prev?.stop ?? null };
  life.entries.set(key, entry);
  if (life.live) start(entry);
}

/** Keep an element that a run once script appended to <body> on every page. */
export function keepAcrossPages<T extends Element>(el: T): T {
  el.setAttribute("data-keep", "");
  return el;
}

/** Call `cb` once the images on this page have loaded (or failed), for
 *  measurements that move as they arrive. Replaces window "load", which
 *  only fires for the first page of a visit. */
export function afterImages(signal: AbortSignal, cb: () => void): void {
  // Lazy images wait for a scroll, so only eager ones count, and a slow one
  // never holds it past a few seconds.
  const pending = Array.from(document.images).filter((img) => !img.complete && img.loading !== "lazy");
  let fired = false;
  const fire = () => {
    if (fired || signal.aborted) return;
    fired = true;
    clearTimeout(cap);
    cb();
  };
  const cap = window.setTimeout(fire, 3000);
  signal.addEventListener("abort", () => clearTimeout(cap));
  if (!pending.length) {
    requestAnimationFrame(fire);
    return;
  }
  let left = pending.length;
  const one = () => {
    if (--left === 0) fire();
  };
  for (const img of pending) {
    img.addEventListener("load", one, { once: true, signal });
    img.addEventListener("error", one, { once: true, signal });
  }
}
