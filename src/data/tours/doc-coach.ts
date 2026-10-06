import type { Tour } from "./types";

export const docCoach: Tour = {
  slug: "doc-coach",
  name: "Doc Coach",
  tail: "Every consult graded and coached within minutes.",
  post: "/posts/clinical-rag",
  cover: "/doc-coach.png",
  kicker: "LLM pipeline · Consultation QA",
  accent: "#A78BFA",
  accentRgb: "167, 139, 250",
  pitch:
    "Every recorded patient consultation gets graded against a 7-part playbook by an LLM, turned into a color-coded coaching report, and emailed to the clinician, their coordinator, and leadership within minutes of the transcript landing.",
  problem:
    "Consultations are where treatment gets accepted or lost, and nobody had time to review them. Recordings piled up unwatched, coaching happened on gut feel, and every clinician ran the conversation their own way. The ask: make every consult reviewable, comparable, and coachable, automatically, without adding a minute of anyone's day.",
  metrics: [
    { label: "Delivery SLO", value: "< 10 min", sub: "transcript ready to inbox" },
    { label: "Scoring", value: "7 criteria · 70 pts", sub: "24 sub-criteria, versioned rubric" },
    { label: "Test suite", value: "~700 tests", sub: "85% coverage floor in CI" },
    { label: "Auto reports", value: "2 / week+month", sub: "zero clicks, scheduled" },
  ],
  concepts: ["Structured outputs", "JSON Schema validation", "LLM evals", "Identity resolution", "Prompt versioning", "Idempotent pipelines"],
  stack: ["Python", "FastAPI", "Cloud Run", "Vertex AI Gemini 2.5 Pro", "Firestore", "BigQuery", "Terraform", "Drive/Gmail APIs"],
  steps: [
    {
      title: "A recording finishes",
      body: "The video platform fires a webhook the moment a transcript is ready. The service verifies the signature, dedupes by meeting id, and filters out anything that is not a patient consultation: staff meetings, trainings, calls under 10 minutes, or meetings tagged to skip QA.",
      screen: {
        kind: "terminal",
        title: "Ingest",
        lines: [
          "$ webhook recording.transcript_completed",
          "signature ok · meeting 7f3a…d2 claimed (idempotent)",
          "filter: topic ok · 34 min ok · 3 participants ok",
          "→ dispatched to pipeline (run #482)",
        ],
      },
    },
    {
      title: "Who was in the room?",
      body: "Three-layer identity resolution: participant emails first, then display-name aliases, then an LLM tie-break on the transcript itself. If the clinician still cannot be resolved, the report goes to leadership only, clearly banner-marked, instead of guessing.",
      screen: {
        kind: "table",
        title: "Identity resolution",
        headers: ["Layer", "Signal", "Result"],
        rows: [
          ["1 · participants", "email match", { text: "coordinator: J. Okafor", tone: "good" }],
          ["2 · aliases", "display name", { text: "clinician: Dr. Chen", tone: "good" }],
          ["3 · LLM tie-break", "not needed", { text: "skipped", tone: "dim" }],
        ],
      },
    },
    {
      title: "One structured scoring call",
      body: "The versioned rubric plus the diarized transcript go to Gemini 2.5 Pro in structured-output mode. The response must validate against a strict JSON Schema: scores, evidence quotes, and coaching notes, or the call retries and then fails loudly. No free-form model text ever reaches the report.",
      screen: {
        kind: "terminal",
        title: "Scoring",
        lines: [
          "$ score run#482 rubric=v7 model=gemini-2.5-pro",
          "structured output → validate against schema v7",
          "scores: 7/7 criteria · 24/24 sub-criteria · evidence quotes: 9",
          "schema valid ✓ · baseline: 30-day averages loaded",
        ],
      },
    },
    {
      title: "The coaching report",
      body: "Scores only mean something against the clinician's own recent history, so every badge is relative: green when a criterion beats their 30-day average by half a point, red when it trails it. A new clinician gets neutral grays until history exists.",
      screen: {
        kind: "report",
        title: "Consultation QA · Dr. Chen · patient Alex Rivera (synthetic)",
        subtitle: "Total 52/70 · 74.3% · Run 1 · vs 30-day personal average",
        sections: [
          { name: "Building rapport", score: 9, max: 10, tone: "good", note: "▲ +1.4 vs average. Opened with genuine curiosity about the patient's travel plans and anchored the outcome conversation to them." },
          { name: "Presenting treatment paths", score: 6, max: 10, tone: "bad", note: "▼ −1.1. Two viable paths existed but only one was described; the patient had nothing to compare against." },
          { name: "Presenting fees", score: 5, max: 10, tone: "bad", note: "▼ −1.6. The fee was handed off to the coordinator. Deliver the number yourself, right after the value summary." },
          { name: "Compassion and professionalism", score: 9, max: 10, tone: "good", note: "▲ +0.7. Never rushed the patient's questions about healing time." },
        ],
      },
    },
    {
      title: "Archive, ledger, deliver",
      body: "Artifacts land in Drive by location and month, one idempotent row per consult lands in a 48-column ledger, a PHI-free audit row lands in the warehouse, and one email goes to the clinician, coordinator, and leadership. A sweeper retries anything stuck every five minutes.",
      screen: {
        kind: "table",
        title: "Ledger (excerpt)",
        headers: ["When", "Doctor", "Patient", "Score", "Status", "Trigger"],
        rows: [
          ["Aug 14 10:41", "Dr. Chen", "A. Rivera", { text: "74.3%", tone: "warn" }, { text: "complete", tone: "good" }, "webhook"],
          ["Aug 14 09:12", "Dr. Osei", "M. Sato", { text: "88.6%", tone: "good" }, { text: "complete", tone: "good" }, "webhook"],
          ["Aug 13 16:03", "Dr. Chen", "R. Novak", { text: "61.4%", tone: "bad" }, { text: "complete", tone: "good" }, "manual"],
        ],
      },
    },
    {
      title: "Weekly and monthly insight reports",
      body: "Every Monday at 8 AM, and on the first weekday of the month, a second layer aggregates all consults per clinician and across clinicians: strengths, opportunities, examples worth sharing, and trend lines. Framed as coaching, never as a ranking. Clinicians with under three consults are marked directional only.",
      screen: {
        kind: "bars",
        title: "Weekly insight · average score by clinician (synthetic)",
        bars: [
          { label: "Dr. Osei (6 consults)", value: 84, max: 100, tone: "good" },
          { label: "Dr. Chen (5 consults)", value: 76, max: 100, tone: "warn" },
          { label: "Dr. Ibarra (2 consults · directional only)", value: 71, max: 100 },
        ],
      },
    },
  ],
  architecture: [
    { lane: "Ingest", items: ["Video platform webhooks, HMAC-verified per account", "Firestore claim for idempotency", "Consult filters: topic, duration, participants, opt-out tag"] },
    { lane: "Understand", items: ["Diarized transcript parsing", "3-layer identity resolution", "30-day per-clinician baselines from the ledger"] },
    { lane: "Score and render", items: ["Gemini 2.5 Pro, structured output vs JSON Schema", "Versioned rubric in markdown, editable in the app", "Jinja2 → email-safe HTML → PDF"] },
    { lane: "Deliver and audit", items: ["Drive archive · 48-column Sheets ledger", "PHI-free audit rows in BigQuery", "Gmail delivery · 5-min retry sweeper · Terraform"] },
  ],
  outcome:
    "Every consultation is now reviewed within minutes, against the same bar, with evidence quotes a coach can act on. Leadership reads one weekly report instead of watching hours of recordings, and the rubric itself is versioned so scoring changes are deliberate, not drift. The seven criteria shown here carry generic names; the real playbook is company IP and stays private.",
};
