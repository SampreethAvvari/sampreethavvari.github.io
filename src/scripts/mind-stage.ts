// The Mind star map — a bespoke 3D constellation rendered on canvas 2D over the
// site's WebGL sky. Nodes are glass bubbles (transparent bodies, colour glowing
// from the fresnel rim); edges are constellation lines. In the Portfolio map the
// four disciplines are pinned to four quadrant corners and everything else settles
// toward whichever it is most relevant to. Drag to orbit in any direction, scroll
// to dolly in and out; up close the bubbles swell and their pinpoint intensity
// eases into a soft glassy glow, size scales with how connected a node is.

interface RawNode {
  id: string;
  type: string;
  label: string;
  color: string;
  weight: number;
  url?: string;
  blurb?: string;
  meta?: string;
  chips?: string[];
}
interface RawGraph {
  key: string;
  title: string;
  subtitle: string;
  nodes: RawNode[];
  edges: { source: string; target: string }[];
}
interface Node extends RawNode {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  px: number; py: number; pz: number; ps: number; // last projection (screen + scale)
  pinned: boolean;
  r: number; // world radius, from weight + degree
  tw: number;
  deg: number;
}

const TYPE_LABELS: Record<string, string> = {
  discipline: "Discipline",
  project: "Project",
  tech: "Technology",
  post: "Case study",
  repo: "Repository",
  org: "Organization",
  language: "Language",
  category: "Tech stack",
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
  repo: "#DCE1EA",
  org: "#F5F5F7",
  tech: "#8E96A6",
  language: "#8E96A6",
};
const LEGEND: Record<string, string[]> = {
  portfolio: ["discipline", "project", "tech", "post"],
  repo: ["category", "repo", "language"],
};
// brightness by type: the "work" (projects, repos, disciplines) shines; the
// supporting stars (tech, languages, topics) stay dim at every zoom level.
const LUM: Record<string, number> = {
  discipline: 1.15,
  category: 1.15,
  project: 1.15,
  repo: 1.1,
  org: 1.05,
  post: 0.8,
  tech: 0.42,
  language: 0.46,
  topic: 0.4,
};
// bright "work" stars keep their labels even zoomed all the way out; the dim
// supporting stars only reveal labels as you zoom in.
const LABEL_ALWAYS = new Set(["discipline", "category", "project", "repo", "org"]);
// A meaningful 2x2. X: business-driven (left) -> tech-driven (right).
// Y: product & delivery (top) -> models & intelligence (bottom).
//   FDE top-left (business + delivery), AIE bottom-left (business + models),
//   SDE top-right (tech + delivery), MLE bottom-right (tech + models).
// A project wired to both sides settles in the middle = business + tech metrics.
const QUAD: Record<string, [number, number]> = {
  fde: [-1, 1],
  aie: [-1, -1],
  sde: [1, 1],
  mle: [1, -1],
};
// Git Mind quadrants: tech-stack corners (repos settle toward the stacks they use).
const CAT_QUAD: Record<string, [number, number]> = {
  aiml: [-1, 1], // top-left
  frontend: [1, 1], // top-right
  backend: [-1, -1], // bottom-left
  data: [1, -1], // bottom-right
};
const AXES: { at: [number, number, number]; label: string }[] = [
  { at: [-1, 0, 0], label: "Business-driven" },
  { at: [1, 0, 0], label: "Tech-driven" },
  { at: [0, 1, 0], label: "Product & delivery" },
  { at: [0, -1, 0], label: "Models & intelligence" },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function mountMind() {
  const canvas = document.getElementById("mind-canvas") as HTMLCanvasElement | null;
  const dataEl = document.getElementById("mind-data");
  const panel = document.querySelector("[data-mind-panel]");
  if (!canvas || !dataEl || !panel) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const graphs: RawGraph[] = JSON.parse(dataEl.textContent || "[]");
  if (!graphs.length) return;
  for (const g of graphs) for (const n of g.nodes) n.color = TYPE_TINT[n.type] ?? n.color;
  const byKey = new Map(graphs.map((g) => [g.key, g]));

  const subEl = panel.querySelector("[data-mind-sub]") as HTMLElement;
  const detailEl = panel.querySelector("[data-mind-detail]") as HTMLElement;
  const legendEl = panel.querySelector("[data-mind-legend]") as HTMLElement;
  const modeBtns = Array.from(panel.querySelectorAll<HTMLButtonElement>(".mind-mode"));
  const resetBtn = document.querySelector("[data-mind-reset]") as HTMLElement | null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, dpr = 1;
  let nodes: Node[] = [];
  let edges: { a: Node; b: Node }[] = [];
  const adj = new Map<string, Set<string>>();

  // orbit camera
  const cam = { yaw: -0.5, pitch: -0.42, dist: 900, focal: 700 };
  let camTarget: Partial<typeof cam> | null = null;
  let worldR = 300;
  let hasQuadrants = false;
  let showAxisLabels = false;
  let alpha = 1, fade = 0;
  let autorotate = !reduced;
  let idle = 0;
  let hover: Node | null = null;
  let selected: Node | null = null;
  let t0 = 0, raf = 0;

  // ---- layout -------------------------------------------------------------
  function loadGraph(key: string) {
    const g = byKey.get(key) || graphs[0];
    adj.clear();
    const map = new Map<string, Node>();
    nodes = g.nodes.map((n) => {
      const node: Node = {
        ...n,
        x: (Math.random() - 0.5) * 260,
        y: (Math.random() - 0.5) * 260,
        z: (Math.random() - 0.5) * 160,
        vx: 0, vy: 0, vz: 0,
        px: 0, py: 0, pz: 0, ps: 1,
        pinned: false,
        r: 2,
        tw: Math.random() * Math.PI * 2,
        deg: 0,
      };
      map.set(n.id, node);
      adj.set(n.id, new Set());
      return node;
    });
    edges = [];
    for (const e of g.edges) {
      const a = map.get(e.source), b = map.get(e.target);
      if (!a || !b) continue;
      edges.push({ a, b });
      a.deg++; b.deg++;
      adj.get(a.id)!.add(b.id);
      adj.get(b.id)!.add(a.id);
    }
    // size from importance: type weight + how connected it is
    for (const n of nodes) n.r = 1.7 + Math.sqrt(n.weight) * 1.9 + Math.sqrt(n.deg) * 1.15;

    // pin the quadrant anchors: disciplines (portfolio) or tech stacks (git mind)
    const Rq = 250;
    for (const n of nodes) {
      const dm = n.id.match(/^disc:(\w+)/);
      const cm = n.id.match(/^cat:(\w+)/);
      const q = dm && QUAD[dm[1]] ? QUAD[dm[1]] : cm && CAT_QUAD[cm[1]] ? CAT_QUAD[cm[1]] : null;
      if (q) { n.x = q[0] * Rq; n.y = q[1] * Rq; n.z = 0; n.pinned = true; }
    }
    hasQuadrants = nodes.some((n) => n.pinned); // divider lines on both maps
    showAxisLabels = nodes.some((n) => n.id.startsWith("disc:")); // business/tech labels: portfolio only

    document.querySelector(".mind-root")?.setAttribute("data-graph", key);
    subEl.textContent = g.subtitle;
    renderLegend(key);
    clearDetail();
    selected = null; hover = null; alpha = 1; fade = 0;
    autorotate = !reduced;
    for (let i = 0; i < 220; i++) step(0.85);
    frameToFit();
  }

  function step(a: number) {
    const n = nodes.length;
    for (let i = 0; i < n; i++) {
      const p = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const q = nodes[j];
        let dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dz = Math.random() - 0.5; d2 = 0.01; }
        const rep = (2600 * a) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * rep, fy = (dy / d) * rep, fz = (dz / d) * rep;
        p.vx += fx; p.vy += fy; p.vz += fz;
        q.vx -= fx; q.vy -= fy; q.vz -= fz;
      }
    }
    for (const e of edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, dz = e.b.z - e.a.z;
      const d = Math.hypot(dx, dy, dz) || 0.01;
      const ideal = 80 + (e.a.r + e.b.r) * 2;
      const f = (d - ideal) * 0.02 * a;
      const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
      e.a.vx += fx; e.a.vy += fy; e.a.vz += fz;
      e.b.vx -= fx; e.b.vy -= fy; e.b.vz -= fz;
    }
    for (const p of nodes) {
      if (p.pinned) { p.vx = p.vy = p.vz = 0; continue; }
      // mild pull to origin, and flatten toward the quadrant plane so the four
      // clusters stay legible while depth still develops
      p.vx -= p.x * 0.01 * a;
      p.vy -= p.y * 0.01 * a;
      p.vz -= p.z * 0.045 * a;
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      p.vx *= 0.84; p.vy *= 0.84; p.vz *= 0.84;
    }
  }

  function frameToFit() {
    let max = 1;
    for (const p of nodes) max = Math.max(max, Math.hypot(p.x, p.y, p.z));
    worldR = max;
    cam.focal = Math.min(W, H) * 0.92;
    camTarget = { dist: worldR * 2.5 + 120, yaw: -0.5, pitch: -0.42 };
  }

  // ---- projection ---------------------------------------------------------
  function projXYZ(x: number, y: number, z: number) {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const s = cam.focal / Math.max(cam.dist - z2, 1);
    return { px: W / 2 + x1 * s, py: H / 2 - y2 * s, pz: z2, ps: s };
  }
  function project(p: Node) {
    const r = projXYZ(p.x, p.y, p.z);
    p.px = r.px; p.py = r.py; p.pz = r.pz; p.ps = r.ps;
  }
  function drawQuadrants(showLabels: boolean) {
    const ext = 380;
    // the two divider lines through the origin that split the plane into quadrants
    const lines: [number, number, number][][] = [
      [[-ext, 0, 0], [ext, 0, 0]],
      [[0, -ext, 0], [0, ext, 0]],
    ];
    ctx!.lineWidth = 1.1;
    for (const [a, b] of lines) {
      const A = projXYZ(a[0], a[1], a[2]);
      const B = projXYZ(b[0], b[1], b[2]);
      const grad = ctx!.createLinearGradient(A.px, A.py, B.px, B.py);
      grad.addColorStop(0, "rgba(245,245,247,0)");
      grad.addColorStop(0.5, `rgba(245,245,247,${0.18 * fade})`);
      grad.addColorStop(1, "rgba(245,245,247,0)");
      ctx!.strokeStyle = grad;
      ctx!.beginPath(); ctx!.moveTo(A.px, A.py); ctx!.lineTo(B.px, B.py); ctx!.stroke();
    }
    if (showLabels) {
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
      for (const ax of AXES) {
        const e = projXYZ(ax.at[0] * ext, ax.at[1] * ext, ax.at[2] * ext);
        ctx!.fillStyle = `rgba(245,245,247,${0.36 * fade})`;
        ctx!.shadowColor = "rgba(0,0,0,0.8)";
        ctx!.shadowBlur = 6;
        ctx!.fillText(ax.label, e.px, e.py);
        ctx!.shadowBlur = 0;
      }
    }
  }

  // ---- render -------------------------------------------------------------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas!.clientWidth; H = canvas!.clientHeight;
    canvas!.width = Math.round(W * dpr);
    canvas!.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.focal = Math.min(W, H) * 0.92;
  }

  function render(now: number) {
    if (!t0) t0 = now;
    const time = (now - t0) / 1000;

    if (camTarget) {
      for (const k of Object.keys(camTarget) as (keyof typeof cam)[]) {
        cam[k] = lerp(cam[k], camTarget[k]!, 0.08);
      }
      if (Math.abs(cam.dist - (camTarget.dist ?? cam.dist)) < 0.5) camTarget = null;
    }
    if (alpha > 0.02) { step(alpha); alpha *= 0.968; }
    if (fade < 1) fade = Math.min(1, fade + 0.05);
    idle++;
    if (autorotate && idle > 90 && !camTarget) cam.yaw += 0.0016;

    for (const p of nodes) project(p);
    const order = [...nodes].sort((a, b) => a.pz - b.pz); // far first

    ctx!.clearRect(0, 0, W, H);
    if (hasQuadrants) drawQuadrants(showAxisLabels);

    // zoom feel: dist small (close) => big soft bubbles; far => sharp pinpoints
    const near = clamp((worldR * 3.4 - cam.dist) / (worldR * 3), 0, 1);
    const labelOn = clamp(near * 1.4 - 0.12, 0, 1);
    const hoverSet = hover ? adj.get(hover.id) : null;
    const selSet = selected ? adj.get(selected.id) : null;

    // edges
    for (const e of edges) {
      const focus =
        hover && (e.a === hover || e.b === hover) ? 1 :
        selected && (e.a === selected || e.b === selected) ? 0.85 : 0;
      const base = lerp(0.05, 0.14, near) * fade;
      const op = focus ? 0.5 : base;
      const grad = ctx!.createLinearGradient(e.a.px, e.a.py, e.b.px, e.b.py);
      grad.addColorStop(0, hexA(e.a.color, op));
      grad.addColorStop(1, hexA(e.b.color, op));
      ctx!.strokeStyle = grad;
      ctx!.lineWidth = focus ? 1.3 : 0.7;
      ctx!.beginPath();
      ctx!.moveTo(e.a.px, e.a.py);
      ctx!.lineTo(e.b.px, e.b.py);
      ctx!.stroke();
    }

    // stars as glass bubbles
    ctx!.textAlign = "center";
    ctx!.textBaseline = "top";
    for (const p of order) {
      if (p.px < -120 || p.px > W + 120 || p.py < -120 || p.py > H + 120) continue;
      const R = clamp(p.r * p.ps, 0.6, 140);
      const depthFade = clamp((p.ps / (cam.focal / cam.dist)) * 0.7 + 0.3, 0.25, 1.15);
      const tw = reduced ? 1 : 0.85 + Math.sin(time * 1.5 + p.tw) * 0.15;
      const dim =
        (hover && hover !== p && !hoverSet?.has(p.id)) ||
        (selected && selected !== p && !selSet?.has(p.id) && !hover);
      const focus = p === hover || p === selected;
      const lum = focus ? 1.15 : LUM[p.type] ?? 0.7;
      const op = (dim ? 0.26 : 1) * fade * depthFade * lum;
      drawBubble(p.px, p.py, R * (focus ? 1.28 : 1), p.color, op * tw, near, focus);

      const bright = LABEL_ALWAYS.has(p.type);
      const lop = focus ? 1 : bright ? 0.92 : labelOn * 0.7;
      if (lop > 0.05 && !(dim && !focus) && R > 1.2) {
        const size = clamp(11 + R * 0.16, 10.5, 16);
        ctx!.font = `${focus || bright ? 600 : 500} ${size}px Inter, -apple-system, "SF Pro Display", sans-serif`;
        ctx!.fillStyle = hexA("#f5f5f7", lop * op * 1.1);
        ctx!.shadowColor = "rgba(0,0,0,0.9)";
        ctx!.shadowBlur = 9;
        ctx!.fillText(trim(p.label, focus ? 44 : 22), p.px, p.py + R + 5);
        ctx!.shadowBlur = 0;
      }
    }
    raf = requestAnimationFrame(render);
  }

  // A star: pinpoint when tiny/far, a glass sphere up close — transparent body,
  // colour glowing from the fresnel rim, with a soft specular highlight.
  function drawBubble(x: number, y: number, R: number, color: string, op: number, near: number, focus: boolean) {
    op = clamp(op, 0, 1);
    if (op <= 0.01) return;
    const bubble = clamp((R - 3) / 8, 0, 1) * clamp(near + 0.15, 0, 1); // 0 pinpoint .. 1 full glass

    // outer bloom
    const bloom = R * (2.6 + near * 2.2);
    const g0 = ctx!.createRadialGradient(x, y, 0, x, y, Math.max(bloom, 3));
    g0.addColorStop(0, hexA(color, 0.22 * op * (1 - bubble * 0.4)));
    g0.addColorStop(0.5, hexA(color, 0.08 * op));
    g0.addColorStop(1, hexA(color, 0));
    ctx!.fillStyle = g0;
    ctx!.beginPath(); ctx!.arc(x, y, Math.max(bloom, 3), 0, Math.PI * 2); ctx!.fill();

    // fresnel rim (glass): transparent centre, bright edge
    if (bubble > 0.02) {
      const g1 = ctx!.createRadialGradient(x, y, 0, x, y, R);
      g1.addColorStop(0, hexA(color, 0.02 * op));
      g1.addColorStop(0.55, hexA(color, 0.05 * op * bubble));
      g1.addColorStop(0.82, hexA(color, 0.16 * op * bubble));
      g1.addColorStop(0.94, hexA(mix(color, "#ffffff", 0.35), 0.7 * op * bubble));
      g1.addColorStop(1, hexA(color, 0.12 * op * bubble));
      ctx!.fillStyle = g1;
      ctx!.beginPath(); ctx!.arc(x, y, R, 0, Math.PI * 2); ctx!.fill();
      // specular highlight
      const hr = R * 0.34;
      const hx = x - R * 0.32, hy = y - R * 0.36;
      const gs = ctx!.createRadialGradient(hx, hy, 0, hx, hy, hr);
      gs.addColorStop(0, hexA("#ffffff", 0.55 * op * bubble));
      gs.addColorStop(1, hexA("#ffffff", 0));
      ctx!.fillStyle = gs;
      ctx!.beginPath(); ctx!.arc(hx, hy, hr, 0, Math.PI * 2); ctx!.fill();
    }

    // bright pinpoint core — dominant when small/far, a faint glassy seed up close
    const coreA = op * lerp(1, 0.32, bubble);
    ctx!.fillStyle = hexA(mix(color, "#ffffff", lerp(0.55, 0.2, bubble)), coreA);
    ctx!.beginPath(); ctx!.arc(x, y, Math.max(R * lerp(0.55, 0.16, bubble), 0.6), 0, Math.PI * 2); ctx!.fill();

    if (focus) {
      ctx!.strokeStyle = hexA(color, 0.7 * op);
      ctx!.lineWidth = 1.4;
      ctx!.beginPath(); ctx!.arc(x, y, R + 5, 0, Math.PI * 2); ctx!.stroke();
    }
  }

  // ---- interaction --------------------------------------------------------
  function pick(sx: number, sy: number): Node | null {
    let best: Node | null = null, bestD = Infinity;
    for (const p of nodes) {
      const rr = Math.max(clamp(p.r * p.ps, 0.6, 140) + 12, 14);
      const d = (p.px - sx) ** 2 + (p.py - sy) ** 2;
      if (d < rr * rr && d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  let dragging = false, moved = false, last = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; moved = false; last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-panning");
    idle = 0; autorotate = false;
  });
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (dragging) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      cam.yaw += dx * 0.006;
      cam.pitch = clamp(cam.pitch + dy * 0.006, -1.45, 1.45);
      camTarget = null;
      last = { x: e.clientX, y: e.clientY };
    } else {
      const h = pick(sx, sy);
      if (h !== hover) { hover = h; canvas.classList.toggle("is-over", !!h); }
    }
  });
  const endDrag = (e: PointerEvent) => {
    if (dragging && !moved) {
      const rect = canvas.getBoundingClientRect();
      select(pick(e.clientX - rect.left, e.clientY - rect.top));
    }
    dragging = false; canvas.classList.remove("is-panning");
    idle = 0;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", () => { dragging = false; canvas.classList.remove("is-panning"); });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), worldR * 0.7, worldR * 6);
    camTarget = null; idle = 0; autorotate = false;
  }, { passive: false });

  let pinch = 0;
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinch) { cam.dist = clamp(cam.dist * (pinch / d), worldR * 0.7, worldR * 6); camTarget = null; }
      pinch = d; e.preventDefault();
    }
  }, { passive: false });
  canvas.addEventListener("touchend", () => (pinch = 0));

  function select(n: Node | null) {
    selected = n;
    if (!n) { clearDetail(); return; }
    camTarget = { dist: clamp(cam.dist, worldR * 0.7, worldR * 2.2) };
    showDetail(n);
    setFolded(false); // a tapped star's story needs the panel open
  }

  // ---- panel --------------------------------------------------------------
  // On a thin or short window the panel starts folded to its top row, so it
  // does not sit on top of the map.
  function setFolded(folded: boolean) {
    panel!.classList.toggle("is-folded", folded);
    if (!foldBtn) return;
    const label = folded ? "Show panel" : "Hide panel";
    foldBtn.setAttribute("aria-expanded", String(!folded));
    foldBtn.setAttribute("aria-label", label);
    foldBtn.title = label;
  }
  const foldBtn = panel.querySelector<HTMLButtonElement>("[data-mind-fold]");
  foldBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setFolded(!panel.classList.contains("is-folded"));
  });
  // Folded, the whole pill opens it.
  panel.addEventListener("click", () => {
    if (panel.classList.contains("is-folded")) setFolded(false);
  });
  setFolded(window.matchMedia("(max-width: 1100px), (max-height: 640px)").matches);

  function showDetail(n: Node) {
    const kind = TYPE_LABELS[n.type] || n.type;
    const safeUrl = n.url && /^(https?:\/\/|\/)/.test(n.url) ? n.url : "";
    const ext = safeUrl.startsWith("http");
    const link = safeUrl
      ? `<a class="mind-detail-link" href="${esc(safeUrl)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${ext ? "Open" : "View"} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></a>`
      : "";
    const blurb = n.blurb ? `<p class="mind-detail-blurb">${esc(n.blurb)}</p>` : "";
    const chips = (n.chips || []).length
      ? `<div class="mind-chips">${n.chips!.slice(0, 8).map((c) => `<span class="mind-chip">${esc(c)}</span>`).join("")}</div>`
      : "";
    const conn = n.deg ? `${n.deg} connection${n.deg === 1 ? "" : "s"}` : "";
    const metaBits = [n.type !== "project" ? n.meta : "", conn].filter(Boolean).map(esc).join(" · ");
    detailEl.style.setProperty("--nc", n.color);
    detailEl.innerHTML = `
      <p class="mind-detail-kind">${esc(kind)}${metaBits ? ` · ${metaBits}` : ""}</p>
      <p class="mind-detail-title">${esc(n.label)}</p>
      ${blurb}${chips}${link}`;
  }
  function clearDetail() {
    detailEl.style.removeProperty("--nc");
    detailEl.innerHTML = `<p class="mind-detail-hint">Drift through the map. Tap a star to open it.</p>`;
  }
  function renderLegend(key: string) {
    const g = byKey.get(key) || graphs[0];
    const colorFor = (type: string) => g.nodes.find((n) => n.type === type)?.color || "#93A4C4";
    legendEl.innerHTML = (LEGEND[key] || [])
      .map((type) => `<li style="--lc:${colorFor(type)}">${esc(TYPE_LABELS[type] || type)}</li>`)
      .join("");
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.mode!;
      modeBtns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", String(on));
      });
      loadGraph(key);
    });
  });
  resetBtn?.addEventListener("click", () => { select(null); frameToFit(); autorotate = !reduced; });

  // ---- boot ---------------------------------------------------------------
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();
  loadGraph("portfolio");
  raf = requestAnimationFrame(render);
  window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));
}

// ---- helpers --------------------------------------------------------------
function hexA(hex: string, a: number): string {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}
function toRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mix(a: string, b: string, t: number): string {
  const A = toRgb(a), B = toRgb(b);
  const r = Math.round(lerp(A.r, B.r, t)), g = Math.round(lerp(A.g, B.g, t)), bl = Math.round(lerp(A.b, B.b, t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}
function trim(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
