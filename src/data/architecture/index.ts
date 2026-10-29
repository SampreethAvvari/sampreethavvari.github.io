// Architecture pages, one per system. Each system lives in its own file,
// systems/<slug>.ts, so many hands can add systems without touching one list.
// A file exports default an Architecture (types.ts): the title block, the
// readouts, the Archify diagram (svg/<slug>.svg, extracted by
// scripts/archify-extract.mjs), what each part does when clicked, how it
// fails, what was tuned, and what it costs.
//
// Every number has a source: git, the GCP billing export, or the repo's own
// docs. A fact's `source` is the file it came from, shown as a small chip.

import type { Architecture } from "./types";
export type { Architecture, Fact, Part, Readout } from "./types";

const modules = import.meta.glob<{ default: Architecture }>("./systems/*.ts", { eager: true });

export const architectures: Architecture[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

export const architectureBySlug: Record<string, Architecture> = Object.fromEntries(
  architectures.map((a) => [a.slug, a]),
);

/** The drawing with each part's owner on its group, so mine, managed,
 * outside and planned look right on first paint, with no script. */
export const svgWithOwners = (arch: Architecture) =>
  arch.svg.replace(/data-node-id="([^"]+)"/g, (m, id) => `${m} data-owner="${arch.parts[id]?.owner ?? "outside"}"`);
