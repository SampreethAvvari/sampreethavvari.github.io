// Post-build: remove from dist/ any .png/.jpg/.jpeg that is NOT referenced
// anywhere in the built HTML. After the <picture> fallbacks were repointed to
// .webp, the original photography rasters are unreferenced and only bloat the
// published site (visitors download AVIF/WebP). This is safe by construction:
// a file kept in any HTML (img src, srcset, href, data-*, og:image meta, inline
// url()) is never removed — so the favicon and OG image stay.
//
// Runs as part of `npm run build` (astro build && node scripts/prune-dist.mjs).
import { existsSync, readdirSync, readFileSync, statSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIST = "dist";
const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

const all = walk(DIST);
const htmlBlob = all
  // Client only islands (the chat widget) name their images in the JS
  // bundles, not the HTML, so scripts and styles count as references too.
  .filter((f) => /\.(html|xml|json|js|mjs|css)$/.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const encodePath = (rel) => rel.split("/").map(encodeURIComponent).join("/");

// Bare test pages for the journey engine and the closing film: the dev server
// still serves them, the published site does not.
for (const lab of ["journey-lab", "ending-lab"]) rmSync(path.join(DIST, lab), { recursive: true, force: true });

const sizeOf = (d) => {
  try {
    return statSync(d).isDirectory() ? walk(d).reduce((sum, f) => sum + statSync(f).size, 0) : statSync(d).size;
  } catch {
    return 0;
  }
};
const dropDir = (d) => {
  const bytes = sizeOf(d);
  rmSync(d, { recursive: true, force: true });
  return bytes;
};
const code = all.filter((f) => /\.(js|mjs)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");

// The filmed scenes. Only a home chapter with a scene ever opens story/manifest.json
// and its frames (Journey.astro), and today every chapter's scene is null. The moment
// one has a scene again, this stops removing them.
let storyFreed = 0;
const home = path.join(DIST, "index.html");
const filmed = existsSync(home) && /scene&#34;:&#34;|scene&quot;:&quot;|"scene":"/.test(readFileSync(home, "utf8"));
if (!filmed) {
  for (const scene of ["exit", "helmet", "touch"]) storyFreed += dropDir(path.join(DIST, "story", scene));
  storyFreed += dropDir(path.join(DIST, "story", "manifest.json"));
}

// The matted plates. The world plays a plate by its id in the code, so a plate whose id
// the code never says is never fetched, and its entry in the manifest goes with it.
const plateManifest = path.join(DIST, "story", "plates", "manifest.json");
if (existsSync(plateManifest)) {
  const m = JSON.parse(readFileSync(plateManifest, "utf8"));
  const used = (m.plates || []).filter((p) => code.includes(`"${p.id}"`));
  for (const p of (m.plates || []).filter((p) => !used.includes(p))) {
    storyFreed += dropDir(path.join(DIST, "story", "plates", p.id));
  }
  m.plates = used;
  writeFileSync(plateManifest, JSON.stringify(m));
}

// Folders a script builds image names in at run time (`/sized/arch/${slug}-960.avif`):
// nothing under them can be judged by searching for the whole name.
const built = [...code.matchAll(/`\/([\w/-]+\/)\$\{/g)].map((m) => "/" + m[1]);
// Sized copies and images at the top of the site that nothing names any more.
const dropIfUnnamed = (rel) =>
  /\.(avif|webp|svg|gif)$/i.test(rel) && (rel.startsWith("/sized/") || rel.startsWith("/logos/skills/") || rel.lastIndexOf("/") === 0) && !built.some((p) => rel.startsWith(p));

let removed = 0, freed = 0;
const kept = [];
for (const f of all) {
  if (!existsSync(f)) continue;
  const rel = "/" + path.relative(DIST, f).replace(/\\/g, "/");
  const raster = /\.(png|jpe?g)$/i.test(f);
  if (!raster && !dropIfUnnamed(rel)) continue;
  // Pages and scripts swap one format for another, or name a picture without its
  // ending (data-art="/writing/platform"), so any form of the name keeps it.
  const base = rel.replace(/\.\w+$/, "");
  const forms = raster ? [rel, encodePath(rel)] : ["", ".avif", ".webp", ".png", ".jpg", ".jpeg", ".svg", '"', "'"].flatMap((end) => [base + end, encodePath(base) + end]);
  if (forms.some((name) => name !== base && name !== encodePath(base) && htmlBlob.includes(name))) {
    if (raster) kept.push(rel);
    continue;
  }
  freed += statSync(f).size;
  rmSync(f);
  removed++;
}

console.log(
  `prune-dist: removed ${removed} unreferenced image(s), freed ${(freed / 1024 / 1024).toFixed(1)} MB; filmed scenes and unplayed plates, freed ${(storyFreed / 1024 / 1024).toFixed(1)} MB`
);
if (kept.length) console.log(`prune-dist: kept ${kept.length} referenced raster(s): ${kept.join(", ")}`);
