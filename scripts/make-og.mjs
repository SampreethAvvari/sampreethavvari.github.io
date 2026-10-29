// Share images: one 1200 x 630 JPG per post and per architecture page, so a
// link pasted into LinkedIn, X, Slack or iMessage shows that page's own art
// (LinkedIn does not reliably render WebP or AVIF previews).
//   node scripts/make-og.mjs
// Posts use their cover, architecture pages their blueprint art. Reads the PNG
// original when there is one, else the published WebP. Writes public/og/.
import sharp from "sharp";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT = "public/og";
mkdirSync(OUT, { recursive: true });

// The best source for a public image path like "/capacity-planner.png".
function source(publicPath, originalsDir = "image-originals") {
  const base = path.basename(publicPath).replace(/\.(png|jpe?g|webp|avif)$/i, "");
  const sub = path.dirname(publicPath).replace(/^\//, "");
  const candidates = [
    path.join(originalsDir, sub, `${base}.png`),
    path.join(originalsDir, `${base}.png`),
    path.join("public", sub, `${base}.webp`),
    path.join("public", sub, `${base}.png`),
    path.join("public", sub, `${base}.jpg`),
  ];
  return candidates.find((c) => existsSync(c));
}

async function write(src, name) {
  if (!src) return console.log(`skip ${name}: no source image`);
  await sharp(src).resize(1200, 630, { fit: "cover", position: "centre" }).jpeg({ quality: 74, mozjpeg: true }).toFile(path.join(OUT, `${name}.jpg`));
  console.log(`og/${name}.jpg`);
}

// A portrait image (the photo, the poster) whole in the middle of a blurred,
// darkened copy of itself, so nothing gets cropped off.
async function framed(src, name) {
  if (!existsSync(src)) return console.log(`skip ${name}: no source image`);
  const back = await sharp(src).resize(1200, 630, { fit: "cover" }).blur(40).modulate({ brightness: 0.45 }).toBuffer();
  const front = await sharp(src).resize({ height: 570, fit: "inside" }).toBuffer();
  await sharp(back).composite([{ input: front, gravity: "centre" }]).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(OUT, `${name}.jpg`));
  console.log(`og/${name}.jpg`);
}
await framed("public/pic.png", "home");
await framed("image-originals/among-monsters-poster.jpg", "film");

// Posts: their cover.
for (const f of readdirSync("src/pages/posts").filter((f) => f.endsWith(".md"))) {
  const fm = readFileSync(path.join("src/pages/posts", f), "utf8").split(/^---$/m)[1] || "";
  const img = (fm.match(/^img_path:\s*"([^"]+)"/m) || [])[1];
  const slug = f.replace(/\.md$/, "");
  if (img) await write(source(img), `post-${slug}`);
}

// Architecture pages: their blueprint card art.
for (const f of readdirSync("src/data/architecture/systems").filter((f) => f.endsWith(".ts"))) {
  const slug = f.replace(/\.ts$/, "");
  await write(source(`/arch/${slug}.png`), `arch-${slug}`);
}
