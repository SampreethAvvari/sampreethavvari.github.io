import type { Architecture } from "../types";
import svg from "../svg/hybridge-forms.svg?raw";

const arch: Architecture = {
  slug: "hybridge-forms",
  rank: 70,
  name: "Hybridge Forms",
  project: "Hybridge Forms",
  kind: "system",
  disciplines: ["fde", "sde"],
  post: "/posts/hybridge-forms",
  headline: "Saves website leads and puts them on Monday.",
  tail: "Replaces Tally and Zapier.",
  lede:
    "A patient's answers post from an iframe on our websites to forms-public, which saves them and their delivery jobs in one Firestore write. A private worker, woken at once by Cloud Tasks and every minute by Cloud Scheduler, puts the lead on Monday and sends the email copies.",
  titleBlock: [
    ["System", "Hybridge Forms"],
    ["Revision", "v2.7.0"],
    ["Live since", "Oct 6, 2026"],
    ["Runs on", "Cloud Run, Firestore"],
    ["Region", "us-east1"],
    ["Replaces", "Tally and Zapier"],
    ["Importer", "32 of 32 Tally forms"],
    ["Rollback", "previous revision"],
    ["Scale", "1 inquiry : 1 write"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "1", unit: "min", label: "longest a lead waits for the backup sweep when the instant wake fails" },
    { value: "0", label: "answers, names, emails or phones in any log line" },
    // per-repo.csv: first commit Sep 30, days_to_shipped_strict 14; Elmwood contact form on it from Oct 14.
    { value: "14", unit: "days", label: "from the first commit to Elmwood's contact form running on it, Oct 14" },
    { value: "67", unit: "leads", label: "backfilled on Monday with every UTM, the GCLID and the landing page" },
  ],
  svg,
  views: [
    { id: "send", label: "A patient sends", focus: ["site", "public", "recaptcha", "db", "tasks", "worker", "monday"], note: "The page posts to forms-public, which saves the answers and their delivery jobs in one write, then wakes the private worker." },
    { id: "nothing-lost", label: "Nothing lost", focus: ["public", "fallback", "nightly", "scheduler", "worker"], note: "If Firestore fails the copy goes to a private bucket for the 2 AM job. The minute sweep retries every delivery." },
    { id: "leaves", label: "Where answers go", focus: ["worker", "monday", "gmail"], note: "Only the private worker holds the Monday token and the right to send mail. The public service holds neither." },
    { id: "who-reads", label: "Who reads them", focus: ["admin", "db"], note: "Staff sign in through IAP with a Hybridge account. Every inquiry opened or exported writes an audit row." },
  ],
  parts: {
    site: {
      kind: "Websites",
      owner: "outside",
      what: "The practice websites load our embed script, which frames the form from our own origin. Analytics, ad pixels and session recorders on the host page cannot read what a patient types.",
      source: "docs/security.md:39",
    },
    recaptcha: {
      kind: "Spam score",
      owner: "managed",
      what: "reCAPTCHA Enterprise, our own key in our own project, scores each send from a browser token and never sees the answers. Below 0.3 is spam and below 0.5 is flagged; both are settings.",
      fails: "If it is down, the inquiry is kept and marked unverified. It is never refused for that.",
      source: "docs/security.md:122",
    },
    public: {
      kind: "My service",
      owner: "mine",
      what: "forms-public on Cloud Run, Next.js 16, open to the internet with one instance kept warm. It serves the form pages and checks every send: JSON only, 32 KB at most, its own origin, a signed start token, a honeypot and a rate limit. It holds no Monday token and cannot send email.",
      fails: "If Firestore does not answer in time, the same record goes to the fallback bucket and the patient still sees sent.",
      source: "packages/core/src/submit.ts:163",
    },
    db: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore holds the answers, the page they came from and a spam verdict. The address is kept only as a salted hash. Rules deny every browser and phone, so only our service accounts reach it.",
      fails: "Seven days of point in time recovery, a daily backup kept 14 weeks, and delete protection.",
      source: "docs/security.md:252",
    },
    fallback: {
      kind: "Private bucket",
      owner: "managed",
      what: "A private Cloud Storage bucket with uniform access and public access prevention. It only receives an inquiry when Firestore fails.",
      fails: "The 2 AM job moves each copy into Firestore, and leaves one behind when a person has to decide.",
      source: "packages/core/src/submit.ts:169",
    },
    tasks: {
      kind: "Managed queue",
      owner: "managed",
      what: "Right after a save, forms-public adds one task that calls the worker as an account whose only right is calling the worker. The send waits at most 1.5 seconds for the queue to take it.",
      fails: "A wake that fails only costs that minute: the send still succeeds and the next sweep picks it up. The queue tries once, since the sweep is the retry path.",
      source: "packages/core/src/delivery/wake.ts:14",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Cloud Scheduler job forms-deliveries calls the worker every minute with an OIDC token. It is the backup for the wake and the clock for retries. A second job starts the nightly checks at 2 AM.",
      source: "scripts/deploy.sh:903",
    },
    worker: {
      kind: "My service",
      owner: "mine",
      what: "forms-worker on Cloud Run, private: only the scheduler and the wake account may call it. It claims due jobs in transactions, creates the Monday lead, adds an answers PDF when the form asks for one, and sends the email copies.",
      fails: "A failed delivery retries after 1 minute, 10 minutes and 1 hour. The fourth failure stops it and emails the developers the form and the patient, never the answers.",
      source: "packages/core/src/delivery/jobs.ts:16",
    },
    monday: {
      kind: "Lead board",
      owner: "outside",
      what: "The Monday Leads board. Each lead gets the mapped answers plus every UTM, the GCLID and the landing page. From then on, whoever can see the board can see the lead.",
      fails: "Before a retry the worker looks for a lead with the same email made since the first try, so a crash after Monday made the item never makes a second one.",
      source: "packages/core/src/delivery/monday.ts:4",
    },
    gmail: {
      kind: "Google Workspace",
      owner: "outside",
      what: "Email copies to each form's recipients, and an optional email back to the person who sent the form. The worker has no key file: it signs in through a delegation for the one gmail.send scope.",
      source: "packages/core/src/delivery/gmail.ts:1",
    },
    admin: {
      kind: "My app",
      owner: "mine",
      what: "The dashboard where staff build, publish, unpublish and search forms, read inquiries and retry deliveries. IAP lets in Hybridge Google accounts only, and the app checks IAP's signed header again on every request. Every inquiry opened or exported is audited.",
      source: "docs/security.md:133",
    },
    nightly: {
      kind: "My job",
      owner: "mine",
      what: "A Cloud Run job at 2 AM New York time. It sends a test inquiry through each open form, opens each page, scans the websites for forms still on Tally, and moves rescued copies from the fallback bucket into Firestore.",
      source: "packages/checks/src/fallback.ts",
    },
  },
  breaks: [
    { title: "Firestore is down", body: "The inquiry goes to a private bucket, the patient still sees sent, and the 2 AM job moves it in.", source: "packages/core/src/submit.ts:164" },
    { title: "Both stores are down", body: "The server answers 503. The browser retries for about 15 seconds with the same id, then keeps the answers on the device with a Try again button.", source: "docs/security.md:59" },
    { title: "Monday refuses a lead", body: "The delivery retries after 1 minute, 10 minutes and 1 hour, then stops and alerts the developers. The inquiry was saved first, so nothing is lost.", source: "packages/core/src/delivery/jobs.ts:15" },
  ],
  tuned: [
    { title: "Wake now, sweep as backup", body: "A Cloud Tasks wake sends a lead right after the save. The minute sweep stays as the safety net and the retry clock.", source: "packages/core/src/delivery/wake.ts:1" },
    { title: "Answers and jobs, one write", body: "The inquiry and its delivery jobs are created together, create only, so a retried send makes neither twice.", source: "packages/core/src/submit.ts:151" },
    { title: "One warm public instance", body: "forms-public keeps one instance running, so the first patient of the morning never waits on a cold start. It is $7.14 of the $8.62 measured in October.", source: "scripts/deploy.sh:794" },
  ],
  guards: [
    { title: "Answers never reach logs", body: "The logger drops 18 field names, answers, email, phone, name and ip among them, and any value that is not plain text, a number or a boolean. Cloud Run request logs for both apps are excluded.", source: "packages/core/src/log.ts:24" },
    { title: "Public side cannot send", body: "forms-public holds neither the Monday token nor the right to send email. Only the private worker does, and only two accounts may call it.", source: "docs/security.md:52" },
    { title: "Browsers never reach data", body: "Firestore rules deny every read and write from a browser or phone. A patient's address is stored only as a salted hash.", source: "firestore.rules:8" },
  ],
  // GCP billing export, account 013C47, Oct 1 to 28 2026, net of credits
  // (project-docs/fde-refresh/costs/by-service.csv). Partial: first cost Oct 6.
  cost: {
    total: "$9",
    period: "in October",
    method: "Measured from the Google Cloud billing export, October 1 to 28, net of credits. A partial month: the first cost landed October 6. One warm public instance is $7.14 of it.",
    parts: [
      { label: "Cloud Run, one warm instance plus requests", usd: 7.74 },
      { label: "Cloud Build", usd: 0.51 },
      { label: "Secret Manager", usd: 0.23 },
      { label: "Scheduler, Firestore, storage, registry", usd: 0.14 },
    ],
  },
  live: {
    mode: "event",
    label: "A new lead",
    everySeconds: 14,
    path: ["site", "public", "recaptcha", "public", "db", "public", "tasks", "worker", "db", "worker", "monday", "worker", "db"],
    source: "a patient pressing Send on a practice website",
  },
};

export default arch;
