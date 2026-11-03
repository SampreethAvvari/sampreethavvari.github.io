// The reel at the top of /filmmaking: one film per screen, full bleed.
//
// The reel is a tall section (one screen per film) with a pinned stage.
// One wheel gesture, one swipe or one arrow key moves exactly one film,
// with a short lock so a trackpad's glide never carries into a second; the
// cut runs through the WebGL shader in reel-gl.ts (a crossfade without it).
// After the last film the next scroll leaves the reel and the page goes on;
// scrolling back up comes into the reel again at the last film.
//
// Each film is a clip, its stills in slow motion, or a designed title card
// until footage arrives. The words over it take their colour from the
// frame. Pointing at the frame shows "Watch" by the cursor; a click opens
// the film's page. The film's own sound plays under it when the site's
// sound is on, and the score is asked to step back (sound:duck).
//
// One clip decodes at a time and the next is fetched ahead. Everything
// stops when the reel is off screen, the tab is hidden, or the page goes.

import { onPage } from "../../scripts/lifecycle";
import { createReelGL, type ReelGL } from "./reel-gl";
import { StillReel } from "./still-reel";
import { TitleCard } from "./title-card";
import { FilmSound, soundIsOn } from "./film-sound";

const CUT_MS = 900;
const PHONE_QUERY = "(max-width: 767px), (hover: none) and (pointer: coarse)";

type Media = {
  el: HTMLVideoElement | HTMLCanvasElement;
  prime(): void;
  play(): void;
  pause(): void;
  unload(): void;
  ready(): boolean;
  fit(): void;
};

function makeMedia(box: HTMLElement, phone: boolean, signal: AbortSignal, onShown: () => void): Media {
  const shown = () => {
    box.classList.add("is-playing");
    onShown();
  };
  const video = box.querySelector<HTMLVideoElement>("[data-reel-video]");
  if (video) {
    const src = (phone && video.dataset.srcPhone) || video.dataset.src || "";
    video.addEventListener("loadeddata", shown, { signal });
    const prime = () => {
      if (video.getAttribute("src")) return;
      video.preload = "auto";
      video.src = src;
      video.load();
    };
    return {
      el: video,
      prime,
      play() {
        prime();
        video.play().catch(() => {});
      },
      pause: () => video.pause(),
      unload() {
        video.pause();
        if (!video.getAttribute("src")) return;
        video.removeAttribute("src");
        video.load();
        box.classList.remove("is-playing");
      },
      ready: () => video.readyState >= 2,
      fit() {},
    };
  }
  const canvas = box.querySelector<HTMLCanvasElement>("canvas[data-reel-frame]")!;
  type Drawn = { ready: boolean; play(): void; pause(): void; destroy(): void; fit(): void; draw(): void };
  let art: Drawn | null = null;
  const prime = () => {
    if (art) return;
    if (canvas.dataset.stills) {
      art = new StillReel(canvas, JSON.parse(canvas.dataset.stills), { phone, dprCap: 1.5, loop: true, onFirstFrame: shown });
    } else {
      art = new TitleCard(
        canvas,
        { title: canvas.dataset.title || "", year: canvas.dataset.year || "", roles: canvas.dataset.roles || "" },
        { phone, dprCap: 1.5, onFirstFrame: shown },
      );
    }
  };
  return {
    el: canvas,
    prime,
    play() {
      prime();
      art!.play();
    },
    pause: () => art?.pause(),
    unload() {
      art?.destroy();
      art = null;
      box.classList.remove("is-playing");
    },
    ready: () => !!art?.ready,
    fit() {
      if (!art) return;
      art.fit();
      art.draw();
    },
  };
}

const waitFor = (test: () => boolean, ms: number, signal: AbortSignal) =>
  new Promise<boolean>((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (signal.aborted) return resolve(false);
      if (test()) return resolve(true);
      if (performance.now() - t0 > ms) return resolve(false);
      requestAnimationFrame(check);
    };
    check();
  });

// The words take the frame's most vivid colour, lifted until it reads on
// the dark picture. A frame with no colour to speak of gets warm white.
const ink = (() => {
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 27;
  const x = c.getContext("2d", { willReadFrequently: true });
  return (src: CanvasImageSource): string | null => {
    if (!x) return null;
    try {
      x.drawImage(src, 0, 0, 48, 27);
      const d = x.getImageData(0, 0, 48, 27).data;
      const picks: Array<[number, number, number, number]> = [];
      for (let k = 0; k < d.length; k += 4) {
        const r = d[k] / 255;
        const g = d[k + 1] / 255;
        const b = d[k + 2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const s = max ? (max - min) / max : 0;
        if (s > 0.22 && max > 0.3) picks.push([s * max, r, g, b]);
      }
      if (picks.length < 12) return "hsl(30 30% 93%)";
      picks.sort((a, b) => b[0] - a[0]);
      const top = picks.slice(0, Math.max(6, Math.round(picks.length * 0.08)));
      const [r, g, b] = [1, 2, 3].map((j) => top.reduce((sum, p) => sum + p[j], 0) / top.length);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      if (max !== min) {
        const dd = max - min;
        h = max === r ? ((g - b) / dd) % 6 : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
        h = Math.round(h * 60 + 360) % 360;
      }
      const l = (max + min) / 2;
      const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
      return `hsl(${h} ${Math.round(Math.min(0.78, sat) * 100)}% ${Math.round(Math.max(0.74, Math.min(0.86, l + 0.25)) * 100)}%)`;
    } catch {
      return null;
    }
  };
})();

onPage("film-reel", (signal) => {
  const root = document.querySelector<HTMLElement>("[data-reel]");
  const stage = root?.querySelector<HTMLElement>("[data-reel-stage]");
  if (!root || !stage) return;
  const boxes = Array.from(root.querySelectorAll<HTMLElement>("[data-reel-media]"));
  const uis = Array.from(root.querySelectorAll<HTMLElement>("[data-reel-ui]"));
  const n = boxes.length;
  if (!n || uis.length !== n) return;

  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = matchMedia(PHONE_QUERY).matches;
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const pick = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const glCanvas = pick<HTMLCanvasElement>("[data-reel-gl]");
  const watch = pick<HTMLAnchorElement>("[data-reel-watch]");
  const watchName = pick("[data-reel-watch-name]");
  const live = pick("[data-reel-live]");
  const clock = pick("[data-reel-clock]");
  const pauses = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-reel-pause]"));
  const titles = uis.map((u) => u.querySelector(".reel-title")?.textContent?.trim() || "");
  const sound = new FilmSound(uis.map((u) => u.dataset.audio || undefined));

  root.classList.add("is-live");
  if (reduce) root.classList.add("is-still");
  if (phone) html.classList.add("fm-reel-solid");

  // Reduced motion: nothing moves until the visitor presses play.
  let userPaused = reduce;
  let onScreen = true;
  let current = 0;
  const running = () => !userPaused && onScreen && !document.hidden;

  const inks: Array<string | null> = new Array(n).fill(null);
  const paintInk = (i: number) => {
    if (i !== current) return;
    root.style.setProperty("--reel-ink", inks[i] ?? "hsl(30 30% 93%)");
  };
  // A film's colour comes from its poster image (a clip's first frame, or
  // the first still): read on the CPU, so it never waits on the graphics
  // card. A title card's colour is its own rose.
  boxes.forEach((b, i) => {
    if (b.classList.contains("is-card")) {
      inks[i] = "hsl(350 72% 84%)";
      return;
    }
    const img = b.querySelector("img");
    if (!img) return;
    const sample = () => {
      if (signal.aborted || !img.naturalWidth) return;
      inks[i] = ink(img) ?? inks[i];
      paintInk(i);
    };
    if (img.complete) sample();
    else img.addEventListener("load", sample, { once: true, signal });
  });
  const medias = boxes.map((b) => makeMedia(b, phone, signal, () => {}));

  const announce = (i: number) => {
    if (live) live.textContent = `${titles[i]}, film ${i + 1} of ${n}`;
  };
  const syncPause = () =>
    pauses.forEach((b) => {
      b.setAttribute("aria-pressed", String(userPaused));
      b.setAttribute("aria-label", userPaused ? "Play the reel" : "Pause the reel");
      b.classList.toggle("is-paused", userPaused);
    });
  syncPause();

  // One clip decodes: the current one. The next is fetched and held, the
  // one before stays ready for going back, the rest let go.
  const keep = (i: number) =>
    medias.forEach((m, k) => {
      if (k === i) return;
      m.pause();
      if (k === i + 1 || k === i - 1) m.prime();
      else m.unload();
    });
  const resume = () => {
    const m = medias[current];
    m.prime();
    if (running()) {
      m.play();
      sound.to(current, 900);
    } else {
      m.pause();
      sound.stop(300);
    }
  };
  const setActive = (i: number, leaving = -1) => {
    boxes.forEach((b, k) => {
      b.classList.toggle("is-active", k === i);
      b.classList.toggle("is-leaving", k === leaving);
    });
    uis.forEach((u, k) => {
      u.classList.toggle("is-active", k === i);
      u.classList.toggle("is-leaving", k === leaving);
      u.toggleAttribute("inert", k !== i);
    });
    const href = uis[i].dataset.href;
    if (watch && href) watch.href = href;
    if (watchName) watchName.textContent = titles[i];
  };

  // ---------------------------------------------------------------- where
  let top = 0;
  let vh = 1;
  const measure = () => {
    top = root.getBoundingClientRect().top + window.scrollY;
    vh = stage.clientHeight || window.innerHeight;
  };
  measure();
  const at = () => (window.scrollY - top) / vh;
  const indexAt = () => Math.max(0, Math.min(n - 1, Math.round(at())));

  // ------------------------------------------------------------------ cuts
  let gl: ReelGL | null = null;
  let glTried = false;
  const shader = () => {
    if (!glTried && glCanvas && !reduce) {
      glTried = true;
      gl = createReelGL(glCanvas, phone ? 5 : 8, phone ? 1 : 1.5);
    }
    return gl && gl.ok ? gl : null;
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const warm = idle ? idle(() => !signal.aborted && shader(), { timeout: 2500 }) : window.setTimeout(() => !signal.aborted && shader(), 1200);

  let cutting = false;
  let wanted = -1;
  let lockUntil = 0;
  const finish = (to: number) => {
    setActive(to);
    keep(to);
    cutting = false;
    if (wanted >= 0 && wanted !== current) {
      const w = wanted;
      wanted = -1;
      void cut(w);
      return;
    }
    wanted = -1;
  };
  const cut = async (to: number) => {
    if (cutting) {
      wanted = to;
      return;
    }
    if (to === current) return;
    cutting = true;
    lockUntil = performance.now() + CUT_MS;
    const from = current;
    const dir: 1 | -1 = to > from ? 1 : -1;
    const a = medias[from];
    const b = medias[to];
    current = to;
    b.prime();
    if (running()) {
      b.play();
      sound.to(to, CUT_MS);
    }
    paintInk(to);
    announce(to);
    const g = shader();
    const ready = g ? await waitFor(() => b.ready() && a.ready(), 300, signal) : false;
    if (signal.aborted) return;
    if (g && ready) {
      a.pause();
      g.run(
        a.el,
        b.el,
        dir,
        CUT_MS,
        () => {
          glCanvas?.classList.remove("is-on");
          finish(to);
        },
        () => {
          glCanvas?.classList.add("is-on");
          setActive(to, from);
        },
      );
      return;
    }
    root.classList.add("is-fade");
    setActive(to, from);
    window.setTimeout(
      () => {
        a.pause();
        root.classList.remove("is-fade");
        finish(to);
      },
      reduce ? 220 : 620,
    );
  };

  // The page's scroll says which film; a step in flight wins until it lands.
  let flight: { y: number; until: number } | null = null;
  let settle = 0;
  let lastF = at();
  const goTo = (i: number) => {
    const y = Math.round(top + i * vh);
    flight = { y, until: performance.now() + 1200 };
    window.scrollTo({ top: y, behavior: reduce ? ("instant" as ScrollBehavior) : "smooth" });
    void cut(i);
  };
  const step = (dir: 1 | -1) => {
    const f = at();
    const i = dir > 0 ? Math.floor(f + 0.02) + 1 : Math.ceil(f - 0.02) - 1;
    goTo(Math.max(0, Math.min(n - 1, i)));
  };
  const onScroll = () => {
    const f = at();
    const was = lastF;
    lastF = f;
    if (flight) {
      if (Math.abs(window.scrollY - flight.y) < 2 || performance.now() > flight.until) flight = null;
      else return;
    }
    // A phone's glide up out of the rest comes to rest on the last film.
    if (phone && was >= n - 1 - 0.01 && f < n - 1 - 0.01 && f > -0.5) {
      window.scrollTo({ top: Math.round(top + (n - 1) * vh), behavior: "instant" as ScrollBehavior });
      lastF = n - 1;
      return;
    }
    if (f <= n - 1 + 0.5) {
      const i = indexAt();
      if (i !== (cutting && wanted >= 0 ? wanted : current)) void cut(i);
    } else if (current !== n - 1 && !cutting) {
      // Arrived below the reel some other way (a link, the scroll bar):
      // the last film waits there, so coming back up meets it.
      current = n - 1;
      setActive(current);
      keep(current);
      paintInk(current);
      resume();
    }
    clearTimeout(settle);
    settle = window.setTimeout(() => {
      const g = at();
      if (flight || g <= 0.02 || g >= n - 1 - 0.02) return;
      if (Math.abs(g - Math.round(g)) > 0.02) goTo(Math.round(g));
    }, 180);
  };
  window.addEventListener("scroll", onScroll, { passive: true, signal });

  // One wheel gesture moves one film. A gesture is a run of wheel events
  // with no gap over 180 ms, so a trackpad's glide never adds a second step
  // or carries out of the reel.
  let lastWheel = 0;
  let acc = 0;
  let stepped = false;
  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || html.classList.contains("lb-lock")) return;
      const now = performance.now();
      if (now - lastWheel > 180) {
        acc = 0;
        stepped = false;
      }
      lastWheel = now;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * vh : e.deltaY;
      if (!dy) return;
      const f = at();
      const pinned = f > -0.02 && f < n - 1 + 0.6;
      if (stepped || now < lockUntil) {
        if (pinned && (dy > 0 ? f < n - 1 - 0.02 || stepped : f > 0.02)) e.preventDefault();
        return;
      }
      const engaged = dy > 0 ? f < n - 1 - 0.02 : f > 0.02 && f < n - 1 + 0.6;
      if (!engaged) return;
      e.preventDefault();
      acc += dy;
      if (Math.abs(acc) < 24) return;
      stepped = true;
      step(acc > 0 ? 1 : -1);
    },
    { passive: false, signal },
  );

  // One swipe moves one film. Past the last film, or above the first, the
  // swipe is the page's own scroll.
  let touch: { x: number; y: number; decided: boolean; native: boolean; stepped: boolean } | null = null;
  window.addEventListener(
    "touchstart",
    (e) => {
      const f = at();
      if (e.touches.length !== 1 || f < -0.02 || f > n - 1 + 0.02) {
        touch = null;
        return;
      }
      touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, decided: false, native: false, stepped: false };
    },
    { passive: true, signal },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (!touch || touch.native) return;
      const dy = touch.y - e.touches[0].clientY;
      const dx = touch.x - e.touches[0].clientX;
      if (!touch.decided && Math.max(Math.abs(dx), Math.abs(dy)) > 4) {
        touch.decided = true;
        const f = at();
        if (Math.abs(dx) > Math.abs(dy) || (dy > 0 && f >= n - 1 - 0.02) || (dy < 0 && f <= 0.02)) {
          touch.native = true;
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      if (!touch.stepped && Math.abs(dy) > 36 && performance.now() >= lockUntil) {
        touch.stepped = true;
        step(dy > 0 ? 1 : -1);
      }
    },
    { passive: false, signal },
  );
  window.addEventListener("touchend", () => (touch = null), { passive: true, signal });

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || html.classList.contains("lb-lock")) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const onControl = !!t.closest("a, button");
      const fwd = ["ArrowDown", "PageDown", "ArrowRight"].includes(e.key) || (e.key === " " && !e.shiftKey && !onControl);
      const back = ["ArrowUp", "PageUp", "ArrowLeft"].includes(e.key) || (e.key === " " && e.shiftKey && !onControl);
      const f = at();
      if (performance.now() < lockUntil && (fwd || back) && f > -0.02 && f < n - 1 + 0.02) {
        e.preventDefault();
        return;
      }
      if (fwd && f > -0.02 && f < n - 1 - 0.02) {
        e.preventDefault();
        step(1);
      } else if (back && f > 0.02 && f <= n - 1 + 0.02) {
        e.preventDefault();
        step(-1);
      }
    },
    { signal },
  );

  // ------------------------------------------------------ pause and sound
  pauses.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        userPaused = !userPaused;
        syncPause();
        resume();
      },
      { signal },
    ),
  );
  window.addEventListener("sound:state", () => (running() && soundIsOn() ? sound.to(current, 900) : sound.stop(400)), { signal });
  document.addEventListener("visibilitychange", resume, { signal });
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true;
    resume();
  });
  io.observe(stage);

  // ----------------------------------------------------- the clock, New York
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const tick = () => {
    if (clock && onScreen && !document.hidden) clock.textContent = fmt.format(new Date());
  };
  tick();
  const clockTimer = window.setInterval(tick, 1000);

  // ---------------------------------------------- Watch, by the pointer
  let follow = 0;
  let wx = 0;
  let wy = 0;
  let tx = 0;
  let ty = 0;
  const home = () => {
    tx = stage.clientWidth * 0.5;
    ty = stage.clientHeight * 0.62;
  };
  home();
  wx = tx;
  wy = ty;
  const place = () => {
    if (watch) watch.style.transform = `translate3d(${wx.toFixed(1)}px, ${wy.toFixed(1)}px, 0)`;
  };
  place();
  const glide = () => {
    wx += (tx - wx) * 0.35;
    wy += (ty - wy) * 0.35;
    place();
    follow = Math.abs(tx - wx) + Math.abs(ty - wy) > 0.3 ? requestAnimationFrame(glide) : 0;
  };
  const aim = () => {
    if (reduce) {
      wx = tx;
      wy = ty;
      place();
    } else if (!follow) follow = requestAnimationFrame(glide);
  };
  if (mouse && watch) {
    stage.addEventListener(
      "pointermove",
      (e) => {
        const r = stage.getBoundingClientRect();
        tx = e.clientX - r.left + 16;
        ty = e.clientY - r.top + 10;
        root.classList.add("is-hover");
        aim();
      },
      { signal },
    );
    stage.addEventListener(
      "pointerleave",
      () => {
        root.classList.remove("is-hover");
        home();
        aim();
      },
      { signal },
    );
    watch.addEventListener(
      "focus",
      () => {
        home();
        aim();
      },
      { signal },
    );
  }
  stage.addEventListener(
    "click",
    (e) => {
      if ((e.target as Element).closest("a, button")) return;
      watch?.click();
    },
    { signal },
  );

  window.addEventListener(
    "resize",
    () => {
      measure();
      home();
      aim();
      medias.forEach((m) => m.fit());
    },
    { passive: true, signal },
  );

  // ------------------------------------------------------------ first film
  current = indexAt();
  setActive(current);
  keep(current);
  resume();
  announce(current);

  return () => {
    io.disconnect();
    clearInterval(clockTimer);
    clearTimeout(settle);
    if (idle) (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(warm);
    else clearTimeout(warm);
    cancelAnimationFrame(follow);
    gl?.destroy();
    medias.forEach((m) => m.unload());
    sound.destroy();
    html.classList.remove("fm-reel-solid");
    root.classList.remove("is-live", "is-still", "is-fade", "is-hover");
  };
});
