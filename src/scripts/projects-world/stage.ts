// The page side of the star system: scroll and touch, the magnetic pull at each
// world, the words that come and go, the pins and leader lines tied to real 3D
// parts, hover and click. The 3D itself loads after first paint from engine.ts.
//
// Sound hooks for the score (nothing here plays audio), on window:
//   projects:world       { index, id, accent }  a stage takes the screen. index 0
//                        is the whole system, 1 to 8 the worlds, 9 the belt.
//   projects:transition  { direction, from, to, duration }  a sling or a jump
//                        starts. direction is 1 or -1, from and to are stage
//                        indexes, duration is an estimate in ms.
//   projects:hover       { kind, id, note }  kind is "world", "part", "star" or
//                        "body". note is a stable small integer: a part's index
//                        in its world, a world's index 1 to 8, a body's index, 0
//                        for the star.
//   projects:open        { id }  a project is being opened.

import { onPage } from "../lifecycle";
import type { FrameInfo, Pick, System } from "./engine";

interface PartData { key: string; value: string; label: string }
interface WorldData { id: string; title: string; accent: string; post: string | null; shown: number; parts: PartData[] }
interface BodyData { id: string; href: string; title: string; value: string; label: string }

const emit = (name: string, detail: Record<string, unknown>) => dispatchEvent(new CustomEvent(name, { detail }));
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const inst = { behavior: "instant" as ScrollBehavior };
// Where the two shots of a world rest, as a fraction of its stage.
const REST_A = 0.3;
const REST_B = 0.7;

export function mountProjectsWorld() {
  onPage("projects-world", (signal) => {
    const root = document.querySelector<HTMLElement>("[data-pw]");
    if (!root || !root.classList.contains("is-live")) return;
    const stage = root.querySelector<HTMLElement>("[data-pw-stage]")!;
    const canvas = root.querySelector<HTMLCanvasElement>(".pw-canvas")!;
    const lines = root.querySelector<SVGSVGElement>(".pw-lines")!;
    const hero = root.querySelector<HTMLElement>("[data-pw-hero]")!;
    const countEl = root.querySelector<HTMLElement>("[data-pw-count] b");
    const tip = root.querySelector<HTMLElement>("[data-pw-tip]")!;
    const tipV = tip.querySelector("b")!;
    const tipL = tip.querySelector("span")!;
    const worlds: WorldData[] = JSON.parse(root.dataset.worlds || "[]");
    const bodiesData: BodyData[] = JSON.parse(root.dataset.bodies || "[]");
    const star = JSON.parse(root.dataset.star || "{}");
    const spans: number[] = JSON.parse(root.dataset.spans || "[]");
    const N = spans.length;
    const panes = Array.from(root.querySelectorAll<HTMLElement>("[data-pane]"));
    const pins = Array.from(root.querySelectorAll<HTMLAnchorElement>(".pw-pin[data-pin]"));
    const starPin = root.querySelector<HTMLAnchorElement>("[data-pin-star]")!;
    const bodyLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-body]"));

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const phone = matchMedia("(max-width: 899px)").matches;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const tier: "high" | "mid" | "low" = phone || memory < 4 ? "low" : coarse || memory < 6 ? "mid" : "high";

    document.documentElement.classList.add("in-pw");

    // ---- scroll: y on the page to g in stage units
    let vh = innerHeight;
    let vw = innerWidth;
    let top = 0;
    const cum: number[] = [];
    const measure = () => {
      vh = innerHeight;
      top = root.getBoundingClientRect().top + scrollY;
      let t = 0;
      spans.forEach((s, i) => {
        cum[i] = t;
        t += s;
      });
      cum[N] = t;
    };
    measure();
    // the section's height is in small viewport units; on a phone the toolbar changes innerHeight
    const rawUnit = () => (root.offsetHeight / (cum[N] + 1));
    let unit = rawUnit();
    const gFromY = (y: number) => {
      const screens = (y - top) / unit;
      if (screens <= 0) return 0;
      for (let i = 0; i < N; i++) if (screens < cum[i + 1]) return i + (screens - cum[i]) / spans[i];
      return N;
    };
    const yFromG = (g: number) => {
      const i = Math.min(N - 1, Math.max(0, Math.floor(g)));
      return top + (cum[i] + spans[i] * (g - i)) * unit;
    };

    // the places the scroll can rest
    const rests: number[] = [0];
    for (let i = 1; i < N - 1; i++) rests.push(i + REST_A, i + REST_B);
    const isWorld = (g: number) => g >= 1 && g < N - 1;

    let sys: System | null = null;
    let g = gFromY(scrollY);
    let lastG = g;
    let lastT = performance.now();
    let velocity = 0;

    // ---- what is on screen
    let active = -1;
    const beatOf = (st: number, s: number) => {
      if (st === 0) return "";
      if (st === N - 1) return s < 0.3 ? "a" : "b";
      if (s > 0.15 && s < 0.5) return "a";
      if (s > 0.5 && s < 0.86) return "b";
      return "";
    };
    const beats = new Array(N).fill("");
    const accentAt = (i: number) => (i >= 1 && i <= worlds.length ? worlds[i - 1].accent : "#5B8DEF");
    const idAt = (i: number) => (i === 0 ? "system" : i <= worlds.length ? worlds[i - 1].id : "belt");
    const setStage = (st: number) => {
      if (st === active) return;
      const from = active;
      active = st;
      emit("projects:world", { index: st, id: idAt(st), accent: accentAt(st) });
      if (countEl) countEl.textContent = String(clamp(st, 0, worlds.length)).padStart(2, "0");
      pins.forEach((p, i) => (i + 1 === st ? p.setAttribute("aria-current", "step") : p.removeAttribute("aria-current")));
      root.classList.toggle("is-touring", st > 0);
      void from;
    };
    let transitionFrom = -1;
    const update = () => {
      ticking = false;
      const y = scrollY;
      g = gFromY(y);
      const now = performance.now();
      const dt = Math.max(0.016, (now - lastT) / 1000);
      const dg = g - lastG;
      velocity = velocity * 0.6 + (dg / dt) * 0.4;
      lastG = g;
      lastT = now;

      const st = Math.min(N - 1, Math.floor(g + 0.0001));
      const s = g - st;
      // beats
      for (let i = 1; i < N; i++) {
        const b = i === st ? beatOf(i, s) : "";
        if (b !== beats[i]) {
          beats[i] = b;
          const pane = panes[i - 1];
          if (b) pane.dataset.beat = b;
          else delete pane.dataset.beat;
          if (b === "b") rectsDirty = true;
          linksDirty = true;
        }
      }
      hero.classList.toggle("is-gone", g > 0.42);
      root.classList.toggle("is-moving", g > 0.03);
      // which stage has the screen: the change comes in the middle of the sling
      const main = s > 0.97 && st < N - 1 ? st + 1 : st;
      setStage(g < 0.5 ? 0 : main);
      // leaving a world, or arriving: the sling starts
      const leaving = isWorld(st) && s > 0.86 && dg > 0;
      const backing = isWorld(st) && s < 0.14 && dg < 0;
      const inGap = leaving || backing || (st === 0 && s > 0.45 && dg > 0);
      if (inGap && transitionFrom === -1) {
        transitionFrom = st;
        const dir = dg > 0 ? 1 : -1;
        const to = Math.max(0, Math.min(N - 1, st + dir));
        const speedScreens = Math.abs(dg / dt) || 0.1;
        emit("projects:transition", { direction: dir, from: st, to, duration: Math.round(clamp((0.3 / speedScreens) * 1000, 300, 2600)) });
      } else if (!inGap) transitionFrom = -1;

      const onStage = root.getBoundingClientRect().bottom > innerHeight * 0.5;
      document.documentElement.classList.toggle("in-pw", onStage);
      sys?.setScroll(Math.min(N - 0.001, g), velocity);
    };
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
      scheduleSettle();
    };
    addEventListener("scroll", onScroll, { passive: true, signal });
    update();

    // ---- the magnetic pull: when the scroll stops near a shot, it eases on.
    // Travel stays free; nothing happens while the reader is moving.
    let gliding = false;
    let glideRaf = 0;
    let settleLater = 0;
    let lastInput = 0;
    let lastDir = 1;
    let pointerDown = false;
    const stopGlide = () => {
      if (glideRaf) cancelAnimationFrame(glideRaf);
      glideRaf = 0;
      gliding = false;
    };
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeBoth = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const glideTo = (topPx: number, dur: number, soft = false) => {
      stopGlide();
      const from = scrollY;
      const to = Math.round(topPx);
      if (Math.abs(to - from) < 2) return;
      if (reduced) {
        scrollTo({ top: to, ...inst });
        return;
      }
      gliding = true;
      const t0 = performance.now();
      const frame = (t: number) => {
        if (signal.aborted) return;
        const k = Math.min(1, (t - t0) / dur);
        scrollTo({ top: from + (to - from) * (soft ? ease(k) : easeBoth(k)), ...inst });
        if (k < 1) glideRaf = requestAnimationFrame(frame);
        else {
          gliding = false;
          glideRaf = 0;
        }
      };
      glideRaf = requestAnimationFrame(frame);
    };
    const settle = () => {
      if (gliding || pointerDown || flying || (window as Window & { __pwHold?: boolean }).__pwHold) return;
      const here = gFromY(scrollY);
      if (here >= N - 1 + 0.02 || here < 0) return; // belt and archive scroll freely
      const st = Math.floor(here);
      const s = here - st;
      // nearest shot
      let best = -1;
      let bestD = 1e9;
      for (const r of rests) {
        const d = Math.abs(r - here);
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }
      if (best < 0) return;
      const inGap = st >= 1 && st < N - 1 ? s < 0.15 || s > 0.85 : st === 0 && s > 0.2;
      let target = -1;
      if (inGap) {
        // between worlds: carry on the way they were going
        const dir = performance.now() - lastInput < 700 ? lastDir : here - best > 0 ? -1 : 1;
        const next = dir > 0 ? rests.find((r) => r > here + 0.001) : [...rests].reverse().find((r) => r < here - 0.001);
        target = next ?? best;
      } else if (bestD < 0.13 * (st === 0 ? 2 : 1)) {
        target = best;
      }
      if (target < 0) return;
      const dist = Math.abs(yFromG(target) - scrollY);
      if (dist < 3) return;
      glideTo(yFromG(target), clamp(dist * 0.7 + 420, 520, inGap ? 1700 : 1100), !inGap);
      if (inGap) {
        const dir = target > here ? 1 : -1;
        emit("projects:transition", { direction: dir, from: Math.floor(here), to: Math.round(target), duration: clamp(dist * 0.7 + 420, 520, 1700) });
      }
    };
    const scheduleSettle = () => {
      if (gliding) return;
      clearTimeout(settleLater);
      settleLater = window.setTimeout(settle, 190);
    };
    addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) return;
        stopGlide();
        const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
        if (dy) {
          lastInput = performance.now();
          lastDir = dy > 0 ? 1 : -1;
        }
      },
      { passive: true, signal },
    );

    // ---- touch: the finger moves the world directly and a fling slows like the
    // page would, so a programmatic glide never fights native momentum. The first
    // move decides between the page, an inner scroller and turning the world.
    let touchMode: "" | "page" | "turn" | "free" = "";
    let tx = 0;
    let ty = 0;
    let tlx = 0;
    let tly = 0;
    let tlt = 0;
    let tv = 0;
    let tStart = 0;
    let fling = 0;
    const stopFling = () => {
      if (fling) cancelAnimationFrame(fling);
      fling = 0;
    };
    const inStage = () => {
      const b = root.getBoundingClientRect();
      return b.top <= 0.5 && b.bottom >= innerHeight - 0.5;
    };
    addEventListener(
      "touchstart",
      (e) => {
        stopFling();
        stopGlide();
        const t = e.touches[0];
        tx = tlx = t.clientX;
        ty = tly = t.clientY;
        tlt = tStart = performance.now();
        tv = 0;
        touchMode = "";
        pointerDown = true;
      },
      { passive: true, signal },
    );
    addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length > 1) {
          touchMode = "free";
          return;
        }
        const t = e.touches[0];
        if (!touchMode) {
          const dx = t.clientX - tx;
          const dy = t.clientY - ty;
          if (Math.abs(dx) + Math.abs(dy) < 4) return;
          if (!inStage()) touchMode = "free";
          else if (Math.abs(dx) > Math.abs(dy) * 1.2 && !(e.target as Element).closest?.("a, button")) touchMode = "turn";
          else touchMode = "page";
        }
        if (touchMode === "free") return;
        if (e.cancelable) e.preventDefault();
        const now = performance.now();
        if (touchMode === "turn") {
          sys?.drag(t.clientX - tlx, t.clientY - tly);
        } else {
          const dy = tly - t.clientY;
          tv = tv * 0.3 + (dy / Math.max(1, now - tlt)) * 0.7;
          if (dy) {
            lastInput = now;
            lastDir = dy > 0 ? 1 : -1;
            scrollBy({ top: dy, ...inst });
          }
        }
        tlx = t.clientX;
        tly = t.clientY;
        tlt = now;
      },
      { passive: false, signal },
    );
    addEventListener(
      "touchend",
      (e) => {
        if (e.touches.length) return;
        pointerDown = false;
        const mode = touchMode;
        touchMode = "";
        if (mode === "turn") {
          sys?.release();
          return;
        }
        if (mode === "") {
          // a tap
          if (performance.now() - tStart < 500 && !(e.target as Element).closest?.("a, button")) {
            const c = e.changedTouches[0];
            activate(sys?.pick(c.clientX, c.clientY) ?? null);
          }
          return;
        }
        if (mode !== "page") return;
        let v = performance.now() - tlt > 90 ? 0 : tv;
        if (Math.abs(v) < 0.05) {
          scheduleSettle();
          return;
        }
        let prev = performance.now();
        const run = (now: number) => {
          if (signal.aborted) return;
          const dt = Math.min(32, now - prev);
          prev = now;
          v *= Math.pow(0.955, dt / 16);
          if (Math.abs(v) < 0.03) {
            fling = 0;
            scheduleSettle();
            return;
          }
          lastInput = now;
          lastDir = v > 0 ? 1 : -1;
          scrollBy({ top: v * dt, ...inst });
          fling = requestAnimationFrame(run);
        };
        fling = requestAnimationFrame(run);
      },
      { passive: true, signal },
    );

    // ---- keys: arrows scroll, page keys and space go to the next shot
    let flying = false;
    addEventListener(
      "keydown",
      (e) => {
        const tgt = e.target as HTMLElement | null;
        if (tgt?.closest?.("input, textarea, select, [contenteditable=true], details") || e.metaKey || e.ctrlKey || e.altKey) return;
        if (!inStage()) return;
        const down = e.key === "PageDown" || (e.key === " " && !e.shiftKey);
        const up = e.key === "PageUp" || (e.key === " " && e.shiftKey);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          lastInput = performance.now();
          lastDir = e.key === "ArrowDown" ? 1 : -1;
          return;
        }
        if (!down && !up) return;
        e.preventDefault();
        const here = gFromY(scrollY);
        const next = down ? rests.find((r) => r > here + 0.02) : [...rests].reverse().find((r) => r < here - 0.02);
        if (next == null) {
          if (down) glideTo(yFromG(N - 1 + 0.2), 900);
          return;
        }
        emit("projects:transition", { direction: down ? 1 : -1, from: Math.floor(here), to: Math.floor(next), duration: 1000 });
        glideTo(yFromG(next), 1000);
      },
      { signal },
    );

    // focus landing on something in a world that is not showing brings it up
    root.addEventListener(
      "focusin",
      (e) => {
        const el = e.target as HTMLElement;
        const pane = el.closest<HTMLElement>("[data-pane]");
        if (!pane || !el.matches?.(":focus-visible")) return;
        const i = Number(pane.dataset.pane);
        const inB = !!el.closest(".pw-b");
        const target = i >= N - 1 ? i + 0.1 : i + (inB ? REST_B : REST_A);
        if (Math.abs(g - target) > 0.04) scrollTo({ top: yFromG(target), ...inst });
      },
      { signal },
    );

    // ---- flying straight to a stage
    const flyTo = (st: number) => {
      const target = st === 0 ? 0 : st >= N - 1 ? st + 0.08 : st + REST_A;
      const from = Math.round(g);
      if (Math.abs(target - g) < 0.01) return;
      const dist = Math.abs(target - g);
      const dur = reduced ? 0 : clamp(1500 + dist * 260, 1700, 3400);
      emit("projects:transition", { direction: target > g ? 1 : -1, from, to: st, duration: dur });
      flying = true;
      window.setTimeout(() => (flying = false), dur + 200);
      stopGlide();
      clearTimeout(settleLater);
      if (sys) sys.fly(target, dur);
      scrollTo({ top: yFromG(target), ...inst });
    };
    root.querySelectorAll<HTMLAnchorElement>("[data-go]").forEach((a) => {
      a.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          flyTo(Number(a.dataset.go));
        },
        { signal },
      );
    });

    // open what a click means
    const open = (id: string, href: string | null | undefined) => {
      if (!href) return;
      emit("projects:open", { id });
      const a = document.createElement("a");
      a.href = href;
      a.style.display = "none";
      root.appendChild(a);
      a.click();
      a.remove();
    };
    const activate = (p: Pick) => {
      if (!p) return;
      if (p.kind === "star") open("hybridge-platform", star.href);
      else if (p.kind === "body") open(bodiesData[p.body].id, bodiesData[p.body].href);
      else if (active === 0 || g < 0.86) flyTo(p.world + 1);
      else open(worlds[p.world].id, worlds[p.world].post);
    };
    root.querySelectorAll<HTMLAnchorElement>("[data-open], .pw-a a.jb, .pw-body, .pw-pin-star").forEach((a) => {
      a.addEventListener(
        "click",
        () => {
          const w = a.closest<HTMLElement>("[data-w]")?.dataset.w;
          const b = a.dataset.body;
          emit("projects:open", { id: w ?? (b != null ? bodiesData[Number(b)].id : "hybridge-platform") });
        },
        { signal },
      );
    });

    // ---- the pointer: lean, hover, drag and click
    let mx = -1;
    let my = -1;
    let mOn = false;
    let dragging = false;
    let dragMoved = 0;
    let downX = 0;
    let downY = 0;
    let lastMX = 0;
    let lastMY = 0;
    let hovered: Pick = null;
    const samePick = (a: Pick, b: Pick) => JSON.stringify(a) === JSON.stringify(b);
    stage.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        mx = e.clientX;
        my = e.clientY;
        if (dragging) {
          const dx = e.clientX - lastMX;
          const dy = e.clientY - lastMY;
          dragMoved += Math.abs(dx) + Math.abs(dy);
          sys?.drag(dx, dy);
          lastMX = e.clientX;
          lastMY = e.clientY;
        }
        mOn = !(e.target as Element).closest?.("a, button");
      },
      { passive: true, signal },
    );
    stage.addEventListener("pointerleave", () => (mOn = false), { signal });
    stage.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        if ((e.target as Element).closest?.("a, button")) return;
        dragging = true;
        pointerDown = true;
        dragMoved = 0;
        downX = lastMX = e.clientX;
        downY = lastMY = e.clientY;
        stage.classList.add("is-dragging");
        stopGlide();
      },
      { signal },
    );
    addEventListener(
      "pointerup",
      (e) => {
        if (e.pointerType !== "mouse" || !dragging) return;
        dragging = false;
        pointerDown = false;
        stage.classList.remove("is-dragging");
        sys?.release();
        if (dragMoved < 6) activate(sys?.pick(downX, downY) ?? null);
        scheduleSettle();
      },
      { signal },
    );

    // stats in the HTML light their parts
    let partFromDom: { world: number; part: number } | null = null;
    root.querySelectorAll<HTMLElement>("[data-part-btn]").forEach((b) => {
      const pane = b.closest<HTMLElement>("[data-pane]");
      if (!pane) return;
      const world = Number(pane.dataset.pane) - 1;
      const part = Number(b.dataset.partBtn);
      const on = () => (partFromDom = { world, part });
      const off = () => (partFromDom = null);
      b.addEventListener("pointerenter", on, { signal });
      b.addEventListener("pointerleave", off, { signal });
      b.addEventListener("focus", on, { signal });
      b.addEventListener("blur", off, { signal });
      b.addEventListener("click", () => (partFromDom = { world, part }), { signal });
    });

    // ---- pins, leader lines, tip: all follow the engine's frame
    const NS = "http://www.w3.org/2000/svg";
    const maxLines = 6;
    const paths: SVGPathElement[] = [];
    const rings: SVGCircleElement[] = [];
    for (let i = 0; i < maxLines; i++) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "#9ec1ff");
      p.setAttribute("stroke-width", "1");
      p.setAttribute("opacity", "0");
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", "3.5");
      c.setAttribute("fill", "none");
      c.setAttribute("stroke", "#cfe0ff");
      c.setAttribute("stroke-width", "1");
      c.setAttribute("opacity", "0");
      lines.append(p, c);
      paths.push(p);
      rings.push(c);
    }
    let rectsDirty = true;
    let linksDirty = true;
    const calloutRects: { x: number; y: number; w: number; h: number; right: boolean; el: HTMLElement }[][] = [];
    const readCallouts = (w: number) => {
      const pane = panes[w];
      const out = Array.from(pane.querySelectorAll<HTMLElement>(".pw-c:not(.is-extra)")).map((el) => {
        const b = el.getBoundingClientRect();
        const rgt = !phone && getComputedStyle(el).textAlign === "right";
        return { x: b.left, y: b.top, w: b.width, h: b.height, right: rgt, el };
      });
      calloutRects[w] = out;
      return out;
    };
    let lineOpacity = 0;
    const labelShift = new Float32Array(worlds.length + 1);
    const pinPlace = new Float32Array(worlds.length * 2);

    const onFrame = (f: FrameInfo) => {
      // pointer, once per frame
      if (sys) {
        sys.setPointer(mx, my, mOn && !dragging);
        let p: Pick = null;
        if (mOn && !dragging) p = sys.pick(mx, my);
        if (partFromDom) p = { kind: "part", world: partFromDom.world, part: partFromDom.part };
        if (!samePick(p, hovered)) {
          hovered = p;
          sys.setHeat(p);
          canvas.dataset.cursor = p ? "press" : "";
          stage.dataset.cursor = p ? "press" : "";
          if (p) {
            if (p.kind === "part") emit("projects:hover", { kind: "part", id: `${worlds[p.world].id}:${worlds[p.world].parts[p.part].key}`, note: p.part });
            else if (p.kind === "world") emit("projects:hover", { kind: "world", id: worlds[p.world].id, note: p.world + 1 });
            else if (p.kind === "star") emit("projects:hover", { kind: "star", id: "hybridge-platform", note: 0 });
            else emit("projects:hover", { kind: "body", id: bodiesData[p.body].id, note: p.body });
          }
          root.querySelectorAll(".pw-c.is-hot").forEach((el) => el.classList.remove("is-hot"));
          pins.forEach((a, i) => a.classList.toggle("is-hot", !!p && (p.kind === "world" || p.kind === "part") && p.world === i));
          starPin.classList.toggle("is-hot", p?.kind === "star");
          bodyLinks.forEach((a, i) => a.classList.toggle("is-hot", p?.kind === "body" && p.body === i));
          if (p?.kind === "part") panes[p.world].querySelector(`.pw-c[data-part="${p.part}"]`)?.classList.add("is-hot");
        }
      }

      // ---- pins on the first screen, an index on the right edge later
      const o = f.overview;
      const k = smooth(0.06, 0.62, o); // 1 pinned, 0 railed
      const railX = vw - (phone ? 14 : 22);
      const railTop = vh * 0.5 - ((worlds.length - 1) * 26) / 2;
      const margin = 8;
      // stack the labels so none sits on another
      const order = pins.map((_, i) => i).sort((a, b) => f.worlds[a * 4 + 1] - f.worlds[b * 4 + 1]);
      let lastBottom = -100;
      const lastX: number[] = [];
      order.forEach((i) => {
        const wx = f.worlds[i * 4];
        const wy = f.worlds[i * 4 + 1];
        const rr = Math.min(f.worlds[i * 4 + 3], 90);
        const flip = wx + rr + 200 > vw;
        const lx = flip ? wx - rr * 0.8 - 8 : wx + rr * 0.8 + 8;
        let ly = wy - 14;
        // only clashes with a label that shares the same part of the width
        const clash = lastX.length && Math.abs(lastX[lastX.length - 1] - lx) < 190;
        if (clash && ly < lastBottom) ly = lastBottom;
        lastBottom = ly + 26;
        lastX.push(lx);
        pinPlace[i * 2] = lx;
        pinPlace[i * 2 + 1] = ly;
        const a = pins[i];
        const showPinned = f.worlds[i * 4 + 2] > 0.5 && lx > margin && lx < vw - margin && ly > 70 && ly < vh - 14;
        const rx = railX;
        const ry = railTop + i * 26;
        const x = phone ? lx : lx * k + rx * (1 - k);
        const y = phone ? ly : ly * k + ry * (1 - k);
        const railing = k < 0.5;
        a.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        const opac = phone ? (showPinned ? smooth(0.5, 0.9, o) : 0) : railing ? 1 : showPinned ? 1 : 0.0;
        a.style.opacity = opac.toFixed(2);
        a.style.pointerEvents = opac > 0.1 ? "auto" : "none";
        a.tabIndex = 0;
        a.classList.toggle("is-rail", railing && !phone);
        a.classList.toggle("is-flip", !phone && (railing || flip));
        a.style.setProperty("--flip", !phone && (railing || flip) ? "1" : phone && flip ? "1" : "0");
        void labelShift;
      });
      // the star's name sits just under it on the first screen
      const sOn = f.star[2] > 0.5 && o > 0.35;
      starPin.style.opacity = sOn ? smooth(0.35, 0.8, o).toFixed(2) : "0";
      starPin.style.pointerEvents = sOn ? "auto" : "none";
      starPin.style.transform = `translate3d(${(f.star[0] - 54).toFixed(1)}px, ${(f.star[1] + Math.min(f.star[3], 90) * 0.9 + 6).toFixed(1)}px, 0)`;

      // ---- the belt's bodies
      const inBelt = f.g > N - 1.15;
      bodyLinks.forEach((a, i) => {
        const x = f.bodies[i * 4];
        const y = f.bodies[i * 4 + 1];
        const front = f.bodies[i * 4 + 2] > 0.5;
        const rad = f.bodies[i * 4 + 3];
        const on = inBelt && front && rad > (phone ? 26 : 22) && x > 10 && x < vw - 10 && y > 84 && y < vh - 40;
        a.style.opacity = on ? smooth(22, 56, rad).toFixed(2) : "0";
        a.style.pointerEvents = on ? "auto" : "none";
        if (on) a.style.transform = `translate3d(${Math.min(x + rad * 0.8, vw - (phone ? 130 : 220)).toFixed(1)}px, ${(y - 12).toFixed(1)}px, 0)`;
      });

      // ---- leader lines from the numbers to the parts they stand for
      const st = active;
      const wIdx = st >= 1 && st <= worlds.length ? st - 1 : -1;
      const wantLines = wIdx >= 0 && beats[st] === "b" && f.partsOf === wIdx && !phone;
      lineOpacity += ((wantLines ? 1 : 0) - lineOpacity) * 0.14;
      if (lineOpacity < 0.01 && !wantLines) {
        if (linksDirty) {
          paths.forEach((p) => p.setAttribute("opacity", "0"));
          rings.forEach((p) => p.setAttribute("opacity", "0"));
          linksDirty = false;
        }
      } else if (wIdx >= 0 && f.partsOf === wIdx) {
        const shown = worlds[wIdx].shown;
        if (rectsDirty || !calloutRects[wIdx]) {
          readCallouts(wIdx);
          rectsDirty = false;
        }
        const rects = calloutRects[wIdx];
        for (let i = 0; i < maxLines; i++) {
          if (i >= shown || !rects[i] || f.parts[i * 4 + 2] < 0.5) {
            paths[i].setAttribute("opacity", "0");
            rings[i].setAttribute("opacity", "0");
            continue;
          }
          const r = rects[i];
          const px = f.parts[i * 4];
          const py = f.parts[i * 4 + 1];
          const cRight = r.x + r.w / 2 > vw / 2;
          const yMid = r.y + Math.min(r.h / 2, 20);
          const sx = cRight ? r.x - 12 : r.x + r.w + 12;
          const horizontalRow = Math.abs(r.y - (rects[(i + 1) % rects.length]?.y ?? r.y)) < 2 && rects.length > 1 && Math.abs(r.y - rects[0].y) < 2 && Math.abs(r.y - rects[rects.length - 1].y) < 2;
          let d = "";
          if (horizontalRow) {
            // a row of numbers: lines leave from the top or bottom edge, straight to the part
            const above = py < r.y;
            const lx = r.x + 6;
            const ly = above ? r.y - 8 : r.y + r.h + 8;
            d = `M${lx.toFixed(1)} ${ly.toFixed(1)} L${lx.toFixed(1)} ${(ly + (above ? -16 : 16)).toFixed(1)} L${px.toFixed(1)} ${py.toFixed(1)}`;
          } else {
            const ex = sx + (cRight ? -24 : 24);
            d = `M${sx.toFixed(1)} ${yMid.toFixed(1)} L${ex.toFixed(1)} ${yMid.toFixed(1)} L${px.toFixed(1)} ${py.toFixed(1)}`;
          }
          paths[i].setAttribute("d", d);
          const hot = hovered?.kind === "part" && hovered.world === wIdx && hovered.part === i;
          paths[i].setAttribute("opacity", ((hot ? 0.95 : 0.42) * lineOpacity).toFixed(3));
          rings[i].setAttribute("cx", px.toFixed(1));
          rings[i].setAttribute("cy", py.toFixed(1));
          rings[i].setAttribute("opacity", ((hot ? 1 : 0.7) * lineOpacity).toFixed(3));
        }
      }

      // ---- the tip: parts with no number on screen, the star, the whole world up close
      let showTip = false;
      const h = hovered;
      if (h) {
        let v = "";
        let l = "";
        let tx2 = mx;
        let ty2 = my;
        if (h.kind === "part") {
          const shownNow = beats[h.world + 1] === "b" && h.part < worlds[h.world].shown && !phone;
          const pt = worlds[h.world].parts[h.part];
          if (!shownNow) {
            v = pt.value;
            l = pt.label;
            tx2 = f.parts[h.part * 4];
            ty2 = f.parts[h.part * 4 + 1];
            showTip = true;
          }
        } else if (h.kind === "star") {
          v = star.value;
          l = star.label;
          showTip = true;
        } else if (h.kind === "world" && f.overview > 0.05) {
          v = worlds[h.world].title;
          l = worlds[h.world].parts[0].value + " · " + worlds[h.world].parts[0].label;
          tx2 = f.worlds[h.world * 4];
          ty2 = f.worlds[h.world * 4 + 1];
          showTip = true;
        }
        if (showTip) {
          if (tipV.textContent !== v) tipV.textContent = v;
          if (tipL.textContent !== l) tipL.textContent = l;
          const b = tip.offsetWidth || 220;
          const hh = tip.offsetHeight || 60;
          const pxx = clamp(tx2 + 18, 12, vw - b - 12);
          const pyy = clamp(ty2 - hh - 14, 76, vh - hh - 12);
          tip.style.transform = `translate3d(${pxx.toFixed(1)}px, ${pyy.toFixed(1)}px, 0)`;
        }
      }
      tip.classList.toggle("is-on", showTip);
    };

    // ---- resize: a change of width only. Phones fire resize as the toolbar
    // comes and goes, and rebuilding the canvas then is what reloads the page.
    let sizedW = innerWidth;
    let sizedH = innerHeight;
    addEventListener(
      "resize",
      () => {
        const w = innerWidth;
        const h = innerHeight;
        if (coarse && w === sizedW) return;
        if (w === sizedW && h === sizedH) return;
        sizedW = w;
        sizedH = h;
        vw = w;
        measure();
        unit = rawUnit();
        rectsDirty = true;
        sys?.resize();
        onScroll();
      },
      { passive: true, signal },
    );

    // ---- the scene: after first paint, paused off screen
    let destroyed = false;
    const boot = () => {
      if (destroyed) return;
      import("./engine")
        .then(async ({ mountSystem }) => {
          if (destroyed) return;
          const inter = "Inter, 'Inter Fallback', Arial, sans-serif";
          const s = await mountSystem(canvas, {
            tier,
            reduced,
            phone,
            bodies: bodiesData.map((b) => b.id),
            title: ["Things I've built."],
            fontFamily: inter,
            onFrame,
          });
          if (destroyed) {
            s.destroy();
            return;
          }
          sys = s;
          s.setScroll(Math.min(N - 0.001, g), 0);
          root.classList.add("is-3d");
          if (!phone) root.classList.add("has-type");
          const io = new IntersectionObserver(([e]) => s.setPaused(!e.isIntersecting || document.hidden));
          io.observe(stage);
          signal.addEventListener("abort", () => io.disconnect());
          document.addEventListener("visibilitychange", () => s.setPaused(document.hidden), { signal });
          // test hook: the camera's stage position
          (window as Window & { __pwReady?: boolean }).__pwReady = true;
        })
        .catch((err) => {
          // the painted sky and the HTML still show every project
          console.warn(err);
        });
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(boot, { timeout: 900 });
    else setTimeout(boot, 200);

    return () => {
      destroyed = true;
      clearTimeout(settleLater);
      stopGlide();
      stopFling();
      sys?.destroy();
      sys = null;
      document.documentElement.classList.remove("in-pw");
      (window as Window & { __pwReady?: boolean }).__pwReady = false;
    };
  });
}
