// Post-build: remove CSS rules that can never match anything on this site.
//
// Tailwind scans every source file, the prose in the posts included, so any word
// that looks like a utility gets a rule, and years of redesigns left rules for
// components that no longer exist. All of it is render blocking on every page.
//
// A selector goes only when a class it requires appears nowhere in the built
// site: not in any page, not in any script, not as the start or end of a class
// name built at run time ("pw-" + id leaves "pw-" in the bundle, which keeps
// every pw-* rule). Classes inside :not(), :is(), :where() and :has() never count
// against a selector, and neither do ones with brackets or parentheses in them.
// A rule goes when all of its selectors have gone. Keyframes that nothing names
// go after that. Safe by construction: what remains matches exactly what matched
// before.
//
// Runs as part of `npm run build`, after `astro build`. node scripts/purge-css.mjs [dist]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";

const DIST = process.argv[2] || "dist";

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );

const files = walk(DIST);
const TEXT = /\.(html|js|mjs|json|txt|xml)$/;
const MAX_TEXT = 8 * 1024 * 1024;

// Every word in the built site that could be a class name, whole and split at
// the characters a selector string joins them with.
const tokens = new Set();
const starts = new Set();
const ends = new Set();
for (const f of files) {
  if (!TEXT.test(f) || statSync(f).size > MAX_TEXT) continue;
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/[A-Za-z0-9_\-:/.!%#]+/g)) {
    const t = m[0];
    tokens.add(t);
    if (/[.:/#]/.test(t)) for (const part of t.split(/[.:/#]/)) if (part) tokens.add(part);
  }
}
for (const t of tokens) {
  if (t.length < 3) continue;
  if (t.endsWith("-")) starts.add(t);
  if (t.startsWith("-")) ends.add(t);
}

const known = (cls) => {
  if (/[[\]()]/.test(cls) || tokens.has(cls)) return true;
  for (const s of starts) if (cls.startsWith(s)) return true;
  for (const e of ends) if (cls.endsWith(e)) return true;
  return false;
};

// The selector with every :not(), :is(), :where(), :has() group taken out.
function required(selector) {
  let out = "";
  let depth = 0;
  let i = 0;
  while (i < selector.length) {
    if (depth === 0 && /^:(not|is|where|has|matches|-webkit-any|-moz-any)\(/.test(selector.slice(i))) {
      i = selector.indexOf("(", i) + 1;
      depth = 1;
      continue;
    }
    if (depth > 0) {
      if (selector[i] === "\\") i++;
      else if (selector[i] === "(") depth++;
      else if (selector[i] === ")") depth--;
      i++;
      continue;
    }
    out += selector[i++];
  }
  return out;
}

const CLASS = /\.((?:\\.|[A-Za-z0-9_-])+)/g;
const alive = (selector) => {
  for (const m of required(selector).matchAll(CLASS)) {
    if (!known(m[1].replace(/\\/g, ""))) return false;
  }
  return true;
};

const inKeyframes = (rule) => /keyframes$/i.test(rule.parent?.name ?? "");

const sheets = files.filter((f) => f.endsWith(".css") && f.includes(`_astro`));
let before = 0;
let after = 0;
let droppedRules = 0;
const roots = new Map();

for (const f of sheets) {
  const css = readFileSync(f, "utf8");
  before += Buffer.byteLength(css);
  const root = postcss.parse(css, { from: f });
  root.walkRules((rule) => {
    if (inKeyframes(rule)) return;
    const live = rule.selectors.filter(alive);
    if (!live.length) {
      rule.remove();
      droppedRules++;
    } else if (live.length !== rule.selectors.length) {
      rule.selectors = live;
    }
  });
  roots.set(f, root);
}

// Keyframes: kept when any remaining rule, page or script names them.
const named = new Set(tokens);
for (const root of roots.values()) {
  root.walkDecls(/^(-webkit-)?animation(-name)?$/i, (d) => {
    for (const w of d.value.split(/[\s,]+/)) named.add(w);
  });
}
for (const [f, root] of roots) {
  root.walkAtRules(/keyframes$/i, (at) => {
    if (!named.has(at.params.trim())) at.remove();
  });
  // Blocks left with nothing in them.
  let again = true;
  while (again) {
    again = false;
    root.walkAtRules((at) => {
      if (at.nodes && at.nodes.length === 0 && !/^(font-face|page)$/i.test(at.name)) {
        at.remove();
        again = true;
      }
    });
  }
  const out = root.toString();
  after += Buffer.byteLength(out);
  writeFileSync(f, out);
}

console.log(
  `purge-css: ${droppedRules} rules that can never match removed from ${sheets.length} stylesheets, ` +
    `${(before / 1024).toFixed(0)} KB to ${(after / 1024).toFixed(0)} KB`,
);
