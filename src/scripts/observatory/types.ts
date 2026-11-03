// What the page and the 3D scene say to each other.

export type Owner = "mine" | "managed" | "outside" | "planned";

export type Part = {
  id: string;
  label: string;
  sub: string;
  shape: string;
  owner: Owner;
  kind: string;
  fails: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Edge = { from: string; to: string; label: string; type: "main" | "plain" | "trust" | "demand"; pts: number[] };
export type Region = { label: string; x: number; y: number; w: number; h: number };

export type World = {
  slug: string;
  name: string;
  project: string;
  kind: "system" | "service";
  disciplines: string[];
  running: boolean;
  vw: number;
  vh: number;
  parts: Part[];
  edges: Edge[];
  regions: Region[];
  live: { mode: "interval" | "daily" | "event"; label: string; path: string[]; every: number; window: number[]; at: string; days: number[]; source: string };
  hue: string;
};

export type EngineDom = {
  labels: HTMLElement;
  eye: HTMLElement;
  eyeImg: HTMLImageElement;
  eyeName: HTMLElement;
  eyeMeta: HTMLElement;
  tip: HTMLElement;
  tipKind: HTMLElement;
  tipName: HTMLElement;
  tipSub: HTMLElement;
  tipFails: HTMLElement;
  wake: HTMLElement;
};

export type EngineOptions = {
  worlds: World[];
  low: boolean;
  reduced: boolean;
  dom: EngineDom;
  /** 0..1, how busy the sky is right now. */
  onActivity?: (a: number) => void;
  onReady?: () => void;
};

export interface Engine {
  /** The worlds in flight order (indices into worlds); the rest drift out. */
  setOrder(order: number[]): void;
  /** -1 the galaxy, 0..n-1 each world in order, n the closing view. */
  setScroll(s: number): void;
  /** Pointer in CSS pixels of the canvas, or null when it leaves. */
  setPointer(x: number | null, y: number | null): void;
  /** The world under the pointer in the galaxy view, if any. */
  pick(): number | null;
  /** Send one request along a world's real path. */
  fire(world: number): void;
  /** A scheduled run on the day replay: the world flashes. */
  pulse(world: number, strength?: number): void;
  /** Light every part of a world that has a written failure. */
  setAlert(world: number | null): void;
  /** Bring the worlds up one by one from the core. */
  ignite(): void;
  setPaused(paused: boolean): void;
  destroy(): void;
}
