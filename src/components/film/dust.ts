// Fine red star dust on one small 2D canvas. Motes drift up slowly and
// twinkle; the canvas sleeps when it is off screen or the tab is hidden,
// draws one still frame for people who asked for less motion, and caps its
// pixel ratio at 1.5 on phones. Returns a stop function; the signal stops
// it too.

type Mote = { x: number; y: number; r: number; a: number; tw: number; ts: number; vx: number; vy: number; red: boolean };

export function mountDust(canvas: HTMLCanvasElement, signal: AbortSignal): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = window.matchMedia("(max-width: 767px)").matches;
  const dprCap = phone ? 1.5 : 2;
  const spawn = (anywhere: boolean): Mote => ({
    x: Math.random(),
    y: anywhere ? Math.random() : 1.02,
    r: Math.random() ** 2.2 * 1.5 + 0.35,
    a: 0.25 + Math.random() * 0.7,
    tw: Math.random() * Math.PI * 2,
    ts: 0.5 + Math.random() * 1.4,
    vx: (Math.random() - 0.5) * 0.006,
    vy: -(0.003 + Math.random() * 0.01),
    red: Math.random() < 0.4,
  });
  const motes = Array.from({ length: phone ? 60 : 130 }, () => spawn(true));
  let w = 0;
  let h = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const draw = (t: number, dt: number) => {
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < -0.02 || m.x < -0.02 || m.x > 1.02) Object.assign(m, spawn(false), { x: Math.random() });
      const fade = Math.max(0, Math.min(1, (1 - m.y) / 0.25, m.y / 0.08));
      const twinkle = 0.55 + 0.45 * Math.sin(t * m.ts + m.tw);
      ctx.globalAlpha = m.a * twinkle * fade;
      ctx.fillStyle = m.red ? "#ff5d78" : "#ffe6ea";
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
      if (m.r > 1.3) {
        ctx.globalAlpha *= 0.18;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  let running = false;
  let onScreen = true;
  let last = 0;
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
    last = now;
    draw(now / 1000, dt);
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    const want = !reduce && onScreen && !document.hidden && !signal.aborted;
    if (want && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  resize();
  draw(0, 0);
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) draw(performance.now() / 1000, 0);
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true;
    sync();
  });
  io.observe(canvas);
  document.addEventListener("visibilitychange", sync, { signal });
  sync();

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
  };
  signal.addEventListener("abort", stop);
  return stop;
}
