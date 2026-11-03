// The wall's data, worked out at build time from the same files the
// drawings use (src/data/architecture). Nothing here is new information:
// names, lines, counts, status and cost come straight from each system's
// own file, worded the way that file words them.

import { architectures, type Architecture } from "../../../data/architecture";

/** Is this system running in production right now? Previews, paused,
 * offline and school projects say so in their status note. */
export const isRunning = (a: Architecture) => (a.status ?? "live") === "live";

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

/** What one card needs, sent to the wall script as JSON. */
export type Card = {
  slug: string;
  name: string;
  project: string;
  kind: "system" | "service";
  disciplines: string[];
  headline: string;
  tail: string;
  status: string;
  running: boolean;
  /** Not running at all: paused, offline, retired or never deployed. */
  retired: boolean;
  parts: number;
  mine: number;
  fails: number;
  cost: string;
};

export function toCard(a: Architecture): Card {
  const parts = Object.values(a.parts);
  const running = isRunning(a);
  return {
    slug: a.slug,
    name: a.name,
    project: a.project,
    kind: a.kind,
    disciplines: a.disciplines,
    headline: a.headline,
    tail: a.tail,
    status: a.statusNote ?? (running ? "In production" : "Preview"),
    running,
    retired: !running && /not running|offline|paused|not deployed|retired/i.test(a.statusNote ?? ""),
    parts: parts.length,
    mine: parts.filter((p) => p.owner === "mine").length,
    fails: a.breaks.length,
    cost: a.cost ? `${a.cost.total} ${a.cost.period}` : "",
  };
}
