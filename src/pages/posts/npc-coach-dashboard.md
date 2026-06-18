---
title: "The dashboard a practice manager actually opens"
date: "2026-06-17"
layout: ../../layouts/PostLayout.astro
description: "Eight surfaces behind Google sign-in: a live pipeline stepper, the scoring math on the screen instead of hidden in the model, and a rubric you can edit in the browser. The features real reports demanded, not the spec."
img_path: "/npc-coach-dashboard.png"
img_alt: "Coaching dashboard — a call list with score bands, hard-gate flags, and a per-criterion breakdown"
tag: "Engineering"
tone: "cyan"
stats:
  - value: "23"
    label: "API endpoints behind one domain-locked React app"
    tone: "cyan"
  - value: "8 surfaces"
    label: "sign-in, dashboard, all calls, detail, submission, stats, analytics, settings"
    tone: "blue"
  - value: "rubric as code"
    label: "the scoring rubric is editable in the browser — and it's the one the scorer runs"
    tone: "emerald"
---

*Part of a series on the [New Patient Coordinator coaching platform](/posts/npc-coach-rebuild). The pipeline grades the calls; this is the surface a coordinator and a manager actually live in.*

The dashboard is a single-page React app behind Google sign-in, backed by 23 API endpoints. A mantra stays pinned in the sidebar the whole time: *correctness over conversion, no PHI in logs.* There are eight working surfaces, and every one of them earns its place by answering a question someone actually asks.

## The everyday surfaces

**Sign in.** A coordinator or manager signs in with their practice Google account; anyone outside the domain is turned away at the door. The signed-out screen says exactly one thing: *the patient's first advocate.*

**Dashboard.** The calls the rubric actually evaluates — the relevant new-patient calls, newest first. Each row carries the time, the coordinator, the patient, the length, the score out of 100, and a coaching cell with the band (Gold, Strong, Developing, Fail), a red "hard gate" chip and an amber "uncooperative caller" chip when they apply. Fifteen per page, a running "N relevant, M scored" count, and a five-second auto-refresh so new calls appear without a reload.

**All Calls.** The full ledger — one row per call after the length filter, not just the scored ones. Filter by date, direction, or tag. Each row shows the direction as a colored in/out arrow, the coordinator and extension, the patient, the tag as a colored chip, the status, the score where it applies, and an actions cell with transcript, recording, and a Run/Rerun button. **No outside phone number is ever shown.**

**Stats and Analytics.** Stats is the shape of the traffic over a window you pick (today, this week, this month, this year, all time, or custom): inbound, outbound, the relevant new-patient subset in each direction, average durations, every tag broken down by count — aggregate only, no PHI. Analytics is where a manager lives: one card per coordinator over a 7/30/90-day window, with a per-criterion bar chart across C1-C6 so you can see exactly *which* behavior to coach, a weekly trend sparkline, and a breakdown by call direction. De-identified.

## Call Detail: the heart of it

Click any row and you get the whole story of one call.

It opens with the identity and metadata, then a **live pipeline stepper** — Ingest, Transcribe, Tag, Score, Report — each stage marked done, in progress, skipped, or failed, refreshing every few seconds while the call is still moving. Then the coaching report itself:

- A **red banner** when a hard gate failed, naming which one (G1 role, G2 patient identity, G3 referral framing) — and stating plainly that the score is still calculated normally, because the gate is a flag, not a cap. (That reversal has its own story in [how it grades a call](/posts/npc-coach-scoring).)
- An **amber banner** when the call wasn't gradeable, or when the caller was uncooperative — the latter quoting the exact line that triggered it, so a low score is read in context.
- A **score-breakdown panel** that lays out the three buckets (rapport 40%, classification 40%, scheduling 20%) as bars, then the weighted sum and the final number. The math is on the screen, not hidden in the model.
- **Each of the six criteria** with its score out of 10, a color-coded bar, the model's rationale, the verbatim quote it cited from the transcript, and a one-line coaching note.

<div class="stat-callout stat-cyan">
  <div class="stat-value">every judgment, a quote</div>
  <div class="stat-label">A coach doesn't just see the number — they see the exact moment in the transcript that earned it. The coaching is grounded in something the coordinator already remembers.</div>
</div>

There's also a **New Submission** surface for scoring a call by hand: paste a CallRail id or a recording URL, hit Check to see whether it's already scored, then Submit — and a second submit of the same call becomes a no-op instead of a duplicate run.

## Settings: the rubric as code

This is the part that surprised people. The scoring rubric isn't buried in the source. It's editable in the browser, and it's the *same* rubric the scorer runs.

The six criteria appear as color-coded chips with editable labels. The prompt itself is split into labeled, color-coded sections you edit one at a time, with a lossless round-trip so an untouched section is reproduced byte-for-byte. There's a one-click "polish to house style" pass, a Save that writes a new **immutable** version with a change note, and a rollback that deletes nothing — it appends the older version back as the new active one. Full version history, no destructive edits. A manager can tune the playbook without ever opening a code editor or pinging me.

## The features the spec never anticipated

The plan covered ingestion, classification, transcription, scoring, identity, reports, and a dashboard. Real calls surfaced needs no spec predicted, and each of these came straight out of looking at actual output: a **voicemail tag** that pulls voicemails off the grader entirely (it caught 3 on the first batch), an **uncooperative-caller flag** and a **scheduling-callback tag** so calls that can't be fairly graded don't drag down an average, the **eval-time relevance gate** that came out of the 40%-not-gradeable hunt, the **date-range presets** wired through every endpoint, and the **hard-gate badge** itself — a feature that exists only because watching real reports made the old score cap obviously wrong.

## Nothing on screen that you can't audit

Every number on every surface traces back to a stored verdict in BigQuery and a report in Cloud Storage. Nothing is computed in a way you can't trace to its source — which is the whole reason a practice can trust it enough to coach real people from it. The boring guarantees under that live in [the architecture post](/posts/npc-coach-architecture).
