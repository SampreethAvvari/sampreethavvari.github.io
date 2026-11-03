// A small light burst where you press: a ring that opens and fades, and a
// few sparks thrown outward, in the colour of the tab you are on. Pure CSS
// animation on a handful of short lived elements, so it costs almost
// nothing and never touches layout.
//
// Mounted once a visit; the layer moves with each page swap.

import { keepAcrossPages } from "../lifecycle";

let mounted = false;

export function mountClickBurst() {
  if (mounted || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  mounted = true;
  const layer = keepAcrossPages(document.createElement("div"));
  layer.className = "fx-burst-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  let live = 0;

  addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || live > 6) return;
    const onControl = !!(e.target as Element | null)?.closest?.("a, button, [role=button], summary, label, input");
    const b = document.createElement("span");
    b.className = `fx-burst${onControl ? " is-strong" : ""}`;
    b.style.left = `${e.clientX}px`;
    b.style.top = `${e.clientY}px`;
    const sparks = onControl ? 7 : 4;
    for (let i = 0; i < sparks; i++) {
      const s = document.createElement("i");
      const a = (i / sparks) * Math.PI * 2 + Math.random() * 0.6;
      const d = (onControl ? 26 : 16) + Math.random() * 14;
      s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
      s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
      s.style.animationDelay = `${Math.random() * 40}ms`;
      b.appendChild(s);
    }
    layer.appendChild(b);
    live++;
    setTimeout(() => { b.remove(); live--; }, 760);
  }, { passive: true });
}
