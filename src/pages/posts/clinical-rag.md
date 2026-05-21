---
title: "Scoring every dental consultation against a CEO's framework"
date: "2026-05-19"
layout: ../../layouts/PostLayout.astro
description: "A Zoom transcript flows in. A pipeline finds the doctor, scores the consult on a 7-criterion rubric, renders a color-coded report, appends to a master Sheet."
img_path: "/doc-coach.png"
img_alt: "Consultation QA pipeline — Zoom transcript to color-coded report"
---

Our CEO, Dr. Frank LaMar, has spent years refining a seven-criterion framework for what a good implant consultation actually looks like. The whole thing lived in a Word doc. Nobody else could read a transcript and score it the way he would.

So most consultations weren't being scored. The coaching loop that should have closed on every consult only closed on the few Frank had time to review personally.

I built a pipeline that does the rest.

## The flow, end to end

```
Zoom consultation finishes
        │
        ▼  recording.transcript_completed webhook
Cloud Run (FastAPI)
        │
        ├─ filter — is this actually a consult?
        ├─ resolve identity — who's the doctor, the patient, the TC?
        ├─ score — Vertex AI Gemini, schema-validated, retry once on fail
        ├─ render — color-coded HTML + PDF report
        ├─ archive — Drive folder by location / month / patient
        ├─ send — Gmail to doctor + CEO + TC
        ├─ append — one row to a master Google Sheet (48 columns, locked)
        └─ audit — BigQuery row with no PHI

Total time from transcript-ready to email in inbox: 5-15 minutes.
```

## Three constraints I had to design around

**HIPAA.** Every transcript is PHI. Everything stays inside Google's BAA boundary. No PHI in any log line, ever.

**No Workspace Super Admin.** I'm not the org admin. So Domain-Wide Delegation, the standard way to give a service account Gmail/Drive access on behalf of users, was off the table. I used a user-OAuth grant on my own account instead, with the refresh token in Secret Manager. The Workspace sees a user account doing user-account-shaped things, which it already trusts.

**Doctor-TC pairing is fully flexible.** Any doctor can pair with any TC. There's no default. The system has to figure out the doctor per meeting.

## Doctor identity, three layers deep

```
1.  Zoom participants    →  email match → display name → alias match
2.  Transcript speakers  →  "Dr Mike:" speaker labels + alias match
3.  Gemini extraction    →  scorecard's doctor_name_candidates
4.  Unresolved           →  send to CEO only, prefix subject
                            [QA — DOCTOR UNRESOLVED]
```

Each layer either returns a unique match, an ambiguous match, or no match. Ambiguity falls through. Unresolved cases don't get silently dropped — they get flagged.

One detail I learned the hard way: short single-word aliases like "Frank" and "Mike" need word-boundary matching. Otherwise they fire inside patient names and casual speech all the time. Multi-word aliases like "Dr. Mike Baleno" are fine on substring.

## The contract that killed half the hallucinations

Free-form LLM output is a bad pattern for anything that has to feed a database. So the scorer doesn't ask Gemini for a report. It asks for a JSON object that passes a JSON Schema.

If validation fails, the scorer retries exactly once with a hardened system prompt: *"Your previous response failed schema validation. Output ONLY JSON. No prose. No markdown fences."*

If the retry also fails, it raises, alerts, and walks away.

That single contract change cut **hallucinations by ~35%** versus the no-schema baseline. The model is the same. The difference is the shape it has to produce.

## Color coding against a rolling baseline

Each criterion gets a 1-10 score. The HTML email colors each one against the doctor's **own 30-day rolling average** for that criterion, not against a global baseline. That's the only way the report makes sense when a new TC pairs with a doctor for the first time.

Rolling averages get read out of the master Sheet every run, so the system never drifts from the ledger.

## What it produced

| | Before | After |
|---|---|---|
| Consultations scored | Frank's hand-picked subset | Every implant consult, both Zoom orgs |
| Time from transcript to coaching report | Days, sometimes weeks | 5-15 minutes |
| Treatment acceptance | baseline | **+130%** |
| Revenue growth | baseline | **+43%** |
| Hallucinations vs no-schema baseline | — | **-35%** |

The number I'm most attached to from an engineering standpoint is that last one. A schema and one structured retry turn the same model into a reliable producer of clean rows. The acceptance lift and revenue growth are downstream of what the coaching loop did with those rows.

## Why this matters beyond the metrics

The pipeline is a teaching tool. Each report quotes the doctor's own words back to them, criterion by criterion, with at least one timestamped quote where the moment landed and where it didn't. Coaching happens against a transcript the doctor remembers, not against an abstract principle.

The system isn't replacing Frank's eye on consultations. It's making the eye scalable, so the framework gets applied to every consult, not just the ones he had time for that week.
