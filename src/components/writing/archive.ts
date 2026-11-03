// The map of every post, and the list view beside it.
//
// One set of filters drives both: search, kind of work, year, tag, and the
// order. The list is the plain grid; its default view (no filters, newest
// first) leaves out the six case studies, which are on the page above. The
// map always holds every post that matches.
//
// The map lays every constellation out so nothing overlaps, then springs
// each card to its place, so a filter, a zoom or an opened card moves
// everything smoothly. It sleeps when nothing moves and off screen.
//
// Sound hook (nothing here plays audio): on window,
//   writing:hover { slug }   the pointer comes onto a post

import { onPage } from "../../scripts/lifecycle";
import { navigate } from "astro:transitions/client";

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

    const matches = (el: HTMLElement) => {
      const dx = (el.dataset.dx || "").split(" ").filter(Boolean);
      if (f.kind !== "all" && !dx.includes(f.kind)) return false;
      if (f.year !== "all" && el.dataset.year !== f.year) return false;
      if (f.tag !== "all" && el.dataset.tag !== f.tag) return false;
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
      map?.update(matches, f.sort === "impact");
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
        map.update(matches, f.sort === "impact");
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
        const item = (e.target as HTMLElement).closest<HTMLElement>(".ax-slot, .ax-star");
        if (!item) return;
        const from = (e.relatedTarget as HTMLElement | null)?.closest(".ax-slot, .ax-star");
        if (from === item) return;
        dispatchEvent(new CustomEvent("writing:hover", { detail: { slug: item.dataset.slug } }));
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
// The map
//
// Three zoom levels:
//   stars  every post a glowing star, only the constellation names
//   cards  the default: every constellation, compact cards, full titles
//   focus  one constellation as full cards with art and summary; the map
//          grows to fit them and the page scrolls through it
// In "cards" each tag is a small masonry of cards under its name. The
// constellations are packed onto shelves, the column counts chosen so the
// whole map fits the view at the largest size, centred. Phones get one
// constellation per screen, swiped sideways.
// ---------------------------------------------------------------------------

type MapHandle = {
  update: (matches: (el: HTMLElement) => boolean, impact: boolean) => void;
  show: () => void;
  hide: () => void;
  stop: () => void;
};

type Mode = "stars" | "cards" | "focus";

type Node = {
  el: HTMLElement;
  link: HTMLAnchorElement;
  slug: string;
  tag: string;
  date: number;
  impact: number;
  on: boolean;
  open: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  tx: number;
  ty: number;
  ts: number;
  // Where an open card sits, and the size of the card at its level.
  ox: number;
  oy: number;
  w: number;
  h: number;
};

type Box = { tag: string; nodes: Node[]; w: number; h: number; pos: Map<Node, [number, number]> };

const CARD_W = 196;
const OPEN_W = 300;
const GAP = 12; // between cards
const GROUP_GAP = 44; // between constellations
const LABEL_H = 36; // a name and the space under it
const STAR = 14;

function mountMap(mapEl: HTMLElement): MapHandle {
  const ac = new AbortController();
  const signal = ac.signal;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phoneMq = matchMedia("(max-width: 899px)");
  const nodes: Node[] = Array.from(mapEl.querySelectorAll<HTMLElement>(".ax-star")).map((el) => ({
    el,
    link: el.querySelector<HTMLAnchorElement>(".ax-node")!,
    slug: el.dataset.slug || "",
    tag: el.dataset.tag || "",
    date: parseInt(el.dataset.date || "0"),
    impact: parseInt(el.dataset.impact || "500"),
    on: true,
    open: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    s: 1,
    tx: 0,
    ty: 0,
    ts: 1,
    ox: 0,
    oy: 0,
    w: CARD_W,
    h: 80,
  }));
  const byTag = <T extends Element>(sel: string) =>
    new Map(Array.from(mapEl.querySelectorAll<T>(sel)).map((e) => [(e as unknown as HTMLElement).dataset.tag || "", e]));
  const glows = byTag<HTMLElement>(".ax-glow");
  const lines = byTag<SVGPathElement>(".ax-line");
  const names = byTag<HTMLElement>(".ax-name");
  const starsLayer = mapEl.querySelector<HTMLElement>(".ax-stars")!;
  const namesLayer = mapEl.querySelector<HTMLElement>(".ax-names")!;
  const back = mapEl.querySelector<HTMLButtonElement>(".ax-back");

  let mode: Mode = "cards";
  let focusTag = "";
  let impactOrder = false;
  let phone = phoneMq.matches;
  let W = 1;
  let H = 1;
  let scale = 1;
  let shown = false;
  let onScreen = false;
  let bloomed = false;
  let raf = 0;
  let awake = 0;
  const trees = new Map<string, Array<[Node, Node]>>();
  let openNode: Node | null = null;

  const margins = () => (phone ? { top: 16, bottom: 16, left: 16, right: 16 } : { top: 96, bottom: 44, left: 84, right: 84 });
  const visible = (n: Node) => n.on && (mode !== "focus" || n.tag === focusTag);
  const order = (g: Node[]) =>
    g.sort((a, b) => (impactOrder ? a.impact - b.impact || b.date - a.date : b.date - a.date));

  const groupsOf = (list: Node[]) => {
    const m = new Map<string, Node[]>();
    for (const n of list) {
      if (!m.has(n.tag)) m.set(n.tag, []);
      m.get(n.tag)!.push(n);
    }
    return [...m.entries()]
      .map(([tag, g]) => ({ tag, nodes: order(g) }))
      .sort((a, b) => b.nodes.length - a.nodes.length || a.tag.localeCompare(b.tag));
  };

  // Masonry: each card goes to the shortest column, in order; alternate
  // columns start a little lower so a constellation does not read as a grid.
  const masonry = (g: Node[], cols: number, cw: number, gap: number, stagger: number) => {
    const colH = Array.from({ length: cols }, (_, k) => (cols > 1 && k % 2 ? stagger : 0));
    const pos = new Map<Node, [number, number]>();
    for (const n of g) {
      let k = 0;
      for (let j = 1; j < cols; j++) if (colH[j] < colH[k] - 0.5) k = j;
      pos.set(n, [k * (cw + gap), colH[k]]);
      colH[k] += n.h + gap;
    }
    return { pos, w: cols * cw + (cols - 1) * gap, h: Math.max(...colH) - gap };
  };

  const setLod = (lod: string) => {
    if (mapEl.dataset.lod !== lod) mapEl.dataset.lod = lod;
  };
  const measure = () => {
    for (const n of nodes) {
      if (n.open) n.el.classList.remove("is-open");
    }
    for (const n of nodes) {
      n.w = n.link.offsetWidth || n.w;
      n.h = n.link.offsetHeight || n.h;
    }
    for (const n of nodes) if (n.open) n.el.classList.add("is-open");
  };

  // Spanning tree inside a constellation, on target centres: each post
  // joins its nearest neighbour already in the figure.
  const treeOf = (g: Node[], cx: (n: Node) => number, cy: (n: Node) => number) => {
    const tree: Array<[Node, Node]> = [];
    if (g.length < 2) return tree;
    const inT = [g[0]];
    const rest = g.slice(1);
    while (rest.length) {
      let bi = 0;
      let bj = 0;
      let bd = Infinity;
      rest.forEach((a, i) =>
        inT.forEach((b, j) => {
          const d = Math.hypot(cx(a) - cx(b), cy(a) - cy(b));
          if (d < bd) {
            bd = d;
            bi = i;
            bj = j;
          }
        }),
      );
      tree.push([rest[bi], inT[bj]]);
      inT.push(rest.splice(bi, 1)[0]);
    }
    return tree;
  };

  const placeName = (tag: string, x: number, y: number) => {
    const el = names.get(tag);
    if (el) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  };
  const placeGlow = (tag: string, x: number, y: number, w: number, h: number) => {
    const el = glows.get(tag);
    if (!el) return;
    const size = Math.max(w, h) * 1.35 + 160;
    el.style.transform = `translate3d(${(x + w / 2 - size / 2).toFixed(1)}px, ${(y + h / 2 - size / 2).toFixed(1)}px, 0) scale(${(size / 10).toFixed(2)})`;
  };

  // ---- Layouts -------------------------------------------------------------

  const layoutCards = (asStars: boolean) => {
    mapEl.style.removeProperty("height");
    starsLayer.style.removeProperty("width");
    namesLayer.style.removeProperty("width");
    mapEl.style.setProperty("--cw", `${CARD_W}px`);
    setLod("cards");
    W = mapEl.clientWidth || 1;
    H = mapEl.clientHeight || 1;
    measure();
    const m = margins();
    const availW = W - m.left - m.right;
    const availH = H - m.top - m.bottom;
    const groups = groupsOf(nodes.filter((n) => n.on));

    // Every column count worth trying for each constellation.
    const options = groups.map((g) => {
      const max = Math.min(g.nodes.length, 6);
      const opts: Box[] = [];
      for (let c = 1; c <= max; c++) {
        const mm = masonry(g.nodes, c, CARD_W, GAP, 14);
        opts.push({ tag: g.tag, nodes: g.nodes, w: mm.w, h: mm.h + LABEL_H, pos: mm.pos });
      }
      return opts;
    });

    type Shelf = { boxes: Box[]; w: number; h: number };
    const pack = (boxes: Box[], limit: number) => {
      const shelves: Shelf[] = [];
      for (const b of [...boxes].sort((a, c) => c.h - a.h)) {
        let shelf = shelves.find((s) => s.w + GROUP_GAP + b.w <= limit);
        if (!shelf) shelves.push((shelf = { boxes: [], w: -GROUP_GAP, h: 0 }));
        shelf.boxes.push(b);
        shelf.w += GROUP_GAP + b.w;
        shelf.h = Math.max(shelf.h, b.h);
      }
      const w = Math.max(...shelves.map((s) => s.w));
      const h = shelves.reduce((t, s) => t + s.h, 0) + GROUP_GAP * (shelves.length - 1);
      return { shelves, w, h };
    };

    let best: { shelves: Shelf[]; w: number; h: number; s: number; aspect: number } | null = null;
    const pick: Box[] = [];
    const limits = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4].map((k) => availW * k);
    const walk = (i: number) => {
      if (i === options.length) {
        for (const limit of limits) {
          const p = pack(pick, limit);
          const s = Math.min(availW / p.w, availH / p.h, 1.18);
          const aspect = Math.abs(Math.log((p.w / p.h) / (availW / availH)));
          if (!best || s > best.s + 0.005 || (Math.abs(s - best.s) <= 0.005 && aspect < best.aspect)) {
            best = { ...p, s, aspect };
          }
        }
        return;
      }
      for (const o of options[i]) {
        pick[i] = o;
        walk(i + 1);
      }
    };
    if (options.length) walk(0);
    const plan = best as { shelves: Shelf[]; w: number; h: number; s: number } | null;
    trees.clear();
    if (!plan) return;
    scale = plan.s;
    const ox = m.left + (availW - plan.w * scale) / 2;
    const oy = m.top + (availH - plan.h * scale) / 2;
    const centre = { x: ox + (plan.w * scale) / 2, y: oy + (plan.h * scale) / 2 };
    const squeeze = 0.58;
    let y = 0;
    for (const shelf of plan.shelves) {
      let x = (plan.w - shelf.w) / 2;
      for (const b of shelf.boxes) {
        const gy = y + (shelf.h - b.h) / 2;
        const sx = (v: number) => ox + v * scale;
        const sy = (v: number) => oy + v * scale;
        if (asStars) {
          // Each card's centre, pulled toward the middle of the map.
          let x0 = Infinity;
          let y0 = Infinity;
          let x1 = -Infinity;
          let y1 = -Infinity;
          for (const n of b.nodes) {
            const [px, py] = b.pos.get(n)!;
            const cx = centre.x + (sx(x + px + n.w / 2) - centre.x) * squeeze;
            const cy = centre.y + (sy(gy + LABEL_H + py + n.h / 2) - centre.y) * squeeze;
            n.tx = cx - STAR / 2;
            n.ty = cy - STAR / 2;
            n.ts = 1;
            x0 = Math.min(x0, cx);
            y0 = Math.min(y0, cy);
            x1 = Math.max(x1, cx);
            y1 = Math.max(y1, cy);
          }
          placeName(b.tag, x0 - 10, y0 - 40);
          placeGlow(b.tag, x0, y0, x1 - x0, y1 - y0);
          trees.set(b.tag, treeOf(b.nodes, (n) => n.tx + STAR / 2, (n) => n.ty + STAR / 2));
        } else {
          for (const n of b.nodes) {
            const [px, py] = b.pos.get(n)!;
            n.tx = sx(x + px);
            n.ty = sy(gy + LABEL_H + py);
            n.ts = scale;
          }
          placeName(b.tag, sx(x), sy(gy));
          placeGlow(b.tag, sx(x), sy(gy + LABEL_H), b.w * scale, (b.h - LABEL_H) * scale);
          trees.set(
            b.tag,
            treeOf(b.nodes, (n) => n.tx + (n.w * scale) / 2, (n) => n.ty + (n.h * scale) / 2),
          );
        }
        x += b.w + GROUP_GAP;
      }
      y += shelf.h + GROUP_GAP;
    }
    if (asStars) setLod("stars");
  };

  const layoutFocus = () => {
    const m = margins();
    starsLayer.style.removeProperty("width");
    namesLayer.style.removeProperty("width");
    W = mapEl.clientWidth || 1;
    const availW = W - m.left - m.right;
    const cols = Math.max(1, Math.min(4, Math.floor((availW + 20) / (300 + 20))));
    const fw = Math.min(340, Math.floor((availW - (cols - 1) * 20) / cols));
    mapEl.style.setProperty("--fw", `${fw}px`);
    setLod("full");
    measure();
    const g = order(nodes.filter((n) => n.on && n.tag === focusTag));
    const mm = masonry(g, Math.min(cols, Math.max(1, g.length)), fw, 20, 0);
    const ox = m.left + (availW - mm.w) / 2;
    const oy = m.top + 64;
    for (const n of g) {
      const [px, py] = mm.pos.get(n)!;
      n.tx = ox + px;
      n.ty = oy + py;
      n.ts = 1;
    }
    placeName(focusTag, ox, m.top + 10);
    placeGlow(focusTag, ox, oy, mm.w, Math.min(mm.h, 900));
    trees.clear();
    H = oy + mm.h + 80;
    mapEl.style.height = `${Math.max(H, innerHeight)}px`;
    scale = 1;
  };

  // Phones: one constellation per screen width, its cards in one column.
  const layoutPhone = () => {
    W = mapEl.clientWidth || 1;
    const cw = W - 32;
    mapEl.style.setProperty("--cw", `${cw}px`);
    setLod("cards");
    measure();
    const groups = groupsOf(nodes.filter((n) => n.on));
    let tallest = 0;
    groups.forEach((g, k) => {
      const x0 = k * W + 16;
      placeName(g.tag, x0, 16);
      let y = 60;
      for (const n of g.nodes) {
        n.tx = x0;
        n.ty = y;
        n.ts = 1;
        y += n.h + 10;
      }
      tallest = Math.max(tallest, y + 16);
    });
    const total = `${Math.max(1, groups.length) * W}px`;
    starsLayer.style.width = total;
    namesLayer.style.width = total;
    mapEl.style.height = `${tallest}px`;
    H = tallest;
    trees.clear();
    scale = 1;
  };

  const layout = () => {
    closeOpen();
    phone = phoneMq.matches;
    if (phone) layoutPhone();
    else if (mode === "focus") layoutFocus();
    else layoutCards(mode === "stars");
    mapEl.dataset.mode = phone ? "cards" : mode;
    if (back) back.hidden = mode !== "focus" || phone;
    for (const n of nodes) {
      const v = visible(n);
      n.el.classList.toggle("is-out", !v);
      n.link.tabIndex = v ? 0 : -1;
      if (v) n.el.removeAttribute("aria-hidden");
      else n.el.setAttribute("aria-hidden", "true");
    }
    const vis = new Set(nodes.filter(visible).map((n) => n.tag));
    names.forEach((el, t) => el.classList.toggle("is-off", !vis.has(t)));
    glows.forEach((el, t) => el.classList.toggle("is-off", !vis.has(t) || phone));
    lines.forEach((el, t) => el.classList.toggle("is-off", !trees.has(t) || (trees.get(t)?.length || 0) === 0));
    names.forEach((el, t) => {
      const c = nodes.filter((n) => n.on && n.tag === t).length;
      el.setAttribute("aria-label", mode === "focus" && t === focusTag ? `Back to the whole map` : `Zoom in on ${t}, ${c} posts`);
      const num = el.querySelector(".ax-name-n");
      if (num) num.textContent = String(c);
    });
    wake();
  };

  // ---- Motion --------------------------------------------------------------

  const step = () => {
    let energy = 0;
    for (const n of nodes) {
      const tx = n.open ? n.ox : n.tx;
      const ty = n.open ? n.oy : n.ty;
      const ts = n.open ? Math.max(1, n.ts) : n.ts;
      n.vx = (n.vx + (tx - n.x) * 0.09) * 0.74;
      n.vy = (n.vy + (ty - n.y) * 0.09) * 0.74;
      n.x += n.vx;
      n.y += n.vy;
      n.s += (ts - n.s) * 0.2;
      energy += Math.abs(n.vx) + Math.abs(n.vy) + Math.abs(ts - n.s) * 30;
    }
    return energy;
  };
  const sizeNow = (n: Node) => (mapEl.dataset.lod === "stars" && !n.open ? [STAR, STAR] : [n.w, n.h]);
  const write = () => {
    for (const n of nodes) {
      n.el.style.transform = `translate3d(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px, 0) scale(${n.s.toFixed(3)})`;
    }
    trees.forEach((tree, t) => {
      const line = lines.get(t);
      if (!line) return;
      let d = "";
      for (const [a, b] of tree) {
        const [aw, ah] = sizeNow(a);
        const [bw, bh] = sizeNow(b);
        const ax = a.x + (aw * a.s) / 2;
        const ay = a.y + (ah * a.s) / 2;
        const bx = b.x + (bw * b.s) / 2;
        const by = b.y + (bh * b.s) / 2;
        d += `M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`;
      }
      line.setAttribute("d", d);
    });
  };
  const frame = () => {
    raf = 0;
    if (!shown || !onScreen) return;
    const energy = step();
    write();
    if (energy > 0.3) awake = 20;
    if (--awake > 0) raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    if (reduce || !bloomed) {
      for (const n of nodes) {
        n.x = n.open ? n.ox : n.tx;
        n.y = n.open ? n.oy : n.ty;
        n.s = n.open ? Math.max(1, n.ts) : n.ts;
        n.vx = n.vy = 0;
      }
      write();
      if (reduce || !bloomed) return;
    }
    awake = 40;
    if (!raf && shown && onScreen) raf = requestAnimationFrame(frame);
  };

  const bloom = () => {
    if (bloomed) return;
    layout();
    bloomed = true;
    mapEl.classList.add("is-live");
    if (reduce) return;
    // Everything starts at the middle and opens out into constellations.
    for (const n of nodes) {
      n.x = W / 2 - (n.w * 0.3) / 2 + (Math.random() - 0.5) * 60;
      n.y = H / 2 - (n.h * 0.3) / 2 + (Math.random() - 0.5) * 40;
      n.s = 0.3;
    }
    write();
    wake();
  };

  // ---- Open a card ---------------------------------------------------------

  const dim = (tag: string | null) => {
    for (const n of nodes) n.el.classList.toggle("is-dim", !!tag && n.tag !== tag && !n.open);
    names.forEach((el, t) => el.classList.toggle("is-dim", !!tag && t !== tag));
    glows.forEach((el, t) => el.classList.toggle("is-dim", !!tag && t !== tag));
    lines.forEach((el, t) => {
      el.classList.toggle("is-hot", !!tag && t === tag);
      el.classList.toggle("is-dim", !!tag && t !== tag);
    });
  };
  function closeOpen() {
    if (!openNode) return;
    const n = openNode;
    openNode = null;
    n.open = false;
    n.el.classList.remove("is-open");
    n.link.style.removeProperty("--px");
    n.link.style.removeProperty("--py");
    dim(null);
    wake();
  }
  const open = (n: Node) => {
    if (phone || mode === "focus" || openNode === n) return;
    closeOpen();
    openNode = n;
    n.open = true;
    n.el.classList.add("is-open");
    mapEl.style.setProperty("--fw", `${OPEN_W}px`);
    const ow = n.link.offsetWidth;
    const oh = n.link.offsetHeight;
    const s = Math.max(1, n.ts);
    const [cw, ch] = mode === "stars" ? [STAR, STAR] : [n.w * n.ts, n.h * n.ts];
    // Grow from the card's centre, kept inside the map.
    n.ox = Math.max(10, Math.min(W - ow * s - 10, n.tx + cw / 2 - (ow * s) / 2));
    n.oy = Math.max(10, Math.min(H - oh * s - 10, n.ty + ch / 2 - (oh * s) / 3));
    dim(n.tag);
    wake();
  };

  const nodeOf = (el: EventTarget | null) => {
    const star = (el as HTMLElement | null)?.closest?.(".ax-star");
    return star ? nodes.find((n) => n.el === star) : undefined;
  };
  mapEl.addEventListener(
    "pointerover",
    (e) => {
      if ((e as PointerEvent).pointerType === "touch") return;
      const n = nodeOf(e.target);
      if (n && visible(n)) open(n);
    },
    { signal },
  );
  mapEl.addEventListener(
    "pointerout",
    (e) => {
      const n = nodeOf(e.target);
      if (!n || n !== openNode) return;
      if (nodeOf(e.relatedTarget) === n) return;
      if (document.activeElement === n.link) return;
      closeOpen();
    },
    { signal },
  );
  mapEl.addEventListener(
    "pointermove",
    (e) => {
      const n = nodeOf(e.target);
      if (!n || !n.open) return;
      const r = n.link.getBoundingClientRect();
      n.link.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      n.link.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    },
    { passive: true, signal },
  );
  mapEl.addEventListener(
    "focusin",
    (e) => {
      const n = nodeOf(e.target);
      if (n) open(n);
    },
    { signal },
  );
  mapEl.addEventListener(
    "focusout",
    (e) => {
      const n = nodeOf(e.target);
      if (n && n === openNode && nodeOf(e.relatedTarget) !== n) closeOpen();
    },
    { signal },
  );

  // A click flies into the card, then the post opens.
  mapEl.addEventListener(
    "click",
    (e) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(".ax-node");
      if (!link) return;
      if (reduce || phone || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const art = link.querySelector<HTMLElement>(".ax-node-art");
      const img = link.querySelector<HTMLImageElement>("img");
      const box = art && art.offsetWidth ? art : link;
      const r = box.getBoundingClientRect();
      const fly = document.createElement("div");
      fly.className = "ax-fly";
      Object.assign(fly.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      if (img?.currentSrc) fly.style.backgroundImage = `url("${img.currentSrc}")`;
      document.body.appendChild(fly);
      const s = Math.max(innerWidth / r.width, innerHeight / r.height);
      const dx = innerWidth / 2 - (r.left + r.width / 2);
      const dy = innerHeight / 2 - (r.top + r.height / 2);
      const anim = fly.animate(
        [
          { transform: "translate(0, 0) scale(1)", borderRadius: "12px" },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, borderRadius: "0px" },
        ],
        { duration: 520, easing: "cubic-bezier(0.7, 0, 0.2, 1)", fill: "forwards" },
      );
      mapEl.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 520, easing: "ease-in" });
      const href = link.href;
      anim.onfinish = () => {
        navigate(href);
        setTimeout(() => fly.remove(), 900);
      };
    },
    { signal },
  );

  // ---- Zoom ----------------------------------------------------------------

  const setMode = (m: Mode, tag = "") => {
    if (phone) return;
    const was = mode;
    mode = m;
    focusTag = m === "focus" ? tag : "";
    layout();
    if (m === "focus" || was === "focus") {
      const top = mapEl.getBoundingClientRect().top + scrollY - 12;
      scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    }
  };
  const nearestTag = (px: number, py: number) => {
    let best = "";
    let bd = Infinity;
    for (const n of nodes) {
      if (!n.on) continue;
      const d = Math.hypot(n.tx - px, n.ty - py);
      if (d < bd) {
        bd = d;
        best = n.tag;
      }
    }
    return best;
  };
  const zoomIn = (px = W / 2, py = H / 2) => {
    if (mode === "stars") setMode("cards");
    else if (mode === "cards") setMode("focus", nearestTag(px, py));
  };
  const zoomOut = () => {
    if (mode === "focus") setMode("cards");
    else if (mode === "cards") setMode("stars");
  };
  names.forEach((el, t) =>
    el.addEventListener(
      "click",
      () => {
        if (phone) return;
        if (mode === "focus" && focusTag === t) setMode("cards");
        else setMode("focus", t);
      },
      { signal },
    ),
  );
  back?.addEventListener("click", () => setMode("cards"), { signal });
  mapEl.querySelectorAll<HTMLElement>(".ax-zbtn").forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        const z = b.dataset.zoom;
        if (z === "fit") setMode("cards");
        else if (z === "in") zoomIn();
        else zoomOut();
      },
      { signal },
    ),
  );
  let wheelAcc = 0;
  let wheelAt = 0;
  mapEl.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt < 450) return;
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < 40) return;
      const r = mapEl.getBoundingClientRect();
      if (wheelAcc < 0) zoomIn(e.clientX - r.left, e.clientY - r.top);
      else zoomOut();
      wheelAcc = 0;
      wheelAt = now;
    },
    { passive: false, signal },
  );
  mapEl.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key === "Escape") {
        if (openNode) closeOpen();
        else if (mode === "focus") setMode("cards");
      }
    },
    { signal },
  );

  const io = new IntersectionObserver(
    ([en]) => {
      onScreen = en.isIntersecting;
      if (onScreen && shown) {
        if (!bloomed) bloom();
        else wake();
      }
    },
    { rootMargin: "0px 0px -15% 0px" },
  );
  io.observe(mapEl);
  let lastW = 0;
  const ro = new ResizeObserver(() => {
    if (!shown || !bloomed) return;
    const w = mapEl.clientWidth;
    // Heights this script sets do not count; a new width does.
    if (w === lastW && mode !== "cards" && mode !== "stars") return;
    if (w === lastW && Math.abs(mapEl.clientHeight - H) < 2) return;
    lastW = w;
    layout();
  });
  ro.observe(mapEl);
  const onPhone = () => {
    if (mode === "focus" || mode === "stars") mode = "cards";
    if (shown && bloomed) layout();
  };
  phoneMq.addEventListener("change", onPhone, { signal });

  return {
    update(matches, impact) {
      impactOrder = impact;
      for (const n of nodes) n.on = matches(n.el);
      if (mode === "focus" && !nodes.some((n) => n.on && n.tag === focusTag)) mode = "cards";
      if (shown && bloomed) layout();
    },
    show() {
      shown = true;
      requestAnimationFrame(() => {
        if (!shown) return;
        lastW = mapEl.clientWidth;
        if (onScreen) {
          if (!bloomed) bloom();
          else layout();
        }
      });
    },
    hide() {
      shown = false;
      closeOpen();
      cancelAnimationFrame(raf);
      raf = 0;
    },
    stop() {
      ac.abort();
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      document.querySelectorAll(".ax-fly").forEach((el) => el.remove());
    },
  };
}
