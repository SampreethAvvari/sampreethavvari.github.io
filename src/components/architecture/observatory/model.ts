// The observatory's data, worked out at build time from the same files the
// drawings use (src/data/architecture). Nothing here is new information:
// each part's place comes from its rectangle in the Archify SVG, each link
// from the SVG's paths, and the words, costs and schedules from the system's
// own file. The page sends a compact copy of this to the 3D scene.

import { architectures, type Architecture } from "../../../data/architecture";
import palette from "./palette.json";

export type Owner = "mine" | "managed" | "outside" | "planned";
export type EdgeType = "main" | "plain" | "trust" | "demand";

export type ObsPart = {
  id: string;
  label: string;
  sub: string;
  /** Archify's node kind: frontend, backend, database, external, security, messagebus, cloud. */
  shape: string;
  owner: Owner;
  /** The part's own kind in words, like "My service". */
  kind: string;
  fails: string;
  /** Rectangle in drawing units, origin at the drawing's centre, y down. */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ObsEdge = { from: string; to: string; label: string; type: EdgeType; pts: number[] };
export type ObsRegion = { label: string; x: number; y: number; w: number; h: number };

export type ObsLive = {
  mode: "interval" | "daily" | "event";
  label: string;
  path: string[];
  every: number;
  window: number[];
  at: string;
  days: number[];
  source: string;
};

/** What the 3D scene gets for one world. */
export type ObsWorld = {
  slug: string;
  name: string;
  project: string;
  kind: "system" | "service";
  disciplines: string[];
  running: boolean;
  /** Drawing size in its own units. */
  vw: number;
  vh: number;
  parts: ObsPart[];
  edges: ObsEdge[];
  regions: ObsRegion[];
  live: ObsLive;
  /** The art's own colour, sampled from /arch/<slug>.webp. Never a code. */
  hue: string;
};

const num = (s: string | undefined) => Number(s || 0);
const attr = (tag: string, name: string) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1] || "";
const unescape = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const EDGE_TYPE: Record<string, EdgeType> = {
  "a-emphasis": "main",
  "a-default": "plain",
  "a-security": "trust",
  "a-dashed": "demand",
};

/** Is this system running in production right now? Previews, paused,
 * offline and school projects say so in their status note. */
export const isRunning = (a: Architecture) => (a.status ?? "live") === "live";

export function toWorld(a: Architecture): ObsWorld {
  const svg = a.svg;
  const vb = (attr(svg.slice(0, 400), "viewBox") || "0 0 1166 520").split(/\s+/).map(Number);
  const [vx, vy, vw, vh] = vb;
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;

  const parts: ObsPart[] = [];
  for (const chunk of svg.split(/<g id="node-/).slice(1)) {
    const open = chunk.slice(0, chunk.indexOf(">"));
    const id = attr(open, "data-node-id");
    const rect = (chunk.match(/<rect\b[^>]*class="c-mask"[^>]*>/) || [])[0] || "";
    if (!id || !rect) continue;
    const p = a.parts[id];
    const x = num(attr(rect, "x"));
    const y = num(attr(rect, "y"));
    const w = num(attr(rect, "width"));
    const h = num(attr(rect, "height"));
    parts.push({
      id,
      label: unescape(attr(open, "data-node-label") || id),
      sub: unescape(attr(open, "data-node-sublabel")),
      shape: attr(open, "data-node-kind") || "backend",
      owner: (p?.owner ?? "outside") as Owner,
      kind: p?.kind ?? "",
      fails: p?.fails ?? "",
      x: Math.round(x + w / 2 - cx),
      y: Math.round(y + h / 2 - cy),
      w,
      h,
    });
  }

  const edges: ObsEdge[] = [];
  for (const m of svg.matchAll(/<path\b[^>]*data-edge-from[^>]*>/g)) {
    const tag = m[0];
    const pts = attr(tag, "data-composition-points")
      .split(";")
      .filter(Boolean)
      .flatMap((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return [Math.round(x - cx), Math.round(y - cy)];
      });
    if (pts.length < 4) continue;
    edges.push({
      from: attr(tag, "data-edge-from"),
      to: attr(tag, "data-edge-to"),
      label: unescape(attr(tag, "data-edge-label")),
      type: EDGE_TYPE[(attr(tag, "class").match(/a-[a-z]+/) || [""])[0]] ?? "plain",
      pts,
    });
  }

  const regions: ObsRegion[] = [];
  for (const m of svg.matchAll(/<rect\b[^>]*data-graph-role="structural-frame"[^>]*>/g)) {
    const tag = m[0];
    const x = num(attr(tag, "x"));
    const y = num(attr(tag, "y"));
    const w = num(attr(tag, "width"));
    const h = num(attr(tag, "height"));
    regions.push({ label: unescape(attr(tag, "data-composition-frame-label")), x: Math.round(x + w / 2 - cx), y: Math.round(y + h / 2 - cy), w, h });
  }

  const l = a.live;
  return {
    slug: a.slug,
    name: a.name,
    project: a.project,
    kind: a.kind,
    disciplines: a.disciplines,
    running: isRunning(a),
    vw,
    vh,
    parts,
    edges,
    regions,
    live: {
      mode: l.mode,
      label: l.label,
      path: l.path,
      every: l.everySeconds ?? (l.mode === "event" ? 14 : 60),
      window: l.window ?? [],
      at: l.at ?? "",
      days: l.days ?? [],
      source: l.source ?? "",
    },
    hue: (palette as Record<string, string>)[a.slug] ?? "#22d3ee",
  };
}

/** Systems in page order: projects keep the order of their best ranked
 * drawing, and a project's drawings sit together. */
export function inPageOrder(): Architecture[] {
  const projects: Array<{ name: string; items: Architecture[] }> = [];
  for (const a of architectures) {
    const p = projects.find((x) => x.name === a.project);
    if (p) p.items.push(a);
    else projects.push({ name: a.project, items: [a] });
  }
  return projects.flatMap((p) => p.items);
}

// --------------------------------------------------------------- schedules

const fmtHour = (h: number, m = 0) => {
  const ap = h < 12 || h === 24 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ap}` : `${hh} ${ap}`;
};

const everyText = (s: number) => {
  if (s % 3600 === 0) return s === 3600 ? "every hour" : `every ${s / 3600} hours`;
  if (s % 60 === 0) return s === 60 ? "every minute" : `every ${s / 60} minutes`;
  return `every ${s} seconds`;
};

/** The real rhythm in a few words: "every minute", "weekdays at 6:20 AM". */
export function scheduleText(a: Architecture): string {
  const l = a.live;
  if (l.mode === "interval") {
    const base = everyText(l.everySeconds ?? 60);
    return l.window ? `${base}, ${fmtHour(l.window[0])} to ${fmtHour(l.window[1])}` : base;
  }
  if (l.mode === "daily") {
    const [h, m] = (l.at || "00:00").split(":").map(Number);
    const weekdays = l.days && l.days.length === 5 && l.days.every((d) => d <= 5);
    return `${weekdays ? "weekdays" : "daily"} at ${fmtHour(h, m)}`;
  }
  return "when something happens";
}

/** How many times a clock system's path runs in one day, from its schedule.
 * Event systems have no clock, so they have no count. */
export function runsPerDay(a: Architecture, weekday: number): number | null {
  const l = a.live;
  if (l.mode === "event") return null;
  if (l.mode === "daily") return !l.days || l.days.includes(weekday) ? 1 : 0;
  const every = l.everySeconds ?? 60;
  const span = l.window ? (l.window[1] - l.window[0]) * 3600 : 86400;
  return Math.floor(span / every);
}

/** "Next sync" reads as "syncs"; "Next poll, 6 AM to 6 PM" as "polls". */
export function runNoun(a: Architecture, n: number): string {
  const base = a.live.label.replace(/^Next\s+/i, "").split(",")[0].trim();
  return n === 1 ? base : base.replace(/(\w+)$/, (w) => (w.endsWith("s") ? w : w + "s"));
}

export const usd = (n: number) => (n >= 100 ? `$${Math.round(n)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(2)}`);
