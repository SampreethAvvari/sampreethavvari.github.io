// Runs the resume page: the scroll, the words of each stop, the links over
// the 3D objects, the events for the score. The 3D world loads afterwards and
// only where it can run; everything here works without it.
//
// Events for the score, all on window:
//   resume:sheet       { id, action: "hover" | "pick" | "flip" }
//   resume:stop        { index, id }
//   resume:transition  { direction, from, to, duration }   duration in seconds
//   resume:hover       { kind, id, note }                   note: a stable small integer

import { initAmbient } from "../spatial";
import { mountMotion } from "./motion";
import { STOPS, type WorldData } from "./types";
import type { World } from "./world";

const SILVER = "206,212,222";
const fire = (name: string, detail: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));

export function startResumeWorld(visit: AbortSignal): void | (() => void) {
  const root = document.querySelector<HTMLElement>("[data-rw]");
  if (!root) return;
  initAmbient(
    [
      [SILVER, SILVER],
      [SILVER, SILVER],
    ],
    undefined,
    visit,
  );

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGL = (() => {
    try {
      const g = document.createElement("canvas").getContext("webgl2");
      g?.getExtension("WEBGL_lose_context")?.loseContext();
      return !!g;
    } catch {
      return false;
    }
  })();
  // Reduced motion and no WebGL get the same markup as a plain document.
  if (reduced || !hasGL) {
    root.classList.remove("is-live");
    return;
  }
  root.classList.add("is-live");
  const live = new AbortController();
  visit.addEventListener("abort", () => live.abort(), { once: true });
  const signal = live.signal;
  const on = { signal };

  const stage = root.querySelector<HTMLElement>(".rw-stage")!;
  const canvas = root.querySelector<HTMLCanvasElement>(".rw-canvas")!;
  const stops = Array.from(root.querySelectorAll<HTMLElement>("[data-stop]"));
  const rail = Array.from(root.querySelectorAll<HTMLElement>("[data-go]"));
  const COUNT = STOPS.length;
  const SPAN = Number(root.dataset.span || 1);
  const data: WorldData = JSON.parse(document.getElementById("rw-data")?.textContent || "{}");
  document.documentElement.classList.add("in-rw");

  // ------------------------------------------------------------ the chosen sheet
  const nameEl = root.querySelector<HTMLElement>("[data-page-name]");
  const blurbEl = root.querySelector<HTMLElement>("[data-page-blurb]");
  const openEl = root.querySelector<HTMLAnchorElement>("[data-page-open]");
  let chosen = 0;
  const choose = (i: number) => {
    if (i === chosen || i < 0) return;
    chosen = i;
    const sh = data.sheets[i];
    if (nameEl) nameEl.textContent = sh.name;
    if (blurbEl) blurbEl.textContent = sh.blurb;
    if (openEl) {
      openEl.href = sh.file;
      openEl.setAttribute("aria-label", `Open the ${sh.name} resume in a new tab`);
    }
    world?.setChosen(i);
  };

  // ------------------------------------------------------------ scrolling
  let world: World | null = null;
  let announced = -1;
  const motion = mountMotion({
    root,
    stage,
    count: COUNT,
    span: SPAN,
    signal,
    onArrive: (i) => {
      if (i === announced) return;
      announced = i;
      fire("resume:stop", { index: i, id: STOPS[i] });
    },
    onLeave: (from, to, dir, ms) => {
      if (from === to) return;
      announced = -1;
      fire("resume:transition", { direction: dir, from, to, duration: ms / 1000 });
    },
    claimTouch: (target, sideways) => {
      // A sideways drag on a sheet spins it; on the labels it swipes them.
      if (sideways) return !!target?.closest?.(".rw-hit, .rw-chips");
      // A long post summary on a small phone scrolls in its own pane.
      const box = target?.closest?.<HTMLElement>(".has-keys .rw-items");
      return !!box && box.scrollHeight > box.clientHeight + 1;
    },
  });
  announced = Math.round(motion.progress());

  rail.forEach((a) => {
    a.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        motion.go(Number(a.dataset.go));
      },
      on,
    );
  });

  // Keyboard focus landing in another stop brings that stop up.
  stops.forEach((el) => {
    el.addEventListener(
      "focusin",
      () => {
        const i = Number(el.dataset.stop);
        if (Math.abs(motion.progress() - i) > 0.02) motion.go(i);
      },
      on,
    );
  });

  // A link straight to a section.
  const HASH: Record<string, number> = { "#versions": 0, "#experience": 2, "#skills": 6, "#education": 7 };
  // The browser also scrolls to the fragment once the page has loaded, so ask again then.
  const toHash = () => {
    const i = HASH[location.hash];
    if (i !== undefined) {
      motion.measure();
      motion.go(i, true);
    }
  };
  toHash();
  if (document.readyState !== "complete") addEventListener("load", () => setTimeout(toHash, 0), { once: true, signal });
  addEventListener("hashchange", toHash, on);

  // A soft pool of light stands behind each stop's subject.
  const sky = root.querySelector<HTMLElement>(".rw-sky");
  const wideScreen = innerWidth >= 768;
  const POOL: Record<string, [number, number]> = wideScreen
    ? { sheets: [50, 56], page: [58, 52], hybridge: [68, 50], research: [33, 50], video: [66, 50], shure: [40, 52], skills: [50, 50], education: [50, 48] }
    : { sheets: [50, 50], page: [50, 34], hybridge: [50, 34], research: [50, 28], video: [50, 28], shure: [50, 28], skills: [50, 50], education: [50, 38] };

  // ------------------------------------------------------------ the words of each stop
  const shown = stops.map(() => -1);
  const applyCopy = (p: number) => {
    stops.forEach((el, i) => {
      const d = p - Number(el.dataset.stop);
      const ad = Math.abs(d);
      // A stop's words hold while it is near and leave well before the next arrives.
      const o = ad < 0.46 ? 1 - Math.min(1, Math.max(0, (ad - 0.06) / 0.34)) : 0;
      const q = Math.round(o * 100);
      if (q !== shown[i] || (q > 0 && ad > 0.0005)) {
        shown[i] = q;
        el.style.opacity = String(o);
        el.style.setProperty("--d", d.toFixed(4));
      }
      el.classList.toggle("is-on", ad < 0.2);
    });
    const near = Math.round(p);
    rail.forEach((a, i) => {
      if (i === near) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
    if (root.dataset.at !== STOPS[near]) {
      root.dataset.at = STOPS[near];
      const [px, py] = POOL[STOPS[near]] ?? [50, 50];
      sky?.style.setProperty("transform", `translate3d(${px - 50}%, ${py - 50}%, 0)`);
    }
    root.classList.toggle("is-moving", p > 0.03);
  };

  // ------------------------------------------------------------ the frame loop
  const magnet = (p: number) => {
    // the view eases near each stop, so even free scrolling feels held there
    const k = Math.floor(p);
    const f = p - k;
    if (f <= 0 || k >= COUNT - 1) return p;
    const s = f * f * (3 - 2 * f);
    return k + f + (s - f) * 0.78;
  };
  let P = magnet(motion.progress());
  let vel = 0;
  let lastT = performance.now();
  let raf = 0;
  let onScreen = true;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    const target = magnet(motion.progress());
    const prev = P;
    P += (target - P) * (1 - Math.exp(-dt * 11));
    if (Math.abs(target - P) < 0.0002) P = target;
    vel = vel * 0.8 + ((P - prev) / dt) * 0.2;
    applyCopy(P);
    world?.frame(now, P, vel);
    const inside = root.getBoundingClientRect().bottom > innerHeight * 0.4;
    document.documentElement.classList.toggle("in-rw", inside);
  };
  const run = () => {
    if (raf || !onScreen || document.hidden || signal.aborted) return;
    lastT = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) run();
    else {
      halt();
      document.documentElement.classList.remove("in-rw");
    }
  });
  io.observe(root);
  document.addEventListener("visibilitychange", () => (document.hidden ? halt() : run()), on);
  applyCopy(P);
  run();

  // ------------------------------------------------------------ pointer
  addEventListener(
    "pointermove",
    (e) => {
      world?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1, true);
    },
    { passive: true, ...on },
  );
  addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (t) world?.setPointer((t.clientX / innerWidth) * 2 - 1, (t.clientY / innerHeight) * 2 - 1, true);
    },
    { passive: true, ...on },
  );

  // ------------------------------------------------------------ the sheets
  const ids = data.sheets.map((s) => s.id);
  const hitSheets = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-hit]"));
  const cellLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-cell]"));
  let hovered = -1;
  const hoverSheet = (i: number) => {
    if (i === hovered) return;
    hovered = i;
    world?.hoverSheet(i >= 0 ? i : null);
    cellLinks.forEach((c) => c.classList.toggle("is-near", ids.indexOf(c.dataset.cell || "") === i));
    if (i >= 0) {
      choose(i);
      fire("resume:sheet", { id: ids[i], action: "hover" });
    }
  };
  const bindHover = (el: HTMLElement, i: number) => {
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") hoverSheet(i);
    }, on);
    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse" && hovered === i) hoverSheet(-1);
    }, on);
    el.addEventListener("focus", () => hoverSheet(i), on);
    el.addEventListener("blur", () => hovered === i && hoverSheet(-1), on);
    el.addEventListener("click", () => {
      fire("resume:sheet", { id: ids[i], action: "pick" });
      world?.pickSheet(i);
    }, on);
  };
  cellLinks.forEach((el) => bindHover(el, ids.indexOf(el.dataset.cell || "")));

  // The links over the sheets also drag: a press and a move spins the sheet,
  // a press alone opens the PDF, which is the browser's own click.
  hitSheets.forEach((el) => {
    const i = ids.indexOf(el.dataset.hit || "");
    bindHover(el, i);
    let down = false;
    let moved = 0;
    let lx = 0;
    let ly = 0;
    let sideways = false;
    let decided = false;
    el.addEventListener("dragstart", (e) => e.preventDefault(), on);
    el.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      down = true;
      moved = 0;
      lx = e.clientX;
      ly = e.clientY;
      decided = e.pointerType === "mouse";
      sideways = decided;
      world?.pressSheet(i);
      choose(i);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* the capture is a nicety */
      }
      if (decided) world?.dragStart(i);
    }, on);
    el.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      lx = e.clientX;
      ly = e.clientY;
      if (!decided && moved > 6) {
        decided = true;
        sideways = Math.abs(dx) > Math.abs(dy);
        if (sideways) world?.dragStart(i);
      }
      if (sideways) world?.dragBy(i, dx, dy);
    }, on);
    const end = () => {
      if (!down) return;
      down = false;
      world?.pressSheet(null);
      world?.dragEnd(i);
    };
    el.addEventListener("pointerup", end, on);
    el.addEventListener("pointercancel", end, on);
    // A drag is not a click.
    el.addEventListener("click", (e) => {
      if (moved > 8) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, { capture: true, signal });
  });

  // ------------------------------------------------------------ the page's sections
  const sectionHits = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-section]"));
  const sectionStop: Record<string, number> = { experience: 2, skills: 6, education: 7 };
  sectionHits.forEach((el, i) => {
    const name = el.dataset.section || "";
    el.addEventListener("pointerenter", () => {
      world?.hoverSection(name);
      fire("resume:hover", { kind: "section", id: name, note: i });
    }, on);
    el.addEventListener("pointerleave", () => world?.hoverSection(null), on);
    el.addEventListener("click", (e) => {
      e.preventDefault();
      motion.go(sectionStop[name]);
    }, on);
  });
  root.querySelectorAll<HTMLElement>("[data-jump]").forEach((el, i) => {
    const name = el.dataset.jump || "";
    el.addEventListener("pointerenter", () => {
      world?.hoverSection(name);
      fire("resume:hover", { kind: "section", id: name, note: i });
    }, on);
    el.addEventListener("pointerleave", () => world?.hoverSection(null), on);
    el.addEventListener("click", (e) => {
      e.preventDefault();
      motion.go(sectionStop[name]);
    }, on);
  });

  // ------------------------------------------------------------ the Hybridge keys
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-item]"));
  const keyHits = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-key]"));
  let activeKey = 0;
  const setKey = (i: number) => {
    if (i === activeKey || i < 0 || i >= items.length) return;
    activeKey = i;
    items.forEach((el, k) => el.classList.toggle("is-shown", k === i));
    world?.setKey(i);
  };
  items.forEach((el, i) => {
    el.addEventListener("focusin", () => setKey(i), on);
  });
  keyHits.forEach((el) => {
    const i = Number(el.dataset.key);
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") {
        setKey(i);
        fire("resume:hover", { kind: "key", id: el.dataset.name || String(i), note: i });
      }
    }, on);
    // On touch the first tap reads, the second opens.
    el.addEventListener("click", (e) => {
      const isTouch = matchMedia("(pointer: coarse)").matches;
      if (isTouch && activeKey !== i) {
        e.preventDefault();
        setKey(i);
        fire("resume:hover", { kind: "key", id: el.dataset.name || String(i), note: i });
      }
    }, on);
  });

  // The reading pane holds its height: as tall as the longest line it can show.
  const pane = root.querySelector<HTMLElement>(".has-keys .rw-items");
  const sizePane = () => {
    if (!pane) return;
    pane.style.minHeight = "";
    pane.style.maxHeight = "";
    let tallest = 0;
    items.forEach((el) => (tallest = Math.max(tallest, el.offsetHeight)));
    let h = tallest;
    const copy = pane.closest<HTMLElement>(".rw-copy");
    if (copy && matchMedia("(max-width: 767px), (max-aspect-ratio: 21 / 20)").matches) {
      // the mark and ten keys need their room above the words
      const chrome = copy.offsetHeight - pane.offsetHeight;
      h = Math.min(tallest, Math.max(96, stage.offsetHeight - 350 - chrome));
      pane.style.maxHeight = `${h}px`;
    }
    pane.style.minHeight = `${h}px`;
  };
  sizePane();
  document.fonts?.ready.then(() => {
    if (signal.aborted) return;
    sizePane();
    world?.layout();
  });

  // ------------------------------------------------------------ the skills
  const chips = Array.from(root.querySelectorAll<HTMLElement>("[data-group]"));
  let pinned: number | null = null;
  chips.forEach((chip) => {
    const g = Number(chip.dataset.group);
    const show = (kind: string) => {
      world?.hoverGroup(g);
      chips.forEach((c) => c.classList.toggle("is-on", c === chip));
      fire("resume:hover", { kind, id: chip.textContent?.trim() || String(g), note: g });
    };
    chip.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") show("group");
    }, on);
    chip.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse" || pinned === g) return;
      world?.hoverGroup(pinned);
      chips.forEach((c) => c.classList.toggle("is-on", Number(c.dataset.group) === pinned));
    }, on);
    chip.addEventListener("focus", () => show("group"), on);
    chip.addEventListener("blur", () => {
      if (pinned === g) return;
      world?.hoverGroup(pinned);
      chips.forEach((c) => c.classList.toggle("is-on", Number(c.dataset.group) === pinned));
    }, on);
    chip.addEventListener("click", () => {
      pinned = pinned === g ? null : g;
      world?.hoverGroup(pinned);
      chips.forEach((c) => {
        const cg = Number(c.dataset.group);
        c.classList.toggle("is-on", cg === pinned);
        c.setAttribute("aria-pressed", String(cg === pinned));
      });
    }, on);
  });

  // ------------------------------------------------------------ size
  // Phones fire resize when the address bar moves. Only a real change counts.
  let sizedW = innerWidth;
  let sizedH = stage.offsetHeight;
  const onResize = () => {
    const w = innerWidth;
    const h = stage.offsetHeight;
    if (w === sizedW && Math.abs(h - sizedH) < 2) return;
    const widthChanged = w !== sizedW;
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (!widthChanged && coarse) return; // height only, on a phone: ignore
    sizedW = w;
    sizedH = h;
    motion.measure();
    sizePane();
    world?.layout();
  };
  addEventListener("resize", onResize, { passive: true, ...on });

  // If WebGL fails after all: back to the plain document, with nothing left running.
  const toDocument = () => {
    live.abort();
    halt();
    io.disconnect();
    stops.forEach((el) => {
      el.style.removeProperty("opacity");
      el.style.removeProperty("--d");
      el.classList.remove("is-on");
    });
    pane?.style.removeProperty("min-height");
    document.documentElement.classList.remove("in-rw");
    root.classList.remove("is-live", "is-3d");
  };

  // ------------------------------------------------------------ the 3D world
  // Lazy: three and the world arrive after the first paint.
  const boot = () => {
    if (signal.aborted) return;
    import("./world")
      .then(async (m) => {
        if (signal.aborted) return;
        const w = await m.mountWorld(
          canvas,
          data,
          {
            sheets: hitSheets,
            sections: sectionHits.map((el) => ({ name: el.dataset.section as "experience" | "skills" | "education", el })),
            keys: keyHits,
            tethers: Array.from(root.querySelectorAll<SVGLineElement>("[data-tether]")),
            endLinks: Array.from(root.querySelectorAll<HTMLElement>("[data-end]")),
          },
          {
            onSheetFlip: (i) => fire("resume:sheet", { id: ids[i], action: "flip" }),
            onSkillTouch: (i, s) => fire("resume:hover", { kind: s.label ? "group" : "skill", id: s.text, note: s.label ? s.group : i % 24 }),
            onMarkHover: (id, note) => fire("resume:hover", { kind: "mark", id, note }),
            onLineHover: (id, note) => fire("resume:hover", { kind: "line", id, note }),
            onLost: () => {
              world?.destroy();
              world = null;
              toDocument();
            },
          },
          () => motion.progress(),
        );
        if (signal.aborted) {
          w?.destroy();
          return;
        }
        if (!w) {
          toDocument();
          return;
        }
        world = w;
        w.setChosen(chosen);
        w.setKey(activeKey);
        if (hovered >= 0) w.hoverSheet(hovered);
        // Draw one frame first, so the canvas never fades in empty.
        w.frame(performance.now(), P, 0);
        requestAnimationFrame(() => {
          if (signal.aborted) return;
          root.classList.add("is-3d");
          if (innerWidth < 640 || matchMedia("(pointer: coarse)").matches) root.classList.add("is-phone-3d");
        });
      })
      .catch((err) => {
        console.warn("resume world did not start", err);
        toDocument();
      });
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(boot, { timeout: 500 });
  else setTimeout(boot, 200);

  return () => {
    halt();
    io.disconnect();
    world?.destroy();
    world = null;
    document.documentElement.classList.remove("in-rw");
    root.classList.remove("is-3d", "is-phone-3d");
  };
}
