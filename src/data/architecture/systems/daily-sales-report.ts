import type { Architecture } from "../types";
import svg from "../svg/daily-sales-report.svg?raw";

const arch: Architecture = {
  slug: "daily-sales-report",
  rank: 90,
  name: "Daily Sales Report",
  project: "Daily Sales Report",
  kind: "system",
  disciplines: ["mle"],
  post: "/posts/daily-sales-report",
  headline: "Builds the forecast by 6:25.",
  tail: "Weekdays, on Cloud Run.",
  lede:
    "A script in the VP of Finance's own Google account copies two lab exports into a bucket, and a weekday job turns them into the VP's forecast with the model ported exactly. Nine checks decide whether it goes out, Gemini writes one paragraph over finished numbers, and the same script emails the report back.",
  titleBlock: [
    ["System", "Daily Sales Report"],
    ["Revision", "unversioned"],
    ["Live since", "Sep 24, 2026"],
    ["Runs on", "Cloud Run, BigQuery"],
    ["Region", "us-central1"],
    ["Checked", "9 checks a morning"],
    ["Ready by", "6:25 each weekday"],
    ["Model", "set 2026-07"],
    ["Scale", "315 days : 15 samples"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "49", unit: "s", label: "average run from wake to a report in the outbox, over 22 sent mornings" },
    { value: "16 of 16", label: "weekday mornings sent since the October 7 fix", ring: 1 },
    { value: "0", label: "new numbers Gemini can put in the report; code checks its paragraph on every run" },
    // First commit Sep 8 (commits-index.csv); first report from the scheduled job Sep 24 (BigQuery dsr.job_runs).
    { value: "16", unit: "days", label: "from the first commit on Sep 8 to the first report from the scheduled job" },
  ],
  svg,
  views: [
    { id: "morning", label: "The 6:20 run", focus: ["scheduler", "landing", "pipeline", "engine", "bq", "reports"], note: "The scheduler wakes the job. It reads the landed exports, loads BigQuery, runs the pure engine and writes the report." },
    { id: "mail", label: "No mailbox credential", focus: ["lab", "bridge", "landing", "reports", "mailer", "vp"], note: "A script in the VP's own account copies two attachments in and sends the finished report out once a day." },
    { id: "prose", label: "Numbers first, prose second", focus: ["pipeline", "engine", "gemini"], note: "The engine makes every number. Gemini sees only those and writes a paragraph that code checks before it ships." },
    { id: "dashboard", label: "The dashboard", focus: ["vp", "web", "bq", "reports"], note: "Behind IAP: the report as sent, every run with its steps, and the one monthly figure typed by hand." },
  ],
  parts: {
    lab: {
      kind: "Lab case system",
      owner: "outside",
      what: "MagicTouch DLCPM, the lab's case system, emails two exports to the VP of Finance: invoice lines at about 6:02 AM and the new starts reports at 7 PM. Both carry patient names.",
      source: "packages/pipeline/dsr_pipeline/landing.py:11",
    },
    bridge: {
      kind: "My script",
      owner: "mine",
      what: "A short Apps Script in the VP's own Google account. Every 15 minutes it asks Gmail for headers and the attachment layout only, and copies matching .xls files into the landing bucket, where that account can add files and do nothing else.",
      fails: "One bad message is retried on the next tick without holding up the others, and an upload that already landed is never overwritten.",
      source: "mailbridge/Code.gs:27",
    },
    landing: {
      kind: "Managed storage",
      owner: "managed",
      what: "A Cloud Storage bucket encrypted with the project's own key and labelled as holding patient data. A landed file is archived and deleted only after a run that read it finishes, and anything left after 30 days is deleted.",
      source: "infra/terraform/mailbridge.tf:13",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Cloud Scheduler job dsr-pipeline-daily starts the job at 5, 20, 35 and 50 past each hour from 6 to 11 AM New York time, Monday to Friday, with an OAuth token from a service account allowed to start this one job.",
      fails: "The job has no retries of its own. A crash leaves the files in place and the next slot reads them again.",
      source: "scripts/deploy_job.sh:26",
    },
    pipeline: {
      kind: "My job",
      owner: "mine",
      what: "dsr-pipeline on Cloud Run, Python 3.12, one task with a 15 minute timeout. It takes a lock, reads the settled files, drops patient and practice fields as it parses, loads BigQuery, projects, runs nine checks, writes the commentary and publishes. A run with nothing new exits in about seven seconds.",
      fails: "Failed checks still compute and save, then hold the report. No invoice export by 11 AM ends the morning as missed. Either way an alert email goes out.",
      source: "packages/pipeline/dsr_pipeline/runner.py:1",
    },
    engine: {
      kind: "My package",
      owner: "mine",
      what: "dsr_engine: the VP's Excel model ported to pure Python with no file access, no network and no clock. Its 108 constants live in named, versioned sets, and the spec's 15 acceptance values are pinned to set 2026-07 by name.",
      fails: "A trailing window padded with empty months raises InsufficientHistory, so a padded series cannot drag a projection toward zero.",
      source: "packages/engine/dsr_engine/model.py:20",
    },
    gemini: {
      kind: "Managed model",
      owner: "managed",
      what: "Gemini 2.5 Flash on Vertex AI writes three to five sentences of commentary. Its only input is one payload of finished projections, bands and check results, built by a single function.",
      fails: "An error, a timeout or a paragraph that fails the guard ships the deterministic template, and the run records which one wrote it.",
      source: "packages/pipeline/dsr_pipeline/narrative.py:240",
    },
    bq: {
      kind: "Managed warehouse",
      owner: "managed",
      what: "BigQuery dataset dsr: daily revenue and starts with patient fields already gone, every run's projections and checks, every scheduled execution with its steps, and the monthly figures typed on the dashboard. A newer export marks older rows superseded and keeps them.",
      source: "packages/pipeline/dsr_pipeline/repository.py:434",
    },
    reports: {
      kind: "Managed storage",
      owner: "managed",
      what: "Cloud Storage for rendered reports, which hold aggregates only. Each run's report is archived here, and the morning's copy goes to an outbox the mail script reads.",
      source: "infra/terraform/mailbridge.tf:51",
    },
    mailer: {
      kind: "My script",
      owner: "mine",
      what: "The second step of the same Apps Script. It looks for today's report in the outbox and emails it once from the VP's own account, with a date flag so a later tick never sends it again.",
      fails: "The two steps run independently, so a failed upload in the first cannot stop the morning email.",
      source: "mailbridge/Code.gs:182",
    },
    web: {
      kind: "My app",
      owner: "mine",
      what: "dsr-web on Cloud Run, FastAPI, nine tabs in the Hybridge design system: Today, Email, Projections, Revenue, New starts, Runs, Pipeline, Monthly inputs and Run now. It shows the report exactly as sent and cannot read the raw attachments.",
      source: "packages/webapp/dsr_web/shell.py:335",
    },
    vp: {
      kind: "People",
      owner: "outside",
      what: "The VP of Finance, who built the Excel model and wrote the spec. The report arrives each weekday morning, and the dashboard opens for two named accounts through Google sign in.",
      source: "scripts/deploy.sh:62",
    },
  },
  breaks: [
    { title: "The invoice export is late", body: "Runs before it lands hold quietly and look again 15 minutes later. If nothing arrives by 11 AM, the morning is marked missed and an alert email goes out.", source: "packages/pipeline/dsr_pipeline/config.py:37" },
    { title: "A data check fails", body: "The projection still computes and lands on the dashboard marked failed. The email is held, and an alert built on the job's own log line emails me.", source: "scripts/setup_alerts.sh:1" },
    { title: "Gemini errs or invents", body: "The deterministic template, written from the same inputs, ships in its place. The run records which one wrote the paragraph.", source: "packages/pipeline/dsr_pipeline/narrative.py:240" },
  ],
  tuned: [
    { title: "Wait for a quiet bucket", body: "A run reads only after the bucket has been still for 5 minutes, since a morning's uploads take about half a minute. Since September 28 the report has been built between 6:21 and 6:25.", source: "packages/pipeline/dsr_pipeline/landing.py:45" },
    { title: "One run at a time", body: "A lock object created only if absent keeps two runs off the same files, so a day's revenue is never counted twice. A lock older than 20 minutes is taken over.", source: "packages/pipeline/dsr_pipeline/lock.py:1" },
    { title: "Nothing new, seven seconds", body: "532 of 610 scheduled runs found nothing new and exited in about seven seconds. The one that builds the report takes about 49.", source: "BigQuery dsr.job_runs, Oct 29 2026" },
  ],
  guards: [
    { title: "No mailbox credential", body: "Nothing in the project can read mail. The VP's own account copies the attachments in and may only add files to the landing bucket.", source: "infra/terraform/mailbridge.tf:1" },
    { title: "Patient fields dropped first", body: "Case numbers, patient and practice names, addresses and phones are dropped at parse time, listed by name, before anything reaches BigQuery.", source: "packages/pipeline/dsr_pipeline/parsers.py:54" },
    { title: "Every number checked", body: "A number in Gemini's paragraph that is missing from the payload, in any reasonable rounding, rejects it. So does a claim the spec tested and found unsupported.", source: "packages/pipeline/dsr_pipeline/narrative.py:209" },
  ],
  // Billing export for this project's account has 0 rows (enabled 2026-10-28):
  // project-docs/fde-refresh/costs/by-project.csv. No measured month yet.
  cost: null,
  // gcloud scheduler jobs list --project hybridge-dsr --location us-central1:
  // dsr-pipeline-daily, "5,20,35,50 6-11 * * 1-5" America/New_York. Every
  // report since Sep 28 came from the 6:20 slot (dsr.job_runs).
  live: {
    mode: "daily",
    label: "Next morning report",
    at: "06:20",
    days: [1, 2, 3, 4, 5],
    path: ["scheduler", "pipeline", "landing", "pipeline", "bq", "pipeline", "engine", "pipeline", "gemini", "pipeline", "reports", "mailer", "vp"],
    source: "Cloud Scheduler job dsr-pipeline-daily, weekdays every 15 minutes from 6:05 AM; the 6:20 run has built every report since Sep 28",
  },
};

export default arch;
