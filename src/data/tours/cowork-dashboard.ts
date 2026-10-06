import type { Tour } from "./types";

export const coworkDashboard: Tour = {
  slug: "cowork-dashboard",
  name: "Cowork Dashboard",
  tail: "One set of numbers two clinics can trust.",
  post: "/posts/cowork-dashboard",
  cover: "/cowork-dashboard.png",
  kicker: "Data pipeline · Operations truth",
  accent: "#5B8DEF",
  accentRgb: "91, 141, 239",
  pitch:
    "A two-clinic operations dashboard built on weekly board exports instead of a live API, joining patients to leads through the CRM's native connect column. Six tabs share one metrics module, so two views structurally cannot disagree on the same number.",
  problem:
    "Leadership needed one trustworthy view of the funnel: leads to scheduled to intakes to consults to accepted treatment, across two clinics. The tempting build was a live API dashboard; the honest one was a weekly export pipeline the team actually trusts, with lead-patient linkage done by the CRM's own connect column instead of fuzzy name matching.",
  metrics: [
    { label: "Patient-lead linkage", value: "~99%", sub: "via the CRM connect column, not name matching" },
    { label: "Weekly workflow", value: "3 min", sub: "drop three exports, hit refresh" },
    { label: "Views", value: "6 tabs", sub: "one shared metrics module underneath" },
    { label: "Verification", value: "Excel diff", sub: "a harness checks metrics against ground truth" },
  ],
  concepts: ["Single source of truth", "Record linkage", "Boring tech on purpose", "Ground-truth verification", "Header-name parsing"],
  stack: ["Google Apps Script", "Drive API", "Chart.js", "Monday.com exports", "Python verification harness"],
  steps: [
    {
      title: "Three files, once a week",
      body: "Ops exports the leads board and both clinics' patient boards to Excel and drops them in one Drive folder. That is the entire data engineering ask of the team, which is why it actually happens every week.",
      screen: {
        kind: "cards",
        title: "Weekly exports folder",
        cards: [
          { name: "Leads.xlsx", lines: ["CRM leads board export"], badge: "week 32" },
          { name: "Patients-ClinicA.xlsx", lines: ["patient board, clinic A"], badge: "week 32" },
          { name: "Patients-ClinicB.xlsx", lines: ["patient board, clinic B"], badge: "week 32" },
        ],
      },
    },
    {
      title: "One refresh parses everything",
      body: "The refresh converts each Excel to a sheet, parses by header name so column reordering cannot break it, and writes raw tabs plus a sync state. Twenty to thirty seconds later the dashboard is current.",
      screen: {
        kind: "terminal",
        title: "Refresh",
        lines: [
          "$ refresh (button)",
          "convert 3 xlsx → temp sheets · parse by header name",
          "Leads_Raw: 61 rows · Patients_A_Raw: 38 · Patients_B_Raw: 23",
          "linkage via connect column: 99.2% · 2 unlinked → data quality panel",
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
      body: "Every tab, scorecards, history, lead sources, trends, weekly rollup, calls the same metrics module with the same filters. There is no second implementation to drift. When two views show leads for the same week, they are the same function call.",
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
      title: "Data quality is a feature, not a footnote",
      body: "Patients that cannot be linked to a lead surface in their own panel with exactly what to fix in the CRM. The linkage rate stays around 99% because someone can see, weekly, the handful of records that fall out.",
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
      body: "A Python harness recomputes every metric from the raw Excel files and diffs against what the dashboard shows. Boring tech, deliberately: an Apps Script web app plus weekly exports beat a real-time dashboard nobody believed.",
      screen: {
        kind: "terminal",
        title: "Verification harness",
        lines: [
          "$ python verify.py --week 2026-03-03",
          "recompute 6 metrics × 2 clinics from raw xlsx",
          "diff vs dashboard values → 0 mismatches ✓",
          "linkage: 99.2% · unlinked: 2 (listed)",
        ],
      },
    },
  ],
  architecture: [
    { lane: "Ingest", items: ["Weekly Excel exports into one Drive folder", "Drive API converts xlsx to sheets", "Header-name-based parser, order-proof"] },
    { lane: "Model", items: ["Raw tabs + sync state in one spreadsheet", "Lead-patient join via CRM connect column", "One shared metrics module for every view"] },
    { lane: "Present", items: ["Apps Script web app, Workspace-restricted", "6 tabs: scorecards, history, sources, trends, playground, weekly", "Chart.js with prior-year overlays"] },
    { lane: "Trust", items: ["Data quality panel with fix instructions", "Python harness diffs metrics vs raw Excel", "3-minute weekly workflow, 10-minute setup"] },
  ],
  outcome:
    "Leadership reads one set of numbers that agree with themselves and with the raw exports, and the weekly ritual is light enough that it has survived contact with reality. The interesting engineering decision was restraint: swapping a brittle live-API design for a verifiable weekly pipeline raised trust more than any feature could. Clinic names and all figures shown are synthetic stand-ins.",
};
