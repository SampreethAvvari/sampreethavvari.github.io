---
title: "How I built an AI that grades every patient consult"
date: "2026-05-19"
layout: ../../layouts/PostLayout.astro
description: "A Zoom call comes in. My tool finds the doctor, grades the consult against the CEO's 7-point checklist, and emails back a color-coded report, without making things up."
img_path: "/doc-coach.png"
img_alt: "Consultation QA pipeline: Zoom transcript to color-coded report"
tag: "MLOps"
tone: "emerald"
stats:
  - value: "+130%"
    label: "treatment acceptance"
    tone: "emerald"
  - value: "+43%"
    label: "revenue growth"
    tone: "blue"
  - value: "-35%"
    label: "hallucinations vs no-schema baseline"
    tone: "violet"
---

Every week, implant consultations finished and nothing happened to them. The doctor moved on. The treatment coordinator moved on. Our CEO, Dr. Frank LaMar, had a seven-criterion framework for what a good consult looks like. It lived in a Word doc. Nobody else could apply it at the speed the practice runs.

So the coaching loop closed on maybe a handful of cases a week: the ones Frank had time to pull up himself. The rest were invisible.

I was the only engineer on this. I had Zoom webhooks, Vertex AI, and a Google Workspace with no Super Admin access. I built the pipeline that reads every transcript, scores it against Frank's rubric, and gets a color-coded report to the doctor, the TC, and Frank before the patient's follow-up window closes.

## The flow, end to end

```
Zoom consultation finishes
        │
        ▼  recording.transcript_completed webhook
Cloud Run (FastAPI)
        │
        ├─ filter: is this actually a consult?
        ├─ resolve identity: who's the doctor, the patient, the TC?
        ├─ score: Vertex AI Gemini, schema-validated, retry once on fail
        ├─ render: color-coded HTML + PDF report
        ├─ archive: Drive folder by location / month / patient
        ├─ send: Gmail to doctor + CEO + TC
        ├─ append: one row to a master Google Sheet (48 columns, locked)
        └─ audit: BigQuery row with no PHI

Total time from transcript-ready to email in inbox: 5-15 minutes.
```

## Three constraints I had to design around

**HIPAA.** Every transcript is PHI. Everything stays inside Google's BAA boundary. No PHI in any log line, ever.

**No Workspace Super Admin.** I'm not the org admin. Domain-Wide Delegation (the standard way to give a service account Gmail/Drive access on behalf of users) was off the table. I used a user-OAuth grant on my own account instead, with the refresh token in Secret Manager. The Workspace sees a user account doing user-account-shaped things, which it already trusts.

**Doctor-TC pairing is fully flexible.** Any doctor can pair with any TC. There's no default. The system has to figure out the doctor per meeting.

## Doctor identity, three layers deep

```
1.  Zoom participants    →  email match → display name → alias match
2.  Transcript speakers  →  "Dr Mike:" speaker labels + alias match
3.  Gemini extraction    →  scorecard's doctor_name_candidates
4.  Unresolved           →  send to CEO only, prefix subject
                            [QA: DOCTOR UNRESOLVED]
```

Each layer returns a unique match, an ambiguous match, or no match. Ambiguity falls through. Unresolved cases don't get silently dropped. They get flagged.

One detail I learned the hard way: short single-word aliases like "Frank" and "Mike" need word-boundary matching. Otherwise they fire inside patient names and casual speech all the time. Multi-word aliases like "Dr. Mike Baleno" are fine on substring.

## The contract that killed half the hallucinations

Free-form LLM output is a bad pattern for anything that has to feed a database. The scorer doesn't ask Gemini for a report. It asks for a JSON object that passes a JSON Schema.

If validation fails, the scorer retries exactly once with a hardened system prompt: *"Your previous response failed schema validation. Output ONLY JSON. No prose. No markdown fences."*

If the retry also fails, it raises, alerts, and stops.

That single change cut **hallucinations by ~35%** versus the no-schema baseline. The model is the same. The difference is the shape it has to produce.

<div class="stat-callout stat-emerald">
  <div class="stat-value">+130%</div>
  <div class="stat-label">Treatment acceptance after every consult started getting coached, not just the few Frank had time for</div>
</div>

## Color coding against a rolling baseline

Each criterion gets a 1-10 score. The HTML email colors each one against the doctor's **own 30-day rolling average** for that criterion, not a global baseline. That's the only way the report makes sense when a new TC pairs with a doctor for the first time.

Rolling averages are read from the master Sheet every run, so the system never drifts from the ledger.

## What it produced

| | Before | After |
|---|---|---|
| Consultations scored | Frank's hand-picked subset | Every implant consult, both Zoom orgs |
| Time from transcript to coaching report | Days, sometimes weeks | 5-15 minutes |

The number I care most about from an engineering standpoint is the hallucination cut. A schema and one structured retry turn the same model into a reliable producer of clean rows. The acceptance lift and revenue growth are downstream of what the coaching loop did with those rows.

## Why this matters beyond the metrics

Each report quotes the doctor's own words back to them, criterion by criterion, with at least one timestamped moment showing where the conversation landed and where it didn't. The coaching is grounded in something the doctor already remembers, not an abstract principle.

That is what this project actually required: sitting with the clinicians and the TC long enough to understand why Frank's Word doc worked for Frank, then translating that into a JSON Schema contract strict enough to produce clean database rows, inside a Workspace where I had no elevated admin rights and no margin for PHI leakage. The metrics are downstream of that translation. The engineering question was whether a hand-written rubric could become a repeatable system without losing what made it useful. It can.
