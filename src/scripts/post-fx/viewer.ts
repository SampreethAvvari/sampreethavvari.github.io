// The picture viewer. A picture grows out of its place on the page, then the
// wheel, a pinch or the keys zoom it around the pointer, a drag pans it, and it
// goes back where it came from on close.
//
// Sound hook: post:figure { id: "viewer", action: "open" | "close" }

import { clamp, emit, h, reduced } from "./util";

const SOURCES = ".post-prose img, .pfx-art[data-zoom]";

export function mountViewer(signal: AbortSignal): void | (() => void) {
  const items = Array.from(document.querySelectorAll<HTMLElement>(SOURCES));
  if (!items.length) return;

  let layer: HTMLElement | null = null;
  let closeIt: (() => void) | null = null;

  const openFrom = (source: HTMLElement) => {
    if (layer) return;
    const img = source.tagName === "IMG" ? (source as HTMLImageElement) : source.querySelector<HTMLImageElement>("img");
    if (!img) return;
    const ext = img.currentSrc.endsWith(".avif") ? "avif" : "webp";
    const big = source.dataset.zoom && source.dataset.zoom !== "1" ? `${source.dataset.zoom}-2560.${ext}` : img.currentSrc || img.src;

    const back = document.activeElement as HTMLElement | null;
    const root = h("div", "pfx-view");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", img.alt || "Picture");
    root.tabIndex = -1;
    const shade = h("div", "pfx-view-shade");
    const stage = h("div", "pfx-view-stage");
    const pic = h("img", "pfx-view-img");
    pic.alt = img.alt;
    pic.draggable = false;
    pic.src = img.currentSrc || img.src;
    stage.append(pic);
    const x = h("button", "pfx-view-x");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    const hint = h("p", "pfx-view-hint", "Scroll to zoom · drag to move");
    root.append(shade, stage, x, hint);
    document.body.append(root);
    layer = root;
    emit("post:figure", { id: "viewer", action: "open" });

    const ia = (img.naturalWidth || 16) / (img.naturalHeight || 9);
    // Fit the picture to the window, then move and scale from there.
    let fitW = 1;
    let fitH = 1;
    const fit = () => {
      const W = innerWidth * (innerWidth < 700 ? 1 : 0.92);
      const H = innerHeight * 0.86;
      fitW = Math.min(W, H * ia);
      fitH = fitW / ia;
      pic.style.width = `${fitW}px`;
      pic.style.height = `${fitH}px`;
    };
    fit();
    let k = 1;
    let tx = 0;
    let ty = 0;
    const limit = () => {
      const mx = Math.max(0, (fitW * k - innerWidth * 0.8) / 2 + innerWidth * 0.1);
      const my = Math.max(0, (fitH * k - innerHeight * 0.8) / 2 + innerHeight * 0.1);
      tx = clamp(tx, -mx, mx);
      ty = clamp(ty, -my, my);
      if (k <= 1.001) {
        tx = 0;
        ty = 0;
      }
    };
    const write = () => {
      pic.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${k.toFixed(4)})`;
      root.classList.toggle("is-zoomed", k > 1.01);
    };
    const zoomAt = (nk: number, cx: number, cy: number) => {
      nk = clamp(nk, 1, 6);
      const ox = cx - innerWidth / 2;
      const oy = cy - innerHeight / 2;
      tx = ox - ((ox - tx) * nk) / k;
      ty = oy - ((oy - ty) * nk) / k;
      k = nk;
      limit();
      write();
    };
    write();

    // Out of its place on the page.
    const still = reduced();
    const fromRect = () => source.getBoundingClientRect();
    const flyKeys = (r: DOMRect) => {
      const sx = r.width / fitW;
      const dx = r.left + r.width / 2 - innerWidth / 2;
      const dy = r.top + r.height / 2 - innerHeight / 2;
      return `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(4)})`;
    };
    if (!still) {
      stage.animate(
        [{ transform: flyKeys(fromRect()), borderRadius: "20px" }, { transform: "none" }],
        { duration: 620, easing: "cubic-bezier(0.22, 1, 0.3, 1)" },
      );
      shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
    }
    // The large file swaps in once it has landed, so nothing flashes.
    if (big !== pic.src) {
      const hi = new Image();
      hi.onload = () => {
        if (layer === root) pic.src = big;
      };
      hi.src = big;
    }
    requestAnimationFrame(() => root.focus({ preventScroll: true }));

    const close = () => {
      if (!layer) return;
      layer = null;
      closeIt = null;
      emit("post:figure", { id: "viewer", action: "close" });
      const done = () => root.remove();
      if (still) done();
      else {
        k = 1;
        tx = 0;
        ty = 0;
        write();
        const a = stage.animate(
          [{ transform: "none" }, { transform: flyKeys(fromRect()) }],
          { duration: 420, easing: "cubic-bezier(0.5, 0, 0.2, 1)", fill: "forwards" },
        );
        shade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: "forwards" });
        x.style.opacity = "0";
        hint.style.opacity = "0";
        a.onfinish = done;
      }
      back?.focus?.({ preventScroll: true });
    };
    closeIt = close;

    x.addEventListener("click", close);

    // Wheel: zoom around the pointer. The page behind stays where it is.
    root.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        zoomAt(k * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
      },
      { passive: false },
    );

    // Pointers: one drags, two pinch. A click on the shade with no drag closes.
    const down = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;
    root.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".pfx-view-x")) return;
      down.set(e.pointerId, { x: e.clientX, y: e.clientY });
      root.setPointerCapture(e.pointerId);
      moved = 0;
      if (down.size === 2) {
        const [a, b] = [...down.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    root.addEventListener("pointermove", (e) => {
      const p = down.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      p.x = e.clientX;
      p.y = e.clientY;
      if (down.size === 2) {
        const [a, b] = [...down.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) zoomAt((k * d) / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = d;
      } else if (k > 1.001) {
        tx += dx;
        ty += dy;
        limit();
        write();
      }
    });
    const up = (e: PointerEvent) => {
      down.delete(e.pointerId);
      pinch = 0;
    };
    root.addEventListener("pointerup", (e) => {
      const wasOne = down.size === 1;
      up(e);
      if (wasOne && moved < 6 && !(e.target as HTMLElement).closest(".pfx-view-img, .pfx-view-x")) close();
    });
    root.addEventListener("pointercancel", up);
    root.addEventListener("dblclick", (e) => {
      if (k > 1.2) {
        k = 1;
        tx = 0;
        ty = 0;
        write();
      } else zoomAt(2.6, e.clientX, e.clientY);
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") zoomAt(k * 1.3, innerWidth / 2, innerHeight / 2);
      else if (e.key === "-") zoomAt(k / 1.3, innerWidth / 2, innerHeight / 2);
      else if (e.key.startsWith("Arrow")) {
        const s = 60;
        if (e.key === "ArrowLeft") tx += s;
        if (e.key === "ArrowRight") tx -= s;
        if (e.key === "ArrowUp") ty += s;
        if (e.key === "ArrowDown") ty -= s;
        limit();
        write();
        e.preventDefault();
      } else if (e.key === "Tab") {
        e.preventDefault();
        x.focus();
      }
    });
    addEventListener(
      "resize",
      () => {
        if (layer !== root) return;
        fit();
        limit();
        write();
      },
      { signal, passive: true },
    );
  };

  for (const el of items) {
    el.classList.add("pfx-zoomable");
    if (!el.matches("a *")) {
      el.setAttribute("role", "button");
      el.tabIndex = el.tabIndex < 0 ? 0 : el.tabIndex;
      if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", "Open this picture larger");
    }
    el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("a")) return;
      openFrom(el);
    }, { signal });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFrom(el);
      }
    }, { signal });
  }

  return () => {
    closeIt?.();
    layer?.remove();
    layer = null;
  };
}
