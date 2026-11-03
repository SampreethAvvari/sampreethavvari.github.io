// Post-build, for every page: tell the browser early about the code it will need.
//
// A page's script imports a few shared chunks, and the browser only learns that once
// the script itself has arrived. On a phone that is a full round trip behind, and the
// page waits for them before it can start. These chunks go in the head as ordinary
// modulepreload links, so they travel with the script. Words come sooner.
//
// A page's 3D world starts when the page's script gets there, and until then nobody has
// asked for three.js or the world's own code, the biggest files on the site. These go
// in the head too, at low priority: the stylesheets, the font and the first picture
// still come first, and the world has its code that much earlier. A plain preload, since
// browsers ignore the priority on a modulepreload, and the font arriving behind the page's
// first layout means laying the whole page out twice.
//
// Only the code a world always needs. Anything a page loads on demand (the sound, the
// page reader, a figure further down a post) stays on demand.
//
// Runs after scripts/prune-dist.mjs, before scripts/csp.mjs.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIST = process.argv[2] || "dist";
const ASTRO = path.join(DIST, "_astro");
// The chunks that start a page's world, by the name of the source file.
const WORLD = /^(engine|world|rail-gl|opening-gl|case-gl|holo-gl)\.[\w-]+\.js$/;

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );

const memo = new Map();
function refs(name) {
  if (memo.has(name)) return memo.get(name);
  let text = "";
  try {
    text = readFileSync(path.join(ASTRO, name), "utf8");
  } catch {
    /* not one of ours */
  }
  const out = {
    statics: [...text.matchAll(/(?:^|[;\n}])\s*import\s*(?:[^"';]*?from\s*)?"\.\/([^"]+\.js)"/g)].map((m) => m[1]),
    dynamics: [...text.matchAll(/\bimport\("\.\/([^"]+\.js)"\)/g)].map((m) => m[1]),
  };
  memo.set(name, out);
  return out;
}

function closure(names, seen = new Set()) {
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    closure(refs(n).statics, seen);
  }
  return seen;
}

const ENTRY = /<script\b[^>]*\btype="module"[^>]*\bsrc="\/_astro\/([^"]+)"[^>]*>/g;
let pages = 0;
let early = 0;
let world = 0;
for (const file of walk(DIST).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(file, "utf8");
  const end = html.indexOf("</head>");
  if (end < 0) continue;
  const entries = [...html.matchAll(ENTRY)].map((m) => m[1]);
  if (!entries.length) continue;

  const now = closure(entries);
  // A world's code is reached from the page's script or a chunk that script imports.
  const roots = new Set();
  for (const n of now) for (const d of refs(n).dynamics) if (WORLD.test(d)) roots.add(d);
  // The teaching stage reaches its world through one more step.
  for (const n of now) {
    for (const d of refs(n).dynamics) {
      if (!/^mount\./.test(d)) continue;
      for (const m of closure([d])) for (const x of refs(m).dynamics) if (WORLD.test(x)) roots.add(x);
    }
  }
  const later = [...closure([...roots])].filter((n) => !now.has(n));
  const already = (n) => html.includes(`href="/_astro/${n}"`);

  const tags = [
    ...[...now].filter((n) => !entries.includes(n) && !already(n)).map((n) => `<link rel="modulepreload" href="/_astro/${n}" />`),
    ...later.filter((n) => !already(n)).map((n) => `<link rel="preload" as="script" crossorigin href="/_astro/${n}" fetchpriority="low" />`),
  ];
  if (!tags.length) continue;
  writeFileSync(file, html.slice(0, end) + tags.join("") + html.slice(end));
  pages++;
  early += tags.length - later.length;
  world += later.length;
}
console.log(`preload-chunks: ${pages} pages, ${early} shared chunks and ${world} world chunks named early`);
