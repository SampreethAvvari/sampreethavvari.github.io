// Small helpers shared by the post effects.

/** A stable small integer for an id, for the composer. Same id, same note. */
export function noteOf(id: string, range = 12): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % range;
}

export type PostEvents = {
  "post:section": { index: number; id: string };
  "post:figure": { id: string; action: string };
  "post:hover": { kind: string; id: string; note: number };
  "post:transition": { direction: "in" | "out"; slug: string };
};

/** The sound hooks. Nothing on a post plays audio; the score listens. */
export function emit<K extends keyof PostEvents>(name: K, detail: PostEvents[K]): void {
  dispatchEvent(new CustomEvent(name, { detail }));
}

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Is this the full version, or the still one? Same test as the stylesheet. */
export const fxOn = () =>
  matchMedia("screen and (scripting: enabled) and (prefers-reduced-motion: no-preference)").matches;
export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isPhone = () => matchMedia("(max-width: 899px)").matches;
export const isTouch = () => matchMedia("(pointer: coarse)").matches;

/** Offset of an element from an ancestor. Reads layout, so a running
 *  transform or the page's arrival animation cannot throw it off. */
export function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** Calls cb at most once a frame on scroll and on real resizes. Height only
 *  resizes on a touch screen are the browser bar moving, so they are ignored. */
export function onScrollFrame(cb: () => void, signal: AbortSignal) {
  let raf = 0;
  const queue = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        cb();
      });
  };
  addEventListener("scroll", queue, { passive: true, signal });
  let lastW = innerWidth;
  addEventListener(
    "resize",
    () => {
      if (isTouch() && innerWidth === lastW) return;
      lastW = innerWidth;
      queue();
    },
    { passive: true, signal },
  );
  signal.addEventListener("abort", () => cancelAnimationFrame(raf));
  return queue;
}

/** Run a frame loop only while `el` is on screen and the tab is visible. */
export function whileVisible(el: Element, frame: (now: number) => void, signal: AbortSignal, margin = "80px") {
  let raf = 0;
  let onScreen = false;
  let running = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    frame(now);
  };
  const sync = () => {
    const want = onScreen && !document.hidden && !signal.aborted;
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
      onScreen = e.isIntersecting;
      sync();
    },
    { rootMargin: margin },
  );
  io.observe(el);
  document.addEventListener("visibilitychange", sync, { signal });
  signal.addEventListener("abort", () => {
    io.disconnect();
    running = false;
    cancelAnimationFrame(raf);
  });
}

export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};
