// A gravity lens that follows the mouse: whatever is under it bends the way
// light bends around a heavy mass, pulled in and twisted a little, with a
// faint ring at the edge in the tab's colour. It wakes when the mouse moves
// and relaxes to nothing when it rests, so reading is never in its way.
//
// How: one SVG filter, built once. Its displacement map is a radial lens
// drawn on a canvas (neutral grey at the rim, so the edge blends in). A
// round element follows the pointer with `backdrop-filter: url(#lens)` and
// the filter's scale follows the mouse speed. Only Chromium can point
// backdrop-filter at an SVG filter; elsewhere only the ring shows. Mice
// only, and never with reduced motion. Mounted once a visit; the lens and
// its filter move with each page swap.

import { keepAcrossPages } from "../lifecycle";

const NS = "http://www.w3.org/2000/svg";
const R = 96; // lens radius in CSS pixels

function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
}

// The lens map: each pixel says where to sample the backdrop from. Near the
// centre it samples closer in (magnified), with a slight swirl, fading to no
// change at the rim.
// Encoded away from the page's thread where it can be: read back and encoded at once, this
// picture stopped every desktop page's first load for hundreds of milliseconds.
function lensMap(size: number): Promise<string> {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return Promise.resolve("");
  const img = g.createImageData(size, size);
  const d = img.data;
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5 - h) / h;
      const py = (y + 0.5 - h) / h;
      const u = Math.hypot(px, py);
      let dx = 0, dy = 0;
      if (u < 1 && u > 1e-4) {
        const f = u * (1 - u) * (1 - u) * 6.75; // peaks at a third of the radius
        const ux = px / u, uy = py / u;
        // pull inward, plus a quarter of that as a twist around the centre
        dx = -ux * f + -uy * f * 0.2;
        dy = -uy * f + ux * f * 0.2;
      }
      const i = (y * size + x) * 4;
      d[i] = Math.round(128 + dx * 127);
      d[i + 1] = Math.round(128 + dy * 127);
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return new Promise((resolve) => {
    const now = () => resolve(c.toDataURL("image/png"));
    c.toBlob((blob) => {
      if (!blob) return now();
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = now;
      reader.readAsDataURL(blob);
    }, "image/png");
  });
}

let mounted = false;

export function mountSpaceLens() {
  if (mounted || !matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  mounted = true;
  const warp = isChromium();
  const size = R * 2;

  const lens = keepAcrossPages(document.createElement("div"));
  lens.className = "fx-lens";
  lens.setAttribute("aria-hidden", "true");
  document.body.appendChild(lens);

  // The bend comes when the browser has a moment. Until the map is ready, only the ring shows.
  let disp: SVGFEDisplacementMapElement | null = null;
  const build = async () => {
    const map = await lensMap(size);
    if (!map) return;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    const filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", "fx-lens");
    filter.setAttribute("x", "0"); filter.setAttribute("y", "0");
    filter.setAttribute("width", String(size)); filter.setAttribute("height", String(size));
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const fe = document.createElementNS(NS, "feImage");
    fe.setAttribute("href", map);
    fe.setAttribute("x", "0"); fe.setAttribute("y", "0");
    fe.setAttribute("width", String(size)); fe.setAttribute("height", String(size));
    fe.setAttribute("result", "map");
    const bend = document.createElementNS(NS, "feDisplacementMap");
    bend.setAttribute("in", "SourceGraphic");
    bend.setAttribute("in2", "map");
    bend.setAttribute("scale", "0");
    bend.setAttribute("xChannelSelector", "R");
    bend.setAttribute("yChannelSelector", "G");
    filter.append(fe, bend);
    svg.appendChild(filter);
    document.body.appendChild(keepAcrossPages(svg));
    disp = bend;
    lens.classList.add("is-warp");
  };
  if (warp) {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => void build(), { timeout: 2500 });
    else setTimeout(() => void build(), 400);
  }

  let x = -999, y = -999, cx = x, cy = y, speed = 0, strength = 0, running = false, lastT = 0, lastX = 0, lastY = 0;
  const loop = (t: number) => {
    cx += (x - cx) * 0.2;
    cy += (y - cy) * 0.2;
    speed *= 0.9;
    // speed opens the lens; at rest it settles to nothing
    const target = Math.min(1, speed / 1.6);
    strength += (target - strength) * 0.12;
    lens.style.transform = `translate3d(${cx - R}px, ${cy - R}px, 0) scale(${0.7 + strength * 0.3})`;
    lens.style.opacity = String(Math.min(1, strength * 1.6));
    if (disp) disp.setAttribute("scale", (strength * 26).toFixed(1));
    if (strength > 0.004 || Math.abs(x - cx) + Math.abs(y - cy) > 0.5) requestAnimationFrame(loop);
    else { running = false; lens.style.opacity = "0"; if (disp) disp.setAttribute("scale", "0"); }
    lastT = t;
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const t = performance.now();
    // Inside a post's figure the labels stay straight, so it stays readable.
    const inFigure = !!(e.target as Element | null)?.closest?.("[data-post-fig]");
    if (lastT && !inFigure) {
      const v = Math.hypot(e.clientX - lastX, e.clientY - lastY) / Math.max(8, t - lastT);
      speed = Math.max(speed, v);
    }
    if (x < -900) { cx = e.clientX; cy = e.clientY; }
    x = e.clientX; y = e.clientY; lastX = x; lastY = y; lastT = t;
    if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: true });
  document.addEventListener("pointerleave", () => { speed = 0; });
}
