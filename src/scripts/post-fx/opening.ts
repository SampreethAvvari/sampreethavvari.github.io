// The opening's choreography: reads the scroll and the pointer, moves the
// words and the picture between "in space" and "settled", and hands the
// picture to the canvas once the canvas has drawn it.
//
// Everything is one number, e. The settled layout is the real layout, the one
// a reader gets with no script, with reduced motion and in print. Space is
// only ever a transform away from it, so nothing can shift the page.

import { fxOn, isPhone, isTouch, clamp, smooth, offsetIn, emit, onScrollFrame } from "./util";
import type { Box, OpeningGL, OpeningState } from "./opening-gl";

const easeE = (p: number) => {
  // Holds a beat, then a long glide in.
  const t = clamp((p - 0.04) / 0.96);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function mountOpening(signal: AbortSignal): void | (() => void) {
  const open = document.getElementById("pfx-open");
  const stage = document.getElementById("pfx-stage");
  if (!open || !stage) return;

  const veil = document.getElementById("pfx-veil");
  const showVeil = (v: number) => {
    if (veil) veil.style.opacity = v.toFixed(3);
  };

  // Stillness: the settled layout as it is, with the reading veil down.
  if (!fxOn()) {
    showVeil(1);
    return;
  }

  const canvas = stage.querySelector<HTMLCanvasElement>(".pfx-gl");
  const art = stage.querySelector<HTMLElement>(".pfx-art");
  const copy = stage.querySelector<HTMLElement>(".pfx-copy");
  const h1 = stage.querySelector<HTMLElement>(".post-title");
  const top = Array.from(stage.querySelectorAll<HTMLElement>(".post-meta"));
  const low = Array.from(stage.querySelectorAll<HTMLElement>(".post-lede, .post-actions"));
  const scrim = stage.querySelector<HTMLElement>(".pfx-scrim");
  const cue = stage.querySelector<HTMLElement>(".pfx-cue");
  const slug = open.dataset.slug || "";
  const rgb = (open.dataset.rgb || "52,211,153").split(",").map((v) => parseFloat(v) || 0) as [number, number, number];

  const zero: Box = { cx: 0, cy: 0, w: 1, h: 1 };
  const state: OpeningState = {
    e: 0,
    speed: 0,
    px: 0,
    py: 0,
    sweep: -1,
    from: { ...zero },
    to: { ...zero },
    radius: 20,
  };

  let runway = 1;
  let kH1 = 1;
  let dyCopy = 0;
  let liftTop = 0;
  let glReady = false;
  let glWanted = false;
  let handTimer = 0;
  let gl: OpeningGL | null = null;

  const measure = () => {
    const vw = stage.clientWidth;
    const vh = isTouch() ? Math.min(stage.clientHeight, screen.height || 9999) : innerHeight;
    const phone = isPhone();
    runway = Math.max(1, open.offsetHeight - stage.offsetHeight);
    if (art) {
      const a = offsetIn(art, stage);
      const hh = (a.w * 9) / 16;
      state.to = { cx: a.x + a.w / 2, cy: a.y + hh / 2, w: a.w, h: hh };
      state.radius = parseFloat(getComputedStyle(art).borderTopLeftRadius) || 20;
    }
    if (copy && h1) {
      const c = offsetIn(copy, stage);
      const th = h1.offsetHeight;
      // The title is larger in space. Its lines stay the same; it only scales.
      kH1 = phone ? 1.06 : Math.max(1, Math.min(1.5, (vw * 0.6) / Math.max(320, h1.offsetWidth)));
      liftTop = th * (kH1 - 1);
      // Clear of the chat button on a phone, which floats low on the right.
      const margin = phone ? 92 : Math.max(44, vh * 0.075);
      dyCopy = vh - margin - (c.y + c.h);
    }
    // The slab takes the room above the words and beside the back link, so its
    // rim never runs through either. Wide screens hang it to the right, phones
    // in the middle.
    if (art && copy) {
      const c = offsetIn(copy, stage);
      const backEl = stage.querySelector<HTMLElement>(".post-back");
      const back = backEl ? offsetIn(backEl, stage) : { x: 0, y: 0, w: 0, h: 0 };
      let headTop = c.y + dyCopy - liftTop;
      if (phone) {
        const roof = back.y + back.h + 12;
        const w = Math.max(vw * 0.72, Math.min(vw * 0.94, ((headTop - roof - 24) * 16) / 9));
        const sh = (w * 9) / 16;
        const need = roof + sh + 24;
        // A short phone: the words give way, down to where they sit settled.
        if (headTop < need) {
          dyCopy += need - headTop;
          headTop = need;
        }
        state.from = { cx: vw / 2, cy: (roof + headTop) / 2, w, h: sh };
      } else {
        const roof = 104;
        const room = Math.max(240, headTop - roof - 34);
        const right = Math.max(44, vw * 0.05);
        const w = Math.min(vw * 0.72, (Math.min(room, vh * 0.72) * 16) / 9, vw - right - (back.x + back.w + 32));
        const hh = (w * 9) / 16;
        state.from = { cx: vw - w / 2 - right, cy: roof + room / 2, w, h: hh };
      }
    }
    // The stage is a full screen tall, and the settled head is often shorter.
    // What follows comes up under the empty part, so no dead space opens up.
    const settled = stage.querySelector<HTMLElement>(".pfx-settled");
    if (settled) {
      const blank = Math.max(0, stage.offsetHeight - (settled.offsetTop + settled.offsetHeight));
      open.style.marginBottom = `${-blank}px`;
    }
    gl?.resize();
    apply();
  };

  const place = () => {
    const e = state.e;
    const f = 1 - e;
    // The art on the page, until the canvas is up: the same slab in CSS.
    if (art && !glReady) {
      const k = state.from.w / Math.max(1, state.to.w);
      const dx = (state.from.cx - state.to.cx) * f;
      const dy = (state.from.cy - state.to.cy) * f;
      const scale = 1 + (k - 1) * f;
      const ry = (-11.5 + state.px * 7) * f;
      const rx = (2.8 - state.py * 4.5) * f;
      art.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) perspective(1600px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    }
    if (h1) h1.style.transform = `translate3d(0, ${(dyCopy * f).toFixed(1)}px, 0) scale(${(1 + (kH1 - 1) * f).toFixed(4)})`;
    for (const el of top) el.style.transform = `translate3d(0, ${((dyCopy - liftTop) * f).toFixed(1)}px, 0)`;
    for (const el of low) el.style.transform = `translate3d(0, ${(dyCopy * f).toFixed(1)}px, 0)`;
    if (scrim) scrim.style.opacity = f.toFixed(3);
    if (cue) cue.style.opacity = (1 - smooth(0, 0.08, e)).toFixed(3);
  };

  const apply = () => {
    const p = clamp(scrollY / runway);
    state.e = easeE(p);
    showVeil(smooth(0.3, 0.95, p));
    place();
    syncHandoff();
    wake();
    if (glWanted && state.e < 0.999) {
      glWanted = false;
      startGL();
    }
  };

  // ---- The hand over between the canvas and the page -----------------------
  let onPageArt = false;
  const syncHandoff = () => {
    if (!glReady || !canvas || !art) return;
    const settled = state.e >= 0.999;
    if (settled === onPageArt) return;
    onPageArt = settled;
    art.classList.toggle("is-handed", !settled);
    canvas.classList.toggle("is-rest", settled);
  };

  // ---- Frames --------------------------------------------------------------
  let raf = 0;
  let running = false;
  let onScreen = true;
  let tx = 0;
  let ty = 0;
  let lastY = scrollY;
  let lastT = performance.now();
  let speedS = 0;
  const sweepAt = performance.now();
  let sweepFrom = 0;

  const need = () => onScreen && !document.hidden && state.e < 0.999;
  const loop = (now: number) => {
    if (!need()) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(loop);
    const dt = Math.max(1, now - lastT);
    lastT = now;
    const vy = Math.abs(scrollY - lastY) / dt;
    lastY = scrollY;
    speedS += (Math.min(1, vy / 3.2) - speedS) * 0.12;
    state.speed = speedS;
    state.px += (tx - state.px) * 0.05;
    state.py += (ty - state.py) * 0.05;
    // The light crosses once on arrival, then every so often.
    const t = (now - sweepAt) / 1000 - sweepFrom;
    state.sweep = glReady ? ((t * 0.11) % 1) * 3.6 - 1.1 : -1;
    if (!glReady) place();
    gl?.draw(now);
  };
  function wake() {
    if (running || !need()) return;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      tx = (e.clientX / innerWidth) * 2 - 1;
      ty = (e.clientY / innerHeight) * 2 - 1;
    },
    { passive: true, signal },
  );
  const io = new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    wake();
  });
  io.observe(stage);
  document.addEventListener("visibilitychange", wake, { signal });
  onScrollFrame(apply, signal);

  // A resize that changes the width solves everything again. Ignored on touch
  // when only the height moved: that is the browser bar sliding.
  let lastW = innerWidth;
  addEventListener(
    "resize",
    () => {
      if (isTouch() && innerWidth === lastW) return;
      lastW = innerWidth;
      measure();
    },
    { passive: true, signal },
  );
  // Fonts settling can move the words.
  document.fonts?.ready.then(() => {
    if (!signal.aborted) measure();
  });

  measure();

  // Arriving from a star at the end of another post.
  try {
    if (sessionStorage.getItem("pfx-dive")) {
      sessionStorage.removeItem("pfx-dive");
      emit("post:transition", { direction: "in", slug });
    }
  } catch {
    /* private window: no note, no matter */
  }

  // ---- Three only now, when the page is up ---------------------------------
  let idle = 0;
  async function startGL() {
    if (signal.aborted || !canvas) return;
    // Already deep in the article: wait until the reader comes back up.
    if (state.e >= 0.999) {
      glWanted = true;
      return;
    }
    const img = art?.querySelector<HTMLImageElement>("img");
    const big = open.dataset.art;
    const ext = img?.currentSrc?.endsWith(".avif") ? "avif" : "webp";
    const url = big ? `${big}-${isTouch() ? 1280 : 2560}.${ext}` : img?.currentSrc || img?.src;
    const loaded = await import("./opening-gl").catch(() => null);
    if (!loaded || signal.aborted) return; // the page's picture stays
    const { mountOpeningGL } = loaded;
    gl = mountOpeningGL(canvas, url, rgb, (slug.length % 13) / 13, state, () => {
      if (signal.aborted) return;
      glReady = true;
      sweepFrom = (performance.now() - sweepAt) / 1000;
      canvas.classList.add("is-up");
      // The page's picture stays until the canvas has faded in over it.
      handTimer = window.setTimeout(() => {
        if (signal.aborted || !art) return;
        art.style.transform = "";
        if (!onPageArt) art.classList.add("is-handed");
      }, 540);
      onPageArt = false;
      syncHandoff();
      wake();
    }, () => {
      // The GPU went away: back to the page's own picture, which never left the layout.
      glReady = false;
      clearTimeout(handTimer);
      const dead = gl;
      gl = null;
      dead?.stop();
      canvas.classList.remove("is-up", "is-rest");
      art?.classList.remove("is-handed");
      place();
    });
  }
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  };
  if (w.requestIdleCallback) idle = w.requestIdleCallback(startGL, { timeout: 900 });
  else idle = window.setTimeout(startGL, 120);

  return () => {
    cancelAnimationFrame(raf);
    running = false;
    io.disconnect();
    w.cancelIdleCallback?.(idle);
    clearTimeout(idle);
    clearTimeout(handTimer);
    gl?.stop();
    gl = null;
    open.style.marginBottom = "";
  };
}
