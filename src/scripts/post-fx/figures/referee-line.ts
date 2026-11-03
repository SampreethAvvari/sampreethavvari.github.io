// Try to be the referee. The post's whole frame scores sit on a line, and you
// drag the bar: everything at or past it passes. You want all three of Maya's
// real shots to pass and Ravi, a different person, to fail. There is no such
// place on the line, and you can feel that by trying. The voice scores below
// use the post's other numbers, where a bar does work, at 0.62.
//
// The scores are the post's: 0.39, 0.39, 0.51 and 0.48 for the frames; the best
// impostor line at 0.613, real lines at 0.647 and up, the bar at 0.62.
//
// Sound hooks:
//   post:figure { id: "referee-line", action: "move" | "verdict:<n>" | "tried-all" | "voice-clear" }
//   post:hover { kind: "frame", id: "<who>-<score>", note }

import type { Figure } from "./index";
import { clamp, emit, h, noteOf } from "../util";
import { fig, frame } from "./parts";

type Mark = { who: string; score: number; real: boolean; stack?: number; side?: "left" | "right" };

const FRAMES: Mark[] = [
  { who: "Maya", score: 0.39, real: true, stack: 0 },
  { who: "Maya", score: 0.39, real: true, stack: 1 },
  { who: "Ravi", score: 0.48, real: false, stack: 1 },
  { who: "Maya", score: 0.51, real: true },
];
const VOICE: Mark[] = [
  { who: "Best impostor", score: 0.613, real: false, side: "left" },
  { who: "Real lines", score: 0.647, real: true, side: "right" },
];

function track(
  host: HTMLElement,
  opts: {
    label: string;
    min: number;
    max: number;
    start: number;
    marks: Mark[];
    digits: number;
    signal: AbortSignal;
    onMove: (bar: number, dragged: boolean) => void;
  },
) {
  const wrap = h("div", "pfx-ref-track");
  const rail = h("div", "pfx-ref-rail");
  const fail = h("div", "pfx-ref-fail");
  const pass = h("div", "pfx-ref-pass");
  rail.append(fail, pass);
  const axis = h("div", "pfx-ref-axis");
  const ticks = 5;
  for (let i = 0; i < ticks; i++) {
    const v = opts.min + ((opts.max - opts.min) * i) / (ticks - 1);
    const t = h("span", "pfx-ref-tick", v.toFixed(opts.digits === 3 ? 2 : 2));
    t.style.left = `${(i / (ticks - 1)) * 100}%`;
    axis.append(t);
  }
  const pct = (v: number) => ((v - opts.min) / (opts.max - opts.min)) * 100;
  const cards = opts.marks.map((m) => {
    const c = h("div", `pfx-ref-card ${m.real ? "is-real" : "is-other"}`);
    c.style.left = `${pct(m.score)}%`;
    if (m.stack) c.classList.add("is-up");
    if (m.side) c.classList.add(`is-${m.side}`);
    const tick = h("i", "pfx-ref-mark");
    tick.style.left = `${pct(m.score)}%`;
    rail.append(tick);
    const face = h("span", "pfx-ref-who", m.who);
    const num = h("b", "pfx-ref-num", m.score.toFixed(opts.digits));
    c.append(face, num);
    c.addEventListener(
      "pointerenter",
      () => emit("post:hover", { kind: "frame", id: `${m.who}-${m.score}`, note: noteOf(`${m.who}-${m.score}`) }),
      { passive: true, signal: opts.signal },
    );
    rail.append(c);
    return { m, c };
  });
  const bar = h("div", "pfx-ref-bar");
  bar.setAttribute("role", "slider");
  bar.tabIndex = 0;
  bar.setAttribute("aria-label", opts.label);
  bar.setAttribute("aria-valuemin", String(opts.min));
  bar.setAttribute("aria-valuemax", String(opts.max));
  const value = h("span", "pfx-ref-val");
  const grip = h("span", "pfx-ref-grip");
  bar.append(value, grip);
  rail.append(bar);
  wrap.append(rail, axis);
  host.append(wrap);

  let cur = opts.start;
  const set = (v: number, dragged: boolean) => {
    cur = clamp(v, opts.min, opts.max);
    const p = pct(cur);
    bar.style.left = `${p}%`;
    fail.style.width = `${p}%`;
    pass.style.left = `${p}%`;
    pass.style.width = `${100 - p}%`;
    value.textContent = cur.toFixed(opts.digits === 3 ? 3 : 2);
    bar.setAttribute("aria-valuenow", cur.toFixed(3));
    bar.setAttribute("aria-valuetext", `Bar at ${cur.toFixed(3)}`);
    cards.forEach(({ m, c }) => c.classList.toggle("is-pass", m.score >= cur));
    opts.onMove(cur, dragged);
  };
  const fromX = (x: number) => {
    const r = rail.getBoundingClientRect();
    return opts.min + clamp((x - r.left) / r.width) * (opts.max - opts.min);
  };
  let drag = false;
  rail.addEventListener(
    "pointerdown",
    (e) => {
      drag = true;
      rail.setPointerCapture(e.pointerId);
      wrap.classList.add("is-drag");
      set(fromX(e.clientX), true);
      e.preventDefault();
    },
    { signal: opts.signal },
  );
  rail.addEventListener(
    "pointermove",
    (e) => {
      if (drag) set(fromX(e.clientX), true);
    },
    { signal: opts.signal },
  );
  const end = () => {
    drag = false;
    wrap.classList.remove("is-drag");
  };
  rail.addEventListener("pointerup", end, { signal: opts.signal });
  rail.addEventListener("pointercancel", end, { signal: opts.signal });
  bar.addEventListener(
    "keydown",
    (e) => {
      const step = (opts.max - opts.min) / 50;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(cur - step, true);
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") set(cur + step, true);
      else return;
      e.preventDefault();
    },
    { signal: opts.signal },
  );
  set(opts.start, false);
  return { set };
}

const render: Figure = ({ root, signal }) => {
  frame(root, "Try to be the referee", "Drag the bar. Everything at or past it passes. Let all of Maya through and stop Ravi.");

  const faceBox = h("div", "pfx-ref-box");
  const faceHead = h("div", "pfx-ref-head");
  faceHead.append(h("span", "pfx-ref-name", "Whole frame, against Maya's sheet"));
  faceBox.append(faceHead);
  root.append(faceBox);

  const checks = h("div", "pfx-ref-checks");
  const c1 = h("div", "pfx-ref-check");
  const c2 = h("div", "pfx-ref-check");
  checks.append(c1, c2);

  const verdict = h("div", "pfx-ref-verdict");
  verdict.setAttribute("aria-live", "polite");

  // The four places a bar can be, and whether each has been visited.
  const seen = new Set<number>();
  let lastRegion = -1;
  let doneTried = false;
  const onFace = (b: number, dragged: boolean) => {
    const maya = FRAMES.filter((m) => m.real && m.score >= b).length;
    const ravi = 0.48 >= b;
    c1.textContent = `Maya: ${maya} of 3 pass`;
    c1.classList.toggle("is-ok", maya === 3);
    c2.textContent = ravi ? "Ravi: passes" : "Ravi: stopped";
    c2.classList.toggle("is-ok", !ravi);
    const region = b <= 0.39 ? 0 : b <= 0.48 ? 1 : b <= 0.51 ? 2 : 3;
    if (dragged) {
      seen.add(region);
      if (region !== lastRegion) fig("referee-line", `verdict:${region}`);
      if (seen.size === 4 && !doneTried) {
        doneTried = true;
        root.classList.add("is-tried");
        fig("referee-line", "tried-all");
      }
    }
    lastRegion = region;
    if (doneTried) verdict.textContent = "No bar does both. Ravi's sheet scores 0.48, higher than two of the three real matches.";
    else if (maya === 3) verdict.textContent = "Everyone passes, Ravi too.";
    else if (ravi) verdict.textContent = "Real shots fail while Ravi still passes.";
    else if (maya > 0) verdict.textContent = "Ravi is stopped, and so are two real shots.";
    else verdict.textContent = "Nobody passes.";
  };

  track(faceBox, {
    label: "Bar for the whole frame score",
    min: 0.35,
    max: 0.55,
    start: 0.43,
    marks: FRAMES,
    digits: 2,
    signal,
    onMove: onFace,
  });
  faceBox.append(checks, verdict);

  const voiceBox = h("div", "pfx-ref-box is-voice");
  const voiceHead = h("div", "pfx-ref-head");
  voiceHead.append(h("span", "pfx-ref-name", "Voice match, the same test"));
  voiceBox.append(voiceHead);
  root.append(voiceBox);
  const vChecks = h("div", "pfx-ref-checks");
  const v1 = h("div", "pfx-ref-check");
  const v2 = h("div", "pfx-ref-check");
  vChecks.append(v1, v2);
  let clear = false;
  const onVoice = (b: number, dragged: boolean) => {
    const real = 0.647 >= b;
    const fake = 0.613 >= b;
    v1.textContent = real ? "Real lines pass" : "Real lines fail";
    v1.classList.toggle("is-ok", real);
    v2.textContent = fake ? "Impostor passes" : "Impostor stopped";
    v2.classList.toggle("is-ok", !fake);
    if (dragged && real && !fake && !clear) {
      clear = true;
      fig("referee-line", "voice-clear");
    }
    if (!(real && !fake)) clear = false;
  };
  track(voiceBox, {
    label: "Bar for the voice match score",
    min: 0.59,
    max: 0.67,
    start: 0.62,
    marks: VOICE,
    digits: 3,
    signal,
    onMove: onVoice,
  });
  voiceBox.append(vChecks, h("div", "pfx-ref-note", "The bar sits at 0.62, in the gap between 0.613 and 0.647."));
};

export default render;
