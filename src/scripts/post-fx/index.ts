// Everything a post gets, started each time a post is shown and stopped when
// it is swapped away. Each piece looks for its own elements first.
//
// All the sound hooks a post fires, on window. Nothing here plays audio:
//   post:section    { index, id }             the section being read changed
//   post:hover      { kind, id, note }        kind is star, link, code, sky or
//                                             a figure's own kind; note is a
//                                             stable small integer
//   post:figure     { id, action }            a figure or viewer did something
//   post:transition { direction, slug }       "out" sets off for slug, "in" arrived

import { onPage } from "../lifecycle";
import { onScrollFrame } from "./util";
import { mountOpening } from "./opening";
import { mountRail } from "./rail";
import { mountLinkCards } from "./links";
import { mountNumbers } from "./numbers";
import { mountViewer } from "./viewer";
import { mountCode } from "./code";
import { mountEndSky } from "./endsky";
import { mountFigures } from "./figures";

onPage("post-fx", (signal) => {
  if (!document.querySelector("article.post")) return;
  const stops: Array<void | (() => void)> = [];

  // Reading progress, in the writing colour.
  const bar = document.getElementById("post-progress");
  if (bar) {
    const update = () => {
      const doc = document.documentElement;
      const height = doc.scrollHeight - doc.clientHeight;
      const pct = height > 0 ? Math.min(1, Math.max(0, doc.scrollTop / height)) : 0;
      bar.style.transform = `scaleX(${pct.toFixed(4)})`;
    };
    onScrollFrame(update, signal);
    update();
  }

  // Wide tables scroll inside their own frame, never the page.
  const body = document.getElementById("post-prose-body");
  body?.querySelectorAll("table").forEach((t) => {
    if (t.parentElement && t.parentElement.classList.contains("post-table")) return;
    const wrap = document.createElement("div");
    wrap.className = "post-table";
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Table");
    t.parentNode!.insertBefore(wrap, t);
    wrap.appendChild(t);
    // Columns that hold sentences get more room on a phone.
    const longest: number[] = [];
    Array.from(t.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell, i) => {
        longest[i] = Math.max(longest[i] || 0, (cell.textContent || "").trim().length);
      });
    });
    Array.from(t.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell, i) => {
        if (longest[i] > 32) cell.classList.add("is-wide");
      });
    });
  });

  for (const mount of [mountOpening, mountRail, mountLinkCards, mountNumbers, mountCode, mountViewer, mountEndSky, mountFigures]) {
    try {
      stops.push(mount(signal));
    } catch (err) {
      console.error(err);
    }
  }

  return () => {
    stops.forEach((s) => {
      if (typeof s === "function") s();
    });
  };
});
