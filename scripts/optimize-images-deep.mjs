// Optimize the heavy SUBFOLDER images under /public (gallery + photography).
// Two strategies, chosen per file so we never break a reference or lose
// visible quality:
//
//   ADDITIVE  - png/jpg/jpeg rendered by Astro components (Crew Photos, Photo
//               Gallery, Creative Roles, gallery/*). Generates .avif/.webp
//               siblings; originals are left untouched and used as the
//               <picture> fallback.
//   IN-PLACE  - files we can't add a sibling for safely: the React about-page
//               carousel ("About page pics/") and the few oversized .AVIF
//               sources. These are downsized to the SAME path/format/name
//               (so no markup or reference changes), originals backed up to
//               ../_image-originals/ first.
//
// Run: node scripts/optimize-images-deep.mjs
import sharp from "sharp";
import { readdirSync, statSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const PUBLIC = "public";
const BACKUP = "_image-originals";
const MAX_W = 2560; // generous retina cap for lightbox/full views; never upscale
const RASTER = /\.(png|jpe?g)$/i;

// Folders whose images are rendered by the React PhotoCarousel — downsize in
// place (no sibling, no markup change).
const INPLACE_DIRS = ["About page pics"];

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

const backup = (file) => {
  const rel = path.relative(PUBLIC, file);
  const dest = path.join(BACKUP, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  if (!existsSync(dest)) copyFileSync(file, dest);
};

// Only subfolders (depth >= 2); skip the already-optimized root and logos.
const all = walk(PUBLIC).filter((f) => {
  const rel = path.relative(PUBLIC, f).replace(/\\/g, "/");
  if (!rel.includes("/")) return false; // root-level handled by optimize-images.mjs
  if (rel.startsWith("logos/")) return false;
  return true;
});

let origTotal = 0, newTotal = 0;
const rows = [];
const failed = [];

for (const file of all) {
  const rel = path.relative(PUBLIC, file).replace(/\\/g, "/");
  const ext = path.extname(file).toLowerCase();
  const size = statSync(file).size;
  const isInplaceDir = INPLACE_DIRS.some((d) => rel.startsWith(d + "/"));
  const isBigAvif = ext === ".avif" && size > 1.5 * 1024 * 1024;

  try {
  if (isInplaceDir && (RASTER.test(file) || ext === ".avif")) {
    // Downsize in place, keep exact path/format/name.
    backup(file);
    const meta = await sharp(file).metadata();
    const w = Math.min(meta.width, MAX_W);
    const buf =
      ext === ".avif"
        ? await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).avif({ quality: 62, effort: 4 }).toBuffer()
        : await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, buf);
    origTotal += size; newTotal += buf.length;
    rows.push({ rel, mode: "in-place", from: size, to: buf.length });
  } else if (isBigAvif) {
    backup(file);
    const meta = await sharp(file).metadata();
    const w = Math.min(meta.width, MAX_W);
    const buf = await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).avif({ quality: 62, effort: 4 }).toBuffer();
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, buf);
    origTotal += size; newTotal += buf.length;
    rows.push({ rel, mode: "in-place", from: size, to: buf.length });
  } else if (RASTER.test(file)) {
    // Additive: generate .avif + .webp siblings.
    const base = file.replace(RASTER, "");
    const meta = await sharp(file).metadata();
    const w = Math.min(meta.width, MAX_W);
    // .rotate() bakes EXIF orientation; q72/q88 keeps photographic detail crisp.
    const pipe = () => sharp(file).rotate().resize({ width: w, withoutEnlargement: true });
    await pipe().avif({ quality: 72, effort: 4 }).toFile(base + ".avif");
    await pipe().webp({ quality: 88, effort: 5 }).toFile(base + ".webp");
    const a = statSync(base + ".avif").size;
    origTotal += size; newTotal += a; // avif is what visitors download
    rows.push({ rel, mode: "additive", from: size, to: a });
  }
  } catch (e) {
    failed.push({ rel, size, msg: String(e.message || e).slice(0, 60) });
  }
}

const mb = (n) => (n / 1024 / 1024).toFixed(2);
rows.sort((a, b) => b.from - a.from);
for (const r of rows) {
  console.log(
    `${r.mode.padEnd(9)} ${(r.from / 1024 / 1024).toFixed(1).padStart(6)}MB -> ${(r.to / 1024).toFixed(0).padStart(5)}KB  ${r.rel}`
  );
}
console.log("-".repeat(80));
console.log(`${rows.length} files | served bytes ${mb(origTotal)} MB -> ${mb(newTotal)} MB (${(100 - newTotal / origTotal * 100).toFixed(1)}% smaller)`);
if (failed.length) {
  console.log("\nSKIPPED (could not decode — need re-export):");
  for (const f of failed) console.log(`  ${(f.size / 1024 / 1024).toFixed(1)}MB  ${f.rel}  (${f.msg})`);
}
