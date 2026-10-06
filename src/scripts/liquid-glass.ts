// Liquid glass that refracts, like the glass in iOS: no frost, the page behind
// stays sharp, and along the rim it bends the way a thick lens bends light.
//
// How: each glass element gets an SVG filter made for its exact size and
// corner radius. The filter's displacement map is drawn here on a canvas: for
// every pixel, the distance in from the edge of the rounded shape and the
// direction of that edge. Inside a rim band the backdrop is sampled from a
// little further in, strongest at the edge and fading to nothing, so the
// centre is clear glass and the rim magnifies what is behind it. Identical
// sizes share one filter.
//
// Only Chromium can point backdrop-filter at an SVG filter. Everywhere else the
// CSS keeps a clear tinted glass and this file does nothing.

const NS = "http://www.w3.org/2000/svg";

type Cached = { id: string };

function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData?.brands;
  return !!brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
}

// The displacement map for one rounded rectangle, as a PNG data URL.
function drawMap(w: number, h: number, r: number, bezel: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const hw = w / 2;
  const hh = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hw;
      const py = y + 0.5 - hh;
      const qx = Math.abs(px) - (hw - r);
      const qy = Math.abs(py) - (hh - r);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      // Signed distance to the rounded edge, negative inside.
      const sd = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      const depth = -sd;
      let dx = 0;
      let dy = 0;
      if (depth > 0 && depth < bezel) {
        // The edge's outward direction at this point.
        let nx: number;
        let ny: number;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(ox, oy) || 1;
          nx = ox / len;
          ny = oy / len;
        } else if (qx > qy) {
          nx = 1;
          ny = 0;
        } else {
          nx = 0;
          ny = 1;
        }
        nx *= Math.sign(px) || 1;
        ny *= Math.sign(py) || 1;
        // A lens profile: strongest at the very edge, easing to nothing.
        const t = 1 - depth / bezel;
        const m = t * t * (3 - 2 * t);
        // Sample from further in (against the outward direction).
        dx = -nx * m;
        dy = -ny * m;
      }
      const i = (y * w + x) * 4;
      data[i] = Math.round(128 + dx * 127);
      data[i + 1] = Math.round(128 + dy * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function initLiquidGlass(selector: string): void {
  if (typeof window === "undefined") return;
  if (!isChromium()) return;
  if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) return;
  const root = document.documentElement;
  if (root.dataset.liquidGlass === "on") return;
  root.dataset.liquidGlass = "on";
  root.classList.add("lg-live");

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  document.body.appendChild(svg);

  const cache = new Map<string, Cached>();
  let count = 0;

  const filterFor = (w: number, h: number, r: number): string => {
    const bezel = Math.max(6, Math.min(22, Math.min(w, h) * 0.34));
    const key = `${w}x${h}r${r}`;
    const hit = cache.get(key);
    if (hit) return hit.id;
    const id = `lg-refract-${++count}`;
    const filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(w));
    filter.setAttribute("height", String(h));
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const map = document.createElementNS(NS, "feImage");
    map.setAttribute("href", drawMap(w, h, r, bezel));
    map.setAttribute("x", "0");
    map.setAttribute("y", "0");
    map.setAttribute("width", String(w));
    map.setAttribute("height", String(h));
    map.setAttribute("preserveAspectRatio", "none");
    map.setAttribute("result", "map");
    const disp = document.createElementNS(NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "map");
    disp.setAttribute("scale", String(Math.round(bezel * 1.1)));
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "G");
    filter.append(map, disp);
    svg.appendChild(filter);
    cache.set(key, { id });
    return id;
  };

  const apply = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 8 || h < 8) return;
    const raw = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const r = Math.min(raw, w / 2, h / 2);
    const id = filterFor(w, h, Math.round(r));
    const value = `url(#${id}) saturate(1.6) brightness(1.06)`;
    el.style.setProperty("backdrop-filter", value);
    el.style.setProperty("-webkit-backdrop-filter", value);
  };

  const seen = new WeakSet<HTMLElement>();
  const ro = "ResizeObserver" in window ? new ResizeObserver((entries) => entries.forEach((e) => apply(e.target as HTMLElement))) : null;
  const scan = () => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      apply(el);
      ro?.observe(el);
    });
  };
  scan();
  // Islands (the nav, the chat button, back to top) mount after this runs.
  let pending = 0;
  new MutationObserver(() => {
    if (pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      scan();
    }, 150);
  }).observe(document.body, { childList: true, subtree: true });
}
