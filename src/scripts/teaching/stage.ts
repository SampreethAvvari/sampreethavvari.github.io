// The opening of the Teaching pages: a full screen where a material's cover
// hangs in space as light. Everything answers to one number, how far the opening
// has been scrolled, so scrolling back up plays it backwards.
//
// The layout with no script is the real one. The runway, the pin and the canvas
// only exist once this has run (is-live), and the page's own picture stays in
// place until the canvas has drawn over it, and comes back if the GPU goes.

import { hasWebGL2 } from "../gl-probe";
import { afterImages } from "../lifecycle";
import { clamp, fxOn, isTouch, onScrollFrame, smooth } from "../post-fx/util";
import type { Holo, HoloBox, HoloState } from "./holo-gl";

export function mountStage(signal: AbortSignal): void | (() => void) {
  const hero = document.querySelector<HTMLElement>("[data-ts-hero]");
  const stage = hero?.querySelector<HTMLElement>(".ts-stage");
  if (!hero || !stage) return;
  // Stillness and no script: the plain page, with the picture where it is.
  if (!fxOn()) return;

  let canvas = stage.querySelector<HTMLCanvasElement>(".ts-gl");
  const copy = stage.querySelector<HTMLElement>(".ts-copy");
  const scrim = stage.querySelector<HTMLElement>(".ts-scrim");
  const cue = stage.querySelector<HTMLElement>(".ts-cue");
  const arts = Array.from(stage.querySelectorAll<HTMLElement>(".ts-art"));
  const rgb = (hero.dataset.rgb || "52,211,153").split(",").map((v) => parseFloat(v) || 0) as [number, number, number];
  const root = document.documentElement;

  const state: HoloState = { p: 0, speed: 0, px: 0, py: 0, hx: -9999, hy: -9999, push: 0 };

  // The page's own sky is held back from the start (index.ts), and once the canvas
  // is up it would be covered anyway. glOut lets it go ahead when there will be no
  // canvas, or the GPU has gone.
  let glOut = false;

  let runway = 1;
  let glReady = false;
  let gl: Holo | null = null;
  let booting = false;
  let wasMounted = false;
  let onScreen = true;

  const boxes = (): HoloBox[] =>
    arts.map((a) => {
      // Layout boxes, so a transform on the page's picture cannot throw it off.
      let x = 0;
      let y = 0;
      let n: HTMLElement | null = a;
      while (n && n !== stage) {
        x += n.offsetLeft;
        y += n.offsetTop;
        n = n.offsetParent as HTMLElement | null;
      }
      // Its left and top are its middle: the stylesheet centres it with a transform.
      return { cx: x, cy: y, w: a.offsetWidth, h: a.offsetHeight };
    });

  const measure = () => {
    // A screen too short for the words does not pin: they must all be reachable.
    hero.classList.remove("is-tall");
    const needs = (copy?.offsetTop ?? 0) + (copy?.offsetHeight ?? 0);
    const tall = needs > stage.clientHeight + 2;
    hero.classList.toggle("is-tall", tall);
    runway = Math.max(1, tall ? stage.offsetHeight * 0.8 : hero.offsetHeight - stage.offsetHeight);
    gl?.setBoxes(boxes());
    gl?.resize();
    apply();
  };

  const place = () => {
    const f = smooth(0.05, 1, state.p);
    // The page's picture, until the canvas is up: the same object, only flatter.
    if (!glReady) {
      for (const a of arts) {
        const ry = (-11 + state.px * 7) * (1 - f);
        const rx = (3 - state.py * 5) * (1 - f);
        a.style.transform = `translate(-50%, -50%) perspective(1600px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${(1 + f * 1.6).toFixed(3)})`;
        a.style.opacity = (1 - smooth(0.2, 0.7, f)).toFixed(3);
      }
    }
  };

  const apply = () => {
    state.p = clamp(scrollY / runway);
    const leave = smooth(0.02, 0.42, state.p);
    if (copy) {
      // The words fall back into the distance as the camera goes forward.
      copy.style.transform = leave > 0 ? `translate3d(0, ${(-leave * 46).toFixed(1)}px, 0) scale(${(1 - leave * 0.16).toFixed(4)})` : "";
      copy.style.opacity = (1 - smooth(0.04, 0.4, state.p)).toFixed(3);
      copy.classList.toggle("is-gone", leave >= 0.999);
    }
    if (scrim) scrim.style.opacity = (1 - smooth(0.05, 0.6, state.p)).toFixed(3);
    if (cue) cue.style.opacity = (1 - smooth(0, 0.08, state.p)).toFixed(3);
    place();
    // While the canvas is opaque the page's own sky behind it can rest.
    root.classList.toggle("in-cx", !glOut && state.p < 0.55);
    // Past the end nothing of it is left to show, and it must not stay on its last frame.
    canvas?.classList.toggle("is-rest", state.p >= 0.995);
    wake();
    keepOrRelease();
  };

  // ---- Frames --------------------------------------------------------------
  let raf = 0;
  let running = false;
  let tx = 0;
  let ty = 0;
  let wantPush = 0;
  let pulse = 0;
  let lastY = scrollY;
  let lastT = performance.now();
  let speedS = 0;

  const need = () => onScreen && !document.hidden && state.p < 0.995;
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
    state.px += (tx - state.px) * 0.055;
    state.py += (ty - state.py) * 0.055;
    pulse *= 0.93;
    state.push += (wantPush + pulse - state.push) * 0.09;
    if (!glReady) place();
    gl?.draw(now);
  };
  function wake() {
    if (running || !need()) return;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  const point = (e: PointerEvent) => {
    tx = (e.clientX / innerWidth) * 2 - 1;
    ty = (e.clientY / innerHeight) * 2 - 1;
    state.hx = e.clientX;
    state.hy = e.clientY;
    wantPush = 0.55;
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") {
        // A finger parts the light too, without turning the whole object.
        state.hx = e.clientX;
        state.hy = e.clientY;
        wantPush = 0.7;
        return;
      }
      point(e);
    },
    { passive: true, signal },
  );
  stage.addEventListener(
    "pointerdown",
    (e) => {
      state.hx = e.clientX;
      state.hy = e.clientY;
      pulse = 2.4;
    },
    { passive: true, signal },
  );
  addEventListener("pointerup", () => { if (isTouch()) wantPush = 0; }, { passive: true, signal });
  addEventListener("pointercancel", () => { wantPush = 0; }, { passive: true, signal });
  document.addEventListener("pointerleave", () => { wantPush = 0; }, { passive: true, signal });

  const io = new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    wake();
  });
  io.observe(stage);
  document.addEventListener("visibilitychange", wake, { signal });
  onScrollFrame(apply, signal);
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
  document.fonts?.ready.then(() => {
    if (!signal.aborted) measure();
  });

  // ---- Three only now, when the page is up ---------------------------------
  const handOver = (on: boolean) => {
    arts.forEach((a) => {
      if (on) {
        a.classList.add("is-handed");
      } else {
        a.classList.remove("is-handed");
        a.style.visibility = "";
      }
    });
  };
  let handTimer = 0;
  async function startGL() {
    if (signal.aborted || !canvas || booting || gl) return;
    // No GPU: the page's picture stays, and the page's sky goes ahead.
    const giveUp = () => {
      glOut = true;
      root.classList.remove("in-cx");
    };
    if (!hasWebGL2()) return giveUp();
    booting = true;
    // The file the page chose for this size, once it has chosen: the second cover
    // on the hub loads lazily, so the words and the first cover go first.
    const urlOf = (a: HTMLElement) => () => {
      const img = a.querySelector<HTMLImageElement>("img");
      const src = () => img?.currentSrc || img?.src || (a.dataset.art ? `${a.dataset.art}.webp` : "");
      if (!img || (img.complete && img.currentSrc)) return Promise.resolve(src());
      return new Promise<string>((done) => {
        const go = () => {
          clearTimeout(cap);
          done(src());
        };
        const cap = window.setTimeout(go, 5000);
        img.addEventListener("load", go, { once: true, signal });
        img.addEventListener("error", go, { once: true, signal });
      });
    };
    const loaded = await import("./holo-gl").catch(() => null);
    booting = false;
    if (signal.aborted || gl) return;
    if (!loaded) return giveUp(); // the page's picture stays
    const b = boxes();
    const low = isTouch() || innerWidth < 900;
    const again = wasMounted || state.p > 0.02;
    const made = loaded.mountHolo(
      canvas,
      arts.map((a, i) => ({ url: urlOf(a), box: b[i], z: parseFloat(a.dataset.z || "0") || 0, seed: ((i + 1) * 0.37 + (hero!.dataset.seed ? parseFloat(hero!.dataset.seed) : 0.2)) % 1 })),
      rgb,
      state,
      () => {
        if (signal.aborted) return;
        glReady = true;
        canvas?.classList.add("is-up");
        clearTimeout(handTimer);
        // The page's picture stays until the canvas has faded in over it.
        handTimer = window.setTimeout(() => {
          if (signal.aborted || !glReady) return;
          handOver(true);
        }, 640);
        apply();
      },
      () => {
        // The GPU went away: the page's own picture, which never left the layout.
        glReady = false;
        glOut = true;
        clearTimeout(handTimer);
        canvas?.classList.remove("is-up");
        handOver(false);
        place();
        apply();
      },
      () => {
        glReady = true;
        glOut = false;
        canvas?.classList.add("is-up");
        handTimer = window.setTimeout(() => {
          if (!signal.aborted && glReady) handOver(true);
        }, 640);
        apply();
      },
      { low, gathered: again },
    );
    if (!made) return giveUp(); // no WebGL: the page's picture stays
    gl = made;
    wasMounted = true;
    wake();
  }

  // A phone gets its GPU memory back once the opening is far above the screen,
  // and the object is built again on the way back up.
  function keepOrRelease() {
    if (!isTouch()) return;
    const far = scrollY > runway + innerHeight * 2.5;
    if (far && gl) {
      gl.stop();
      gl = null;
      glReady = false;
      clearTimeout(handTimer);
      if (canvas) {
        const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
        fresh.classList.remove("is-up");
        canvas.replaceWith(fresh);
        canvas = fresh;
      }
      handOver(false);
      place();
    } else if (!far && !gl && wasMounted && !booting && scrollY < runway + innerHeight) {
      void startGL();
    }
  }

  // In the next frame and not now: this runs during DOMContentLoaded, right after
  // the page's first long layout, and reading layout here would add to that task.
  const begin = requestAnimationFrame(() => {
    hero.classList.add("is-live");
    measure();
  });

  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  };
  // Not until the words and the page's picture are on screen: the largest paint
  // comes first, then a frame, then a quiet moment.
  let idle = 0;
  afterImages(signal, () => {
    requestAnimationFrame(() => {
      if (signal.aborted) return;
      if (w.requestIdleCallback) idle = w.requestIdleCallback(() => void startGL(), { timeout: 1200 });
      else idle = window.setTimeout(() => void startGL(), 200);
    });
  });

  return () => {
    cancelAnimationFrame(begin);
    cancelAnimationFrame(raf);
    running = false;
    io.disconnect();
    w.cancelIdleCallback?.(idle);
    clearTimeout(idle);
    clearTimeout(handTimer);
    gl?.stop();
    gl = null;
    root.classList.remove("in-cx");
  };
}
