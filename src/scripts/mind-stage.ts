// The Mind star map: a 3D space to fly through, drawn on canvas 2D over the
// site's WebGL sky. Projects are bright stars with light spikes, disciplines
// are ringed planets, and the tools they use are dim starlight around them.
// Glows add up where they overlap, so bright clusters bloom like a real sky.
//
// The map lives in a field of its own: stars at every depth, slow colour
// clouds and star clusters far out, and a few comets on straight runs.
// Everything shares one camera, so flying in sends the stars streaming past,
// nearby comets slide off the edge of the screen and pass behind you, and
// pulling back brings them into view again, still moving. Small stars stay
// faint until you fly close to them.
//
// Mouse: drag to turn, right drag or shift drag to move, scroll to fly toward
// the pointer, click a star to fly to it and open its card. Touch: one finger
// turns, two fingers pinch to fly and slide to move, tap a star. Keys: W A S D
// or arrows to fly, R and F up and down, + and - to zoom, Escape to close.
// The view follows the hand directly and coasts only briefly after release.
//
// Speed: every glow, cloud and cluster is drawn once into a small image and
// reused, so a frame is mostly image copies, which phones handle well.

interface RawLink { label: string; url: string }
interface RawNode {
  id: string;
  type: string;
  label: string;
  color: string;
  weight: number;
  url?: string;
  links?: RawLink[];
  blurb?: string;
  meta?: string;
  chips?: string[];
}
interface RawGraph {
  key: string;
  title: string;
  subtitle: string;
  nodes: RawNode[];
  edges: { source: string; target: string }[];
}
interface Node extends RawNode {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  px: number; py: number; pz: number; ps: number; // last projection (screen + scale)
  pinned: boolean;
  major: boolean;
  r: number; // world radius, from weight + degree
  tw: number;
  deg: number;
  reveal: number; // 0 hidden .. 1 fully shown
}
interface Edge { a: Node; b: Node; rgb: string; major: boolean }
type V3 = [number, number, number];

const TYPE_LABELS: Record<string, string> = {
  discipline: "Discipline",
  project: "Project",
  tech: "Technology",
  post: "Case study",
  repo: "Repository",
  language: "Language",
  category: "Tech stack",
};
const TYPE_PLURAL: Record<string, string> = {
  discipline: "Disciplines",
  category: "Tech stacks",
  project: "Projects",
  post: "Case studies",
  tech: "Technologies",
  repo: "Repositories",
  language: "Languages",
};
// Stars are coloured by what they are, never by discipline. Where a kind of
// star is a place on the site it wears that tab's colour: disciplines open
// the Work tab (amber), projects are Projects (blue), case studies are
// Writing (emerald). Git Mind's stack anchors take this page's own violet.
// Everything else is neutral starlight. This overrides the tint in the data.
const TYPE_TINT: Record<string, string> = {
  discipline: "#F5A524",
  project: "#5B8DEF",
  post: "#34D399",
  category: "#A78BFA",
  repo: "#22D3EE",
  tech: "#F25C5C",
  language: "#F25C5C",
};
// What the legend lists, and which of those can be switched off. The anchors
// (disciplines, stacks) always stay.
const LEGEND: Record<string, string[]> = {
  portfolio: ["discipline", "project", "post", "tech"],
  repo: ["category", "repo", "language"],
};
const FILTERABLE = new Set(["project", "post", "tech", "repo", "language"]);
// brightness by type: projects, repos and disciplines shine; the supporting
// stars (tools, languages) stay dim at every zoom level.
const LUM: Record<string, number> = {
  discipline: 1.25,
  category: 1.25,
  project: 1.22,
  repo: 0.6,
  post: 0.8,
  tech: 0.4,
  language: 0.44,
};
// The work stars are always there; the supporting stars come forward as the
// camera gets near them.
const MAJOR = new Set(["discipline", "category", "project", "repo"]);
const PLANET = new Set(["discipline", "category"]);
const SPIKED = new Set(["project", "repo"]);
// A meaningful 2x2. X: business-driven (left) -> tech-driven (right).
// Y: product & delivery (top) -> models & intelligence (bottom).
//   FDE top-left (business + delivery), AIE bottom-left (business + models),
//   SDE top-right (tech + delivery), MLE bottom-right (tech + models).
// A project wired to both sides settles in the middle = business + tech metrics.
// Each anchor also takes a depth, on alternate corners of a cube (a
// tetrahedron), so the four clusters fill the space instead of one plane and
// still read as their quadrant from the front. Depth is the third axis:
// FDE and MLE start from data (the customer's systems, the training set), AIE
// and SDE from the system they build.
const QUAD: Record<string, V3> = {
  fde: [-1, 1, 1],
  aie: [-1, -1, -1],
  sde: [1, 1, -1],
  mle: [1, -1, 1],
};
// Git Mind: the four stacks take the matching discipline's corner (AI and
// LLMs where AIE is, machine learning where MLE is, web where SDE is, backend
// and data where FDE is), and repos settle toward the stacks they belong to.
const CAT_QUAD: Record<string, V3> = {
  ai: [-1, -1, -1],
  ml: [1, -1, 1],
  web: [1, 1, -1],
  data: [-1, 1, 1],
};
const AXES: { at: V3; label: string }[] = [
  { at: [-1, 0, 0], label: "Business-driven" },
  { at: [1, 0, 0], label: "Tech-driven" },
  { at: [0, 1, 0], label: "Product & delivery" },
  { at: [0, -1, 0], label: "Models & intelligence" },
  { at: [0, 0, 1], label: "Data & integration" },
  { at: [0, 0, -1], label: "Systems & platforms" },
];
// The site's tab colours, for comets and clouds.
const SPACE_TINTS = ["#A78BFA", "#5B8DEF", "#22D3EE", "#34D399", "#F5A524", "#F43F5E"];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Anything closer to the camera than this (world units) fades out, so flying
// through the cloud stays clean and things pass behind you.
const NEAR = 28;

// Mounts the map on the page and returns a function that takes it down
// again: the render loop, the observers and every window listener. The site
// moves between pages without reloading, so /mind calls this each time it is
// shown and the returned function when it is swapped away.
export function mountMind(): (() => void) | undefined {
  const canvas = document.getElementById("mind-canvas") as HTMLCanvasElement | null;
  const dataEl = document.getElementById("mind-data");
  const panel = document.querySelector("[data-mind-panel]");
  if (!canvas || !dataEl || !panel) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const life = new AbortController();
  const signal = life.signal;
  const on = { signal };

  const graphs: RawGraph[] = JSON.parse(dataEl.textContent || "[]");
  if (!graphs.length) return;
  for (const g of graphs) for (const n of g.nodes) n.color = TYPE_TINT[n.type] ?? n.color;
  const byKey = new Map(graphs.map((g) => [g.key, g]));

  const subEl = panel.querySelector("[data-mind-sub]") as HTMLElement;
  const legendEl = panel.querySelector("[data-mind-legend]") as HTMLElement;
  const modeBtns = Array.from(panel.querySelectorAll<HTMLButtonElement>(".mind-mode"));
  const resetBtn = document.querySelector("[data-mind-reset]") as HTMLElement | null;
  const cardEl = document.querySelector("[data-mind-card]") as HTMLElement | null;
  const cardBody = document.querySelector("[data-mind-card-body]") as HTMLElement | null;
  const cardClose = document.querySelector("[data-mind-card-close]") as HTMLElement | null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = window.matchMedia("(max-width: 767px)").matches;

  let W = 0, H = 0, dpr = 1;
  let nodes: Node[] = [];
  let edges: Edge[] = [];
  const adj = new Map<string, Set<string>>();
  const byId = new Map<string, Node>();
  let graphKey = "portfolio";
  const hiddenTypes = new Set<string>();
  const shown = (p: Node) => !hiddenTypes.has(p.type);

  // ---- camera ---------------------------------------------------------------
  // It looks at a target point from `dist` away, turned by yaw and pitch. The
  // target can move anywhere, so the whole space is open to explore.
  const cam = { yaw: -0.5, pitch: -0.42, dist: 900, focal: 700, tx: 0, ty: 0, tz: 0 };
  type CamKey = keyof typeof cam;
  let camTarget: Partial<Record<CamKey, number>> | null = null;
  // a short coast after letting go, so a fling carries a little and stops
  const vel = { yaw: 0, pitch: 0, tx: 0, ty: 0, tz: 0 };
  let worldR = 300;
  // How far apart the map spreads. It grows with the number of stars, so a
  // busy map opens up instead of packing into tight clusters.
  let spread = 1;
  let hasQuadrants = false;
  let showAxisLabels = false;
  let alpha = 1, fade = 0;
  // Layout steps still to run. They spread over the first frames so the page
  // answers at once on a phone; the stars settle while the camera flies in.
  let settleLeft = 0;
  let autorotate = !reduced;
  let idle = 0;
  let hover: Node | null = null;
  let selected: Node | null = null;
  // During the tour: the kinds of star a step is about (the rest dim), or an
  // empty set to dim every star and let the axes speak.
  let tourKinds: Set<string> | null = null;
  let tourAxes = false; // the axes are what the step is about
  let touring = false;
  let last = 0, raf = 0, time = 0;

  // The camera's own axes in world space.
  const axes = () => {
    const c1 = Math.cos(cam.yaw), s1 = Math.sin(cam.yaw);
    const c2 = Math.cos(cam.pitch), s2 = Math.sin(cam.pitch);
    return {
      right: [c1, 0, s1] as V3,
      up: [s2 * s1, c2, -s2 * c1] as V3,
      back: [-c2 * s1, s2, c2 * c1] as V3, // from the target toward the camera
    };
  };
  const camPos = (): V3 => {
    const b = axes().back;
    return [cam.tx + b[0] * cam.dist, cam.ty + b[1] * cam.dist, cam.tz + b[2] * cam.dist];
  };
  const minDist = () => 70;
  const maxDist = () => worldR * 7;

  // ---- images, drawn once and reused --------------------------------------------
  const sprites = new Map<string, HTMLCanvasElement>();
  const canvasOf = (size: number) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  function sprite(kind: "glow" | "core" | "spike" | "soft", color: string): HTMLCanvasElement {
    const key = kind + color;
    const hit = sprites.get(key);
    if (hit) return hit;
    const S = 128, c = canvasOf(S);
    const g = c.getContext("2d")!;
    const rgb = rgbOf(color), hot = rgbOf(mix(color, "#ffffff", 0.7));
    if (kind === "glow" || kind === "soft") {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      if (kind === "glow") {
        grd.addColorStop(0, `rgba(${hot},1)`);
        grd.addColorStop(0.08, `rgba(${rgb},0.8)`);
        grd.addColorStop(0.22, `rgba(${rgb},0.36)`);
        grd.addColorStop(0.5, `rgba(${rgb},0.1)`);
      } else {
        grd.addColorStop(0, `rgba(${rgb},0.55)`);
        grd.addColorStop(0.4, `rgba(${rgb},0.2)`);
        grd.addColorStop(0.7, `rgba(${rgb},0.06)`);
      }
      grd.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
    } else if (kind === "core") {
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.28, `rgba(${hot},0.95)`);
      grd.addColorStop(0.55, `rgba(${rgb},0.45)`);
      grd.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, S, S);
    } else {
      // four point light spikes, like a bright star through a lens
      for (const [w, h] of [[S, 3], [3, S]]) {
        const grd = w > h ? g.createLinearGradient(0, 0, S, 0) : g.createLinearGradient(0, 0, 0, S);
        grd.addColorStop(0, `rgba(${rgb},0)`);
        grd.addColorStop(0.4, `rgba(${rgb},0.35)`);
        grd.addColorStop(0.5, `rgba(${hot},1)`);
        grd.addColorStop(0.6, `rgba(${rgb},0.35)`);
        grd.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grd;
        g.fillRect((S - w) / 2, (S - h) / 2, w, h);
      }
    }
    sprites.set(key, c);
    return c;
  }
  // A star cluster: a ball of stars, densest at its heart.
  function clusterSprite(color: string, seed: number): HTMLCanvasElement {
    const key = `clu${color}${seed}`;
    const hit = sprites.get(key);
    if (hit) return hit;
    const S = 192, c = canvasOf(S), g = c.getContext("2d")!;
    const rgb = rgbOf(color), hot = rgbOf(mix(color, "#ffffff", 0.8));
    let s = seed * 7919 + 104729;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 700; i++) {
      const u = Math.max(rand(), 1e-4), v = rand();
      const r = Math.sqrt(-2 * Math.log(u)) * 22;
      const ang = v * Math.PI * 2;
      const x = 96 + Math.cos(ang) * r, y = 96 + Math.sin(ang) * r;
      const a = clamp(1 - r / 90, 0, 1) * (0.35 + rand() * 0.6);
      g.fillStyle = `rgba(${rand() < 0.5 ? hot : rgb},${a.toFixed(3)})`;
      const d = rand() < 0.08 ? 1.8 : 1;
      g.fillRect(x, y, d, d);
    }
    const grd = g.createRadialGradient(96, 96, 0, 96, 96, 70);
    grd.addColorStop(0, `rgba(${hot},0.45)`);
    grd.addColorStop(0.35, `rgba(${rgb},0.1)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    sprites.set(key, c);
    return c;
  }
  function blit(img: HTMLCanvasElement, x: number, y: number, r: number, a: number) {
    if (a <= 0.004 || r < 0.3) return;
    ctx!.globalAlpha = Math.min(a, 1);
    ctx!.drawImage(img, x - r, y - r, r * 2, r * 2);
  }

  // ---- the space around the map ------------------------------------------
  // Stars: points in a box that wraps around the camera's target, so there is
  // always space ahead however far you fly.
  const DUST = reduced ? 320 : phone ? 760 : 1400;
  let BOX = 1600;
  const DUST_TINTS = ["#EEF2FF", "#CFE0FF", ...SPACE_TINTS];
  const dust = Array.from({ length: DUST }, () => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random() * 2 - 1,
    size: 0.45 + Math.random() ** 3 * 1.9,
    tint: Math.random() < 0.82 ? (Math.random() < 0.6 ? 0 : 1) : 2 + ((Math.random() * SPACE_TINTS.length) | 0),
    tw: Math.random() * Math.PI * 2,
    sx: NaN, sy: NaN,
  }));
  // Far structures: nebulae, colour clouds and star clusters, each placed in a
  // direction from the map and drawn at its depth, so they turn and drift
  // with the camera like a real background.
  const onSphere = (): V3 => {
    const a = Math.random() * Math.PI * 2, e = Math.asin(Math.random() * 2 - 1) * 0.8;
    return [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  };
  const nebulae = Array.from({ length: 5 }, (_, i) => ({ dir: onSphere(), size: 0.55 + Math.random() * 0.45, color: SPACE_TINTS[i % SPACE_TINTS.length] }));
  const clouds = Array.from({ length: phone ? 4 : 6 }, (_, i) => ({
    dir: onSphere(),
    size: 0.4 + Math.random() * 0.3,
    blobs: Array.from({ length: 5 }, (_, j) => ({
      ox: (Math.random() - 0.5) * 1.1,
      oy: (Math.random() - 0.5) * 0.7,
      r: 0.35 + Math.random() * 0.45,
      color: SPACE_TINTS[(i * 2 + j) % SPACE_TINTS.length],
      ph: Math.random() * Math.PI * 2,
      sp: 0.05 + Math.random() * 0.08,
    })),
  }));
  const clusters = Array.from({ length: phone ? 4 : 7 }, (_, i) => ({
    dir: onSphere(),
    size: 0.12 + Math.random() * 0.1,
    color: i % 3 === 0 ? "#FFE8B0" : SPACE_TINTS[(i + 2) % SPACE_TINTS.length],
    seed: i + 11,
  }));
  // Comets: straight runs through the space, some across the foreground.
  type Comet = { p: V3; v: V3; len: number; w: number; color: string; age: number; life: number };
  const COMETS = reduced ? 3 : phone ? 4 : 7;
  const comets: Comet[] = [];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  function spawnComet(c?: Comet): Comet {
    const { right, up, back } = axes();
    const T: V3 = [cam.tx, cam.ty, cam.tz];
    // half pass between the camera and the map, half anywhere in the field
    const fore = Math.random() < 0.5;
    const depth = fore ? rnd(0.15, 0.75) * cam.dist : rnd(-1, 1) * worldR * 2.2;
    const width = worldR * (fore ? 1.1 : 2.4);
    const ox = rnd(-1, 1) * width, oy = rnd(-1, 1) * width * 0.7;
    const center: V3 = [
      T[0] + back[0] * depth + right[0] * ox + up[0] * oy,
      T[1] + back[1] * depth + right[1] * ox + up[1] * oy,
      T[2] + back[2] * depth + right[2] * ox + up[2] * oy,
    ];
    // a heading mostly across the view, with some depth to it
    const a = Math.random() * Math.PI * 2;
    const dz = rnd(-0.6, 0.6);
    const h: V3 = [
      right[0] * Math.cos(a) + up[0] * Math.sin(a) + back[0] * dz,
      right[1] * Math.cos(a) + up[1] * Math.sin(a) + back[1] * dz,
      right[2] * Math.cos(a) + up[2] * Math.sin(a) + back[2] * dz,
    ];
    const hl = Math.hypot(h[0], h[1], h[2]) || 1;
    const speed = rnd(70, 150) * (worldR / 300);
    const life = rnd(7, 12);
    const run = speed * life * 0.5;
    const out = c || ({} as Comet);
    out.v = [(h[0] / hl) * speed, (h[1] / hl) * speed, (h[2] / hl) * speed];
    out.p = [center[0] - (h[0] / hl) * run, center[1] - (h[1] / hl) * run, center[2] - (h[2] / hl) * run];
    out.len = rnd(0.9, 1.6) * (worldR / 300) * 160;
    out.w = rnd(1, 2.2);
    out.color = SPACE_TINTS[(Math.random() * SPACE_TINTS.length) | 0];
    out.life = life;
    out.age = c ? 0 : rnd(0, life * 0.8);
    return out;
  }

  // The map's own galaxy: a spiral disk of stars through the middle of the
  // map with a warm core. From far out the map reads as a galaxy; inside it
  // the disk is the stars around you.
  const DISK_TINTS = ["#FFE8B0", "#EEF2FF", "#CFE0FF", "#A78BFA", "#5B8DEF", "#22D3EE"];
  let disk = new Float32Array(0); // x, y, z, size, tint per star, sorted by tint
  let armGlow: { x: number; z: number; r: number; color: string }[] = [];
  function buildDisk() {
    const N = reduced ? 600 : phone ? 1100 : 2000;
    const R = worldR * 1.75;
    const arms = 3;
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(Math.random(), 1e-4))) * Math.cos(Math.random() * Math.PI * 2);
    const rows: number[][] = [];
    for (let i = 0; i < N; i++) {
      const core = Math.random() < 0.22;
      let r: number, ang: number;
      if (core) {
        r = Math.abs(gauss()) * R * 0.14;
        ang = Math.random() * Math.PI * 2;
      } else {
        const t = Math.pow(Math.random(), 0.75);
        r = R * (0.1 + t * 0.9);
        ang = ((i % arms) * Math.PI * 2) / arms + Math.log(r / (R * 0.1)) * 2.1 + (Math.random() - 0.5) * 0.55;
      }
      const thick = R * (0.05 * (1 - r / R) + 0.012);
      const tint = core ? (Math.random() < 0.7 ? 0 : 1) : Math.random() < 0.55 ? 1 + ((Math.random() * 2) | 0) : 3 + ((Math.random() * 3) | 0);
      rows.push([Math.cos(ang) * r, gauss() * thick, Math.sin(ang) * r, 0.5 + Math.random() ** 2.5 * 1.8, tint]);
    }
    rows.sort((a, b) => a[4] - b[4]);
    disk = new Float32Array(rows.flat());
    // soft light along each arm, so the arms read as glowing lanes
    armGlow = [];
    for (let k = 0; k < arms; k++) {
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const r = R * (0.1 + t * 0.9);
        const ang = (k * Math.PI * 2) / arms + Math.log(r / (R * 0.1)) * 2.1;
        armGlow.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r, r: R * (0.16 - t * 0.08), color: DISK_TINTS[3 + ((k + i) % 3)] });
      }
    }
  }
  function drawGalaxy(out: number, quiet: number) {
    // the core
    const c = projXYZ(0, 0, 0);
    if (c.pz > NEAR) {
      blit(sprite("soft", "#FFD9A0"), c.px, c.py, clamp(worldR * 0.75 * c.ps, 30, Math.max(W, H)), (0.07 + 0.16 * out) * fade * quiet);
      blit(sprite("soft", "#A78BFA"), c.px, c.py, clamp(worldR * 1.6 * c.ps, 50, Math.max(W, H) * 1.5), (0.05 + 0.1 * out) * fade * quiet);
    }
    // the disk, turning slowly
    const th = reduced ? 0 : time * 0.012;
    const ct = Math.cos(th), st = Math.sin(th);
    for (const g of armGlow) {
      const q = projXYZ(g.x * ct - g.z * st, 0, g.x * st + g.z * ct);
      if (q.pz < NEAR) continue;
      blit(sprite("soft", g.color), q.px, q.py, clamp(g.r * q.ps, 6, Math.max(W, H) * 0.5), (0.015 + 0.045 * out) * fade * quiet);
    }
    const base = (0.1 + 0.32 * out) * fade * quiet;
    let tint = -1;
    for (let i = 0; i < disk.length; i += 5) {
      const x0 = disk[i], z0 = disk[i + 2];
      const q = projXYZ(x0 * ct - z0 * st, disk[i + 1], x0 * st + z0 * ct);
      if (q.pz < NEAR || q.px < -4 || q.px > W + 4 || q.py < -4 || q.py > H + 4) continue;
      const t = disk[i + 4];
      if (t !== tint) { tint = t; ctx!.fillStyle = DISK_TINTS[t]; }
      const r = clamp(disk[i + 3] * (0.5 + q.ps * 1.2), 0.5, 2.4);
      ctx!.globalAlpha = Math.min(1, base * (0.32 + disk[i + 3] * 0.28));
      ctx!.fillRect(q.px - r * 0.5, q.py - r * 0.5, r, r);
    }
    ctx!.globalAlpha = 1;
  }

  // ---- layout -------------------------------------------------------------
  function loadGraph(key: string) {
    graphKey = key;
    const g = byKey.get(key) || graphs[0];
    adj.clear();
    byId.clear();
    hiddenTypes.clear();
    leadCache = { key: "", list: [] };
    relCache = new Map();
    nodes = g.nodes.map((n) => {
      const node: Node = {
        ...n,
        x: (Math.random() - 0.5) * 260,
        y: (Math.random() - 0.5) * 260,
        z: (Math.random() - 0.5) * 260,
        vx: 0, vy: 0, vz: 0,
        px: 0, py: 0, pz: 0, ps: 1,
        pinned: false,
        major: MAJOR.has(n.type),
        r: 2,
        tw: Math.random() * Math.PI * 2,
        deg: 0,
        reveal: MAJOR.has(n.type) ? 1 : 0.2,
      };
      byId.set(n.id, node);
      adj.set(n.id, new Set());
      return node;
    });
    edges = [];
    for (const e of g.edges) {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b) continue;
      edges.push({ a, b, rgb: rgbOf(mix(mix(a.color, b.color, 0.5), "#ffffff", 0.25)), major: a.major && b.major });
      a.deg++; b.deg++;
      adj.get(a.id)!.add(b.id);
      adj.get(b.id)!.add(a.id);
    }
    // size from importance: type weight + how connected it is
    for (const n of nodes) n.r = 1.7 + Math.sqrt(n.weight) * 1.9 + Math.sqrt(n.deg) * 1.15;
    // the git map packs more stars per stack, so it gets more room
    spread = clamp(Math.sqrt(nodes.length / 35), 1.25, 3) * (key === "repo" ? 1.4 : 1);
    for (const n of nodes) { n.x *= spread; n.y *= spread; n.z *= spread; }

    // pin the quadrant anchors: disciplines (portfolio) or tech stacks (git mind)
    const Rq = 250 * spread;
    for (const n of nodes) {
      const dm = n.id.match(/^disc:(\w+)/);
      const cm = n.id.match(/^cat:(\w+)/);
      const q = dm && QUAD[dm[1]] ? QUAD[dm[1]] : cm && CAT_QUAD[cm[1]] ? CAT_QUAD[cm[1]] : null;
      if (q) { n.x = q[0] * Rq; n.y = q[1] * Rq; n.z = q[2] * Rq; n.pinned = true; }
    }
    hasQuadrants = nodes.some((n) => n.pinned); // divider lines on both maps
    showAxisLabels = nodes.some((n) => n.id.startsWith("disc:")); // business/tech labels: portfolio only

    document.querySelector(".mind-root")?.setAttribute("data-graph", key);
    subEl.textContent = g.subtitle;
    renderLegend(key);
    closeCard();
    selected = null; hover = null; alpha = 1; fade = 0;
    autorotate = !reduced;
    // The anchors are pinned from the start, so the map's extent (and the
    // camera fit) is already right before the rest has settled.
    settleLeft = 260;
    const t0 = performance.now();
    while (settleLeft > 0 && (reduced || performance.now() - t0 < 24)) { step(0.85); settleLeft--; }
    frameToFit();
    Object.assign(cam, { tx: 0, ty: 0, tz: 0, dist: camTarget!.dist! * 1.6 });
    BOX = worldR * 5;
    buildDisk();
    comets.length = 0;
    for (let i = 0; i < COMETS; i++) comets.push(spawnComet());
  }

  function step(a: number) {
    const n = nodes.length;
    const k3 = spread * spread * spread;
    // The git map: repos push each other harder, and a language most repos
    // use (Python, TypeScript) pulls on each one more gently, so the repos
    // spread out instead of collapsing onto the shared languages.
    const git = graphKey === "repo";
    const majorPush = git ? 12000 : 6200;
    for (let i = 0; i < n; i++) {
      const p = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const q = nodes[j];
        let dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dz = Math.random() - 0.5; d2 = 0.01; }
        // projects push each other harder, so each has room around it
        const rep = ((p.major && q.major ? majorPush : 2600) * k3 * a) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * rep, fy = (dy / d) * rep, fz = (dz / d) * rep;
        p.vx += fx; p.vy += fy; p.vz += fz;
        q.vx -= fx; q.vy -= fy; q.vz -= fz;
      }
    }
    for (const e of edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, dz = e.b.z - e.a.z;
      const d = Math.hypot(dx, dy, dz) || 0.01;
      // tools sit close around their project; projects keep their distance
      const ideal = (80 + (e.a.r + e.b.r) * 2) * spread * (e.major ? 1.25 : 0.72);
      const hub = git && !e.major ? Math.min(1, 2.5 / Math.sqrt(Math.max(e.a.deg, e.b.deg))) : 1;
      const f = (d - ideal) * 0.02 * a * hub;
      const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
      e.a.vx += fx; e.a.vy += fy; e.a.vz += fz;
      e.b.vx -= fx; e.b.vy -= fy; e.b.vz -= fz;
    }
    for (const p of nodes) {
      if (p.pinned) { p.vx = p.vy = p.vz = 0; continue; }
      // the same mild pull to the centre on every axis, so the cloud keeps
      // its depth instead of flattening onto one plane
      p.vx -= p.x * 0.01 * a;
      p.vy -= p.y * 0.01 * a;
      p.vz -= p.z * 0.01 * a;
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      p.vx *= 0.84; p.vy *= 0.84; p.vz *= 0.84;
    }
  }

  function frameToFit() {
    let max = 1;
    for (const p of nodes) max = Math.max(max, Math.hypot(p.x, p.y, p.z));
    worldR = max;
    cam.focal = focalFor(W, H);
    camTarget = { dist: worldR * (graphKey === "repo" ? 2.05 : 2.4) + 120, yaw: -0.5, pitch: -0.42, tx: 0, ty: 0, tz: 0 };
  }

  // How large the map draws. A portrait phone is narrow and tall, so the map
  // may use more of its width than a square fit allows.
  function focalFor(w: number, h: number) {
    return w < 600 && h > w ? w * 1.12 : Math.min(w, h) * 0.92;
  }

  // ---- projection ---------------------------------------------------------
  // pz is the distance in front of the camera; anything under NEAR is behind
  // or too close and is not drawn.
  let cy = 1, sy = 0, cp = 1, sp = 0;
  function projXYZ(x: number, y: number, z: number) {
    x -= cam.tx; y -= cam.ty; z -= cam.tz;
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const depth = cam.dist - z2;
    const s = cam.focal / Math.max(depth, 1);
    return { px: W / 2 + x1 * s, py: H / 2 - y2 * s, pz: depth, ps: s };
  }
  function project(p: Node) {
    const r = projXYZ(p.x, p.y, p.z);
    p.px = r.px; p.py = r.py; p.pz = r.pz; p.ps = r.ps;
  }

  function drawAxes(showLabels: boolean, vis: number) {
    const ext = 640 * spread;
    // Three long dotted axes through the centre of the map, a cool tint so
    // they never read as connection lines.
    const lines: [V3, V3][] = [
      [[-ext, 0, 0], [ext, 0, 0]],
      [[0, -ext, 0], [0, ext, 0]],
      [[0, 0, -ext], [0, 0, ext]],
    ];
    ctx!.save();
    ctx!.lineWidth = 1.3;
    ctx!.lineCap = "round";
    ctx!.setLineDash([1.5, 7]);
    for (const [a, b] of lines) {
      const A = projXYZ(a[0], a[1], a[2]);
      const B = projXYZ(b[0], b[1], b[2]);
      if (A.pz < NEAR || B.pz < NEAR) continue;
      const grad = ctx!.createLinearGradient(A.px, A.py, B.px, B.py);
      grad.addColorStop(0, "rgba(150,200,255,0)");
      grad.addColorStop(0.18, `rgba(150,200,255,${0.5 * fade * vis})`);
      grad.addColorStop(0.5, `rgba(185,220,255,${0.75 * fade * vis})`);
      grad.addColorStop(0.82, `rgba(150,200,255,${0.5 * fade * vis})`);
      grad.addColorStop(1, "rgba(150,200,255,0)");
      ctx!.strokeStyle = grad;
      ctx!.beginPath(); ctx!.moveTo(A.px, A.py); ctx!.lineTo(B.px, B.py); ctx!.stroke();
    }
    ctx!.restore();
    if (showLabels) {
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.font = '600 13px Inter, ui-sans-serif, system-ui, sans-serif';
      ctx!.shadowColor = "rgba(0,0,0,0.9)";
      ctx!.shadowBlur = 8;
      for (const ax of AXES) {
        const e = projXYZ(ax.at[0] * ext * 0.86, ax.at[1] * ext * 0.86, ax.at[2] * ext * 0.86);
        if (e.pz < NEAR) continue;
        if (!tourAxes && nodes.some((n) => PLANET.has(n.type) && Math.hypot(n.px - e.px, n.py - e.py) < 120)) continue;
        ctx!.fillStyle = `rgba(214,232,255,${0.95 * fade * vis})`;
        ctx!.fillText(ax.label, e.px, e.py);
      }
      ctx!.shadowBlur = 0;
    }
  }

  // ---- the space: far structures, stars, comets ------------------------------
  // Far things sit around a point that follows the camera's target at half
  // pace, so they drift slowly as you move and never come close.
  function farPoint(dir: V3, far: number): ReturnType<typeof projXYZ> {
    return projXYZ(cam.tx * 0.5 + dir[0] * far, cam.ty * 0.5 + dir[1] * far, cam.tz * 0.5 + dir[2] * far);
  }
  function drawFar() {
    const far = BOX * 0.95;
    for (const n of nebulae) {
      const q = farPoint(n.dir, far);
      if (q.pz < NEAR) continue;
      blit(sprite("soft", n.color), q.px, q.py, clamp(far * n.size * q.ps, 80, Math.max(W, H) * 1.6), 0.2 * fade);
    }
    // clouds: each a few colour blobs drifting slowly around a centre,
    // swelling and fading a little, so the colours keep shifting
    for (const cl of clouds) {
      const q = farPoint(cl.dir, far * 0.9);
      if (q.pz < NEAR) continue;
      const R = clamp(far * cl.size * q.ps, 40, Math.max(W, H) * 1.1);
      if (q.px < -R * 1.6 || q.px > W + R * 1.6 || q.py < -R * 1.6 || q.py > H + R * 1.6) continue;
      for (const b of cl.blobs) {
        const t = reduced ? 0 : time * b.sp;
        const x = q.px + (b.ox + Math.sin(t + b.ph) * 0.18) * R;
        const y = q.py + (b.oy + Math.cos(t * 0.8 + b.ph) * 0.12) * R;
        const r = R * b.r * (1 + Math.sin(t * 1.3 + b.ph) * 0.1);
        blit(sprite("soft", b.color), x, y, r, (0.075 + Math.sin(t * 1.1 + b.ph * 2) * 0.03) * fade);
      }
    }
    for (const c of clusters) {
      const q = farPoint(c.dir, far * 0.8);
      if (q.pz < NEAR) continue;
      const R = clamp(far * c.size * q.ps, 10, Math.max(W, H) * 0.4);
      blit(clusterSprite(c.color, c.seed), q.px, q.py, R, 0.45 * fade);
    }
  }

  function drawDust(speed: number, quiet: number) {
    const half = BOX;
    const fog = BOX * 1.7;
    const streak = !reduced && speed > 0.5;
    let tint = -1;
    for (const d of dust) {
      // wrap each star into the box around the target, so the field never ends
      let x = d.x * half - cam.tx, y = d.y * half - cam.ty, z = d.z * half - cam.tz;
      x = ((((x + half) % (2 * half)) + 2 * half) % (2 * half)) - half;
      y = ((((y + half) % (2 * half)) + 2 * half) % (2 * half)) - half;
      z = ((((z + half) % (2 * half)) + 2 * half) % (2 * half)) - half;
      const q = projXYZ(x + cam.tx, y + cam.ty, z + cam.tz);
      if (q.pz < NEAR || q.px < -20 || q.px > W + 20 || q.py < -20 || q.py > H + 20) { d.sx = NaN; continue; }
      const near = clamp(1 - q.pz / fog, 0, 1);
      const tw = reduced ? 1 : 0.7 + Math.sin(time * 1.4 + d.tw) * 0.3;
      const a = clamp(0.22 + near * near * 1.2, 0, 1) * tw * fade * quiet;
      const r = clamp(d.size * (0.7 + q.ps * 1.8), 0.6, 3.8);
      const color = DUST_TINTS[d.tint];
      if (d.tint !== tint) { tint = d.tint; ctx!.fillStyle = color; ctx!.strokeStyle = color; }
      const moved = Math.hypot(q.px - d.sx, q.py - d.sy);
      ctx!.globalAlpha = a;
      if (streak && moved > 1.5 && moved < 180) {
        // flying fast: each star leaves a streak from where it was a frame ago
        ctx!.lineWidth = Math.max(r * 0.8, 0.7);
        ctx!.beginPath(); ctx!.moveTo(d.sx, d.sy); ctx!.lineTo(q.px, q.py); ctx!.stroke();
      } else {
        ctx!.fillRect(q.px - r * 0.5, q.py - r * 0.5, r, r);
        // the brightest stars carry a glow, the very brightest spikes too
        if (d.size > 1.3) {
          blit(sprite("glow", color), q.px, q.py, r * 5.5, a * 0.7);
          if (d.size > 1.85) blit(sprite("spike", color), q.px, q.py, r * 7, a * 0.55);
          ctx!.globalAlpha = a;
          ctx!.fillStyle = color;
        }
      }
      d.sx = q.px; d.sy = q.py;
    }
    ctx!.globalAlpha = 1;
  }

  function moveComets(dt: number) {
    const T: V3 = [cam.tx, cam.ty, cam.tz];
    const reach = worldR * 4.5 + cam.dist;
    for (const c of comets) {
      if (!reduced) {
        c.p[0] += c.v[0] * dt; c.p[1] += c.v[1] * dt; c.p[2] += c.v[2] * dt;
        c.age += dt;
      }
      const far = Math.hypot(c.p[0] - T[0], c.p[1] - T[1], c.p[2] - T[2]) > reach;
      if (c.age > c.life || far) spawnComet(c);
    }
  }
  // A comet: a tail of short segments that taper and fade behind the head.
  // Segments behind the camera are skipped, so a comet flying past leaves the
  // screen instead of smearing across it.
  function drawComet(c: Comet) {
    const spd = Math.hypot(c.v[0], c.v[1], c.v[2]) || 1;
    const dir: V3 = [c.v[0] / spd, c.v[1] / spd, c.v[2] / spd];
    const life = c.age / c.life;
    const env = clamp(life / 0.12, 0, 1) * clamp((1 - life) / 0.18, 0, 1) * fade;
    if (env <= 0.01) return;
    const SEG = 10;
    let prev = projXYZ(c.p[0], c.p[1], c.p[2]);
    const head = prev;
    const rgb = rgbOf(c.color), hot = rgbOf(mix(c.color, "#ffffff", 0.6));
    ctx!.globalAlpha = 1;
    for (let i = 1; i <= SEG; i++) {
      const k = (i / SEG) * c.len;
      const q = projXYZ(c.p[0] - dir[0] * k, c.p[1] - dir[1] * k, c.p[2] - dir[2] * k);
      if (prev.pz > NEAR && q.pz > NEAR) {
        const f = 1 - (i - 1) / SEG;
        ctx!.strokeStyle = `rgba(${i === 1 ? hot : rgb},${(0.9 * f * f * env).toFixed(3)})`;
        ctx!.lineWidth = clamp(c.w * prev.ps * 1.7 * f, 0.6, 9);
        ctx!.beginPath(); ctx!.moveTo(prev.px, prev.py); ctx!.lineTo(q.px, q.py); ctx!.stroke();
      }
      prev = q;
    }
    if (head.pz > NEAR) {
      const R = clamp(c.w * head.ps * 10, 3, 70);
      blit(sprite("glow", c.color), head.px, head.py, R, env);
      blit(sprite("core", c.color), head.px, head.py, R * 0.32, env);
      ctx!.globalAlpha = 1;
    }
  }

  // Lines from each anchor (discipline, stack) to the stars of the lead kind:
  // direct where they touch, else through the project or repo between them.
  let leadCache = { key: "", list: [] as Edge[] };
  function leadEdges(lead: string): Edge[] {
    const key = `${graphKey}:${lead}`;
    if (leadCache.key === key) return leadCache.list;
    const list: Edge[] = [];
    const seen = new Set<string>();
    const add = (a: Node, b: Node) => {
      const k = `${a.id}|${b.id}`;
      if (seen.has(k)) return;
      seen.add(k);
      list.push({ a, b, rgb: rgbOf(mix(mix(a.color, b.color, 0.5), "#ffffff", 0.2)), major: true });
    };
    for (const A of nodes) {
      if (!PLANET.has(A.type) || !lead) continue;
      for (const id of adj.get(A.id) || []) {
        const X = byId.get(id);
        if (!X) continue;
        if (X.type === lead) add(A, X);
        else if (X.major && !PLANET.has(X.type)) {
          for (const id2 of adj.get(X.id) || []) {
            const Y = byId.get(id2);
            if (Y && Y.type === lead) add(A, Y);
          }
        }
      }
    }
    leadCache = { key, list };
    return list;
  }

  // The highest kind switched on: projects, then case studies, then
  // technologies (repos, then languages on the git map).
  const RANK: Record<string, number> = { discipline: 0, category: 0, project: 1, repo: 1, post: 2, tech: 3, language: 2 };
  function leadKind(): string {
    const order = graphKey === "repo" ? ["repo", "language"] : ["project", "post", "tech"];
    return order.find((t) => !hiddenTypes.has(t)) ?? "";
  }
  // A star's connections. An anchor shows only the one kind below it that is
  // switched on (through the stars between when those are off). Any other
  // star shows what it touches, everything below it in the hierarchy (a case
  // study shows its project's technologies), and reaches through switched
  // off stars to the ones still on.
  let relCache = new Map<string, Node[]>();
  function related(S: Node): Node[] {
    const hit = relCache.get(S.id);
    if (hit) return hit;
    const out = new Set<Node>();
    if (PLANET.has(S.type)) {
      for (const e of leadEdges(leadKind())) if (e.a === S && shown(e.b)) out.add(e.b);
    } else {
      const r = RANK[S.type] ?? 9;
      for (const id of adj.get(S.id) || []) {
        const X = byId.get(id);
        if (!X) continue;
        if (shown(X)) out.add(X);
        const through = !shown(X);
        const parent = !PLANET.has(X.type) && (RANK[X.type] ?? 9) < r;
        if (!through && !parent) continue;
        for (const id2 of adj.get(X.id) || []) {
          const Y = byId.get(id2);
          if (!Y || Y === S || !shown(Y) || Y.type === S.type) continue;
          if (through || (RANK[Y.type] ?? 0) > r) out.add(Y);
        }
      }
    }
    const list = [...out];
    relCache.set(S.id, list);
    return list;
  }

  // ---- render -------------------------------------------------------------
  // The canvas buffer is only rebuilt when its pixel size really changes. On a
  // phone the address bar sliding fires many tiny resizes, and rebuilding a
  // full screen buffer on each one is what runs a phone out of graphics
  // memory. Phones also draw at 1.5x, which is plenty on a moving star field.
  function resize() {
    const nextDpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2);
    const w = Math.round(canvas!.clientWidth), h = Math.round(canvas!.clientHeight);
    const pw = Math.round(w * nextDpr), ph = Math.round(h * nextDpr);
    if (pw === canvas!.width && ph === canvas!.height && nextDpr === dpr && w === W && h === H) return;
    dpr = nextDpr; W = w; H = h;
    if (canvas!.width !== pw) canvas!.width = pw;
    if (canvas!.height !== ph) canvas!.height = ph;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.focal = focalFor(W, H);
  }

  let prevCam = { tx: 0, ty: 0, tz: 0, dist: 0, yaw: 0, pitch: 0 };
  function render(now: number) {
    if (signal.aborted) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    time += dt;

    // the camera: a quick flight when one is set; after a drag, a short coast
    if (camTarget) {
      const k = 1 - Math.pow(1 - 0.16, dt * 60);
      for (const key of Object.keys(camTarget) as CamKey[]) cam[key] = lerp(cam[key], camTarget[key]!, k);
      const done = Object.keys(camTarget).every((key) => Math.abs(cam[key as CamKey] - camTarget![key as CamKey]!) < (key === "yaw" || key === "pitch" ? 0.002 : 0.5));
      if (done) camTarget = null;
    } else if (!pts.size) {
      const damp = Math.pow(0.72, dt * 60);
      cam.yaw += vel.yaw; cam.pitch = clamp(cam.pitch + vel.pitch, -1.45, 1.45);
      cam.tx += vel.tx; cam.ty += vel.ty; cam.tz += vel.tz;
      vel.yaw *= damp; vel.pitch *= damp;
      vel.tx *= damp; vel.ty *= damp; vel.tz *= damp;
    }
    if (settleLeft > 0) {
      const t1 = performance.now();
      const budget = phone ? 6 : 12;
      do { step(0.85); settleLeft--; } while (settleLeft > 0 && performance.now() - t1 < budget);
    } else if (alpha > 0.02) { step(alpha); alpha *= 0.968; }
    if (fade < 1) fade = Math.min(1, fade + dt * 2.4);
    idle += dt;
    if (autorotate && idle > 2.4 && !camTarget && !selected) cam.yaw += 0.06 * dt;
    keysFly(dt);

    cy = Math.cos(cam.yaw); sy = Math.sin(cam.yaw);
    cp = Math.cos(cam.pitch); sp = Math.sin(cam.pitch);
    // how fast the view is moving, for the star streaks
    const speed =
      Math.hypot(cam.tx - prevCam.tx, cam.ty - prevCam.ty, cam.tz - prevCam.tz) / Math.max(cam.dist, 1) * 60 +
      Math.abs(Math.log(cam.dist / (prevCam.dist || cam.dist))) * 40 +
      (Math.abs(cam.yaw - prevCam.yaw) + Math.abs(cam.pitch - prevCam.pitch)) * 18;
    prevCam = { tx: cam.tx, ty: cam.ty, tz: cam.tz, dist: cam.dist, yaw: cam.yaw, pitch: cam.pitch };

    // how far out the camera is: from far away the map turns into a galaxy,
    // its stars soften and only the anchors keep their names
    const out = clamp((cam.dist - worldR * 1.4) / (worldR * 2.6), 0, 1);
    // The lead kind shines like the projects: the highest switched on of
    // projects, then case studies, then technologies (repos, then languages
    // on the git map). The kinds under it stay dim, and with a filter on the
    // background steps back so it covers nothing.
    const lead = leadKind();
    const leads = (p: Node) => p.major || p.type === lead;
    const quiet = hiddenTypes.size ? 0.35 : 1;
    // the dust and the galaxy's speckle stay well under the map's stars
    const dustQ = quiet * (touring ? 0.15 : 0.4);

    for (const p of nodes) project(p);
    moveComets(dt);
    const order = [...nodes].sort((a, b) => b.pz - a.pz); // far first

    ctx!.clearRect(0, 0, W, H);
    // light adds up, so overlapping glows bloom
    ctx!.globalCompositeOperation = "lighter";
    drawFar();
    drawDust(speed, dustQ);
    ctx!.globalCompositeOperation = "source-over";
    // the axes step back while a star is open, so its names read clearly
    if (hasQuadrants) drawAxes(showAxisLabels && (!selected || tourAxes), tourAxes ? 1.2 : touring ? 0.08 : (1 - out * 0.85) * (selected ? 0.35 : 1));
    ctx!.globalCompositeOperation = "lighter";

    // Comets behind the map's centre draw under it, the rest over it.
    const front: Comet[] = [];
    for (const c of comets) {
      const h = projXYZ(c.p[0], c.p[1], c.p[2]);
      if (h.pz > cam.dist) drawComet(c); else front.push(c);
    }

    // zoom feel: close => big soft bubbles; far => sharp pinpoints
    const near = clamp((worldR * 3.4 - cam.dist) / (worldR * 3), 0, 1);
    drawGalaxy(out * dustQ, dustQ);
    // every work star lights the region around it, like a star cluster
    for (const p of nodes) {
      if (!leads(p) || p.pz < NEAR || p.reveal < 0.05) continue;
      const R = clamp((60 + p.deg * 9) * spread * p.ps, 12, Math.max(W, H) * 0.6);
      blit(sprite("soft", p.color), p.px, p.py, R, (0.05 + 0.05 * out) * p.reveal * fade * quiet);
    }
    ctx!.globalAlpha = 1;
    const hoverSet = hover ? new Set(related(hover).map((m) => m.id)) : null;
    const selSet = selected ? new Set(related(selected).map((m) => m.id)) : null;

    // The small stars come forward as the camera nears them; filtered ones go.
    const C = camPos();
    const revealR = worldR * 1.5;
    const ease = 1 - Math.pow(0.88, dt * 60);
    for (const p of nodes) {
      const want = !shown(p)
        ? 0
        : leads(p) || p === hover || p === selected || hoverSet?.has(p.id) || selSet?.has(p.id)
          ? 1
          : clamp(1.35 - Math.hypot(p.x - C[0], p.y - C[1], p.z - C[2]) / revealR, 0.32, 1);
      p.reveal = lerp(p.reveal, want, ease);
    }

    // Lines. At rest only the anchors' lines to the lead kind: discipline to
    // project, or with projects off discipline to case study (traced through
    // the project between them), and so on down. An open or hovered star
    // shows its own lines instead, and they take the stage.
    const line = (a: Node, b: Node, rgb: string, op: number, width: number) => {
      if (op < 0.01) return;
      ctx!.strokeStyle = `rgba(${rgb},${(op * 0.16).toFixed(3)})`;
      ctx!.lineWidth = width * 3.2;
      ctx!.beginPath(); ctx!.moveTo(a.px, a.py); ctx!.lineTo(b.px, b.py); ctx!.stroke();
      ctx!.strokeStyle = `rgba(${rgb},${op.toFixed(3)})`;
      ctx!.lineWidth = width;
      ctx!.beginPath(); ctx!.moveTo(a.px, a.py); ctx!.lineTo(b.px, b.py); ctx!.stroke();
    };
    ctx!.globalAlpha = 1;
    const lit = selected || hover;
    if (!selected) {
      for (const e of leadEdges(lead)) {
        if (e.a.pz < NEAR || e.b.pz < NEAR) continue;
        const vis = Math.min(e.a.reveal, e.b.reveal);
        if (vis < 0.02) continue;
        const inTour = !tourKinds || (tourKinds.has(e.a.type) && tourKinds.has(e.b.type));
        line(e.a, e.b, e.rgb, (hover ? 0.28 : 0.6) * fade * vis * (inTour ? 1 : 0.05), 1.1);
      }
    }
    if (lit && lit.pz > NEAR) {
      for (const m of related(lit)) {
        if (m.pz < NEAR || m.reveal < 0.02) continue;
        line(lit, m, rgbOf(mix(mix(lit.color, m.color, 0.5), "#ffffff", 0.25)), 0.9 * fade * Math.min(1, m.reveal + 0.3), 1.5);
      }
    }

    // stars
    const labels: { text: string; x: number; y: number; font: string; size: number; a: number; prio: number; focus: boolean }[] = [];
    for (const p of order) {
      if (p.pz < NEAR || p.reveal < 0.02) continue;
      if (p.px < -160 || p.px > W + 160 || p.py < -160 || p.py > H + 160) continue;
      const nearFade = clamp((p.pz - NEAR) / NEAR, 0, 1);
      const big = leads(p);
      const promoted = big && !p.major;
      const R = clamp(p.r * p.ps * (promoted ? 1.6 : p.type === "repo" ? 1.2 : 1), 0.6, 140);
      const depthFade = clamp((p.ps / (cam.focal / cam.dist)) * 0.6 + 0.5, 0.6, 1.25);
      const pace = 0.7 + (Math.sin(p.tw * 7.3) + 1) * 0.45;
      const tw = reduced ? 1 : 0.8 + 0.2 * (0.62 * Math.sin(time * pace + p.tw) + 0.38 * Math.sin(time * pace * 2.3 + p.tw * 1.7));
      const dim =
        (hover && hover !== p && !hoverSet?.has(p.id)) ||
        (selected && selected !== p && !selSet?.has(p.id) && !hover) ||
        (!selected && !hover && tourKinds !== null && !tourKinds.has(p.type));
      const focus = p === hover || p === selected;
      const hotHue = p.type === "repo" || p.type === "tech" || p.type === "language";
      const baseLum = promoted ? LUM.project * (hotHue ? 0.55 : 1) : LUM[p.type] ?? 0.7;
      const lum = p === selected ? Math.min(1.45, baseLum * 1.3) : p === hover ? Math.min(1.35, baseLum * 1.15) : baseLum;
      const op = (dim ? (touring ? 0.05 : selected && !hover ? 0.12 : 0.3) : 1) * fade * depthFade * lum * nearFade * p.reveal * tw;
      // the white centre stays small on every work star, so colour leads
      const coreLift = hotHue ? 0.45 : p.type === "project" ? 0.55 : 1;
      const lift = p === selected ? 1.1 : p === hover ? 1.05 : 1;
      drawStar(p, R * lift * (0.97 + (tw - 0.8) * 0.25), op, near, focus, focus ? 0 : out, big, coreLift);

      // Names follow the same order as the lines: the anchors and the lead
      // kind always, crisp; any other star only when it, or a star it is
      // joined to, is hovered or open. Nothing faint in between.
      const named = big;
      const near1 = hover === p || hoverSet?.has(p.id) || selSet?.has(p.id);
      const anchor = PLANET.has(p.type);
      const far1 = anchor ? 1 : clamp(1 - (out - 0.25) * 1.8, 0, 1);
      const lop = focus ? 1 : named ? 0.88 * far1 : near1 ? 0.88 : 0;
      if (lop > 0.05 && !(dim && !focus) && R > 1.1) {
        const size = focus ? 14 : clamp((p.major ? 10.5 : 10) + R * 0.1, 10, 13);
        labels.push({
          text: trim(p.label, focus ? 44 : 22),
          x: p.px,
          y: p.py + Math.max(R * 1.4, 7) + 4,
          font: `${focus ? 600 : 500} ${size}px Inter, -apple-system, "SF Pro Display", sans-serif`,
          size,
          a: Math.min(1, lop * Math.max(p.reveal, near1 ? 1 : 0)),
          prio: (focus ? 1e6 : 0) + (PLANET.has(p.type) ? 5000 : 0) + (big ? 1000 : 0) + p.ps * 100 + p.r,
          focus,
        });
      }
    }
    for (const c of front) drawComet(c);
    ctx!.globalCompositeOperation = "source-over";
    ctx!.globalAlpha = 1;

    // Labels go on top, nearest and most important first; one that would sit
    // on a label already placed waits until the view opens up.
    labels.sort((a, b) => b.prio - a.prio);
    const taken: [number, number, number, number][] = [];
    ctx!.textAlign = "center";
    ctx!.textBaseline = "top";
    ctx!.shadowColor = "rgba(0,0,0,0.75)";
    ctx!.shadowBlur = 6;
    for (const l of labels) {
      ctx!.font = l.font;
      const w = ctx!.measureText(l.text).width;
      const box: [number, number, number, number] = [l.x - w / 2 - 3, l.y - 1, l.x + w / 2 + 3, l.y + l.size + 2];
      if (!l.focus && taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) continue;
      taken.push(box);
      ctx!.fillStyle = `rgba(232,236,245,${l.a.toFixed(3)})`;
      ctx!.fillText(l.text, l.x, l.y);
    }
    ctx!.shadowBlur = 0;
    raf = requestAnimationFrame(render);
  }

  // A star. Every star has a soft halo and a hot white core, added as light.
  // Projects and repos carry four point light spikes. Disciplines are planets:
  // a lit sphere with a ring. Up close a project shows a glass rim.
  function drawStar(p: Node, R: number, op: number, near: number, focus: boolean, out: number, big: boolean, coreLift = 1) {
    op = clamp(op, 0, 1.5);
    if (op <= 0.01) return;
    const x = p.px, y = p.py;
    const haloMax = Math.max(W, H) * (phone ? 0.45 : 0.8);
    const halo = Math.min(haloMax, big ? Math.max(R * 8 + lerp(16, 6, out), lerp(26, 11, out)) : Math.max(R * 4.6 + 4, lerp(8, 5, out)));
    blit(sprite("glow", p.color), x, y, halo, op * (big ? lerp(0.72, 0.5, out) : 0.42));
    if ((SPIKED.has(p.type) || (big && !p.major)) && out < 0.85) blit(sprite("spike", p.color), x, y, Math.max(R * 7 + 20, lerp(30, 12, out)), op * 0.55 * (1 - out));
    const core = Math.max(R * (big ? 1.45 : 0.95), big ? lerp(2.6, 1.7, out) : 1.2);
    blit(sprite("core", p.color), x, y, core * 1.8, Math.min(1, op * 0.92 * coreLift));
    ctx!.globalAlpha = 1;

    if (PLANET.has(p.type) && R > 2.6) {
      // a lit sphere, its ring tilted through it
      ctx!.globalCompositeOperation = "source-over";
      const g = ctx!.createRadialGradient(x - R * 0.38, y - R * 0.42, R * 0.08, x, y, R);
      g.addColorStop(0, hexA(mix(p.color, "#ffffff", 0.7), Math.min(1, op)));
      g.addColorStop(0.5, hexA(p.color, Math.min(1, op * 0.92)));
      g.addColorStop(1, hexA(mix(p.color, "#000000", 0.55), Math.min(1, op * 0.95)));
      ctx!.fillStyle = g;
      ctx!.beginPath(); ctx!.arc(x, y, R, 0, Math.PI * 2); ctx!.fill();
      ctx!.globalCompositeOperation = "lighter";
      ctx!.strokeStyle = hexA(mix(p.color, "#ffffff", 0.3), Math.min(1, op * 0.75));
      ctx!.lineWidth = Math.max(1, R * 0.14);
      ctx!.beginPath(); ctx!.ellipse(x, y, R * 2.15, R * 0.6, -0.38, 0, Math.PI * 2); ctx!.stroke();
    } else if (p.major && R > 7) {
      // glass rim up close
      const bubble = clamp((R - 7) / 10, 0, 1) * clamp(near + 0.2, 0, 1);
      if (bubble > 0.02) {
        const g1 = ctx!.createRadialGradient(x, y, R * 0.7, x, y, R);
        g1.addColorStop(0, hexA(p.color, 0));
        g1.addColorStop(0.75, hexA(p.color, 0.18 * op * bubble));
        g1.addColorStop(0.92, hexA(mix(p.color, "#ffffff", 0.4), 0.75 * op * bubble));
        g1.addColorStop(1, hexA(p.color, 0));
        ctx!.fillStyle = g1;
        ctx!.beginPath(); ctx!.arc(x, y, R, 0, Math.PI * 2); ctx!.fill();
      }
    }
    if (focus) {
      ctx!.strokeStyle = hexA(p.color, Math.min(1, 0.85 * op));
      ctx!.lineWidth = 1.4;
      ctx!.beginPath(); ctx!.arc(x, y, Math.max(R * 1.7, 9) + 5, 0, Math.PI * 2); ctx!.stroke();
    }
  }

  // ---- interaction --------------------------------------------------------
  function pick(sx: number, sy: number): Node | null {
    let best: Node | null = null, bestD = Infinity;
    for (const p of nodes) {
      if (p.pz < NEAR || p.reveal < 0.3) continue;
      const rr = Math.max(clamp(p.r * p.ps, 0.6, 140) * 1.4 + 12, 16);
      const d = (p.px - sx) ** 2 + (p.py - sy) ** 2;
      if (d < rr * rr && d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  const wake = () => { idle = 0; autorotate = false; camTarget = null; };
  // Turn the view by a drag of dx, dy pixels, right away; the last move is
  // kept for a short coast after release.
  const TURN = 0.0065;
  const turn = (dx: number, dy: number) => {
    cam.yaw += dx * TURN;
    cam.pitch = clamp(cam.pitch + dy * TURN, -1.45, 1.45);
    vel.yaw = dx * TURN * 0.5;
    vel.pitch = dy * TURN * 0.5;
  };
  // Move the view across by a drag of dx, dy pixels: the map follows the
  // finger at the depth of the point being looked at.
  const pan = (dx: number, dy: number) => {
    const { right, up } = axes();
    const s = cam.focal / Math.max(cam.dist, 1);
    const mx = -dx / s, my = dy / s;
    const mv: V3 = [right[0] * mx + up[0] * my, right[1] * mx + up[1] * my, right[2] * mx + up[2] * my];
    cam.tx += mv[0]; cam.ty += mv[1]; cam.tz += mv[2];
    vel.tx = mv[0] * 0.5; vel.ty = mv[1] * 0.5; vel.tz = mv[2] * 0.5;
  };
  // Fly in or out by a factor, toward the point under (sx, sy).
  const flyToward = (factor: number, sx: number, sy: number) => {
    const before = cam.dist;
    const after = clamp(before * factor, minDist(), maxDist());
    const k = 1 - after / before; // share of the way to the point
    const { right, up } = axes();
    const s = cam.focal / Math.max(before, 1);
    const ox = (sx - W / 2) / s, oy = -(sy - H / 2) / s;
    cam.tx += (right[0] * ox + up[0] * oy) * k;
    cam.ty += (right[1] * ox + up[1] * oy) * k;
    cam.tz += (right[2] * ox + up[2] * oy) * k;
    cam.dist = after;
  };

  // Pointers on the map: one turns it (or moves it with the right button or
  // shift), two pinch to fly and slide to move.
  const pts = new Map<number, { x: number; y: number }>();
  let moved = false, panMode = false, lastPinch = 0, lastMid = { x: 0, y: 0 };
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-panning");
    wake();
    vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
    if (pts.size === 1) {
      moved = false;
      panMode = e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
    } else if (pts.size === 2) {
      moved = true;
      const [a, b] = [...pts.values()];
      lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
      lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const prev = pts.get(e.pointerId);
    if (!prev) {
      const h = pick(e.clientX - rect.left, e.clientY - rect.top);
      if (h !== hover) { hover = h; canvas.classList.toggle("is-over", !!h); }
      return;
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (lastPinch) flyToward(lastPinch / d, mid.x - rect.left, mid.y - rect.top);
      pan(mid.x - lastMid.x, mid.y - lastMid.y);
      lastPinch = d; lastMid = mid;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    if (panMode) pan(dx, dy); else turn(dx, dy);
  });
  const release = (e: PointerEvent) => {
    const was = pts.size;
    pts.delete(e.pointerId);
    if (was === 1 && !moved && e.type === "pointerup") {
      const rect = canvas.getBoundingClientRect();
      select(pick(e.clientX - rect.left, e.clientY - rect.top));
    }
    if (pts.size < 2) lastPinch = 0;
    if (pts.size === 1) lastMid = [...pts.values()][0];
    if (pts.size === 1 || was >= 2) vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
    if (!pts.size) canvas.classList.remove("is-panning");
    idle = 0;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    wake();
    const rect = canvas.getBoundingClientRect();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    flyToward(Math.exp(clamp(delta, -120, 120) * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  // Keys fly the camera: W A S D or arrows, R and F up and down, + and - zoom.
  const keys = new Set<string>();
  const typing = () => {
    const a = document.activeElement as HTMLElement | null;
    return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
  };
  window.addEventListener("keydown", (e) => {
    if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "escape") { if (tourStep >= 0) endTour(); else select(null); return; }
    if (["w", "a", "s", "d", "r", "f", "arrowup", "arrowdown", "arrowleft", "arrowright", "+", "=", "-", "_"].includes(k)) {
      keys.add(k);
      wake();
      if (k.startsWith("arrow")) e.preventDefault();
    }
  }, on);
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()), on);
  window.addEventListener("blur", () => keys.clear(), on);
  function keysFly(dt: number) {
    if (!keys.size) return;
    const { right, up, back } = axes();
    const v = cam.dist * 0.9 * dt;
    const m = (k: string) => (keys.has(k) ? 1 : 0);
    const fwd = m("w") + m("arrowup") - m("s") - m("arrowdown");
    const side = m("d") + m("arrowright") - m("a") - m("arrowleft");
    const lift = m("r") - m("f");
    cam.tx += (-back[0] * fwd + right[0] * side + up[0] * lift) * v;
    cam.ty += (-back[1] * fwd + right[1] * side + up[1] * lift) * v;
    cam.tz += (-back[2] * fwd + right[2] * side + up[2] * lift) * v;
    const z = m("+") + m("=") - m("-") - m("_");
    if (z) cam.dist = clamp(cam.dist * Math.exp(-z * 1.4 * dt), minDist(), maxDist());
  }

  // Selecting a star flies to it and opens its card.
  function select(n: Node | null) {
    selected = n;
    if (!n) { closeCard(); return; }
    // the star and every visible connection, inside one sphere
    const group = [n, ...related(n)];
    let lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    for (const m of group) {
      lo = [Math.min(lo[0], m.x), Math.min(lo[1], m.y), Math.min(lo[2], m.z)];
      hi = [Math.max(hi[0], m.x), Math.max(hi[1], m.y), Math.max(hi[2], m.z)];
    }
    const c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    let R = 60 * spread;
    for (const m of group) R = Math.max(R, Math.hypot(m.x - c[0], m.y - c[1], m.z - c[2]) + 30 * spread);
    // the open space: left of the card on a wide screen, above it on a phone
    const sheet = W < 641;
    const panelOpen = !sheet && !panel!.classList.contains("is-folded");
    const leftEdge = panelOpen ? Math.max(0, panel!.getBoundingClientRect().right + 16) : 0;
    const rightEdge = sheet ? W : W - Math.min(420, W * 0.36) - 48;
    const availW = Math.max(240, rightEdge - leftEdge);
    const availH = sheet ? H * 0.5 : H - 150;
    const half = Math.max(90, (Math.min(availW, availH) / 2) * 0.86);
    const dist = clamp((cam.focal * R) / half + R * 0.6, minDist(), maxDist());
    const s = cam.focal / dist;
    const { right, up } = axes();
    const shiftX = sheet ? 0 : (W / 2 - (leftEdge + availW / 2)) / s;
    const shiftY = sheet ? (H / 2 - availH / 2 - 40) / s : 0;
    camTarget = {
      tx: c[0] + right[0] * shiftX - up[0] * shiftY,
      ty: c[1] + right[1] * shiftX - up[1] * shiftY,
      tz: c[2] + right[2] * shiftX - up[2] * shiftY,
      dist,
    };
    vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
    autorotate = false;
    openCard(n);
    // on a phone the card needs the room the panel takes
    if (phone) setFolded(true);
  }

  // ---- the card: a star's dossier, floating in space ---------------------------
  const ARROW = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>`;
  const safe = (u: string) => (/^(https?:\/\/|\/)/.test(u) ? u : "");
  function openCard(n: Node) {
    if (!cardEl || !cardBody) return;
    const kind = TYPE_LABELS[n.type] || n.type;
    const neighbours = related(n);
    const linkList = (n.links && n.links.length ? n.links : n.url ? [{ label: n.url.startsWith("http") ? "Open" : "View", url: n.url }] : [])
      .map((l) => ({ label: l.label, url: safe(l.url) }))
      .filter((l) => l.url);
    const kinds: [string, string, string][] = graphKey === "repo"
      ? [["repo", "Repositories", "repository"], ["language", "Languages", "language"], ["category", "Stacks", "stack"]]
      : [["project", "Projects", "project"], ["post", "Case studies", "case study"], ["tech", "Technologies", "technology"]];
    const counts = kinds.map(([t, label, one]) => ({ label, one, value: neighbours.filter((m) => m.type === t).length }));
    const plural = (k: { one: string; value: number }) =>
      `${k.value} ${k.value === 1 ? k.one : k.one === "technology" ? "technologies" : k.one === "case study" ? "case studies" : k.one === "repository" ? "repositories" : k.one + "s"}`;
    const linked = counts.filter((k) => k.value > 0);
    const connected = linked.length
      ? `<div class="mc-count"><span class="mc-label">Connected to</span><div class="mc-count-row">${linked
          .map((k) => `<span class="mc-count-item"><b>${k.value}</b> ${esc(plural(k).replace(/^\d+ /, ""))}</span>`)
          .join("")}</div></div>`
      : "";
    const cls = [kind, n.meta].filter(Boolean).join(" · ");
    const hop = neighbours
      .sort((a, b) => Number(b.major) - Number(a.major) || b.weight - a.weight)
      .slice(0, 9);
    cardEl.style.setProperty("--nc", n.color);
    cardEl.style.setProperty("--nc-rgb", rgbOf(n.color));
    cardEl.dataset.kind = n.type;
    const blurb = (n.blurb || "").trim();
    cardBody.innerHTML = `
      <header class="mc-head">
        <span class="mc-orb${PLANET.has(n.type) ? " is-planet" : ""}" aria-hidden="true"></span>
        <div class="mc-id">
          <p class="mc-class">${esc(cls)}</p>
          <h2 class="mc-name" id="mind-card-name">${esc(n.label)}</h2>
        </div>
      </header>
      ${blurb ? `<p class="mc-bio">${esc(blurb)}</p>` : ""}
      ${connected}
      ${linkList.length ? `<div class="mc-actions">${linkList
        .map((l) => {
          const ext = l.url.startsWith("http");
          return `<a class="mc-btn" href="${esc(l.url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)} ${ARROW}</a>`;
        })
        .join("")}</div>` : ""}
      <div class="mc-more"${(n.chips || []).length || hop.length ? "" : " hidden"}>
        ${(n.chips || []).length ? `<div class="mc-sec"><p class="mc-label">Built with</p><div class="mc-chips">${n.chips!.slice(0, 10).map((c) => `<span class="mc-chip">${esc(c)}</span>`).join("")}</div></div>` : ""}
        ${hop.length ? `<div class="mc-sec"><p class="mc-label">Nearby stars</p><div class="mc-chips">${hop
          .map((m) => `<button type="button" class="mc-hop" data-hop="${esc(m.id)}" style="--hc:${esc(m.color)}">${esc(trim(m.label, 26))}</button>`)
          .join("")}</div></div>` : ""}
      </div>`;
    cardEl.hidden = false;
    // replay the arrival each time a new star opens
    cardEl.classList.remove("is-in");
    void cardEl.offsetWidth;
    cardEl.classList.add("is-in");
  }
  function closeCard() {
    if (!cardEl) return;
    cardEl.classList.remove("is-in");
    cardEl.hidden = true;
  }
  cardBody?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-hop]");
    if (!b) return;
    const n = byId.get(b.dataset.hop!);
    if (n) select(n);
  });
  cardClose?.addEventListener("click", () => select(null));

  // ---- panel --------------------------------------------------------------
  // On a thin or short window the panel starts folded to its top row, so it
  // does not sit on top of the map.
  function setFolded(folded: boolean) {
    panel!.classList.toggle("is-folded", folded);
    if (!foldBtn) return;
    const label = folded ? "Show panel" : "Hide panel";
    foldBtn.setAttribute("aria-expanded", String(!folded));
    foldBtn.setAttribute("aria-label", label);
    foldBtn.title = label;
  }
  const foldBtn = panel.querySelector<HTMLButtonElement>("[data-mind-fold]");
  foldBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setFolded(!panel.classList.contains("is-folded"));
  });
  // Folded, the whole pill opens it.
  panel.addEventListener("click", () => {
    if (panel.classList.contains("is-folded")) setFolded(false);
  });
  setFolded(window.matchMedia("(max-width: 1100px), (max-height: 640px)").matches);

  // The legend doubles as the filter: each kind of star that can be switched
  // off is a button; the anchors always stay.
  function renderLegend(key: string) {
    const g = byKey.get(key) || graphs[0];
    const colorFor = (type: string) => g.nodes.find((n) => n.type === type)?.color || "#93A4C4";
    legendEl.innerHTML = (LEGEND[key] || [])
      .map((type) => {
        const label = esc(TYPE_PLURAL[type] || TYPE_LABELS[type] || type);
        return FILTERABLE.has(type)
          ? `<li><button type="button" class="mind-filter-btn" data-type="${type}" aria-pressed="true" style="--lc:${colorFor(type)}">${label}</button></li>`
          : `<li class="mind-filter-fixed" style="--lc:${colorFor(type)}">${label}</li>`;
      })
      .join("");
  }
  legendEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-type]");
    if (!b) return;
    e.stopPropagation();
    const type = b.dataset.type!;
    const on = hiddenTypes.has(type);
    if (on) hiddenTypes.delete(type); else hiddenTypes.add(type);
    b.setAttribute("aria-pressed", String(on));
    relCache = new Map();
    if (hover && !shown(hover)) hover = null;
    if (selected) select(shown(selected) ? selected : null);
  });

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.mode!;
      modeBtns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", String(on));
      });
      loadGraph(key);
    });
  });
  resetBtn?.addEventListener("click", () => {
    select(null);
    vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
    frameToFit();
    autorotate = !reduced;
  });

  // ---- the tour -------------------------------------------------------------
  // A first visit walk through the map. The site is static, so "first visit"
  // is remembered in this browser; the Tour button replays it any time.
  const TOUR_KEY = "mind-tour-v1";
  const tourEl = document.querySelector<HTMLElement>("[data-mind-tour]");
  const tourOpen = document.querySelector<HTMLButtonElement>("[data-mind-tour-open]");
  let tourStep = -1;
  let tourWasFolded = false;
  type TourStep = { title: string; text: string; target?: string; enter: () => void };
  // A step either needs the panel (it points at something in it) or not;
  // when not, the panel folds away so the map has the room.
  const panelFor = (open: boolean) => setFolded(!open);
  const overview = (yaw = -0.5, pitch = -0.42, zoom = 1) => {
    select(null);
    vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
    frameToFit();
    camTarget = { ...camTarget, yaw, pitch, dist: camTarget!.dist! * zoom };
    autorotate = false;
  };
  const showcase = () =>
    nodes.filter((n) => n.type === "project" && shown(n)).sort((a, b) => b.deg - a.deg)[0] || null;
  const STEPS: TourStep[] = [
    {
      title: "Welcome to the Mind",
      text: "A star map of everything I have built. Here is how to read it.",
      enter: () => { tourKinds = null; tourAxes = false; panelFor(false); overview(); },
    },
    {
      title: "Four planets, four disciplines",
      text: "AIE, FDE, MLE and SDE. Each project is pulled toward the ones it belongs to.",
      enter: () => { tourKinds = new Set(["discipline"]); tourAxes = false; panelFor(false); overview(); },
    },
    {
      title: "Position has meaning",
      text: "Left to right: business to tech. Top to bottom: product to models. Depth: data to systems.",
      enter: () => { tourKinds = new Set(); tourAxes = true; panelFor(false); overview(-0.95, -0.36, 1.3); },
    },
    {
      title: "What the colours mean",
      text: "Blue projects, green case studies, red technologies. Fly closer to see more.",
      target: ".mind-filter",
      enter: () => { tourKinds = new Set(["project", "post", "tech"]); tourAxes = false; panelFor(true); overview(); },
    },
    {
      title: "Open any star",
      text: "Tap a star to open its card: what it is, where to read more, what it links to.",
      enter: () => { tourKinds = null; tourAxes = false; panelFor(false); const n = showcase(); if (n) select(n); },
    },
    {
      title: "Choose what you see",
      text: "Switch kinds on and off. The highest kind still on takes the lines.",
      target: ".mind-filter",
      enter: () => { tourKinds = new Set(); tourAxes = false; panelFor(true); overview(); },
    },
    {
      title: "Fly around",
      text: "Scroll or pinch to fly, drag to turn. Git mind shows my repos by tech stack.",
      target: ".mind-modes",
      enter: () => { tourKinds = new Set(); tourAxes = false; panelFor(true); },
    },
  ];
  // The tour card moves to wherever it covers least: it tries a few spots
  // and skips any that sit on the stars or axis names the step is about,
  // the open panel, or a star's card.
  function placeTour() {
    if (!tourEl || tourEl.hidden) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const phoneW = vw < 641;
    const w = phoneW ? vw - 24 : Math.min(440, vw - 32);
    const h = tourEl.offsetHeight || 170;
    const top0 = phoneW ? 84 : 96;
    type R = { x: number; y: number; w: number; h: number };
    const hit = (r: R, x: number, y: number, pad = 18) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
    const meets = (a: R, b: R) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const blocks: R[] = [];
    if (!panel!.classList.contains("is-folded") || phoneW) {
      const pr = panel!.getBoundingClientRect();
      blocks.push({ x: pr.left - 12, y: pr.top - 12, w: pr.width + 24, h: pr.height + 24 });
    }
    for (const el of document.querySelectorAll(".chat-launcher, [data-mind-reset]")) {
      const r = el.getBoundingClientRect();
      if (r.width) blocks.push({ x: r.left - 12, y: r.top - 12, w: r.width + 24, h: r.height + 24 });
    }
    const frame = cardEl && !cardEl.hidden ? cardEl.querySelector(".mind-card-frame") : null;
    if (frame) {
      const cr = frame.getBoundingClientRect();
      blocks.push({ x: cr.left - 16, y: cr.top - 16, w: cr.width + 32, h: cr.height + 32 });
    }
    // what this step is about, on screen
    const pts: [number, number, number][] = [];
    for (const p of nodes) {
      if (p.pz < NEAR || p.reveal < 0.3) continue;
      const lit = selected ? p === selected || !!related(selected).includes(p) : tourKinds ? tourKinds.has(p.type) : p.major;
      if (lit) pts.push([p.px, p.py, PLANET.has(p.type) || p === selected ? 6 : 1]);
    }
    if (tourAxes) {
      const ext = 640 * spread * 0.86;
      for (const ax of AXES) {
        const e = projXYZ(ax.at[0] * ext, ax.at[1] * ext, ax.at[2] * ext);
        if (e.pz > NEAR) pts.push([e.px, e.py, 6]);
      }
    }
    const spots: R[] = phoneW
      ? [{ x: 12, y: top0, w, h }, { x: 12, y: vh - h - 24, w, h }]
      : [
          { x: (vw - w) / 2, y: vh - h - 24, w, h },
          { x: vw - w - 24, y: vh - h - 24, w, h },
          { x: vw - w - 24, y: top0, w, h },
          { x: (vw - w) / 2, y: top0, w, h },
          { x: 24, y: vh - h - 24, w, h },
          { x: 24, y: top0, w, h },
        ];
    let best = spots[0], bestScore = Infinity;
    spots.forEach((r, k) => {
      if (r.x < 0 || r.y < 0 || r.y + r.h > vh) return;
      let score = k * 0.5; // a small lean toward the first spots
      for (const b of blocks) if (meets(r, b)) score += 1000;
      for (const [x, y, wgt] of pts) if (hit(r, x, y)) score += wgt * 10;
      if (score < bestScore) { bestScore = score; best = r; }
    });
    tourEl.style.width = `${best.w}px`;
    tourEl.style.left = `${best.x}px`;
    tourEl.style.top = `${best.y}px`;
  }
  function showStep(i: number) {
    if (!tourEl) return;
    document.querySelectorAll(".is-tour-target").forEach((el) => el.classList.remove("is-tour-target"));
    tourStep = i;
    const s = STEPS[i];
    s.enter();
    if (s.target) document.querySelector(s.target)?.classList.add("is-tour-target");
    const last = i === STEPS.length - 1;
    tourEl.querySelector("[data-tour-count]")!.textContent = `Space tour · ${i + 1} of ${STEPS.length}`;
    tourEl.querySelector("[data-tour-title]")!.textContent = s.title;
    tourEl.querySelector("[data-tour-text]")!.textContent = s.text;
    tourEl.querySelector("[data-tour-dots]")!.innerHTML = STEPS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    (tourEl.querySelector("[data-tour-back]") as HTMLElement).hidden = i === 0;
    (tourEl.querySelector("[data-tour-skip]") as HTMLElement).hidden = last;
    const next = tourEl.querySelector("[data-tour-next]") as HTMLButtonElement;
    next.textContent = i === 0 ? "Show me" : last ? "Start exploring" : "Next";
    tourEl.classList.remove("is-step");
    void tourEl.offsetWidth;
    if (i > 0) tourEl.classList.add("is-step");
    // once now, then again as the camera settles on the step
    requestAnimationFrame(placeTour);
    window.setTimeout(placeTour, 650);
    window.setTimeout(placeTour, 1300);
  }
  function startTour() {
    if (!tourEl) return;
    try { localStorage.setItem(TOUR_KEY, "seen"); } catch { /* private mode: it shows again next time */ }
    if (graphKey !== "portfolio") modeBtns.find((b) => b.dataset.mode === "portfolio")?.click();
    tourWasFolded = panel!.classList.contains("is-folded");
    touring = true;
    panel!.classList.add("is-touring");
    document.body.classList.add("mind-touring");
    tourEl.hidden = false;
    showStep(0);
    (tourEl.querySelector("[data-tour-next]") as HTMLButtonElement).focus({ preventScroll: true });
  }
  function endTour() {
    if (!tourEl || tourStep < 0) return;
    tourStep = -1;
    tourKinds = null;
    tourAxes = false;
    touring = false;
    panel!.classList.remove("is-touring");
    document.body.classList.remove("mind-touring");
    document.querySelectorAll(".is-tour-target").forEach((el) => el.classList.remove("is-tour-target"));
    tourEl.hidden = true;
    setFolded(tourWasFolded);
  }
  tourEl?.querySelector("[data-tour-next]")?.addEventListener("click", () => {
    if (tourStep >= STEPS.length - 1) endTour(); else showStep(tourStep + 1);
  });
  tourEl?.querySelector("[data-tour-back]")?.addEventListener("click", () => { if (tourStep > 0) showStep(tourStep - 1); });
  tourEl?.querySelector("[data-tour-skip]")?.addEventListener("click", () => endTour());
  // keep pointer and wheel on the tour card from moving the map
  for (const ev of ["pointerdown", "wheel", "click"]) tourEl?.addEventListener(ev, (e) => e.stopPropagation());
  tourOpen?.addEventListener("click", (e) => { e.stopPropagation(); startTour(); });
  window.addEventListener("resize", () => placeTour(), on);

  // ---- boot ---------------------------------------------------------------
  let resizeQueued = false;
  const ro = new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resize(); });
  });
  ro.observe(canvas);
  resize();
  loadGraph(graphKey);
  raf = requestAnimationFrame(render);
  // first visit in this browser: the tour opens once the map has settled
  let seen = false;
  try { seen = localStorage.getItem(TOUR_KEY) === "seen"; } catch { seen = false; }
  const tourTimer = !seen && !new URLSearchParams(location.search).has("notour") ? window.setTimeout(startTour, 1400) : 0;

  return () => {
    life.abort();
    cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    clearTimeout(tourTimer);
    keys.clear();
    document.body.classList.remove("mind-touring");
  };
}

// ---- helpers --------------------------------------------------------------
const rgbCache = new Map<string, string>();
function rgbOf(hex: string): string {
  let v = rgbCache.get(hex);
  if (v) return v;
  const { r, g, b } = toRgb(hex);
  v = `${r},${g},${b}`;
  rgbCache.set(hex, v);
  return v;
}
function hexA(hex: string, a: number): string {
  return `rgba(${rgbOf(hex)},${clamp(a, 0, 1).toFixed(3)})`;
}
function toRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mix(a: string, b: string, t: number): string {
  const A = toRgb(a), B = toRgb(b);
  const r = Math.round(lerp(A.r, B.r, t)), g = Math.round(lerp(A.g, B.g, t)), bl = Math.round(lerp(A.b, B.b, t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}
function trim(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
