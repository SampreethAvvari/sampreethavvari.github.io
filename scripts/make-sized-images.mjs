// Generate smaller copies of the site's large images, so a page can serve each one
// at the size it is shown, with a srcset. Purely additive: the files already in
// public/ are not touched. A 2560 pixel portrait shown at 44 pixels was costing a
// visitor 740 KB.
//
// Writes public/sized/<same path>-<width>.avif and .webp, and the list of what
// exists to src/data/image-sizes.json, which Picture and SmartImage read. Each copy
// comes from the archived original when there is one (image-originals/, kept on the
// owner's machine) and from the largest public file otherwise. Only ever smaller
// than the source. Encoded at the settings of the photographs (AVIF 72, WebP 88), a
// step higher for the smallest, where every pixel shows.
//
// Run by hand after adding images: node scripts/make-sized-images.mjs
// The output is committed, so builds do not spend minutes encoding.
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const PUBLIC = "public";
const ORIGINALS = "image-originals";
const OUT = path.join(PUBLIC, "sized");
const MANIFEST = "src/data/image-sizes.json";
const WIDTHS = [320, 640, 960, 1440];

// Folders of large photographs, plus the covers and drawings the cards use.
const FOLDERS = ["Crew Photos", "Photo Gallery", "Creative Roles", "arch", "teaching", "writing/guides"];
const ROOT_COVERS = true;
const SKIP = /^(favicon|icon|logo|apple-touch)/i;

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );

const posix = (p) => p.split(path.sep).join("/");
const stems = new Set();
for (const folder of FOLDERS) {
  const dir = path.join(PUBLIC, folder);
  if (!existsSync(dir)) continue;
  for (const f of walk(dir)) if (/\.avif$/i.test(f)) stems.add(posix(path.relative(PUBLIC, f)).replace(/\.avif$/i, ""));
}
if (ROOT_COVERS) {
  for (const e of readdirSync(PUBLIC, { withFileTypes: true })) {
    if (e.isFile() && /\.avif$/i.test(e.name) && !SKIP.test(e.name)) stems.add(e.name.replace(/\.avif$/i, ""));
  }
}

function sourceFor(stem) {
  for (const ext of [".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG"]) {
    const orig = path.join(ORIGINALS, stem + ext);
    if (existsSync(orig)) return orig;
  }
  for (const ext of [".png", ".jpg", ".jpeg"]) {
    const p = path.join(PUBLIC, stem + ext);
    if (existsSync(p)) return p;
  }
  return path.join(PUBLIC, stem + ".webp");
}

const manifest = {};
let made = 0;
let bytes = 0;
const list = [...stems].sort();
for (const [n, stem] of list.entries()) {
  const publicWebp = path.join(PUBLIC, stem + ".webp");
  const publicAvif = path.join(PUBLIC, stem + ".avif");
  if (!existsSync(publicWebp) || !existsSync(publicAvif)) continue;
  // What the page's own <img> shows at full size decides the shape and the top.
  const shown = await sharp(publicAvif).metadata();
  let source = sourceFor(stem);
  // An original cropped differently from what the site shows is not a source.
  const from = await sharp(source).rotate().metadata();
  const flipped = (from.orientation ?? 1) >= 5;
  const fromRatio = flipped ? from.height / from.width : from.width / from.height;
  if (Math.abs(fromRatio - shown.width / shown.height) > 0.01 * (shown.width / shown.height)) source = publicWebp;
  const widths = WIDTHS.filter((w) => w < shown.width * 0.9);
  const entry = { w: shown.width, h: shown.height, sizes: [] };
  for (const w of widths) {
    const base = path.join(OUT, `${stem}-${w}`);
    mkdirSync(path.dirname(base), { recursive: true });
    const avif = `${base}.avif`;
    const webp = `${base}.webp`;
    const pipe = () => sharp(source).rotate().resize({ width: w, withoutEnlargement: true });
    if (!existsSync(avif)) {
      await pipe().avif({ quality: w <= 320 ? 76 : 72, effort: 4 }).toFile(avif);
      made++;
    }
    if (!existsSync(webp)) {
      await pipe().webp({ quality: w <= 320 ? 90 : 88, effort: 5 }).toFile(webp);
      made++;
    }
    // A copy that came out no smaller than the full file is no use.
    if (statSync(avif).size >= statSync(publicAvif).size) continue;
    bytes += statSync(avif).size + statSync(webp).size;
    entry.sizes.push(w);
  }
  manifest[`/${stem}`] = entry;
  if (n % 20 === 0) console.log(`${n + 1} of ${list.length}: ${stem}`);
}

const before = existsSync(MANIFEST) ? readFileSync(MANIFEST, "utf8") : "";
const text = JSON.stringify(manifest, null, 1) + "\n";
if (text !== before) writeFileSync(MANIFEST, text);
console.log(`${Object.keys(manifest).length} images, ${made} files written, ${(bytes / 1048576).toFixed(1)} MB of copies in use`);
