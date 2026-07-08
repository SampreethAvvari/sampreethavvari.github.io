import React, { useRef, useEffect } from "react";

// Cursor glitter trail. Fine specks with a soft radial glow, twinkling out
// over their life. Multi-tone palette so it doesn't read as one flat colour.
// Hi-DPI canvas so the specks stay crisp on retina displays.
export default function Pointer() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // No trail for users who asked for less motion, and no work on touch
    // devices where the canvas is hidden anyway.
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(pointer: fine)").matches
    ) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let particles = [];
    let raf = 0;
    let dpr = window.devicePixelRatio || 1;

    const sizeCanvas = () => {
      dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeCanvas();

    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);

    const mouse = { x: undefined, y: undefined, last_x: undefined, last_y: undefined };

    const onMouseMove = (e) => {
      mouse.last_x = mouse.x;
      mouse.last_y = mouse.y;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onMouseOut = () => {
      mouse.x = mouse.last_x;
      mouse.y = mouse.last_y;
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseout", onMouseOut);

    // Cool-palette glitter so it reads as a single coherent trail across modes.
    const palette = [
      "rgba(91, 141, 239, 1)",   // brand blue
      "rgba(34, 211, 238, 1)",   // cyan
      "rgba(167, 139, 250, 1)",  // violet
      "rgba(244, 244, 247, 1)",  // near-white sparkle
    ];

    const cfg = {
      radius: [0.4, 1.6],     // fine specks instead of fat balls
      spread: 14,              // jitter around the cursor
      life: 42,                // frames; longer life = longer twinkle tail
      interval: 12,            // ms between emissions
      threshold: 1.2,          // movement floor to start emitting
      velocityScale: 0.10,     // damped, sleek tails
      friction: 0.94,          // ease the speed out so specks settle
    };

    const rand = (min, max) => Math.random() * (max - min) + min;

    function emit() {
      if (
        mouse.x === undefined ||
        mouse.last_x === undefined ||
        (Math.abs(mouse.x - mouse.last_x) < cfg.threshold &&
          Math.abs(mouse.y - mouse.last_y) < cfg.threshold)
      ) {
        return;
      }
      // Up to 3 specks per emission, density scales with speed.
      const dx = mouse.x - mouse.last_x;
      const dy = mouse.y - mouse.last_y;
      const speed = Math.hypot(dx, dy);
      const count = Math.min(3, 1 + Math.floor(speed / 10));
      for (let i = 0; i < count; i++) {
        const radius = rand(...cfg.radius);
        const x = mouse.x + rand(-cfg.spread, cfg.spread) / 2;
        const y = mouse.y + rand(-cfg.spread, cfg.spread) / 2;
        const vx = dx * cfg.velocityScale + rand(-0.3, 0.3);
        const vy = dy * cfg.velocityScale + rand(-0.3, 0.3);
        const color = palette[Math.floor(Math.random() * palette.length)];
        particles.push(new Particle(x, y, vx, vy, radius, color, cfg.life, ctx, cfg.friction));
      }
    }

    const emitter = setInterval(emit, cfg.interval);

    // Pause everything while the tab is hidden.
    let hidden = document.hidden;
    const onVisibility = () => {
      hidden = document.hidden;
      if (hidden) particles = [];
    };
    document.addEventListener("visibilitychange", onVisibility);

    function frame() {
      raf = requestAnimationFrame(frame);
      if (hidden) return;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      // Additive blending makes overlapping specks twinkle instead of muddy out.
      ctx.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.dead()) particles.splice(i, 1);
        else p.update();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(emitter);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("visibilitychange", onVisibility);
      particles = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-50 hidden md:block not-sr-only"
    />
  );
}

function Particle(x, y, vx, vy, radius, color, life, ctx, friction) {
  this.x = x;
  this.y = y;
  this.vx = vx;
  this.vy = vy;
  this.radius = radius;
  this.color = color;
  this.life = life;
  this.maxLife = life;
  this.ctx = ctx;
  this.friction = friction;

  this.update = function () {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 1;

    // Twinkle: opacity falls off non-linearly as life remaining shrinks.
    const t = this.life / this.maxLife;
    const alpha = Math.max(0, Math.pow(t, 0.8));
    // Soft radial halo: small bright core + wider faint glow.
    const haloR = this.radius * 5.5;
    const grad = this.ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, haloR);
    const coreColor = this.color.replace("1)", `${0.9 * alpha})`);
    const midColor = this.color.replace("1)", `${0.4 * alpha})`);
    const outerColor = this.color.replace("1)", "0)");
    grad.addColorStop(0, coreColor);
    grad.addColorStop(0.35, midColor);
    grad.addColorStop(1, outerColor);

    this.ctx.beginPath();
    this.ctx.fillStyle = grad;
    this.ctx.arc(this.x, this.y, haloR, 0, Math.PI * 2);
    this.ctx.fill();
  };

  this.dead = function () {
    return this.life <= 0;
  };
}
