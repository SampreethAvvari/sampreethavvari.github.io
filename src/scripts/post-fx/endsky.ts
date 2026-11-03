// The sky at the end of a post. The dome tilts with the pointer and the stars
// lean toward it, a star under the pointer shows its post on the card and the
// line from this post reaches for it. A click dives: the sky rushes past the
// star, its art opens out of it, and the warp carries on from there, so the
// move reads as one flight into the next post.
//
// Sound hooks:
//   post:hover { kind: "sky", id, note }  a star came under the pointer; note is
//     its place in its constellation, 0 the brightest
//   post:transition { direction: "out", slug }  the dive set off for slug
//   post:transition { direction: "in", slug }  arrived, fired by the opening

import { navigate } from "astro:transitions/client";
import { clamp, emit, h, isPhone, isTouch, reduced, whileVisible } from "./util";

export function mountEndSky(signal: AbortSignal): void | (() => void) {
  const section = document.getElementById("pfx-sky");
  if (!section) return;
  const field = section.querySelector<HTMLElement>(".pfx-sky-field");
  const dome = section.querySelector<HTMLElement>(".pfx-sky-dome");
  const canvas = section.querySelector<HTMLCanvasElement>(".pfx-sky-bg");
  const card = section.querySelector<HTMLAnchorElement>(".pfx-sky-card");
  const reach = section.querySelector<SVGLineElement>(".pfx-sky-reach");
  if (!field || !dome) return;

  const still = reduced();
  const stars = Array.from(section.querySelectorAll<HTMLElement>(".pfx-sky-star"));
  const links = stars.filter((s): s is HTMLAnchorElement => s.tagName === "A");
  const here = stars.find((s) => s.classList.contains("is-here"));
  const posOf = (el: HTMLElement) => {
    const li = el.parentElement as HTMLElement;
    return { x: parseFloat(li.style.getPropertyValue("--x")), y: parseFloat(li.style.getPropertyValue("--y")) };
  };

  // ---- Backdrop: the same Milky Way, painted once per size ----------------
  let pw = 0;
  let ph = 0;
  const paint = () => {
    if (!canvas) return;
    const W = section.clientWidth;
    const H = section.clientHeight;
    if (Math.abs(W - pw) < 2 && Math.abs(H - ph) < 40) return;
    pw = W;
    ph = H;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ax = -W * 0.05;
    const ay = H * 0.9;
    const bx = W * 1.05;
    const by = H * 0.1;
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const nx = -uy;
    const ny = ux;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 22; i++) {
      const t = rnd();
      const off = (rnd() - 0.5) * H * 0.2;
      const x = ax + ux * len * t + nx * off;
      const y = ay + uy * len * t + ny * off;
      const r = H * (0.14 + rnd() * 0.18);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rnd() < 0.4 ? "rgba(255,226,196,0.05)" : "rgba(190,205,255,0.055)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < Math.round((W * H) / 1000); i++) {
      const t = rnd();
      const off = (rnd() + rnd() + rnd() - 1.5) * H * 0.18;
      const x = ax + ux * len * t + nx * off;
      const y = ay + uy * len * t + ny * off;
      ctx.fillStyle = `rgba(225,232,255,${(0.05 + rnd() * 0.22).toFixed(3)})`;
      const s = rnd() < 0.92 ? 0.7 : 1.3;
      ctx.fillRect(x, y, s, s);
    }
    for (let i = 0; i < Math.round((W * H) / 2800); i++) {
      const big = rnd() < 0.06;
      ctx.fillStyle = `rgba(235,240,255,${(big ? 0.5 + rnd() * 0.4 : 0.12 + rnd() * 0.35).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(rnd() * W, rnd() * H, big ? 1.1 : 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  };
  const ro = new ResizeObserver(paint);
  ro.observe(section);
  paint();

  // The lines draw the first time the sky comes up.
  const seenIo = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      section.classList.add("is-seen");
      seenIo.disconnect();
    },
    { threshold: 0.2 },
  );
  seenIo.observe(field);

  // ---- The card and the reaching line --------------------------------------
  const art = card?.querySelector<HTMLElement>(".pfx-sky-card-art");
  const setCard = (a: HTMLAnchorElement) => {
    if (!card || card.dataset.slug === a.dataset.slug) return;
    card.dataset.slug = a.dataset.slug || "";
    card.href = a.href;
    card.style.setProperty("--art", a.dataset.rgb || "52,211,153");
    const t = card.querySelector(".pfx-sky-card-title");
    const l = card.querySelector(".pfx-sky-card-line");
    const m = card.querySelector(".pfx-sky-card-meta");
    if (t) t.textContent = a.dataset.title || "";
    if (l) l.textContent = a.dataset.line || "";
    if (m) m.textContent = a.dataset.meta || "";
    if (art && a.dataset.thumb) {
      art.innerHTML = "";
      const pic = h("picture");
      const s = h("source");
      s.type = "image/avif";
      s.srcset = `${a.dataset.thumb}.avif`;
      const img = h("img");
      img.src = `${a.dataset.thumb}.webp`;
      img.alt = "";
      img.width = 560;
      img.height = 315;
      pic.append(s, img);
      art.append(pic);
      if (!still) img.animate([{ opacity: 0, transform: "scale(1.05)" }, { opacity: 1, transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(0.22,1,0.3,1)" });
    }
  };
  const reachTo = (a: HTMLElement | null) => {
    if (!reach || !here) return;
    if (!a) {
      reach.classList.remove("is-on");
      return;
    }
    const f = posOf(here);
    const t = posOf(a);
    reach.setAttribute("x1", String(f.x));
    reach.setAttribute("y1", String(f.y));
    reach.setAttribute("x2", String(t.x));
    reach.setAttribute("y2", String(t.y));
    reach.classList.remove("is-on");
    void reach.getBoundingClientRect();
    reach.classList.add("is-on");
  };
  const light = (a: HTMLAnchorElement) => {
    links.forEach((s) => s.classList.toggle("is-hot", s === a));
    setCard(a);
    reachTo(a);
    emit("post:hover", { kind: "sky", id: a.dataset.slug || "", note: parseInt(a.dataset.note || "0") % 12 });
  };
  links.forEach((a) => {
    a.addEventListener("pointerenter", (e) => {
      if ((e as PointerEvent).pointerType !== "touch") light(a);
    }, { signal });
    a.addEventListener("focus", () => light(a), { signal });
    a.addEventListener("pointerleave", () => {
      a.classList.remove("is-hot");
      reachTo(null);
    }, { signal });
    a.addEventListener("click", (e) => dive(e, a), { signal });
  });
  if (card) {
    card.addEventListener("click", (e) => {
      const a = links.find((s) => s.dataset.slug === card.dataset.slug);
      if (a) dive(e, a);
    }, { signal });
  }

  // ---- The dive ------------------------------------------------------------
  let diving = false;
  function dive(e: Event, a: HTMLAnchorElement) {
    const me = e as MouseEvent;
    if (me.metaKey || me.ctrlKey || me.shiftKey || me.button > 0) return;
    if (still) return; // the plain link does the work
    e.preventDefault();
    if (diving) return;
    diving = true;
    const slug = a.dataset.slug || "";
    emit("post:transition", { direction: "out", slug });
    try {
      sessionStorage.setItem("pfx-dive", slug);
    } catch {
      /* no note, no matter */
    }
    section!.classList.add("is-diving");
    a.classList.add("is-hot");
    const star = a.querySelector("i") || a;
    const r = star.getBoundingClientRect();
    const fx = r.left + r.width / 2;
    const fy = r.top + r.height / 2;
    const dr = dome!.getBoundingClientRect();
    dome!.style.transformOrigin = `${fx - dr.left}px ${fy - dr.top}px`;
    dome!.animate(
      [{ transform: "scale(1)" }, { transform: "scale(11)" }],
      { duration: 900, easing: "cubic-bezier(0.55, 0, 0.85, 0.35)", fill: "forwards" },
    );
    if (canvas) {
      canvas.style.transformOrigin = `${fx}px ${fy - section!.getBoundingClientRect().top}px`;
      canvas.animate([{ transform: "scale(1)" }, { transform: "scale(1.6)" }], { duration: 900, easing: "cubic-bezier(0.55, 0, 0.85, 0.35)", fill: "forwards" });
    }
    // The next post's art opens out of the star.
    const veil = h("div", "pfx-dive");
    veil.style.setProperty("--x", `${fx.toFixed(0)}px`);
    veil.style.setProperty("--y", `${fy.toFixed(0)}px`);
    veil.style.setProperty("--art", a.dataset.rgb || "52,211,153");
    if (a.dataset.thumb) {
      const pic = h("picture");
      const s = h("source");
      s.type = "image/avif";
      s.srcset = `${a.dataset.thumb}.avif`;
      const img = h("img");
      img.src = `${a.dataset.thumb}.webp`;
      img.alt = "";
      pic.append(s, img);
      veil.append(pic);
    }
    document.body.append(veil);
    window.setTimeout(() => navigate(a.href), 780);
  }

  // ---- Motion --------------------------------------------------------------
  if (still) {
    return () => {
      ro.disconnect();
      seenIo.disconnect();
    };
  }
  let tx = 0;
  let ty = 0;
  let sx = 0;
  let sy = 0;
  let mx = -1e4;
  let my = -1e4;
  const fine = !isTouch();
  if (fine) {
    field.addEventListener(
      "pointermove",
      (e) => {
        const r = field.getBoundingClientRect();
        mx = e.clientX - r.left;
        my = e.clientY - r.top;
        tx = clamp((mx / r.width) * 2 - 1, -1, 1);
        ty = clamp((my / r.height) * 2 - 1, -1, 1);
      },
      { passive: true, signal },
    );
    field.addEventListener(
      "pointerleave",
      () => {
        tx = 0;
        ty = 0;
        mx = -1e4;
        my = -1e4;
      },
      { passive: true, signal },
    );
  }
  type Lean = { el: HTMLElement; x: number; y: number; lx: number; ly: number };
  const lean: Lean[] = stars.map((el) => ({ el, x: 0, y: 0, lx: 0, ly: 0 }));
  const place = () => {
    const r = field.getBoundingClientRect();
    lean.forEach((s) => {
      const p = posOf(s.el);
      s.x = (p.x / 100) * r.width;
      s.y = (p.y / 100) * r.height;
    });
  };
  place();
  const ro2 = new ResizeObserver(place);
  ro2.observe(field);
  const t0 = performance.now();
  whileVisible(
    section,
    (now) => {
      if (diving) return;
      const t = (now - t0) / 1000;
      sx += (tx - sx) * 0.05;
      sy += (ty - sy) * 0.05;
      const rx = -sy * 4 + Math.sin(t * 0.11) * 0.6;
      const ry = sx * 5 + Math.cos(t * 0.09) * 0.6;
      dome.style.setProperty("--rx", `${rx.toFixed(3)}deg`);
      dome.style.setProperty("--ry", `${ry.toFixed(3)}deg`);
      if (canvas) canvas.style.transform = `translate3d(${(-sx * 10).toFixed(1)}px, ${(-sy * 7).toFixed(1)}px, 0) scale(1.03)`;
      if (!fine || isPhone()) return;
      for (const s of lean) {
        const dx = mx - s.x;
        const dy = my - s.y;
        const d = Math.hypot(dx, dy);
        let lx = 0;
        let ly = 0;
        if (d < 150 && d > 0.5) {
          const f = Math.pow(1 - d / 150, 2) * 9;
          lx = (dx / d) * f;
          ly = (dy / d) * f;
        }
        if (Math.abs(lx - s.lx) > 0.05 || Math.abs(ly - s.ly) > 0.05) {
          s.lx += (lx - s.lx) * 0.25;
          s.ly += (ly - s.ly) * 0.25;
          s.el.style.transform = `translate3d(${s.lx.toFixed(1)}px, ${s.ly.toFixed(1)}px, 0)`;
        }
      }
    },
    signal,
  );

  return () => {
    ro.disconnect();
    ro2.disconnect();
    seenIo.disconnect();
    document.querySelectorAll(".pfx-dive").forEach((n) => n.remove());
  };
}
