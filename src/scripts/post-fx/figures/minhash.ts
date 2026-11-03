// MinHash and LSH, running live. Two made up users are sets of movies, drawn as
// two constellations that share stars. Drag how many they share and the real
// algorithm runs on every move: each user becomes 30 numbers, the numbers split
// into 6 bands of 5, and a pair only ever gets compared if a whole band agrees.
// That is how the post's search skipped most of about 55 billion pairs.
//
// 30 numbers, 6 bands, 54,772,059,825 pairs, 22,215,721 candidates and the top
// 100 are the post's. The two users are examples, and say so.
//
// Sound hooks:
//   post:figure { id: "minhash", action: "band:<count>" | "new-users" }
//   post:hover { kind: "band", id: "band-<i>", note }

import type { Figure } from "./index";
import { clamp, emit, h, isPhone, whileVisible } from "../util";
import { fig, frame, readCard } from "./parts";

const PERMS = 30;
const BANDS = 6;
const ROWS = PERMS / BANDS;
const N = 40; // movies each example user has rated

// One real hash family: multiply, shift, mix.
function mix(x: number, seed: number) {
  let h = Math.imul(x ^ seed, 0x5bd1e995);
  h ^= h >>> 15;
  h = Math.imul(h, 0x97455bcd + seed);
  h ^= h >>> 13;
  return h >>> 0;
}
function minhash(set: number[], seeds: number[]) {
  return seeds.map((s) => {
    let best = 0xffffffff;
    for (const m of set) {
      const v = mix(m, s);
      if (v < best) best = v;
    }
    return best;
  });
}

type Star = { x: number; y: number; tx: number; ty: number; a: number; b: number; ta: number; tb: number; r: number; tw: number };

const render: Figure = ({ root, signal, still }) => {
  frame(root, "Taste as 30 numbers", "Drag how many movies the two share. Watch which numbers agree, and when a whole band locks.");

  const skyBox = h("div", "pfx-mh-sky");
  const canvas = h("canvas", "pfx-mh-canvas");
  const labelA = h("div", "pfx-mh-user is-a", "User A");
  const labelB = h("div", "pfx-mh-user is-b", "User B");
  skyBox.append(canvas, labelA, labelB);
  root.append(skyBox);

  const controls = h("div", "pfx-mh-controls");
  const sliderLabel = h("label", "pfx-mh-slabel");
  const sliderName = h("span", undefined, "Movies in common");
  const sliderValue = h("b", "pfx-mh-svalue");
  sliderLabel.append(sliderName, sliderValue);
  const slider = h("input", "pfx-mh-range");
  slider.type = "range";
  slider.min = "0";
  slider.max = String(N);
  slider.value = "24";
  slider.setAttribute("aria-label", "Movies in common");
  const again = h("button", "pfx-mh-again", "New example users");
  again.type = "button";
  controls.append(sliderLabel, slider, again);
  root.append(controls);

  const bars = h("div", "pfx-mh-bars");
  const rowA = h("div", "pfx-mh-row");
  rowA.append(h("span", "pfx-mh-rowname", "A"));
  const rowB = h("div", "pfx-mh-row");
  rowB.append(h("span", "pfx-mh-rowname", "B"));
  const grid = h("div", "pfx-mh-grid");
  type Cell = { a: HTMLElement; b: HTMLElement };
  const cells: Cell[] = [];
  const bands: HTMLElement[] = [];
  for (let b = 0; b < BANDS; b++) {
    const band = h("div", "pfx-mh-band");
    band.setAttribute("role", "group");
    band.setAttribute("aria-label", `Band ${b + 1}`);
    band.addEventListener(
      "pointerenter",
      () => emit("post:hover", { kind: "band", id: `band-${b}`, note: b }),
      { passive: true, signal },
    );
    const topRow = h("div", "pfx-mh-cells");
    const botRow = h("div", "pfx-mh-cells");
    for (let i = 0; i < ROWS; i++) {
      const a = h("i", "pfx-mh-cell");
      const c = h("i", "pfx-mh-cell");
      topRow.append(a);
      botRow.append(c);
      cells.push({ a, b: c });
    }
    const tag = h("span", "pfx-mh-bandtag", `Band ${b + 1}`);
    band.append(topRow, botRow, tag);
    grid.append(band);
    bands.push(band);
  }
  bars.append(grid);
  root.append(bars);

  const verdict = h("div", "pfx-mh-verdict");
  verdict.setAttribute("aria-live", "polite");
  const vText = h("div", "pfx-mh-vtext");
  const curve = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  curve.setAttribute("viewBox", "0 0 120 64");
  curve.setAttribute("class", "pfx-mh-curve");
  curve.setAttribute("aria-hidden", "true");
  const pathPts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const s = i / 40;
    const p = 1 - Math.pow(1 - Math.pow(s, ROWS), BANDS);
    pathPts.push(`${(4 + s * 112).toFixed(1)} ${(58 - p * 52).toFixed(1)}`);
  }
  curve.innerHTML = `<path class="pfx-mh-axis" d="M4 58H116M4 6V58"/><path class="pfx-mh-s" d="M${pathPts.join("L")}"/><circle class="pfx-mh-dot" r="3.4" cx="4" cy="58"/>`;
  const dot = curve.querySelector("circle")!;
  const curveBox = h("div", "pfx-mh-curvebox");
  curveBox.append(curve, h("span", "pfx-mh-curvecap", "Chance of being compared, by real overlap"));
  verdict.append(vText, curveBox);
  root.append(verdict);

  const funnel = h("div", "pfx-read pfx-mh-funnel");
  funnel.append(
    readCard("54,772,059,825", "Pairs to compare one by one"),
    readCard("22,215,721", "Candidate pairs LSH returned"),
    readCard("100", "Twins, with the most movies in common"),
  );
  root.append(funnel);

  // ---- The algorithm --------------------------------------------------------
  let seed = 7;
  let seeds: number[] = [];
  let shared: number[] = [];
  let onlyA: number[] = [];
  let onlyB: number[] = [];
  const shuffleSets = () => {
    seed = (seed * 16807) % 2147483647;
    let r = seed;
    const rnd = () => (r = (r * 16807) % 2147483647);
    seeds = Array.from({ length: PERMS }, () => rnd() >>> 0);
    // A pool of movie ids, dealt out so moving the slider changes one movie.
    const pool = Array.from({ length: N * 3 }, (_, i) => 1000 + i * 37 + rnd() % 31);
    shared = pool.slice(0, N);
    onlyA = pool.slice(N, N * 2);
    onlyB = pool.slice(N * 2, N * 3);
  };
  shuffleSets();

  const colour = (v: number) => {
    // A shade from the number itself, so equal numbers look identical.
    const hue = 226 + (v % 46);
    const l = 40 + ((v >>> 8) % 38);
    return `hsl(${hue} 72% ${l}%)`;
  };

  let lastLocked = -1;
  const compute = (t: number) => {
    const A = [...shared.slice(0, t), ...onlyA.slice(0, N - t)];
    const B = [...shared.slice(0, t), ...onlyB.slice(0, N - t)];
    const ma = minhash(A, seeds);
    const mb = minhash(B, seeds);
    let agree = 0;
    ma.forEach((v, i) => {
      const same = v === mb[i];
      if (same) agree++;
      const c = cells[i];
      c.a.style.background = colour(v);
      c.b.style.background = colour(mb[i]);
      c.a.classList.toggle("is-same", same);
      c.b.classList.toggle("is-same", same);
    });
    let locked = 0;
    bands.forEach((band, bi) => {
      let all = true;
      for (let i = 0; i < ROWS; i++) if (ma[bi * ROWS + i] !== mb[bi * ROWS + i]) all = false;
      band.classList.toggle("is-lock", all);
      if (all) locked++;
    });
    const jac = t / (2 * N - t);
    sliderValue.textContent = `${t} of ${N}`;
    const p = 1 - Math.pow(1 - Math.pow(jac, ROWS), BANDS);
    dot.setAttribute("cx", (4 + jac * 112).toFixed(1));
    dot.setAttribute("cy", (58 - p * 52).toFixed(1));
    vText.textContent = "";
    const head = h("div", `pfx-mh-vhead ${locked ? "is-yes" : ""}`, locked ? "Same bucket. This pair gets compared." : "No shared bucket. This pair is never compared.");
    const sub = h("div", "pfx-mh-vsub", `${agree} of ${PERMS} numbers agree · ${locked} of ${BANDS} bands match · ${Math.round(jac * 100)}% real overlap`);
    vText.append(head, sub);
    if (locked !== lastLocked) {
      if (lastLocked !== -1) fig("minhash", `band:${locked}`);
      lastLocked = locked;
    }
  };

  // ---- The sky: two constellations that merge ---------------------------------
  const stars: Star[] = [];
  let W = 1;
  let H = 1;
  let dpr = 1;
  const cA = { x: 0, y: 0 };
  const cB = { x: 0, y: 0 };
  const hash = (i: number, k: number) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const layout = (t: number) => {
    // Every movie is a star: slot i of the three groups. A star's home depends
    // on whether this pair has it in common.
    stars.forEach((s, i) => {
      const group = i < N ? 0 : i < N * 2 ? 1 : 2;
      const k = group === 0 ? i : i - N * group;
      const inShared = group === 0 && k < t;
      const inA = group === 1 && k < N - t;
      const inB = group === 2 && k < N - t;
      const ang = hash(i, 1) * Math.PI * 2;
      const rr = Math.sqrt(hash(i, 2));
      if (inShared) {
        s.tx = W / 2 + Math.cos(ang) * rr * W * 0.13;
        s.ty = H / 2 + Math.sin(ang) * rr * H * 0.34;
        s.ta = 1;
        s.tb = 1;
      } else if (group === 0) {
        s.tx = W / 2 + Math.cos(ang) * rr * W * 0.13;
        s.ty = H / 2 + Math.sin(ang) * rr * H * 0.34;
        s.ta = 0;
        s.tb = 0;
      } else {
        const c = group === 1 ? cA : cB;
        s.tx = c.x + Math.cos(ang) * rr * W * 0.15;
        s.ty = c.y + Math.sin(ang) * rr * H * 0.36;
        s.ta = group === 1 && inA ? 1 : 0;
        s.tb = group === 2 && inB ? 1 : 0;
      }
    });
  };
  for (let i = 0; i < N * 3; i++) {
    stars.push({ x: 0, y: 0, tx: 0, ty: 0, a: 0, b: 0, ta: 0, tb: 0, r: 0.9 + hash(i, 3) * 1.1, tw: hash(i, 4) * 6.28 });
  }
  const size = () => {
    W = skyBox.clientWidth || 1;
    H = skyBox.clientHeight || 1;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cA.x = W * (isPhone() ? 0.2 : 0.2);
    cA.y = H / 2;
    cB.x = W * 0.8;
    cB.y = H / 2;
    layout(parseInt(slider.value));
    stars.forEach((s) => {
      s.x = s.tx;
      s.y = s.ty;
      s.a = s.ta;
      s.b = s.tb;
    });
    paint(performance.now());
  };
  const ctx = canvas.getContext("2d");
  const paint = (now: number) => {
    if (!ctx) return;
    const t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      if (!still) {
        s.x += (s.tx - s.x) * 0.1;
        s.y += (s.ty - s.y) * 0.1;
        s.a += (s.ta - s.a) * 0.1;
        s.b += (s.tb - s.b) * 0.1;
      } else {
        s.x = s.tx;
        s.y = s.ty;
        s.a = s.ta;
        s.b = s.tb;
      }
    }
    // Lines from each user to their movies.
    ctx.lineWidth = 0.6;
    for (const s of stars) {
      if (s.a > 0.02) {
        ctx.strokeStyle = `rgba(167,139,250,${(0.17 * s.a).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(cA.x, cA.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      if (s.b > 0.02) {
        ctx.strokeStyle = `rgba(125,180,255,${(0.17 * s.b).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(cB.x, cB.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
    }
    for (const s of stars) {
      const o = Math.max(s.a, s.b);
      if (o < 0.02) continue;
      const both = Math.min(s.a, s.b);
      const tw = still ? 1 : 0.78 + 0.22 * Math.sin(t * 1.3 + s.tw);
      ctx.globalAlpha = o * tw;
      ctx.fillStyle = both > 0.4 ? "#fff" : s.a > s.b ? "#c9b8ff" : "#a8ceff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + both * 0.7, 0, Math.PI * 2);
      ctx.fill();
      if (both > 0.4) {
        ctx.globalAlpha = o * 0.16 * tw;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // The two users themselves.
    for (const [c, col] of [
      [cA, "#a78bfa"],
      [cB, "#7db4ff"],
    ] as const) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const onSlide = () => {
    const t = clamp(parseInt(slider.value) || 0, 0, N);
    compute(t);
    layout(t);
    slider.style.setProperty("--p", `${(t / N) * 100}%`);
    if (still) paint(performance.now());
  };
  slider.addEventListener("input", onSlide, { signal });
  again.addEventListener(
    "click",
    () => {
      shuffleSets();
      lastLocked = -1;
      onSlide();
      fig("minhash", "new-users");
    },
    { signal },
  );

  const ro = new ResizeObserver(size);
  ro.observe(skyBox);
  size();
  onSlide();
  if (!still) whileVisible(skyBox, paint, signal);

  return () => ro.disconnect();
};

export default render;
