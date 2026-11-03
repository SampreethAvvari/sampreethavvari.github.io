// Sections arrive with depth. A block marked data-depth comes up out of the
// distance as it enters the screen and goes on past the camera as it leaves, tied
// to the scroll in both directions. Its place in the layout never changes: only
// a transform, and nothing at all once it is at rest.
//
// A paragraph marked data-words lights up word by word as it is read, and cards
// on the hub lean toward the pointer. Sound:
//   post:section    { index, id }   a section reached the middle of the screen
//   teaching:hover  { kind, id }    a material under the pointer (new, see below)

import { clamp, fxOn, isPhone, isTouch, onScrollFrame, smooth } from "../post-fx/util";

type Block = { el: HTMLElement; near: boolean; last: string };

export function mountDepth(signal: AbortSignal): void | (() => void) {
  const stops: Array<() => void> = [];

  // ---- Which section is on screen, for the score ---------------------------
  const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-ts-section]"));
  if (sections.length) {
    let current = -1;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const i = sections.indexOf(en.target as HTMLElement);
          if (i === current) continue;
          current = i;
          dispatchEvent(new CustomEvent("post:section", { detail: { index: i, id: (en.target as HTMLElement).dataset.tsSection || "" } }));
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    stops.push(() => io.disconnect());
  }

  mountCards(signal);

  // Stillness: the plain page.
  if (!fxOn()) return () => stops.forEach((s) => s());

  // ---- Words ---------------------------------------------------------------
  const paras = Array.from(document.querySelectorAll<HTMLElement>("[data-words]"));
  type Para = { el: HTMLElement; words: HTMLElement[]; lit: number };
  const lit: Para[] = paras.map((el) => {
    const text = el.textContent || "";
    const frag = document.createDocumentFragment();
    const words: HTMLElement[] = [];
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(" ");
        continue;
      }
      const s = document.createElement("span");
      s.className = "ts-w";
      s.textContent = part;
      words.push(s);
      frag.append(s);
    }
    el.textContent = "";
    el.append(frag);
    el.classList.add("is-split");
    return { el, words, lit: 0 };
  });

  // ---- Depth ---------------------------------------------------------------
  const blocks: Block[] = Array.from(document.querySelectorAll<HTMLElement>("[data-depth]")).map((el) => ({ el, near: false, last: "" }));
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const b = blocks.find((x) => x.el === en.target);
        if (b) b.near = en.isIntersecting;
      }
      queue();
    },
    { rootMargin: "40% 0px 40% 0px" },
  );
  blocks.forEach((b) => io.observe(b.el));
  stops.push(() => io.disconnect());

  const update = () => {
    const vh = innerHeight;
    const phone = isPhone();
    for (const b of blocks) {
      if (!b.near) continue;
      const r = b.el.getBoundingClientRect();
      // Layout position, without what this function has written. A transform
      // moves the box a little, which the plateau below is wide enough to hide.
      // Cards in one row do not all come at once.
      const top = r.top + (Number(b.el.style.getPropertyValue("--i")) || 0) * vh * 0.05;
      const bottom = r.bottom;
      const inT = 1 - clamp((top - vh * 0.62) / (vh * 0.42));
      const outT = clamp((vh * 0.14 - bottom) / (vh * 0.3));
      let t = "";
      let o = "";
      if (inT < 0.999) {
        const k = 1 - inT;
        o = smooth(0, 0.8, inT).toFixed(3);
        t = phone
          ? `translate3d(0, ${(k * 36).toFixed(1)}px, 0) scale(${(1 - k * 0.05).toFixed(4)})`
          : `perspective(1400px) translate3d(0, ${(k * 50).toFixed(1)}px, ${(-k * 300).toFixed(1)}px) rotateX(${(k * 9).toFixed(2)}deg)`;
      } else if (outT > 0.001) {
        o = (1 - smooth(0.1, 1, outT)).toFixed(3);
        t = phone
          ? `translate3d(0, ${(-outT * 18).toFixed(1)}px, 0)`
          : `perspective(1400px) translate3d(0, ${(-outT * 20).toFixed(1)}px, ${(outT * 170).toFixed(1)}px) rotateX(${(-outT * 5).toFixed(2)}deg)`;
      }
      const key = t + o;
      if (key !== b.last) {
        b.last = key;
        b.el.style.transform = t;
        b.el.style.opacity = o;
        b.el.classList.toggle("is-moving", !!t);
      }
    }
    for (const p of lit) {
      const r = p.el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) continue;
      // From when the block's top reaches 80% of the screen to when its end reaches 45%.
      const t = clamp((vh * 0.8 - r.top) / Math.max(1, r.height + vh * 0.35));
      const n = Math.round(smooth(0, 0.96, t) * p.words.length);
      if (n !== p.lit) {
        const a = Math.min(n, p.lit);
        const z = Math.max(n, p.lit);
        for (let i = a; i < z; i++) p.words[i].classList.toggle("is-lit", i < n);
        p.lit = n;
      }
    }
  };
  const queue = onScrollFrame(update, signal);
  queue();

  return () => {
    stops.forEach((s) => s());
    for (const b of blocks) {
      b.el.style.transform = "";
      b.el.style.opacity = "";
      b.el.classList.remove("is-moving");
    }
  };
}

/** A material on the hub leans toward the pointer, and its light follows. */
function mountCards(signal: AbortSignal) {
  const grid = document.querySelector<HTMLElement>("[data-ts-cards]");
  if (!grid || isTouch() || !fxOn()) return;
  let card: HTMLElement | null = null;
  let raf = 0;
  let tx = 0;
  let ty = 0;
  let sx = 0;
  let sy = 0;
  const frame = () => {
    raf = 0;
    if (!card) return;
    sx += (tx - sx) * 0.14;
    sy += (ty - sy) * 0.14;
    card.style.setProperty("--ry", `${(sx * 8).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${(-sy * 7).toFixed(2)}deg`);
    card.style.setProperty("--mx", `${(50 + sx * 50).toFixed(1)}%`);
    card.style.setProperty("--my", `${(50 + sy * 50).toFixed(1)}%`);
    if (Math.abs(tx - sx) > 0.002 || Math.abs(ty - sy) > 0.002) raf = requestAnimationFrame(frame);
  };
  const clear = (c: HTMLElement) => {
    c.classList.remove("is-near");
    ["--rx", "--ry", "--mx", "--my"].forEach((v) => c.style.removeProperty(v));
  };
  grid.addEventListener(
    "pointermove",
    (e) => {
      const c = (e.target as HTMLElement).closest<HTMLElement>(".tb-card");
      if (c !== card) {
        if (card) clear(card);
        card = c;
        if (card) {
          card.classList.add("is-near");
          dispatchEvent(new CustomEvent("teaching:hover", { detail: { kind: "card", id: card.dataset.slug || "" } }));
        }
        sx = 0;
        sy = 0;
      }
      if (!card) return;
      const r = card.getBoundingClientRect();
      tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true, signal },
  );
  grid.addEventListener(
    "pointerleave",
    () => {
      if (card) clear(card);
      card = null;
    },
    { passive: true, signal },
  );
  signal.addEventListener("abort", () => cancelAnimationFrame(raf));
}
