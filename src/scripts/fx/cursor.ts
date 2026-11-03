// The site's cursor: the system arrow is hidden and a small ring with a dot
// at its centre follows the mouse. The dot is exact; the ring trails a
// little. Over anything you can press the ring opens and fills softly; in a
// text field it becomes a thin caret; pressing squeezes it. Mice only, and it
// never runs on touch screens or with reduced motion (the system cursor stays).

let mounted = false;

export function mountCursor() {
  if (mounted) return;
  if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  mounted = true;

  const ring = document.createElement("div");
  ring.className = "fx-cursor";
  ring.setAttribute("aria-hidden", "true");
  const dot = document.createElement("div");
  dot.className = "fx-cursor-dot";
  dot.setAttribute("aria-hidden", "true");
  document.body.append(ring, dot);
  document.documentElement.classList.add("has-fx-cursor");

  let x = -100, y = -100, rx = x, ry = y, running = false, seen = false;
  const loop = () => {
    rx += (x - rx) * 0.24;
    ry += (y - ry) * 0.24;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    if (Math.abs(x - rx) + Math.abs(y - ry) > 0.2) requestAnimationFrame(loop);
    else running = false;
  };
  const kind = (t: EventTarget | null) => {
    const el = t as Element | null;
    if (!el?.closest) return "";
    if (el.closest("input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]")) return "text";
    if (el.closest("a, button, [role=button], summary, label, select, [data-cursor=press]")) return "press";
    return "";
  };

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (!seen) { seen = true; rx = x; ry = y; ring.classList.add("is-on"); dot.classList.add("is-on"); }
    const k = kind(e.target);
    ring.classList.toggle("is-press", k === "press");
    ring.classList.toggle("is-text", k === "text");
    dot.classList.toggle("is-text", k === "text");
    if (!running) { running = true; requestAnimationFrame(loop); }
  }, { passive: true });
  addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") ring.classList.add("is-down"); }, { passive: true });
  addEventListener("pointerup", () => ring.classList.remove("is-down"), { passive: true });
  document.addEventListener("pointerleave", () => { ring.classList.remove("is-on"); dot.classList.remove("is-on"); seen = false; });
  // a touch on a laptop screen hands back to the system cursor until the mouse moves again
  addEventListener("touchstart", () => { ring.classList.remove("is-on"); dot.classList.remove("is-on"); seen = false; }, { passive: true });
}
