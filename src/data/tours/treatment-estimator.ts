import type { Tour } from "./types";

export const treatmentEstimator: Tour = {
  slug: "treatment-estimator",
  name: "Treatment Estimator",
  tail: "Estimates built live in the consult, with prices that never move.",
  post: "/posts/treatment-estimator",
  cover: "/treatment-estimator.png",
  kicker: "Pricing engine · Live consult tool",
  accent: "#F5A524",
  accentRgb: "245, 165, 36",
  pitch:
    "A treatment coordinator builds multi-option estimates live during the consult, clicking teeth on a chart and dragging treatments onto option cards while prices compute from that clinic's own versioned price book. Every saved line freezes its price at capture, so the document a patient signs is still reproducible six months later.",
  problem:
    "The old tool was a 10-year-old script wrapped around one spreadsheet: a rigid 14-step questionnaire that could not express a real consult, where treatments get added in minute 20 and dropped in minute 25. Coordinators hand-checked the math, and a price change silently rewrote history on past estimates.",
  metrics: [
    { label: "Price guarantee", value: "DB property", sub: "write-once capture columns, trigger-enforced" },
    { label: "Pricing coverage", value: "100%", sub: "line and branch coverage is a CI gate" },
    { label: "Tests", value: "316", sub: "incl. 11 golden fixtures from the legacy tool" },
    { label: "Shipped", value: "3 weeks", sub: "v1 to production, ~77 PRs over 3.5 months" },
  ],
  concepts: ["Domain modeling", "Immutable versioning", "Write-once invariants", "Property-based testing", "Golden fixtures", "Optimistic UI"],
  stack: ["Next.js", "TypeScript", "Postgres", "Auth.js + Workspace SSO", "Zustand", "TanStack Query", "react-pdf", "ExcelJS", "Playwright"],
  steps: [
    {
      title: "Start from the doctor's handoff",
      body: "The doctor finishes the exam: upper full-arch, lower conventional, show both a fixed and a removable option. The coordinator picks the patient, sets the arch scope, selects the consulting doctors, and gets a draft estimate while the patient is still in the chair.",
      screen: {
        kind: "cards",
        title: "New estimate · Jordan Rivera-Blake (synthetic)",
        cards: [
          { name: "Arch scope", lines: ["Upper + Lower"], badge: "both" },
          { name: "Doctors", lines: ["Dr. Sam Placeholder ★ primary"], badge: "1" },
          { name: "Estimate", lines: ["EST-100377 · Draft · Revision 1", "Northside Clinic (Demo)"] },
        ],
      },
    },
    {
      title: "Build options on a drag-and-drop canvas",
      body: "Treatment paths drag onto the canvas to create option cards; categories drag onto cards to open inline panels with a 32-tooth chart, staging rows, and surface pickers. Nothing blocks: incomplete answers show amber flags, hard problems show a red 'to fix' chip that jumps to the panel that fixes it, and everything autosaves.",
      screen: {
        kind: "cards",
        title: "Workspace · Upper arch",
        cards: [
          { name: "Option 1 · Full-Arch Fixed", lines: ["Phase 1 Emergent care: $3,900", "Phase 2 Reconstruction: $17,000", "6 implants on the tooth chart (#3, 5, 7, 10, 12, 14)"], badge: "$20,900", highlight: true },
          { name: "Option 2 · Removable Alternative", lines: ["Records and imaging: $500", "Extractions with bone prep: $3,100", "Definitive denture: $4,400"], badge: "$8,000" },
          { name: "Flags", lines: ["1 to answer: staging assignments incomplete", "✓ all changes saved"], badge: "amber" },
        ],
      },
    },
    {
      title: "Five pricing models, one resolver",
      body: "A shared procedure catalog defines what exists; each location's immutable price book defines how much. One resolver prices every line under one of five models, flat, tiered by zone, tiered, range, or per-surface, with tier counters that reset per arch per option and caps that clamp at the end. Illustrative ladder: first implant $1,500, second $1,400, third and after $1,300.",
      screen: {
        kind: "table",
        title: "Pricing engine trace (synthetic ladder)",
        headers: ["Line", "Model", "Tier", "Price"],
        rows: [
          ["Implant #3", "tiered", "1st", "$1,500"],
          ["Implant #5", "tiered", "2nd", "$1,400"],
          ["Implant #7", "tiered", "3rd+", "$1,300"],
          ["Extractions (arch)", "capped", "·", { text: "clamped at $2,500", tone: "warn" }],
          ["Filling #30, 3 surfaces", "per-surface", "3", "$300"],
        ],
      },
    },
    {
      title: "Prices freeze at capture",
      body: "Saving an option runs the engine against the currently published price book and writes each line with its price, price book version, tier, and label at capture, write-once columns protected by a database trigger. Publishing next month's prices can never move an estimate a patient already saw. The 6-month guarantee is a schema property, not a promise.",
      screen: {
        kind: "terminal",
        title: "Save option · transaction",
        lines: [
          "$ save option-1 (estimate EST-100377)",
          "load published price book PB-NRT-003",
          "resolve 5 lines → insert with *_at_capture columns",
          "trigger: UPDATE of captured price rejected ✓ (write-once)",
        ],
      },
    },
    {
      title: "Scenarios and adjustments",
      body: "Options compose into named scenarios, fixed upper with conventional lower against removable upper with conventional lower, and per-scenario adjustments stack: prepay courtesy, intake courtesy, anesthesia add-ons, custom rows. The patient compares final numbers side by side.",
      screen: {
        kind: "cards",
        title: "Scenarios (synthetic)",
        cards: [
          { name: "A · Fixed upper + conventional lower", lines: ["Options: $25,050", "Prepay courtesy −5%: −$1,252", "Intake courtesy: −$100"], badge: "$23,698", highlight: true },
          { name: "B · Removable upper + conventional lower", lines: ["Options: $12,150", "Prepay −5%, intake −$100", "General anesthesia: +$2,000"], badge: "$13,443" },
        ],
      },
    },
    {
      title: "Present, lock, and audit",
      body: "PDF for the patient, a clinical variant with procedure codes, and a print-formatted Excel all render from the same snapshotted lines as the live preview, so they cannot disagree. Marking the estimate presented snapshots a revision; any later edit opens revision n+1. An append-only audit table records every state change for six years.",
      screen: {
        kind: "table",
        title: "Audit trail (excerpt)",
        headers: ["When", "Actor", "Event"],
        rows: [
          ["14:02", "coordinator", "estimate created (EST-100377)"],
          ["14:19", "coordinator", "option saved · 5 lines captured @ PB-NRT-003"],
          ["14:31", "coordinator", { text: "marked presented → revision locked", tone: "good" }],
          ["14:32", "system", "PDF (patient) generated · logged"],
        ],
      },
    },
  ],
  architecture: [
    { lane: "Frontend", items: ["Next.js App Router, server components for reads", "Zustand workspace store + TanStack Query", "Debounced live pricing preview (~200 ms)"] },
    { lane: "Pricing core", items: ["Shared procedure catalog: zones, tooth maps, caps", "Per-location immutable price book versions", "One resolver, five pricing models, resettable tier counters"] },
    { lane: "Integrity", items: ["Write-once *_at_capture columns, trigger-enforced", "Estimate revisions snapshot on present", "Append-only audit table, monthly partitioned"] },
    { lane: "Output & quality", items: ["react-pdf patient and clinical variants + ExcelJS", "100% pricing coverage gate · property-based invariants", "11 golden fixtures replayed from the legacy tool"] },
  ],
  outcome:
    "Coordinators build estimates the way consults actually flow instead of fighting a 14-step form, and the math stopped being anyone's job to double-check: lines must sum to subtotals, caps can never be exceeded, and every line carries the price book version that produced it, invariants enforced by property-based tests in CI and triggers in the database. All prices shown here are invented; the real fee schedules are the company's.",
};
