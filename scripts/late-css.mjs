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
// 2. Minifies inline scripts and styles, which Astro leaves exactly as written,
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
  const out = minify(moveStyles(html));
  before += Buffer.byteLength(html);
  after += Buffer.byteLength(out);
  if (out !== html) {
    writeFileSync(file, out);
    pages++;
  }
}
console.log(`late-css: ${pages} pages, HTML ${(before / 1048576).toFixed(1)} MB to ${(after / 1048576).toFixed(1)} MB`);
