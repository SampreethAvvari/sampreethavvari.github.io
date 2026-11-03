import type { Tour } from "./types";

export const coworkDashboard: Tour = {
  slug: "cowork-dashboard",
  name: "Cowork Dashboard",
  tail: "One set of numbers three offices can trust.",
  post: "/posts/cowork-dashboard",
  cover: "/cowork-dashboard.png",
  kicker: "Data pipeline · Operations truth",
  accent: "#5B8DEF",
  accentRgb: "91, 141, 239",
  pitch:
    "An operations dashboard for our three offices. Weekly board exports feed most tabs, and the Cash Flow tab reads the Monday API every morning at 6. Nine tabs, and every metric is defined once. Each card counts the rows of its own drilldown, and a test checks it.",
  problem:
    "Leadership needed one view of the funnel, leads to scheduled to intakes to consults to accepted treatment, across Rochester, Buffalo and Syracuse.",
  metrics: [
    { label: "Ambiguous lead matches", value: "31.2% to 5.8%", sub: "after breaking surname ties on first name" },
    { label: "Request to live", value: "19 minutes", sub: "a finance request in the Feature requests tab, Oct 28" },
    { label: "Views", value: "9 tabs", sub: "every metric defined once" },
    { label: "Verification", value: "Excel diff", sub: "a harness checks metrics against ground truth" },
  ],
  concepts: ["Single source of truth", "Record linkage", "Boring tech on purpose", "Ground-truth verification", "Header-name parsing"],
  stack: ["TypeScript", "Cloud Run", "ExcelJS", "Cloud IAP", "Chart.js", "Monday.com exports and API", "Python verification harness"],
  steps: [
    {
      title: "Four files, once a week",
      body: "Ops exports the Leads board and the three patient boards to one Drive folder. That is the entire data engineering ask of the team, which is why it actually happens every week.",
      screen: {
        kind: "cards",
        title: "Weekly exports folder",
        cards: [
          { name: "Leads.xlsx", lines: ["CRM leads board export"], badge: "week 32" },
          { name: "Patients-ClinicA.xlsx", lines: ["patient board, clinic A"], badge: "week 32" },
          { name: "Patients-ClinicB.xlsx", lines: ["patient board, clinic B"], badge: "week 32" },
          { name: "Patients-ClinicC.xlsx", lines: ["patient board, clinic C"], badge: "week 32" },
        ],
      },
    },
    {
      title: "One refresh parses everything",
      body: "A private service checks the folder every five minutes and rebuilds when all four files have changed.",
      screen: {
        kind: "terminal",
        title: "Refresh",
        lines: [
          "$ check folder: all four files changed",
          "parse 4 xlsx · Leads_Raw: 61 rows · three patient boards",
          "join via connect column · 2 unlinked → data quality panel",
        ],
      },
    },
    {
      title: "The scorecard week",
      body: "Global filters set the window, default last completed week, with clinic and preset toggles. Scorecards show the funnel with deltas against the prior-year weekly baseline, and clicking any card drills into the underlying leads or patients.",
      screen: {
        kind: "bars",
        title: "Week of Mar 3 to 9 (synthetic)",
        bars: [
          { label: "Leads", value: 61, max: 61, tone: "good" },
          { label: "Scheduled", value: 34, max: 61 },
          { label: "Intakes", value: 22, max: 61 },
          { label: "Consults", value: 18, max: 61 },
          { label: "Treatment accepted", value: 9, max: 61, tone: "good" },
        ],
      },
    },
    {
      title: "Structurally consistent numbers",
      body: "Every tab calls the same metric definitions, and each card number is computed from its drilldown's rows.",
      screen: {
        kind: "table",
        title: "Lead sources (synthetic)",
        headers: ["Bucket", "Leads", "Consults", "Accepted"],
        rows: [
          ["Digital", "28", "9", { text: "5", tone: "good" }],
          ["Referral", "14", "6", { text: "3", tone: "good" }],
          ["Traditional", "9", "2", "1"],
          ["Radio", "6", "1", "0"],
          ["Other / unknown", "4", "0", "0"],
        ],
      },
    },
    {
      title: "Bad data gets its own panel",
      body: "Patients that cannot be linked to a lead show in their own panel, with what to fix in Monday.",
      screen: {
        kind: "table",
        title: "Data quality panel (synthetic)",
        headers: ["Patient", "Clinic", "Issue", "Fix"],
        rows: [
          ["P-2231", "A", { text: "no lead link", tone: "warn" }, "connect the lead on the CRM board"],
          ["P-2264", "B", { text: "no lead link", tone: "warn" }, "secondary source: additional treatment"],
        ],
      },
    },
    {
      title: "Trusted because it is verified",
      body: "A Python harness recomputes every metric from the raw Excel files and diffs against what the dashboard shows. Boring tech, deliberately: weekly exports beat a real-time dashboard nobody believed.",
      screen: {
        kind: "terminal",
        title: "Verification harness",
        lines: [
          "$ python verify.py --week 2026-03-03",
          "recompute every metric from raw xlsx",
          "diff vs dashboard values → 0 mismatches ✓",
          "unlinked: 2 (listed)",
        ],
      },
    },
  ],
  architecture: [
    { lane: "Ingest", items: ["Weekly Excel exports into one Drive folder", "A private service checks it every five minutes", "Header-name-based parser, order-proof"] },
    { lane: "Model", items: ["Each card counts its own drilldown rows", "Lead-patient join via CRM connect column", "Every metric defined once, for every view"] },
    { lane: "Present", items: ["Cloud Run web app behind Google sign in", "9 tabs including Cash Flow and Feature requests", "Chart.js with prior-year overlays"] },
    { lane: "Trust", items: ["Data quality panel with fix instructions", "Python harness diffs metrics vs raw Excel"] },
  ],
  outcome:
    "Leadership reads one set of numbers that agree with themselves and with the raw exports, and the weekly ritual is light enough that it has survived contact with reality. The interesting engineering decision was restraint: swapping a brittle live-API design for a verifiable weekly pipeline raised trust more than any feature could. Clinic names and all figures shown are synthetic stand-ins.",
};
