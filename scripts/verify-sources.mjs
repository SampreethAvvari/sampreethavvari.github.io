// Verify every <source srcset> / <img src> in built HTML resolves to a real
// file in dist/. A 404 source in a <picture> renders a broken image.
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

const htmlFiles = walk("dist").filter((f) => f.endsWith(".html"));
const refs = new Set();
for (const f of htmlFiles) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/(?:srcset|src)="(\/[^"]+\.(?:avif|webp|png|jpe?g))"/gi)) {
    refs.add(m[1]);
  }
}

let missing = 0;
for (const ref of refs) {
  const p = path.join("dist", decodeURIComponent(ref));
  if (!existsSync(p)) {
    missing++;
    if (missing <= 12) console.log("MISSING:", ref);
  }
}
console.log(`\nchecked ${refs.size} unique image refs across ${htmlFiles.length} pages | missing: ${missing}`);
