// The reel at the top of /filmmaking, handled like film on a viewer.
//
// The reel is a tall section with a pinned stage. Each film owns a stretch
// of the page's scroll: the first part scrubs through its clip (or its
// stills), frame by frame with the scroll, with a scrub bar and timecode;
// a short stretch after the end holds the last frame (the resistance), and
// only then does the cut to the next film run, through the WebGL shader in
// reel-gl.ts or a crossfade. Past the last film the page scrolls on.
//
// By hand: drag sideways on the picture to scrub, hold the pointer (a long
// press on touch) to play from there at normal speed (with the film's own
// sound when the site's sound is on), pick a film from the thumbnails along
// the bottom, and on a mouse the picture tilts toward the cursor with a
// light glare. Keys: left and right scrub, up and down change film.
//
// One clip decodes at a time and its neighbours are fetched ahead. All of
// it stops when the reel is off screen, the tab is hidden, or the page goes.

import { onPage } from "../../scripts/lifecycle";
import { createReelGL, type ReelGL } from "./reel-gl";
import { StillReel } from "./still-reel";
import { FilmSound } from "./film-sound";

const CUT_MS = 820;
const SCRUB = 1.6; // screens of scroll that scrub one film
const HOLD = 0.4; // screens that hold its last frame before the cut
const SEG = SCRUB + HOLD;
const FPS = 24;
const PHONE_QUERY = "(max-width: 767px), (hover: none) and (pointer: coarse)";

type Media = {
  el: HTMLVideoElement | HTMLCanvasElement;
  prime(): void;
  unload(): void;
  ready(): boolean;
  fit(): void;
  seek(t: number): void;
  play(): void;
  pause(): void;
  progress(): number;
  duration(): number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function makeMedia(box: HTMLElement, phone: boolean, signal: AbortSignal, onEnd: () => void): Media {
  const shown = () => box.classList.add("is-playing");
  const video = box.querySelector<HTMLVideoElement>("[data-reel-video]");
  if (video) {
    const src = (phone && video.dataset.srcPhone) || video.dataset.src || "";
    let pending = -1;
    const doSeek = (t: number) => {
      if (!Number.isFinite(video.duration) || !video.duration || video.seeking) {
        pending = t;
        return;
      }
      pending = -1;
      video.currentTime = Math.min(0.999, clamp01(t)) * video.duration;
    };
    const flush = () => {
      if (pending >= 0) doSeek(pending);
    };
    video.addEventListener("loadeddata", shown, { signal });
    video.addEventListener("loadedmetadata", flush, { signal });
    video.addEventListener("seeked", flush, { signal });
    video.addEventListener("ended", onEnd, { signal });
    const prime = () => {
      if (video.getAttribute("src")) return;
      video.preload = "auto";
      video.src = src;
      video.load();
    };
    return {
      el: video,
      prime,
      unload() {
        video.pause();
        if (!video.getAttribute("src")) return;
        video.removeAttribute("src");
        video.load();
        box.classList.remove("is-playing");
      },
      ready: () => video.readyState >= 2,
      fit() {},
      seek(t) {
        prime();
        doSeek(t);
      },
      play() {
        prime();
        video.play().catch(() => {});
      },
      pause: () => video.pause(),
      progress: () => (video.duration ? video.currentTime / video.duration : 0),
      duration: () => (Number.isFinite(video.duration) ? video.duration : 0),
    };
  }
  const canvas = box.querySelector<HTMLCanvasElement>("[data-reel-stills]")!;
  const urls: string[] = JSON.parse(canvas.dataset.stills || "[]");
  let reel: StillReel | null = null;
  let at = 0;
  const prime = () => {
    reel ??= new StillReel(canvas, urls, {
      phone,
      dprCap: 1.5,
      onFirstFrame: () => {
        reel?.seek(at);
        shown();
      },
      onEnd,
    });
  };
  return {
    el: canvas,
    prime,
    unload() {
      reel?.destroy();
      reel = null;
      box.classList.remove("is-playing");
    },
    ready: () => !!reel?.ready,
    fit() {
      if (!reel) return;
      reel.fit();
      reel.draw();
    },
    seek(t) {
      at = t;
      prime();
      reel!.seek(t);
    },
    play() {
      prime();
      reel!.play();
    },
    pause: () => reel?.pause(),
    progress: () => (reel ? reel.progress : at),
    duration: () => (reel ? reel.duration : urls.length * 5.2),
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

// HH:MM:SS:FF at 24 frames a second.
const timecode = (sec: number) => {
  const f = Math.max(0, Math.floor(sec * FPS));
  const s = Math.floor(f / FPS);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60, f % FPS].map((v) => String(v).padStart(2, "0")).join(":");
};

onPage("film-reel", (signal) => {
  const root = document.querySelector<HTMLElement>("[data-reel]");
  const stage = root?.querySelector<HTMLElement>("[data-reel-stage]");
  const view = root?.querySelector<HTMLElement>("[data-reel-view]");
  if (!root || !stage || !view) return;
  const boxes = Array.from(root.querySelectorAll<HTMLElement>("[data-reel-media]"));
  const uis = Array.from(root.querySelectorAll<HTMLElement>("[data-reel-ui]"));
  const n = boxes.length;
  if (!n || uis.length !== n) return;

  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = matchMedia(PHONE_QUERY).matches;
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel) as T | null;
  const thumbs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-reel-thumb]"));
  const fill = $("[data-reel-fill]");
  const head = $("[data-reel-head]");
  const scrub = $("[data-reel-scrub]");
  const tcNow = $("[data-reel-tc]");
  const tcAll = $("[data-reel-tc-all]");
  const next = $("[data-reel-next]");
  const nextName = $("[data-reel-next-name]");
  const live = $("[data-reel-live]");
  const glCanvas = $<HTMLCanvasElement>("[data-reel-gl]");
  const glare = $("[data-reel-glare]");
  const watch = $<HTMLAnchorElement>("[data-reel-watch]");
  const watchName = $("[data-reel-watch-name]");
  const after = root.dataset.after || "";

  const titles = uis.map((u) => u.querySelector(".reel-title")?.textContent?.trim() || "");
  const sound = new FilmSound(uis.map((u) => u.dataset.audio || undefined));

  root.classList.add("is-live");
  root.style.setProperty("--seg", String(SEG));
  if (phone) html.classList.add("fm-reel-solid");

  // ---------------------------------------------------------------- where
  let top = 0;
  let vh = 1;
  const measure = () => {
    top = root.getBoundingClientRect().top + window.scrollY;
    vh = stage.clientHeight || window.innerHeight;
  };
  measure();
  const where = () => {
    const u = (window.scrollY - top) / vh;
    const i = Math.max(0, Math.min(n - 1, Math.floor(u / SEG)));
    const w = u - i * SEG;
    return { i, u, t: clamp01(w / SCRUB), hold: clamp01((w - SCRUB) / HOLD) };
  };
  const yFor = (i: number, t: number) => Math.round(top + (i * SEG + clamp01(t) * SCRUB) * vh);
  const inReel = () => {
    const u = (window.scrollY - top) / vh;
    return u > -0.02 && u < n * SEG + 0.02;
  };

  // ---------------------------------------------------------------- media
  let playing = false;
  let current = where().i;
  const medias = boxes.map((b, i) => makeMedia(b, phone, signal, () => i === current && stopPlay()));
  let target = where().t;
  let shown = target;
  let easeRaf = 0;
  let playRaf = 0;
  let onScreen = true;
  // Put the page where the playhead is, without a scroll animation.
  const syncScroll = (t: number) => window.scrollTo({ top: yFor(current, t), behavior: "instant" as ScrollBehavior });

  const keep = (i: number) =>
    medias.forEach((m, k) => {
      if (k === i) return;
      m.pause();
      if (Math.abs(k - i) === 1) m.prime();
      else m.unload();
    });

  const paint = () => {
    const d = medias[current].duration();
    if (fill) fill.style.transform = `scaleX(${shown})`;
    if (head) head.style.transform = `translateX(${(shown * 100).toFixed(3)}%)`;
    if (tcNow) tcNow.textContent = timecode(shown * d);
    if (tcAll && d) tcAll.textContent = timecode(d);
    if (scrub) {
      scrub.setAttribute("aria-valuenow", String(Math.round(shown * 100)));
      scrub.setAttribute("aria-valuetext", `${timecode(shown * d)} of ${timecode(d)}`);
    }
  };
  // The picture eases to the playhead, so a wheel's steps glide.
  const ease = () => {
    const d = target - shown;
    shown = reduce || Math.abs(d) < 0.0008 ? target : shown + d * 0.24;
    if (!playing) medias[current].seek(shown);
    paint();
    easeRaf = shown === target ? 0 : requestAnimationFrame(ease);
  };
  const aim = (t: number) => {
    target = clamp01(t);
    if (!easeRaf) easeRaf = requestAnimationFrame(ease);
  };

  const announce = (i: number) => {
    if (live) live.textContent = `${titles[i]}, film ${i + 1} of ${n}`;
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
    thumbs.forEach((b, k) => (k === i ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
    const href = uis[i].dataset.href;
    if (watch && href) watch.href = href;
    if (watchName) watchName.textContent = titles[i];
    if (nextName) nextName.textContent = i < n - 1 ? titles[i + 1] : "The slate";
  };

  // ------------------------------------------------------------ play by hand
  const followPlay = () => {
    if (!playing) return;
    shown = target = medias[current].progress();
    paint();
    playRaf = requestAnimationFrame(followPlay);
  };
  const startPlay = () => {
    if (playing || !onScreen) return;
    playing = true;
    root.classList.add("is-rolling");
    cancelAnimationFrame(easeRaf);
    easeRaf = 0;
    const m = medias[current];
    if (shown >= 0.995) m.seek(0);
    m.play();
    sound.playFrom(current, m.progress(), 500);
    playRaf = requestAnimationFrame(followPlay);
  };
  function stopPlay() {
    if (!playing) return;
    playing = false;
    root.classList.remove("is-rolling");
    cancelAnimationFrame(playRaf);
    const m = medias[current];
    m.pause();
    sound.stop(400);
    shown = target = m.progress();
    paint();
    if (inReel()) syncScroll(shown);
  }

  // ------------------------------------------------------------------ cuts
  let gl: ReelGL | null = null;
  let glTried = false;
  const shader = () => {
    if (!glTried && glCanvas && !reduce) {
      glTried = true;
      gl = createReelGL(glCanvas, phone ? 8 : 12, phone ? 1 : 1.5);
    }
    return gl && gl.ok ? gl : null;
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const warm = idle ? idle(() => !signal.aborted && shader(), { timeout: 2500 }) : window.setTimeout(() => !signal.aborted && shader(), 1200);

  let cutting = false;
  let wanted = -1;
  const cut = async (to: number) => {
    if (cutting) {
      wanted = to;
      return;
    }
    if (to === current) return;
    cutting = true;
    stopPlay();
    const from = current;
    const dir: 1 | -1 = to > from ? 1 : -1;
    const a = medias[from];
    const b = medias[to];
    const p = where();
    current = to;
    target = shown = p.i === to ? p.t : dir > 0 ? 0 : 1;
    b.prime();
    b.seek(shown);
    announce(to);
    paint();
    const g = shader();
    const ready = g ? await waitFor(() => b.ready() && a.ready(), 300, signal) : false;
    if (signal.aborted) return;
    const end = () => {
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
      const q = where();
      if (q.i === current) aim(q.t);
    };
    if (g && ready) {
      a.pause();
      g.run(
        a.el,
        b.el,
        dir,
        CUT_MS,
        () => {
          glCanvas?.classList.remove("is-on");
          end();
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
        root.classList.remove("is-fade");
        end();
      },
      reduce ? 220 : 620,
    );
  };

  // The page's scroll is the playhead. A jump in flight wins until it lands.
  let flight: { y: number; until: number } | null = null;
  const jump = (i: number) => {
    const y = yFor(i, 0);
    flight = { y, until: performance.now() + 1400 };
    window.scrollTo({ top: y, behavior: reduce ? ("instant" as ScrollBehavior) : "smooth" });
    void cut(i);
  };
  const onScroll = () => {
    if (flight) {
      if (Math.abs(window.scrollY - flight.y) < 2 || performance.now() > flight.until) flight = null;
      else return;
    }
    const p = where();
    if (next) {
      next.style.opacity = String(p.hold);
      next.style.transform = `translateY(${((1 - p.hold) * 10).toFixed(2)}px)`;
    }
    root.classList.toggle("is-holding", p.hold > 0.02);
    if (p.u > n * SEG + 0.5) return;
    if (p.i !== (cutting && wanted >= 0 ? wanted : current)) {
      void cut(p.i);
      return;
    }
    if (!playing && p.i === current) aim(p.t);
  };
  window.addEventListener("scroll", onScroll, { passive: true, signal });

  // -------------------------------------------------------- drag and hold
  let press: { x: number; y: number; id: number; t: number } | null = null;
  let dragging = false;
  let holdTimer = 0;
  const release = () => {
    clearTimeout(holdTimer);
    if (playing) stopPlay();
    if (dragging) root.classList.remove("is-scrubbing");
    press = null;
    dragging = false;
  };
  stage.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0 || (e.target as Element).closest("a, button, [data-reel-scrub]")) return;
      press = { x: e.clientX, y: e.clientY, id: e.pointerId, t: shown };
      dragging = false;
      holdTimer = window.setTimeout(startPlay, 320);
    },
    { signal },
  );
  window.addEventListener(
    "pointermove",
    (e) => {
      if (!press || e.pointerId !== press.id) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        dragging = true;
        clearTimeout(holdTimer);
        stopPlay();
        root.classList.add("is-scrubbing");
      } else if (!dragging && Math.hypot(dx, dy) > 10) {
        clearTimeout(holdTimer);
      }
      if (dragging) {
        const t = clamp01(press.t + dx / (stage.clientWidth * 0.85));
        aim(t);
        syncScroll(t);
      }
    },
    { signal },
  );
  window.addEventListener("pointerup", release, { signal });
  window.addEventListener("pointercancel", release, { signal });
  // A long press on a phone plays; it should not open the system menu.
  stage.addEventListener("contextmenu", (e) => press && e.preventDefault(), { signal });

  // The scrub bar itself: press or drag along it.
  if (scrub) {
    let on = false;
    const toBar = (x: number) => {
      const r = scrub.getBoundingClientRect();
      const t = clamp01((x - r.left) / r.width);
      aim(t);
      syncScroll(t);
    };
    scrub.addEventListener(
      "pointerdown",
      (e) => {
        on = true;
        stopPlay();
        scrub.setPointerCapture?.(e.pointerId);
        toBar(e.clientX);
      },
      { signal },
    );
    scrub.addEventListener("pointermove", (e) => on && toBar(e.clientX), { signal });
    scrub.addEventListener("pointerup", () => (on = false), { signal });
    scrub.addEventListener("pointercancel", () => (on = false), { signal });
  }

  thumbs.forEach((b, k) => b.addEventListener("click", () => jump(k), { signal }));

  // ------------------------------------------------------------- keyboard
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || html.classList.contains("lb-lock")) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || !inReel()) return;
      const p = where();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        stopPlay();
        const t = clamp01(target + (e.key === "ArrowRight" ? 1 : -1) / 40);
        aim(t);
        syncScroll(t);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (p.i < n - 1) jump(p.i + 1);
        else document.querySelector(after)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      } else if (e.key === "ArrowUp" && (p.i > 0 || p.t > 0.01)) {
        e.preventDefault();
        jump(p.t > 0.05 ? p.i : p.i - 1);
      }
    },
    { signal },
  );

  // ------------------------------------------------- tilt, glare and Watch
  let tiltRaf = 0;
  let nx = 0;
  let ny = 0;
  let cx = 0;
  let cy = 0;
  let px = 0;
  let py = 0;
  let wx = 0;
  let wy = 0;
  let hx = 0;
  let hy = 0;
  const homeWatch = () => {
    hx = stage.clientWidth * 0.5;
    hy = stage.clientHeight * 0.66;
  };
  homeWatch();
  wx = hx;
  wy = hy;
  const frame = () => {
    cx += (nx - cx) * 0.08;
    cy += (ny - cy) * 0.08;
    wx += (hx - wx) * 0.2;
    wy += (hy - wy) * 0.2;
    if (mouse && !reduce) {
      view.style.transform = `perspective(1600px) rotateX(${(-cy * 3).toFixed(3)}deg) rotateY(${(cx * 4.2).toFixed(3)}deg) scale(1.05)`;
      if (glare) glare.style.transform = `translate3d(${(px - 450).toFixed(1)}px, ${(py - 450).toFixed(1)}px, 0)`;
    }
    if (watch) watch.style.transform = `translate3d(${wx.toFixed(1)}px, ${wy.toFixed(1)}px, 0) translate(-50%, -50%)`;
    const moving = Math.abs(nx - cx) + Math.abs(ny - cy) + Math.abs(hx - wx) / 100 + Math.abs(hy - wy) / 100 > 0.002;
    tiltRaf = moving ? requestAnimationFrame(frame) : 0;
  };
  const kick = () => {
    if (!tiltRaf) tiltRaf = requestAnimationFrame(frame);
  };
  frame();
  if (mouse) {
    stage.addEventListener(
      "pointermove",
      (e) => {
        const r = stage.getBoundingClientRect();
        px = e.clientX - r.left;
        py = e.clientY - r.top;
        nx = px / r.width - 0.5;
        ny = py / r.height - 0.5;
        hx = px + 22;
        hy = py + 22;
        root.classList.add("is-hover");
        kick();
      },
      { signal },
    );
    stage.addEventListener(
      "pointerleave",
      () => {
        nx = ny = 0;
        homeWatch();
        root.classList.remove("is-hover");
        kick();
      },
      { signal },
    );
    watch?.addEventListener(
      "focus",
      () => {
        homeWatch();
        kick();
      },
      { signal },
    );
  }

  // -------------------------------------------------- off screen, resize
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true;
    if (!onScreen) stopPlay();
  });
  io.observe(stage);
  document.addEventListener("visibilitychange", () => document.hidden && stopPlay(), { signal });
  window.addEventListener("sound:state", () => sound.sync(playing), { signal });
  window.addEventListener(
    "resize",
    () => {
      measure();
      homeWatch();
      medias.forEach((m) => m.fit());
      kick();
    },
    { passive: true, signal },
  );

  // ------------------------------------------------------------ first film
  setActive(current);
  keep(current);
  medias[current].prime();
  medias[current].seek(shown);
  paint();
  announce(current);
  onScroll();

  return () => {
    stopPlay();
    io.disconnect();
    clearTimeout(holdTimer);
    if (idle) (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(warm);
    else clearTimeout(warm);
    cancelAnimationFrame(easeRaf);
    cancelAnimationFrame(tiltRaf);
    gl?.destroy();
    medias.forEach((m) => m.unload());
    sound.destroy();
    html.classList.remove("fm-reel-solid");
    root.classList.remove("is-live", "is-fade", "is-holding", "is-rolling", "is-scrubbing", "is-hover");
  };
});
