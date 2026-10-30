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

type Cached = { id: string; ready: Promise<void> };

function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData?.brands;
  return !!brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
}

// The displacement map for one rounded rectangle, as a PNG data URL. The PNG
// is encoded with toBlob, which the browser does off the main thread;
// toDataURL would hold the page for a tenth of a second on a wide map.
function drawMap(w: number, h: number, r: number, bezel: number): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  // A plain memory canvas: the map is written once and read back once, and a
  // GPU canvas would make that read wait on the graphics card.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Promise.resolve("");
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const hw = w / 2;
  const hh = h / 2;
  // Only a band `bezel` wide along the edge bends anything; everywhere else
  // the map is the neutral grey (128, 128, 128). Fill it all neutral, then
  // work out real pixels only where they can differ: whole rows near the top
  // and bottom, and just the two edge bands on the rows between. Same map,
  // a fraction of the work on a large card.
  new Uint32Array(data.buffer).fill(new Uint32Array(new Uint8Array([128, 128, 128, 255]).buffer)[0]);
  // Rows inside the rounded corners bend across their whole corner, so they
  // are full rows too.
  const band = Math.ceil(bezel) + 1;
  const edgeRows = Math.max(band, Math.ceil(r) + 1);
  for (let y = 0; y < h; y++) {
    const fullRow = Math.abs(y + 0.5 - hh) > hh - edgeRows;
    for (let x = 0; x < w; x++) {
      if (!fullRow && x === band && w - band > band) x = w - band;
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
  return new Promise((resolve) => {
    const sync = () => resolve(canvas.toDataURL("image/png"));
    canvas.toBlob((blob) => {
      if (!blob) return sync();
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = sync;
      reader.readAsDataURL(blob);
    }, "image/png");
  });
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

  const filterFor = (w: number, h: number, r: number): Cached => {
    const bezel = Math.max(6, Math.min(22, Math.min(w, h) * 0.34));
    const key = `${w}x${h}r${r}`;
    const hit = cache.get(key);
    if (hit) return hit;
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
    const entry: Cached = { id, ready: drawMap(w, h, r, bezel).then((url) => map.setAttribute("href", url)) };
    cache.set(key, entry);
    return entry;
  };

  // Sizes come from the ResizeObserver and each corner radius is read once,
  // all reads before any write, so setting one element's filter never makes
  // the browser recompute styles to measure the next.
  // An element takes its refracting filter once that filter's map is ready;
  // until then it keeps the clear tinted glass from the CSS.
  const radius = new WeakMap<HTMLElement, number>();
  const wanted = new WeakMap<HTMLElement, string>();
  const write = (el: HTMLElement, w: number, h: number) => {
    if (w < 8 || h < 8) return;
    const r = Math.min(radius.get(el) ?? 0, w / 2, h / 2);
    const filter = filterFor(w, h, Math.round(r));
    wanted.set(el, filter.id);
    filter.ready.then(() => {
      if (wanted.get(el) !== filter.id) return; // resized again since
      const value = `url(#${filter.id}) saturate(1.6) brightness(1.06)`;
      el.style.setProperty("backdrop-filter", value);
      el.style.setProperty("-webkit-backdrop-filter", value);
    });
  };
  const measureAll = (els: HTMLElement[]) => {
    const sizes = els.map((el) => {
      if (!radius.has(el)) radius.set(el, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
      const rect = el.getBoundingClientRect();
      return [Math.round(rect.width), Math.round(rect.height)] as const;
    });
    els.forEach((el, i) => write(el, sizes[i][0], sizes[i][1]));
  };

  const seen = new WeakSet<HTMLElement>();
  const ro =
    "ResizeObserver" in window
      ? new ResizeObserver((entries) => {
          const els = entries.map((e) => e.target as HTMLElement);
          for (const el of els) if (!radius.has(el)) radius.set(el, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
          for (const e of entries) {
            const box = e.borderBoxSize?.[0];
            if (box) write(e.target as HTMLElement, Math.round(box.inlineSize), Math.round(box.blockSize));
            else measureAll([e.target as HTMLElement]);
          }
        })
      : null;
  const scan = () => {
    const fresh: HTMLElement[] = [];
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      fresh.push(el);
    });
    // The observer reports each new element's size once on its own.
    if (ro) fresh.forEach((el) => ro.observe(el));
    else measureAll(fresh);
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
