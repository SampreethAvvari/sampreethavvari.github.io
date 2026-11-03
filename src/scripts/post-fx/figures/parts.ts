// The parts every figure shares: a header, a segmented control and readout
// cards, so six figures read as one family.

import { emit, h } from "../util";

export function frame(root: HTMLElement, title: string, hint: string) {
  root.classList.add("pfx-fig");
  const head = h("div", "pfx-fig-head");
  const t = h("div", "pfx-fig-title", title);
  const hintEl = h("div", "pfx-fig-hint", hint);
  head.append(t, hintEl);
  root.append(head);
  return { head, hint: hintEl };
}

export type Seg<T extends string> = {
  el: HTMLElement;
  set: (v: T, silent?: boolean) => void;
  value: () => T;
};

/** A row of pills, one on. Arrow keys move between them. */
export function segmented<T extends string>(
  label: string,
  options: Array<{ v: T; label: string }>,
  start: T,
  onChange: (v: T) => void,
  signal: AbortSignal,
): Seg<T> {
  const el = h("div", "pfx-seg");
  el.setAttribute("role", "radiogroup");
  el.setAttribute("aria-label", label);
  let cur = start;
  const btns = options.map((o) => {
    const b = h("button", "pfx-seg-b", o.label);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.v = o.v;
    el.append(b);
    return b;
  });
  const sync = () => {
    btns.forEach((b) => {
      const on = b.dataset.v === cur;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
  };
  const set = (v: T, silent = false) => {
    if (v === cur) return;
    cur = v;
    sync();
    if (!silent) onChange(v);
  };
  btns.forEach((b, i) => {
    b.addEventListener("click", () => set(b.dataset.v as T), { signal });
    b.addEventListener(
      "keydown",
      (e) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const next = btns[(i + d + btns.length) % btns.length];
        next.focus();
        set(next.dataset.v as T);
      },
      { signal },
    );
  });
  sync();
  return { el, set, value: () => cur };
}

/** A small solid card: a value and what it is. */
export function readCard(value: string, label: string, cls = "") {
  const c = h("div", `pfx-read-c ${cls}`.trim());
  const v = h("div", "pfx-read-v", value);
  const k = h("div", "pfx-read-k", label);
  c.append(v, k);
  return c;
}

/** Fires the sound hook for a figure. */
export const fig = (id: string, action: string) => emit("post:figure", { id, action });
