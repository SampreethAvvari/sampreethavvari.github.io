import type { Architecture } from "../types";
import svg from "../svg/cdf-diagnostic-filter.svg?raw";

const arch: Architecture = {
  slug: "cdf-diagnostic-filter",
  rank: 27,
  name: "CDF Diagnostic Filter",
  project: "CDF Patient Hub",
  kind: "system",
  disciplines: ["aie"],
  post: "/posts/cdf-diagnostic-filter",
  headline: "Turns each patient survey into two reports.",
  tail: "Gemini writes the doctor's page.",
  lede:
    "A patient's survey becomes one named Cloud Task, and the renderer turns it into PDFs, with Gemini writing the doctor's page and, on demand, a panorex read under the founder's written ruleset. Every Gemini call retries and falls back through newer models, and the clinic email waits until both reports exist.",
  titleBlock: [
    ["System", "CDF Diagnostic Filter"],
    ["Revision", "v0.25.0"],
    ["Live since", "Jun 19, 2026"],
    ["Runs on", "Cloud Run, Vertex AI"],
    ["Region", "us-central1"],
    ["Checked", "4 of 4 pro models"],
    ["Patient copy", "No risk score"],
    ["Retries", "10, then hourly"],
    ["Scale", "2 reports : 1 clinic email"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "0.3", unit: "s", label: "for an experience survey submit to return; the reports follow in the queue" },
    { value: "2 of 2", label: "reports before the clinic list gets an email. Until then it waits and retries" },
    // git-stats/per-repo.csv hours_to_shipped_strict 1.3: c006969 at 01:48 to 89475e4 at 03:06, Jun 19.
    { value: "1.3", unit: "hours", label: "from the first commit at 1:48 AM on Jun 19 to a branded shell on Cloud Run" },
    { value: "6", unit: "Gemini calls", label: "psychographic, panorex read, risk read, intake extract, feedback summary and voice, all through one fallback" },
  ],
  svg,
  views: [
    { id: "intake", label: "An intake, end to end", focus: ["patient", "survey", "tasks", "renderer", "gmail"], note: "A submit becomes one named task. The renderer makes the PDFs, mails the patient, then mails the clinic." },
    { id: "fallback", label: "When Gemini is busy", focus: ["renderer", "chain", "gemini"], note: "Three tries per model with a growing wait, then the next model, all inside a time budget." },
    { id: "clinic-hold", label: "The clinic hold", focus: ["tasks", "renderer", "db", "reconcile", "gmail"], note: "No doctor report means no clinic email yet. The task retries, and the hourly sweep keeps trying after the queue stops." },
    { id: "panorex", label: "The panorex read", focus: ["drive", "chain", "gemini", "renderer", "db"], note: "Panorex and photos go to Gemini under the doctor's written ruleset, and plain code recounts every total." },
  ],
  parts: {
    drive: {
      kind: "Google Workspace",
      owner: "outside",
      what: "Each patient's Drive folder holds the panorex and clinical photos. The panorex read pulls them in as images inside the Gemini request, and the renderer files the finished PDFs back there.",
      source: "packages/lib/src/drive.ts",
    },
    chain: {
      kind: "My module",
      owner: "mine",
      what: "Every Gemini call goes through one function. A 429, 408, 5xx or timeout retries the same model up to three times with a 2 to 20 second wait; a 404 model is skipped and remembered for six hours; any other error moves straight to the next model. All of it runs inside a time budget, so a retry never outlasts the request.",
      fails: "If every model fails, one error names them all. For the psychographic that means no doctor report yet, so the clinic email is held.",
      source: "packages/lib/src/gemini-models.ts:142",
    },
    gemini: {
      kind: "Managed AI",
      owner: "managed",
      what: "Gemini on Vertex AI. The pro chain is 2.5 Pro, then 4 Argon, 3.1 Pro preview and 3.8 Flash; the flash chain is 2.5 Flash, 3.8 Flash and 3.5 Flash. A service setting reorders either without a code change, and newer models get their default temperature.",
      source: "packages/lib/src/gemini-models.ts:46",
    },
    patient: {
      kind: "People",
      owner: "outside",
      what: "Patients fill in the intake before a consult, on an office tablet or from a link, and the experience survey after. The experience survey takes spoken answers too.",
    },
    survey: {
      kind: "My app",
      owner: "mine",
      what: "Next.js on Cloud Run, public. One questionnaire for three offices, routed by office. A submit writes the response and enqueues one task named after it, so a double submit collapses into one.",
      source: "apps/web-questionnaire/app/api/responses/[id]/submit/route.ts:119",
    },
    tasks: {
      kind: "Managed queue",
      owner: "managed",
      what: "The delivery queue allows ten attempts, 10 seconds to 5 minutes apart, and each call carries an OIDC token. A 5xx from the renderer is the whole retry mechanism.",
      source: "apps/pdf-renderer/src/server.ts:647",
    },
    renderer: {
      kind: "My service",
      owner: "mine",
      what: "Fastify with headless Chromium, 2 CPU and 4 GiB, CPU kept on after the reply. It renders the patient summary with no risk score, then the doctor report with the psychographic page, mails the patient, then the office's clinic list, files to Drive and tells the CDF. The panorex read runs here when staff press Regenerate.",
      fails: "A missing doctor report holds the clinic email and the request answers 500, so the task comes back. Each retry skips whatever already landed.",
      source: "apps/pdf-renderer/src/server.ts:448",
    },
    gmail: {
      kind: "Email",
      owner: "outside",
      what: "Sends the patient their summary and each office's list the summary plus the doctor report. The lists live on each office's Firestore record and are read at send time, so changing one needs no deploy.",
      source: "packages/lib/src/gmail.ts",
    },
    cdf: {
      kind: "My app",
      owner: "mine",
      what: "Staff read every response, report and PDF on the CDF dashboard. Regenerate there asks the renderer for the panorex read, the risk read and both clinical reports, fire and forget.",
      source: "apps/pdf-renderer/src/server.ts:662",
    },
    db: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore responses, reports and office records, and the PDFs in Cloud Storage. A held clinic email is written on its report with when it was first held, so the alert and the sweep both know.",
      source: "apps/pdf-renderer/src/delivery-alerts.ts",
    },
    reconcile: {
      kind: "My sweep",
      owner: "mine",
      what: "Cloud Scheduler calls the sweep every hour. It looks back seven days, leaves the last 75 minutes to the queue so it never races a retry, and sends whatever never landed under the same both reports rule.",
      source: "apps/pdf-renderer/src/reconcile.ts:125",
    },
  },
  breaks: [
    { title: "Gemini answers 429", body: "The same model is tried three times with a growing wait, then the next model. Before Oct 23 a single 429 cost a clinic one patient's doctor report.", source: "packages/lib/src/gemini-models.ts:5" },
    { title: "A model is retired", body: "A 404 skips that model for six hours on that instance, and one alert per retired model goes out, once.", source: "apps/pdf-renderer/src/delivery-alerts.ts:130" },
    { title: "Delivery dies halfway", body: "The renderer answers 5xx while anything is missing and Cloud Tasks comes back; each retry only does what has not landed. The hourly sweep is the backstop.", source: "apps/pdf-renderer/src/server.ts:647" },
  ],
  tuned: [
    { title: "Flash where speed matters", body: "The feedback summary and voice transcription run on the flash chain with 60 and 45 second budgets. The reports use pro.", source: "packages/lib/src/experience-summary.ts:218" },
    { title: "CPU stays on after replying", body: "Delivery kept dying after the response until v0.15.1 kept CPU allocated. Concurrency is 8 because each render forks a browser.", source: "infra/cloudbuild.pdf-renderer.yaml:46" },
    { title: "Default temperature on newer models", body: "Our prompts pin a low temperature tuned on 2.5. Google's own guide says newer models loop at low values, so they get their default.", source: "packages/lib/src/gemini-models.ts:238" },
  ],
  guards: [
    { title: "The model observes, code counts", body: "The panorex read lists teeth. The destruction score and its band are recomputed in plain code, and the per arch rule is enforced in code.", source: "packages/lib/src/cdf-generate.ts:20" },
    { title: "Uncited points are dropped", body: "Every point in the feedback summary must cite a real quote. One whose citation does not resolve is dropped in code, not trusted.", source: "packages/lib/src/experience-summary.ts:16" },
    { title: "No risk score for patients", body: "The patient's copy is a cover and a one page summary with no risk score. The 0 to 200 number is for the doctor to explain in the room.", source: "apps/pdf-renderer/src/templates/Report.tsx:175" },
  ],
  // hybridge-assessment-dev is not measured: its billing export has 0 rows
  // (enabled 2026-10-28). project-docs/fde-refresh/costs/by-project.csv
  cost: null,
  live: {
    mode: "event",
    label: "A patient submits an intake",
    everySeconds: 14,
    path: ["patient", "survey", "tasks", "renderer", "chain", "gemini", "chain", "renderer", "db", "renderer", "gmail"],
    source: "a patient pressing Submit on the intake survey",
  },
};

export default arch;
