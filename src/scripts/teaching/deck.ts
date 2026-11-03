// The stack of pages at the reader's place on a material page. It is a plain link
// to the PDF until this script takes it over, so the file is always one tap away.
// Pressing it, or the title above it, imports the reader. No PDF code runs before
// that. Once the visitor has stayed at the stack for a moment, or rests the pointer
// on it, the files go into the cache, so the press has little left to wait for.

import { clamp, fxOn, isTouch } from "../post-fx/util";
import type { Reader } from "./reader";

export function mountDeck(signal: AbortSignal): void | (() => void) {
  const root = document.querySelector<HTMLElement>("[data-reader]");
  if (!root) return;
  const stack = root.querySelector<HTMLAnchorElement>(".tr-stack");
  const title = root.querySelector<HTMLAnchorElement>(".tr-open");
  if (!stack) return;

  // The pages behind the top one only show at their edges until the stack fans
  // out, so they wait until it is nearly on screen.
  const later = Array.from(root.querySelectorAll<HTMLImageElement>("img[data-later]"));
  if (later.length) {
    const near = new IntersectionObserver(
      ([en]) => {
        if (!en.isIntersecting) return;
        near.disconnect();
        later.forEach((img) => {
          img.src = img.dataset.later || "";
          img.removeAttribute("data-later");
        });
      },
      { rootMargin: "60% 0px" },
    );
    near.observe(stack);
    signal.addEventListener("abort", () => near.disconnect());
  }

  const slug = root.dataset.slug || "";
  let reader: Reader | null = null;
  let opening = false;
  let warmed = false;
  const load = () => import("./reader");
  const warm = () => {
    if (warmed) return;
    warmed = true;
    load().then((m) => m.warmReader()).catch(() => {});
  };

  // Staying at the stack, on a connection that can spare it.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!conn?.saveData && !/2g/.test(conn?.effectiveType || "")) {
    let stay = 0;
    const stayed = new IntersectionObserver(
      ([en]) => {
        clearTimeout(stay);
        if (en.isIntersecting) stay = window.setTimeout(warm, 900);
      },
      { threshold: 0.35 },
    );
    stayed.observe(stack);
    signal.addEventListener("abort", () => {
      clearTimeout(stay);
      stayed.disconnect();
    });
  }

  const open = async (resume: boolean) => {
    if (opening || reader) return;
    opening = true;
    root.classList.add("is-loading");
    let mod: typeof import("./reader") | null = null;
    try {
      mod = await load();
    } catch {
      /* the chunk did not come */
    }
    opening = false;
    root.classList.remove("is-loading");
    if (signal.aborted) return;
    if (!mod) {
      // The file itself, in the plain way, rather than nothing.
      window.open(root.dataset.file, "_blank", "noopener");
      return;
    }
    reader = mod.openReader(root, { signal, resume, onClose: () => (reader = null) });
  };

  const press = (e: MouseEvent) => {
    // After a failed open the links go back to being plain links to the file.
    if (root.dataset.plain || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    void open(false);
  };
  stack.addEventListener("click", press, { signal });
  title?.addEventListener("click", press, { signal });
  document.querySelector("[data-read-jump]")?.addEventListener(
    "click",
    (e) => {
      const me = e as MouseEvent;
      if (me.metaKey || me.ctrlKey || me.shiftKey || me.button > 0) return;
      e.preventDefault();
      if (root.dataset.plain) {
        root.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
        return;
      }
      if (reader) reader.reveal();
      else void open(false);
    },
    { signal },
  );

  // Coming back to a page where the book was left open, and the visitor was down
  // inside it (back, forward, a reload): the book opens again at the page they were
  // on. Any other arrival starts from the top with the book shut, and no PDF code.
  try {
    const state = history.state as { scrollY?: number } | null;
    if (sessionStorage.getItem(`tr-open:${slug}`) === "1" && (state?.scrollY ?? 0) > root.offsetTop) void open(true);
  } catch {
    /* private window: the book stays shut */
  }

  if (!fxOn() || isTouch()) {
    if (isTouch()) stack.addEventListener("pointerdown", warm, { once: true, passive: true, signal });
    return () => reader?.destroy();
  }

  // ---- The stack turns toward the pointer ----------------------------------
  const deck = root.querySelector<HTMLElement>(".tr-deck");
  let tx = 0;
  let ty = 0;
  let sx = 0;
  let sy = 0;
  let raf = 0;
  let dwell = 0;
  const frame = () => {
    raf = 0;
    sx += (tx - sx) * 0.1;
    sy += (ty - sy) * 0.1;
    stack.style.setProperty("--ry", `${(sx * 11).toFixed(2)}deg`);
    stack.style.setProperty("--rx", `${(-sy * 8).toFixed(2)}deg`);
    stack.style.setProperty("--mx", `${(50 + sx * 55).toFixed(1)}%`);
    stack.style.setProperty("--my", `${(50 + sy * 55).toFixed(1)}%`);
    if (Math.abs(tx - sx) > 0.002 || Math.abs(ty - sy) > 0.002) raf = requestAnimationFrame(frame);
  };
  deck?.addEventListener(
    "pointermove",
    (e) => {
      const r = deck.getBoundingClientRect();
      tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true, signal },
  );
  deck?.addEventListener(
    "pointerleave",
    () => {
      tx = 0;
      ty = 0;
      clearTimeout(dwell);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true, signal },
  );
  stack.addEventListener(
    "pointerenter",
    () => {
      dispatchEvent(new CustomEvent("teaching:hover", { detail: { kind: "deck", id: slug } }));
      dwell = window.setTimeout(warm, 180);
    },
    { passive: true, signal },
  );
  stack.addEventListener("focus", warm, { signal, once: true });

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(dwell);
    reader?.destroy();
  };
}
