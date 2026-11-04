// The reader. Pages are sheets of paper in the page's own flow, so the visitor
// scrolls the document itself: the sky flies behind the sheets, there is no second
// scrollbar, a phone keeps its momentum and its pinch. PDF.js draws each sheet to a
// canvas only as it comes near, and a sheet far from the screen gives its canvas
// back, so a long book costs the same as a short one.
//
// Everything here is imported when someone starts reading, and PDF.js itself is a
// plain file from this site, fetched at that moment. Every page also exists as a
// picture made ahead of time, so a sheet reads the moment its picture comes, however
// long PDF.js and the file take. The canvas then takes its place, unseen, and brings
// the selectable words, the links and the deep zoom with it.
//
// Sound hooks, on window:
//   post:figure   { id: "viewer", action: "open" | "close" }  the book opened or closed
//   teaching:page { page, total }  the page being read changed (new)
//   teaching:hover { kind: "star", id }  a chapter under the pointer (new)

import pdfUrl from "pdfjs-dist/legacy/build/pdf.min.mjs?url";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { clamp, h, reduced } from "../post-fx/util";

type Lib = typeof import("pdfjs-dist");

let libP: Promise<Lib> | null = null;
function loadLib(): Promise<Lib> {
  if (!libP) {
    libP = (import(/* @vite-ignore */ pdfUrl) as Promise<Lib>).then((m) => {
      m.GlobalWorkerOptions.workerSrc = workerUrl;
      return m;
    });
    libP.catch(() => (libP = null));
  }
  return libP;
}

// The widths scripts/make-teaching-pages.mjs draws each page at.
const PICTURE_WIDTHS = [900, 1240, 1760];
const pictureUrl = (base: string, n: number, cssWidth: number) => {
  const want = cssWidth * Math.min(devicePixelRatio || 1, 3);
  const w = PICTURE_WIDTHS.find((x) => x >= want * 0.9) ?? PICTURE_WIDTHS[PICTURE_WIDTHS.length - 1];
  return `${base}/${n}-${w}.avif`;
};

/** The visitor has come to the stack: into the cache ahead of the press, not run. */
export function warmReader(root?: HTMLElement) {
  for (const url of [pdfUrl, workerUrl]) fetch(url, { priority: "low" } as RequestInit).catch(() => {});
  const base = root?.dataset.pictures;
  if (!root || !base) return;
  // The first page, at the size the reader will show it.
  const cw = root.clientWidth;
  const refW = 595;
  const css = cw < PHONE_MAX ? ((cw - 8) / (refW - PHONE_CROP * 2)) * refW : Math.min(cw - (cw < 1024 ? 48 : 96), 880);
  const img = new Image();
  img.decoding = "async";
  img.src = pictureUrl(base, 1, css);
}

export type Reader = { reveal: () => void; close: () => void; destroy: () => void };

type Sheet = {
  n: number;
  el: HTMLElement;
  inner: HTMLElement;
  pw: number;
  ph: number;
  crop: number;
  k: number; // css pixels per PDF point
  doneK: number;
  canvas: HTMLCanvasElement | null;
  task: RenderTask | null;
  busy: boolean;
  page: PDFPageProxy | null;
  text: HTMLElement | null;
  textBusy: boolean;
  links: HTMLElement | null;
  ghost: HTMLElement | null;
  pic: HTMLImageElement | null;
  lean: string;
};

const ZOOMS = [0.6, 0.75, 0.9, 1, 1.25, 1.5, 2, 2.5];
const PHONE_ZOOMS = [1, 1.35, 1.7, 2.2, 2.8];
// On a phone the page's outer margins go, so the words get the whole width. The
// text in these books starts 48 points in and the boxes 46, so 40 is safe.
const PHONE_CROP = 40;
const PHONE_MAX = 640;

const ICON = (d: string, w = 2) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const ICONS = {
  prev: ICON("M15 18l-6-6 6-6"),
  next: ICON("M9 18l6-6-6-6"),
  out: ICON("M5 12h14"),
  in: ICON("M12 5v14M5 12h14"),
  full: ICON("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"),
  exit: ICON("M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"),
  tab: ICON("M7 17 17 7m0 0H8m9 0v9"),
  close: ICON("M6 6l12 12M18 6 6 18"),
};

export function openReader(
  root: HTMLElement,
  opts: { signal: AbortSignal; resume: boolean; onClose: () => void },
): Reader {
  const file = root.dataset.file || "";
  const slug = root.dataset.slug || "";
  const title = root.dataset.title || "";
  const dims = JSON.parse(root.dataset.dims || "null") as { pages: number; w: number; h: number; odd: Record<string, [number, number]> } | null;
  const still = reduced();
  const finePointer = matchMedia("(pointer: fine)").matches;
  const STORE = `tr-page:${slug}`;
  const OPEN = `tr-open:${slug}`;
  const docRoot = document.documentElement;
  let pictures = root.dataset.pictures || "";
  // PDF.js waits its turn for the first picture, so on a slow connection the page the
  // reader is looking at goes first. Never for long: the two do not depend on each other.
  let pictureCame = () => {};
  const firstPicture = new Promise<void>((resolve) => {
    if (!pictures) return resolve();
    pictureCame = resolve;
    setTimeout(resolve, 1500);
  });

  const life = new AbortController();
  const signal = life.signal;
  opts.signal.addEventListener("abort", () => destroy(), { once: true });

  let lib: Lib | null = null;
  let task: PDFDocumentLoadingTask | null = null;
  let doc: PDFDocumentProxy | null = null;
  let dead = false;
  let zoom = 1;
  let total = dims?.pages ?? 1;
  let current = 1;
  let lastPosted = 0;
  let isFull = false;
  let pseudoFull = false;
  let phone = false;
  let wide = false;

  // The page's fly in scales the whole article about its middle. The book is about to
  // make that article very tall, which would throw every measure below off by pages, so
  // a press during the fly in ends it.
  for (let e: HTMLElement | null = root; e; e = e.parentElement) {
    for (const a of e.getAnimations()) {
      try {
        a.finish();
      } catch {
        /* one that never ends: nothing here runs like that */
      }
    }
  }

  // ---- The parts -----------------------------------------------------------
  const stackLeaf = root.querySelector<HTMLElement>(".tr-leaf-top");
  const firstImg = stackLeaf?.querySelector<HTMLImageElement>("img");
  const fromRect = stackLeaf?.getBoundingClientRect();

  const col = h("div", "tr-col");
  col.setAttribute("role", "document");
  col.setAttribute("aria-label", title);
  const sheets: Sheet[] = [];
  const makeSheet = (n: number, size: [number, number]): Sheet => {
    const el = h("div", "tr-page");
    el.dataset.n = String(n);
    const inner = h("div", "tr-page-in");
    const no = h("span", "tr-page-no", String(n));
    no.setAttribute("aria-hidden", "true");
    el.append(no, inner);
    const s: Sheet = { n, el, inner, pw: size[0], ph: size[1], crop: 0, k: 1, doneK: 0, canvas: null, task: null, busy: false, page: null, text: null, textBusy: false, links: null, ghost: null, pic: null, lean: "" };
    return s;
  };
  const sizeOf = (n: number): [number, number] => dims?.odd?.[n] ?? [dims?.w ?? 595.28, dims?.h ?? 841.89];
  for (let n = 1; n <= total; n++) sheets.push(makeSheet(n, sizeOf(n)));
  col.append(...sheets.map((s) => s.el));

  // The stack's top page holds the first sheet until PDF.js has drawn it.
  if (firstImg && sheets[0]) {
    const ghost = h("div", "tr-page-ghost");
    const img = h("img");
    img.src = firstImg.currentSrc || firstImg.src;
    img.alt = "";
    ghost.append(img);
    sheets[0].ghost = ghost;
    sheets[0].inner.append(ghost);
  }

  const hud = h("div", "tr-hud");
  hud.setAttribute("role", "toolbar");
  hud.setAttribute("aria-label", "Reader");
  const btn = (act: string, label: string, icon: string, cls = "") => {
    const b = h("button", `tr-b no-lift ${cls}`.trim());
    b.type = "button";
    b.dataset.act = act;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = icon;
    return b;
  };
  const input = h("input", "tr-count-in");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Page");
  input.value = "1";
  const totalEl = h("span", "tr-count-of tabular", `/ ${total}`);
  const count = h("label", "tr-count");
  count.append(input, totalEl);
  const zoomEl = h("output", "tr-zoom tabular", "100%");
  const fullBtn = btn("full", "Full screen", ICONS.full, "tr-b-full");
  const tab = h("a", "tr-b tr-b-tab no-lift");
  tab.href = file;
  tab.target = "_blank";
  tab.rel = "noopener";
  tab.setAttribute("aria-label", "Open in a new tab");
  tab.title = "Open in a new tab";
  tab.innerHTML = ICONS.tab;
  const seg = (...kids: Array<HTMLElement>) => {
    const d = h("div", "tr-seg");
    d.append(...kids);
    return d;
  };
  const prog = h("i", "tr-prog");
  hud.append(
    seg(btn("prev", "Previous page", ICONS.prev), count, btn("next", "Next page", ICONS.next)),
    seg(btn("out", "Zoom out", ICONS.out), zoomEl, btn("in", "Zoom in", ICONS.in)),
    seg(fullBtn, tab, btn("close", "Close the book", ICONS.close)),
    prog,
  );

  const rail = h("nav", "tr-rail");
  rail.setAttribute("aria-label", "Chapters");
  const railFill = h("i", "tr-rail-fill");
  const railLine = h("span", "tr-rail-line");
  railLine.append(railFill);
  rail.append(railLine);
  type Chapter = { page: number; el: HTMLButtonElement };
  let chapters: Chapter[] = [];

  root.append(col, hud, rail);
  root.classList.add("is-open");
  try {
    sessionStorage.setItem(OPEN, "1");
  } catch {
    /* no note, no matter */
  }
  dispatchEvent(new CustomEvent("post:figure", { detail: { id: "viewer", action: "open" } }));

  // ---- Layout --------------------------------------------------------------
  const scroller = (): HTMLElement | Window => (isFull ? root : window);
  const scrollBy = (dy: number) => {
    if (isFull) root.scrollBy({ top: dy, behavior: "instant" as ScrollBehavior });
    else window.scrollBy({ top: dy, behavior: "instant" as ScrollBehavior });
  };

  function layout() {
    const cw = isFull ? root.clientWidth : col.parentElement?.clientWidth || innerWidth;
    phone = cw < PHONE_MAX;
    // A phone turned on its side keeps its zoom only if the wider list has it.
    const zooms = phone ? PHONE_ZOOMS : ZOOMS;
    if (zoom < zooms[0] || zoom > zooms[zooms.length - 1]) zoom = 1;
    const refW = sheets[0] ? Math.min(sheets[0].pw, sheets[0].ph) : 595;
    const crop = phone ? PHONE_CROP : 0;
    const gutter = cw < 1024 ? 24 : 48;
    const base = phone ? cw - 8 : Math.min(cw - gutter * 2, isFull ? 1040 : 880);
    const u = (base / (refW - crop * 2)) * zoom;
    wide = false;
    for (const s of sheets) {
      s.crop = s.pw < s.ph ? crop : 0;
      let k = u;
      const w = (s.pw - s.crop * 2) * k;
      // A wide page at reading size: as large as the screen allows, the same zoom on top.
      if (w > cw - 8 && zoom <= 1) k *= (cw - 8) / w;
      s.k = k;
      const cssW = Math.round((s.pw - s.crop * 2) * k);
      if (cssW > cw - 2) wide = true;
      s.el.style.width = `${cssW}px`;
      s.el.style.height = `${Math.round(s.ph * k)}px`;
      s.inner.style.width = `${(s.pw * k).toFixed(2)}px`;
      s.inner.style.height = `${(s.ph * k).toFixed(2)}px`;
      s.inner.style.left = `${(-s.crop * k).toFixed(2)}px`;
      s.inner.style.setProperty("--scale-factor", String(k));
    }
    col.classList.toggle("is-wide", wide);
    zoomEl.textContent = `${Math.round(zoom * 100)}%`;
    hud.querySelector<HTMLButtonElement>('[data-act="out"]')!.disabled = zoom <= zooms[0];
    hud.querySelector<HTMLButtonElement>('[data-act="in"]')!.disabled = zoom >= zooms[zooms.length - 1];
  }

  /** Change the sizes and keep the same words under the reader's eye. */
  function keepPlace(change: () => void) {
    const line = innerHeight * 0.42;
    const s = sheets[current - 1];
    if (!s) return change();
    const a = s.el.getBoundingClientRect();
    const f = (line - a.top) / Math.max(1, a.height);
    const x = col.scrollLeft;
    change();
    const b = s.el.getBoundingClientRect();
    scrollBy(b.top + f * b.height - line);
    col.scrollLeft = wide ? (col.scrollWidth - col.clientWidth) / 2 : x;
  }

  // ---- Painting ------------------------------------------------------------
  // A sheet near the screen wears its picture until its canvas is ready. A browser
  // without AVIF, or a picture that does not come, just waits for the canvas.
  const dress = (s: Sheet) => {
    if (!pictures || s.canvas || s.pic) return;
    if (!s.ghost) {
      s.ghost = h("div", "tr-page-ghost");
      s.inner.append(s.ghost);
    }
    const img = h("img", "tr-page-pic");
    img.alt = "";
    img.decoding = "async";
    if (s.n === current) img.setAttribute("fetchpriority", "high");
    img.addEventListener(
      "load",
      () => {
        const show = () => img.classList.add("is-in");
        img.decode().then(show, show);
        pictureCame();
      },
      { once: true },
    );
    img.addEventListener(
      "error",
      () => {
        img.remove();
        if (s.pic === img) s.pic = null;
        pictures = "";
        pictureCame();
      },
      { once: true },
    );
    img.src = pictureUrl(pictures, s.n, s.pw * s.k);
    s.pic = img;
    s.ghost.append(img);
  };
  const undress = (s: Sheet) => {
    s.ghost?.remove();
    s.ghost = null;
    s.pic = null;
  };

  const near = new Set<Sheet>();
  let io: IntersectionObserver | null = null;
  const watch = () => {
    io?.disconnect();
    near.clear();
    io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const s = sheets[Number((en.target as HTMLElement).dataset.n) - 1];
          if (!s) continue;
          if (en.isIntersecting) {
            near.add(s);
            dress(s);
          } else {
            near.delete(s);
            flatten(s);
            if (!s.canvas) undress(s);
          }
        }
        queue();
        pump();
      },
      { root: isFull ? root : null, rootMargin: phone ? "90% 0px" : "130% 0px" },
    );
    sheets.forEach((s) => io!.observe(s.el));
  };

  const ratio = (s: Sheet) => {
    const d = devicePixelRatio || 1;
    const r = Math.min(d, phone ? 2.5 : 2);
    const area = s.pw * s.k * s.ph * s.k * r * r;
    const cap = (phone ? 2.2 : 6) * 1e6;
    return area > cap ? r * Math.sqrt(cap / area) : r;
  };
  const freeCanvas = (c: HTMLCanvasElement | null) => {
    if (!c) return;
    // Zero first: Safari keeps a removed canvas's memory for a while otherwise.
    c.width = 0;
    c.height = 0;
    c.remove();
  };
  const release = (s: Sheet) => {
    s.task?.cancel();
    s.task = null;
    freeCanvas(s.canvas);
    s.canvas = null;
    s.doneK = 0;
    s.text?.remove();
    s.text = null;
    s.links?.remove();
    s.links = null;
    s.page?.cleanup();
    s.page = null;
  };

  let painting = 0;
  const maxPaint = 1;
  const keep = () => (phone ? 2 : 3);
  function pump() {
    if (dead || !doc) return;
    // Pages far from the reader give their memory back.
    for (const s of sheets) {
      if ((s.canvas || s.task) && !near.has(s) && Math.abs(s.n - current) > keep()) release(s);
    }
    while (painting < maxPaint) {
      const next = [...near]
        .filter((s) => !s.busy && s.doneK !== s.k)
        .sort((a, b) => Math.abs(a.n - current) - Math.abs(b.n - current))[0];
      if (!next) break;
      void paint(next);
    }
  }

  async function paint(s: Sheet) {
    s.busy = true;
    painting++;
    const k = s.k;
    try {
      const page = s.page ?? (s.page = await doc!.getPage(s.n));
      if (dead) return;
      const vp = page.getViewport({ scale: k * ratio(s) });
      const c = h("canvas", "tr-canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext("2d", { alpha: false });
      if (!ctx) return;
      s.task = page.render({ canvasContext: ctx, viewport: vp, background: "#fff" });
      await s.task.promise;
      s.task = null;
      if (dead) {
        freeCanvas(c);
        return;
      }
      // The old one stays until the new one is ready, so a zoom never flashes.
      const old = s.canvas;
      s.canvas = c;
      s.doneK = k;
      // Over a picture of itself the canvas needs no fade: the swap should not show.
      const ghost = s.ghost;
      if (ghost) c.style.animation = "none";
      s.inner.prepend(c);
      freeCanvas(old);
      s.ghost = null;
      s.pic = null;
      if (ghost) requestAnimationFrame(() => ghost.remove());
      s.el.classList.add("is-drawn");
      wordsSoon();
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "RenderingCancelledException") console.warn("reader: page", s.n, err);
    } finally {
      s.busy = false;
      painting--;
      pump();
    }
  }

  // Measuring a page's words is the costliest thing here, so it waits until the
  // scroll has rested: nothing is gained by doing it for pages flying past.
  let wordsTimer = 0;
  function wordsSoon() {
    clearTimeout(wordsTimer);
    wordsTimer = window.setTimeout(() => {
      if (dead) return;
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      const run = () => {
        if (dead) return;
        const now = current;
        const list = [now, now + 1, now - 1].map((n) => sheets[n - 1]).filter((x): x is Sheet => !!x && !!x.canvas);
        const next = list.find((x) => !x.text || x.text.dataset.k !== String(x.k));
        if (next) void words(next).then(wordsSoon);
      };
      if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 700 });
      else run();
    }, 220);
  }

  /** The words over the canvas, invisible, so they can be selected and read aloud; and the book's own links. */
  async function words(s: Sheet) {
    if (!s.page || !lib || s.textBusy) return;
    if (Math.abs(s.n - current) > (phone ? 1 : 2)) return;
    const page = s.page;
    const k = s.k;
    if (s.text && s.text.dataset.k === String(k)) return;
    s.textBusy = true;
    try {
      const vp = page.getViewport({ scale: k });
      const tc = await page.getTextContent({ includeMarkedContent: false, disableNormalization: true });
      if (dead || s.page !== page) return;
      const layer = h("div", "textLayer");
      layer.dataset.k = String(k);
      const tl = new lib.TextLayer({ textContentSource: tc, container: layer, viewport: vp });
      await tl.render();
      if (dead || s.page !== page) return;
      s.text?.remove();
      s.text = layer;
      s.inner.append(layer);

      const ann = await page.getAnnotations({ intent: "display" });
      if (dead || s.page !== page) return;
      s.links?.remove();
      const links = h("div", "tr-links");
      for (const a of ann) {
        if (a.subtype !== "Link" || (!a.dest && !a.url)) continue;
        const r = vp.convertToViewportRectangle(a.rect);
        const link = h("a", "tr-link");
        link.style.left = `${Math.min(r[0], r[2]).toFixed(1)}px`;
        link.style.top = `${Math.min(r[1], r[3]).toFixed(1)}px`;
        link.style.width = `${Math.abs(r[2] - r[0]).toFixed(1)}px`;
        link.style.height = `${Math.abs(r[3] - r[1]).toFixed(1)}px`;
        if (a.url) {
          link.href = a.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        } else {
          link.href = "#read";
          link.setAttribute("aria-label", "Go to this part of the book");
          link.addEventListener("click", (e) => {
            e.preventDefault();
            void follow(a.dest);
          });
        }
        links.append(link);
      }
      s.links = links;
      s.inner.append(links);
    } catch {
      /* the page still reads as a picture */
    } finally {
      s.textBusy = false;
    }
  }

  async function follow(dest: unknown) {
    if (!doc) return;
    const n = await pageOfDest(dest);
    if (n) goTo(n);
  }
  async function pageOfDest(dest: unknown): Promise<number | null> {
    if (!doc) return null;
    try {
      const d = typeof dest === "string" ? await doc.getDestination(dest) : (dest as unknown[]);
      if (!d) return null;
      const i = await doc.getPageIndex(d[0] as never);
      return i + 1;
    } catch {
      return null;
    }
  }

  // ---- Going through it ----------------------------------------------------
  function setCurrent(n: number) {
    if (n === current && lastPosted) return;
    current = n;
    if (document.activeElement !== input) input.value = String(n);
    prog.style.transform = `scaleX(${(total > 1 ? (n - 1) / (total - 1) : 1).toFixed(4)})`;
    if (lastPosted !== n) {
      lastPosted = n;
      dispatchEvent(new CustomEvent("teaching:page", { detail: { page: n, total } }));
    }
    saveSoon();
    markRail();
    pump();
    wordsSoon();
    for (const o of sheets) {
      if ((o.text || o.links) && Math.abs(o.n - n) > (phone ? 2 : 3)) {
        o.text?.remove();
        o.text = null;
        o.links?.remove();
        o.links = null;
      }
    }
  }
  let saveTimer = 0;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        if (current >= total) localStorage.removeItem(STORE);
        else localStorage.setItem(STORE, String(current));
      } catch {
        /* the place is just not remembered */
      }
    }, 500);
  };

  let goal = 0;
  let goalUntil = 0;
  function goTo(n: number, instant = false) {
    n = clamp(Math.round(n), 1, total);
    const s = sheets[n - 1];
    if (!s) return;
    const far = Math.abs(n - current) > 3;
    const glide = !(instant || far || still);
    s.el.scrollIntoView({ block: "start", behavior: (glide ? "smooth" : "instant") as ScrollBehavior });
    // While it glides there the count stays on the page it is going to.
    goal = n;
    goalUntil = performance.now() + (glide ? 900 : 200);
    setCurrent(n);
  }

  // The sheet in the reader's eye, and the lean of the ones coming and going.
  let raf = 0;
  let lastScroll = 0;
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(frame);
    wordsSoon();
  };
  const flatten = (s: Sheet) => {
    if (s.lean) {
      s.lean = "";
      s.el.style.transform = "";
      s.el.style.setProperty("--dim", "0");
    }
  };
  const canLean = () => !still && finePointer && !phone && !wide;
  function frame() {
    raf = 0;
    if (dead) return;
    const vh = isFull ? root.clientHeight : innerHeight;
    const line = vh * 0.42;
    let best = current;
    let bestD = Infinity;
    const lean = canLean();
    for (const s of near) {
      const r = s.el.getBoundingClientRect();
      const d = r.top <= line && r.bottom >= line ? 0 : Math.min(Math.abs(r.top - line), Math.abs(r.bottom - line));
      if (d < bestD) {
        bestD = d;
        best = s.n;
      }
      if (!lean) {
        flatten(s);
        continue;
      }
      // Flat while it fills the screen. Coming up from below it leans back and
      // is further off; going out over the top it tips toward the reader.
      const inT = clamp((r.top - vh * 0.58) / (vh * 0.42));
      const outT = clamp((vh * 0.16 - r.bottom) / (vh * 0.3));
      let t = "";
      let dim = 0;
      if (inT > 0.001) {
        t = `perspective(1500px) translateZ(${(-inT * 170).toFixed(1)}px) rotateX(${(inT * 15).toFixed(2)}deg)`;
        dim = inT * 0.55;
      } else if (outT > 0.001) {
        t = `perspective(1500px) translateZ(${(outT * 60).toFixed(1)}px) rotateX(${(-outT * 12).toFixed(2)}deg)`;
        dim = outT * 0.4;
      }
      if (t !== s.lean) {
        s.lean = t;
        s.el.style.transform = t;
        s.el.style.setProperty("--dim", dim.toFixed(3));
      }
    }
    // Right after a jump the watched sheets are still the old ones: wait for the new.
    if (performance.now() < goalUntil) best = goal;
    if (bestD < vh) setCurrent(best);
    railMove();

    // The bar steps aside while reading down and comes back on the way up.
    const y = isFull ? root.scrollTop : scrollY;
    const dy = y - lastScroll;
    lastScroll = y;
    if (reading && Math.abs(dy) > 3) docRoot.classList.toggle("tr-nav-away", dy > 0);
  }

  // ---- The bar and the keys ------------------------------------------------
  let reading = false;
  const seen = new IntersectionObserver(
    ([en]) => {
      reading = en.isIntersecting;
      hud.classList.toggle("is-on", reading);
      docRoot.classList.toggle("tr-reading", reading);
      if (!reading) docRoot.classList.remove("tr-nav-away");
      queue();
    },
    { rootMargin: "-20% 0px -35% 0px" },
  );
  seen.observe(col);

  const setZoom = (next: number) => {
    if (next === zoom) return;
    zoom = next;
    keepPlace(layout);
    pump();
    queue();
  };
  /** One step up or down the list, from wherever the zoom is now. */
  const stepZoom = (dir: 1 | -1) => {
    const zooms = phone ? PHONE_ZOOMS : ZOOMS;
    const next = dir > 0 ? zooms.find((z) => z > zoom) : [...zooms].reverse().find((z) => z < zoom);
    if (next !== undefined) setZoom(next);
  };
  const toggleFull = async () => {
    if (isFull) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      else setFull(false, true);
      return;
    }
    if (root.requestFullscreen && document.fullscreenEnabled) {
      try {
        await root.requestFullscreen();
        return;
      } catch {
        /* a phone that says no gets the same thing without the browser's help */
      }
    }
    setFull(true, true);
  };
  function setFull(on: boolean, pseudo: boolean) {
    if (on === isFull) return;
    const keepN = current;
    isFull = on;
    pseudoFull = on && pseudo;
    root.classList.toggle("is-full", on);
    root.classList.toggle("is-pseudo", pseudoFull);
    docRoot.classList.toggle("tr-full", on);
    docRoot.classList.remove("tr-nav-away");
    fullBtn.innerHTML = on ? ICONS.exit : ICONS.full;
    fullBtn.setAttribute("aria-label", on ? "Leave full screen" : "Full screen");
    fullBtn.title = on ? "Leave full screen" : "Full screen";
    layout();
    watch();
    requestAnimationFrame(() => {
      if (dead) return;
      const s = sheets[keepN - 1];
      s?.el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
      lastScroll = isFull ? root.scrollTop : scrollY;
      pump();
      queue();
    });
  }
  document.addEventListener(
    "fullscreenchange",
    () => {
      setFull(document.fullscreenElement === root, false);
    },
    { signal },
  );

  hud.addEventListener(
    "click",
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "prev") goTo(current - 1);
      else if (act === "next") goTo(current + 1);
      else if (act === "out") stepZoom(-1);
      else if (act === "in") stepZoom(1);
      else if (act === "full") void toggleFull();
      else if (act === "close") close();
    },
    { signal },
  );
  const jump = () => {
    const n = parseInt(input.value, 10);
    if (Number.isFinite(n)) goTo(n);
    else input.value = String(current);
  };
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      jump();
      input.blur();
    } else if (e.key === "Escape") {
      input.value = String(current);
      input.blur();
    }
  });
  input.addEventListener("focus", () => input.select());
  input.addEventListener("blur", () => {
    if (parseInt(input.value, 10) !== current) jump();
  });

  addEventListener(
    "keydown",
    (e) => {
      if (!reading && !isFull) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable], [role='dialog'], .tm-modal")) return;
      if (document.querySelector(".tm-modal")) return;
      const key = e.key;
      if (key === "ArrowLeft") {
        e.preventDefault();
        goTo(current - 1);
      } else if (key === "ArrowRight") {
        e.preventDefault();
        goTo(current + 1);
      } else if (key === "+" || key === "=") stepZoom(1);
      else if (key === "-") stepZoom(-1);
      else if (key === "0") setZoom(1);
      else if (key === "f" || key === "F") void toggleFull();
      else if (key === "Escape" && pseudoFull) setFull(false, true);
    },
    { signal },
  );

  // ---- Pulling a zoomed page around with the mouse -------------------------
  let drag: { x: number; y: number } | null = null;
  col.addEventListener(
    "pointerdown",
    (e) => {
      if (!wide || e.pointerType !== "mouse" || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("a")) return;
      drag = { x: e.clientX, y: e.clientY };
      col.classList.add("is-dragging");
      col.setPointerCapture(e.pointerId);
    },
    { signal },
  );
  col.addEventListener(
    "pointermove",
    (e) => {
      if (!drag) return;
      col.scrollLeft -= e.clientX - drag.x;
      scrollBy(drag.y - e.clientY);
      drag = { x: e.clientX, y: e.clientY };
    },
    { signal, passive: true },
  );
  const endDrag = () => {
    drag = null;
    col.classList.remove("is-dragging");
  };
  col.addEventListener("pointerup", endDrag, { signal });
  col.addEventListener("pointercancel", endDrag, { signal });

  addEventListener("scroll", queue, { passive: true, signal });
  root.addEventListener("scroll", queue, { passive: true, signal });
  let lastW = innerWidth;
  addEventListener(
    "resize",
    () => {
      // A phone's bar sliding changes only the height, and needs nothing.
      if (innerWidth === lastW && !isFull) return;
      lastW = innerWidth;
      keepPlace(layout);
      pump();
      queue();
    },
    { passive: true, signal },
  );

  // ---- The chapters, from the book's own outline ---------------------------
  const clean = (t: string) =>
    t
      .replace(/\s+/g, " ")
      .replace(/\s*STATION\s.*$/, "")
      .replace(/\s*[\u2014\u2013]\s*/g, ": ")
      .trim();
  async function buildRail() {
    if (!doc || !finePointer || innerWidth < 1180) return;
    const outline = await doc.getOutline().catch(() => null);
    if (!outline || dead) return;
    const numbered = outline.filter((o) => /^\d+\s/.test(o.title));
    const list = numbered.length >= 4 ? numbered : outline;
    const found: { page: number; title: string }[] = [];
    for (const o of list) {
      const page = await pageOfDest(o.dest);
      if (dead) return;
      if (page) found.push({ page, title: clean(o.title) });
    }
    if (found.length < 2) return;
    chapters = found.map((c) => {
      const b = h("button", "tr-star no-lift");
      b.type = "button";
      b.tabIndex = -1;
      b.style.setProperty("--y", `${(((c.page - 1) / Math.max(1, total - 1)) * 100).toFixed(2)}%`);
      b.innerHTML = `<i aria-hidden="true"></i><span></span>`;
      b.querySelector("span")!.textContent = c.title;
      b.addEventListener("click", () => goTo(c.page), { signal });
      b.addEventListener("pointerenter", () => {
        dispatchEvent(new CustomEvent("teaching:hover", { detail: { kind: "star", id: c.title } }));
      }, { signal });
      rail.append(b);
      return { page: c.page, el: b };
    });
    rail.classList.add("is-ready");
    markRail();
  }
  function markRail() {
    railFill.style.transform = `scaleY(${(total > 1 ? (current - 1) / (total - 1) : 0).toFixed(4)})`;
    if (!chapters.length) return;
    let at = -1;
    for (let i = 0; i < chapters.length; i++) if (chapters[i].page <= current) at = i;
    chapters.forEach((c, i) => {
      c.el.classList.toggle("is-past", i < at);
      c.el.classList.toggle("is-now", i === at);
    });
  }
  function railMove() {
    rail.classList.toggle("is-on", reading);
  }

  // ---- Opening -------------------------------------------------------------
  layout();
  markRail();

  const savedPage = () => {
    try {
      const n = parseInt(localStorage.getItem(STORE) || "", 10);
      return Number.isFinite(n) && n > 1 && n <= total ? n : 0;
    } catch {
      return 0;
    }
  };
  const start = opts.resume ? savedPage() : 0;
  const pressed = savedPage();
  if (start > 1) {
    current = start;
    sheets[start - 1]?.el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
  } else if (!opts.resume) {
    // Out of the stack: the top page grows into the first sheet, the rest fly off.
    const target = pressed > 1 ? pressed : 1;
    current = target;
    if (target > 1) {
      sheets[target - 1]?.el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    } else {
      const head = root.querySelector<HTMLElement>(".tr-head");
      const y = (head ?? col).getBoundingClientRect().top + scrollY - (innerWidth < 900 ? 84 : 96);
      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    }
    if (!still && fromRect && target === 1) {
      const to = sheets[0].el.getBoundingClientRect();
      const sx = fromRect.width / to.width;
      const dx = fromRect.left - to.left;
      const dy = fromRect.top - to.top;
      sheets[0].el.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) perspective(1600px) rotateY(-14deg) scale(${sx.toFixed(4)})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: 820, easing: "cubic-bezier(0.22, 1, 0.3, 1)" },
      );
      sheets.slice(1, 4).forEach((s, i) => {
        s.el.animate(
          [
            { opacity: 0, transform: `translateY(${60 + i * 40}px) perspective(1500px) translateZ(-200px) rotateX(16deg)` },
            { opacity: 1, transform: "none" },
          ],
          { duration: 900, delay: 120 + i * 80, easing: "cubic-bezier(0.22, 1, 0.3, 1)", fill: "backwards" },
        );
      });
    }
  }
  setCurrent(current);
  lastScroll = scrollY;
  watch();
  queue();
  // The stack that had the focus has gone: the reading takes it.
  if (document.activeElement === document.body || root.querySelector(".tr-rest")?.contains(document.activeElement)) {
    col.tabIndex = -1;
    col.focus({ preventScroll: true });
  }

  const fail = () => {
    if (dead) return;
    destroy();
    root.dataset.plain = "1";
    root.classList.add("is-failed");
    try {
      sessionStorage.removeItem(OPEN);
    } catch {
      /* fine */
    }
    opts.onClose();
    // A desktop browser can still show the file itself. A phone often cannot, so
    // it gets the link, which the stack has been all along.
    if (innerWidth >= 900 && !root.querySelector(".tr-fallback")) {
      const fb = h("div", "tr-fallback");
      const frame = h("iframe");
      frame.src = `${file}#toolbar=0&navpanes=0&view=FitH`;
      frame.title = title;
      frame.loading = "lazy";
      fb.append(frame);
      root.append(fb);
    }
  };

  firstPicture
    .then(loadLib)
    .then(async (m) => {
      if (dead) return;
      lib = m;
      task = m.getDocument({
        url: file,
        isEvalSupported: false, // the site's policy has no unsafe-eval
        disableAutoFetch: true, // pages come as they are asked for
        disableStream: true,
        enableXfa: false,
        verbosity: 0,
      });
      const d = await task.promise;
      if (dead) {
        void d.destroy();
        return;
      }
      doc = d;
      // A book the build has not measured: read its pages from the file.
      if (d.numPages !== total || !dims) {
        const had = total;
        total = d.numPages;
        for (let n = had + 1; n <= total; n++) {
          const s = makeSheet(n, sizeOf(n));
          sheets.push(s);
          col.append(s.el);
        }
        while (sheets.length > total) sheets.pop()?.el.remove();
        totalEl.textContent = `/ ${total}`;
        const sizes = await Promise.all(sheets.map((s) => d.getPage(s.n).then((p) => p.getViewport({ scale: 1 }))));
        if (dead) return;
        sheets.forEach((s, i) => {
          s.pw = sizes[i].width;
          s.ph = sizes[i].height;
        });
        keepPlace(layout);
        watch();
      }
      pump();
      queue();
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(() => void buildRail(), { timeout: 2500 });
      else setTimeout(() => void buildRail(), 800);
    })
    .catch((err) => {
      console.warn("reader: could not open the book", err);
      // The pictures still read as the book. Without them, the plain way.
      if (!pictures) fail();
    });

  // ---- Closing -------------------------------------------------------------
  function destroy() {
    if (dead) return;
    dead = true;
    life.abort();
    cancelAnimationFrame(raf);
    clearTimeout(saveTimer);
    clearTimeout(wordsTimer);
    seen.disconnect();
    io?.disconnect();
    if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
    for (const s of sheets) release(s);
    task?.destroy().catch(() => {});
    task = null;
    doc = null;
    col.remove();
    hud.remove();
    rail.remove();
    root.classList.remove("is-open", "is-full", "is-pseudo");
    docRoot.classList.remove("tr-reading", "tr-nav-away", "tr-full");
  }
  function close() {
    try {
      sessionStorage.removeItem(OPEN);
    } catch {
      /* fine */
    }
    dispatchEvent(new CustomEvent("post:figure", { detail: { id: "viewer", action: "close" } }));
    destroy();
    opts.onClose();
    const head = root.querySelector<HTMLElement>(".tr-head");
    const y = (head ?? root).getBoundingClientRect().top + scrollY - (innerWidth < 900 ? 84 : 96);
    window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    // The stack comes back together.
    const stack = root.querySelector<HTMLElement>(".tr-stack");
    if (stack && !still) {
      stack.animate(
        [
          { opacity: 0, transform: "perspective(1500px) translateZ(220px) rotateX(-8deg)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 700, easing: "cubic-bezier(0.22, 1, 0.3, 1)" },
      );
    }
    (root.querySelector<HTMLElement>(".tr-open") ?? stack)?.focus({ preventScroll: true });
  }

  return {
    reveal: () => goTo(current, true),
    close,
    destroy,
  };
}
