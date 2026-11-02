// Draws the hero's orbit rings off the page's main thread, so they keep
// turning while the page is busy loading or the visitor scrolls. The page
// sends sizes, the pointer and the sky's colours; see OrbitHero.astro.

import { createOrbit, type Orbit, type OrbitInput } from "./orbit-draw";

type Msg =
  | { type: "init"; back: OffscreenCanvas; front: OffscreenCanvas; size: number; dpr: number; input: OrbitInput }
  | { type: "resize"; size: number; dpr: number }
  | { type: "input"; input: Partial<OrbitInput> }
  | { type: "run"; run: boolean };

const scope = self as unknown as {
  requestAnimationFrame?: (cb: (t: number) => void) => number;
  onmessage: ((e: MessageEvent<Msg>) => void) | null;
};
const raf = scope.requestAnimationFrame
  ? scope.requestAnimationFrame.bind(scope)
  : (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

let orbit: Orbit | null = null;
let input: OrbitInput;
let running = false;
let looping = false;
let last = 0;

function loop(now: number) {
  if (!running || !orbit) {
    looping = false;
    return;
  }
  orbit.frame(last ? now - last : 0, input);
  last = now;
  raf(loop);
}
function wake() {
  if (looping || !running || !orbit) return;
  looping = true;
  last = 0;
  raf(loop);
}

scope.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    orbit = createOrbit(m.back, m.front);
    input = m.input;
    if (!orbit) return;
    orbit.resize(m.size, m.dpr);
    orbit.draw(input);
    running = true;
    wake();
  } else if (m.type === "resize") {
    orbit?.resize(m.size, m.dpr);
    if (orbit && !running) orbit.draw(input);
  } else if (m.type === "input") {
    input = { ...input, ...m.input };
  } else if (m.type === "run") {
    running = m.run;
    wake();
  }
};
