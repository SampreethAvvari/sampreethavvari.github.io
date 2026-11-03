// The map of every post, and the list view beside it.
//
// One set of filters drives both: search, kind of work, year, tag, and the
// order. The list is the plain grid; its default view (no filters, newest
// first) leaves out the six case studies, which are on the page above. The
// map always holds every post that matches.
//
// The map is a small physics scene in the DOM: each card springs toward
// its place in its tag's constellation and pushes its neighbours aside, so
// a filter, a zoom or an opened card moves everything smoothly. It sleeps
// when nothing moves and while it is off screen.
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
    const nameBtns = group(".ax-name");

    const setTag = (tag: string) => {
      f.tag = f.tag === tag && tag !== "all" ? "all" : tag;
      press(tagBtns, (b) => b.dataset.tag === f.tag);
      nameBtns.forEach((b) => b.classList.toggle("is-on", b.dataset.tag === f.tag));
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
    on(nameBtns, (b) => setTag(b.dataset.tag || "all"));
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
        map ??= mountMap(mapEl, setTag);
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
// ---------------------------------------------------------------------------

type MapHandle = {
  update: (matches: (el: HTMLElement) => boolean, impact: boolean) => void;
  show: () => void;
  hide: () => void;
  stop: () => void;
};

type Node = {
  el: HTMLElement;
  link: HTMLAnchorElement;
  tag: string;
  date: number;
  impact: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  ts: number;
  wx: number;
  wy: number;
  on: boolean;
  open: boolean;
  w: number;
  h: number;
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const GAP = 12;

function mountMap(mapEl: HTMLElement, setTag: (t: string) => void): MapHandle {
  const ac = new AbortController();
  const signal = ac.signal;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nodes: Node[] = Array.from(mapEl.querySelectorAll<HTMLElement>(".ax-star")).map((el) => ({
    el,
    link: el.querySelector<HTMLAnchorElement>(".ax-node")!,
    tag: el.dataset.tag || "",
    date: parseInt(el.dataset.date || "0"),
    impact: parseInt(el.dataset.impact || "500"),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    s: 0.3,
    ts: 1,
    wx: 0,
    wy: 0,
    on: true,
    open: false,
    w: 132,
    h: 120,
  }));
  const byTag = <T extends Element>(sel: string) =>
    new Map(Array.from(mapEl.querySelectorAll<T>(sel)).map((e) => [(e as unknown as HTMLElement).dataset.tag || "", e]));
  const glows = byTag<HTMLElement>(".ax-glow");
  const lines = byTag<SVGPolylineElement>(".ax-line");
  const names = byTag<HTMLElement>(".ax-name");
  const nameW = new Map<string, number>();

  let W = 1;
  let H = 1;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let impactMode = false;
  let shown = false;
  let onScreen = false;
  let bloomed = false;
  let awake = 0;
  let raf = 0;

  const measure = () => {
    W = mapEl.clientWidth || 1;
    H = mapEl.clientHeight || 1;
    for (const n of nodes) {
      if (n.open) continue;
      n.w = n.link.offsetWidth || n.w;
      n.h = n.link.offsetHeight || n.h;
    }
    names.forEach((el, t) => nameW.set(t, el.offsetWidth || 90));
  };

  // Places in the world: the largest tag in the middle when it holds a
  // good share, the rest on an ellipse around it; inside a tag, a sunflower
  // spiral from the newest post outward.
  const layout = () => {
    const on = nodes.filter((n) => n.on);
    const groups = new Map<string, Node[]>();
    for (const n of on) {
      if (!groups.has(n.tag)) groups.set(n.tag, []);
      groups.get(n.tag)!.push(n);
    }
    const list = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const total = on.length || 1;
    const centers = new Map<string, [number, number]>();
    if (list.length === 1) centers.set(list[0][0], [0, 0]);
    else if (list.length) {
      const middle = list[0][1].length / total >= 0.3;
      const ring = middle ? list.slice(1) : list;
      if (middle) centers.set(list[0][0], [0, 8]);
      const rx = W * (middle ? 0.35 : 0.27);
      const ry = H * (middle ? 0.3 : 0.24);
      ring.forEach(([t], k) => {
        const a = -2.5 + (k * Math.PI * 2) / ring.length;
        centers.set(t, [Math.cos(a) * rx, Math.sin(a) * ry]);
      });
    }
    const sp = Math.max(52, Math.min(70, W / 22));
    for (const [t, g] of list) {
      g.sort((a, b) => b.date - a.date);
      const [cx, cy] = centers.get(t)!;
      g.forEach((n, j) => {
        const r = sp * Math.sqrt(j);
        const a = j * GOLDEN;
        n.wx = cx + Math.cos(a) * r * 1.3;
        n.wy = cy + Math.sin(a) * r * 0.95;
      });
    }
    // Cards that leave drift outward from where they are.
    for (const n of nodes) {
      if (n.on) continue;
      n.wx = (n.x - W / 2 - panX) / zoom * 1.25;
      n.wy = (n.y - H / 2 - panY) / zoom * 1.25;
    }
  };

  const sizeOf = (n: Node) => {
    const base = Math.max(0.72, Math.min(1.35, 0.9 + (zoom - 1) * 0.45));
    let s = base;
    if (impactMode) s *= n.impact < 6 ? 1.3 : n.impact < 14 ? 1.1 : 0.88;
    if (!n.on) s *= 0.5;
    return s;
  };

  const write = () => {
    for (const n of nodes) {
      n.el.style.transform = `translate3d(${(n.x - (n.w * n.s) / 2).toFixed(1)}px, ${(n.y - (n.h * n.s) / 2).toFixed(1)}px, 0) scale(${n.s.toFixed(3)})`;
    }
    // Constellations: a glow, a name above, and a line through the posts
    // in the order they were written.
    const groups = new Map<string, Node[]>();
    for (const n of nodes) {
      if (!n.on) continue;
      if (!groups.has(n.tag)) groups.set(n.tag, []);
      groups.get(n.tag)!.push(n);
    }
    glows.forEach((el, t) => {
      const g = groups.get(t);
      el.classList.toggle("is-off", !g);
      names.get(t)?.classList.toggle("is-off", !g);
      lines.get(t)?.classList.toggle("is-off", !g || g.length < 2);
      if (!g) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0;
      for (const n of g) {
        const hw = (n.w * n.s) / 2;
        const hh = (n.h * n.s) / 2;
        x0 = Math.min(x0, n.x - hw);
        x1 = Math.max(x1, n.x + hw);
        y0 = Math.min(y0, n.y - hh);
        y1 = Math.max(y1, n.y + hh);
        sx += n.x;
      }
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const size = Math.max(x1 - x0, y1 - y0) * 1.5 + 220;
      el.style.transform = `translate3d(${(cx - size / 2).toFixed(1)}px, ${(cy - size / 2).toFixed(1)}px, 0) scale(${(size / 10).toFixed(2)})`;
      const nw = nameW.get(t) || 90;
      const name = names.get(t);
      if (name) name.style.transform = `translate3d(${(sx / g.length - nw / 2).toFixed(1)}px, ${(y0 - 36).toFixed(1)}px, 0)`;
      const line = lines.get(t);
      if (line && g.length > 1) {
        const pts = [...g].sort((a, b) => b.date - a.date).map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(" ");
        line.setAttribute("points", pts);
      }
    });
  };

  // One physics step: springs toward targets, then the cards push apart.
  const step = () => {
    const cx = W / 2;
    const cy = H / 2 + 16;
    let energy = 0;
    for (const n of nodes) {
      const tx = cx + n.wx * zoom + panX;
      const ty = cy + n.wy * zoom + panY;
      const k = n.open ? 0.02 : 0.055;
      n.vx = (n.vx + (tx - n.x) * k) * 0.78;
      n.vy = (n.vy + (ty - n.y) * k) * 0.78;
      n.x += n.vx;
      n.y += n.vy;
      n.ts = sizeOf(n);
      n.s += (n.ts - n.s) * 0.18;
      energy += Math.abs(n.vx) + Math.abs(n.vy) + Math.abs(n.ts - n.s) * 40;
    }
    const act = nodes.filter((n) => n.on);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < act.length; i++) {
        const a = act[i];
        for (let j = i + 1; j < act.length; j++) {
          const b = act[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const ox = (a.w * a.s + b.w * b.s) / 2 + GAP - Math.abs(dx);
          if (ox <= 0) continue;
          const oy = (a.h * a.s + b.h * b.s) / 2 + GAP - Math.abs(dy);
          if (oy <= 0) continue;
          // An open card holds its place; the others make room.
          const wa = a.open ? 0 : b.open ? 1 : 0.5;
          const wb = 1 - wa;
          if (ox < oy) {
            const sgn = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
            a.x -= sgn * ox * wa;
            b.x += sgn * ox * wb;
          } else {
            const sgn = dy === 0 ? (j % 2 ? 1 : -1) : Math.sign(dy);
            a.y -= sgn * oy * wa;
            b.y += sgn * oy * wb;
          }
          energy += Math.min(ox, oy) * 0.2;
        }
      }
    }
    return energy;
  };

  const frame = () => {
    raf = 0;
    if (!shown || !onScreen) return;
    const energy = step();
    write();
    if (energy > 0.4) awake = 30;
    if (--awake > 0 || reduce) {
      if (!reduce) raf = requestAnimationFrame(frame);
    }
  };
  const wake = () => {
    awake = 60;
    if (reduce) {
      // No motion: settle at once.
      for (let i = 0; i < 160; i++) step();
      for (const n of nodes) n.s = n.ts;
      write();
      return;
    }
    if (!raf && shown && onScreen) raf = requestAnimationFrame(frame);
  };

  const bloom = () => {
    if (bloomed) return;
    bloomed = true;
    measure();
    layout();
    // Everything starts in the middle and blooms out into constellations.
    for (const n of nodes) {
      n.x = W / 2 + (Math.random() - 0.5) * 40;
      n.y = H / 2 + (Math.random() - 0.5) * 30;
      n.s = 0.2;
    }
    mapEl.classList.add("is-live");
    wake();
  };

  const io = new IntersectionObserver(
    ([en]) => {
      onScreen = en.isIntersecting;
      if (onScreen && shown) {
        if (!bloomed) bloom();
        else wake();
      }
    },
    { rootMargin: "0px 0px -20% 0px" },
  );
  io.observe(mapEl);
  const ro = new ResizeObserver(() => {
    if (!shown) return;
    measure();
    layout();
    wake();
  });
  ro.observe(mapEl);

  // Open a card: forward, wider, with its summary.
  const openNode = (n: Node, yes: boolean) => {
    if (n.open === yes) return;
    n.open = yes;
    n.el.classList.toggle("is-open", yes);
    n.w = n.link.offsetWidth;
    n.h = n.link.offsetHeight;
    if (!yes) n.link.style.removeProperty("--px"), n.link.style.removeProperty("--py");
    wake();
  };
  const nodeOf = (el: EventTarget | null) => {
    const star = (el as HTMLElement | null)?.closest?.(".ax-star");
    return star ? nodes.find((n) => n.el === star) : undefined;
  };
  mapEl.addEventListener(
    "pointerover",
    (e) => {
      const n = nodeOf(e.target);
      if (n && n.on) openNode(n, true);
    },
    { signal },
  );
  mapEl.addEventListener(
    "pointerout",
    (e) => {
      const n = nodeOf(e.target);
      if (!n) return;
      if (nodeOf(e.relatedTarget) === n) return;
      if (document.activeElement === n.link) return;
      openNode(n, false);
    },
    { signal },
  );
  // Depth inside the open card: the art and its glint move apart.
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
      if (!n) return;
      openNode(n, true);
      // Bring a card that is near an edge toward the middle.
      if (n.x < 100 || n.x > W - 100 || n.y < 110 || n.y > H - 110) {
        panX += W / 2 - n.x;
        panY += H / 2 - n.y;
        wake();
      }
    },
    { signal },
  );
  mapEl.addEventListener(
    "focusout",
    (e) => {
      const n = nodeOf(e.target);
      if (n && nodeOf(e.relatedTarget) !== n) openNode(n, false);
    },
    { signal },
  );

  // A click flies into the card, then the post opens.
  mapEl.addEventListener(
    "click",
    (e) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(".ax-node");
      if (!link || dragged) {
        if (dragged) e.preventDefault();
        return;
      }
      if (reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as MouseEvent).button !== 0) return;
      e.preventDefault();
      const art = link.querySelector<HTMLElement>(".ax-node-art");
      const img = link.querySelector<HTMLImageElement>("img");
      const r = (art || link).getBoundingClientRect();
      const fly = document.createElement("div");
      fly.className = "ax-fly";
      fly.style.left = `${r.left}px`;
      fly.style.top = `${r.top}px`;
      fly.style.width = `${r.width}px`;
      fly.style.height = `${r.height}px`;
      if (img?.currentSrc) fly.style.backgroundImage = `url("${img.currentSrc}")`;
      document.body.appendChild(fly);
      const sx = innerWidth / r.width;
      const sy = innerHeight / r.height;
      const s = Math.max(sx, sy);
      const dx = innerWidth / 2 - (r.left + r.width / 2);
      const dy = innerHeight / 2 - (r.top + r.height / 2);
      const anim = fly.animate(
        [
          { transform: "translate(0, 0) scale(1)", borderRadius: "14px", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, borderRadius: "0px", opacity: 1 },
        ],
        { duration: 520, easing: "cubic-bezier(0.7, 0, 0.2, 1)", fill: "forwards" },
      );
      mapEl.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.12)", opacity: 0.2 }], {
        duration: 520,
        easing: "cubic-bezier(0.7, 0, 0.2, 1)",
      });
      const href = link.href;
      anim.onfinish = () => {
        navigate(href);
        setTimeout(() => fly.remove(), 900);
      };
    },
    { signal },
  );

  // Pan by dragging the empty sky; zoom with the buttons, ctrl and scroll,
  // a pinch, or a double click.
  let dragging = false;
  let dragged = false;
  let lx = 0;
  let ly = 0;
  let moved = 0;
  mapEl.addEventListener(
    "pointerdown",
    (e) => {
      if ((e.target as HTMLElement).closest(".ax-zoom, .ax-name")) return;
      if (e.button !== 0) return;
      dragging = true;
      dragged = false;
      moved = 0;
      lx = e.clientX;
      ly = e.clientY;
    },
    { signal },
  );
  addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6 && !dragged) {
        dragged = true;
        mapEl.classList.add("is-dragging");
      }
      if (!dragged) return;
      panX += dx;
      panY += e.pointerType === "touch" ? 0 : dy;
      wake();
    },
    { passive: true, signal },
  );
  addEventListener(
    "pointerup",
    () => {
      dragging = false;
      mapEl.classList.remove("is-dragging");
      // Let the click that ends a drag be ignored, then forget it.
      setTimeout(() => (dragged = false), 0);
    },
    { signal },
  );
  const zoomAt = (factor: number, px: number, py: number) => {
    const z = Math.max(0.6, Math.min(2.2, zoom * factor));
    const cx = W / 2;
    const cy = H / 2 + 16;
    const wx = (px - cx - panX) / zoom;
    const wy = (py - cy - panY) / zoom;
    zoom = z;
    panX = px - cx - wx * zoom;
    panY = py - cy - wy * zoom;
    wake();
  };
  mapEl.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = mapEl.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false, signal },
  );
  mapEl.addEventListener(
    "dblclick",
    (e) => {
      if ((e.target as HTMLElement).closest(".ax-node, .ax-zoom, .ax-name")) return;
      const r = mapEl.getBoundingClientRect();
      zoomAt(1.4, e.clientX - r.left, e.clientY - r.top);
    },
    { signal },
  );
  mapEl.querySelectorAll<HTMLElement>(".ax-zbtn").forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        const z = b.dataset.zoom;
        if (z === "fit") {
          zoom = 1;
          panX = 0;
          panY = 0;
          wake();
        } else zoomAt(z === "in" ? 1.3 : 1 / 1.3, W / 2, H / 2);
      },
      { signal },
    ),
  );
  // Keyboard on the map itself: arrows pan, plus and minus zoom.
  mapEl.addEventListener(
    "keydown",
    (e) => {
      if ((e.target as HTMLElement).closest("input")) return;
      const k = e.key;
      const step = 60;
      if (k === "+" || k === "=") zoomAt(1.2, W / 2, H / 2);
      else if (k === "-") zoomAt(1 / 1.2, W / 2, H / 2);
      else if (e.target === mapEl && k.startsWith("Arrow")) {
        e.preventDefault();
        if (k === "ArrowLeft") panX += step;
        if (k === "ArrowRight") panX -= step;
        if (k === "ArrowUp") panY += step;
        if (k === "ArrowDown") panY -= step;
        wake();
      }
    },
    { signal },
  );
  void setTag;

  return {
    update(matches, impact) {
      impactMode = impact;
      for (const n of nodes) {
        const ok = matches(n.el);
        n.on = ok;
        n.el.classList.toggle("is-out", !ok);
        n.link.tabIndex = ok ? 0 : -1;
        if (ok) n.el.removeAttribute("aria-hidden");
        else n.el.setAttribute("aria-hidden", "true");
        if (!ok && n.open) openNode(n, false);
      }
      if (!shown) return;
      layout();
      wake();
    },
    show() {
      shown = true;
      requestAnimationFrame(() => {
        if (!shown) return;
        if (onScreen) {
          if (!bloomed) bloom();
          else {
            measure();
            layout();
            wake();
          }
        }
      });
    },
    hide() {
      shown = false;
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
