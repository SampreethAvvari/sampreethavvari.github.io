// The ship: an original near future exploration vessel. Twelve modules
// (habitats with lit windows, foil wrapped labs, cargo frames and two engine
// pods) form a slowly turning ring on four truss spokes. A despun hub at the
// centre carries black radiators, solar wings, attitude thrusters and a
// docking port with a small angular lander that undocks for the landing.
//
// Ship space: the lander's nose points to -Z (direction of travel), up is +Y.
// The ring lies in the XY plane, about 13 units across.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type CanvasTexture,
  type Material,
  type Object3D,
} from "three";
import { buildPlumes, PLUME_FS, PLUME_VS, TRAIL_FS, TRAIL_VS, type Nozzle } from "./exhaust";
import { additive, GlowBatch } from "./fx";
import { body, boxUV, latheZ, mergeAll, placed, plate, pod, rod, sidePlate, type Key } from "./kit";
import type { CompositeSet } from "./skin";
import { rng } from "./textures";

export interface ShipInput {
  time: number;
  dt: number;
  /** Signed eased speed in chapters per second. */
  speed: number;
  /** 0..1 from the absolute speed. */
  boost: number;
  /** Current chapter light, linear RGB. */
  color: Color;
  reduced: boolean;
  /** Lander landing gear, 0 stowed to 1 down. */
  gear: number;
  /** Lander braking jets, 0..1. */
  brake: number;
  /** Lander engines cooling after touchdown, 0..1. */
  idle: number;
  /** 0 docked, rising to 1 as the lander pulls away. */
  detach: number;
  /** 1 facing forward along the path, -1 turned around; in between while turning. */
  heading: number;
  /** Heat glow on the lander coming down through the air, 0..1. */
  heat: number;
  /** 1 once the lander has settled. */
  landed: number;
  /** How far the ramp is open, 0 to 1. */
  ramp: number;
  /** He is in the doorway: the light behind him flares. */
  glare: number;
}

export interface Ship {
  /** The mothership. The engine moves and rotates it inside the rig. */
  root: Group;
  /** The lander. Lives in world space; the engine places it every frame. */
  lander: Group;
  /** Lander pose relative to the mothership when docked. */
  dock: Matrix4;
  /** Ion trails. Add to the rig (path frame), not to the ship. */
  trails: Mesh;
  /** Bounding radius of the mothership and of the lander. */
  radius: number;
  landerRadius: number;
  /** Height of the lander's origin above the ground when it stands on its legs. */
  standHeight: number;
  update(s: ShipInput): void;
}

export interface ShipBuildOptions {
  low: boolean;
  composite: CompositeSet;
  foil: CanvasTexture;
  solar: CanvasTexture;
  shadows: boolean;
}

const RR = 6.0; // ring radius to the module centres
const MODS = ["hab", "lab", "cargo", "hab", "engine", "lab", "hab", "cargo", "lab", "hab", "engine", "cargo"];

interface Parts {
  comp: BufferGeometry[];
  gold: BufferGeometry[];
  silver: BufferGeometry[];
  carbon: BufferGeometry[];
  metal: BufferGeometry[];
  glass: BufferGeometry[];
  solar: BufferGeometry[];
}
const parts = (): Parts => ({ comp: [], gold: [], silver: [], carbon: [], metal: [], glass: [], solar: [] });

/** A rounded box whose long axis is X. */
function podX(len: number, h: number, d: number, r: number, bevel: number) {
  return pod(d, h, len, r, bevel).rotateY(Math.PI / 2);
}

function cylX(r: number, len: number, seg: number) {
  return new CylinderGeometry(r, r, len, seg, 1).rotateZ(Math.PI / 2);
}

function cylZ(r0: number, r1: number, len: number, seg: number, z: number) {
  return new CylinderGeometry(r1, r0, len, seg, 1).rotateX(Math.PI / 2).translate(0, 0, z);
}

const BELL = [
  [0.18, 0],
  [0.22, 0.1],
  [0.3, 0.32],
  [0.36, 0.55],
  [0.33, 0.55],
  [0.2, 0.2],
];

export function buildShip(opts: ShipBuildOptions): Ship {
  const { low, composite, foil, solar, shadows } = opts;
  const rand = rng(17);
  const root = new Group();
  root.name = "ship";
  const seg = low ? 12 : 22;

  // ---- Materials: off white composite, crinkled gold and silver foil, carbon, bare metal.
  const comp = new MeshStandardMaterial({ color: 0xffffff, map: composite.map, roughnessMap: composite.rough, roughness: 1, metalness: 0.05, envMapIntensity: 0.35 });
  const gold = new MeshStandardMaterial({ color: new Color("#d9a441"), metalness: 1, roughness: 0.3, normalMap: foil, envMapIntensity: 1.0 });
  gold.normalScale = new Vector2(0.9, 0.9);
  const silver = new MeshStandardMaterial({ color: new Color("#d5d9df"), metalness: 1, roughness: 0.24, normalMap: foil, envMapIntensity: 1.0 });
  silver.normalScale = new Vector2(0.9, 0.9);
  const carbon = new MeshStandardMaterial({ color: 0x17191d, metalness: 0.35, roughness: 0.55, envMapIntensity: 0.4 });
  const metal = new MeshStandardMaterial({ color: 0x8c939d, metalness: 1, roughness: 0.34, envMapIntensity: 0.8 });
  const glass = new MeshStandardMaterial({ color: 0x0a0f17, metalness: 0.6, roughness: 0.08, envMapIntensity: 1.4 });
  glass.emissive = new Color(0, 0, 0);
  const solarMat = new MeshStandardMaterial({ color: 0xffffff, map: solar, metalness: 0.55, roughness: 0.32, envMapIntensity: 0.9 });
  const windowMat = new MeshBasicMaterial({ color: new Color(1.7, 1.42, 1.0) });
  const nozzleCore = new MeshBasicMaterial({ color: 0xffffff });
  const mats: Record<keyof Parts, Material> = { comp, gold, silver, carbon, metal, glass, solar: solarMat };

  const addParts = (target: Object3D, p: Parts) => {
    for (const key of Object.keys(p) as (keyof Parts)[]) {
      if (!p[key].length) continue;
      const m = new Mesh(mergeAll(p[key]), mats[key]);
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      target.add(m);
    }
  };

  // ================================================================ the ring
  const spin = new Group();
  const ringParts = parts();
  const windowMats: Matrix4[] = [];
  const ringLightsPos: Vector3[] = [];
  const engineNozzles: Nozzle[] = [];
  const coreParts: BufferGeometry[] = [];
  const m4 = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);

  MODS.forEach((kind, k) => {
    const a = (k / MODS.length) * Math.PI * 2 + Math.PI / 2;
    const T = new Vector3(-Math.sin(a), Math.cos(a), 0);
    const R = new Vector3(Math.cos(a), Math.sin(a), 0);
    const Z = new Vector3(0, 0, 1);
    const C = R.clone().multiplyScalar(RR);
    const put = (g: BufferGeometry, list: BufferGeometry[], uv = 2.2) => list.push(boxUV(placed(g, T, R, Z, C), uv));
    const pt = (x: number, y: number, z: number) => C.clone().addScaledVector(T, x).addScaledVector(R, y).addScaledVector(Z, z);
    const basis = new Matrix4().makeBasis(T, R, Z);
    const win = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      q.setFromRotationMatrix(basis);
      windowMats.push(new Matrix4().compose(pt(x, y, z), q, new Vector3(sx, sy, sz)));
    };

    if (kind === "hab") {
      put(podX(2.3, 1.2, 1.3, 0.25, 0.05), ringParts.comp);
      put(new BoxGeometry(0.55, 1.26, 1.36), ringParts.silver, 0.9);
      for (const x of [-1.2, 1.2]) put(new BoxGeometry(0.1, 1.06, 1.16).translate(x, 0, 0), ringParts.carbon);
      put(new BoxGeometry(1.5, 0.05, 0.5).translate(0, 0.63, 0), ringParts.carbon);
      for (const x of [-0.85, -0.6, 0.6, 0.85]) {
        win(x, 0.15, 0.66, 0.15, 0.09, 0.02);
        win(x, 0.15, -0.66, 0.15, 0.09, 0.02);
        win(x, -0.18, 0.66, 0.15, 0.09, 0.02);
      }
      ringLightsPos.push(pt(1.15, 0.62, 0.66));
    } else if (kind === "lab") {
      put(cylX(0.58, 2.0, seg), ringParts.gold, 0.9);
      for (const x of [-0.98, 0.98]) put(cylX(0.66, 0.16, seg).translate(x, 0, 0), ringParts.comp);
      put(new BoxGeometry(1.1, 0.22, 0.72).translate(0, 0.66, 0), ringParts.comp);
      put(new SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0.3, 0.77, 0), ringParts.glass);
      put(cylX(0.6, 0.06, seg).translate(-0.45, 0, 0), ringParts.carbon);
      put(cylX(0.6, 0.06, seg).translate(0.45, 0, 0), ringParts.carbon);
      win(0, 0.66, 0.37, 0.4, 0.06, 0.02);
      ringLightsPos.push(pt(-0.9, 0.7, 0.4));
    } else if (kind === "cargo") {
      put(new BoxGeometry(1.86, 1.0, 1.2), ringParts.silver, 0.9);
      const e = 0.07;
      for (const [y, z] of [
        [0.53, 0.63],
        [-0.53, 0.63],
        [0.53, -0.63],
        [-0.53, -0.63],
      ])
        put(new BoxGeometry(2.0, e, e).translate(0, y, z), ringParts.carbon);
      for (const [x, z] of [
        [0.97, 0.63],
        [-0.97, 0.63],
        [0.97, -0.63],
        [-0.97, -0.63],
      ])
        put(new BoxGeometry(e, 1.1, e).translate(x, 0, z), ringParts.carbon);
      for (const [x, y] of [
        [0.97, 0.53],
        [-0.97, 0.53],
        [0.97, -0.53],
        [-0.97, -0.53],
      ])
        put(new BoxGeometry(e, e, 1.3).translate(x, y, 0), ringParts.carbon);
      put(new BoxGeometry(1.2, 0.05, 0.9).translate(0, 0.54, 0), ringParts.comp);
    } else {
      // Engine pod: a composite block with two bells facing aft.
      put(podX(1.9, 1.0, 1.4, 0.2, 0.04), ringParts.comp);
      for (const z of [0.72, -0.72]) put(new BoxGeometry(1.5, 0.78, 0.04).translate(0, 0, z), ringParts.carbon);
      put(new BoxGeometry(0.6, 0.35, 0.7).translate(0, 0.66, -0.1), ringParts.gold, 0.9);
      for (const x of [-0.45, 0.45]) {
        const b = latheZ(BELL, seg, 0.72, x, 0);
        ringParts.metal.push(placed(b, T, R, Z, C));
        const disc = new CylinderGeometry(0.17, 0.17, 0.02, 12, 1).rotateX(Math.PI / 2).translate(x, 0, 0.82);
        coreParts.push(placed(disc, T, R, Z, C));
        engineNozzles.push({ o: pt(x, 0, 0.72 + 0.55), d: Z.clone(), r: 0.32, kind: 0 });
      }
      ringLightsPos.push(pt(0.9, 0.5, -0.72));
    }

    // Tunnel to the next module, centred between them on the ring.
    const am = a + Math.PI / MODS.length;
    const Tm = new Vector3(-Math.sin(am), Math.cos(am), 0);
    const Rm = new Vector3(Math.cos(am), Math.sin(am), 0);
    const Cm = Rm.clone().multiplyScalar(RR);
    ringParts.comp.push(boxUV(placed(cylX(0.27, 1.6, seg), Tm, Rm, Z, Cm), 2.2));
    for (const x of [-0.3, 0.3]) ringParts.carbon.push(boxUV(placed(cylX(0.31, 0.1, seg).translate(x, 0, 0), Tm, Rm, Z, Cm), 2.2));

    // Truss spokes to every third module.
    if (k % 3 === 0) {
      const y0 = 1.3 - RR;
      const y1 = -0.62;
      for (const z of [-0.2, 0.2]) ringParts.metal.push(placed(rod(new Vector3(0, y0, z), new Vector3(0, y1, z), 0.055, 6), T, R, Z, C));
      ringParts.comp.push(boxUV(placed(rod(new Vector3(0.22, y0, 0), new Vector3(0.22, y1, 0), 0.1, 10), T, R, Z, C), 2.2));
      for (let y = y0 + 0.3; y < y1 - 0.1; y += 0.42) ringParts.carbon.push(placed(new BoxGeometry(0.05, 0.05, 0.42).translate(0, y, 0), T, R, Z, C));
    }
  });

  // Bearing collar the ring turns on.
  ringParts.comp.push(boxUV(cylZ(1.3, 1.3, 0.5, 28, 0), 2.2));
  ringParts.carbon.push(cylZ(1.34, 1.34, 0.1, 28, 0.2), cylZ(1.34, 1.34, 0.1, 28, -0.2));
  addParts(spin, ringParts);
  const windows = new InstancedMesh(new BoxGeometry(1, 1, 1), windowMat, windowMats.length);
  windowMats.forEach((m, i) => windows.setMatrixAt(i, m));
  spin.add(windows);
  const nozzleMesh = new Mesh(mergeAll(coreParts), nozzleCore);
  spin.add(nozzleMesh);
  root.add(spin);

  // ================================================================ the hub
  const hubParts = parts();
  hubParts.comp.push(boxUV(cylZ(1.0, 1.0, 3.6, 28, 0.1), 2.2));
  hubParts.silver.push(boxUV(cylZ(1.04, 1.04, 0.9, 28, -0.95), 0.9));
  hubParts.gold.push(boxUV(cylZ(1.04, 1.04, 0.8, 28, 1.25), 0.9));
  hubParts.metal.push(cylZ(0.62, 0.72, 0.4, 24, -1.85));
  hubParts.metal.push(new TorusGeometry(0.64, 0.05, 6, 28).translate(0, 0, -2.04));
  hubParts.carbon.push(cylZ(1.06, 1.06, 0.08, 28, -1.55), cylZ(1.06, 1.06, 0.08, 28, 1.75));
  // Antenna dish at the back.
  hubParts.comp.push(boxUV(new CylinderGeometry(0.95, 0.12, 0.35, 24, 1).rotateX(-Math.PI / 2).translate(0, 0, 2.25), 2.2));
  hubParts.metal.push(rod(new Vector3(0, 0, 2.2), new Vector3(0, 0, 3.0), 0.03, 6));
  // Black radiators left and right, ribbed.
  const ribMats: Matrix4[] = [];
  for (const sx of [1, -1]) {
    hubParts.carbon.push(new BoxGeometry(3.3, 0.05, 1.3).translate(sx * 2.75, 0, 1.45));
    hubParts.metal.push(rod(new Vector3(sx * 0.95, 0, 1.45), new Vector3(sx * 1.2, 0, 1.45), 0.08, 8));
    for (let i = 0; i < (low ? 8 : 14); i++) {
      const x = sx * (1.25 + (i / ((low ? 8 : 14) - 1)) * 3.0);
      ribMats.push(new Matrix4().compose(new Vector3(x, 0.035, 1.45), q.identity(), new Vector3(0.03, 0.03, 1.24)));
      ribMats.push(new Matrix4().compose(new Vector3(x, -0.035, 1.45), q.identity(), new Vector3(0.03, 0.03, 1.24)));
    }
  }
  // Solar wings up and down.
  for (const sy of [1, -1]) {
    hubParts.metal.push(rod(new Vector3(0, sy * 0.98, 2.05), new Vector3(0, sy * 4.9, 2.05), 0.045, 6));
    const panel = new BoxGeometry(1.15, 3.5, 0.04).translate(0, sy * 3.1, 2.05);
    hubParts.solar.push(boxUV(panel, 1.15));
  }
  // Attitude thruster quads around the hub, front and back.
  const RCS: [number, number, number, number, number][] = [
    // x, y, z, dir x, dir y
    [1.05, 0, -1.25, 1, 0],
    [-1.05, 0, -1.25, -1, 0],
    [0, 1.05, -1.25, 0, 1],
    [0, -1.05, -1.25, 0, -1],
    [1.05, 0, 0.95, 1, 0],
    [-1.05, 0, 0.95, -1, 0],
    [0, 1.05, 0.95, 0, 1],
    [0, -1.05, 0.95, 0, -1],
  ];
  const rcsNozzles: Nozzle[] = [];
  RCS.forEach(([x, y, z, dx, dy], i) => {
    hubParts.carbon.push(new BoxGeometry(0.22, 0.22, 0.22).translate(x * 0.95, y * 0.95, z));
    rcsNozzles.push({ o: new Vector3(x + dx * 0.08, y + dy * 0.08, z), d: new Vector3(dx, dy, 0), r: 0.06, kind: 2 + i });
  });
  addParts(root, hubParts);
  const ribs = new InstancedMesh(new BoxGeometry(1, 1, 1), metal, ribMats.length);
  ribMats.forEach((m, i) => ribs.setMatrixAt(i, m));
  root.add(ribs);

  // ================================================================ the lander
  // Simple and angular on purpose: a chamfered box body, a cockpit band at the
  // front, side engine pods, four legs, a ramp at the back and warm lights.
  const lander = new Group();
  lander.name = "lander";
  const LZ0 = -1.8;
  const LZ1 = 1.8;
  const LANDER: Key[] = [
    [0, 0.42, 0.26, 0.3],
    [0.1, 0.68, 0.46, 0.42],
    [0.3, 0.76, 0.56, 0.46],
    [1, 0.78, 0.58, 0.46],
  ];
  const lp = parts();
  lp.comp.push(boxUV(body(LANDER, LZ0, LZ1, low ? 6 : 10), 2.2));
  lp.carbon.push(plate(LANDER, LZ0, LZ1, { t0: 0.02, t1: 0.98, s0: 2.5, s1: 5.5, offset: 0.006, thick: 0.04 }, 6));
  lp.glass.push(plate(LANDER, LZ0, LZ1, { t0: 0.03, t1: 0.2, s0: 6.6, s1: 9.4, offset: 0.006, thick: 0.02 }, 4));
  lp.carbon.push(plate(LANDER, LZ0, LZ1, { t0: 0.45, t1: 0.85, s0: 7.2, s1: 8.8, offset: 0.006, thick: 0.04 }, 4));
  // Side engine pods with a bell each at the back.
  for (const sx of [1, -1]) {
    lp.comp.push(boxUV(new BoxGeometry(0.42, 0.42, 2.4).translate(sx * 0.98, -0.05, 0.45), 2.2));
    lp.carbon.push(new BoxGeometry(0.46, 0.08, 2.0).translate(sx * 0.98, 0.18, 0.45));
    lp.metal.push(latheZ(BELL.map(([r, z]) => [r * 0.55, z * 0.55]), seg, 1.62, sx * 0.98, -0.05));
  }
  // Roof rack and antenna.
  lp.carbon.push(new BoxGeometry(0.9, 0.08, 1.0).translate(0, 0.62, 0.6));
  lp.metal.push(rod(new Vector3(0.3, 0.62, 0.4), new Vector3(0.3, 1.05, 0.55), 0.02, 5));
  const LBRAKE = [
    [0.55, -0.48, -1.0],
    [-0.55, -0.48, -1.0],
    [0.55, -0.48, 1.0],
    [-0.55, -0.48, 1.0],
  ];
  const brakeNozzles: Nozzle[] = LBRAKE.map(([x, y, z]) => {
    lp.carbon.push(new BoxGeometry(0.2, 0.08, 0.2).translate(x, y, z));
    return { o: new Vector3(x, y - 0.05, z), d: new Vector3(0, -1, 0), r: 0.08, kind: 1 };
  });
  addParts(lander, lp);
  // Its own skin: a ceramic grey hull that takes the sky, bright trim, dark seals, small lights.
  const hullMat = comp.clone();
  hullMat.color = new Color(0xd2cfc8);
  hullMat.metalness = 0.22;
  hullMat.roughness = 0.6;
  hullMat.envMapIntensity = 0.8;
  const trimMat = new MeshStandardMaterial({ color: 0xc6c9cf, metalness: 1, roughness: 0.36, envMapIntensity: 1.25 });
  // Legs and rails: worn metal that never throws the sun back as a white spot.
  const legMat = metal.clone();
  legMat.roughness = 0.62;
  legMat.metalness = 0.75;
  const ledMat = new MeshBasicMaterial({ color: new Color(1.5, 1.05, 0.62) });
  lander.traverse((o) => {
    const mm = o as Mesh;
    if (mm.isMesh && mm.material === comp) mm.material = hullMat;
  });
  {
    const trim: BufferGeometry[] = [];
    const dark: BufferGeometry[] = [];
    const led: BufferGeometry[] = [];
    const Z = LZ1;
    // A proper frame around the hatch: outer trim, a dark seal inside it, a light strip over the door.
    trim.push(new BoxGeometry(1.0, 0.1, 0.11).translate(0, 0.46, Z + 0.045));
    trim.push(new BoxGeometry(1.0, 0.07, 0.11).translate(0, -0.47, Z + 0.045));
    for (const sx of [1, -1]) {
      trim.push(new BoxGeometry(0.09, 0.96, 0.11).translate(sx * 0.455, -0.01, Z + 0.045));
      dark.push(new BoxGeometry(0.035, 0.86, 0.13).translate(sx * 0.4, -0.02, Z + 0.035));
      // Ribs and a grab rail either side of the hatch.
      trim.push(new BoxGeometry(0.04, 0.72, 0.05).translate(sx * 0.6, 0.02, Z + 0.02));
      trim.push(new BoxGeometry(0.02, 0.52, 0.02).translate(sx * 0.53, -0.04, Z + 0.11));
      dark.push(new BoxGeometry(0.1, 0.2, 0.03).translate(sx * 0.68, 0.24, Z + 0.012));
      dark.push(new BoxGeometry(0.1, 0.1, 0.03).translate(sx * 0.68, -0.26, Z + 0.012));
      led.push(new BoxGeometry(0.045, 0.012, 0.01).translate(sx * 0.68, 0.24, Z + 0.03));
    }
    dark.push(new BoxGeometry(0.8, 0.035, 0.13).translate(0, 0.405, Z + 0.035));
    led.push(new BoxGeometry(0.62, 0.012, 0.012).translate(0, 0.38, Z + 0.1));
    // Along the flanks: vents, a conduit, a band of small ports.
    for (const sx of [1, -1]) {
      for (let k = 0; k < 7; k++) dark.push(new BoxGeometry(0.014, 0.05, 0.11).translate(sx * 0.785, 0.1 - (k % 2) * 0.0, -0.7 + k * 0.15));
      trim.push(rod(new Vector3(sx * 0.7, 0.42, -1.4), new Vector3(sx * 0.7, 0.42, 1.65), 0.012, 5));
      trim.push(rod(new Vector3(sx * 0.52, 0.56, -1.0), new Vector3(sx * 0.52, 0.56, 1.5), 0.016, 6));
      for (let k = 0; k < 4; k++) led.push(new BoxGeometry(0.008, 0.012, 0.03).translate(sx * 0.792, 0.27, -0.5 + k * 0.3));
      // Thruster quads at the corners.
      for (const sz of [1.5, -1.3]) {
        dark.push(new BoxGeometry(0.12, 0.12, 0.12).translate(sx * 0.72, 0.36, sz));
        trim.push(new CylinderGeometry(0.018, 0.03, 0.05, 8).rotateZ(sx * -Math.PI * 0.5).translate(sx * 0.8, 0.36, sz));
      }
      // Collars and a fin on the engine pods.
      trim.push(new CylinderGeometry(0.25, 0.25, 0.04, 18).rotateX(Math.PI / 2).translate(sx * 0.98, -0.05, 1.56));
      trim.push(new CylinderGeometry(0.25, 0.25, 0.03, 18).rotateX(Math.PI / 2).translate(sx * 0.98, -0.05, 0.9));
      dark.push(new BoxGeometry(0.03, 0.14, 0.7).translate(sx * 0.98, 0.2, 1.05));
    }
    // A small dish and mast on the roof.
    trim.push(new CylinderGeometry(0.1, 0.02, 0.05, 14).translate(-0.28, 0.74, 0.5));
    trim.push(rod(new Vector3(-0.28, 0.62, 0.5), new Vector3(-0.28, 0.72, 0.5), 0.012, 6));
    lander.add(new Mesh(mergeAll(trim), trimMat), new Mesh(mergeAll(dark), carbon), new Mesh(mergeAll(led), ledMat));
  }

  // The ramp: closed it is the back wall, open it slides out to a long easy
  // slope down to the ground. Treads and side rails give it scale.
  const STAND = 1.35;
  const RAMP_LEN = 2.6;
  const rampPivot = new Group();
  rampPivot.position.set(0, -0.44, LZ1 + 0.02);
  const rampParts: BufferGeometry[] = [new BoxGeometry(0.9, RAMP_LEN, 0.05).translate(0, RAMP_LEN / 2, 0)];
  const railParts: BufferGeometry[] = [];
  for (const sx of [1, -1]) railParts.push(new BoxGeometry(0.05, RAMP_LEN, 0.1).translate(sx * 0.47, RAMP_LEN / 2, 0.02));
  for (let k = 0; k < 12; k++) railParts.push(new BoxGeometry(0.82, 0.035, 0.03).translate(0, 0.12 + (k / 12) * (RAMP_LEN - 0.2), -0.035));
  for (const sx of [1, -1]) railParts.push(new BoxGeometry(0.03, RAMP_LEN * 0.62, 0.05).translate(sx * 0.47, RAMP_LEN * 0.33, 0.08));
  const rampMat = new MeshStandardMaterial({ color: 0x3b3d42, metalness: 0.8, roughness: 0.5, envMapIntensity: 0.9 });
  const ramp = new Mesh(boxUV(mergeAll(rampParts), 2.2), rampMat);
  ramp.castShadow = shadows;
  ramp.receiveShadow = shadows;
  const rampRails = new Mesh(mergeAll(railParts), legMat);
  rampRails.castShadow = shadows;
  rampRails.receiveShadow = shadows;
  const rampLed: BufferGeometry[] = [];
  for (const sx of [1, -1]) rampLed.push(new BoxGeometry(0.012, RAMP_LEN * 0.9, 0.012).translate(sx * 0.44, RAMP_LEN * 0.5, -0.05));
  const rampLight = new Mesh(mergeAll(rampLed), new MeshBasicMaterial({ color: new Color(1.3, 0.8, 0.42) }));
  rampPivot.add(ramp, rampRails, rampLight);
  lander.add(rampPivot);
  const RAMP_CLOSED = 0.95 / RAMP_LEN;
  const RAMP_OPEN = Math.PI - Math.acos(Math.min(1, (STAND - 0.44) / RAMP_LEN));
  rampPivot.scale.y = RAMP_CLOSED;
  // The open hatch: warm light from inside, framed by the hull.
  const doorMat = new ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uOpen;
      varying vec2 vUv;
      void main() {
        // A lit corridor seen from outside: bright overhead, dark at the sides and floor.
        vec2 q = vUv - vec2(0.5, 0.5);
        float room = smoothstep(0.5, 0.18, abs(q.x)) * smoothstep(-0.52, 0.28, q.y);
        float ceiling = exp(-pow((q.y - 0.42) / 0.09, 2.0)) * smoothstep(0.42, 0.08, abs(q.x));
        float ribs = 0.95 + 0.05 * sin(vUv.y * 40.0);
        vec3 c = vec3(0.012, 0.009, 0.008) + vec3(0.7, 0.36, 0.14) * room * ribs + vec3(1.5, 0.92, 0.5) * ceiling;
        gl_FragColor = vec4(c * uOpen, 1.0);
      }`,
    uniforms: { uOpen: { value: 0 } },
  });
  const doorPanel = new Mesh(new PlaneGeometry(0.8, 0.86).translate(0, -0.02, 0), doorMat);
  doorPanel.position.set(0, 0, LZ1 + 0.012);
  doorPanel.visible = false;
  lander.add(doorPanel);


  // Heat glow wrapped around the lander while it comes down through the air.
  const heatMat = additive(
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          vP = position;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uHeat; uniform float uTime;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          float below = smoothstep(0.4, -0.9, vP.y);
          float flick = 0.75 + 0.25 * sin(uTime * 40.0 + vP.z * 9.0 + vP.x * 7.0);
          vec3 col = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.85, 0.6), below * 0.6);
          gl_FragColor = vec4(col * rim * (0.4 + below) * flick * uHeat * 2.2, 1.0);
        }`,
      uniforms: { uHeat: { value: 0 }, uTime: { value: 0 } },
      side: DoubleSide,
    }),
  );
  const heatShell = new Mesh(new SphereGeometry(1, 24, 16).scale(1.45, 1.05, 2.5).translate(0, -0.1, 0), heatMat);
  heatShell.visible = false;
  heatShell.renderOrder = 5;
  lander.add(heatShell);

  // Landing legs, folded flat under the body until the descent.
  const SPLAY = 0.42;
  const legs: { pivot: Group; side: number }[] = [];
  for (const [x, y, z] of [
    [0.62, -0.42, -1.05],
    [-0.62, -0.42, -1.05],
    [0.62, -0.42, 1.15],
    [-0.62, -0.42, 1.15],
  ]) {
    const len = (STAND + y) / (Math.cos(SPLAY) * Math.cos(0.1));
    const lg: BufferGeometry[] = [
      new BoxGeometry(0.11, len * 0.6, 0.11).translate(0, -len * 0.3, 0),
      new CylinderGeometry(0.045, 0.045, len * 0.5, 6).translate(0, -len * 0.72, 0),
      new CylinderGeometry(0.17, 0.2, 0.06, 12).translate(0, -len + 0.03, 0),
    ];
    const pivot = new Group();
    pivot.position.set(x, y, z);
    lg.push(new CylinderGeometry(0.1, 0.12, 0.05, 12).translate(0, -len + 0.08, 0));
    lg.push(new CylinderGeometry(0.018, 0.018, len * 0.62, 6).translate(0.075, -len * 0.42, 0));
    const mesh = new Mesh(mergeAll(lg), legMat);
    mesh.castShadow = shadows;
    const sleeve = new Mesh(mergeAll([new BoxGeometry(0.15, len * 0.34, 0.15).translate(0, -len * 0.17, 0), new BoxGeometry(0.1, 0.06, 0.1).translate(0, -len * 0.36, 0), new CylinderGeometry(0.03, 0.03, 0.12, 8).rotateZ(Math.PI / 2).translate(0, -0.02, 0)]), carbon);
    sleeve.castShadow = shadows;
    pivot.add(mesh, sleeve);
    pivot.rotation.order = "ZXY";
    pivot.visible = false;
    lander.add(pivot);
    legs.push({ pivot, side: Math.sign(x) });
  }
  const dock = new Matrix4().makeTranslation(0, 0, -2.12 + LZ0);

  // ================================================================ lights
  // Ring lights turn with the ring: alternating red, green and white.
  const ringGlows = new GlowBatch(24);
  const ringLight: number[] = [];
  ringLightsPos.forEach((p, i) => {
    const c = i % 3 === 0 ? [1, 0.18, 0.2] : i % 3 === 1 ? [0.3, 1, 0.45] : [1, 1, 1];
    ringLight.push(ringGlows.add(p.x, p.y, p.z, 0.22, c[0], c[1], c[2], 1));
  });
  const engineGlow: number[] = engineNozzles.map((n) => ringGlows.add(n.o.x, n.o.y, n.o.z + 0.05, 0.6, 0.5, 0.75, 1, 1));
  spin.add(ringGlows.mesh);
  const hubGlows = new GlowBatch(16);
  const beacon = [hubGlows.add(0, 1.08, 0.3, 0.3, 1, 0.2, 0.2, 0), hubGlows.add(0, -1.08, 0.3, 0.3, 1, 0.2, 0.2, 0)];
  const strobe = [hubGlows.add(4.45, 0, 1.45, 0.35, 1, 1, 1, 0), hubGlows.add(-4.45, 0, 1.45, 0.35, 1, 1, 1, 0)];
  const rcsGlow = rcsNozzles.map((n) => hubGlows.add(n.o.x + n.d.x * 0.1, n.o.y + n.d.y * 0.1, n.o.z, 0.32, 0.85, 0.92, 1, 0));
  const portGlow = hubGlows.add(0, 0, -2.08, 0.5, 1, 1, 1, 1);
  root.add(hubGlows.mesh);
  const landerGlows = new GlowBatch(22);
  const navL = landerGlows.add(-1.2, 0.1, 0.2, 0.16, 1, 0.15, 0.2, 1);
  const navR = landerGlows.add(1.2, 0.1, 0.2, 0.16, 0.25, 1, 0.4, 1);
  const lBeacon = landerGlows.add(0, 0.72, 0.6, 0.14, 1, 0.3, 0.25, 0);
  const lEngine = [-0.98, 0.98].map((x) => landerGlows.add(x, -0.05, 2.25, 0.36, 0.6, 0.8, 1, 0.4));
  const brakeGlow = brakeNozzles.map((n) => landerGlows.add(n.o.x, n.o.y - 0.08, n.o.z, 0.36, 1, 0.9, 0.8, 0));
  // Warm floodlights under the nose and in the doorway.
  const flood = [landerGlows.add(0.4, -0.45, -1.6, 0.5, 1, 0.68, 0.36, 1), landerGlows.add(-0.4, -0.45, -1.6, 0.5, 1, 0.68, 0.36, 1)];
  const door = landerGlows.add(0, 0.05, 1.7, 1.1, 1, 0.66, 0.34, 0);
  for (const [gx, gy, gz, gs, gr, gg, gb] of [
    [0.72, 0.5, 1.75, 0.05, 1, 0.8, 0.5],
    [-0.72, 0.5, 1.75, 0.05, 1, 0.8, 0.5],
    [0.47, 0.53, 1.92, 0.04, 1, 0.9, 0.7],
    [-0.47, 0.53, 1.92, 0.04, 1, 0.9, 0.7],
  ])
    landerGlows.add(gx, gy, gz, gs, gr, gg, gb, 0.9);
  lander.add(landerGlows.mesh);

  // ================================================================ exhaust
  const rcsU = new Float32Array(8);
  const plumeMat = additive(
    new ShaderMaterial({
      vertexShader: PLUME_VS,
      fragmentShader: PLUME_FS,
      uniforms: {
        uLen: { value: 1 },
        uIntensity: { value: 0.5 },
        uBrake: { value: 0 },
        uRcs: { value: rcsU },
        uColor: { value: new Color() },
        uTime: { value: 0 },
      },
      side: DoubleSide,
    }),
  );
  const mkPlumes = (list: Nozzle[], target: Object3D) => {
    const m = new Mesh(buildPlumes(list, low ? 8 : 14, low ? 6 : 10), plumeMat);
    m.frustumCulled = false;
    m.renderOrder = 4;
    target.add(m);
  };
  mkPlumes(engineNozzles, spin);
  mkPlumes(rcsNozzles, root);
  mkPlumes(brakeNozzles, lander);

  // Faint ion trails from the engine pods, fed by a short position history.
  const TR = low ? 20 : 32;
  const vertsPer = (TR + 1) * 2;
  const tPos = new Float32Array(engineNozzles.length * vertsPer * 3);
  const tUv = new Float32Array(engineNozzles.length * vertsPer * 2);
  const tIdx: number[] = [];
  for (let s = 0; s < engineNozzles.length; s++) {
    for (let k = 0; k <= TR; k++) {
      const b = s * vertsPer + k * 2;
      tUv.set([k / TR, 0, k / TR, 1], b * 2);
      if (k < TR) tIdx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  const trailGeo = new BufferGeometry();
  const tPosAttr = new BufferAttribute(tPos, 3);
  tPosAttr.setUsage(DynamicDrawUsage);
  trailGeo.setAttribute("position", tPosAttr);
  trailGeo.setAttribute("aUv", new BufferAttribute(tUv, 2));
  trailGeo.setIndex(tIdx);
  const trailMat = additive(
    new ShaderMaterial({ vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, uniforms: { uColor: { value: new Color() }, uIntensity: { value: 0.1 }, uTime: { value: 0 } }, side: DoubleSide }),
  );
  const trails = new Mesh(trailGeo, trailMat);
  trails.frustumCulled = false;
  trails.renderOrder = 3;
  const HIST = TR;
  const hist = new Float32Array(engineNozzles.length * HIST * 3);
  const age = new Float32Array(HIST);
  let head = 0;
  let seeded = false;
  let acc = 0;
  const STEP = 1 / 40;
  const nv = new Vector3();
  const toRig = new Matrix4();
  const record = (slot: number) => {
    for (let n = 0; n < engineNozzles.length; n++) {
      nv.copy(engineNozzles[n].o).applyMatrix4(toRig);
      const o = (n * HIST + slot) * 3;
      hist[o] = nv.x;
      hist[o + 1] = nv.y;
      hist[o + 2] = nv.z;
    }
  };

  const engineCol = new Color();
  const white = new Color(1, 1, 1);
  const blue = new Color(0.45, 0.68, 1.0);
  let thrust = 0;
  let prevYaw = 0;
  let prevPitch = 0;
  let yawRate = 0;
  let pitchRate = 0;
  let clock = 0;
  void rand;

  function update(s: ShipInput) {
    const { time, dt, boost, color, gear, brake, idle, detach } = s;
    clock += dt;

    // The ring turns slowly; the hub stays still.
    spin.rotation.z += dt * (s.reduced ? 0.03 : 0.07);

    // Engine pods: a modest blue glow that grows a little with speed.
    const target = 0.2 + boost * 0.8;
    thrust += (target - thrust) * Math.min(1, dt * 4);
    engineCol.copy(blue).lerp(color, 0.25);
    nozzleCore.color.copy(engineCol).lerp(white, 0.3).multiplyScalar(1.0 + thrust * 1.6);
    plumeMat.uniforms.uColor.value.copy(engineCol);
    plumeMat.uniforms.uLen.value = 0.8 + thrust * 4.5;
    plumeMat.uniforms.uIntensity.value = 0.3 + thrust * 0.9;
    plumeMat.uniforms.uBrake.value = brake * (0.85 + 0.15 * Math.sin(time * 41));
    plumeMat.uniforms.uTime.value = time;
    for (const i of engineGlow) {
      ringGlows.setColor(i, engineCol.r, engineCol.g, engineCol.b);
      ringGlows.setIntensity(i, 0.35 + thrust * 0.8);
    }
    for (let i = 0; i < ringLight.length; i++) ringGlows.setIntensity(ringLight[i], 0.4 + 2.2 * Math.pow(Math.max(0, Math.sin(time * 1.9 + i * 1.1)), 12));
    ringGlows.commit();

    // Hub: red beacons, white strobes on the radiator tips, the docking port light.
    const b = Math.pow(Math.max(0, Math.sin(time * 2.2)), 8) * 3.2;
    hubGlows.setIntensity(beacon[0], b);
    hubGlows.setIntensity(beacon[1], b);
    const ph = time % 2.0;
    const flash = ph < 0.05 || (ph > 0.16 && ph < 0.21) ? 4 : 0;
    hubGlows.setIntensity(strobe[0], flash);
    hubGlows.setIntensity(strobe[1], flash);
    hubGlows.setColor(portGlow, color.r, color.g, color.b);
    hubGlows.setIntensity(portGlow, (0.6 + 0.3 * Math.sin(time * 3)) * (1 - detach * 0.7));

    // Attitude thrusters puff when the ship yaws or pitches.
    const r = root.rotation;
    const k = 1 - Math.exp(-dt * 10);
    yawRate += ((r.y - prevYaw) / Math.max(dt, 1e-3) - yawRate) * k;
    pitchRate += ((r.x - prevPitch) / Math.max(dt, 1e-3) - pitchRate) * k;
    prevYaw = r.y;
    prevPitch = r.x;
    const yaw = Math.max(-1, Math.min(1, yawRate * 5));
    const pitch = Math.max(-1, Math.min(1, pitchRate * 5));
    // Order matches RCS: front +X, -X, +Y, -Y, then rear +X, -X, +Y, -Y.
    const want = [
      Math.max(0, yaw),
      Math.max(0, -yaw),
      Math.max(0, -pitch),
      Math.max(0, pitch),
      Math.max(0, -yaw),
      Math.max(0, yaw),
      Math.max(0, pitch),
      Math.max(0, -pitch),
    ];
    for (let i = 0; i < 8; i++) {
      const raw = s.reduced ? 0 : Math.min(1, Math.max(0, want[i] - 0.1) * 1.8);
      const flicker = 0.75 + 0.25 * Math.sin(clock * 53 + i * 2.1);
      rcsU[i] = raw * flicker;
      hubGlows.setIntensity(rcsGlow[i], raw * 2.6 * flicker);
    }
    hubGlows.commit();

    // Lander: nav lights, a beacon once it is away, braking jets, legs, cooling engines,
    // heat on the way down, then the ramp opens onto warm light.
    heatMat.uniforms.uHeat.value = s.heat;
    heatMat.uniforms.uTime.value = time;
    heatShell.visible = s.heat > 0.01;
    // How far the ramp is open is a position in the story.
    const re = s.ramp * s.ramp * (3 - 2 * s.ramp);
    rampPivot.rotation.x = re * RAMP_OPEN;
    rampPivot.scale.y = RAMP_CLOSED + (1 - RAMP_CLOSED) * re;
    doorPanel.visible = re > 0.01;
    doorMat.uniforms.uOpen.value = re;
    landerGlows.setIntensity(door, re * (0.22 + s.glare * 0.95));
    for (const i of flood) landerGlows.setIntensity(i, 0.5 + 1.1 * Math.max(s.gear, re));
    landerGlows.setIntensity(navL, 1.6);
    landerGlows.setIntensity(navR, 1.6);
    landerGlows.setIntensity(lBeacon, detach > 0.01 ? Math.pow(Math.max(0, Math.sin(time * 2.8)), 10) * 2.2 : 0);
    const lHot = detach * (1 - idle);
    for (const i of lEngine) {
      landerGlows.setColor(i, engineCol.r, engineCol.g, engineCol.b);
      landerGlows.setIntensity(i, 0.25 + lHot * 1.4);
    }
    for (let i = 0; i < brakeGlow.length; i++) landerGlows.setIntensity(brakeGlow[i], brake * (2.4 + Math.sin(time * 47 + i) * 0.5));
    landerGlows.commit();
    const g = gear * gear * (3 - 2 * gear);
    for (const leg of legs) {
      leg.pivot.visible = gear > 0.001;
      leg.pivot.rotation.x = -1.45 * (1 - g) - 0.1 * g;
      leg.pivot.rotation.z = leg.side * SPLAY * g;
    }

    // Trails: record engine positions in rig space, then stream them back.
    root.updateMatrix();
    spin.updateMatrix();
    toRig.multiplyMatrices(root.matrix, spin.matrix);
    if (!seeded) {
      for (let kk = 0; kk < HIST; kk++) {
        const slot = (head - kk + HIST) % HIST;
        age[slot] = kk * STEP;
        record(slot);
      }
      seeded = true;
    }
    acc += dt;
    for (let kk = 0; kk < HIST; kk++) age[kk] += dt;
    while (acc >= STEP) {
      acc -= STEP;
      head = (head + 1) % HIST;
      age[head] = acc;
      record(head);
    }
    const flow = (s.reduced ? 4 : 8) + Math.abs(s.speed) * 30;
    for (let n = 0; n < engineNozzles.length; n++) {
      const base = n * vertsPer;
      for (let kk = 0; kk <= TR; kk++) {
        let x: number;
        let y: number;
        let zz: number;
        let a: number;
        if (kk === 0) {
          nv.copy(engineNozzles[n].o).applyMatrix4(toRig);
          x = nv.x;
          y = nv.y;
          zz = nv.z;
          a = 0;
        } else {
          const h = (head - (kk - 1) + HIST) % HIST;
          const o = (n * HIST + h) * 3;
          a = age[h];
          x = hist[o];
          y = hist[o + 1];
          zz = hist[o + 2] + a * flow * s.heading;
        }
        const w = 0.08 + a * 0.35;
        const vi = (base + kk * 2) * 3;
        tPos[vi] = x - w;
        tPos[vi + 1] = y;
        tPos[vi + 2] = zz;
        tPos[vi + 3] = x + w;
        tPos[vi + 4] = y;
        tPos[vi + 5] = zz;
      }
    }
    tPosAttr.needsUpdate = true;
    trailMat.uniforms.uColor.value.copy(engineCol);
    trailMat.uniforms.uIntensity.value = 0.04 + thrust * 0.12;
    trailMat.uniforms.uTime.value = time;
  }

  void m4;
  void one;
  return { root, lander, dock, trails, radius: 6.9, landerRadius: 2.3, standHeight: STAND + 0.03, update };
}
