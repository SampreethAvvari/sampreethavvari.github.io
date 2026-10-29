import type { Architecture } from "../types";
import svg from "../svg/launchpad.svg?raw";

const arch: Architecture = {
  slug: "launchpad",
  rank: 110,
  name: "Hybridge Launchpad",
  project: "Launchpad",
  kind: "system",
  disciplines: ["fde", "sde"],
  post: "/posts/launchpad",
  headline: "Lists every Hybridge app on one board.",
  tail: "On Cloud Run, behind IAP.",
  lede:
    "Anyone with a Hybridge Google account passes IAP and opens any app from one board of 38 projects grouped by status. Four leaders also see Work and History, and one editor changes the cards, each save writing the project and its history entry in a single Firestore transaction.",
  titleBlock: [
    ["System", "Hybridge Launchpad"],
    ["Revision", "unversioned"],
    ["Live since", "Oct 22, 2026"],
    ["Runs on", "Cloud Run, Firestore"],
    ["Region", "us-central1"],
    ["Sign in", "Hybridge Google, IAP"],
    ["History", "Append only"],
    ["Deploy", "Clean main only"],
    ["Scale", "38 cards : 1 editor"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "78", unit: "minutes", label: "from the first commit to a working live board on Oct 22" },
    { value: "1", unit: "editor", label: "moves or edits a card. Four leaders read Work and History, and everyone else sees Apps" },
    // Live Firestore launchpad_projects read, status and kind fields only, 2026-10-29.
    { value: "38", unit: "projects", label: "on one board in panes by status, 22 of them live" },
    { value: "21", unit: "edits", label: "logged since launch, each with who, when, and every field's old and new value" },
  ],
  svg,
  views: [
    { id: "open-an-app", label: "Open any app", focus: ["staff", "iap", "app", "board", "projects"], note: "Anyone with a Hybridge Google account passes IAP and sees every app, grouped by status." },
    { id: "work", label: "Work and History", focus: ["leaders", "iap", "app", "board", "changes"], note: "Four leaders also see what is being built now, next, stalled and shipped, and every change with its date." },
    { id: "one-editor", label: "One editor, every edit logged", focus: ["editor", "iap", "app", "projects", "changes"], note: "Only the owner moves or edits a card. The project and its history entry save in one Firestore transaction." },
    { id: "requests", label: "Same image, second job", focus: ["board", "app", "relay"], note: "The same image runs again as launchpad-requests, the relay six other apps call. It has its own drawing." },
  ],
  parts: {
    leaders: {
      kind: "People",
      owner: "outside",
      what: "Four leaders on the Work list. They see what is being built now, next, stalled and shipped, each with a 1 to 5 complexity meter, plus the History tab. They read and never edit.",
      source: "README.md:12",
    },
    board: {
      kind: "My app",
      owner: "mine",
      what: "Apps shows every project in panes by status, side by side, each with a cover; services sit in narrower cards. Work sorts them into now, next, stalled and shipped. History lists every change with its date.",
      source: "components/apps/AppsBoard.tsx",
    },
    tour: {
      kind: "My app",
      owner: "mine",
      what: "A welcome dialog and a guided tour on the first visit in each browser. Everyone gets 9 stops, the Work list 11 and the editor 13, and it replays from the rail.",
      source: "components/tour/steps.tsx:103",
    },
    staff: {
      kind: "People",
      owner: "outside",
      what: "Everyone with a Hybridge Google account. They see the Apps tab and open any app from it, view only.",
      source: "scripts/deploy.ps1:273",
    },
    iap: {
      kind: "Sign in",
      owner: "managed",
      what: "Identity Aware Proxy on the Cloud Run service lets in Hybridge Google accounts only. The app still verifies IAP's signed header against Google's public keys and ignores the unsigned email header.",
      fails: "If the check fails, the person gets the Apps tab only. Work, History and editing stay hidden.",
      source: "lib/viewer.ts:46",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "hybridge-launchpad on Cloud Run, Next.js 15 and React 19, no minimum instances and at most two. A hand deploy script runs the tests and a build first, so no CI minutes are spent.",
      fails: "The first revision failed every page on how the production bundle loaded the Firestore client. The fixed revision went live ten minutes later.",
      source: "scripts/deploy.ps1:255",
    },
    projects: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore keeps the 38 projects in launchpad_projects. The database is shared with the retired June board, so Launchpad reads and writes only its own collections.",
      source: "lib/store/firestore.ts:6",
    },
    changes: {
      kind: "Managed database",
      owner: "managed",
      what: "launchpad_changes: one entry per save, with the date, who, and each field's old and new value. Entries are created and never set, so none can be overwritten. A save that changes nothing adds nothing.",
      source: "lib/store/firestore.ts:97",
    },
    editor: {
      kind: "People",
      owner: "outside",
      what: "The one admin. Drags cards between panes (Stalled asks for a reason), hides a card, edits the wording and adds projects. The owner's address is in the code, so the owner is always an admin.",
      source: "lib/viewer.ts:8",
    },
    relay: {
      kind: "My service",
      owner: "mine",
      what: "The same image deployed a second time with relay mode on, as launchpad-requests: the feature request relay six other apps call. It answers only the request API and a health check, and has its own drawing.",
      source: "middleware.ts:13",
    },
    seed: {
      kind: "Starting data",
      owner: "mine",
      what: "data/projects.json, copied into Firestore the first time the live app starts, with no history entries. After that the store is the source of truth and the file changes nothing live.",
      fails: "If two instances start at once, the second one's create() fails, so an edit made in the first seconds is never overwritten.",
      source: "lib/store/firestore.ts:56",
    },
  },
  breaks: [
    { title: "The bundle loses Firestore", body: "A dynamic import in the Next production bundle exposed the Firestore class only under default, so every page failed with 'b is not a constructor'. The loader takes either shape now, and a test covers both.", source: "lib/store/index.ts:70" },
    { title: "The signed header fails", body: "No valid IAP assertion means no email. The page still loads with the Apps tab, and Work, History and editing stay hidden.", source: "lib/viewer.ts:75" },
    { title: "Two instances seed at once", body: "The seed uses create(), which fails when the document exists, so a second instance cannot overwrite an early edit.", source: "lib/store/firestore.ts:56" },
  ],
  tuned: [
    { title: "Scale to zero", body: "No minimum instances, at most two, 1 GiB each. Request time for all three services in the project came to under two cents in October.", source: "scripts/deploy.ps1:263" },
    { title: "One store, two homes", body: "A JSON file on my laptop, Firestore when deployed, behind one small interface the tests fake.", source: "lib/store/index.ts:36" },
    { title: "History without an index", body: "One project's history is short, so it is sorted in memory instead of with a composite Firestore index.", source: "lib/store/firestore.ts:105" },
  ],
  guards: [
    { title: "Signed header, verified", body: "The email comes only from IAP's signed assertion, checked against Google's keys and this service's audience. The unsigned header is ignored.", source: "lib/viewer.ts:75" },
    { title: "History is append only", body: "Each save writes the project and its history entry in one transaction. Entries are only ever created.", source: "lib/store/firestore.ts:87" },
    { title: "Deploy refuses a dirty tree", body: "Cloud Run builds the folder as it is, so the script stops on uncommitted files or any branch but main, then runs the tests and a build.", source: "scripts/deploy.ps1:141" },
  ],
  // GCP billing export, account 013C47, Oct 1 to 28 2026, net of credits
  // (project-docs/fde-refresh/costs/by-service.csv). Whole project: Launchpad,
  // its relay, and the June board with its paused sync job and secrets.
  cost: {
    total: "$0.32",
    period: "in October",
    method: "Measured from the Google Cloud billing export, October 1 to 28, net of credits, for the whole project. It holds Launchpad, its request relay and the June board it replaced, whose daily sync job and secrets make up most of the bill. Firestore does not show up at all.",
    parts: [
      { label: "Secret Manager, three secrets", usd: 0.2 },
      { label: "Scheduler, the June sync job", usd: 0.04 },
      { label: "Cloud Run, jobs and requests", usd: 0.04 },
      { label: "Image registry", usd: 0.04 },
    ],
  },
  // Request driven: the only scheduler job in hybridge-dashboard is the June
  // board's git-sync-daily, paused (gcloud scheduler jobs list). One edit:
  // the editor saves, IAP signs, the app writes project and history together.
  live: {
    mode: "event",
    label: "An edit, logged",
    everySeconds: 14,
    path: ["editor", "iap", "app", "projects", "changes", "projects", "app", "board"],
    source: "the editor saves a change on the board, and the project and its history entry commit together",
  },
};

export default arch;
