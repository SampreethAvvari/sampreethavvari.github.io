// The journey engine: an exploration ship travelling through eight worlds as
// the page scrolls. The page owns the canvas and tells the engine where it is
// scrolled and where the pointer is; the engine owns its loop, its sizing and
// every GPU resource it creates.
//
// Progress runs 0 .. chapters.length. Chapter i rests at i + 0.3. The jump
// to world i+1 runs from i + 0.57 to i + 1.03 and crosses over (flash, new
// world) at i + 0.8, the middle of a glide between two rest points.
//
// The 3D carries the chapters up to the one with id "film" (the landing
// world). When the page arrives at that world's rest point and holds, the
// lander undocks and comes down in real time: touchdown exactly TOUCHDOWN_S
// seconds after arrival, then it settles and holds. Leaving forward before
// it finishes snaps it to landed; leaving backward (past the jump's
// crossover) snaps it back to the dock. Chapters after it hold the landed shot.
//
// Usage:
//   const { mountJourney } = await import("./journey/engine");
//   const j = mountJourney(canvas, { chapters, quality: "high", onShip });
//   j.setScroll(progress, velocity); j.setPointer(nx, ny); j.setPaused(false);
//   j.destroy();

import {
  BackSide,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderTarget,
} from "three";
import { approachU, CROSS, FlightPath, JUMP_A, JUMP_B, jumpAt, REST, travel, worldAt } from "./path";
import { Post, type PostFrame } from "./post";
import { buildShip, type ShipInput } from "./ship";
import { compositeTextures, foilNormal, solarTexture } from "./skin";
import type { PointerRay } from "./pieces";
import { buildSpace, type Chapter } from "./space";
import type { SurfaceShot } from "./surface";
import { cloudTexture, glowTexture } from "./textures";

export interface JourneyChapter {
  id: string;
  /** Hex colour, the chapter's light. */
  color: string;
}

/** Where the focus craft sits on screen: centre in 0..1 (origin top left), radius as a fraction of viewport height. */
export interface ShipScreen {
  x: number;
  y: number;
  r: number;
  /** The jump in progress, or null while travelling inside a world. */
  jump: { from: number; to: number; amount: number } | null;
}

export interface Journey {
  /** progress 0 .. chapters.length (continuous). velocity in chapters per second, signed. */
  setScroll(progress: number, velocity: number): void;
  /** -1..1 each. nx: left to right. ny: top to bottom (DOM direction). */
  setPointer(nx: number, ny: number): void;
  /** Stop rendering entirely while paused. */
  setPaused(paused: boolean): void;
  /** 0 until the lander touches down, then 1. */
  landedNow(): number;
  destroy(): void;
}

export interface JourneyOptions {
  chapters: JourneyChapter[];
  quality?: "high" | "low";
  reducedMotion?: boolean;
  /** Called every rendered frame. The object is reused, so copy what you keep. */
  onShip?: (s: ShipScreen) => void;
}

/**
 * Where the page should put each chapter's words on wide screens: the side
 * and band of the screen the camera leaves clear. On phones the ship is
 * framed in the upper half, so the words belong in the lower half.
 */
export const CHAPTER_FRAMING: { side: "left" | "right"; v: "top" | "bottom" }[] = [
  { side: "left", v: "bottom" }, // launch: ship right, front three quarter
  { side: "right", v: "bottom" }, // proof: ship left, side on
  { side: "left", v: "bottom" }, // projects: ship right, overhead
  { side: "right", v: "bottom" }, // disciplines: ship left, from below
  { side: "left", v: "bottom" }, // writing: ship right, slow orbit
  { side: "left", v: "top" }, // film: the landing, lander lower right, open sky above
  { side: "left", v: "top" }, // mind: hold on the landed lander
  { side: "left", v: "top" }, // contact: hold
  { side: "left", v: "top" }, // connect: hold
];

/** Index of the landing world in the default chapter list. */
export const LAND_WORLD = 5;

/** The jump in progress at this progress, or null inside a world. There are no jumps after the landing world. */
export function jumpState(progress: number, landWorld = LAND_WORLD): { from: number; to: number; amount: number } | null {
  return jumpAt(progress, landWorld + 1);
}

/** Seconds from arriving at the landing world's rest point to touchdown (eight beats at 85.7 bpm). */
export const TOUCHDOWN_S = 5.6;

// The live landing state of the mounted engine, so landed() can answer.
let liveLanded = 0;

/**
 * 0 until the lander touches down, then 1. Before the landing world it is 0
 * and past its rest point it is 1; at the rest point it follows the real
 * time descent of the mounted engine (Journey.landedNow says the same).
 */
export function landed(progress: number, landWorld = LAND_WORLD): number {
  if (progress < landWorld - 1 + CROSS) return 0;
  if (progress > landWorld + REST + 0.05) return 1;
  return liveLanded;
}

/** Progress at which each chapter sits at rest. */
export const REST_POINTS = (chapters = 9) => Array.from({ length: chapters }, (_, i) => i + REST);

// ------------------------------------------------------------------ shots

/**
 * A camera shot in the ship's travel frame. az: degrees around the ship from
 * behind (0) through its right side (90) to the front (180). el: degrees up.
 * size: ship diameter as a share of viewport height. x, y: where the ship
 * sits on screen in NDC. d*: how az, el and size change while travelling
 * through the world. key: hard sun direction in the travel frame.
 */
interface Shot {
  az: number;
  el: number;
  size: number;
  x: number;
  y: number;
  roll: number;
  dAz: number;
  dEl: number;
  dSize: number;
  key: [number, number, number];
}

const SHOTS: Record<string, Shot> = {
  launch: { az: 152, el: 11, size: 0.46, x: 0.4, y: -0.06, roll: -0.03, dAz: -26, dEl: 4, dSize: 0.02, key: [0.65, 0.55, -0.55] },
  proof: { az: 62, el: 14, size: 0.42, x: -0.4, y: 0.02, roll: 0.0, dAz: 16, dEl: 3, dSize: 0, key: [0.55, 0.7, -0.45] },
  projects: { az: 18, el: 68, size: 0.44, x: 0.4, y: 0.0, roll: 0.0, dAz: 22, dEl: 6, dSize: 0, key: [0.35, 0.9, 0.25] },
  disciplines: { az: 165, el: -34, size: 0.42, x: -0.4, y: 0.06, roll: 0.04, dAz: -14, dEl: -4, dSize: 0, key: [0.3, -0.55, -0.78] },
  writing: { az: 205, el: 14, size: 0.42, x: 0.42, y: -0.02, roll: 0.0, dAz: 80, dEl: 6, dSize: 0, key: [-0.6, 0.6, 0.5] },
  film: { az: 215, el: 12, size: 0.4, x: 0.36, y: 0.05, roll: 0.0, dAz: 0, dEl: 0, dSize: 0, key: [0.3, 0.15, -1] },
  mind: { az: 28, el: 50, size: 0.26, x: 0.36, y: 0.12, roll: 0.0, dAz: 14, dEl: -8, dSize: 0.14, key: [0.4, 0.85, 0.35] },
  contact: { az: 210, el: 16, size: 0.4, x: 0.36, y: 0.05, roll: 0.0, dAz: 0, dEl: 0, dSize: 0, key: [0.2, 0.15, -1] },
};
const ORDER = ["launch", "proof", "projects", "disciplines", "writing", "film"];

// Scratch objects reused every frame so the loop never allocates.
const _v = new Vector3();
const _v2 = new Vector3();
const _right = new Vector3();
const _up = new Vector3();
const _fwd = new Vector3();
const _rigPos = new Vector3();
const _rigQuat = new Quaternion();
const _look = new Vector3();
const _target = new Vector3();
const _camDir = new Vector3();
const _key = new Vector3();
const _color = new Color();
const _white = new Color(1, 1, 1);
const _q = new Quaternion();
const _dockPos = new Vector3();
const _dockQuat = new Quaternion();
const _a = new Vector3();
const _b = new Vector3();
const _landerPos = new Vector3();
const _yAxis = new Vector3(0, 1, 0);
const _evening = new Color(1.0, 0.62, 0.42);
const _spaceFillSky = new Color(0x6070a0);
const _spaceFillGround = new Color(0x050608);
const _sunKey = new Vector3();

function clamp(x: number, a: number, b: number) {
  return x < a ? a : x > b ? b : x;
}
function ease(x: number) {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function smooth(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function damp(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** A dark studio of soft panels, baked once into a reflection map. */
function environment(renderer: WebGLRenderer): WebGLRenderTarget {
  const s = new Scene();
  const dome = new Mesh(
    new SphereGeometry(60, 32, 16),
    new ShaderMaterial({
      side: BackSide,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `varying vec3 vP; void main(){
        float y = vP.y;
        vec3 top = vec3(0.06, 0.07, 0.1);
        vec3 mid = vec3(0.015, 0.018, 0.026);
        vec3 low = vec3(0.004, 0.004, 0.006);
        vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.9, y)) : mix(mid, low, smoothstep(0.0, -0.6, y));
        gl_FragColor = vec4(c, 1.0);
      }`,
    }),
  );
  s.add(dome);
  const panel = (w: number, h: number, x: number, y: number, z: number, r: number, g: number, b: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(r, g, b), side: DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(30, 18, 18, 34, 14, 6.0, 5.6, 5.0); // the sun side
  panel(4, 40, -36, 6, -6, 0.8, 1.2, 2.2); // cool strip on the left
  panel(40, 3, 0, 4, -40, 1.8, 1.9, 2.1); // thin bar ahead for a crisp edge
  panel(16, 7, 6, -30, 12, 0.2, 0.18, 0.16); // faint bounce from below
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(s, 0.015);
  pmrem.dispose();
  s.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    }
  });
  return rt;
}

export function mountJourney(canvas: HTMLCanvasElement, opts: JourneyOptions): Journey {
  const low = opts.quality === "low";
  const reduced = !!opts.reducedMotion;
  const list = opts.chapters && opts.chapters.length ? opts.chapters : [{ id: "launch", color: "#5B8DEF" }];
  const chapters: Chapter[] = list.map((c) => ({ id: c.id, color: new Color(c.color) }));
  const N = chapters.length;
  const maxP = N;
  // The 3D worlds run up to the landing world; later chapters hold its last shot.
  const filmAt = chapters.findIndex((c) => c.id === "film");
  const landWorld = filmAt >= 0 ? filmAt : Math.min(LAND_WORLD, N - 1);
  const W = landWorld + 1;
  const dprCap = low ? 1.25 : 1.75;
  const shots: Shot[] = chapters.slice(0, W).map((c, i) => SHOTS[c.id] ?? SHOTS[ORDER[i % ORDER.length]]);
  shots[W - 1] = SHOTS.film;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: low ? "default" : "high-performance",
  });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(1);
  const shadows = !low;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  scene.fog = new FogExp2(0x03040a, 0.0008);
  const camera = new PerspectiveCamera(42, 1, 0.3, 9000);

  let envRT = environment(renderer);
  scene.environment = envRT.texture;

  // Lighting like a space photograph: one hard sun, a soft rim in the
  // chapter colour, almost no fill so the shadows stay deep.
  const key = new DirectionalLight(0xfff4e8, 3.2);
  const rim = new DirectionalLight(0xffffff, 1.3);
  const fill = new HemisphereLight(0x6070a0, 0x050608, 0.12);
  scene.add(key, key.target, rim, rim.target, fill);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 9;
    sc.bottom = -9;
    sc.near = 1;
    sc.far = 60;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
  }

  const composite = compositeTextures(low ? 512 : 1024);
  const foil = foilNormal(low ? 256 : 512);
  const solar = solarTexture(256);
  const glowTex = glowTexture();
  const cloudTex = cloudTexture(low ? 96 : 128);
  const textures: Texture[] = [composite.map, composite.rough, foil, solar, glowTex, cloudTex];

  const path = new FlightPath(W);
  const ship = buildShip({ low, composite, foil, solar, shadows });
  const landing = path.landing(ship.standHeight);
  const rig = new Group();
  rig.add(ship.root, ship.trails);
  scene.add(rig, ship.lander);
  ship.root.rotation.order = "YXZ";

  const space = buildSpace(path, chapters, low, glowTex, cloudTex, landing, landWorld);
  scene.add(space.group);
  const surface = space.surface;
  const sshot: SurfaceShot = { pos: new Vector3(), look: new Vector3(), fov: 42, parallax: 0 };
  // Progress at which each chapter from the landing on comes to rest. The
  // surface progress s counts them: 0 landed, 1 first steps, 2 helmet, 3 touch.
  const restKnots: number[] = [];
  for (let i = landWorld; i < N; i++) restKnots.push(i === N - 1 && i > landWorld ? i : i + REST);
  const surfaceAt = (pp: number) => {
    if (pp <= restKnots[0]) return 0;
    for (let i = 1; i < restKnots.length; i++) if (pp <= restKnots[i]) return i - 1 + (pp - restKnots[i - 1]) / (restKnots[i] - restKnots[i - 1]);
    return restKnots.length - 1;
  };
  fill.position.copy(landing.up);

  // Multisampling only where the pixel ratio is too low to hide jagged edges.
  const dpr0 = Math.min(window.devicePixelRatio || 1, dprCap);
  const msaa = !low && dpr0 < 1.5 ? 4 : 0;
  const lensOn = !low && !reduced;
  const post = new Post(renderer, { low, msaa, lens: lensOn });

  // ------------------------------------------------------------ state
  let targetP = 0;
  let p = 0;
  let v = 0;
  let snapped = false;
  let ptx = 0;
  let pty = 0;
  let px = 0;
  let py = 0;
  let lensX = 0.5;
  let lensY = 0.5;
  let lensAmt = 0;
  let lensEnergy = 0;
  let hasPointer = false;
  let pVelX = 0;
  let boost = 0;
  let prevQ = 0;
  let qSpeed = 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let paused = false;
  let disposed = false;
  let ready = false;
  let lost = false;
  let fadeIn = 0;
  let sized = false;
  let resizeDirty = true;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let pxScale = 800;
  let aspect = 1;
  let portrait = false;
  let firstFrame = false;
  let prevL = 0;
  let bounceT = -1;
  // Landing state: 0 docked, 1 coming down, 2 landed.
  let landState = 0;
  let landStart = 0;
  // Heading: +1 flying forward along the path, -1 after turning back. It
  // flips on the direction of a jump, and the turn plays out over a second.
  let heading = 1;
  let turn = 0;
  let turnV = 0;
  let camTurn = 0;
  let camTurnV = 0;
  let ptrOn = 0;
  let shipLift = 0;
  let shadowWide = false;
  const ptr: PointerRay = { o: new Vector3(), d: new Vector3(0, 0, -1), on: 0 };
  const shipIn: ShipInput = { time: 0, dt: 0, speed: 0, boost: 0, color: _color, reduced, gear: 0, brake: 0, idle: 0, detach: 0, heading: 1, heat: 0, landed: 0 };
  const screen: ShipScreen = { x: 0.7, y: 0.5, r: 0.2, jump: null };

  function applySize() {
    resizeDirty = false;
    const cw = canvas.clientWidth || canvas.width || 1;
    const ch = canvas.clientHeight || canvas.height || 1;
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.max(1, Math.round(cw * dpr));
    const h = Math.max(1, Math.round(ch * dpr));
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      post.setSize(w, h);
    }
    aspect = cw / ch;
    portrait = aspect < 0.9;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    sized = true;
  }

  const ro = new ResizeObserver(() => {
    resizeDirty = true;
  });
  ro.observe(canvas);

  /** The light of the world on screen, blending quickly at each crossover. */
  function worldColor(pp: number, out: Color) {
    const x = pp + 1 - CROSS;
    const i = Math.floor(x);
    const f = x - i;
    const e = 0.04;
    const at = (k: number) => chapters[clamp(k, 0, W - 1)].color;
    if (f < e) return out.copy(at(i - 1)).lerp(at(i), smooth(-e, e, f));
    if (f > 1 - e) return out.copy(at(i)).lerp(at(i + 1), smooth(1 - e, 1 + e, f));
    return out.copy(at(i));
  }

  // Shot parameters blended across the scroll, written into this object.
  const S = { az: 0, el: 0, size: 0, x: 0, y: 0, roll: 0, kx: 0, ky: 0, kz: 0 };
  function shotAt(i: number, w: number, k: number) {
    const s = shots[clamp(i, 0, W - 1)];
    const t = w - 0.5;
    S.az += (s.az + s.dAz * t) * k;
    S.el += (s.el + s.dEl * t) * k;
    S.size += (s.size + s.dSize * w) * k;
    S.x += s.x * k;
    S.y += s.y * k;
    S.roll += s.roll * k;
    S.kx += s.key[0] * k;
    S.ky += s.key[1] * k;
    S.kz += s.key[2] * k;
  }
  /** Fill S for progress pp: hold a world's shot inside it, swing to the next during the jump. */
  function blendShots(pp: number) {
    S.az = S.el = S.size = S.x = S.y = S.roll = S.kx = S.ky = S.kz = 0;
    const j = jumpAt(pp, W);
    if (!j) {
      const w = worldAt(pp, W);
      const inA = JUMP_B - 1;
      shotAt(w, clamp((pp - (w + inA)) / (JUMP_A - inA), 0, 1), 1);
      return;
    }
    const k = smooth(0.3, 0.7, j.amount);
    shotAt(j.from, 1, 1 - k);
    // Take the shortest way round to the next azimuth.
    const from = shots[j.from].az + shots[j.from].dAz * 0.5;
    const to = shots[j.to].az - shots[j.to].dAz * 0.5;
    let d = to - from;
    d -= Math.round(d / 360) * 360;
    const azKeep = S.az;
    shotAt(j.to, 0, k);
    S.az = azKeep + (from + d) * k;
  }

  // ------------------------------------------------------------ frame
  function step(dt: number) {
    time += dt;

    // Scroll: a critically damped spring toward the page's progress.
    const w = 8;
    const acc = w * w * (targetP - p) - 2 * w * v;
    v += acc * dt;
    p += v * dt;
    if (p < 0) {
      p = 0;
      v = Math.max(0, v);
    } else if (p > maxP) {
      p = maxP;
      v = Math.min(0, v);
    }

    // Path position and its speed; jumps move fast, worlds slowly.
    const q = travel(p, W);
    qSpeed = damp(qSpeed, (q - prevQ) / Math.max(dt, 1e-3), 10, dt);
    prevQ = q;
    const speed = qSpeed;
    boost = damp(boost, clamp(Math.abs(speed) / 0.9, 0, 1), 5, dt);
    const jump = jumpAt(p, W);
    const ja = jump ? jump.amount : 0;
    const bell = Math.sin(Math.PI * ja);

    // Pointer.
    const prevPx = px;
    px = damp(px, ptx, 3.0, dt);
    py = damp(py, pty, 3.0, dt);
    pVelX = damp(pVelX, (px - prevPx) / Math.max(dt, 1e-3), 6, dt);

    worldColor(p, _color);

    // Turn around when a jump runs backwards, and back again on the next
    // forward jump. The camera turns with the ship.
    if (jump && Math.abs(v) > 0.05) heading = v > 0 ? 1 : -1;
    if (p >= landing.start - 0.3) heading = 1;
    const turnTo = heading < 0 ? 1 : 0;
    if (reduced) {
      if (!jump || (ja > 0.45 && ja < 0.55)) turn = turnTo;
    } else {
      const tw = 3.4;
      turnV += (tw * tw * (turnTo - turn) - 2 * tw * turnV) * dt;
      turn = clamp(turn + turnV * dt, -0.05, 1.05);
    }
    const turnAng = Math.PI * turn;
    // The camera follows the turn a beat later, so the ship is seen swinging round.
    if (reduced) camTurn = turn;
    else {
      const cw = 2.0;
      camTurnV += (cw * cw * (turn - camTurn) - 2 * cw * camTurnV) * dt;
      camTurn += camTurnV * dt;
    }
    const turnRoll = Math.sin(Math.PI * clamp(turn, 0, 1)) * 0.55 * (heading < 0 ? 1 : -1);

    // Rig on the path.
    path.frame(q, _rigPos, _rigQuat, _right, _up, _fwd);
    const bend = path.bend(q, _right);
    // Once he is on the ground the big ship climbs back to orbit and out of the sky.
    const sNow = landState === 2 ? surfaceAt(p) : 0;
    shipLift = damp(shipLift, sNow > 0.02 ? 1800 : 0, sNow > 0.02 ? 0.5 : 4, dt);
    rig.position.copy(_rigPos).addScaledVector(landing.up, shipLift);
    rig.quaternion.copy(_rigQuat);
    rig.visible = shipLift < 1500;

    // Ship motion inside the rig: a slow hover, a bank into curves, a little pointer steering.
    const sr = ship.root;
    if (reduced) {
      sr.position.set(0, 0, 0);
      sr.rotation.set(0, turnAng, clamp(-bend * 0.02, -0.2, 0.2));
    } else {
      const t = time;
      sr.position.set(px * 0.8 + Math.sin(t * 0.31) * 0.15, -py * 0.5 + Math.sin(t * 0.9) * 0.12, 0);
      const yaw = -px * 0.12 - pVelX * 0.05;
      const pitch = py * 0.06 + Math.sin(t * 0.7) * 0.01 + bell * 0.04;
      const bank = -px * 0.14 - clamp(pVelX * 0.08, -0.25, 0.25) + clamp(-bend * 0.02, -0.25, 0.25) + Math.sin(t * 0.5) * 0.02;
      sr.rotation.set(pitch, yaw + turnAng, bank + turnRoll);
    }
    rig.updateMatrixWorld();

    // Landing in the last world: the lander undocks and comes down onto the pad.
    // The landing runs on the clock once the page holds at the rest point.
    const restP = landWorld + REST;
    if (p < landWorld - 1 + CROSS) landState = 0; // back past the crossover: docked again
    else if (targetP > restP + 0.05 || p > restP + 0.05) landState = 2; // moving on: landed
    else if (landState === 0 && Math.abs(targetP - restP) < 0.0015) {
      landState = reduced ? 2 : 1;
      landStart = performance.now();
    }
    let L = 0;
    if (landState === 1) {
      L = clamp((performance.now() - landStart) / 1000 / (TOUCHDOWN_S / 0.84), 0, 1);
      if (L >= 1) landState = 2;
    } else if (landState === 2) L = 1;
    liveLanded = L >= 0.84 ? 1 : 0;
    _dockPos.setFromMatrixPosition(ship.dock).applyMatrix4(sr.matrixWorld);
    _dockQuat.setFromRotationMatrix(sr.matrixWorld);
    if (L > 0) {
      const u = approachU(L);
      // A cubic from the dock, down and out to the side, then in to the pad from ahead.
      _a.copy(_dockPos).addScaledVector(landing.up, -16).addScaledVector(landing.right, -18);
      _b.copy(landing.touch).addScaledVector(landing.up, 22).addScaledVector(landing.fwd, 26);
      const iu = 1 - u;
      _landerPos
        .copy(_dockPos)
        .multiplyScalar(iu * iu * iu)
        .addScaledVector(_a, 3 * iu * iu * u)
        .addScaledVector(_b, 3 * iu * u * u)
        .addScaledVector(landing.touch, u * u * u);
      _q.copy(_dockQuat).slerp(landing.quat, smooth(0.04, 0.6, L));
    } else {
      _landerPos.copy(_dockPos);
      _q.copy(_dockQuat);
    }
    if (L >= 0.84 && prevL < 0.84 && !reduced) bounceT = 0;
    if (L < 0.8) bounceT = -1;
    prevL = L;
    let bounce = 0;
    if (bounceT >= 0) {
      bounceT += dt;
      bounce = -0.12 * Math.sin(bounceT * 10) * Math.exp(-bounceT * 4);
      if (bounceT > 2.5) bounceT = -1;
    }
    ship.lander.position.copy(_landerPos).addScaledVector(landing.up, bounce);
    ship.lander.quaternion.copy(_q);
    // Nose up a touch while braking.
    ship.lander.rotateX(0.16 * Math.sin(Math.PI * clamp((L - 0.3) / 0.55, 0, 1)));

    shipIn.time = time;
    shipIn.dt = dt;
    shipIn.speed = speed;
    shipIn.boost = boost;
    shipIn.color = _color;
    shipIn.gear = smooth(0.4, 0.72, L);
    shipIn.brake = smooth(0.32, 0.5, L) * (1 - smooth(0.8, 0.9, L));
    shipIn.idle = smooth(0.86, 1, L);
    shipIn.detach = smooth(0, 0.1, L);
    shipIn.heading = Math.cos(turnAng);
    shipIn.heat = smooth(0.08, 0.25, L) * (1 - smooth(0.42, 0.6, L));
    shipIn.landed = smooth(0.84, 0.98, L);
    ship.update(shipIn);

    // ---- Camera: the chapter's shot around the ship, eased into the landing shot.
    blendShots(p);
    let fov = 42 + (reduced ? 0 : 16 * bell) + (portrait ? 16 : 0);
    const tanV = Math.tan((fov * Math.PI) / 360);
    const tanH = tanV * aspect;
    // Focus: the mothership, handing over to the lander during the landing.
    const focusW = smooth(0.08, 0.5, L);
    sr.getWorldPosition(_target);
    _target.lerp(_landerPos, focusW);
    const radius = lerp(ship.radius, ship.landerRadius, focusW);
    // Phones: ship in the upper half, sized to the width.
    const sx = portrait ? 0 : S.x;
    const sy = portrait ? 0.4 : S.y;
    let dist = portrait ? radius / (0.82 * tanH) : radius / (S.size * tanV);
    if (!portrait) dist = Math.max(dist, radius / ((0.92 - Math.abs(sx)) * tanH));
    // The jump lurches back.
    const shakeAmt = reduced ? 0 : bell;
    dist *= 1 + 0.3 * shakeAmt;
    // At rest the camera keeps drifting slowly through the world.
    const drift = reduced ? 0 : 1;
    dist *= 1 + drift * 0.04 * Math.sin(time * 0.13);
    const driftAz = drift * (9 * Math.sin(time * 0.09) + 4 * Math.sin(time * 0.23 + 2));
    const driftEl = drift * 3 * Math.sin(time * 0.11 + 1);
    const az = ((S.az + 180 * camTurn + driftAz + (reduced ? 0 : px * 4)) * Math.PI) / 180;
    const el = ((S.el + driftEl + (reduced ? 0 : -py * 3)) * Math.PI) / 180;
    _camDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).applyQuaternion(_rigQuat);
    camera.position.copy(_target).addScaledVector(_camDir, dist);
    camera.up.copy(_up);
    // Landing: follow the lander down through the cloud, then ease into a
    // wide calm hold from beside it, lander lower right.
    const c1 = smooth(0.0, 0.3, L);
    const cb = ease(smooth(0.5, 0.95, L));
    const k = clamp((aspect - 0.7) / 0.7, 0, 1);
    if (c1 > 0) {
      _v.copy(_landerPos).addScaledVector(landing.right, -10).addScaledVector(landing.up, 4.5).addScaledVector(landing.fwd, -15);
      camera.position.lerp(_v, c1);
      camera.up.lerp(landing.up, c1).normalize();
    }
    if (cb > 0) {
      _v.copy(landing.touch)
        .addScaledVector(landing.right, lerp(-2.0, -6.5, k))
        .addScaledVector(landing.up, lerp(3.4, 1.9, k))
        .addScaledVector(landing.fwd, -lerp(20, 14, k));
      camera.position.lerp(_v, cb);
      // Aim past the lander so it sits lower right (upper centre on phones).
      _look
        .copy(landing.touch)
        .addScaledVector(landing.right, lerp(-1.6, -4.8, k))
        .addScaledVector(landing.up, lerp(-11, 4.6, k))
        .addScaledVector(landing.fwd, 40);
      _v.copy(_target).lerp(_look, cb);
    } else {
      _v.copy(_target);
    }
    // On the surface the camera travels one path through the world. The look
    // point stays put while the camera position moves, so the pointer and the
    // slow breathing are real parallax.
    if (surface && sNow > 0) {
      surface.shot(sNow, portrait, sshot);
      const k = smooth(0, 0.22, sNow);
      camera.position.lerp(sshot.pos, k);
      _v.lerp(sshot.look, k);
      camera.up.copy(landing.up);
      fov += (sshot.fov - fov) * k;
      if (!reduced) {
        const par = sshot.parallax * k;
        camera.position
          .addScaledVector(landing.right, px * par + Math.sin(time * 0.21) * par * 0.14)
          .addScaledVector(landing.up, -py * par * 0.45 + Math.sin(time * 0.33 + 1) * par * 0.09)
          .addScaledVector(landing.fwd, Math.sin(time * 0.17 + 2) * par * 0.2);
      }
    }
    camera.lookAt(_v);
    // Put the focus where the shot wants it on screen, then add roll and shake.
    const off = 1 - Math.max(c1, cb);
    camera.rotateY(Math.atan(sx * tanH) * off);
    camera.rotateX(-Math.atan(sy * tanV) * off);
    camera.rotateZ(S.roll * off);
    if (shakeAmt > 0) {
      const sh = shakeAmt * 0.012;
      camera.rotateX(Math.sin(time * 61) * sh + Math.sin(time * 37) * sh * 0.6);
      camera.rotateY(Math.sin(time * 53 + 1) * sh);
      camera.rotateZ(Math.sin(time * 47 + 2) * sh * 1.5);
    }
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    pxScale = height / (2 * Math.tan((camera.fov * Math.PI) / 360));

    // Lights: the hard key comes from the shot's sun direction; the rim in
    // the chapter colour comes from behind the ship as the camera sees it.
    _key.set(S.kx, S.ky, S.kz).normalize().applyAxisAngle(_yAxis, turnAng).applyQuaternion(_rigQuat);
    const groundK = surface ? smooth(0.2, 0.55, L) : 0;
    if (L > 0) {
      if (surface) {
        // The sun as the ground sees it, held just above the horizon so the
        // light still rakes the sand once the disc is going down.
        _sunKey.copy(surface.sunWorld);
        const lift = 0.085 - _sunKey.dot(landing.up);
        if (lift > 0) _sunKey.addScaledVector(landing.up, lift);
        _v.copy(_sunKey).normalize();
      } else {
        _v.copy(landing.fwd).addScaledVector(landing.up, 0.35).addScaledVector(landing.right, 0.45).normalize();
      }
      _key.lerp(_v, smooth(0, 0.5, L)).normalize();
    }
    key.position.copy(_target).addScaledVector(_key, shadowWide ? 80 : 30);
    // Evening on the landing world: a lower, warmer sun.
    key.intensity = lerp(3.2, 2.1, smooth(0, 0.6, L));
    key.color.setRGB(1, 0.957, 0.91).lerp(_evening, smooth(0, 0.6, L));
    if (surface && groundK > 0) {
      key.intensity = lerp(key.intensity, 1, groundK);
      key.color.lerp(surface.sunColor, groundK);
      fill.intensity = lerp(0.12, 0.24, groundK);
      fill.color.copy(_spaceFillSky).lerp(surface.skyLight, groundK);
      fill.groundColor.copy(_spaceFillGround).lerp(surface.groundLight, groundK);
    } else {
      fill.intensity = 0.12;
      fill.color.copy(_spaceFillSky);
      fill.groundColor.copy(_spaceFillGround);
    }
    // The low sun throws long shadows, so the shadow camera opens up on the ground.
    const wantWide = shadows && L > 0.7;
    if (wantWide !== shadowWide) {
      shadowWide = wantWide;
      const sc = key.shadow.camera;
      const e = wantWide ? 26 : 9;
      sc.left = -e;
      sc.right = e;
      sc.top = e;
      sc.bottom = -e;
      sc.far = wantWide ? 170 : 60;
      sc.updateProjectionMatrix();
    }
    // Far from the lander nothing near casts a shadow any more.
    if (shadows) renderer.shadowMap.autoUpdate = sNow < 1.6;
    key.target.position.copy(_target);
    key.target.updateMatrixWorld();
    _v.subVectors(_target, camera.position).normalize().addScaledVector(_up, 0.35);
    rim.position.copy(_target).addScaledVector(_v, 30);
    rim.target.position.copy(_target);
    rim.target.updateMatrixWorld();
    rim.color.copy(_color);
    rim.intensity = lerp(1.3, 0.35, groundK);
    // The pointer as a ray into the scene, for the things that answer it.
    ptrOn = damp(ptrOn, hasPointer ? 1 : 0, 3, dt);
    ptr.o.copy(camera.position);
    ptr.d.set(ptx, -pty, 0.5).unproject(camera).sub(camera.position).normalize();
    ptr.on = ptrOn * (1 - bell);

    space.update({ p, q, time, dt, speed, boost, color: _color, camera, fwd: _fwd, reduced, pxScale, dpr, warp: reduced ? 0 : bell, ptr, heading: Math.cos(turnAng), land: L, s: sNow });
    const fog = scene.fog as FogExp2;
    fog.color.setRGB(0.012, 0.014, 0.03).lerp(_color, 0.04).lerp(space.haze.color, space.haze.weight);
    fog.density = lerp(0.0008, space.haze.density, space.haze.weight);

    // Where the focus sits on screen, for the page and for the lens.
    _v.copy(_target).project(camera);
    const fx0 = _v.x * 0.5 + 0.5;
    const fy0 = _v.y * 0.5 + 0.5;
    const depth = _v2.subVectors(_target, camera.position).dot(camera.getWorldDirection(_a));
    const sRad = radius / Math.max(0.5, depth) / (2 * tanV);
    screen.x = fx0;
    screen.y = 1 - fy0;
    // On the surface the shots leave the words their own side of the frame.
    screen.r = sNow > 0 ? 0 : sRad;
    screen.jump = jump;
    if (opts.onShip) opts.onShip(screen);

    // Flare from the brightest light in view.
    const fl = space.flare;
    let flareStrength = 0;
    let fx = 0;
    let fy = 0;
    if (fl.strength > 0.001) {
      _v.copy(fl.pos).project(camera);
      if (_v.z < 1 && _v.z > -1) {
        fx = _v.x * 0.5 + 0.5;
        fy = _v.y * 0.5 + 0.5;
        const edge = Math.min(fx + 0.15, 1.15 - fx, fy + 0.15, 1.15 - fy);
        flareStrength = fl.strength * clamp(edge / 0.2, 0, 1);
      }
    }

    // Pointer lens: strong while the pointer moves fast, a gentle bend at rest.
    let lensStrength = 0;
    if (lensOn && hasPointer) {
      const tx = ptx * 0.5 + 0.5;
      const ty = 0.5 - pty * 0.5;
      const moved = Math.hypot(tx - lensX, ty - lensY) / Math.max(dt, 1e-3);
      lensX = damp(lensX, tx, 14, dt);
      lensY = damp(lensY, ty, 14, dt);
      const energy = clamp(moved * 0.35, 0, 1);
      lensEnergy = energy > lensEnergy ? damp(lensEnergy, energy, 10, dt) : damp(lensEnergy, energy, 1.6, dt);
      lensAmt = damp(lensAmt, 1, 2, dt);
      lensStrength = lensAmt * (0.32 + 0.68 * lensEnergy) * (1 - bell);
    }

    fadeIn = Math.min(1, fadeIn + dt * 1.6);
    pf.time = reduced ? 0 : time;
    pf.fade = fadeIn;
    pf.flare.x = fx;
    pf.flare.y = fy;
    pf.flare.strength = flareStrength * (1 - bell);
    pf.flare.color.copy(fl.color);
    pf.lens.x = lensX;
    pf.lens.y = lensY;
    pf.lens.strength = lensStrength;
    pf.lens.radius = 0.035 + 0.03 * lensEnergy;
    pf.lens.color.copy(_color);
    pf.ship.x = fx0;
    pf.ship.y = fy0;
    pf.ship.radius = sRad;
    // The jump: split and bend the image and flash at the crossover. Reduced
    // motion gets a quick dip through dark instead.
    const cross = ja > 0 ? Math.exp(-Math.pow((ja - 0.5) / 0.07, 2)) : 0;
    pf.jump = reduced ? 0 : bell;
    pf.flash = reduced ? 0 : cross;
    pf.dip = reduced && ja > 0 ? 0.92 * Math.exp(-Math.pow((ja - 0.5) / 0.2, 2)) : 0;
    pf.flashColor.copy(_color).lerp(_white, 0.55);
    post.render(scene, camera, pf);
  }

  // One frame description reused by the post pass so the loop stays allocation free.
  const pf: PostFrame = {
    time: 0,
    fade: 0,
    flare: { x: 0, y: 0, strength: 0, color: new Color() },
    lens: { x: 0.5, y: 0.5, strength: 0, radius: 0.05, color: new Color() },
    ship: { x: 0.7, y: 0.3, radius: 0.1 },
    jump: 0,
    flash: 0,
    dip: 0,
    flashColor: new Color(),
  };

  function loop(now: number) {
    raf = 0;
    if (paused || disposed || lost) return;
    raf = requestAnimationFrame(loop);
    if (resizeDirty || !sized) applySize();
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 1 / 60;
    last = now;
    step(dt);
    if (!firstFrame) {
      firstFrame = true;
      canvas.dispatchEvent(new CustomEvent("journeyready"));
    }
  }

  function start() {
    if (raf || paused || disposed || lost || !ready) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // Warm up every shader before the first frame, including set pieces that
  // are hidden until later chapters, so nothing stutters mid flight.
  applySize();
  path.frame(0, _rigPos, _rigQuat);
  camera.position.copy(_rigPos).add(_v.set(0, 5, 30));
  camera.lookAt(_rigPos);
  camera.updateMatrixWorld();
  const hidden: Object3D[] = [];
  for (const pc of space.pieces) {
    if (!pc.group.visible) hidden.push(pc.group);
    pc.group.visible = true;
  }
  const afterCompile = () => {
    for (const g of hidden) g.visible = false;
    if (disposed) return;
    ready = true;
    start();
  };
  renderer.compileAsync(scene, camera).then(afterCompile, afterCompile);

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    stop();
  };
  const onRestored = () => {
    lost = false;
    envRT.dispose();
    envRT = environment(renderer);
    scene.environment = envRT.texture;
    width = 0;
    height = 0;
    resizeDirty = true;
    start();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  return {
    setScroll(progress: number, _velocity: number) {
      if (!Number.isFinite(progress)) return;
      targetP = clamp(progress, 0, maxP);
      // The first value jumps straight there, so a reload mid page does not
      // replay the whole flight.
      if (!snapped) {
        snapped = true;
        p = targetP;
        v = 0;
        prevQ = travel(p, W);
      }
    },
    setPointer(nx: number, ny: number) {
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
      ptx = clamp(nx, -1, 1);
      pty = clamp(ny, -1, 1);
      if (!hasPointer) {
        hasPointer = true;
        lensX = ptx * 0.5 + 0.5;
        lensY = 0.5 - pty * 0.5;
      }
    },
    landedNow() {
      return landState === 2 || (landState === 1 && liveLanded === 1) ? 1 : 0;
    },
    setPaused(next: boolean) {
      if (paused === next) return;
      paused = next;
      if (paused) stop();
      else start();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      const mats = new Set<Material>();
      scene.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as Material | Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
        else if (mat) mats.add(mat);
        const inst = o as unknown as { dispose?: () => void; isInstancedMesh?: boolean };
        if (inst.isInstancedMesh && inst.dispose) inst.dispose();
      });
      for (const m of mats) m.dispose();
      for (const t of textures) t.dispose();
      if (shadows) key.shadow.dispose();
      envRT.dispose();
      post.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
