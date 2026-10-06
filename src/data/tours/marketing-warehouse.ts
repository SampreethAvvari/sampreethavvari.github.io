import type { Tour } from "./types";

export const marketingWarehouse: Tour = {
  slug: "marketing-warehouse",
  name: "Marketing Warehouse",
  tail: "Five platforms in one place a model can read.",
  post: "/posts/marketing-warehouse",
  cover: "/marketing-warehouse.png",
  kicker: "Data platform · LLM-ready analytics",
  accent: "#F5A524",
  accentRgb: "245, 165, 36",
  pitch:
    "A BigQuery warehouse that pulls five ad and CRM platforms into one place every morning and joins ad spend all the way through to booked patients, with a self-documenting catalog that lets an LLM answer marketing questions in plain English, and weekly graded evals to prove it keeps doing so.",
  problem:
    "Marketing questions like which channel actually produces patients, not clicks, required manually exporting from five platforms and stitching spreadsheets. And once an LLM was allowed to answer questions over the data, a harder problem appeared: how do you know its answers stay right as the schema evolves?",
  metrics: [
    { label: "Sources unified", value: "5", sub: "search ads, social ads, call tracking, CRM, and more" },
    { label: "Funnel linkage", value: "98.5%", sub: "patients joined to leads; 99.5% agreement vs exports" },
    { label: "LLM evals", value: "22 golden Qs", sub: "weekly graded run, fails under 80%" },
    { label: "Running cost", value: "$5 to 15/mo", sub: "serverless jobs + BigQuery" },
  ],
  concepts: ["Dimensional modeling", "LLM-over-SQL", "Golden-question evals", "Drift detection", "Self-documenting schemas", "Freshness monitoring"],
  stack: ["Python", "BigQuery", "Cloud Run Jobs", "Cloud Scheduler", "MCP Toolbox", "Looker Studio", "Docker"],
  steps: [
    {
      title: "Five connectors, one morning sync",
      body: "Cloud Scheduler fires the connector jobs at 6 AM: search ads, social ads, call tracking, and the CRM, with one platform arriving via BigQuery Data Transfer. All connectors share retry, load, and secret code, packaged as a single container image run as serverless jobs.",
      screen: {
        kind: "table",
        title: "Nightly runs",
        headers: ["Source", "Rows", "Status", "Finished"],
        rows: [
          ["Search ads (Platform A)", "1,204", { text: "ok", tone: "good" }, "06:04"],
          ["Social ads (Platform B)", "912", { text: "ok", tone: "good" }, "06:06"],
          ["Call tracking", "388", { text: "ok", tone: "good" }, "06:07"],
          ["CRM boards", "2,730", { text: "ok", tone: "good" }, "06:11"],
          ["Search ads (transfer)", "·", { text: "managed transfer", tone: "dim" }, "06:15"],
        ],
      },
    },
    {
      title: "A sentinel that emails before anyone notices",
      body: "At 6:45 the ops job checks every table's freshness and runs a z-score drift sentinel over daily volumes. A source that silently stopped syncing, or a metric that jumped three standard deviations, emails an alert before the morning meeting reads a stale number.",
      screen: {
        kind: "table",
        title: "Drift log",
        headers: ["Metric", "z-score", "Threshold", "Flagged"],
        rows: [
          ["calls_per_day", "+1.2", "|z| > 3", { text: "no", tone: "good" }],
          ["leads_per_day", "−0.4", "|z| > 3", { text: "no", tone: "good" }],
          ["spend_per_day (Platform B)", "+3.6", "|z| > 3", { text: "Alert emailed", tone: "bad" }],
        ],
      },
    },
    {
      title: "Raw to staging to marts",
      body: "Views build the classic layers, and every view and column carries an inline description that survives every reapply. The catalog table, data_guide, is written for a machine reader: it is the first thing any LLM consults before writing SQL.",
      screen: {
        kind: "terminal",
        title: "marts.data_guide (excerpt)",
        lines: [
          "cost_per_outcome: spend joined to leads, consults and accepted",
          "  treatment by channel and clinic. Grain: month × clinic × channel.",
          "lead_to_patient_funnel: one row per lead with linkage flags.",
          "  98.5% of patients link; unlinked rows carry a reason column.",
        ],
      },
    },
    {
      title: "Ask in plain English",
      body: "Analysts and leadership query through an LLM wired to the warehouse via MCP, or through dashboards. Because the guide describes grains, joins, and caveats, the model writes correct SQL instead of plausible SQL.",
      screen: {
        kind: "search",
        query: "What did a booked patient cost us per search channel last full month?",
        answer:
          "Clinic A search: $190 per lead, $1,320 per booked patient. Clinic B search: $350 per lead, $2,140 per booked patient. Social runs notably higher everywhere. Figures are synthetic; computed from marts.cost_per_outcome at month × clinic × channel grain.",
        citations: [
          { doc: "marts.cost_per_outcome", snippet: "grain: month × clinic × channel · spend joined through lead linkage" },
          { doc: "marts.lead_to_patient_funnel", snippet: "98.5% linkage · unlinked rows excluded and counted" },
        ],
      },
    },
    {
      title: "Evals keep the LLM honest",
      body: "Every Monday, a job replays 22 golden questions against the live warehouse and grades the answers. Under 80% pass fails the run and emails out. The first run scored 77%, which is the point: the gaps became guide fixes, and the score is real, not decorative.",
      screen: {
        kind: "bars",
        title: "Weekly eval scorecard",
        bars: [
          { label: "Week 1 (first run)", value: 77, max: 100, tone: "warn" },
          { label: "Week 2 (guide fixes)", value: 86, max: 100, tone: "good" },
          { label: "Week 3", value: 91, max: 100, tone: "good" },
        ],
      },
    },
    {
      title: "Anyone can check the pipes",
      body: "A glass-styled monitoring app shows each source as a node with health glow, plain-language popups on click, nightly run history, eval results, and live connection tests, built so a non-engineer can answer did last night work without asking one.",
      screen: {
        kind: "cards",
        title: "Pipeline monitor",
        cards: [
          { name: "Search ads", lines: ["last sync 06:04 · fresh"], badge: "healthy", highlight: true },
          { name: "Social ads", lines: ["last sync 06:06 · fresh"], badge: "healthy" },
          { name: "Call tracking", lines: ["last sync 06:07 · fresh"], badge: "healthy" },
          { name: "CRM", lines: ["last sync 06:11 · fresh"], badge: "healthy" },
          { name: "Evals", lines: ["last run 91% · gate 80%"], badge: "passing" },
        ],
      },
    },
  ],
  architecture: [
    { lane: "Ingest", items: ["5 connectors, one Docker image, Cloud Run jobs", "Shared retry, load and secret modules", "6 AM schedule + managed transfer"] },
    { lane: "Warehouse", items: ["BigQuery: raw → staging → marts (+ evals dataset)", "Inline descriptions on every view and column", "data_guide catalog written for LLM readers"] },
    { lane: "Consume", items: ["LLM access via MCP Toolbox", "Looker Studio dashboards", "Plain-English answers with mart citations"] },
    { lane: "Trust", items: ["6:45 freshness check + z-score drift sentinel", "22 golden questions graded weekly, 80% gate", "Glass monitoring app with per-node health"] },
  ],
  outcome:
    "Marketing spend, calls, leads, and booked patients live in one queryable place with 98.5% linkage, validated at 99.5% agreement against the manual exports it replaced, for five to fifteen dollars a month. The part worth stealing: treating the LLM's access as a product surface with its own weekly, graded, gated eval suite instead of assuming yesterday's good answers persist. All dollar figures shown are synthetic.",
};
