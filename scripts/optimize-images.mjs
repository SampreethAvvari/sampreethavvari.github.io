// Generate high-quality AVIF + WebP siblings for every raster image at the
// root of /public. Purely additive: originals are never touched, so there is
// zero risk of quality regression — the <picture> fallback always points at
// the untouched original. Run: `node scripts/optimize-images.mjs`
import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const PUBLIC = "public";
const MAX_W = 1600; // retina-safe cap; we never upscale (withoutEnlargement)
const EXT = new Set([".png", ".jpg", ".jpeg"]);

const entries = await readdir(PUBLIC, { withFileTypes: true });
const files = entries
  .filter((e) => e.isFile() && EXT.has(path.extname(e.name).toLowerCase()))
  .map((e) => e.name);

let origTotal = 0;
let avifTotal = 0;
const rows = [];

for (const name of files) {
  const src = path.join(PUBLIC, name);
  const base = name.replace(/\.(png|jpe?g)$/i, "");
  const meta = await sharp(src).metadata();
  const origSize = (await stat(src)).size;
  const targetW = Math.min(meta.width, MAX_W);
  // .rotate() with no args bakes EXIF orientation so phone photos aren't sideways.
  const pipe = () => sharp(src).rotate().resize({ width: targetW, withoutEnlargement: true });

  const avifPath = path.join(PUBLIC, base + ".avif");
  const webpPath = path.join(PUBLIC, base + ".webp");
  await pipe().avif({ quality: 62, effort: 4 }).toFile(avifPath);
  await pipe().webp({ quality: 86, effort: 5 }).toFile(webpPath);

  const avifSize = (await stat(avifPath)).size;
  const webpSize = (await stat(webpPath)).size;
  origTotal += origSize;
  avifTotal += avifSize; // AVIF is what virtually every visitor actually downloads
  rows.push({ name, dims: `${meta.width}->${targetW}`, orig: origSize, avif: avifSize, webp: webpSize });
}

const kb = (n) => (n / 1024).toFixed(0).padStart(6) + " KB";
rows.sort((a, b) => b.orig - a.orig);
console.log("file".padEnd(34), "dims".padEnd(13), "orig".padEnd(9), "avif".padEnd(9), "webp");
for (const r of rows) {
  console.log(r.name.padEnd(34), r.dims.padEnd(13), kb(r.orig), kb(r.avif), kb(r.webp));
}
console.log("-".repeat(70));
console.log(
  `TOTAL  orig ${(origTotal / 1024 / 1024).toFixed(2)} MB  ->  avif ${(avifTotal / 1024 / 1024).toFixed(2)} MB  (${(100 - (avifTotal / origTotal) * 100).toFixed(1)}% smaller)`
);
