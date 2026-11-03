// Everything the Teaching pages get, started each time one is shown and stopped
// when it is swapped away. Each piece looks for its own elements first. The 3D
// and the PDF code are imported by those pieces only when they are needed.
//
// The sound hooks fired here, on window. Nothing here plays audio:
//   post:section    { index, id }        a section reached the middle of the screen
//   post:figure     { id: "viewer", action: "open" | "close" }  the book opened or closed
//   teaching:hover  { kind, id }         kind is card, deck or star
//   teaching:page   { page, total }      the page being read changed

import { afterImages, onPage } from "../lifecycle";

// What sits below the first screen waits, because the first layout of a page is the
// longest thing it does (teaching.css). It takes its own turn straight after the
// first paint, or the moment the visitor scrolls, so the first layout never grows
// into one long task with the scripts.
function layOutTheRest(signal: AbortSignal) {
  const later = Array.from(document.querySelectorAll<HTMLElement>(".teach-browse, .tm-flap, .tr, .tm-other, .tb-brand-sec, .site-foot"));
  let done = false;
  const show = () => {
    if (done) return;
    done = true;
    later.forEach((el) => el.classList.add("is-laid"));
  };
  addEventListener("scroll", show, { passive: true, once: true, signal });
  requestAnimationFrame(() => {
    if (signal.aborted) return;
    // Back to a place further down the page, or a link to a part of it: now.
    if (scrollY > 40 || location.hash) {
      show();
      if (location.hash) {
        try {
          document.querySelector(location.hash)?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
        } catch {
          /* not an id we know */
        }
      }
    }
  });
  afterImages(signal, () => {
    requestAnimationFrame(() => {
      if (!signal.aborted) setTimeout(show, 0);
    });
  });
}

onPage("teaching", (signal) => {
  if (!document.querySelector("[data-teaching]")) return;
  // These pages have their own sky, and the sheets want a calm one. Gone before
  // the layout's comet engine looks for them, so it never starts.
  document.querySelector(".page-comets")?.remove();
  layOutTheRest(signal);

  // The page's own sky waits behind the opening from the start. Starting two skies
  // keeps the graphics process busy just as it has the first paint to put on screen.
  // The opening lets it go ahead if there will be no canvas (stage.ts).
  const root = document.documentElement;
  const moving = matchMedia("screen and (scripting: enabled) and (prefers-reduced-motion: no-preference)").matches;
  if (moving) root.classList.add("in-cx");

  let stops: Array<void | (() => void)> = [];
  import("./mount").then(
    ({ mountAll }) => {
      if (!signal.aborted) stops = mountAll(signal);
    },
    () => root.classList.remove("in-cx"), // the plain page, with the sky
  );
  return () => {
    root.classList.remove("in-cx");
    stops.forEach((s) => {
      if (typeof s === "function") s();
    });
  };
}, -5);
