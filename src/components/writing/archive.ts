// The list under the case studies: filters, order, the count, and the
// light that follows the pointer.
//
// Default view (all, newest): every post except the six case studies,
// which are already on the page above. Any other view shows every post
// that matches, the six included, so a filter or the impact order is
// complete. The count is always the number of posts that match.

import { onPage } from "../../scripts/lifecycle";

export function mountArchive(): void {
  onPage("writing-archive", (signal) => {
    const grid = document.getElementById("ax-grid");
    if (!grid) return;
    const slots = Array.from(grid.children) as HTMLElement[];
    const filterBtns = Array.from(document.querySelectorAll<HTMLElement>(".ax-filter"));
    const sortBtns = Array.from(document.querySelectorAll<HTMLElement>(".ax-sort"));
    const impactNote = document.getElementById("ax-impact-note");
    const empty = document.getElementById("ax-empty");
    const count = document.getElementById("ax-count");

    let filter = "all";
    let sort = "date";

    const press = (btns: HTMLElement[], on: HTMLElement) =>
      btns.forEach((b) => {
        b.classList.toggle("is-on", b === on);
        b.setAttribute("aria-pressed", b === on ? "true" : "false");
      });

    const apply = () => {
      const isDefault = filter === "all" && sort === "date";
      if (impactNote) impactNote.hidden = sort !== "impact";

      const sorted = [...slots].sort((a, b) =>
        sort === "impact"
          ? parseInt(a.dataset.impact || "999") - parseInt(b.dataset.impact || "999")
          : parseInt(b.dataset.date || "0") - parseInt(a.dataset.date || "0"),
      );
      const shown: HTMLElement[] = [];
      let matching = 0;
      for (const slot of sorted) {
        const dx = (slot.dataset.dx || "").split(" ").filter(Boolean);
        const hideByFilter = filter !== "all" && !dx.includes(filter);
        const hideAsDup = isDefault && slot.dataset.featured === "1";
        slot.hidden = hideByFilter || hideAsDup;
        if (!hideByFilter) matching++;
        if (!slot.hidden) shown.push(slot);
        grid.appendChild(slot);
      }

      // Lanes: which column each card lands in (for the staggered rise),
      // and how the last row fills so no card is left alone with a gap.
      const n = shown.length;
      shown.forEach((slot, i) => {
        slot.dataset.col = String(i % 3);
        slot.style.setProperty("--col", String(i % 3));
        delete slot.dataset.tail3;
        delete slot.dataset.tail2;
      });
      if (n % 3 === 1) shown[n - 1].dataset.tail3 = "1";
      if (n % 3 === 2) {
        shown[n - 1].dataset.tail3 = "2";
        shown[n - 2].dataset.tail3 = "2";
      }
      if (n % 2 === 1) shown[n - 1].dataset.tail2 = "1";

      if (empty) empty.hidden = n > 0;
      if (count) count.textContent = matching === 1 ? "1 post" : `${matching} posts`;
    };

    filterBtns.forEach((btn) =>
      btn.addEventListener(
        "click",
        () => {
          filter = btn.dataset.filter || "all";
          press(filterBtns, btn);
          apply();
        },
        { signal },
      ),
    );
    sortBtns.forEach((btn) =>
      btn.addEventListener(
        "click",
        () => {
          sort = btn.dataset.sort || "date";
          press(sortBtns, btn);
          apply();
        },
        { signal },
      ),
    );
    apply();

    // Light under the pointer: one listener for the whole section.
    const section = grid.closest("section") || grid;
    let raf = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;
    section.addEventListener(
      "pointermove",
      (e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>(".ax-card, .ax-guide");
        if (!el) return;
        pending = { el, x: e.clientX, y: e.clientY };
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!pending) return;
          const r = pending.el.getBoundingClientRect();
          pending.el.style.setProperty("--mx", `${pending.x - r.left}px`);
          pending.el.style.setProperty("--my", `${pending.y - r.top}px`);
          pending = null;
        });
      },
      { passive: true, signal },
    );

    // Where scroll linked animation is missing, cards ease in on arrival.
    let io: IntersectionObserver | null = null;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && !CSS.supports("animation-timeline: view()") && "IntersectionObserver" in window) {
      grid.classList.add("is-js");
      io = new IntersectionObserver(
        (entries) => {
          for (const en of entries) {
            if (en.isIntersecting) {
              en.target.classList.add("is-in");
              io?.unobserve(en.target);
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      slots.forEach((s) => io!.observe(s));
    }

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      grid.classList.remove("is-js");
    };
  });
}
