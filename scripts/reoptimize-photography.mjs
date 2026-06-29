// Regenerate the photography AVIF/WebP from the moved-out originals in
// image-originals/, fixing two issues in the first pass:
//   1) EXIF orientation — .rotate() (no args) bakes the correct orientation so
//      phone photos stop rendering sideways.
//   2) quality — bump to AVIF q72 / WebP q88 for photographic detail.
// Writes siblings back into public/ at the matching path.
import sharp from "sharp";
import { readdirSync } from "node:fs";
import path from "node:path";

const SRC = "image-originals";
const OUT = "public";
const FOLDERS = ["Crew Photos", "Photo Gallery", "Creative Roles", "gallery"];
const RASTER = /\.(png|jpe?g)$/i;

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

let n = 0;
for (const folder of FOLDERS) {
  let files;
  try { files = walk(path.join(SRC, folder)); } catch { continue; }
  for (const f of files) {
    if (!RASTER.test(f)) continue;
    const rel = path.relative(SRC, f);
    const base = path.join(OUT, rel).replace(RASTER, "");
    const pipe = () => sharp(f).rotate().resize({ width: 2560, withoutEnlargement: true });
    await pipe().avif({ quality: 72, effort: 4 }).toFile(base + ".avif");
    await pipe().webp({ quality: 88, effort: 5 }).toFile(base + ".webp");
    n++;
  }
}
console.log(`reoptimized ${n} photography files (EXIF auto-rotate + AVIF q72 / WebP q88)`);
