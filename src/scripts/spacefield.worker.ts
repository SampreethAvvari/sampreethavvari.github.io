// Draws the star field on an OffscreenCanvas, off the page's main thread:
// starting WebGL, compiling the shaders and every frame's drawing happen here,
// so none of it can hold up a click, a scroll or the page's first paint.
// The page sends its scroll, section colours, size and visibility.
import { createSky, type Sky, type SkyInput } from "./spacefield-gl";

type Msg =
  | { type: "init"; canvas: OffscreenCanvas; isMobile: boolean; w: number; h: number; dpr: number; input: SkyInput }
  | { type: "resize"; w: number; h: number; dpr: number }
  | { type: "input"; input: Partial<SkyInput> }
  | { type: "hidden"; hidden: boolean };

const scope = self as unknown as {
  requestAnimationFrame?: (cb: () => void) => number;
  postMessage: (m: unknown) => void;
  onmessage: ((e: MessageEvent<Msg>) => void) | null;
};
const nextFrame = (cb: () => void) => (scope.requestAnimationFrame ? scope.requestAnimationFrame(cb) : setTimeout(cb, 16));

let sky: Sky | null = null;
let ready = false;
let hidden = false;
let running = false;
const input: SkyInput = { scrollY: 0, th1: [0.36, 0.55, 0.94], th2: [0.2, 0.83, 0.6], arrivedAt: null };

const loop = () => {
  if (running || !ready) return;
  running = true;
  const tick = () => {
    if (hidden || !sky) {
      running = false;
      return;
    }
    sky.frame(input);
    nextFrame(tick);
  };
  nextFrame(tick);
};

scope.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    sky = createSky(m.canvas, m.isMobile);
    if (!sky) return scope.postMessage({ type: "fail" });
    Object.assign(input, m.input);
    sky.resize(m.w, m.h, m.dpr);
    sky.whenReady((ok) => {
      if (!ok) return scope.postMessage({ type: "fail" });
      ready = true;
      scope.postMessage({ type: "ready" });
      loop();
    }, nextFrame);
  } else if (m.type === "resize") sky?.resize(m.w, m.h, m.dpr);
  else if (m.type === "input") Object.assign(input, m.input);
  else if (m.type === "hidden") {
    hidden = m.hidden;
    if (!hidden) loop();
  }
};
