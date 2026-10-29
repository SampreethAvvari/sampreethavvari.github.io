import type { Architecture } from "../types";
import svg from "../svg/capacity-planner.svg?raw";

const arch: Architecture = {
  slug: "capacity-planner",
  rank: 10,
  name: "Capacity Planner",
  project: "Capacity Planner",
  kind: "system",
  disciplines: ["fde", "sde"],
  post: "/posts/capacity-planner",
  headline: "Syncs Denticon into the planner every minute.",
  tail: "Read only, on Cloud Run and Postgres.",
  lede:
    "A minute sync pulls changed appointments from the CDF mirror into Postgres. One pure engine does all the planning math, the same code on the server and in the browser, so a what if and the real board can never disagree.",
  titleBlock: [
    ["System", "Capacity Planner"],
    ["Revision", "v0.54.0"],
    ["Live since", "Sep 28, 2026"],
    ["Runs on", "Cloud Run, Cloud SQL"],
    ["Region", "us-east1"],
    ["Checked", "360 of 360 cells"],
    ["Backups", "Daily, point in time"],
    ["Rollback", "10 seconds"],
    ["Scale", "1 minute : 1 sync"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "60", unit: "s", label: "from a booking in Denticon to the board", ring: 1 },
    { value: "0", label: "write methods toward Denticon, held by a type test" },
    { value: "17", unit: "days", label: "from the first commit to v0.1.0 in production" },
    // Cloud Run line, GCP billing export Oct 1 to 28 2026 (project-docs/fde-refresh/costs/by-service.csv).
    { value: "$1.29", label: "for Cloud Run in October, a sync every minute included" },
  ],
  svg,
  views: [
    { id: "minute-sync", label: "The minute sync", focus: ["scheduler", "denticon", "cdf", "app", "db"], note: "Every minute the scheduler wakes the app, which reads changed rows from the CDF mirror and writes them to Postgres." },
    { id: "sign-in", label: "Sign in and audit", focus: ["staff", "auth", "board", "app", "db"], note: "Google sign in, two roles, and every change ends in an audit row." },
    { id: "what-if", label: "What if", focus: ["board", "engine", "app"], note: "The same pure engine answers in the browser and on the server, so the two never disagree." },
    { id: "outbound", label: "What it sends", focus: ["app", "workspace"], note: "Reads the doctor calendar and sends the 7 AM task email. Nothing goes back to Denticon." },
  ],
  parts: {
    denticon: {
      kind: "Practice system",
      owner: "outside",
      what: "Denticon is where every appointment really lives. The planner never talks to it directly.",
    },
    cdf: {
      kind: "My service",
      owner: "mine",
      what: "The CDF keeps a mirror of Denticon and serves it over a registry API. It is the only service that holds Denticon credentials, so the planner has none.",
      fails: "If the CDF is slow or down, the sync logs it and still answers 200, and the board shows how old its data is.",
      source: "docs/runbook/incidents.md",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Cloud Scheduler job capacity-sync calls POST /tasks/sync every minute with an OIDC token from a service account that can invoke the app and nothing else. A second job sends the 7 AM task email, Monday to Friday.",
      fails: "Paused or deleted job: the board's freshness pill goes stale and the runbook has the one line to resume it.",
      source: "docs/runbook/operations.md",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "capacity-prod on Cloud Run, Next.js 16 in standalone mode. Server actions carry every change, and each one ends by writing an audit row. It deploys only from a version tag, after a gates job runs lint, types, unit and integration tests.",
      fails: "A bad release rolls back by flipping traffic to the previous revision, about ten seconds. Migrations are additive, so the old code still fits the new schema.",
      source: "docs/runbook/operations.md:60",
    },
    db: {
      kind: "Managed database",
      owner: "managed",
      what: "Cloud SQL Postgres 16 on its own instance, db-g1-small, daily backups with point in time recovery. Drizzle with plain SQL migrations. A partitioned audit table.",
      fails: "Its own instance, so the estimator's connection ceiling can never starve it, and a restore here touches nothing else.",
      source: "docs/architecture/0001-stack-decisions.md",
    },
    board: {
      kind: "My app",
      owner: "mine",
      what: "The board in React 19. It polls a tiny version endpoint every 60 seconds and offers a refresh banner. It never swaps what you are looking at.",
      source: "docs/architecture/0001-stack-decisions.md",
    },
    engine: {
      kind: "My package",
      owner: "mine",
      what: "packages/engine: availability, coverage, cadence projection, bandwidth, gaps and cover suggestions. No database, no network, no clock. Golden tested against the workbook it replaced.",
      source: "packages/engine",
    },
    auth: {
      kind: "Sign in",
      owner: "managed",
      what: "NextAuth v5 with Google, 12 hour database sessions. Only verified hybridgeimplants.com and elmwooddental.com accounts. Two roles, and no grant means viewer.",
      source: "docs/architecture/0001-stack-decisions.md",
    },
    staff: {
      kind: "People",
      owner: "outside",
      what: "The operations lead and the office directors in Rochester, Buffalo and Syracuse. They make every real schedule change in Denticon, by hand.",
    },
    workspace: {
      kind: "Google Workspace",
      owner: "outside",
      what: "Reads the shared doctor calendar as the planner's own account, not mine, and sends the 7 AM task email through Gmail.",
      source: "apps/web/lib/doctorCalendar/google.ts",
    },
  },
  breaks: [
    { title: "Denticon or the CDF is slow", body: "The sync still answers 200, so the scheduler never retries into a storm. A pill on the board says how old the data is.", source: "docs/runbook/incidents.md" },
    { title: "A minute missed a change", body: "Most minutes read only changed rows. A full read at least once an hour heals anything a delta missed.", source: "STATUS.md:12" },
    { title: "A release goes bad", body: "Traffic flips back to the last revision in about ten seconds. Migrations only ever add, so the old code still runs.", source: "docs/runbook/operations.md:60" },
  ],
  tuned: [
    { title: "One engine, two places", body: "The same pure package runs in the sync and in the browser. There is no second copy of a rule to drift.", source: "docs/architecture/0001-stack-decisions.md" },
    { title: "Deltas, not dumps", body: "The first full read was about 12,300 rows. After that, most minutes move only what changed.", source: "STATUS.md:12" },
    { title: "Poll the version, not the data", body: "Open boards ask a tiny endpoint whether anything changed, then offer a refresh. No hot swapping under someone's cursor.", source: "docs/architecture/0001-stack-decisions.md" },
  ],
  guards: [
    { title: "Zero write methods", body: "A type level test fails the build if anything shaped like create, update, cancel or book appears on the Denticon contract.", source: "packages/engine/test/types.test.ts:14" },
    { title: "No Denticon credential here", body: "Only the CDF holds one. This project could not write to Denticon even if it tried.", source: "docs/runbook/README.md" },
    { title: "Patient names stay out of logs", body: "The logger redacts patient fields and the query logger is off everywhere. Fixture tests print counts, never values.", source: "docs/architecture/SECURITY.md:59" },
  ],
  // GCP billing export, account 013C47, Oct 1 to 28 2026, net of credits
  // (project-docs/fde-refresh/costs/by-service.csv).
  cost: {
    total: "$27",
    period: "in October",
    method: "Measured from the Google Cloud billing export, October 1 to 28, net of credits. The always on database is nine tenths of it. A sync every minute, all month, costs $1.29.",
    parts: [
      { label: "Cloud SQL, always on", usd: 24.98 },
      { label: "Cloud Run, per request", usd: 1.29 },
      { label: "Secret Manager", usd: 0.64 },
      { label: "Scheduler and image registry", usd: 0.15 },
    ],
  },
  live: {
    mode: "interval",
    label: "Next sync",
    everySeconds: 60,
    path: ["scheduler", "app", "cdf", "app", "db", "app", "board"],
    source: "Cloud Scheduler job capacity-sync, every minute",
  },
};

export default arch;
