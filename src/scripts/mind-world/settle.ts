// Where every star sits. The force layout runs once, when the page is built, and
// its result goes out in the page's data, so a visitor's phone never spends time on
// it and the first map is right from its first frame. The same seed gives the same
// map every time, so a star stays where the visitor last saw it.

type V3 = [number, number, number];

export const MAJOR = new Set(["discipline", "category", "project", "repo"]);
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

/** How far apart a map spreads. It grows with the number of stars, so a busy map opens up. */
export const spreadOf = (count: number, key: string) => Math.max(1.25, Math.min(3, Math.sqrt(count / 35))) * (key === "repo" ? 1.4 : 1);
/** A star's size in the world, from its importance and how connected it is. */
export const radiusOf = (weight: number, deg: number) => 1.7 + Math.sqrt(weight) * 1.9 + Math.sqrt(deg) * 1.15;

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface In {
  key: string;
  nodes: { id: string; type: string; weight: number }[];
  edges: { source: string; target: string }[];
}

/** The settled position of every star, by id. */
export function settle(g: In): Map<string, V3> {
  const rand = seeded(g.key === "repo" ? 90210 : 2046);
  const n = g.nodes.length;
  const spread = spreadOf(n, g.key);
  const git = g.key === "repo";
  const index = new Map(g.nodes.map((node, i) => [node.id, i]));
  const x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n);
  const vx = new Float64Array(n), vy = new Float64Array(n), vz = new Float64Array(n);
  const major = g.nodes.map((node) => MAJOR.has(node.type));
  const deg = new Int32Array(n);
  const pinned = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = (rand() - 0.5) * 260 * spread;
    y[i] = (rand() - 0.5) * 260 * spread;
    z[i] = (rand() - 0.5) * 260 * spread;
  }
  const links: [number, number][] = [];
  for (const e of g.edges) {
    const a = index.get(e.source), b = index.get(e.target);
    if (a === undefined || b === undefined) continue;
    links.push([a, b]);
    deg[a]++;
    deg[b]++;
  }
  const r = g.nodes.map((node, i) => radiusOf(node.weight, deg[i]));
  // pin the quadrant anchors: disciplines (portfolio) or tech stacks (git mind)
  const Rq = 250 * spread;
  g.nodes.forEach((node, i) => {
    const dm = node.id.match(/^disc:(\w+)/);
    const cm = node.id.match(/^cat:(\w+)/);
    const q = dm && QUAD[dm[1]] ? QUAD[dm[1]] : cm && CAT_QUAD[cm[1]] ? CAT_QUAD[cm[1]] : null;
    if (q) {
      x[i] = q[0] * Rq;
      y[i] = q[1] * Rq;
      z[i] = q[2] * Rq;
      pinned[i] = 1;
    }
  });
  const k3 = spread * spread * spread;
  // The git map: repos push each other harder, and a language most repos
  // use (Python, TypeScript) pulls on each one more gently, so the repos
  // spread out instead of collapsing onto the shared languages.
  const majorPush = git ? 12000 : 6200;
  const step = (a: number) => {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = x[i] - x[j], dy = y[i] - y[j], dz = z[i] - z[j];
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.01) {
          dx = rand() - 0.5;
          dy = rand() - 0.5;
          dz = rand() - 0.5;
          d2 = 0.01;
        }
        // projects push each other harder, so each has room around it
        const rep = ((major[i] && major[j] ? majorPush : 2600) * k3 * a) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * rep, fy = (dy / d) * rep, fz = (dz / d) * rep;
        vx[i] += fx; vy[i] += fy; vz[i] += fz;
        vx[j] -= fx; vy[j] -= fy; vz[j] -= fz;
      }
    }
    for (const [i, j] of links) {
      const dx = x[j] - x[i], dy = y[j] - y[i], dz = z[j] - z[i];
      const d = Math.hypot(dx, dy, dz) || 0.01;
      const both = major[i] && major[j];
      // tools sit close around their project; projects keep their distance
      const ideal = (80 + (r[i] + r[j]) * 2) * spread * (both ? 1.25 : 0.72);
      const hub = git && !both ? Math.min(1, 2.5 / Math.sqrt(Math.max(deg[i], deg[j]))) : 1;
      const f = (d - ideal) * 0.02 * a * hub;
      const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
      vx[i] += fx; vy[i] += fy; vz[i] += fz;
      vx[j] -= fx; vy[j] -= fy; vz[j] -= fz;
    }
    for (let i = 0; i < n; i++) {
      if (pinned[i]) {
        vx[i] = vy[i] = vz[i] = 0;
        continue;
      }
      // the same mild pull to the centre on every axis, so the cloud keeps
      // its depth instead of flattening onto one plane
      vx[i] -= x[i] * 0.01 * a;
      vy[i] -= y[i] * 0.01 * a;
      vz[i] -= z[i] * 0.01 * a;
      x[i] += vx[i]; y[i] += vy[i]; z[i] += vz[i];
      vx[i] *= 0.84; vy[i] *= 0.84; vz[i] *= 0.84;
    }
  };
  for (let s = 0; s < 260; s++) step(0.85);
  for (let a = 1; a > 0.02; a *= 0.968) step(a);
  const out = new Map<string, V3>();
  g.nodes.forEach((node, i) => out.set(node.id, [Math.round(x[i] * 10) / 10, Math.round(y[i] * 10) / 10, Math.round(z[i] * 10) / 10]));
  return out;
}
