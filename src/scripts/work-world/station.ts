// The station: a ring six hundred units across, hanging in the star's light.
// Its axis is Z and its front looks along +Z. Everything here is the part that
// never changes: the drum, the plating, the fins and lattice that catch the
// light, the spokes and the hub. The four docking bays are built in bays.ts
// and set into the holes this file leaves in the front face.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  TorusGeometry,
  Vector3,
  Vector4,
  type Material,
} from "three";
import { hullMaterial } from "./hull";
import { DEG, TAU, box, cyl, merge, place, rng, strut } from "./util";

export const RO = 300; // outer radius
export const RI = 238; // inner radius
export const HD = 34; // half depth
export const RC = 269; // where the bay mouths are centred
export const FACE_Z = 31; // the recessed front face the mouths open in
export const MOUTH_W = 26; // half width of a mouth
export const MOUTH_H = 21; // half height

/** Each bay's angle on the ring. The ring turns +90 degrees to bring up the next. */
export const bayAngle = (i: number) => -90 * DEG - i * 90 * DEG;

type P = [number, number]; // radius, z

/** A ring of bands from a profile, hard edged between bands and smooth around the ring. */
function bands(profile: P[], segs: number, a0 = 0, a1 = TAU): BufferGeometry {
  const n = profile.length - 1;
  const verts = (segs + 1) * 2 * n;
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const idx = new Uint32Array(segs * n * 6);
  let v = 0;
  let t = 0;
  for (let b = 0; b < n; b++) {
    const [r0, z0] = profile[b];
    const [r1, z1] = profile[b + 1];
    const dr = r1 - r0;
    const dz = z1 - z0;
    const l = Math.hypot(dr, dz) || 1;
    const nr = dz / l;
    const nz = -dr / l;
    const base = v;
    for (let i = 0; i <= segs; i++) {
      const a = a0 + ((a1 - a0) * i) / segs;
      const c = Math.cos(a);
      const s = Math.sin(a);
      for (let k = 0; k < 2; k++) {
        const r = k ? r1 : r0;
        const z = k ? z1 : z0;
        pos[v * 3] = c * r;
        pos[v * 3 + 1] = s * r;
        pos[v * 3 + 2] = z;
        nor[v * 3] = c * nr;
        nor[v * 3 + 1] = s * nr;
        nor[v * 3 + 2] = nz;
        uv[v * 2] = i / segs;
        uv[v * 2 + 1] = k;
        v++;
      }
    }
    for (let i = 0; i < segs; i++) {
      const p = base + i * 2;
      idx[t++] = p;
      idx[t++] = p + 2;
      idx[t++] = p + 1;
      idx[t++] = p + 1;
      idx[t++] = p + 2;
      idx[t++] = p + 3;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("normal", new BufferAttribute(nor, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}

function instanced(geo: BufferGeometry, mat: Material, list: Matrix4[], cols?: Color[]) {
  const m = new InstancedMesh(geo, mat, list.length);
  list.forEach((x, i) => m.setMatrixAt(i, x));
  if (cols) cols.forEach((c, i) => m.setColorAt(i, c));
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

// The name painted on the hull, wrapped around the front face. Mapped so the
// tops of the letters point at the hub: they read upright in the lower half.
function paintLivery(low: boolean) {
  const W = low ? 4096 : 8192;
  const H = low ? 128 : 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000";
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#fff";
  x.textBaseline = "alphabetic";
  const px = H / 44; // canvas pixels per world unit, across the band
  const ux = W / (TAU * RC); // and around it
  const stretch = ux / px;
  const names = [
    ["AI", "ENGINEERING"],
    ["FORWARD-DEPLOYED", "ENGINEERING"],
    ["MACHINE LEARNING", "ENGINEERING"],
    ["SOFTWARE", "ENGINEERING"],
  ];
  const put = (txt: string, ux0: number, y: number, size: number, weight: number, track: number) => {
    x.save();
    x.translate(ux0, y);
    x.scale(stretch, 1);
    x.font = `${weight} ${size}px Inter, Arial, sans-serif`;
    (x as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${track}px`;
    x.fillText(txt, 0, 0);
    x.restore();
  };
  names.forEach((n, i) => {
    const a = bayAngle(i);
    const start = ((((a + (MOUTH_W + 16) / RC) / TAU + 0.5) % 1) + 1) % 1;
    const u = start * W;
    put(`0${i + 1}`, u, H * 0.86, H * 0.86, 700, H * -0.02);
    const after = u + H * 0.86 * 1.32 * stretch;
    put(n[0], after, H * 0.46, H * 0.32, 700, H * 0.012);
    put(n[1], after, H * 0.86, H * 0.32, 700, H * 0.012);
  });
  // A soft edge, read back through a threshold, keeps the letters crisp when
  // the camera comes close.
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const o = out.getContext("2d")!;
  if ("filter" in o) o.filter = `blur(${low ? 1 : 1.6}px)`;
  o.drawImage(c, 0, 0);
  const tex = new CanvasTexture(out);
  tex.flipY = false;
  tex.wrapS = RepeatWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = low ? 4 : 12;
  tex.generateMipmaps = true;
  return tex;
}

export function buildStation(opts: { low: boolean }) {
  const { low } = opts;
  const root = new Group();
  const ring = new Group();
  const hub = new Group();
  root.add(ring, hub);
  const R = rng(4177);
  const uniforms: { uTime: { value: number } }[] = [];
  const dispose: (() => void)[] = [];

  const livery = paintLivery(low);
  dispose.push(() => livery.dispose());

  const mouths = [0, 1, 2, 3].map((i) => new Vector4(((bayAngle(i) + Math.PI * 3) % TAU) - Math.PI, RC, MOUTH_W, MOUTH_H));
  const drumMat = hullMaterial({ mode: "polar", color: 0x8d8579, plate: 30, windows: 0.34, r0: RC, mouths, livery: { tex: livery, r0: RC - 22, r1: RC + 22 } });
  uniforms.push(drumMat.uniforms as any);
  const trimMat = hullMaterial({ mode: "box", color: 0x5e5a53, plate: 12, rough: 0.5, metal: 0.9 });
  uniforms.push(trimMat.uniforms as any);
  const darkMat = new MeshStandardMaterial({ color: 0x24221e, roughness: 0.62, metalness: 0.85 });
  const steelMat = new MeshStandardMaterial({ color: 0x7c766c, roughness: 0.42, metalness: 0.95 });
  const glowMat = new MeshBasicMaterial({ color: new Color(1, 0.62, 0.26).multiplyScalar(6) });
  const dimMat = new MeshBasicMaterial({ color: new Color(1, 0.6, 0.24).multiplyScalar(2.4) });

  // ---- the drum
  const profile: P[] = [
    [RO - 4, -HD], [RO, -HD + 4], [RO, -14], [RO + 4, -12], [RO + 4, 8], [RO, 10], [RO, HD - 4], [RO - 4, HD],
    [RC + 24, HD], [RC + 23, FACE_Z], [RC - 23, FACE_Z], [RC - 24, HD], [RI + 4, HD],
    [RI, HD - 4], [RI, 12], [RI - 4, 10], [RI - 4, -10], [RI, -12], [RI, -HD + 4], [RI + 4, -HD],
    [RO - 4, -HD],
  ];
  const segs = low ? 256 : 720;
  const drum = new Mesh(bands(profile, segs), drumMat.mat);
  drum.castShadow = true;
  drum.receiveShadow = true;
  ring.add(drum);

  // Thin rails and conduits around the ring, the fine lines that give it size.
  const rails: BufferGeometry[] = [];
  const rail = (r: number, z: number, t = 0.5) => rails.push(place(new TorusGeometry(r, t, 6, low ? 200 : 460), 0, 0, z));
  [[RO + 5, 3], [RO + 5, -5], [RO + 5, -9], [RO + 1, 20], [RO + 1, 26], [RO + 1, -22], [RC + 26, HD + 0.6], [RC - 26, HD + 0.6], [RI + 2, HD + 0.6], [RO - 2, HD + 0.6], [RI - 5, 4], [RI - 5, -6], [RI - 1, 22]].forEach(([r, z]) => rail(r, z));
  rail(RO + 8, -1, 1.1);
  rail(RI - 9, 0, 1.3);
  const railMesh = new Mesh(merge(rails), steelMat);
  railMesh.castShadow = true;
  ring.add(railMesh);

  // ---- fins on the outer wall: the saw edge that catches the star
  const m = new Matrix4();
  const q = new Quaternion();
  const zAxis = new Vector3(0, 0, 1);
  const finList: Matrix4[] = [];
  const finN = low ? 90 : 180;
  for (let i = 0; i < finN; i++) {
    const group = Math.floor((i / finN) * 24);
    if (group % 3 === 2) continue; // gaps between runs of fins
    const a = (i / finN) * TAU;
    const h = 11 + 12 * Math.abs(Math.sin(group * 2.3));
    const r = RO + 4 + h / 2;
    q.setFromAxisAngle(zAxis, a);
    m.compose(new Vector3(Math.cos(a) * r, Math.sin(a) * r, HD - 22), q, new Vector3(h, 1, 22));
    finList.push(m.clone());
  }
  ring.add(instanced(new BoxGeometry(1, 1, 1), trimMat.mat, finList));

  // ---- greebles: machinery bolted on the walls and lips
  const greeb: Matrix4[] = [];
  const greebCol: Color[] = [];
  const GN = low ? 900 : 3200;
  const cBase = new Color(0x8a8378);
  for (let i = 0; i < GN; i++) {
    const a = R() * TAU;
    const side = R();
    let r = 0;
    let z = 0;
    let sx = 1 + R() * R() * 9;
    let sy = 0.6 + R() * 2.4;
    let sz = 0.8 + R() * R() * 7;
    if (side < 0.32) {
      r = RO + sy / 2;
      z = -HD + R() * HD * 2;
    } else if (side < 0.6) {
      r = RI - sy / 2;
      z = -HD + R() * HD * 2;
    } else if (side < 0.8) {
      r = R() < 0.5 ? RC + 26 + R() * 6 : RC - 26 - R() * 6;
      z = HD + sz / 4;
      const t = sy;
      sy = sz;
      sz = t;
    } else {
      r = RI + R() * (RO - RI);
      z = -HD - sz / 4;
    }
    q.setFromAxisAngle(zAxis, a + Math.PI / 2);
    m.compose(new Vector3(Math.cos(a) * r, Math.sin(a) * r, z), q, new Vector3(sx, sy, sz));
    greeb.push(m.clone());
    greebCol.push(cBase.clone().multiplyScalar(0.45 + R() * 0.8));
  }
  ring.add(instanced(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ roughness: 0.55, metalness: 0.85 }), greeb, greebCol));

  // ---- the lattice inside the ring, lace against the light
  const lat: Matrix4[] = [];
  const LN = low ? 120 : 340;
  const lr0 = RI - 9;
  const lr1 = RI - 26;
  const up = new Vector3(0, 1, 0);
  const seg = (a: Vector3, b: Vector3, t: number) => {
    const d = new Vector3().subVectors(b, a);
    const l = d.length();
    q.setFromUnitVectors(up, d.clone().normalize());
    m.compose(new Vector3().addVectors(a, b).multiplyScalar(0.5), q, new Vector3(t, l, t));
    lat.push(m.clone());
  };
  const pt = (a: number, r: number, z: number) => new Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
  for (let i = 0; i < LN; i++) {
    const a0 = (i / LN) * TAU;
    const a1 = ((i + 1) / LN) * TAU;
    const zs: number[] = [-12, 12];
    seg(pt(a0, lr1, zs[0]), pt(a1, lr1, zs[0]), 0.9);
    seg(pt(a0, lr1, zs[1]), pt(a1, lr1, zs[1]), 0.9);
    seg(pt(a0, lr1, zs[0]), pt(a0, lr1, zs[1]), 0.5);
    seg(pt(a0, lr1, i % 2 ? zs[0] : zs[1]), pt(a1, lr0, 0), 0.5);
    seg(pt(a1, lr1, i % 2 ? zs[1] : zs[0]), pt(a1, lr0, 0), 0.5);
  }
  ring.add(instanced(new CylinderGeometry(0.5, 0.5, 1, 5, 1), steelMat, lat));

  // ---- running lights on the lips: a thin thread of light around the ring
  const lights: BufferGeometry[] = [];
  lights.push(bands([[RC + 25.4, HD + 0.2], [RC + 25.9, HD + 0.2]], segs));
  lights.push(bands([[RI - 4.1, 2.2], [RI - 4.1, 1.6]], segs));
  lights.push(bands([[RO + 4.1, -3], [RO + 4.1, -3.4]], segs));
  const lightMesh = new Mesh(merge(lights), dimMat);
  ring.add(lightMesh);

  // ---- the spokes, set between the bays
  const spoke: BufferGeometry[] = [];
  const spokeLat: BufferGeometry[] = [];
  const beacons: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = 45 * DEG + i * 90 * DEG;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (r: number, t: number, z: number) => new Vector3(c * r - s * t, s * r + c * t, z);
    const r0 = 70;
    const r1 = RI - 6;
    // Two heavy beams, an elevator shaft between them.
    const beam = (t: number, z: number, w: number, h: number) => {
      spoke.push(place(new BoxGeometry(r1 - r0, w, h), c * ((r0 + r1) / 2) - s * t, s * ((r0 + r1) / 2) + c * t, z, 0, 0, a));
    };
    beam(9, 10, 3.2, 3.2);
    beam(-9, 10, 3.2, 3.2);
    beam(9, -10, 3.2, 3.2);
    beam(-9, -10, 3.2, 3.2);
    spoke.push(place(new BoxGeometry(r1 - r0, 5, 5), c * ((r0 + r1) / 2), s * ((r0 + r1) / 2), 0, 0, 0, a));
    const steps = low ? 8 : 16;
    for (let k = 0; k < steps; k++) {
      const u0 = r0 + ((r1 - r0) * k) / steps;
      const u1 = r0 + ((r1 - r0) * (k + 1)) / steps;
      const t0 = k % 2 ? 9 : -9;
      spokeLat.push(strut(P(u0, t0, 10), P(u1, -t0, 10), 0.42, 4));
      spokeLat.push(strut(P(u0, t0, -10), P(u1, -t0, -10), 0.42, 4));
      spokeLat.push(strut(P(u0, 9, -10), P(u1, 9, 10), 0.42, 4));
      spokeLat.push(strut(P(u0, -9, -10), P(u1, -9, 10), 0.42, 4));
      spokeLat.push(strut(P(u0, 9, 10), P(u0, -9, 10), 0.32, 4));
      spokeLat.push(strut(P(u0, 9, -10), P(u0, -9, -10), 0.32, 4));
      if (k % 3 === 0) beacons.push(place(new BoxGeometry(1.2, 1.2, 0.5), P(u0, 0, 2.8).x, P(u0, 0, 2.8).y, 2.8));
    }
    // Thin cables to the ring either side of the spoke.
    for (const off of [-22, 22]) {
      const b = (a + off * DEG);
      spokeLat.push(strut(P(90, 0, 16), new Vector3(Math.cos(b) * (RI - 8), Math.sin(b) * (RI - 8), 16), 0.3, 3));
      spokeLat.push(strut(P(90, 0, -16), new Vector3(Math.cos(b) * (RI - 8), Math.sin(b) * (RI - 8), -16), 0.3, 3));
    }
  }
  const spokeMesh = new Mesh(merge(spoke), trimMat.mat);
  spokeMesh.castShadow = true;
  spokeMesh.receiveShadow = true;
  ring.add(spokeMesh);
  const latMesh = new Mesh(merge(spokeLat), steelMat);
  latMesh.castShadow = true;
  ring.add(latMesh);
  ring.add(new Mesh(merge(beacons), glowMat));

  // ---- the hub, turning against the ring
  const hubProfile: P[] = [
    [40, -52], [70, -40], [84, -30], [84, 30], [70, 40], [52, 44], [52, 50], [40, 56], [40, 92], [30, 98], [30, 118], [24, 124], [8, 124],
  ];
  const hubMat = hullMaterial({ mode: "polar", color: 0x8d8579, plate: 11, windows: 0.3, r0: 84 });
  uniforms.push(hubMat.uniforms as any);
  const hubMesh = new Mesh(bands(hubProfile, low ? 64 : 160), hubMat.mat);
  hubMesh.castShadow = true;
  hubMesh.receiveShadow = true;
  hub.add(hubMesh);
  const hubParts: BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    hubParts.push(place(new BoxGeometry(5, 14, 28), Math.cos(a) * 90, Math.sin(a) * 90, -6, 0, 0, a + Math.PI / 2));
  }
  for (const z of [62, 76, 90, 108]) hubParts.push(place(new TorusGeometry(z > 100 ? 32 : 42, 1.2, 6, 64), 0, 0, z));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    hubParts.push(cyl(1.4, 1.4, 70, 6, Math.cos(a) * 41, Math.sin(a) * 41, 74));
  }
  const hp = new Mesh(merge(hubParts), trimMat.mat);
  hp.castShadow = true;
  hub.add(hp);
  hub.add(new Mesh(bands([[8.5, 124.2], [23, 124.2]], 48), glowMat));

  // ---- traffic: small lights going about their day around the ring
  const shuttleCount = low ? 18 : 46;
  const shuttleGeo = merge([box(3.2, 1.4, 1.4), box(1, 0.6, 3.4, -0.6)]);
  const shuttles = new InstancedMesh(shuttleGeo, steelMat, shuttleCount);
  shuttles.frustumCulled = false;
  const sparks = new InstancedMesh(new BoxGeometry(0.7, 0.7, 0.7), new MeshBasicMaterial({ color: new Color(1, 0.74, 0.42).multiplyScalar(14) }), shuttleCount);
  sparks.frustumCulled = false;
  root.add(shuttles, sparks);
  const traffic = Array.from({ length: shuttleCount }, () => ({
    r: RI + 10 + R() * (RO - RI + 40),
    z: HD + 6 + R() * 42 - (R() < 0.3 ? 100 : 0),
    a: R() * TAU,
    v: (0.012 + R() * 0.03) * (R() < 0.5 ? -1 : 1),
  }));

  const _p = new Vector3();
  const _s = new Vector3(1, 1, 1);
  const _q = new Quaternion();
  const _m = new Matrix4();

  return {
    root,
    ring,
    hub,
    setTime(t: number) {
      for (const u of uniforms) u.uTime.value = t;
      for (let i = 0; i < traffic.length; i++) {
        const o = traffic[i];
        const a = o.a + t * o.v;
        _p.set(Math.cos(a) * o.r, Math.sin(a) * o.r, o.z);
        _q.setFromAxisAngle(zAxis, a + (o.v > 0 ? Math.PI / 2 : -Math.PI / 2));
        _m.compose(_p, _q, _s);
        shuttles.setMatrixAt(i, _m);
        _p.set(Math.cos(a - Math.sign(o.v) * 0.008) * o.r, Math.sin(a - Math.sign(o.v) * 0.008) * o.r, o.z);
        _m.compose(_p, _q, _s);
        sparks.setMatrixAt(i, _m);
      }
      shuttles.instanceMatrix.needsUpdate = true;
      sparks.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      root.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      [drumMat.mat, trimMat.mat, hubMat.mat, darkMat, steelMat, glowMat, dimMat, shuttles.material as Material, sparks.material as Material].forEach((x) => x.dispose());
      dispose.forEach((d) => d());
    },
  };
}
export type Station = ReturnType<typeof buildStation>;
