---
title: "How I rebuilt a brittle call grader into a coaching platform"
date: "2026-06-18"
layout: ../../layouts/PostLayout.astro
description: "An n8n prototype scored each front-desk call out of 60 and emailed a link to a Google Doc. I rebuilt it: evidence behind every score, patient safety as a loud flag, a queryable system of record. Here's the before and after."
img_path: "/npc-coach.png"
img_alt: "New Patient Coordinator coaching platform — call recordings in, evidence-backed coaching reports out"
tag: "MLOps"
tone: "emerald"
stats:
  - value: "60 → 100"
    label: "flat sum out of 60, now a weighted 0-100 with 3 hard gates"
    tone: "emerald"
  - value: "1,156"
    label: "tests passing on the green gate"
    tone: "blue"
  - value: "285 → 40"
    label: "calls ingested → real new-patient calls scored, day one"
    tone: "amber"
---

We didn't start from zero. An earlier grader — call it v2, built in n8n — already pulled the call recordings off an SFTP server every hour and produced a report. It proved the idea. It earned its keep. And then it hit a ceiling I couldn't raise without rebuilding the thing underneath it.

v2 graded each new-patient phone call as a flat sum out of 60, wrote the result as a semicolon-delimited blob into a single Google Doc, and emailed a link. That Doc was the only record. No database meant no trends, no per-coordinator averages, no way to answer the one question a manager actually asks: *how is this person doing this month?* Every report carried the patient's name and the full transcript, and every one of them was shared to the entire company domain. The score had no quotes behind it, no record of which non-negotiable gates passed or failed, and no memory of whether the patient was in pain. If the workflow died halfway through, the call was skipped in silence.

So I rebuilt it. Same playbook, same Gemini family, rebuilt around three things v2 never had: **evidence, patient safety, and scale.**

## v2 versus what runs now

| | v2, the n8n prototype | Now, this platform |
|---|---|---|
| **Score** | Flat sum out of 60 | Weighted 40/40/20 out of 100, plus 3 hard gates + a patient-urgency override |
| **Evidence** | A number with nothing behind it | A verbatim transcript quote behind every one of the six criteria |
| **Output** | Semicolon-delimited text, parsed by position | Validated structured JSON, scored by the engine, not the model |
| **System of record** | One Google Doc per call | A queryable BigQuery store feeding a 23-endpoint dashboard |
| **Analytics** | None | Per-coordinator rollups and trends across any date range |
| **Privacy** | Full transcript + patient name shared company-wide | A dashboard locked to the practice domain behind Google sign-in |
| **Call routing** | Every recording graded, blindly | Voicemails, wrong numbers, non-new-patient calls filtered out and tagged |
| **Reliability** | A mid-run failure dropped the call quietly | Deterministic call IDs — a call is never graded twice and never lost |

## The one rule the whole thing is built on

The principle under all of it comes straight from Dr. Frank LaMar, who wrote the playbook: the coordinator is the patient's **first advocate**, not a clinician and not a salesperson. The system grades judgment and patient safety, never booking rate.

That sounds like a soft statement. It's actually the hardest constraint in the build. A call where the patient politely defers is *not* a failure. A patient who books an appointment just to get off the phone is a failure of advocacy, not a win. **Correctness beats conversion, every time** — and the grader is written so it can never reward the reverse. (If you're wondering how a number enforces a value like that, that's the whole point of [how it grades a call](/posts/npc-coach-scoring).)

## What runs now, end to end

A call happens. The phone system drops the recording onto SFTP; CallRail, the other source, hands inbound calls back with a transcript already attached. From there the pipeline does six things:

1. **Ingest** — pull the day's recordings, or accept the CallRail webhook. Each call gets a deterministic `call_id` so it can never be processed twice into two different records.
2. **Transcribe** — outbound recordings go through Vertex Gemini; inbound CallRail calls reuse the transcript that already exists, which keeps transcription cost near zero for that source.
3. **Classify** — a tagger decides what the call actually *is*. A new-patient clinical conversation goes forward. A wrong number, a voicemail, an existing patient — all get tagged and set aside.
4. **Score** — a relevant call is graded against the playbook, criterion by criterion, with a verbatim quote backing every judgment.
5. **Resolve identity** — a patient identity service assigns a stable patient ID so every call to and from the same person links together.
6. **Report and store** — the verdict lands in BigQuery, the transcript and report land in Cloud Storage, and the dashboard renders both.

The design decisions that made this swappable, testable, and HIPAA-safe — ports and adapters, a single compliance switch, keeping the arithmetic out of the model — are their own story: [the compliance switch and other architecture I'd do again](/posts/npc-coach-architecture).

## The proof: one full day on live calls

On 2026-06-17 the system processed an entire day of real calls end to end.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-emerald">
    <div class="stat-value">~285</div>
    <div class="stat-label">recordings ingested in one day</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">40</div>
    <div class="stat-label">real new-patient calls found and scored with quoted evidence</div>
  </div>
  <div class="stat-callout stat-amber">
    <div class="stat-value">3 / 28</div>
    <div class="stat-label">voicemails auto-filtered before grading / calls flagged for a missed non-negotiable</div>
  </div>
</div>

v2 told you a call scored 47 out of 60. This tells you the call scored 84, names the exact moment the coordinator missed a referral-framing gate, quotes what they said, and puts that next to their own 90-day average. That's the difference between a number and a coaching tool.

Getting there wasn't clean. Roughly 40% of the first real batch came back "not gradeable," a wheel that passed a thousand tests still failed to deploy, and the transcriber heard the practice name a dozen different wrong ways. Those are written up honestly in [the bugs the test suite couldn't catch](/posts/npc-coach-bugs).

## Where it stands

This is the last stage, not the finish line. The dashboard runs on Cloud Run behind Google sign-in, locked to the practice domain, showing real processed calls — and a practice manager can actually live in it (here's [the dashboard, screen by screen](/posts/npc-coach-dashboard)). What's left before full go-live is scoped and queued: MP3 transcoding with an in-dashboard player, email delivery with a send identity, the extension-to-coordinator mapping confirmed with the team, patient-name extraction wired as its own step, and the move from the interim single-process pipeline to the full event-driven mesh once the Cloud BAA is formally accepted. None of those are unknowns.

## The numbers, with no rounding up

| Metric | Value |
|---|---|
| Calendar time, first to latest commit | 16 days (2026-06-02 → 2026-06-18) |
| Commits / PRs merged | 399 / 31 |
| Python source | 19,441 lines, 190 files, 19 modules |
| Tests | 1,156 passing on the latest green gate |
| Frontend | 4,623 lines of TypeScript and React |
| Design & planning docs | 75 markdown files (5 ADRs, 10 specs, 29 plans) |
| API endpoints | 23 |
| First live day | ~285 ingested · 40 scored · 3 voicemails caught · 28 flagged |
| Scoring | 6 criteria · 3 hard gates · 40/40/20 weighting · 4 bands |
| Target volume / cost | 1,000-5,000 calls/month · ~$50-250/month |

If there's one lesson under all of it: a green test suite is necessary, not sufficient. It proved the logic ran. It didn't catch the packaging break, and it didn't tell me 40% of real calls wouldn't grade. The real calls did. Ship the smaller correct thing, watch what real data does to it, and let *that* drive the next feature — not the original plan.
