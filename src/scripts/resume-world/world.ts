// The resume as an object in zero gravity.
//
// Four printed sheets float in front of his name. One comes forward, and its
// lines lift off the page and spread into the space around you: the work
// becomes stops you fly between, each company's mark standing as a solid lit
// object, the skills become a cloud of paper slips, education comes last.
// Every pose is a function of the scroll, so scrolling back puts the page
// together again exactly.
//
// The words stay in the HTML. This module draws, and moves the invisible
// links that sit over what it draws.

import { Governor } from "../gl-governor";
import { prelink, quietShaderChecks } from "../gl-warm";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CustomBlending,
  DataTexture,
  DynamicDrawUsage,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  LineSegments,
  Matrix3,
  Matrix4,
  Mesh,
  NoColorSpace,
  OneFactor,
  PerspectiveCamera,
  Points,
  Quaternion,
  RedFormat,
  Scene,
  ShaderMaterial,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import { Finish } from "./finish";
import { distanceField, layeredQuads, logoMask, typeMask, type Field } from "./marks";
import { PAGE_H, PAGE_RATIO, PAGE_W, layoutPage, paintAtlas, paintBacks, paintPage, paintWords, type Layout, type Piece, type Rect, type Slip } from "./paper";
import { DUST_FS, DUST_VS, MARK_FS, MARK_VS, PAPER_FS, PAPER_VS } from "./shaders";
import { STOPS, type WorldData } from "./types";

export type WorldHits = {
  sheets: HTMLElement[];
  sections: { name: "experience" | "skills" | "education"; el: HTMLElement }[];
  keys: HTMLElement[];
  tethers: SVGLineElement[];
  /** The PDF links at the last stop; the small sheets stand over them. */
  endLinks: HTMLElement[];
};

export type WorldEvents = {
  onSheetFlip?: (i: number) => void;
  onSkillTouch?: (index: number, slip: Slip) => void;
  onMarkHover?: (id: string, note: number) => void;
  onLineHover?: (id: string, note: number) => void;
  onLost?: () => void;
};

export type World = {
  frame(now: number, p: number, velocity: number): void;
  layout(): void;
  setPointer(nx: number, ny: number, seen: boolean): void;
  setChosen(i: number): void;
  chosen(): number;
  hoverSheet(i: number | null): void;
  pressSheet(i: number | null): void;
  pickSheet(i: number): void;
  dragStart(i: number): void;
  dragBy(i: number, dx: number, dy: number): void;
  dragEnd(i: number): void;
  hoverSection(name: string | null): void;
  setKey(i: number): void;
  hoverGroup(g: number | null): void;
  slips(): Slip[];
  destroy(): void;
};

type Tier = { dpr: number; page: number; atlas: [number, number]; words: number; layers: number; samples: number; bloom: number; dust: number; field: number; sheetSeg: [number, number] };

function pickTier(): Tier {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = matchMedia("(max-width: 767px)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
  if (coarse || small) return { dpr: 1.5, page: 900, atlas: [2048, 1024], words: 1280, layers: 10, samples: 4, bloom: 3, dust: 700, field: 768, sheetSeg: [18, 24] };
  if (cores >= 8 && mem >= 8) return { dpr: 2, page: 1400, atlas: [4096, 1536], words: 2048, layers: 26, samples: 4, bloom: 5, dust: 2200, field: 1400, sheetSeg: [26, 34] };
  return { dpr: 1.5, page: 1400, atlas: [3072, 1280], words: 2048, layers: 16, samples: 4, bloom: 4, dust: 1400, field: 1024, sheetSeg: [20, 26] };
}

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out3 = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const damp = (c: number, t: number, rate: number, dt: number) => c + (t - c) * (1 - Math.exp(-rate * dt));
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// A sheet of paper: a front and a back made of a grid, so it can flex, and a
// strip around it for the cut edge.
function paperGeometry(sx: number, sy: number): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const face: number[] = [];
  const idx: number[] = [];
  const grid = (z: number, f: number) => {
    const b = pos.length / 3;
    for (let y = 0; y <= sy; y++)
      for (let x = 0; x <= sx; x++) {
        pos.push(x / sx - 0.5, y / sy - 0.5, z);
        nor.push(0, 0, z > 0 ? 1 : -1);
        face.push(f);
      }
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        const a = b + y * (sx + 1) + x;
        const c = a + 1;
        const d = a + sx + 1;
        const e = d + 1;
        if (z > 0) idx.push(a, c, e, a, e, d);
        else idx.push(a, e, c, a, d, e);
      }
  };
  grid(0.5, 0);
  grid(-0.5, 1);
  const side = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    const nx = y1 - y0;
    const ny = -(x1 - x0);
    const b = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = lerp(x0, x1, t);
      const y = lerp(y0, y1, t);
      pos.push(x, y, 0.5, x, y, -0.5);
      nor.push(nx, ny, 0, nx, ny, 0);
      face.push(2, 2);
    }
    for (let i = 0; i < n; i++) {
      const a = b + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  side(-0.5, -0.5, 0.5, -0.5, sx);
  side(0.5, -0.5, 0.5, 0.5, sy);
  side(0.5, 0.5, -0.5, 0.5, sx);
  side(-0.5, 0.5, -0.5, -0.5, sy);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute("aFace", new BufferAttribute(new Float32Array(face), 1));
  g.setIndex(idx);
  return g;
}

class Batch {
  mesh: InstancedMesh;
  uvA: Float32Array;
  uvB: Float32Array;
  size: Float32Array;
  state: Float32Array;
  flex: Float32Array;
  private aState: InstancedBufferAttribute;
  private aFlex: InstancedBufferAttribute;
  constructor(geo: BufferGeometry, mat: ShaderMaterial, n: number) {
    const g = geo.clone();
    this.uvA = new Float32Array(n * 4);
    this.uvB = new Float32Array(n * 4);
    this.size = new Float32Array(n * 2);
    this.state = new Float32Array(n * 4);
    this.flex = new Float32Array(n * 4);
    g.setAttribute("aUvA", new InstancedBufferAttribute(this.uvA, 4));
    g.setAttribute("aUvB", new InstancedBufferAttribute(this.uvB, 4));
    g.setAttribute("aSize", new InstancedBufferAttribute(this.size, 2));
    this.aState = new InstancedBufferAttribute(this.state, 4);
    this.aState.setUsage(DynamicDrawUsage);
    this.aFlex = new InstancedBufferAttribute(this.flex, 4);
    this.aFlex.setUsage(DynamicDrawUsage);
    g.setAttribute("aState", this.aState);
    g.setAttribute("aFlex", this.aFlex);
    this.mesh = new InstancedMesh(g, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  }
  place(i: number, r: Rect | null, uvB: readonly number[] | null, seed: number) {
    if (r) {
      this.uvA.set([r.x / PAGE_W, r.y / PAGE_H, r.w / PAGE_W, r.h / PAGE_H], i * 4);
      this.size.set([r.w / PAGE_W, r.h / PAGE_W], i * 2);
    }
    if (uvB) this.uvB.set(uvB as number[], i * 4);
    this.state[i * 4 + 3] = seed;
  }
  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aState.needsUpdate = true;
    this.aFlex.needsUpdate = true;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

type Frame = { pos: Vector3; q: Quaternion; right: Vector3; up: Vector3; fwd: Vector3 };
type PieceRT = {
  p: Piece;
  i: number;
  local: Vector3;
  destK: number;
  dest: Vector3;
  destQ: Quaternion;
  destS: number;
  destFlexK: number;
  hoop: { center: Vector3; tilt: Quaternion; radius: number; k: number; dir: number; phase: number } | null;
  exit: Vector3;
  exitQ: Quaternion;
  entry: Vector3;
  entryQ: Quaternion;
  t0: number;
  t1: number;
  seed: number;
  active: number;
  near: number;
  lift: number;
};
type SlipRT = {
  s: Slip;
  i: number;
  local: Vector3;
  home: Vector3;
  grid: Vector3;
  gridS: number;
  homeS: number;
  exit: Vector3;
  entry: Vector3;
  t0: number;
  seed: number;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  spin: number;
  lit: number;
  touched: boolean;
  mix: number;
};
type MarkRT = {
  id: string;
  mesh: Mesh;
  mat: ShaderMaterial;
  tex: DataTexture;
  aspect: number;
  stop: number;
  pos: Vector3;
  q: Quaternion;
  worldW: number;
  depth: number;
  float: number;
  yaw: number;
  seed: number;
  over: boolean;
  band: number;
};
type SheetRT = {
  batch: Batch;
  mat: ShaderMaterial;
  hover: number;
  hoverT: number;
  press: number;
  pressT: number;
  pick: number;
  pickT: number;
  yaw: number;
  vy: number;
  pitch: number;
  vp: number;
  dragging: boolean;
  lastFace: number;
  auto: number;
  autoFrom: number;
  sx: number;
  sy: number;
  dist: number;
  base: { yaw: number; pitch: number; roll: number };
  dir: Vector3;
  worldW: number;
  seed: number;
};

const PAPER_LOCAL_H = PAGE_RATIO;

export async function mountWorld(
  canvas: HTMLCanvasElement,
  data: WorldData,
  hits: WorldHits,
  events: WorldEvents,
  motionStart: () => number,
): Promise<World | null> {
  const tier = pickTier();
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: tier.dpr >= 2 ? "high-performance" : "default",
    });
  } catch {
    return null;
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return null;
  }
  quietShaderChecks(renderer);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;
  const baseDpr = Math.min(devicePixelRatio || 1, tier.dpr);
  let dpr = baseDpr;

  const finish = new Finish(renderer, { levels: tier.bloom, samples: tier.samples });

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 16 / 9, 0.1, 400);
  camera.layers.enable(0);

  // ------------------------------------------------------------- textures
  try {
    await Promise.all([document.fonts.load('600 64px "Inter"'), document.fonts.load('400 24px "Inter"')]);
  } catch {
    /* the fallback face still reads */
  }
  const logoUrls = [...new Set([...data.roles.map((r) => r.logo), ...data.education.map((e) => e.logo)].filter(Boolean))];
  const masks = new Map<string, HTMLCanvasElement>();
  await Promise.all(
    logoUrls.map(async (src) => {
      try {
        masks.set(src, await logoMask(src, tier.field));
      } catch {
        /* a missing logo leaves the text alone */
      }
    }),
  );
  const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  const textures: Texture[] = [];
  const tex = (cv: HTMLCanvasElement) => {
    const t = new CanvasTexture(cv);
    t.flipY = false;
    t.colorSpace = NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    textures.push(t);
    return t;
  };
  // Upload now and let go of the canvas: the GPU holds the picture.
  const upload = (t: Texture) => {
    renderer.initTexture(t);
    const cv = t.image as HTMLCanvasElement;
    cv.width = 1;
    cv.height = 1;
  };

  await nextFrame();
  const measure = document.createElement("canvas").getContext("2d")!;
  const layoutData: Layout = layoutPage(measure, data, masks);
  await nextFrame();
  const pageTex: Texture[] = [];
  for (let i = 0; i < data.sheets.length; i++) {
    pageTex.push(tex(paintPage(layoutData, i, tier.page)));
    upload(pageTex[i]);
    await nextFrame();
  }
  const backs = paintBacks(data, Math.round(tier.page / 2));
  const backTex = tex(backs.canvas);
  upload(backTex);
  const maxTex = renderer.capabilities.maxTextureSize;
  const atlas = paintAtlas(layoutData, Math.min(maxTex, tier.atlas[0]), Math.min(maxTex, tier.atlas[1]));
  const atlasTex = tex(atlas.canvas);
  upload(atlasTex);
  await nextFrame();
  const words = paintWords(layoutData, tier.words);
  const wordsTex = tex(words.canvas);
  upload(wordsTex);
  await nextFrame();

  // ------------------------------------------------------------- shared
  const shared = {
    uTime: { value: 0 },
    uThick: { value: 0.0038 },
    uCursor: { value: new Vector3(0, 0, 5) },
    uCursorI: { value: 2.2 },
    uKeyDir: { value: new Vector3(-0.36, 0.72, 0.6).normalize() },
    uEnv: { value: 0 },
    uRes: { value: new Vector2(1, 1) },
    tBehind: { value: finish.behindTexture as Texture | null },
    uBehind: { value: 0 },
    uLuminous: { value: 0.8 },
  };
  const paperMaterial = (page: Texture, alt: Texture | null, back: Texture | null) =>
    new ShaderMaterial({
      vertexShader: PAPER_VS,
      fragmentShader: PAPER_FS,
      uniforms: {
        ...shared,
        tPage: { value: page },
        tAlt: { value: alt },
        tBack: { value: back },
        uHasAlt: { value: alt ? 1 : 0 },
        uHasBack: { value: back ? 1 : 0 },
      },
    });

  // ------------------------------------------------------------- objects
  const sheetGeo = paperGeometry(tier.sheetSeg[0], tier.sheetSeg[1]);
  const pieceGeo = paperGeometry(56, 2);
  const scrapGeo = paperGeometry(10, 2);
  const slipGeo = paperGeometry(2, 1);
  const n = data.sheets.length;
  const sheets: SheetRT[] = data.sheets.map((_, i) => {
    const mat = paperMaterial(pageTex[i], null, backTex);
    const batch = new Batch(sheetGeo, mat, 1);
    batch.place(0, { x: 0, y: 0, w: PAGE_W, h: PAGE_H }, backs.rects[i], 0.13 + i * 0.21);
    batch.state.set([0, 1, 1, 0.13 + i * 0.21], 0);
    scene.add(batch.mesh);
    return {
      batch,
      mat,
      hover: 0,
      hoverT: 0,
      press: 0,
      pressT: 0,
      pick: 0,
      pickT: 0,
      yaw: 0,
      vy: 0,
      pitch: 0,
      vp: 0,
      dragging: false,
      lastFace: 0,
      auto: -1,
      autoFrom: 0,
      sx: 0.5,
      sy: 0.5,
      dist: 9,
      base: { yaw: 0, pitch: 0, roll: 0 },
      dir: new Vector3(),
      worldW: 1,
      seed: hash(i + 3),
    };
  });

  // The lines of the page, with one blank sheet behind them. Instance 0 is
  // the blank.
  const piecesList = layoutData.pieces;
  const pieceMat = paperMaterial(pageTex[0], atlasTex, null);
  const pieceBatch = new Batch(pieceGeo, pieceMat, piecesList.length + 1);
  // It shades as the whole page but prints nothing: a blank corner of the atlas.
  pieceBatch.place(0, { x: 0, y: 0, w: PAGE_W, h: PAGE_H }, [0.9985, 0.9985, 0.0005, 0.0005], 0.5);
  scene.add(pieceBatch.mesh);

  const destOf = (dest: string) => {
    const roleStop: Record<string, number> = {};
    data.roles.forEach((r, i) => (roleStop[r.id] = 2 + i));
    if (dest in roleStop) return roleStop[dest];
    if (data.education.some((e) => e.id === dest)) return STOPS.indexOf("education");
    return -1;
  };

  const pieces: PieceRT[] = piecesList.map((p, i) => {
    const seed = hash(i * 1.7 + 5);
    pieceBatch.place(i + 1, p.rect, atlas.rects.get(p.id) ?? [0, 0, 0, 0], seed);
    return {
      p,
      i: i + 1,
      local: new Vector3((p.rect.x + p.rect.w / 2) / PAGE_W - 0.5, PAPER_LOCAL_H / 2 - (p.rect.y + p.rect.h / 2) / PAGE_W, 0.0016 + seed * 0.0012),
      destK: destOf(p.dest),
      dest: new Vector3(),
      destQ: new Quaternion(),
      destS: 1,
      destFlexK: 0,
      hoop: null,
      exit: new Vector3(),
      exitQ: new Quaternion(),
      entry: new Vector3(),
      entryQ: new Quaternion(),
      t0: 1.03,
      t1: 1.8,
      seed,
      active: 0,
      near: 0,
      lift: 0,
    };
  });

  const slipsList = layoutData.slips;
  const slipMat = paperMaterial(pageTex[0], wordsTex, null);
  const slipBatch = new Batch(slipGeo, slipMat, slipsList.length);
  scene.add(slipBatch.mesh);
  const slips: SlipRT[] = slipsList.map((s, i) => {
    const seed = hash(i * 2.3 + 11);
    slipBatch.place(i, s.rect, words.rects.get(s.id) ?? [0, 0, 0, 0], seed);
    return {
      s,
      i,
      local: new Vector3((s.rect.x + s.rect.w / 2) / PAGE_W - 0.5, PAPER_LOCAL_H / 2 - (s.rect.y + s.rect.h / 2) / PAGE_W, 0.003),
      home: new Vector3(),
      grid: new Vector3(),
      gridS: 1,
      homeS: 1,
      exit: new Vector3(),
      entry: new Vector3(),
      t0: 1.04 + seed * 0.3,
      seed,
      dx: 0,
      dy: 0,
      vx: 0,
      vy: 0,
      spin: 0,
      lit: 0.8,
      touched: false,
      mix: 0,
    };
  });

  // Scraps of the page hanging along the way. You only see them in motion.
  const scrapCount = tier.dust > 1000 ? 130 : 60;
  const scrapBatch = new Batch(scrapGeo, pieceMat, scrapCount);
  scene.add(scrapBatch.mesh);
  type Scrap = { i: number; u: number; off: Vector3; base: Vector3; axis: Vector3; rate: number; phase: number; size: number };
  const scraps: Scrap[] = [];
  for (let i = 0; i < scrapCount; i++) {
    const r0 = hash(i * 3.1 + 2);
    const r1 = hash(i * 4.7 + 9);
    const h0 = 24 + hash(i * 5.9 + 3) * 44;
    const w0 = 150 + hash(i * 7.3 + 4) * 340;
    const rect: Rect = { x: 92 + r0 * (PAGE_W - 184 - w0), y: 250 + r1 * (PAGE_H - 340), w: w0, h: h0 };
    const seed = hash(i * 9.1 + 5);
    scrapBatch.place(i, rect, [0, 0, 0, 0], seed);
    scrapBatch.state.set([0, 1, 1, seed], i * 4);
    const seg = 1 + Math.floor(hash(i * 11.3 + 6) * 6);
    const u = seg + 0.2 + hash(i * 13.7 + 7) * 0.6;
    const a = hash(i * 17.1 + 8) * Math.PI * 2;
    const rad = 1.3 + Math.pow(hash(i * 19.3 + 1), 1.6) * 6.5;
    scraps.push({
      i,
      u,
      off: new Vector3(Math.cos(a) * rad * 1.3, Math.sin(a) * rad * 0.8, (seed - 0.5) * 3),
      base: new Vector3(),
      axis: new Vector3(seed - 0.5, hash(seed * 3) - 0.5, hash(seed * 5) - 0.5).normalize(),
      rate: 0.15 + seed * 0.5,
      phase: seed * 20,
      size: 2.6 + hash(seed * 7) * 2.4,
    });
  }

  // ------------------------------------------------------------- marks
  const fieldGeo = layeredQuads(tier.layers);
  const makeMark = (id: string, field: Field, stop: number, depth: number, base: number, bevel: number): MarkRT => {
    const t = new DataTexture(field.data, field.width, field.height, RedFormat, UnsignedByteType);
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = true;
    t.flipY = false;
    t.colorSpace = NoColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.unpackAlignment = 1;
    t.needsUpdate = true;
    textures.push(t);
    const mat = new ShaderMaterial({
      vertexShader: MARK_VS,
      fragmentShader: MARK_FS,
      alphaToCoverage: true,
      uniforms: {
        uCursor: shared.uCursor,
        uCursorI: shared.uCursorI,
        uKeyDir: shared.uKeyDir,
        uEnv: shared.uEnv,
        tField: { value: t },
        uTexel: { value: new Vector2(1 / field.width, 1 / field.height) },
        uSpread: { value: field.spread },
        uBevelPx: { value: bevel },
        uBase: { value: base },
        uLit: { value: 1 },
        uSweep: { value: -1 },
        uSize: { value: new Vector2(1, 1 / field.aspect) },
        uDepth: { value: depth },
        uAxes: { value: new Matrix3() },
        uDome: { value: 0.7 },
        uRes: shared.uRes,
        uShade: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
        uShadeOn: { value: 0 },
      },
    });
    const mesh = new Mesh(fieldGeo, mat);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = true;
    scene.add(mesh);
    return { id, mesh, mat, tex: t, aspect: field.aspect, stop, pos: new Vector3(), q: new Quaternion(), worldW: 1, depth, float: 0.05, yaw: 0, seed: hash(stop * 3 + id.length), over: false, band: 1.9 };
  };

  const marks: MarkRT[] = [];
  const wide = () => canvas.clientWidth / Math.max(1, canvas.clientHeight) >= 1.05 && canvas.clientWidth >= 768;
  const spreadFor = (w: number) => Math.max(10, Math.round(w / 64));
  const logoField = (src: string) => {
    const m = masks.get(src);
    return m ? distanceField(m, spreadFor(m.width)) : null;
  };
  const fieldsBySrc = new Map<string, Field>();
  for (const src of logoUrls) {
    const f = logoField(src);
    if (f) fieldsBySrc.set(src, f);
    await nextFrame();
  }
  data.roles.forEach((r, i) => {
    const f = fieldsBySrc.get(r.logo);
    if (f) marks.push(makeMark(`role-${r.id}`, f, 2 + i, r.logo.includes("hybridge") ? 0.05 : 0.09, 0.2, f.spread * 0.5));
  });
  masks.clear();
  data.education.forEach((e) => {
    const f = fieldsBySrc.get(e.logo);
    if (f) marks.push(makeMark(`edu-${e.id}`, f, STOPS.indexOf("education"), e.logo.endsWith(".png") ? 0.008 : 0.06, e.logo.endsWith(".png") ? 0.36 : 0.2, e.logo.endsWith(".png") ? 2.5 : f.spread * 0.5));
  });

  // His name, large, behind the sheets. Phones stack it on two lines.
  const nameParts = data.person.name.split(" ");
  const buildType = () => {
    const lines = wide() ? [data.person.name] : nameParts;
    const fontPx = 300;
    const mask = typeMask(lines, fontPx, 620, -fontPx * 0.042);
    return distanceField(mask, 14);
  };
  const typeMark = makeMark("name", buildType(), 0, 0.06, 0.17, 5);
  typeMark.mesh.layers.enable(1);
  typeMark.mat.uniforms.uShadeOn.value = 1;
  marks.push(typeMark);
  await nextFrame();

  // ------------------------------------------------------------- dust
  const dustCount = tier.dust;
  const dPos = new Float32Array(dustCount * 3);
  const dSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const a = hash(i + 1) * Math.PI * 2;
    const r = 2 + Math.pow(hash(i * 2 + 7), 0.7) * 22;
    dPos[i * 3] = Math.cos(a) * r * 1.4;
    dPos[i * 3 + 1] = Math.sin(a) * r * 0.8;
    dPos[i * 3 + 2] = 14 - hash(i * 3 + 9) * 170;
    dSeed[i] = hash(i * 5 + 2);
  }
  const dustU = { uTime: shared.uTime, uStretch: { value: 0 }, uDpr: { value: dpr }, uGain: { value: 0.7 }, uLine: { value: 0 } };
  const additive = { transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor } as const;
  const pointGeo = new BufferGeometry();
  pointGeo.setAttribute("position", new BufferAttribute(dPos, 3));
  pointGeo.setAttribute("aSeed", new BufferAttribute(dSeed, 1));
  pointGeo.setAttribute("aTail", new BufferAttribute(new Float32Array(dustCount), 1));
  const pointMat = new ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: dustU, ...additive });
  const points = new Points(pointGeo, pointMat);
  points.frustumCulled = false;
  points.renderOrder = 20;
  scene.add(points);
  const lp = new Float32Array(dustCount * 6);
  const ls = new Float32Array(dustCount * 2);
  const lt = new Float32Array(dustCount * 2);
  for (let i = 0; i < dustCount; i++)
    for (let k = 0; k < 2; k++) {
      lp.set([dPos[i * 3], dPos[i * 3 + 1], dPos[i * 3 + 2]], (i * 2 + k) * 3);
      ls[i * 2 + k] = dSeed[i];
      lt[i * 2 + k] = k;
    }
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new BufferAttribute(lp, 3));
  lineGeo.setAttribute("aSeed", new BufferAttribute(ls, 1));
  lineGeo.setAttribute("aTail", new BufferAttribute(lt, 1));
  const lineU = { ...dustU, uLine: { value: 1 }, uGain: { value: 0 }, uStretch: { value: 0 } };
  const lineMat = new ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: lineU, ...additive });
  const lines = new LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 21;
  scene.add(lines);

  // ------------------------------------------------------------- the path
  const LAST = STOPS.length - 1;
  const KEYS = [
    { pos: [0, 0, 9], look: [0, 0, 0], roll: 0 },
    { pos: [0, 0, 9], look: [0, 0, 0], roll: 0 },
    { pos: [3.5, 1.2, -12], look: [2.6, 0.9, -26], roll: -0.035 },
    { pos: [-7, -2, -34], look: [-8.6, -1.6, -48], roll: 0.05 },
    { pos: [6, 3.4, -56], look: [7.6, 2.6, -70], roll: -0.04 },
    { pos: [-3, -3.4, -78], look: [-2.2, -4.6, -92], roll: 0.03 },
    { pos: [0, 0, -102], look: [0, 0, -116], roll: 0 },
    { pos: [-3, 2, -128], look: [-3.6, 2, -142], roll: 0.012 },
  ];
  const posCurve = new CatmullRomCurve3(KEYS.map((k) => new Vector3(...(k.pos as [number, number, number]))), false, "centripetal");
  const lookCurve = new CatmullRomCurve3(KEYS.map((k) => new Vector3(...(k.look as [number, number, number]))), false, "centripetal");
  scraps.forEach((sc) => posCurve.getPoint(sc.u / (STOPS.length - 1), sc.base).add(sc.off));
  const m4 = new Matrix4();
  const frames: Frame[] = KEYS.map((k) => {
    const pos = new Vector3(...(k.pos as [number, number, number]));
    const look = new Vector3(...(k.look as [number, number, number]));
    m4.lookAt(pos, look, new Vector3(0, 1, 0));
    const q = new Quaternion().setFromRotationMatrix(m4);
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), k.roll));
    return {
      pos,
      q,
      right: new Vector3(1, 0, 0).applyQuaternion(q),
      up: new Vector3(0, 1, 0).applyQuaternion(q),
      fwd: new Vector3(0, 0, -1).applyQuaternion(q),
    };
  });

  // ------------------------------------------------------------- layout
  let W = 1;
  let H = 1;
  let aspect = 1;
  let isWide = true;
  let tanH = Math.tan((15 * Math.PI) / 180);
  const viewH = (d: number) => 2 * d * tanH;
  const viewW = (d: number) => viewH(d) * aspect;
  const pxWorld = (px: number, d: number) => (px * viewH(d)) / H;
  const at = (k: number, sx: number, sy: number, d: number, out: Vector3) => {
    const f = frames[k];
    return out
      .copy(f.pos)
      .addScaledVector(f.fwd, d)
      .addScaledVector(f.right, (sx - 0.5) * viewW(d))
      .addScaledVector(f.up, (0.5 - sy) * viewH(d));
  };
  const euler = new Euler(0, 0, 0, "YXZ");
  const qFrom = (k: number, pitch: number, yaw: number, roll: number, out: Quaternion) => {
    euler.set(pitch, yaw, roll);
    return out.setFromEuler(euler).premultiply(frames[k].q);
  };

  const pageSpec = { pos: new Vector3(), q: new Quaternion(), worldW: 1 };
  const cellRects: ({ x: number; y: number } | null)[] = [];
  const endRects: ({ x: number; y: number } | null)[] = [];
  const STAGGER = [
    { dz: -0.1, dy: 0.018, yaw: 0.34, pitch: -0.12, roll: -0.06 },
    { dz: 0.9, dy: -0.03, yaw: -0.16, pitch: 0.13, roll: 0.04 },
    { dz: -0.7, dy: 0.012, yaw: 0.15, pitch: 0.1, roll: -0.03 },
    { dz: 0.5, dy: -0.016, yaw: -0.32, pitch: -0.13, roll: 0.07 },
  ];
  let typeLit = 1;

  const layout = () => {
    W = Math.max(1, canvas.clientWidth);
    H = Math.max(1, canvas.clientHeight);
    aspect = W / H;
    isWide = aspect >= 1.05 && W >= 768;
    camera.fov = isWide ? 30 : 36;
    tanH = Math.tan(((camera.fov / 2) * Math.PI) / 180);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    const rw = Math.floor(W * dpr);
    const rh = Math.floor(H * dpr);
    finish.setSize(rw, rh);
    shared.uRes.value.set(rw, rh);
    dustU.uDpr.value = dpr;

    // ---- the sheets line up over their links
    const cells = hits.sheets.map((el) => document.querySelector<HTMLElement>(`[data-cell="${el.dataset.hit}"]`));
    const rects = cells.map((c) => c?.getBoundingClientRect());
    const stage = canvas.getBoundingClientRect();
    rects.forEach((r, i) => {
      cellRects[i] = r ? { x: r.left + r.width / 2 - stage.left, y: r.top - stage.top } : null;
    });
    hits.endLinks.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const row = el.parentElement?.getBoundingClientRect();
      endRects[i] = { x: r.left + r.width / 2 - stage.left, y: (row ? row.top : r.top) - stage.top };
    });
    const cellTop = Math.min(...rects.map((r) => (r ? r.top - stage.top : H * 0.86)));
    const dT = 10.5;
    const nameBox = (() => {
      let tw = viewW(dT) * (isWide ? 0.955 : 0.93);
      let th = tw / typeMark.aspect;
      const most = viewH(dT) * (isWide ? 0.24 : 0.3);
      if (th > most) {
        th = most;
        tw = th * typeMark.aspect;
      }
      const hpx = (th / viewH(dT)) * H;
      const topPx = isWide ? (H < 620 ? 72 : 112) : 96;
      return { tw, hpx, topPx, bottom: topPx + hpx };
    })();

    sheets.forEach((s, i) => {
      const r = rects[i];
      const sg = STAGGER[i];
      s.dist = 9 + sg.dz * (isWide ? 1 : 0.5);
      s.base = { yaw: sg.yaw * (isWide ? 1 : 0.7), pitch: sg.pitch, roll: sg.roll };
      if (isWide) {
        const cw = r ? r.width : W / 4;
        // the sheets stand in front of the lower part of his name
        const regionTop = nameBox.bottom - nameBox.hpx * 0.24;
        const regionH = Math.max(120, cellTop - regionTop - 14);
        const hpx = Math.min(regionH, (cw / PAGE_W) * PAGE_H * 0.98);
        s.sx = (r ? r.left + r.width / 2 : ((i + 0.5) * W) / 4) / W;
        s.sy = (regionTop + regionH / 2) / H + sg.dy;
        s.worldW = pxWorld((hpx / PAGE_H) * PAGE_W, 9);
      } else {
        // two by two above the links
        const regionTop = nameBox.bottom - 24;
        const regionH = cellTop - regionTop - 8;
        const rowH = regionH / 2;
        const hpx = Math.min(rowH * 0.98, (W * 0.43 * PAGE_H) / PAGE_W);
        const col = i % 2;
        const row = Math.floor(i / 2);
        s.sx = (col ? 0.74 : 0.26) + (row ? 0.008 : -0.008);
        s.sy = (regionTop + rowH * (row + 0.5)) / H + sg.dy * 0.5;
        s.worldW = pxWorld((hpx / PAGE_H) * PAGE_W, 9);
      }
      s.dir.set(i < 2 ? -1 : 1, i % 2 ? -0.45 : 0.55, -1).normalize();
    });

    // ---- the page, large and readable
    const pageD = 5.4;
    if (isWide) {
      const hpx = H * 0.885;
      at(1, 0.585, 0.525, pageD, pageSpec.pos);
      qFrom(1, 0.0, -0.1, 0.0, pageSpec.q);
      pageSpec.worldW = pxWorld((hpx / PAGE_H) * PAGE_W, pageD);
    } else {
      const wpx = Math.min(W * 0.84, ((H * 0.47) / PAGE_H) * PAGE_W);
      at(1, 0.5, 0.345, pageD, pageSpec.pos);
      qFrom(1, 0.0, 0.0, 0.0, pageSpec.q);
      pageSpec.worldW = pxWorld(wpx, pageD);
    }

    // ---- the lines' first flight: off the page and past you
    pieces.forEach((pc) => {
      const dir = new Vector3(pc.local.x * 2.4 + (pc.seed - 0.5) * 0.9, pc.local.y * 1.9 + (hash(pc.seed * 9) - 0.5) * 0.9, 0);
      if (dir.lengthSq() < 0.02) dir.set(pc.seed > 0.5 ? 1 : -1, 0.3, 0);
      dir.normalize();
      const f = frames[1];
      pc.exit
        .copy(f.pos)
        .addScaledVector(f.fwd, 2.4 + pc.seed * 2.5)
        .addScaledVector(f.right, dir.x * (viewW(3) * 0.95 + pc.seed * 2))
        .addScaledVector(f.up, dir.y * (viewH(3) * 0.95 + pc.seed * 2));
      euler.set((pc.seed - 0.5) * 2.2, (hash(pc.seed * 3) - 0.5) * 2.6, (hash(pc.seed * 5) - 0.5) * 1.4);
      pc.exitQ.setFromEuler(euler).premultiply(frames[1].q);
      pc.t0 = 1.02 + clamp((PAPER_LOCAL_H / 2 - pc.local.y) / PAPER_LOCAL_H) * 0.16 + pc.seed * 0.05;
      pc.t1 = pc.t0 + 0.5 + pc.seed * 0.12;
    });

    const destine = (pc: PieceRT, k: number, sx: number, sy: number, d: number, px: number, pitch: number, yaw: number, roll: number, flexK = 0) => {
      at(k, sx, sy, d, pc.dest);
      qFrom(k, pitch, yaw, roll, pc.destQ);
      pc.destS = pxWorld(px, d) / (pc.p.rect.w / PAGE_W);
      pc.destFlexK = flexK;
      // it swoops in from beside the camera
      const f = frames[k];
      const side = pc.seed > 0.5 ? 1 : -1;
      pc.entry
        .copy(f.pos)
        .addScaledVector(f.fwd, -2 + pc.seed * 3)
        .addScaledVector(f.right, side * (3 + pc.seed * 4))
        .addScaledVector(f.up, (hash(pc.seed * 13) - 0.5) * 7);
      euler.set((pc.seed - 0.5) * 2.4, side * 1.3, (hash(pc.seed * 7) - 0.5) * 1.6);
      pc.entryQ.setFromEuler(euler).premultiply(f.q);
    };

    const place = (id: string, sx: number, sy: number, d: number, px: number, pitch = 0, yaw = 0, roll = 0, k = 0) => {
      const pc = pieces.find((c) => c.p.id === id);
      if (pc && pc.destK >= 0) destine(pc, pc.destK, sx, sy, d, px, pitch, yaw, roll, k);
    };
    const mark = (id: string, sx: number, sy: number, d: number, px: number, yaw = 0, pitch = 0, roll = 0) => {
      const mk = marks.find((c) => c.id === id);
      if (!mk) return;
      at(mk.stop, sx, sy, d, mk.pos);
      qFrom(mk.stop, pitch, yaw, roll, mk.q);
      mk.yaw = yaw;
      mk.worldW = pxWorld(px, d);
    };

    // A strip closed into a hoop around a mark. Its length sets its scale, so
    // the words read larger the wider the hoop.
    const hoop = (c: PieceRT, sx: number, sy: number, d: number, radiusPx: number, pitch: number, roll: number, dir: number, phase: number) => {
      const center = at(c.destK, sx, sy, d, new Vector3());
      const tilt = qFrom(c.destK, pitch, 0, roll, new Quaternion());
      const radius = pxWorld(radiusPx, d);
      const L = c.p.rect.w / PAGE_W;
      c.destS = (Math.PI * 2 * radius) / L;
      c.hoop = { center, tilt, radius, k: (Math.PI * 2) / L, dir, phase };
      c.destFlexK = c.hoop.k;
      c.dest.copy(center);
      c.destQ.copy(tilt);
      const f = frames[c.destK];
      const side = c.seed > 0.5 ? 1 : -1;
      c.entry.copy(f.pos).addScaledVector(f.fwd, -2 + c.seed * 3).addScaledVector(f.right, side * (3 + c.seed * 4)).addScaledVector(f.up, (hash(c.seed * 13) - 0.5) * 7);
      c.entryQ.copy(f.q);
    };
    pieces.forEach((c) => (c.hoop = null));
    // On phones the object takes the middle of what the words leave free.
    const free = (stop: number) => {
      const el = document.querySelector<HTMLElement>(`[data-stop="${stop}"] .rw-copy`);
      const panel = el ? el.offsetHeight : H * 0.42;
      const top = 112;
      const bottom = H - panel - 8;
      return { top: top / H, bottom: bottom / H, mid: (top + bottom) / 2 / H, room: bottom - top };
    };
    const [hy, re, vi, sh] = data.roles;
    const K = (rid: string) => pieces.filter((c) => c.p.dest === rid).sort((a, b) => a.p.slot - b.p.slot);
    if (isWide) {
      // Hybridge: a tall run of keys under the mark, on the right.
      const keyScale = Math.min(W * 0.4, H * 0.72) / 608; // screen px per page unit
      const top = 0.345;
      const bot = 0.915;
      K(hy.id).forEach((c, i, all) => {
        const t = all.length > 1 ? i / (all.length - 1) : 0;
        const wpx = c.p.rect.w * keyScale;
        // every strip starts on the same left edge
        destine(c, c.destK, 0.5 + t * 0.012 + wpx / (2 * W), lerp(top, bot, t), 7.2 + t * 0.5, wpx, 0.03, -0.26, 0);
      });
      mark(`role-${hy.id}`, 0.66, 0.2, 7, Math.min(W * 0.32, H * 0.55), -0.22, 0.04);
      // Research: the sentence closed into one wide hoop around the mark.
      const hoopPx = Math.min(W * 0.235, H * 0.37);
      K(re.id).forEach((c) => hoop(c, 0.33, 0.5, 7.4, hoopPx, 0.42, -0.1, -1, 0.4));
      mark(`role-${re.id}`, 0.33, 0.5, 7.4, hoopPx * 1.42, 0.14, -0.02, -0.03);
      // Video: two hoops, tilted against each other, like a gimbal.
      const gimbal = Math.min(W * 0.21, H * 0.34);
      K(vi.id).forEach((c, i) => hoop(c, 0.66, 0.5, 7.2, i === 0 ? gimbal * 1.22 : gimbal, i === 0 ? 0.5 : -0.46, i === 0 ? 0.2 : -0.16, i === 0 ? -1 : 1, 1.1 + i * 2));
      mark(`role-${vi.id}`, 0.66, 0.5, 7.2, gimbal * 1.18, -0.1, 0.03, 0.02);
      // Shure: the word itself, very large, with two flat strips under it.
      K(sh.id).forEach((c, i) => {
        const wpx = (c.p.rect.w / 1320) * Math.min(W * 0.8, H * 1.34);
        destine(c, c.destK, 0.05 + wpx / (2 * W), 0.79 + i * 0.085, 7, wpx, 0.14, 0.1, -0.03);
      });
      mark(`role-${sh.id}`, 0.4, 0.5, 7, Math.min(W * 0.68, H * 1.15), 0.2, 0.06, -0.035);
    } else {
      const frH = free(2);
      const hyMark = marks.find((c) => c.id === `role-${hy.id}`);
      const markWpx = Math.min(W * 0.56, H * 0.3);
      const markHpx = markWpx / (hyMark?.aspect ?? 3.9);
      const keysTop = 112 + markHpx + 20;
      const keysBot = frH.bottom * H - 18;
      const pitch = (keysBot - keysTop) / 9;
      const keyScale = Math.min((W * 0.82) / 608, (pitch * 0.84) / 40);
      K(hy.id).forEach((c, i, all) => {
        const t = all.length > 1 ? i / (all.length - 1) : 0;
        const wpx = c.p.rect.w * keyScale;
        destine(c, c.destK, 0.09 + wpx / (2 * W), lerp(keysTop, keysBot, t) / H, 7, wpx, 0.02, -0.08, 0);
      });
      mark(`role-${hy.id}`, 0.5, (112 + markHpx / 2) / H, 7, markWpx, -0.08, 0.05);
      const frR = free(3);
      const hoopR = Math.min(W * 0.44, frR.room * 0.46);
      K(re.id).forEach((c) => hoop(c, 0.5, frR.mid, 7, hoopR, 0.42, -0.08, -1, 0.4));
      mark(`role-${re.id}`, 0.5, frR.mid, 7, hoopR * 1.25, 0.1, -0.02);
      const frV = free(4);
      const hoopV = Math.min(W * 0.44, frV.room * 0.42);
      K(vi.id).forEach((c, i) => hoop(c, 0.5, frV.mid, 7, i === 0 ? hoopV : hoopV * 0.82, i === 0 ? 0.5 : -0.48, i === 0 ? 0.16 : -0.14, i === 0 ? -1 : 1, 1.1 + i * 2));
      mark(`role-${vi.id}`, 0.5, frV.mid, 7, hoopV * 1.1, 0.05, 0.02);
      const frS = free(5);
      const hoopS = Math.min(W * 0.45, frS.room * 0.44);
      K(sh.id).forEach((c, i) => hoop(c, 0.5, frS.mid, 7, i === 0 ? hoopS : hoopS * 0.84, i === 0 ? 0.48 : -0.46, i === 0 ? 0.14 : -0.12, i === 0 ? -1 : 1, 0.8 + i * 2));
      mark(`role-${sh.id}`, 0.5, frS.mid, 7, hoopS * 1.42, 0.08, 0.03, -0.02);
    }

    // Education: two cards, two marks, equal lanes.
    const edu = data.education;
    if (isWide) {
      edu.forEach((e, i) => {
        const id = `${e.id}-card`;
        const sx = i === 0 ? 0.285 : 0.715;
        place(id, sx, 0.545, 7, Math.min(W * 0.39, H * 0.68), 0.03, i === 0 ? 0.14 : -0.14);
        mark(`edu-${e.id}`, sx, 0.345, 7, i === 0 ? Math.min(W * 0.21, H * 0.36) : Math.min(W * 0.27, H * 0.46), i === 0 ? 0.16 : -0.16, 0.03);
      });
    } else {
      // a mark and its card, a mark and its card, evenly down the screen
      const cw = Math.min(W * 0.88, H * 0.62);
      const rows = edu.map((e, i) => {
        const card = pieces.find((c) => c.p.id === `${e.id}-card`);
        const mk = marks.find((c) => c.id === `edu-${e.id}`);
        const mw = Math.min(W * (i === 0 ? 0.46 : 0.66), H * (i === 0 ? 0.24 : 0.34));
        return { e, mw, mh: mw / (mk?.aspect ?? 3), ch: card ? cw * (card.p.rect.h / card.p.rect.w) : 80 };
      });
      const top = 112;
      // above the PDF links and the small print, however tall they wrap
      const endBlock = hits.endLinks[0]?.closest(".rw-end")?.getBoundingClientRect();
      const bottom = (endBlock ? endBlock.top - stage.top : H - 96) - 6;
      const total = rows.reduce((a0, r) => a0 + r.mh + r.ch, 0);
      const gap = Math.max(4, (bottom - top - total) / (rows.length * 2 + 1));
      let y = top + gap * 0.6;
      rows.forEach((r) => {
        mark(`edu-${r.e.id}`, 0.5, (y + r.mh / 2) / H, 7, r.mw, 0, 0.02);
        y += r.mh + gap * 0.7;
        place(`${r.e.id}-card`, 0.5, (y + r.ch / 2) / H, 7, cw, 0.02, 0);
        y += r.ch + gap * 1.7;
      });
    }

    // ---- his name across the top
    at(0, 0.5, (nameBox.topPx + nameBox.hpx / 2) / H, dT, typeMark.pos);
    typeMark.q.copy(frames[0].q);
    typeMark.worldW = nameBox.tw;

    layoutCloud();
  };

  // ---- the cloud of slips, in islands, one island per group of skills
  const CLOUD_D = 9.2;
  const layoutCloud = () => {
    const G = data.skills.length;
    const f = frames[6];
    const wideSeats = [
      [-0.72, 0.52],
      [-0.26, 0.6],
      [0.22, 0.58],
      [0.7, 0.5],
      [-0.86, 0.0],
      [-0.3, 0.02],
      [0.28, 0.0],
      [0.82, -0.02],
      [-0.56, -0.52],
      [0.02, -0.56],
      [0.56, -0.52],
    ];
    const tallSeats = [
      [-0.5, 0.74],
      [0.5, 0.72],
      [-0.52, 0.42],
      [0.52, 0.38],
      [-0.5, 0.08],
      [0.5, 0.04],
      [-0.52, -0.26],
      [0.52, -0.3],
      [-0.5, -0.58],
      [0.5, -0.62],
      [0, -0.86],
    ];
    const seats = isWide ? wideSeats : tallSeats;
    const unit = isWide ? clamp(H / 900, 0.8, 1.25) * 0.84 : clamp((W / 390) * 0.5, 0.42, 0.7) * clamp(H / 844, 0.72, 1); // screen px per page unit
    const counts = new Array(G).fill(0);
    const topEdge = isWide ? 82 : 150;
    const botEdge = H - (isWide ? 78 : 66);
    const leftEdge = W * 0.03;
    const rightEdge = W - (isWide ? 56 : W * 0.03);
    const midX = (leftEdge + rightEdge) / 2;
    const midY = (topEdge + botEdge) / 2;
    const halfX = (rightEdge - leftEdge) / 2;
    const halfY = (botEdge - topEdge) / 2;
    const boxes = slips.map((sl) => {
      const g = sl.s.group;
      const seat = seats[g % seats.length];
      const nInGroup = data.skills[g].items.length + 1;
      const k = counts[g]++;
      const golden = 2.39996 * k + g;
      const rad = k === 0 ? 0 : Math.sqrt(k / nInGroup);
      const tall = isWide ? 1 : 1;
      const cx = midX + seat[0] * halfX * 0.86 + Math.cos(golden) * rad * halfX * (isWide ? 0.2 : 0.42) * tall;
      const cy = midY - seat[1] * halfY * 0.88 + Math.sin(golden) * rad * halfY * (isWide ? 0.2 : 0.13) * tall;
      const mul = sl.s.label ? 1.24 : 0.92 + hash(sl.i + 3) * 0.24;
      return { sl, cx, cy, tx: cx, ty: cy, w: sl.s.rect.w * unit * mul + 18, h: sl.s.rect.h * unit * mul + 16, mul };
    });
    // the heading and the PDF links keep their ground
    const keepOut = isWide
      ? [{ l: 0, t: 0, r: Math.min(380, W * 0.3), b: 220 }, { l: W - 250, t: 0, r: W, b: 128 }]
      : [{ l: 0, t: 0, r: W, b: 146 }];
    for (let it = 0; isWide && it < 320; it++) {
      for (let a0 = 0; a0 < boxes.length; a0++) {
        const A = boxes[a0];
        for (let b0 = a0 + 1; b0 < boxes.length; b0++) {
          const B = boxes[b0];
          const ox = (A.w + B.w) / 2 - Math.abs(A.cx - B.cx);
          const oy = (A.h + B.h) / 2 - Math.abs(A.cy - B.cy);
          if (ox > 0 && oy > 0) {
            if (oy < ox) {
              const m = (oy / 2) * (A.cy < B.cy ? -1 : 1);
              A.cy += m;
              B.cy -= m;
            } else {
              const m = (ox / 2) * (A.cx < B.cx ? -1 : 1);
              A.cx += m;
              B.cx -= m;
            }
          }
        }
        for (const z of keepOut) {
          const ox = Math.min(A.cx + A.w / 2 - z.l, z.r - (A.cx - A.w / 2));
          const oy = Math.min(A.cy + A.h / 2 - z.t, z.b - (A.cy - A.h / 2));
          if (ox > 0 && oy > 0) {
            if (oy < ox) A.cy = z.b + A.h / 2 + 1;
            else A.cx = A.cx > (z.l + z.r) / 2 ? z.r + A.w / 2 + 1 : z.l - A.w / 2 - 1;
          }
        }
        A.cx = clamp(A.cx, leftEdge + A.w / 2, rightEdge - A.w / 2);
        A.cy = clamp(A.cy, topEdge + A.h / 2, botEdge - A.h / 2);
        if (it < 40) {
          A.cx += (A.tx - A.cx) * 0.01;
          A.cy += (A.ty - A.cy) * 0.01;
        }
      }
    }
    if (!isWide) {
      const gapX = 6;
      const rows: { items: typeof boxes; h: number; group: number }[] = [];
      for (let g = 0; g < G; g++) {
        const members = boxes.filter((b0) => b0.sl.s.group === g);
        let row: typeof boxes = [];
        let used = 0;
        const flush = () => {
          if (row.length) rows.push({ items: row, h: Math.max(...row.map((m) => m.sl.s.rect.h * unit * m.mul)), group: g });
          row = [];
          used = 0;
        };
        members.forEach((m) => {
          const w = m.sl.s.rect.w * unit * m.mul;
          if (used + w > rightEdge - leftEdge && row.length) flush();
          row.push(m);
          used += w + gapX;
        });
        flush();
      }
      const inkH = rows.reduce((a0, r) => a0 + r.h, 0);
      const groupsGaps = G - 1;
      const room = botEdge - topEdge - inkH;
      const rowGap = Math.max(2, Math.min(12, (room * 0.6) / Math.max(1, rows.length - 1)));
      const groupGap = Math.max(0, (room - rowGap * (rows.length - 1)) / Math.max(1, groupsGaps));
      let y = topEdge;
      rows.forEach((r, ri) => {
        if (ri && r.group !== rows[ri - 1].group) y += Math.min(groupGap, 26);
        const total = r.items.reduce((a0, m) => a0 + m.sl.s.rect.w * unit * m.mul, 0);
        const spare = rightEdge - leftEdge - total;
        const gapRow = r.items.length > 1 ? Math.min(gapX + 16, spare / (r.items.length - 1)) : 0;
        let x = leftEdge + Math.max(0, spare - gapRow * (r.items.length - 1)) * hash(ri + 31);
        r.items.forEach((m) => {
          const w = m.sl.s.rect.w * unit * m.mul;
          m.cx = x + w / 2;
          m.cy = y + r.h / 2;
          x += w + gapRow;
        });
        y += r.h + rowGap;
      });
    }
    for (const b0 of boxes) {
      const sl = b0.sl;
      const hz = (hash(sl.i + 40) - 0.5) * (isWide ? 3.2 : 1.2) + (sl.s.label ? 0.8 : 0);
      const d = CLOUD_D - hz;
      at(6, b0.cx / W, b0.cy / H, d, sl.home);
      sl.homeS = pxWorld(unit * b0.mul * PAGE_W, d);
      // burst from the page, past the camera
      const a2 = sl.seed * Math.PI * 2;
      sl.exit
        .copy(frames[1].pos)
        .addScaledVector(frames[1].fwd, 1 + sl.seed * 3)
        .addScaledVector(frames[1].right, Math.cos(a2) * viewW(3) * (0.9 + sl.seed))
        .addScaledVector(frames[1].up, Math.sin(a2) * viewH(3) * (0.9 + sl.seed));
      sl.entry
        .copy(f.pos)
        .addScaledVector(f.fwd, -1.5 + sl.seed * 2)
        .addScaledVector(f.right, Math.cos(a2 * 3) * (3 + sl.seed * 7))
        .addScaledVector(f.up, Math.sin(a2 * 3) * (2 + sl.seed * 5));
    }
    // the tidy version of each group, for when its label is hovered
    const gridD = 6.4;
    const gridPx = (isWide ? 1.28 : 0.86) * PAGE_W;
    const gs = pxWorld(gridPx, gridD);
    const pxPerUnit = gridPx / PAGE_W;
    const maxW = W * (isWide ? 0.62 : 0.92);
    for (let g = 0; g < G; g++) {
      const members = slips.filter((s) => s.s.group === g && !s.s.label);
      const rows: SlipRT[][] = [[]];
      let line = 0;
      members.forEach((m) => {
        const w = m.s.rect.w * pxPerUnit + 8;
        if (line + w > maxW && rows[rows.length - 1].length) {
          rows.push([]);
          line = 0;
        }
        rows[rows.length - 1].push(m);
        line += w;
      });
      const rowH = 36 * (isWide ? 1.28 : 0.86);
      const totalH = rows.length * rowH;
      const cy = (isWide ? 0.46 : 0.36) * H;
      rows.forEach((row, ri) => {
        const rowW = row.reduce((a, m) => a + m.s.rect.w * pxPerUnit + 8, -8);
        let x = (W - rowW) / 2;
        const y = cy - totalH / 2 + ri * rowH + rowH / 2;
        row.forEach((m) => {
          const w = m.s.rect.w * pxPerUnit;
          at(6, (x + w / 2) / W, y / H, gridD, m.grid);
          m.gridS = gs;
          x += w + 8;
        });
      });
      const label = slips.find((s) => s.s.group === g && s.s.label);
      if (label) {
        at(6, 0.5, (cy - totalH / 2 - rowH * 0.9) / H, gridD, label.grid);
        label.gridS = gs * 1.1;
      }
    }
  };

  layout();

  // ------------------------------------------------------------- input
  let pnx = 0;
  let pny = 0;
  let spx = 0;
  let spy = 0;
  let pointerSeen = false;
  let lastPointerAt = -1e9;
  let chosen = 0;
  let hoverIdx: number | null = null;
  let sectionHover: string | null = null;
  const sectionLift: Record<string, number> = { experience: 0, skills: 0, education: 0 };
  let activeKey = 0;
  let groupHover: number | null = null;
  let groupDim = 0;

  // ------------------------------------------------------------- frame
  const vA = new Vector3();
  const vB = new Vector3();
  const vC = new Vector3();
  const qA = new Quaternion();
  const qB = new Quaternion();
  const qC = new Quaternion();
  const sV = new Vector3();
  const mat = new Matrix4();
  const camPos = new Vector3();
  const camLook = new Vector3();
  const axis = new Vector3();
  const heroPos = sheets.map(() => new Vector3());
  const heroQ = sheets.map(() => new Quaternion());
  const heroS = sheets.map(() => 1);
  const qRoll = new Quaternion();
  const frame1Inverse = frames[1].q.clone().invert();
  const Z = new Vector3(0, 0, 1);
  const up = new Vector3(0, 1, 0);
  let last = performance.now();
  const born = last;
  // Only a first arrival at the top gets the entrance.
  const introOn = motionStart() < 0.02;
  let P = 0;
  let speed = 0;
  let camVzLast = 0;

  const projectPx = (v: Vector3, out: { x: number; y: number }) => {
    vC.copy(v).project(camera);
    out.x = (vC.x * 0.5 + 0.5) * W;
    out.y = (0.5 - vC.y * 0.5) * H;
  };
  const pt = { x: 0, y: 0 };
  const placeHit = (el: HTMLElement | undefined, corners: Vector3[], on: boolean) => {
    if (!el) return;
    if (!on) {
      if (el.dataset.on !== "0") {
        el.dataset.on = "0";
        el.style.transform = "translate3d(-300vw,0,0)";
      }
      return;
    }
    let a = 1e9;
    let b = 1e9;
    let c = -1e9;
    let d = -1e9;
    for (const v of corners) {
      projectPx(v, pt);
      a = Math.min(a, pt.x);
      b = Math.min(b, pt.y);
      c = Math.max(c, pt.x);
      d = Math.max(d, pt.y);
    }
    el.dataset.on = "1";
    el.style.transform = `translate3d(${a.toFixed(1)}px,${b.toFixed(1)}px,0) scale(${((c - a) / 100).toFixed(3)},${((d - b) / 100).toFixed(3)})`;
  };
  const cornerSet = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  const rectCorners = (pos: Vector3, q: Quaternion, w: number, h: number) => {
    cornerSet[0].set(-w / 2, -h / 2, 0).applyQuaternion(q).add(pos);
    cornerSet[1].set(w / 2, -h / 2, 0).applyQuaternion(q).add(pos);
    cornerSet[2].set(w / 2, h / 2, 0).applyQuaternion(q).add(pos);
    cornerSet[3].set(-w / 2, h / 2, 0).applyQuaternion(q).add(pos);
    return cornerSet;
  };

  // Fewer pixels when frames run slow and that helps, and back again when there is room.
  const governor = new Governor({
    steps: [1, 0.85, 0.72],
    apply: (scale) => {
      dpr = Math.max(1, baseDpr * scale);
      layout();
    },
  });

  function frame(now: number, p: number, vel: number) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const time = (now - born) / 1000;
    P = p;
    speed = damp(speed, Math.min(1, Math.abs(vel) / 1.2), 8, dt);
    shared.uTime.value = time;

    // ---- pointer and light
    spx = damp(spx, pnx, 5, dt);
    spy = damp(spy, pny, 5, dt);
    const idle = !pointerSeen || now - lastPointerAt > 3500;
    const wx = idle ? Math.sin(time * 0.31) * 0.62 : spx;
    const wy = idle ? Math.sin(time * 0.23 + 1.3) * 0.45 - 0.1 : spy;
    shared.uEnv.value = damp(shared.uEnv.value, spx * 0.26 + Math.sin(time * 0.07) * 0.1, 2.5, dt);

    // ---- camera on its rail
    const u = clamp(P / LAST);
    posCurve.getPoint(u, camPos);
    lookCurve.getPoint(u, camLook);
    camera.position.copy(camPos);
    camera.up.copy(up);
    camera.lookAt(camLook);
    const k = Math.min(LAST - 1, Math.floor(P));
    const fr = P - k;
    const roll = lerp(KEYS[k].roll, KEYS[k + 1].roll, ease(fr)) + Math.sin(Math.PI * fr) * (k % 2 ? 0.09 : -0.09) * (k >= 1 ? 1 : 0);
    camera.quaternion.multiply(qRoll.setFromAxisAngle(Z, roll));
    // a little parallax from the pointer
    camera.position.x += spx * 0.14;
    camera.position.y -= spy * 0.09;
    camera.updateMatrixWorld();

    const cd = 4.4;
    shared.uCursor.value
      .copy(camera.position)
      .addScaledVector(vA.set(0, 0, -1).applyQuaternion(camera.quaternion), cd)
      .addScaledVector(vA.set(1, 0, 0).applyQuaternion(camera.quaternion), (wx * viewW(cd)) / 2)
      .addScaledVector(vA.set(0, 1, 0).applyQuaternion(camera.quaternion), (-wy * viewH(cd)) / 2);
    shared.uCursorI.value = 1.45 + speed * 0.6;

    // ---- the four sheets
    const leave = clamp(P * 6);
    sheets.forEach((s, i) => {
      const b = s.batch;
      const isChosen = i === chosen;
      const e = ease(clamp(P / 0.96));
      const out = ease(clamp(P / 0.72));
      const endE = isWide && H >= 620 ? ease(clamp((P - 6.3) / 0.62)) : 0;
      const gone = endE <= 0 && ((!isChosen && out >= 1) || (isChosen && P >= 0.985));
      b.mesh.visible = !gone;

      s.hover = damp(s.hover, s.hoverT * (1 - leave), 6, dt);
      s.press = damp(s.press, s.pressT, 14, dt);
      s.pick = damp(s.pick, s.pickT, 4.2, dt);
      if (s.pickT > 0 && s.pick > 0.94) s.pickT = 0;

      // spin: the drag, its coast, and the pull back to a face
      if (s.dragging) {
        s.vy *= Math.exp(-dt * 10);
        s.vp *= Math.exp(-dt * 10);
      } else {
        const target = P > 0.015 ? Math.round(s.yaw / (Math.PI * 2)) * Math.PI * 2 : Math.round(s.yaw / Math.PI) * Math.PI;
        const pull = Math.abs(s.vy) < 2.4 ? 22 : 0;
        s.vy += (target - s.yaw) * pull * dt;
        s.vy *= Math.exp(-dt * (pull ? 5.2 : 0.9));
        s.yaw += s.vy * dt;
        s.vp += -s.pitch * 26 * dt;
        s.vp *= Math.exp(-dt * 6);
        s.pitch += s.vp * dt;
      }
      const faceNow = Math.round(s.yaw / Math.PI);
      if (faceNow !== s.lastFace) {
        s.lastFace = faceNow;
        events.onSheetFlip?.(i);
      }
      // now and then a sheet turns all the way round on its own
      let autoYaw = 0;
      if (s.auto >= 0) {
        const a = (time - s.autoFrom) / 9;
        if (a >= 1 || s.hoverT || s.dragging || P > 0.02) s.auto = -1;
        else autoYaw = ease(a) * Math.PI * 2;
      } else {
        const slot = Math.floor(time / 13);
        if (slot > 0 && slot % n === i && s.autoFrom < slot * 13 && P < 0.02 && !s.hoverT && !s.dragging) {
          s.auto = 0;
          s.autoFrom = time;
        }
      }

      const sway = time * 0.33 + s.seed * 7;
      const entered = introOn ? out3(clamp((time - i * 0.1) / 1.7)) : 1;
      const h = s.hover;
      const hr = 1 - h * 0.9;
      const pk = s.pick;
      // hovered: it drifts toward you. Picked: it flies to the front.
      const dist = lerp(s.dist - h * 1.7 - s.press * 0.3, 3.9, pk) + (1 - entered) * 22;
      const sx = lerp(s.sx, 0.5, pk);
      const sy = lerp(s.sy - h * 0.018, 0.5, pk) + (1 - entered) * 0.1;
      at(0, sx, sy, dist, vA);
      vA.y += Math.sin(sway * 0.9) * 0.05 * hr;
      vA.x += Math.cos(sway * 0.7) * 0.03 * hr;
      const yaw = s.yaw + autoYaw + (1 - entered) * (2.6 + i * 0.5) * (i % 2 ? -1 : 1) + (s.base.yaw + Math.sin(sway) * 0.2) * hr * (1 - pk) + spx * 0.18;
      const pitch = s.pitch + (1 - entered) * 0.7 + (s.base.pitch + Math.sin(sway * 0.77 + 1.2) * 0.07) * hr * (1 - pk) + spy * 0.12;
      const rl = (s.base.roll + Math.sin(sway * 0.5) * 0.03) * hr * (1 - pk);
      qFrom(0, pitch, yaw, rl, qA);
      heroS[i] = s.worldW;

      let bendK = (0.62 + Math.sin(sway * 1.3) * 0.34) * (i % 2 ? -1 : 1) * hr + s.vy * 0.14 + speed * 0.5;
      let ripple = 0.0028 + speed * 0.008;
      let bendY = Math.sin(sway * 0.8 + 2) * 0.05 * hr;
      let twist = Math.sin(sway * 0.6) * 0.16 * hr + s.vp * 0.08;

      if (isChosen) {
        vA.lerp(pageSpec.pos, e);
        vA.addScaledVector(frames[0].fwd, -Math.sin(Math.PI * e) * 1.1);
        qA.slerp(qFrom(1, spy * 0.04, spx * 0.07, 0, qB).multiply(qC.copy(pageSpec.q).premultiply(frame1Inverse)), e);
        heroS[i] = lerp(s.worldW, pageSpec.worldW, e);
        const settle = 1 - smooth(0.7, 0.97, P);
        bendK = bendK * settle + Math.sin(Math.PI * e) * 0.6;
        ripple *= settle;
        bendY *= settle;
        twist *= settle;
      } else if (out > 0) {
        vA.addScaledVector(s.dir, out * 16);
        axis.set(s.dir.y, s.dir.x, 0.4).normalize();
        qA.multiply(qB.setFromAxisAngle(axis, out * 2.4));
      }
      // the last stop: four small sheets again, one over each link
      if (endE > 0) {
        const cell = endRects[i];
        const hEnd = cell ? (Math.min(H * 0.17, 168)) : 120;
        const dEnd = 7;
        const lift = s.hoverT * 0.02;
        at(7, cell ? cell.x / W : 0.5, cell ? (cell.y - hEnd / 2 - 12) / H - lift : 0.8, dEnd - s.hoverT * 0.7, vB);
        qFrom(7, spy * 0.1 + Math.sin(sway) * 0.06, spx * 0.18 + Math.sin(sway * 0.7) * 0.2, Math.sin(sway * 0.5) * 0.03, qB);
        vA.copy(frames[7].pos).addScaledVector(frames[7].fwd, -1).addScaledVector(frames[7].right, i < 2 ? -6 : 6).addScaledVector(frames[7].up, -2 + i);
        vA.lerp(vB, endE);
        qA.copy(frames[7].q).multiply(qC.setFromAxisAngle(up, (1 - endE) * 3));
        qA.slerp(qB, endE);
        heroS[i] = pxWorld((hEnd / PAGE_H) * PAGE_W, dEnd);
        bendK = (0.5 + Math.sin(sway) * 0.3) * (i % 2 ? -1 : 1);
        ripple = 0.002;
        bendY = 0;
        twist = Math.sin(sway * 0.6) * 0.1;
      }
      if (endE <= 0) {
        heroPos[i].copy(vA);
        heroQ[i].copy(qA);
      }
      sV.setScalar(heroS[i]);
      mat.compose(vA, qA, sV);
      b.mesh.setMatrixAt(0, mat);
      b.state[1] = isChosen ? lerp(0.86 + h * 0.2 + pk * 0.1, 1, smooth(0.7, 0.985, P)) : 0.86 + h * 0.2 + pk * 0.1;
      b.state[2] = isChosen && endE <= 0 ? 1 - smooth(0.7, 0.985, P) : 1;
      b.flex.set([bendK, bendY, twist, ripple], 0);
      b.commit();

      // the invisible link follows its sheet
      const hw = heroS[i];
      placeHit(hits.sheets[i], rectCorners(vA, qA, hw, hw * PAPER_LOCAL_H), (P < 0.45 && !gone) || (P > 6.85 && endE > 0));

      // a thin line ties each sheet to its label
      const line = hits.tethers[i];
      if (line) {
        if (P < 0.5 && isWide && entered > 0.98) {
          vB.set(0, -hw * PAPER_LOCAL_H * 0.5, 0).applyQuaternion(qA).add(vA);
          projectPx(vB, pt);
          const r = cellRects[i];
          line.setAttribute("x1", pt.x.toFixed(1));
          line.setAttribute("y1", pt.y.toFixed(1));
          line.setAttribute("x2", (r ? r.x : pt.x).toFixed(1));
          line.setAttribute("y2", (r ? r.y : pt.y).toFixed(1));
          line.style.opacity = String((0.3 + h * 0.7) * (1 - clamp(P * 5)));
        } else line.style.opacity = "0";
      }
    });

    // ---- the page in pieces
    const chosenPos = heroPos[chosen];
    const chosenQ = heroQ[chosen];
    const chosenS = heroS[chosen];
    const piecesOn = P >= 0.985;
    pieceBatch.mesh.visible = piecesOn && P < LAST + 1;
    slipBatch.mesh.visible = piecesOn && (P < 2 || P > 5.05);
    Object.keys(sectionLift).forEach((g) => {
      sectionLift[g] = damp(sectionLift[g], sectionHover === g && P < 1.03 ? 1 : 0, 9, dt);
    });

    if (pieceBatch.mesh.visible) {
      // the blank sheet the lines lifted from drifts off behind them
      const be = ease(clamp((P - 1.02) / 0.24));
      if (be >= 1) {
        sV.setScalar(0);
        mat.compose(vA.set(0, 0, 0), qA.identity(), sV);
      } else {
        vA.copy(chosenPos).addScaledVector(frames[1].fwd, 0.002 + be * 10).addScaledVector(frames[1].right, be * 2.2).addScaledVector(frames[1].up, be * -1.2);
        axis.set(0.4, 1, 0.2).normalize();
        qA.copy(chosenQ).multiply(qB.setFromAxisAngle(axis, be * 1.5));
        sV.setScalar(chosenS * (1 - be * 0.45));
        mat.compose(vA, qA, sV);
      }
      pieceBatch.mesh.setMatrixAt(0, mat);
      pieceBatch.state.set([1, 1 - be * 0.92, smooth(1.0, 1.05, P), 0.5], 0);
      pieceBatch.flex.set([be * 0.25, 0, be * 0.1, be * 0.006], 0);

      for (const pc of pieces) {
        const i = pc.i;
        const sec = pc.p.group === "head" ? 0 : sectionLift[pc.p.group] ?? 0;
        const isKey = pc.p.id.includes("-key-");
        let scale = 0;
        let morph = 0;
        let lit = 1;
        let rim = 0;
        let bendK = 0;
        let ripple = 0;
        let twist = 0;
        const stopK = pc.destK;
        const direct = stopK === 2;

        const end = direct ? Math.max(pc.t1, 1.72 + pc.seed * 0.2) : pc.t1;
        if (P < end) {
          // leaving the page
          const e = ease(clamp((P - pc.t0) / (end - pc.t0)));
          const pre = smooth(1.0, 1.06, P);
          vA.copy(pc.local).multiplyScalar(chosenS);
          vA.z += (pc.seed * 0.1 + 0.02) * pre + sec * 0.1;
          vA.applyQuaternion(chosenQ).add(chosenPos);
          const target = direct ? pc.dest : pc.exit;
          const tq = direct ? pc.destQ : pc.exitQ;
          vB.lerpVectors(vA, target, e);
          // a sideways arc, and a tumble mid flight
          axis.set(pc.seed - 0.5, hash(pc.seed * 2) - 0.5, hash(pc.seed * 4) - 0.5).normalize();
          vB.addScaledVector(axis, Math.sin(Math.PI * e) * (0.5 + pc.seed * 1.2));
          qA.copy(chosenQ);
          if (sec > 0) qA.multiply(qB.setFromAxisAngle(rtAxis, -sec * 0.03));
          qA.slerp(tq, e);
          qA.multiply(qB.setFromAxisAngle(axis, Math.sin(Math.PI * e) * (0.6 + pc.seed)));
          scale = direct ? lerp(chosenS, pc.destS, e) : chosenS;
          morph = pc.p.hi > 0 ? smooth(0.0, 0.28, e) : 0;
          rim = pre;
          ripple = Math.sin(Math.PI * e) * 0.012;
          bendK = Math.sin(Math.PI * e) * (pc.seed - 0.5) * 2.2;
          twist = Math.sin(Math.PI * e) * (pc.seed - 0.5) * 1.2;
        } else if (stopK >= 3 && P > stopK - 0.88 && P < stopK + 0.92) {
          // arriving at its stop
          const e = ease(clamp((P - (stopK - 0.88)) / 0.84));
          if (pc.hoop) {
            const H0 = pc.hoop;
            const theta = H0.phase + H0.dir * (time * 0.16 + (P - stopK) * 1.2) + spx * 0.5;
            qC.copy(H0.tilt).multiply(qB.setFromAxisAngle(up, theta));
            pc.dest.copy(H0.center).add(vC.set(0, 0, H0.radius).applyQuaternion(qC));
            pc.destQ.copy(qC);
          }
          vB.lerpVectors(pc.entry, pc.dest, e);
          axis.set(pc.seed - 0.5, hash(pc.seed * 2) - 0.5, hash(pc.seed * 4) - 0.5).normalize();
          vB.addScaledVector(axis, Math.sin(Math.PI * e) * 0.6);
          qA.copy(pc.entryQ).slerp(pc.destQ, e);
          scale = pc.destS;
          morph = pc.p.hi > 0 ? 1 : 0;
          rim = pc.hoop ? 0.42 : 1;
          ripple = Math.sin(Math.PI * e) * 0.01;
          bendK = pc.hoop ? pc.destFlexK * Math.max(e, 0.02) : pc.destFlexK * e + Math.sin(Math.PI * e) * (pc.seed - 0.5) * 1.5;
        } else if (direct && P < stopK + 0.92) {
          vB.copy(pc.dest);
          qA.copy(pc.destQ);
          scale = pc.destS;
          morph = 1;
          rim = 1;
        }

        // at rest: they breathe, and the keys answer the pointer
        if (scale > 0 && stopK >= 2) {
          const onStop = 1 - smooth(0.0, 0.4, Math.abs(P - stopK));
          if (onStop > 0) {
            const sway = time * 0.5 + pc.seed * 9;
            const amp = isKey ? 0.005 : pc.hoop ? 0 : 0.02;
            vB.addScaledVector(frames[stopK].up, Math.sin(sway) * amp * onStop);
            vB.addScaledVector(frames[stopK].right, Math.cos(sway * 0.8) * amp * 0.7 * onStop);
            if (isKey) {
              const slot = pc.p.slot;
              const isOn = slot === activeKey ? 1 : 0;
              pc.active = damp(pc.active, isOn * onStop, 9, dt);
              // the wave near the pointer
              projectPx(pc.dest, pt);
              const near = pointerSeen ? Math.exp(-Math.pow((pt.y / H - (pny * 0.5 + 0.5)) / 0.05, 2)) * smooth(0.2, 0.5, pnx * 0.5 + 0.5) : 0;
              pc.near = damp(pc.near, near * onStop, 10, dt);
              const push = (pc.active * 0.55 + pc.near * 0.16) * (isWide ? 1 : 0.3);
              vB.addScaledVector(frames[stopK].fwd, -push);
              vB.addScaledVector(frames[stopK].right, -pc.active * (isWide ? 0.5 : 0.04) - pc.near * 0.08);
              qB.setFromAxisAngle(up, (isWide ? 0.3 : 0.08) * pc.active);
              qA.multiply(qB);
              lit = 0.56 + pc.active * 0.5 + pc.near * 0.3;
              ripple = 0.001 + pc.near * 0.003;
            } else {
              lit = 1;
              ripple = pc.hoop ? 0 : Math.max(ripple, 0.0016);
              if (!pc.hoop) {
                const w0 = pc.destS * (pc.p.rect.w / PAGE_W);
                const h0 = pc.destS * (pc.p.rect.h / PAGE_W);
                let a0 = 1e9;
                let b0 = 1e9;
                let c0 = -1e9;
                let d0 = -1e9;
                for (const v of rectCorners(pc.dest, pc.destQ, w0, h0)) {
                  projectPx(v, pt);
                  a0 = Math.min(a0, pt.x);
                  b0 = Math.min(b0, pt.y);
                  c0 = Math.max(c0, pt.x);
                  d0 = Math.max(d0, pt.y);
                }
                const px0 = (pnx * 0.5 + 0.5) * W;
                const py0 = (pny * 0.5 + 0.5) * H;
                const over = pointerSeen && onStop > 0.8 && px0 > a0 && px0 < c0 && py0 > b0 && py0 < d0 ? 1 : 0;
                if (over && !pc.lift) events.onLineHover?.(pc.p.id, pc.i % 12);
                pc.lift = over;
                pc.near = damp(pc.near, over, 9, dt);
                vB.addScaledVector(frames[stopK].fwd, -pc.near * 0.34);
                lit = 0.92 + pc.near * 0.14;
                rim = 1 + pc.near * 0.6;
              }
            }
          }
        }

        sV.setScalar(scale);
        mat.compose(vB, qA, sV);
        pieceBatch.mesh.setMatrixAt(i, mat);
        pieceBatch.state[i * 4] = morph;
        pieceBatch.state[i * 4 + 1] = lit;
        pieceBatch.state[i * 4 + 2] = rim;
        pieceBatch.flex.set([bendK, 0, twist, ripple], i * 4);
      }
      pieceBatch.commit();

      // the zones on the page and the keys
      for (const s of hits.sections) {
        const z = layoutData.zones[s.name];
        vA.set((z.x + z.w / 2) / PAGE_W - 0.5, PAPER_LOCAL_H / 2 - (z.y + z.h / 2) / PAGE_W, 0).multiplyScalar(chosenS).applyQuaternion(chosenQ).add(chosenPos);
        placeHit(s.el, rectCorners(vA, chosenQ, (z.w / PAGE_W) * chosenS, (z.h / PAGE_W) * chosenS), Math.abs(P - 1) < 0.22);
      }
      const keysOn = Math.abs(P - 2) < 0.2;
      for (const pc of pieces) {
        if (!pc.p.id.includes("-key-")) continue;
        const el = hits.keys[pc.p.slot];
        const w = pc.destS * (pc.p.rect.w / PAGE_W);
        const h = pc.destS * (pc.p.rect.h / PAGE_W);
        placeHit(el, rectCorners(pc.dest, pc.destQ, w, h * 1.3), keysOn);
      }
    } else {
      for (const s of hits.sections) placeHit(s.el, cornerSet, false);
      for (const el of hits.keys) placeHit(el, cornerSet, false);
    }

    // ---- the slips
    if (slipBatch.mesh.visible) {
      const inCloud = P > 5.05;
      groupDim = damp(groupDim, groupHover !== null && Math.abs(P - 6) < 0.4 ? 1 : 0, 7, dt);
      const R = isWide ? 150 : 90;
      const px = (pnx * 0.5 + 0.5) * W;
      const py = (pny * 0.5 + 0.5) * H;
      const cloudOn = Math.abs(P - 6) < 0.45;
      for (const sl of slips) {
        const i = sl.i;
        let scale = 0;
        let morph = 0;
        let rim = 0;
        let lit = 1;
        let bendK = 0;
        if (!inCloud) {
          const e = ease(clamp((P - sl.t0) / 0.5));
          if (e < 1) {
            const pre = smooth(1.0, 1.05, P);
            vA.copy(sl.local).multiplyScalar(chosenS);
            vA.z += sl.seed * 0.06 * pre;
            vA.applyQuaternion(chosenQ).add(chosenPos);
            vB.lerpVectors(vA, sl.exit, e);
            axis.set(sl.seed - 0.5, hash(sl.seed * 2) - 0.5, hash(sl.seed * 4) - 0.5).normalize();
            qA.copy(chosenQ).multiply(qB.setFromAxisAngle(axis, e * (2 + sl.seed * 5)));
            scale = chosenS;
            morph = smooth(0, 0.2, e);
            rim = pre;
            bendK = Math.sin(Math.PI * e) * (sl.seed - 0.5) * 4;
          }
        } else if (P < 6.92) {
          const e = ease(clamp((P - (5.1 + sl.seed * 0.16)) / 0.72));
          // the sweep pushes slips aside; a spring brings them home
          vB.lerpVectors(sl.entry, sl.home, e);
          if (cloudOn) {
            projectPx(vB, pt);
            const sx = pt.x + sl.dx;
            const sy = pt.y + sl.dy;
            let fx = 0;
            let fy = 0;
            const dx = sx - px;
            const dy = sy - py;
            const r = Math.hypot(dx, dy) + 0.001;
            if (r < R && pointerSeen) {
              const f = Math.pow(1 - r / R, 2) * 5200;
              fx += (dx / r) * f;
              fy += (dy / r) * f;
              sl.spin += f * dt * 0.0011 * (sl.seed > 0.5 ? 1 : -1);
              if (!sl.touched && r < R * 0.42) {
                sl.touched = true;
                events.onSkillTouch?.(i, sl.s);
              }
            }
            if (sl.touched && r > R * 0.62) sl.touched = false;
            sl.vx += (fx - sl.dx * 14) * dt;
            sl.vy += (fy - sl.dy * 14) * dt;
            const dmp = Math.exp(-dt * 4.2);
            sl.vx *= dmp;
            sl.vy *= dmp;
            sl.dx += sl.vx * dt;
            sl.dy += sl.vy * dt;
          }
          const wpp = viewH(CLOUD_D) / H;
          vB.addScaledVector(frames[6].right, sl.dx * wpp);
          vB.addScaledVector(frames[6].up, -sl.dy * wpp);
          sl.spin *= Math.exp(-dt * 1.4);
          const t = time * 0.22 + sl.seed * 20;
          const drift = isWide ? 0.03 : 0.012;
          vB.addScaledVector(frames[6].up, Math.sin(t) * drift);
          vB.addScaledVector(frames[6].right, Math.cos(t * 0.8) * drift);

          const isG = groupHover === sl.s.group;
          sl.mix = damp(sl.mix, isG && cloudOn ? 1 : 0, 8, dt);
          const dim = groupDim * (isG ? 0 : 1);
          if (dim > 0) vB.addScaledVector(frames[6].fwd, dim * 1.6);
          if (sl.mix > 0.001) vB.lerp(sl.grid, ease(sl.mix));

          const wob = (1 - sl.mix) * ((isWide ? 1 : 0.5) + Math.min(3, Math.abs(sl.spin)));
          const py2 = (Math.sin(t * 1.3) * 0.2 + (sl.seed - 0.5) * 0.3) * wob;
          const yw2 = (Math.sin(t * 0.9 + 2) * 0.32 + (hash(sl.seed * 8) - 0.5) * 0.4) * wob + sl.spin;
          const rl2 = (Math.sin(t * 0.7 + 4) * 0.03 + (hash(sl.seed * 6) - 0.5) * 0.06) * wob;
          qFrom(6, py2, yw2, rl2, qA);
          if (e < 1) {
            axis.set(sl.seed - 0.5, hash(sl.seed * 2) - 0.5, 0.3).normalize();
            qA.multiply(qB.setFromAxisAngle(axis, (1 - e) * (3 + sl.seed * 3)));
          }
          scale = lerp(sl.homeS, sl.gridS, ease(sl.mix));
          morph = 1;
          rim = 0.32 + sl.mix * 0.4 + Math.min(0.6, Math.abs(sl.spin) * 0.4);
          const nearBoost = Math.exp(-Math.pow(Math.hypot(sl.dx, sl.dy) / 40, 2)) < 0.8 ? 0.2 : 0;
          sl.lit = damp(sl.lit, (sl.s.label ? 1.02 : 0.86) - dim * 0.62 + sl.mix * 0.25 + nearBoost, 8, dt);
          lit = sl.lit;
          bendK = Math.sin(Math.PI * e) * (sl.seed - 0.5) * 3;
        }
        sV.setScalar(scale);
        mat.compose(vB, qA, sV);
        slipBatch.mesh.setMatrixAt(i, mat);
        slipBatch.state[i * 4] = morph;
        slipBatch.state[i * 4 + 1] = lit;
        slipBatch.state[i * 4 + 2] = rim;
        slipBatch.flex.set([bendK, 0, 0, 0], i * 4);
      }
      slipBatch.commit();
    }

    // ---- the scraps along the way
    const travel = smooth(0.05, 0.2, Math.abs(P - Math.round(P)));
    scrapBatch.mesh.visible = P > 1.02 && P < LAST && travel > 0.001;
    if (scrapBatch.mesh.visible) {
      for (const sc of scraps) {
        const d = camera.position.distanceTo(sc.base);
        const near = smooth(30, 12, d) * travel;
        if (near < 0.01) {
          sV.setScalar(0);
          mat.compose(sc.base, qA.identity(), sV);
        } else {
          qA.setFromAxisAngle(sc.axis, sc.phase + time * sc.rate);
          sV.setScalar(sc.size * (0.4 + near * 0.6));
          mat.compose(sc.base, qA, sV);
        }
        scrapBatch.mesh.setMatrixAt(sc.i, mat);
        scrapBatch.state[sc.i * 4 + 1] = 0.82 * near;
        scrapBatch.flex.set([Math.sin(time * 0.5 + sc.phase) * 1.6, 0, Math.cos(time * 0.4 + sc.phase) * 0.6, 0.004], sc.i * 4);
      }
      scrapBatch.commit();
    }

    // ---- the marks
    for (const mk of marks) {
      const u0 = mk.mat.uniforms;
      if (mk === typeMark) {
        // the camera goes straight through his name
        const showT = P < 1.75;
        mk.mesh.visible = showT;
        if (showT) {
          mk.mesh.position.copy(mk.pos);
          mk.mesh.quaternion.copy(mk.q);
          (u0.uSize.value as Vector2).set(mk.worldW, mk.worldW / mk.aspect);
          typeLit = lerp(1, 0.5, smooth(0.2, 0.9, P));
          u0.uLit.value = typeLit * (introOn ? smooth(0, 1.1, time) : 1);
          u0.uSweep.value = introOn ? lerp(-0.7, 1.9, clamp((time - 0.5) / 1.6)) : -1;
          (u0.uAxes.value as Matrix3).setFromMatrix4(m4.makeRotationFromQuaternion(mk.q));
          const shade = u0.uShade.value as Vector4[];
          for (let si = 0; si < 4; si++) {
            const sh = sheets[si];
            if (!sh || !sh.batch.mesh.visible) {
              shade[si].set(-9, -9, 0, 0);
              continue;
            }
            const dcam = camera.position.distanceTo(heroPos[si]);
            vA.copy(heroPos[si]).project(camera);
            const w2 = heroS[si] * 0.5;
            // its size on screen, offset as if the light came from above left
            const scr = 1 / viewH(dcam);
            shade[si].set(vA.x * 0.5 + 0.5 + 0.012, vA.y * 0.5 + 0.5 - 0.02, (w2 * scr) / aspect, w2 * PAPER_LOCAL_H * scr);
          }
        }
        continue;
      }
      const dk = P - mk.stop;
      const vis = dk > -0.98 && dk < 1.0;
      mk.mesh.visible = vis;
      if (!vis) continue;
      const arrive = ease(clamp((dk + 0.95) / 0.9));
      const sway = time * 0.42 + mk.seed * 10;
      mk.mesh.position.copy(mk.pos).addScaledVector(frames[mk.stop].up, Math.sin(sway) * mk.float).addScaledVector(frames[mk.stop].right, Math.cos(sway * 0.8) * mk.float * 0.6);
      const onStop = 1 - smooth(0.0, 0.35, Math.abs(dk));
      qB.setFromEuler(euler.set(spy * 0.16 * onStop + Math.sin(sway * 0.7) * 0.03, spx * 0.24 * onStop + Math.sin(sway * 0.5) * 0.05 + (1 - arrive) * 1.2, 0));
      mk.mesh.quaternion.copy(mk.q).multiply(qB);
      mk.mesh.updateMatrixWorld();
      (u0.uAxes.value as Matrix3).setFromMatrix4(m4.makeRotationFromQuaternion(mk.mesh.quaternion));
      (u0.uSize.value as Vector2).set(mk.worldW, mk.worldW / mk.aspect);
      u0.uDepth.value = lerp(0.01, mk.depth, arrive);
      u0.uLit.value = smooth(-0.98, -0.5, dk);
      const passing = lerp(-0.7, 1.9, clamp((dk + 0.6) / 0.62));
      // on hover the band follows the pointer across the mark
      const mw = mk.worldW;
      const mh = mw / mk.aspect;
      let a1 = 1e9;
      let b1 = 1e9;
      let c1 = -1e9;
      let d1 = -1e9;
      for (const v of rectCorners(mk.pos, mk.q, mw, mh)) {
        projectPx(v, pt);
        a1 = Math.min(a1, pt.x);
        b1 = Math.min(b1, pt.y);
        c1 = Math.max(c1, pt.x);
        d1 = Math.max(d1, pt.y);
      }
      const px1 = (pnx * 0.5 + 0.5) * W;
      const py1 = (pny * 0.5 + 0.5) * H;
      const over = pointerSeen && onStop > 0.8 && px1 > a1 && px1 < c1 && py1 > b1 && py1 < d1;
      if (over && !mk.over) events.onMarkHover?.(mk.id.replace(/^(role|edu)-/, ""), marks.indexOf(mk));
      mk.over = over;
      const follow = (px1 - a1) / Math.max(1, c1 - a1) + ((py1 - b1) / Math.max(1, d1 - b1)) * 0.35;
      mk.band = damp(mk.band, over ? follow : passing, over ? 16 : 6, dt);
      u0.uSweep.value = dk < 0.02 && dk > -0.02 ? mk.band : passing;
    }

    // ---- dust
    const camVz = (camPos.z - camVzLast) / Math.max(dt, 0.001);
    camVzLast = camPos.z;
    lineU.uStretch.value = Math.min(9, Math.abs(camVz) * 0.11);
    lineU.uGain.value = Math.min(0.9, Math.abs(camVz) * 0.02);
    lines.visible = lineU.uGain.value > 0.01;

    // ---- draw
    const behindOn = P < 1.2;
    shared.uBehind.value = behindOn ? 0.5 : 0;
    if (behindOn) {
      // his name alone, softened, so it glows through the paper
      camera.layers.set(1);
      renderer.setRenderTarget(finish.behind);
      renderer.clear();
      renderer.render(scene, camera);
      camera.layers.set(0);
      finish.blurBehind();
    }
    finish.beginScene(scene, camera);
    finish.finish({ bloom: 0.2 + speed * 0.25, chroma: speed * 1.1, exposure: 1, time });

    // ---- slow machine: give up pixels, not the picture
    governor.frame(dt * 1000, Math.abs(speed) > 0.02);
  }

  const rtAxis = new Vector3(1, 0, 0);

  // ------------------------------------------------------------- compile
  // Warm the shaders before the first visible frame, in the background, so nothing hitches.
  await Promise.all([prelink(renderer, scene, camera, finish.scene), finish.warm()]);

  const lost = (e: Event) => {
    e.preventDefault();
    events.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", lost);

  let dead = false;
  return {
    frame(now, p, v) {
      if (!dead) frame(now, p, v);
    },
    layout() {
      if (!dead) layout();
    },
    setPointer(nx, ny, seen) {
      pnx = nx;
      pny = ny;
      if (seen) {
        pointerSeen = true;
        lastPointerAt = performance.now();
      }
    },
    setChosen(i) {
      chosen = i;
      pieceMat.uniforms.tPage.value = pageTex[i];
      slipMat.uniforms.tPage.value = pageTex[i];
    },
    chosen: () => chosen,
    hoverSheet(i) {
      hoverIdx = i;
      sheets.forEach((s, k) => (s.hoverT = k === hoverIdx ? 1 : 0));
    },
    pressSheet(i) {
      sheets.forEach((s, k) => (s.pressT = k === i ? 1 : 0));
    },
    pickSheet(i) {
      const s = sheets[i];
      if (s) s.pickT = 1;
    },
    dragStart(i) {
      const s = sheets[i];
      if (s) {
        s.dragging = true;
        s.vy = 0;
        s.vp = 0;
      }
    },
    dragBy(i, dx, dy) {
      const s = sheets[i];
      if (!s) return;
      s.yaw += dx * 0.011;
      s.pitch = clamp(s.pitch + dy * 0.006, -0.7, 0.7);
      s.vy = s.vy * 0.5 + dx * 0.011 * 30;
      s.vp = s.vp * 0.5 + dy * 0.006 * 30;
    },
    dragEnd(i) {
      const s = sheets[i];
      if (s) s.dragging = false;
    },
    hoverSection(name) {
      sectionHover = name;
    },
    setKey(i) {
      activeKey = i;
    },
    hoverGroup(g) {
      groupHover = g;
    },
    slips: () => slipsList,
    destroy() {
      dead = true;
      canvas.removeEventListener("webglcontextlost", lost);
      textures.forEach((t) => t.dispose());
      sheets.forEach((s) => {
        s.batch.dispose();
        s.mat.dispose();
      });
      pieceBatch.dispose();
      scrapBatch.dispose();
      pieceMat.dispose();
      slipBatch.dispose();
      slipMat.dispose();
      marks.forEach((m) => m.mat.dispose());
      fieldGeo.dispose();
      sheetGeo.dispose();
      pieceGeo.dispose();
      scrapGeo.dispose();
      slipGeo.dispose();
      pointGeo.dispose();
      pointMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      finish.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
