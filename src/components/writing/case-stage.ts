// The pinned case studies at the top of /posts.
//
// Wide screens: the section is tall and its stage sticks. Scroll position
// becomes a number t from 0 to n - 1 (which case study is up), with a hold
// at each whole number so every one stays still for a beat. CSS variables
// on each article turn t into the window opening, the fall back and the
// words rising. A canvas over the art draws star dust that streaks when
// you scroll through a change, and now and then a light streak.
//
// Phones and reduced motion get the plain cards from CSS; only the click
// on the art runs there.
//
// Sound hooks for the score (nothing here plays audio): on window,
//   writing:hero        { index, slug, accent }  a case study takes over
//   writing:transition  { kind: "hero", direction: "next" | "back", from,
//                       to, duration }  a change starts; duration is an
//                       estimate in ms from the current scroll speed

import { layoutBox } from "../../scripts/layout-box";
import { onPage } from "../../scripts/lifecycle";
import type { GLHandle } from "./case-gl";

const STAGE = "(min-width: 900px) and (prefers-reduced-motion: no-preference)";
const CALM = "(prefers-reduced-motion: reduce)";
// Part of each step spent holding still before the change starts.
const HOLD = 0.36;
// One step of scroll, in viewport heights. Matches 150vh in the CSS.
const STEP = 1.5;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);
const inOut = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const outCubic = (v: number) => 1 - Math.pow(1 - v, 3);

type State = { t: number; x: number; sky: number; exit: number };

const emit = (name: string, detail: Record<string, unknown>) =>
  dispatchEvent(new CustomEvent(name, { detail }));

export function mountCaseHeroes(): void {
  onPage("writing-cases", (signal) => {
    const root = document.querySelector<HTMLElement>(".cx");
    if (!root) return;

    // The button is the real link. Clicking the art or the title follows it
    // too, unless text is being selected.
    root.addEventListener(
      "click",
      (e) => {
        const el = e.target as HTMLElement;
        if (el.closest("a, button")) return;
        if (!el.closest(".cx-frame, .cx-title")) return;
        if (String(getSelection() || "").length) return;
        el.closest(".cx-hero")?.querySelector<HTMLAnchorElement>(".cx-read")?.click();
      },
      { signal },
    );

    // The cards snap on phones, from the first touch. Switched on with the page
    // itself, the browser snaps while everything is still arriving and the page
    // moves by itself as it loads.
    const snapOn = () => document.documentElement.classList.add("cx-snap-on");
    for (const ev of ["touchstart", "wheel", "keydown"]) addEventListener(ev, snapOn, { passive: true, once: true, signal });
    signal.addEventListener("abort", () => document.documentElement.classList.remove("cx-snap-on"), { once: true });

    const mq = matchMedia(STAGE);
    let stop: (() => void) | null = null;
    const run = () => {
      stop?.();
      stop = mq.matches ? stage(root) : matchMedia(CALM).matches ? null : starDrift(root);
    };
    mq.addEventListener("change", run, { signal });
    run();
    return () => {
      stop?.();
      stop = null;
    };
  });
}

// Phones and the no WebGL fallback: two tiled star sheets inside each picture.
// A transform moves them, wrapped at the tile, so nothing repaints. Each scroll
// frame writes only to the sheets near the screen, and those are the only ones
// held as their own layers, so a long page of pictures costs what one does.
const TILE = 1024;
function starDrift(root: HTMLElement): () => void {
  const heroes = Array.from(root.querySelectorAll<HTMLElement>(".cx-hero"));
  const sheets = heroes.map((h) => ({
    far: h.querySelector<HTMLElement>(".cx-stars-far"),
    near: h.querySelector<HTMLElement>(".cx-stars-near"),
  }));
  const close = new Set<number>();
  let queued = 0;
  const write = () => {
    queued = 0;
    const y = scrollY;
    const f = `${(-(y * 0.1) % TILE).toFixed(1)}px`;
    const n = `${(-(y * 0.34) % TILE).toFixed(1)}px`;
    for (const i of close) {
      sheets[i].far?.style.setProperty("--star-far", f);
      sheets[i].near?.style.setProperty("--star-near", n);
    }
  };
  const onScroll = () => {
    if (!queued) queued = requestAnimationFrame(write);
  };
  addEventListener("scroll", onScroll, { passive: true });
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const i = heroes.indexOf(e.target as HTMLElement);
        if (i < 0) continue;
        if (e.isIntersecting) close.add(i);
        else close.delete(i);
        (e.target as HTMLElement).toggleAttribute("data-near", e.isIntersecting);
      }
      write();
    },
    { rootMargin: "25% 0px" },
  );
  heroes.forEach((h) => io.observe(h));
  return () => {
    removeEventListener("scroll", onScroll);
    cancelAnimationFrame(queued);
    io.disconnect();
    heroes.forEach((h) => h.removeAttribute("data-near"));
    for (const sh of sheets) {
      sh.far?.style.removeProperty("--star-far");
      sh.near?.style.removeProperty("--star-near");
    }
  };
}

function stage(root: HTMLElement): () => void {
  const ac = new AbortController();
  const signal = ac.signal;
  const stageEl = root.querySelector<HTMLElement>(".cx-stage")!;
  const heroes = Array.from(root.querySelectorAll<HTMLElement>(".cx-hero"));
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(".cx-index a"));
  const n = heroes.length;
  const state: State = { t: 0, x: 0, sky: 0, exit: 0 };
  // A custom property written on an element makes the browser restyle everything
  // under it, and the stage holds every letter of every title. So each variable
  // goes only to the elements that read it.
  const headParts = Array.from(root.querySelectorAll<HTMLElement>(".cx-head, .cx-cue"));
  const exitParts = Array.from(root.querySelectorAll<HTMLElement>(".cx-veil, .cx-join, .cx-index"));
  const parts = heroes.map((h) => ({
    frame: h.querySelector<HTMLElement>(".cx-frame")!,
    rim: h.querySelector<HTMLElement>(".cx-rim")!,
    art: h.querySelector<HTMLElement>(".cx-art")!,
    copy: h.querySelector<HTMLElement>(".cx-copy")!,
    title: h.querySelector<HTMLElement>(".cx-title")!,
  }));
  // Once the 3D has taken over, the pictures underneath are hidden, and nothing moves them.
  let picturesHidden = false;
  let coversSky = false;
  const accentOf = (i: number) => `rgb(${(heroes[i]?.style.getPropertyValue("--a") || "52,211,153").trim()})`;

  let top = 0;
  let vh = innerHeight;
  let seg = vh * STEP;
  let span = 1;
  let x = 0;

  const measure = () => {
    vh = innerHeight;
    seg = vh * STEP;
    top = layoutBox(root).top;
    span = Math.max(1, root.offsetHeight - vh);
  };

  // Write a variable only when its text changes.
  const last = new WeakMap<HTMLElement, Record<string, string>>();
  const put = (el: HTMLElement, name: string, v: number) => {
    const s = v.toFixed(4);
    let m = last.get(el);
    if (!m) last.set(el, (m = {}));
    if (m[name] === s) return;
    m[name] = s;
    el.style.setProperty(name, s);
  };

  let lastY = NaN;
  let lastTime = performance.now();
  let pxPerMs = 0;
  let current = -1;
  let lastT = 0;
  let vel = 0;
  let travel = 1;
  const update = (force = false) => {
    const y = scrollY;
    if (!force && y === lastY) return;
    const now = performance.now();
    const dy = Number.isNaN(lastY) ? 0 : y - lastY;
    if (dy) travel = dy > 0 ? 1 : -1;
    const dms = Math.max(1, now - lastTime);
    lastTime = now;
    pxPerMs += (Math.abs(dy) / dms - pxPerMs) * 0.35;
    lastY = y;
    const rel = y - top;
    // The way out starts a little before the stage lets go and ends once half
    // of it has left, so nothing is still lit when its bottom edge comes up.
    state.exit = clamp01((rel - (span - vh * 0.3)) / (vh * 0.8));
    state.sky = Math.max(0, rel) / seg;
    // Once the 3D has taken over it is opaque and fills the screen, so the
    // page's sky behind it can rest (SpaceField).
    const covers = picturesHidden && rel >= 0 && state.exit === 0;
    if (covers !== coversSky) {
      coversSky = covers;
      document.documentElement.classList.toggle("in-cx", covers);
    }
    for (const el of exitParts) put(el, "--exit", state.exit);

    x = Math.max(0, Math.min(rel, span)) / seg;
    const k = Math.floor(x);
    const f = x - k;
    const t = k >= n - 1 ? n - 1 : k + smooth(clamp01((f - HOLD) / (1 - HOLD)));
    state.t = t;
    state.x = x;

    // A change starts when t leaves a whole number.
    const was = lastT;
    lastT = t;
    if (Number.isInteger(was) && t !== was) {
      const to = t > was ? was + 1 : was - 1;
      const left = seg * (1 - HOLD);
      const duration = Math.round(Math.max(250, Math.min(2500, pxPerMs > 0.05 ? left / pxPerMs : 900)));
      if (to >= 0 && to < n) emit("writing:transition", { kind: "hero", direction: to > was ? "next" : "back", from: was, to, duration });
    }
    // Speed for the colour split on the words: 0 still, 1 fast.
    vel += (Math.min(1, pxPerMs / 6) - vel) * 0.5;
    const shownVel = vel < 0.02 ? 0 : Math.round(vel * 50) / 50;
    const head = clamp01((x - 0.16) / 0.26);
    for (const el of headParts) put(el, "--head", head);

    heroes.forEach((h, i) => {
      const cin = i === 0 ? 1 : clamp01(t - (i - 1));
      const cout = clamp01(t - i);
      const live = cin > 0 && cout < 1;
      const wasLive = h.hasAttribute("data-live");
      if (live !== wasLive) h.toggleAttribute("data-live", live);
      const p = parts[i];
      if (!picturesHidden) {
        const open = 1 - inOut(cin);
        const out = inOut(cout);
        put(p.frame, "--open", open);
        put(p.rim, "--open", open);
        put(p.frame, "--out", out);
        put(p.art, "--zoom", 0.5 * (1 - outCubic(cin)));
        put(p.art, "--drift", Math.max(-1, Math.min(1.6, x - i)));
      }
      // Nothing of the words shows outside a hero that is live: once it has
      // written itself out, it has nothing more to write.
      if (live || wasLive || force) {
        put(p.copy, "--cin", clamp01((cin - 0.5) / 0.5));
        put(p.copy, "--cout", clamp01(cout / 0.34));
        put(p.copy, "--exit", state.exit);
      }
      put(p.title, "--vel", live ? shownVel : 0);
      // At rest the letters drop their filters.
      const calm = cin >= 1 && cout <= 0;
      if (calm !== h.hasAttribute("data-calm")) h.toggleAttribute("data-calm", calm);
    });

    links.forEach((a, i) => put(a, "--f", i === 0 ? 1 : clamp01(t - (i - 1))));
    const up = Math.min(n - 1, Math.round(t));
    if (up !== current) {
      const first = current === -1;
      current = up;
      links.forEach((a, i) => {
        if (i === up) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      if (!first) emit("writing:hero", { index: up, slug: heroes[up]?.dataset.slug, accent: accentOf(up) });
    }
  };

  // Where a case study sits still: early in its hold.
  const restOf = (i: number) => top + i * seg + seg * 0.1;

  // A reader who stops halfway through a change would rest on half faded,
  // blurred words, so the change finishes by itself, the way they were going.
  let finishing = 0;
  const stopFinishing = () => {
    if (finishing) cancelAnimationFrame(finishing);
    finishing = 0;
  };
  const finish = () => {
    const k = Math.floor(state.t);
    const frac = state.t - k;
    if (finishing || frac < 0.001 || frac > 0.999) return;
    const onward = travel > 0 ? frac > 0.15 : frac > 0.85;
    const to = onward ? top + (k + 1.01) * seg : top + (k + HOLD - 0.01) * seg;
    const from = scrollY;
    const t0 = performance.now();
    const step = (now: number) => {
      if (signal.aborted) return;
      const p = Math.min(1, (now - t0) / 650);
      const e = 1 - Math.pow(1 - p, 3);
      scrollTo({ top: from + (to - from) * e, behavior: "instant" as ScrollBehavior });
      finishing = p < 1 ? requestAnimationFrame(step) : 0;
    };
    finishing = requestAnimationFrame(step);
  };
  for (const ev of ["wheel", "touchstart", "keydown"]) addEventListener(ev, stopFinishing, { passive: true, signal });

  let queued = 0;
  let settle = 0;
  const onScroll = () => {
    clearTimeout(settle);
    // When the scroll stops, let the speed fall back to still.
    settle = window.setTimeout(() => {
      pxPerMs = 0;
      vel = 0;
      for (const p of parts) put(p.title, "--vel", 0);
      finish();
    }, 140);
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      update();
    });
  };
  addEventListener("scroll", onScroll, { passive: true, signal });

  const refresh = () => {
    measure();
    update(true);
  };
  const ro = new ResizeObserver(refresh);
  ro.observe(root);
  if (root.previousElementSibling) ro.observe(root.previousElementSibling);
  addEventListener("resize", refresh, { signal });
  refresh();

  // Keyboard: a link in a case study that is not on screen brings it up.
  root.addEventListener(
    "focusin",
    (e) => {
      const hero = (e.target as HTMLElement).closest<HTMLElement>(".cx-hero");
      if (!hero) return;
      const i = heroes.indexOf(hero);
      if (i < 0 || Math.abs(state.t - i) < 0.01) return;
      // After the browser's own scroll to the focused element.
      requestAnimationFrame(() => scrollTo({ top: restOf(i), behavior: "instant" as ScrollBehavior }));
    },
    { signal },
  );

  // The index: glide to a case study. From the keyboard, focus follows.
  links.forEach((a, i) =>
    a.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        if ((e as MouseEvent).detail === 0) {
          heroes[i]?.querySelector<HTMLElement>(".cx-read")?.focus({ preventScroll: true });
          scrollTo({ top: restOf(i), behavior: "instant" as ScrollBehavior });
        } else {
          scrollTo({ top: restOf(i), behavior: "smooth" });
        }
      },
      { signal },
    ),
  );

  // The 3D scene, loaded only here, so phones and the plain cards never fetch
  // three. Until it is up the masked pictures hold the screen. Where WebGL is
  // missing, the scene cannot load, or the GPU is taken back, they and the 2D
  // dust carry the same story.
  let dust: (() => void) | null = null;
  let drift: (() => void) | null = null;
  let gl: GLHandle | null = null;
  let hideLater = 0;
  const flat = () => {
    if (signal.aborted) return;
    clearTimeout(hideLater);
    picturesHidden = false;
    root.classList.remove("is-gl");
    update(true);
    if (!dust) dust = mountDust(root, heroes, state);
    if (!drift) drift = starDrift(root);
  };
  const showGL = () => {
    if (signal.aborted) return;
    root.classList.add("is-gl");
    dust?.();
    dust = null;
    drift?.();
    drift = null;
    // The fade to the canvas takes 900 ms in the stylesheet.
    clearTimeout(hideLater);
    hideLater = window.setTimeout(() => {
      picturesHidden = true;
      update(true);
    }, 950);
  };
  const glCanvas = root.querySelector<HTMLCanvasElement>(".cx-gl");
  if (glCanvas) {
    import("./case-gl")
      .then(({ mountCaseGL }) => {
        if (signal.aborted) return;
        gl = mountCaseGL(root, glCanvas, heroes, state, showGL, flat);
        if (!gl) flat();
      })
      .catch(flat);
  } else {
    flat();
  }

  // Clicking the 3D art opens the case study that is up.
  glCanvas?.addEventListener(
    "click",
    () => heroes[Math.min(n - 1, Math.round(state.t))]?.querySelector<HTMLAnchorElement>(".cx-read")?.click(),
    { signal },
  );

  emit("writing:hero", { index: current, slug: heroes[current]?.dataset.slug, accent: accentOf(current) });

  return () => {
    ac.abort();
    ro.disconnect();
    cancelAnimationFrame(queued);
    clearTimeout(settle);
    clearTimeout(hideLater);
    dust?.();
    drift?.();
    gl?.stop();
    root.classList.remove("is-gl");
    document.documentElement.classList.remove("in-cx");
    // Back to the plain cards: drop what the stage wrote.
    const written = [stageEl, ...heroes, ...links, ...headParts, ...exitParts];
    for (const p of parts) written.push(p.frame, p.rim, p.art, p.copy, p.title);
    for (const el of written) {
      for (const v of ["--exit", "--open", "--zoom", "--out", "--cin", "--cout", "--drift", "--f", "--vel", "--head"]) el.style.removeProperty(v);
    }
    heroes.forEach((h, i) => {
      h.toggleAttribute("data-live", i === 0);
      h.style.setProperty("--open", i === 0 ? "0" : "1");
      h.style.setProperty("--cin", i === 0 ? "1" : "0");
    });
  };
}

// Star dust over the art. Stars sit at depths; scrolling through a change
// flies the camera forward (or back), which draws each star as a streak
// from where it was. Idle, they drift. Runs only while the stage is on
// screen and the tab is visible.
function mountDust(root: HTMLElement, heroes: HTMLElement[], state: State): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>(".cx-dust");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return () => {};

  const colors = heroes.map((h) =>
    (h.style.getPropertyValue("--a") || "52,211,153").split(",").map((v) => parseFloat(v) || 0),
  );
  const colorAt = (t: number) => {
    const i = Math.max(0, Math.min(colors.length - 1, Math.floor(t)));
    const j = Math.min(colors.length - 1, i + 1);
    const f = clamp01(t - i);
    return colors[i].map((c, k) => Math.round(c + (colors[j][k] - c) * f));
  };

  let w = 0;
  let h = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  type Star = { x: number; y: number; z: number; r: number; tw: number };
  const spawn = (s: Star, far: boolean) => {
    s.x = Math.random() * 2 - 1;
    s.y = (Math.random() * 2 - 1) * 0.62;
    s.z = far ? 0.75 + Math.random() * 0.25 : 0.12 + Math.random() * 0.88;
    s.r = 0.35 + Math.random() * 1.15;
    s.tw = Math.random() * Math.PI * 2;
    return s;
  };
  const stars: Star[] = Array.from({ length: 190 }, () => spawn({ x: 0, y: 0, z: 0, r: 0, tw: 0 }, false));

  type Streak = { x: number; y: number; vx: number; vy: number; life: number; max: number };
  const streaks: Streak[] = [];
  let nextStreak = performance.now() + 1800;

  let raf = 0;
  let running = false;
  let lastT = state.t;
  let lastNow = performance.now();

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(50, now - lastNow) / 16.67;
    lastNow = now;
    const t = state.t;
    const dT = t - lastT;
    lastT = t;
    // Forward speed in depth units per frame. A jump (an index click, a
    // resize) does not streak.
    const push = Math.abs(dT) < 0.3 ? dT * 0.5 : 0;
    const v = 0.0007 * dt + push;
    const warp = Math.min(1, Math.abs(push) * 60);
    const [cr, cg, cb] = colorAt(t);

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const cx = w * 0.5;
    const cy = h * 0.5;
    const fov = Math.max(w, h) * 0.42;
    ctx.lineCap = "round";

    for (const s of stars) {
      const pz = s.z;
      s.z -= v;
      if (s.z < 0.06) {
        spawn(s, true);
        continue;
      }
      if (s.z > 1) {
        spawn(s, false);
        continue;
      }
      const sx = cx + (s.x / s.z) * fov;
      const sy = cy + (s.y / s.z) * fov;
      if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) {
        spawn(s, v >= 0);
        continue;
      }
      const near = 1 - s.z;
      s.tw += 0.03 * dt;
      const a = (0.18 + near * 0.7) * (0.75 + 0.25 * Math.sin(s.tw));
      // White when still, the case study's colour when flying.
      const r = Math.round(255 + (cr - 255) * warp * 0.85);
      const g = Math.round(255 + (cg - 255) * warp * 0.85);
      const b = Math.round(255 + (cb - 255) * warp * 0.85);
      if (warp > 0.04) {
        const px = cx + (s.x / pz) * fov;
        const py = cy + (s.y / pz) * fov;
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
        ctx.lineWidth = s.r * (0.6 + near * 1.4);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      } else {
        const d = s.r * (0.5 + near * 1.3);
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.fillRect(sx - d / 2, sy - d / 2, d, d);
      }
    }

    // Now and then a thin light streak crosses the sky.
    if (now > nextStreak) {
      nextStreak = now + 2600 + Math.random() * 4200;
      const fromLeft = Math.random() < 0.5;
      const ang = (fromLeft ? 0.22 : Math.PI - 0.22) + (Math.random() - 0.5) * 0.3;
      const sp = 14 + Math.random() * 8;
      streaks.push({
        x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5,
        y: Math.random() * h * 0.45,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0,
        max: 46 + Math.random() * 20,
      });
    }
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i];
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const p = s.life / s.max;
      if (p >= 1) {
        streaks.splice(i, 1);
        continue;
      }
      const fade = Math.sin(p * Math.PI);
      const tx = s.x - s.vx * 9;
      const ty = s.y - s.vy * 9;
      const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
      grad.addColorStop(1, `rgba(${Math.min(255, cr + 90)},${Math.min(255, cg + 90)},${Math.min(255, cb + 90)},${0.75 * fade})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  const start = () => {
    if (running || document.hidden) return;
    running = true;
    lastNow = performance.now();
    lastT = state.t;
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  let onScreen = false;
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) start();
    else halt();
  });
  io.observe(root);
  const onVis = () => (document.hidden ? halt() : onScreen && start());
  document.addEventListener("visibilitychange", onVis);
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  size();

  return () => {
    halt();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    ctx.clearRect(0, 0, w, h);
    // Let the browser drop the backing store.
    canvas.width = 1;
    canvas.height = 1;
  };
}
