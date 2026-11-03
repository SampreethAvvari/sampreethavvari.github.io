// The four docking bays. Each is built from what that work really is, so the
// four have nothing in common but the amber light:
//
//   AI Engineering: a reading room. Lines of transcript stream down the hall,
//     pass a scanning blade, and snap into the cells of a schema on the far
//     wall. Slatted doors.
//   Forward-Deployed: an open dock with no back wall. A boom reaches out of
//     the station to three office pods and a lab, and light runs along the
//     tethers in both directions. Clamshell doors.
//   Machine Learning: a CT gantry. Rings turn around an arch of points being
//     scanned, and at the far end twenty sealed cubes sit behind glass: the
//     holdout, kept out of training. An iris door.
//   Software: the keel. Blast doors, a wall of exactly 360 cells that all
//     light, and ledger stacks that only ever grow.
//
// Local frame of a bay: origin at the centre of its mouth on the ring's front
// face, +Z out into space, -Z down the hall, +Y toward the hub.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Shape,
  TorusGeometry,
  Vector3,
  type Material,
} from "three";
import { hullMaterial } from "./hull";
import { FACE_Z, MOUTH_H, MOUTH_W, RC, bayAngle } from "./station";
import { DEG, TAU, box, clamp, cyl, lerp, merge, place, rng, smooth, strut } from "./util";

export type BayId = "aie" | "fde" | "mle" | "sde";
export const BAY_IDS: BayId[] = ["aie", "fde", "mle", "sde"];
export const HALL = 230; // how far the halls run back

const WARM = new Color(1, 0.62, 0.26);

export interface BayLight {
  /** Local position. */
  p: [number, number, number];
  i: number;
  d: number;
  c?: [number, number, number];
}

/** Something in a bay that answers the pointer and has its own note. */
export interface BayPart {
  mesh: Mesh;
  /** The part's name and its note for a hit, from the hit's uv and instance. */
  read: (uv: { x: number; y: number } | undefined) => { id: string; note: number };
  /** Told where the pointer is on the part, or null when it left. */
  touch?: (uv: { x: number; y: number } | null) => void;
}

export interface Bay {
  id: BayId;
  index: number;
  group: Group;
  /** Everything behind the doors: hidden while the bay can't be seen into. */
  inside: Group;
  /** Invisible plane across the mouth, for hover and click. */
  hit: Mesh;
  parts: BayPart[];
  lights: BayLight[];
  update(time: number, dt: number, open: number, power: number): void;
  dispose(): void;
}

interface Kit {
  low: boolean;
  wall: Material;
  trim: Material;
  steel: Material;
  dark: Material;
  uniforms: { uTime: { value: number } }[];
  add(mat: Material): Material;
}

const lightMat = (mult: number, c: Color = WARM) => new MeshBasicMaterial({ color: c.clone().multiplyScalar(mult) });

// Soft light hanging in the air: strongest in the middle of a quad, gone at
// its edges. Adding a few of these in depth reads as glowing haze.
function hazeMaterial(mult: number) {
  return new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uC: { value: WARM.clone().multiplyScalar(mult) }, uK: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uC; uniform float uK; varying vec2 vUv;
      void main(){ vec2 q=abs(vUv-0.5)*2.0; float a=(1.0-smoothstep(0.0,1.0,q.x))*(1.0-smoothstep(0.0,1.0,q.y)); gl_FragColor=vec4(uC*a*a*uK,1.0); }`,
  });
}

function hitPlane(w: number, h: number, z = 2) {
  const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ visible: false }));
  m.position.z = z;
  return m;
}

// A glow in the mouth, so an open door throws light out into space.
function mouthGlow(kit: Kit, w: number, h: number) {
  const mat = hazeMaterial(1);
  kit.add(mat);
  const group = new Group();
  const planes = [0, -8, -18].map((z, i) => {
    const m = new Mesh(new PlaneGeometry(w * (1.5 - i * 0.2), h * (1.5 - i * 0.2)), mat);
    m.position.z = z;
    m.renderOrder = 8;
    group.add(m);
    return m;
  });
  void planes;
  return { group, mat };
}

// ---------------------------------------------------------------- hall kit

function hallShell(kit: Kit, w: number, h: number, len: number, ribEvery: number, ribDepth: number) {
  const g = new Group();
  const parts: BufferGeometry[] = [];
  // Walls, floor, ceiling.
  parts.push(box(1, h, len, -w / 2 - 0.5, 0, -len / 2));
  parts.push(box(1, h, len, w / 2 + 0.5, 0, -len / 2));
  parts.push(box(w + 2, 1, len, 0, -h / 2 - 0.5, -len / 2));
  parts.push(box(w + 2, 1, len, 0, h / 2 + 0.5, -len / 2));
  const shell = new Mesh(merge(parts), kit.wall);
  shell.receiveShadow = true;
  g.add(shell);
  const ribs: BufferGeometry[] = [];
  for (let z = -ribEvery; z > -len; z -= ribEvery) {
    ribs.push(box(ribDepth, h, 2.2, -w / 2 + ribDepth / 2, 0, z));
    ribs.push(box(ribDepth, h, 2.2, w / 2 - ribDepth / 2, 0, z));
    ribs.push(box(w, ribDepth, 2.2, 0, h / 2 - ribDepth / 2, z));
    ribs.push(box(w, 0.8, 2.2, 0, -h / 2 + 0.4, z));
  }
  g.add(new Mesh(merge(ribs), kit.trim));
  return g;
}

function collarPlate(kit: Kit, outerW: number, outerH: number, depth: number, hole: (s: Path) => void) {
  const s = new Shape();
  s.moveTo(-outerW / 2, -outerH / 2);
  s.lineTo(outerW / 2, -outerH / 2);
  s.lineTo(outerW / 2, outerH / 2);
  s.lineTo(-outerW / 2, outerH / 2);
  s.closePath();
  const p = new Path();
  hole(p);
  s.holes.push(p);
  const geo = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1, curveSegments: 64 });
  const m = new Mesh(geo, kit.trim);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const rectHole = (w: number, h: number) => (p: Path) => {
  p.moveTo(-w, -h);
  p.lineTo(-w, h);
  p.lineTo(w, h);
  p.lineTo(w, -h);
  p.closePath();
};

// ---------------------------------------------------------------- AI: the reading room

function buildAie(kit: Kit, index: number): Bay {
  const group = new Group();
  const inside = new Group();
  group.add(inside);
  const W = MOUTH_W * 2 - 2;
  const H = MOUTH_H * 2 - 2;
  inside.add(hallShell(kit, W, H, HALL, 7, 1.4));

  // Collar: thin vertical fins down both sides and a lit header.
  const c = new Group();
  c.add(collarPlate(kit, MOUTH_W * 2 + 12, MOUTH_H * 2 + 8, 2.6, rectHole(MOUTH_W - 1, MOUTH_H - 1)));
  const fins: BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const x = MOUTH_W + 1.6 + i * 1.5;
    const hh = MOUTH_H * 2 + 26 - i * 6;
    fins.push(box(0.5, hh, 7 - i * 0.6, x, 0, 3));
    fins.push(box(0.5, hh, 7 - i * 0.6, -x, 0, 3));
  }
  const finMesh = new Mesh(merge(fins), kit.dark);
  finMesh.castShadow = true;
  c.add(finMesh);
  group.add(c);
  const stripMat = kit.add(lightMat(2.4));
  const header = new Mesh(box(MOUTH_W * 2 - 4, 0.22, 0.22, 0, MOUTH_H + 2.2, 3), stripMat);
  group.add(header);

  // Light strips, three high on each wall.
  const strips: BufferGeometry[] = [];
  for (const y of [-12, 0, 12]) {
    strips.push(box(0.4, 0.4, HALL - 10, -W / 2 + 1.7, y, -HALL / 2));
    strips.push(box(0.4, 0.4, HALL - 10, W / 2 - 1.7, y, -HALL / 2));
  }
  strips.push(box(1.2, 0.2, HALL - 8, 0, -H / 2 + 0.9, -HALL / 2));
  const stripsMat = kit.add(lightMat(4)) as MeshBasicMaterial;
  inside.add(new Mesh(merge(strips), stripsMat));

  // The stream of transcript. Each bar is a line of words moving down the
  // hall; past the blade it snaps into a column and takes the cell's width.
  const COUNT = kit.low ? 700 : 2400;
  const barGeo = new PlaneGeometry(1, 1);
  const inst = new InstancedMesh(barGeo, new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aS; // x, row, length seed, speed seed
      uniform float uTime; uniform float uPower;
      varying float vB; varying vec2 vUv;
      void main() {
        const float LEN = ${(HALL - 34).toFixed(1)};
        float z = -mod(aS.z * LEN + uTime * (6.0 + aS.w * 5.0), LEN) - 8.0;
        float k = smoothstep(120.0, 170.0, -z);
        float row = floor(aS.y * 26.0);
        float y = -15.0 + row * 1.16;
        float free = (aS.x - 0.5) * 30.0;
        // Into columns: the structure emerges as the lines near the schema.
        float col = floor(aS.x * 8.0);
        float fixedX = -14.0 + col * 4.0;
        float x = mix(free, fixedX, k);
        float w = mix(2.0 + aS.w * 9.0, 3.2, k);
        vec3 p = vec3(position.x * w + x, position.y * mix(0.26, 0.42, k) + y, z);
        vB = (0.25 + 1.6 * k) * uPower * (0.5 + 0.5 * sin(aS.z * 91.0 + uTime * 0.6)) + 0.04 * uPower;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vB; varying vec2 vUv;
      void main() {
        float e = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        gl_FragColor = vec4(vec3(1.0, 0.68, 0.32) * vB * e * 3.2, 1.0);
      }`,
  }), COUNT);
  inst.frustumCulled = false;
  const R = rng(1201);
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT * 4; i++) seeds[i] = R();
  barGeo.setAttribute("aS", new InstancedBufferAttribute(seeds, 4));
  inside.add(inst);
  const streamMat = inst.material as ShaderMaterial;

  // The schema on the far wall: rows of cells filling in, one field at a time.
  const schemaMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uHot: { value: new Vector3(-1, -1, 0) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower; uniform vec3 uHot; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 g = vec2(12.0, 14.0);
        vec2 q = vUv * g;
        vec2 id = floor(q);
        vec2 f = fract(q);
        float row = g.y - 1.0 - id.y;
        float cycle = fract(uTime * 0.05);
        float t = (row * g.x + id.x) / (g.x * g.y);
        float lit = smoothstep(t, t + 0.01, cycle * 1.25) * smoothstep(1.25, 1.1, cycle * 1.25 + 0.0);
        float m = smoothstep(0.08, 0.14, f.x) * smoothstep(0.92, 0.86, f.x) * smoothstep(0.16, 0.24, f.y) * smoothstep(0.84, 0.76, f.y);
        float frame = m * (0.1 + 0.05 * h(id));
        vec3 base = vec3(1.0, 0.62, 0.26);
        float hot = step(0.0, uHot.x) * step(abs(id.y - uHot.y), 0.5) * uHot.z;
        vec3 c = base * (frame * 0.7 + m * lit * (0.55 + 0.55 * h(id + 3.0)) * 3.6 + m * hot * 4.0);
        gl_FragColor = vec4(c * uPower + vec3(0.012, 0.008, 0.004), 1.0);
      }`,
  });
  const schema = new Mesh(new PlaneGeometry(W, H), schemaMat);
  schema.position.z = -HALL + 1;
  inside.add(schema);

  // The scanning blade.
  const bladeMat = kit.add(hazeMaterial(5)) as ShaderMaterial;
  const blade = new Mesh(new PlaneGeometry(W, H), bladeMat);
  blade.renderOrder = 6;
  inside.add(blade);
  const bladeEdge = new Mesh(merge([box(W, 0.18, 0.18, 0, H / 2 - 0.4, 0), box(W, 0.18, 0.18, 0, -H / 2 + 0.4, 0), box(0.18, H, 0.18, W / 2 - 0.4, 0, 0), box(0.18, H, 0.18, -W / 2 + 0.4, 0, 0)]), kit.add(lightMat(9)));
  inside.add(bladeEdge);

  // Slatted doors.
  const SL = 12;
  const slatH = (MOUTH_H * 2 - 2) / SL;
  const slats = new InstancedMesh(new BoxGeometry(MOUTH_W * 2 - 2, slatH * 0.96, 0.5), kit.steel, SL);
  slats.castShadow = true;
  slats.instanceMatrix.setUsage(DynamicDrawUsage);
  slats.frustumCulled = false;
  group.add(slats);
  // Light between the slats when they crack.
  const glow = mouthGlow(kit, W, H);
  group.add(glow.group);

  const hit = hitPlane(MOUTH_W * 2 + 8, MOUTH_H * 2 + 8);
  group.add(hit);

  const m = new Matrix4();
  const q = new Quaternion();
  const axis = new Vector3(1, 0, 0);
  const s = new Vector3(1, 1, 1);
  const p = new Vector3();
  const hotUniform = schemaMat.uniforms.uHot.value as Vector3;

  return {
    id: "aie",
    index,
    group,
    inside,
    hit,
    lights: [
      { p: [0, 12, -46], i: 420, d: 90 },
      { p: [0, 10, -130], i: 560, d: 110 },
      { p: [0, 6, -212], i: 620, d: 90 },
    ],
    parts: [
      {
        mesh: schema,
        read: (uv) => {
          const row = uv ? 13 - Math.floor(uv.y * 14) : 0;
          return { id: `schema-row-${row}`, note: clamp(row, 0, 13) };
        },
        touch: (uv) => {
          if (!uv) return hotUniform.setZ(0);
          hotUniform.set(1, Math.floor(uv.y * 14), 1);
        },
      },
    ],
    update(t, _dt, open, power) {
      streamMat.uniforms.uTime.value = t;
      streamMat.uniforms.uPower.value = power;
      schemaMat.uniforms.uTime.value = t;
      schemaMat.uniforms.uPower.value = power;
      stripsMat.color.copy(WARM).multiplyScalar(0.2 + power * 1.8);
      const z = -8 - ((t * 0.09) % 1) * (HALL - 40);
      blade.position.z = z;
      bladeEdge.position.z = z;
      (bladeMat.uniforms.uK as { value: number }).value = 0.28 * power;
      glow.mat.uniforms.uK.value = open * (0.02 + 0.07 * power);
      for (let i = 0; i < SL; i++) {
        // Slats tip open from the top down, one after another.
        const e = smooth((open * 1.5 - ((SL - 1 - i) / SL) * 0.5));
        q.setFromAxisAngle(axis, e * 82 * DEG);
        p.set(0, -MOUTH_H + 1 + slatH * (i + 0.5), 1.6);
        m.compose(p, q, s);
        slats.setMatrixAt(i, m);
      }
      slats.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      [streamMat, schemaMat, stripsMat].forEach((x) => x.dispose());
    },
  };
}

// ---------------------------------------------------------------- FDE: the open dock

function buildFde(kit: Kit, index: number): Bay {
  const group = new Group();
  const inside = new Group();
  group.add(inside);
  const W = MOUTH_W * 2 - 2;
  const H = MOUTH_H * 2 - 2;

  // A frame every so often and nothing between but the deck: you can see
  // straight through the station to the star.
  const frames: BufferGeometry[] = [];
  const LEN = FACE_Z + 40;
  for (let z = -4; z > -LEN; z -= 11) {
    frames.push(box(1.6, H, 1.6, -W / 2, 0, z), box(1.6, H, 1.6, W / 2, 0, z), box(W, 1.6, 1.6, 0, H / 2, z));
    frames.push(strut(new Vector3(-W / 2, -H / 2, z), new Vector3(-W / 2, H / 2, z - 11), 0.3, 4));
    frames.push(strut(new Vector3(W / 2, H / 2, z), new Vector3(W / 2, -H / 2, z - 11), 0.3, 4));
  }
  const frameMesh = new Mesh(merge(frames), kit.trim);
  frameMesh.castShadow = true;
  inside.add(frameMesh);
  const deck = new Mesh(merge([box(W, 0.8, LEN, 0, -H / 2, -LEN / 2), box(1.6, 3, LEN, -W / 2 + 2, -H / 2 + 1.6, -LEN / 2), box(1.6, 3, LEN, W / 2 - 2, -H / 2 + 1.6, -LEN / 2)]), kit.wall);
  deck.receiveShadow = true;
  inside.add(deck);
  const stripsMat = kit.add(lightMat(3)) as MeshBasicMaterial;
  inside.add(new Mesh(merge([box(0.5, 0.2, LEN, -8, -H / 2 + 0.6, -LEN / 2), box(0.5, 0.2, LEN, 8, -H / 2 + 0.6, -LEN / 2)]), stripsMat));

  // Collar: heavy on top, where the gantry runs out over the boom.
  const c = new Group();
  c.add(collarPlate(kit, MOUTH_W * 2 + 8, MOUTH_H * 2 + 8, 2.4, rectHole(MOUTH_W - 1, MOUTH_H - 1)));
  const gantry: BufferGeometry[] = [];
  const GL = 62;
  for (const x of [-16, 16]) {
    gantry.push(box(2.2, 2.2, GL, x, MOUTH_H + 3.6, GL / 2 - 2));
    gantry.push(box(1.4, 1.4, GL * 0.92, x, MOUTH_H + 11, GL * 0.46 - 2));
    for (let i = 0; i < 9; i++) {
      const z0 = i * 6.4;
      gantry.push(strut(new Vector3(x, MOUTH_H + 3.6, z0), new Vector3(x, MOUTH_H + 11, z0 + 3.2), 0.28, 4));
      gantry.push(strut(new Vector3(x, MOUTH_H + 11, z0 + 3.2), new Vector3(x, MOUTH_H + 3.6, z0 + 6.4), 0.28, 4));
    }
  }
  for (let i = 0; i < 6; i++) gantry.push(box(32, 0.8, 0.8, 0, MOUTH_H + 3.6, 4 + i * 10));
  const g = new Mesh(merge(gantry), kit.steel);
  g.castShadow = true;
  c.add(g);
  group.add(c);

  // Clamshell doors, hinged at the top and bottom of the mouth.
  const doorGeo = merge([box(MOUTH_W * 2 - 2, MOUTH_H - 1, 1.1, 0, -(MOUTH_H - 1) / 2, 0), box(MOUTH_W * 2 - 8, 1.4, 1.2, 0, -MOUTH_H + 3.4, 0.5), box(MOUTH_W * 2 - 8, 1.4, 1.2, 0, -8, 0.5), box(1.4, MOUTH_H - 5, 1.2, -18, -(MOUTH_H - 1) / 2, 0.5), box(1.4, MOUTH_H - 5, 1.2, 18, -(MOUTH_H - 1) / 2, 0.5)]);
  const top = new Mesh(doorGeo, kit.wall);
  const bot = new Mesh(doorGeo, kit.wall);
  top.castShadow = true;
  bot.castShadow = true;
  const topHinge = new Group();
  const botHinge = new Group();
  topHinge.position.set(0, MOUTH_H - 1, 1);
  botHinge.position.set(0, -MOUTH_H + 1, 1);
  botHinge.rotation.z = Math.PI;
  topHinge.add(top);
  botHinge.add(bot);
  group.add(topHinge, botHinge);

  // The boom. Three telescoping sections; the pods hang off its far end.
  const boomGroup = new Group();
  boomGroup.position.set(0, -H / 2 + 5, 0);
  group.add(boomGroup);
  const secs = [
    { w: 4.4, len: 70 },
    { w: 3.2, len: 70 },
    { w: 2.2, len: 66 },
  ].map((o) => {
    const mesh = new Mesh(merge([box(o.w, o.w, o.len, 0, 0, o.len / 2), box(o.w + 1.2, o.w + 1.2, 1.6, 0, 0, o.len - 0.8), box(o.w + 0.4, 0.3, o.len - 6, 0, o.w / 2 + 0.1, o.len / 2)]), kit.trim);
    mesh.castShadow = true;
    boomGroup.add(mesh);
    return mesh;
  });
  const head = new Mesh(merge([box(6, 5, 8, 0, 0, 4), cyl(1.6, 2.4, 3, 8, 0, 0, 9.2), box(14, 0.6, 2, 0, 0, 3)]), kit.trim);
  boomGroup.add(head);
  const headLight = new Mesh(new BoxGeometry(2, 1, 0.4), kit.add(lightMat(12)));
  head.add(headLight);
  headLight.position.set(0, 0, 8.3);

  // The pods: three offices and a lab, out in the open on long tethers.
  const podAt: [number, number, number, number][] = [
    [-70, 26, 244, 1], // an office
    [-16, 44, 322, 1],
    [58, 30, 274, 1],
    [14, -30, 366, 1.55], // the lab, bigger
  ];
  const podMat = hullMaterial({ mode: "box", color: 0x8d8579, plate: 4, windows: 0.65 });
  kit.uniforms.push(podMat.uniforms as any);
  kit.add(podMat.mat);
  const pods = podAt.map(([x, y, z, sc], i) => {
    const pod = new Group();
    pod.position.set(x, y, z);
    pod.scale.setScalar(sc);
    const body = new Mesh(merge([cyl(5.6, 5.6, 14, 18, 0, 0, 0), cyl(5.6, 3.6, 3, 18, 0, 0, -8.5), cyl(3.6, 5.6, 3, 18, 0, 0, 8.5), box(16, 0.6, 3, 0, 0, 0)]), podMat.mat);
    body.castShadow = true;
    pod.add(body);
    const ring = new Mesh(new TorusGeometry(6.6, 0.28, 6, 40), kit.steel);
    ring.position.z = 2;
    pod.add(ring);
    if (i === 3) {
      const fin = new Mesh(merge([box(0.5, 22, 7, 0, 0, -2), box(22, 0.5, 7, 0, 0, -2)]), kit.trim);
      pod.add(fin);
    }
    const lamp = new Mesh(new BoxGeometry(3.8, 0.5, 0.3), kit.add(lightMat(10)));
    lamp.position.set(0, 0, 10.1);
    pod.add(lamp);
    group.add(pod);
    return pod;
  });

  // Tethers, with light running along them both ways.
  const tetherPts = podAt.map(([x, y, z]) => ({ a: new Vector3(0, -H / 2 + 5, 206), b: new Vector3(x, y, z) }));
  const tethers: BufferGeometry[] = [];
  for (const t of tetherPts) tethers.push(strut(t.a, t.b, 0.09, 3));
  const tetherMesh = new Mesh(merge(tethers), kit.add(lightMat(1.6)));
  group.add(tetherMesh);
  const pulseN = kit.low ? 12 : 24;
  const pulses = new InstancedMesh(new BoxGeometry(0.5, 0.5, 2.8), kit.add(lightMat(26)), pulseN);
  pulses.frustumCulled = false;
  pulses.instanceMatrix.setUsage(DynamicDrawUsage);
  group.add(pulses);
  const pulseSeed = Array.from({ length: pulseN }, (_, i) => ({ t: i % 4, s: (i * 0.137) % 1, back: i % 2 === 0 }));

  const glow = mouthGlow(kit, W, H);
  group.add(glow.group);
  const hit = hitPlane(MOUTH_W * 2 + 8, MOUTH_H * 2 + 8);
  group.add(hit);

  // Invisible handles on the pods so each answers with its own note.
  const podHit = pods.map((pod, i) => {
    const m = new Mesh(new BoxGeometry(22, 22, 26), new MeshBasicMaterial({ visible: false }));
    pod.add(m);
    return { mesh: m, read: () => ({ id: i === 3 ? "lab" : `office-${i + 1}`, note: i }) };
  });

  const up = new Vector3(0, 0, 1);
  const mx = new Matrix4();
  const qq = new Quaternion();
  const p = new Vector3();
  const s1 = new Vector3(1, 1, 1);
  const d = new Vector3();

  return {
    id: "fde",
    index,
    group,
    inside,
    hit,
    parts: podHit,
    lights: [
      { p: [0, 8, 40], i: 900, d: 160 },
      { p: [0, 10, 170], i: 1200, d: 200 },
      { p: [0, 10, 300], i: 1800, d: 260 },
    ],
    update(t, _dt, open, power) {
      stripsMat.color.copy(WARM).multiplyScalar(0.3 + power * 2.8);
      topHinge.rotation.x = -open * 105 * DEG;
      botHinge.rotation.x = open * 105 * DEG;
      const e = smooth(open * 1.2 - 0.1);
      // The boom reaches out in steps, each section from inside the last.
      secs[0].position.z = lerp(-68, 0, smooth(e * 2));
      secs[1].position.z = secs[0].position.z + lerp(0, 66, smooth(e * 2 - 0.35));
      secs[2].position.z = secs[1].position.z + lerp(0, 66, smooth(e * 2 - 0.7));
      head.position.z = secs[2].position.z + 66;
      glow.mat.uniforms.uK.value = open * (0.06 + 0.18 * power);
      // Pods nod on their tethers.
      pods.forEach((pod, i) => {
        pod.rotation.z = Math.sin(t * 0.13 + i * 2) * 0.1;
        pod.rotation.x = Math.sin(t * 0.09 + i) * 0.03;
      });
      const reach = Math.max(0.0001, e);
      for (let i = 0; i < pulseN; i++) {
        const o = pulseSeed[i];
        const f = (t * 0.1 + o.s) % 1;
        const k = o.back ? 1 - f : f;
        const a = tetherPts[o.t].a;
        const b = tetherPts[o.t].b;
        p.lerpVectors(a, b, k);
        d.subVectors(b, a).normalize();
        qq.setFromUnitVectors(up, d);
        mx.compose(p, qq, s1.setScalar(reach * power));
        pulses.setMatrixAt(i, mx);
      }
      pulses.instanceMatrix.needsUpdate = true;
    },
    dispose() {},
  };
}

// ---------------------------------------------------------------- ML: the scanner

function buildMle(kit: Kit, index: number): Bay {
  const group = new Group();
  const inside = new Group();
  group.add(inside);
  const TR = MOUTH_H - 2; // tube radius
  const seg = kit.low ? 48 : 96;

  // A round hole in a square collar.
  const c = collarPlate(kit, MOUTH_W * 2 + 8, MOUTH_H * 2 + 8, 3.2, (p) => p.absarc(0, 0, TR + 1, 0, TAU, true));
  group.add(c);
  const lip = new Mesh(new TorusGeometry(TR + 1.6, 0.9, 10, seg), kit.steel);
  lip.position.z = 3.8;
  group.add(lip);
  const lampsMat = kit.add(lightMat(6));
  const lamps: BufferGeometry[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    lamps.push(place(new BoxGeometry(0.34, 1.3, 0.3), Math.cos(a) * (TR + 3.6), Math.sin(a) * (TR + 3.6), 3.9, 0, 0, a + Math.PI / 2));
  }
  group.add(new Mesh(merge(lamps), lampsMat));

  // The tube.
  const tube = new Mesh(new CylinderGeometry(TR, TR, HALL, seg, 1, true), new MeshStandardMaterial({ color: 0x4e4a43, roughness: 0.6, metalness: 0.88, side: 1 }));
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -HALL / 2;
  tube.receiveShadow = true;
  inside.add(tube);
  const ribs: BufferGeometry[] = [];
  for (let z = -10; z > -HALL; z -= 10) ribs.push(place(new TorusGeometry(TR - 0.2, 0.46, 6, seg), 0, 0, z));
  inside.add(new Mesh(merge(ribs), kit.trim));
  const stripGeo: BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.13;
    stripGeo.push(box(0.26, 0.26, HALL - 8, Math.cos(a) * (TR - 0.6), Math.sin(a) * (TR - 0.6), -HALL / 2));
  }
  const stripsMat = kit.add(lightMat(3)) as MeshBasicMaterial;
  inside.add(new Mesh(merge(stripGeo), stripsMat));

  // The gantries: heavy rings with a source on one side and a detector arc on
  // the other. A thin fan of light joins them.
  const fanMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uK: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uK; varying vec2 vP;
      void main(){ float d=clamp((vP.y+${(TR - 1).toFixed(1)})/${(TR * 2 - 2).toFixed(1)},0.0,1.0); gl_FragColor=vec4(vec3(1.0,0.66,0.3)*uK*(0.25+0.75*d*d),1.0); }`,
  });
  const gantries = [-36, -92, -158].map((z, i) => {
    const g = new Group();
    g.position.z = z;
    const body = new Mesh(merge([
      place(new TorusGeometry(TR - 4 - i * 0.6, 2.6 - i * 0.3, 10, seg), 0, 0, 0),
      place(new TorusGeometry(TR - 7.6 - i * 0.6, 0.5, 6, seg), 0, 0, 1.6),
      place(new TorusGeometry(TR - 7.6 - i * 0.6, 0.5, 6, seg), 0, 0, -1.6),
      box(9, 6, 5.4, 0, TR - 5.5, 0),
      box(14, 3, 4.6, 0, -(TR - 5.5), 0),
      box(5, 8, 4.8, TR - 5.5, 0, 0),
      box(5, 8, 4.8, -(TR - 5.5), 0, 0),
    ]), kit.trim);
    body.castShadow = true;
    g.add(body);
    const emitter = new Mesh(new BoxGeometry(2.2, 0.6, 2.2), kit.add(lightMat(26)));
    emitter.position.set(0, TR - 8.6, 0);
    g.add(emitter);
    const det = new Mesh(new BoxGeometry(11, 0.5, 2), kit.add(lightMat(5)));
    det.position.set(0, -(TR - 7.4), 0);
    g.add(det);
    const fg = new BufferGeometry();
    const yt = TR - 8.6;
    fg.setAttribute("position", new BufferAttribute(new Float32Array([0, yt, 0, -5.5, -yt + 1.2, 0, 5.5, -yt + 1.2, 0]), 3));
    const fan = new Mesh(fg, fanMat);
    fan.renderOrder = 7;
    g.add(fan);
    inside.add(g);
    return g;
  });

  // The arch being scanned: a cloud of points in the shape of a dental arch.
  // Made up, from a curve, with no patient anywhere near it.
  const N = kit.low ? 5000 : 26000;
  const R = rng(733);
  const pos = new Float32Array(N * 3);
  const shade = new Float32Array(N);
  const v = new Vector3();
  for (let i = 0; i < N; i++) {
    const t = (R() * 2 - 1) * 1.36; // along the arch
    const ax = Math.sin(t) * 11;
    const az = Math.cos(t) * 8.5 - 3;
    const n = new Vector3(Math.sin(t), 0, Math.cos(t));
    const tooth = Math.abs(Math.sin(t * 7.2));
    const hgt = R();
    const crown = hgt > 0.5;
    const rad = crown ? 0.8 + 1.6 * Math.pow(tooth, 0.5) * (1 - (hgt - 0.5) * 0.9) : 1.8 + 0.3 * R();
    const ang = R() * TAU;
    v.set(ax + n.x * Math.cos(ang) * rad, (hgt - 0.5) * (crown ? 11 : 11) - (crown ? 0 : 1), az + n.z * Math.cos(ang) * rad + Math.sin(ang) * rad * 0.7);
    pos.set([v.x, v.y, v.z], i * 3);
    shade[i] = 0.5 + R() * 0.5;
  }
  const cloudGeo = new BufferGeometry();
  cloudGeo.setAttribute("position", new BufferAttribute(pos, 3));
  cloudGeo.setAttribute("aS", new BufferAttribute(shade, 1));
  const cloudMat = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aS; uniform float uTime, uPower, uPx; varying float vB;
      void main() {
        float plane = mod(uTime * 2.6, 26.0) - 13.0;
        float hit = exp(-pow((position.y - plane * 0.6) * 1.4, 2.0));
        vB = aS * (0.16 + hit * 2.6) * uPower;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * clamp(70.0 / -mv.z, 1.0, 4.0);
      }`,
    fragmentShader: `varying float vB; void main(){ vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.1,length(q)); gl_FragColor=vec4(vec3(1.0,0.7,0.38)*vB*a,1.0); }`,
  });
  const cloud = new Points(cloudGeo, cloudMat);
  cloud.frustumCulled = false;
  cloud.position.z = -64;
  inside.add(cloud);

  // The holdout: twenty sealed cubes behind glass, kept out of training.
  const vault = new Group();
  vault.position.z = -HALL + 6;
  inside.add(vault);
  const cubeMat = new MeshStandardMaterial({ color: 0x3c3831, roughness: 0.32, metalness: 0.7, emissive: new Color(1, 0.6, 0.24), emissiveIntensity: 0.2 });
  kit.add(cubeMat);
  const cubes = new InstancedMesh(new BoxGeometry(3.2, 3.2, 3.2), cubeMat, 20);
  cubes.frustumCulled = false;
  const mm = new Matrix4();
  for (let i = 0; i < 20; i++) {
    mm.makeTranslation(-9.6 + (i % 5) * 4.8, 7.2 - Math.floor(i / 5) * 4.8, 0);
    cubes.setMatrixAt(i, mm);
  }
  vault.add(cubes);
  const glass = new Mesh(new PlaneGeometry(30, 24), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 1, transparent: true, opacity: 0.12 }));
  glass.position.z = 6;
  vault.add(glass);
  const frameG = new Mesh(merge([box(30, 0.4, 0.4, 0, 12, 6), box(30, 0.4, 0.4, 0, -12, 6), box(0.4, 24, 0.4, -15, 0, 6), box(0.4, 24, 0.4, 15, 0, 6)]), kit.add(lightMat(7)));
  vault.add(frameG);
  const cubeHit = new Mesh(new PlaneGeometry(24, 19), new MeshBasicMaterial({ visible: false }));
  cubeHit.position.z = 7;
  vault.add(cubeHit);

  // Iris door: ten blades turning on pivots around the mouth.
  const BL = 10;
  const blade = new Shape();
  const bladeR = TR + 3;
  blade.moveTo(0, 0);
  blade.lineTo(bladeR * 1.32, -2);
  blade.lineTo(bladeR * 1.18, bladeR * 0.7);
  blade.quadraticCurveTo(bladeR * 0.56, bladeR * 0.5, 0, 0);
  const bladeGeo = new ExtrudeGeometry(blade, { depth: 0.5, bevelEnabled: false, curveSegments: 12 });
  const irisRoot = new Group();
  irisRoot.position.z = 1.2;
  const blades = Array.from({ length: BL }, (_, i) => {
    const pivot = new Group();
    const a = (i / BL) * TAU;
    pivot.position.set(Math.cos(a) * (TR + 2.4), Math.sin(a) * (TR + 2.4), i * 0.02);
    pivot.rotation.z = a + Math.PI;
    const mesh = new Mesh(bladeGeo, kit.wall);
    mesh.castShadow = true;
    const inner = new Group();
    inner.add(mesh);
    pivot.add(inner);
    irisRoot.add(pivot);
    return inner;
  });
  group.add(irisRoot);

  const glow = mouthGlow(kit, TR * 2, TR * 2);
  group.add(glow.group);
  const hit = hitPlane(MOUTH_W * 2 + 8, MOUTH_H * 2 + 8);
  group.add(hit);
  const gantryHits = gantries.map((g, i) => {
    const m = new Mesh(new CylinderGeometry(TR - 2, TR - 2, 6, 24, 1, false), new MeshBasicMaterial({ visible: false }));
    m.rotation.x = Math.PI / 2;
    g.add(m);
    return { mesh: m, read: () => ({ id: `gantry-${i + 1}`, note: i }) };
  });

  return {
    id: "mle",
    index,
    group,
    inside,
    hit,
    lights: [
      { p: [0, 0, -24], i: 240, d: 70 },
      { p: [0, 0, -100], i: 360, d: 90 },
      { p: [0, 0, -200], i: 420, d: 80 },
    ],
    parts: [
      ...gantryHits,
      {
        mesh: cubeHit,
        read: (uv) => {
          const col = uv ? clamp(Math.floor(uv.x * 5), 0, 4) : 0;
          const row = uv ? clamp(3 - Math.floor(uv.y * 4), 0, 3) : 0;
          return { id: `holdout-${row * 5 + col + 1}`, note: 3 + row * 5 + col };
        },
      },
    ],
    update(t, _dt, open, power) {
      gantries.forEach((g, i) => (g.rotation.z = t * (i % 2 ? -0.42 : 0.3) * (0.3 + power * 1.2) + i));
      cloudMat.uniforms.uTime.value = t;
      cloudMat.uniforms.uPower.value = power;
      fanMat.uniforms.uK.value = 0.24 * power;
      stripsMat.color.copy(WARM).multiplyScalar(0.2 + power * 1.5);
      cubeMat.emissiveIntensity = 0.1 + 0.3 * power;
      glow.mat.uniforms.uK.value = open * (0.02 + 0.05 * power);
      const e = smooth(open);
      blades.forEach((b) => (b.rotation.z = lerp(0, -62 * DEG, e)));
    },
    dispose() {
      fanMat.dispose();
      cloudMat.dispose();
    },
  };
}

// ---------------------------------------------------------------- SDE: the keel

function buildSde(kit: Kit, index: number): Bay {
  const group = new Group();
  const inside = new Group();
  group.add(inside);
  const W = MOUTH_W * 2 - 2;
  const H = MOUTH_H * 2 - 2;
  inside.add(hallShell(kit, W, H, HALL, 22, 3.2));

  // Heavy stepped collar with bolts and a chevron header.
  const c = new Group();
  c.add(collarPlate(kit, MOUTH_W * 2 + 14, MOUTH_H * 2 + 12, 3.6, rectHole(MOUTH_W - 1, MOUTH_H - 1)));
  const step: BufferGeometry[] = [];
  step.push(box(MOUTH_W * 2 + 22, 3.4, 8, 0, MOUTH_H + 6.6, 3));
  step.push(box(MOUTH_W * 2 + 22, 3.4, 8, 0, -MOUTH_H - 6.6, 3));
  step.push(box(4, MOUTH_H * 2 + 12, 8, MOUTH_W + 8.6, 0, 3));
  step.push(box(4, MOUTH_H * 2 + 12, 8, -MOUTH_W - 8.6, 0, 3));
  for (let i = 0; i < 26; i++) {
    const x = -MOUTH_W - 6 + (i / 25) * (MOUTH_W * 2 + 12);
    step.push(cyl(0.5, 0.5, 0.7, 6, x, MOUTH_H + 3.2, 4));
    step.push(cyl(0.5, 0.5, 0.7, 6, x, -MOUTH_H - 3.2, 4));
  }
  const stepMesh = new Mesh(merge(step), kit.trim);
  stepMesh.castShadow = true;
  c.add(stepMesh);
  group.add(c);

  // Doors with interlocking teeth down the join, and pistons that drive them.
  const door = (dir: number) => {
    const s = new Shape();
    const w = MOUTH_W;
    const h = MOUTH_H - 1;
    s.moveTo(0, -h);
    s.lineTo(dir * w, -h);
    s.lineTo(dir * w, h);
    s.lineTo(0, h);
    const teeth = 7;
    const th = (2 * h) / teeth;
    for (let i = 0; i < teeth; i++) {
      const y = h - i * th;
      const bite = (i % 2 === 0 ? 1 : -1) * dir * 2.4;
      s.lineTo(bite, y);
      s.lineTo(bite, y - th);
    }
    s.lineTo(0, -h);
    const geo = new ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 1 });
    const parts: BufferGeometry[] = [geo as BufferGeometry];
    for (let y = -14; y <= 14; y += 7) parts.push(box(w - 8, 1.1, 0.8, dir * (w / 2 + 2), y, 2.8));
    const m = new Mesh(merge(parts), kit.wall);
    m.castShadow = true;
    return m;
  };
  const left = door(-1);
  const right = door(1);
  left.position.z = 0.6;
  right.position.z = 0.6;
  group.add(left, right);
  const pistonMat = kit.steel;
  const pistons = [-12, 12].flatMap((y) =>
    [-1, 1].map((dir) => {
      const rod = new Mesh(new CylinderGeometry(0.7, 0.7, 30, 10), pistonMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(dir * (MOUTH_W + 12), y, 4.6);
      group.add(rod);
      return { rod, dir };
    }),
  );

  // Lights: steady, square, overhead.
  const strips: BufferGeometry[] = [];
  for (const x of [-16, -6, 6, 16]) strips.push(box(0.6, 0.2, HALL - 8, x, H / 2 - 3.6, -HALL / 2));
  for (const x of [-20, 20]) strips.push(box(0.3, 0.14, HALL - 8, x, -H / 2 + 1, -HALL / 2));
  const stripsMat = kit.add(lightMat(5, new Color(1, 0.78, 0.5))) as MeshBasicMaterial;
  inside.add(new Mesh(merge(strips), stripsMat));

  // Ledger stacks: slabs on both sides. New ones arrive on top and none ever
  // leave, so the stacks only grow.
  const stackRows = kit.low ? 14 : 22;
  const columns = 5;
  const SN = stackRows * columns * 2;
  const stack = new InstancedMesh(new BoxGeometry(11, 0.9, 30), kit.trim, SN);
  stack.castShadow = true;
  stack.frustumCulled = false;
  const R = rng(99);
  const mm = new Matrix4();
  const tmp = new Vector3();
  let n = 0;
  const slabX = (side: number) => side * (W / 2 - 8.6);
  for (const side of [-1, 1]) {
    for (let c2 = 0; c2 < columns; c2++) {
      const z = -30 - c2 * 34;
      for (let r2 = 0; r2 < stackRows; r2++) {
        const jx = (R() - 0.5) * 0.36;
        const jz = (R() - 0.5) * 0.6;
        const sx = 0.9 + R() * 0.1;
        mm.makeScale(sx, 1, 1);
        mm.setPosition(tmp.set(slabX(side) + jx, -H / 2 + 1.2 + r2 * 1.06, z + jz));
        stack.setMatrixAt(n++, mm);
      }
    }
  }
  inside.add(stack);
  // The newest slab on one stack, and the crane lowering it.
  const crane = new Mesh(merge([box(W - 4, 1.4, 2.6, 0, 0, 0), box(4, 2.2, 3.6, -10, -1.6, 0), cyl(0.12, 0.12, 12, 4, -10, -8, 0, 0)]), kit.steel);
  crane.position.y = H / 2 - 6;
  inside.add(crane);
  const slabNew = new Mesh(new BoxGeometry(11, 0.9, 30), kit.add(new MeshStandardMaterial({ color: 0x6a645a, roughness: 0.4, metalness: 0.9, emissive: new Color(1, 0.62, 0.26), emissiveIntensity: 0.45 })));
  inside.add(slabNew);

  // The wall of 360: twelve rows of thirty, one cell per day cell of the
  // workbook, all of them lit by the time the wave has passed.
  const wallMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uHot: { value: new Vector3(0, 0, 0) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower; uniform vec3 uHot; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 g = vec2(30.0, 12.0);
        vec2 q = vUv * g;
        vec2 id = floor(q);
        vec2 f = fract(q);
        float seq = ((g.y - 1.0 - id.y) * g.x + id.x) / 360.0;
        float cyc = fract(uTime * 0.07) * 1.45;
        float lit = smoothstep(seq, seq + 0.006, cyc);
        float wave = exp(-abs(cyc - seq) * 60.0);
        float m = smoothstep(0.08, 0.14, f.x) * smoothstep(0.92, 0.86, f.x) * smoothstep(0.1, 0.16, f.y) * smoothstep(0.9, 0.84, f.y);
        float hot = uHot.z * step(abs(id.x - uHot.x), 0.5) * step(abs(id.y - uHot.y), 0.5);
        vec3 c = vec3(1.0, 0.66, 0.3) * m * (0.05 + lit * (0.7 + 0.25 * h(id)) * 1.5 + wave * 6.0 + hot * 5.0);
        gl_FragColor = vec4(c * uPower + vec3(0.008, 0.005, 0.003), 1.0);
      }`,
  });
  const wall = new Mesh(new PlaneGeometry(W - 2, H - 3), wallMat);
  wall.position.set(0, 0.5, -HALL + 1);
  inside.add(wall);

  // Columns along the hall, square and close.
  const cols: BufferGeometry[] = [];
  for (let z = -11; z > -HALL + 10; z -= 22) {
    cols.push(box(3, H, 3, -W / 2 + 1.5, 0, z));
    cols.push(box(3, H, 3, W / 2 - 1.5, 0, z));
  }
  inside.add(new Mesh(merge(cols), kit.wall));

  const glow = mouthGlow(kit, W, H);
  group.add(glow.group);
  const hit = hitPlane(MOUTH_W * 2 + 8, MOUTH_H * 2 + 8);
  group.add(hit);
  const hot = wallMat.uniforms.uHot.value as Vector3;

  return {
    id: "sde",
    index,
    group,
    inside,
    hit,
    lights: [
      { p: [0, 12, -32], i: 520, d: 90, c: [1, 0.78, 0.52] },
      { p: [0, 12, -110], i: 620, d: 110, c: [1, 0.78, 0.52] },
      { p: [0, 12, -200], i: 620, d: 100, c: [1, 0.78, 0.52] },
    ],
    parts: [
      {
        mesh: wall,
        read: (uv) => {
          const row = uv ? clamp(11 - Math.floor(uv.y * 12), 0, 11) : 0;
          const col = uv ? clamp(Math.floor(uv.x * 30), 0, 29) : 0;
          return { id: `cell-${row * 30 + col + 1}`, note: row };
        },
        touch: (uv) => {
          if (!uv) return hot.setZ(0);
          hot.set(Math.floor(uv.x * 30), Math.floor(uv.y * 12), 1);
        },
      },
    ],
    update(t, _dt, open, power) {
      wallMat.uniforms.uTime.value = t;
      wallMat.uniforms.uPower.value = power;
      stripsMat.color.setRGB(1, 0.78, 0.5).multiplyScalar(0.3 + power * 2.2);
      const e = smooth(open);
      left.position.x = -e * (MOUTH_W - 1);
      right.position.x = e * (MOUTH_W - 1);
      pistons.forEach((p) => (p.rod.position.x = p.dir * (MOUTH_W + 12 + 0 * e) + p.dir * e * 2));
      glow.mat.uniforms.uK.value = open * (0.02 + 0.06 * power);
      // A new slab, every eleven seconds: lowered, set, and it stays.
      const cycle = (t / 11) % 1;
      const col = Math.floor(t / 11) % columns;
      const side = Math.floor(t / 11) % 2 ? 1 : -1;
      const z = -30 - col * 34;
      crane.position.z = lerp(crane.position.z, z, 0.04);
      const top = -H / 2 + 1.2 + stackRows * 1.06;
      slabNew.position.set(slabX(side), lerp(H / 2 - 12, top, smooth(cycle * 1.6)), z);
      (slabNew.material as MeshStandardMaterial).emissiveIntensity = 0.5 * (1 - smooth(cycle * 1.6 - 0.9)) * power;
    },
    dispose() {
      wallMat.dispose();
    },
  };
}

// ----------------------------------------------------------------

export function buildBays(opts: { low: boolean }) {
  const made: Material[] = [];
  const wall = hullMaterial({ mode: "box", color: 0x57534b, plate: 14, rough: 0.6, metal: 0.8 });
  const trim = hullMaterial({ mode: "box", color: 0x7b756a, plate: 9, rough: 0.48, metal: 0.92 });
  const steel = new MeshStandardMaterial({ color: 0x8a8378, roughness: 0.38, metalness: 0.96 });
  const dark = new MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.7, metalness: 0.7 });
  const uniforms: { uTime: { value: number } }[] = [wall.uniforms as any, trim.uniforms as any];
  const kit: Kit = {
    low: opts.low,
    wall: wall.mat,
    trim: trim.mat,
    steel,
    dark,
    uniforms,
    add(m) {
      made.push(m);
      return m;
    },
  };
  const bays = [buildAie, buildFde, buildMle, buildSde].map((f, i) => {
    const bay = f(kit, i);
    // Set the bay into the ring: its +Y points at the hub.
    const a = bayAngle(i);
    bay.group.position.set(Math.cos(a) * RC, Math.sin(a) * RC, FACE_Z);
    bay.group.rotation.z = a + Math.PI / 2;
    return bay;
  });
  return {
    bays,
    tick(t: number) {
      for (const u of uniforms) u.uTime.value = t;
    },
    dispose() {
      bays.forEach((b) => {
        b.group.traverse((o) => {
          const mesh = o as Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        b.dispose();
      });
      made.forEach((m) => m.dispose());
      [wall.mat, trim.mat, steel, dark].forEach((m) => m.dispose());
    },
  };
}
export type Bays = ReturnType<typeof buildBays>;
