// The Mind star map: a 3D space to fly through. Projects are bright stars,
// disciplines are ringed planets, and the tools they use are dim starlight around
// them. Links are light that travels between them. Nothing else is in the map's
// space: the atmosphere stays outside it, so the connections are what you read.
//
// This file owns the camera, the layout of the stars, the controls, the names, the
// card and the tour, and it has no 3D code in it, so it is on screen in a moment.
// The world itself (mind-world/engine.ts) loads after it, builds in small turns,
// and fades in behind the map. Until then, and whenever there is no GPU, the same
// map is drawn with canvas 2D (mind-world/flat.ts) and every control still works.
//
// Mouse: drag to turn, right drag or shift drag to move, scroll to fly toward
// the pointer, click a star to fly to it and open its card. Touch: one finger
// turns, two fingers pinch to fly and slide to move, tap a star. Keys: W A S D
// or arrows to fly, R and F up and down, + and - to zoom, Escape to close.
// The view follows the hand directly and coasts only briefly after release.
//
// Sound reads this page through window events:
//   mind:fly    { speed }      0..1, on every change while moving, 0 when it stops
//   mind:depth  { near }       0..1, how close the camera is to the map's centre
//   mind:focus  { id, kind }   a star opened, or nulls when it closes
//   mind:hover  { id, kind }   the pointer on a star, or nulls when it leaves
//   mind:filter { kind, on }   a kind of star switched on or off

import { MAJOR, radiusOf, spreadOf } from "./mind-world/settle";
import { Flat, mix, PLANET_SCALE, rgbOf, type FlatComet, type FlatNode, type Projected } from "./mind-world/flat";
import { LabelAtlas } from "./mind-world/labels";
import type { World, WorldComet, WorldFrame, WorldLink, WorldShown } from "./mind-world/engine";

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
  /** Its place on the map, worked out when the page was built. */
  at: V3;
}
interface RawGraph {
  key: string;
  title: string;
  subtitle: string;
  nodes: RawNode[];
  edges: { source: string; target: string }[];
}
interface Node extends RawNode, FlatNode {
  x: number; y: number; z: number;
  pinned: boolean;
  major: boolean;
  r: number; // world radius, from weight + degree
  tw: number;
  deg: number;
  reveal: number; // 0 hidden .. 1 fully shown
  vr: number; // the radius it draws at this frame
  labelA: number; // its name's fade in
  labelOn: boolean; // its name was placed last frame
  hx: number; hy: number; hz: number; // where it settles
  delay: number; // how long it waits before it flies out to its place
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
// The work stars (MAJOR, in settle.ts) are always there; the supporting stars come
// forward as the camera gets near them.
const PLANET = new Set(["discipline", "category"]);
const AXES: { at: V3; label: string }[] = [
  { at: [-1, 0, 0], label: "Business-driven" },
  { at: [1, 0, 0], label: "Tech-driven" },
  { at: [0, 1, 0], label: "Product & delivery" },
  { at: [0, -1, 0], label: "Models & intelligence" },
  { at: [0, 0, 1], label: "Data & integration" },
  { at: [0, 0, -1], label: "Systems & platforms" },
];
// The site's tab colours, for the comets.
const SPACE_TINTS = ["#A78BFA", "#5B8DEF", "#22D3EE", "#34D399", "#F5A524", "#F43F5E"];
// How far along an axis its name sits.
const AXIS_AT = 0.72;
// Where the map is seen from at rest, and how far it sways either side of that.
const HOME_YAW = -0.5;
const HOME_PITCH = -0.42;
const SWAY = 0.2;
const NAME_COLOR = "rgb(232,236,245)";
const AXIS_COLOR = "rgb(214,232,255)";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (a: number, b: number, k: number, dt: number) => lerp(a, b, 1 - Math.exp(-k * dt));
// Anything closer to the camera than this (world units) fades out, so flying
// through the cloud stays clean and things pass behind you.
const NEAR = 28;
const INTER = "Inter, 'Inter Fallback', Arial, sans-serif";

// Mounts the map on the page and returns a function that takes it down
// again: the render loop, the observers and every window listener. The site
// moves between pages without reloading, so /mind calls this each time it is
// shown and the returned function when it is swapped away.
export function mountMind(): (() => void) | undefined {
  const canvas = document.getElementById("mind-canvas") as HTMLCanvasElement | null;
  const glCanvas = document.getElementById("mind-gl") as HTMLCanvasElement | null;
  const dataEl = document.getElementById("mind-data");
  const panel = document.querySelector<HTMLElement>("[data-mind-panel]");
  const root = document.querySelector<HTMLElement>(".mind-root");
  if (!canvas || !dataEl || !panel || !root) return;
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
  const cardFrame = document.querySelector(".mind-card-frame") as HTMLElement | null;
  const cardPort = document.querySelector("[data-card-port]") as HTMLElement | null;
  const cardOrb = document.querySelector("[data-card-orb]") as HTMLElement | null;
  const cardBody = document.querySelector("[data-mind-card-body]") as HTMLElement | null;
  const cardClose = document.querySelector("[data-mind-card-close]") as HTMLElement | null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = window.matchMedia("(max-width: 767px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const tier: "high" | "mid" | "low" = phone || memory < 4 ? "low" : coarse || memory < 6 ? "mid" : "high";

  let W = 0, H = 0, dpr = 1;
  let nodes: Node[] = [];
  let edges: Edge[] = [];
  const adj = new Map<string, Set<string>>();
  const byId = new Map<string, Node>();
  let graphKey = "portfolio";
  const hiddenTypes = new Set<string>();
  const shown = (p: Node) => !hiddenTypes.has(p.type);

  const flat = new Flat(ctx, reduced, phone);
  let atlas = new LabelAtlas(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2), phone);

  // ---- camera ---------------------------------------------------------------
  // It looks at a target point from `dist` away, turned by yaw and pitch. The
  // target can move anywhere, so the whole space is open to explore.
  const cam = { yaw: HOME_YAW, pitch: HOME_PITCH, dist: 900, focal: 700, tx: 0, ty: 0, tz: 0 };
  type CamKey = keyof typeof cam;
  // A flight: every value eases toward its target with its own velocity, so a
  // new target mid flight bends the move instead of breaking it.
  let camTarget: Partial<Record<CamKey, number>> | null = null;
  const camV: Partial<Record<CamKey, number>> = {};
  // a short coast after letting go, so a fling carries a little and stops
  const vel = { yaw: 0, pitch: 0, tx: 0, ty: 0, tz: 0 };
  let worldR = 300;
  // The lens opens a little while flying, so speed is felt in the whole picture.
  let focalNow = 700;
  // Where the view's centre sits: the open space beside the panel or the card.
  let ox = 0, oy = 0, oxT = 0, oyT = 0;
  // How far apart the map spreads. It grows with the number of stars, so a
  // busy map opens up instead of packing into tight clusters.
  let spread = 1;
  let hasQuadrants = false;
  let showAxisLabels = false;
  let fade = 0;
  // On arrival the stars fly out from the heart of the map to their places, while
  // the camera comes in: 0 at the start, 1 once every one has landed.
  let bloom = 1;
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
  let paused = false;

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

  // A flight starts here: a new target, and the short way around for the turn.
  function flyTo(t: Partial<Record<CamKey, number>>) {
    if (t.yaw !== undefined) {
      const turnBy = ((((t.yaw - cam.yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
      t.yaw = cam.yaw + turnBy;
    }
    // Reduced motion in the tour: no flying, the view is simply there, and the stars
    // come up in it.
    if (reduced && touring) {
      Object.assign(cam, t);
      camTarget = null;
      fade = Math.min(fade, 0.3);
      return;
    }
    camTarget = t;
  }

  // ---- comets ---------------------------------------------------------------
  // A few straight runs out past the map. One that would cross it fades away first.
  const COMETS = reduced ? 1 : phone ? 2 : 3;
  const comets: (FlatComet & { view: WorldComet })[] = [];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  function spawnComet(c?: (typeof comets)[number]) {
    const z = rnd(-1, 1), a = rnd(0, Math.PI * 2), q = Math.sqrt(1 - z * z);
    const dir: V3 = [Math.cos(a) * q, z, Math.sin(a) * q];
    const shell = worldR * rnd(1.8, 3);
    const center: V3 = [dir[0] * shell, dir[1] * shell, dir[2] * shell];
    // along the shell, not toward the map
    const b = rnd(0, Math.PI * 2);
    const u: V3 = Math.abs(dir[1]) < 0.9 ? [dir[2], 0, -dir[0]] : [1, 0, 0];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    const u1: V3 = [u[0] / ul, u[1] / ul, u[2] / ul];
    const u2: V3 = [dir[1] * u1[2] - dir[2] * u1[1], dir[2] * u1[0] - dir[0] * u1[2], dir[0] * u1[1] - dir[1] * u1[0]];
    const h: V3 = [u1[0] * Math.cos(b) + u2[0] * Math.sin(b), u1[1] * Math.cos(b) + u2[1] * Math.sin(b), u1[2] * Math.cos(b) + u2[2] * Math.sin(b)];
    const speed = rnd(70, 150) * (worldR / 300);
    const lifeSpan = rnd(7, 12);
    const run = speed * lifeSpan * 0.5;
    const out = c || ({ view: { head: [0, 0, 0], tail: [0, 0, 0], color: "", width: 1, env: 0 } } as unknown as (typeof comets)[number]);
    out.v = [h[0] * speed, h[1] * speed, h[2] * speed];
    out.p = [center[0] - h[0] * run, center[1] - h[1] * run, center[2] - h[2] * run];
    out.len = rnd(0.6, 1.1) * (worldR / 300) * 120;
    out.w = rnd(1, 2);
    out.color = SPACE_TINTS[(Math.random() * SPACE_TINTS.length) | 0];
    out.life = lifeSpan;
    out.age = c ? 0 : rnd(0, lifeSpan * 0.8);
    return out;
  }
  // The map's bounds as a camera at C sees them: a half angle. From inside it, the map
  // is all around, so nothing else may show anywhere.
  const MAP_FADE = 0.2;
  function mapAngle(C: V3) {
    const D = Math.hypot(C[0], C[1], C[2]);
    const R = worldR * 1.02;
    const a = D > R ? Math.asin(R / D) : Math.PI / 2;
    let inside = clamp((R * 1.3 - D) / (R * 0.3), 0, 1);
    inside = inside * inside * (3 - 2 * inside);
    return lerp(a, Math.PI, inside) + 0.02;
  }
  // 0 on the map's bounds, up to 1 well clear of them, for a point seen from C.
  function clearOfMap(C: V3, mapA: number, x: number, y: number, z: number) {
    const dx = x - C[0], dy = y - C[1], dz = z - C[2];
    const dl = Math.hypot(dx, dy, dz) || 1;
    const Dl = Math.hypot(C[0], C[1], C[2]) || 1;
    const cos = (dx * -C[0] + dy * -C[1] + dz * -C[2]) / (dl * Dl);
    return clamp((Math.acos(clamp(cos, -1, 1)) - mapA) / MAP_FADE, 0, 1);
  }
  function moveComets(dt: number, C: V3, mapA: number) {
    const reach = worldR * 5 + cam.dist;
    for (const c of comets) {
      if (!reduced) {
        c.p[0] += c.v[0] * dt; c.p[1] += c.v[1] * dt; c.p[2] += c.v[2] * dt;
        c.age += dt;
      }
      const far = Math.hypot(c.p[0], c.p[1], c.p[2]) > reach;
      if (c.age > c.life || far) spawnComet(c);
      // what the world draws
      const spd = Math.hypot(c.v[0], c.v[1], c.v[2]) || 1;
      const lf = c.age / c.life;
      const v = c.view;
      v.head[0] = c.p[0]; v.head[1] = c.p[1]; v.head[2] = c.p[2];
      v.tail[0] = c.p[0] - (c.v[0] / spd) * c.len;
      v.tail[1] = c.p[1] - (c.v[1] / spd) * c.len;
      v.tail[2] = c.p[2] - (c.v[2] / spd) * c.len;
      v.color = c.color;
      v.width = c.w;
      const clear = Math.min(clearOfMap(C, mapA, v.head[0], v.head[1], v.head[2]), clearOfMap(C, mapA, v.tail[0], v.tail[1], v.tail[2]));
      v.env = clamp(lf / 0.12, 0, 1) * clamp((1 - lf) / 0.18, 0, 1) * clear * 0.7;
    }
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
    nodes = g.nodes.map((n, i) => {
      const seed = ((i * 2654435761) >>> 0) / 4294967296;
      const node: Node = {
        ...n,
        x: n.at[0], y: n.at[1], z: n.at[2],
        hx: n.at[0], hy: n.at[1], hz: n.at[2],
        delay: seed * 0.45,
        px: 0, py: 0, pz: 0, ps: 1,
        pinned: PLANET.has(n.type),
        major: MAJOR.has(n.type),
        r: 2,
        tw: seed * Math.PI * 2,
        deg: 0,
        reveal: MAJOR.has(n.type) ? 1 : 0.2,
        R: 1, op: 0, foc: 0, big: false, vr: 2,
        labelA: 0, labelOn: false,
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
    for (const n of nodes) n.vr = n.r = radiusOf(n.weight, n.deg);
    // the git map packs more stars per stack, so it gets more room
    spread = spreadOf(nodes.length, key);
    hasQuadrants = nodes.some((n) => n.pinned); // divider lines on both maps
    showAxisLabels = nodes.some((n) => n.id.startsWith("disc:")); // business/tech labels: portfolio only

    root!.setAttribute("data-graph", key);
    subEl.textContent = g.subtitle;
    renderLegend(key);
    closeCard();
    if (selected) emit("mind:focus", { id: null, kind: null });
    selected = null;
    setHover(null);
    fade = 0;
    bloom = reduced ? 1 : 0;
    placeBloom();
    autorotate = !reduced;
    updateFrame();
    frameToFit();
    Object.assign(cam, { tx: 0, ty: 0, tz: 0, dist: camTarget!.dist! * 1.2 });
    for (const k of Object.keys(camV) as CamKey[]) camV[k] = 0;
    comets.length = 0;
    for (let i = 0; i < COMETS; i++) comets.push(spawnComet());
    linkKey = "";
    needGraph = true;
    if (flatSky) flat.buildSky(worldR);
  }

  // Each star's position along the arrival, from close to the heart out to its place.
  function placeBloom() {
    for (const p of nodes) {
      if (p.pinned) continue;
      let k = clamp((bloom - p.delay) / (1 - p.delay), 0, 1);
      k = 1 - (1 - k) * (1 - k) * (1 - k);
      const m = 0.42 + 0.58 * k;
      p.x = p.hx * m;
      p.y = p.hy * m;
      p.z = p.hz * m;
    }
  }

  // The whole map, with a little room around it, in the space the panel and the words
  // leave open. It is worked out from the stars themselves, across the whole of the
  // slow sway at rest, so nothing can ever drift under the nav or the panel.
  function fitIn(rect: Rect, yaw0 = HOME_YAW, pitch = HOME_PITCH, swing = SWAY) {
    const f = focalFor(W, H);
    const hw = Math.max(60, (rect.r - rect.l) / 2), hh = Math.max(60, (rect.b - rect.t) / 2);
    const list = nodes.filter((n) => n.major);
    const yaws = [yaw0 - swing, yaw0 - swing / 2, yaw0, yaw0 + swing / 2, yaw0 + swing];
    const cp0 = Math.cos(pitch), sp0 = Math.sin(pitch);
    const fits = (d: number) => {
      for (const yaw of yaws) {
        const c = Math.cos(yaw), si = Math.sin(yaw);
        for (const n of list) {
          const x1 = n.hx * c + n.hz * si;
          const z1 = -n.hx * si + n.hz * c;
          const y2 = n.hy * cp0 - z1 * sp0;
          const z2 = n.hy * sp0 + z1 * cp0;
          const depth = d - z2;
          if (depth <= 1) return false;
          const sc = f / depth;
          const planet = PLANET.has(n.type);
          const R = planet ? n.r * PLANET_SCALE * 2.36 * sc : n.r * sc + 4;
          const under = planet ? 24 : 14;
          if (Math.abs(x1 * sc) + R > hw) return false;
          if (y2 * sc + R > hh) return false;
          if (-y2 * sc + R + under > hh) return false;
        }
      }
      return true;
    };
    let lo = worldR * 1.05, hi = worldR * 14;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid; else lo = mid;
    }
    return hi * 1.04; // a little breathing room
  }
  const fitDist = () => fitIn(freeRect());
  function frameToFit() {
    let max = 1;
    for (const p of nodes) max = Math.max(max, Math.hypot(p.hx, p.hy, p.hz));
    worldR = max;
    cam.focal = focalFor(W, H);
    flyTo({ dist: fitDist(), yaw: HOME_YAW, pitch: HOME_PITCH, tx: 0, ty: 0, tz: 0 });
    swayT = 0;
  }

  // How large the map draws. A portrait phone is narrow and tall, so the map
  // may use more of its width than a square fit allows.
  function focalFor(w: number, h: number) {
    return w < 600 && h > w ? w * 1.12 : Math.min(w, h) * 0.92;
  }

  // ---- the open space -------------------------------------------------------
  // The map is framed in what the panel, the card and the tour leave free, by moving
  // the view's centre there, so the camera always looks straight at what it is on and
  // turning orbits that star. Read once when something changes, never per frame.
  type Rect = { l: number; t: number; r: number; b: number };
  let panelRightCache = 0, panelTopCache = 0, frameTopCache = 0, cardLeftCache = 0;
  let sheetOpen = false;
  let tourRect: { x: number; y: number; w: number; h: number } | null = null;
  // Where names may not go: behind the panel and the card.
  const keepOut: number[] = [];
  // Where the body over the open card sits.
  const shownAt = { x: 0, y: 0, R: 36 };
  let words: { ax: number; ay: number; width: number; tilt: number } = { ax: 0, ay: 0, width: 600, tilt: 0.82 };
  const panelOpenNow = () => W >= 641 && !panel!.classList.contains("is-folded");
  // A short window, like a phone on its side, keeps its height for the map.
  const wordsFit = () => H >= 560;
  const cardIsOpen = () => !!cardEl && !cardEl.hidden;
  function freeRect(): Rect {
    const sheet = W < 641;
    const pr = panelOpenNow() ? panelRightCache + 16 : 0;
    if (touring && tourRect) {
      if (sheet) {
        const t = tourRect.y + tourRect.h + 10;
        let b = H - 72;
        if (cardIsOpen()) b = Math.min(b, frameTopCache - 8);
        if (sheetOpen) b = Math.min(b, panelTopCache - 8);
        return { l: 8, t, r: W - 8, b: Math.max(b, t + 120) };
      }
      return { l: pr || 12, t: 84, r: cardIsOpen() ? cardLeftCache - 20 : W - 24, b: tourRect.y - 12 };
    }
    if (selected && cardIsOpen()) {
      if (sheet) return { l: 8, t: 96, r: W - 8, b: Math.max(frameTopCache - 10, 226) };
      return { l: pr, t: 75, r: Math.max(pr + 240, cardLeftCache - 28), b: H - 75 };
    }
    if (sheet) return { l: 12, t: 100, r: W - 12, b: !wordsFit() ? H - 20 : sheetOpen ? panelTopCache - 8 : H - 172 };
    return { l: pr || 12, t: panelOpenNow() ? 84 : 128, r: W - 70, b: H - (wordsFit() ? 118 : 24) };
  }
  function updateFrame() {
    if (!W) return;
    const sheet = W < 641;
    const rb = root!.getBoundingClientRect();
    const pb = panel!.getBoundingClientRect();
    const open = panelOpenNow();
    panelRightCache = open ? pb.right - rb.left : 0;
    panelTopCache = pb.top - rb.top;
    sheetOpen = sheet && !panel!.classList.contains("is-folded");
    keepOut.length = 0;
    if (open || sheetOpen) keepOut.push(pb.left - rb.left - 4, panelTopCache - 4, pb.right - rb.left + 4, pb.bottom - rb.top + 4);
    if (cardIsOpen()) {
      // It stops above the chat button, whatever the window's shape.
      const launcher = document.querySelector<HTMLElement>(".chat-launcher");
      const lb = launcher ? launcher.getBoundingClientRect() : null;
      if (!sheet && lb && lb.width > 0) cardEl!.style.setProperty("--card-bottom", `${Math.max(24, rb.bottom - lb.top + 14)}px`);
      else cardEl!.style.removeProperty("--card-bottom");
      const fb = cardFrame!.getBoundingClientRect();
      frameTopCache = cardFrame!.offsetTop + cardEl!.getBoundingClientRect().top - rb.top;
      cardLeftCache = cardEl!.getBoundingClientRect().left - rb.left;
      const pt = cardPort!.getBoundingClientRect();
      const big = selected && PLANET.has(selected.type);
      shownAt.R = sheet ? (big ? 17 : 23) : big ? 23 : 31;
      shownAt.x = pt.left - rb.left + (sheet ? 50 : 66);
      shownAt.y = pt.bottom - rb.top - (big ? 8 : 6);
      void fb;
      keepOut.push(cardLeftCache - 6, pt.top - rb.top, cardLeftCache + cardEl!.offsetWidth + 6, frameTopCache + cardFrame!.offsetHeight + 6);
    }
    if (touring && tourRect) keepOut.push(tourRect.x - 6, tourRect.y - 6, tourRect.x + tourRect.w + 6, tourRect.y + tourRect.h + 6);
    const free = freeRect();
    oxT = (free.l + free.r) / 2 - W / 2;
    oyT = (free.t + free.b) / 2 - H / 2;
    // The words: in the free band under the map.
    const leftEdge = open ? panelRightCache + 16 : 0;
    const left = sheet ? 12 : leftEdge + 6;
    const right = sheet ? W - 12 : W - 118;
    const width = Math.min(right - left, sheet ? 214 : 720);
    const midX = (left + right) / 2;
    const midY = H - (sheet ? 112 : 60);
    words = { ax: midX - W / 2, ay: midY - H / 2, width, tilt: sheet ? 0.55 : 0.86 };
  }

  // ---- projection ---------------------------------------------------------
  // pz is the distance in front of the camera; anything under NEAR is behind
  // or too close and is not drawn.
  let cy = 1, sy = 0, cp = 1, sp = 0;
  function projXYZ(x: number, y: number, z: number): Projected {
    x -= cam.tx; y -= cam.ty; z -= cam.tz;
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const depth = cam.dist - z2;
    const s = focalNow / Math.max(depth, 1);
    return { px: W / 2 + ox + x1 * s, py: H / 2 + oy - y2 * s, pz: depth, ps: s };
  }
  // The same, written into one shared object: for the loops over thousands of
  // stars, where a new object each time keeps the garbage collector busy. The
  // result only lasts until the next call.
  const fastQ: Projected = { px: 0, py: 0, pz: 0, ps: 1 };
  function projFast(x: number, y: number, z: number): Projected {
    x -= cam.tx; y -= cam.ty; z -= cam.tz;
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const depth = cam.dist - z2;
    const s = focalNow / Math.max(depth, 1);
    fastQ.px = W / 2 + ox + x1 * s;
    fastQ.py = H / 2 + oy - y2 * s;
    fastQ.pz = depth;
    fastQ.ps = s;
    return fastQ;
  }
  function project(p: Node) {
    const r = projFast(p.x, p.y, p.z);
    p.px = r.px; p.py = r.py; p.pz = r.pz; p.ps = r.ps;
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

  // ---- sound -----------------------------------------------------------------
  const emit = (name: string, detail: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));
  function setHover(h: Node | null) {
    if (h === hover) return;
    hover = h;
    canvas!.classList.toggle("is-over", !!h);
    emit("mind:hover", { id: h?.id ?? null, kind: h?.type ?? null });
  }
  let flySent = 0, nearSent = -1;

  // ---- sizing -------------------------------------------------------------
  // The canvas buffer is only rebuilt when its pixel size really changes. On a
  // phone the address bar sliding fires many tiny resizes, and rebuilding a
  // full screen buffer on each one is what runs a phone out of graphics
  // memory. Phones also draw at 1.5x, which is plenty on a moving star field.
  function resize() {
    const nextDpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2);
    const w = Math.round(canvas!.clientWidth), h = Math.round(canvas!.clientHeight);
    const pw = Math.round(w * nextDpr), ph = Math.round(h * nextDpr);
    if (pw === canvas!.width && ph === canvas!.height && nextDpr === dpr && w === W && h === H) return;
    const dprChanged = nextDpr !== dpr;
    const reshaped = w !== W || Math.abs(h - H) > 160;
    dpr = nextDpr; W = w; H = h;
    if (canvas!.width !== pw) canvas!.width = pw;
    if (canvas!.height !== ph) canvas!.height = ph;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.imageSmoothingQuality = "high";
    if (dprChanged) {
      atlas.dispose();
      atlas = new LabelAtlas(nextDpr, phone);
    }
    cam.focal = focalFor(W, H);
    updateFrame();
    world?.resize();
    // Resting at home in a window of a new shape: home is somewhere new.
    if (reshaped && nodes.length && autorotate && !selected && !touring) frameToFit();
  }

  // ---- the frame ------------------------------------------------------------
  let world: World | null = null;
  let worldDown = false; // the GPU is gone: draw nothing with it until it returns
  let worldShown = false; // the 3D world is on screen
  let worldA = 0; // its fade in, 0..1
  let flatSky = false; // the plain sky is what the visitor sees
  let needGraph = false;
  let prevCam = { tx: 0, ty: 0, tz: 0, dist: 0, yaw: 0, pitch: 0 };
  let speedS = 0, dollyS = 0;
  let flyAmt = 0;
  let zoomX = 0.5, zoomY = 0.5;
  let focusAmt = 0, focusR = 300;
  const focusNow = { x: 0, y: 0, z: 0, color: "#A78BFA" };
  let waveR = 0, waveAmt = 0;
  let quietS = 1, baseK = 1, litK = 0;
  let wordsAway = false, wordsForm = 0, wordsLevel = 1, wordsDone = false;
  const wordFade = [1, 1, 1, 1, 1, 1, 1, 1];
  let wordFadeAll = 1;
  let ptrX = -1e4, ptrY = -1e4, ptrIn = false, ptrXS = 0, ptrYS = 0, ptrOnS = 0;
  // Reused every frame, so the garbage collector stays quiet.
  const wf = {
    pos: [0, 0, 0], right: [0, 0, 0], up: [0, 0, 0], back: [0, 0, 0],
    zoom: [0.5, 0.5, 0], axes: { ext: 0, op: 0 },
    focus: { x: 0, y: 0, z: 0, color: "#A78BFA", amount: 0, radius: 300, wave: 0, waveAmt: 0 },
    links: [], comets: [], nodes: [],
  } as unknown as WorldFrame;
  const cometViews: WorldComet[] = [];
  const shownFrame: WorldShown = { node: null as unknown as Node, x: 0, y: 0, R: 30, t: 0 };
  let shownNode: Node | null = null;
  let cardT = 0;
  let swayT = 0;
  // A chip or a count in the card that the pointer is on: the links it stands for.
  let linkHot: Node | null = null;
  let kindHot: string | null = null;
  const wordsFrame = { form: 0, level: 1, per: wordFade, ax: 0, ay: 0, width: 600, tilt: 0.8, leanX: 0, leanY: 0, ptrX: 0, ptrY: 0, ptrOn: 0 };

  // Lines: the anchors' lines to the lead kind, plus what the star in hand touches.
  type LinkOut = WorldLink & { a: Node; b: Node; kind: 0 | 1; rgb: string };
  const linkViews: LinkOut[] = [];
  let linkKey = "", linksRev = 0;
  function syncLinks(lead: string) {
    const lit = selected || hover || tourSpot;
    const key = `${graphKey}|${lead}|${lit?.id ?? ""}|${[...hiddenTypes].join()}`;
    if (key === linkKey) return;
    linkKey = key;
    linksRev++;
    litK = 0;
    linkViews.length = 0;
    for (const e of leadEdges(lead)) {
      linkViews.push({ a: e.a, b: e.b, op: 0, width: 1.15, flow: 0.13 + ((e.a.tw + e.b.tw) % 1) * 0.1, seed: (e.a.tw * 7 + e.b.tw * 13) % 1, kind: 0, rgb: e.rgb });
    }
    if (lit) {
      for (const m of related(lit)) {
        linkViews.push({ a: lit, b: m, op: 0, width: 1.7, flow: 0.42, seed: (m.tw * 11) % 1, kind: 1, rgb: rgbOf(mix(mix(lit.color, m.color, 0.5), "#ffffff", 0.25)) });
      }
    }
  }

  // Names: gathered per frame from a pool, nearest and most important first.
  type Label = { text: string; x: number; y: number; size: number; weight: number; color: string; scale: number; a: number; prio: number; focus: boolean; node: Node | null };
  const labelPool: Label[] = [];
  let labelN = 0;
  const pushLabel = (text: string, x: number, y: number, size: number, weight: number, color: string, scale: number, a: number, prio: number, focus: boolean, node: Node | null) => {
    let l = labelPool[labelN];
    if (!l) l = labelPool[labelN] = {} as Label;
    l.text = text; l.x = x; l.y = y; l.size = size; l.weight = weight; l.color = color; l.scale = scale; l.a = a; l.prio = prio; l.focus = focus; l.node = node;
    labelN++;
  };
  const sorted: Label[] = [];
  const taken: number[] = []; // x0, y0, x1, y1 of each name placed
  const planetBoxes: number[] = [];
  const clashes = (x0: number, y0: number, x1: number, y1: number) => {
    for (let i = 0; i < taken.length; i += 4) {
      if (x0 < taken[i + 2] && x1 > taken[i] && y0 < taken[i + 3] && y1 > taken[i + 1]) return true;
    }
    for (let i = 0; i < planetBoxes.length; i += 4) {
      if (x0 < planetBoxes[i + 2] && x1 > planetBoxes[i] && y0 < planetBoxes[i + 3] && y1 > planetBoxes[i + 1]) return true;
    }
    return false;
  };

  function stepCamera(dt: number) {
    if (camTarget) {
      // The tour takes its time: it is showing, not answering.
      const smooth = reduced ? 0.12 : touring ? 0.82 : 0.46;
      const omega = 2 / smooth;
      const x = omega * dt;
      const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      let done = true;
      for (const key of Object.keys(camTarget) as CamKey[]) {
        const target = camTarget[key]!;
        const change = cam[key] - target;
        const v = camV[key] ?? 0;
        const temp = (v + omega * change) * dt;
        camV[key] = (v - omega * temp) * e;
        cam[key] = target + (change + temp) * e;
        const angle = key === "yaw" || key === "pitch";
        if (Math.abs(cam[key] - target) > (angle ? 0.004 : 0.5) || Math.abs(camV[key]!) > (angle ? 0.03 : 2)) done = false;
      }
      if (done) {
        camTarget = null;
        for (const k of Object.keys(camV) as CamKey[]) camV[k] = 0;
      }
    } else if (!pts.size) {
      const k = Math.pow(0.72, dt * 60);
      cam.yaw += vel.yaw; cam.pitch = clamp(cam.pitch + vel.pitch, -1.45, 1.45);
      cam.tx += vel.tx; cam.ty += vel.ty; cam.tz += vel.tz;
      vel.yaw *= k; vel.pitch *= k;
      vel.tx *= k; vel.ty *= k; vel.tz *= k;
    }
    ox = damp(ox, oxT, reduced ? 30 : 3.6, dt);
    oy = damp(oy, oyT, reduced ? 30 : 3.6, dt);
  }

  function render(now: number) {
    if (signal.aborted) return;
    raf = requestAnimationFrame(render);
    if (paused) { last = 0; return; }
    const rawMs = last ? now - last : 16.7;
    const dt = Math.min(0.05, Math.max(0.001, rawMs / 1000));
    last = now;
    time += dt;

    stepCamera(dt);
    // What is in hand for the moment: the pointer's star, or the one the tour is showing.
    const hov = hover ?? tourSpot;
    let moved = needGraph;
    if (bloom < 1) {
      bloom = Math.min(1, bloom + dt / 1.5);
      placeBloom();
      moved = true;
    }
    if (fade < 1) fade = Math.min(1, fade + dt * 2.4);
    idle += dt;
    // At rest the map sways slowly either side of home, so it keeps its depth and its
    // meaning: left is still business, and nothing drifts away from where it was framed.
    if (autorotate && idle > 2.4 && !camTarget && !selected && !touring) {
      swayT += dt;
      cam.yaw = HOME_YAW + SWAY * Math.sin(swayT * 0.11);
    }
    if (touring && tourStep >= 0) {
      // The tour's beats, and a slow turn so the world keeps its depth while it speaks.
      beatLeft -= dt;
      if (beatLeft <= 0) nextBeat();
      if (!reduced) {
        if (camTarget && camTarget.yaw !== undefined) camTarget.yaw += 0.02 * dt;
        else cam.yaw += 0.02 * dt;
      }
    }
    keysFly(dt);

    cy = Math.cos(cam.yaw); sy = Math.sin(cam.yaw);
    cp = Math.cos(cam.pitch); sp = Math.sin(cam.pitch);

    // How fast the view is moving, in view lengths a second, for streaks and sound.
    const trans = Math.hypot(cam.tx - prevCam.tx, cam.ty - prevCam.ty, cam.tz - prevCam.tz) / Math.max(cam.dist, 1) / dt;
    const zoomNow = Math.abs(Math.log(cam.dist / (prevCam.dist || cam.dist))) / dt;
    const angular = (Math.abs(cam.yaw - prevCam.yaw) + Math.abs(cam.pitch - prevCam.pitch)) / dt;
    prevCam.tx = cam.tx; prevCam.ty = cam.ty; prevCam.tz = cam.tz; prevCam.dist = cam.dist; prevCam.yaw = cam.yaw; prevCam.pitch = cam.pitch;
    const speed = trans + zoomNow * 0.9 + angular * 0.55;
    speedS = damp(speedS, speed, speed > speedS ? 14 : 5, dt);
    dollyS = damp(dollyS, trans + zoomNow, trans + zoomNow > dollyS ? 10 : 4.5, dt);
    flyAmt = clamp(speedS / 2.4, 0, 1);
    if (flyAmt < 0.012) flyAmt = 0;
    // The lens opens a little along a flight, so the whole picture feels the speed.
    focalNow = cam.focal * (reduced ? 1 : 1 - 0.16 * clamp(dollyS / 2.6, 0, 1));

    if (Math.abs(flyAmt - flySent) > 0.01 || (flyAmt === 0 && flySent !== 0)) {
      flySent = flyAmt;
      emit("mind:fly", { speed: +flyAmt.toFixed(3) });
    }
    const C = camPos();
    const nearCentre = clamp(1 - (Math.hypot(C[0], C[1], C[2]) - worldR * 0.25) / (worldR * 3), 0, 1);
    if (Math.abs(nearCentre - nearSent) > 0.005) {
      nearSent = nearCentre;
      emit("mind:depth", { near: +nearCentre.toFixed(3) });
    }

    // how far out the camera is: from far away the map is one small bright thing,
    // its stars soften and only the anchors keep their names
    const out = clamp((cam.dist - worldR * 1.4) / (worldR * 2.6), 0, 1);
    // The lead kind shines like the projects: the highest switched on of
    // projects, then case studies, then technologies (repos, then languages
    // on the git map). The kinds under it stay dim, and with a filter on the
    // background steps back so it covers nothing.
    const lead = leadKind();
    const leads = (p: Node) => p.major || p.type === lead;
    const mapA = mapAngle(C);
    quietS = damp(quietS, (hiddenTypes.size ? 0.35 : 1) * (touring ? 0.45 : 1), 4, dt);

    for (const p of nodes) project(p);
    moveComets(dt, C, mapA);

    const hoverSet = hov ? new Set(related(hov).map((m) => m.id)) : null;
    const selSet = selected ? new Set(related(selected).map((m) => m.id)) : null;

    // The small stars come forward as the camera nears them; filtered ones go.
    const revealR = worldR * 1.5;
    const ease = 1 - Math.pow(0.88, dt * 60);
    for (const p of nodes) {
      const want = !shown(p)
        ? 0
        : leads(p) || p === hov || p === selected || hoverSet?.has(p.id) || selSet?.has(p.id)
          ? 1
          : clamp(1.35 - Math.hypot(p.x - C[0], p.y - C[1], p.z - C[2]) / revealR, 0.32, 1);
      p.reveal = lerp(p.reveal, want, ease);
    }

    // Every star's light and size this frame, and its name.
    labelN = 0;
    atlas.begin();
    const focEase = 1 - Math.exp(-dt * 9);
    const baseScale = focalNow / cam.dist;
    const ptrNear = ptrIn && !coarse && !pts.size;
    for (const p of nodes) {
      p.foc = lerp(p.foc, p === hov || p === selected || p === linkHot ? 1 : 0, focEase);
      const nearFade = clamp((p.pz - NEAR) / NEAR, 0, 1);
      if (p.pz < NEAR || p.reveal < 0.02) { p.op = 0; p.R = 0; continue; }
      const big = leads(p);
      p.big = big;
      const promoted = big && !p.major;
      const planet = PLANET.has(p.type);
      const vr = p.r * (promoted ? 1.6 : p.type === "repo" ? 1.2 : 1);
      const lift = p === selected ? 1.1 : p === hov ? 1.05 : 1;
      p.vr = vr * lift;
      const R = clamp(p.vr * p.ps * (planet ? PLANET_SCALE : 1), 0.6, 400);
      p.R = R;
      const depthFade = clamp((p.ps / baseScale) * 0.6 + 0.5, 0.6, 1.25);
      const dim =
        (hov && hov !== p && !hoverSet?.has(p.id)) ||
        (selected && selected !== p && !selSet?.has(p.id) && !hov) ||
        (!selected && !hov && tourKinds !== null && !tourKinds.has(p.type));
      const focus = p === hov || p === selected;
      const hotHue = p.type === "repo" || p.type === "tech" || p.type === "language";
      const baseLum = promoted ? LUM.project * (hotHue ? 0.55 : 1) : LUM[p.type] ?? 0.7;
      const lum = p === selected ? Math.min(1.45, baseLum * 1.3) : p === hov ? Math.min(1.35, baseLum * 1.15) : baseLum;
      p.op = (dim ? (touring ? 0.05 : selected && !hov ? 0.12 : 0.3) : 1) * depthFade * lum * nearFade * p.reveal;

      // Names follow the same order as the lines: the anchors and the lead
      // kind always, crisp; any other star only when it, or a star it is
      // joined to, is hovered or open. Nothing faint in between.
      if (p.px < -160 || p.px > W + 160 || p.py < -160 || p.py > H + 160) continue;
      const near1 = hov === p || hoverSet?.has(p.id) || selSet?.has(p.id);
      const far1 = planet ? 1 : clamp(1 - (out - 0.25) * 1.8, 0, 1);
      const lop = focus ? 1 : near1 ? 0.92 : big ? 0.92 * far1 : 0;
      if (lop > 0.05 && !(dim && !focus) && R > 1.1) {
        // Names have depth too: a near star's name is larger than a far one's, and a
        // name under the pointer lifts a little toward it.
        let scale = clamp(0.92 + (p.ps / baseScale - 1) * 0.55, 0.86, 1.12);
        let a = Math.min(1, lop * Math.max(p.reveal, near1 ? 1 : 0));
        if (ptrNear) {
          const dx = p.px - ptrX, dy = p.py - ptrY;
          const prox = 1 - Math.min(1, (dx * dx + dy * dy) / 14400);
          scale *= 1 + prox * 0.07;
          a = Math.min(1, a + prox * 0.12);
        }
        const yy = p.py + Math.max(R * (planet ? 2.2 : 1.4), 7) + 3;
        // Not under the nav's glass, where a name would read through its own words.
        if (yy < 80) continue;
        // The heavier stars speak first; when the view is wide the small names wait.
        const prio = (focus || p === linkHot ? 1e6 : 0) + (planet ? 5000 : 0) + (big ? 1000 : 0) + p.ps * 60 + p.r * 14 + (p.labelOn ? 900 : 0);
        pushLabel(trim(p.label, focus ? 44 : 22), p.px, yy, focus ? 15 : planet ? 13 : phone ? 11.5 : 12, focus || planet ? 600 : 500, NAME_COLOR, focus ? 1 : scale, a, prio, focus, p);
      }
    }

    // The axes step back while a star is open, so its names read clearly.
    const axisVis = tourAxes ? 1.2 : touring ? 0.08 : (1 - out * 0.85) * (selected ? 0.35 : 1);
    const ext = 640 * spread;
    if (hasQuadrants && showAxisLabels && (!selected || tourAxes) && axisVis > 0.05) {
      for (const ax of AXES) {
        const e = projFast(ax.at[0] * ext * AXIS_AT, ax.at[1] * ext * AXIS_AT, ax.at[2] * ext * AXIS_AT);
        if (e.pz < NEAR) continue;
        // Whole on screen, and clear of the nav and the panel, or not at all.
        const half = ax.label.length * 3.3;
        const lx = clamp(e.px, half + 8, W - half - 8);
        if (e.py < 92 || e.py > H - 28 || lx - half < panelRightCache + 8) continue;
        const onPlanet = nodes.find((n) => PLANET.has(n.type) && Math.abs(n.px - lx) < half + n.R * 2.8 && Math.abs(n.py - e.py) < 20 + n.R * 2.8);
        if (!tourAxes && onPlanet) continue;
        // In their own tour step they win, and stand clear of a planet by going over it.
        const ay = onPlanet ? onPlanet.py - onPlanet.R * 2.6 - 26 : e.py - 8;
        // On the map they yield to any star's name.
        pushLabel(ax.label, lx, ay, 13, 600, AXIS_COLOR, 1, Math.min(1, 0.9 * axisVis), tourAxes ? 2e6 : 700 + (e.ps * 10), tourAxes, null);
      }
    }

    syncLinks(lead);
    baseK = damp(baseK, selected ? 0 : hov ? 0.46 : 1, 7, dt);
    litK = Math.min(1, litK + dt * 5);
    const hotOn = !!linkHot || !!kindHot;
    for (const l of linkViews) {
      if (l.kind === 0) {
        const vis = Math.min(l.a.reveal, l.b.reveal);
        const inTour = !tourKinds || (tourKinds.has(l.a.type) && tourKinds.has(l.b.type));
        l.op = baseK * 0.7 * (vis < 0.02 ? 0 : vis) * (inTour ? 1 : 0.05);
      } else {
        // A chip or a count in the card, under the pointer, lights its own links.
        const isHot = linkHot ? l.b === linkHot : kindHot ? l.b.type === kindHot : false;
        l.op = litK * 0.9 * Math.min(1, l.b.reveal + 0.3) * (hotOn ? (isHot ? 1.7 : 0.26) : 1);
        l.width = isHot ? 2.5 : 1.7;
        l.flow = isHot ? 0.9 : 0.42;
      }
    }

    // ---- the plain drawing, on the top canvas
    ctx!.clearRect(0, 0, W, H);
    const flatA = worldShown ? clamp(1 - worldA * 1.4, 0, 1) : 1;
    if (flatA > 0.004) {
      const near = clamp((worldR * 3.4 - cam.dist) / (worldR * 3), 0, 1);
      if (flatSky) {
        const T: V3 = [cam.tx, cam.ty, cam.tz];
        const mid = projXYZ(0, 0, 0);
        const mapR = mid.pz > 0 ? Math.min(Math.max(W, H) * 3, worldR * 1.12 * mid.ps) : Math.max(W, H) * 3;
        flat.drawSky({ W, H, time, fade: fade * flatA, worldR, box: worldR * 5, dustQ: quietS * (touring ? 0.15 : 0.32), speed: speedS * 0.7, cam: T, proj: projXYZ, fast: projFast, mapX: mid.px, mapY: mid.py, mapR });
        for (const c of comets) {
          const h = projXYZ(c.p[0], c.p[1], c.p[2]);
          if (Math.hypot(h.px - mid.px, h.py - mid.py) > mapR * 1.15) flat.drawComet(c, fade * flatA, projXYZ);
        }
      }
      for (const l of linkViews) {
        if (l.a.pz < NEAR || l.b.pz < NEAR) continue;
        flat.line(l.a.px, l.a.py, l.b.px, l.b.py, l.rgb, l.op * fade * flatA, l.kind ? 1.5 : 1.1);
      }
      ctx!.globalCompositeOperation = "lighter";
      for (const p of nodes) {
        // Until the world arrives only the bright stars are drawn: the phone has better
        // things to do than glows nobody will see for long.
        if (!flatSky && !p.big && p.foc < 0.05) continue;
        const op0 = p.op;
        p.op = op0 * fade * flatA;
        flat.drawStar(p, W, H, near, out);
        p.op = op0;
      }
      ctx!.globalCompositeOperation = "source-over";
    }

    // ---- names, on top of everything and never on each other
    sorted.length = 0;
    for (let i = 0; i < labelN; i++) sorted.push(labelPool[i]);
    sorted.sort((a, b) => b.prio - a.prio);
    taken.length = 0;
    // A name does not sit on a planet.
    planetBoxes.length = 0;
    for (const p of nodes) {
      p.labelOn = false;
      if (PLANET.has(p.type) && p.pz > NEAR && p.op > 0.3) planetBoxes.push(p.px - p.R * 1.2, p.py - p.R * 1.2, p.px + p.R * 1.2, p.py + p.R * 1.2);
    }
    for (const v of keepOut) planetBoxes.push(v);
    const still = speedS < 0.04;
    for (const l of sorted) {
      const s = atlas.get(l.text, l.size, l.weight, l.color, l.focus);
      if (!s) continue;
      const w = s.w * l.scale;
      const h = s.h * l.scale;
      const pad = s.pad * l.scale;
      // A name stays whole on screen while its star is.
      const lx = l.x > 0 && l.x < W ? clamp(l.x, w / 2 - pad + 5, W - w / 2 + pad - 5) : l.x;
      const x0 = lx - w / 2 + pad - 3, x1 = lx + w / 2 - pad + 3;
      const textH = h - pad * 2;
      // Under its star first; if that is taken, over it; if both are, it waits.
      let top = l.y;
      let clash = false;
      if (!l.focus) {
        clash = clashes(x0, l.y - 1, x1, l.y + textH + 2);
        if (clash && l.node) {
          const above = l.node.py - (l.y - l.node.py) - textH;
          if (!clashes(x0, above - 1, x1, above + textH + 2)) {
            top = above;
            clash = false;
          }
        }
      }
      if (clash) {
        if (l.node) l.node.labelA = 0;
        continue;
      }
      const y0 = top - 1, y1 = top + textH + 2;
      taken.push(x0, y0, x1, y1);
      let fadeIn = 1;
      if (l.node) {
        l.node.labelOn = true;
        l.node.labelA = Math.min(1, l.node.labelA + dt * 6);
        fadeIn = l.node.labelA;
      }
      let dx = lx - w / 2;
      let dy = top - pad;
      // At rest each name lands on whole device pixels, so it is as sharp as it can be.
      if (still && l.scale === 1) {
        dx = Math.round(dx * dpr) / dpr;
        dy = Math.round(dy * dpr) / dpr;
      }
      ctx!.globalAlpha = Math.min(1, l.a * fadeIn * fade);
      ctx!.drawImage(atlas.canvas, s.sx, s.sy, s.sw, s.sh, dx, dy, w, h);
    }
    ctx!.globalAlpha = 1;

    // ---- the 3D world
    if (world && !worldDown) {
      if (needGraph) {
        world.setGraph(nodes, worldR);
        needGraph = false;
        moved = true;
      }
      // The chosen star's light on the world, and the wave it sends out.
      const lit = selected || (hov && !selected ? hov : null);
      if (lit) {
        focusNow.x = lit.x; focusNow.y = lit.y; focusNow.z = lit.z;
        focusNow.color = lit.color;
      }
      focusAmt = damp(focusAmt, selected ? 1 : hov ? 0.32 : 0, reduced ? 12 : selected ? 2.6 : 5, dt);
      focusR = damp(focusR, worldR * (selected ? 0.55 : 0.34), 4, dt);
      if (waveAmt > 0.001) {
        waveR += dt * worldR * 1.5;
        waveAmt = Math.max(0, 1 - waveR / (worldR * 2.6));
        waveAmt *= waveAmt;
      }

      // The words: gather at rest, blow apart as soon as the visitor moves.
      let wordsOut: typeof wordsFrame | null = null;
      if (worldShown && !touring) {
        if (wordsAway && !selected && idle > 8 && !camTarget && Math.hypot(cam.tx, cam.ty, cam.tz) < worldR * 0.1 && cam.dist < fitDist() * 1.35 && cam.dist > fitDist() * 0.7) wordsAway = false;
      }
      const wantWords = worldShown && worldA > 0.92 && wordsFit() && !sheetOpen && !touring && !wordsAway && !selected ? 1 : 0;
      wordsForm = wantWords ? Math.min(1, wordsForm + dt / (reduced ? 0.6 : 2.4)) : Math.max(0, wordsForm - dt / (reduced ? 0.2 : 0.5));
      wordsLevel = damp(wordsLevel, hov ? 0.42 : hiddenTypes.size ? 0.7 : 1, 7, dt);
      if (wordsForm > 0.002) {
        // The words give way if a star or a name comes near any of them.
        const boxes = world.wordBoxes();
        const cx0 = W / 2 + ox, cy0 = H / 2 + oy;
        // The band is fixed on screen, whatever the view's centre is doing.
        const ax = words.ax - ox, ay = words.ay - oy;
        let blockedAny = false;
        for (let i = 0; i < boxes.length && i < wordFade.length && !blockedAny; i++) {
          const b = boxes[i];
          const zA = 1 + (b.y1 * words.width * Math.sin(words.tilt)) / focalNow;
          const zB = 1 + (b.y0 * words.width * Math.sin(words.tilt)) / focalNow;
          const x0 = cx0 + Math.min((ax + b.x0 * words.width) / zA, (ax + b.x0 * words.width) / zB) - 8;
          const x1 = cx0 + Math.max((ax + b.x1 * words.width) / zA, (ax + b.x1 * words.width) / zB) + 8;
          const y0 = cy0 + (ay - b.y1 * words.width * Math.cos(words.tilt)) / zA - 8;
          const y1 = cy0 + (ay - b.y0 * words.width * Math.cos(words.tilt)) / zB + 8;
          let blocked = false;
          for (let k = 0; k < nodes.length && !blocked; k++) {
            const p = nodes[k];
            if (p.op < 0.3 || p.pz < NEAR) continue;
            const m = p.R * (PLANET.has(p.type) ? 2.6 : 2);
            if (p.px > x0 - m && p.px < x1 + m && p.py > y0 - m && p.py < y1 + m) blocked = true;
          }
          for (let k = 0; k < taken.length && !blocked; k += 4) {
            if (x0 < taken[k + 2] && x1 > taken[k] && y0 < taken[k + 3] && y1 > taken[k + 1]) blocked = true;
          }
          if (blocked) blockedAny = true;
        }
        // The phrase goes as one: a title with a hole in it reads as a glitch.
        wordFadeAll = damp(wordFadeAll, blockedAny ? 0 : 1, blockedAny ? 9 : 2.2, dt);
        wordFade.fill(wordFadeAll);
        // Follows the pointer softly, and leans toward it a little.
        const pw = words.width;
        const lx = (ptrX - cx0 - ax) / pw;
        const ly = -(ptrY - cy0 - ay) / Math.cos(words.tilt) / pw;
        const insideish = ptrIn && !coarse && Math.abs(lx) < 0.65 && Math.abs(ly) < 0.28;
        if (insideish && ptrOnS < 0.02) { ptrXS = lx; ptrYS = ly; }
        ptrXS = damp(ptrXS, lx, 9, dt);
        ptrYS = damp(ptrYS, ly, 9, dt);
        ptrOnS = damp(ptrOnS, insideish && !reduced ? 1 : 0, 6, dt);
        wordsFrame.form = wordsForm;
        wordsFrame.level = wordsLevel * 0.9;
        wordsFrame.ax = ax;
        wordsFrame.ay = ay;
        wordsFrame.width = words.width;
        wordsFrame.tilt = words.tilt;
        const nx = ptrIn && !reduced && !coarse ? clamp((ptrX - W / 2) / (W / 2), -1, 1) : 0;
        const ny = ptrIn && !reduced && !coarse ? clamp((ptrY - H / 2) / (H / 2), -1, 1) : 0;
        wordsFrame.leanY = damp(wordsFrame.leanY, nx * 0.05 + (reduced ? 0 : Math.sin(time * 0.17) * 0.012), 3, dt);
        wordsFrame.leanX = damp(wordsFrame.leanX, -ny * 0.035, 3, dt);
        wordsFrame.ptrX = ptrXS;
        wordsFrame.ptrY = ptrYS;
        wordsFrame.ptrOn = ptrOnS;
        wordsOut = wordsFrame;
        // In the wide layout the title lives out here once it has gathered, so the
        // panel does not say it twice.
        if (!wordsDone && wordsForm > 0.55 && W >= 641) {
          wordsDone = true;
          root!.classList.add("words-on");
        }
      }

      // Zoom blur: from the view's centre, or the pointer when scrolling toward it.
      const dollyZ = clamp((dollyS - 0.5) / 4, 0, 1);
      const zx = wheelAt > 0 ? (wheelX + 0) / Math.max(1, W) : (W / 2 + ox) / Math.max(1, W);
      const zy = wheelAt > 0 ? 1 - wheelY / Math.max(1, H) : 1 - (H / 2 + oy) / Math.max(1, H);
      zoomX = damp(zoomX, zx, 8, dt);
      zoomY = damp(zoomY, zy, 8, dt);
      wheelAt = Math.max(0, wheelAt - dt);

      const b = axes();
      wf.rawMs = rawMs;
      wf.dt = dt;
      wf.time = time;
      wf.moving = flyAmt > 0.02;
      wf.pos[0] = C[0]; wf.pos[1] = C[1]; wf.pos[2] = C[2];
      wf.right[0] = b.right[0]; wf.right[1] = b.right[1]; wf.right[2] = b.right[2];
      wf.up[0] = b.up[0]; wf.up[1] = b.up[1]; wf.up[2] = b.up[2];
      wf.back[0] = b.back[0]; wf.back[1] = b.back[1]; wf.back[2] = b.back[2];
      wf.focal = focalNow;
      wf.ox = ox;
      wf.oy = oy;
      wf.dist = cam.dist;
      wf.worldR = worldR;
      wf.out = out;
      wf.quiet = quietS;
      wf.fly = flyAmt;
      wf.zoom[0] = zoomX; wf.zoom[1] = zoomY; wf.zoom[2] = dollyZ * 0.085;
      wf.nodes = nodes;
      wf.moved = moved;
      wf.mapA = mapA;
      wf.mapFade = MAP_FADE;
      // The body over the card: carried there from its star, and back when it closes.
      if (shownNode) {
        cardT = selected === shownNode ? Math.min(1, cardT + dt / (reduced ? 0.15 : 0.75)) : Math.max(0, cardT - dt / 0.28);
        if (cardT <= 0 && selected !== shownNode) shownNode = null;
      }
      if (shownNode) {
        const e = 1 - (1 - cardT) ** 3;
        shownFrame.node = shownNode;
        shownFrame.x = shownAt.x;
        shownFrame.y = shownAt.y;
        shownFrame.R = shownAt.R;
        shownFrame.t = e;
        wf.shown = shownFrame;
      } else wf.shown = null;
      wf.links = linkViews;
      wf.linksRev = linksRev;
      wf.axes.ext = hasQuadrants ? ext : 0;
      wf.axes.op = hasQuadrants ? axisVis * 0.55 * fade : 0;
      cometViews.length = 0;
      for (const c of comets) cometViews.push(c.view);
      wf.comets = cometViews;
      const fo = wf.focus;
      fo.x = focusNow.x; fo.y = focusNow.y; fo.z = focusNow.z; fo.color = focusNow.color;
      fo.amount = focusAmt; fo.radius = focusR; fo.wave = waveR; fo.waveAmt = waveAmt;
      wf.words = wordsOut;
      wf.fade = fade;
      world.frame(wf);
      if (worldShown) worldA = Math.min(1, worldA + dt / (reduced ? 0.3 : 1.1));
      else showWorld();
    }
  }

  // ---- interaction --------------------------------------------------------
  function pick(sx: number, sy: number): Node | null {
    let best: Node | null = null, bestD = Infinity;
    for (const p of nodes) {
      if (p.pz < NEAR || p.reveal < 0.3) continue;
      const rr = PLANET.has(p.type) ? Math.max(clamp(p.R, 0.6, 200) * 1.25 + 12, 16) : Math.max(clamp(p.r * p.ps, 0.6, 140) * 1.4 + 12, 16);
      const d = (p.px - sx) ** 2 + (p.py - sy) ** 2;
      if (d < rr * rr && d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  const wake = () => {
    takeOver();
    idle = 0;
    autorotate = false;
    camTarget = null;
    wordsAway = true;
    for (const k of Object.keys(camV) as CamKey[]) camV[k] = 0;
  };
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
    const s = focalNow / Math.max(cam.dist, 1);
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
    const s = focalNow / Math.max(before, 1);
    const ox0 = (sx - (W / 2 + ox)) / s, oy0 = -(sy - (H / 2 + oy)) / s;
    cam.tx += (right[0] * ox0 + up[0] * oy0) * k;
    cam.ty += (right[1] * ox0 + up[1] * oy0) * k;
    cam.tz += (right[2] * ox0 + up[2] * oy0) * k;
    cam.dist = after;
  };

  // Pointers on the map: one turns it (or moves it with the right button or
  // shift), two pinch to fly and slide to move.
  const pts = new Map<number, { x: number; y: number }>();
  let moved = false, panMode = false, lastPinch = 0, lastMid = { x: 0, y: 0 };
  let wheelAt = 0, wheelX = 0, wheelY = 0;
  canvas.addEventListener("contextmenu", (e) => e.preventDefault(), on);
  canvas.addEventListener("pointerdown", (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-panning");
    // Any press: the tour hands over where it is, and the words step back.
    takeOver();
    wordsAway = true;
    idle = 0;
    autorotate = false;
    camTarget = null;
    for (const k of Object.keys(camV) as CamKey[]) camV[k] = 0;
    vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
    if (pts.size === 1) {
      moved = false;
      panMode = e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
    } else if (pts.size === 2) {
      moved = true;
      wordsAway = true;
      const [a, b] = [...pts.values()];
      lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
      lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }, on);
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    ptrX = e.clientX - rect.left;
    ptrY = e.clientY - rect.top;
    ptrIn = true;
    const prev = pts.get(e.pointerId);
    if (!prev) {
      setHover(pick(ptrX, ptrY));
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
      idle = 0;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) { moved = true; wordsAway = true; }
    idle = 0;
    if (panMode) pan(dx, dy); else turn(dx, dy);
  }, on);
  canvas.addEventListener("pointerleave", () => { ptrIn = false; setHover(null); }, on);
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
    if (e.pointerType !== "mouse") { ptrIn = false; setHover(null); }
    idle = 0;
  };
  canvas.addEventListener("pointerup", release, on);
  canvas.addEventListener("pointercancel", release, on);

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    wake();
    const rect = canvas.getBoundingClientRect();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    wheelX = e.clientX - rect.left;
    wheelY = e.clientY - rect.top;
    wheelAt = 0.35;
    flyToward(Math.exp(clamp(delta, -120, 120) * 0.0018), wheelX, wheelY);
  }, { passive: false, signal });

  // Keys fly the camera: W A S D or arrows, R and F up and down, + and - zoom.
  const keys = new Set<string>();
  const typing = () => {
    const a = document.activeElement as HTMLElement | null;
    return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
  };
  window.addEventListener("keydown", (e) => {
    if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "escape") { if (tourStep >= 0) endTour(true); else select(null); return; }
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
    idle = 0;
  }

  // Selecting a star flies to it and opens its card. Its light goes out through
  // the world once, and from then on it is the light the world is seen by.
  function select(n: Node | null) {
    const changed = n !== selected;
    selected = n;
    if (changed) {
      emit("mind:focus", { id: n?.id ?? null, kind: n?.type ?? null });
      linkHot = null;
      kindHot = null;
    }
    if (!n) { closeCard(); updateFrame(); return; }
    wordsAway = true;
    // on a phone the card needs the room the panel takes
    if (phone) setFolded(true);
    openCard(n);
    updateFrame();
    // The star and its connections, inside one sphere. The planets sit out at the
    // corners of the map, so they ask for less room: their lines may run a little
    // past the edge rather than shrink the star to a dot.
    const group = [n, ...related(n)];
    const inner = group.filter((m) => m === n || !PLANET.has(m.type));
    const core = inner.length > 1 ? inner : group;
    let lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    for (const m of core) {
      lo = [Math.min(lo[0], m.x), Math.min(lo[1], m.y), Math.min(lo[2], m.z)];
      hi = [Math.max(hi[0], m.x), Math.max(hi[1], m.y), Math.max(hi[2], m.z)];
    }
    let c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    // A planet sits at the map's corner, so its stars pull the middle away from it.
    // Meet halfway, so the one that was opened is never behind the card.
    if (PLANET.has(n.type)) c = [(c[0] + n.x) / 2, (c[1] + n.y) / 2, (c[2] + n.z) / 2];
    let R = 60 * spread;
    for (const m of group) {
      const d = Math.hypot(m.x - c[0], m.y - c[1], m.z - c[2]);
      R = Math.max(R, (PLANET.has(m.type) && m !== n ? d * 0.6 : d) + 30 * spread);
    }
    // the open space, wherever the card and the tour have left it
    const free = freeRect();
    const half = Math.max(90, (Math.min(free.r - free.l, free.b - free.t) / 2) * 0.86);
    const dist = clamp((cam.focal * R) / half + R * 0.6, minDist(), maxDist());
    flyTo(touring ? { tx: c[0], ty: c[1], tz: c[2], dist, yaw: cam.yaw + 0.16 } : { tx: c[0], ty: c[1], tz: c[2], dist });
    vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
    autorotate = false;
    if (changed && !reduced) { waveR = 0; waveAmt = 1; }
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
    // The real body flies up to the card, unless it is the same one.
    if (shownNode !== n) {
      shownNode = n;
      cardT = 0;
    }
    const kinds: [string, string, string][] = graphKey === "repo"
      ? [["repo", "Repositories", "repository"], ["language", "Languages", "language"], ["category", "Stacks", "stack"]]
      : [["project", "Projects", "project"], ["post", "Case studies", "case study"], ["tech", "Technologies", "technology"]];
    const counts = kinds.map(([t, label, one]) => ({ type: t, label, one, value: neighbours.filter((m) => m.type === t).length }));
    const plural = (k: { one: string; value: number }) =>
      `${k.value} ${k.value === 1 ? k.one : k.one === "technology" ? "technologies" : k.one === "case study" ? "case studies" : k.one === "repository" ? "repositories" : k.one + "s"}`;
    const linked = counts.filter((k) => k.value > 0);
    const connected = linked.length
      ? `<div class="mc-count"><span class="mc-label">Connected to</span><div class="mc-count-row">${linked
          .map((k) => {
            // One light per star it touches, coming on as its link lights on the map.
            let lit = 0;
            const dots = Array.from({ length: Math.min(k.value, 28) }, () => `<i style="--d:${lit++}"></i>`).join("");
            return `<span class="mc-count-item" data-kind="${k.type}" style="--kc:${TYPE_TINT[k.type] ?? n.color}"><span class="mc-count-top"><b>${k.value}</b> ${esc(plural(k).replace(/^\d+ /, ""))}</span><span class="mc-dots" aria-hidden="true">${dots}</span></span>`;
          })
          .join("")}</div></div>`
      : "";
    const cls = [kind, n.meta].filter(Boolean).join(" · ");
    const hop = [...neighbours]
      .sort((a, b) => Number(b.major) - Number(a.major) || b.weight - a.weight)
      .slice(0, 9);
    cardEl.style.setProperty("--nc", n.color);
    cardEl.style.setProperty("--nc-rgb", rgbOf(n.color));
    cardEl.dataset.kind = n.type;
    const blurb = (n.blurb || "").trim();
    // A chip whose name is a star this one touches lights that link.
    const byLabel = new Map(neighbours.map((m) => [m.label.toLowerCase(), m]));
    const chip = (c: string) => {
      const m = byLabel.get(c.toLowerCase());
      return m ? `<span class="mc-chip" data-lit="${esc(m.id)}" style="--hc:${esc(m.color)}">${esc(c)}</span>` : `<span class="mc-chip">${esc(c)}</span>`;
    };
    cardOrb?.classList.toggle("is-planet", PLANET.has(n.type));
    cardBody.innerHTML = `
      <header class="mc-head">
        <div class="mc-id">
          <p class="mc-class">${esc(cls)}</p>
          <h2 class="mc-name" id="mind-card-name">${esc(n.label)}</h2>
        </div>
      </header>
      <div class="mc-scroll">
      ${blurb ? `<p class="mc-bio">${esc(blurb)}</p>` : ""}
      ${connected}
      <div class="mc-more"${(n.chips || []).length || hop.length ? "" : " hidden"}>
        ${(n.chips || []).length ? `<div class="mc-sec"><p class="mc-label">Built with</p><div class="mc-chips">${n.chips!.slice(0, 10).map(chip).join("")}</div></div>` : ""}
        ${hop.length ? `<div class="mc-sec"><p class="mc-label">Nearby stars</p><div class="mc-chips">${hop
          .map((m) => `<button type="button" class="mc-hop" data-hop="${esc(m.id)}" style="--hc:${esc(m.color)}">${esc(trim(m.label, 26))}</button>`)
          .join("")}</div></div>` : ""}
      </div>
      </div>
      ${linkList.length ? `<div class="mc-actions">${linkList
        .map((l) => {
          const ext = l.url.startsWith("http");
          return `<a class="mc-btn" href="${esc(l.url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)} ${ARROW}</a>`;
        })
        .join("")}</div>` : ""}`;
    const fresh = cardEl.hidden;
    cardEl.hidden = false;
    // It arrives from the star's place in space, with depth, and its light sweeps down.
    cardEl.classList.remove("is-in");
    void cardEl.offsetWidth;
    cardEl.classList.add("is-in");
    cardFrame?.getAnimations().forEach((a) => a.cancel());
    if (!reduced && cardFrame) {
      const r = cardFrame.getBoundingClientRect();
      const rb = root!.getBoundingClientRect();
      const dx = clamp(n.px + rb.left - (r.left + r.width / 2), -W, W);
      const dy = clamp(n.py + rb.top - (r.top + r.height / 2), -H, H);
      const start = fresh
        ? `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px) scale(0.22) rotateY(${dx < 0 ? 22 : -22}deg)`
        : `translateY(8px) scale(0.985)`;
      cardFrame.animate([{ opacity: fresh ? 0 : 0.4, transform: start }, { opacity: 1, transform: "none" }], { duration: fresh ? 620 : 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    }
  }
  function closeCard() {
    if (!cardEl) return;
    cardEl.classList.remove("is-in");
    cardEl.hidden = true;
  }
  cardBody?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-hop]");
    if (!b) return;
    takeOver();
    const n = byId.get(b.dataset.hop!);
    if (n) select(n);
  }, on);
  // What is under the pointer in the card lights its link on the map.
  const lightFrom = (t: EventTarget | null) => {
    const el = (t as HTMLElement | null)?.closest?.<HTMLElement>("[data-hop], [data-lit], [data-kind]");
    const id = el?.dataset.hop ?? el?.dataset.lit;
    linkHot = id ? byId.get(id) ?? null : null;
    kindHot = el?.dataset.kind ?? null;
  };
  cardBody?.addEventListener("pointerover", (e) => { if (e.pointerType === "mouse") lightFrom(e.target); }, on);
  cardBody?.addEventListener("pointerleave", () => { linkHot = null; kindHot = null; }, on);
  cardBody?.addEventListener("focusin", (e) => lightFrom(e.target), on);
  cardBody?.addEventListener("focusout", () => { linkHot = null; kindHot = null; }, on);
  cardClose?.addEventListener("click", () => select(null), on);
  // The card leans a little toward the pointer, and its heading floats over it.
  if (cardFrame && !coarse && !reduced) {
    let queued = false, rx = 0, ry = 0;
    cardFrame.addEventListener("pointermove", (e) => {
      const r = cardFrame.getBoundingClientRect();
      ry = ((e.clientX - r.left) / r.width - 0.5) * 2;
      rx = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        cardFrame.style.setProperty("--ry", `${(ry * 2.2).toFixed(2)}deg`);
        cardFrame.style.setProperty("--rx", `${(-rx * 1.8).toFixed(2)}deg`);
        cardFrame.style.setProperty("--hx", `${(ry * 3).toFixed(1)}px`);
        cardFrame.style.setProperty("--hy", `${(rx * 2).toFixed(1)}px`);
      });
    }, on);
    cardFrame.addEventListener("pointerleave", () => {
      for (const v of ["--rx", "--ry", "--hx", "--hy"]) cardFrame.style.removeProperty(v);
    }, on);
  }

  // ---- panel --------------------------------------------------------------
  // On a thin or short window the panel starts folded to its top row, so it
  // does not sit on top of the map.
  const foldBtn = panel.querySelector<HTMLButtonElement>("[data-mind-fold]");
  function setFolded(folded: boolean) {
    const was = panel!.classList.contains("is-folded");
    panel!.classList.toggle("is-folded", folded);
    if (was !== folded && W) updateFrame();
    if (!foldBtn) return;
    const label = folded ? "Show panel" : "Hide panel";
    foldBtn.setAttribute("aria-expanded", String(!folded));
    foldBtn.setAttribute("aria-label", label);
    foldBtn.title = label;
  }
  foldBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setFolded(!panel.classList.contains("is-folded"));
  }, on);
  // Folded, the whole pill opens it.
  panel.addEventListener("click", () => {
    if (panel.classList.contains("is-folded")) setFolded(false);
  }, on);
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
    takeOver();
    const type = b.dataset.type!;
    setKind(type, hiddenTypes.has(type));
    if (selected) select(shown(selected) ? selected : null);
  }, on);
  function setKind(type: string, isOn: boolean) {
    if (isOn) hiddenTypes.delete(type); else hiddenTypes.add(type);
    legendEl.querySelector(`[data-type="${type}"]`)?.setAttribute("aria-pressed", String(isOn));
    relCache = new Map();
    emit("mind:filter", { kind: type, on: isOn });
    if (hover && !shown(hover)) setHover(null);
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      takeOver();
      const key = btn.dataset.mode!;
      modeBtns.forEach((b) => {
        const isIt = b === btn;
        b.classList.toggle("is-active", isIt);
        b.setAttribute("aria-selected", String(isIt));
      });
      wordsAway = true;
      idle = 0;
      loadGraph(key);
    }, on);
  });
  resetBtn?.addEventListener("click", () => {
    takeOver();
    select(null);
    vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
    updateFrame();
    frameToFit();
    autorotate = !reduced;
    idle = 0;
  }, on);

  // ---- the tour -------------------------------------------------------------
  // A guided flight. The words are a few short steps, and as each one speaks the
  // camera flies to what it is about: wide at first, on to each planet, to a project
  // star with its links lit, along a link to the next, then back to read the whole.
  // The site is static, so "first visit" is remembered in this browser; the Tour
  // button replays it any time. Next, Back and Skip stay. Escape leaves. Any input on
  // the map takes over at once, wherever the camera has got to.
  const TOUR_KEY = "mind-tour-v1";
  const tourEl = document.querySelector<HTMLElement>("[data-mind-tour]");
  const tourOpen = document.querySelector<HTMLButtonElement>("[data-mind-tour-open]");
  let tourStep = -1;
  let tourWasFolded = false;
  let tourSpot: Node | null = null;
  let beatI = 0, beatLeft = Infinity;
  let tourHidden: string[] = [];
  const visited = new Set<string>();
  type Beat = { hold: number; go: () => void };
  type TourStep = { title: string; text: string; target?: string; panel: boolean; kinds: string[] | null; axes: boolean; beats: Beat[]; loop?: boolean };
  // A body the tour is showing: its links light, the music hears of it.
  const setSpot = (n: Node | null) => {
    if (n === tourSpot) return;
    tourSpot = n;
    emit("mind:focus", { id: n?.id ?? null, kind: n?.type ?? null });
    if (n) { waveR = 0; waveAmt = reduced ? 0 : 0.6; }
  };
  const wide = (zoom = 1, yaw = HOME_YAW, pitch = HOME_PITCH) => {
    setSpot(null);
    if (selected) select(null);
    flyTo({ tx: 0, ty: 0, tz: 0, yaw, pitch, dist: fitIn(freeRect(), yaw, pitch, 0.1) * zoom });
    vel.yaw = vel.pitch = vel.tx = vel.ty = vel.tz = 0;
  };
  // From outside the map looking back through it: the planet near, its links fanning
  // out behind it, lit along one side by the heart of the map.
  const toPlanet = (n: Node | undefined) => {
    if (!n) return;
    if (selected) select(null);
    setSpot(n);
    const l = Math.hypot(n.hx, n.hy, n.hz) || 1;
    const o: V3 = [n.hx / l, n.hy / l, n.hz / l];
    const sl = Math.hypot(o[2], o[0]) || 1;
    const side: V3 = [o[2] / sl, 0, -o[0] / sl];
    const b: V3 = [o[0] * 0.84 + side[0] * 0.42, o[1] * 0.84 - 0.3, o[2] * 0.84 + side[2] * 0.42];
    const bl = Math.hypot(b[0], b[1], b[2]) || 1;
    const by = b[1] / bl;
    const free = freeRect();
    const room = Math.min(free.r - free.l, free.b - free.t);
    const ringR = n.r * PLANET_SCALE * 2.36;
    flyTo({
      tx: n.hx * 0.9, ty: n.hy * 0.9, tz: n.hz * 0.9,
      yaw: Math.atan2(-b[0] / bl, b[2] / bl),
      pitch: clamp(Math.asin(clamp(by, -1, 1)), -1.3, 1.3),
      dist: (cam.focal * ringR) / (room * 0.3) + l * 0.1,
    });
  };
  // In among the stars, close enough for the quiet ones to come forward.
  const closer = (i: number) => {
    setSpot(null);
    if (selected) select(null);
    const ranked = nodes.filter((n) => n.type === "project").sort((a, b) => b.deg - a.deg);
    const n = ranked[i % Math.max(1, ranked.length)];
    if (n) flyTo({ tx: n.hx * 0.9, ty: n.hy * 0.9, tz: n.hz * 0.9, dist: fitIn(freeRect()) * 0.36 });
  };
  const showcase = () =>
    nodes.filter((n) => n.type === "project" && shown(n)).sort((a, b) => b.deg - a.deg)[0] || null;
  const toStar = (n: Node | null) => {
    if (!n) return;
    setSpot(null);
    visited.add(n.id);
    select(n);
  };
  // Along a link from the star in hand to the next one.
  const followLink = () => {
    if (!selected) return;
    const next = related(selected)
      .filter((m) => !visited.has(m.id) && !PLANET.has(m.type))
      .sort((a, b) => Number(b.type === "project") - Number(a.type === "project") || b.deg - a.deg)[0];
    if (next) toStar(next);
  };
  const disc = (k: string) => byId.get(`disc:${k}`);
  const STEPS: TourStep[] = [
    {
      title: "Welcome to the Mind",
      text: "A star map of everything I have built. Here is how to read it.",
      panel: false, kinds: null, axes: false,
      beats: [{ hold: Infinity, go: () => wide() }],
    },
    {
      title: "Four planets, four disciplines",
      text: "AIE, FDE, MLE and SDE. Each project is pulled toward the ones it belongs to.",
      panel: false, kinds: ["discipline"], axes: false, loop: true,
      beats: ["aie", "fde", "mle", "sde"].map((k) => ({ hold: 4.4, go: () => toPlanet(disc(k)) })),
    },
    {
      title: "Position has meaning",
      text: "Left to right: business to tech. Top to bottom: product to models. Depth: data to systems.",
      panel: false, kinds: ["discipline"], axes: true, loop: true,
      beats: [{ hold: 5, go: () => wide(1.1, HOME_YAW, HOME_PITCH) }, { hold: 5, go: () => wide(1.16, -0.98, -0.34) }],
    },
    {
      title: "What the colours mean",
      text: "Blue projects, green case studies, red technologies. Fly closer to see more.",
      target: ".mind-filter",
      panel: true, kinds: ["project", "post", "tech"], axes: false, loop: true,
      beats: [{ hold: 5, go: () => closer(0) }, { hold: 5, go: () => closer(4) }],
    },
    {
      title: "Open any star",
      text: "Tap a star to open its card: what it is, where to read more, what it links to.",
      panel: false, kinds: null, axes: false,
      beats: [{ hold: 4.2, go: () => toStar(showcase()) }, { hold: 4.2, go: followLink }, { hold: Infinity, go: followLink }],
    },
    {
      title: "Choose what you see",
      text: "Switch kinds on and off. The highest kind still on takes the lines.",
      target: ".mind-filter",
      panel: true, kinds: null, axes: false, loop: true,
      beats: [
        { hold: 2.4, go: () => wide() },
        { hold: 3.6, go: () => setKind("project", false) },
        { hold: 3.2, go: () => setKind("project", true) },
      ],
    },
    {
      title: "Fly around",
      text: "Scroll or pinch to fly, drag to turn. Git mind shows my repos by tech stack.",
      target: ".mind-modes",
      panel: true, kinds: null, axes: false,
      beats: [{ hold: Infinity, go: () => wide(1.08) }],
    },
  ];
  function nextBeat() {
    const s = STEPS[tourStep];
    // Reduced motion: one view for each step, and it stays.
    if (reduced) { beatLeft = Infinity; return; }
    let i = beatI + 1;
    if (i >= s.beats.length) {
      if (!s.loop) { beatLeft = Infinity; return; }
      i = 0;
    }
    beatI = i;
    beatLeft = s.beats[i].hold;
    s.beats[i].go();
  }
  // The card goes where it is out of the way of what the step is about, by rule: under
  // the map on a wide screen, over it on a phone, and the view frames what is left.
  function placeTour() {
    if (!tourEl || tourEl.hidden) return;
    const vw = W || window.innerWidth, vh = H || window.innerHeight;
    const sheet = vw < 641;
    const w = sheet ? vw - 24 : Math.min(440, vw - 32);
    const h = tourEl.offsetHeight || 170;
    let x = 12, y = 84;
    if (!sheet) {
      y = vh - h - 24;
      const pr = panelOpenNow() ? panelRightCache + 16 : 0;
      if (cardIsOpen()) x = 24;
      else if (pr) x = Math.max(pr, (pr + vw - 120 - w) / 2);
      else x = (vw - w) / 2;
    }
    tourRect = { x, y, w, h };
    tourEl.style.width = `${w}px`;
    tourEl.style.left = `${x}px`;
    tourEl.style.top = `${y}px`;
  }
  function restoreKinds() {
    for (const t of [...hiddenTypes]) setKind(t, true);
  }
  function showStep(i: number) {
    if (!tourEl) return;
    document.querySelectorAll(".is-tour-target").forEach((el) => el.classList.remove("is-tour-target"));
    restoreKinds();
    tourStep = i;
    visited.clear();
    const s = STEPS[i];
    tourKinds = s.kinds ? new Set(s.kinds) : null;
    tourAxes = s.axes;
    setSpot(null);
    if (selected) select(null);
    setFolded(!s.panel);
    if (s.target) document.querySelector(s.target)?.classList.add("is-tour-target");
    const lastStep = i === STEPS.length - 1;
    tourEl.querySelector("[data-tour-count]")!.textContent = `Space tour · ${i + 1} of ${STEPS.length}`;
    tourEl.querySelector("[data-tour-title]")!.textContent = s.title;
    tourEl.querySelector("[data-tour-text]")!.textContent = s.text;
    tourEl.querySelector("[data-tour-dots]")!.innerHTML = STEPS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    (tourEl.querySelector("[data-tour-back]") as HTMLElement).hidden = i === 0;
    (tourEl.querySelector("[data-tour-skip]") as HTMLElement).hidden = lastStep;
    const next = tourEl.querySelector("[data-tour-next]") as HTMLButtonElement;
    next.textContent = i === 0 ? "Show me" : lastStep ? "Start exploring" : "Next";
    tourEl.classList.remove("is-step");
    void tourEl.offsetWidth;
    if (i > 0) tourEl.classList.add("is-step");
    updateFrame();
    placeTour();
    updateFrame();
    beatI = 0;
    beatLeft = s.beats[0].hold;
    s.beats[0].go();
    // the card may have just opened, and it changes where the tour's card belongs
    placeTour();
    updateFrame();
  }
  function startTour() {
    if (!tourEl || tourStep >= 0) return;
    try { localStorage.setItem(TOUR_KEY, "seen"); } catch { /* private mode: it shows again next time */ }
    if (graphKey !== "portfolio") modeBtns.find((b) => b.dataset.mode === "portfolio")?.click();
    tourWasFolded = panel!.classList.contains("is-folded");
    // Everything shows for the tour; what the visitor had switched off comes back after.
    tourHidden = [...hiddenTypes];
    for (const t of tourHidden) setKind(t, true);
    touring = true;
    wordsAway = true;
    autorotate = false;
    panel!.classList.add("is-touring");
    document.body.classList.add("mind-touring");
    tourEl.hidden = false;
    showStep(0);
    (tourEl.querySelector("[data-tour-next]") as HTMLButtonElement).focus({ preventScroll: true });
  }
  // Leaving by choice flies home; taken over by the visitor, the camera stays with them.
  function endTour(home: boolean) {
    if (!tourEl || tourStep < 0) return;
    tourStep = -1;
    tourKinds = null;
    tourAxes = false;
    touring = false;
    beatLeft = Infinity;
    setSpot(null);
    restoreKinds();
    for (const t of tourHidden) setKind(t, false);
    tourHidden = [];
    panel!.classList.remove("is-touring");
    document.body.classList.remove("mind-touring");
    document.querySelectorAll(".is-tour-target").forEach((el) => el.classList.remove("is-tour-target"));
    tourEl.hidden = true;
    tourRect = null;
    setFolded(tourWasFolded);
    if (home) {
      if (selected) select(null);
      updateFrame();
      frameToFit();
      autorotate = !reduced;
      idle = 0;
    } else {
      updateFrame();
    }
  }
  function takeOver() {
    if (tourStep >= 0) endTour(false);
  }
  tourEl?.querySelector("[data-tour-next]")?.addEventListener("click", () => {
    if (tourStep >= STEPS.length - 1) endTour(true); else showStep(tourStep + 1);
  }, on);
  tourEl?.querySelector("[data-tour-back]")?.addEventListener("click", () => { if (tourStep > 0) showStep(tourStep - 1); }, on);
  tourEl?.querySelector("[data-tour-skip]")?.addEventListener("click", () => endTour(true), on);
  // keep pointer and wheel on the tour card from moving the map
  for (const ev of ["pointerdown", "wheel", "click"]) tourEl?.addEventListener(ev, (e) => e.stopPropagation(), on);
  tourOpen?.addEventListener("click", (e) => { e.stopPropagation(); startTour(); }, on);
  window.addEventListener("resize", () => { placeTour(); updateFrame(); }, on);

  // ---- boot ---------------------------------------------------------------
  let resizeQueued = false;
  const ro = new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resize(); });
  });
  ro.observe(canvas);
  resize();
  // A cheap look, without making a context: the real answer comes when the world asks.
  flatSky = !glCanvas || typeof WebGL2RenderingContext === "undefined";
  if (flatSky) root.classList.add("is-plain");
  loadGraph(graphKey);
  raf = requestAnimationFrame(render);

  // ---- the 3D world, behind the first map ---------------------------------
  const skyRest = (rest: boolean) => document.documentElement.classList.toggle("in-cx", rest);
  // The title, in the page's own words: a line on a wide screen, two on a phone.
  const titleLines = () => {
    const text = (root!.querySelector(".mind-title .t-main")?.textContent || "").trim();
    if (!text) return [];
    if (W >= 641) return [text];
    const ws = text.split(/\s+/);
    let best = 1, bestD = Infinity;
    for (let i = 1; i < ws.length; i++) {
      const a = ws.slice(0, i).join(" ").length, b = ws.slice(i).join(" ").length;
      if (Math.abs(a - b) < bestD) { bestD = Math.abs(a - b); best = i; }
    }
    return [ws.slice(0, best).join(" "), ws.slice(best).join(" ")];
  };
  const showWorld = () => {
    worldShown = true;
    glCanvas!.classList.add("is-on");
    root!.classList.add("has-world");
    // The shared sky rests under an opaque world: two scenes would only cost frames.
    window.setTimeout(() => { if (!signal.aborted && worldShown) skyRest(true); }, 1200);
  };
  const toPlain = () => {
    worldDown = true;
    worldShown = false;
    worldA = 0;
    glCanvas!.classList.remove("is-on");
    root!.classList.remove("words-on", "has-world");
    root!.classList.add("is-plain");
    skyRest(false);
    if (!flatSky) {
      flatSky = true;
      flat.buildSky(worldR);
    }
  };
  if (!flatSky && glCanvas) {
    // The code starts down the wire now, so the wait is the wire and not an idle moment first.
    const engine = import("./mind-world/engine");
    const boot = () => {
      engine
        .then(async ({ mountWorld }) => {
          if (signal.aborted) return;
          const w = await mountWorld(glCanvas, {
            tier,
            reduced,
            phone,
            titleLines: titleLines(),
            fontFamily: INTER,
            onLost: toPlain,
            onRestored: () => {
              if (signal.aborted) return;
              worldDown = false;
              flatSky = false;
              root.classList.remove("is-plain");
              needGraph = true;
              linkKey = "";
              wordsDone = false;
              worldA = 0;
            },
          });
          if (signal.aborted) {
            w.destroy();
            return;
          }
          world = w;
          needGraph = true;
          w.setPaused(paused);
        })
        .catch((err) => {
          // No 3D for whatever reason: the map carries on, with its plain sky. If the GPU
          // went while the world was being built, it is built again when the GPU returns.
          console.warn(err);
          if (signal.aborted) return;
          toPlain();
          glCanvas.addEventListener("webglcontextrestored", boot, { once: true, signal });
        });
    };
    const rest = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (rest) rest(boot, { timeout: 500 });
    else window.setTimeout(boot, 120);
  } else if (flatSky) {
    flat.buildSky(worldR);
  }

  // Nothing draws while the tab is hidden or the map is off screen.
  let onScreen = true;
  const rest = () => {
    paused = !onScreen || document.hidden;
    world?.setPaused(paused);
  };
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    rest();
  });
  io.observe(root);
  document.addEventListener("visibilitychange", rest, on);

  // first visit in this browser: the tour opens once the map has settled
  let seen = false;
  try { seen = localStorage.getItem(TOUR_KEY) === "seen"; } catch { seen = false; }
  const tourTimer = !seen && !new URLSearchParams(location.search).has("notour") ? window.setTimeout(startTour, 1400) : 0;

  // For the checks in a development build only. A production build has none of this.
  if (import.meta.env.DEV) {
    (window as unknown as { __mind: unknown }).__mind = {
      nodes: () => nodes,
      cam,
      state: () => ({ worldShown, worldA, flatSky, wordsForm, wordsAway, flyAmt, speedS, fade, selected: selected?.id ?? null, hover: hover?.id ?? null, ox, oy, labels: labelN, placed: taken.length / 4, words: wordFade.slice(), settleLeft: bloom < 1 ? 1 : 0, dist: cam.dist, yaw: cam.yaw, pitch: cam.pitch, tx: cam.tx, ty: cam.ty, tz: cam.tz, paused }),
      taken: () => taken.slice(),
      sway: (t: number) => { swayT = t; },
      box: () => ({ W, H, keepOut: keepOut.slice(), free: freeRect(), mapA: mapAngle(camPos()) }),
    };
  }

  return () => {
    life.abort();
    cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    io.disconnect();
    clearTimeout(tourTimer);
    keys.clear();
    document.body.classList.remove("mind-touring");
    document.documentElement.classList.remove("in-cx");
    world?.destroy();
    world = null;
    atlas.dispose();
    if (flySent !== 0) emit("mind:fly", { speed: 0 });
  };
}

// ---- helpers --------------------------------------------------------------
function trim(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
