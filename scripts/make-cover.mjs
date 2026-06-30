// Generate an on-brand dark-neon placeholder cover for a teaching material.
// Usage: node scripts/make-cover.mjs "<title>" "<accent hex>" "<eyebrow>" "<outPath>"
// Swap with a real Nano-Banana image later by dropping a PNG at the same path.
import sharp from "sharp";

const [title = "Material", accent = "#34d399", eyebrow = "HANDBOOK", out = "public/teaching/cover.png"] =
  process.argv.slice(2);

const W = 1200, H = 750;

// Greedy word-wrap to ~13 chars/line, max 3 lines.
function wrap(text, max = 13, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur.trim());
      cur = w;
    } else cur = (cur + " " + w).trim();
    if (lines.length === maxLines - 1) break;
  }
  if (cur) lines.push(words.slice(text.split(/\s+/).indexOf(cur.split(" ")[0])).join(" "));
  return lines.slice(0, maxLines);
}
const lines = wrap(title);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");

const dots = [];
for (let y = 60; y < H; y += 46)
  for (let x = 60; x < W; x += 46) dots.push(`<circle cx="${x}" cy="${y}" r="1.1" fill="rgba(255,255,255,0.05)"/>`);

const titleSvg = lines
  .map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 84}">${esc(l)}</tspan>`)
  .join("");

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="12%" cy="8%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.42"/>
      <stop offset="55%" stop-color="${accent}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="92%" cy="98%" r="70%">
      <stop offset="0%" stop-color="#5b8def" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#5b8def" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d0f15"/>
      <stop offset="100%" stop-color="#08090d"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  <g>${dots.join("")}</g>
  <rect x="80" y="${H - 150}" width="64" height="4" rx="2" fill="${accent}"/>
  <text x="80" y="150" font-family="Georgia, 'Times New Roman', serif" font-size="22" letter-spacing="8" fill="${accent}" opacity="0.9">${esc(eyebrow.toUpperCase())}</text>
  <text x="80" y="300" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="76" fill="#f5f5f7">${titleSvg}</text>
  <text x="80" y="${H - 90}" font-family="Georgia, serif" font-size="24" fill="rgba(245,245,247,0.55)">Sampreeth Avvari · Teaching</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`cover -> ${out} (${lines.join(" / ")})`);
