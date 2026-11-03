// The second half of the colour handoff between tabs. The warp loader
// started blending toward this page's colour when the link was followed and
// left a note (window.__warpFrom: the colours it started from, when, and for
// how long). Here the page's own sky, starlight and accents finish that same
// blend on the same clock, then hand back to their normal values, so moving
// from Projects to Film fades blue into red instead of cutting.
//
// Runs once per page shown. The note is used up here, so a page shown
// without the warp (reduced motion, back to a page with no loader trip)
// does not replay an old blend.

import { ambTargets } from "./spatial";

type WarpNote = { pal: string[]; at: number; dur: number } | null;

const mix = (a: string, b: string, t: number) => {
  const A = a.split(",").map(Number);
  const B = b.split(",").map(Number);
  return A.map((v, k) => Math.round(v + (B[k] - v) * t)).join(",");
};

export function tweenToneFromWarp(signal?: AbortSignal): void {
  const w = window as Window & { __warpFrom?: WarpNote };
  const note = w.__warpFrom;
  w.__warpFrom = null;
  if (!note || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const body = document.body;
  const ambient = document.querySelector<HTMLElement>("[data-ambient]");
  // The same elements the ambient blend writes to (see initAmbient).
  const tinted = [ambient, ...ambTargets()];
  const from = note.pal[0];
  const target = (body.dataset.sky || "91,141,239").replace(/\s/g, "");
  // Where the sky is heading: whatever the page's own ambient set first.
  const amb1 = ambient?.style.getPropertyValue("--amb1").trim() || target;
  const amb2 = ambient?.style.getPropertyValue("--amb2").trim() || target;

  let raf = 0;
  const done = () => {
    body.style.removeProperty("--tone-rgb");
    body.style.removeProperty("--tone");
  };
  const step = () => {
    raf = 0;
    const raw = Math.min(1, Math.max(0, (Date.now() - note.at) / note.dur));
    const t = raw * raw * (3 - 2 * raw);
    const tone = mix(from, target, t);
    body.style.setProperty("--tone-rgb", tone.replace(/,/g, ", "));
    body.style.setProperty("--tone", `rgb(${tone})`);
    const a1 = mix(from, amb1, t);
    const a2 = mix(from, amb2, t);
    for (const el of tinted) {
      el?.style.setProperty("--amb1", a1);
      el?.style.setProperty("--amb2", a2);
    }
    if (raw < 1) raf = requestAnimationFrame(step);
    else done();
  };
  signal?.addEventListener("abort", () => {
    cancelAnimationFrame(raf);
    done();
  });
  step();
}
