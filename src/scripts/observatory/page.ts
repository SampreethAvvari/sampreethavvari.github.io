// The observatory page: the list, the filters, the scroll that flies the
// camera, the live clocks, the day replay and the events the score follows.
// The 3D scene (engine.ts) loads after first paint, only where WebGL works.
// Everything here also works without it: the list is the page.
//
// Events for the score (scripts/sound can listen):
//   architecture:focus  { slug, title, discipline, disciplines }  a world is reached
//   architecture:flow   { intensity: 0..1 }                         how busy the sky is

import { asleep, clockText, nextRun, readSchedule, runsBetween, span, zoned, type Schedule } from "./clock";
import type { Engine, World } from "./types";

type Anchor = { y: number; s: number };

const DAY_SECONDS = 40; // one day of schedules, played in this many seconds
const RING = 2 * Math.PI * 8;
const HUD_RING = 2 * Math.PI * 15;

export function mountObservatory(signal: AbortSignal): void | (() => void) {
  const root = document.querySelector<HTMLElement>("[data-obs]");
  const dataEl = document.getElementById("obs-data");
  if (!root || !dataEl) return;
  const worlds: World[] = JSON.parse(dataEl.textContent || "[]");
  const stops = [...root.querySelectorAll<HTMLElement>("[data-stop]")];
  if (!stops.length) return;
  const on = { signal };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const low = matchMedia("(max-width: 767px), (pointer: coarse)").matches || (((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 4);
  const $ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = root) => el.querySelector<T>(sel);

  let engine: Engine | null = null;
  let order: number[] = stops.map((_, i) => i);
  let anchors: Anchor[] = [];
  let s = -1;
  let here = -1; // flight index of the panel nearest the middle
  let focused = -1; // world index of the system in focus, or -1
  let alertWorld: number | null = null;

  // ---------------------------------------------------------------- filters
  const discChips = [...root.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  const kindChips = [...root.querySelectorAll<HTMLButtonElement>("[data-kind]")];
  const rail = [...root.querySelectorAll<HTMLElement>("[data-rail]")];
  const empty = $("[data-obs-empty]");
  let disc = "all";
  let kind = "all";

  const applyFilters = () => {
    discChips.forEach((c) => {
      const isOn = c.dataset.filter === disc;
      c.classList.toggle("is-on", isOn);
      c.setAttribute("aria-pressed", String(isOn));
    });
    kindChips.forEach((c) => {
      const isOn = c.dataset.kind === kind;
      c.classList.toggle("is-on", isOn);
      c.setAttribute("aria-pressed", String(isOn));
    });
    order = [];
    stops.forEach((st, i) => {
      const okD = disc === "all" || (st.dataset.disciplines || "").split(" ").includes(disc);
      const okK = kind === "all" || st.dataset.kind === kind;
      st.hidden = !(okD && okK);
      rail[i].hidden = st.hidden;
      if (!st.hidden) order.push(i);
    });
    if (empty) empty.hidden = order.length > 0;
    engine?.setOrder(order);
    measure();
    onScroll();
    try {
      sessionStorage.setItem("arch-filter", disc);
    } catch {}
  };
  discChips.forEach((c) => c.addEventListener("click", () => {
    disc = c.dataset.filter || "all";
    applyFilters();
  }, on));
  kindChips.forEach((c) => c.addEventListener("click", () => {
    kind = c.dataset.kind || "all";
    applyFilters();
  }, on));
  try {
    const saved = new URLSearchParams(location.search).get("kind") || sessionStorage.getItem("arch-filter");
    if (saved && discChips.some((c) => c.dataset.filter === saved && !c.disabled)) disc = saved;
  } catch {}

  // ----------------------------------------------------------------- scroll
  // Anchors: the top of the page is the galaxy (-1), each world's panel
  // centred on screen is that world (0..n-1), the day section is n.
  const day = $("[data-obs-day]");
  const docY = (el: HTMLElement) => el.getBoundingClientRect().top + scrollY;
  function measure() {
    const vh = innerHeight;
    anchors = [{ y: 0, s: -1 }];
    order.forEach((wi, k) => {
      const st = stops[wi];
      anchors.push({ y: docY(st) + st.offsetHeight / 2 - vh / 2, s: k });
    });
    if (day) anchors.push({ y: docY(day) + Math.min(day.offsetHeight, vh) / 2 - vh / 2 + 40, s: order.length });
    for (let i = 1; i < anchors.length; i++) anchors[i].y = Math.max(anchors[i].y, anchors[i - 1].y + 1);
  }
  const progressAt = (y: number) => {
    if (y <= anchors[0].y) return anchors[0].s;
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1];
      const b = anchors[i];
      if (y <= b.y) return a.s + ((y - a.y) / (b.y - a.y)) * (b.s - a.s);
    }
    return anchors[anchors.length - 1].s;
  };
  const scrollToFlight = (k: number) => {
    const a = anchors.find((x) => x.s === k);
    if (a) scrollTo({ top: a.y, behavior: reduced ? "auto" : "smooth" });
  };

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  function update() {
    ticking = false;
    s = progressAt(scrollY);
    engine?.setScroll(s);
    const n = order.length;
    const k = Math.round(s);
    const nearest = k >= 0 && k < n && Math.abs(s - k) < 0.5 ? k : -1;
    if (nearest !== here) {
      if (here >= 0 && order[here] !== undefined) stops[order[here]].classList.remove("is-here");
      here = nearest;
      if (here >= 0) stops[order[here]].classList.add("is-here");
      rail.forEach((r) => r.classList.remove("is-here"));
      if (here >= 0) rail[order[here]].classList.add("is-here");
    }
    const f = k >= 0 && k < n && Math.abs(s - k) < 0.36 ? order[k] : -1;
    if (f !== focused) setFocus(f);
    root!.classList.toggle("is-flying", s > -0.55 && s < n - 0.45);
    root!.classList.toggle("is-awake", s > -0.6 || playing);
    cue?.classList.toggle("is-gone", s > -0.9);
  }
  const cue = $("[data-obs-cue]");
  addEventListener("scroll", onScroll, { passive: true, ...on });
  addEventListener("resize", () => {
    measure();
    onScroll();
  }, { passive: true, ...on });
  const ro = new ResizeObserver(() => {
    measure();
    onScroll();
  });
  ro.observe($("[data-obs-list]")!);

  // Rail ticks and clicks on a world in the sky fly to that world.
  rail.forEach((r, i) => r.querySelector("a")?.addEventListener("click", (e) => {
    e.preventDefault();
    const k = order.indexOf(i);
    if (k >= 0) scrollToFlight(k);
  }, on));
  root.addEventListener("click", (e) => {
    if (!engine) return;
    const t = e.target as HTMLElement;
    if (t.closest("a, button, input, label, .obs-panel, .obs-hud, .obs-filters")) return;
    const w = engine.pick();
    if (w === null) return;
    const k = order.indexOf(w);
    if (k >= 0) scrollToFlight(k);
  }, on);
  addEventListener("pointermove", (e) => {
    if (!engine || e.pointerType === "touch") return;
    engine.setPointer(e.clientX, e.clientY);
    const t = e.target as HTMLElement;
    const overUi = !!t.closest?.("a, button, .obs-panel, .obs-hud, .obs-filters, .obs-totals, nav");
    root!.classList.toggle("is-picking", !overUi && engine.pick() !== null);
  }, { passive: true, ...on });
  document.documentElement.addEventListener("pointerleave", () => engine?.setPointer(null, null), on);
  // A tap on a phone shows a part's notes where it lands.
  root.addEventListener("pointerdown", (e) => {
    if (!engine || e.pointerType !== "touch") return;
    engine.setPointer(e.clientX, e.clientY);
  }, { passive: true, ...on });

  // ------------------------------------------------------------------ focus
  type LiveState = { el: HTMLElement; sch: Schedule; target: number; last: number; when: HTMLElement | null; ring: SVGCircleElement | null; base: string; text: string };
  let live: LiveState | null = null;

  function setFocus(w: number) {
    focused = w;
    setAlert(null);
    live = null;
    if (w < 0) return;
    const st = stops[w];
    const el = st.querySelector<HTMLElement>("[data-live]");
    if (el) {
      const sch = readSchedule(el);
      const now = Date.now();
      const when = el.querySelector<HTMLElement>("[data-live-when]");
      live = {
        el,
        sch,
        target: sch.mode === "event" ? now + 1600 : nextRun(sch, now),
        last: now,
        when,
        ring: el.querySelector<SVGCircleElement>("[data-live-ring]"),
        base: when?.dataset.base ?? (when ? (when.dataset.base = when.textContent || "") : ""),
        text: "",
      };
    }
    const data = worlds[w];
    window.dispatchEvent(new CustomEvent("architecture:focus", {
      detail: { slug: data.slug, title: data.name, discipline: data.disciplines[0] ?? null, disciplines: data.disciplines },
    }));
  }

  // "Replay" sends one request along the real path, whenever it is pressed.
  stops.forEach((st, i) => {
    st.querySelector("[data-live-fire]")?.addEventListener("click", () => {
      engine?.fire(i);
      flash(st.querySelector<HTMLElement>("[data-live]"));
      if (live && focused === i && live.sch.mode === "event") {
        live.last = Date.now();
        live.target = live.last + live.sch.every * 1000;
      }
    }, on);
  });
  const flash = (el: HTMLElement | null) => {
    if (!el) return;
    el.classList.remove("is-firing");
    void el.offsetWidth;
    el.classList.add("is-firing");
    setTimeout(() => el.classList.remove("is-firing"), 900);
  };

  // When it breaks: each title opens its story, and while the list has
  // the pointer or focus, the world lights every part with a written failure.
  function setAlert(w: number | null) {
    if (w === alertWorld) return;
    alertWorld = w;
    engine?.setAlert(w);
  }
  stops.forEach((st, i) => {
    const box = st.querySelector<HTMLElement>("[data-breaks]");
    if (!box) return;
    const sync = () => {
      const open = !!box.querySelector('[aria-expanded="true"]');
      const active = box.matches(":hover") || box.contains(document.activeElement) || open;
      setAlert(active ? i : alertWorld === i ? null : alertWorld);
    };
    box.addEventListener("pointerenter", sync, on);
    box.addEventListener("pointerleave", () => requestAnimationFrame(sync), on);
    box.addEventListener("focusin", sync, on);
    box.addEventListener("focusout", () => requestAnimationFrame(sync), on);
    box.querySelectorAll<HTMLButtonElement>("[data-break]").forEach((b) => {
      b.addEventListener("click", () => {
        const open = b.getAttribute("aria-expanded") !== "true";
        b.setAttribute("aria-expanded", String(open));
        const ans = document.getElementById(b.getAttribute("aria-controls") || "");
        if (ans) ans.hidden = !open;
        sync();
      }, on);
    });
  });

  // ------------------------------------------------------------------- HUD
  const hudClock = $("[data-hud-clock]");
  const hudWhere = $("[data-hud-where]");
  const hudRing = $<SVGCircleElement>("[data-hud-ring]");
  const hudPlay = $<HTMLButtonElement>("[data-hud-play]");
  const hudPlayLabel = $("[data-hud-play-label]");
  const dayPlay = $<HTMLButtonElement>("[data-day-play]");
  const dayTotalEl = $("[data-day-total]");
  const dayHeads = [...root.querySelectorAll<HTMLElement>("[data-day-head]")];
  const dayCards = [...root.querySelectorAll<HTMLElement>("[data-day-card]")].map((card) => {
    const slug = card.dataset.dayCard!;
    const wi = worlds.findIndex((w) => w.slug === slug);
    const liveEl = stops[wi]?.querySelector<HTMLElement>("[data-live]");
    return {
      card,
      wi,
      sch: liveEl ? readSchedule(liveEl) : null,
      runs: Number(card.dataset.runs) || 0,
      nEl: card.querySelector<HTMLElement>("[data-day-n]"),
      count: 0,
      source: worlds[wi]?.live.source || slug,
    };
  });
  const finalTotal = dayTotalEl?.textContent || "";

  let playing = false;
  let playStart = 0;
  let playSod = 0;
  let lastFocusFire = 0;
  const fmt = (n: number) => n.toLocaleString("en-US");

  function startDay() {
    if (reduced) return;
    playing = true;
    playStart = performance.now();
    playSod = 0;
    dayCards.forEach((d) => {
      d.count = 0;
      if (d.nEl) d.nEl.textContent = "0";
    });
    if (dayTotalEl) dayTotalEl.textContent = "0";
    root!.classList.add("is-playing");
    if (hudPlayLabel) hudPlayLabel.textContent = "Stop";
    if (dayPlay) dayPlay.textContent = "Stop the day";
    if (hudWhere) hudWhere.textContent = "A weekday, replayed";
    kick();
  }
  function stopDay() {
    playing = false;
    root!.classList.remove("is-playing");
    dayCards.forEach((d) => {
      if (d.nEl) d.nEl.textContent = fmt(d.runs);
      d.card.classList.remove("is-firing");
    });
    if (dayTotalEl) dayTotalEl.textContent = finalTotal;
    if (hudPlayLabel) hudPlayLabel.textContent = "Play a day";
    if (dayPlay) dayPlay.textContent = "Play the day";
    if (hudWhere) hudWhere.textContent = "New York";
    if (hudRing) hudRing.style.strokeDashoffset = `${HUD_RING}`;
  }
  const toggleDay = () => (playing ? stopDay() : startDay());
  hudPlay?.addEventListener("click", toggleDay, on);
  dayPlay?.addEventListener("click", toggleDay, on);
  if (reduced) {
    hudPlay?.setAttribute("hidden", "");
    dayPlay?.setAttribute("hidden", "");
  }

  function stepDay(now: number) {
    const sod = Math.min(86400, ((now - playStart) / 1000 / DAY_SECONDS) * 86400);
    const prev = playSod;
    playSod = sod;
    const seen = new Set<string>();
    let total = 0;
    for (const d of dayCards) {
      if (!d.sch) continue;
      const runs = runsBetween(d.sch, prev, sod, 1);
      if (runs > 0) {
        d.count += runs;
        if (d.nEl) d.nEl.textContent = fmt(d.count);
        engine?.pulse(d.wi, Math.min(1, 0.3 + runs * 0.15));
        d.card.classList.add("is-firing");
        setTimeout(() => d.card.classList.remove("is-firing"), 260);
        if (d.wi === focused && now - lastFocusFire > 900) {
          lastFocusFire = now;
          engine?.fire(d.wi);
          if (live) flash(live.el);
        }
      }
      if (!seen.has(d.source)) {
        seen.add(d.source);
        total += d.count;
      }
    }
    if (dayTotalEl) dayTotalEl.textContent = fmt(total);
    const pct = `${(sod / 86400) * 100}%`;
    dayHeads.forEach((h) => (h.style.left = pct));
    if (hudClock) hudClock.textContent = clockText(sod);
    if (hudRing) hudRing.style.strokeDashoffset = `${HUD_RING * (1 - sod / 86400)}`;
    if (sod >= 86400) stopDay();
  }

  // ------------------------------------------------------------------- loop
  // One frame loop for the page's own moving words: the HUD clock, the
  // focused world's countdown and the day replay. Off screen it sleeps.
  let raf = 0;
  let visible = true;
  let lastSec = -1;
  function frame(now: number) {
    raf = 0;
    if (signal.aborted || !visible || document.hidden) return;
    const ms = Date.now();
    if (playing) stepDay(now);
    else {
      const sec = Math.floor(ms / 1000);
      if (sec !== lastSec && hudClock) {
        lastSec = sec;
        hudClock.textContent = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(ms);
        if (hudRing) hudRing.style.strokeDashoffset = `${HUD_RING * (1 - zoned(ms).sod / 86400)}`;
      }
    }
    if (live) tickLive(ms);
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && visible && !document.hidden && !signal.aborted) raf = requestAnimationFrame(frame);
  }
  function tickLive(ms: number) {
    const L = live!;
    if (ms >= L.target) {
      // Clock systems fire on their real schedule; event systems replay one
      // request every few seconds while they are in view.
      if (!(playing && L.sch.mode !== "event")) {
        engine?.fire(focused);
        flash(L.el);
      }
      L.last = L.target;
      L.target = L.sch.mode === "event" ? ms + L.sch.every * 1000 : nextRun(L.sch, ms);
    }
    const left = L.target - ms;
    const period = Math.max(1000, L.target - L.last);
    if (L.ring) L.ring.style.strokeDashoffset = `${RING * Math.min(1, Math.max(0, left / period))}`;
    if (L.sch.mode !== "event" && L.when) {
      const sleep = asleep(L.sch, ms);
      L.el.classList.toggle("is-asleep", sleep);
      const text = `${sleep ? "Asleep, wakes in" : "In"} ${span(left)}, ${L.base}`;
      if (text !== L.text) {
        L.text = text;
        L.when.textContent = text;
      }
    }
  }
  const io = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    root.classList.toggle("is-in", visible);
    engine?.setPaused(!visible || document.hidden);
    if (visible) kick();
  });
  io.observe(root);
  document.addEventListener("visibilitychange", () => {
    engine?.setPaused(!visible || document.hidden);
    kick();
  }, on);

  // ------------------------------------------------------------ the totals
  // The totals count up while the worlds light, from the core outwards.
  const countUp = () => {
    if (reduced) return;
    const els = [...root.querySelectorAll<HTMLElement>("[data-count-to]")];
    const t0 = performance.now();
    const dur = 2400;
    const step = (t: number) => {
      if (signal.aborted) return;
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      for (const el of els) {
        const to = Number(el.dataset.countTo);
        el.textContent = `${el.dataset.countPrefix || ""}${Math.round(to * e)}`;
      }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // --------------------------------------------------------------- engine
  // The 3D scene loads after the first paint, where WebGL2 works.
  const canvas = $<HTMLCanvasElement>("[data-obs-canvas]");
  const engines = import.meta.glob("./engine.ts");
  const load = Object.values(engines)[0] as undefined | (() => Promise<{ mountEngine: (c: HTMLCanvasElement, o: unknown) => Engine }>);
  const hasGL = (() => {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  })();
  let lastFlow = -1;
  let lastFlowAt = 0;
  const onActivity = (a: number) => {
    const t = performance.now();
    if (Math.abs(a - lastFlow) < 0.04 && !(a === 0 && lastFlow !== 0)) return;
    if (t - lastFlowAt < 200) return;
    lastFlow = a;
    lastFlowAt = t;
    window.dispatchEvent(new CustomEvent("architecture:flow", { detail: { intensity: Math.round(a * 100) / 100 } }));
  };
  let idle = 0;
  if (canvas && load && hasGL) {
    const boot = () =>
      load()
        .then((m) => {
          if (signal.aborted) return;
          engine = m.mountEngine(canvas, {
            worlds,
            low,
            reduced,
            onActivity,
            onReady: () => {
              if (signal.aborted) return;
              root.classList.add("is-3d");
              engine?.ignite();
              countUp();
              measure();
              onScroll();
            },
            dom: {
              labels: $("[data-obs-labels]")!,
              eye: $("[data-obs-eye]")!,
              eyeImg: $<HTMLImageElement>("[data-eye-img]")!,
              eyeName: $("[data-eye-name]")!,
              eyeMeta: $("[data-eye-meta]")!,
              tip: $("[data-obs-tip]")!,
              tipKind: $("[data-tip-kind]")!,
              tipName: $("[data-tip-name]")!,
              tipSub: $("[data-tip-sub]")!,
              tipFails: $("[data-tip-fails]")!,
              wake: $("[data-obs-wake]")!,
            },
          });
          engine.setOrder(order);
          engine.setScroll(s);
          engine.setPaused(!visible || document.hidden);
        })
        .catch((err) => console.error(err));
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) idle = ric(boot, { timeout: 900 });
    else idle = window.setTimeout(boot, 300);
  }

  applyFilters();
  measure();
  update();
  kick();
  // Fonts and lazy images settle the layout a moment later.
  document.fonts?.ready.then(() => {
    if (signal.aborted) return;
    measure();
    onScroll();
  });

  return () => {
    cancelAnimationFrame(raf);
    const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    if (cic) cic(idle);
    else clearTimeout(idle);
    io.disconnect();
    ro.disconnect();
    engine?.destroy();
    engine = null;
    root.classList.remove("is-3d", "is-in", "is-flying", "is-playing", "is-picking");
  };
}
