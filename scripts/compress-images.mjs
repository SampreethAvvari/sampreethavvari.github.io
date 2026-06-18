// One-shot image compression for files in public/.
//
// Project screenshots ship from public/ as-is (Astro only optimises files
// imported from src/), so big PNGs were turning into 1.5-2 MB asset
// downloads on every page render. This script downsizes each one to a
// reasonable display width and writes both a compressed PNG (replaces the
// original) and a sibling .webp for browsers that support it.
//
// Run once after dropping a new asset into public/:  node scripts/compress-images.mjs
// Idempotent; skips anything already small enough.

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

// Per-image target widths. Keep displayed width in mind: project hero cards
// render at most ~1400 CSS px wide on a 2k monitor. 1600px source covers
// 2x retina without paying for 4k.
const RULES = [
  // Project hero screenshots (used at ~1400px on /projects + post hero).
  { match: /^(cbct-validator|treatment-estimator|cowork-dashboard|doc-coach|npc-coach|npc-coach-scoring|npc-coach-architecture|npc-coach-bugs|npc-coach-dashboard|loan-radar|llm-persuasion|enterprise-data|accounting-automation|pipeline-ghosting|film-and-engineering|optimal-living-systems|fake-news|resnet-compact|customer-segmentation|buffer_overflow|heap_exploit|comics|paper|simpsons|jobpilot|jobpilot-judge|doctor-report-cards)\.png$/i, width: 1600, quality: 78 },
  // Brand/avatar tiles (favicon, chatbot avatar). 256px is plenty for both.
  { match: /^logos\/samp-chat\.png$/i, width: 256, quality: 82 },
];

const SKIP_BELOW_BYTES = 250 * 1024; // already small enough; don't churn

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function pickRule(relPath) {
  const normalised = relPath.replaceAll("\\", "/");
  for (const r of RULES) {
    if (r.match.test(normalised)) return r;
  }
  return null;
}

async function compressOne(absPath) {
  const rel = path.relative(PUBLIC_DIR, absPath);
  const rule = pickRule(rel);
  if (!rule) return null;

  const stat = await fs.stat(absPath);
  if (stat.size < SKIP_BELOW_BYTES) return { rel, status: "skip-small", before: stat.size };

  const input = await fs.readFile(absPath);
  const pipeline = sharp(input).resize({
    width: rule.width,
    withoutEnlargement: true,
    fit: "inside",
  });

  // Re-encode PNG (palette + adaptive filter cuts size hard on screenshot-style art).
  const pngOut = await pipeline
    .clone()
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: rule.quality })
    .toBuffer();
  await fs.writeFile(absPath, pngOut);

  // WebP sibling for browsers that prefer it. ~40-60% smaller than the PNG.
  const webpPath = absPath.replace(/\.png$/i, ".webp");
  const webpOut = await pipeline
    .clone()
    .webp({ quality: rule.quality, effort: 6 })
    .toBuffer();
  await fs.writeFile(webpPath, webpOut);

  return {
    rel,
    status: "done",
    before: stat.size,
    afterPng: pngOut.length,
    afterWebp: webpOut.length,
  };
}

function kb(n) {
  return `${(n / 1024).toFixed(0)}KB`;
}

const all = await walk(PUBLIC_DIR);
const results = [];
for (const p of all) {
  if (!/\.png$/i.test(p)) continue;
  try {
    const r = await compressOne(p);
    if (r) results.push(r);
  } catch (err) {
    console.error(`failed: ${p}`, err.message);
  }
}

for (const r of results) {
  if (r.status === "skip-small") {
    console.log(`${r.rel.padEnd(48)} skip (already ${kb(r.before)})`);
  } else {
    console.log(`${r.rel.padEnd(48)} ${kb(r.before)} -> png ${kb(r.afterPng)}, webp ${kb(r.afterWebp)}`);
  }
}
