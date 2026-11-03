// The lever that costs nothing. Every run the post names sits on one chart, with
// the 5 million cap as a wall. Drag the star up its three stops and the accuracy
// climbs while the star goes straight up, because augmentation adds zero
// parameters. Beside it, a 32 by 32 cat goes through the same transforms the
// post's notebook lists, at its true size, a new image on every load.
//
// Every number is the post's. The cat is drawn here, not a CIFAR-10 image.
//
// Sound hooks:
//   post:figure { id: "zero-params", action: "stop:<0|1|2>" | "load" }
//   post:hover { kind: "run", id: "<run>", note }

import type { Figure } from "./index";
import { clamp, emit, h, noteOf, whileVisible } from "../util";
import { fig, frame } from "./parts";

type Stop = { label: string; acc: number; adds: string };
const STOPS: Stop[] = [
  { label: "Flip and crop", acc: 93.76, adds: "Flip and crop" },
  { label: "Add AutoAugment", acc: 95.34, adds: "+ AutoAugment" },
  { label: "Add a perspective warp", acc: 97.12, adds: "+ Perspective" },
];

type Run = { id: string; name: string; short: string; params: number; paramsText: string; acc: number; note: string };
const RUNS: Run[] = [
  { id: "r18", name: "Official ResNet18", short: "ResNet18", params: 11.05, paramsText: "over 11 million", acc: 88.56, note: "Over the cap" },
  { id: "r34", name: "ResNet34", short: "ResNet34", params: 11.7, paramsText: "11.7 million", acc: 90, note: "More than twice the cap" },
  { id: "r34b", name: "ResNet34's 3, 4, 6, 3 blocks", short: "3, 4, 6, 3 blocks", params: 5.3, paramsText: "5.3 million", acc: 91, note: "Over the cap" },
  { id: "r24", name: "ResNet24", short: "ResNet24", params: 4.969776, paramsText: "4,969,776", acc: 96.82, note: "The repo's other finalist" },
];

const CAP = 5;

const XMIN = 4;
const XMAX = 12.4;
const YMIN = 87;
const YMAX = 98;

// ---- A small cat, drawn at 32 by 32, soft like a low resolution photo ----------
function drawCat(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, "#6f8fa8");
  g.addColorStop(1, "#3d4b3a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "#5a4a3a";
  ctx.fillRect(0, 25, 32, 7);
  const fur = "#c88a4a";
  const dark = "#8a5a2c";
  // Body
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(16, 25, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head and ears
  ctx.beginPath();
  ctx.ellipse(16, 14.5, 7.5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9.5, 11);
  ctx.lineTo(9.5, 4.5);
  ctx.lineTo(14, 9);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22.5, 11);
  ctx.lineTo(22.5, 4.5);
  ctx.lineTo(18, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e6a6a0";
  ctx.beginPath();
  ctx.moveTo(10.6, 9.6);
  ctx.lineTo(10.6, 6.6);
  ctx.lineTo(12.8, 8.8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(21.4, 9.6);
  ctx.lineTo(21.4, 6.6);
  ctx.lineTo(19.2, 8.8);
  ctx.closePath();
  ctx.fill();
  // Stripes
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(16, 8.6);
  ctx.lineTo(16, 11.4);
  ctx.moveTo(13.6, 9);
  ctx.lineTo(14, 11);
  ctx.moveTo(18.4, 9);
  ctx.lineTo(18, 11);
  ctx.moveTo(11.5, 22);
  ctx.lineTo(13.5, 24);
  ctx.moveTo(20.5, 22);
  ctx.lineTo(18.5, 24);
  ctx.stroke();
  // Face
  ctx.fillStyle = "#f4e6c8";
  ctx.beginPath();
  ctx.ellipse(16, 17.4, 3.4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b2a1f";
  ctx.beginPath();
  ctx.ellipse(12.8, 13.6, 1.2, 1.3, 0, 0, Math.PI * 2);
  ctx.ellipse(19.2, 13.6, 1.2, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b86a6a";
  ctx.fillRect(15.3, 16.2, 1.4, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(13, 17);
  ctx.lineTo(8.6, 16.2);
  ctx.moveTo(13, 18);
  ctx.lineTo(8.6, 18.6);
  ctx.moveTo(19, 17);
  ctx.lineTo(23.4, 16.2);
  ctx.moveTo(19, 18);
  ctx.lineTo(23.4, 18.6);
  ctx.stroke();
}

type Px = Uint8ClampedArray;
const SZ = 32;

/** Inverse map sampling: for each output pixel, where in the source it came from. */
function warp(src: Px, map: (x: number, y: number) => [number, number]): Px {
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const [sx, sy] = map(x + 0.5, y + 0.5);
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const o = (y * SZ + x) * 4;
      if (ix < 0 || iy < 0 || ix >= SZ || iy >= SZ) {
        out[o + 3] = 255;
        continue;
      }
      const i = (iy * SZ + ix) * 4;
      out[o] = src[i];
      out[o + 1] = src[i + 1];
      out[o + 2] = src[i + 2];
      out[o + 3] = 255;
    }
  }
  return out;
}

/** The transforms from the post's notebook cell, in its order. */
function augment(base: Px, stop: number): { px: Px; fired: string[] } {
  let px: Px = base.slice() as Px;
  const fired: string[] = [];
  if (stop >= 1) {
    // AutoAugment's CIFAR-10 policy picks a sub policy per image. A sample of
    // the kinds of operation it can choose.
    const ops = ["Rotate", "Shear", "Translate", "Posterize", "Invert", "Solarize", "Contrast"];
    const a = ops[Math.floor(Math.random() * ops.length)];
    fired.push(a);
    if (a === "Rotate") {
      const r = ((Math.random() - 0.5) * 50 * Math.PI) / 180;
      const c = Math.cos(r);
      const s = Math.sin(r);
      px = warp(px, (x, y) => [16 + (x - 16) * c - (y - 16) * s, 16 + (x - 16) * s + (y - 16) * c]);
    } else if (a === "Shear") {
      const k = (Math.random() - 0.5) * 0.7;
      px = warp(px, (x, y) => [x + (y - 16) * k, y]);
    } else if (a === "Translate") {
      const dx = Math.round((Math.random() - 0.5) * 16);
      const dy = Math.round((Math.random() - 0.5) * 16);
      px = warp(px, (x, y) => [x + dx, y + dy]);
    } else {
      const out = px.slice() as Px;
      for (let i = 0; i < out.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const v = out[i + c];
          if (a === "Posterize") out[i + c] = v & 0xe0;
          else if (a === "Invert") out[i + c] = 255 - v;
          else if (a === "Solarize") out[i + c] = v > 128 ? 255 - v : v;
          else out[i + c] = clamp((v - 128) * 1.8 + 128, 0, 255);
        }
      }
      px = out;
    }
  }
  // RandomCrop(32, padding=4)
  const cx = Math.floor(Math.random() * 9) - 4;
  const cy = Math.floor(Math.random() * 9) - 4;
  if (cx || cy) fired.push("Crop");
  px = warp(px, (x, y) => [x + cx, y + cy]);
  // RandomHorizontalFlip(p=0.5)
  if (Math.random() < 0.5) {
    fired.push("Flip");
    px = warp(px, (x, y) => [32 - x, y]);
  }
  // RandomPerspective(distortion_scale=0.6, p=0.5)
  if (stop >= 2 && Math.random() < 0.5) {
    fired.push("Perspective");
    const d = 0.6 * 16;
    const j = () => Math.random() * d;
    const tl = [j(), j()];
    const tr = [32 - j(), j()];
    const bl = [j(), 32 - j()];
    const br = [32 - j(), 32 - j()];
    px = warp(px, (x, y) => {
      // A bilinear stand in for the homography: close enough at 32 pixels.
      const u = x / 32;
      const v = y / 32;
      const top = [tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u];
      const bot = [bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u];
      const px0 = top[0] + (bot[0] - top[0]) * v;
      const py0 = top[1] + (bot[1] - top[1]) * v;
      // Inverse of the small warp around the identity.
      return [x - (px0 - x), y - (py0 - y)];
    });
  }
  return { px, fired };
}

const render: Figure = ({ root, signal, still }) => {
  frame(root, "The lever that costs nothing", "Drag the star up. Every stop is from the report. The parameter count does not move.");
  const body = h("div", "pfx-zp-body");
  root.append(body);

  // ---- Left: the cat -------------------------------------------------------
  const left = h("div", "pfx-zp-left");
  const big = h("canvas", "pfx-zp-big");
  big.width = SZ;
  big.height = SZ;
  big.setAttribute("role", "img");
  big.setAttribute("aria-label", "A small cat at 32 by 32 pixels, transformed differently each time it loads");
  const bigWrap = h("div", "pfx-zp-bigwrap");
  bigWrap.append(big);
  const fired = h("div", "pfx-zp-fired");
  const strip = h("div", "pfx-zp-strip");
  const strips = Array.from({ length: 6 }, () => {
    const c = h("canvas", "pfx-zp-thumb");
    c.width = SZ;
    c.height = SZ;
    strip.append(c);
    return c;
  });
  const load = h("button", "pfx-zp-load", "Load it again");
  load.type = "button";
  left.append(bigWrap, fired, strip, load);
  body.append(left);

  // ---- Right: the runs -------------------------------------------------------
  const right = h("div", "pfx-zp-right");
  const svgNS = "http://www.w3.org/2000/svg";
  const chart = h("div", "pfx-zp-chart");
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "pfx-zp-svg");
  svg.setAttribute("aria-hidden", "true");
  chart.append(svg);
  const over = h("div", "pfx-zp-over");
  over.append(h("span", undefined, "Over the cap"));
  chart.append(over);
  const wall = h("div", "pfx-zp-wall");
  wall.append(h("span", undefined, "5M cap"));
  chart.append(wall);
  const yAxis = h("div", "pfx-zp-yaxis");
  chart.append(yAxis);
  [88, 90, 92, 94, 96, 98].forEach((v) => {
    const t = h("span", "pfx-zp-ytick", `${v}%`);
    t.style.bottom = `${((v - YMIN) / (YMAX - YMIN)) * 100}%`;
    yAxis.append(t);
  });
  right.append(chart);
  body.append(right);

  const xp = (v: number) => ((v - XMIN) / (XMAX - XMIN)) * 100;
  const yp = (v: number) => ((v - YMIN) / (YMAX - YMIN)) * 100;
  over.style.left = `${xp(CAP)}%`;
  wall.style.left = `${xp(CAP)}%`;

  const runTip = h("div", "pfx-zp-runtip");
  runTip.hidden = true;
  chart.append(runTip);
  RUNS.forEach((r) => {
    const b = h("button", `pfx-zp-run ${r.params > CAP ? "is-over" : ""}`);
    b.type = "button";
    b.style.left = `${xp(r.params)}%`;
    b.style.bottom = `${yp(r.acc)}%`;
    b.setAttribute("aria-label", `${r.name}, ${r.paramsText} parameters, ${r.acc}%`);
    const show = () => {
      runTip.innerHTML = "";
      runTip.append(h("b", undefined, `${r.acc}%`), h("span", undefined, r.name), h("span", "pfx-zp-runsub", `${r.paramsText} · ${r.note}`));
      runTip.hidden = false;
      const left = xp(r.params);
      runTip.style.left = `${left}%`;
      runTip.style.bottom = `${yp(r.acc)}%`;
      runTip.classList.toggle("is-flip", left > 55);
      emit("post:hover", { kind: "run", id: r.id, note: noteOf(r.id) });
    };
    b.addEventListener("pointerenter", show, { passive: true, signal });
    b.addEventListener("focus", show, { signal });
    b.addEventListener("click", show, { signal });
    b.addEventListener("pointerleave", () => (runTip.hidden = true), { passive: true, signal });
    b.addEventListener("blur", () => (runTip.hidden = true), { signal });
    chart.append(b);
    const lab = h("span", `pfx-zp-runlab ${r.params > 9 ? "is-left" : ""}`, r.short);
    lab.style.left = `${xp(r.params)}%`;
    lab.style.bottom = `${yp(r.acc)}%`;
    chart.append(lab);
  });
  [6, 8, 10, 12].forEach((v) => {
    const t = h("span", "pfx-zp-xtick", `${v}M`);
    t.style.left = `${xp(v)}%`;
    chart.append(t);
  });

  // The ladder and the star.
  const ladder = h("div", "pfx-zp-ladder");
  ladder.style.left = `${xp(4.978810)}%`;
  STOPS.forEach((s) => {
    const tick = h("i", "pfx-zp-stop");
    tick.style.bottom = `${yp(s.acc)}%`;
    ladder.append(tick);
  });
  const fill = h("div", "pfx-zp-fill");
  ladder.append(fill);
  chart.append(ladder);
  const star = h("button", "pfx-zp-star");
  star.type = "button";
  star.style.left = `${xp(4.97881)}%`;
  star.setAttribute("role", "slider");
  star.setAttribute("aria-label", "Augmentation");
  star.setAttribute("aria-valuemin", "0");
  star.setAttribute("aria-valuemax", "2");
  star.innerHTML =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 1.5c.7 6 3.5 9.5 10.5 10.5-7 1-9.8 4.5-10.5 10.5C11.3 16.5 8.5 13 1.5 12 8.5 11 11.300 7.5 12 1.500Z"/></svg>';
  chart.append(star);
  const axisX = h("div", "pfx-zp-xlab", "Trainable parameters");
  right.append(axisX);

  // ---- Readout ----------------------------------------------------------------
  const read = h("div", "pfx-zp-read");
  const rNow = h("div", "pfx-zp-now");
  const rAcc = h("div", "pfx-zp-acc");
  const rAdds = h("div", "pfx-zp-adds");
  rNow.append(rAcc, rAdds);
  const rParams = h("div", "pfx-zp-params");
  const pNum = h("b", undefined, "+0");
  rParams.append(pNum, h("span", undefined, "parameters added"));
  const rSpare = h("div", "pfx-zp-spare");
  rSpare.append(h("b", undefined, "21,190"), h("span", undefined, "under the cap, at 4,978,810"));
  read.append(rNow, rParams, rSpare);
  right.append(read);

  // ---- State ------------------------------------------------------------------
  let stop = 0;
  let starPos = STOPS[0].acc;
  let starTarget = starPos;
  const base = (() => {
    const c = document.createElement("canvas");
    c.width = SZ;
    c.height = SZ;
    const x = c.getContext("2d")!;
    drawCat(x);
    return x.getImageData(0, 0, SZ, SZ).data;
  })();
  const put = (c: HTMLCanvasElement, px: Px) => {
    const x = c.getContext("2d");
    if (!x) return;
    x.putImageData(new ImageData(new Uint8ClampedArray(px), SZ, SZ), 0, 0);
  };
  const history: Px[] = [];
  const reload = (user = false) => {
    const { px, fired: f } = augment(base, stop);
    put(big, px);
    fired.textContent = "";
    if (f.length) f.forEach((name) => fired.append(h("span", "pfx-zp-chip", name)));
    else fired.append(h("span", "pfx-zp-chip is-none", "Nothing fired this time"));
    history.unshift(px);
    history.length = Math.min(history.length, strips.length);
    strips.forEach((c, i) => {
      if (history[i]) put(c, history[i]);
    });
    if (user) fig("zero-params", "load");
  };
  const writeStar = () => {
    star.style.bottom = `${yp(starPos)}%`;
    fill.style.height = `${yp(starPos) - yp(STOPS[0].acc)}%`;
    fill.style.bottom = `${yp(STOPS[0].acc)}%`;
  };
  const setStop = (n: number, user: boolean) => {
    n = clamp(n, 0, 2);
    const changed = n !== stop;
    stop = n;
    starTarget = STOPS[n].acc;
    if (still) {
      starPos = starTarget;
      writeStar();
    }
    rAcc.textContent = `${STOPS[n].acc}%`;
    rAdds.textContent = STOPS[n].label;
    star.setAttribute("aria-valuenow", String(n));
    star.setAttribute("aria-valuetext", `${STOPS[n].label}, ${STOPS[n].acc} percent`);
    if (changed || !user) reload();
    if (changed && user) fig("zero-params", `stop:${n}`);
  };

  // Drag up and down: the star snaps to a stop when let go.
  let drag = false;
  const chartY = (y: number) => {
    const r = chart.getBoundingClientRect();
    return YMIN + clamp((r.bottom - y) / r.height) * (YMAX - YMIN);
  };
  const nearest = (acc: number) => {
    let n = 0;
    let best = 1e9;
    STOPS.forEach((s, i) => {
      const d = Math.abs(s.acc - acc);
      if (d < best) {
        best = d;
        n = i;
      }
    });
    return n;
  };
  star.addEventListener(
    "pointerdown",
    (e) => {
      drag = true;
      star.setPointerCapture(e.pointerId);
      chart.classList.add("is-drag");
      e.preventDefault();
    },
    { signal },
  );
  star.addEventListener(
    "pointermove",
    (e) => {
      if (!drag) return;
      const acc = clamp(chartY(e.clientY), STOPS[0].acc, STOPS[2].acc);
      starPos = acc;
      starTarget = acc;
      writeStar();
      const n = nearest(acc);
      if (n !== stop) setStop(n, true);
    },
    { signal },
  );
  const end = () => {
    if (!drag) return;
    drag = false;
    chart.classList.remove("is-drag");
    starTarget = STOPS[stop].acc;
    if (still) {
      starPos = starTarget;
      writeStar();
    }
  };
  star.addEventListener("pointerup", end, { signal });
  star.addEventListener("pointercancel", end, { signal });
  star.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") setStop(stop + 1, true);
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") setStop(stop - 1, true);
      else return;
      e.preventDefault();
    },
    { signal },
  );
  load.addEventListener("click", () => reload(true), { signal });

  setStop(0, false);
  writeStar();
  // Show the strip full from the start.
  for (let i = 0; i < strips.length - 1; i++) reload();

  let lastLoad = performance.now();
  if (!still) {
    whileVisible(
      root,
      (now) => {
        if (Math.abs(starTarget - starPos) > 0.005) {
          starPos += (starTarget - starPos) * 0.14;
          writeStar();
        }
        // Every load is a new image, and the strip keeps the last few.
        if (now - lastLoad > 1500) {
          lastLoad = now;
          reload();
        }
      },
      signal,
    );
  }
};

export default render;
