// Pull the diagram out of an Archify HTML file and save it as a bare SVG the
// architecture pages can inline and restyle with the site's own tokens.
//
//   node scripts/archify-extract.mjs <archify.html> <slug>
//
// Writes src/data/architecture/svg/<slug>.svg. Archify validates the layout
// (routes, label clearance, crossings); the site owns the look. So this keeps
// every class and data attribute Archify emits and drops only what the site
// draws itself: the background grid and the native per node tooltips, which
// would fight the inspector panel.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [src, slug] = process.argv.slice(2);
if (!src || !slug) {
  console.error("usage: node scripts/archify-extract.mjs <archify.html> <slug>");
  process.exit(1);
}

const html = readFileSync(src, "utf8");
const start = html.indexOf("<svg");
const end = html.indexOf("</svg>", start);
if (start < 0 || end < 0) throw new Error(`no <svg> in ${src}`);
let svg = html.slice(start, end + 6);

svg = svg
  // The site draws a finer blueprint grid behind the whole stage.
  .replace(/<pattern id="grid"[\s\S]*?<\/pattern>/, "")
  .replace(/<rect width="100%" height="100%" fill="url\(#grid\)"\s*\/>/, "")
  // Node tooltips: the inspector says more, and says it once.
  .replace(/(<g id="node-[^"]+"[^>]*>)\s*<title>[^<]*<\/title>/g, "$1")
  // Edges get ids so travelling pulses can follow them with <mpath>.
  .replace(/<path data-edge-from="([^"]+)" data-edge-to="([^"]+)"([^>]*?)data-edge-id="([^"]+)"/g,
    (_m, from, to, mid, id) => `<path id="edge-${id}" data-edge-from="${from}" data-edge-to="${to}"${mid}data-edge-id="${id}"`)
  .replace(/<svg /, '<svg class="arch-svg" ')
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\n\s*\n/g, "\n");

// The page has its own legend, so Archify's goes. It is the last group in
// the drawing, so everything from its opening tag to </svg> is the legend.
const legendAt = svg.indexOf("<g data-legend");
if (legendAt > 0) svg = svg.slice(0, legendAt) + "</svg>";

// Crop the viewBox to what is drawn, with a margin, now the legend is gone.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const m of svg.matchAll(/<rect\b[^>]*?\bx="([\d.]+)"[^>]*?\by="([\d.]+)"[^>]*?\bwidth="([\d.]+)"[^>]*?\bheight="([\d.]+)"[^>]*?class="c-(?!mask)/g)) {
  // Only node plates and frames count; sigil glyphs sit at their own origin.
  const [x, y, w, h] = m.slice(1).map(Number);
  minX = Math.min(minX, x); minY = Math.min(minY, y);
  maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
}
const pad = 28;
const box = [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad].map((n) => Math.round(n));
svg = svg.replace(/viewBox="[^"]+"/, `viewBox="${box.join(" ")}"`);

const out = resolve("src/data/architecture/svg", `${slug}.svg`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log(`wrote ${out} (${(svg.length / 1024).toFixed(1)} KB)`);
