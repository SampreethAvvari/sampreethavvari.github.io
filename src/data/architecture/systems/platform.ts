import type { Architecture } from "../types";
import svg from "../svg/platform.svg?raw";

const arch: Architecture = {
  slug: "platform",
  rank: 1,
  name: "Hybridge Platform",
  project: "Hybridge Platform",
  kind: "system",
  disciplines: ["fde", "sde", "aie"],
  post: "/posts/platform",
  headline: "45 services run three dental offices.",
  tail: "On 14 Google Cloud projects.",
  lede:
    "Patients reach the practice through lead forms and surveys, and their reports, chart links and appointments move through three shared services: the PDF renderer, the CDF registry and the Denticon sync. Around them sit the estimator and planner, the marketing data jobs, the coaching, lab and ops apps, and one request relay that six apps file into.",
  titleBlock: [
    ["System", "Hybridge Platform"],
    ["Revision", "unversioned"],
    ["Live since", "Apr 21, 2026"],
    ["Runs on", "Cloud Run, BigQuery"],
    ["Region", "us-central1, us-east1"],
    ["Services", "45 live on Oct 29"],
    ["Projects", "14 on Google Cloud"],
    ["Offices", "3 in upstate New York"],
    ["Scale", "1 engineer : 45 services"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "1", unit: "min", label: "the tightest loops: the planner reads the book and the forms worker sweeps deliveries every minute" },
    { value: "1", unit: "key holder", label: "for Denticon. Every other app reads the mirror through the CDF registry" },
    { value: "19", unit: "minutes", label: "from a request filed in the Cowork Dashboard to the live fix on Oct 28" },
    { value: "$132", label: "Google Cloud in October for the six projects the billing export measured" },
  ],
  svg,
  views: [
    { id: "patient", label: "One patient's path", focus: ["patients", "pforms", "monday", "renderer", "cdf", "clinic"], note: "A lead form lands on the Monday board. At the consult the intake survey becomes reports and a chart link, and the clinic apps read the book." },
    { id: "keys", label: "One holder of the Denticon keys", focus: ["denticon", "sync", "cdf", "clinic"], note: "Only the sync service talks to Denticon. Every other app reads the mirror through the CDF registry." },
    { id: "requests", label: "Feature requests", focus: ["clinic", "ops", "relay"], note: "Six apps file feature requests through one relay, each with its own Google ID token, into one Launchpad list." },
    { id: "outside", label: "What leaves the building", focus: ["marketing", "monday", "outside", "renderer", "ops"], note: "Each family reaches only the outside systems it needs: Gemini, Gmail, Zoom, the phone system, the lab and the ad platforms." },
  ],
  parts: {
    patients: {
      kind: "People",
      owner: "outside",
      what: "Prospects send an inquiry from one of four Hybridge websites. Patients fill in the intake survey before a consult and the experience survey after, on an office tablet or from a link, and get their summary by email.",
    },
    pforms: {
      kind: "My apps, 5 services",
      owner: "mine",
      what: "Everything a patient types into. Hybridge Forms is four services: the public forms and API, the staff dashboard, a delivery worker that sweeps every minute, and nightly checks. The intake and experience surveys are one more.",
      source: "hybridge-forms/packages/core/src/sites.ts:4",
    },
    monday: {
      kind: "Work boards",
      owner: "outside",
      what: "Monday holds the Leads board and the patient boards. A new inquiry becomes a lead item within seconds; the marketing pulls, the Cowork Dashboard and Doc Coach read the boards.",
      source: "hybridge-forms/packages/core/src/delivery/monday.ts:13",
    },
    renderer: {
      kind: "My shared service",
      owner: "mine",
      what: "Turns a finished survey into the patient summary and the doctor report in headless Chromium, mails the patient and the office list, and tells the CDF the intake is done. The delivery queue, the CDF dashboard and an hourly sweep call it.",
      fails: "It answers 500 while any delivery step is missing, so the queue retries, and the hourly sweep sends whatever the queue gave up on.",
      source: "hybridge-assessment/apps/pdf-renderer/src/server.ts:322",
    },
    cdf: {
      kind: "My shared service",
      owner: "mine",
      what: "The CDF dashboard is the staff screen with one row per patient, and its registry routes serve the Denticon mirror to the estimator and the capacity planner, each behind its own bearer. It also looks up consults in Doc Coach and estimates in the estimator.",
      fails: "A planner read with an unknown office is refused, because a dropped office would look like an empty calendar.",
      source: "hybridge-cdf/lib/registry/README.md",
    },
    clinic: {
      kind: "My apps, 2 services",
      owner: "mine",
      what: "The treatment estimator, where coordinators build and present estimates, and the capacity planner, which shows leadership who is where across three offices. Both read the appointment book from the CDF and hold no Denticon credential.",
      source: "hybridge-capacity-planner/apps/web/lib/sources/cdf/client.ts:112",
    },
    denticon: {
      kind: "Practice system",
      owner: "outside",
      what: "Denticon, from Planet DDS, is where every chart and appointment really lives. Nothing here writes to it.",
    },
    sync: {
      kind: "My shared service",
      owner: "mine",
      what: "Keeps the Firestore mirror of Denticon: webhooks first, a worker every ten minutes, a sweep at twenty past each hour and a 4 AM poll. It is the only service that holds Denticon credentials, with one warm instance so Denticon's ten second webhook check never meets a cold start.",
      source: "hybridge-cdf/infra/cloudbuild-sync.yaml:168",
    },
    relay: {
      kind: "My apps, 2 services",
      owner: "mine",
      what: "Launchpad is one page that opens every Hybridge app, with a Work board for four leaders. Its relay takes feature requests from six apps, each calling with its own Google ID token, into one list.",
      source: "hybridge-launchpad/lib/requests/relay.ts:54",
    },
    ops: {
      kind: "My apps, 16 services",
      owner: "mine",
      what: "Doc Coach scores recorded consults; NPC Coach grades new patient calls in three services; the CBCT validator checks lab scans in four; the Cowork Dashboard and the Daily Sales Report are two each; Reconciliation matches billing to notes; the Doctor Portal runs on sample data; and two website previews.",
    },
    outside: {
      kind: "Outside services",
      owner: "outside",
      what: "Gemini on Vertex AI, and Gmail, Drive, Sheets, Calendar and Chat from Google Workspace. Zoom for recorded consults, the phone system's recording drop, the lab's scan system and the ad and analytics platforms. The Doctor Portal's link to MagicTouch, the lab's case system, is planned, not live.",
    },
    marketing: {
      kind: "My jobs, 17 services",
      owner: "mine",
      what: "Nine jobs pull CallRail, Meta paid and organic, Microsoft Ads, TapClicks, Monday, GA4, Search Console and Business Profile at 6 AM, beside a Google Ads transfer and a weekly Monday backup. Then a view rebuild, the 6:30 email, a 6:45 health check, a weekly question quiz, the Data connector for Claude and a status page.",
      source: "hybridge-marketing-warehouse/deploy/deploy_jobs.sh:47",
    },
  },
  breaks: [
    { title: "Denticon misses a webhook", body: "A sweep at twenty past each hour lists every slice Denticon holds, and the 4 AM poll reads everything changed since each cursor.", source: "hybridge-cdf/lib/denticon/slice-worker.ts:13" },
    { title: "Gemini is busy or retired", body: "Three tries per model with a growing wait, then the next model in the chain. A retired model is skipped for six hours.", source: "packages/lib/src/gemini-models.ts:47" },
    { title: "Monday is down", body: "A lead waits in Firestore and the worker retries at one minute, ten minutes and an hour. The Cowork Dashboard keeps its last good read.", source: "packages/core/src/delivery/jobs.ts:16" },
  ],
  tuned: [
    { title: "Zero instances by default", body: "The estimator, planner, Launchpad, the relay and the forms worker scale to zero. The webhook receiver and the public forms keep one warm, because each must answer fast.", source: "hybridge-cdf/infra/cloudbuild-sync.yaml:168" },
    { title: "One image, two services", body: "The CDF dashboard and the Denticon sync share an image, and so do Launchpad and its relay. Configuration decides what each one can do.", source: "hybridge-launchpad/scripts/deploy.ps1:296" },
    { title: "Ship from a tag", body: "The estimator, the planner, the CDF and the surveys deploy only from a version tag, and a bad release moves traffic back to the last revision.", source: ".github/workflows/deploy-prod.yaml:13" },
  ],
  guards: [
    { title: "One holder of the keys", body: "Only the sync service holds Denticon credentials. Every other repo calls the CDF, and none gets its own credentials, not even as a fallback.", source: "hybridge-cdf/docs/HANDOFF.md:225" },
    { title: "Every machine call signed", body: "The registry takes one bearer per caller, compared in constant time. The relay and the renderer take Google identity tokens from named service accounts.", source: "hybridge-cdf/lib/registry/auth.ts:26" },
    { title: "Logs carry counts", body: "The forms logger drops answers, names, emails and phones. The sync and the renderer log counts and ids.", source: "hybridge-forms/packages/core/src/log.ts:24" },
  ],
  // GCP billing export, account 013C47, Oct 1 to 28 2026, net of credits
  // (project-docs/fde-refresh/costs/by-project.csv). Six Hybridge projects are
  // measured: 61.76 + 33.88 + 27.07 + 8.62 + 0.32 + 0.06 = 131.71.
  cost: {
    total: "$132",
    period: "in October",
    method: "Measured from the Google Cloud billing export, October 1 to 28, net of credits, for the six projects it covers. The other eight projects hold the CDF, marketing data, Cowork, the Daily Sales Report, Doc Coach, NPC Coach, Reconciliation and the websites; their billing export switched on Oct 28, 2026, so there is no measured month yet.",
    parts: [
      { label: "CBCT scan validation", usd: 61.76 },
      { label: "Treatment estimator", usd: 33.88 },
      { label: "Capacity planner", usd: 27.07 },
      { label: "Forms, Launchpad, Doctor Portal", usd: 9.0 },
    ],
  },
  // Event driven. One patient: a lead form, the Monday lead, the reply, then at
  // the consult the intake survey, the renderer, the CDF and the clinic apps.
  live: {
    mode: "event",
    label: "A new patient",
    everySeconds: 16,
    path: ["patients", "pforms", "monday", "pforms", "patients", "pforms", "renderer", "cdf", "clinic"],
    source: "a lead form on a Hybridge website, then the intake survey at the consult",
  },
};

export default arch;
