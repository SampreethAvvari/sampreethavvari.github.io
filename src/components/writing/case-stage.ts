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

import { onPage } from "../../scripts/lifecycle";

const STAGE = "(min-width: 900px) and (prefers-reduced-motion: no-preference)";
// Part of each step spent holding still before the change starts.
const HOLD = 0.36;
// One step of scroll, in viewport heights. Matches 150vh in the CSS.
const STEP = 1.5;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);
const inOut = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const outCubic = (v: number) => 1 - Math.pow(1 - v, 3);

type State = { t: number };

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

    const mq = matchMedia(STAGE);
    let stop: (() => void) | null = null;
    const run = () => {
      stop?.();
      stop = mq.matches ? stage(root) : null;
    };
    mq.addEventListener("change", run, { signal });
    run();
    return () => {
      stop?.();
      stop = null;
    };
  });
}

function stage(root: HTMLElement): () => void {
  const ac = new AbortController();
  const signal = ac.signal;
  const stageEl = root.querySelector<HTMLElement>(".cx-stage")!;
  const heroes = Array.from(root.querySelectorAll<HTMLElement>(".cx-hero"));
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(".cx-index a"));
  const n = heroes.length;
  const state: State = { t: 0 };

  let top = 0;
  let vh = innerHeight;
  let seg = vh * STEP;
  let span = 1;
  let x = 0;

  const measure = () => {
    vh = innerHeight;
    seg = vh * STEP;
    top = root.getBoundingClientRect().top + scrollY;
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
  let current = -1;
  const update = (force = false) => {
    const y = scrollY;
    if (!force && y === lastY) return;
    lastY = y;
    const rel = y - top;
    put(stageEl, "--dock", Math.max(clamp01(-rel / vh), clamp01((rel - span) / vh)));

    x = Math.max(0, Math.min(rel, span)) / seg;
    const k = Math.floor(x);
    const f = x - k;
    const t = k >= n - 1 ? n - 1 : k + smooth(clamp01((f - HOLD) / (1 - HOLD)));
    state.t = t;

    heroes.forEach((h, i) => {
      const cin = i === 0 ? 1 : clamp01(t - (i - 1));
      const cout = clamp01(t - i);
      const live = cin > 0 && cout < 1;
      if (live !== h.hasAttribute("data-live")) h.toggleAttribute("data-live", live);
      put(h, "--open", 1 - inOut(cin));
      put(h, "--zoom", 0.5 * (1 - outCubic(cin)));
      put(h, "--out", inOut(cout));
      put(h, "--cin", clamp01((cin - 0.5) / 0.5));
      put(h, "--cout", clamp01(cout / 0.34));
      put(h, "--drift", Math.max(-1, Math.min(1.6, x - i)));
    });

    links.forEach((a, i) => put(a, "--f", i === 0 ? 1 : clamp01(t - (i - 1))));
    const now = Math.min(n - 1, Math.round(t));
    if (now !== current) {
      current = now;
      links.forEach((a, i) => {
        if (i === now) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }
  };

  // Where a case study sits still: early in its hold.
  const restOf = (i: number) => top + i * seg + seg * 0.1;

  let queued = 0;
  const onScroll = () => {
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
      scrollTo({ top: restOf(i), behavior: "instant" as ScrollBehavior });
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

  const dust = mountDust(root, heroes, state);

  return () => {
    ac.abort();
    ro.disconnect();
    cancelAnimationFrame(queued);
    dust();
    // Back to the plain cards: drop what the stage wrote.
    for (const el of [stageEl, ...heroes, ...links]) {
      for (const v of ["--dock", "--open", "--zoom", "--out", "--cin", "--cout", "--drift", "--f"]) el.style.removeProperty(v);
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
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
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
