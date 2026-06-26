// Post-build: remove from dist/ any .png/.jpg/.jpeg that is NOT referenced
// anywhere in the built HTML. After the <picture> fallbacks were repointed to
// .webp, the original photography rasters are unreferenced and only bloat the
// published site (visitors download AVIF/WebP). This is safe by construction:
// a file kept in any HTML (img src, srcset, href, data-*, og:image meta, inline
// url()) is never removed — so the favicon and OG image stay.
//
// Runs as part of `npm run build` (astro build && node scripts/prune-dist.mjs).
import { readdirSync, readFileSync, statSync, rmSync } from "node:fs";
import path from "node:path";

const DIST = "dist";
const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

const all = walk(DIST);
const htmlBlob = all
  .filter((f) => f.endsWith(".html") || f.endsWith(".xml") || f.endsWith(".json"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const encodePath = (rel) => rel.split("/").map(encodeURIComponent).join("/");

let removed = 0, freed = 0;
const kept = [];
for (const f of all) {
  if (!/\.(png|jpe?g)$/i.test(f)) continue;
  const rel = "/" + path.relative(DIST, f).replace(/\\/g, "/");
  const referenced = htmlBlob.includes(rel) || htmlBlob.includes(encodePath(rel));
  if (referenced) {
    kept.push(rel);
    continue;
  }
  freed += statSync(f).size;
  rmSync(f);
  removed++;
}

console.log(
  `prune-dist: removed ${removed} unreferenced raster(s), freed ${(freed / 1024 / 1024).toFixed(1)} MB`
);
if (kept.length) console.log(`prune-dist: kept ${kept.length} referenced raster(s): ${kept.join(", ")}`);
