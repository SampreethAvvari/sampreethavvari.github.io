// The second half of the colour handoff between tabs. The warp loader on the
// page you left started blending toward this page's colour and left a note
// (window.__warpFrom: the colours it started from, when, and for how long).
// Here the page's own sky, starlight and accents finish that same blend on
// the same clock, then hand back to their normal values, so moving from
// Projects to Film fades blue into red instead of cutting.

import { ambTargets } from "./spatial";

type WarpNote = { pal: string[]; at: number; dur: number } | null;

const mix = (a: string, b: string, t: number) => {
  const A = a.split(",").map(Number);
  const B = b.split(",").map(Number);
  return A.map((v, k) => Math.round(v + (B[k] - v) * t)).join(",");
};

export function tweenToneFromWarp(): void {
  const note = (window as Window & { __warpFrom?: WarpNote }).__warpFrom;
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

  const step = () => {
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
    if (raw < 1) requestAnimationFrame(step);
    else {
      body.style.removeProperty("--tone-rgb");
      body.style.removeProperty("--tone");
    }
  };
  step();
}
