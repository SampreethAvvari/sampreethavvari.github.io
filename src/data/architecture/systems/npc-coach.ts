import type { Architecture } from "../types";
import svg from "../svg/npc-coach.svg?raw";

const arch: Architecture = {
  slug: "npc-coach",
  rank: 50,
  name: "NPC Coach",
  project: "NPC Coach",
  kind: "system",
  disciplines: ["aie"],
  post: "/posts/npc-coach",
  headline: "Grades new patient calls with Gemini.",
  tail: "Every five minutes, 6 AM to 6 PM.",
  lede:
    "Every five minutes from 6 AM to 6 PM, a Cloud Run Job pulls new recordings from the phone system's SFTP drop and keeps only real new patient calls on an NPC line. Gemini transcribes and judges each one with a quote per criterion, plain Python adds up the score, and the report lands in the NPC's inbox and on a dashboard.",
  titleBlock: [
    ["System", "NPC Coach"],
    ["Revision", "unversioned"],
    ["Live since", "Jun 18, 2026"],
    ["Runs on", "Cloud Run Jobs"],
    ["Region", "us-central1"],
    ["Rubric", "prompt v1.5.0"],
    ["NPC lines", "7 on the allow list"],
    ["Rollback", "previous image tag"],
    ["Scale", "100 points : 0 for booking"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    // BigQuery SELECT on npc_ops.call_manifest, calls dated Oct 1 to 29 2026, n = 172:
    // scored_at minus (call start + duration), median 13.9 minutes.
    { value: "14", unit: "min", label: "median from hang up to a graded call, in October" },
    { value: "1", unit: "poll", label: "at a time, held by a Firestore lease since reports went out twice" },
    // BigQuery SELECT on npc_ops.call_manifest, all rows (first call date Jun 17 2026).
    { value: "690", label: "calls graded out of 28,745 recordings read since June 17" },
    // per-repo.csv first commit Jun 2; npc-poller job created Jun 18 5:25 AM ET, first transcription 00:21 ET Jun 18.
    { value: "16", unit: "days", label: "from the first commit on Jun 2 to grading live calls on Jun 18" },
  ],
  svg,
  views: [
    { id: "five-minutes", label: "Every five minutes", focus: ["scheduler", "sftp", "poller", "grader", "gemini", "gcs", "bq"], note: "From 6 AM to 6 PM the scheduler wakes the poller, which pulls only new recordings and grades each one." },
    { id: "report", label: "The report email", focus: ["grader", "gmail", "staff"], note: "Each graded call's report goes to the NPC who took it, with a quote behind every score." },
    { id: "five-pm", label: "The 5 PM summary", focus: ["bq", "summary", "gmail", "staff"], note: "Weekdays at 5 PM a job reads the day's scores and emails leaders and every NPC with a graded call." },
    { id: "dashboard", label: "The dashboard", focus: ["staff", "webapp", "bq"], note: "Google sign in, then every graded call, its transcript, its recording and the trends per NPC." },
  ],
  parts: {
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Cloud Scheduler job npc-poller-5min starts the poller every 5 minutes from 6 AM to 6 PM, New York time. A second job starts the daily summary at 5 PM, Monday to Friday.",
      fails: "Calls that land overnight wait in the drop and grade on the 6 AM run, because every run takes each file it has not seen yet.",
      source: "src/processor/poller.py:87",
    },
    sftp: {
      kind: "Phone system drop",
      owner: "outside",
      what: "The phone system writes every recorded call to an SFTP server as a WAV file. The file name is the only metadata: date, time, direction and extension.",
      fails: "Files are never moved or deleted by the poller, so a missed run loses nothing. The next run picks up whatever it has not seen.",
      source: "src/processor/poller.py:57",
    },
    poller: {
      kind: "My job",
      owner: "mine",
      what: "Lists the drop and skips any file name it has already handled. Lines off the NPC allow list, call park recordings and calls under 60 seconds are tagged without ever reaching a model. A Firestore lease lets only one run work at a time.",
      fails: "One bad call is logged and skipped, and the next run retries it. If Firestore is down the lease fails open, so grading never stops.",
      source: "src/processor/poller.py:75",
    },
    grader: {
      kind: "My code",
      owner: "mine",
      what: "Transcribes the call, tags it, and asks Gemini Pro whether it really is a new patient talking to an NPC. Gemini Flash then returns six scores, three gate answers and a quote for each, and a plain Python function turns those into the 0 to 100 score.",
      fails: "A verdict that breaks the schema gets the exact field error sent back for a repair try. If it still fails, the call is saved as not gradeable with the reason.",
      source: "src/score/scorer.py:122",
    },
    gemini: {
      kind: "Managed model",
      owner: "managed",
      what: "Vertex AI Gemini 2.5. Flash transcribes and judges, Flash Lite tags, Pro is the relevance gate, and Flash writes the summary bullets.",
      fails: "Rate limits and short outages retry up to five times with backoff, so a blip does not fail a good call.",
      source: "src/common/transient_retry.py:38",
    },
    gcs: {
      kind: "Managed storage",
      owner: "managed",
      what: "Holds each call's transcript and full coaching report, plus MP3 copies of recordings the dashboard fetched on demand.",
      source: "src/manifest/transcript_archive.py",
    },
    bq: {
      kind: "Managed warehouse",
      owner: "managed",
      what: "One table has a row per recording with its tag, score and flags. Another keeps every criterion, gate and quote per graded call, so a trend per NPC is one query.",
      source: "src/score/bq_writer.py",
    },
    gmail: {
      kind: "Google Workspace",
      owner: "outside",
      what: "Sends each report to the NPC who handled the call, found by extension and by the name they gave on the call, plus two people who always get a copy. The same account sends the 5 PM summary.",
      source: "src/delivery/report_emailer.py:71",
    },
    staff: {
      kind: "People",
      owner: "outside",
      what: "Seven NPC lines, the NPC trainer and the practice leaders. They read the reports, dispute grades they think are wrong, and pull a call out of the numbers when it should not count.",
    },
    summary: {
      kind: "My job",
      owner: "mine",
      what: "At 5 PM on weekdays it reads the day's scores, keeps the latest one per call, and works out each NPC's averages in code. Gemini only writes the did well and needs work bullets. No graded calls means no email.",
      source: "src/summary/job.py:142",
    },
    webapp: {
      kind: "My app",
      owner: "mine",
      what: "FastAPI and React behind Google sign in for the practice domain. Every graded call with its report, transcript and recording, trends per NPC, and an x that takes a call out of every average.",
      fails: "Recording playback and the email button are best effort. If either is missing, only that route answers 404 and the rest of the page works.",
      source: "src/webapp/service.py:341",
    },
  },
  breaks: [
    { title: "Two runs overlap", body: "A run that outlasts five minutes holds a Firestore lease, so the next one exits at once. A stale lease expires after 70 minutes and the next run takes it over.", source: "src/processor/poll_lock.py:1" },
    { title: "Gemini hits a rate limit", body: "429 and 503 errors retry up to five times with backoff inside the adapter. A call that still fails is logged and picked up by the next run.", source: "src/common/transient_retry.py:1" },
    { title: "The model breaks the schema", body: "The validation error goes back to the model for a repair try. If that fails too, the call is saved as not gradeable with the field that broke.", source: "src/score/scorer.py:122" },
  ],
  tuned: [
    { title: "Names before network calls", body: "A file name already in the table is skipped before any SFTP stat. Before this, a run made about 7,700 stat calls and could outlast the five minute schedule.", source: "src/processor/poller.py:101" },
    { title: "Filter before transcribing", body: "Lines off the allow list, call park files and calls under 60 seconds never reach a model. Of 28,745 recordings, 3,334 were ever transcribed.", source: "src/processor/poller.py:127" },
    { title: "Math outside the model", body: "Gemini returns six integers and three gate answers. A Python function does the 40/40/20 sum, so the same verdict always gives the same score.", source: "src/score/formula.py:1" },
  ],
  guards: [
    { title: "NPC lines only", body: "An allow list of NPC extensions decides what gets graded. Every other line is tagged and left alone, never transcribed.", source: "src/processor/poller.py:93" },
    { title: "Pinned SFTP host key", body: "The poller checks the server's key fingerprint before it logs in and refuses a mismatch.", source: "src/ingest_sftp/sftp_client.py:24" },
    { title: "Signed remove links", body: "The remove button in each email is a signed link for that one call. Opening it changes nothing; only the page's own POST removes the call, so mail scanners are harmless.", source: "src/delivery/remove_link.py:1" },
  ],
  // hybridge-npc-prod bills to its own account. Its billing export was switched on
  // Oct 28 2026 and has no rows yet (project-docs/fde-refresh/costs/by-project.csv).
  cost: null,
  live: {
    mode: "interval",
    label: "Next poll, 6 AM to 6 PM",
    everySeconds: 300,
    window: [6, 18],
    path: ["scheduler", "poller", "sftp", "poller", "grader", "gemini", "grader", "gmail", "staff"],
    source: "Cloud Scheduler job npc-poller-5min, every 5 minutes from 6 AM to 6 PM New York",
  },
};

export default arch;
