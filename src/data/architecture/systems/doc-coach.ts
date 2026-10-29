import type { Architecture } from "../types";
import svg from "../svg/doc-coach.svg?raw";

const arch: Architecture = {
  slug: "doc-coach",
  rank: 40,
  name: "Doc Coach",
  project: "Doc Coach",
  kind: "system",
  disciplines: ["aie", "fde"],
  post: "/posts/clinical-rag",
  headline: "Grades each recorded Zoom consult with Gemini.",
  tail: "Runs on Cloud Run for three offices.",
  lede:
    "A Zoom webhook says a consult's transcript is ready, and one Cloud Run service scores it against the CEO's seven criteria with Gemini. The report goes to the doctor, the TC and the CEO, the chart note goes to the TC, and every consult becomes one row in a master Sheet that feeds the weekly report cards.",
  titleBlock: [
    ["System", "Doc Coach"],
    ["Revision", "unversioned"],
    ["Live since", "May 19, 2026"],
    ["Runs on", "Cloud Run, Firestore"],
    ["Region", "us-central1"],
    ["Model", "Gemini 2.5 Pro"],
    ["Rubric", "7 criteria, 25 checks"],
    ["Warm hours", "7 AM to 7 PM"],
    ["Scale", "1 consult : 1 row"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    // BigQuery audit table, transcript downloaded to pipeline_complete, October 2026.
    { value: "2.7", unit: "min", label: "median from transcript to sent report in October, 9 in 10 under 3.8" },
    // app/api_lookup.py allowlist, pinned by a test (commit 87c3fc4).
    { value: "0", label: "score fields the one machine route can return, by allowlist and test" },
    // BigQuery audit table, distinct meetings with a completed QA run.
    { value: "471", unit: "consults", label: "scored live since May 19 across Rochester, Buffalo and Syracuse" },
    // commits-index.csv first commit 22dc199 at 7:28 PM May 19; audit table first pipeline_complete (qa) at 8:36 PM.
    { value: "68", unit: "min", label: "from the first commit on May 19 to the first live consult graded that night" },
  ],
  svg,
  views: [
    { id: "one-consult", label: "One consult", focus: ["zoom", "webhook", "runs", "pipeline", "gemini", "ledger", "gmail", "people"], note: "Zoom says the transcript is ready, the service answers 202, writes a run row, scores it and emails the report." },
    { id: "nothing-silent", label: "Nothing fails quietly", focus: ["webhook", "runs", "dashboard", "people"], note: "Every transcript event gets a run row before any gate, so a dropped consult shows red on the board instead of vanishing." },
    { id: "report-cards", label: "Report cards", focus: ["ledger", "cards", "gmail", "people", "dashboard"], note: "Monday at 8 AM and the first weekday of each month, stored scores become one comparison report for leadership and doctors." },
    { id: "warm-hours", label: "Warm hours", focus: ["scheduler", "webhook"], note: "Two scheduler jobs keep one instance warm 7 AM to 7 PM Eastern. At night a webhook cold starts one." },
  ],
  parts: {
    zoom: {
      kind: "Video calls",
      owner: "outside",
      what: "Two Zoom accounts, one per company. When a cloud recording's transcript is ready, Zoom posts a signed webhook, and the service downloads the VTT with that account's own server to server app.",
      source: "zoom-transcript-pipeline/app/webhook.py:77",
    },
    webhook: {
      kind: "My service",
      owner: "mine",
      what: "FastAPI on Cloud Run. It checks the HMAC signature and the timestamp, answers 202, and hands the work to a background task. For a transcript event it writes the run row before any other gate, so nothing can vanish unseen.",
      fails: "A bad signature gets a 401 and an audit row, never a run. A host it does not know still gets a red row that says how to add them.",
      source: "zoom-transcript-pipeline/app/webhook.py:1246",
    },
    runs: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore holds a row for every run, the claims that turn Zoom's repeat deliveries into one run, and tombstones for consults someone deleted. Point in time recovery and delete protection are on.",
      fails: "A claim left by a crash can be taken over after 15 minutes, so a dead worker never locks a meeting for good.",
      source: "zoom-transcript-pipeline/app/state.py:27",
    },
    pipeline: {
      kind: "My pipeline",
      owner: "mine",
      what: "The same service runs the steps in the background: skip what is not a consult, work out the doctor in three layers, score, render the report and PDF, write the chart note, archive, email, and append one ledger row.",
      fails: "Every failure carries a code. A sweep every 5 minutes reruns the retriable ones up to 3 times, resuming from the saved scorecard when there is one, then emails me.",
      source: "zoom-transcript-pipeline/app/auto_retry.py:54",
    },
    gemini: {
      kind: "Managed model",
      owner: "managed",
      what: "gemini-2.5-pro on Vertex AI, twice per consult: a scorecard as JSON checked against a schema, then the chart note. Scoring runs at temperature 0.2.",
      fails: "Cut off twice is a truncation error, wrong shape twice is a schema error, and an exhausted quota waits for a person instead of burning more.",
      source: "zoom-transcript-pipeline/app/scorer.py:312",
    },
    gmail: {
      kind: "Google Workspace",
      owner: "managed",
      what: "Two emails per consult on one Workspace OAuth grant: the color coded report with its PDF to the doctor, the TC and the CEO, and the chart note as plain copyable text to the TC.",
      fails: "Rate limits, OAuth refresh blips and dropped sockets retry three times with backoff. A run that scored but did not send shows amber, never green.",
      source: "zoom-transcript-pipeline/app/retry.py:54",
    },
    people: {
      kind: "People",
      owner: "outside",
      what: "Doctors, treatment coordinators and leadership in Rochester, Buffalo and Syracuse. The TC is always the Zoom host, and any doctor can pair with any TC.",
      source: "zoom-transcript-pipeline/app/identity_resolver.py:3",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Two Cloud Scheduler jobs set the service's minimum instances to 1 at 7 AM and 0 at 7 PM Eastern, without deploying a revision. Live since October 29.",
      fails: "If a wake fails nothing is lost. A webhook cold starts an instance, and the in process loops catch up on their next tick.",
      source: "zoom-transcript-pipeline/infra/main.tf:342",
    },
    ledger: {
      kind: "Google Workspace",
      owner: "managed",
      what: "Drive keeps each consult's transcript, scorecard, report PDF, chart note and video, filed by office, month and patient first name with last initial. A master Sheet keeps one 49 column row per consult.",
      fails: "Drive uploads are keyed in appProperties and the Sheet append checks the meeting id first, so a replay never writes twice.",
      source: "zoom-transcript-pipeline/app/sheets_ledger.py:10",
    },
    cards: {
      kind: "My pipeline",
      owner: "mine",
      what: "A loop inside the service checks every 5 minutes. Monday at 8 AM it reports the week before, and on the first weekday of a month the month before: one Gemini call per doctor, one for the comparison, a PDF and an email.",
      fails: "A Firestore marker makes each period fire once. If the first try fails before a report exists, the marker is released and the next tick tries again.",
      source: "zoom-transcript-pipeline/app/analysis_scheduler.py:1",
    },
    dashboard: {
      kind: "My app",
      owner: "mine",
      what: "A single page app served by the same service, behind Google sign in for the two company domains. All Runs, a Logs tab with a plain English view of every stage, Analytics with Analyse, and Settings.",
      source: "zoom-transcript-pipeline/app/auth_middleware.py:1",
    },
  },
  breaks: [
    { title: "Zoom sends it twice", body: "Delivery is at least once. A Firestore claim on the meeting and file turns repeats into one run, and a crashed claim can be retaken after 15 minutes.", source: "zoom-transcript-pipeline/app/state.py:1" },
    { title: "Gemini runs out of room", body: "On gemini-2.5-pro the thinking spends the same token budget as the answer. A cut response is never parsed, and the retry doubles the budget instead of repeating the prompt.", source: "zoom-transcript-pipeline/app/scorer.py:312" },
    { title: "A send fails after scoring", body: "The run turns amber. The sweep repairs only the missing email or Sheet row, without scoring again, up to 3 times, then emails me.", source: "zoom-transcript-pipeline/app/auto_retry.py:86" },
  ],
  tuned: [
    { title: "Budget, not retries", body: "After the September 11 incident the scoring ceiling went from 8,192 to 32,768 tokens. Unused ceiling costs nothing: thinking measured 3,534 tokens at 8,192 and 3,589 at 32,768.", source: "zoom-transcript-pipeline/config/pipeline.yaml:34" },
    { title: "Warm only in office hours", body: "One instance stays warm 7 AM to 7 PM Eastern instead of all night. CPU stays allocated, because the work runs after the 202 and would starve otherwise.", source: "zoom-transcript-pipeline/infra/main.tf:256" },
    { title: "Resume, do not restart", body: "Report and chart note run as two branches after scoring. A retry that finds a valid scorecard redoes only the branch that failed.", source: "zoom-transcript-pipeline/app/resume_policy.py:1" },
  ],
  guards: [
    { title: "Signed or refused", body: "Every webhook must match its account's HMAC within 5 minutes of its timestamp, compared in constant time.", source: "zoom-transcript-pipeline/app/security.py:22" },
    { title: "Scores stay in DocReview", body: "The one route another service can call is an allowlist with no score fields, and it fails closed when its secret is missing.", source: "zoom-transcript-pipeline/app/api_lookup.py:14" },
    { title: "No transcript text in logs", body: "The JSON logger redacts emails, phones and record numbers. Scoring failures log token counts and the finish reason, never the text.", source: "zoom-transcript-pipeline/app/logging_config.py:1" },
  ],
  // hybridge-zoom-pipeline bills to account 01257B, whose export was switched on
  // Oct 28, 2026 and is still empty (project-docs/fde-refresh/costs/by-project.csv).
  cost: null,
  live: {
    mode: "event",
    label: "Trace a finished consult",
    everySeconds: 14,
    path: ["zoom", "webhook", "runs", "webhook", "pipeline", "gemini", "pipeline", "ledger", "pipeline", "gmail", "people"],
    source: "a Zoom webhook that says a recording's transcript is ready",
  },
};

export default arch;
