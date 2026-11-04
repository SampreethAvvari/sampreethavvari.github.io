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

const MOTION = "(prefers-reduced-motion: no-preference)";

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
      const label = matching === 1 ? "1 post" : `${matching} posts`;
      if (count) count.textContent = label;
      const fcount = document.getElementById("ax-fcount");
      if (fcount) fcount.textContent = label;
      const done = section.querySelector(".ax-fsheet-done");
      if (done) done.textContent = matching === 0 ? "No posts match" : `Show ${label}`;
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
    on(viewBtns, (b) => {
      setView(b.dataset.view || "list");
      // Both views start at the top of this section.
      scrollTo({ top: section.getBoundingClientRect().top + scrollY, behavior: "auto" });
    });

    // The sky first; with reduced motion the list first.
    apply();
    if (matchMedia(MOTION).matches) setView("map");

    // Phones: the controls live in a sheet behind one pill.
    const pill = section.querySelector<HTMLElement>(".ax-fpill");
    const sheet = document.getElementById("ax-fsheet");
    const scrim = section.querySelector<HTMLElement>(".ax-fscrim");
    const sheetX = section.querySelector<HTMLElement>(".ax-fsheet-x");
    const sheetDone = section.querySelector<HTMLElement>(".ax-fsheet-done");
    let sheetOpen = false;
    const setSheet = (open: boolean) => {
      if (open === sheetOpen) return;
      sheetOpen = open;
      sheet?.classList.toggle("is-open", open);
      scrim?.classList.toggle("is-open", open);
      section.classList.toggle("is-sheet", open);
      pill?.setAttribute("aria-expanded", open ? "true" : "false");
      (open ? sheetX : pill)?.focus({ preventScroll: true });
    };
    pill?.addEventListener("click", () => setSheet(!sheetOpen), { signal });
    scrim?.addEventListener("click", () => setSheet(false), { signal });
    sheetX?.addEventListener("click", () => setSheet(false), { signal });
    sheetDone?.addEventListener("click", () => setSheet(false), { signal });
    addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && sheetOpen) setSheet(false);
      },
      { signal },
    );
    matchMedia("(max-width: 899px)").addEventListener(
      "change",
      (e) => {
        if (!e.matches) setSheet(false);
      },
      { signal },
    );

    // Light under the pointer on list cards and guides, and the hover hook.
    let raf = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;
    section.addEventListener(
      "pointermove",
      (e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>(".ax-card");
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
  nx: number;
  ny: number;
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
    nx: 0,
    ny: 0,
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
  // one each frame with the far parallax and any shooting star on top. The
  // stars have the same count, sizes and colours as the sheets over the case
  // studies, so the night reads as one across the join.
  const SPARE_MAG = 0.46;
  const SPARE_SHARE = 0.06;
  const field = document.createElement("canvas");
  // The stars that leave where the constellations are: every bright one, and a
  // share of the rest.
  const spare = document.createElement("canvas");
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
    field.width = canvas.width;
    field.height = canvas.height;
    spare.width = canvas.width;
    spare.height = canvas.height;
    bg.width = canvas.width;
    bg.height = canvas.height;
    const ctx = field.getContext("2d");
    const sc = spare.getContext("2d");
    if (!ctx || !sc) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    sc.setTransform(DPR, 0, 0, DPR, 0, 0);
    sc.clearRect(0, 0, CW, CH);
    sc.globalCompositeOperation = "lighter";
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // A faint Milky Way, corner to corner, low left to high right.
    const ax = -CW * 0.05;
    const ay = CH * 0.92;
    const bx = CW * 1.05;
    const by = CH * 0.08;
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const nx = -uy;
    const ny = ux;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const t = rnd();
      const off = (rnd() - 0.5) * CH * 0.16;
      const x = ax + ux * len * t + nx * off;
      const y = ay + uy * len * t + ny * off;
      const r = CH * (0.12 + rnd() * 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rnd() < 0.4 ? "rgba(255,226,196,0.022)" : "rgba(190,205,255,0.026)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < Math.round((CW * CH) / 1500); i++) {
      const t = rnd();
      const off = (rnd() + rnd() + rnd() - 1.5) * CH * 0.14;
      const x = ax + ux * len * t + nx * off;
      const y = ay + uy * len * t + ny * off;
      ctx.fillStyle = `rgba(225,232,255,${(0.04 + rnd() * 0.16).toFixed(3)})`;
      const d = rnd() < 0.92 ? 0.7 : 1.2;
      ctx.fillRect(x, y, d, d);
    }
    // The stars, sheet by sheet.
    const area = (CW * CH) / (1440 * 900);
    const SHEETS = [
      { n: 2800, s0: 0.62, s1: 0.9, gain: 0.66, halo: 0 },
      { n: 1000, s0: 0.7, s1: 1.05, gain: 0.82, halo: 0 },
      { n: 330, s0: 0.85, s1: 1.5, gain: 1, halo: 0 },
      { n: 44, s0: 1.3, s1: 2.2, gain: 1, halo: 0 },
      { n: 5, s0: 2, s1: 2.8, gain: 1, halo: 10 },
    ];
    let count = 0;
    for (const sh of SHEETS) {
      for (let i = 0; i < Math.round(sh.n * area); i++) {
        const x = rnd() * CW;
        const y = rnd() * CH;
        const c = rnd();
        const e = rnd();
        const b = rnd();
        const sig = Math.max(sh.s0 + (sh.s1 - sh.s0) * c * c * c, 0.8 / DPR);
        const mag = Math.min(1, sh.gain * (0.42 + 0.58 * e * e));
        const mix = (warm: number, cool: number) => Math.round(255 * (1 + ((warm + (cool - warm) * b) - 1) * 0.6));
        const rgb = `${mix(1, 0.78)},${mix(0.88, 0.87)},${mix(0.76, 1)}`;
        const R = sig * 3.2;
        // Which stars can leave comes from the star's place in the list, so
        // the sky itself stays the same.
        count++;
        const out = mag > SPARE_MAG || sig > 1.15 || (count * 0.618034) % 1 < SPARE_SHARE ? sc : ctx;
        const g = out.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, `rgba(${rgb},${mag.toFixed(3)})`);
        g.addColorStop(0.32, `rgba(${rgb},${(mag * 0.6).toFixed(3)})`);
        g.addColorStop(0.62, `rgba(${rgb},${(mag * 0.15).toFixed(3)})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        out.fillStyle = g;
        out.fillRect(x - R, y - R, R * 2, R * 2);
        if (sh.halo) {
          const HR = sh.halo * 3;
          const h = out.createRadialGradient(x, y, 0, x, y, HR);
          h.addColorStop(0, `rgba(${rgb},${(mag * 0.2).toFixed(3)})`);
          h.addColorStop(0.4, `rgba(${rgb},${(mag * 0.06).toFixed(3)})`);
          h.addColorStop(1, `rgba(${rgb},0)`);
          out.fillStyle = h;
          out.fillRect(x - HR, y - HR, HR * 2, HR * 2);
        }
      }
    }
    // The sky has no top or bottom edge: its stars fade out there, and the
    // stars laid over each join carry on across it.
    const fade = CH * 0.2;
    const fadeLow = CH * 0.12;
    for (const c of [ctx, sc]) {
      c.globalCompositeOperation = "destination-out";
      let g = c.createLinearGradient(0, 0, 0, fade);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, CW, fade);
      g = c.createLinearGradient(0, CH - fadeLow, 0, CH);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,1)");
      c.fillStyle = g;
      c.fillRect(0, CH - fadeLow, CW, fadeLow);
      c.globalCompositeOperation = "source-over";
    }
  };

  // Where the constellations are, the spare stars leave and the rest dim, most
  // of all right around their stars, lines and names. The edges of the sky keep
  // every star.
  const carve = () => {
    const ctx = bg.getContext("2d");
    if (!ctx || !field.width) return;
    // A point of the map on this canvas: the canvas is oversized and sits a
    // little back in the dome.
    const back = phone ? 1 : 1500 / 1440;
    const ox = W / 2;
    const oy = H * 0.45;
    const px = (x: number) => ox + (x - ox) * back + (CW - W) / 2;
    const py = (y: number) => oy + (y - oy) * back + (CH - H) / 2;
    const oval = (x: number, y: number, rx: number, ry: number, a: number, solid: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      if (solid) g.addColorStop(0.62, `rgba(0,0,0,${a})`);
      else g.addColorStop(0.55, `rgba(0,0,0,${(a * 0.7).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    };
    const mr = mapEl.getBoundingClientRect();
    const words = overlay ? Array.from(overlay.querySelectorAll<HTMLElement>(".ax-h2, .ax-dock, .ax-fpill, .ax-head .kicker")) : [];
    // Solid clears the spare stars right out. Otherwise the stars left dim.
    const clear = (solid: boolean) => {
      const reach = phone ? (solid ? 0.85 : 0.62) : 1;
      for (const el of words) {
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).visibility === "hidden") continue;
        // Measured against the map, so it holds wherever the page is scrolled.
        const x = r.left - mr.left + r.width / 2;
        const y = r.top - mr.top + r.height / 2;
        if (y > H) continue;
        oval(px(x), py(y), r.width * (solid ? 0.72 : 0.68), r.height * (solid ? 1.5 : 1.25), solid ? 1 : 0.82, solid);
      }
      for (const g of groups) {
        const vis = g.stars.filter((s) => s.on);
        if (!vis.length) continue;
        // The area of the whole figure, broad and gentle.
        const cx = (g.x0 + g.x1) / 2;
        const cy = (g.y0 + g.y1) / 2;
        const pad = (solid ? 170 : 150) * reach;
        oval(px(cx), py(cy), (g.x1 - g.x0) / 2 + pad, (g.y1 - g.y0) / 2 + pad, solid ? 1 : 0.5, solid);
        // Tight around each star.
        const near = (solid ? 110 : 58) * reach;
        for (const s of vis) oval(px(s.x), py(s.y), near, near, solid ? 1 : 0.72, solid);
        // Along each line.
        const along = (solid ? 40 : 26) * reach;
        for (const [a, b] of g.edges) {
          const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 22));
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            oval(px(a.x + (b.x - a.x) * t), py(a.y + (b.y - a.y) * t), along, along, solid ? 1 : 0.34, solid);
          }
        }
        // Behind the name.
        const nw = g.name.offsetWidth || 100;
        const nh = g.name.offsetHeight || 46;
        oval(px(g.nx + nw / 2), py(g.ny + nh / 2), nw * (solid ? 0.95 : 0.85), nh * (solid ? 1.4 : 1.15), solid ? 1 : 0.9, solid);
      }
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, bg.width, bg.height);
    ctx.drawImage(spare, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    clear(true);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(field, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    clear(false);
    ctx.globalCompositeOperation = "source-over";
    skyDirty = true;
    paint(lastOx, lastOy, performance.now());
  };

  // ---- The visible sky: the backdrop, shifted, and shooting stars ---------
  type Shot = { x: number; y: number; vx: number; vy: number; life: number; max: number };
  const shots: Shot[] = [];
  let nextShot = performance.now() + 2500;
  let lastPaint = performance.now();
  let lastOx = 0;
  let lastOy = 0;
  let paintedX = NaN;
  let paintedY = NaN;
  let skyDirty = true;
  const paint = (ox: number, oy: number, now: number) => {
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    lastOx = ox;
    lastOy = oy;
    const dt = Math.min(50, now - lastPaint) / 16.67;
    lastPaint = now;
    // The whole sky is one image: while it has not moved and no star is
    // falling, what is on the canvas is already right.
    const atX = Math.round(ox * DPR);
    const atY = Math.round(oy * DPR);
    if (atX === paintedX && atY === paintedY && !shots.length && now <= nextShot && !skyDirty) return;
    paintedX = atX;
    paintedY = atY;
    skyDirty = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg, atX, atY);
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

  // Everything over the sky takes its room first: the heading and filters
  // above (measured, so a wrapped row or the impact note moves the sky), the
  // hint below, the scroll gauge on the left, the chat and back to top
  // buttons in the bottom right corner.
  const overlay = mapEl.parentElement?.querySelector<HTMLElement>(".ax-overlay") || null;
  const section = mapEl.closest<HTMLElement>(".ax");
  let skyKey = "";
  let layoutKey = "";

  const nameCount = (g: Group) => {
    const n = g.stars.filter((s) => s.on).length;
    const num = g.name.querySelector(".ax-name-n");
    if (num) num.textContent = `${n} ${n === 1 ? "post" : "posts"}`;
    g.name.setAttribute("aria-label", `${g.tag}, ${n} ${n === 1 ? "post" : "posts"}. Open this constellation`);
    g.name.classList.toggle("is-out", n === 0);
    return n;
  };

  const layout = () => {
    phone = phoneMq.matches;
    W = mapEl.clientWidth || 1;
    H = mapEl.clientHeight || 1;
    const top = (overlay ? overlay.offsetHeight : 0) + (phone ? 18 : 34);
    const m = phone ? { t: top, b: 46, l: 14, r: 14 } : { t: top, b: 56, l: 120, r: 120 };
    const box = { x0: m.l, y0: m.t, x1: W - m.r, y1: H - m.b };
    const availW = Math.max(1, box.x1 - box.x0);
    const availH = Math.max(1, box.y1 - box.y0);
    const corner = phone
      ? { x0: W - 72, y0: H - 160, x1: W, y1: H }
      : { x0: W - 150, y0: H - 200, x1: W, y1: H };

    groups.forEach(nameCount);
    const live = groups.filter((g) => g.stars.some((s) => s.on));
    let fours = 0;
    const seeds = live.map((g) => {
      const vis = g.stars.filter((s) => s.on).sort((a, b) => a.impact - b.impact || b.date - a.date);
      const shape = shapeFor(vis.length, vis.length === 4 ? fours++ : 0);
      const rot = vis.length > 1 ? (hash(g.tag + "r") - 0.5) * 0.6 : 0;
      return { g, vis, shape, rot, nw: g.name.offsetWidth || 110, nh: g.name.offsetHeight || 46 };
    });

    // One constellation at a given size: its stars around the origin, its
    // name under them, and the box around both.
    const shapeAt = (it: (typeof seeds)[number], base: number) => {
      const n = it.vis.length;
      const size = n === 1 ? 0 : base * Math.sqrt(n) * 0.95;
      const w = size * Math.sqrt(it.shape.aspect);
      const h = size / Math.sqrt(it.shape.aspect);
      const cos = Math.cos(it.rot);
      const sin = Math.sin(it.rot);
      const pts = it.vis.map((_, i) => {
        const p = it.shape.pts[i] || [0.5 + Math.cos(i * 2.4) * 0.45 * (i / n), 0.5 + Math.sin(i * 2.4) * 0.45 * (i / n)];
        const lx = (p[0] - 0.5) * w;
        const ly = (p[1] - 0.5) * h;
        return [lx * cos - ly * sin, lx * sin + ly * cos] as [number, number];
      });
      const sx0 = Math.min(...pts.map((p) => p[0]));
      const sx1 = Math.max(...pts.map((p) => p[0]));
      const sy0 = Math.min(...pts.map((p) => p[1]));
      const sy1 = Math.max(...pts.map((p) => p[1]));
      const nx = (sx0 + sx1) / 2 - it.nw / 2;
      const ny = sy1 + 14;
      const pad = 12;
      return {
        pts,
        nx,
        ny,
        x0: Math.min(sx0 - pad, nx),
        x1: Math.max(sx1 + pad, nx + it.nw),
        y0: sy0 - pad,
        y1: ny + it.nh,
      };
    };

    type Spot = { it: (typeof seeds)[number]; sh: ReturnType<typeof shapeAt>; x: number; y: number };
    const hits = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }, gap: number) =>
      a.x0 < b.x1 + gap && a.x1 + gap > b.x0 && a.y0 < b.y1 + gap && a.y1 + gap > b.y0;
    const rectOf = (sp: { sh: ReturnType<typeof shapeAt>; x: number; y: number }) => ({
      x0: sp.x + sp.sh.x0,
      y0: sp.y + sp.sh.y0,
      x1: sp.x + sp.sh.x1,
      y1: sp.y + sp.sh.y1,
    });

    // Largest first, on a spiral from the middle of the room, inside it and
    // clear of the others. If any will not fit, try again a little smaller.
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const ratio = availW / availH;
    const tryBase = (base: number): Spot[] | null => {
      const items = seeds
        .map((it) => ({ it, sh: shapeAt(it, base) }))
        .sort((a, b) => (b.sh.x1 - b.sh.x0) * (b.sh.y1 - b.sh.y0) - (a.sh.x1 - a.sh.x0) * (a.sh.y1 - a.sh.y0));
      const placed: Spot[] = [];
      const reach = Math.hypot(availW, availH);
      for (const { it, sh } of items) {
        let found: Spot | null = null;
        const turn = hash(it.g.tag) * Math.PI * 2;
        for (let rr = 0; rr < reach && !found; rr += 12) {
          const tries = rr === 0 ? 1 : Math.max(10, Math.round(rr / 9));
          for (let j = 0; j < tries; j++) {
            const a = turn + (j / tries) * Math.PI * 2;
            const sp: Spot = { it, sh, x: cx - (sh.x0 + sh.x1) / 2 + Math.cos(a) * rr * Math.sqrt(ratio), y: cy - (sh.y0 + sh.y1) / 2 + (Math.sin(a) * rr) / Math.sqrt(ratio) };
            const r = rectOf(sp);
            if (r.x0 < box.x0 || r.x1 > box.x1 || r.y0 < box.y0 || r.y1 > box.y1) continue;
            if (hits(r, corner, 0)) continue;
            if (placed.some((p) => hits(r, rectOf(p), 22))) continue;
            found = sp;
            break;
          }
        }
        if (!found) return null;
        placed.push(found);
      }
      return placed;
    };
    let base = phone ? Math.min(W * 0.13, 52) : Math.min(availW / 13, availH / 6, 110);
    let spots: Spot[] | null = null;
    while (!spots && base >= 12) {
      spots = tryBase(base);
      if (!spots) base *= 0.93;
    }
    if (!spots) spots = tryBase(12) || [];

    // Spread the figure to use the room and keep it centred: move the middles
    // apart, axis by axis, as far as the room allows. Moving apart never makes
    // an overlap. A move that would land in the button corner is undone.
    if (spots.length > 1) {
      const all = spots;
      const centre = () => {
        const rects = all.map(rectOf);
        const dx = cx - (Math.min(...rects.map((r) => r.x0)) + Math.max(...rects.map((r) => r.x1))) / 2;
        const dy = cy - (Math.min(...rects.map((r) => r.y0)) + Math.max(...rects.map((r) => r.y1))) / 2;
        for (const sp of all) {
          sp.x += dx;
          sp.y += dy;
        }
        if (all.some((sp) => hits(rectOf(sp), corner, 0))) {
          for (const sp of all) {
            sp.x -= dx;
            sp.y -= dy;
          }
        }
      };
      const limit = (centreAt: number, lo: number, hi: number, axis: "x" | "y") => {
        let f = 2.4;
        for (const sp of all) {
          const r = rectOf(sp);
          const a0 = axis === "x" ? r.x0 : r.y0;
          const a1 = axis === "x" ? r.x1 : r.y1;
          const mid = (a0 + a1) / 2;
          const half = (a1 - a0) / 2;
          if (mid > centreAt + 0.5) f = Math.min(f, (hi - half - centreAt) / (mid - centreAt));
          else if (mid < centreAt - 0.5) f = Math.min(f, (centreAt - lo - half) / (centreAt - mid));
        }
        return Math.max(1, f);
      };
      centre();
      for (let pass = 0; pass < 3; pass++) {
        const fxMax = limit(cx, box.x0, box.x1, "x");
        const fyMax = limit(cy, box.y0, box.y1, "y");
        const from = all.map((sp) => ({ x: sp.x, y: sp.y, r: rectOf(sp) }));
        for (let t = 1; t >= 0; t -= 0.1) {
          const fx = 1 + (fxMax - 1) * t;
          const fy = 1 + (fyMax - 1) * t;
          all.forEach((sp, i) => {
            const mx0 = (from[i].r.x0 + from[i].r.x1) / 2;
            const my0 = (from[i].r.y0 + from[i].r.y1) / 2;
            sp.x = from[i].x + (cx + (mx0 - cx) * fx - mx0);
            sp.y = from[i].y + (cy + (my0 - cy) * fy - my0);
          });
          if (!all.some((sp) => hits(rectOf(sp), corner, 0))) break;
        }
        centre();
      }
    }

    for (const sp of spots) {
      const { g, vis, shape } = sp.it;
      vis.forEach((st, i) => {
        st.note = i;
        st.x = sp.x + sp.sh.pts[i][0];
        st.y = sp.y + sp.sh.pts[i][1];
      });
      g.edges = shape.edges
        .filter(([a, b]) => a < vis.length && b < vis.length)
        .map(([a, b]) => [vis[a], vis[b]] as [Star, Star]);
      g.x0 = Math.min(...vis.map((st) => st.x));
      g.x1 = Math.max(...vis.map((st) => st.x));
      g.y0 = Math.min(...vis.map((st) => st.y));
      g.y1 = Math.max(...vis.map((st) => st.y));
      g.nx = sp.x + sp.sh.nx;
      g.ny = sp.y + sp.sh.ny;
    }
    write();
    const key = `${W}x${H}`;
    if (key !== skyKey) {
      skyKey = key;
      drawSky();
    }
    carve();
    laidOut = true;
  };

  const place = (s: Star) => {
    s.el.style.transform = `translate3d(${(s.x + s.lx).toFixed(1)}px, ${(s.y + s.ly).toFixed(1)}px, 0)`;
  };
  const radius = (s: Star) =>
    impactMode ? 4.4 + Math.max(0, 1 - s.impact / 40) * 6.5 : 4 + Math.min(10, s.minutes) * 0.72;

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
      if (!g.stars.some((s) => s.on)) continue;
      g.name.style.transform = `translate3d(${g.nx.toFixed(1)}px, ${g.ny.toFixed(1)}px, 0)`;
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
      const bandTop = 72;
      const bandBottom = H * 0.28 - 8;
      k = Math.min(1.6, (W * 0.8) / gw, (bandBottom - bandTop) / gh);
      tx = W / 2;
      ty = (bandTop + bandBottom) / 2;
    } else {
      const left = 96;
      const right = (panel.offsetLeft || W * 0.3) - 24;
      k = Math.min(1.7, ((right - left) * 0.92) / gw, (H * 0.6) / gh);
      tx = (left + right) / 2;
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
    section?.classList.add("is-sheet");
    // Line the screen up with the window.
    const r = mapEl.getBoundingClientRect();
    if (Math.abs(r.top) > 4) scrollTo({ top: r.top + scrollY, behavior: reduce ? "auto" : "smooth" });
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
      section?.classList.remove("is-sheet");
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
    dome.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
    const px = (-psx * 16 + Math.sin(t * 0.07) * 6) * free;
    const py = (-psy * 10 + Math.cos(t * 0.05) * 4) * free;
    par.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
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
    mapEl.toggleAttribute("data-on", onScreen);
    run();
  });
  io.observe(mapEl);
  document.addEventListener("visibilitychange", run, { signal });

  let overlayH = -1;
  const ro = new ResizeObserver(() => {
    if (!shown) return;
    const oh = overlay ? overlay.offsetHeight : 0;
    if (Math.abs(mapEl.clientWidth - W) < 1 && Math.abs(mapEl.clientHeight - H) < 1 && oh === overlayH) return;
    overlayH = oh;
    layout();
    if (openGroup) {
      renderPage();
      glideTo(openGroup);
    }
  });
  ro.observe(mapEl);
  if (overlay) ro.observe(overlay);
  // A coarse pointer taps.
  if (matchMedia("(pointer: coarse)").matches) {
    const hint = mapEl.querySelector(".ax-hint");
    if (hint) hint.textContent = "Tap a constellation to open it";
  }

  return {
    update(pass, q, impact) {
      impactMode = impact;
      query = q;
      for (const s of stars) {
        s.on = pass(s.el);
        s.match = !q || q.split(/\s+/).every((w) => (s.el.dataset.q || "").includes(w));
      }
      if (!shown) return;
      // The search only lights stars; the shapes move when the set does.
      const key = `${impact}|${stars.map((s) => (s.on ? 1 : 0)).join("")}`;
      if (key !== layoutKey) {
        layoutKey = key;
        layout();
      } else write();
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
        overlayH = overlay ? overlay.offsetHeight : 0;
        layoutKey = `${impactMode}|${stars.map((s) => (s.on ? 1 : 0)).join("")}`;
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
