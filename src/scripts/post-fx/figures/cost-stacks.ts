// What it costs, as glass coins. One coin is one dollar of the post's table,
// stacked by project and by line. "What never sleeps" sends the coins of the
// four always on lines flying into one stack of $76.55, which is the post's
// argument made physical. "The apps" leaves only the Cloud Run coins, which
// are slivers.
//
// Every amount here is in the post. A project's remainder is drawn so its
// stack is the right height, and is labelled without a number of its own.
//
// Sound hooks:
//   post:figure { id: "cost-stacks", action: "mode:bill" | "mode:never" | "mode:apps" | "project:<id>" }
//   post:hover { kind: "coin", id: "<project>/<line>", note }

import {
  AdditiveBlending,
  BackSide,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearSRGBColorSpace,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  Sphere,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Figure } from "./index";
import { clamp, emit, h, noteOf, whileVisible } from "../util";
import { frame, fig, readCard, segmented } from "./parts";

type Kind = "never" | "app" | "other" | "rest";
type Line = { id: string; label: string; amount: number; show: string; kind: Kind; why: string };
type Project = { id: string; name: string; short: string; total: number; lines: Line[] };

const money = (v: number) => `$${v.toFixed(2)}`;

// From the post's table and paragraphs, nothing else.
const RAW: Array<Omit<Project, "lines"> & { lines: Array<Omit<Line, "show"> & { show?: string }> }> = [
  {
    id: "cbct",
    name: "CBCT scan validator",
    short: "CBCT",
    total: 61.76,
    lines: [
      { id: "jobs", label: "Training data jobs", amount: 45.54, kind: "other", why: "Cloud Run jobs that turn labeled scans into training data" },
      { id: "vm", label: "SFTP VM", amount: 11.23, kind: "never", why: "The always on VM that trades files with the lab's case system" },
      { id: "run", label: "Cloud Run", amount: 0.68, kind: "app", why: "All the CBCT services, the validator and the review app included" },
    ],
  },
  {
    id: "est",
    name: "Treatment estimator",
    short: "Estimator",
    total: 33.88,
    lines: [
      { id: "sql", label: "Cloud SQL", amount: 33.2, kind: "never", why: "$23.45 of that is the small instance alone" },
      { id: "sec", label: "Secret Manager", amount: 0.39, kind: "other", why: "More than the app's Cloud Run" },
      { id: "run", label: "Cloud Run", amount: 0.14, kind: "app", why: "Scales to zero between consults" },
    ],
  },
  {
    id: "plan",
    name: "Capacity planner",
    short: "Planner",
    total: 27.07,
    lines: [
      { id: "sql", label: "Cloud SQL", amount: 24.98, kind: "never", why: "The same $23.45 instance plus $1.53 of storage" },
      { id: "run", label: "Cloud Run", amount: 1.29, kind: "app", why: "The minute sync and every page people opened" },
      { id: "sch", label: "Scheduler job", amount: 0.09, kind: "other", why: "The job that fires the sync every minute" },
    ],
  },
  {
    id: "forms",
    name: "Hybridge Forms",
    short: "Forms",
    total: 8.62,
    lines: [
      { id: "warm", label: "Warm instance", amount: 7.14, kind: "never", why: "So the first patient of the morning never waits on a cold start" },
      { id: "run", label: "Requests", amount: 0.56, kind: "app", why: "Public forms, dashboard and delivery worker" },
      { id: "job", label: "Nightly check job", amount: 0.03, kind: "other", why: "The job that tests the forms at night" },
    ],
  },
  {
    id: "launch",
    name: "Launchpad",
    short: "Launchpad",
    total: 0.32,
    lines: [
      { id: "sec", label: "Secret Manager", amount: 0.2, kind: "other", why: "More than its Cloud Run" },
      { id: "run", label: "Cloud Run", amount: 0.04, kind: "app", why: "Less than the secrets it reads" },
    ],
  },
  {
    id: "portal",
    name: "Doctor Portal",
    short: "Portal",
    total: 0.06,
    lines: [
      { id: "sec", label: "Secret Manager", amount: 0.05, kind: "other", why: "More than its Cloud Run" },
      // The post says "less than a cent" and gives no figure, so none is shown.
      { id: "run", label: "Cloud Run", amount: 0.005, show: "Under a cent", kind: "app", why: "Less than a cent" },
    ],
  },
];

const PROJECTS: Project[] = RAW.map((p) => {
  const lines: Line[] = p.lines.map((l) => ({ ...l, show: l.show ?? money(l.amount) }));
  const rest = p.total - lines.reduce((a, l) => a + l.amount, 0);
  if (rest > 0.012) {
    lines.push({ id: "rest", label: "The rest of this project", amount: rest, show: "", kind: "rest", why: "Everything else on its bill" });
  }
  return { ...p, lines };
});

const THICK = 0.072;
const GAP = 0.012;
const STEP = THICK + GAP;
const SPACING = 2.55;
const FRONT_Z = 1.7;

type Coin = {
  p: number;
  l: number;
  scaleY: number;
  home: Vector3;
  pool: Vector3 | null;
  t: number;
  delay: number;
  lift: number;
  glow: number;
  fade: number;
};

const VS = /* glsl */ `
attribute vec2 aState;
uniform float uMirror;
varying vec3 vN; varying vec3 vView; varying vec3 vLocal; varying vec2 vState; varying float vY;
void main() {
  vLocal = position;
  vState = aState;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 n = normal;
  vY = wp.y;
  if (uMirror > 0.5) { wp.y = -wp.y; n.y = -n.y; }
  vN = normalize(mat3(modelMatrix) * n);
  vView = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FS = /* glsl */ `
precision highp float;
uniform vec3 uTone; uniform vec3 uHot; uniform float uMirror; uniform float uCrisp;
varying vec3 vN; varying vec3 vView; varying vec3 vLocal; varying vec2 vState; varying float vY;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vView);
  float glow = vState.x;
  float fade = vState.y;
  float ndv = abs(dot(N, V));
  float cap = smoothstep(0.7, 0.95, abs(N.y));
  float r = length(vLocal.xz);
  vec3 tone = mix(uTone, uHot, glow);
  // The side of a coin: dark glass with one lit edge, so a stack reads as rings.
  float line = smoothstep(0.1, 0.5, vLocal.y);
  float lit = mix(0.5, line, uCrisp);
  float side = 0.035 + 0.3 * pow(1.0 - ndv, 2.5) + lit * (0.3 + 0.42 * ndv);
  // A face: nearly black, with a bright ring at its edge.
  float face = 0.03 + smoothstep(0.84, 0.985, r) * 0.85;
  vec3 col = tone * mix(side, face, cap);
  col += vec3(1.0, 0.95, 0.86) * (line * (1.0 - cap) * glow * 0.3);
  col *= (1.0 + glow * 0.45) * fade;
  // On the floor, a reflection that dies away.
  if (uMirror > 0.5) {
    gl_FragColor = vec4(col * 0.26 * smoothstep(1.3, 0.0, vY), 0.0);
    return;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const render: Figure = ({ root, signal, still }) => {
  const { head } = frame(root, "The bill, coin by coin", "One coin is one dollar. Drag to turn it, pick a stack to open it.");
  const stage = h("div", "pfx-cost-stage");
  const canvas = h("canvas", "pfx-cost-gl");
  const labels = h("div", "pfx-cost-labels");
  const tip = h("div", "pfx-cost-tip");
  tip.hidden = true;
  stage.append(canvas, labels, tip);
  const read = h("div", "pfx-read pfx-cost-read");
  read.setAttribute("aria-live", "polite");
  root.append(stage, read);

  type Mode = "bill" | "never" | "apps";
  let mode: Mode = "bill";
  let picked: number | null = null;

  const seg = segmented<Mode>(
    "What to show",
    [
      { v: "bill", label: "The bill" },
      { v: "never", label: "Never sleeps" },
      { v: "apps", label: "The apps" },
    ],
    "bill",
    (v) => setMode(v),
    signal,
  );
  head.append(seg.el);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    // No WebGL: the same figures as cards, and the post's table above them.
    stage.remove();
    seg.el.remove();
    PROJECTS.forEach((p) => read.append(readCard(money(p.total), p.name)));
    return;
  }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1.6, 0.1, 200);

  // ---- Coins ---------------------------------------------------------------
  const coins: Coin[] = [];
  const stackX = (i: number) => (i - (PROJECTS.length - 1) / 2) * SPACING;
  const stackZ = (i: number) => -Math.abs(i - (PROJECTS.length - 1) / 2) * 0.28;
  PROJECTS.forEach((proj, pi) => {
    let y = 0;
    proj.lines.forEach((line, li) => {
      let left = line.amount;
      while (left > 1e-6) {
        const part = Math.min(1, left);
        left -= part;
        // A sliver of a coin stays visible: the point is how thin it is.
        const scaleY = Math.max(0.1, part);
        const hh = THICK * scaleY;
        coins.push({
          p: pi,
          l: li,
          scaleY,
          home: new Vector3(stackX(pi), y + hh / 2, stackZ(pi)),
          pool: null,
          t: 0,
          delay: 0,
          lift: 0,
          glow: 0,
          fade: 1,
        });
        y += hh + GAP;
      }
    });
  });
  // The one stack of what never sleeps: largest line at the bottom.
  {
    const never = coins
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => PROJECTS[c.p].lines[c.l].kind === "never")
      .sort((a, b) => PROJECTS[b.c.p].lines[b.c.l].amount - PROJECTS[a.c.p].lines[a.c.l].amount);
    let y = 0;
    never.forEach(({ c }, k) => {
      const hh = THICK * c.scaleY;
      c.pool = new Vector3(0, y + hh / 2, FRONT_Z);
      c.delay = k * 0.012;
      y += hh + GAP;
    });
  }

  const geo = new CylinderGeometry(1, 1, 1, 56, 1, false);
  const state = new InstancedBufferAttribute(new Float32Array(coins.length * 2), 2);
  state.setUsage(DynamicDrawUsage);
  geo.setAttribute("aState", state);
  const shared = {
    uTone: { value: new Color(245 / 255, 165 / 255, 36 / 255) },
    uHot: { value: new Color(1, 0.8, 0.46) },
    uCrisp: { value: 1 },
  };
  const mat = new ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { ...shared, uMirror: { value: 0 } } });
  const mirrorMat = new ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { ...shared, uMirror: { value: 1 } }, side: BackSide, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, premultipliedAlpha: true });
  const mesh = new InstancedMesh(geo, mat, coins.length);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const mirror = new InstancedMesh(geo, mirrorMat, coins.length);
  mirror.instanceMatrix = mesh.instanceMatrix;
  mirror.frustumCulled = false;
  mirror.boundingSphere = new Sphere(new Vector3(0, 0, 0), 30);
  mirror.renderOrder = -1;
  scene.add(mirror);
  // The coins move, so the bounds are simply generous.
  mesh.boundingSphere = new Sphere(new Vector3(0, 3, 0), 30);

  // ---- Labels ---------------------------------------------------------------
  const labelEls = PROJECTS.map((p, i) => {
    const b = h("button", "pfx-cost-label");
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", `${p.name}, ${money(p.total)}`);
    const n = h("span", "pfx-cost-label-n", p.short);
    const v = h("span", "pfx-cost-label-v", money(p.total));
    b.append(n, v);
    b.addEventListener("click", () => pick(picked === i ? null : i), { signal });
    labels.append(b);
    return b;
  });
  let poolLabel: HTMLElement | null = h("div", "pfx-cost-pool");
  poolLabel.textContent = "$76.55";
  labels.append(poolLabel);

  // ---- Readout --------------------------------------------------------------
  let focusLine: { p: number; l: number } | null = null;
  const lineCard = (p: number, l: number, cls = "", whose = false) => {
    const line = PROJECTS[p].lines[l];
    const label = whose ? `${PROJECTS[p].short} · ${line.label}` : line.label;
    const c = line.show ? readCard(line.show, label, `is-line ${cls}`) : readCard("The rest", "Of this project", `is-line ${cls}`);
    const why = h("div", "pfx-read-why", line.why);
    c.append(why);
    c.tabIndex = 0;
    const on = () => {
      focusLine = { p, l };
      emit("post:hover", { kind: "coin", id: `${PROJECTS[p].id}/${line.id}`, note: noteOf(`${PROJECTS[p].id}/${line.id}`) });
    };
    const off = () => {
      focusLine = null;
    };
    c.addEventListener("pointerenter", on, { signal });
    c.addEventListener("pointerleave", off, { signal });
    c.addEventListener("focus", on, { signal });
    c.addEventListener("blur", off, { signal });
    return c;
  };
  const refresh = () => {
    read.textContent = "";
    if (mode === "never") {
      const never: Array<{ p: number; l: number; amount: number }> = [];
      PROJECTS.forEach((proj, p) =>
        proj.lines.forEach((line, l) => {
          if (line.kind === "never") never.push({ p, l, amount: line.amount });
        }),
      );
      never.sort((x, y) => y.amount - x.amount).forEach(({ p, l }) => read.append(lineCard(p, l, "", true)));
    } else if (mode === "apps") {
      PROJECTS.forEach((proj, p) =>
        proj.lines.forEach((line) => {
          if (line.kind === "app") {
            read.append(readCard(line.show, proj.short, "is-line is-small"));
          }
        }),
      );
    } else if (picked !== null) {
      PROJECTS[picked].lines.forEach((_, l) => read.append(lineCard(picked as number, l)));
    } else {
      read.append(
        readCard("$131.71", "Six measured projects, October 1 to 28", "is-wide"),
        readCard("$76.55", "Two small Postgres databases, one VM and one warm instance", "is-wide"),
      );
    }
    read.dataset.n = String(read.children.length);
    labelEls.forEach((b, i) => {
      b.classList.toggle("is-on", picked === i && mode === "bill");
      b.setAttribute("aria-pressed", picked === i && mode === "bill" ? "true" : "false");
    });
  };

  function pick(i: number | null) {
    if (mode !== "bill") {
      seg.set("bill", true);
      mode = "bill";
      targetPool = 0;
    }
    picked = i;
    refresh();
    if (i !== null) fig("cost-stacks", `project:${PROJECTS[i].id}`);
  }

  let targetPool = 0;
  function setMode(v: Mode) {
    mode = v;
    picked = null;
    targetPool = v === "never" ? 1 : 0;
    root.dataset.mode = v;
    refresh();
    fig("cost-stacks", `mode:${v}`);
  }
  refresh();

  // ---- Size -----------------------------------------------------------------
  let W = 1;
  let H = 1;
  const target = new Vector3(0, 2.75, 0);
  const resize = () => {
    W = stage.clientWidth || 1;
    H = stage.clientHeight || 1;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const tan = Math.tan((camera.fov / 2) * (Math.PI / 180));
    const needW = (SPACING * (PROJECTS.length - 1) + 2.3) / (2 * tan * camera.aspect);
    const needH = 8.9 / (2 * tan);
    const dist = Math.max(needW, needH);
    camera.position.set(0, 4.9, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    // How many device pixels one coin spans decides how crisp its edge can be.
    const coinPx = ((STEP / (2 * tan * dist)) * H) * dpr;
    shared.uCrisp.value = clamp((coinPx - 1.6) / 2.2);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  // ---- Turning and picking ---------------------------------------------------
  let yaw = 0;
  let yawT = 0;
  let dragging = false;
  let startX = 0;
  let startYaw = 0;
  let moved = 0;
  let hoverCoin = -1;
  const ray = new Raycaster();
  const ndc = new Vector2();
  const hitAt = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(mesh, false);
    return hits.length ? (hits[0].instanceId ?? -1) : -1;
  };
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      dragging = true;
      startX = e.clientX;
      startYaw = yawT;
      moved = 0;
      canvas.setPointerCapture(e.pointerId);
    },
    { signal },
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (dragging) {
        const dx = e.clientX - startX;
        moved = Math.max(moved, Math.abs(dx));
        yawT = clamp(startYaw + dx * 0.006, -0.85, 0.85);
        return;
      }
      if (e.pointerType === "touch") return;
      const id = hitAt(e.clientX, e.clientY);
      if (id === hoverCoin) {
        if (id >= 0) moveTip(e.clientX, e.clientY);
        return;
      }
      hoverCoin = id;
      if (id < 0) {
        tip.hidden = true;
        return;
      }
      const c = coins[id];
      const line = PROJECTS[c.p].lines[c.l];
      tip.textContent = line.show ? `${line.label} · ${line.show}` : line.label;
      tip.hidden = false;
      moveTip(e.clientX, e.clientY);
      emit("post:hover", { kind: "coin", id: `${PROJECTS[c.p].id}/${line.id}`, note: noteOf(`${PROJECTS[c.p].id}/${line.id}`) });
    },
    { passive: true, signal },
  );
  const moveTip = (x: number, y: number) => {
    const r = stage.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const px = clamp(x - r.left - tw / 2, 6, r.width - tw - 6);
    const py = Math.max(6, y - r.top - 38);
    tip.style.transform = `translate3d(${px.toFixed(0)}px, ${py.toFixed(0)}px, 0)`;
  };
  canvas.addEventListener(
    "pointerleave",
    () => {
      hoverCoin = -1;
      tip.hidden = true;
    },
    { passive: true, signal },
  );
  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (moved < 6) {
      const id = hitAt(e.clientX, e.clientY);
      if (id >= 0) pick(picked === coins[id].p && mode === "bill" ? null : coins[id].p);
      else if (mode === "bill") pick(null);
    }
  };
  canvas.addEventListener("pointerup", endDrag, { signal });
  canvas.addEventListener("pointercancel", () => (dragging = false), { signal });

  // ---- Frames ----------------------------------------------------------------
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const pos = new Vector3();
  const proj = new Vector3();
  const qy = new Quaternion();
  const axisY = new Vector3(0, 1, 0);
  const t0 = performance.now();
  let last = t0;
  let poolShown = 0;
  const easeInOut = (v: number) => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2);

  const place = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;
    const sway = still ? 0 : Math.sin(time * 0.22) * 0.07;
    yaw += (yawT + sway - yaw) * (still ? 1 : 0.09);
    qy.setFromAxisAngle(axisY, yaw);

    const hover = hoverCoin >= 0 ? coins[hoverCoin] : null;
    const focus = focusLine || (hover ? { p: hover.p, l: hover.l } : null);
    const arr = state.array as Float32Array;
    coins.forEach((c, i) => {
      const line = PROJECTS[c.p].lines[c.l];
      const never = line.kind === "never";
      const wantPool = mode === "never" && never ? 1 : 0;
      // Each coin leaves on its own beat, and all come home together.
      const rate = dt / 0.85;
      const gate = wantPool && (still ? 1 : poolShown > c.delay) ? 1 : 0;
      c.t = still ? gate : clamp(c.t + (gate ? rate : -rate));
      const e = easeInOut(c.t);
      pos.copy(c.home);
      if (c.pool) {
        pos.lerp(c.pool, e);
        pos.y += Math.sin(Math.PI * e) * 1.6;
      }
      // What is focused slides out toward the viewer.
      const isFocus = focus && focus.p === c.p && focus.l === c.l;
      const wantLift = isFocus ? 1 : 0;
      c.lift += (wantLift - c.lift) * (still ? 1 : 0.16);
      pos.z += c.lift * 0.55;

      let fade = 1;
      let glow = 0;
      if (mode === "never") {
        fade = never ? 1 : 0.1;
        glow = never ? 0.32 : 0;
      } else if (mode === "apps") {
        fade = line.kind === "app" ? 1 : 0.035;
        glow = line.kind === "app" ? 1 : 0;
      } else if (picked !== null) {
        fade = c.p === picked ? 1 : 0.2;
        glow = c.p === picked ? 0.2 : 0;
      }
      if (line.kind === "rest" && mode === "bill") fade *= 0.6;
      if (isFocus) {
        glow = 1;
        fade = 1;
      }
      c.fade += (fade - c.fade) * (still ? 1 : 0.12);
      c.glow += (glow - c.glow) * (still ? 1 : 0.14);

      pos.applyQuaternion(qy);
      q.identity();
      s.set(1, THICK * c.scaleY, 1);
      m.compose(pos, q, s);
      mesh.setMatrixAt(i, m);
      arr[i * 2] = c.glow;
      arr[i * 2 + 1] = c.fade;
    });
    mesh.instanceMatrix.needsUpdate = true;
    state.needsUpdate = true;

    const wantShown = mode === "never" ? 1.2 : 0;
    poolShown = still ? wantShown : clamp(poolShown + (wantShown ? dt * 0.8 : -dt * 3), 0, 1.2);

    // Labels sit under each stack, and follow it as it turns.
    labelEls.forEach((b, i) => {
      proj.set(stackX(i), -0.22, stackZ(i)).applyQuaternion(qy).project(camera);
      const x = (proj.x * 0.5 + 0.5) * W;
      const y = (-proj.y * 0.5 + 0.5) * H;
      b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
    });
    if (poolLabel) {
      const topY = coins.reduce((a, c) => (c.pool ? Math.max(a, c.pool.y) : a), 0);
      proj.set(1.1, topY - 0.3, FRONT_Z).applyQuaternion(qy).project(camera);
      poolLabel.style.transform = `translate3d(${((proj.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-proj.y * 0.5 + 0.5) * H).toFixed(1)}px, 0) translate(8px, -50%)`;
      poolLabel.style.opacity = mode === "never" && poolShown > 0.85 ? "1" : "0";
    }
    renderer.render(scene, camera);
  };

  whileVisible(stage, place, signal);
  // One frame now, so the first look is never empty.
  place(performance.now());

  return () => {
    ro.disconnect();
    geo.dispose();
    mat.dispose();
    mirrorMat.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    poolLabel = null;
  };
};

export default render;
