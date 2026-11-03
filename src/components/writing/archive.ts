// The map of every post, and the list view beside it.
//
// One set of filters drives both: search, kind of work, year, tag, and the
// order. The list is the plain grid; its default view (no filters, newest
// first) leaves out the six case studies, which are on the page above. The
// map always holds every post that matches.
//
// The sky shows every post as a star in its tag's constellation; a
// constellation's cards open in one panel beside it.
//
// Sound hook (nothing here plays audio): on window,
//   writing:hover { kind: "card", id, slug }  the pointer comes onto a card
//   (the sky adds its own star, constellation and dive events below)

import { onPage } from "../../scripts/lifecycle";

type Filters = { kind: string; year: string; tag: string; q: string; sort: string };

const WIDE = "(min-width: 900px) and (prefers-reduced-motion: no-preference)";

export function mountArchive(): void {
  onPage("writing-archive", (signal) => {
    const section = document.querySelector<HTMLElement>(".ax");
    const grid = document.getElementById("ax-grid");
    const mapEl = document.getElementById("ax-map");
    if (!section || !grid || !mapEl) return;

    const slots = Array.from(grid.children) as HTMLElement[];
    const impactNote = document.getElementById("ax-impact-note");
    const empty = document.getElementById("ax-empty");
    const count = document.getElementById("ax-count");
    const qInput = document.getElementById("ax-q") as HTMLInputElement | null;
    const f: Filters = { kind: "all", year: "all", tag: "all", q: "", sort: "date" };

    // Filters hide posts; the search also hides them in the list, and on
    // the sky it lights the stars that match.
    const passFilters = (el: HTMLElement) => {
      const dx = (el.dataset.dx || "").split(" ").filter(Boolean);
      if (f.kind !== "all" && !dx.includes(f.kind)) return false;
      if (f.year !== "all" && el.dataset.year !== f.year) return false;
      if (f.tag !== "all" && el.dataset.tag !== f.tag) return false;
      return true;
    };
    const matches = (el: HTMLElement) => {
      if (!passFilters(el)) return false;
      if (f.q) {
        const hay = el.dataset.q || "";
        if (!f.q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    };

    const press = (btns: HTMLElement[], on: (b: HTMLElement) => boolean) =>
      btns.forEach((b) => {
        const yes = on(b);
        b.classList.toggle("is-on", yes);
        b.setAttribute("aria-pressed", yes ? "true" : "false");
      });

    let map: MapHandle | null = null;

    const apply = () => {
      const isDefault = f.kind === "all" && f.year === "all" && f.tag === "all" && !f.q && f.sort === "date";
      if (impactNote) impactNote.hidden = f.sort !== "impact";

      const sorted = [...slots].sort((a, b) =>
        f.sort === "impact"
          ? parseInt(a.dataset.impact || "999") - parseInt(b.dataset.impact || "999")
          : parseInt(b.dataset.date || "0") - parseInt(a.dataset.date || "0"),
      );
      const shown: HTMLElement[] = [];
      let matching = 0;
      for (const slot of sorted) {
        const ok = matches(slot);
        slot.hidden = !ok || (isDefault && slot.dataset.featured === "1");
        if (ok) matching++;
        if (!slot.hidden) shown.push(slot);
        grid.appendChild(slot);
      }
      // Lanes for the list: the column each card lands in, and how the
      // last row fills so no card is left alone beside a gap.
      const n = shown.length;
      shown.forEach((slot, i) => {
        slot.dataset.col = String(i % 3);
        delete slot.dataset.tail3;
        delete slot.dataset.tail2;
      });
      if (n % 3 === 1) shown[n - 1].dataset.tail3 = "1";
      if (n % 3 === 2) {
        shown[n - 1].dataset.tail3 = "2";
        shown[n - 2].dataset.tail3 = "2";
      }
      if (n % 2 === 1) shown[n - 1].dataset.tail2 = "1";

      if (empty) empty.hidden = matching > 0;
      if (count) count.textContent = matching === 1 ? "1 post" : `${matching} posts`;
      map?.update(passFilters, f.q, f.sort === "impact");
    };

    // Controls
    const group = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
    const kindBtns = group(".ax-kind");
    const yearBtns = group(".ax-year");
    const sortBtns = group(".ax-sort");
    const viewBtns = group(".ax-view");
    const tagBtns = group(".ax-tag");

    const setTag = (tag: string) => {
      f.tag = f.tag === tag && tag !== "all" ? "all" : tag;
      press(tagBtns, (b) => b.dataset.tag === f.tag);
      apply();
    };
    const on = (btns: HTMLElement[], fn: (b: HTMLElement) => void) =>
      btns.forEach((b) => b.addEventListener("click", () => fn(b), { signal }));
    on(kindBtns, (b) => {
      f.kind = b.dataset.kind || "all";
      press(kindBtns, (x) => x === b);
      apply();
    });
    on(yearBtns, (b) => {
      f.year = b.dataset.year || "all";
      press(yearBtns, (x) => x === b);
      apply();
    });
    on(sortBtns, (b) => {
      f.sort = b.dataset.sort || "date";
      press(sortBtns, (x) => x === b);
      apply();
    });
    on(tagBtns, (b) => setTag(b.dataset.tag || "all"));
    let qTimer = 0;
    qInput?.addEventListener(
      "input",
      () => {
        clearTimeout(qTimer);
        qTimer = window.setTimeout(() => {
          f.q = qInput.value.trim().toLowerCase();
          apply();
        }, 90);
      },
      { signal },
    );

    const setView = (v: string) => {
      section.dataset.view = v;
      press(viewBtns, (b) => b.dataset.view === v);
      if (v === "map") {
        map ??= mountMap(mapEl);
        map.update(passFilters, f.q, f.sort === "impact");
        map.show();
      } else {
        map?.hide();
      }
    };
    on(viewBtns, (b) => setView(b.dataset.view || "list"));

    // Wide screens open on the map; phones and reduced motion on the list.
    apply();
    if (matchMedia(WIDE).matches) setView("map");

    // Light under the pointer on list cards and guides, and the hover hook.
    let raf = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;
    section.addEventListener(
      "pointermove",
      (e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>(".ax-card, .ax-guide");
        if (!el) return;
        pending = { el, x: e.clientX, y: e.clientY };
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!pending) return;
          const r = pending.el.getBoundingClientRect();
          pending.el.style.setProperty("--mx", `${pending.x - r.left}px`);
          pending.el.style.setProperty("--my", `${pending.y - r.top}px`);
          pending = null;
        });
      },
      { passive: true, signal },
    );
    section.addEventListener(
      "pointerover",
      (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>(".ax-slot, .ax-c");
        if (!item) return;
        const from = (e.relatedTarget as HTMLElement | null)?.closest(".ax-slot, .ax-c");
        if (from === item) return;
        dispatchEvent(new CustomEvent("writing:hover", { detail: { kind: "card", id: item.dataset.slug, slug: item.dataset.slug } }));
      },
      { passive: true, signal },
    );

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(qTimer);
      map?.stop();
      map = null;
    };
  });
}

// ---------------------------------------------------------------------------
// The sky
//
// Every tag is a constellation drawn on the shape of a real one (Scorpius
// for the largest, the Big Dipper, Orion, Cassiopeia, Crux, Lyra, Cygnus,
// Triangulum), its posts the stars, sized by reading time (or by impact
// when that order is on). The constellations are packed across the sky
// with room for their names. Clicking a name or a star glides the camera
// to that constellation, dims the rest, and opens its cards in one panel
// beside it (a sheet from the bottom on phones). Escape, the close button
// or a click on empty sky goes back.
//
// Sound hooks (window CustomEvents; nothing here plays audio):
//   writing:constellation { id, tag, action: "hover" | "open" | "close" }
//   writing:hover { kind: "star", id, slug, tag, note }  a star under the
//     pointer; note is its place in its constellation, 0 the brightest
//   writing:hover { kind: "card", id, slug }  a card under the pointer
//   writing:transition { kind: "dive", direction: "in" | "out", tag }
// ---------------------------------------------------------------------------

type MapHandle = {
  update: (pass: (el: HTMLElement) => boolean, query: string, impact: boolean) => void;
  show: () => void;
  hide: () => void;
  stop: () => void;
};

type Shape = { pts: Array<[number, number]>; edges: Array<[number, number]>; aspect: number };

// Points in a unit box, ordered so any first few still make a shape.
const SHAPES: Record<string, Shape> = {
  scorpius: {
    aspect: 0.95,
    pts: [[0.1, 0.08], [0.18, 0.2], [0.04, 0.3], [0.26, 0.3], [0.34, 0.38], [0.4, 0.47], [0.43, 0.57], [0.45, 0.67], [0.48, 0.77], [0.54, 0.85], [0.62, 0.91], [0.72, 0.93], [0.8, 0.88], [0.86, 0.8], [0.82, 0.71], [0.22, 0.09]],
    edges: [[0, 1], [2, 1], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [15, 3]],
  },
  orion: {
    aspect: 0.8,
    pts: [[0.2, 0.12], [0.78, 0.18], [0.42, 0.5], [0.5, 0.52], [0.58, 0.54], [0.26, 0.95], [0.8, 0.9], [0.5, 0.0], [0.5, 0.7], [0.94, 0.32]],
    edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [7, 1], [3, 8], [1, 9]],
  },
  dipper: {
    aspect: 1.7,
    pts: [[0.92, 0.28], [0.88, 0.66], [0.58, 0.72], [0.54, 0.4], [0.37, 0.28], [0.2, 0.2], [0.03, 0.32]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  cygnus: {
    aspect: 1.0,
    pts: [[0.5, 0.0], [0.5, 0.38], [0.5, 1.0], [0.06, 0.22], [0.94, 0.5], [0.5, 0.68]],
    edges: [[0, 1], [1, 5], [5, 2], [3, 1], [1, 4]],
  },
  cassiopeia: {
    aspect: 1.7,
    pts: [[0.0, 0.3], [0.25, 0.82], [0.5, 0.42], [0.75, 0.92], [1.0, 0.22]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  crux: {
    aspect: 0.8,
    pts: [[0.5, 0.0], [0.5, 1.0], [0.1, 0.42], [0.9, 0.56]],
    edges: [[0, 1], [2, 3]],
  },
  lyra: {
    aspect: 0.75,
    pts: [[0.18, 0.0], [0.4, 0.32], [0.78, 0.42], [0.64, 0.94], [0.28, 0.82]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
  },
  triangulum: {
    aspect: 1.25,
    pts: [[0.0, 0.78], [0.55, 0.0], [1.0, 0.64]],
    edges: [[0, 1], [1, 2], [2, 0]],
  },
  single: { aspect: 1, pts: [[0.5, 0.5]], edges: [] },
};

const shapeFor = (n: number, k: number): Shape => {
  if (n >= 11) return SHAPES.scorpius;
  if (n >= 8) return SHAPES.orion;
  if (n === 7) return SHAPES.dipper;
  if (n === 6) return SHAPES.cygnus;
  if (n === 5) return SHAPES.cassiopeia;
  if (n === 4) return k % 2 ? SHAPES.lyra : SHAPES.crux;
  if (n === 3) return SHAPES.triangulum;
  if (n === 2) return SHAPES.lyra;
  return SHAPES.single;
};

type Star = {
  el: HTMLElement;
  slug: string;
  tag: string;
  title: string;
  minutes: number;
  impact: number;
  date: number;
  on: boolean;
  match: boolean;
  x: number;
  y: number;
  note: number;
  lx: number;
  ly: number;
};

type Group = {
  tag: string;
  stars: Star[];
  name: HTMLButtonElement;
  line: SVGPathElement | null;
  draw: SVGPathElement | null;
  edges: Array<[Star, Star]>;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

function mountMap(mapEl: HTMLElement): MapHandle {
  const ac = new AbortController();
  const signal = ac.signal;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phoneMq = matchMedia("(max-width: 899px)");
  const world = mapEl.querySelector<HTMLElement>(".ax-world")!;
  const canvas = mapEl.querySelector<HTMLCanvasElement>(".ax-sky");
  const tip = mapEl.querySelector<HTMLElement>(".ax-tip")!;
  const panel = mapEl.querySelector<HTMLElement>(".ax-panel")!;
  const panelTitle = panel.querySelector<HTMLElement>(".ax-panel-title")!;
  const panelCount = panel.querySelector<HTMLElement>(".ax-panel-count")!;
  const list = panel.querySelector<HTMLElement>(".ax-cards")!;
  const cards = Array.from(list.querySelectorAll<HTMLElement>(".ax-c"));
  const pager = panel.querySelector<HTMLElement>(".ax-pager")!;
  const pagerStatus = panel.querySelector<HTMLElement>(".ax-pager-status")!;
  const pageBtns = Array.from(panel.querySelectorAll<HTMLButtonElement>(".ax-page"));
  const closeBtn = panel.querySelector<HTMLButtonElement>(".ax-close")!;
  const dome = mapEl.querySelector<HTMLElement>(".ax-dome")!;
  const par = mapEl.querySelector<HTMLElement>(".ax-par")!;
  const emit = (name: string, detail: Record<string, unknown>) => dispatchEvent(new CustomEvent(name, { detail }));

  const stars: Star[] = Array.from(mapEl.querySelectorAll<HTMLElement>(".ax-s")).map((el) => ({
    el,
    slug: el.dataset.slug || "",
    tag: el.dataset.tag || "",
    title: el.dataset.title || "",
    minutes: parseInt(el.dataset.minutes || "5"),
    impact: parseInt(el.dataset.impact || "500"),
    date: parseInt(el.dataset.date || "0"),
    on: true,
    match: true,
    x: 0,
    y: 0,
    note: 0,
    lx: 0,
    ly: 0,
  }));
  const groups: Group[] = Array.from(mapEl.querySelectorAll<HTMLButtonElement>(".ax-name")).map((name) => ({
    tag: name.dataset.tag || "",
    stars: stars.filter((s) => s.tag === name.dataset.tag),
    name,
    line: mapEl.querySelector<SVGPathElement>(`.ax-line[data-tag="${CSS.escape(name.dataset.tag || "")}"]`),
    draw: mapEl.querySelector<SVGPathElement>(`.ax-line-draw[data-tag="${CSS.escape(name.dataset.tag || "")}"]`),
    edges: [],
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
  }));

  let W = 1;
  let H = 1;
  let impactMode = false;
  let query = "";
  let shown = false;
  let laidOut = false;
  let openGroup: Group | null = null;
  let page = 0;
  let phone = phoneMq.matches;

  // ---- The backdrop: faint stars and the Milky Way, drawn once a size ----
  // Drawn once a size into a canvas of its own, then copied to the visible
  // one each frame with the far parallax and any shooting star on top.
  const bg = document.createElement("canvas");
  let CW = 1;
  let CH = 1;
  let DPR = 1;
  const drawSky = () => {
    if (!canvas) return;
    DPR = Math.min(devicePixelRatio || 1, 1.5);
    CW = canvas.clientWidth || W * 1.08;
    CH = canvas.clientHeight || H * 1.08;
    canvas.width = Math.round(CW * DPR);
    canvas.height = Math.round(CH * DPR);
    bg.width = canvas.width;
    bg.height = canvas.height;
    const ctx = bg.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    const W = CW;
    const H = CH;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // The band runs corner to corner, low left to high right.
    const ax = -W * 0.05;
    const ay = H * 0.92;
    const bx = W * 1.05;
    const by = H * 0.08;
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const nx = -uy;
    const ny = ux;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const t = rnd();
      const off = (rnd() - 0.5) * H * 0.16;
      const x = ax + ux * len * t + nx * off;
      const y = ay + uy * len * t + ny * off;
      const r = H * (0.12 + rnd() * 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const warm = rnd() < 0.4;
      g.addColorStop(0, warm ? "rgba(255,226,196,0.05)" : "rgba(190,205,255,0.055)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Dust: many tiny points packed along the band.
    for (let i = 0; i < Math.round((W * H) / 900); i++) {
      const t = rnd();
      const off = (rnd() + rnd() + rnd() - 1.5) * H * 0.14;
      const x = ax + ux * len * t + nx * off;
      const y = ay + uy * len * t + ny * off;
      const a = 0.05 + rnd() * 0.22;
      ctx.fillStyle = `rgba(225,232,255,${a.toFixed(3)})`;
      const s = rnd() < 0.92 ? 0.7 : 1.3;
      ctx.fillRect(x, y, s, s);
    }
    // A dark lane down the middle of the band.
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 14; i++) {
      const t = 0.1 + rnd() * 0.8;
      const off = (rnd() - 0.5) * H * 0.04;
      const x = ax + ux * len * t + nx * off;
      const y = ay + uy * len * t + ny * off;
      const r = H * (0.05 + rnd() * 0.06);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(2,4,10,0.45)");
      g.addColorStop(1, "rgba(2,4,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Faint stars over the whole sky.
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < Math.round((W * H) / 2600); i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const big = rnd() < 0.06;
      const a = big ? 0.5 + rnd() * 0.4 : 0.12 + rnd() * 0.35;
      ctx.fillStyle = `rgba(235,240,255,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, big ? 1.1 : 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    paint(0, 0, performance.now());
  };

  // ---- The visible sky: the backdrop, shifted, and shooting stars ---------
  type Shot = { x: number; y: number; vx: number; vy: number; life: number; max: number };
  const shots: Shot[] = [];
  let nextShot = performance.now() + 2500;
  let lastPaint = performance.now();
  const paint = (ox: number, oy: number, now: number) => {
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dt = Math.min(50, now - lastPaint) / 16.67;
    lastPaint = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg, Math.round(ox * DPR), Math.round(oy * DPR));
    if (reduce) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (now > nextShot) {
      nextShot = now + 4000 + Math.random() * 5000;
      const fromLeft = Math.random() < 0.5;
      const a = (fromLeft ? 0.35 : Math.PI - 0.35) + (Math.random() - 0.5) * 0.3;
      const sp = 9 + Math.random() * 5;
      shots.push({
        x: CW * (fromLeft ? 0.1 + Math.random() * 0.4 : 0.5 + Math.random() * 0.4),
        y: CH * (0.08 + Math.random() * 0.3),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: 55 + Math.random() * 20,
      });
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = shots.length - 1; i >= 0; i--) {
      const sh = shots[i];
      sh.life += dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      const p = sh.life / sh.max;
      if (p >= 1) {
        shots.splice(i, 1);
        continue;
      }
      const fade = Math.sin(p * Math.PI);
      const tx = sh.x - sh.vx * 11;
      const ty = sh.y - sh.vy * 11;
      const g = ctx.createLinearGradient(tx, ty, sh.x, sh.y);
      g.addColorStop(0, "rgba(220,230,255,0)");
      g.addColorStop(1, `rgba(240,245,255,${(0.8 * fade).toFixed(3)})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(sh.x, sh.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  // ---- Layout -------------------------------------------------------------

  const layout = () => {
    phone = phoneMq.matches;
    W = mapEl.clientWidth || 1;
    H = mapEl.clientHeight || 1;
    const m = phone ? { t: 84, b: 64, l: 18, r: 18 } : { t: 110, b: 64, l: 90, r: 90 };
    const availW = W - m.l - m.r;
    const availH = H - m.t - m.b;
    const base = phone ? Math.min(W * 0.1, 46) : Math.min(availW / 15, availH / 9.5, 86);
    const live = groups.filter((g) => g.stars.some((s) => s.on));
    // Sizes first, then pack: largest first, on a spiral from the middle.
    type Item = { g: Group; shape: Shape; w: number; h: number; r: number; x: number; y: number; vis: Star[] };
    let k4 = 0;
    const items: Item[] = live
      .map((g) => {
        const vis = g.stars.filter((s) => s.on).sort((a, b) => a.impact - b.impact || b.date - a.date);
        const n = vis.length;
        const shape = shapeFor(n, n === 4 ? k4++ : 0);
        const size = n === 1 ? 0 : base * Math.sqrt(n) * 0.95;
        const w = n === 1 ? 0 : size * Math.sqrt(shape.aspect);
        const h = n === 1 ? 0 : size / Math.sqrt(shape.aspect);
        const nameW = g.name.offsetWidth || 110;
        const r = Math.max(Math.hypot(w, h) / 2, nameW / 2) + 30;
        return { g, shape, w, h, r, x: 0, y: 0, vis };
      })
      .sort((a, b) => b.r - a.r);
    const ratio = availW / availH;
    const placed: Item[] = [];
    for (const it of items) {
      let best: { x: number; y: number } | null = null;
      for (let rr = 0; rr < 4000 && !best; rr += 8) {
        const tries = rr === 0 ? 1 : Math.max(12, Math.round(rr / 6));
        const turn = hash(it.g.tag) * Math.PI * 2;
        for (let j = 0; j < tries; j++) {
          const a = turn + (j / tries) * Math.PI * 2;
          const x = Math.cos(a) * rr * Math.sqrt(ratio);
          const y = Math.sin(a) * rr / Math.sqrt(ratio);
          if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + it.r + 8)) {
            best = { x, y };
            break;
          }
        }
      }
      it.x = best?.x || 0;
      it.y = best?.y || 0;
      placed.push(it);
    }
    // Spread the packed figure to fill the sky, centred.
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const p of placed) {
      bx0 = Math.min(bx0, p.x - p.r);
      by0 = Math.min(by0, p.y - p.r);
      bx1 = Math.max(bx1, p.x + p.r);
      by1 = Math.max(by1, p.y + p.r);
    }
    const spreadX = Math.max(1, availW / Math.max(1, bx1 - bx0));
    const spreadY = Math.max(1, availH / Math.max(1, by1 - by0));
    const shrink = Math.min(1, availW / Math.max(1, bx1 - bx0), availH / Math.max(1, by1 - by0));
    const cxW = m.l + availW / 2;
    const cyW = m.t + availH / 2;
    const midX = (bx0 + bx1) / 2;
    const midY = (by0 + by1) / 2;
    for (const it of placed) {
      const cx = cxW + (it.x - midX) * Math.min(spreadX, 1.6) * shrink;
      const cy = cyW + (it.y - midY) * Math.min(spreadY, 1.6) * shrink;
      const w = it.w * shrink;
      const h = it.h * shrink;
      const rot = (hash(it.g.tag + "r") - 0.5) * 0.6;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      it.vis.forEach((s, i) => {
        s.note = i;
        const p = it.shape.pts[i] || [0.5 + Math.cos(i * 2.4) * 0.45 * (i / it.vis.length), 0.5 + Math.sin(i * 2.4) * 0.45 * (i / it.vis.length)];
        const lx = (p[0] - 0.5) * w;
        const ly = (p[1] - 0.5) * h;
        s.x = cx + lx * cos - ly * sin;
        s.y = cy - 14 + lx * sin + ly * cos;
      });
      const g = it.g;
      g.edges = it.shape.edges
        .filter(([a, b]) => a < it.vis.length && b < it.vis.length)
        .map(([a, b]) => [it.vis[a], it.vis[b]] as [Star, Star]);
      g.x0 = Math.min(...it.vis.map((s) => s.x));
      g.x1 = Math.max(...it.vis.map((s) => s.x));
      g.y0 = Math.min(...it.vis.map((s) => s.y));
      g.y1 = Math.max(...it.vis.map((s) => s.y));
    }
    write();
    drawSky();
    laidOut = true;
  };

  const place = (s: Star) => {
    s.el.style.transform = `translate3d(${(s.x + s.lx).toFixed(1)}px, ${(s.y + s.ly).toFixed(1)}px, 0)`;
  };
  const radius = (s: Star) =>
    impactMode ? 3 + Math.max(0, 1 - s.impact / 40) * 6 : 2.6 + Math.min(10, s.minutes) * 0.62;

  const write = () => {
    for (const s of stars) {
      place(s);
      s.el.style.setProperty("--r", `${radius(s).toFixed(1)}px`);
      s.el.style.setProperty("--tw", `${(2.6 + hash(s.slug) * 3).toFixed(2)}s`);
      s.el.style.setProperty("--td", `${(-hash(s.slug + "d") * 4).toFixed(2)}s`);
      s.el.classList.toggle("is-out", !s.on);
      s.el.classList.toggle("is-match", !!query && s.on && s.match);
      s.el.classList.toggle("is-faint", !!query && s.on && !s.match);
    }
    for (const g of groups) {
      const n = g.stars.filter((s) => s.on).length;
      g.name.classList.toggle("is-out", n === 0);
      const num = g.name.querySelector(".ax-name-n");
      if (num) num.textContent = `${n} ${n === 1 ? "post" : "posts"}`;
      g.name.setAttribute("aria-label", `${g.tag}, ${n} ${n === 1 ? "post" : "posts"}. Open this constellation`);
      if (n === 0) continue;
      // The name sits under its stars.
      const nw = g.name.offsetWidth || 100;
      const x = Math.max(8, Math.min(W - nw - 8, (g.x0 + g.x1) / 2 - nw / 2));
      g.name.style.transform = `translate3d(${x.toFixed(1)}px, ${(g.y1 + 16).toFixed(1)}px, 0)`;
      const d = g.edges.map(([a, b]) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`).join("");
      g.line?.setAttribute("d", d);
      g.draw?.setAttribute("d", d);
    }
  };

  // ---- Hover --------------------------------------------------------------

  const groupOf = (tag: string) => groups.find((g) => g.tag === tag) || null;
  let hotGroup: Group | null = null;
  // One hover event per visit to a constellation, not one per star.
  let lastHover = { tag: "", at: 0 };
  const hot = (g: Group | null) => {
    if (g && g !== hotGroup && !openGroup) {
      const now = performance.now();
      if (g.tag !== lastHover.tag || now - lastHover.at > 1200) {
        emit("writing:constellation", { id: g.tag, tag: g.tag, action: "hover" });
      }
      lastHover = { tag: g.tag, at: now };
    }
    hotGroup = g;
    for (const x of groups) {
      const on = x === g;
      x.draw?.classList.toggle("is-on", on);
      x.line?.classList.toggle("is-hot", on);
      x.name.classList.toggle("is-hot", on);
      x.stars.forEach((s) => s.el.classList.toggle("is-hot", on));
    }
  };
  const showTip = (s: Star) => {
    tip.textContent = s.title;
    tip.hidden = false;
    const r = s.el.getBoundingClientRect();
    const mr = mapEl.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const x = Math.max(8, Math.min(W - tw - 8, r.left - mr.left + r.width / 2 - tw / 2));
    const y = r.top - mr.top - th - 6 < 8 ? r.bottom - mr.top + 6 : r.top - mr.top - th - 6;
    tip.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  };
  const starOf = (t: EventTarget | null) => {
    const el = (t as HTMLElement | null)?.closest?.(".ax-s");
    return el ? stars.find((s) => s.el === el) || null : null;
  };
  mapEl.addEventListener(
    "pointerover",
    (e) => {
      if ((e as PointerEvent).pointerType === "touch") return;
      const s = starOf(e.target);
      if (s && s.on) {
        showTip(s);
        emit("writing:hover", { kind: "star", id: s.slug, slug: s.slug, tag: s.tag, note: s.note });
        if (!openGroup) hot(groupOf(s.tag));
        return;
      }
      const name = (e.target as HTMLElement).closest<HTMLElement>(".ax-name");
      if (name && !openGroup) hot(groupOf(name.dataset.tag || ""));
    },
    { signal },
  );
  mapEl.addEventListener(
    "pointerout",
    (e) => {
      const from = starOf(e.target) || (e.target as HTMLElement).closest?.(".ax-name");
      if (!from) return;
      const to = e.relatedTarget as HTMLElement | null;
      if (to && (to === from || (from as HTMLElement).contains?.(to))) return;
      tip.hidden = true;
      if (!openGroup) hot(null);
    },
    { signal },
  );

  // ---- Open a constellation -----------------------------------------------

  const visibleCards = (g: Group) => {
    let set = g.stars.filter((s) => s.on && (!query || s.match));
    if (!set.length) set = g.stars.filter((s) => s.on);
    set.sort((a, b) => (impactMode ? a.impact - b.impact : b.date - a.date));
    return set;
  };
  const PAGE = 6;
  const colsFor = (n: number) => (n <= 1 ? 1 : n === 2 || n === 4 ? 2 : 3);
  const renderPage = () => {
    if (!openGroup) return;
    const set = visibleCards(openGroup);
    const pages = phone ? 1 : Math.max(1, Math.ceil(set.length / PAGE));
    page = Math.max(0, Math.min(page, pages - 1));
    const slice = phone ? set : set.slice(page * PAGE, page * PAGE + PAGE);
    const want = new Map(slice.map((s, i) => [s.slug, i]));
    for (const c of cards) {
      const i = want.get(c.dataset.slug || "");
      c.hidden = i === undefined;
      if (i !== undefined) {
        c.style.setProperty("--k", String(i));
        list.appendChild(c);
      }
    }
    // Keep the order of the slice.
    slice.forEach((s) => {
      const c = cards.find((x) => x.dataset.slug === s.slug);
      if (c) list.appendChild(c);
    });
    list.style.setProperty("--cols", String(phone ? 1 : colsFor(slice.length)));
    list.scrollTop = 0;
    pager.hidden = phone || pages <= 1;
    const from = page * PAGE + 1;
    const to = page * PAGE + slice.length;
    pagerStatus.textContent = pages > 1 ? `${from} to ${to} of ${set.length}` : "";
    pageBtns[0].disabled = page === 0;
    pageBtns[1].disabled = page >= pages - 1;
    panelCount.textContent = `${set.length} ${set.length === 1 ? "post" : "posts"}`;
  };

  // Where the camera lands: world = translate(ox, oy) scale(k).
  let cam = { k: 1, ox: 0, oy: 0 };
  const glideTo = (g: Group | null) => {
    if (!g) {
      world.style.transform = "";
      cam = { k: 1, ox: 0, oy: 0 };
      return;
    }
    const gw = Math.max(60, g.x1 - g.x0);
    const gh = Math.max(60, g.y1 - g.y0 + 50);
    const cx = (g.x0 + g.x1) / 2;
    const cy = (g.y0 + g.y1) / 2 + 20;
    let k: number;
    let tx: number;
    let ty: number;
    if (phone) {
      k = Math.min(1.8, (W * 0.7) / gw, (H * 0.26) / gh);
      tx = W / 2;
      ty = H * 0.22;
    } else {
      const panelW = panel.offsetWidth || W * 0.6;
      const room = W - panelW - 60;
      k = Math.max(1, Math.min(1.7, (room * 0.7) / gw, (H * 0.55) / gh));
      tx = Math.max(room / 2 + 10, 160);
      ty = H * 0.5;
    }
    cam = { k, ox: tx - cx * k, oy: ty - cy * k };
    world.style.transform = `translate3d(${cam.ox.toFixed(1)}px, ${cam.oy.toFixed(1)}px, 0) scale(${k.toFixed(3)})`;
  };

  // Cards fly out of their stars: from the star's place after the dive,
  // turned away in depth and small, to their place in the panel.
  const starAt = (slug: string) => {
    const st = stars.find((x) => x.slug === slug);
    if (!st) return null;
    const mr = mapEl.getBoundingClientRect();
    return { x: mr.left + cam.ox + st.x * cam.k, y: mr.top + cam.oy + st.y * cam.k };
  };
  const flyOut = (delay: number) => {
    if (reduce) return;
    const shownCards = Array.from(list.querySelectorAll<HTMLElement>(".ax-c:not([hidden])"));
    shownCards.forEach((c, i) => {
      c.getAnimations().forEach((a) => a.cancel());
      const a = starAt(c.dataset.slug || "");
      const r = c.getBoundingClientRect();
      const fx = a ? a.x - (r.left + r.width / 2) : 0;
      const fy = a ? a.y - (r.top + r.height / 2) : 80;
      c.animate(
        [
          { transform: `translate3d(${fx.toFixed(0)}px, ${fy.toFixed(0)}px, -260px) rotateX(55deg) rotateY(-28deg) scale(0.12)`, opacity: 0 },
          { transform: `translate3d(${(fx * 0.12).toFixed(0)}px, ${(fy * 0.12).toFixed(0)}px, 40px) rotateX(-7deg) rotateY(5deg) scale(1.02)`, opacity: 1, offset: 0.72 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 950, delay: delay + i * 85, easing: "cubic-bezier(0.2, 0.75, 0.2, 1)", fill: "both" },
      );
    });
  };
  const flyBack = () => {
    // On a phone the sheet slides away with its cards.
    if (reduce || phone) return phone && !reduce ? 380 : 0;
    const shownCards = Array.from(list.querySelectorAll<HTMLElement>(".ax-c:not([hidden])"));
    shownCards.forEach((c, i) => {
      c.getAnimations().forEach((a) => a.cancel());
      const a = starAt(c.dataset.slug || "");
      const r = c.getBoundingClientRect();
      const fx = a ? a.x - (r.left + r.width / 2) : 0;
      const fy = a ? a.y - (r.top + r.height / 2) : 80;
      c.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translate3d(${fx.toFixed(0)}px, ${fy.toFixed(0)}px, -220px) rotateX(45deg) rotateY(-20deg) scale(0.12)`, opacity: 0 },
        ],
        { duration: 460, delay: (shownCards.length - 1 - i) * 45, easing: "cubic-bezier(0.6, 0, 0.8, 0.4)", fill: "both" },
      );
    });
    return 460 + shownCards.length * 45;
  };

  const open = (g: Group, from?: HTMLElement) => {
    if (!g.stars.some((s) => s.on)) return;
    const same = openGroup === g;
    openGroup = g;
    page = 0;
    mapEl.dataset.state = "open";
    tip.hidden = true;
    for (const x of groups) {
      const dimmed = x !== g;
      x.name.classList.toggle("is-dim", dimmed);
      x.line?.classList.toggle("is-dim", dimmed);
      x.stars.forEach((s) => s.el.classList.toggle("is-dim", dimmed));
      x.name.setAttribute("aria-expanded", x === g ? "true" : "false");
    }
    hot(g);
    panel.style.setProperty("--tint", g.name.style.getPropertyValue("--tint"));
    panel.style.removeProperty("--drag");
    panelTitle.textContent = g.tag;
    renderPage();
    panel.hidden = false;
    if (!same) {
      emit("writing:transition", { kind: "dive", direction: "in", tag: g.tag });
      emit("writing:constellation", { id: g.tag, tag: g.tag, action: "open" });
    }
    // Cards wait for the camera to set off, then fly out of their stars.
    glideTo(g);
    flyOut(phone ? 120 : 260);
    requestAnimationFrame(() => panel.classList.add("is-in"));
    returnTo = from || g.name;
    panelTitle.focus({ preventScroll: true });
    // Bring the whole sky into view on wide screens.
    const r = mapEl.getBoundingClientRect();
    if (!phone && (r.top < -40 || r.bottom > innerHeight + 40)) {
      scrollTo({ top: r.top + scrollY - 10, behavior: reduce ? "auto" : "smooth" });
    }
  };
  let returnTo: HTMLElement | null = null;
  const close = () => {
    if (!openGroup) return;
    const g = openGroup;
    openGroup = null;
    emit("writing:transition", { kind: "dive", direction: "out", tag: g.tag });
    emit("writing:constellation", { id: g.tag, tag: g.tag, action: "close" });
    const back = flyBack();
    mapEl.dataset.state = "sky";
    window.setTimeout(() => {
      if (!openGroup) panel.classList.remove("is-in");
    }, Math.max(0, back - 250));
    for (const x of groups) {
      x.name.classList.remove("is-dim");
      x.line?.classList.remove("is-dim");
      x.stars.forEach((s) => s.el.classList.remove("is-dim"));
      x.name.setAttribute("aria-expanded", "false");
    }
    hot(null);
    glideTo(null);
    window.setTimeout(() => {
      if (openGroup) return;
      panel.hidden = true;
      list.querySelectorAll<HTMLElement>(".ax-c").forEach((c) => c.getAnimations().forEach((a) => a.cancel()));
    }, reduce ? 0 : back + 200);
    returnTo?.focus({ preventScroll: true });
  };

  groups.forEach((g) => g.name.addEventListener("click", () => (openGroup === g ? close() : open(g, g.name)), { signal }));
  mapEl.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest(".ax-panel, .ax-name")) return;
      const s = starOf(t);
      if (s && s.on) {
        const g = groupOf(s.tag);
        if (g) open(g);
        return;
      }
      // Empty sky goes back.
      close();
    },
    { signal },
  );
  closeBtn.addEventListener("click", close, { signal });
  pageBtns.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        page += parseInt(b.dataset.dir || "1");
        renderPage();
        flyOut(0);
      },
      { signal },
    ),
  );
  addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && openGroup) {
        e.preventDefault();
        close();
      }
    },
    { signal },
  );

  // Cards lean toward the pointer and catch a glare.
  list.addEventListener(
    "pointermove",
    (e) => {
      if (reduce || (e as PointerEvent).pointerType === "touch") return;
      const link = (e.target as HTMLElement).closest<HTMLElement>(".ax-c-link");
      if (!link) return;
      const r = link.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width;
      const v = (e.clientY - r.top) / r.height;
      link.style.setProperty("--try", `${((u - 0.5) * 10).toFixed(2)}deg`);
      link.style.setProperty("--trx", `${((0.5 - v) * 8).toFixed(2)}deg`);
      link.style.setProperty("--gx", `${(u * 100).toFixed(1)}%`);
      link.style.setProperty("--gy", `${(v * 100).toFixed(1)}%`);
    },
    { passive: true, signal },
  );
  list.addEventListener(
    "pointerout",
    (e) => {
      const link = (e.target as HTMLElement).closest<HTMLElement>(".ax-c-link");
      if (!link || link.contains(e.relatedTarget as Node)) return;
      link.style.removeProperty("--try");
      link.style.removeProperty("--trx");
    },
    { signal },
  );

  // Phones: drag the sheet down by its head to close it.
  const head = panel.querySelector<HTMLElement>(".ax-panel-head");
  let dragY: number | null = null;
  let dragD = 0;
  head?.addEventListener(
    "pointerdown",
    (e) => {
      if (!phone || (e.target as HTMLElement).closest("button")) return;
      dragY = e.clientY;
      dragD = 0;
      panel.classList.add("is-dragging");
      head.setPointerCapture(e.pointerId);
    },
    { signal },
  );
  head?.addEventListener(
    "pointermove",
    (e) => {
      if (dragY === null) return;
      dragD = Math.max(0, e.clientY - dragY);
      panel.style.setProperty("--drag", `${dragD}px`);
    },
    { signal },
  );
  const endDrag = () => {
    if (dragY === null) return;
    dragY = null;
    panel.classList.remove("is-dragging");
    if (dragD > 110) close();
    else panel.style.setProperty("--drag", "0px");
  };
  head?.addEventListener("pointerup", endDrag, { signal });
  head?.addEventListener("pointercancel", endDrag, { signal });

  // ---- Motion: the dome tilts, the layers part, stars lean ----------------
  let ptx = 0;
  let pty = 0;
  let psx = 0;
  let psy = 0;
  let mx = -1e4;
  let my = -1e4;
  mapEl.addEventListener(
    "pointermove",
    (e) => {
      const r = mapEl.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      ptx = (mx / Math.max(1, r.width)) * 2 - 1;
      pty = (my / Math.max(1, r.height)) * 2 - 1;
    },
    { passive: true, signal },
  );
  mapEl.addEventListener(
    "pointerleave",
    () => {
      ptx = 0;
      pty = 0;
      mx = -1e4;
      my = -1e4;
    },
    { signal },
  );
  let loopRaf = 0;
  let looping = false;
  let onScreen = false;
  const born = performance.now();
  const loop = (now: number) => {
    loopRaf = requestAnimationFrame(loop);
    const t = (now - born) / 1000;
    const r = mapEl.getBoundingClientRect();
    psx += (ptx - psx) * 0.05;
    psy += (pty - psy) * 0.05;
    const free = openGroup ? 0 : 1;
    const sf = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
    const rx = (sf * 6 - psy * 3 + Math.sin(t * 0.11) * 0.6) * free;
    const ry = (psx * 4 + Math.cos(t * 0.09) * 0.6) * free;
    dome.style.setProperty("--rx", `${rx.toFixed(3)}deg`);
    dome.style.setProperty("--ry", `${ry.toFixed(3)}deg`);
    const px = (-psx * 16 + Math.sin(t * 0.07) * 6) * free;
    const py = (-psy * 10 + Math.cos(t * 0.05) * 4) * free;
    par.style.setProperty("--px", `${px.toFixed(2)}px`);
    par.style.setProperty("--py", `${py.toFixed(2)}px`);
    paint(-psx * 6 - CW * 0.0, -psy * 4, now);
    // Stars near the pointer lean toward it.
    for (const s of stars) {
      let lx = 0;
      let ly = 0;
      if (!openGroup && s.on) {
        const dx = mx - (s.x + px);
        const dy = my - (s.y + py);
        const d = Math.hypot(dx, dy);
        if (d < 150 && d > 0.5) {
          const f = Math.pow(1 - d / 150, 2) * 9;
          lx = (dx / d) * f;
          ly = (dy / d) * f;
        }
      }
      if (Math.abs(lx - s.lx) > 0.05 || Math.abs(ly - s.ly) > 0.05) {
        s.lx += (lx - s.lx) * 0.25;
        s.ly += (ly - s.ly) * 0.25;
        place(s);
      }
    }
  };
  const run = () => {
    const want = shown && onScreen && !document.hidden && !reduce;
    if (want && !looping) {
      looping = true;
      loopRaf = requestAnimationFrame(loop);
    } else if (!want && looping) {
      looping = false;
      cancelAnimationFrame(loopRaf);
    }
  };
  const io = new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    run();
  });
  io.observe(mapEl);
  document.addEventListener("visibilitychange", run, { signal });

  const ro = new ResizeObserver(() => {
    if (!shown) return;
    if (Math.abs(mapEl.clientWidth - W) < 1 && Math.abs(mapEl.clientHeight - H) < 1) return;
    layout();
    if (openGroup) {
      renderPage();
      glideTo(openGroup);
    }
  });
  ro.observe(mapEl);

  return {
    update(pass, q, impact) {
      impactMode = impact;
      query = q;
      for (const s of stars) {
        s.on = pass(s.el);
        s.match = !q || q.split(/\s+/).every((w) => (s.el.dataset.q || "").includes(w));
      }
      if (!shown) return;
      layout();
      if (openGroup) {
        if (!openGroup.stars.some((s) => s.on)) close();
        else {
          renderPage();
          glideTo(openGroup);
        }
      }
    },
    show() {
      shown = true;
      requestAnimationFrame(() => {
        if (!shown) return;
        layout();
        mapEl.classList.add("is-live");
        run();
      });
    },
    hide() {
      shown = false;
      close();
      run();
    },
    stop() {
      ac.abort();
      ro.disconnect();
      io.disconnect();
      looping = false;
      cancelAnimationFrame(loopRaf);
      void laidOut;
    },
  };
}
