// The architecture page's diagram: trace a part's paths on hover, open its
// notes on click, show one path at a time from the view buttons, and run the
// minute clock that sends a pulse through the sync path when it hits zero.
// Archify's SVG carries data-node-id on parts and data-edge-from/to on paths,
// which is all this needs.

type Part = { kind: string; owner: string; what: string; fails?: string; source?: string };

const SVG_NS = "http://www.w3.org/2000/svg";

export function initArchitecture() {
  const stage = document.querySelector<HTMLElement>("[data-stage]");
  const canvas = stage?.querySelector<HTMLElement>("[data-canvas]");
  const svg = canvas?.querySelector<SVGSVGElement>("svg");
  if (!stage || !canvas || !svg) return;

  const parts: Record<string, Part> = JSON.parse(document.getElementById("arch-parts")?.textContent || "{}");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const nodes = new Map<string, SVGGElement>();
  svg.querySelectorAll<SVGGElement>("g[data-node-id]").forEach((g) => nodes.set(g.dataset.nodeId!, g));
  const edges = [...svg.querySelectorAll<SVGPathElement>("path[data-edge-from]")];
  const labels = [...svg.querySelectorAll<SVGGElement>("g[data-edge-id]")];

  const neighbours = new Map<string, Set<string>>();
  for (const id of nodes.keys()) neighbours.set(id, new Set());
  for (const e of edges) {
    neighbours.get(e.dataset.edgeFrom!)?.add(e.dataset.edgeTo!);
    neighbours.get(e.dataset.edgeTo!)?.add(e.dataset.edgeFrom!);
  }

  // Light a set of parts and every path that runs between two lit parts.
  const light = (ids: Set<string> | null, mode: "trace" | "view" | null) => {
    stage.classList.toggle("is-tracing", mode === "trace");
    stage.classList.toggle("is-view", mode === "view");
    nodes.forEach((g, id) => g.classList.toggle("is-lit", !!ids?.has(id)));
    const on = (from?: string, to?: string) => !!ids && !!from && !!to && ids.has(from) && ids.has(to);
    edges.forEach((e) => e.classList.toggle("is-lit", on(e.dataset.edgeFrom, e.dataset.edgeTo)));
    labels.forEach((l) => l.classList.toggle("is-lit", on(l.dataset.edgeFrom, l.dataset.edgeTo)));
  };

  // Views: one path at a time, with its note under the drawing.
  const note = stage.querySelector<HTMLElement>("[data-note]");
  const defaultNote = note?.textContent || "";
  let view: Set<string> | null = null;
  stage.querySelectorAll<HTMLButtonElement>(".sv").forEach((btn) => {
    btn.addEventListener("click", () => {
      stage.querySelectorAll<HTMLButtonElement>(".sv").forEach((b) => {
        b.classList.toggle("is-on", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      const focus = btn.dataset.focus;
      view = focus ? new Set(focus.split(",")) : null;
      light(view, view ? "view" : null);
      if (note) note.textContent = btn.dataset.note || defaultNote;
    });
  });

  const restore = () => light(view, view ? "view" : null);
  nodes.forEach((g, id) => {
    const trace = () => light(new Set([id, ...(neighbours.get(id) || [])]), "trace");
    g.addEventListener("pointerenter", trace);
    g.addEventListener("focus", trace);
    g.addEventListener("pointerleave", restore);
    g.addEventListener("blur", restore);
    g.addEventListener("click", () => open(id));
    g.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        open(id);
      }
    });
  });

  // The inspector: what the part is, how it fails, what it talks to.
  const insp = stage.querySelector<HTMLElement>("[data-inspector]")!;
  const set = (sel: string, text: string) => {
    const el = insp.querySelector<HTMLElement>(sel);
    if (el) el.textContent = text;
  };
  let picked: string | null = null;
  // Matches the breakpoint in architecture.css where the inspector stops
  // floating over the drawing and sits below it.
  const sheetLayout = window.matchMedia("(max-width: 860px)");
  function open(id: string) {
    const p = parts[id];
    const g = nodes.get(id);
    if (!p || !g) return;
    picked = id;
    nodes.forEach((n, nid) => n.classList.toggle("is-picked", nid === id));
    set("[data-insp-kind]", p.kind);
    set("[data-insp-name]", g.dataset.nodeLabel || id);
    set("[data-insp-what]", p.what);
    set("[data-insp-fails]", p.fails || "");
    insp.querySelector<HTMLElement>("[data-insp-fails-wrap]")!.hidden = !p.fails;
    set("[data-insp-src]", p.source || "");
    insp.querySelector<HTMLElement>("[data-insp-src]")!.hidden = !p.source;
    const list = insp.querySelector<HTMLUListElement>("[data-insp-links]")!;
    list.replaceChildren(
      ...[...(neighbours.get(id) || [])].map((nid) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = nodes.get(nid)?.dataset.nodeLabel || nid;
        b.addEventListener("click", () => open(nid));
        li.append(b);
        return li;
      }),
    );
    insp.hidden = false;
    stage.classList.add("has-inspector");
    // On phones the notes sheet sits under the drawing; the floating chat and
    // back to top buttons step aside while it is open.
    document.body.classList.add("arch-notes-open");
    requestAnimationFrame(() => {
      insp.classList.add("is-open");
      // On phones the notes are a sheet under the drawing, often below the
      // fold; bring the whole sheet into view so a tap visibly answers.
      if (sheetLayout.matches) insp.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    });
  }
  function close() {
    picked = null;
    nodes.forEach((n) => n.classList.remove("is-picked"));
    insp.classList.remove("is-open");
    stage.classList.remove("has-inspector");
    document.body.classList.remove("arch-notes-open");
    setTimeout(() => {
      if (!picked) insp.hidden = true;
    }, 280);
  }
  insp.querySelector("[data-insp-close]")?.addEventListener("click", close);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && picked) close();
  });

  // Pulses: light travelling along a path. The main data path carries a
  // slow steady stream; the clock fires a brighter burst on the sync path.
  const pulse = (edge: SVGPathElement, opts: { dur: number; begin?: number; burst?: boolean; reverse?: boolean }) => {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("r", opts.burst ? "3.2" : "2.2");
    c.setAttribute("class", opts.burst ? "pulse pulse-burst" : "pulse");
    const anim = document.createElementNS(SVG_NS, "animateMotion");
    anim.setAttribute("dur", `${opts.dur}s`);
    anim.setAttribute("rotate", "auto");
    // A request runs against the drawn arrow: the caller asking, before the
    // answer comes back along it.
    if (opts.reverse) {
      anim.setAttribute("keyPoints", "1;0");
      anim.setAttribute("keyTimes", "0;1");
      anim.setAttribute("calcMode", "linear");
    }
    anim.setAttribute("fill", opts.burst ? "remove" : "freeze");
    anim.setAttribute("repeatCount", opts.burst ? "1" : "indefinite");
    anim.setAttribute("begin", opts.burst ? "indefinite" : `${opts.begin ?? 0}s`);
    const mp = document.createElementNS(SVG_NS, "mpath");
    mp.setAttribute("href", `#${edge.id}`);
    anim.append(mp);
    c.append(anim);
    edge.parentNode!.insertBefore(c, edge.nextSibling);
    if (opts.burst) {
      (anim as unknown as SVGAnimationElement).beginElement();
      setTimeout(() => c.remove(), opts.dur * 1000 + 60);
    }
  };

  if (!reduceMotion) {
    edges
      .filter((e) => e.classList.contains("a-emphasis"))
      .forEach((e, i) => {
        pulse(e, { dur: 2.6, begin: i * 0.45 });
        pulse(e, { dur: 2.6, begin: i * 0.45 + 1.3 });
      });
  }

  const live = stage.querySelector<HTMLElement>("[data-live]");
  if (live) runLive(live);

  // The replay: the system's real rhythm, run on a clock in the browser.
  // Interval and daily systems count down on their real schedule in New York
  // time; event systems replay one request every few seconds. The speed
  // slider runs that clock faster, so a 6 AM job does not take a day to see.
  function runLive(el: HTMLElement) {
    const mode = (el.dataset.mode || "interval") as "interval" | "daily" | "event";
    const every = (Number(el.dataset.every) || 60) * 1000;
    const win = (el.dataset.window || "").split(",").filter(Boolean).map(Number);
    const [atH = 0, atM = 0] = (el.dataset.at || "").split(":").filter(Boolean).map(Number);
    const days = (el.dataset.days || "").split(",").filter(Boolean).map(Number);
    const tz = el.dataset.tz || "America/New_York";
    const path = (el.dataset.path || "").split(",").filter(Boolean);
    const count = el.querySelector<HTMLElement>("[data-live-count]");
    const ring = el.querySelector<SVGCircleElement>("[data-tick-ring]");
    const clock = stage!.querySelector<HTMLElement>("[data-sim-clock]");
    const speedIn = stage!.querySelector<HTMLInputElement>("[data-speed]");
    const speedOut = stage!.querySelector<HTMLElement>("[data-speed-out]");
    const SPEEDS = [1, 10, 60, 600, 3600];
    const SPEED_NAMES = ["Real time", "10x", "1 minute a second", "10 minutes a second", "1 hour a second"];
    const len = 2 * Math.PI * 8;
    if (ring) ring.style.strokeDasharray = `${len}`;

    const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const partsFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const clockFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit" });
    const at = (ms: number) => {
      const p = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
      return { wd: WD[p.weekday] || 1, sod: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) };
    };
    const dayOk = (ms: number) => !days.length || days.includes(at(ms).wd);
    const inWindow = (ms: number) => {
      if (win.length < 2) return true;
      const h = at(ms).sod / 3600;
      return h >= win[0] && h < win[1];
    };

    // The next run at or after `from`, in simulated time.
    const nextRun = (from: number): number => {
      if (mode === "daily") {
        const { sod } = at(from);
        let delta = atH * 3600 + atM * 60 - sod;
        if (delta <= 0) delta += 86400;
        let t = Math.floor(from / 1000) * 1000 + delta * 1000;
        for (let i = 0; i < 8 && !dayOk(t); i++) t += 86400000;
        return t;
      }
      if (mode === "event") return from + every;
      let t = Math.ceil((from + 1) / every) * every;
      for (let i = 0; i < 20000 && !(inWindow(t) && dayOk(t)); i++) t += every;
      return t;
    };

    // Simulated time runs from an anchor at the chosen speed.
    let speed = 1;
    let anchorSim = Date.now();
    let anchorReal = performance.now();
    const simNow = () => anchorSim + (performance.now() - anchorReal) * speed;
    let target = nextRun(simNow());
    let lastRun = simNow();
    let lastFireReal = 0;

    const fire = () => {
      lastFireReal = performance.now();
      el.classList.remove("is-firing");
      void el.offsetWidth;
      el.classList.add("is-firing");
      const step = 380;
      path.forEach((id, i) => {
        setTimeout(() => {
          const g = nodes.get(id);
          if (!g) return;
          g.classList.remove("is-woken");
          void (g as unknown as HTMLElement).getBoundingClientRect();
          g.classList.add("is-woken");
        }, i * step);
        if (reduceMotion || i === path.length - 1) return;
        const a = path[i];
        const b = path[i + 1];
        const fwd = edges.find((e) => e.dataset.edgeFrom === a && e.dataset.edgeTo === b);
        const back = fwd ? null : edges.find((e) => e.dataset.edgeFrom === b && e.dataset.edgeTo === a);
        const edge = fwd || back;
        if (edge) setTimeout(() => pulse(edge, { dur: 0.75, burst: true, reverse: !!back }), i * step);
      });
    };

    el.querySelector("[data-live-fire]")?.addEventListener("click", fire);
    speedIn?.addEventListener("input", () => {
      const now = simNow();
      speed = SPEEDS[Number(speedIn.value)] ?? 1;
      anchorSim = now;
      anchorReal = performance.now();
      if (speedOut) speedOut.textContent = SPEED_NAMES[Number(speedIn.value)] ?? "Real time";
      stage!.classList.toggle("is-fast", speed > 1);
    });

    const span = (ms: number) => {
      const s = Math.max(0, Math.ceil(ms / 1000));
      if (s < 100) return `${s}s`;
      if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
      return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
    };

    let lastText = "";
    // The clock face and the asleep check read whole seconds, so they are
    // worked out once per simulated second, not on every frame.
    let lastSec = NaN;
    let asleep = false;
    let raf = 0;
    let timer = 0;
    let onScreen = true;
    const loop = () => {
      raf = 0;
      const now = simNow();
      if (now >= target) {
        // At high speed several runs can pass in one frame; show one, keep a
        // short gap so the drawing never strobes.
        if (performance.now() - lastFireReal > 900) fire();
        lastRun = target;
        target = nextRun(Math.max(now, target));
      }
      const left = target - now;
      const period = Math.max(1000, target - lastRun);
      const sec = Math.floor(now / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        asleep = mode === "interval" && win.length === 2 && !inWindow(now);
        el.classList.toggle("is-asleep", asleep);
        if (clock) clock.textContent = clockFmt.format(new Date(now));
      }
      const text = asleep ? `asleep, wakes in ${span(left)}` : `in ${span(left)}`;
      if (count && text !== lastText) {
        count.textContent = text;
        lastText = text;
      }
      if (ring) ring.style.strokeDashoffset = `${len * Math.min(1, Math.max(0, left / period))}`;
      schedule();
    };
    // On screen the clock draws every frame. Off screen there is nothing to
    // draw, so it only wakes when the next run is due, and the run still
    // happens on time. A hidden tab runs nothing, as before: the browser
    // holds the frames, and the clock catches up when the tab comes back.
    function schedule() {
      if (onScreen) {
        if (timer) {
          clearTimeout(timer);
          timer = 0;
        }
        if (!raf) raf = requestAnimationFrame(loop);
        return;
      }
      if (timer || document.hidden) return;
      timer = window.setTimeout(() => {
        timer = 0;
        if (onScreen || document.hidden) schedule();
        else loop();
      }, Math.max(0, (target - simNow()) / speed));
    }
    speedIn?.addEventListener("input", () => {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
      schedule();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) schedule();
    });
    // Starts a screen early, so the clock is already current when it scrolls in.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => {
          onScreen = entries[entries.length - 1].isIntersecting;
          schedule();
        },
        { rootMargin: "100% 0px" },
      ).observe(stage!);
    }
    schedule();
  }

  // The light running along the paths pauses while the drawing is off
  // screen and carries on from the same place when it comes back.
  if (!reduceMotion && "IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        if (entries[entries.length - 1].isIntersecting) svg.unpauseAnimations();
        else svg.pauseAnimations();
      },
      { rootMargin: "100% 0px" },
    ).observe(stage);
  }

  // Phones: the drawing pans sideways inside its frame, the page never does.
  const hint = document.querySelector<HTMLElement>(".stage-pan-hint");
  canvas.addEventListener("scroll", () => hint?.classList.add("is-gone"), { once: true, passive: true });
}
