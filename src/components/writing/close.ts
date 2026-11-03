// The end of the writing page: the aurora grows with the scroll and leans to
// the pointer, the stars keep moving, the guide cards tilt and catch a glare,
// and the closing note's edge light follows the pointer. Everything here only
// writes CSS variables, while the section is on screen.
//
// Sound hook (nothing here plays audio), on window:
//   writing:hover { kind: "card", id, slug }  the pointer comes onto a guide

import { onPage } from "../../scripts/lifecycle";

const TILE = 1024;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function mountWritingClose(): void {
  onPage("writing-close", (signal) => {
    const wc = document.querySelector<HTMLElement>(".wc");
    if (!wc) return;
    // A cover's overlay appears once its art has arrived.
    wc.querySelectorAll<HTMLElement>(".wc-card").forEach((card) => {
      const img = card.querySelector<HTMLImageElement>("img");
      const ready = () => card.classList.add("is-art");
      if (!img || img.complete) ready();
      else img.addEventListener("load", ready, { once: true, signal });
    });
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const aurora = wc.querySelector<HTMLElement>(".wc-aurora");
    const far = wc.querySelector<HTMLElement>(".wc-stars-far");
    const near = wc.querySelector<HTMLElement>(".wc-stars-near");
    const note = wc.querySelector<HTMLElement>(".next-card");

    // Grows from when the section's top comes up the screen until it has
    // risen most of the way, so it keeps building while the guides pass.
    let queued = 0;
    let onScreen = false;
    const write = () => {
      queued = 0;
      const y = scrollY;
      far?.style.setProperty("--wc-far", `${(-(y * 0.1) % TILE).toFixed(1)}px`);
      near?.style.setProperty("--wc-near", `${(-(y * 0.34) % TILE).toFixed(1)}px`);
      const top = wc.getBoundingClientRect().top;
      const grow = clamp01((innerHeight - top) / (innerHeight * 1.5));
      aurora?.style.setProperty("--grow", (grow * grow * (3 - 2 * grow)).toFixed(3));
    };
    const onScroll = () => {
      if (onScreen && !queued) queued = requestAnimationFrame(write);
    };
    addEventListener("scroll", onScroll, { passive: true, signal });
    const io = new IntersectionObserver(([en]) => {
      onScreen = en.isIntersecting;
      wc.toggleAttribute("data-near", onScreen);
      if (onScreen) onScroll();
    });
    io.observe(wc);
    write();

    // The pointer: one listener for the section, one frame of writes at most.
    let move: PointerEvent | null = null;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const e = move;
      move = null;
      if (!e) return;
      aurora?.style.setProperty("--ax", ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
      aurora?.style.setProperty("--ay", ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
      if (e.pointerType === "touch") return;
      const t = e.target as HTMLElement;
      const card = t.closest?.<HTMLElement>(".wc-card");
      if (card) {
        const r = card.getBoundingClientRect();
        const u = (e.clientX - r.left) / r.width;
        const v = (e.clientY - r.top) / r.height;
        card.style.setProperty("--u", ((u - 0.5) * 2).toFixed(3));
        card.style.setProperty("--v", ((v - 0.5) * 2).toFixed(3));
        card.style.setProperty("--gx", `${(u * 100).toFixed(1)}%`);
        card.style.setProperty("--gy", `${(v * 100).toFixed(1)}%`);
        card.classList.add("is-lit");
      }
      if (note) {
        const r = note.getBoundingClientRect();
        note.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
        note.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
      }
    };
    wc.addEventListener(
      "pointermove",
      (e) => {
        move = e;
        if (!raf) raf = requestAnimationFrame(apply);
      },
      { passive: true, signal },
    );
    // A card goes back level when the pointer leaves it.
    wc.addEventListener(
      "pointerout",
      (e) => {
        const card = (e.target as HTMLElement).closest?.<HTMLElement>(".wc-card");
        if (!card || card.contains(e.relatedTarget as Node)) return;
        card.style.removeProperty("--u");
        card.style.removeProperty("--v");
        card.classList.remove("is-lit");
      },
      { signal },
    );
    wc.addEventListener(
      "pointerover",
      (e) => {
        if (e.pointerType === "touch") return;
        const card = (e.target as HTMLElement).closest?.<HTMLElement>(".wc-card");
        if (!card || card.contains(e.relatedTarget as Node)) return;
        dispatchEvent(new CustomEvent("writing:hover", { detail: { kind: "card", id: card.dataset.slug, slug: card.dataset.slug } }));
      },
      { passive: true, signal },
    );

    return () => {
      io.disconnect();
      cancelAnimationFrame(queued);
      cancelAnimationFrame(raf);
    };
  });
}
