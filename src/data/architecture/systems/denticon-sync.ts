import type { Architecture } from "../types";
import svg from "../svg/denticon-sync.svg?raw";

const arch: Architecture = {
  slug: "denticon-sync",
  rank: 24,
  name: "Denticon Sync",
  project: "CDF Patient Hub",
  kind: "service",
  disciplines: ["sde", "fde"],
  post: "/posts/denticon-sync",
  headline: "Mirrors Denticon for every app.",
  tail: "Webhooks first, nightly poll behind.",
  lede:
    "When a record changes, Denticon posts a pointer; the receiver saves it and answers inside ten seconds, and a worker every ten minutes fetches the slice with the only Denticon credentials we hold. A 4 AM sweep polls everything changed since each office's cursor, which catches any webhook that went missing.",
  titleBlock: [
    ["System", "Denticon sync"],
    ["Revision", "the CDF image"],
    ["Live since", "Sep 21, 2026"],
    ["Runs on", "Cloud Run"],
    ["Region", "us-central1"],
    ["Instances", "1 warm, 4 max"],
    ["Wakes", "10 min, :20, 4 AM"],
    ["Retries", "4 a call, 3 a slice"],
    ["Scale", "1 webhook : 0 bytes trusted"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "2.6", unit: "min", label: "how far the mirror trailed Denticon once the sync ran on a timer on Sep 21, down from 6.0 days", ring: 1 },
    { value: "0", unit: "bytes", label: "of a webhook body kept as data. It is a pointer, and the worker fetches the record itself" },
    { value: "6", unit: "days", label: "from the first Denticon commit on Sep 15 to the sync service live on Sep 21" },
    { value: "4", unit: "services", label: "read the mirror: the CDF, the estimator and the planner through the registry, and the report renderer" },
  ],
  svg,
  views: [
    { id: "push", label: "Pushed: a webhook", focus: ["pipeline", "receiver", "slices", "worker", "api", "mirror"], note: "Denticon says a slice is ready. The receiver saves the pointer and answers; the worker fetches the slice itself and upserts it." },
    { id: "poll", label: "Polled: the safety net", focus: ["scheduler", "worker", "api", "mirror"], note: "At 4 AM the sweep asks Denticon for everything changed since each cursor, and at twenty past each hour it lists slices a webhook missed." },
    { id: "keys", label: "Where the keys live", focus: ["receiver", "worker", "api"], note: "Only the worker side holds Denticon credentials. The receiver needs none, and no other service has any." },
    { id: "health", label: "Is it still fed", focus: ["mirror", "freshness", "registry"], note: "Every expected cursor is judged, a missing one worst of all, and every registry answer carries the same health." },
  ],
  parts: {
    pipeline: {
      kind: "Practice system",
      owner: "outside",
      what: "Denticon's data pipeline sends a notification when a slice of changed records is ready. Three offices times six record types is eighteen subscriptions, live since Sep 29. A notification carries an office, a record type and a pointer, never patient data.",
      source: "lib/denticon/subscriptions.ts:70",
    },
    receiver: {
      kind: "My route",
      owner: "mine",
      what: "Saves the pointer and answers 200. It does not fetch, authenticate to Denticon or read the body as data, because Denticon checks a webhook address by calling it and wants a reply within ten seconds. A late reply means the subscription is never created.",
      fails: "It answers 200 even when Firestore is down. A dropped pointer is found again by the hourly sweep; a failed subscription would be a phone call to the vendor.",
      source: "app/api/denticon/slices/[secret]/route.ts:49",
    },
    slices: {
      kind: "Managed database",
      owner: "managed",
      what: "One Firestore document per pointer: pending, processing, applied or failed. A worker claims a slice under a ten minute lease, so a deploy or a scale down that kills it mid slice never parks the slice for good.",
      source: "lib/denticon/slice-worker.ts:78",
    },
    worker: {
      kind: "My service",
      owner: "mine",
      what: "The same image as the CDF dashboard, run as a second Cloud Run service with one warm instance and four at most. Its worker route takes up to ten slices a run and applies their rows through the same mappers the nightly poll uses; its sync route is the 4 AM sweep. It is the only service with the Denticon client id, secret and subscription key.",
      fails: "Every Denticon call retries a 429 or a 5xx four times, from 500 ms up to 30 seconds with jitter, and waits for the vendor's own retryAfter when it sends one.",
      source: "infra/cloudbuild-sync.yaml:168",
    },
    mirror: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore collections for patients, appointments, offices, providers, visit types and chairs, plus the sync cursors. Every write merges on the record's own id, so a webhook and the poll delivering the same change is harmless, and the arrival order changes nothing.",
      source: "lib/denticon/slice-worker.ts:21",
    },
    api: {
      kind: "Practice system",
      owner: "outside",
      what: "Denticon's API, from Planet DDS. A sixty minute token with a read scope, minted from the client credentials the worker holds. It is the only place the slice data and the changed since poll come from.",
      source: "lib/denticon/README.md",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Three jobs, each with a bearer: the slice worker every ten minutes, a sweep at twenty past each hour that lists slices a webhook never announced, and the 4 AM New York sweep that polls patients, appointments, offices, providers, visit types and chairs.",
      fails: "Cloud Scheduler retries a failed call with backoff. If a job stops, the cursors age and the freshness check reports that office as stale.",
      source: "docs/deploy.md:637",
    },
    registry: {
      kind: "My API",
      owner: "mine",
      what: "The CDF's read only routes. The estimator reads one day of the book and the capacity planner reads what changed, each with its own bearer. Neither holds a Denticon credential.",
      source: "lib/registry/README.md",
    },
    freshness: {
      kind: "Health check",
      owner: "mine",
      what: "Starts from the twelve cursors it expects, three offices times four resources, and reports one with no document as missing, the worst status. A run holding a lease past its threshold reads as quiet, because the question is whether data arrives.",
      source: "lib/denticon/freshness.ts:23",
    },
  },
  breaks: [
    { title: "A webhook never arrives", body: "The sweep at twenty past each hour lists every slice the vendor holds, whatever the receiver saw, and the 4 AM poll reads everything changed. Slices are kept seven days, so there is time.", source: "lib/denticon/subscriptions.ts:401" },
    { title: "Denticon rate limits us", body: "Four attempts from a 500 ms base, capped at 30 seconds, with jitter, and four instances at most so a burst cannot outrun the vendor.", source: "lib/denticon/paging.ts:440" },
    { title: "A slice keeps failing", body: "Three attempts, then it stays failed with a short error slug for a person. A slice that failed three times will not start working, and retrying it starves the ones that would.", source: "lib/denticon/subscriptions.ts:290" },
  ],
  tuned: [
    { title: "Answer first, work later", body: "The receiver only saves a pointer. Fetching, mapping and writing happen in the worker, far from Denticon's ten second reply window.", source: "app/api/denticon/slices/[secret]/route.ts:16" },
    { title: "One warm instance", body: "Minimum one, so a webhook check never meets a cold start. Maximum four, because a worker is not a request server and the vendor's limits are undocumented.", source: "infra/cloudbuild-sync.yaml:168" },
    { title: "One image, never rebuilt", body: "The sync service deploys an image the dashboard pipeline already built. Both run provably the same container, and the credentials decide which routes can work.", source: "infra/cloudbuild-sync.yaml:46" },
  ],
  guards: [
    { title: "Keys on one service", body: "The Denticon credentials are mounted on this service only. The dashboard has none, so its copies of these routes cannot reach the vendor even if called.", source: "infra/cloudbuild-sync.yaml:52" },
    { title: "A webhook is a hint", body: "Nothing in a notification is stored as data or picks a code path. The worst a bad one can do is one extra authenticated fetch of a slice that is ours.", source: "app/api/denticon/slices/[secret]/route.ts:39" },
    { title: "Deletes leave a mark", body: "A Delete slice marks the mirror document deleted upstream. A chart that vanished while another record points at it would be worse than one that says what happened.", source: "lib/denticon/slice-worker.ts:31" },
  ],
  // hybridge-assessment-dev is not measured: its billing export has 0 rows
  // (enabled 2026-10-28). project-docs/fde-refresh/costs/by-project.csv
  cost: null,
  // Confirmed with `gcloud scheduler jobs list --project=hybridge-assessment-dev
  // --location=us-central1` on 2026-10-29: denticon-slice-worker */10 * * * * UTC.
  live: {
    mode: "interval",
    label: "Next slice run",
    everySeconds: 600,
    path: ["scheduler", "worker", "slices", "worker", "api", "worker", "mirror"],
    source: "Cloud Scheduler job denticon-slice-worker, every 10 minutes",
  },
};

export default arch;
