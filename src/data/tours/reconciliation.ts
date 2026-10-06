import type { Tour } from "./types";

export const reconciliation: Tour = {
  slug: "reconciliation",
  name: "Reconciliation",
  tail: "Three daily exports in, a dozen exceptions out.",
  post: "/posts/reconciliation",
  cover: "/reconciliation.png",
  kicker: "Deterministic engine · Revenue integrity",
  accent: "#34D399",
  accentRgb: "52, 211, 153",
  pitch:
    "Takes a dental practice's three daily exports, the schedule, the production ledger, and the clinical notes, and proves that every patient who was seen got both documented and billed. Staff review a dozen flagged exceptions instead of eyeballing three spreadsheets.",
  problem:
    "Two front office staff were each spending about three hours a day cross-checking three exports by hand: did everyone on the schedule get a note? Did every note get billed? Did the right provider bill it? Six person-hours daily, and misses meant either lost revenue or compliance risk.",
  metrics: [
    { label: "Manual work replaced", value: "6 h → 5 min", sub: "daily cross-check becomes exception review" },
    { label: "Auto-verified", value: "~30 / 41", sub: "patients on a typical day need no review" },
    { label: "Determinism", value: "byte-identical", sub: "same inputs always produce the same report" },
    { label: "Releases", value: "v1.16", sub: "240 tests, every rule traces to a staff review" },
  ],
  concepts: ["Deterministic core", "Record linkage", "Rule engines", "Auditability", "Adapter pattern", "Human feedback loops"],
  stack: ["Python", "FastAPI", "Cloud Run", "Firestore", "Google OAuth", "Docker", "GitHub Actions"],
  steps: [
    {
      title: "Upload three exports",
      body: "End of day, staff upload the schedule, the production ledger, and the clinical notes for one date, plus an optional perio charting export. Two practice management systems are supported through separate adapters; a wrong file fails loudly, naming the missing column, instead of producing a silently wrong answer.",
      screen: {
        kind: "cards",
        title: "Upload",
        cards: [
          { name: "Schedule", lines: ["appointments-0821.xlsx", "41 rows parsed"], badge: "ok" },
          { name: "Production ledger", lines: ["daily-journal-0821.xlsx", "118 rows parsed"], badge: "ok" },
          { name: "Clinical notes", lines: ["progress-notes-0821.csv", "notes reassembled across broken lines"], badge: "ok" },
          { name: "Perio charting (optional)", lines: ["perio-0821.xlsx", "enables one extra rule"], badge: "ok" },
        ],
      },
    },
    {
      title: "Messy files become typed records",
      body: "Real exports are hostile: duplicate column headers, junk title rows, merged cells, wrong encodings, notes split across rows by unquoted line breaks. Each adapter maps columns by name, never position, and emits the same typed records, each carrying its source spreadsheet row number for the audit trail.",
      screen: {
        kind: "terminal",
        title: "Parse",
        lines: [
          "$ reconcile --date 2026-08-21",
          "schedule: 41 appointments · ledger: 118 transactions · notes: 47",
          "join key recovered from trailing digits on sort-name field",
          "input hashes recorded (SHA-256) · every record carries its source row",
        ],
      },
    },
    {
      title: "Classify every patient",
      body: "Each scheduled patient gets two booleans: has production, has a real note (deleted notes and generic 'updated medical history' notes never count). Then the rule checks run: did the provider who billed appear in the note, do note and ledger codes agree, do the arches match, was perio charting done when billed.",
      screen: {
        kind: "bars",
        title: "Day summary · 41 scheduled patients (synthetic)",
        bars: [
          { label: "Verified, nothing to do", value: 30, max: 41, tone: "good" },
          { label: "Check mismatch", value: 4, max: 41, tone: "warn" },
          { label: "Money, no note", value: 2, max: 41, tone: "bad" },
          { label: "Note, no money", value: 2, max: 41, tone: "bad" },
          { label: "Neither (no-show)", value: 3, max: 41 },
        ],
      },
    },
    {
      title: "Work the flags",
      body: "The flag table says who, what bucket, and why in one sentence. Every verdict is explainable: click a row and the drill-down shows the exact schedule, ledger, and note rows that produced it.",
      screen: {
        kind: "table",
        title: "Flagged for review (synthetic)",
        headers: ["Patient", "Status", "Why"],
        rows: [
          ["Rowan Kestrel · 40118", { text: "Money, no note", tone: "bad" }, "Production posted but no note documents the visit. $0 delivery lines still need a note."],
          ["Marisol Vantwood · 40263", { text: "Provider mismatch", tone: "warn" }, "Ledger line billed by Dr. A. Placeholder, but the note is signed by a different doctor."],
          ["Desmond Ashgrove · 40391", { text: "Code mismatch", tone: "warn" }, "Note plans the upper arch; the ledger bills the opposite arch."],
        ],
      },
    },
    {
      title: "The engine never guesses at dates",
      body: "One real incident produced 85 phantom flags because staff exported the notes for the wrong day. Now a whole-run guard compares the dates inside the files and refuses to pretend: a loud banner says re-export, and the emailed report subject carries a warning prefix.",
      screen: {
        kind: "report",
        title: "Export coherence guard",
        sections: [
          {
            name: "Check your exports",
            tone: "warn",
            note: "The production ledger is mostly dated Aug 21 but the notes file is mostly dated Aug 20. Re-export the notes for Aug 21 before trusting this report.",
          },
        ],
      },
    },
    {
      title: "Close the loop",
      body: "Reports save to a searchable history; each flagged patient can be marked fixed, reversibly, so the next reviewer sees what was handled. The emailed summary mirrors the dashboard. Every rule in the engine traces back to a dated staff review session that requested it.",
      screen: {
        kind: "table",
        title: "Report history",
        headers: ["Date", "Flagged", "Fixed", "Verified"],
        rows: [
          ["2026-08-21", "8", { text: "5", tone: "good" }, "30"],
          ["2026-08-20", "11", { text: "11", tone: "good" }, "28"],
          ["2026-08-19", "9", { text: "9", tone: "good" }, "31"],
        ],
      },
    },
  ],
  architecture: [
    { lane: "Pure engine", items: ["No network, no database, no clock: same inputs, byte-identical output", "Per-source adapters map columns by name and fail loudly", "Typed records carry their source row for the audit trail"] },
    { lane: "Rules", items: ["7 primary buckets, 6 secondary checks", "Provider, exam, code, arch and perio cross-checks", "Every rule traces to a dated staff review"] },
    { lane: "App shell", items: ["FastAPI on Cloud Run, Google sign-in with allowlist", "Firestore: users, saved reports, fixed-flag state", "Self-service Gmail connect for sending reports"] },
    { lane: "Quality", items: ["240 tests across 21 files, CI on synthetic fixtures only", "Input SHA-256 hashes recorded per run", "Golden assertion pins engine behavior"] },
  ],
  outcome:
    "Six person-hours of daily spreadsheet triage became a five-minute exception review. Because the engine is deterministic and every verdict cites its source rows, staff argue with the data, not the tool, and each disagreement became a versioned rule release: v1.7 added provider verification, v1.8 added the wrong-day guard after the 85-phantom-flag incident, and by v1.16 all eight known false-verified cases flag correctly.",
};
