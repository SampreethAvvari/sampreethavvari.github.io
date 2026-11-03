// Post-build, for every page made with BaseLayout:
//
// 1. Moves the page's stylesheets out of the head, to just under the loader at
//    the top of the body. A stylesheet in the head holds back the whole first
//    paint; one in the body only holds back what comes after it. So the loader,
//    whose styles are in the page, is on screen as soon as the HTML arrives.
//    Everything after the stylesheets still waits for them, parsing and scripts
//    included, so nothing runs against an unstyled page. BaseLayout's head script
//    moves them back to the head once parsed, for the router.
//
// 2. Names the 3D code of a page with a world, in a meta tag, so BaseLayout's head
//    script can start it down the wire as soon as the HTML arrives, instead of
//    after the page has laid out and its scripts have run. It is left to the head
//    script because it can check first that this visitor will use it.
//
// 3. Minifies inline scripts and styles, which Astro leaves exactly as written,
//    comments and all, in every page.
//
// Runs before scripts/csp.mjs, which hashes the inline scripts as they end up.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { transformSync } from "esbuild";

const DIST = process.argv[2] || "dist";
const EXEC_TYPES = /^(|module|text\/javascript|application\/javascript)$/i;
const MARKER = /<template data-css-here[^>]*><\/template>/;
const IN_HEAD = /<link\b[^>]*\brel="stylesheet"[^>]*>|<style\b[^>]*>[\s\S]*?<\/style>/g;

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );

const late = (tag) => tag.replace(/^<(link|style)\b/, "<$1 data-late");

function moveStyles(html) {
  if (!MARKER.test(html)) return html;
  const end = html.indexOf("</head>");
  const first = html.indexOf('<link rel="stylesheet"');
  if (end < 0 || first < 0 || first > end) return html.replace(MARKER, "");
  const part = html.slice(first, end);
  const moved = part.match(IN_HEAD) ?? [];
  const rest = part.replace(IN_HEAD, "");
  return (html.slice(0, first) + rest + html.slice(end)).replace(MARKER, () => moved.map(late).join(""));
}

// The chunks a page's script imports when its world starts: the entry engine and
// what it needs, three among them. Found by following the page's script through
// its static imports to the dynamic import of the engine.
const ASTRO = path.join(DIST, "_astro");
const WORLD = /^(engine|world)\./;
const engineMemo = new Map();
function engineChunks(script) {
  if (engineMemo.has(script)) return engineMemo.get(script);
  engineMemo.set(script, []);
  let text = "";
  try {
    text = readFileSync(path.join(ASTRO, script), "utf8");
  } catch {
    return [];
  }
  const deps = (text.match(/viteFileDeps = \[([^\]]*)\]/) || [, ""])[1].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  const out = new Set();
  for (const m of text.matchAll(/import\("\.\/([^"]+)"\),__vite__mapDeps\(\[([\d,]+)\]\)/g)) {
    if (!WORLD.test(m[1])) continue;
    out.add(`/_astro/${m[1]}`);
    for (const i of m[2].split(",")) {
      const dep = deps[+i] ?? "";
      if (/\.js$/.test(dep) && !/\/(hoisted|preload-helper|router|ids|index)\./.test(dep)) out.add(`/${dep}`);
    }
  }
  for (const m of text.matchAll(/(?:from|import)\s*"\.\/(hoisted\.[^"]+)"/g)) for (const c of engineChunks(m[1])) out.add(c);
  const list = [...out];
  engineMemo.set(script, list);
  return list;
}

function nameWorldCode(html) {
  const entry = (html.match(/<script type="module" src="\/_astro\/(hoisted\.[^"]+)"/) || [])[1];
  if (!entry || !MARKER.test(html)) return html;
  const code = engineChunks(entry);
  if (!code.length) return html;
  return html.replace("</head>", `<meta name="world-code" content="${code.join(" ")}"></head>`);
}

const memo = new Map();
function small(code, loader) {
  const key = loader + code;
  if (memo.has(key)) return memo.get(key);
  let out = code;
  try {
    out = transformSync(code, { loader, minify: true, legalComments: "none" }).code.trim();
  } catch (err) {
    console.warn(`late-css: left one inline ${loader} as written: ${err.message.split("\n")[0]}`);
  }
  memo.set(key, out);
  return out;
}

function minify(html) {
  return html
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (all, attrs, body) => {
      if (/\bsrc\s*=/.test(attrs) || !body.trim()) return all;
      const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]*)/i) || [, ""])[1];
      if (!EXEC_TYPES.test(type) || /^module$/i.test(type)) return all;
      return `<script${attrs}>${small(body, "js")}</script>`;
    })
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (all, attrs, body) =>
      body.trim() ? `<style${attrs}>${small(body, "css")}</style>` : all,
    );
}

let pages = 0;
let before = 0;
let after = 0;
for (const file of walk(DIST).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(file, "utf8");
  const out = minify(moveStyles(nameWorldCode(html)));
  before += Buffer.byteLength(html);
  after += Buffer.byteLength(out);
  if (out !== html) {
    writeFileSync(file, out);
    pages++;
  }
}
console.log(`late-css: ${pages} pages, HTML ${(before / 1048576).toFixed(1)} MB to ${(after / 1048576).toFixed(1)} MB`);
