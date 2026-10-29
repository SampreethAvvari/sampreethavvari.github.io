import type { Architecture } from "../types";
import svg from "../svg/treatment-estimator.svg?raw";

const arch: Architecture = {
  slug: "treatment-estimator",
  rank: 30,
  name: "Treatment Estimator",
  project: "Treatment Estimator",
  kind: "system",
  disciplines: ["sde", "fde"],
  post: "/posts/treatment-estimator",
  headline: "Prices quotes from each office's price book.",
  tail: "Saved lines keep their price.",
  lede:
    "Coordinators build options in a workspace, and the pricing engine prices every line from the office's published price book. The save writes the price, tier, label and book version onto each line, and the PDF, the Excel and every total read those back.",
  titleBlock: [
    ["System", "Treatment Estimator"],
    ["Revision", "v1.56.0"],
    ["Live since", "May 8, 2026"],
    ["Runs on", "Cloud Run, Cloud SQL"],
    ["Region", "us-east1"],
    ["Sessions", "12 hours"],
    ["Backups", "30 daily, point in time"],
    ["Rollback", "10 seconds"],
    ["Scale", "$1 : 100 integer cents"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "14.5", unit: "hours", label: "from the first commit to v1.0.0" },
    { value: "4", unit: "fields", label: "frozen on every saved line: price, tier, label and price book version" },
    // Aug 19: commit 8ea3b71 at 4:58 AM for a coordinator's ask, tag v1.14.0 at 5:03 AM.
    { value: "5", unit: "min", label: "from a 4:58 AM fix for a coordinator's ask to shipping it as v1.14.0" },
    { value: "3", unit: "offices", label: "each with its own versioned price book; only an admin can publish a change" },
  ],
  svg,
  views: [
    { id: "quote", label: "Build and price a quote", focus: ["staff", "auth", "workspace", "app", "pricing", "db"], note: "A coordinator builds options, the engine prices each line from the office's book, and the save writes that price onto the line." },
    { id: "print", label: "Print what was quoted", focus: ["db", "app", "exports"], note: "PDF and Excel read the price stored on each line, so a later price change never reaches a saved quote." },
    { id: "schedule", label: "Today's consults", focus: ["cdf", "app", "workspace"], note: "The front page asks the CDF for the day's consults with its own secret. No secret means an empty day, never sample names." },
    { id: "ship", label: "Ship a release", focus: ["actions", "db", "app"], note: "A v tag builds the image, runs migrations and the fee scripts through the Cloud SQL proxy, then deploys." },
  ],
  parts: {
    staff: {
      kind: "People",
      owner: "outside",
      what: "Treatment coordinators and doctors at Rochester, Buffalo and Syracuse. A coordinator builds the estimate during the consult, downloads the PDF and sends it from their own inbox.",
      source: "docs/architecture/0001-stack-decisions.md",
    },
    auth: {
      kind: "Sign in",
      owner: "managed",
      what: "Auth.js v5 with Google, sessions stored in Postgres for 12 hours. Only verified accounts on the two practice domains get in, and an account with no grant is read only.",
      source: "lib/auth/guards.ts:29",
    },
    workspace: {
      kind: "My app",
      owner: "mine",
      what: "A three pane, drag and drop workspace where options, phases and scenarios get built, the default since August. It opens on the day's consults, and one click opens that patient's estimate.",
      source: "components/workspace",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "estimator-prod on Cloud Run, Next.js 16 standalone, 1 CPU and 512 MiB, zero to five instances. Server actions carry every change, and each one writes an audit row.",
      fails: "A bad release rolls back by moving traffic to the previous revision, about ten seconds.",
      source: "docs/runbook/incidents.md:40",
    },
    cdf: {
      kind: "My service",
      owner: "mine",
      what: "The CDF holds the Denticon mirror and the only Denticon credentials. The estimator asks it for the day's consults with one bearer secret, and the CDF reads a read only patient lookup back with a different one, so revoking one never blinds the other.",
      fails: "Slower than 8 seconds or not configured: the page shows an empty day and says why. Production never shows sample names.",
      source: "lib/schedule/registry.ts:83",
    },
    actions: {
      kind: "Deploy pipeline",
      owner: "managed",
      what: "A v tag starts the deploy behind a GitHub approval gate. It signs in to Google with workload identity and no stored key, builds the image, runs migrations and the one shot data scripts through the Cloud SQL proxy, then deploys.",
      source: ".github/workflows/deploy-prod.yaml:13",
    },
    db: {
      kind: "Managed database",
      owner: "managed",
      what: "Cloud SQL Postgres 16, db-g1-small, zonal and always on, with 30 daily backups and point in time recovery. Every saved line keeps its price, tier, label and price book version.",
      fails: "Zonal, so a zone outage means a point in time restore to a new instance, not a failover.",
      source: "docs/runbook/incidents.md:286",
    },
    exports: {
      kind: "My code",
      owner: "mine",
      what: "PDF and Excel built on the server from the stored lines, never from the live book. The office's logo, the workup listed first, and each option kept whole on a page.",
      source: "lib/pdf/loader.ts:171",
    },
    sequence: {
      kind: "My package",
      owner: "mine",
      what: "The treatment sequence engine and builder, vendored from their own repo as a committed snapshot. It picks one of 11 transcribed practice masters and fills in the real teeth.",
      source: "vendor/sequence/README.md",
    },
    pricing: {
      kind: "My code",
      owner: "mine",
      what: "Path strategies for Hybridge, denture and conventional work, and one resolver for five pricing models: flat, tiered, tiered by zone, price range and per surface. A sixth model fails the build until the resolver prices it.",
      source: "lib/pricing/resolver.ts:92",
    },
  },
  breaks: [
    { title: "A release goes bad", body: "Traffic moves back to the previous revision in about ten seconds. The prior revision stays warm for exactly this.", source: "docs/runbook/incidents.md:40" },
    { title: "The CDF is slow or unset", body: "After 8 seconds the coordinator gets their screen back with an empty day and a reason. Production never fills it with sample names.", source: "lib/schedule/registry.ts:83" },
    { title: "The database zone fails", body: "Restore to a new instance from point in time recovery, point the secret at it, redeploy. The runbook's target is 5 to 10 minutes.", source: "docs/runbook/incidents.md:286" },
  ],
  tuned: [
    { title: "Code for flow, rows for prices", body: "The decision tree is TypeScript with tests. Each office's prices are versioned rows with their own approval, so an office can change a price without a deploy.", source: "docs/architecture/0001-stack-decisions.md:182" },
    { title: "Scale to zero", body: "Cloud Run runs zero to five instances and bills per request. October 1 to 28 cost 14 cents of Cloud Run.", source: ".github/workflows/deploy-prod.yaml:141" },
    { title: "The arch follows the options", body: "Nobody picks Upper, Lower or Both anymore. The arch is set from the options inside every save and delete transaction.", source: "lib/summary/archSync.ts" },
  ],
  guards: [
    { title: "Prices frozen on each line", body: "Four columns on every saved line: price, tier, label and price book version. Totals, PDF and Excel read those back, never the live book.", source: "lib/db/schema/estimate.ts:138" },
    { title: "Reopen moves, never copies", body: "Reopening moves the live rows to the next revision, so payments still point at the right lines. The update is guarded on status and revision, so two clicks cannot both move them.", source: "app/_actions/estimate.ts:672" },
    { title: "No grant means read only", body: "A new account lands as a viewer and can write nothing until someone grants a role. It fails closed.", source: "lib/auth/guards.ts:29" },
  ],
  // GCP billing export, account 013C47, Oct 1 to 28 2026, net of credits
  // (project-docs/fde-refresh/costs/by-service.csv).
  cost: {
    total: "$34",
    period: "in October",
    method: "Measured from the Google Cloud billing export, October 1 to 28, net of credits. The always on database is almost all of it, $23.45 of that for the instance alone. The app itself scales to zero between consults.",
    parts: [
      { label: "Cloud SQL, always on", usd: 33.20 },
      { label: "Secret Manager", usd: 0.39 },
      { label: "Image registry", usd: 0.15 },
      { label: "Cloud Run, per request", usd: 0.14 },
    ],
  },
  live: {
    mode: "event",
    label: "A coordinator saves an option",
    everySeconds: 14,
    path: ["staff", "workspace", "app", "pricing", "app", "db", "app", "workspace"],
    source: "a coordinator pressing Save on an option, which runs a server action",
  },
};

export default arch;
