// The hand built figures. A post embeds one with an empty div in its Markdown:
//
//   <div class="pfx-slot" data-post-fig="cost-stacks"></div>
//
// The slot holds its height in the stylesheet, so nothing moves when the figure
// arrives. With no script and in print it is hidden, and the post's own words
// carry the same facts. The code for each figure only loads as it comes near
// the screen, and each one stops drawing when it leaves.

export type FigureCtx = {
  root: HTMLElement;
  signal: AbortSignal;
  /** Reduced motion: the figure still works, it just does not animate. */
  still: boolean;
};
export type Figure = (ctx: FigureCtx) => void | (() => void) | Promise<void | (() => void)>;

const LOAD: Record<string, () => Promise<{ default: Figure }>> = {
  "cost-stacks": () => import("./cost-stacks"),
  "referee-line": () => import("./referee-line"),
  minhash: () => import("./minhash"),
  "zero-params": () => import("./zero-params"),
  "day-sky": () => import("./day-sky"),
  "permission-gate": () => import("./permission-gate"),
};

export function mountFigures(signal: AbortSignal): void | (() => void) {
  const slots = Array.from(document.querySelectorAll<HTMLElement>("[data-post-fig]"));
  if (!slots.length) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stops: Array<() => void> = [];

  const start = async (slot: HTMLElement) => {
    const id = slot.dataset.postFig || "";
    const load = LOAD[id];
    if (!load) return;
    try {
      const mod = await load();
      if (signal.aborted) return;
      const stop = await mod.default({ root: slot, signal, still });
      if (typeof stop === "function") {
        if (signal.aborted) stop();
        else stops.push(stop);
      }
      slot.classList.add("is-up");
    } catch (err) {
      console.error(err);
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        start(e.target as HTMLElement);
      }
    },
    { rootMargin: "700px 0px" },
  );
  slots.forEach((s) => io.observe(s));

  return () => {
    io.disconnect();
    stops.forEach((s) => s());
  };
}
