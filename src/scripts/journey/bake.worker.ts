// The planet's baked ground, sand and moons, away from the page's main thread.
import { grainData, groundGrids, moonData, rippleData } from "./bakes";

export type BakeAsk = { low: boolean; ripple: number; grain: [number, number]; moons: [number, number][] };

const scope = self as unknown as {
  postMessage: (m: unknown, transfer: Transferable[]) => void;
  onmessage: ((e: MessageEvent<BakeAsk>) => void) | null;
};

scope.onmessage = (e) => {
  const { low, ripple, grain, moons } = e.data;
  const ground = groundGrids(low);
  const r = rippleData(ripple);
  const g = grainData(grain[0], grain[1]);
  const m = moons.map(([w, seed]) => moonData(w, seed));
  scope.postMessage({ ground, ripple: r, grain: g, moons: m }, [ground.fine.d.buffer, ground.wide.d.buffer, r.buffer, g.buffer, ...m.map((x) => x.buffer)]);
};
