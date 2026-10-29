import type { Architecture } from "../types";
import svg from "../svg/pdf-renderer.svg?raw";

const arch: Architecture = {
  slug: "pdf-renderer",
  rank: 26,
  name: "PDF Renderer",
  project: "CDF Patient Hub",
  kind: "service",
  disciplines: ["sde"],
  post: "/posts/pdf-renderer",
  headline: "Turns every survey into PDFs and emails.",
  tail: "Retries until each step lands.",
  lede:
    "A survey submit becomes one named Cloud Task; the renderer draws the patient summary and the doctor report in headless Chromium, records each delivery step, and mails the patient and the office list. The CDF dashboard and an hourly sweep call the same service, and it tells the CDF when an intake is done.",
  titleBlock: [
    ["System", "PDF renderer"],
    ["Revision", "v0.25.0"],
    ["Live since", "Jun 19, 2026"],
    ["Runs on", "Cloud Run"],
    ["Region", "us-central1"],
    ["Size", "2 CPU, 4 GiB"],
    ["Concurrency", "8 renders"],
    ["Retries", "10, then hourly"],
    ["Scale", "1 browser : 1 render"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "60 to 90", unit: "s", label: "for one survey's whole delivery, run inside the request with full CPU" },
    { value: "Held", label: "a patient email whose address is on file only for other patients in the Denticon mirror" },
    { value: "7", unit: "min", label: "from the first renderer commit at 11:00 PM on Jun 19 to the service running on Cloud Run" },
    { value: "3", unit: "callers", label: "the delivery queue, the CDF dashboard and the hourly sweep, each with a Google identity token" },
  ],
  svg,
  views: [
    { id: "intake", label: "A survey, delivered", focus: ["survey", "tasks", "renderer", "db", "gmail", "people"], note: "A submit becomes one named task. The renderer makes the PDFs, records each step, and mails the patient and the office list." },
    { id: "callers", label: "Three ways in", focus: ["tasks", "cdf", "scheduler", "renderer"], note: "The delivery queue, the CDF dashboard and an hourly sweep call it. Each call carries a Google identity token." },
    { id: "owner", label: "Whose email is it", focus: ["renderer", "mirror", "gmail"], note: "Before a patient email goes out, the address is looked up in the Denticon mirror. One on file only for other patients is held." },
    { id: "handshake", label: "Telling the CDF", focus: ["renderer", "events", "tasks"], note: "Only an ack counts as delivered. Two quick tries, then the queue for about 25 minutes, then one alert with ids only." },
  ],
  parts: {
    survey: {
      kind: "My app",
      owner: "mine",
      what: "The intake survey before a consult and the experience survey after, on an office tablet or from a link. A submit writes the response and enqueues one task named after it, so a double tap collapses into one delivery.",
      source: "apps/web-questionnaire/app/api/responses/[id]/submit/route.ts:119",
    },
    tasks: {
      kind: "Managed queue",
      owner: "managed",
      what: "The delivery queue: ten attempts, 10 seconds to 5 minutes apart, each call signed with the project's own service account. A 5xx from the renderer is the whole retry mechanism.",
      source: "apps/pdf-renderer/src/server.ts:649",
    },
    cdf: {
      kind: "My app",
      owner: "mine",
      what: "Staff press Regenerate on a patient to rebuild the clinical reports, or upload a completed assessment PDF from the old system for the renderer to read into our form and render. Both calls carry a Google identity token.",
      source: "apps/pdf-renderer/src/server.ts:662",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Calls the reconcile sweep at the top of every hour. It looks back seven days, leaves the newest 75 minutes to the queue so the two never race, and sends whatever never landed.",
      source: "apps/pdf-renderer/src/reconcile.ts:121",
    },
    renderer: {
      kind: "My service",
      owner: "mine",
      what: "Fastify on Cloud Run, 2 CPU and 4 GiB, CPU kept on, at most 8 renders an instance because each one launches a fresh Chromium. It renders the patient summary, then the doctor report, and runs every delivery step inside the request, reading first what already went out.",
      fails: "While any step is missing it answers 500, so the queue comes back; each retry does only what has not landed. A container killed halfway loses nothing that was recorded.",
      source: "infra/cloudbuild.pdf-renderer.yaml:46",
    },
    gemini: {
      kind: "Managed AI",
      owner: "managed",
      what: "Gemini on Vertex AI writes the doctor's pages: the psychographic profile, the risk read and, on Regenerate, the panorex read. Every call retries and falls back through newer models, and the office email waits until both reports exist.",
      source: "packages/lib/src/gemini-models.ts:47",
    },
    mirror: {
      kind: "Managed database",
      owner: "managed",
      what: "The Denticon mirror the sync service keeps. The renderer looks up the typed email there. On file only for other patients means the patient email is held and the office email says so; an address on no chart goes out, because a new patient's email is often not in Denticon yet.",
      source: "apps/pdf-renderer/src/email-owner.ts:10",
    },
    db: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore holds each report's delivery record, step by step, and the PDFs sit in Cloud Storage under the response id. The record is what makes a retry, a resend and the sweep safe to run again.",
      source: "apps/pdf-renderer/src/server.ts:346",
    },
    gmail: {
      kind: "Email",
      owner: "outside",
      what: "The patient gets their summary with no risk score. The office list gets the summary and the doctor report. Each office's list is read from its Firestore record at send time, and the experience survey has lists of its own.",
      source: "packages/lib/src/gmail.ts",
    },
    people: {
      kind: "People",
      owner: "outside",
      what: "Patients in Rochester, Buffalo and Syracuse, and each office's distribution list, which gets both reports.",
    },
    events: {
      kind: "My API",
      owner: "mine",
      what: "The CDF's intake event route. The renderer posts that an intake finished, with a Google identity token, and only an answer of ack counts. The CDF then puts the intake and its reports on the patient's chart.",
      fails: "Two quick tries, then a task on the delivery queue tries for about 25 minutes, then one alert email with ids and the error. The CDF's own sweep links the intake anyway.",
      source: "apps/pdf-renderer/src/cdf-notify.ts:8",
    },
  },
  breaks: [
    { title: "Delivery dies halfway", body: "The renderer answers 500 while anything is missing, the queue comes back, and each retry skips what already landed. Nobody gets an email twice.", source: "apps/pdf-renderer/src/server.ts:322" },
    { title: "The queue gives up", body: "The hourly sweep reads seven days of submissions and sends whatever never landed, under the same rules. Running it twice is a no op.", source: "apps/pdf-renderer/src/reconcile.ts:1" },
    { title: "The CDF is down", body: "Nothing about the patient or office email waits on it. The event retries for about 25 minutes, then one alert goes out.", source: "apps/pdf-renderer/src/cdf-notify.ts:20" },
  ],
  tuned: [
    { title: "Work inside the request", body: "Delivery used to run after the reply, and Cloud Run throttled the CPU, so it crawled or vanished. It now runs inside the request with a live connection holding the instance.", source: "apps/pdf-renderer/src/server.ts:322" },
    { title: "CPU always on", body: "CPU stays allocated after the reply. Under the default throttling, work after the reply crawled and then died with the instance.", source: "infra/cloudbuild.pdf-renderer.yaml:46" },
    { title: "Eight renders an instance", body: "Each render forks a browser of about 300 MB, so Cloud Run spreads surveys across instances instead of piling them onto one.", source: "infra/cloudbuild.pdf-renderer.yaml:52" },
  ],
  guards: [
    { title: "Whose email is it", body: "An address on file only for other patients holds the patient email and tells the office. The practice's own inboxes are never held.", source: "apps/pdf-renderer/src/email-owner.ts:23" },
    { title: "Only an ack counts", body: "The CDF event is delivered when the CDF answers ack. Every other answer says whether another try could help.", source: "apps/pdf-renderer/src/cdf-notify.ts:9" },
    { title: "Callers sign every call", body: "The service is deployed with no public access. The queue, the sweep and the CDF each present a Google identity token.", source: "infra/cloudbuild.pdf-renderer.yaml:27" },
  ],
  // hybridge-assessment-dev is not measured: its billing export has 0 rows
  // (enabled 2026-10-28). project-docs/fde-refresh/costs/by-project.csv
  cost: null,
  // Event driven: a patient submits a survey and the questionnaire enqueues a
  // named task on assessment-delivery, which calls /render.
  live: {
    mode: "event",
    label: "A survey is submitted",
    everySeconds: 14,
    path: ["survey", "tasks", "renderer", "db", "renderer", "mirror", "renderer", "gmail", "people"],
    source: "a patient pressing Submit on the intake or experience survey",
  },
};

export default arch;
