import fs from "node:fs";
import path from "node:path";

// Which kinds of work each post is about, for the filters on /posts and for
// "More writing" at the end of a post. A post can carry more than one.
export const disciplinesFor: Record<string, string[]> = {
  "enterprise-search": ["aie"],
  "clinical-rag": ["aie", "fde"],
  "doctor-report-cards": ["aie", "fde"],
  "pipeline-ghosting": ["sde"],
  "npc-coach": ["aie"],
  "cbct-scan-validator": ["mle"],
  "jobpilot-v2": ["sde", "aie"],
  "jobpilot": ["sde", "aie"],
  "llama-rlhf": ["mle"],
  "resnet-under-5m": ["mle"],
  "recsys-spark-bigdata": ["mle", "sde"],
  "fake-news-sentiment": ["mle"],
  "loan-radar-mlops": ["mle"],
  "treatment-estimator": ["sde", "fde"],
  "cowork-dashboard": ["fde"],
  "cdf-diagnostic-filter": ["aie"],
  "reconciliation": ["fde", "sde"],
  "accounting-automation": ["fde"],
  "magic-hour": ["aie", "sde"],
  "film-and-engineering": [],
  // The October posts, matched to where src/data/disciplines.ts lists them.
  "patient-dashboard": ["fde", "sde"],
  "capacity-planner": ["fde", "sde"],
  "treatment-sequence": ["sde"],
  "daily-sales-report": ["mle"],
  "marketing-warehouse": ["aie"],
};

// Impact order: the projects that changed the most for the people using
// them. Enterprise RAG work first, then the patient hub, Doc Coach and its
// pipeline hardening, NPC Coach, the CBCT validator, JobPilot, the research
// work, the estimator and its visit plans, the dashboards, and the rest
// ranked by content.
export const impactOrder = [
  "enterprise-search",
  "patient-dashboard",
  "clinical-rag",
  "doctor-report-cards",
  "pipeline-ghosting",
  "npc-coach",
  "cbct-scan-validator",
  "capacity-planner",
  "marketing-warehouse",
  "daily-sales-report",
  "jobpilot-v2",
  "jobpilot",
  "magic-hour",
  "llama-rlhf",
  "resnet-under-5m",
  "recsys-spark-bigdata",
  "fake-news-sentiment",
  "loan-radar-mlops",
  "treatment-estimator",
  "treatment-sequence",
  "cowork-dashboard",
  "cdf-diagnostic-filter",
  "reconciliation",
  "accounting-automation",
  "film-and-engineering",
];

export const slugOf = (url: string | undefined) =>
  (url || "").split("/").filter(Boolean).pop() || "";

export const impactRank = (slug: string) => {
  const i = impactOrder.indexOf(slug);
  return i === -1 ? 500 : i;
};

// "2026-10-06" reads as "Oct 6, 2026". Parsed as UTC so the day never slips
// by a time zone.
export function formatPostDate(date: string | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// A cover only renders when its file exists, so a post whose art is still
// being made shows a calm panel instead of a broken image. The repo keeps
// the optimised .avif/.webp siblings, not always the .png.
export const hasPublic = (p?: string) =>
  !!p &&
  [p, p.replace(/\.(png|jpe?g)$/i, ".avif"), p.replace(/\.(png|jpe?g)$/i, ".webp")].some((f) =>
    fs.existsSync(path.join(process.cwd(), "public", f)),
  );
