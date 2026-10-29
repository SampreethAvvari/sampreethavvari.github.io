import type { Architecture } from "../types";
import svg from "../svg/reconciliation.svg?raw";

const arch: Architecture = {
  slug: "reconciliation",
  rank: 140,
  name: "Reconciliation",
  project: "Insurance Reconciliation",
  kind: "system",
  disciplines: ["fde", "sde"],
  post: "/posts/reconciliation",
  headline: "Flags patients whose billing and notes disagree.",
  tail: "On Cloud Run since June 16.",
  lede:
    "Staff upload a day's schedule, ledger and clinical notes from Eaglesoft or Denticon, and a pure Python engine lines them up by patient id. Only the patients whose billing, notes or doctor disagree come back, on a dashboard and by email.",
  titleBlock: [
    ["System", "Reconciliation"],
    ["Revision", "v1.19.0"],
    ["Live since", "Jun 16, 2026"],
    ["Runs on", "Cloud Run, Firestore"],
    ["Region", "us-central1"],
    ["Sources", "Eaglesoft, Denticon"],
    ["Sign in", "Google, 2 domains"],
    ["Joins on", "patient id"],
    ["Scale", "3 exports : 1 short list"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "8.75", unit: "hours", label: "from the first commit, a design spec at 5:23 AM, to the first live revision" },
    { value: "85", unit: "false flags", label: "from one Monday run with Friday's notes. A date check now warns before anyone chases them" },
    // v1.13.0 "Kym's no-exam provider rule (7/24 spec)", commit 16:50 EDT,
    // revision ledger-notes-verifier-00026 created 20:52Z (gcloud run revisions list).
    { value: "Same day", label: "from a reviewer writing down the no exam rule on July 24 to it running live at 4:52 PM" },
    { value: "8 of 8", label: "patients a reviewer said were wrongly passed on one Rochester day, all flagged from v1.10.0" },
  ],
  svg,
  views: [
    { id: "one-day", label: "One day's check", focus: ["team", "pms", "ui", "app", "parsers", "engine"], note: "Staff upload the day's exports. The app parses them in a temp folder and the engine returns only the patients who disagree." },
    { id: "who-signed", label: "Who signed the note", focus: ["parsers", "engine", "registry"], note: "The billing doctor must appear in the note. Nicknames, fused Dr prefixes and small typos match; short names stay exact." },
    { id: "sign-in", label: "Sign in and history", focus: ["team", "ui", "signin", "app", "db"], note: "Google sign in on two practice domains plus an admin list. Each run is saved so a past day reopens in one click." },
    { id: "outbound", label: "Email and what is next", focus: ["app", "gmail", "engine", "gemini"], note: "The report email goes out through Gmail. The Gemini matcher is built and kept out of the verdict for now." },
  ],
  parts: {
    team: {
      kind: "People",
      owner: "outside",
      what: "The insurance and billing reviewers at the Hybridge implant offices and at Elmwood, the general practice. They export the day's files, upload them, and work the flagged list.",
      source: "docs/HANDOFF.md",
    },
    pms: {
      kind: "Practice systems",
      owner: "outside",
      what: "Elmwood runs Eaglesoft, whose CSV exports come in a Windows encoding with one header repeated three times. The implant offices run Denticon, whose .xlsx puts the header below title rows. The app never connects to either; staff export the files.",
      source: "engine/denticon.py:36",
    },
    ui: {
      kind: "My app",
      owner: "mine",
      what: "One page with a tab per source. Upload three files, or four with the perio charting report, then click a summary card to see each patient's schedule, ledger and note rows with tooth, surface, provider and amount. A Reports tab reopens any past day.",
      source: "app/static/index.html",
    },
    signin: {
      kind: "My sign in",
      owner: "mine",
      what: "Google sign in, then two checks in the app: the address must be on one of the two practice domains, and an admin must have added the person. A valid login nobody added sees a pending page.",
      source: "app/auth/routes.py:124",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "FastAPI on Cloud Run with 512 MiB, deployed from source with the version bumped on every deploy. It writes the uploads to a private temp folder, runs the engine, and deletes the folder when the request ends.",
      fails: "A failed email or a failed history save never blocks the result. The report still comes back, with the email error on it.",
      source: "app/main.py:200",
    },
    parsers: {
      kind: "My code",
      owner: "mine",
      what: "One adapter per source finds columns by name and emits the same typed rows, so no check knows which system a file came from. A missing column stops the run with an error that names it.",
      fails: "If someone uploads the wrong Denticon report, the reader cannot find its header row and says which report to export instead.",
      source: "engine/parsing.py:49",
    },
    engine: {
      kind: "My code",
      owner: "mine",
      what: "A pure function with no network, no database and no clock; the run time is passed in, so the same files give the same result. It joins on patient id and runs every check: money and note, billing doctor, no exam codes, note codes against the ledger, perio proof and deliveries.",
      source: "engine/reconcile.py:317",
    },
    registry: {
      kind: "My code",
      owner: "mine",
      what: "Maps every provider number and name to one dentist, with nicknames and initials. A name matches within one typo, two for long names, and names under five letters must match exactly.",
      source: "engine/providers.py:132",
    },
    db: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore keeps the user list, the Gmail connection and every saved run, so a past day reopens in one click and a flagged patient can be marked fixed.",
      source: "app/reports.py:63",
    },
    gmail: {
      kind: "Email",
      owner: "managed",
      what: "An admin clicks Connect Gmail once and reports go out as that person. The email is built from the same result as the dashboard, so the two match.",
      source: "app/report_email.py",
    },
    gemini: {
      kind: "Planned",
      owner: "planned",
      what: "Planned, not live. A Gemini matcher that lines up each billed procedure with the note by tooth, surface and wording. It is built and stays out of the verdict until the reviewers confirm each practice's terminology list.",
      source: "app/verify.py:106",
    },
  },
  breaks: [
    { title: "Notes from another day", body: "A Monday run with Friday's notes once showed 85 patients as billed with no note. The engine now compares the dates inside both files and warns on the report and in the email subject.", source: "engine/reconcile.py:295" },
    { title: "The wrong report uploaded", body: "The Denticon reader looks for its header row. When it is missing, the error names the report to export instead of guessing.", source: "engine/denticon.py:36" },
    { title: "The email does not send", body: "A mail failure never blocks the result. The report still shows, with the email error on it.", source: "app/main.py:215" },
  ],
  tuned: [
    { title: "Time passed in", body: "The engine takes the run time as an argument instead of reading the clock, so the same three files give identical output.", source: "engine/reconcile.py:317" },
    { title: "Split notes stitched back", body: "Eaglesoft leaves line breaks in note text unquoted, so long notes split across rows. Rejoining them cleared 4 false flags on one test day and cut provider mismatches from 21 to 13.", source: "engine/parsing.py:85" },
    { title: "Columns by name", body: "Eaglesoft repeats a header and Denticon moves it below title rows, so every adapter finds columns by name, never by position.", source: "engine/parsing.py:28" },
  ],
  guards: [
    { title: "Patient id, never the name", body: "Every file joins on patient id, read from the end of the notes' sort name where there is no id column. An appointment with no id goes to a person to confirm.", source: "engine/matching.py:44" },
    { title: "Domain plus allowlist", body: "Only the two practice domains can sign in, and only people an admin added get past the pending page.", source: "app/auth/routes.py:124" },
    { title: "Email stays on the domain", body: "An extra recipient must be an address on an allowed domain, checked before any file is read.", source: "app/main.py:191" },
  ],
  // hybridge-ledger-verifier is billed to an account whose export switched on
  // Oct 28, 2026 and has no rows yet (project-docs/fde-refresh/costs/by-project.csv).
  cost: null,
  // Request driven: the Cloud Scheduler API is not enabled in
  // hybridge-ledger-verifier. One run: upload, parse, check, save, back.
  live: {
    mode: "event",
    label: "A day's exports",
    everySeconds: 14,
    path: ["team", "ui", "app", "parsers", "engine", "parsers", "app", "db", "app", "ui", "team"],
    source: "a reviewer uploads the day's schedule, ledger and notes",
  },
};

export default arch;
