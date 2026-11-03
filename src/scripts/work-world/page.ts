// What ties the world to the page: the scroll, the words, the pointer, and the
// moves between /work and /work/<slug>. The engine stays alive across those
// moves, so flying into a bay is one continuous shot; moving anywhere else
// releases it.
//
// Events for the score, on window (nothing here plays audio):
//   work:bay        { id, action: "hover" | "open" | "close" }
//   work:spin       { velocity, section }   signed stops per second
//   work:stop       { index, id }           the page has come to rest at a stop
//   work:transition { direction, from, to, duration }
//       direction: "next" | "back" between stops, "rewind" along the trail,
//       "in" | "out" | "across" for flights between pages; duration in ms
//   work:hover      { kind, id, note }      kind: "bay" | "part" | "body" |
//       "stat" | "card" | "chip" | "point" | "door"; note is a stable small integer

import { navigate } from "astro:transitions/client";
import { onPage } from "../lifecycle";
import { mountMovement, type Movement } from "./movement";
import { emit } from "./math";
import type { Panels } from "./panels";
import type { BayId } from "./bays";
import type { Hit, World } from "./engine";

// Years as depth: must match trail.ts, which pulls in three and loads later.
const NOW_YEAR = 2026.85;
const PER_YEAR = 1100;

const BAYS: BayId[] = ["aie", "fde", "mle", "sde"];
// How far each bay's doors stand open at rest, before the pointer reaches them.
const AJAR = [0.62, 0.13, 0.34, 0.04];
const isWork = (p: string) => p === "/work" || p === "/work/" || p.startsWith("/work/");
const bayOf = (p: string): BayId | null => {
  const m = p.match(/^\/work\/([a-z]+)\/?$/);
  return m && (BAYS as string[]).includes(m[1]) ? (m[1] as BayId) : null;
};

type W = Window & { __ww?: unknown };

let world: World | null = null;
let booting: Promise<World | null> | null = null;
let worldCanvas: HTMLCanvasElement | null = null;
let keepWorld = false;
let cameFrom: string | null = null;
let lastPath: string | null = null;
let mod: typeof import("./engine") | null = null;
let enterTimer = 0;

// A move between two Work pages stays in the world: the site's loader does not
// come up. This runs before the loader's own listener and stops it seeing the
// move at all. Any other move goes through the loader as usual.
document.addEventListener(
  "astro:before-preparation",
  (e) => {
    const ev = e as Event & { to: URL; from: URL };
    clearTimeout(enterTimer);
    const from = lastPath ?? ev.from.pathname;
    keepWorld = !!world && isWork(ev.to.pathname) && isWork(from);
    cameFrom = from;
    if (keepWorld) {
      document.documentElement.classList.add("ww-flying");
      e.stopImmediatePropagation();
    }
  },
  { capture: true },
);

async function bootWorld(canvas: HTMLCanvasElement, low: boolean, reduced: boolean) {
  if (world && worldCanvas === canvas) return world;
  if (world) {
    world.destroy();
    world = null;
  }
  if (booting) return booting;
  booting = (async () => {
    await Promise.race([document.fonts?.load?.("700 100px Inter") ?? Promise.resolve(), new Promise((r) => setTimeout(r, 900))]);
    const engine = await import("./engine");
    mod = engine;
    const w = engine.mountWorld(canvas, { low, reduced, still: reduced });
    world = w;
    worldCanvas = canvas;
    return w;
  })().finally(() => {
    booting = null;
  });
  return booting;
}

function hasGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    const ok = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

onPage("work-world", (signal) => {
  const root = document.querySelector<HTMLElement>("[data-ww]");
  lastPath = location.pathname;
  if (!root) {
    if (world && !keepWorld) {
      world.destroy();
      world = null;
      worldCanvas = null;
    }
    document.documentElement.classList.remove("in-ww", "ww-flying");
    return;
  }

  const sig = { signal };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const low = matchMedia("(max-width: 767px), (pointer: coarse)").matches || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 4;
  const touch = matchMedia("(hover: none), (pointer: coarse)").matches;
  const stage = root.querySelector<HTMLElement>("[data-ww-stage]")!;
  const layer = root.querySelector<HTMLElement>("[data-ww-layer]")!;
  const canvas = root.querySelector<HTMLCanvasElement>(".ww-canvas")!;
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-stop]"));
  const pageKind = root.dataset.page as "index" | "bay";
  const slug = (root.dataset.slug || null) as BayId | null;
  const count = panels.length;
  const span = Number(root.dataset.span || 1.9);
  const ids = panels.map((p) => p.dataset.id || p.id || `stop-${p.dataset.stop}`);

  const gl = hasGL();
  // Reduced motion and no WebGL share the flat page.
  if (!gl || reduced) {
    root.classList.add("is-flat");
    document.documentElement.classList.remove("ww-flying");
    if (gl && reduced) {
      // The calm version: one still frame of the world behind the words. No
      // loop runs, and scrolling moves only the words.
      bootWorld(canvas, low, true).then((sw) => {
        if (!sw || signal.aborted) return;
        if (pageKind === "index") {
          sw.setPage({ kind: "index" });
          sw.setBay(0, 0, 0.5);
        } else {
          sw.setPage({ kind: "bay", id: slug!, stops: count });
          BAYS.forEach((id, i) => sw.setBay(i, id === slug ? 1 : 0, id === slug ? 1 : 0));
        }
        sw.setScroll(0, true);
        sw.start();
        // Doors and lamps have taken their places once a frame has run.
        requestAnimationFrame(() => sw.renderOnce());
        root.classList.add("is-3d");
        addEventListener("resize", () => sw.renderOnce(), sig);
      }).catch(() => {});
    }
    return () => {
      if (!keepWorld && world) {
        world.destroy();
        world = null;
        worldCanvas = null;
      }
    };
  }

  let skyHeld: boolean | null = null;
  const markStage = () => {
    const bottom = root.getBoundingClientRect().bottom;
    document.documentElement.classList.toggle("in-ww", bottom > innerHeight * 0.5);
    const hold = bottom > 1;
    if (hold !== skyHeld) {
      skyHeld = hold;
      emit("spacefield:hold", { hold });
    }
  };
  markStage();
  addEventListener("scroll", markStage, { passive: true, ...sig });
  signal.addEventListener("abort", () => emit("spacefield:hold", { hold: false }));

  let w: World | null = null;
  let pan: Panels | null = null;
  let q = 0;
  let active = 0;
  let qShown = 0;
  let hoverBay = -1;
  let panelBay = -1;
  let hoverKey = "";
  let holdFlight = false;
  const openStops = new Set<number>();
  const doorsWere = [false, false, false, false];
  const shade = (i: number) => {
    w?.setShade(panels[i]?.dataset.shade || "");
  };

  // Before the 3D is ready, panels just cross fade.
  const plainPanels = (at: number) => {
    panels.forEach((p, i) => {
      const a = Math.abs(at - i);
      p.style.opacity = String(Math.max(0, 1 - a / 0.4));
      p.classList.toggle("is-active", a < 0.3);
    });
  };

  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    markRail(i);
    shade(i);
    if (touch) updateBays();
  };

  const goers = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-ww-go]"));
  const rail = Array.from(root.querySelectorAll<HTMLAnchorElement>(".ww-rail [data-ww-go]"));
  function markRail(i: number) {
    rail.forEach((a) => (Number(a.dataset.wwGo) === i ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
  }
  const readEl = root.querySelector<HTMLElement>("[data-ww-year]");

  const movement: Movement = mountMovement({
    root,
    stage: layer,
    count,
    span,
    reduced,
    signal,
    scrollers: "[data-ww-scroll]",
    hold: () => holdFlight,
    onMove(at) {
      q = at;
      w?.setScroll(at);
      if (!w) plainPanels(at);
      const near = Math.round(at);
      if (Math.abs(at - near) < 0.46) setActive(near);
      updateBays();
    },
    onDepart(from, to, ms) {
      const rewind = pageKind === "index" && from === 5 && to === 6;
      emit("work:transition", { direction: rewind ? "rewind" : to > from ? "next" : "back", from: ids[from], to: ids[to], duration: ms });
    },
    onArrive(i) {
      setActive(i);
      emit("work:stop", { index: i, id: ids[i] });
      updateBays();
    },
  });

  // ---- bay doors
  function updateBays() {
    if (!w) return;
    if (pageKind === "bay") {
      BAYS.forEach((id, i) => w!.setBay(i, id === slug ? 1 : 0, id === slug ? 1 : 0));
      return;
    }
    const focusStop = Math.round(q);
    const settled = Math.abs(q - focusStop) < 0.22;
    for (let i = 0; i < 4; i++) {
      const focus = settled && focusStop === i + 1;
      const hot = hoverBay === i || panelBay === i || (touch && focus);
      const open = hot ? 1 : focus ? AJAR[i] : 0;
      const power = hot ? 1 : focus ? 0.5 : 0.12;
      w.setBay(i, open, power);
      if (hot !== doorsWere[i]) {
        doorsWere[i] = hot;
        emit("work:bay", { id: BAYS[i], action: hot ? "open" : "close" });
      }
      panels[i + 1]?.classList.toggle("is-open", hot);
    }
  }

  // ---- pointer
  let px = 0;
  let py = 0;
  let pendingPick = false;
  let down: { x: number; y: number; t: number; lastY: number; lastX: number; v: number; moved: boolean; onUi: boolean } | null = null;

  const noteOf = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 12;
  };

  function say(kind: string, id: string, note: number) {
    const key = `${kind}:${id}`;
    if (key === hoverKey) return;
    hoverKey = key;
    emit("work:hover", { kind, id, note });
  }

  function onPick(hit: Hit | null) {
    if (!w) return;
    let nextBay = -1;
    if (hit?.kind === "bay") {
      nextBay = hit.bay;
      if (hit.part) say("part", `${hit.id}/${hit.part.id}`, hit.part.note);
      else say("bay", hit.id, hit.bay);
    } else if (hit?.kind === "body") {
      say("body", hit.id, hit.note);
    } else {
      hoverKey = "";
    }
    if (nextBay !== hoverBay) {
      if (nextBay >= 0) emit("work:bay", { id: BAYS[nextBay], action: "hover" });
      hoverBay = nextBay;
      updateBays();
    }
    // Bodies answer while the pointer is on them.
    for (const id of ["t2017", "t2021", "t2023", "t2024v", "t2024r"]) w.setHotStop(id, hit?.kind === "body" && hit.stop === id ? 1 : 0);
    stage.style.cursor = hit ? "pointer" : "";
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    px = (e.clientX / innerWidth) * 2 - 1;
    py = (e.clientY / innerHeight) * 2 - 1;
    w?.setPointer(px, py);
    if (down) {
      const dx = e.clientX - down.lastX;
      const dy = e.clientY - down.lastY;
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
        down.moved = true;
        stage.classList.add("is-dragging");
      }
      if (down.moved) {
        // A screen's width of drag is one stop. Up and down work too.
        const k = (span * stage.offsetHeight) / Math.max(320, innerWidth);
        const d = (Math.abs(dx) > Math.abs(dy) ? -dx : -dy) * k;
        const t = performance.now();
        down.v = down.v * 0.4 + (d / Math.max(1, t - down.t)) * 0.6;
        down.t = t;
        movement.drag(d);
      }
      down.lastX = e.clientX;
      down.lastY = e.clientY;
      return;
    }
    if (!pendingPick) {
      pendingPick = true;
      requestAnimationFrame(() => {
        pendingPick = false;
        if (signal.aborted || !w) return;
        if (w.flying()) return onPick(null);
        const over = document.elementFromPoint(e.clientX, e.clientY);
        // Words and cards on top win; only the open stage reaches the world.
        if (over && !stage.contains(over)) return onPick(null);
        if (over && over.closest("a, button, .ww-card, .ww-box, .ww-plates li")) return onPick(null);
        onPick(w.pick(px, py));
      });
    }
  }, { passive: true, ...sig });

  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    const el = e.target as Element;
    if (el.closest("a, button, input, .ww-card, .ww-box, .ww-shelf")) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), lastX: e.clientX, lastY: e.clientY, v: 0, moved: false, onUi: false };
  }, sig);
  addEventListener("pointerup", (e) => {
    if (!down) return;
    const d = down;
    down = null;
    stage.classList.remove("is-dragging");
    if (d.moved) {
      if (Math.abs(d.v) > 0.05) movement.fling(d.v);
      return;
    }
    if (d.onUi || !w || w.flying()) return;
    const hit = w.pick((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    click(hit);
  }, sig);
  addEventListener("pointercancel", () => {
    down = null;
    stage.classList.remove("is-dragging");
  }, sig);
  // Taps on a phone.
  let tapAt: { x: number; y: number; t: number } | null = null;
  stage.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    tapAt = { x: t.clientX, y: t.clientY, t: performance.now() };
  }, { passive: true, ...sig });
  stage.addEventListener("touchend", (e) => {
    if (!tapAt) return;
    const t = e.changedTouches[0];
    const tap = Math.hypot(t.clientX - tapAt.x, t.clientY - tapAt.y) < 10 && performance.now() - tapAt.t < 400;
    tapAt = null;
    if (!tap || !w || w.flying()) return;
    if ((e.target as Element).closest("a, button, .ww-card")) return;
    click(w.pick((t.clientX / innerWidth) * 2 - 1, (t.clientY / innerHeight) * 2 - 1));
  }, { passive: true, ...sig });

  function click(hit: Hit | null) {
    if (!hit) return;
    if (hit.kind === "bay" && pageKind === "index") {
      const stop = hit.bay + 1;
      if ((Math.round(q) === stop && Math.abs(q - stop) < 0.3) || q > 6) enterBay(hit.id);
      else movement.go(stop);
    } else if (hit.kind === "body") {
      const stop = panels.findIndex((p) => p.id === hit.stop);
      if (stop < 0) return;
      if (Math.round(q) === stop) toggleStop(stop);
      else movement.go(stop);
    }
  }

  function toggleStop(i: number) {
    const p = panels[i];
    const open = !p.classList.contains("is-open");
    p.classList.toggle("is-open", open);
    p.querySelector("[data-ww-toggle]")?.setAttribute("aria-expanded", String(open));
    const label = p.querySelector("[data-ww-toggle]");
    if (label) label.textContent = open ? "Less" : "More";
    if (open) openStops.add(i);
    else openStops.delete(i);
  }
  root.querySelectorAll<HTMLElement>(".ww-more a").forEach((a) => {
    a.addEventListener("focus", () => {
      const p = a.closest<HTMLElement>("[data-stop]");
      if (p && !p.classList.contains("is-open")) toggleStop(Number(p.dataset.stop));
    }, sig);
  });
  root.querySelectorAll<HTMLElement>("[data-ww-toggle]").forEach((b) => {
    b.addEventListener("click", () => {
      const p = b.closest<HTMLElement>("[data-stop]");
      if (p) toggleStop(Number(p.dataset.stop));
    }, sig);
  });

  // ---- moving between pages
  const stopCountOf = (id: BayId) => Number(root.querySelector<HTMLElement>(`[data-bay="${id}"]`)?.dataset.interior || 0);

  function enterBay(id: BayId) {
    if (!w || w.flying()) return;
    const stops = stopCountOf(id) || 7;
    holdFlight = true;
    w.setBay(BAYS.indexOf(id), 1, 1);
    keepWorld = true;
    document.documentElement.classList.add("ww-flying");
    const dur = 1700;
    emit("work:transition", { direction: "in", from: "station", to: id, duration: dur });
    w.flyIn(id, stops, undefined, dur);
    // The page comes in while the camera is still moving: it lands inside it.
    clearTimeout(enterTimer);
    enterTimer = window.setTimeout(() => {
      if (!signal.aborted) navigate(`/work/${id}`);
    }, dur * 0.62);
  }

  // Real links to a bay fly there too, unless asked to open elsewhere.
  root.querySelectorAll<HTMLAnchorElement>("[data-ww-enter]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !w) return;
      e.preventDefault();
      enterBay(a.dataset.wwEnter as BayId);
    }, sig);
  });

  // These links glide to their stop.
  goers.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      movement.go(Number(a.dataset.wwGo));
    }, sig);
  });

  // Keyboard focus landing on a stop brings it up.
  panels.forEach((p, i) => {
    p.addEventListener("focusin", (e) => {
      if ((e.target as Element).matches(":focus-visible") && Math.round(q) !== i) movement.go(i);
    }, sig);
  });

  // Hovering the words of a bay opens it as well.
  panels.forEach((p) => {
    const bay = p.dataset.bay ? BAYS.indexOf(p.dataset.bay as BayId) : -1;
    const box = p.querySelector<HTMLElement>(".ww-box");
    if (bay >= 0 && box) {
      box.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch" || w?.flying()) return;
        panelBay = bay;
        emit("work:bay", { id: BAYS[bay], action: "hover" });
        updateBays();
      }, sig);
      box.addEventListener("pointerleave", () => {
        if (panelBay === bay) panelBay = -1;
        updateBays();
      }, sig);
      box.addEventListener("focusin", () => {
        panelBay = bay;
        updateBays();
      }, sig);
      box.addEventListener("focusout", (e) => {
        if (box.contains(e.relatedTarget as Node | null)) return;
        if (panelBay === bay) panelBay = -1;
        updateBays();
      }, sig);
    }
  });

  // Hover notes for the things in the words.
  const noteTargets: [string, string][] = [
    [".ww-stats li", "stat"],
    [".ww-card", "card"],
    [".ww-chip", "chip"],
    [".ww-points li", "point"],
    [".ww-plates li", "point"],
    [".ww-door", "door"],
    [".ww-shelf > a", "card"],
  ];
  for (const [sel, kind] of noteTargets) {
    root.querySelectorAll<HTMLElement>(sel).forEach((el, k) => {
      el.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch") return;
        const id = el.dataset.id || el.textContent?.trim().slice(0, 32) || `${kind}-${k}`;
        say(kind, id, Number(el.dataset.note ?? noteOf(id)));
      }, sig);
    });
  }

  // ---- arrival at this page
  const returning = pageKind === "index" && cameFrom ? bayOf(cameFrom) : null;
  const hashStop = location.hash ? panels.findIndex((p) => p.id === location.hash.slice(1)) : -1;
  if (returning) {
    const s = BAYS.indexOf(returning) + 1;
    movement.jump(s);
    q = s;
    active = -1;
    setActive(s);
  } else if (hashStop >= 0) {
    movement.jump(hashStop);
    q = hashStop;
  }
  q = movement.q();
  shade(Math.round(q));
  active = Math.round(q);
  markRail(active);

  // ---- the world
  let stopFrame: (() => void) | null = null;
  let lastSpin = 0;
  let spinSent = 0;
  let yearShown = "";
  const start = (wd: World) => {
    w = wd;
    if (signal.aborted) return;
    const prior = wd.pageKind();
    const wasBay = prior.kind === "bay" ? prior.id : null;
    if (pageKind === "index") wd.setPage({ kind: "index" });
    else wd.setPage({ kind: "bay", id: slug!, stops: count });

    pan = mod!.mountPanels(
      layer,
      panels.map((p, i) => ({ el: p, stop: i, depth: Number(p.dataset.depth || 120) })),
      (i, o) => wd.stopPose(i, o),
      mod!.newPose,
    );
    updateBays();
    shade(Math.round(q));
    // Flights that begin on arrival.
    if (returning && wasBay) {
      emit("work:transition", { direction: "out", from: wasBay, to: "station", duration: 1500 });
      wd.setScroll(q, true);
      wd.flyOut(wasBay, q, () => document.documentElement.classList.remove("ww-flying"));
    } else if (pageKind === "bay" && wasBay && wasBay !== slug) {
      emit("work:transition", { direction: "across", from: wasBay, to: slug, duration: 2200 });
      wd.setScroll(q, true);
      wd.flyAcross(wasBay, slug!, count, () => document.documentElement.classList.remove("ww-flying"));
    } else if (pageKind === "bay" && prior.kind === "index" && !wd.flying()) {
      emit("work:transition", { direction: "in", from: "station", to: slug, duration: 1500 });
      wd.flyIn(slug!, count, () => document.documentElement.classList.remove("ww-flying"));
      wd.setScroll(q, true);
    } else if (wd.flying()) {
      wd.setScroll(q, true);
      // Already in the air from the page before: let it land.
      const clear = setInterval(() => {
        if (signal.aborted || !wd.flying()) {
          clearInterval(clear);
          document.documentElement.classList.remove("ww-flying");
        }
      }, 80);
    } else {
      wd.setScroll(q, true);
      document.documentElement.classList.remove("ww-flying");
    }
    holdFlight = false;
    stopFrame = wd.onFrame((f) => {
      qShown = f.q;
      pan?.update(f.camera, f.q, f.flying, active);
      root.classList.toggle("is-moving", Math.abs(f.vel) > 0.12);
      root.classList.toggle("is-trail", pageKind === "index" && f.q > 5.02);
      const t = performance.now();
      if (t - lastSpin > 70 && Math.abs(f.vel - spinSent) > 0.01) {
        lastSpin = t;
        spinSent = f.vel;
        emit("work:spin", { velocity: Number(f.vel.toFixed(3)), section: pageKind === "bay" ? "bay" : f.q < 5 ? "station" : "trail" });
      }
      if (readEl && pageKind === "index" && f.q > 5) {
        const y = NOW_YEAR - f.camera.position.z / PER_YEAR;
        const shown = String(Math.max(2017, Math.min(new Date().getFullYear(), Math.floor(y))));
        if (shown !== yearShown) {
          yearShown = shown;
          readEl.textContent = shown;
        }
      }
    });
    wd.start();
    root.classList.add("is-3d");
    let onScreen = true;
    const pauseIfNeeded = () => wd.setPaused(!onScreen || document.hidden);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      pauseIfNeeded();
    });
    io.observe(stage);
    document.addEventListener("visibilitychange", pauseIfNeeded, sig);
    signal.addEventListener("abort", () => io.disconnect());
    // A phone can take the GPU back. The words are all still there, as a page.
    canvas.addEventListener("webglcontextlost", () => {
      wd.setPaused(true);
      root.classList.remove("is-3d");
      root.classList.add("is-flat");
      movement.jump(0);
    }, sig);
    if (import.meta.env.DEV) {
      (window as W).__ww = { world: wd, movement, q: () => qShown, go: (i: number) => { movement.jump(i); wd.setScroll(i, true); wd.snap(); wd.renderOnce(); } };
    }
  };

  plainPanels(q);
  const boot = () => {
    bootWorld(canvas, low, false)
      .then((wd) => {
        if (wd) start(wd);
      })
      .catch((err) => {
        console.warn(err);
        root.classList.add("is-flat");
      });
  };
  if (world && worldCanvas === canvas) boot();
  else if ("requestIdleCallback" in window) (window as Window & typeof globalThis).requestIdleCallback(boot, { timeout: 900 });
  else setTimeout(boot, 200);

  return () => {
    stopFrame?.();
    document.documentElement.classList.remove("in-ww");
    if (!keepWorld && world) {
      world.destroy();
      world = null;
      worldCanvas = null;
    }
    delete (window as W).__ww;
  };
});
