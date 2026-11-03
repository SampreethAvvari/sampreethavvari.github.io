// The reel at the top of /filmmaking: one film per screen, its clip (or its
// stills) full bleed, and the cut to the next film on scroll.
//
// Two ways to show it, chosen once per visit of the page:
//  - Stage (mouse and trackpad screens): the reel is a tall section with a
//    pinned stage. The page's own scroll position picks the film. A wheel
//    gesture, an arrow key or Page Down steps one film; past the last film
//    the page scrolls on as usual, so nothing is ever held. Each cut runs
//    through the WebGL shader in reel-gl.ts, or a crossfade without it.
//  - Panels (phones and tablets): one full screen panel per film, stacked,
//    with scroll snap. Swiping moves the picture with the finger.
//
// One clip decodes at a time and the next one is fetched ahead. Everything
// stops when the reel is off screen, the tab is hidden, or the page goes.

import { onPage } from "../../scripts/lifecycle";
import { createReelGL, type ReelGL } from "./reel-gl";
import { StillReel } from "./still-reel";
import { FilmSound } from "./film-sound";

const CUT_MS = 820;
const PANEL_QUERY = "(max-width: 767px), (hover: none) and (pointer: coarse)";

type Media = {
  el: HTMLVideoElement | HTMLCanvasElement;
  prime(): void;
  play(): void;
  pause(): void;
  unload(): void;
  ready(): boolean;
  fit(): void;
};

function makeMedia(panel: HTMLElement, phone: boolean, signal: AbortSignal): Media {
  const box = panel.querySelector<HTMLElement>(".reel-media")!;
  const shown = () => box.classList.add("is-playing");
  const video = panel.querySelector<HTMLVideoElement>("[data-reel-video]");
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
  const canvas = panel.querySelector<HTMLCanvasElement>("[data-reel-stills]")!;
  const urls: string[] = JSON.parse(canvas.dataset.stills || "[]");
  let reel: StillReel | null = null;
  const prime = () => {
    reel ??= new StillReel(canvas, urls, { phone, dprCap: 1.5, onFirstFrame: shown });
  };
  return {
    el: canvas,
    prime,
    play() {
      prime();
      reel!.play();
    },
    pause: () => reel?.pause(),
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

onPage("film-reel", (signal) => {
  const root = document.querySelector<HTMLElement>("[data-reel]");
  const stage = root?.querySelector<HTMLElement>("[data-reel-stage]");
  if (!root || !stage) return;
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-reel-panel]"));
  const n = panels.length;
  if (!n) return;

  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const panelMode = matchMedia(PANEL_QUERY).matches;
  const medias = panels.map((p) => makeMedia(p, panelMode, signal));
  const sound = new FilmSound(panels.map((p) => p.dataset.audio || undefined));
  const live = root.querySelector<HTMLElement>("[data-reel-live]");
  const pauses = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-reel-pause]"));
  const glCanvas = root.querySelector<HTMLCanvasElement>("[data-reel-gl]");
  const watch = root.querySelector<HTMLAnchorElement>("[data-reel-watch]");
  const watchName = watch?.querySelector<HTMLElement>("[data-reel-watch-name]");

  root.classList.add("is-live", panelMode ? "is-panels" : "is-stage");
  if (reduce) root.classList.add("is-still");

  // Reduced motion: nothing moves until the visitor presses play.
  let userPaused = reduce;
  let onScreen = true;
  let current = -1;
  const running = () => !userPaused && onScreen && !document.hidden;

  const label = (i: number) => panels[i]?.querySelector(".reel-title")?.textContent?.trim() || "";
  const announce = (i: number) => {
    if (live) live.textContent = `${label(i)}, film ${i + 1} of ${n}`;
  };
  const syncPauseButtons = () =>
    pauses.forEach((b) => {
      b.setAttribute("aria-pressed", String(userPaused));
      b.setAttribute("aria-label", userPaused ? "Play the reel" : "Pause the reel");
      b.classList.toggle("is-paused", userPaused);
    });
  syncPauseButtons();

  // Keep one clip decoding: the current one plays, its neighbours are
  // fetched and held, the rest let go of their files.
  const keep = (i: number) => {
    medias.forEach((m, k) => {
      if (k === i) return;
      m.pause();
      if (Math.abs(k - i) === 1) m.prime();
      else m.unload();
    });
  };
  const resume = () => {
    if (current < 0) return;
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

  pauses.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        userPaused = !userPaused;
        syncPauseButtons();
        resume();
      },
      { signal },
    ),
  );
  window.addEventListener("sound:state", () => sound.sync(running()), { signal });
  document.addEventListener("visibilitychange", resume, { signal });

  let teardownMode: () => void = () => {};

  if (panelMode) {
    // ---------------------------------------------------------- panels
    html.classList.add("fm-reel-snap");
    const activate = (i: number) => {
      if (i === current) return;
      current = i;
      panels.forEach((p, k) => p.classList.toggle("is-active", k === i));
      keep(i);
      announce(i);
      resume();
    };
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(Number((e.target as HTMLElement).dataset.i), e.isIntersecting ? e.intersectionRatio : 0);
        let best = -1;
        let top = 0;
        ratios.forEach((r, k) => {
          if (r > top) {
            top = r;
            best = k;
          }
        });
        const was = onScreen;
        onScreen = top > 0.15;
        if (best >= 0 && top >= 0.55) activate(best);
        else if (was !== onScreen) resume();
      },
      { threshold: [0, 0.15, 0.35, 0.55, 0.75, 1] },
    );
    panels.forEach((p) => io.observe(p));
    medias[0].prime();
    const onResize = () => medias.forEach((m) => m.fit());
    window.addEventListener("resize", onResize, { passive: true, signal });
    teardownMode = () => {
      io.disconnect();
      html.classList.remove("fm-reel-snap");
    };
  } else {
    // ----------------------------------------------------------- stage
    let top = 0;
    let vh = window.innerHeight;
    const measure = () => {
      top = root.getBoundingClientRect().top + window.scrollY;
      vh = window.innerHeight;
    };
    measure();
    const at = () => (window.scrollY - top) / vh;
    const indexAt = () => Math.max(0, Math.min(n - 1, Math.round(at())));

    let gl: ReelGL | null = null;
    let glTried = false;
    const shader = () => {
      if (!glTried && glCanvas && !reduce) {
        glTried = true;
        gl = createReelGL(glCanvas);
      }
      return gl && gl.ok ? gl : null;
    };

    const setActive = (i: number, leaving = -1) => {
      panels.forEach((p, k) => {
        p.classList.toggle("is-active", k === i);
        p.classList.toggle("is-leaving", k === leaving);
        p.toggleAttribute("inert", k !== i);
      });
      const href = panels[i].dataset.href;
      if (watch && href) watch.href = href;
      if (watchName) watchName.textContent = label(i);
    };

    let cutting = false;
    let wanted = -1;
    const finish = (to: number) => {
      current = to;
      keep(to);
      cutting = false;
      if (wanted >= 0 && wanted !== current) {
        const w = wanted;
        wanted = -1;
        void cut(w);
      }
      wanted = -1;
    };

    const cut = async (to: number) => {
      if (to === current && !cutting) return;
      if (cutting) {
        wanted = to;
        return;
      }
      cutting = true;
      const from = current;
      const dir: 1 | -1 = to > from ? 1 : -1;
      const a = medias[from];
      const b = medias[to];
      b.prime();
      if (running()) {
        b.play();
        sound.to(to, CUT_MS);
      }
      announce(to);
      const g = shader();
      const ready = g ? await waitFor(() => b.ready() && a.ready(), 280, signal) : false;
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
            setActive(to);
            finish(to);
          },
          () => {
            glCanvas?.classList.add("is-on");
            setActive(to, from);
          },
        );
        return;
      }
      // Crossfade: no WebGL, reduced motion, or a clip that is not ready.
      root.classList.add("is-fade");
      setActive(to, from);
      window.setTimeout(
        () => {
          a.pause();
          setActive(to);
          root.classList.remove("is-fade");
          finish(to);
        },
        reduce ? 220 : 620,
      );
    };

    // The first film shown, wherever the page opened.
    current = indexAt();
    setActive(current);
    keep(current);
    resume();
    announce(current);

    // Scroll picks the film. A step in flight wins until it lands.
    let flight: { y: number; until: number } | null = null;
    let settleTimer = 0;
    const goTo = (i: number) => {
      const y = Math.round(top + i * vh);
      flight = { y, until: performance.now() + 1100 };
      window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
      void cut(i);
    };
    const onScroll = () => {
      if (flight) {
        if (Math.abs(window.scrollY - flight.y) < 2 || performance.now() > flight.until) flight = null;
        else return;
      }
      const f = at();
      if (f <= n - 1 + 0.5) {
        const i = indexAt();
        if (i !== (cutting && wanted >= 0 ? wanted : current)) void cut(i);
      }
      // Settle on a film when a scroll (a scrollbar drag, a touch screen)
      // stops between two of them.
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        const g = at();
        if (flight || g <= 0.02 || g >= n - 1 - 0.02) return;
        if (Math.abs(g - Math.round(g)) > 0.02) goTo(Math.round(g));
      }, 180);
    };
    window.addEventListener("scroll", onScroll, { passive: true, signal });

    const step = (dir: 1 | -1) => {
      const f = at();
      const i = dir > 0 ? Math.floor(f + 0.02) + 1 : Math.ceil(f - 0.02) - 1;
      goTo(Math.max(0, Math.min(n - 1, i)));
    };

    // One wheel gesture moves one film. A gesture is a run of wheel events
    // with no gap longer than 180 ms, so a trackpad's glide after a flick
    // never carries on into the next film, or out of the reel.
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
        if (stepped) {
          if (pinned) e.preventDefault();
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

    // Off screen: stop. Back: carry on.
    const io = new IntersectionObserver((entries) => {
      onScreen = entries[0]?.isIntersecting ?? true;
      resume();
    });
    io.observe(stage);

    const onResize = () => {
      measure();
      medias.forEach((m) => m.fit());
    };
    window.addEventListener("resize", onResize, { passive: true, signal });

    // Watch follows the pointer across the picture, and a click anywhere on
    // the picture opens the film. From the keyboard it is a plain link.
    let wx = 0;
    let wy = 0;
    let tx = 0;
    let ty = 0;
    let follow = 0;
    const home = () => {
      tx = stage.clientWidth * 0.5;
      ty = stage.clientHeight * 0.74;
    };
    const place = () => {
      if (watch) watch.style.transform = `translate3d(${wx}px, ${wy}px, 0) translate(-50%, -50%)`;
    };
    home();
    wx = tx;
    wy = ty;
    place();
    const glide = () => {
      wx += (tx - wx) * 0.2;
      wy += (ty - wy) * 0.2;
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
    if (watch && matchMedia("(pointer: fine)").matches) {
      stage.addEventListener(
        "pointermove",
        (e) => {
          const r = stage.getBoundingClientRect();
          tx = e.clientX - r.left + 18;
          ty = e.clientY - r.top + 18;
          aim();
        },
        { signal },
      );
      stage.addEventListener(
        "pointerleave",
        () => {
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
      stage.addEventListener(
        "click",
        (e) => {
          if ((e.target as Element).closest("a, button")) return;
          watch.click();
        },
        { signal },
      );
    }

    teardownMode = () => {
      io.disconnect();
      clearTimeout(settleTimer);
      cancelAnimationFrame(follow);
      gl?.destroy();
    };
  }

  return () => {
    teardownMode();
    medias.forEach((m) => m.unload());
    sound.destroy();
    root.classList.remove("is-live", "is-panels", "is-stage", "is-still", "is-fade");
  };
});
