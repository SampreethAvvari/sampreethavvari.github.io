import type { Architecture } from "../types";
import svg from "../svg/accounting-automation.svg?raw";

const arch: Architecture = {
  slug: "accounting-automation",
  rank: 145,
  status: "preview",
  statusNote: "Offline, billing is off",
  name: "Accounting Tools",
  project: "Accounting Automation",
  kind: "system",
  disciplines: ["fde"],
  post: "/posts/accounting-automation",
  headline: "Runs our controller's nine accounting scripts from one page.",
  tail: "Built in one evening on Cloud Run.",
  lede:
    "Our controller uploads an export from Denticon, Paychex, Ramp, the bank or the lab system, and the page names the script, asks its questions in one form and hands back a QuickBooks import or a clean workbook. Reference workbooks and run logs sit in a Cloud Storage bucket, and every script edit is tested before it is committed to GitHub.",
  titleBlock: [
    ["System", "Accounting Tools"],
    ["Revision", "unversioned"],
    ["Live since", "May 20, 2026"],
    ["Runs on", "Cloud Run, GCS"],
    ["Region", "us-central1"],
    ["Contract", "prescan, then run"],
    ["Sign in", "IAP, Google"],
    ["Instances", "0 to 3, 1 hour runs"],
    ["Scale", "26 prompts : 0 terminals"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "62", unit: "minutes", label: "from the first commit to the first live revision on May 20" },
    { value: "2", unit: "bugs", label: "in the old scripts, fixed in the move: a missing comma and a misplaced line" },
    // First commit 16:12 EDT (commits-index.csv); editor commit 20f7223 at 19:54;
    // revision hybridge-accounting-tools-00014 created 23:56Z (gcloud run revisions list).
    { value: "3.7", unit: "hours", label: "from the first commit to the browser editor our controller asked for, live at 7:56 PM" },
    { value: "26", unit: "prompts", label: "typed into a terminal across the nine old scripts, now asked up front in one form" },
  ],
  svg,
  views: [
    { id: "run", label: "Run a script", focus: ["controller", "exports", "ui", "app", "scripts", "bucket"], note: "Upload an export, the page names the script, the script asks its questions, then runs and leaves a file to download." },
    { id: "questions", label: "Questions first", focus: ["ui", "app", "scripts"], note: "Every script answers prescan before run, so the prompts it used to ask in a terminal come up as one form." },
    { id: "edit", label: "Edit a script", focus: ["controller", "ui", "app", "github", "iap"], note: "A change must compile and pass its smoke test in a copy before it is committed to GitHub." },
    { id: "checks", label: "Checks import", focus: ["gmail", "cron", "scripts", "sheets"], note: "A second service from the same image pulls check sheets from Gmail labels into the outstanding checks Sheet." },
  ],
  parts: {
    controller: {
      kind: "People",
      owner: "outside",
      what: "Our controller is the person it was built for. They upload an export, answer the questions, and download the result to import into QuickBooks.",
      source: "README.md",
    },
    iap: {
      kind: "Sign in",
      owner: "managed",
      what: "Identity Aware Proxy lets in only the accounts on its allowlist. The app still verifies IAP's signed header on every request, ES256 against Google's keys, with issuer and audience checks.",
      source: "app/auth.py:32",
    },
    github: {
      kind: "Code host",
      owner: "outside",
      what: "The private repo holds the app and the nine scripts. The container clones it at start, and a published edit becomes a commit with a version history and a revert button.",
      fails: "Without a checkout the app still starts and runs scripts; only the editor turns off.",
      source: "app/git_ops.py:34",
    },
    exports: {
      kind: "Source files",
      owner: "outside",
      what: "Denticon collections and production, Paychex time off, the bank's transaction detail, Ramp, a QuickBooks aging summary and two exports from the lab system. The page recommends a script from the file name.",
      source: "app/recommender.py",
    },
    ui: {
      kind: "My app",
      owner: "mine",
      what: "Server rendered pages with htmx: Run a script, Scripts with a Monaco editor and a diff view, Reference files, Run history, and an Access tab for admins.",
      source: "app/templates",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "FastAPI on Cloud Run, no minimum instances, at most three, with a one hour timeout for long runs. It never imports a script; each one runs as its own process with JSON in and out.",
      fails: "A script that crashes returns its exit code and stderr to the page, and the server keeps running.",
      source: "app/runner.py:33",
    },
    scripts: {
      kind: "My code",
      owner: "mine",
      what: "The nine scripts our controller already ran, moved onto one contract. Prescan reads the file and returns every question without writing anything; run does the work with the answers. Cashflow import adds a second step to delete matched checks after a confirm.",
      source: "scripts/_lib.py:73",
    },
    sheets: {
      kind: "Spreadsheets",
      owner: "managed",
      what: "Cashflow import writes matched bank rows to the cashflow Sheet after a confirm per tab. The checks import appends to the outstanding checks tabs.",
      source: "scripts/cashflow_import.py:745",
    },
    bucket: {
      kind: "Managed storage",
      owner: "managed",
      what: "Mounted at /data with GCS Fuse, so the scripts open the reference workbooks as plain files. Versioning keeps old reference files. Uploads are deleted after 7 days and outputs after 30.",
      source: "deploy/setup_gcp.sh:57",
    },
    cron: {
      kind: "My service",
      owner: "mine",
      what: "The same image deployed a second time in cron mode, with only the cron routes, no IAP, and only the scheduler's account allowed to call it. The repo's setup script schedules it hourly, and a Run now button starts it too.",
      source: "deploy/setup_scheduler.sh:24",
    },
    gmail: {
      kind: "Email",
      owner: "managed",
      what: "The checks import reads unread spreadsheet attachments under two Gmail labels, Hybridge and Buffalo, and appends each to its own tab.",
      source: "scripts/checks_import.py:34",
    },
  },
  breaks: [
    { title: "A script crashes mid run", body: "It runs as its own process, so the server stays up and the page shows the exit code and the error output.", source: "app/runner.py:33" },
    { title: "A published edit is broken", body: "py_compile and the script's smoke test run in a copy first. On a failure the editor shows the error and nothing is committed.", source: "app/script_publish.py:20" },
    { title: "No git checkout at start", body: "The app starts anyway with the editor turned off, so running scripts still works.", source: "app/git_ops.py:34" },
  ],
  tuned: [
    { title: "Scale to zero", body: "No minimum instances, at most three, one CPU and 1 GiB, with an hour allowed for a long run.", source: ".github/workflows/deploy.yml" },
    { title: "Excel stays Excel", body: "Reference data stayed in the three workbooks our controller already edits, on a GCS Fuse mount, instead of moving to a database.", source: ".github/workflows/deploy.yml:39" },
    { title: "The bucket cleans itself", body: "Uploads go after 7 days, outputs after 30, and old versions of reference files after 30.", source: "deploy/setup_gcp.sh:57" },
  ],
  guards: [
    { title: "IAP header verified", body: "Every request carries IAP's signed header, and the app checks its signature, issuer and audience before it reads the email.", source: "app/auth.py:32" },
    { title: "Questions before writes", body: "Prescan never writes. Each Google Sheet tab gets its own confirm question before anything is written.", source: "scripts/cashflow_import.py:745" },
    { title: "The last admin stays", body: "The Access tab refuses to remove the last admin, and every access change goes to an append only audit log.", source: "app/routes/access.py:88" },
  ],
  // hybridge-accounting-tools has no billing account linked now; the only
  // export rows are May 20, 2026 at $0 (project-docs/fde-refresh/costs/by-project.csv).
  cost: null,
  // Request driven for the main page. The hourly checks import job is in
  // deploy/setup_scheduler.sh but could not be listed (billing off).
  live: {
    mode: "event",
    label: "An export uploaded",
    everySeconds: 14,
    path: ["controller", "ui", "app", "scripts", "app", "bucket", "app", "ui", "controller"],
    source: "our controller uploads an export on the Run page",
  },
};

export default arch;
