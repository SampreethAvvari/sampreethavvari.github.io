import type { Tour } from "./types";

export const npcCoach: Tour = {
  slug: "npc-coach",
  name: "NPC Coach",
  tail: "Every new patient call graded against the playbook.",
  post: "/posts/npc-coach",
  cover: "/npc-coach.png",
  kicker: "Speech + LLM pipeline · Call coaching",
  accent: "#FB7185",
  accentRgb: "251, 113, 133",
  pitch:
    "Every new-patient phone call gets transcribed and graded against the practice's documented playbook, producing a coaching report that quotes the exact moment a coordinator missed a non-negotiable, next to their own 90-day average.",
  problem:
    "New-patient coordinators are the practice's first advocates, and their calls set the tone for everything after. But nobody could listen to a thousand calls a month, so coaching was anecdotal. The design constraint came from the top: correctness beats conversion, and booking rate is explicitly not the success metric.",
  metrics: [
    { label: "First live day", value: "285 → 40", sub: "recordings ingested, relevant calls graded" },
    { label: "Volume", value: "1k to 5k calls/mo", sub: "5 to 10 minutes each, EN + ES" },
    { label: "Tests", value: "1,000+", sub: "across ~19k lines of Python" },
    { label: "Built in", value: "16 days", sub: "including the React dashboard" },
  ],
  concepts: ["Speech-to-text + diarization", "Structured LLM scoring", "Hard gates vs weighted scores", "Idempotent ingestion", "Ports and adapters", "Evidence-quoted evals"],
  stack: ["Python", "FastAPI", "Cloud Run", "Speech-to-Text v2", "Vertex AI Gemini", "Firestore", "BigQuery", "React", "Terraform"],
  steps: [
    {
      title: "Two ingestion paths, one call record",
      body: "Outbound calls arrive as MP3 drops on SFTP; inbound calls arrive from the call platform with a transcript already attached, which the pipeline reuses instead of paying to transcribe twice. Both normalize into one record, claim an idempotency key, and create a visible run row before any filtering, so no call can silently disappear.",
      screen: {
        kind: "terminal",
        title: "Ingest",
        lines: [
          "$ ingest SYN-4471.mp3 (inbound · transcript attached)",
          "idempotency key claimed · run row created (visible pre-filter)",
          "classify: new-patient call ✓ · not voicemail · not wrong-number",
          "transcript reused from platform → $0 transcription cost",
        ],
      },
    },
    {
      title: "Filter before grading",
      body: "Voicemails, wrong numbers, and non-new-patient calls get tagged out with a reason, not deleted. On the first live day, 285 recordings came in, 3 voicemails were auto-filtered, and 40 relevant new-patient calls were graded.",
      screen: {
        kind: "bars",
        title: "First live day (real counts)",
        bars: [
          { label: "Recordings ingested", value: 285, max: 285 },
          { label: "Relevant new-patient calls graded", value: 40, max: 285, tone: "good" },
          { label: "Flagged: missed a non-negotiable", value: 28, max: 285, tone: "warn" },
          { label: "Voicemails auto-filtered", value: 3, max: 285 },
        ],
      },
    },
    {
      title: "Score with hard gates, not just averages",
      body: "Six criteria cover advocacy, identity and referral framing, rapport, classification before conversion, sequencing, and differentiators. Three of them are hard gates: miss one and the score caps at 49 no matter how smooth the call sounded. Weighted buckets put 40% on rapport, 40% on classification, 20% on scheduling outcome.",
      screen: {
        kind: "report",
        title: "Call SYN-4471 · Coordinator C-3 · 6m 12s (synthetic)",
        subtitle: "Final 84/100 · coordinator 90-day average: 79",
        sections: [
          { name: "Rapport and advocacy (40%)", score: 9, max: 10, tone: "good", note: "Warm open, used the caller's name, acknowledged the anxiety mention before moving on." },
          { name: "Classification before conversion (40%)", score: 8, max: 10, tone: "good", note: "Scope and duration established before any scheduling talk." },
          { name: "Referral framing (hard gate)", score: 0, max: 1, tone: "bad", note: "Missed. Evidence: 'we're the office you'd want for that, let me just get you on the schedule.' Frame the source as a referral before scheduling." },
        ],
      },
    },
    {
      title: "Evidence or it did not happen",
      body: "Every scored criterion cites verbatim transcript evidence. An early version failed on 40% of calls because evidence extraction was too strict; the fix made quotes advisory where the rubric allows and added a relevance gate, a real lesson in designing LLM outputs that degrade gracefully.",
      screen: {
        kind: "chat",
        messages: [
          { from: "agent", text: "Criterion: classification before conversion · score 8/10" },
          { from: "agent", text: "Evidence: 'Before we look at times, can I ask how long this tooth has been bothering you, and is it one tooth or more?'" },
          { from: "agent", text: "Coaching: strong sequencing. One refinement: confirm duration explicitly ('weeks or months?') before offering the slot." },
        ],
      },
    },
    {
      title: "Runs are transparent end to end",
      body: "The React dashboard shows every run with a step-by-step progress stepper and logs panel: ingest, classify, transcribe, score, render, archive, deliver. A stuck or failed run is visible and retryable, never invisible.",
      screen: {
        kind: "table",
        title: "All runs",
        headers: ["Call", "Coordinator", "Duration", "Score", "Status"],
        rows: [
          ["SYN-4471", "C-3", "6m 12s", { text: "84", tone: "good" }, { text: "complete", tone: "good" }],
          ["SYN-4470", "C-1", "4m 45s", { text: "49 (gate cap)", tone: "bad" }, { text: "complete", tone: "good" }],
          ["SYN-4469", "C-5", "0m 38s", "·", { text: "filtered: voicemail", tone: "dim" }],
        ],
      },
    },
    {
      title: "Coaching lands with the coordinator",
      body: "Each report emails the coordinator and their manager: score, gates, evidence quotes, and one concrete next-call behavior, benchmarked against their own 90-day average rather than each other. Analytics roll up trends per coordinator and per criterion.",
      screen: {
        kind: "bars",
        title: "Coordinator trend · 90 days (synthetic)",
        bars: [
          { label: "C-3 average", value: 79, max: 100, tone: "good" },
          { label: "This call", value: 84, max: 100, tone: "good" },
          { label: "Team average", value: 74, max: 100 },
        ],
      },
    },
  ],
  architecture: [
    { lane: "Ingest", items: ["SFTP MP3 drops + call-platform webhooks", "One normalized call record, idempotency claims", "Run rows created before any gate: nothing disappears"] },
    { lane: "Understand", items: ["Speech-to-Text v2 with diarization (outbound)", "Platform transcripts reused (inbound), cost deduped", "Call classification: new patient vs everything else"] },
    { lane: "Score", items: ["Gemini structured output with response schema", "6 criteria, 3 hard gates, weighted buckets 40/40/20", "Verbatim evidence quotes with a relevance gate"] },
    { lane: "Deliver", items: ["React dashboard: runs, steppers, logs, analytics", "Email reports to coordinator + manager", "Firestore state · BigQuery audit · Terraform · ports-and-adapters demo mode"] },
  ],
  outcome:
    "A thousand-plus monthly calls now get the same rubric a human coach would apply on their best day, with receipts. The ports-and-adapters design means the whole pipeline runs on synthetic data in demo mode, which is exactly what this tour is. This is a PHI workload in production: no real transcripts, recordings, or caller details appear here, and coordinators are anonymized as C-1 through C-8.",
};
