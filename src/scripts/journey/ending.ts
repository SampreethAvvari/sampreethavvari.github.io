// The closing film, in three scenes: "exit" (the first steps down the ramp at
// night), "helmet" (the helmet comes off at sunset) and "touch" (a hand meets
// a small plant and it answers with light). Each scene is a short image
// sequence drawn on one canvas. The page picks a scene with setScene() and
// moves through it with setProgress(0..1), either in real time over
// duration(scene) seconds or by scroll.
//
// Frames are fetched coarse to fine (the first frame, then every 8th, every
// 4th, every 2nd, then the rest), the current scene first, then the first
// frame of every scene, then the rest in story order. They are kept as
// compressed blobs and only the few frames around the playhead are decoded.
// A slow scrub blends neighbouring frames; real time playback shows whole
// frames. Grain, a vignette and a soft scrim for the closing words are drawn
// on top.
//
// Fires `journey:ending` on window with { scene, progress, beat, frame, key,
// words } as the shown frame moves, so the score can follow the steps, the
// breath and the touch. `key` turns true at the scene's key moment, `words`
// on the frames left free for the closing words.

export type SceneId = "exit" | "helmet" | "touch";

export interface EndingOptions {
  /** Usually /story/manifest.json. Frame folders resolve against it. */
  manifestUrl: string;
  /** Small or touch screen: lighter frames, lower pixel ratio. */
  phone: boolean;
}

export interface Ending {
  /** Switch scene. Progress restarts at 0 unless setProgress follows. */
  setScene(id: SceneId): void;
  /** 0..1 through the current scene. */
  setProgress(p: number): void;
  /** Real length of a scene in seconds (the current one when omitted). 0 until the manifest is in. */
  duration(scene?: SceneId): number;
  /** True once the first frame of that scene (the current one when omitted) has loaded and decodes. */
  ready(scene?: SceneId): boolean;
  /** Stop drawing while the film is off screen. */
  setPaused(b: boolean): void;
  destroy(): void;
}

interface FrameSet {
  dir: string;
  width: number;
  height: number;
  /** [frame, x 0..1] keys: where to hold the crop when the screen is narrower than the frame. */
  focus?: [number, number][];
}

interface SceneInfo {
  id: SceneId;
  frames: number;
  fps: number;
  duration?: number;
  /** The frame of the key moment (first step, helmet off, the touch). */
  key: number;
  desktop: FrameSet;
  phone: FrameSet;
  beats?: { id: string; start: number }[];
  /** Frames that leave room for words, and on which side. */
  words?: { from: number; to: number; desktop: "left" | "top"; phone: "left" | "top" };
}

interface Manifest {
  digits?: number;
  formats?: string[];
  scenes?: SceneInfo[];
}

interface SceneState {
  info: SceneInfo;
  blobs: (Blob | null)[];
  /** 0 none, 1 loading, 2 ready, 3 failed */
  state: Uint8Array;
  queue: number[];
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Coarse to fine order: 0, every 8th, every 4th, every 2nd, the rest. */
function fetchOrder(n: number, lite: boolean): number[] {
  const out: number[] = [0];
  const seen = new Uint8Array(n);
  seen[0] = 1;
  for (const step of lite ? [8, 4, 2] : [8, 4, 2, 1]) {
    for (let i = 0; i < n; i += step) if (!seen[i]) { seen[i] = 1; out.push(i); }
  }
  if (!seen[n - 1]) out.push(n - 1);
  return out;
}

function makeGrain(size: number, count: number): HTMLCanvasElement[] {
  const tiles: HTMLCanvasElement[] = [];
  for (let k = 0; k < count; k++) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    if (!g) break;
    const img = g.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // two samples averaged: softer, closer to film than flat white noise
      const v = ((Math.random() + Math.random()) * 0.5 * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
}

export function mountEnding(canvas: HTMLCanvasElement, opts: EndingOptions): Ending {
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lite = !!(navigator as any).connection?.saveData;
  const base = new URL(opts.manifestUrl, location.href);

  let man: Manifest | null = null;
  let digits = 3;
  const scenes = new Map<SceneId, SceneState>();
  let order: SceneId[] = [];
  let setName: "desktop" | "phone" | "" = "";
  let ext = "";
  let probing = false;

  let current: SceneId | null = null;
  let wantedScene: SceneId | null = null; // asked for before the manifest arrived
  let inflight = 0;
  let aborter = new AbortController();
  let generation = 0;
  const decoded = new Map<string, ImageBitmap>();
  const decoding = new Set<string>();

  let progress = 0;
  let target = 0; // frame position asked for
  let shown = 0; // eased frame position on screen
  let speed = 0; // frames per second the playhead is moving, smoothed
  let paused = false;
  let destroyed = false;
  let raf = 0;
  let lastT = 0;
  let dirty = true;
  let grainTick = -1;
  let lastSent = -1;
  let lastBeat = -1;
  let drawnKey = "";

  let cw = 0;
  let ch = 0;
  let cssW = 0;
  let cssH = 0;
  let vignette: CanvasGradient | null = null;

  const grain = makeGrain(opts.phone ? 128 : 160, 4);
  const patterns = ctx ? grain.map((t) => ctx.createPattern(t, "repeat")) : [];
  const maxDecoded = opts.phone ? 10 : 12;
  const conc = () => (paused ? 2 : opts.phone ? 4 : 6);
  const keyOf = (s: SceneId, i: number) => `${s}:${i}`;

  const scene = () => (current ? scenes.get(current) || null : null);
  const frameUrl = (s: SceneState, i: number) =>
    new URL(`${s.info[setName as "desktop" | "phone"].dir}/${String(i).padStart(digits, "0")}.${ext}`, base).href;

  // ---- loading
  /** Next frame to fetch: every scene's first frame (the current one leads), then the current scene, then the rest in story order. */
  function nextJob(): [SceneState, number] | null {
    const cur = scene();
    for (const s of cur ? [cur, ...scenes.values()] : scenes.values()) {
      if (!s.state[0]) return [s, 0];
    }
    if (cur) {
      while (cur.queue.length) {
        const i = cur.queue.shift()!;
        if (!cur.state[i]) return [cur, i];
      }
    }
    for (const id of order) {
      const s = scenes.get(id)!;
      while (s.queue.length) {
        const i = s.queue.shift()!;
        if (!s.state[i]) return [s, i];
      }
    }
    return null;
  }

  function pump() {
    if (!man || !setName || !ext || destroyed) return;
    while (inflight < conc()) {
      const job = nextJob();
      if (!job) break;
      load(job[0], job[1]);
    }
  }

  function load(s: SceneState, i: number) {
    const gen = generation;
    s.state[i] = 1;
    inflight++;
    fetch(frameUrl(s, i), { signal: aborter.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (gen !== generation) return;
        s.blobs[i] = b;
        s.state[i] = 2;
        if (s === scene()) { dirty = true; wake(); }
      })
      .catch(() => {
        if (gen !== generation) return;
        s.state[i] = 3;
      })
      .finally(() => {
        if (gen !== generation) return;
        inflight--;
        pump();
      });
  }

  /** Move frames near the playhead to the front of the current scene's queue. */
  function want(center: number, dir: number) {
    const s = scene();
    if (!s) return;
    const n = s.info.frames;
    const near: number[] = [];
    const step = dir >= 0 ? 1 : -1;
    for (let k = 0; k <= 8; k++) {
      const a = Math.round(center + k * step);
      if (a >= 0 && a < n && !s.state[a]) near.push(a);
      const b = Math.round(center - k * step);
      if (k && k <= 2 && b >= 0 && b < n && !s.state[b]) near.push(b);
    }
    if (!near.length) return;
    s.queue = near.concat(s.queue.filter((i) => !near.includes(i)));
    pump();
  }

  function decode(s: SceneState, i: number) {
    if (i < 0 || i >= s.info.frames || s.state[i] !== 2) return;
    const key = keyOf(s.info.id, i);
    if (decoded.has(key) || decoding.has(key)) return;
    const b = s.blobs[i];
    if (!b) return;
    const gen = generation;
    decoding.add(key);
    createImageBitmap(b).then(
      (bmp) => {
        decoding.delete(key);
        if (destroyed || gen !== generation) { bmp.close?.(); return; }
        decoded.set(key, bmp);
        evict();
        dirty = true;
        wake();
      },
      () => {
        // a frame that will not decode: drop it, the nearest neighbour stands in
        decoding.delete(key);
        s.state[i] = 3;
        s.blobs[i] = null;
      },
    );
  }

  function evict() {
    if (decoded.size <= maxDecoded) return;
    const cost = (k: string) => {
      const [sid, f] = k.split(":");
      // other scenes go first, then frames far from the playhead; first frames are cheap to keep
      return (sid === current ? 0 : 1000) + Math.abs(Number(f) - shown) - (f === "0" ? 500 : 0);
    };
    const keys = Array.from(decoded.keys()).sort((a, b) => cost(b) - cost(a));
    for (const k of keys) {
      if (decoded.size <= maxDecoded) break;
      if (k === drawnKey) continue;
      decoded.get(k)?.close?.();
      decoded.delete(k);
    }
  }

  function clearFrames() {
    generation++;
    aborter.abort();
    aborter = new AbortController();
    for (const b of decoded.values()) b.close?.();
    decoded.clear();
    decoding.clear();
    inflight = 0;
    drawnKey = "";
  }

  function resetScenes() {
    for (const s of scenes.values()) {
      s.blobs = new Array(s.info.frames).fill(null);
      s.state = new Uint8Array(s.info.frames);
      s.queue = fetchOrder(s.info.frames, lite);
    }
  }

  function useSet(name: "desktop" | "phone") {
    if (!man || name === setName) return;
    clearFrames();
    setName = name;
    resetScenes();
    if (!ext) probeFormat();
    else pump();
  }

  /** Try each format on the first frame of the first scene to load; keep the first one that decodes. */
  function probeFormat() {
    if (probing || !man || !setName) return;
    const s = scene() || (order[0] ? scenes.get(order[0]) : null);
    if (!s) return;
    probing = true;
    const formats = man.formats && man.formats.length ? man.formats : ["webp"];
    const gen = generation;
    const tryAt = (k: number) => {
      if (destroyed) return;
      if (gen !== generation) { probing = false; probeFormat(); return; }
      if (k >= formats.length) { probing = false; return; }
      ext = formats[k];
      fetch(frameUrl(s, 0), { signal: aborter.signal })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((b) => createImageBitmap(b).then((bmp) => ({ b, bmp })))
        .then(({ b, bmp }) => {
          probing = false;
          if (destroyed || gen !== generation) { bmp.close?.(); if (!destroyed) probeFormat(); return; }
          s.blobs[0] = b;
          s.state[0] = 2;
          decoded.set(keyOf(s.info.id, 0), bmp);
          dirty = true;
          wake();
          pump();
        })
        .catch(() => { ext = ""; tryAt(k + 1); });
    };
    tryAt(0);
  }

  // ---- sizing
  function pickSet() {
    if (!man || !scenes.size) return;
    const w = cssW || innerWidth;
    const h = cssH || innerHeight;
    // the phone frames are a portrait reframe; a landscape screen wants the full width frames
    useSet(opts.phone && h > w ? "phone" : "desktop");
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    cssW = r.width;
    cssH = r.height;
    if (cssW >= 2 && cssH >= 2) {
      const dpr = Math.min(window.devicePixelRatio || 1, opts.phone ? 1.5 : 2);
      let w = Math.round(cssW * dpr);
      let h = Math.round(cssH * dpr);
      const cap = opts.phone ? 1400 : 2560;
      if (Math.max(w, h) > cap) {
        const k = cap / Math.max(w, h);
        w = Math.round(w * k);
        h = Math.round(h * k);
      }
      if (w !== cw || h !== ch) {
        cw = canvas.width = w;
        ch = canvas.height = h;
        vignette = null;
        dirty = true;
        drawnKey = "";
      }
    }
    pickSet();
    wake();
  }

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  addEventListener("resize", resize);

  // ---- drawing
  function focusAt(set: FrameSet, f: number): number {
    const keys = set.focus;
    if (!keys || !keys.length) return 0.5;
    if (f <= keys[0][0]) return keys[0][1];
    for (let k = 1; k < keys.length; k++) {
      if (f <= keys[k][0]) {
        const [f0, x0] = keys[k - 1];
        const [f1, x1] = keys[k];
        const t = (f - f0) / Math.max(1e-6, f1 - f0);
        return x0 + (x1 - x0) * t * t * (3 - 2 * t);
      }
    }
    return keys[keys.length - 1][1];
  }

  function nearestDecoded(sid: SceneId, f: number): number {
    let best = -1;
    let d = Infinity;
    for (const k of decoded.keys()) {
      const [s, n] = k.split(":");
      if (s !== sid) continue;
      const dd = Math.abs(Number(n) - f);
      if (dd < d) { d = dd; best = Number(n); }
    }
    return best;
  }

  function cover(bmp: ImageBitmap, alpha: number, fx: number) {
    if (!ctx) return;
    const s = Math.max(cw / bmp.width, ch / bmp.height);
    const dw = bmp.width * s;
    const dh = bmp.height * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(bmp, (cw - dw) * fx, (ch - dh) * 0.5, dw, dh);
    ctx.globalAlpha = 1;
  }

  function beatAt(s: SceneState, f: number): number {
    let b = 0;
    (s.info.beats || []).forEach((x, k) => { if (f >= x.start) b = k; });
    return b;
  }

  function wordsAmount(s: SceneState, f: number): number {
    const w = s.info.words;
    if (!w || f < w.from - 12 || f > w.to + 1) return 0;
    return clamp((f - (w.from - 12)) / 24, 0, 1);
  }

  function draw(t: number) {
    const s = scene();
    if (!ctx || !s || !setName || !cw || !ch) return;
    const sid = s.info.id;
    const n = s.info.frames;
    const i0 = clamp(Math.floor(shown), 0, n - 1);
    const i1 = Math.min(n - 1, i0 + 1);
    const a = shown - i0;
    const dir = target >= shown || speed >= 0 ? 1 : -1;

    // decode what the next frames need, nothing more
    decode(s, i0);
    decode(s, i1);
    for (let k = 2; k <= 4; k++) decode(s, i0 + k * dir);
    if (s.state[i0] !== 2) {
      // not here yet: stand in with the closest frame that has arrived, earlier first
      for (let k = 1; k < n; k++) {
        if (i0 - k >= 0 && s.state[i0 - k] === 2) { decode(s, i0 - k); break; }
        if (i0 + k < n && s.state[i0 + k] === 2) { decode(s, i0 + k); break; }
      }
    }

    const baseIdx = decoded.has(keyOf(sid, i0)) ? i0 : nearestDecoded(sid, shown);
    if (baseIdx < 0) return; // nothing of this scene yet: keep what is on the canvas
    const set = s.info[setName];
    const fx = focusAt(set, shown);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, cw, ch);
    cover(decoded.get(keyOf(sid, baseIdx))!, 1, fx);
    // blend neighbours only on a slow scrub; real time playback shows whole frames
    const blend = !reduced && Math.abs(speed) < s.info.fps * 0.5;
    if (blend && baseIdx === i0 && a > 0.02 && decoded.has(keyOf(sid, i1))) cover(decoded.get(keyOf(sid, i1))!, a, fx);
    drawnKey = keyOf(sid, baseIdx);

    // room for the closing words: a soft scrim on the side the copy uses
    const wa = wordsAmount(s, shown);
    if (wa > 0 && s.info.words) {
      const side = setName === "phone" ? s.info.words.phone : s.info.words.desktop;
      const g = side === "top" ? ctx.createLinearGradient(0, 0, 0, ch) : ctx.createLinearGradient(0, 0, cw, 0);
      g.addColorStop(0, `rgba(3,3,5,${(0.6 * wa).toFixed(3)})`);
      g.addColorStop(0.3, `rgba(3,3,5,${(0.32 * wa).toFixed(3)})`);
      g.addColorStop(0.58, "rgba(3,3,5,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
    }

    if (!vignette) {
      const r = Math.hypot(cw, ch) * 0.5;
      vignette = ctx.createRadialGradient(cw * 0.5, ch * 0.5, r * 0.45, cw * 0.5, ch * 0.5, r);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, cw, ch);

    // grain: a new tile and offset 24 times a second
    if (patterns.length) {
      const tick = reduced ? 0 : Math.floor(t / (1000 / 24));
      const pat = patterns[tick % patterns.length];
      if (pat) {
        const ox = (tick * 61) % 160;
        const oy = (tick * 37) % 160;
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = opts.phone ? 0.1 : 0.12;
        ctx.translate(-ox, -oy);
        ctx.fillStyle = pat;
        ctx.fillRect(ox, oy, cw, ch);
        ctx.restore();
      }
    }
  }

  function send(force = false) {
    const s = scene();
    if (!s) return;
    const n = s.info.frames;
    const beat = beatAt(s, shown);
    const p = n > 1 ? shown / (n - 1) : 0;
    if (!force && Math.abs(p - lastSent) < 0.001 && beat === lastBeat) return;
    lastSent = p;
    lastBeat = beat;
    const frame = Math.round(shown);
    const words = !!s.info.words && frame >= s.info.words.from;
    window.dispatchEvent(new CustomEvent("journey:ending", { detail: { scene: s.info.id, progress: p, beat, frame, key: frame >= s.info.key, words } }));
  }

  function loop(t: number) {
    raf = 0;
    if (destroyed || paused || document.hidden) return;
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    const before = shown;
    const gap = target - shown;
    if (reduced || Math.abs(gap) > 24) shown = target; // a jump, not a scrub
    else {
      shown += gap * (1 - Math.exp(-dt / 0.06));
      if (Math.abs(target - shown) < 0.01) shown = target;
    }
    speed = speed * 0.7 + ((shown - before) / dt) * 0.3;
    const moved = shown !== before;
    if (moved) want(shown, target - shown);
    const tick = reduced ? 0 : Math.floor(t / (1000 / 24));
    if (moved || dirty || tick !== grainTick) {
      grainTick = tick;
      dirty = false;
      draw(t);
    }
    if (moved) send();
    // keep going while the grain is alive; with reduced motion, only while something changes
    if (!reduced || moved || dirty || shown !== target) raf = requestAnimationFrame(loop);
  }

  function wake() {
    if (!raf && !paused && !destroyed && !document.hidden) {
      lastT = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  const onVis = () => { if (!document.hidden) wake(); };
  document.addEventListener("visibilitychange", onVis);

  function enter(id: SceneId) {
    const s = scenes.get(id);
    if (!s) return;
    current = id;
    progress = 0;
    target = shown = 0;
    speed = 0;
    lastSent = -1;
    lastBeat = -1;
    // the new scene's frames go to the front
    s.queue = fetchOrder(s.info.frames, lite).filter((i) => !s.state[i]);
    if (!ext) probeFormat();
    pump();
    dirty = true;
    wake();
    send(true);
  }

  // ---- manifest
  fetch(base.href, { signal: aborter.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((m: Manifest) => {
      if (destroyed) return;
      man = m;
      digits = m.digits || 3;
      for (const info of m.scenes || []) {
        if (!info || !info.id || !(info.frames > 0) || !info.desktop || !info.phone) continue;
        const n = info.frames | 0;
        scenes.set(info.id, { info: { ...info, frames: n }, blobs: new Array(n).fill(null), state: new Uint8Array(n), queue: fetchOrder(n, lite) });
        order.push(info.id);
      }
      if (!scenes.size) return; // no film yet: ready() stays false and the page keeps its fallback
      if (wantedScene && scenes.has(wantedScene)) current = wantedScene;
      resize();
      if (current) {
        const keep = progress;
        enter(current);
        if (keep) api.setProgress(keep);
      }
    })
    .catch(() => { /* no film: ready() stays false */ });

  const api: Ending = {
    setScene(id: SceneId) {
      if (destroyed) return;
      if (!man) { wantedScene = id; progress = 0; return; }
      if (id === current || !scenes.has(id)) return;
      enter(id);
    },
    setProgress(p: number) {
      progress = clamp(Number.isFinite(p) ? p : 0, 0, 1);
      const s = scene();
      if (!s) return;
      const next = progress * (s.info.frames - 1);
      if (next === target) return;
      target = next;
      want(target, target - shown);
      if (paused) {
        // nothing is drawn while paused; be there when it wakes
        shown = target;
        dirty = true;
        send();
      } else wake();
    },
    duration(id?: SceneId) {
      const s = id ? scenes.get(id) : scene();
      if (!s) return 0;
      return s.info.duration || s.info.frames / (s.info.fps || 24);
    },
    ready(id?: SceneId) {
      const s = id ? scenes.get(id) : scene();
      return !!(s && ext && setName && s.state[0] === 2);
    },
    setPaused(b: boolean) {
      if (b === paused) return;
      paused = b;
      if (b) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
        dirty = true;
        wake();
        pump();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearFrames();
      scenes.clear();
      order = [];
      ro?.disconnect();
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      ctx?.clearRect(0, 0, cw, ch);
      grain.length = 0;
    },
  };
  return api;
}
