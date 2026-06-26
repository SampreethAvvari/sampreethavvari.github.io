// Audit which SUBFOLDER source images are actually referenced by the site.
// A file counts as USED if either:
//   - it lives under a folder the code enumerates with fs.readdirSync
//     ("Photo Gallery", "Photo Gallery/Swechcha", "gallery/<slug>"), or
//   - its filename (bare or URL-encoded) appears anywhere in src/.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

// Concatenate all source files we might reference images from.
const srcBlob = walk("src")
  .filter((f) => /\.(astro|ts|tsx|js|jsx|md|mdx)$/.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

// Folders the code reads dynamically -> every file inside is used.
const DYNAMIC = ["Photo Gallery/", "gallery/"];

// Source images (originals), excluding the .avif/.webp WE generate as siblings.
const isGeneratedSibling = (rel) => {
  if (!/\.(avif|webp)$/i.test(rel)) return false;
  const base = rel.replace(/\.(avif|webp)$/i, "");
  return ["png", "jpg", "jpeg", "JPG", "JPEG", "PNG"].some((e) => {
    try { statSync(path.join("public", base + "." + e)); return true; } catch { return false; }
  });
};

const files = walk("public")
  .map((f) => path.relative("public", f).replace(/\\/g, "/"))
  .filter((rel) => rel.includes("/") && !rel.startsWith("logos/")) // subfolders only
  .filter((rel) => /\.(png|jpe?g|avif|webp)$/i.test(rel))
  .filter((rel) => !isGeneratedSibling(rel));

const used = [], orphan = [];
for (const rel of files) {
  const name = rel.split("/").pop();
  const inDynamic = DYNAMIC.some((d) => rel.startsWith(d));
  const referenced =
    inDynamic ||
    srcBlob.includes(name) ||
    srcBlob.includes(encodeURIComponent(name));
  const size = statSync(path.join("public", rel)).size;
  (referenced ? used : orphan).push({ rel, size, why: inDynamic ? "readdir" : referenced ? "named" : "—" });
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
const sum = (a) => a.reduce((s, x) => s + x.size, 0);
orphan.sort((a, b) => b.size - a.size);

console.log(`\n=== ORPHANED (not referenced anywhere) — ${orphan.length} files, ${mb(sum(orphan))} MB ===`);
for (const o of orphan) console.log(`  ${mb(o.size).padStart(6)} MB  ${o.rel}`);
console.log(`\n=== USED — ${used.length} files, ${mb(sum(used))} MB (originals; served as avif) ===`);
console.log(`  ${used.filter((u) => u.why === "readdir").length} via readdir folders, ${used.filter((u) => u.why === "named").length} named in src`);
