import type { Architecture } from "../types";
import svg from "../svg/cbct-scan-validator.svg?raw";

const arch: Architecture = {
  slug: "cbct-scan-validator",
  rank: 80,
  status: "preview",
  statusNote: "Testing on real scans",
  name: "CBCT Scan Validator",
  project: "CBCT Scan Validator",
  kind: "system",
  disciplines: ["mle"],
  post: "/posts/cbct-scan-validator",
  headline: "Flags bad CT scans before design.",
  tail: "$62 in October, on CPU.",
  lede:
    "The lab's case system exports each CBCT case zip to an SFTP box, a new zip in the bucket fires Eventarc, and a frozen dental encoder on Cloud Run CPU scores it and sends the verdict PDF back through the same box. Labeled Drive folders become training tensors each morning, and the testing team checks the model on real studies in a review app with its own scoreboard.",
  titleBlock: [
    ["System", "CBCT Scan Validator"],
    ["Revision", "v0.6.1"],
    ["Live since", "Apr 22, 2026"],
    ["Runs on", "Cloud Run, a VM"],
    ["Region", "us-east1"],
    ["Encoder", "OpenVINO, CPU"],
    ["Holdout", "20 scans, never trained on"],
    ["Rollback", "One command"],
    ["Scale", "1 miss : 15 false alarms"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "2.2", unit: "s", label: "per pass of the frozen encoder on CPU with OpenVINO, measured before deploy" },
    { value: "20", unit: "scans", label: "in a frozen holdout the trainer refuses to train on" },
    // Mar 25 to May 1, 38 calendar days (git-stats/per-repo.csv); Model H at 5:44 AM May 1 (commits-index.csv).
    { value: "38", unit: "days", label: "from the first commit on Mar 25 to Model H, the model it runs today, on May 1" },
    { value: "26 of 30", label: "bad studies the testing team found that the model also flagged, Aug 19 to Oct 28" },
  ],
  svg,
  views: [
    { id: "a-scan", label: "A scan arrives", focus: ["dlcpm", "sftp", "bucket", "eventarc", "validator"], note: "The lab system exports a case over SFTP, a new zip in the bucket fires Eventarc, and the validator scores it on CPU." },
    { id: "way-back", label: "The verdict goes back", focus: ["validator", "sftp", "dlcpm"], note: "The verdict PDF goes back through the same SFTP box, named so the lab system files it on the right case." },
    { id: "training", label: "Training data", focus: ["drive", "etl", "trainer", "bucket", "validator"], note: "Labeled Drive folders become versioned tensors each morning. A new head reaches the validator through the bucket." },
    { id: "testing", label: "The testing team", focus: ["testers", "iap", "review", "bucket", "bq"], note: "Testers upload a real study, see the verdict, record the true answer, and a live page counts hits and misses per model." },
  ],
  parts: {
    dlcpm: {
      kind: "Lab case system",
      owner: "outside",
      what: "MagicTouch DLCPM is where the lab's cases live. Its Import and Export Digital Files feature works over SFTP in both directions and matches files to cases by name, so the link needs no API license.",
      source: "docs/MagicTouch_Integration_Brief.md:21",
    },
    sftp: {
      kind: "My VM",
      owner: "mine",
      what: "cbct-sftp, an e2-small VM running OpenSSH. The lab's user is chrooted to two folders: drop for scans coming in, inbox for verdicts going out. A systemd service watches drop and copies each file to the bucket and to a Drive audit folder.",
      fails: "The local file is deleted only after both copies land. If either fails, the file stays in drop for the next event to retry.",
      source: "scripts/sftp_to_gcs_and_drive.py:8",
    },
    bucket: {
      kind: "Managed storage",
      owner: "managed",
      what: "One Cloud Storage bucket holds the inbox, processed cases, versioned training tensors, the holdout and the model head. A finished zip moves to processed/, so a repeat event finds nothing to run.",
      source: "scan_val/inference/service.py:326",
    },
    eventarc: {
      kind: "Managed events",
      owner: "managed",
      what: "Trigger cbct-inbox-trigger fires when an object finishes writing and posts it to the validator. Anything outside the inbox, or not a zip, gets a 200 and is skipped.",
      fails: "A real processing failure answers 500, so Eventarc retries it. The ack window is 600 seconds to cover a cold start.",
      source: "scan_val/inference/service.py:283",
    },
    validator: {
      kind: "My service",
      owner: "mine",
      what: "cbct-validator on Cloud Run: FastAPI, 2 vCPU and 8 GiB, at most 3 instances, scales to zero. A frozen dental segmentation encoder compiled to OpenVINO feeds a small trained head, and a rules router names the artifact family and the next step. It writes a PDF and JSON report, emails the PDF and pushes it back to the lab.",
      fails: "Email, the Drive archive and the write back are best effort, and each logs its own failure. The report is saved to storage before any of them run.",
      source: "scan_val/inference/service.py:274",
    },
    drive: {
      kind: "Google Workspace",
      owner: "outside",
      what: "Staff sort example scans into labeled folders in Drive: good scans, plus one folder per artifact type. That folder tree is the source of truth for training labels.",
      source: "scripts/training_data_sync.py:72",
    },
    etl: {
      kind: "My job",
      owner: "mine",
      what: "training-etl-sync, a Cloud Run job with 4 CPUs and 16 GiB, runs at 6 AM every day. It turns each new labeled zip into a tensor under a versioned prefix with the same ETL code the validator runs, and skips anything already done at that version. A lock object keeps two runs from overlapping.",
      fails: "A scan that fails twice moves to a Manual review folder in Drive, and I get an email.",
      source: "scripts/training_data_sync.py:125",
    },
    trainer: {
      kind: "My workstation",
      owner: "mine",
      what: "Training runs on my laptop's RTX 4080. The encoder stays frozen, so only a head of about 500,000 parameters trains, on tensors pulled from the bucket. The threshold is picked on validation data to minimise 15 times the misses plus the false alarms.",
      source: "scripts/build_and_eval_dentalseg_head.py:487",
    },
    iap: {
      kind: "Sign in",
      owner: "managed",
      what: "Identity Aware Proxy lets only Hybridge Google accounts reach the review app. The app records which account uploaded and which account judged each study.",
    },
    review: {
      kind: "My app",
      owner: "mine",
      what: "cbct-review on Cloud Run. A tester uploads a study straight to the bucket through a short lived signed link, the active model answers good or bad, and the tester records the true answer. A live page keeps a scoreboard per model, and a reviewed study can join the training pool, deduplicated by a hash of its volume.",
    },
    testers: {
      kind: "People",
      owner: "outside",
      what: "Three people on the testing team. Since August 19 they have uploaded 123 real studies and recorded the true answer on 103.",
    },
    bq: {
      kind: "Managed warehouse",
      owner: "managed",
      what: "BigQuery dataset cbct_review with three tables: inferences, verdicts and the training pool. Rows are only ever added. If a verdict changes, the newest row wins when the scoreboard reads it.",
    },
  },
  breaks: [
    { title: "Eventarc fires twice", body: "The first run moves the zip to processed/, so the second finds nothing to score. Skipped events answer 200 and real failures 500, so only real failures retry.", source: "scan_val/inference/service.py:326" },
    { title: "One upload of two fails", body: "The SFTP box deletes its copy only after the bucket and Drive both have the file. Until then the file waits in drop for the next retry.", source: "scripts/sftp_to_gcs_and_drive.py:8" },
    { title: "A scan will not convert", body: "The ETL tries twice, then moves the zip to a Manual review folder, logs the error and emails me.", source: "scripts/training_data_sync.py:16" },
  ],
  tuned: [
    { title: "Daily at 6 AM", body: "The training ETL woke every 5 minutes on 4 CPUs and 16 GiB, 53,086 runs since April. On October 28 it moved to once a day at 6 AM.", source: "Cloud Scheduler job training-etl-sync-trigger" },
    { title: "Encoder baked, head swapped", body: "The encoder is compiled into the image per release. The small head loads from the bucket at cold start, so a retrain ships without a rebuild.", source: "docs/PHASE1_PRODUCTION_PLAN.md:31" },
    { title: "OpenVINO on CPU", body: "2.20 seconds per encoder pass with OpenVINO, 2.56 with PyTorch and 3.93 with ONNX Runtime alone. The validator runs on CPU and scales to zero.", source: "docs/PATH_A_LATENCY_SPIKE_FINDINGS.md:36" },
  ],
  guards: [
    { title: "The holdout never trains", body: "Training stops before it starts if any of the 20 holdout studies appears in its labels. The split puts all 20 in the test set.", source: "scripts/run_train_v2.py:739" },
    { title: "SFTP only, chrooted", body: "The lab's user is locked into its own folder and can only speak SFTP. It gets no shell and no port forwarding.", source: "scripts/sftp-cloud-init.yaml:34" },
    { title: "Write back is a switch", body: "Pushing a verdict into the lab system needs an explicit flag on the service. With the flag off, the validator still scores and reports.", source: "scan_val/inference/dlcpm_writeback.py:41" },
  ],
  // GCP billing export, account 013C47, Oct 1 to 28 2026, net of credits
  // (project-docs/fde-refresh/costs/by-service.csv, cloud-run-by-service.csv).
  // Jobs CPU+memory is all training-etl-sync: drive-sync has been paused since Apr 29.
  cost: {
    total: "$62",
    period: "in October",
    method: "Measured from the Google Cloud billing export, October 1 to 28, net of credits. About three quarters is the training ETL, which woke every 5 minutes until October 28 and now runs once a day. The drop is not measured yet.",
    parts: [
      { label: "Cloud Run jobs, the training ETL", usd: 45.54 },
      { label: "SFTP VM, always on", usd: 11.23 },
      { label: "Image registry and storage", usd: 4.07 },
      { label: "Services, secrets, scheduler", usd: 0.92 },
    ],
  },
  // Event driven: Eventarc trigger cbct-inbox-trigger on object finalized
  // (gcloud eventarc triggers list). The daily ETL is the other rhythm.
  live: {
    mode: "event",
    label: "A new scan",
    everySeconds: 14,
    path: ["dlcpm", "sftp", "bucket", "eventarc", "validator", "sftp", "dlcpm"],
    source: "Eventarc trigger cbct-inbox-trigger, when a case zip lands in the bucket",
  },
};

export default arch;
