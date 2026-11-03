// Scrolling the world: free while travelling, with a magnetic pull at each
// stop. The page scrolls under the reader's own hand; when the hand stops,
// the nearest stop in the direction of travel draws the view in.
//
// Two traps this module exists to avoid. global.css sets scroll-behavior to
// smooth, so every scroll made from a frame loop asks for "instant". And on
// touch the finger drives the scroll and a fling of our own follows it, so a
// glide never fights the phone's native momentum.

import { layoutBox } from "../layout-box";
export type Motion = {
  /** Stop position, 0 to count - 1, from the current scroll. */
  progress(): number;
  /** Glide to a stop. */
  go(i: number, instant?: boolean): void;
  /** Which stop the view is at or last left. */
  here(): number;
  gliding(): boolean;
  measure(): void;
};

export type MotionOpts = {
  root: HTMLElement;
  stage: HTMLElement;
  count: number;
  span: number;
  signal: AbortSignal;
  onArrive: (i: number) => void;
  onLeave: (from: number, to: number, dir: number, durationMs: number) => void;
  /** A touch that starts here may belong to the element: decide on first move. */
  claimTouch?: (target: Element | null, sideways: boolean) => boolean;
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const INSTANT = "instant" as ScrollBehavior;

export function mountMotion(o: MotionOpts): Motion {
  const { root, stage, count, span, signal } = o;
  const LAST = count - 1;
  const on = { signal };
  let top0 = 0;
  let step = 1;
  // The page ends with the last stop, so the stops share exactly the scroll
  // there is: the last one sits at the very bottom, whatever the address bar does.
  const measure = () => {
    const sh = stage.offsetHeight || innerHeight;
    top0 = layoutBox(root).top;
    const room = document.documentElement.scrollHeight - innerHeight - top0;
    step = room > sh ? room / LAST : span * sh;
  };
  measure();
  const stepPx = () => step;
  const topFor = (i: number) => top0 + i * step;
  const progress = () => Math.max(0, Math.min(LAST, (scrollY - top0) / step));

  let glideRaf = 0;
  let isGliding = false;
  let lastInput = 0;
  let lastDir = 1;
  let settleLater = 0;
  let at = Math.round(progress());
  let fling = 0;
  let touching = false;

  const stopGlide = () => {
    if (glideRaf) cancelAnimationFrame(glideRaf);
    glideRaf = 0;
    isGliding = false;
  };
  const stopFling = () => {
    if (fling) cancelAnimationFrame(fling);
    fling = 0;
  };

  const arrive = (i: number) => {
    if (i !== at) at = i;
    o.onArrive(i);
  };

  const glide = (i: number) => {
    stopGlide();
    const from = scrollY;
    const to = Math.round(topFor(i));
    const dist = Math.abs(to - from);
    if (dist < 2) {
      if (dist) scrollTo({ top: to, behavior: INSTANT });
      arrive(i);
      return;
    }
    const steps = dist / stepPx();
    const dur = Math.max(420, Math.min(1500, 560 + steps * 800));
    const fromStop = at;
    if (fromStop !== i) o.onLeave(fromStop, i, i > fromStop ? 1 : -1, dur);
    isGliding = true;
    const t0 = performance.now();
    const frame = (t: number) => {
      if (signal.aborted || !isGliding) return;
      const k = Math.min(1, (t - t0) / dur);
      scrollTo({ top: from + (to - from) * ease(k), behavior: INSTANT });
      if (k < 1) glideRaf = requestAnimationFrame(frame);
      else {
        glideRaf = 0;
        isGliding = false;
        arrive(i);
      }
    };
    glideRaf = requestAnimationFrame(frame);
  };

  // When the hand has stopped: find the stop that pulls.
  const settle = () => {
    settleLater = 0;
    if (signal.aborted || isGliding || touching || fling) return;
    const p = progress();
    const k = Math.floor(p);
    const f = p - k;
    if (f < 0.0015 || k >= LAST) {
      const r = Math.round(p);
      if (Math.abs(p - r) < 0.0015 && r !== at) arrive(r);
      return;
    }
    // A small push in the direction of travel is enough to go on.
    const pxPast = f * stepPx();
    const pxBefore = (1 - f) * stepPx();
    const CARRY = 46;
    let target: number;
    if (lastDir > 0) target = pxPast > CARRY ? k + 1 : k;
    else target = pxBefore > CARRY ? k : k + 1;
    glide(target);
  };
  const armSettle = (ms = 140) => {
    clearTimeout(settleLater);
    settleLater = window.setTimeout(settle, ms);
  };

  // ---- the wheel scrolls the page itself; a stop only pulls afterwards
  addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) return;
      if (e.deltaY) lastDir = e.deltaY > 0 ? 1 : -1;
      lastInput = performance.now();
      if (isGliding) stopGlide();
      armSettle();
    },
    { passive: true, ...on },
  );

  let prevY = scrollY;
  let crossed = Math.round(progress());
  addEventListener(
    "scroll",
    () => {
      const y = scrollY;
      if (y !== prevY) {
        if (!isGliding && performance.now() - lastInput < 600) lastDir = y > prevY ? 1 : -1;
        prevY = y;
      }
      const near = Math.round(progress());
      if (near !== crossed) {
        // passing a stop by hand still counts as a move for the score
        if (!isGliding) {
          o.onLeave(crossed, near, near > crossed ? 1 : -1, 420);
          at = near;
        }
        crossed = near;
      }
      if (isGliding) return;
      // A scrollbar drag or a restored scroll waits longer before the pull.
      armSettle(performance.now() - lastInput < 500 ? 140 : 360);
    },
    { passive: true, ...on },
  );

  // ---- touch: the finger moves the world, a fling of our own slows like the page would
  let tx = 0;
  let ty = 0;
  let lastY = 0;
  let lastT = 0;
  let vel = 0;
  let decided = false;
  let free = false;
  let startTarget: Element | null = null;
  addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length > 1) {
        free = true;
        decided = true;
        return;
      }
      startTarget = e.target as Element | null;
      const inside = !!startTarget?.closest?.("[data-rw]");
      stopFling();
      if (isGliding) stopGlide();
      tx = e.touches[0].clientX;
      ty = lastY = e.touches[0].clientY;
      lastT = performance.now();
      vel = 0;
      decided = !inside;
      free = !inside;
      touching = inside;
    },
    { passive: true, ...on },
  );
  addEventListener(
    "touchmove",
    (e) => {
      if (free && decided) return;
      const y = e.touches[0].clientY;
      if (!decided) {
        decided = true;
        const dx = e.touches[0].clientX - tx;
        const dy = y - ty;
        const sideways = Math.abs(dx) > Math.abs(dy);
        free = !!o.claimTouch?.(startTarget, sideways);
        if (free) {
          touching = false;
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      const t = performance.now();
      const dy = lastY - y;
      vel = vel * 0.3 + (dy / Math.max(1, t - lastT)) * 0.7;
      lastY = y;
      lastT = t;
      if (dy) {
        lastInput = t;
        lastDir = dy > 0 ? 1 : -1;
      }
      scrollBy({ top: dy, behavior: INSTANT });
    },
    { passive: false, ...on },
  );
  addEventListener(
    "touchend",
    () => {
      if (free) {
        free = false;
        return;
      }
      if (!touching) return;
      touching = false;
      const t = performance.now();
      let v = t - lastT > 90 ? 0 : vel;
      if (Math.abs(v) < 0.08) {
        armSettle(60);
        return;
      }
      let prev = t;
      const run = (now: number) => {
        if (signal.aborted) {
          fling = 0;
          return;
        }
        const dt = Math.min(32, now - prev);
        prev = now;
        v *= Math.pow(0.94, dt / 16);
        // the page has two ends; a fling stops at them
        const atEnd = (v > 0 && scrollY >= topFor(LAST) - 1) || (v < 0 && scrollY <= top0 + 1);
        if (Math.abs(v) < 0.12 || atEnd) {
          fling = 0;
          armSettle(10);
          return;
        }
        lastInput = now;
        lastDir = v > 0 ? 1 : -1;
        scrollBy({ top: v * dt, behavior: INSTANT });
        fling = requestAnimationFrame(run);
      };
      fling = requestAnimationFrame(run);
    },
    { passive: true, ...on },
  );

  // ---- keys: one stop at a time
  addEventListener(
    "keydown",
    (e) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt?.closest?.("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (tgt?.closest?.("[role=dialog], .chat-panel")) return;
      const down = e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey);
      const up = e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey);
      if (!down && !up) return;
      const here = isGliding ? at : Math.round(progress());
      // nothing lies past either end
      if ((down && here >= LAST) || (up && here <= 0)) return;
      e.preventDefault();
      go(here + (down ? 1 : -1));
    },
    on,
  );

  function go(i: number, instant = false) {
    const j = Math.max(0, Math.min(LAST, i));
    stopFling();
    clearTimeout(settleLater);
    if (instant) {
      stopGlide();
      scrollTo({ top: topFor(j), behavior: INSTANT });
      prevY = scrollY;
      crossed = j;
      arrive(j);
      return;
    }
    glide(j);
  }

  signal.addEventListener("abort", () => {
    stopGlide();
    stopFling();
    clearTimeout(settleLater);
  });

  return {
    progress,
    go,
    here: () => at,
    gliding: () => isGliding,
    measure,
  };
}
