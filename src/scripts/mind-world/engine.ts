// The Mind tab's 3D world. The page owns the camera, the layout, the card and
// the controls, and tells this what to draw each frame; this owns every GPU
// resource. It loads on its own after the words and the first map are already on
// screen, builds in small turns, and links its shaders in the background.
//
//   const w = await mountWorld(canvas, options);
//   w.setGraph(nodes, worldR); w.frame(frame); w.setPaused(true); w.destroy();

import { Governor } from "../gl-governor";
import { breathe, prelink, quietShaderChecks } from "../gl-warm";
import {
  Color,
  LinearSRGBColorSpace,
  Matrix4,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type WebGLRenderTarget,
} from "three";
import { buildAtmosphere } from "./atmosphere";
import { buildPlanets, KIND, makeStarBatch, PLANET_SCALE, type Planet } from "./bodies";
import { buildFields } from "./field";
import { makeShared, type Shared } from "./glsl";
import { makeLinkBatch, STYLE } from "./links";
import { Post } from "./post";
import { bakeSky, makeBackdrop, type SkyBake } from "./sky";
import { buildWords, type WordBox, type Words, type WordsFrame } from "./words";

export type V3 = [number, number, number];

export interface WorldNode {
  type: string;
  /** Its kind leads the map right now: it shines as a full star. */
  big: boolean;
  color: string;
  x: number;
  y: number;
  z: number;
  /** World radius it draws at. */
  vr: number;
  /** Brightness this frame: 0 is gone. */
  op: number;
  /** 0..1, hovered or open. */
  foc: number;
  tw: number;
}

export interface WorldLink {
  a: WorldNode;
  b: WorldNode;
  op: number;
  width: number;
  /** Pulses per second along it. */
  flow: number;
  seed: number;
}

export interface WorldComet {
  head: V3;
  tail: V3;
  color: string;
  width: number;
  env: number;
}

/** The body held up over an open card: the real one, flown there from its place on the map. */
export interface WorldShown {
  node: WorldNode;
  /** Where it sits, in CSS pixels on screen, and how big. */
  x: number;
  y: number;
  R: number;
  /** 0 on the map, 1 over the card. */
  t: number;
}

export interface WorldFrame {
  rawMs: number;
  dt: number;
  time: number;
  moving: boolean;
  /** Camera: where it is and its axes. */
  pos: V3;
  right: V3;
  up: V3;
  back: V3;
  /** Pixels per world unit at distance 1, and the shift of the view's centre. */
  focal: number;
  ox: number;
  oy: number;
  /** Distance from the camera to what it looks at. */
  dist: number;
  worldR: number;
  /** 0..1, how far out the view is. */
  out: number;
  /** 0..1, how far the background has stepped back (filters, the tour). */
  quiet: number;
  /** 0..1, how fast the view is moving. */
  fly: number;
  /** Zoom blur: uv of where it leads, strength. */
  zoom: [number, number, number];
  nodes: WorldNode[];
  /** Positions changed this frame (the map still settling). */
  moved: boolean;
  links: WorldLink[];
  /** Goes up when the list of links is a different list. */
  linksRev: number;
  axes: { ext: number; op: number };
  comets: WorldComet[];
  focus: { x: number; y: number; z: number; color: string; amount: number; radius: number; wave: number; waveAmt: number };
  /** The map's bounds as this camera sees them, and how wide the fade outside them is. */
  mapA: number;
  mapFade: number;
  shown: WorldShown | null;
  words: WordsFrame | null;
  fade: number;
}

export interface WorldOptions {
  tier: "high" | "mid" | "low";
  reduced: boolean;
  phone: boolean;
  /** The title, a word or two per line, in the page's own words. */
  titleLines: string[];
  fontFamily: string;
  /** Called the moment the GPU is gone, and again once it has been rebuilt. */
  onLost(): void;
  onRestored(): void;
}

export interface World {
  setGraph(nodes: WorldNode[], worldR: number): void;
  setWorldR(worldR: number): void;
  frame(f: WorldFrame): void;
  wordBoxes(): WordBox[];
  setPaused(p: boolean): void;
  resize(): void;
  destroy(): void;
}

const NODE_CAP = 240;
const LINK_CAP = 460;
const COMET_CAP = 4;

export async function mountWorld(canvas: HTMLCanvasElement, o: WorldOptions): Promise<World> {
  // Asking for the context ourselves means no second one just to find out, and a
  // browser with only software rendering says no here: it gets the plain map, which
  // it can draw well, instead of this at two frames a second.
  const context = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: true,
  });
  if (!context) throw new Error("no capable GPU");
  const renderer = new WebGLRenderer({ canvas, context, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false, depth: false });
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  quietShaderChecks(renderer);
  renderer.autoClear = false;
  renderer.sortObjects = true;

  let lost = false;
  let disposed = false;
  let owed = false;
  let restore: () => void = () => {
    owed = true;
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    if (lost) return;
    lost = true;
    o.onLost();
  };
  const onRestored = () => restore();
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  const stopped = () => disposed || lost;

  const shared: Shared = makeShared(o.tier, o.reduced);
  const msaa = o.tier === "high" ? 4 : o.tier === "mid" ? 2 : 0;
  const post = new Post(renderer, { low: shared.low, msaa });
  await breathe();

  let bake: SkyBake = await bakeSky(renderer, { tier: o.tier, hdr: post.hdr, noise: shared.noise.value, stopped });
  await breathe();

  const atmosphere = buildAtmosphere(shared, bake.tile.texture, post.hdr);

  const scene = new Scene();
  const backU = {
    tSky: { value: bake.cube.texture as unknown },
    tAtmo: { value: atmosphere.target.texture as unknown },
    uRight: { value: new Vector3() },
    uUp: { value: new Vector3() },
    uBack: { value: new Vector3() },
    uHalf: { value: new Vector2(1, 1) },
    uShift: { value: new Vector2(0, 0) },
    uSkyLum: { value: 1 },
    uTint: { value: new Color() },
    uTintAmt: { value: 0 },
    uDecode: { value: bake.encoded ? 1 : 0 },
    uMapDir: shared.mapDir,
    uMapA: shared.mapA,
    uMapFade: shared.mapFade,
  };
  const backdrop = makeBackdrop(backU);
  scene.add(backdrop);

  const fields = buildFields(shared);
  scene.add(fields.deep, fields.motes);

  // Four for the map, and one that rides over an open card.
  const planets = buildPlanets(shared, 5);
  for (const p of planets.list) {
    p.group.visible = false;
    scene.add(p.group);
  }
  const shownPlanet = planets.list[4];
  shownPlanet.body.renderOrder = 50;
  shownPlanet.ring.renderOrder = 51;
  shownPlanet.fixedLight(1.05);
  // It sits nearer than anything else, whatever is around it.
  shownPlanet.body.onBeforeRender = () => renderer.clearDepth();

  const links = makeLinkBatch(shared, LINK_CAP, shared.low ? 16 : 26);
  scene.add(links.mesh);

  const stars = makeStarBatch(shared, NODE_CAP + COMET_CAP + 2);
  stars.mesh.renderOrder = -15;
  scene.add(stars.mesh);

  let words: Words | null = null;
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  try {
    await Promise.race([fonts?.load(`600 120px ${o.fontFamily}`), new Promise((r) => setTimeout(r, 400))]);
  } catch {
    /* it draws with whatever came first */
  }
  await breathe();
  if (!disposed && o.titleLines.length) {
    words = await buildWords(shared, o.titleLines, o.fontFamily, stopped);
    scene.add(words.points);
  }

  const camera = new PerspectiveCamera(50, 1, 1, 60000);
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;
  camera.up.set(0, 1, 0);

  // ---- sizing
  let cssW = 1;
  let cssH = 1;
  let resizeLater = 0;
  const governor = new Governor({ steps: [1, 0.86, 0.72], apply: () => sizeNow() });
  const budget = o.tier === "high" ? 3.4e6 : o.tier === "mid" ? 2.2e6 : 1.5e6;
  let sized = "";
  const sizeNow = () => {
    // By layout, not by rect: on the way in the page's blocks are still flying, scaled.
    cssW = Math.max(1, canvas.clientWidth);
    cssH = Math.max(1, canvas.clientHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, o.phone ? 1.5 : 2);
    if (cssW * cssH * dpr * dpr > budget) dpr = Math.sqrt(budget / (cssW * cssH));
    dpr = Math.max(0.6, dpr) * governor.scale;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    // On a phone the address bar sliding fires many small resizes: only a real change rebuilds.
    const key = `${w}x${h}`;
    shared.dpr.value = dpr;
    shared.view.value.set(w, h);
    if (key === sized) return;
    sized = key;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    atmosphere.setSize(w, h);
  };
  sizeNow();

  // ---- the map's data
  let nodes: WorldNode[] = [];
  let planetNodes: { n: WorldNode; p: Planet }[] = [];
  const colorCache = new Map<string, Color>();
  const colorOf = (hex: string) => {
    let c = colorCache.get(hex);
    if (!c) {
      c = new Color(hex);
      colorCache.set(hex, c);
    }
    return c;
  };
  const writeStatic = () => {
    const col = stars.iCol.array as Float32Array;
    const seed = stars.iSeed.array as Float32Array;
    nodes.forEach((n, i) => {
      if (i >= NODE_CAP) return;
      const c = colorOf(n.color);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      seed[i] = (n.tw / (Math.PI * 2)) % 1;
    });
    stars.iCol.needsUpdate = true;
    stars.iSeed.needsUpdate = true;
  };
  const setGraph = (list: WorldNode[], worldR: number) => {
    nodes = list;
    writeStatic();
    planetNodes = [];
    let i = 0;
    for (const n of list) {
      if (n.type !== "discipline" && n.type !== "category") continue;
      const p = planets.list[i++];
      if (!p || i > 4) break;
      planetNodes.push({ n, p });
      p.set(n.x, n.y, n.z, n.vr * PLANET_SCALE, n.color, 0.31 + i * 1.37);
    }
    for (; i < 4; i++) planets.list[i].visible(false);
    atmosphere.setRadius(worldR);
    shared.coreR.value = worldR;
    linksRevSeen = -1;
    shownNode = null;
  };

  // ---- the loop
  const tmpV = new Vector3();
  const light = new Vector3();
  const prevVP = new Matrix4();
  const curVP = new Matrix4();
  const shownPos = new Vector3();
  let havePrev = false;
  let paused = false;
  let linksRevSeen = -1;
  let shownFocus = "";
  let shownNode: WorldNode | null = null;
  const camPos = new Vector3();

  const kindOf = (n: WorldNode) => {
    if (n.type === "discipline" || n.type === "category") return KIND.planet;
    return n.big ? KIND.star : KIND.tool;
  };

  const frame = (f: WorldFrame) => {
    if (paused || lost || disposed) {
      havePrev = false;
      return;
    }
    governor.frame(f.rawMs, f.moving);
    // The canvas changed size. The picture stretches a touch for a moment, but on a
    // phone the address bar sliding fires many small resizes, and rebuilding the
    // buffers on each is what runs a phone out of graphics memory, so only the last
    // one counts. A real change, like a rotation, rebuilds at once.
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw !== cssW || ch !== cssH) {
      const small = cw === cssW && Math.abs(ch - cssH) < 160;
      cssW = cw;
      cssH = ch;
      clearTimeout(resizeLater);
      if (o.phone && small) resizeLater = window.setTimeout(sizeNow, 320);
      else sizeNow();
    }

    shared.time.value = o.reduced ? f.time * 0.2 : f.time;
    shared.focal.value = f.focal;

    // ---- camera: the page's own numbers, so its labels sit exactly on these stars
    const [px, py, pz] = f.pos;
    const [rx, ry, rz] = f.right;
    const [ux, uy, uz] = f.up;
    const [bx, by, bz] = f.back;
    camera.matrixWorld.set(rx, ux, bx, px, ry, uy, by, py, rz, uz, bz, pz, 0, 0, 0, 1);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camPos.set(px, py, pz);
    camera.near = Math.max(4, f.dist * 0.02);
    camera.far = f.worldR * 16 + f.dist * 4;
    camera.aspect = cssW / cssH;
    camera.fov = (2 * Math.atan(cssH / 2 / f.focal) * 180) / Math.PI;
    camera.setViewOffset(cssW, cssH, -f.ox, -f.oy, cssW, cssH);
    camera.updateProjectionMatrix();
    curVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!havePrev) {
      prevVP.copy(curVP);
      havePrev = true;
    }

    // ---- what everything keeps clear of: the map, as this camera sees it
    const D = camPos.length();
    shared.mapDir.value.copy(camPos).multiplyScalar(-1 / Math.max(D, 1));
    shared.mapA.value = f.mapA;
    shared.mapFade.value = f.mapFade;
    // Far bodies sink back: from a little in front of the middle of the map to its far side.
    shared.haze.value.set(f.dist - f.worldR * 0.4, f.worldR * 1.5);

    // ---- the chosen star's light
    const fc = f.focus;
    shared.focus.value.set(fc.x, fc.y, fc.z, fc.amount);
    shared.focusCol.value.copy(colorOf(fc.color));
    shared.focusR.value = fc.radius;
    shared.wave.value.set(fc.wave, fc.waveAmt);
    shared.waveW.value = f.worldR * 0.16;
    if (fc.color !== shownFocus) {
      shownFocus = fc.color;
      backU.uTint.value.copy(colorOf(fc.color));
    }
    // The lens only works on the bodies of the map, and only with a star in hand.
    const aperture = 6 * fc.amount * (1 - Math.min(1, f.fly * 1.4));
    const focusDist = fc.amount > 0.01 ? Math.max(1, tmpV.set(fc.x, fc.y, fc.z).sub(camPos).length()) : f.dist;
    shared.dof.value.set(focusDist, o.reduced ? 0 : aperture);

    // ---- the backdrop and the gas, out beyond the map
    backU.uRight.value.set(rx, ry, rz);
    backU.uUp.value.set(ux, uy, uz);
    backU.uBack.value.set(bx, by, bz);
    backU.uHalf.value.set(cssW / 2 / f.focal, cssH / 2 / f.focal);
    backU.uShift.value.set(f.ox / f.focal, -f.oy / f.focal);
    backU.uSkyLum.value = (1 - fc.amount * 0.4) * (0.6 + 0.4 * f.quiet) * 0.9;
    backU.uTintAmt.value = fc.amount * 0.3;
    atmosphere.update(0.82 * (0.5 + 0.5 * f.quiet), f.worldR * 0.3);
    fields.update({
      cam: camPos,
      prevVP,
      worldR: f.worldR,
      dist: f.dist,
      lum: 0.3 * (0.5 + 0.5 * f.quiet),
      // Only while flying: at rest the motes are gone.
      moteLum: Math.min(1, Math.max(0, f.fly - 0.04) * 3) * 0.8,
      fly: f.fly,
    });

    // ---- planets, all in the one light
    for (const { n, p } of planetNodes) {
      const r = n.vr * PLANET_SCALE;
      p.group.position.set(n.x, n.y, n.z);
      // From the heart of the map, leaning a little toward the reader, so no planet
      // ever turns a wholly dark face to them.
      light.set(-n.x, -n.y, -n.z).normalize();
      tmpV.copy(camPos).sub(p.group.position).normalize();
      light.addScaledVector(tmpV, 0.6 + n.foc * 0.9).add(tmpV.set(ux, uy, uz).multiplyScalar(0.12)).normalize();
      // Inside its own radius there is nothing to see: fade before the camera gets there.
      const camD = camPos.distanceTo(p.group.position);
      const near = Math.min(1, Math.max(0, (camD - r * 1.25) / (r * 1.4)));
      p.update(Math.min(1, n.op / 1.25) * near * f.fade, n.foc, light);
    }

    // ---- stars: positions only while the map is settling, brightness always
    const pos = stars.iPos.array as Float32Array;
    const st = stars.iS.array as Float32Array;
    const count = Math.min(nodes.length, NODE_CAP);
    for (let i = 0; i < count; i++) {
      const n = nodes[i];
      if (f.moved) {
        pos[i * 3] = n.x;
        pos[i * 3 + 1] = n.y;
        pos[i * 3 + 2] = n.z;
      }
      const kind = kindOf(n);
      st[i * 4] = kind === KIND.planet ? n.vr * PLANET_SCALE : n.vr;
      st[i * 4 + 1] = n.op * f.fade * (kind === KIND.planet ? 0.8 : 1);
      st[i * 4 + 2] = n.foc;
      st[i * 4 + 3] = kind;
    }
    // ---- comets: a head in the star batch, a tail in the ribbons
    const cc = stars.iCol.array as Float32Array;
    let total = count;
    const comets = f.comets;
    for (let i = 0; i < comets.length && i < COMET_CAP; i++) {
      const c = comets[i];
      const j = total++;
      pos[j * 3] = c.head[0];
      pos[j * 3 + 1] = c.head[1];
      pos[j * 3 + 2] = c.head[2];
      const col = colorOf(c.color);
      cc[j * 3] = col.r;
      cc[j * 3 + 1] = col.g;
      cc[j * 3 + 2] = col.b;
      st[j * 4] = c.width * 0.6;
      st[j * 4 + 1] = c.env * 0.6;
      st[j * 4 + 2] = 0;
      st[j * 4 + 3] = KIND.comet;
    }

    // ---- the body over an open card: the real one, carried there from its place
    const sh = f.shown;
    let haveShown = false;
    if (sh && sh.t > 0.001) {
      const n = sh.node;
      const t = sh.t;
      // A place on screen, just in front of the camera.
      const depth = Math.max(camera.near * 6, 40);
      const k = depth / f.focal;
      const lx = (sh.x - cssW / 2 - f.ox) * k;
      const ly = -(sh.y - cssH / 2 - f.oy) * k;
      shownPos.set(px + rx * lx + ux * ly - bx * depth, py + ry * lx + uy * ly - by * depth, pz + rz * lx + uz * ly - bz * depth);
      const planet = n.type === "discipline" || n.type === "category";
      const real = planet ? n.vr * PLANET_SCALE : n.vr;
      const wantR = sh.R * k;
      // It leaves from where the star is, shrinking or growing the whole way.
      shownPos.x = n.x + (shownPos.x - n.x) * t;
      shownPos.y = n.y + (shownPos.y - n.y) * t;
      shownPos.z = n.z + (shownPos.z - n.z) * t;
      const dNow = Math.max(camera.near * 2, shownPos.distanceTo(camPos));
      const startR = real;
      const shownR = startR + (wantR * (dNow / depth) - startR) * t;
      if (planet) {
        if (shownNode !== n) {
          shownPlanet.set(shownPos.x, shownPos.y, shownPos.z, shownR, n.color, 0.31 + (planetNodes.findIndex((q) => q.n === n) + 1) * 1.37);
          shownNode = n;
        }
        shownPlanet.place(shownPos.x, shownPos.y, shownPos.z, shownR);
        light.set(-n.x, -n.y, -n.z).normalize();
        tmpV.copy(camPos).sub(shownPos).normalize();
        light.addScaledVector(tmpV, 0.72).add(tmpV.set(ux, uy, uz).multiplyScalar(0.26)).normalize();
        shownPlanet.update(Math.min(1, t * 2), 0, light);
      } else {
        shownPlanet.visible(false);
        shownNode = null;
      }
      const j = total++;
      pos[j * 3] = shownPos.x;
      pos[j * 3 + 1] = shownPos.y;
      pos[j * 3 + 2] = shownPos.z;
      const col = colorOf(n.color);
      cc[j * 3] = col.r;
      cc[j * 3 + 1] = col.g;
      cc[j * 3 + 2] = col.b;
      st[j * 4] = shownR;
      st[j * 4 + 1] = Math.min(1, t * 2) * (planet ? 0.8 : 0.72);
      st[j * 4 + 2] = 0;
      st[j * 4 + 3] = planet ? KIND.planet : KIND.shown;
      (stars.iSeed.array as Float32Array)[j] = (n.tw / (Math.PI * 2)) % 1;
      stars.iSeed.needsUpdate = true;
      haveShown = true;
    } else {
      shownPlanet.visible(false);
      shownNode = null;
    }
    stars.iPos.needsUpdate = true;
    stars.iS.needsUpdate = true;
    if (comets.length || haveShown) stars.iCol.needsUpdate = true;
    (stars.mesh.geometry as unknown as { instanceCount: number }).instanceCount = total;

    // ---- links, with the axes and the comets' tails after them
    const list = f.links;
    const la = links.iA.array as Float32Array;
    const lb = links.iB.array as Float32Array;
    const lca = links.iCA.array as Float32Array;
    const lcb = links.iCB.array as Float32Array;
    const ll = links.iL.array as Float32Array;
    const lk = links.iK.array as Float32Array;
    const rewrite = linksRevSeen !== f.linksRev || f.moved;
    let m = Math.min(list.length, LINK_CAP - 4 - COMET_CAP);
    if (rewrite) {
      linksRevSeen = f.linksRev;
      for (let i = 0; i < m; i++) {
        const e = list[i];
        la[i * 3] = e.a.x;
        la[i * 3 + 1] = e.a.y;
        la[i * 3 + 2] = e.a.z;
        lb[i * 3] = e.b.x;
        lb[i * 3 + 1] = e.b.y;
        lb[i * 3 + 2] = e.b.z;
        const ca = colorOf(e.a.color);
        const cb = colorOf(e.b.color);
        const white = 0.3;
        lca[i * 3] = ca.r + (1 - ca.r) * white;
        lca[i * 3 + 1] = ca.g + (1 - ca.g) * white;
        lca[i * 3 + 2] = ca.b + (1 - ca.b) * white;
        lcb[i * 3] = cb.r + (1 - cb.r) * white;
        lcb[i * 3 + 1] = cb.g + (1 - cb.g) * white;
        lcb[i * 3 + 2] = cb.b + (1 - cb.b) * white;
        ll[i * 4 + 2] = e.seed;
        ll[i * 4 + 3] = 0.1 + e.seed * 0.08;
        lk[i * 2] = STYLE.link;
      }
      links.iA.needsUpdate = links.iB.needsUpdate = links.iCA.needsUpdate = links.iCB.needsUpdate = true;
    }
    for (let i = 0; i < m; i++) {
      const e = list[i];
      ll[i * 4] = e.op * f.fade;
      ll[i * 4 + 1] = e.width;
      lk[i * 2 + 1] = e.flow;
    }
    // Axes: three straight dotted lines through the middle.
    if (f.axes.op > 0.004) {
      const ext = f.axes.ext;
      const dirs: V3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      for (const d of dirs) {
        la.set([-d[0] * ext, -d[1] * ext, -d[2] * ext], m * 3);
        lb.set([d[0] * ext, d[1] * ext, d[2] * ext], m * 3);
        lca.set([1, 1, 1], m * 3);
        lcb.set([1, 1, 1], m * 3);
        ll.set([f.axes.op, 1.4, 0, 0], m * 4);
        lk.set([STYLE.dotted, 0], m * 2);
        m++;
      }
    }
    // Comet tails.
    for (let i = 0; i < comets.length && i < COMET_CAP; i++) {
      const c = comets[i];
      la.set(c.tail, m * 3);
      lb.set(c.head, m * 3);
      const col = colorOf(c.color);
      lca.set([col.r, col.g, col.b], m * 3);
      lcb.set([col.r, col.g, col.b], m * 3);
      ll.set([c.env, c.width * 1.1, 0, 0], m * 4);
      lk.set([STYLE.comet, 0], m * 2);
      m++;
    }
    // One thread of light from the star to the card that speaks for it.
    if (haveShown && sh) {
      const n = sh.node;
      la.set([n.x, n.y, n.z], m * 3);
      lb.set([shownPos.x, shownPos.y, shownPos.z], m * 3);
      const col = colorOf(n.color);
      lca.set([col.r, col.g, col.b], m * 3);
      lcb.set([col.r, col.g, col.b], m * 3);
      ll.set([sh.t * 0.62, 1.15, 0.3, 0], m * 4);
      lk.set([STYLE.link, 0.5], m * 2);
      m++;
    }
    links.iL.needsUpdate = links.iK.needsUpdate = true;
    links.iA.needsUpdate = links.iB.needsUpdate = links.iCA.needsUpdate = links.iCB.needsUpdate = true;
    (links.mesh.geometry as unknown as { instanceCount: number }).instanceCount = m;

    // ---- the words ride with the camera, behind the map
    if (words) {
      if (f.words) words.update(f.words, camera, f.focal, f.dist * 1.55);
      else words.points.visible = false;
    }

    // ---- draw
    renderer.setRenderTarget(atmosphere.target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);
    renderer.render(atmosphere.scene, camera);

    post.render(scene, camera, {
      time: f.time,
      bloom: 0.34,
      exposure: 1,
      zoom: o.reduced ? [0.5, 0.5, 0] : f.zoom,
    });
    prevVP.copy(curVP);
  };

  // Everything links in the background, one thing per turn, against the target it
  // will really use. Hidden things count: nothing waits for its first appearance.
  const warm = async () => {
    const jobs: [Object3D, WebGLRenderTarget | null][] = [
      [backdrop, post.sceneTarget],
      [fields.deep, post.sceneTarget],
      [planets.list[0].body, post.sceneTarget],
      [planets.list[0].ring, post.sceneTarget],
      [links.mesh, post.sceneTarget],
      [stars.mesh, post.sceneTarget],
      [atmosphere.gas, atmosphere.target],
      [atmosphere.dust, atmosphere.target],
    ];
    if (words) jobs.push([words.points, post.sceneTarget]);
    const waits: Promise<unknown>[] = [];
    for (const [obj, target] of jobs) {
      if (disposed) return;
      waits.push(prelink(renderer, obj, camera, target));
      await breathe();
    }
    waits.push(post.warm());
    await Promise.all(waits);
  };
  await warm();

  restore = async () => {
    if (disposed) return;
    try {
      // the painted sky and the tile went with the context: paint them again
      const was = bake;
      bake = await bakeSky(renderer, { tier: o.tier, hdr: post.hdr, noise: shared.noise.value, stopped: () => disposed });
      was.dispose();
      if (disposed) return;
      backU.tSky.value = bake.cube.texture;
      atmosphere.setTile(bake.tile.texture);
      sized = "";
      sizeNow();
      writeStatic();
      linksRevSeen = -1;
      await warm();
      if (disposed) return;
      lost = false;
      havePrev = false;
      o.onRestored();
    } catch (err) {
      console.warn(err);
    }
  };
  if (owed) restore();

  return {
    setGraph,
    setWorldR(worldR) {
      atmosphere.setRadius(worldR);
      shared.coreR.value = worldR;
    },
    frame,
    wordBoxes: () => words?.boxes ?? [],
    setPaused(p) {
      paused = p;
      if (p) governor.reset();
    },
    resize() {
      sizeNow();
    },
    destroy() {
      disposed = true;
      clearTimeout(resizeLater);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      planets.dispose();
      links.dispose();
      stars.dispose();
      fields.dispose();
      atmosphere.dispose();
      words?.dispose();
      shared.noise.value.dispose();
      backdrop.geometry.dispose();
      (backdrop.material as { dispose(): void }).dispose();
      bake.dispose();
      post.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
