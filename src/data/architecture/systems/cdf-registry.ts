import type { Architecture } from "../types";
import svg from "../svg/cdf-registry.svg?raw";

const arch: Architecture = {
  slug: "cdf-registry",
  rank: 25,
  name: "CDF Registry API",
  project: "CDF Patient Hub",
  kind: "service",
  disciplines: ["sde", "fde"],
  post: "/posts/cdf-registry",
  headline: "Mirrors Denticon for two other apps.",
  tail: "Refreshed every ten minutes.",
  lede:
    "A sync service pulls Denticon into a Firestore mirror, woken by webhooks, a worker every ten minutes and a nightly sweep. The estimator and the capacity planner read that mirror through a small registry API, each with its own bearer secret, and neither of them ever touches Denticon.",
  titleBlock: [
    ["System", "CDF Registry API"],
    ["Revision", "v0.27.0"],
    ["Live since", "Sep 28, 2026"],
    ["Runs on", "Cloud Run, Firestore"],
    ["Region", "us-central1"],
    ["Checked", "14 filters proven"],
    ["Retries", "4 per call, 30 s cap"],
    ["Rollback", "Traffic to last revision"],
    ["Scale", "3 offices : 18 webhooks"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "2.6", unit: "min", label: "how far the mirror trailed Denticon on Sep 21 once the sync ran on a timer, down from 6.0 days", ring: 1 },
    { value: "1", label: "service holds Denticon credentials. Each caller holds only its own bearer" },
    {
      value: "14",
      unit: "days",
      label: "from the first Denticon commit on Sep 15 to reading the live practice on Sep 29",
    },
    { value: "20,111", label: "charts and 22,688 appointments in the first production backfill" },
  ],
  svg,
  views: [
    { id: "mirror-feed", label: "How the mirror stays fresh", focus: ["scheduler", "denticon", "sync", "mirror"], note: "Webhooks say what changed, a worker every ten minutes fetches it, and a nightly sweep catches whatever they missed." },
    { id: "planner-minute", label: "The planner's minute", focus: ["planner", "registry", "mirror"], note: "The capacity planner asks for every row changed since its last watermark, behind its own bearer secret." },
    { id: "estimator-day", label: "The estimator's day", focus: ["estimator", "registry", "mirror", "dashboard"], note: "One local day of the book, joined to patient and doctor names, for the estimator and the CDF day list." },
    { id: "credentials", label: "Where the keys live", focus: ["secrets", "sync", "denticon"], note: "Only the sync service holds Denticon credentials. The registry and every caller hold none." },
  ],
  parts: {
    denticon: {
      kind: "Practice system",
      owner: "outside",
      what: "Denticon, from Planet DDS, is where every chart and booking really lives. Its API has no patient search, so the mirror is the only patient index we have. It ignores a query parameter it does not know and answers 200 with the whole table.",
      source: "docs/plans/2026-09-09-denticon-master-dashboard.md:234",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Three Cloud Scheduler jobs, each carrying a bearer: a sweep at 4 AM New York time, the slice worker every 10 minutes, and a missed slice sweep at twenty past every hour.",
      fails: "If a job stops, the cursors age, and every registry answer and the freshness check report that office as stale rather than fine.",
      source: "docs/deploy.md:637",
    },
    sync: {
      kind: "My service",
      owner: "mine",
      what: "The same image as the dashboard, run as a second Cloud Run service with its own role. It keeps one instance warm because Denticon checks a webhook address by calling it and wants an answer within ten seconds. A webhook is only a pointer, so the worker always fetches the data itself, with credentials.",
      fails: "A 429 or a 5xx from Denticon is retried four times with backoff and jitter, and a retryAfter from the vendor wins. A slice gets three attempts, then is marked failed for the sweeps to pick up.",
      source: "lib/denticon/paging.ts:441",
    },
    secrets: {
      kind: "Managed secrets",
      owner: "managed",
      what: "Secret Manager holds the Denticon client id, client secret and subscription key. They are mounted on the sync service only. The dashboard had its copy taken off in v0.13.0 on Sep 21.",
      source: "infra/cloudbuild-sync.yaml:170",
    },
    mirror: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore collections for offices, providers, patients, appointments, production types and chairs, plus the sync cursors and slices. Every write is keyed on the record id, so a double delivery is harmless.",
      source: "lib/denticon/slice-worker.ts:21",
    },
    registry: {
      kind: "My API",
      owner: "mine",
      what: "Five bearer secured GET routes on the CDF dashboard service. The estimator gets one day of the book; the capacity planner gets the book by window or by change, providers, production types and chairs. It reads Firestore only and never calls Denticon.",
      fails: "On the planner's routes an unknown office is a 400, because a dropped office would read as an empty calendar and the planner cancels what it does not see. A window over 10,000 rows answers 413.",
      source: "lib/registry/shared.ts:34",
    },
    planner: {
      kind: "My service",
      owner: "mine",
      what: "The capacity planner's minute sync asks for the rows the mirror wrote since its last watermark, plus the provider list. It holds no Denticon credential and never calls Planet DDS.",
      source: "lib/registry/README.md",
    },
    estimator: {
      kind: "My service",
      owner: "mine",
      what: "The treatment estimator's landing page reads one local day of the book, joined to patient and doctor names, with consultations flagged by the scheduler's own visit types.",
      source: "lib/registry/schedule.ts",
    },
    freshness: {
      kind: "Health check",
      owner: "mine",
      what: "Judges all twelve sync cursors and reports a missing cursor as missing, not as fine. It answers to a bearer and sits outside the login redirect, so a monitor can never go green on a 307 to a sign in page.",
      source: "lib/denticon/freshness.ts",
    },
    dashboard: {
      kind: "My app",
      owner: "mine",
      what: "The CDF Patients list reads the same day of the book through the registry's own code: every visit, plus the intakes submitted that day.",
      source: "docs/HANDOFF.md:449",
    },
  },
  breaks: [
    { title: "A webhook never arrives", body: "The sweep at twenty past each hour lists slices whatever the receiver did, and the 4 AM sweep polls everything changed. A lost webhook delays data; it does not lose it.", source: "docs/runbook-denticon-cutover.md:392" },
    { title: "Denticon rate limits us", body: "429s and 5xx retry four times from a 500 ms base, capped at 30 seconds, with jitter. Four instances at most, so we never outrun the vendor.", source: "lib/denticon/paging.ts:441" },
    { title: "The mirror falls behind", body: "Every registry answer carries each office's cursor health, judged the same way as the freshness check, so a caller can show old data as old.", source: "lib/registry/shared.ts:62" },
  ],
  tuned: [
    { title: "Webhooks first, poll as net", body: "Webhooks carry the load and a nightly poll is the safety net. I decided against a one minute poller against Denticon.", source: "docs/HANDOFF.md:232" },
    { title: "Changes, not whole months", body: "The planner asks for rows written since its watermark, minus an overlap longer than the ten minute sync lease. A window read is capped at 31 days.", source: "lib/registry/README.md" },
    { title: "One warm instance", body: "Minimum one, so Denticon's ten second webhook check never meets a cold start. Maximum four, so the sync stays under the vendor's rate limits.", source: "infra/cloudbuild-sync.yaml:168" },
  ],
  guards: [
    { title: "One holder of the keys", body: "Only this repo holds Denticon credentials, and only the sync service mounts them. No other repo gets its own, not even as a fallback.", source: "docs/HANDOFF.md:225" },
    { title: "A secret per caller", body: "The estimator and the planner each have their own bearer, compared in constant time, trimmed, and closed when unset. Revoking one does not blind the other.", source: "lib/registry/auth.ts:36" },
    { title: "Proven filters only", body: "A query parameter not on the proven list throws before the request leaves. Proven means totalCount changed, not that the call returned 200.", source: "lib/denticon/paging.ts:121" },
  ],
  // hybridge-assessment-dev is not measured: its billing export has 0 rows
  // (enabled 2026-10-28). project-docs/fde-refresh/costs/by-project.csv
  cost: null,
  live: {
    mode: "interval",
    label: "Next slice run",
    everySeconds: 600,
    path: ["scheduler", "sync", "denticon", "sync", "mirror"],
    source: "Cloud Scheduler job denticon-slice-worker, every 10 minutes",
  },
};

export default arch;
