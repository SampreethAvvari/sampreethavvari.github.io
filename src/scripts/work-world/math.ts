// Numbers and small helpers with no dependency on three, so the page can use
// them before the 3D has loaded.

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const k = clamp(t);
  return k * k * (3 - 2 * k);
};
export const smoother = (t: number) => {
  const k = clamp(t);
  return k * k * k * (k * (k * 6 - 15) + 10);
};
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
export const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const outCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** A seeded generator, so the station is built the same way on every visit. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export const emit = (name: string, detail: Record<string, unknown>) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));
