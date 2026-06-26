// Move every /public raster (.png/.jpg/.jpeg) that is NOT referenced in the
// built HTML out to image-originals/ (gitignored local backup). The site is
// served from the .avif/.webp siblings, so the originals are dead weight in the
// repo. Safe: anything referenced (OG image pic.png, favicon/logos) is kept.
// Run AFTER a build (needs dist/ HTML to know what's referenced).
import { readdirSync, readFileSync, statSync, mkdirSync, renameSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

const htmlBlob = walk("dist")
  .filter((f) => /\.(html|xml|json)$/.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const enc = (rel) => rel.split("/").map(encodeURIComponent).join("/");

let moved = 0, bytes = 0;
const kept = [];
for (const f of walk("public")) {
  if (!/\.(png|jpe?g)$/i.test(f)) continue;
  const relPosix = "/" + path.relative("public", f).replace(/\\/g, "/");
  if (htmlBlob.includes(relPosix) || htmlBlob.includes(enc(relPosix))) {
    kept.push(relPosix);
    continue;
  }
  const size = statSync(f).size;
  const dest = path.join("image-originals", path.relative("public", f));
  if (existsSync(dest)) {
    rmSync(f); // already backed up
  } else {
    mkdirSync(path.dirname(dest), { recursive: true });
    renameSync(f, dest);
  }
  moved++; bytes += size;
}

console.log(`archive-originals: moved/removed ${moved} unreferenced originals, ${(bytes / 1024 / 1024).toFixed(1)} MB out of public/`);
console.log(`kept in public (referenced): ${kept.join(", ")}`);
