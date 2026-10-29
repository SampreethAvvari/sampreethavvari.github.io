import type { Architecture } from "../types";
import svg from "../svg/patient-dashboard.svg?raw";

const arch: Architecture = {
  slug: "patient-dashboard",
  rank: 20,
  name: "CDF Patient Dashboard",
  project: "CDF Patient Hub",
  kind: "system",
  disciplines: ["fde", "sde"],
  post: "/posts/patient-dashboard",
  headline: "Puts each patient's records on one chart.",
  tail: "Built for coordinators at three offices.",
  lede:
    "The CDF dashboard reads the day's book from the Denticon mirror and puts intakes, estimates and recorded consults onto each patient's chart. Rules link what they can prove, a coordinator links the rest, and every link is one audited transaction.",
  titleBlock: [
    ["System", "CDF Patient Dashboard"],
    ["Revision", "v0.27.0"],
    ["Live since", "Jun 23, 2026"],
    ["Runs on", "Cloud Run, Firestore"],
    ["Region", "us-central1"],
    ["Checked", "453 of 453 links"],
    ["Undo", "On every link"],
    ["Rollback", "Traffic to last revision"],
    ["Scale", "4 systems : 1 chart"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "15", unit: "min", label: "at most between matcher runs while anyone has the dashboard open" },
    { value: "453 of 453", label: "blind test against bookings: when the rules picked a chart, it was the right one" },
    // hybridge-cdf docs/plans/2026-09-30-intake-links.md: name + booking links 81 of 103 real intakes.
    { value: "81 of 103", label: "real intakes the name and booking rule links by itself, measured Sep 30. A coordinator confirms the rest" },
    { value: "259", unit: "links", label: "written by the first backfill with 0 errors, each audited and undoable" },
  ],
  svg,
  views: [
    { id: "day-list", label: "The day's list", focus: ["mirror", "links", "app", "board", "staff"], note: "Coordinators open a day of the book from the mirror and click a patient to see every record on one profile." },
    { id: "record-links", label: "Record links", focus: ["estimator", "docreview", "mirror", "links", "app", "records"], note: "Rules put consults and estimates on a chart. Each write is one audited transaction, and a person's call always wins." },
    { id: "intake-event", label: "Intake finished", focus: ["renderer", "app", "links", "records"], note: "The renderer posts a signed event, the CDF links the intake and answers, and a sweep catches any lost event." },
    { id: "sign-in", label: "Sign in", focus: ["staff", "auth", "board", "app"], note: "Google sign in, then a signed session cookie that only company accounts can get." },
  ],
  parts: {
    estimator: {
      kind: "My service",
      owner: "mine",
      what: "The treatment estimator's lookup sends each patient's estimates and the stage its own list shows: draft, saved, presented, accepted, payment or declined. Counts and dates only, never an amount.",
      fails: "The CDF gives up after 10 seconds and does not keep the failure, so the next caller simply tries again.",
      source: "lib/profiles/lookups.ts:90",
    },
    renderer: {
      kind: "My service",
      owner: "mine",
      what: "The survey side's report renderer posts an intake finished event, signed with a Google identity token, once an intake's reports exist. The CDF checks the token's audience and caller, links the intake, and acknowledges.",
      fails: "Two quick tries, then a Cloud Task retries ten times over about 25 minutes, then one alert with ids only. The sweep links the intake anyway.",
      source: "docs/plans/2026-09-30-intake-links.md",
    },
    auth: {
      kind: "Sign in",
      owner: "managed",
      what: "Sign in with Google, checked on the server, then an httpOnly session cookie the app signs itself. Only the company's own Google accounts get one, and it fails closed if the signing secret is missing.",
      source: "lib/session.ts:11",
    },
    mirror: {
      kind: "Managed database",
      owner: "managed",
      what: "The Firestore copy of Denticon that the sync service keeps: charts, the appointment book, providers and chairs. The dashboard reads it and never writes it.",
      source: "lib/registry/README.md",
    },
    links: {
      kind: "My module",
      owner: "mine",
      what: "Puts recorded consults, estimator patients and intakes onto Denticon charts: the record's own id first, then the old Rochester chart number, then one name on that office's book for the day, held to the visit time or the doctor. Anything unsure goes to a person as a shortlist.",
      fails: "A run holds a lease so two never overlap, records itself before writing so it can be undone, and stops starting new records after 200 seconds. The next run carries on.",
      source: "docs/plans/2026-09-30-record-links.md",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "Next.js 15 on Cloud Run with one warm instance. Seven tabs: Patients, Intake survey, Manual intake, Patient experience, Estimates, Consultations and Feature requests. It ships only from a version tag.",
      fails: "Cloud Run keeps every revision, so a bad release goes back by moving traffic to the last one.",
      source: "docs/deploy.md:294",
    },
    board: {
      kind: "My app",
      owner: "mine",
      what: "Patients is the landing page: a day, or a range up to 31 days, of every visit plus the intakes submitted then, filtered by the scheduler's own visit types. A profile joins every record on the Denticon id at read time, with a journey from intake to the next visit.",
      source: "docs/HANDOFF.md:449",
    },
    staff: {
      kind: "People",
      owner: "outside",
      what: "Treatment coordinators and office staff in Rochester, Buffalo and Syracuse. They decide any link the rules cannot prove, and no rule ever overwrites their decision.",
    },
    docreview: {
      kind: "My service",
      owner: "mine",
      what: "The consult grader's lookup sends each recorded consult with its note, recording, transcript and Drive folder. Never the scoring: its projection is an allowlist, and the CDF drops anything score shaped as a second lock.",
      fails: "The CDF gives up after 12 seconds and keeps no failure. A good answer is shared for three minutes, because each call reads a thousand documents on the other side.",
      source: "lib/profiles/lookups.ts:193",
    },
    records: {
      kind: "Managed database",
      owner: "managed",
      what: "Firestore patients, reports, record links and the audit log, with report PDFs in Cloud Storage. Documents staff add are stored under the record id only, because file names carry patient names.",
      source: "docs/HANDOFF.md:462",
    },
  },
  breaks: [
    { title: "An intake event is lost", body: "The renderer retries for about 25 minutes, then alerts. The sweep links every intake without a chart whenever the dashboard is in use, so a lost event delays a link and never loses one.", source: "docs/plans/2026-09-30-intake-links.md" },
    { title: "A lookup is down", body: "Estimator calls give up at 10 seconds and DocReview at 12. A failure is never cached, so the next caller tries again.", source: "lib/links/sources.ts:15" },
    { title: "The evidence changes later", body: "Recent automatic links are worked out again on every run, and one whose evidence no longer holds is withdrawn rather than left standing.", source: "docs/plans/2026-09-30-record-links.md" },
  ],
  tuned: [
    { title: "Join at read time", body: "A profile resolves each record once: a link first, then the record's own id. There is no copied master table to drift.", source: "docs/HANDOFF.md:454" },
    { title: "One read, shared three minutes", body: "Profiles, the directory, the link sheet and the sweep share each lookup's answer instead of fetching it four times.", source: "lib/links/sources.ts:15" },
    { title: "Sweep when the page opens", body: "Opening the dashboard starts a matcher run when the last finished one is older than 15 minutes. No extra scheduler job to run or watch.", source: "app/api/links/sweep/route.ts:29" },
  ],
  guards: [
    { title: "A person's call wins", body: "The matcher never touches a link a person decided and never links a chart a person rejected.", source: "lib/links/store.ts:123" },
    { title: "Decide again inside the write", body: "Every link write is one transaction that rereads the mirror, decides again and writes its audit entry. A stale screen gets a 409, not an overwrite.", source: "lib/links/store.ts:119" },
    { title: "Never the scores", body: "Consult scoring never reaches this screen. The upstream sends an allowlist, and the CDF strips anything named like a score, percent or grade.", source: "lib/profiles/lookups.ts:193" },
  ],
  // hybridge-assessment-dev is not measured: its billing export has 0 rows
  // (enabled 2026-10-28). project-docs/fde-refresh/costs/by-project.csv
  cost: null,
  live: {
    mode: "event",
    label: "An intake finishes",
    everySeconds: 14,
    path: ["renderer", "app", "links", "mirror", "links", "app", "records", "app", "renderer"],
    source: "the report renderer's intake finished event, sent when an intake's reports exist",
  },
};

export default arch;
