// Turn an architecture card original into the AVIF and WebP the site serves.
//   node scripts/arch-image-convert.mjs <slug>
// Reads image-originals/arch/<slug>.png, writes public/arch/<slug>.avif/.webp.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/arch-image-convert.mjs <slug>");
  process.exit(1);
}
const src = `image-originals/arch/${slug}.png`;
mkdirSync("public/arch", { recursive: true });
const [avif, webp] = await Promise.all([
  sharp(src).resize(1200).avif({ quality: 52 }).toFile(`public/arch/${slug}.avif`),
  sharp(src).resize(1200).webp({ quality: 78 }).toFile(`public/arch/${slug}.webp`),
]);
console.log(`public/arch/${slug}.avif ${avif.size} B, .webp ${webp.size} B`);
