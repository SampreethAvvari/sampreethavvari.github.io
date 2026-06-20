---
title: "How I taught a model to grade a phone call, then took the math away from it"
date: "2026-06-20"
layout: ../../layouts/PostLayout.astro
description: "Six criteria, three hard gates, a patient-safety override, and a 40/40/20 weighted sum — with the arithmetic kept out of the model on purpose. Plus the one scoring decision I reversed after watching real reports."
img_path: "/npc-coach-scoring.png"
img_alt: "Call scoring breakdown — six criteria rolling into three weighted buckets and a final number"
tag: "MLOps"
tone: "emerald"
stats:
  - value: "40 / 40 / 20"
    label: "rapport / classification / scheduling weighting"
    tone: "emerald"
  - value: "6 + 3 + 1"
    label: "criteria, hard gates, patient-urgency override"
    tone: "blue"
  - value: "84 + flag"
    label: "a call can score 84 and still fail a non-negotiable"
    tone: "amber"
---

*This is part of a series on the [New Patient Coordinator coaching platform](/posts/npc-coach-rebuild). Start there for the why; this post is the how — the actual scoring, not a hand-wave.*

People ask about the score first, so here's the real math.

Every relevant new-patient call is scored on **six criteria**, each from 0 to 10:

- **C1** — role identification and advocacy (did the coordinator say their name and title, and frame themselves as the patient's advocate?)
- **C2** — patient identification and referral framing (did they capture the name, and treat the practice as referral-based rather than asking "how did you hear about us?")
- **C3** — rapport and emotional connection (did the patient feel heard — no diagnosing, no treatment price quotes?)
- **C4** — classification before conversion (did they pin down scope and how long it had been going on?)
- **C5** — sequencing and scheduling logic (the *right* appointment, not the fastest one, with no ultimatums?)
- **C6** — use of differentiators (only when a patient concern actually called for one; most calls don't, and the absence is never penalized)

## The headline number is a weighted sum, nothing fancier

Those six roll into three weighted buckets:

```
final_score = 10 × ( 0.40 × mean(C1, C3)      # rapport
                   + 0.40 × mean(C2, C4)      # classification
                   + 0.20 × mean(C5, C6) )    # scheduling
```

So the 0-to-100 headline is a pure 40/40/20 weighted sum, mapping to four bands: **Gold** at 85+, **Strong** at 70-84, **Developing** at 50-69, **Fail** below 50. No magic. That's deliberate, and I'll come back to why at the end.

## Two safety layers the model evaluates separately

On top of the number sit two layers that have nothing to do with how *nice* the call was:

- **Three hard gates.** G1 (the coordinator identified their role), G2 (they captured the patient's name), G3 (they framed the referral correctly). Binary pass or fail.
- **A patient-urgency override.** Urgency is judged from the patient's *own words*. If someone is in real pain and the coordinator schedules a consult-only with no imaging, delays intake, or pivots to financing, that's a patient-safety failure the system records explicitly.

## The decision I reversed: cap versus flag

**Situation.** The original rubric capped any gate-failing call at 49 and subtracted 30 points for a patient-safety failure. It looked principled. Miss a non-negotiable, crater the score.

**Task.** Decide whether a missed gate should crush the score or stand beside it.

**Action.** In practice the cap destroyed information. A genuinely warm, well-sequenced call that happened to use one bit of retail framing would collapse to 49 — which told a coach *nothing* about everything else the coordinator did well. So I removed the cap and the penalty entirely. The final score became the pure weighted sum, and the gate failure became a loud red badge on the report and the dashboard row.

**Result.** A call can now read **84 and still be flagged as failed.** Coaches see both signals at once: how good the call was, and which non-negotiable was missed. The score and the safety flag stopped fighting each other.

<div class="stat-callout stat-amber">
  <div class="stat-value">a flag, not a cap</div>
  <div class="stat-label">The number measures how well the call went. The flag tells you a non-negotiable was missed. Conflating the two hides exactly what a coach needs to see.</div>
</div>

## Intent, not script

Every example phrase in the playbook is *illustrative*. A coordinator earns full credit for achieving the intent in their own words — the grader is told so explicitly. The only things penalized are the actual anti-patterns: retail framing, sales pressure, downplaying urgency, quoting a treatment cost, reading a feature menu off a card. Say it your way; just don't do the thing the playbook warns against.

## Keeping the input clean and the output queryable

Two things grew around the score once real calls started flowing. First, eligibility became its own strict gate ahead of scoring: a Gemini-Pro relevance check decides whether a call is genuinely a new-patient conversation before the rubric ever runs, so voicemails, wrong numbers, and existing-patient calls never reach the scorer and never dilute a coordinator's average. Second, every scored result is stored in a structured form rather than as prose, every criterion score, gate boolean, urgency state, and final number, per call. That structured store is what lets the dashboard answer how someone is trending over 90 days with a query instead of a re-read.

## Why I took the math away from the model

Here's the part I'd defend hardest. The model produces only three things: the six integer scores, the gate booleans, and the urgency state. A pure Python function turns those into the final number.

Keeping the arithmetic *out* of the LLM means the headline score is reproducible — same inputs, same number, every time — and I can change the weighting without re-prompting anything. If the practice decides scheduling should count for 30% instead of 20%, that's a one-line change to a function, not a prompt rewrite and a re-validation of every call. The model does the part it's good at (reading a conversation and judging it against a rubric, with a quote to back it up) and none of the part it's bad at (consistent arithmetic).

That single split — model judges, code computes — is why I trust the number on the dashboard. The [architecture post](/posts/npc-coach-architecture) goes into the rest of the boundaries I drew for the same reason.
