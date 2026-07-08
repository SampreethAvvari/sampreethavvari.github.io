// Shared spatial interactions for the glass redesign: pointer glare, 3D tilt,
// magnetic pull, depth arrival on scroll, and count-up metrics. Every effect
// bails under prefers-reduced-motion; pointer effects also bail on touch.
// All handlers are transform/opacity only, batched through rAF.

const reduce = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => window.matchMedia("(pointer: fine)").matches;

/** Specular highlight that follows the cursor. Sets --gx/--gy percent vars
 *  consumed by a ::after radial gradient. */
export function initGlare(selector: string): void {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.addEventListener(
      "pointermove",
      (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--gx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
      },
      { passive: true },
    );
  });
}

/** 3D tilt toward the cursor, max angle from data-tiltmax (default 5deg). */
export function initTilt(selector: string): void {
  if (reduce() || !finePointer()) return;
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const max = parseFloat(el.dataset.tiltmax || "5");
    el.addEventListener(
      "pointermove",
      (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(700px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateY(-2px)`;
      },
      { passive: true },
    );
    el.addEventListener("pointerleave", () => {
      el.style.transition = "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)";
      el.style.transform = "";
      setTimeout(() => (el.style.transition = ""), 410);
    });
  });
}

/** Elements lean a few px toward the cursor and spring back on leave. */
export function initMagnetic(selector: string): void {
  if (reduce() || !finePointer()) return;
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.addEventListener(
      "pointermove",
      (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.transform = `translate(${(x * 6).toFixed(1)}px, ${(y * 6).toFixed(1)}px)`;
      },
      { passive: true },
    );
    el.addEventListener("pointerleave", () => {
      el.style.transition = "transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4)";
      el.style.transform = "";
      setTimeout(() => (el.style.transition = ""), 460);
    });
  });
}

/** Sections ease in from a slight offset/scale/blur as they approach the
 *  viewport center, and sit exactly at rest inside a generous dead zone so
 *  docked content is never distorted while being read. Fast scrolling adds
 *  a motion-blur pass on top: content lags a touch, stretches slightly
 *  along the scroll axis, and softens, then snaps sharp as you stop. */
export function initArrive(selector: string): void {
  if (reduce()) return;
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (!els.length) return;
  let raf = 0;
  let lastY = window.scrollY;
  let vel = 0; // px per frame, signed, smoothed
  const apply = () => {
    raf = 0;
    const y = window.scrollY;
    vel += (y - lastY - vel) * 0.3;
    lastY = y;
    const speed = Math.min(Math.abs(vel), 90);
    const mblur = speed > 6 ? Math.min((speed - 6) * 0.05, 3.4) : 0;
    const stretch = 1 + Math.min(speed * 0.0007, 0.035);
    const lag = Math.max(-9, Math.min(9, vel * 0.09));
    const vh = window.innerHeight;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const c = r.top + r.height / 2;
      const d = Math.max(-1, Math.min(1, (c - vh / 2) / (vh * 0.85)));
      // Dead zone: within 30% of center the element is fully at rest.
      const away = Math.max(0, Math.abs(d) - 0.3) / 0.7;
      const blur = Math.max(away * 1.8, mblur);
      if (away === 0 && blur < 0.05) {
        el.style.transform = "";
        el.style.opacity = "";
        el.style.filter = "";
        continue;
      }
      el.style.transform = `translateY(${(Math.sign(d) * 26 * away + lag).toFixed(1)}px) scale(${(1 - away * 0.045).toFixed(3)}) scaleY(${stretch.toFixed(3)})`;
      el.style.opacity = (1 - away * 0.45).toFixed(3);
      el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
    }
    // Keep ticking until the motion blur has fully decayed, so content
    // snaps back sharp after the scroll stops.
    if (Math.abs(vel) > 0.5) queue();
    else vel = 0;
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue, { passive: true });
  apply();
}

/** Decorative elements drift vertically at their own rate while you scroll
 *  (data-parallax = speed factor), which reads as layers at different
 *  depths. Decor only: everything using this is aria-hidden. */
export function initParallax(selector = "[data-parallax]"): void {
  if (reduce()) return;
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (!els.length) return;
  let raf = 0;
  const apply = () => {
    raf = 0;
    const y = window.scrollY;
    for (const el of els) {
      const f = parseFloat(el.dataset.parallax || "0.08");
      el.style.transform = `translate3d(0, ${(-y * f).toFixed(1)}px, 0)`;
    }
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };
  window.addEventListener("scroll", queue, { passive: true });
  apply();
}

/** One continuous ambient colour field behind the whole page. The colours
 *  interpolate through per-section stops as you scroll, so hues flow
 *  between sections instead of cutting off at borders. Each stop is a pair
 *  of "r,g,b" strings. When `sectionIds` is given (one id per stop), the
 *  stops anchor to the real measured section positions, so each section
 *  actually shows its own colour; otherwise the stops spread linearly over
 *  the page height. The starfield reads the same values, so the glow reads
 *  as coming from the stars. */
export function initAmbient(stops: Array<[string, string]>, sectionIds?: string[]): void {
  const el = document.querySelector<HTMLElement>("[data-ambient]");
  if (!el || stops.length < 2) return;
  const cols = stops.map(([a, b]) => [a.split(",").map(Number), b.split(",").map(Number)]);

  let centers: number[] | null = null;
  const measure = () => {
    centers = null;
    if (!sectionIds || sectionIds.length !== cols.length) return;
    const cs: number[] = [];
    for (const id of sectionIds) {
      const s = document.getElementById(id);
      if (!s) return;
      const r = s.getBoundingClientRect();
      cs.push(r.top + window.scrollY + r.height / 2);
    }
    centers = cs;
  };

  const setAt = (i: number, f: number) => {
    const mix = (a: number[], b: number[]) =>
      a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",");
    el.style.setProperty("--amb1", mix(cols[i][0], cols[i + 1][0]));
    el.style.setProperty("--amb2", mix(cols[i][1], cols[i + 1][1]));
  };

  const apply = () => {
    raf = 0;
    if (centers) {
      const y = window.scrollY + window.innerHeight / 2;
      if (y <= centers[0]) return setAt(0, 0);
      if (y >= centers[centers.length - 1]) return setAt(cols.length - 2, 1);
      for (let i = 0; i < centers.length - 1; i++) {
        if (y >= centers[i] && y < centers[i + 1]) {
          return setAt(i, (y - centers[i]) / (centers[i + 1] - centers[i]));
        }
      }
      return setAt(cols.length - 2, 1);
    }
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scaled = Math.min(0.9999, Math.max(0, window.scrollY / max)) * (cols.length - 1);
    setAt(Math.min(cols.length - 2, Math.floor(scaled)), scaled % 1);
  };

  let raf = 0;
  measure();
  if (reduce()) {
    setAt(0, 0);
    return;
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", () => { measure(); queue(); }, { passive: true });
  // Layout can shift as images load; re-measure once things settle.
  window.addEventListener("load", () => { measure(); queue(); }, { once: true });
  apply();
}

/** Space objects are alive: click one and it flies off into the depth of
 *  space, then respawns somewhere else in its section a moment later. */
export function initSpaceObjects(selector = ".space-el"): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((wrap) => {
    const objs = Array.from(wrap.children) as HTMLElement[];
    if (!objs.length) return;
    wrap.classList.add("space-live");
    wrap.addEventListener("click", () => {
      if (objs[0].classList.contains("space-fly")) return;
      objs.forEach((o) => o.classList.add("space-fly"));
      const wait = 2400 + Math.random() * 2400;
      setTimeout(() => {
        wrap.style.top = (4 + Math.random() * 68).toFixed(1) + "%";
        wrap.style.bottom = "auto";
        if (Math.random() < 0.5) {
          wrap.style.left = (2 + Math.random() * 66).toFixed(1) + "%";
          wrap.style.right = "auto";
        } else {
          wrap.style.right = (2 + Math.random() * 66).toFixed(1) + "%";
          wrap.style.left = "auto";
        }
        objs.forEach((o) => {
          o.classList.remove("space-fly");
          o.classList.add("space-spawn");
          o.addEventListener("animationend", () => o.classList.remove("space-spawn"), { once: true });
        });
      }, wait);
    });
  });
}

/** Section comets that actually travel. Each comet picks a random point
 *  and heading inside its section, glides along it (tail trailing the
 *  motion), fades out near the end of its life, and is reborn somewhere
 *  else on a new heading. Clicking one sends it into the abyss early.
 *  The section owns its comets, so they scroll away with the content. */
export function initComets(selector = ".space-el"): void {
  if (reduce()) return;
  const wraps = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (!wraps.length) return;

  type CometState = {
    wrap: HTMLElement;
    comet: HTMLElement | null;
    parent: HTMLElement;
    x: number; y: number; ang: number; speed: number;
    life: number; maxLife: number; flying: boolean;
  };
  const comets: CometState[] = [];

  for (const wrap of wraps) {
    const parent = wrap.parentElement as HTMLElement | null;
    if (!parent) continue;
    const comet = wrap.querySelector<HTMLElement>(".space-comet");
    // JS owns the motion: park the wrapper at the origin and disable the
    // CSS idle drift so inline transforms win.
    wrap.style.top = "0";
    wrap.style.left = "0";
    wrap.style.right = "auto";
    wrap.style.bottom = "auto";
    if (comet) comet.style.animation = "none";
    const st: CometState = {
      wrap, comet, parent,
      x: 0, y: 0, ang: 0, speed: 0, life: 0, maxLife: 1, flying: false,
    };
    const respawn = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      st.x = w * (0.05 + Math.random() * 0.75);
      st.y = h * (0.05 + Math.random() * 0.7);
      st.ang = Math.random() * Math.PI * 2;
      st.speed = 26 + Math.random() * 34; // px per second
      st.maxLife = 7 + Math.random() * 7;
      st.life = 0;
      if (comet) comet.style.transform = `rotate(${((st.ang * 180) / Math.PI).toFixed(1)}deg)`;
    };
    respawn();
    // Random phase so comets don't breathe in sync.
    st.life = Math.random() * st.maxLife * 0.6;
    wrap.classList.add("space-live");
    wrap.addEventListener("click", () => {
      if (st.flying) return;
      st.flying = true;
      const kids = Array.from(wrap.children) as HTMLElement[];
      kids.forEach((k) => k.classList.add("space-fly"));
      setTimeout(() => {
        kids.forEach((k) => k.classList.remove("space-fly"));
        respawn();
        st.flying = false;
      }, 2100 + Math.random() * 1500);
    });
    (st as CometState & { respawn?: () => void }).respawn = respawn;
    comets.push(st);
  }

  let last = performance.now();
  (function tick(now: number = performance.now()) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.08);
    last = now;
    const vh = window.innerHeight;
    for (const st of comets) {
      const pr = st.parent.getBoundingClientRect();
      if (pr.bottom < -60 || pr.top > vh + 60) continue; // section offscreen
      if (st.flying) continue;
      st.life += dt;
      st.x += Math.cos(st.ang) * st.speed * dt;
      st.y += Math.sin(st.ang) * st.speed * dt;
      const t = st.life / st.maxLife;
      const out =
        t >= 1 ||
        st.x < -80 || st.x > st.parent.clientWidth + 80 ||
        st.y < -80 || st.y > st.parent.clientHeight + 80;
      if (out) {
        (st as CometState & { respawn?: () => void }).respawn?.();
        continue;
      }
      const alpha = Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.2);
      st.wrap.style.transform = `translate3d(${st.x.toFixed(1)}px, ${st.y.toFixed(1)}px, 0)`;
      st.wrap.style.opacity = alpha.toFixed(3);
    }
  })();
}

/** Numbers with data-count animate from 0 when they first become visible.
 *  data-prefix / data-suffix wrap the number. */
export function initCountUps(selector: string): void {
  const els = document.querySelectorAll<HTMLElement>(selector);
  if (!els.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const el = en.target as HTMLElement;
        if (!en.isIntersecting || el.dataset.done) continue;
        el.dataset.done = "1";
        const target = parseFloat(el.dataset.count || "0");
        const pre = el.dataset.prefix || "";
        const suf = el.dataset.suffix || "";
        if (reduce()) {
          el.textContent = pre + target + suf;
          continue;
        }
        const t0 = performance.now();
        const dur = 950;
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = pre + Math.round(target * e) + suf;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    },
    { threshold: 0.6 },
  );
  els.forEach((el) => io.observe(el));
}
