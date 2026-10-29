import type { Architecture } from "../types";
import svg from "../svg/feature-requests.svg?raw";

const arch: Architecture = {
  slug: "feature-requests",
  rank: 112,
  name: "Feature request relay",
  project: "Launchpad",
  kind: "service",
  disciplines: ["sde", "fde"],
  post: "/posts/feature-requests",
  headline: "Collects requests from six apps.",
  tail: "Each one pings Google Chat.",
  lede:
    "Six Hybridge apps serve the same request screen and forward each call to launchpad-requests with their own Google ID token and the person they signed in. The relay saves one record per request in Firestore under an FR number that never changes, keeps pasted files in a private bucket, and pings one Google Chat space.",
  titleBlock: [
    ["System", "launchpad-requests"],
    ["Revision", "unversioned"],
    ["Live since", "Oct 23, 2026"],
    ["Runs on", "Cloud Run, Firestore"],
    ["Region", "us-central1"],
    ["Callers", "6 app accounts"],
    ["Sign in", "Google ID token, no IAP"],
    ["Screen", "1 element, 719 KB"],
    ["Scale", "6 apps : 1 list"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "19", unit: "minutes", label: "from our VP of finance's request in the Cowork tab to the live fix on Oct 28" },
    { value: "0", unit: "admins", label: "through an app. A relayed person can ask and add to a request, and only Launchpad sets a status" },
    // Relay revision 00001 at 19:24Z (gcloud run revisions list); FR-0001 createdAt 19:32:45Z (Firestore).
    { value: "8", unit: "minutes", label: "from the relay going live at 3:24 PM on Oct 23 to the first request, FR-0001" },
    { value: "6", unit: "callers", label: "the most of any service in the inventory, each allowed to file only about its own app" },
  ],
  svg,
  views: [
    { id: "ask", label: "Ask from any app", focus: ["cowork", "relay", "requests", "launchpad"], note: "The app checks the person its own way and forwards the call with its own Google ID token." },
    { id: "callers", label: "Six callers", focus: ["estimator", "planner", "cowork", "patients", "forms", "portal", "relay"], note: "Only these six app accounts can invoke the relay. Each may file requests only about its own app." },
    { id: "ping", label: "The ping", focus: ["relay", "chat", "owner", "launchpad"], note: "Each new request and follow up posts a card to one Chat space, threaded by its FR number." },
    { id: "files", label: "Screenshots stay private", focus: ["relay", "files", "launchpad"], note: "Pasted files go to a private bucket and are served back only through Launchpad, sandboxed." },
  ],
  parts: {
    estimator: {
      kind: "My app",
      owner: "mine",
      what: "The Treatment Estimator's tab. Its route takes the person from the estimator's own sign in, drops any Authorization, Cookie or X-Relay header the browser sent, and forwards with an ID token from the metadata server.",
      source: "treatment-estimator/lib/featureRequests/relay.ts:21",
    },
    planner: {
      kind: "My app",
      owner: "mine",
      what: "The Capacity Planner's tab. Plain fetch with no Google client library, and a path can never climb out of the request API on the relay.",
      source: "hybridge-capacity-planner/apps/web/lib/featureRequests/relay.ts:17",
    },
    cowork: {
      kind: "My app",
      owner: "mine",
      what: "The Cowork Dashboard's tab, in the element's dark theme. The person comes from the verified IAP header, and an upload streams straight through to the relay.",
      source: "hybridge-cowork-dashboard/packages/web/src/feature-requests.ts:34",
    },
    patients: {
      kind: "My app",
      owner: "mine",
      what: "The Patient Dashboard's tab. The route reads the session itself and refuses a write from another site, so a page elsewhere cannot post as a signed in coordinator.",
      source: "hybridge-cdf/lib/feature-requests.ts:153",
    },
    forms: {
      kind: "My app",
      owner: "mine",
      what: "The Hybridge Forms dashboard's tab, next to its older Send feedback menu item. The route is kept free of Next and the session, so a test hands it a request, a person and a fetch.",
      source: "hybridge-forms/apps/admin/lib/feature-requests.ts:18",
    },
    portal: {
      kind: "My app",
      owner: "mine",
      what: "The Doctor Portal's tab, the sixth caller, added on Oct 29. It forwards only the identity IAP verified.",
      source: "hybridge-portal/apps/portal/lib/featureRequests/relay.ts:24",
    },
    relay: {
      kind: "My service",
      owner: "mine",
      what: "launchpad-requests: Launchpad's own image deployed again with relay mode on, no IAP, at most two instances. It answers only the request API and a health check, and trusts a person only when the token, the calling account, the app it names and a Hybridge address all match.",
      source: "lib/requests/relay.ts:54",
    },
    chat: {
      kind: "Chat space",
      owner: "managed",
      what: "Each new request and follow up posts a card to one space: the app, who, when, the first lines, and a button to the request. Follow ups thread under their FR number, and the owner's own messages are skipped.",
      fails: "Chat gets three seconds. A slow or broken Chat costs only the ping, because the request is saved first.",
      source: "lib/requests/notify.ts:70",
    },
    owner: {
      kind: "People",
      owner: "outside",
      what: "The one admin. Sets a status with an optional note, edits headings, and presses Copy, which puts the whole thread and every attachment's path into one block for a Claude Code session.",
      source: "lib/requests/copy-text.ts:65",
    },
    requests: {
      kind: "Managed database",
      owner: "managed",
      what: "Five collections of its own in Launchpad's Firestore database: requests, messages, uploads, people and one counter. A request and its FR number are written in one transaction, so two requests never share a number.",
      source: "lib/requests/store/firestore.ts:55",
    },
    launchpad: {
      kind: "My app",
      owner: "mine",
      what: "The Feature requests tab inside Launchpad: every app's requests in one list, open ones first, newest activity on top. Anyone signed in can ask and add; only the admin sets statuses.",
      source: "app/requests/page.tsx",
    },
    files: {
      kind: "Managed storage",
      owner: "managed",
      what: "A private Cloud Storage bucket with uniform access and public access prevention. Files up to 25 MB from an allow list of types, served back only through Launchpad and the apps' routes.",
      source: "scripts/deploy.ps1:200",
    },
  },
  breaks: [
    { title: "Uploads over 10 MB", body: "Next copies a request body into middleware and cuts it at 10 MB, so a 12 MB upload failed. The request API skips middleware now, and a test pins it.", source: "middleware.ts:13" },
    { title: "Chat is slow or down", body: "The ping waits three seconds at most and never throws. The request is already saved.", source: "lib/requests/notify.ts:75" },
    { title: "The heading model stalls", body: "It gets five seconds. After that the heading is the request's first sentence, and the admin can edit it.", source: "lib/requests/heading.ts:42" },
  ],
  tuned: [
    { title: "One image, two services", body: "The relay deploy reuses the image the main deploy just built, so there is no second build and the two run the same code.", source: "scripts/deploy.ps1:296" },
    { title: "Uploads stream through", body: "A 25 MB video passes from the browser through the app to the relay as a stream, and the browser sends big files two at a time.", source: "components/requests/queue.ts:1" },
    { title: "One element, six apps", body: "The request screen is one custom element in a shadow root, with a light and a dark theme, and each app copies it with its own script.", source: "scripts/build-element.mjs" },
  ],
  guards: [
    { title: "No admin through an app", body: "An app only vouches for who is asking. A bug in one app cannot set statuses, edit headings or Copy.", source: "lib/requests/relay.ts:68" },
    { title: "Each app, its own requests", body: "The calling account must match the app named in the header. A request sent from an app is about that app, and a delete through an app reaches only its requests.", source: "lib/requests/store/index.ts:324" },
    { title: "Files come back sandboxed", body: "Every attachment is served with a sandbox policy and no content sniffing, by Launchpad and by each app's route.", source: "app/api/requests/files/[uploadId]/route.ts:30" },
  ],
  // GCP billing export, account 013C47, Oct 1 to 28 2026, net of credits
  // (project-docs/fde-refresh/costs/cloud-run-by-service.csv and by-service.csv).
  // The export has no service label, so request time covers all three services.
  cost: {
    total: "$0.02",
    period: "in October",
    method: "Measured from the Google Cloud billing export, October 1 to 28, net of credits. The export cannot split Cloud Run by service, so this is the request time of all three services in the project (Launchpad, this relay and the retired June board), the most the relay could have cost. Firestore does not show up at all.",
    parts: [
      { label: "Cloud Run requests, three services", usd: 0.02 },
      { label: "Cloud Storage, every bucket", usd: 0.0 },
    ],
  },
  // Request driven: no scheduler job calls the relay. One request from the
  // Cowork tab: saved under its FR number, then the Chat ping, then the admin.
  live: {
    mode: "event",
    label: "A new request",
    everySeconds: 14,
    path: ["cowork", "relay", "requests", "relay", "chat", "owner", "launchpad"],
    source: "someone sends a request from an app's Feature requests tab",
  },
};

export default arch;
