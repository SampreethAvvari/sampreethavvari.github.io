// Write a Content Security Policy into every built page.
//
// GitHub Pages cannot send response headers, so the policy goes in a <meta>
// tag at the top of <head>. Inline scripts are allowed by their sha256 hash
// only (no 'unsafe-inline' for scripts), so a script that was not in the
// build cannot run. Everything else is limited to this site plus the two
// Workers the pages call and the demo the JobPilot post embeds.
//
// Runs after `astro build` (see package.json). Re-running it on the same
// dist replaces the old policy.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

// Origins a page may talk to besides itself: the chat and teaching Workers,
// and Cloudflare Web Analytics (its beacon script and where it reports).
const SCRIPTS = ["https://static.cloudflareinsights.com"];
const CONNECT = [
  "https://sampreeth-chatbot.sampreethavvariedu.workers.dev",
  "https://sampreeth-teaching.sampreethavvariedu.workers.dev",
  "https://cloudflareinsights.com",
];
const FRAMES = ["https://jobpilot-demo.pages.dev"];
// One page needs one more script source: the Enterprise Search demo guide
// draws its diagrams with Mermaid, allowed by its exact package path only.
const PAGE_SCRIPTS = {
  "enterprise-search/demo-guide.html": ["https://cdn.jsdelivr.net/npm/mermaid@11/"],
};

const EXEC_TYPES = /^(|module|text\/javascript|application\/javascript)$/i;

function policyFor(hashes, extraScripts = []) {
  return [
    "default-src 'self'",
    `script-src 'self' ${[...SCRIPTS, ...extraScripts].join(" ")} ${hashes.map((h) => `'${h}'`).join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    `connect-src 'self' ${CONNECT.join(" ")}`,
    `frame-src 'self' ${FRAMES.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

let pages = 0;
let scripts = 0;
for (const file of walk(DIST)) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, "");
  const hashes = new Set();
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue;
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]*)/i) || [, ""])[1];
    if (!EXEC_TYPES.test(type)) continue; // JSON data blocks never run
    // browsers turn CRLF and lone CR into LF before they hash a script
    const body = m[2].replace(/\r\n?/g, "\n");
    hashes.add("sha256-" + crypto.createHash("sha256").update(body, "utf8").digest("base64"));
    scripts++;
  }
  const rel = path.relative(DIST, file).split(path.sep).join("/");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor([...hashes], PAGE_SCRIPTS[rel] || [])}">`;
  if (/<meta charset[^>]*>/i.test(html)) html = html.replace(/(<meta charset[^>]*>)/i, `$1${meta}`);
  else html = html.replace(/<head([^>]*)>/i, `<head$1>${meta}`);
  fs.writeFileSync(file, html);
  pages++;
}
console.log(`[csp] policy written to ${pages} pages (${scripts} inline scripts hashed)`);
