// The reading constellation: the star of the section being read is lit, the
// line to the next star draws as you read that section, and a star click flies
// you to its heading. Narrow screens get one small control and a sheet.
//
// Sound hooks:
//   post:section { index, id }  the section being read changed
//   post:hover { kind: "star", id, note }  the pointer came onto a star

import { clamp, emit, h, noteOf, onScrollFrame, reduced } from "./util";

export function mountRail(signal: AbortSignal): void | (() => void) {
  const nav = document.getElementById("post-toc");
  const prose = document.getElementById("post-prose-body");
  if (!nav || !prose) return;
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a[data-target]"));
  const heads = links
    .map((a) => document.getElementById(a.dataset.target || ""))
    .filter((el): el is HTMLElement => !!el);
  if (!heads.length) return;
  const lit = Array.from(nav.querySelectorAll<SVGLineElement>(".pfx-con-lit"));
  const endLink = nav.querySelector<HTMLAnchorElement>(".pfx-con-end a");
  const sky = document.getElementById("pfx-sky");

  let cur = -2;
  let lastFill = -1;
  let lastCur = -1;

  // ---- The control and sheet for narrow screens ---------------------------
  const dock = h("button", "pfx-dock");
  dock.type = "button";
  dock.setAttribute("aria-expanded", "false");
  dock.setAttribute("aria-label", "On this page");
  dock.innerHTML =
    '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><path class="pfx-dock-l" d="M5 16 L10 10 L16 6"/><circle cx="5" cy="16" r="1.6"/><circle cx="10" cy="10" r="2.1"/><circle cx="16" cy="6" r="1.6"/></svg><span class="pfx-dock-n"></span>';
  const dockN = dock.querySelector<HTMLElement>(".pfx-dock-n")!;
  const scrim = h("button", "pfx-sheet-scrim");
  scrim.type = "button";
  scrim.setAttribute("aria-label", "Close");
  scrim.tabIndex = -1;
  const sheet = h("div", "pfx-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "On this page");
  const list = h("ol", "pfx-sheet-list");
  links.forEach((a, i) => {
    const li = h("li");
    const b = h("a");
    b.href = a.getAttribute("href") || "#";
    b.dataset.index = String(i);
    b.append(h("i", "pfx-star"), h("span", undefined, a.querySelector(".pfx-star-label")?.textContent || ""));
    li.append(b);
    list.append(li);
  });
  sheet.append(list);
  document.body.append(dock, scrim, sheet);
  const sheetLinks = Array.from(list.querySelectorAll<HTMLAnchorElement>("a"));
  let sheetOpen = false;
  const setSheet = (open: boolean) => {
    if (open === sheetOpen) return;
    sheetOpen = open;
    sheet.classList.toggle("is-open", open);
    scrim.classList.toggle("is-open", open);
    dock.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) sheetLinks[Math.max(0, cur)]?.focus({ preventScroll: true });
    else dock.focus({ preventScroll: true });
  };
  dock.addEventListener("click", () => setSheet(!sheetOpen), { signal });
  scrim.addEventListener("click", () => setSheet(false), { signal });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") setSheet(false);
  }, { signal });

  const jump = (target: HTMLElement, hash: string) => {
    const y = target.getBoundingClientRect().top + scrollY - (target === sky ? 0 : 100);
    scrollTo({ top: y, behavior: reduced() ? "auto" : "smooth" });
    history.replaceState(history.state, "", hash);
  };
  const onLink = (e: Event, a: HTMLAnchorElement) => {
    const hash = a.getAttribute("href") || "";
    const target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (!target) return;
    e.preventDefault();
    jump(target, hash);
    setSheet(false);
  };
  [...links, ...(endLink ? [endLink] : []), ...sheetLinks].forEach((a) =>
    a.addEventListener("click", (e) => onLink(e, a), { signal }),
  );

  // A hovered star shows its name; the current one steps back for it.
  const con = nav.querySelector<HTMLElement>(".pfx-con");
  [...links, ...(endLink ? [endLink] : [])].forEach((a) => {
    const id = a.dataset.target || "next";
    const over = () => {
      con?.classList.add("is-peek");
      a.classList.add("is-peek");
      emit("post:hover", { kind: "star", id, note: a.dataset.index ? parseInt(a.dataset.index) % 12 : noteOf(id) });
    };
    const out = () => {
      con?.classList.remove("is-peek");
      a.classList.remove("is-peek");
    };
    a.addEventListener("pointerenter", over, { signal });
    a.addEventListener("pointerleave", out, { signal });
    a.addEventListener("focus", over, { signal });
    a.addEventListener("blur", out, { signal });
  });

  // ---- Reading ------------------------------------------------------------
  const frame = () => {
    const line = innerHeight * 0.32;
    let c = -1;
    for (let i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= line) c = i;
      else break;
    }
    if (c !== cur) {
      cur = c;
      links.forEach((a, i) => {
        a.classList.toggle("is-active", i === c);
        a.classList.toggle("is-past", i < c);
        if (i === c) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      sheetLinks.forEach((a, i) => {
        a.classList.toggle("is-active", i === c);
        a.classList.toggle("is-past", i < c);
      });
      if (c >= 0) emit("post:section", { index: c, id: heads[c].id });
      dockN.textContent = `${Math.max(1, c + 1)} · ${heads.length}`;
    }
    // How far down the current section, for the one line still drawing.
    let fill = 0;
    if (c >= 0) {
      const top = heads[c].getBoundingClientRect().top;
      const next = c + 1 < heads.length ? heads[c + 1].getBoundingClientRect().top : prose.getBoundingClientRect().bottom;
      fill = clamp((line - top) / Math.max(1, next - top));
    }
    if (c !== lastCur || Math.abs(fill - lastFill) > 0.002) {
      lit.forEach((l, i) => {
        const f = i < c ? 1 : i === c ? fill : 0;
        l.style.strokeDashoffset = (1 - f).toFixed(3);
      });
      lastCur = c;
      lastFill = fill;
    }
    // The control appears once the reader is in the article, and leaves at
    // the end, where the sky takes over.
    const inRead = heads[0].getBoundingClientRect().top < innerHeight * 0.9;
    const pastEnd = sky ? sky.getBoundingClientRect().top < innerHeight * 0.6 : false;
    dock.classList.toggle("is-on", inRead && !pastEnd);
  };
  onScrollFrame(frame, signal);
  frame();

  return () => {
    dock.remove();
    scrim.remove();
    sheet.remove();
  };
}
