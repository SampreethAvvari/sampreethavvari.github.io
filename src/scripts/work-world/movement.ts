// Scroll for the Work world. The page scrolls freely under the visitor's hand
// while travelling; when the hand stops, a glide carries it to the nearest
// stop in the direction it was going. Any new input cancels the glide at once.
//
// Traps handled here: global.css sets scroll-behavior smooth, so every scroll
// from a frame loop passes behavior "instant". On touch the finger moves the
// page directly with our own fling, so a glide never fights native momentum,
// and the first touchmove decides between an inner scroller and the page.

import { clamp, inOut } from "./math";

export interface MovementOptions {
  root: HTMLElement;
  stage: HTMLElement;
  count: number;
  /** Screens of scroll per stop. */
  span: number;
  reduced: boolean;
  signal: AbortSignal;
  /** Called with the position in stops whenever it changes. */
  onMove(q: number): void;
  /** A glide has finished at this stop. */
  onArrive(index: number): void;
  /** A glide between stops is starting. */
  onDepart?(from: number, to: number, ms: number): void;
  /** Elements whose own scrolling a touch or wheel may belong to. */
  scrollers?: string;
  /** While true, the page does not move by itself. */
  hold(): boolean;
}

const INSTANT = "instant" as ScrollBehavior;

export function mountMovement(o: MovementOptions) {
  const { root, stage, count, span, reduced, signal } = o;
  const sig = { signal };
  let H = stage.offsetHeight || innerHeight;
  const spanPx = () => span * H;
  const topAt = (q: number) => root.offsetTop + q * spanPx();
  const qNow = () => clamp((scrollY - root.offsetTop) / Math.max(1, spanPx()), 0, count - 1);
  const inStage = () => scrollY >= root.offsetTop - 2 && scrollY <= topAt(count - 1) + 2;
  // Nothing lies past the last stop. Our own scrolling never leaves it, so the
  // last screen stays whole whatever the phone's address bar is doing.
  const push = (d: number) => {
    const max = topAt(count - 1);
    const next = scrollY + d;
    scrollBy({ top: next > max ? Math.min(0, max - scrollY) : d, behavior: INSTANT });
  };

  let glideId = 0;
  let gliding = false;
  let lastInput = 0;
  let lastDir = 0;
  let idle = 0;
  let fling = 0;
  let arrived = -1;
  let lastQ = -1;
  let departed = -1;
  let departedAt = 0;

  const stopFling = () => {
    if (fling) cancelAnimationFrame(fling);
    fling = 0;
  };
  const cancelGlide = () => {
    glideId++;
    gliding = false;
  };

  function glide(to: number, ms?: number) {
    cancelGlide();
    stopFling();
    const id = glideId;
    const from = scrollY;
    const target = Math.round(topAt(to));
    const dist = Math.abs(target - from);
    if (dist < 2) {
      settle(to);
      return;
    }
    const dur = ms ?? clamp((dist / spanPx()) * 1500, 420, 1500);
    if (reduced) {
      scrollTo({ top: target, behavior: INSTANT });
      settle(to);
      return;
    }
    gliding = true;
    const fromStop = Math.round(qNow());
    // A glide that replaces one going to the same stop is the same move.
    if (fromStop !== to && (departed !== to || performance.now() - departedAt > 1800)) {
      departed = to;
      departedAt = performance.now();
      o.onDepart?.(fromStop, to, dur);
    }
    const t0 = performance.now();
    const step = (t: number) => {
      if (id !== glideId || signal.aborted) return;
      const k = Math.min(1, (t - t0) / dur);
      scrollTo({ top: from + (target - from) * inOut(k), behavior: INSTANT });
      if (k < 1) requestAnimationFrame(step);
      else {
        gliding = false;
        settle(to);
      }
    };
    requestAnimationFrame(step);
  }

  function settle(i: number) {
    if (arrived !== i) {
      arrived = i;
      o.onArrive(i);
    }
  }

  // The magnet: when everything has gone still, find the stop to rest at.
  // A small push in one direction is enough to carry on to the next stop.
  function magnet() {
    if (gliding || o.hold() || !inStage()) return;
    const q = qNow();
    const i = Math.floor(q);
    const f = q - i;
    if (f < 0.004 || f > 0.996) {
      settle(Math.round(q));
      return;
    }
    const fresh = performance.now() - lastInput < 900;
    let to: number;
    if (fresh && lastDir > 0) to = f > 0.05 ? i + 1 : i;
    else if (fresh && lastDir < 0) to = f < 0.95 ? i : i + 1;
    else to = Math.round(q);
    glide(clamp(to, 0, count - 1));
  }

  const wake = (delay = 150) => {
    clearTimeout(idle);
    idle = window.setTimeout(magnet, delay);
  };

  const report = () => {
    const q = qNow();
    if (Math.abs(q - lastQ) > 1e-5) {
      lastQ = q;
      if (Math.abs(q - arrived) > 0.02) arrived = -1;
      o.onMove(q);
    }
  };

  addEventListener("scroll", () => {
    report();
    if (!gliding) wake();
  }, { passive: true, ...sig });

  addEventListener("wheel", (e) => {
    if (e.ctrlKey) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    if (!dy) return;
    // A wheel over a panel's inner list scrolls that list first.
    lastInput = performance.now();
    lastDir = dy > 0 ? 1 : -1;
    if (gliding) cancelGlide();
    stopFling();
    wake(180);
  }, { passive: true, ...sig });

  // ---- touch: our own drag and fling
  const scrollers = o.scrollers ?? "[data-ww-scroll]";
  let touchX = 0;
  let touchY = 0;
  let lastY = 0;
  let lastX = 0;
  let lastT = 0;
  let v = 0;
  let owned = false;
  let decided = false;
  let scroller: HTMLElement | null = null;
  let free = false;
  let sideways = false;
  addEventListener("touchstart", (e) => {
    if (e.touches.length > 1) return;
    stopFling();
    cancelGlide();
    clearTimeout(idle);
    const t = e.touches[0];
    touchX = lastX = t.clientX;
    touchY = lastY = t.clientY;
    lastT = performance.now();
    v = 0;
    const target = e.target as Element | null;
    owned = !!target?.closest?.("[data-ww-stage]");
    scroller = (target?.closest?.(scrollers) as HTMLElement | null) ?? null;
    decided = !scroller;
    free = false;
    sideways = false;
  }, { passive: true, ...sig });
  addEventListener("touchmove", (e) => {
    if (!owned || e.touches.length > 1) return;
    const t = e.touches[0];
    if (!decided) {
      decided = true;
      if (scroller) {
        const dx = t.clientX - touchX;
        const dy = t.clientY - touchY;
        const horiz = Math.abs(dx) > Math.abs(dy);
        const canX = scroller.scrollWidth > scroller.clientWidth + 1;
        const canY = scroller.scrollHeight > scroller.clientHeight + 1;
        free = horiz ? canX : canY && (dy < 0 ? scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1 : scroller.scrollTop > 0);
      }
    }
    if (free) return;
    if (e.cancelable) e.preventDefault();
    const now = performance.now();
    const dy = lastY - t.clientY;
    const dx = lastX - t.clientX;
    // A sideways drag on the station turns the ring just as well.
    if (!sideways && Math.abs(t.clientX - touchX) > Math.abs(t.clientY - touchY) * 1.4 && Math.abs(t.clientX - touchX) > 12) sideways = true;
    const delta = sideways ? dx * 1.6 : dy;
    v = v * 0.3 + (delta / Math.max(1, now - lastT)) * 0.7;
    lastY = t.clientY;
    lastX = t.clientX;
    lastT = now;
    if (delta) {
      lastInput = now;
      lastDir = delta > 0 ? 1 : -1;
    }
    push(delta);
  }, { passive: false, ...sig });
  addEventListener("touchend", () => {
    if (!owned || free) return;
    owned = false;
    const now = performance.now();
    let vel = now - lastT > 90 ? 0 : v;
    if (Math.abs(vel) < 0.05) {
      wake(60);
      return;
    }
    let prev = now;
    const run = (t: number) => {
      if (signal.aborted) return;
      const dt = Math.min(32, t - prev);
      prev = t;
      vel *= Math.pow(0.95, dt / 16);
      if (Math.abs(vel) < 0.12) {
        fling = 0;
        wake(30);
        return;
      }
      lastInput = t;
      lastDir = vel > 0 ? 1 : -1;
      push(vel * dt);
      fling = requestAnimationFrame(run);
    };
    fling = requestAnimationFrame(run);
  }, { passive: true, ...sig });

  // ---- keys: page keys and space move a whole stop, arrows too on this stage
  addEventListener("keydown", (e) => {
    const tgt = e.target as HTMLElement | null;
    if (tgt?.closest?.("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!inStage()) return;
    if (e.key === "Home" || e.key === "End") {
      if (tgt?.closest?.("[data-ww-scroll]")) return;
      e.preventDefault();
      lastInput = performance.now();
      lastDir = e.key === "End" ? 1 : -1;
      glide(e.key === "End" ? count - 1 : 0);
      return;
    }
    const down = e.key === "ArrowDown" || e.key === "PageDown" || e.key === "ArrowRight" || (e.key === " " && !e.shiftKey);
    const up = e.key === "ArrowUp" || e.key === "PageUp" || e.key === "ArrowLeft" || (e.key === " " && e.shiftKey);
    if (!down && !up) return;
    // Space on a focused link or button belongs to that control.
    if (e.key === " " && tgt?.closest?.("a, button, summary")) return;
    const q = qNow();
    const at = Math.round(q);
    const to = down ? (q > at + 0.01 ? at + 1 : at + 1) : q < at - 0.01 ? at - 1 : at - 1;
    if (to > count - 1) return; // past the last stop the page carries on as normal
    if (to < 0) return;
    e.preventDefault();
    lastInput = performance.now();
    lastDir = down ? 1 : -1;
    glide(to);
  }, sig);

  // Only a real change of size moves the stops: phones change height as the
  // address bar folds, and 100svh does not.
  let lastW = innerWidth;
  addEventListener("resize", () => {
    const h = stage.offsetHeight || innerHeight;
    if (innerWidth === lastW && Math.abs(h - H) < 2) return;
    const q = qNow();
    lastW = innerWidth;
    H = h;
    scrollTo({ top: topAt(q), behavior: INSTANT });
    report();
  }, { passive: true, ...sig });

  report();
  return {
    q: qNow,
    go: (i: number, ms?: number) => glide(clamp(i, 0, count - 1), ms),
    jump(i: number) {
      cancelGlide();
      scrollTo({ top: topAt(clamp(i, 0, count - 1)), behavior: INSTANT });
      report();
    },
    /** Push the page by a number of pixels, from a pointer drag. */
    drag(dy: number) {
      cancelGlide();
      stopFling();
      lastInput = performance.now();
      if (dy) lastDir = dy > 0 ? 1 : -1;
      push(dy);
      wake(180);
    },
    /** Let go of a drag with this velocity, in pixels per ms. */
    fling(vel0: number) {
      stopFling();
      let vel = vel0;
      let prev = performance.now();
      const run = (t: number) => {
        if (signal.aborted) return;
        const dt = Math.min(32, t - prev);
        prev = t;
        vel *= Math.pow(0.94, dt / 16);
        if (Math.abs(vel) < 0.12) {
          fling = 0;
          wake(30);
          return;
        }
        lastInput = t;
        lastDir = vel > 0 ? 1 : -1;
        push(vel * dt);
        fling = requestAnimationFrame(run);
      };
      fling = requestAnimationFrame(run);
    },
    topAt,
  };
}
export type Movement = ReturnType<typeof mountMovement>;
