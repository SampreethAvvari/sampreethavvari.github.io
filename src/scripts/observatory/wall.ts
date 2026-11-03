// The architecture wall: an endless wall of thick glass cards, one per
// system, repeating in every direction on a gently curved surface.
//
// One WebGL2 program draws every visible card in one instanced call. Each
// card is a small grid of vertices bent onto the curve in the vertex
// shader; the fragment shader makes the glass from a rounded rectangle's
// distance field: the bevel's normal, refraction with a little dispersion
// at the rim, a bright edge, and a mirrored strip of the words along the
// bottom bevel. The art and words for every card are drawn once with a 2D
// canvas into one texture atlas.
//
// Drag, wheel and arrow keys move the wall with inertia; a card lifts under
// the pointer; a click zooms it to the screen and opens its drawing.
// Everything it starts stops when `signal` aborts.
//
// Events for the score (scripts/sound can listen):
//   architecture:focus  { slug, title, discipline, disciplines }  a card is hovered
//   architecture:flow   { intensity: 0..1 }                         how fast the wall moves

import { navigate } from "astro:transitions/client";

type Card = {
  slug: string;
  name: string;
  project: string;
  kind: "system" | "service";
  disciplines: string[];
  headline: string;
  tail: string;
  status: string;
  running: boolean;
  retired: boolean;
  parts: number;
  mine: number;
  fails: number;
  cost: string;
};

type Inst = { i: number; j: number; card: number; key: number; cx: number; cy: number; sc: number; lift: number; appear: number; back: number; flash: number };

const VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPos;
in vec4 aA; // centre x, centre y, scale, lift
in vec4 aB; // atlas slot, appear, retired, ease back
in vec4 aC; // flash
uniform vec2 uView;
uniform vec2 uCard;
uniform float uPad;
uniform vec2 uR;
uniform float uF;
uniform float uLift;
out vec2 vP;
out float vShade;
out float vLift;
flat out vec4 vB;
flat out vec4 vC;
void main() {
  vec2 halfSize = uCard * 0.5 + uPad;
  vec2 local = aPos * halfSize;
  vec2 w = aA.xy + local * aA.z;
  vec2 ang = w / uR;
  vec3 P = vec3(uR.x * sin(ang.x), uR.y * sin(ang.y), uR.x * (cos(ang.x) - 1.0) + uR.y * (cos(ang.y) - 1.0));
  vec3 N = normalize(vec3(sin(ang.x), sin(ang.y), max(cos(ang.x) * cos(ang.y), 0.05)));
  P += N * aA.w * uLift;
  float persp = uF / max(uF - P.z, 1.0);
  gl_Position = vec4(P.xy * persp / (uView * 0.5), 0.0, 1.0);
  vP = local;
  vShade = N.z;
  vLift = aA.w;
  vB = aB;
  vC = aC;
}
`;

const FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec2 uCard;
uniform float uRadius;
uniform float uBevel;
uniform vec2 uAtlasSize;
uniform vec2 uStride;
uniform float uGutter;
uniform float uCols;
uniform float uLow;
uniform vec3 uTone;
in vec2 vP;
in float vShade;
in float vLift;
flat in vec4 vB;
flat in vec4 vC;
out vec4 frag;

float sdRR(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec2 gradRR(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  vec2 s = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  if (q.x > 0.0 && q.y > 0.0) return normalize(q) * s;
  return q.x > q.y ? vec2(s.x, 0.0) : vec2(0.0, s.y);
}
vec3 atlas(vec2 uv) {
  uv = clamp(uv, vec2(0.003), vec2(0.997));
  float slot = vB.x;
  float col = mod(slot, uCols);
  float row = floor((slot + 0.5) / uCols);
  vec2 cell = uStride - 2.0 * uGutter;
  vec2 px = vec2(col, row) * uStride + uGutter + vec2(uv.x, 1.0 - uv.y) * cell;
  return texture(uAtlas, px / uAtlasSize).rgb;
}
void main() {
  vec2 hs = uCard * 0.5;
  float d = sdRR(vP, hs, uRadius);
  float aa = max(fwidth(d), 0.6);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float lift = vLift;

  // Around the card: a soft shadow, and light when it lifts.
  float dOut = max(d, 0.0);
  float shadow = exp(-dOut / (uCard.y * 0.04)) * 0.45;
  // the glow fades out before the edge of the quad, so no box shows
  float glow = exp(-dOut / (uCard.y * 0.08)) * (0.04 + lift * 0.6) * (1.0 - smoothstep(uCard.y * 0.1, uCard.y * 0.22, dOut));
  vec3 glowCol = mix(vec3(1.0), uTone, 0.25);
  vec4 outside = vec4(glowCol * glow, shadow);

  // The glass: a pillow bevel from the distance field.
  float t = clamp(-d / uBevel, 0.0, 1.0);
  float s = 1.0 - t;
  float slope = min(s / sqrt(max(1.0 - s * s, 0.01)), 5.0);
  vec2 g = gradRR(vP, hs, uRadius);
  vec3 n = normalize(vec3(g * slope, 1.0));
  vec2 uv = vP / uCard + 0.5;
  vec2 off = -g * (1.0 - n.z) * (uBevel * 1.35) / uCard;
  vec3 col;
  if (uLow > 0.5) {
    col = atlas(uv + off);
  } else {
    vec2 tang = vec2(-g.y, g.x) * (1.0 - n.z) * 0.012;
    col.r = atlas(uv + off * 0.45 + tang).r;
    col.g = atlas(uv + off).g;
    col.b = atlas(uv + off * 1.75 - tang).b;
  }

  // The bottom bevel mirrors the words just above it.
  float bottom = smoothstep(0.3, 0.95, -g.y) * step(0.001, s);
  if (bottom > 0.0) {
    float yb = -hs.y + uBevel;
    float my = yb + (yb - vP.y) * 1.45 + uBevel * 0.12;
    vec3 m = atlas(vec2(uv.x + off.x * 0.4, my / uCard.y + 0.5));
    col = mix(col, m * 1.3, bottom * 0.7 * smoothstep(0.0, 0.5, s));
  }

  // Retired and preview systems: a little grey.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * 0.95, vB.z * 0.55);

  // Light on the glass.
  vec2 L = normalize(vec2(-0.5, 0.86));
  float spec = pow(max(dot(g, L), 0.0), 2.0) * pow(s, 1.5);
  float shade = pow(max(dot(g, -L), 0.0), 2.0) * s;
  float rim = exp(min(d, 0.0) / 1.3);
  float fres = pow(1.0 - n.z, 1.4);
  // A thin rainbow where the light bends hardest, as in thick glass.
  float around = atan(g.y, g.x) / 6.2832 + vP.x / uCard.x * 0.35;
  vec3 rainbow = 0.5 + 0.5 * cos(6.2832 * (around + vec3(0.0, 0.33, 0.67)));
  float band = exp(-pow((t - 0.32) / 0.16, 2.0));
  col *= 1.0 - shade * 0.45 - band * 0.12;
  col += rainbow * band * (0.16 + spec * 0.3) * (1.0 - uLow * 0.5);
  col += vec3(1.0) * (spec * 0.7 + rim * 0.42 + fres * 0.16);
  col += vec3(0.9, 0.97, 1.0) * smoothstep(0.3, 0.0, abs(uv.x * 0.55 + uv.y - 1.18)) * 0.05;

  col *= (1.0 + lift * 0.16) * (1.0 - vB.w * 0.22);
  col *= mix(0.38, 1.0, smoothstep(0.5, 0.985, vShade));
  col = mix(col, vec3(1.0), vC.x);

  vec4 card = vec4(col, 1.0);
  frag = mix(outside, card, inside) * vB.y;
}
`;

// Deep space behind the wall: faint nebula, dust and three layers of stars,
// each sliding at its own fraction of the pan, so the sky reads as depth.
const BG_VS = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;
const BG_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uPan;
uniform float uDpr;
uniform float uTime;
uniform float uLow;
uniform vec3 uTone;
out vec4 frag;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p, int oct) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return s;
}
vec3 stars(vec2 b, float cell, float density, float size, float seed) {
  vec2 id = floor(b / cell);
  vec2 f = fract(b / cell);
  float h = hash12(id + seed);
  if (h > density) return vec3(0.0);
  vec2 pos = vec2(hash12(id + seed + 1.31), hash12(id + seed + 7.17)) * 0.8 + 0.1;
  vec2 d = (f - pos) * cell;
  float br = hash12(id + seed + 3.71);
  float tw = 0.72 + 0.28 * sin(uTime * (0.8 + br * 2.6) + h * 60.0);
  float core = exp(-dot(d, d) / (size * size));
  vec3 c = br > 0.86 ? vec3(0.62, 0.95, 1.0) : br < 0.08 ? vec3(1.0, 0.86, 0.72) : vec3(0.82, 0.88, 1.0);
  return c * core * (0.35 + br * br * 1.5) * tw;
}
void main() {
  vec2 p = gl_FragCoord.xy / uDpr;
  int oct = uLow > 0.5 ? 2 : 3;
  // far nebula
  vec2 nb = (p + vec2(uPan.x, -uPan.y) * 0.05) / 620.0;
  float n1 = fbm(nb, oct);
  float n2 = fbm(nb * 1.7 + vec2(4.0, 1.3), oct);
  vec3 col = vec3(0.004, 0.006, 0.012);
  col += uTone * 0.11 * smoothstep(0.4, 0.85, n1);
  col += vec3(0.24, 0.12, 0.55) * 0.1 * smoothstep(0.48, 0.92, n2);
  col += vec3(0.05, 0.09, 0.16) * 0.45 * n1 * n1;
  // dust, a little nearer
  vec2 db = (p + vec2(uPan.x, -uPan.y) * 0.18) / 210.0;
  float dust = fbm(db, oct);
  col += vec3(0.5, 0.62, 0.8) * 0.025 * smoothstep(0.55, 0.9, dust);
  // stars, far to near
  col += stars(p + vec2(uPan.x, -uPan.y) * 0.04, 40.0, 0.45, 0.8, 1.0) * 0.9;
  col += stars(p + vec2(uPan.x, -uPan.y) * 0.1, 84.0, 0.4, 1.05, 11.0) * 1.3;
  if (uLow < 0.5) col += stars(p + vec2(uPan.x, -uPan.y) * 0.22, 170.0, 0.32, 1.6, 23.0) * 1.6;
  frag = vec4(col, 1.0);
}
`;

const SEG_X = 14;
const SEG_Y = 10;
const MAX_INST = 160;
const FLOATS = 12;

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const damp = (c: number, t: number, rate: number, dt: number) => c + (t - c) * (1 - Math.exp(-rate * dt));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const mod = (a: number, n: number) => ((a % n) + n) % n;

export function mountWall(signal: AbortSignal): void | (() => void) {
  const root = document.querySelector<HTMLElement>("[data-wall]");
  const dataEl = document.getElementById("wall-data");
  if (!root || !dataEl) return;
  const stage = root.querySelector<HTMLElement>("[data-wall-stage]")!;
  const canvas = root.querySelector<HTMLCanvasElement>("[data-wall-canvas]")!;
  const hint = root.querySelector<HTMLElement>("[data-wall-hint]");
  const flashEl = root.querySelector<HTMLElement>("[data-wall-flash]");
  const liveEl = root.querySelector<HTMLElement>("[data-wall-live]");
  const modeBtn = root.querySelector<HTMLButtonElement>("[data-wall-mode]");
  const modeLabel = root.querySelector<HTMLElement>("[data-wall-mode-label]");
  const listEl = root.querySelector<HTMLElement>("[data-wall-list]");
  const items = [...root.querySelectorAll<HTMLElement>(".gl-item")];
  const empty = root.querySelector<HTMLElement>("[data-wall-empty]");
  const chips = [...root.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  const cards: Card[] = JSON.parse(dataEl.textContent || "[]");
  const on = { signal };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Touch screens have no wheel, so the hint says what works there.
  if (matchMedia("(pointer: coarse)").matches) {
    const ht = root.querySelector<HTMLElement>("[data-wall-hint-text]");
    if (ht) ht.textContent = "Drag to explore";
  }
  const low = matchMedia("(max-width: 767px), (pointer: coarse)").matches || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 4;

  // ------------------------------------------------------------ filters
  const TESTS: Record<string, (c: Card) => boolean> = {
    all: () => true,
    aie: (c) => c.disciplines.includes("aie"),
    fde: (c) => c.disciplines.includes("fde"),
    mle: (c) => c.disciplines.includes("mle"),
    sde: (c) => c.disciplines.includes("sde"),
    service: (c) => c.kind === "service",
  };
  let filter = "all";
  try {
    const saved = new URLSearchParams(location.search).get("kind") || sessionStorage.getItem("arch-filter");
    if (saved && TESTS[saved] && chips.some((c) => c.dataset.filter === saved && !c.disabled)) filter = saved;
  } catch {}
  let list = cards.map((_, i) => i).filter((i) => TESTS[filter](cards[i]));
  const showFilter = () => {
    chips.forEach((c) => {
      const isOn = c.dataset.filter === filter;
      c.classList.toggle("is-on", isOn);
      c.setAttribute("aria-pressed", String(isOn));
    });
    items.forEach((el, i) => (el.hidden = !TESTS[filter](cards[i])));
    if (empty) empty.hidden = list.length > 0;
  };
  showFilter();

  // --------------------------------------------------------------- mode
  // The wall, or the list of real links. Without WebGL2 the list is all.
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: low ? "default" : "high-performance" });
  let mode: "wall" | "list" = gl ? "wall" : "list";
  try {
    if (sessionStorage.getItem("arch-view") === "list") mode = "list";
  } catch {}
  const setMode = (m: "wall" | "list", focusList = false) => {
    if (!gl) m = "list";
    mode = m;
    root.dataset.mode = m;
    document.documentElement.classList.toggle("wall-on", m === "wall");
    modeBtn?.setAttribute("aria-pressed", String(m === "list"));
    if (modeLabel) modeLabel.textContent = m === "list" ? "Wall view" : "List view";
    try {
      sessionStorage.setItem("arch-view", m);
    } catch {}
    if (m === "wall") {
      scrollTo(0, 0);
      kick();
    } else if (focusList) listEl?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
  };
  modeBtn?.addEventListener("click", () => setMode(mode === "wall" ? "list" : "wall"), on);
  // Keyboard focus that lands in the list, or past it, shows the list.
  document.addEventListener("focusin", (e) => {
    if (mode !== "wall") return;
    const t = e.target as HTMLElement;
    if (listEl?.contains(t) || t.closest?.("footer, .next-step")) setMode("list");
  }, on);

  if (!gl) {
    setMode("list");
    chips.forEach((c) => c.addEventListener("click", () => {
      filter = c.dataset.filter || "all";
      list = cards.map((_, i) => i).filter((i) => TESTS[filter](cards[i]));
      showFilter();
    }, on));
    return () => document.documentElement.classList.remove("wall-on");
  }

  // ------------------------------------------------------------- program
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = (name: string) => gl.getUniformLocation(prog, name);
  const u = {
    view: U("uView"), card: U("uCard"), pad: U("uPad"), r: U("uR"), f: U("uF"), lift: U("uLift"),
    radius: U("uRadius"), bevel: U("uBevel"), atlasSize: U("uAtlasSize"), stride: U("uStride"), gutter: U("uGutter"),
    cols: U("uCols"), low: U("uLow"), tone: U("uTone"), atlas: U("uAtlas"),
  };

  // A card is a grid of vertices, so the curve bends it smoothly.
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const verts: number[] = [];
  for (let y = 0; y <= SEG_Y; y++) for (let x = 0; x <= SEG_X; x++) verts.push((x / SEG_X) * 2 - 1, (y / SEG_Y) * 2 - 1);
  const idx: number[] = [];
  for (let y = 0; y < SEG_Y; y++)
    for (let x = 0; x < SEG_X; x++) {
      const a = y * (SEG_X + 1) + x;
      idx.push(a, a + 1, a + SEG_X + 1, a + 1, a + SEG_X + 2, a + SEG_X + 1);
    }
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  const locPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
  const ibo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  const instData = new Float32Array(MAX_INST * FLOATS);
  const instBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  gl.bufferData(gl.ARRAY_BUFFER, instData.byteLength, gl.DYNAMIC_DRAW);
  ["aA", "aB", "aC"].forEach((name, k) => {
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, FLOATS * 4, k * 16);
    gl.vertexAttribDivisor(loc, 1);
  });
  gl.bindVertexArray(null);

  // The sky behind: one full screen triangle.
  const bgVs = compile(gl.VERTEX_SHADER, BG_VS);
  const bgFs = compile(gl.FRAGMENT_SHADER, BG_FS);
  const bgProg = gl.createProgram()!;
  gl.attachShader(bgProg, bgVs);
  gl.attachShader(bgProg, bgFs);
  gl.linkProgram(bgProg);
  if (!gl.getProgramParameter(bgProg, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(bgProg));
  const bgU = {
    pan: gl.getUniformLocation(bgProg, "uPan"),
    dpr: gl.getUniformLocation(bgProg, "uDpr"),
    time: gl.getUniformLocation(bgProg, "uTime"),
    low: gl.getUniformLocation(bgProg, "uLow"),
    tone: gl.getUniformLocation(bgProg, "uTone"),
  };
  const bgVao = gl.createVertexArray()!;
  gl.bindVertexArray(bgVao);
  const bgBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, bgBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const bgLoc = gl.getAttribLocation(bgProg, "aPos");
  gl.enableVertexAttribArray(bgLoc);
  gl.vertexAttribPointer(bgLoc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // --------------------------------------------------------------- atlas
  // One texture holds every card: art, shade and words, drawn with a 2D
  // canvas. Phones get smaller cells.
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const cellW = low ? 448 : 736;
  const cellH = Math.round(cellW * 0.625);
  const GUT = 8;
  const strideW = cellW + GUT * 2;
  const strideH = cellH + GUT * 2;
  const cols = Math.max(1, Math.min(cards.length, Math.floor(Math.min(maxTex, 8192) / strideW), low ? 6 : 8));
  const rows = Math.ceil(cards.length / cols);
  const atlasW = cols * strideW;
  const atlasH = rows * strideH;
  const levels = Math.floor(Math.log2(Math.max(atlasW, atlasH))) + 1;
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, atlasW, atlasH);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, low ? 2 : 4);
  const cellCanvas = document.createElement("canvas");
  cellCanvas.width = strideW;
  cellCanvas.height = strideH;
  const cx2d = cellCanvas.getContext("2d")!;
  const ready = new Set<number>();
  let mipDirty = false;
  let mipTimer = 0;
  const images: HTMLImageElement[] = [];

  const fit = (text: string, weight: number, size: number, min: number, max: number) => {
    let s = size;
    cx2d.font = `${weight} ${s}px Inter, "Inter Fallback", system-ui, sans-serif`;
    while (s > min && cx2d.measureText(text).width > max) {
      s -= 1;
      cx2d.font = `${weight} ${s}px Inter, "Inter Fallback", system-ui, sans-serif`;
    }
    return s;
  };
  const wrap = (text: string, max: number, lines: number) => {
    const words = text.split(/\s+/);
    const out: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (cx2d.measureText(next).width <= max || !line) line = next;
      else {
        out.push(line);
        line = w;
        if (out.length === lines - 1) {
          // the last line takes the rest, cut with an ellipsis if it must be
          const rest = words.slice(words.indexOf(w)).join(" ");
          let r = rest;
          while (cx2d.measureText(r).width > max && r.length > 4) r = r.slice(0, -2);
          if (r !== rest) r = r.replace(/\s*\S*$/, "") + "…";
          out.push(r);
          return out;
        }
      }
    }
    if (line) out.push(line);
    return out;
  };

  function drawCell(k: number) {
    const c = cards[k];
    const img = images[k];
    const W = cellW;
    const H = cellH;
    const s = W / 736;
    const ctx = cx2d;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, strideW, strideH);
    ctx.translate(GUT, GUT);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a1220");
    bg.addColorStop(1, "#04060b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (img && img.naturalWidth) {
      const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.04;
      const dw = img.naturalWidth * sc;
      const dh = img.naturalHeight * sc;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2 - H * 0.04, dw, dh);
    } else {
      // Until the art arrives: a faint drafting grid in the tab colour.
      ctx.strokeStyle = "rgba(34, 211, 238, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 28 * s) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 28 * s) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }
    // Shade under the words, top and bottom.
    const gb = ctx.createLinearGradient(0, H * 0.34, 0, H);
    gb.addColorStop(0, "rgba(2, 3, 6, 0)");
    gb.addColorStop(0.5, "rgba(2, 3, 6, 0.5)");
    gb.addColorStop(1, "rgba(2, 3, 6, 0.86)");
    ctx.fillStyle = gb;
    ctx.fillRect(0, 0, W, H);
    const gt = ctx.createLinearGradient(0, 0, 0, H * 0.3);
    gt.addColorStop(0, "rgba(2, 3, 6, 0.62)");
    gt.addColorStop(1, "rgba(2, 3, 6, 0)");
    ctx.fillStyle = gt;
    ctx.fillRect(0, 0, W, H * 0.3);

    const pad = 40 * s;
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 10 * s;
    // Top left: the project and its counts.
    ctx.fillStyle = "rgba(125, 235, 250, 0.96)";
    fit(c.project, 600, Math.round(19 * s), Math.round(14 * s), W * 0.5);
    ctx.textAlign = "left";
    ctx.fillText(c.project, pad, pad + 14 * s);
    ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
    const facts = [`${c.parts} parts`, `${c.fails} failure paths`, c.cost].filter(Boolean).join("  ·  ");
    fit(facts, 500, Math.round(16 * s), Math.round(12 * s), W * 0.56);
    ctx.fillText(facts, pad, pad + 38 * s);
    // Top right: status, a small dot and its words.
    ctx.textAlign = "right";
    fit(c.status, 500, Math.round(16 * s), Math.round(12 * s), W * 0.36);
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.fillText(c.status, W - pad, pad + 14 * s);
    const sw = ctx.measureText(c.status).width;
    ctx.shadowBlur = c.running ? 10 * s : 0;
    ctx.shadowColor = c.running ? "rgba(34, 197, 94, 0.9)" : "transparent";
    ctx.fillStyle = c.running ? "#22c55e" : "rgba(190, 205, 222, 0.75)";
    ctx.beginPath();
    ctx.arc(W - pad - sw - 12 * s, pad + 8.5 * s, 4.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    // Bottom left: the name, then its line.
    ctx.textAlign = "left";
    const bottomPad = H * 0.085 + 26 * s;
    ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
    fit("x", 500, Math.round(22 * s), Math.round(22 * s), W);
    const lines = wrap(c.headline, W - pad * 2.2, 2);
    const lh = 29 * s;
    lines.forEach((ln, i) => ctx.fillText(ln, pad, H - bottomPad - (lines.length - 1 - i) * lh));
    const titleY = H - bottomPad - lines.length * lh - 12 * s;
    ctx.shadowBlur = 16 * s;
    ctx.fillStyle = "#ffffff";
    fit(c.name, 700, Math.round(50 * s), Math.round(34 * s), W - pad * 2);
    ctx.fillText(c.name, pad, titleY);
    ctx.restore();

    const col = k % cols;
    const row = Math.floor(k / cols);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texSubImage2D(gl!.TEXTURE_2D, 0, col * strideW, row * strideH, gl!.RGBA, gl!.UNSIGNED_BYTE, cellCanvas);
    ready.add(k);
    mipDirty = true;
    if (!mipTimer) mipTimer = window.setTimeout(() => {
      mipTimer = 0;
      if (signal.aborted || !mipDirty) return;
      mipDirty = false;
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.generateMipmap(gl!.TEXTURE_2D);
      kick();
    }, 120);
  }

  // Words first (once Inter is in), then each picture as it arrives.
  const fontsIn = Promise.race([
    Promise.all([document.fonts.load('700 50px Inter'), document.fonts.load('500 22px Inter'), document.fonts.load('600 19px Inter')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  fontsIn.then(() => {
    if (signal.aborted) return;
    cards.forEach((_, k) => drawCell(k));
    // Pictures nearest the centre first.
    const first = list.length ? list : cards.map((_, i) => i);
    const orderLoad = [...first, ...cards.map((_, i) => i).filter((i) => !first.includes(i))];
    orderLoad.forEach((k, n) => {
      const img = new Image();
      img.decoding = "async";
      img.src = `/arch/${cards[k].slug}.webp`;
      images[k] = img;
      const done = () => {
        if (signal.aborted) return;
        drawCell(k);
      };
      setTimeout(() => img.decode().then(done, () => {}), Math.min(n * 25, 400));
    });
  });

  // -------------------------------------------------------------- layout
  let W = 1;
  let H = 1;
  let dpr = 1;
  let phone = false;
  let cw = 400;
  let ch = 250;
  let cellX = 420;
  let cellY = 270;
  let Rx = 1000;
  let Ry = 1000;
  let F = 1500;
  let liftPx = 60;
  let extI = 3;
  let extJ = 3;
  let resizeDirty = true;

  function project(wx: number, wy: number, lift: number, out: { x: number; y: number }) {
    const ax = wx / Rx;
    const ay = wy / Ry;
    let px = Rx * Math.sin(ax);
    let py = Ry * Math.sin(ay);
    let pz = Rx * (Math.cos(ax) - 1) + Ry * (Math.cos(ay) - 1);
    if (lift) {
      const nx = Math.sin(ax);
      const ny = Math.sin(ay);
      const nz = Math.max(Math.cos(ax) * Math.cos(ay), 0.05);
      const l = Math.hypot(nx, ny, nz);
      px += (nx / l) * lift * liftPx;
      py += (ny / l) * lift * liftPx;
      pz += (nz / l) * lift * liftPx;
    }
    const k = F / Math.max(F - pz, 1);
    out.x = W / 2 + px * k;
    out.y = H / 2 - py * k;
    return out;
  }

  function resize() {
    resizeDirty = false;
    W = canvas.clientWidth || innerWidth;
    H = canvas.clientHeight || innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    phone = W < 700;
    if (phone) {
      cw = Math.min(W * 0.74, 360);
      ch = cw * 0.625;
      cellX = cw + 22;
      cellY = ch + 22;
      Rx = W * 0.82;
      Ry = H * 0.78;
      F = H * 1.5;
    } else {
      cw = clamp(W * 0.285, 300, 480);
      ch = cw * 0.625;
      const gap = cw * 0.09;
      cellX = cw + gap;
      cellY = ch + gap;
      Rx = W * 0.92;
      Ry = H * 1.25;
      F = W * 1.35;
    }
    liftPx = ch * 0.3;
    // The hint sits just under the card in the middle.
    if (hint) {
      hint.style.top = `${Math.round(H / 2 + ch * 0.58)}px`;
      hint.style.bottom = "auto";
    }
    // How many cells reach the screen's edge on the curve.
    const out = { x: 0, y: 0 };
    let i = 1;
    while (i < 14) {
      project(i * cellX - cellX / 2, 0, 0, out);
      if (out.x > W + cw * 0.15 || (i * cellX) / Rx > 1.45) break;
      i++;
    }
    extI = i + 1;
    let j = 1;
    while (j < 14) {
      project(0, j * cellY - cellY / 2, 0, out);
      if (out.y < -ch * 0.15 || (j * cellY) / Ry > 1.45) break;
      j++;
    }
    extJ = j + 1;
  }
  const ro = new ResizeObserver(() => {
    resizeDirty = true;
    kick();
  });
  ro.observe(canvas);

  // -------------------------------------------------------------- motion
  let ox = 0;
  let oy = 0;
  let tx = 0;
  let ty = 0;
  let vx = 0;
  let vy = 0;
  let lastInput = performance.now();
  let interacted = false;
  let time = 0;
  let last = 0;
  let raf = 0;
  let speedEased = 0;

  // Intro and filter changes: cards appear outward from the middle.
  type Phase = { kind: "in" | "out" | "rest"; t0: number; ci: number; cj: number; first: boolean };
  let phase: Phase = { kind: "in", t0: 0, ci: 0, cj: 0, first: true };
  // The intro waits for the site's loader to lift, so it is seen.
  const warp = document.getElementById("warp");
  const warpUp = () => !!warp && !warp.hidden && !warp.classList.contains("is-done");
  let holdIntro = !reduced && warpUp();
  if (holdIntro && warp) {
    const release = () => {
      if (!holdIntro) return;
      holdIntro = false;
      phase.t0 = time;
      mo.disconnect();
      kick();
    };
    const mo = new MutationObserver(() => {
      if (!warpUp()) release();
    });
    mo.observe(warp, { attributes: true, attributeFilter: ["class", "hidden"] });
    const cap = setTimeout(release, 4000);
    signal.addEventListener("abort", () => {
      mo.disconnect();
      clearTimeout(cap);
    });
  }
  let pendingFilter: string | null = null;
  const appearAt = (i: number, j: number) => {
    if (reduced || phase.kind === "rest") return 1;
    if (holdIntro) return 0;
    const t = time - phase.t0;
    const dist = Math.hypot(i - phase.ci, (j - phase.cj) * 1.35);
    if (phase.kind === "out") return 1 - easeOut((t - dist * 0.025) / 0.24);
    const delay = phase.first ? (dist < 0.5 ? 0.1 : 0.75 + dist * 0.1) : 0.04 + dist * 0.06;
    return easeOut((t - delay) / (phase.first ? 0.7 : 0.45));
  };

  // Lift per cell, so a hovered card rises and its neighbours ease back.
  const lifts = new Map<number, number>();
  let hover: Inst | null = null;
  let hoverCard = -1;
  let opening: { inst: Inst; t0: number; done: boolean } | null = null;
  const insts: Inst[] = [];
  const cellKey = (i: number, j: number) => i * 4099 + j;

  function stride(n: number) {
    if (n <= 2) return 1;
    if (n <= 4) return 2;
    let s = Math.round(n * 0.4);
    while (s > 1 && (s % n === 0 || n % s === 0)) s++;
    return s;
  }

  // ------------------------------------------------------------- pointer
  let px: number | null = null;
  let py: number | null = null;
  let dragging = false;
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  let startTx = 0;
  let startTy = 0;
  let moved = 0;
  const samples: Array<{ t: number; x: number; y: number }> = [];

  const wake = () => {
    lastInput = performance.now();
    if (!interacted) {
      interacted = true;
      hint?.classList.add("is-gone");
    }
    kick();
  };

  stage.addEventListener("pointerdown", (e) => {
    if (opening) return;
    if (e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    dragging = true;
    moved = 0;
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
    startTx = tx;
    startTy = ty;
    vx = vy = 0;
    samples.length = 0;
    samples.push({ t: downAt, x: e.clientX, y: e.clientY });
    px = e.clientX;
    py = e.clientY;
    stage.classList.add("is-dragging");
    wake();
  }, on);
  stage.addEventListener("pointermove", (e) => {
    px = e.clientX;
    py = e.clientY;
    if (dragging) {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      moved = Math.max(moved, Math.hypot(dx, dy));
      tx = startTx - dx * 1.15;
      ty = startTy - dy * 1.15;
      const now = performance.now();
      samples.push({ t: now, x: e.clientX, y: e.clientY });
      while (samples.length > 2 && now - samples[0].t > 90) samples.shift();
      wake();
    } else kick();
  }, on);
  const release = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("is-dragging");
    const now = performance.now();
    const a = samples[0];
    const b = samples[samples.length - 1];
    const dtS = Math.max(16, b.t - a.t) / 1000;
    if (moved > 6 && now - b.t < 80) {
      vx = -((b.x - a.x) / dtS) * 1.15;
      vy = -((b.y - a.y) / dtS) * 1.15;
      const sp = Math.hypot(vx, vy);
      if (sp > 4200) {
        vx *= 4200 / sp;
        vy *= 4200 / sp;
      }
    }
    // A tap or a click, not a drag: open the card under it.
    if (moved <= 6 && now - downAt < 600 && e.type === "pointerup") {
      px = e.clientX;
      py = e.clientY;
      pickHover();
      if (hover) open(hover);
    }
    if (e.pointerType === "touch") {
      px = py = null;
    }
    wake();
  };
  stage.addEventListener("pointerup", release, on);
  stage.addEventListener("pointercancel", release, on);
  stage.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "touch" && !dragging) {
      px = py = null;
      kick();
    }
  }, on);
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (opening || e.ctrlKey) return;
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? H : 1;
    // Shift with a plain mouse wheel means sideways. Some browsers turn it
    // into deltaX already; others keep deltaY and only set shiftKey.
    let dx = e.deltaX, dy = e.deltaY;
    if (e.shiftKey && Math.abs(dx) < 0.5) { dx = dy; dy = 0; }
    tx += dx * k;
    ty += dy * k;
    vx = vy = 0;
    wake();
  }, { passive: false, signal });
  stage.addEventListener("keydown", (e) => {
    if (opening) return;
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (step) {
      e.preventDefault();
      // Snap to the grid so the card in the middle is always whole.
      tx = Math.round(tx / cellX + step[0]) * cellX;
      ty = Math.round(ty / cellY + step[1]) * cellY;
      vx = vy = 0;
      keyNav = true;
      wake();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const c = centreInst();
      if (c) open(c);
    }
  }, on);
  let keyNav = false;
  let announced = -1;

  chips.forEach((c) => c.addEventListener("click", () => {
    const f = c.dataset.filter || "all";
    if (f === filter) return;
    filter = f;
    try {
      sessionStorage.setItem("arch-filter", f);
    } catch {}
    if (mode === "list" || reduced) {
      list = cards.map((_, i) => i).filter((i) => TESTS[filter](cards[i]));
      showFilter();
      tx = ty = ox = oy = 0;
      kick();
      return;
    }
    // The wall folds in, re-deals the chosen systems, and opens again.
    pendingFilter = f;
    const ci = Math.round(ox / cellX);
    const cj = Math.round(oy / cellY);
    phase = { kind: "out", t0: time, ci, cj, first: false };
    showFilterChips();
    wake();
  }, on));
  const showFilterChips = () => chips.forEach((c) => {
    const isOn = c.dataset.filter === filter;
    c.classList.toggle("is-on", isOn);
    c.setAttribute("aria-pressed", String(isOn));
  });

  // ---------------------------------------------------------------- open
  function open(inst: Inst) {
    if (opening) return;
    const c = cards[inst.card];
    const href = `/architecture/${c.slug}`;
    if (reduced) {
      navigate(href);
      return;
    }
    opening = { inst: { ...inst }, t0: time, done: false };
    flashEl?.classList.add("is-on");
    kick();
  }
  function centreInst(): Inst | null {
    let best: Inst | null = null;
    let bd = 1e9;
    for (const it of insts) {
      const d = Math.hypot(it.cx, it.cy);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  // --------------------------------------------------------------- hover
  const pa = { x: 0, y: 0 };
  const pb = { x: 0, y: 0 };
  const pc = { x: 0, y: 0 };
  const pd = { x: 0, y: 0 };
  const cross = (ax: number, ay: number, bx: number, by: number, x: number, y: number) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  function pickHover() {
    let found: Inst | null = null;
    if (px !== null && py !== null && !dragging && !opening && phase.kind === "rest") {
      // Topmost first: the list is drawn back to front.
      const r = canvas.getBoundingClientRect();
      const x = px - r.left;
      const y = py - r.top;
      for (let k = insts.length - 1; k >= 0; k--) {
        const it = insts[k];
        if (it.appear < 0.5) continue;
        const hw = (cw / 2) * it.sc;
        const hh = (ch / 2) * it.sc;
        project(it.cx - hw, it.cy + hh, it.lift, pa);
        project(it.cx + hw, it.cy + hh, it.lift, pb);
        project(it.cx + hw, it.cy - hh, it.lift, pc);
        project(it.cx - hw, it.cy - hh, it.lift, pd);
        const s1 = cross(pa.x, pa.y, pb.x, pb.y, x, y);
        const s2 = cross(pb.x, pb.y, pc.x, pc.y, x, y);
        const s3 = cross(pc.x, pc.y, pd.x, pd.y, x, y);
        const s4 = cross(pd.x, pd.y, pa.x, pa.y, x, y);
        if ((s1 >= 0 && s2 >= 0 && s3 >= 0 && s4 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0 && s4 <= 0)) {
          found = it;
          break;
        }
      }
    }
    hover = found;
    stage.classList.toggle("is-over", !!found);
    const card = found ? found.card : -1;
    if (card !== hoverCard) {
      hoverCard = card;
      if (card >= 0) focusEvent(card);
    }
  }
  const focusEvent = (k: number) => {
    const c = cards[k];
    window.dispatchEvent(new CustomEvent("architecture:focus", { detail: { slug: c.slug, title: c.name, discipline: c.disciplines[0] ?? null, disciplines: c.disciplines } }));
  };

  // ---------------------------------------------------------------- frame
  let lastFlow = -1;
  let lastFlowAt = 0;
  function frame(now: number) {
    raf = 0;
    if (signal.aborted || mode !== "wall" || document.hidden) return;
    if (resizeDirty) resize();
    const dt = last ? Math.min(0.05, Math.max(0.001, (now - last) / 1000)) : 1 / 60;
    last = now;
    time += dt;

    // Inertia, then the wall eases toward where it is asked to be.
    if (!dragging) {
      tx += vx * dt;
      ty += vy * dt;
      const fr = Math.exp(-2.4 * dt);
      vx *= fr;
      vy *= fr;
      if (Math.abs(vx) < 2) vx = 0;
      if (Math.abs(vy) < 2) vy = 0;
      // A slow drift when nobody is touching it.
      const idle = (now - lastInput) / 1000;
      if (!reduced && idle > 3 && !opening && !keyNav) {
        const k = Math.min(1, (idle - 3) / 3);
        tx += 7 * k * dt;
        ty += 3.2 * k * dt;
      }
    }
    const pox = ox;
    const poy = oy;
    ox = reduced ? tx : damp(ox, tx, dragging ? 22 : 9, dt);
    oy = reduced ? ty : damp(oy, ty, dragging ? 22 : 9, dt);
    const speed = Math.hypot(ox - pox, oy - poy) / dt;
    speedEased = damp(speedEased, speed, 6, dt);

    // Phases.
    if (holdIntro) phase.t0 = time;
    if (phase.kind === "out" && time - phase.t0 > 0.42 && pendingFilter) {
      filter = pendingFilter;
      pendingFilter = null;
      list = cards.map((_, i) => i).filter((i) => TESTS[filter](cards[i]));
      showFilter();
      tx = ty = ox = oy = 0;
      vx = vy = 0;
      phase = { kind: "in", t0: time, ci: 0, cj: 0, first: false };
    } else if (phase.kind === "in" && time - phase.t0 > (phase.first ? 3.2 : 1.6)) {
      phase = { kind: "rest", t0: time, ci: 0, cj: 0, first: false };
      if (!interacted) setTimeout(() => !signal.aborted && hint?.classList.add("is-gone"), 3500);
    }

    // Visible cells.
    insts.length = 0;
    const n = list.length;
    const st = stride(n);
    if (n) {
      const ci = Math.round(ox / cellX);
      const cj = Math.round(oy / cellY);
      for (let j = cj - extJ; j <= cj + extJ; j++) {
        for (let i = ci - extI; i <= ci + extI; i++) {
          const x = i * cellX - ox;
          const y = -(j * cellY - oy);
          if (Math.abs(x) / Rx > 1.5 || Math.abs(y) / Ry > 1.5) continue;
          const card = list[mod(i + j * st, n)];
          const key = cellKey(i, j);
          const isHover = hover && hover.key === key && !dragging;
          let lift = lifts.get(key) ?? 0;
          lift = reduced ? (isHover ? 1 : 0) : damp(lift, isHover ? 1 : 0, isHover ? 10 : 6, dt);
          if (lift > 0.002) lifts.set(key, lift);
          else lifts.delete(key);
          const appear = appearAt(i, j);
          insts.push({ i, j, card, key, cx: x, cy: y, sc: (0.8 + 0.2 * appear) * (1 + 0.06 * lift), lift, appear, back: 0, flash: 0 });
        }
      }
    }
    // Neighbours ease back while one card is up.
    const up = hover && !dragging ? 1 : 0;
    backAmt = reduced ? up : damp(backAmt, up, 6, dt);
    for (const it of insts) {
      it.back = backAmt * (1 - it.lift);
      it.sc *= 1 - 0.02 * it.back;
    }

    // Opening a card: it flies to the middle and fills the screen.
    let curve = 1;
    if (opening) {
      const t = clamp((time - opening.t0) / 0.56, 0, 1);
      const e = t * t * (3 - 2 * t);
      curve = 1 - e * 0.85;
      const fill = Math.max(W / cw, H / ch) * 1.12;
      const o = opening.inst;
      let target = insts.find((x) => x.key === o.key);
      if (!target) {
        target = { ...o };
        insts.push(target);
      }
      target.cx = o.cx * (1 - e);
      target.cy = o.cy * (1 - e);
      target.sc = 1 + (fill - 1) * e;
      target.lift = 1 - e;
      target.flash = Math.max(0, (t - 0.45) / 0.55) * 0.85;
      target.appear = 1;
      for (const it of insts) if (it !== target) it.appear *= 1 - e;
      if (t >= 1 && !opening.done) {
        opening.done = true;
        navigate(`/architecture/${cards[o.card].slug}`);
      }
    }

    // Back to front: lifted cards last.
    insts.sort((a, b) => a.lift - b.lift + (a.flash - b.flash) * 10);
    if (insts.length > MAX_INST) insts.splice(0, insts.length - MAX_INST);

    pickHover();
    // Keyboard: say which card is in the middle once the wall settles.
    if (keyNav && Math.hypot(tx - ox, ty - oy) < 2) {
      const c = centreInst();
      if (c && c.card !== announced) {
        announced = c.card;
        const cd = cards[c.card];
        if (liveEl) liveEl.textContent = `${cd.name}. ${cd.headline} Press Enter to open its drawing.`;
        focusEvent(c.card);
      }
    }

    // Draw.
    let k = 0;
    for (const it of insts) {
      const o = k * FLOATS;
      instData[o] = it.cx;
      instData[o + 1] = it.cy;
      instData[o + 2] = it.sc;
      instData[o + 3] = it.lift;
      instData[o + 4] = it.card;
      instData[o + 5] = it.appear;
      instData[o + 6] = cards[it.card].retired ? 1 : 0;
      instData[o + 7] = it.back;
      instData[o + 8] = it.flash;
      instData[o + 9] = 0;
      instData[o + 10] = 0;
      instData[o + 11] = 0;
      k++;
    }
    const g = gl!;
    g.viewport(0, 0, canvas.width, canvas.height);
    g.disable(g.BLEND);
    g.useProgram(bgProg);
    g.uniform2f(bgU.pan, ox, oy);
    g.uniform1f(bgU.dpr, dpr);
    g.uniform1f(bgU.time, reduced ? 0 : time);
    g.uniform1f(bgU.low, low ? 1 : 0);
    g.uniform3f(bgU.tone, 34 / 255, 211 / 255, 238 / 255);
    g.bindVertexArray(bgVao);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.bindVertexArray(null);
    if (k) {
      g.useProgram(prog);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      g.uniform2f(u.view, W, H);
      g.uniform2f(u.card, cw, ch);
      g.uniform1f(u.pad, ch * 0.24);
      g.uniform2f(u.r, Rx / curve, Ry / curve);
      g.uniform1f(u.f, F);
      g.uniform1f(u.lift, liftPx);
      g.uniform1f(u.radius, ch * 0.15);
      g.uniform1f(u.bevel, ch * (phone ? 0.075 : 0.085));
      g.uniform2f(u.atlasSize, atlasW, atlasH);
      g.uniform2f(u.stride, strideW, strideH);
      g.uniform1f(u.gutter, GUT);
      g.uniform1f(u.cols, cols);
      g.uniform1f(u.low, low ? 1 : 0);
      g.uniform3f(u.tone, 34 / 255, 211 / 255, 238 / 255);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, tex);
      g.uniform1i(u.atlas, 0);
      g.bindBuffer(g.ARRAY_BUFFER, instBuf);
      g.bufferSubData(g.ARRAY_BUFFER, 0, instData, 0, k * FLOATS);
      g.bindVertexArray(vao);
      g.drawElementsInstanced(g.TRIANGLES, idx.length, g.UNSIGNED_SHORT, 0, k);
      g.bindVertexArray(null);
    }

    // The score follows how fast the wall moves.
    const flow = clamp(speedEased / 2400, 0, 1);
    if ((Math.abs(flow - lastFlow) > 0.03 || (flow === 0 && lastFlow !== 0)) && now - lastFlowAt > 150) {
      lastFlow = flow;
      lastFlowAt = now;
      window.dispatchEvent(new CustomEvent("architecture:flow", { detail: { intensity: Math.round(flow * 100) / 100 } }));
    }

    // Keep going while anything moves; rest when the wall is still.
    const busy =
      !reduced ||
      dragging ||
      Math.abs(tx - ox) > 0.3 ||
      Math.abs(ty - oy) > 0.3 ||
      vx !== 0 ||
      vy !== 0 ||
      phase.kind !== "rest" ||
      !!opening ||
      lifts.size > 0;
    if (busy) raf = requestAnimationFrame(frame);
  }
  let backAmt = 0;
  function kick() {
    if (!raf && !signal.aborted && mode === "wall" && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) kick();
  }, on);

  const onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    setMode("list");
  };
  canvas.addEventListener("webglcontextlost", onLost, on);

  setMode(mode);
  if (reduced) {
    phase = { kind: "rest", t0: 0, ci: 0, cj: 0, first: false };
    hint?.classList.add("is-gone");
  }
  kick();

  return () => {
    cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(mipTimer);
    ro.disconnect();
    document.documentElement.classList.remove("wall-on");
    for (const img of images) if (img) img.src = "";
    gl.deleteTexture(tex);
    gl.deleteBuffer(vbo);
    gl.deleteBuffer(ibo);
    gl.deleteBuffer(instBuf);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(prog);
    gl.deleteProgram(bgProg);
    gl.deleteShader(bgVs);
    gl.deleteShader(bgFs);
    gl.deleteBuffer(bgBuf);
    gl.deleteVertexArray(bgVao);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}
