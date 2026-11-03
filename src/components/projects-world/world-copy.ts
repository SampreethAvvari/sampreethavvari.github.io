// What each world says. A part either points at a stat in src/data/info.ts by
// index (so the number cannot drift from the site's records) or carries a value
// the page checks against that project's own entry when it builds.

export interface PartCopy {
  key: string;
  /** Index into the project's details.stats. */
  stat?: number;
  /** A number or fact that is in the project's entry but not in its stats. */
  value?: string;
  label: string;
}

export interface WorldCopy {
  id: string;
  /** Matched against the project's title. */
  match: string;
  /** The title, one word or phrase per line. */
  name: string[];
  accent: string;
  line: string;
  /** The world's biggest fact, set as large as its title on some screens. */
  hero?: { value: string; label: string };
  /** The first `shown` parts stay on screen in the second shot, with leader lines. The rest appear on hover. */
  shown: number;
  parts: PartCopy[];
}

export const WORLD_COPY: WorldCopy[] = [
  {
    id: "mirror",
    match: "Patient Dashboard",
    name: ["Patient", "Dashboard"],
    accent: "#9cc4ff",
    line: "One row per patient, every document one click away, and a live read only mirror the other apps read through.",
    shown: 4,
    parts: [
      { key: "links", stat: 0, label: "Charts the linker picked right, in a blind test against bookings" },
      { key: "lag", stat: 1, label: "How far the mirror trails, down from 6.0 days" },
      { key: "intakes", stat: 2, label: "Intake surveys linked to their chart on their own by Sep 30" },
      { key: "backfill", stat: 3, label: "From the first backfill, with 0 errors, each one undoable" },
      { key: "ids", value: "Four ids", label: "Four tabs and four ids for one patient. Every record now joins on one." },
    ],
  },
  {
    id: "ring",
    match: "Capacity Planner",
    name: ["Capacity", "Planner"],
    accent: "#ffbf80",
    line: "Demand, capacity and capability across three offices, in one forward view. It reads and never writes back.",
    shown: 4,
    parts: [
      { key: "cells", stat: 2, label: "Day cells from the old workbook, reproduced on every test run" },
      { key: "sync", stat: 0, label: "Sync from the Denticon mirror, with no vendor credential in the planner" },
      { key: "valve", stat: 1, label: "Toward Denticon, held there by a test that fails the build" },
      { key: "days", stat: 3, label: "From the first commit on Sep 11 to production on Sep 28" },
      { key: "docks", value: "Three offices", label: "One dock each. A shuttle stands for cover moving between them." },
      { key: "keys", value: "Five keys", label: "Cover suggestions rank capability, willingness, presence, free day and pairing" },
    ],
  },
  {
    id: "listener",
    match: "Doc Coach",
    name: ["Doc Coach"],
    accent: "#ff9d7a",
    line: "Grades every implant consult from its Zoom call and sends a colored report to the doctor, the treatment coordinator and the CEO.",
    shown: 4,
    parts: [
      { key: "live", stat: 0, label: "Consults scored live, May 19 to Oct 28" },
      { key: "fast", stat: 1, label: "Median from transcript to report, October" },
      { key: "bands", stat: 2, label: "Criteria and sub checks. Seven bands, 25 beads." },
      { key: "older", stat: 3, label: "Older consults regraded on the same rubric" },
      { key: "quote", value: "Real timestamp", label: "Every rationale must quote the transcript with one" },
    ],
  },
  {
    id: "disk",
    match: "NPC Coach",
    name: ["NPC Coach"],
    accent: "#ffb56b",
    line: "Finds the new patient calls among thousands of recordings and grades each one with a transcript quote behind every score.",
    hero: { value: "28,745", label: "Recordings the poller read" },
    shown: 4,
    parts: [
      { key: "graded", stat: 0, label: "Real calls graded, June 17 to October 29" },
      { key: "minutes", stat: 1, label: "Median from call end to grade, October" },
      { key: "score", stat: 2, label: "Weighted score, plus 3 hard gates" },
      { key: "days", stat: 3, label: "First commit to live calls" },
      { key: "recordings", value: "28,745", label: "Recordings the poller read" },
      { key: "gates", value: "3 hard gates", label: "They show as a flag beside the score" },
    ],
  },
  {
    id: "geode",
    match: "Treatment Estimator",
    name: ["Treatment", "Estimator"],
    accent: "#ffc98f",
    line: "Every saved line keeps the price it was quoted.",
    hero: { value: "14.5 hrs", label: "First commit to v1.0.0" },
    shown: 4,
    parts: [
      { key: "hours", stat: 0, label: "First commit to v1.0.0" },
      { key: "fields", stat: 1, label: "Frozen on every saved line: price, tier, label, price book version" },
      { key: "kinds", stat: 2, label: "Pricing model kinds: flat, tiered, tiered by zone, price range, per surface" },
      { key: "cost", stat: 3, label: "Measured cloud cost, October 1 to 28" },
      { key: "decisions", value: "Nine", label: "Architecture decisions written before any code" },
    ],
  },
  {
    id: "arch",
    match: "Centralized Diagnostic Filter",
    name: ["Centralized", "Diagnostic Filter"],
    accent: "#c8b8ff",
    line: "Intake and experience surveys where Gemini writes the doctor's page and reads the panorex under the founder's own rules.",
    shown: 4,
    parts: [
      { key: "both", stat: 1, label: "Reports before a clinic list gets an email" },
      { key: "calls", stat: 0, label: "Gemini calls, each through one retry and fallback chain" },
      { key: "cases", stat: 2, label: "The founder narrated, now the written ruleset" },
      { key: "quick", stat: 3, label: "For an experience survey submit to return" },
      { key: "risk", value: "0 to 200", label: "The risk score on the doctor report, for the doctor to explain" },
      { key: "stones", value: "The panorex", label: "The model lists the teeth, and plain code recomputes the score" },
    ],
  },
  {
    id: "nets",
    match: "Hybridge Forms",
    name: ["Hybridge", "Forms"],
    accent: "#8ff0dc",
    line: "Our own forms service, built around one rule: no submission is ever lost.",
    shown: 4,
    parts: [
      { key: "retry", stat: 0, label: "About how long the browser retries before it keeps the answers on the device" },
      { key: "logs", stat: 1, label: "Answers, names, emails or phones in any log line" },
      { key: "leads", stat: 2, label: "Got their missing tracking fields on Oct 26" },
      { key: "cost", stat: 3, label: "Measured Google Cloud cost in October, a partial month" },
      { key: "nets", value: "Firestore first", label: "Then a private Cloud Storage bucket, then the visitor's device" },
      { key: "sweep", value: "Every minute", label: "A sweep runs, behind a worker that wakes on every send" },
    ],
  },
  {
    id: "comet",
    match: "JobPilot",
    name: ["JobPilot"],
    accent: "#bcd6ff",
    line: "My open source job hunt autopilot. It scored each role against my profile and tailored a resume and cover letter per match.",
    shown: 4,
    parts: [
      { key: "boards", value: "163", label: "Company boards watched directly" },
      { key: "runs", value: "1,008", label: "Runs from June 10 to October 8" },
      { key: "patterns", value: "16", label: "Patterns that drop a job before any model sees it" },
      { key: "sources", value: "Eleven", label: "Sources watched directly" },
    ],
  },
];

/** The title of the entry the star stands for. */
export const STAR_MATCH = "Hybridge Platform";

/** Body order through the belt: Hybridge work first, then school, research last. */
export const BELT_ORDER = [
  "cbct-scan-validator",
  "enterprise-search",
  "reconciliation",
  "treatment-sequence",
  "cowork-dashboard",
  "daily-sales-report",
  "marketing-data-warehouse",
  "marketing-data-connector",
  "denticon-sync",
  "cdf-registry",
  "pdf-renderer",
  "launchpad",
  "feature-requests-relay",
  "doctor-portal",
  "hybridge-websites",
  "case-intake",
  "enterprise-data-project",
  "teaching-llama-to-argue-better",
  "loan-radar",
  "fake-news-and-sentiment-analysis",
  "resnet-under-5m-parameters",
  "customer-segmentation-and-recommendation-system",
];
