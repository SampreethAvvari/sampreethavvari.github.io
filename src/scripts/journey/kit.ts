// Geometry kit for the ship: lofted faceted bodies, armour plates with
// thickness, revolved bands, extruded plates, and helpers to merge, mirror
// and place parts. Everything returns plain BufferGeometry.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Matrix4,
  Path,
  Quaternion,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const UVS = 1.7; // world units per texture tile

// ------------------------------------------------------------------ hull kit

export type Key = [number, number, number, number]; // t, half width, top, bottom

export function keyed(keys: Key[]) {
  const out = { w: 0, ht: 0, hb: 0 };
  return (t: number) => {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const t0 = keys[i][0];
    const t1 = keys[i + 1][0];
    const h = t1 - t0;
    const u = Math.min(1, Math.max(0, (t - t0) / h));
    const h00 = 2 * u * u * u - 3 * u * u + 1;
    const h10 = u * u * u - 2 * u * u + u;
    const h01 = -2 * u * u * u + 3 * u * u;
    const h11 = u * u * u - u * u;
    const tan = (j: number, c: number) => {
      const a = keys[Math.max(0, j - 1)];
      const b = keys[Math.min(keys.length - 1, j + 1)];
      return (b[c] - a[c]) / (b[0] - a[0]);
    };
    const v = (c: number) => h00 * keys[i][c] + h10 * h * tan(i, c) + h01 * keys[i + 1][c] + h11 * h * tan(i + 1, c);
    out.w = Math.max(0.005, v(1));
    out.ht = Math.max(0.005, v(2));
    out.hb = Math.max(0.005, v(3));
    return out;
  };
}

export const K = 8; // points around a hull section
/** Section ring: top, upper right, right, lower right, keel, then the left side. */
export function octRing(keys: Key[]) {
  const f = keyed(keys);
  return (t: number, out: Float32Array) => {
    const { w, ht, hb } = f(t);
    const pts = [0, ht * 1.03, w * 0.58, ht, w, ht * 0.16, w * 0.74, -hb * 0.8, 0, -hb, -w * 0.74, -hb * 0.8, -w, ht * 0.16, -w * 0.58, ht];
    for (let i = 0; i < 16; i++) out[i] = pts[i];
  };
}

/** Point and outward normal at fractional ring position s (wraps). */
export function ringAt(ring: Float32Array, n: number, s: number, out: number[]) {
  const sm = ((s % n) + n) % n;
  const i = Math.floor(sm);
  const f = sm - i;
  const b = (i + 1) % n;
  const ax = ring[i * 2];
  const ay = ring[i * 2 + 1];
  const bx = ring[b * 2];
  const by = ring[b * 2 + 1];
  out[0] = ax + (bx - ax) * f;
  out[1] = ay + (by - ay) * f;
  let nx = -(by - ay);
  let ny = bx - ax;
  if (f < 1e-4) {
    const p = (i - 1 + n) % n;
    nx += -(ay - ring[p * 2 + 1]);
    ny += ax - ring[p * 2];
  }
  const l = Math.hypot(nx, ny) || 1;
  out[2] = nx / l;
  out[3] = ny / l;
}

/** Loft a ring along z. Hard edges give each ring edge its own strip so facets stay crisp. */
export function loft(ts: number[], z0: number, z1: number, ring: (t: number, out: Float32Array) => void, n: number, closed: boolean, hard: boolean): BufferGeometry {
  const rings = ts.map((t) => {
    const r = new Float32Array(n * 2);
    ring(t, r);
    return r;
  });
  const zs = ts.map((t) => z0 + (z1 - z0) * t);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const edges = closed ? n : n - 1;
  const perim = (r: Float32Array, upto: number) => {
    let s = 0;
    for (let e = 0; e < upto; e++) {
      const a = e % n;
      const b = (e + 1) % n;
      s += Math.hypot(r[b * 2] - r[a * 2], r[b * 2 + 1] - r[a * 2 + 1]);
    }
    return s;
  };
  if (hard) {
    for (let e = 0; e < edges; e++) {
      const a = e;
      const b = (e + 1) % n;
      const base = pos.length / 3;
      for (let j = 0; j < ts.length; j++) {
        const r = rings[j];
        const va = perim(r, e);
        const vb = va + Math.hypot(r[b * 2] - r[a * 2], r[b * 2 + 1] - r[a * 2 + 1]);
        pos.push(r[a * 2], r[a * 2 + 1], zs[j], r[b * 2], r[b * 2 + 1], zs[j]);
        uv.push(zs[j] / UVS, va / UVS, zs[j] / UVS, vb / UVS);
      }
      for (let j = 0; j < ts.length - 1; j++) {
        const A = base + j * 2;
        idx.push(A, A + 2, A + 1, A + 1, A + 2, A + 3);
      }
    }
  } else {
    const cols = closed ? n + 1 : n;
    for (let j = 0; j < ts.length; j++) {
      const r = rings[j];
      for (let i = 0; i < cols; i++) {
        const k = i % n;
        pos.push(r[k * 2], r[k * 2 + 1], zs[j]);
        uv.push(zs[j] / UVS, perim(r, i) / UVS);
      }
    }
    for (let j = 0; j < ts.length - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const A = j * cols + i;
        idx.push(A, A + cols, A + 1, A + 1, A + cols, A + cols + 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flat cap over a ring (a fan from its centre) facing +Z or -Z. */
export function cap(points: Float32Array, z: number, facing: 1 | -1): BufferGeometry {
  const pos: number[] = [];
  const m = points.length / 2;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < m; i++) {
    cx += points[i * 2] / m;
    cy += points[i * 2 + 1] / m;
  }
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    const ax = points[i * 2];
    const ay = points[i * 2 + 1];
    const bx = points[j * 2];
    const by = points[j * 2 + 1];
    const cz = (ax - cx) * (by - cy) - (ay - cy) * (bx - cx);
    if (cz * facing >= 0) pos.push(cx, cy, z, ax, ay, z, bx, by, z);
    else pos.push(cx, cy, z, bx, by, z, ax, ay, z);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

/** A closed lofted body with caps at both ends. */
export function body(keys: Key[], z0: number, z1: number, sections: number, bias = 1) {
  const ring = octRing(keys);
  const ts: number[] = [];
  for (let j = 0; j <= sections; j++) ts.push(Math.pow(j / sections, bias));
  const r0 = new Float32Array(16);
  const r1 = new Float32Array(16);
  ring(0, r0);
  ring(1, r1);
  return mergeAll([loft(ts, z0, z1, ring, K, true, true), cap(r0, z0, -1), cap(r1, z1, 1)]);
}

export interface PlateSpec {
  t0: number;
  t1: number;
  s0: number;
  s1: number;
  offset: number;
  thick: number;
  chamfer?: number;
  chamferLen?: number;
}

/** A thin armour plate with real thickness that follows a body's facets. */
export function plate(keys: Key[], z0: number, z1: number, spec: PlateSpec, sections: number): BufferGeometry {
  const ringOf = octRing(keys);
  const { t0, t1, s0, s1, offset, thick } = spec;
  const ch = spec.chamfer ?? 0;
  const cl = spec.chamferLen ?? 0.2;
  const mids: number[] = [];
  for (let s = Math.floor(s0) + 1; s < s1; s++) mids.push(s);
  const m = mids.length + 2;
  const hr = new Float32Array(16);
  const tmp = [0, 0, 0, 0];
  const ring = (t: number, out: Float32Array) => {
    ringOf(t, hr);
    const u = (t - t0) / (t1 - t0);
    const e = Math.min(u, 1 - u) / cl;
    const pull = e < 1 ? ch * (1 - e) * (1 - e) : 0;
    const ss = [s0 + pull, ...mids, s1 - pull];
    for (let i = 0; i < m; i++) {
      ringAt(hr, K, ss[i], tmp);
      out[i * 2] = tmp[0] + tmp[2] * (offset + thick);
      out[i * 2 + 1] = tmp[1] + tmp[3] * (offset + thick);
      const j = 2 * m - 1 - i;
      out[j * 2] = tmp[0] + tmp[2] * offset;
      out[j * 2 + 1] = tmp[1] + tmp[3] * offset;
    }
  };
  const ts: number[] = [];
  for (let j = 0; j <= sections; j++) ts.push(t0 + ((t1 - t0) * j) / sections);
  const za = z0 + (z1 - z0) * t0;
  const zb = z0 + (z1 - z0) * t1;
  const loftT = ts.map((t) => (t - t0) / (t1 - t0));
  const g = loft(loftT, za, zb, (u, out) => ring(t0 + u * (t1 - t0), out), m * 2, true, true);
  const r0 = new Float32Array(m * 4);
  const r1 = new Float32Array(m * 4);
  ring(t0, r0);
  ring(t1, r1);
  return mergeAll([g, pairCap(r0, za, -1), pairCap(r1, zb, 1)]);
}

/** Cap a thin closed ring made of paired outer and inner points. */
export function pairCap(points: Float32Array, z: number, facing: 1 | -1) {
  const pos: number[] = [];
  const m = points.length / 2;
  const h = m / 2;
  const tri = (a: number, b: number, c: number) => {
    const ax = points[a * 2];
    const ay = points[a * 2 + 1];
    const bx = points[b * 2];
    const by = points[b * 2 + 1];
    const cx = points[c * 2];
    const cy = points[c * 2 + 1];
    const cz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (cz * facing >= 0) pos.push(ax, ay, z, bx, by, z, cx, cy, z);
    else pos.push(ax, ay, z, cx, cy, z, bx, by, z);
  };
  for (let i = 0; i < h - 1; i++) {
    tri(i, i + 1, m - 2 - i);
    tri(i, m - 2 - i, m - 1 - i);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

/** Revolve a closed (radius, z) outline around the Z axis with crisp edges. */
export function revolve(outline: number[][], segs: number): BufferGeometry {
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const prof = area < 0 ? outline.slice().reverse() : outline;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let vacc = 0;
  for (let e = 0; e < prof.length; e++) {
    const [r0, z0] = prof[e];
    const [r1, z1] = prof[(e + 1) % prof.length];
    const len = Math.hypot(r1 - r0, z1 - z0);
    const base = pos.length / 3;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(r0 * c, r0 * s, z0, r1 * c, r1 * s, z1);
      const u = (j / segs) * ((Math.PI * 2 * (r0 + r1)) / 2 / UVS);
      uv.push(u, vacc / UVS, u, (vacc + len) / UVS);
    }
    for (let j = 0; j < segs; j++) {
      const A = base + j * 2;
      idx.push(A, A + 1, A + 2, A + 1, A + 3, A + 2);
    }
    vacc += len;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  // Faces point away from the middle of the outline.
  let rc = 0;
  let zc = 0;
  for (const [r, z] of prof) {
    rc += r / prof.length;
    zc += z / prof.length;
  }
  return fixOutward(g, (x, y, z, out) => {
    const r = Math.hypot(x, y) || 1;
    const k = (r - rc) / r;
    return out.set(x * k, y * k, z - zc);
  });
}

/**
 * Make every triangle face away from a reference direction field. Used where
 * working the winding out by hand is error prone.
 */
export function fixOutward(g: BufferGeometry, dirAt: (x: number, y: number, z: number, out: Vector3) => Vector3): BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  const pos = ng.getAttribute("position") as BufferAttribute;
  const uv = ng.getAttribute("uv") as BufferAttribute;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  const d = new Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(d.subVectors(c, a));
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    dirAt(cx, cy, cz, d);
    if (n.dot(d) < 0) {
      for (const attr of [pos, uv]) {
        const s = attr.itemSize;
        const arr = attr.array as Float32Array;
        for (let k = 0; k < s; k++) {
          const t = arr[(i + 1) * s + k];
          arr[(i + 1) * s + k] = arr[(i + 2) * s + k];
          arr[(i + 2) * s + k] = t;
        }
      }
    }
  }
  ng.computeVertexNormals();
  return ng;
}

// --------------------------------------------------------------- geometry kit

export function prep(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  if (!out.getAttribute("uv")) out.setAttribute("uv", new BufferAttribute(new Float32Array(out.getAttribute("position").count * 2), 2));
  if (!out.getAttribute("normal")) out.computeVertexNormals();
  for (const name of Object.keys(out.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") out.deleteAttribute(name);
  out.clearGroups();
  return out;
}

export function mergeAll(list: BufferGeometry[]): BufferGeometry {
  const ready = list.map(prep);
  const merged = mergeGeometries(ready, false)!;
  for (const g of ready) g.dispose();
  return merged;
}

/** Mirror a geometry across X and fix the triangle winding. */
export function mirrorX(src: BufferGeometry): BufferGeometry {
  const g = prep(src.clone());
  g.applyMatrix4(new Matrix4().makeScale(-1, 1, 1));
  for (const name of ["position", "normal", "uv"]) {
    const a = g.getAttribute(name) as BufferAttribute;
    const s = a.itemSize;
    const arr = a.array as Float32Array;
    for (let i = 0; i < a.count; i += 3) {
      for (let c = 0; c < s; c++) {
        const t = arr[(i + 1) * s + c];
        arr[(i + 1) * s + c] = arr[(i + 2) * s + c];
        arr[(i + 2) * s + c] = t;
      }
    }
  }
  return g;
}

export function both(g: BufferGeometry): BufferGeometry[] {
  const right = prep(g);
  return [right, mirrorX(right)];
}

export function scaleUV(g: BufferGeometry, su: number, sv: number) {
  const uv = g.getAttribute("uv") as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

/** A bevelled plate lying in the XZ plane from a planform outline (x, forward). */
export function flatPlate(outline: number[][], depth: number, bevel: number, segs: number): BufferGeometry {
  const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel * 0.7, bevelSize: bevel, bevelSegments: segs, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -depth / 2, 0);
  scaleUV(g, 1 / UVS, 1 / UVS);
  return g;
}

/** A bevelled plate standing in the YZ plane from a side outline (z, y). */
export function sidePlate(outline: number[][], width: number, bevel: number): BufferGeometry {
  const shape = new Shape(outline.map(([z, y]) => new Vector2(z, y)));
  const g = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel * 0.7, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2, 0, 0);
  scaleUV(g, 1 / UVS, 1 / UVS);
  return g;
}

/** A hexagonal collar around the Z axis, centred on z. */
export function hexCollar(ro: number, ri: number, depth: number, z: number, bevel = 0.05): BufferGeometry {
  const hex = (r: number) => Array.from({ length: 6 }, (_, k) => new Vector2(Math.cos((k * Math.PI) / 3) * r, Math.sin((k * Math.PI) / 3) * r));
  const shape = new Shape(hex(ro));
  shape.holes.push(new Path(hex(ri).reverse()));
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, z - depth / 2);
  scaleUV(g, 1 / UVS, 1 / UVS);
  return g;
}

/** A rounded box along Z: width x height cross section, length along Z, centred. */
export function pod(w: number, h: number, len: number, r: number, bevel: number): BufferGeometry {
  const s = new Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h);
  s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new ExtrudeGeometry(s, { depth: len, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -len / 2);
  scaleUV(g, 1 / UVS, 1 / UVS);
  return g;
}

export function tube(points: Vector3[], radius: number, segs: number, radial = 6): BufferGeometry {
  return new TubeGeometry(new CatmullRomCurve3(points, false, "catmullrom", 0.2), segs, radius, radial, false);
}

/** A box spanning from a to b with the given cross section. */
export function beam(a: Vector3, b: Vector3, w: number, h: number): BufferGeometry {
  const len = a.distanceTo(b);
  const g = new BoxGeometry(w, h, len);
  const dir = new Vector3().subVectors(b, a).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir);
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** A cylinder spanning from a to b. */
export function rod(a: Vector3, b: Vector3, r: number, seg = 8): BufferGeometry {
  const g = new CylinderGeometry(r, r, a.distanceTo(b), seg, 1);
  const dir = new Vector3().subVectors(b, a).normalize();
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** A lathed shape around the Z axis from (radius, z) points, starting at z0. */
export function latheZ(points: number[][], segs: number, z0: number, x = 0, y = 0) {
  const g = new LatheGeometry(points.map(([r, z]) => new Vector2(r, z)), segs);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z0);
  return g;
}


/** Box projected UVs in world units, so merged parts share one texel density. */
export function boxUV(g: BufferGeometry, scale = UVS): BufferGeometry {
  const pos = g.getAttribute("position") as BufferAttribute;
  const nrm = g.getAttribute("normal") as BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else if (ay >= az) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  return g;
}

/** Place a geometry with a basis and an origin. */
export function placed(g: BufferGeometry, x: Vector3, y: Vector3, z: Vector3, o: Vector3): BufferGeometry {
  return g.applyMatrix4(new Matrix4().makeBasis(x, y, z).setPosition(o));
}
