// /demos and the pages under it, around the launch rail (rail-gl.ts).
//
// The index is a pinned stage: every stretch of scroll is one stop, the whole
// rail from outside, then JobPilot, then a look down the bore, then each tour,
// each holding still for a beat. A tour page and JobPilot open on their own
// capsule, and the page flies on down the rail behind the player.
//
// The words and links are real HTML from the first byte, and the same markup is
// a plain readable page with no script, no GPU or reduced motion. Three is only
// imported once the page has painted.
//
// Sound hooks (nothing here plays audio), on window:
//   demos:section  { index, id, direction }   a new stop or section is up
//   demos:hover    { kind, id }               the pointer found something to launch
//   demos:step     { index, total }           the tour moved to a step (TourPlayer)

import { navigate } from "astro:transitions/client";
import { hasWebGL2 } from "../../scripts/gl-probe";
import { layoutBox } from "../../scripts/layout-box";
import { onPage } from "../../scripts/lifecycle";
import type { Capsule, RailGL, RailState } from "./rail-gl";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);
const ramp = (a: number, b: number, v: number) => smooth(clamp01((v - a) / (b - a)));
const emit = (name: string, detail: Record<string, unknown>) => dispatchEvent(new CustomEvent(name, { detail }));

// Part of each stop spent holding still before the move to the next.
const HOLD = 0.34;
const TALL_ENOUGH = "(min-height: 620px)";
const CALM = "(prefers-reduced-motion: reduce)";

const fineHover = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
const later = (cb: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 900 });
  else setTimeout(cb, 120);
};

type Pointer = { tx: number; ty: number };

/** Pointer position across the window, -1 to 1. A finger moves nothing. */
function watchPointer(signal: AbortSignal): Pointer {
  const p: Pointer = { tx: 0, ty: 0 };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      p.tx = (e.clientX / innerWidth) * 2 - 1;
      p.ty = (e.clientY / innerHeight) * 2 - 1;
    },
    { passive: true, signal },
  );
  return p;
}

/** Run frames only while `el` is near the screen and the tab is showing. */
function frames(el: Element, frame: (now: number) => void, signal: AbortSignal): () => void {
  let raf = 0;
  let near = false;
  let running = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    frame(now);
  };
  const sync = () => {
    const want = near && !document.hidden && !signal.aborted;
    if (want && !running) {
      running = true;
      raf = requestAnimationFrame(loop);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  const io = new IntersectionObserver(
    ([e]) => {
      near = e.isIntersecting;
      sync();
    },
    { rootMargin: "60px" },
  );
  io.observe(el);
  document.addEventListener("visibilitychange", sync, { signal });
  return () => {
    io.disconnect();
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", sync);
  };
}

// The tall stage goes on from a small script in the page itself, before first
// paint. The router skips a page's inline script when the page it is leaving has
// one with the same text, which is every move between demos, so here the class
// goes onto the incoming page before the swap. It has to be there by then: a move
// back restores the scroll position straight after the swap, and on the short
// plain page it would be cut off.
const canFly = () => "WebGL2RenderingContext" in window && !matchMedia(CALM).matches;
let swapHooked = false;
function hookSwap() {
  if (swapHooked) return;
  swapHooked = true;
  document.addEventListener("astro:before-swap", (e) => {
    if (!canFly()) return;
    (e as Event & { newDocument: Document }).newDocument.querySelectorAll("[data-rl]").forEach((el) => el.classList.add("is-live"));
  });
}

const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// ---- The index -------------------------------------------------------------

export function mountRailIndex(): void {
  hookSwap();
  onPage("demos-rail-index", (signal) => {
    const root = document.querySelector<HTMLElement>("[data-rl='index']");
    if (!root) return;
    if (!canFly()) return;
    root.classList.add("is-live");
    const mq = matchMedia(TALL_ENOUGH);
    let stop: (() => void) | null = null;
    const run = () => {
      stop?.();
      stop = mq.matches ? indexStage(root, signal) : null;
    };
    mq.addEventListener("change", run, { signal });
    run();
    return () => {
      stop?.();
      stop = null;
    };
  });
}

function indexStage(root: HTMLElement, pageSignal: AbortSignal): () => void {
  const ac = new AbortController();
  const signal = ac.signal;
  pageSignal.addEventListener("abort", () => ac.abort(), { once: true, signal });
  const stageEl = root.querySelector<HTMLElement>(".rl-stage")!;
  const stops = Array.from(root.querySelectorAll<HTMLElement>("[data-stop]")).sort((a, b) => Number(a.dataset.stop) - Number(b.dataset.stop));
  const inners = stops.map((s) => s.querySelector<HTMLElement>(".rl-in") ?? s);
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(".rl-index a"));
  const veil = root.querySelector<HTMLElement>(".rl-veil");
  const cue = root.querySelector<HTMLElement>(".rl-cue");
  const canvas = root.querySelector<HTMLCanvasElement>(".rl-gl");
  const n = stops.length;
  const pointer = watchPointer(signal);

  // Which stops carry a capsule, and the picture for each.
  const capsules: Capsule[] = [];
  const capOf = new Map<number, number>();
  stops.forEach((s, i) => {
    const tex = s.dataset.tex;
    if (tex === undefined) return;
    capOf.set(i, capsules.length);
    capsules.push({ url: matchMedia("(pointer: coarse)").matches ? tex.replace("-960.webp", "-640.webp") : tex, stop: i });
  });
  const lookahead = stops.findIndex((s) => "lookahead" in s.dataset);

  const state: RailState = { path: 0, speed: 0, dir: 1, px: 0, py: 0, hover: 0, step: 0 };

  let top = 0;
  let seg = 1;
  let tail = 1;
  const measure = () => {
    top = layoutBox(root).top;
    // After the last stop the stage stays pinned for half a screen more and goes
    // dark, so it lets go with no edge showing. The stylesheet adds the same half.
    tail = stageEl.offsetHeight * 0.5;
    seg = Math.max(1, (root.offsetHeight - stageEl.offsetHeight - tail) / Math.max(1, n - 1));
  };
  const restOf = (i: number) => top + Math.min(i + 0.06, n - 1) * seg;

  let lastY = NaN;
  let lastTime = performance.now();
  let pxPerMs = 0;
  let travel = 1;
  let current = -1;
  let t = 0;
  const shown = new Set<number>();

  const place = (i: number, d: number) => {
    const el = inners[i];
    const a = Math.abs(d);
    // One set of words is gone before the next arrives.
    const opacity = 1 - ramp(0.05, 0.4, a);
    if (opacity <= 0.001) {
      if (shown.has(i)) {
        shown.delete(i);
        el.style.opacity = "0";
        el.style.transform = "";
        stops[i].removeAttribute("data-on");
      }
      return;
    }
    shown.add(i);
    // Comes up from far ahead and goes by the camera.
    const z = d < 0 ? d * 420 : d * 260;
    const y = d < 0 ? -d * 46 : -d * 30;
    el.style.opacity = opacity.toFixed(3);
    el.style.transform = a < 0.002 ? "" : `translate3d(0, ${y.toFixed(1)}px, ${z.toFixed(1)}px)`;
    if ((a < 0.34) !== stops[i].hasAttribute("data-on")) stops[i].toggleAttribute("data-on", a < 0.34);
  };

  const update = (force = false) => {
    const y = scrollY;
    if (!force && y === lastY) return;
    const now = performance.now();
    const dy = Number.isNaN(lastY) ? 0 : y - lastY;
    if (dy) travel = dy > 0 ? 1 : -1;
    pxPerMs += (Math.abs(dy) / Math.max(1, now - lastTime) - pxPerMs) * 0.35;
    lastTime = now;
    lastY = y;
    const rel = y - top;
    const span = seg * (n - 1);
    const x = Math.max(0, Math.min(rel, span)) / seg;
    const k = Math.min(n - 1, Math.floor(x));
    const f = x - k;
    t = k >= n - 1 ? n - 1 : k + smooth(clamp01((f - HOLD) / (1 - HOLD)));
    state.path = t;
    for (let i = 0; i < n; i++) place(i, t - i);
    links.forEach((a) => {
      const i = Number(a.dataset.go);
      a.style.setProperty("--f", (1 - clamp01(Math.abs(t - i) * 1.6)).toFixed(3));
    });
    const up = Math.round(t);
    if (up !== current) {
      const first = current === -1;
      current = up;
      links.forEach((a) => {
        if (Number(a.dataset.go) === up) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      root.dataset.at = String(up);
      if (!first) emit("demos:section", { index: up, id: stops[up]?.id || `stop-${up}`, direction: travel });
    }
    if (cue) cue.style.opacity = (1 - ramp(0, 0.2, x)).toFixed(3);
    if (veil) veil.style.opacity = clamp01((rel - span) / tail).toFixed(3);
    syncSky(rel - span);
  };

  // While the rail fills the screen, the page's own sky can rest (SpaceField
  // listens for this class). Leaving the stage hands the sky back.
  let glOn = false;
  let coversSky = false;
  const syncSky = (past: number) => {
    const covers = glOn && past < tail && scrollY >= top - 1;
    if (covers === coversSky) return;
    coversSky = covers;
    document.documentElement.classList.toggle("in-cx", covers);
  };

  // A visitor who stops halfway through a move would rest on half faded words,
  // so the move finishes by itself, the way they were going.
  let finishing = 0;
  const stopFinishing = () => {
    if (finishing) cancelAnimationFrame(finishing);
    finishing = 0;
  };
  const finish = () => {
    const k = Math.floor(t);
    const frac = t - k;
    if (finishing || frac < 0.001 || frac > 0.999) return;
    const onward = travel > 0 ? frac > 0.12 : frac > 0.88;
    const to = onward ? top + (k + 1.02) * seg : top + (k + HOLD - 0.02) * seg;
    const from = scrollY;
    const t0 = performance.now();
    const step = (now: number) => {
      if (signal.aborted) return;
      const p = Math.min(1, (now - t0) / 620);
      const e = 1 - Math.pow(1 - p, 3);
      scrollTo({ top: from + (to - from) * e, behavior: "instant" as ScrollBehavior });
      finishing = p < 1 ? requestAnimationFrame(step) : 0;
    };
    finishing = requestAnimationFrame(step);
  };
  for (const ev of ["wheel", "touchstart", "keydown"]) addEventListener(ev, stopFinishing, { passive: true, signal });

  let queued = 0;
  let settle = 0;
  const onScroll = () => {
    clearTimeout(settle);
    settle = window.setTimeout(() => {
      pxPerMs = 0;
      finish();
    }, 150);
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      update();
    });
  };
  addEventListener("scroll", onScroll, { passive: true, signal });

  const refresh = () => {
    measure();
    update(true);
    gl?.resize();
  };
  const ro = new ResizeObserver(refresh);
  ro.observe(root);
  // Height only changes on a phone are the browser bar: the stage is sized to
  // the screen without it, so they need nothing.
  let lastW = innerWidth;
  addEventListener(
    "resize",
    () => {
      if (innerWidth === lastW && matchMedia("(pointer: coarse)").matches) return;
      lastW = innerWidth;
      refresh();
    },
    { passive: true, signal },
  );

  // Keyboard: a link in a stop that is not on screen brings it up.
  root.addEventListener(
    "focusin",
    (e) => {
      const stop = (e.target as HTMLElement).closest<HTMLElement>("[data-stop]");
      if (!stop) return;
      const i = stops.indexOf(stop);
      if (i < 0 || Math.abs(t - i) < 0.01) return;
      requestAnimationFrame(() => scrollTo({ top: restOf(i), behavior: "instant" as ScrollBehavior }));
    },
    { signal },
  );

  // The index: glide to a stop. From the keyboard, focus follows.
  links.forEach((a) =>
    a.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        const i = Number(a.dataset.go);
        if (e.detail === 0) {
          stops[i]?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
          scrollTo({ top: restOf(i), behavior: "instant" as ScrollBehavior });
        } else {
          scrollTo({ top: restOf(i), behavior: "smooth" });
        }
      },
      { signal },
    ),
  );
  links.forEach((a) =>
    a.addEventListener("pointerenter", () => emit("demos:hover", { kind: "index", id: a.dataset.id || "" }), { signal }),
  );
  stageEl.querySelectorAll<HTMLElement>("a[data-launch]").forEach((a) =>
    a.addEventListener("pointerenter", () => emit("demos:hover", { kind: "card", id: a.closest<HTMLElement>("[data-stop]")?.id || "" }), { signal }),
  );

  // Launching. The link is the real thing; with the rail up, a plain click fires
  // the capsule first and the page follows it down the bore.
  let launching = false;
  const launch = (stopIndex: number, href: string) => {
    if (launching) return;
    const cap = capOf.get(stopIndex);
    if (!gl || !glOn || cap == null) {
      navigate(href);
      return;
    }
    launching = true;
    gl.launch(cap);
    window.setTimeout(() => {
      if (!signal.aborted) navigate(href);
    }, 420);
  };
  stageEl.addEventListener(
    "click",
    (e) => {
      if (!plainClick(e)) return;
      const target = e.target as HTMLElement;
      const a = target.closest<HTMLAnchorElement>("a[data-launch]");
      if (a) {
        const stop = a.closest<HTMLElement>("[data-stop]");
        if (!stop || !gl || !glOn) return;
        e.preventDefault();
        launch(stops.indexOf(stop), a.href);
        return;
      }
      if (target.closest("a, button") || !hotStop()) return;
      // A click on the capsule itself.
      const link = hotStop()!.querySelector<HTMLAnchorElement>("a[data-launch]");
      if (link) launch(stops.indexOf(hotStop()!), link.href);
    },
    { signal },
  );

  // The capsule under the pointer leans in.
  let hover = 0;
  let hotAt = -1;
  const hotStop = () => (hotAt >= 0 ? stops[hotAt] : null);
  if (fineHover()) {
    stageEl.addEventListener(
      "pointermove",
      (e) => {
        if (!gl || !glOn) return;
        const i = Math.round(t);
        const cap = capOf.get(i);
        let hot = -1;
        if (cap != null && Math.abs(t - i) < 0.1 && !(e.target as HTMLElement).closest("a, button")) {
          const r = gl.faceRect(cap);
          if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) hot = i;
        }
        if (hot === hotAt) return;
        hotAt = hot;
        stageEl.classList.toggle("is-hot", hot >= 0);
        if (hot >= 0) emit("demos:hover", { kind: "capsule", id: stops[hot].id });
      },
      { passive: true, signal },
    );
  }

  // Frames.
  let gl: RailGL | null = null;
  let speedS = 0;
  let dirS = 1;
  let lastFrameY = scrollY;
  const stopFrames = frames(
    root,
    (now) => {
      const vy = Math.abs(scrollY - lastFrameY);
      lastFrameY = scrollY;
      speedS += (Math.min(1, vy / 60) - speedS) * 0.1;
      dirS += (travel - dirS) * 0.05;
      hover += ((hotAt >= 0 ? 1 : 0) - hover) * 0.12;
      state.speed = speedS;
      state.dir = dirS;
      state.hover = hover;
      state.px += (pointer.tx - state.px) * 0.05;
      state.py += (pointer.ty - state.py) * 0.05;
      gl?.draw(now);
    },
    signal,
  );

  // The world, once the page has painted. Until it is up, and whenever the GPU
  // is taken away, the static sky and each stop's own picture carry the page.
  const showGL = () => {
    if (signal.aborted) return;
    glOn = true;
    root.classList.add("is-gl");
    update(true);
  };
  const noGL = () => {
    if (signal.aborted) return;
    glOn = false;
    root.classList.remove("is-gl");
    syncSky(1);
  };
  const toPlain = () => {
    if (signal.aborted) return;
    const at = stops[Math.round(t)];
    teardown();
    root.classList.remove("is-live");
    if (scrollY > top && at) requestAnimationFrame(() => at.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }));
  };
  if (canvas) {
    // Asking whether the GPU is there stops the page for a moment, so it waits
    // for a quiet one, and three is only fetched once the answer is yes.
    later(() => {
      if (signal.aborted) return;
      if (!hasWebGL2()) {
        toPlain();
        return;
      }
      import("./rail-gl")
        .then(({ mountRail }) => (signal.aborted ? null : mountRail(canvas, { capsules, stops: n, outside: true, lookahead: lookahead >= 0 ? lookahead : undefined }, state, showGL, noGL, signal)))
        .then((made) => {
          if (signal.aborted) return;
          gl = made;
          if (!gl) toPlain();
        })
        .catch(toPlain);
    });
  }

  measure();
  update(true);
  // A link to one stop: go straight there. A move back has its own place to return to.
  if (location.hash && !(history.state as { scrollY?: number } | null)?.scrollY) {
    const i = stops.findIndex((s) => s.id && `#${s.id}` === location.hash);
    if (i >= 0) scrollTo({ top: restOf(i), behavior: "instant" as ScrollBehavior });
  }

  function teardown() {
    ac.abort();
    ro.disconnect();
    stopFrames();
    stopFinishing();
    cancelAnimationFrame(queued);
    clearTimeout(settle);
    gl?.stop();
    gl = null;
    root.classList.remove("is-gl");
    document.documentElement.classList.remove("in-cx");
    stageEl.classList.remove("is-hot");
    inners.forEach((el) => {
      el.style.opacity = "";
      el.style.transform = "";
    });
    stops.forEach((s) => s.removeAttribute("data-on"));
    links.forEach((a) => a.style.removeProperty("--f"));
    if (cue) cue.style.opacity = "";
    if (veil) veil.style.opacity = "";
  }
  return teardown;
}

// ---- A tour page, or JobPilot ------------------------------------------------

export function mountRailFlight(): void {
  hookSwap();
  onPage("demos-rail-flight", (signal) => {
    const flight = document.querySelector<HTMLElement>("[data-rl='flight']");
    if (flight && canFly()) flight.classList.add("is-live");
    const depth = Array.from(document.querySelectorAll<HTMLElement>("[data-depth]"));
    const calm = matchMedia(CALM).matches;
    let stopDepth: (() => void) | null = null;
    if (!calm && depth.length) stopDepth = depthSections(depth, signal);
    const stopTilt = !calm ? tiltInstruments(signal) : null;
    const stopWorld = flight && flight.classList.contains("is-live") ? flightWorld(flight, signal) : null;
    return () => {
      stopDepth?.();
      stopTilt?.();
      stopWorld?.();
    };
  });
}

function flightWorld(flight: HTMLElement, signal: AbortSignal): (() => void) | null {
  const canvas = flight.querySelector<HTMLCanvasElement>(".rl-gl");
  const hero = flight.querySelector<HTMLElement>("[data-flight-hero]");
  const sticky = flight.querySelector<HTMLElement>(".rl-sticky");
  const slabImg = flight.querySelector<HTMLImageElement>(".rl-slab img");
  if (!canvas || !hero || !sticky) return null;
  const pointer = watchPointer(signal);
  const state: RailState = { path: 0, speed: 0, dir: 1, px: 0, py: 0, hover: 0, step: 0 };
  let stepTarget = 0;

  let heroH = 1;
  let endAt = 1;
  let top = 0;
  const measure = () => {
    top = layoutBox(flight).top;
    heroH = Math.max(1, hero.offsetHeight);
    // On a wide screen the rail keeps flying behind the console, and its margins
    // show it. A phone's console fills the screen, so the world stops at the top.
    const wide = matchMedia("(min-width: 1024px)").matches;
    const pad = parseFloat(getComputedStyle(flight).paddingBottom) || 0;
    endAt = top + (wide ? flight.offsetHeight - pad : heroH) - innerHeight;
  };
  let travel = 1;
  let lastY = scrollY;
  let glOn = false;
  let coversSky = false;
  const update = () => {
    const y = scrollY;
    if (y !== lastY) travel = y > lastY ? 1 : -1;
    lastY = y;
    state.path = clamp01((y - top) / heroH);
    // The world lets go as the flight section's end comes up.
    const fade = 1 - ramp(endAt + innerHeight * 0.08, endAt + innerHeight * 0.72, y);
    sticky.style.opacity = fade.toFixed(3);
    sticky.style.visibility = fade <= 0.001 ? "hidden" : "";
    const covers = glOn && fade >= 0.999;
    if (covers !== coversSky) {
      coversSky = covers;
      document.documentElement.classList.toggle("in-cx", covers);
    }
    flight.toggleAttribute("data-past", state.path > 0.02);
  };
  let queued = 0;
  addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        update();
      });
    },
    { passive: true, signal },
  );
  const refresh = () => {
    measure();
    update();
    gl?.resize();
  };
  const ro = new ResizeObserver(refresh);
  ro.observe(flight);

  addEventListener(
    "demos:step",
    (e) => {
      const d = (e as CustomEvent<{ index: number }>).detail;
      if (!d) return;
      travel = d.index >= stepTarget ? 1 : -1;
      stepTarget = d.index;
      gl?.pulse();
    },
    { signal },
  );

  let gl: RailGL | null = null;
  let speedS = 0;
  let dirS = 1;
  let lastFrameY = scrollY;
  const stopFrames = frames(
    sticky,
    (now) => {
      if (Number(sticky.style.opacity || 1) <= 0.001) return;
      const vy = Math.abs(scrollY - lastFrameY);
      lastFrameY = scrollY;
      const stepping = Math.abs(stepTarget - state.step);
      speedS += (Math.min(1, vy / 60 + stepping * 0.5) - speedS) * 0.1;
      dirS += (travel - dirS) * 0.05;
      state.step += (stepTarget - state.step) * 0.045;
      state.speed = speedS;
      state.dir = dirS;
      state.px += (pointer.tx - state.px) * 0.05;
      state.py += (pointer.ty - state.py) * 0.05;
      gl?.draw(now);
    },
    signal,
  );

  const showGL = () => {
    if (signal.aborted) return;
    glOn = true;
    flight.classList.add("is-gl");
    update();
  };
  const noGL = () => {
    if (signal.aborted) return;
    glOn = false;
    flight.classList.remove("is-gl");
    coversSky = false;
    document.documentElement.classList.remove("in-cx");
  };
  const start = () => {
    if (signal.aborted) return;
    if (!hasWebGL2()) {
      flight.classList.remove("is-live");
      return;
    }
    const url = slabImg?.currentSrc || slabImg?.src || flight.dataset.tex;
    import("./rail-gl")
      .then(({ mountRail }) => (signal.aborted ? null : mountRail(canvas, { capsules: [{ url, stop: 0 }], stops: 2, outside: false }, state, showGL, noGL, signal)))
      .then((made) => {
        if (signal.aborted) return;
        gl = made;
        if (!gl) flight.classList.remove("is-live");
      })
      .catch(() => {
        if (!signal.aborted) flight.classList.remove("is-live");
      });
  };
  // The page's picture first, so the canvas reuses the file it already has.
  if (slabImg && !slabImg.complete) {
    slabImg.addEventListener("load", () => later(start), { once: true, signal });
    slabImg.addEventListener("error", () => later(start), { once: true, signal });
  } else later(start);

  measure();
  update();
  return () => {
    ro.disconnect();
    stopFrames();
    cancelAnimationFrame(queued);
    gl?.stop();
    gl = null;
    flight.classList.remove("is-gl");
    flight.removeAttribute("data-past");
    sticky.style.opacity = "";
    sticky.style.visibility = "";
    document.documentElement.classList.remove("in-cx");
  };
}

// Sections come up from far ahead and go by the camera: --p is 0 far below, 1
// through the middle of the screen, and --q runs 0 to 1 as it leaves at the top.
// Scrolling up plays it backward. Only what is on screen is written.
function depthSections(els: HTMLElement[], signal: AbortSignal): () => void {
  const near = new Set<HTMLElement>();
  const boxes = new Map<HTMLElement, { top: number; h: number }>();
  let vh = innerHeight;
  const measure = () => {
    vh = innerHeight;
    for (const el of els) {
      const b = layoutBox(el);
      boxes.set(el, { top: b.top, h: b.height });
    }
  };
  let up: Set<HTMLElement> = new Set();
  const write = () => {
    const y = scrollY;
    for (const el of near) {
      const b = boxes.get(el);
      if (!b) continue;
      const entry = (y + vh - b.top) / (vh * 0.44);
      const p = ramp(0, 1, entry);
      const leave = clamp01((y - (b.top + b.h - vh * 0.18)) / (vh * 0.3));
      el.style.setProperty("--p", p.toFixed(3));
      el.style.setProperty("--q", leave.toFixed(3));
      if ("lanes" in el.dataset) el.style.setProperty("--lit", ramp(0.7, 1.9, entry).toFixed(3));
      // The section that crosses the middle is the one playing.
      const mid = y + vh * 0.5 > b.top && y + vh * 0.5 < b.top + b.h;
      if (mid && !up.has(el)) {
        up = new Set([el]);
        emit("demos:section", { index: els.indexOf(el), id: el.id || el.getAttribute("aria-labelledby") || "", direction: y >= lastY ? 1 : -1 });
      }
    }
    lastY = y;
  };
  let lastY = scrollY;
  let queued = 0;
  addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        write();
      });
    },
    { passive: true, signal },
  );
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) near.add(el);
        else near.delete(el);
      }
      write();
    },
    { rootMargin: "20% 0px" },
  );
  document.documentElement.classList.add("rl-depth");
  els.forEach((el) => io.observe(el));
  const ro = new ResizeObserver(() => {
    measure();
    write();
  });
  ro.observe(document.body);
  measure();
  // Before the observer's first call, so nothing shows for a frame at full size.
  for (const el of els) {
    const b = boxes.get(el);
    if (b && b.top > scrollY + vh) {
      el.style.setProperty("--p", "0");
      if ("lanes" in el.dataset) el.style.setProperty("--lit", "0");
    }
  }
  return () => {
    io.disconnect();
    ro.disconnect();
    cancelAnimationFrame(queued);
    document.documentElement.classList.remove("rl-depth");
    for (const el of els) {
      el.style.removeProperty("--p");
      el.style.removeProperty("--q");
      el.style.removeProperty("--lit");
    }
  };
}

// The instruments lean toward the pointer, and their rim light follows it.
function tiltInstruments(signal: AbortSignal): (() => void) | null {
  if (!fineHover()) return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
  if (!els.length) return null;
  const cur = new Map(els.map((el) => [el, { x: 0, y: 0, tx: 0, ty: 0, on: false }]));
  let raf = 0;
  const loop = () => {
    raf = 0;
    let more = false;
    for (const [el, s] of cur) {
      s.x += (s.tx - s.x) * 0.1;
      s.y += (s.ty - s.y) * 0.1;
      if (Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) > 0.002) more = true;
      const max = Number(el.dataset.tilt || 2);
      el.style.setProperty("--rx", `${(-s.y * max).toFixed(3)}deg`);
      el.style.setProperty("--ry", `${(s.x * max).toFixed(3)}deg`);
    }
    if (more) raf = requestAnimationFrame(loop);
  };
  for (const el of els) {
    const s = cur.get(el)!;
    el.addEventListener(
      "pointermove",
      (e) => {
        const r = el.getBoundingClientRect();
        s.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
        s.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
        el.style.setProperty("--mx", `${(((s.tx + 1) / 2) * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(((s.ty + 1) / 2) * 100).toFixed(1)}%`);
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { passive: true, signal },
    );
    el.addEventListener(
      "pointerleave",
      () => {
        s.tx = 0;
        s.ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { signal },
    );
  }
  return () => {
    cancelAnimationFrame(raf);
    for (const el of els) ["--rx", "--ry", "--mx", "--my"].forEach((v) => el.style.removeProperty(v));
  };
}
