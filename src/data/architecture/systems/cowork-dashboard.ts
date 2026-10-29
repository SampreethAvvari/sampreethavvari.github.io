import type { Architecture } from "../types";
import svg from "../svg/cowork-dashboard.svg?raw";

const arch: Architecture = {
  slug: "cowork-dashboard",
  rank: 120,
  name: "Cowork Dashboard",
  project: "Cowork Dashboard",
  kind: "system",
  disciplines: ["fde"],
  post: "/posts/cowork-dashboard",
  headline: "Turns Monday boards into a dashboard.",
  tail: "Cash flow refreshes at 6 AM.",
  lede:
    "Weekly board exports in Drive and a 6 AM read of the three patient boards become one immutable snapshot in Cloud Storage. The browser pins that snapshot and computes every tab from one metric registry, where a card counts its own drilldown rows.",
  titleBlock: [
    ["System", "Cowork Dashboard"],
    ["Revision", "unversioned"],
    ["Live since", "Sep 2, 2026"],
    ["Runs on", "Cloud Run, Cloud Storage"],
    ["Region", "us-central1"],
    ["Checked", "Parity with the old build"],
    ["Access", "9 accounts, behind IAP"],
    ["Rollback", "One pointer rewrite"],
    ["Scale", "1 metric : 1 copy"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "17", unit: "ms", label: "for the multi year Weekly tab, down from about 5.2 seconds" },
    { value: "45 of 45", label: "stored snapshot checks the cash flow pace rebuild matched exactly before it shipped" },
    // Previous post and project-docs/05-cowork-dashboard.md (decision 2026-06-12).
    { value: "~$460K", label: "of patient value on 25 retreatment cases no lead pointed at, found by fixing the join" },
    { value: "18", unit: "min", label: "from the finance lead's request in the Feature requests tab to it live, Oct 28" },
  ],
  svg,
  views: [
    { id: "morning-read", label: "The 6 AM read", focus: ["scheduler", "ingest", "monday", "snapshots", "web"], note: "The first five minute check after 6 AM, or Refresh now, reads the three patient boards and swaps them into the current snapshot." },
    { id: "weekly", label: "The weekly exports", focus: ["monday", "drive", "ingest", "snapshots"], note: "Four board exports land in Drive. Nothing rebuilds until all four have changed." },
    { id: "one-number", label: "One number, one definition", focus: ["snapshots", "web", "ui", "core"], note: "The browser pins one snapshot and computes every tab with the core package. A card counts its own drilldown rows." },
    { id: "requests", label: "Ask for a change", focus: ["iap", "ui", "web", "relay"], note: "The Feature requests tab goes through cowork-web to Launchpad with the person IAP verified." },
  ],
  parts: {
    monday: {
      kind: "Work boards",
      owner: "outside",
      what: "Monday holds the Leads board and one patient board each for Rochester, Buffalo and Syracuse. The practice works in it all day. The dashboard only reads it.",
      fails: "If Monday is unreachable at six, nothing publishes and the next five minute check tries again.",
      source: "packages/core/src/config.ts:68",
    },
    drive: {
      kind: "Shared folder",
      owner: "managed",
      what: "Once a week the four boards are exported and dropped here. The ingest reads the folder as its own service account and spots a changed file by its checksum.",
      source: "packages/ingest/src/ingest.ts:9",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Cloud Scheduler job cowork-ingest-check calls the ingest every five minutes with an OIDC token. The first check at or after 6 AM New York also reads Monday.",
      fails: "The check answers 200 even on an error. The scheduler never retries in a loop, and the error goes to the log.",
      source: "packages/ingest/src/index.ts:37",
    },
    ingest: {
      kind: "My service",
      owner: "mine",
      what: "cowork-ingest on Cloud Run, private, at most three instances. It rebuilds when all four exports have changed, joins patients to leads, and writes a snapshot named by a hash of its inputs. The daily read swaps fresh patient boards into the current snapshot and leaves the weekly data alone.",
      fails: "A file that fails to parse stops the build before the pointer moves. The dashboard keeps serving the last good snapshot.",
      source: "packages/ingest/src/ingest.ts:147",
    },
    snapshots: {
      kind: "Managed storage",
      owner: "managed",
      what: "Cloud Storage keeps every snapshot, immutable, about 0.4 MB gzipped. One small pointer file names the current one and is written last.",
      fails: "A failed build never moves the pointer. Rollback is pointing it at an older snapshot.",
      source: "packages/ingest/src/store.ts:8",
    },
    web: {
      kind: "My service",
      owner: "mine",
      what: "cowork-web on Cloud Run. It streams the snapshot through itself, passes Refresh now to the ingest with its own ID token, and relays the Feature requests tab.",
      fails: "If the relay cannot be reached, the tab answers 502 and the rest of the dashboard keeps working.",
      source: "packages/web/src/server.ts:99",
    },
    iap: {
      kind: "Sign in",
      owner: "managed",
      what: "Identity Aware Proxy admits only accounts granted one at a time, nine today. The Feature requests route also verifies the header IAP signs before it names anyone to Launchpad.",
      source: "packages/web/src/iap.ts:71",
    },
    ui: {
      kind: "My app",
      owner: "mine",
      what: "Nine tabs, from Dashboard and Weekly to Cash flow and Feature requests. The browser downloads one snapshot, pins it for the session and computes every tab locally. A poll each minute finds newer data and shows a banner, and the numbers change on a click.",
      source: "packages/web/src/runtime.ts:8",
    },
    relay: {
      kind: "My service",
      owner: "mine",
      what: "Launchpad's request relay, in another Google Cloud project, keeps one list of feature requests for every Hybridge app. cowork-web calls it with its own Google ID token and the person IAP verified.",
      source: "packages/web/src/feature-requests.ts:1",
    },
    core: {
      kind: "My package",
      owner: "mine",
      what: "packages/core: parsing, the patient to lead join, the metric registry and every aggregation. The same compiled code runs in the ingest and in the browser. Each metric is defined once.",
      source: "packages/core/src/metrics.ts:333",
    },
  },
  breaks: [
    { title: "Monday is down at six", body: "The read throws and nothing publishes. The dashboard keeps the last good boards and the next five minute check tries again.", source: "packages/ingest/src/ingest.ts:240" },
    { title: "Exports arrive one at a time", body: "Nothing rebuilds until all four files have changed. A half dropped set never reaches the page.", source: "packages/ingest/src/ingest.ts:131" },
    { title: "A refresh lands mid read", body: "The daily read publishes only onto the pointer it started from. If a Refresh now published first, the daily read steps aside.", source: "packages/ingest/src/ingest.ts:261" },
  ],
  tuned: [
    { title: "Ask Monday for less", body: "The read asks only for the columns the dashboard uses. Every column took 104 seconds across the three boards. This takes about 45.", source: "packages/ingest/src/monday.ts:10" },
    { title: "Sorted date indexes", body: "Every tab computes in the browser against sorted date indexes. The multi year Weekly tab went from about 5.2 seconds to about 17 milliseconds.", source: "README.md" },
    { title: "Read the history once", body: "The pace reads each board's full activity log once, about two minutes, and caches it. Each daily read then fetches two days, about a second.", source: "packages/ingest/src/history.ts:5" },
  ],
  guards: [
    { title: "The card counts its rows", body: "Each metric is defined once and the card number is computed from its drilldown rows. A test checks that for every metric across ranges and locations.", source: "packages/core/test/metrics.test.ts:59" },
    { title: "Figures from production", body: "A golden test asserts numbers read off the running old dashboard. It caught a one day shift on 948 dates that the parity test missed.", source: "packages/core/test/golden.test.ts:103" },
    { title: "Only the signed header", body: "The person comes from the header IAP signs, checked against Google's keys and this service's audience. The unsigned email header is never read.", source: "packages/web/src/iap.ts:71" },
  ],
  // hybridge-cowork's billing export (account 0122AD) was enabled on Oct 28 2026
  // and has 0 rows (project-docs/fde-refresh/costs/by-project.csv). Not measured.
  cost: null,
  // gcloud scheduler jobs list --project hybridge-cowork --location us-central1:
  // cowork-ingest-check, */5 * * * *, America/New_York. The first check at or
  // after LIVE_REFRESH_HOUR = 6 reads Monday (packages/core/src/config.ts:81,
  // packages/ingest/src/live.ts:28).
  live: {
    mode: "daily",
    label: "Next board read",
    at: "06:00",
    path: ["scheduler", "ingest", "monday", "ingest", "snapshots", "web", "ui"],
    source: "Cloud Scheduler job cowork-ingest-check, every 5 minutes; the first check at or after 6 AM reads Monday",
  },
};

export default arch;
