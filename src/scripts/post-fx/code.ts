// Code blocks: a copy control that stays put while the code scrolls under it,
// and a light that follows the pointer along the frame.
//
// Sound hooks:
//   post:hover { kind: "code", id, note }  the pointer came onto a block
//   post:figure { id, action: "copy" }  a block was copied; id is "code-<n>"

import { emit, h, isTouch } from "./util";

export function mountCode(signal: AbortSignal): void | (() => void) {
  const prose = document.getElementById("post-prose-body");
  if (!prose) return;
  const blocks = Array.from(prose.querySelectorAll<HTMLElement>("pre"));
  if (!blocks.length) return;

  const touch = isTouch();
  blocks.forEach((pre, i) => {
    if (pre.parentElement?.classList.contains("pfx-code")) return;
    const id = `code-${i}`;
    const wrap = h("div", "pfx-code");
    pre.parentNode!.insertBefore(wrap, pre);
    wrap.append(pre);
    if (!pre.hasAttribute("tabindex")) pre.tabIndex = 0;

    const btn = h("button", "pfx-codecopy");
    btn.type = "button";
    btn.setAttribute("aria-label", "Copy this code");
    const word = h("span", undefined, "Copy");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>';
    btn.append(word);
    wrap.append(btn);

    let timer = 0;
    btn.addEventListener(
      "click",
      async () => {
        const text = pre.innerText.replace(/\n$/, "");
        let ok = false;
        try {
          await navigator.clipboard.writeText(text);
          ok = true;
        } catch {
          const sel = getSelection();
          const range = document.createRange();
          range.selectNodeContents(pre);
          sel?.removeAllRanges();
          sel?.addRange(range);
          try {
            ok = document.execCommand("copy");
          } catch {
            ok = false;
          }
          sel?.removeAllRanges();
        }
        word.textContent = ok ? "Copied" : "Press Ctrl C";
        btn.classList.toggle("is-done", ok);
        if (ok) emit("post:figure", { id, action: "copy" });
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          word.textContent = "Copy";
          btn.classList.remove("is-done");
        }, 1600);
      },
      { signal },
    );

    if (touch) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    wrap.addEventListener(
      "pointermove",
      (e) => {
        px = e.clientX;
        py = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = wrap.getBoundingClientRect();
          wrap.style.setProperty("--mx", `${(px - r.left).toFixed(0)}px`);
          wrap.style.setProperty("--my", `${(py - r.top).toFixed(0)}px`);
        });
      },
      { passive: true, signal },
    );
    wrap.addEventListener(
      "pointerenter",
      () => emit("post:hover", { kind: "code", id, note: i % 12 }),
      { passive: true, signal },
    );
  });
}
