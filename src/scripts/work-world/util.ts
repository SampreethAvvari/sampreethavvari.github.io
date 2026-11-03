// Small shared pieces for the Work world: numbers, easing, seeded randomness,
// and the geometry helpers the station and the bays are assembled from.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export * from "./math";

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);

/** Bake a position, an Euler rotation and a scale into a geometry. */
export function place(g: BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

export const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  place(new BoxGeometry(w, h, d), x, y, z, rx, ry, rz);

/** A cylinder along Z unless rotated further. */
export const cyl = (r0: number, r1: number, len: number, seg = 16, x = 0, y = 0, z = 0, rx = Math.PI / 2, ry = 0, rz = 0) =>
  place(new CylinderGeometry(r0, r1, len, seg, 1), x, y, z, rx, ry, rz);

/** A strut between two points. */
export function strut(a: Vector3, b: Vector3, r = 0.4, seg = 6) {
  const d = new Vector3().subVectors(b, a);
  const len = d.length();
  const g = new CylinderGeometry(r, r, len, seg, 1);
  _q.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  _p.addVectors(a, b).multiplyScalar(0.5);
  _s.set(1, 1, 1);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

/** Merge parts that may or may not share attributes (keeps position, normal, uv). */
export function merge(parts: BufferGeometry[]) {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute("uv", new BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  const out = mergeGeometries(clean, false);
  clean.forEach((g) => g.dispose());
  parts.forEach((g) => g.dispose());
  return out!;
}
