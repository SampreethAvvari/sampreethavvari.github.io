---
title: "How I rebuilt a brittle call grader into a coaching platform"
date: "2026-06-21"
layout: ../../layouts/PostLayout.astro
description: "A prototype scored every front-desk call out of 60 and emailed a link to a Google Doc. I rebuilt it into a coaching platform: a verbatim quote behind every score, patient safety as a loud flag, the math kept out of the model, and a dashboard a manager actually opens. Here is the whole story, including the bugs my tests could not catch."
img_path: "/npc-coach.png"
img_alt: "New Patient Coordinator coaching platform: call recordings in, evidence-backed coaching reports out"
tag: "AIE"
tone: "emerald"
stats:
  - value: "60 → 100"
    label: "a flat sum out of 60, now a weighted 0-100 with 3 hard gates"
    tone: "emerald"
  - value: "1,156 tests"
    label: "the whole suite runs with no cloud and no patient data"
    tone: "blue"
  - value: "285 → 40"
    label: "calls ingested, then real new-patient calls scored, on day one"
    tone: "amber"
---

The job of a New Patient Coordinator is the first phone call. Someone is nervous, maybe in pain, and the way that call goes decides whether they ever walk in. The practice founder, Dr. Frank LaMar, wrote a careful playbook for those calls. The question was how to coach forty people against it without a manager listening to hundreds of recordings a week.

We did not start from zero. An earlier grader, built in a no-code tool called n8n, already pulled the call recordings off a server every hour and produced a report. It proved the idea was worth something. And then it hit a ceiling I could not raise without rebuilding the thing underneath it.

So I rebuilt it. This is the whole story: what was wrong, how it grades a call now, the architecture decisions I would make again, the bugs my tests never caught, and the dashboard a manager actually lives in.

## What the prototype did, and where it stopped

The old version graded each call as a flat sum out of 60, wrote the result as a blob of text into a single Google Doc, and emailed a link. That Doc was the only record.

That design quietly broke in a lot of places at once.

<div class="aside">
<strong>What the prototype could not do.</strong> No database, so no trends, no per-coordinator averages, and no way to answer the question a manager actually asks: how is this person doing this month? The score had no quotes behind it, so nobody could see why a call got a 47. It kept no record of which non-negotiables passed or failed. It shared the patient's name and the full transcript to the entire company. And if the workflow died halfway through, the call was skipped in silence.
</div>

I kept the same playbook and the same model family, and rebuilt everything around three things the prototype never had: evidence behind every score, patient safety as a first-class signal, and a real system of record you can query.

| | The prototype | What runs now |
|---|---|---|
| Score | Flat sum out of 60 | Weighted 40/40/20 out of 100, plus 3 hard gates and a patient-urgency override |
| Evidence | A number with nothing behind it | A verbatim transcript quote behind every one of six criteria |
| Output | Text parsed by position | Validated structured data, scored by code, not the model |
| Record | One Google Doc per call | A queryable BigQuery store feeding a 26-endpoint dashboard |
| Privacy | Full transcript and name shared company-wide | A dashboard locked to the practice domain behind sign-in |
| Reliability | A mid-run failure dropped the call silently | Deterministic call IDs, so a call is never graded twice or lost |

## The one rule the whole thing is built on

The principle under all of it comes straight from the playbook: the coordinator is the patient's first advocate, not a clinician and not a salesperson. The system grades judgment and patient safety. It never grades booking rate.

That sounds soft. It is actually the hardest constraint in the build. A call where the patient politely defers is not a failure. A patient who books an appointment just to get off the phone is a failure of advocacy, not a win. Correctness beats conversion, every time, and I had to write the grader so it can never quietly reward the reverse.

## What runs now, end to end

A call happens. The phone system drops the recording on a server, or our other source hands an inbound call back with a transcript already attached. From there the pipeline does six things.

<div class="aside">
<strong>The pipeline.</strong>
<ol>
<li><strong>Ingest</strong> the day's recordings, or accept the live webhook. Each call gets a deterministic ID so it can never become two records.</li>
<li><strong>Transcribe</strong>. Outbound recordings go through Vertex Gemini. Inbound calls reuse the transcript that already exists, which keeps that cost near zero.</li>
<li><strong>Classify</strong> what the call actually is. A new-patient conversation goes forward. A voicemail, a wrong number, or an existing patient gets tagged and set aside.</li>
<li><strong>Score</strong> the relevant calls against the playbook, criterion by criterion, with a quote behind every judgment.</li>
<li><strong>Resolve identity</strong> so every call to and from the same person links to one stable patient ID.</li>
<li><strong>Report and store</strong>. The verdict lands in BigQuery, the transcript and report in Cloud Storage, and the dashboard renders both.</li>
</ol>
</div>

## How it grades a call

People ask about the score first, so here is the real math. Every relevant call is graded on six criteria, each from 0 to 10.

<div class="aside">
<strong>The six criteria.</strong>
C1, role identification and advocacy. C2, patient identification and referral framing. C3, rapport and emotional connection. C4, classification before conversion (pin down the scope before pushing an appointment). C5, sequencing and scheduling logic (the right appointment, not the fastest one). C6, use of differentiators, only when a patient concern actually calls for one. Most calls do not, and the absence is never penalized.
</div>

Those six roll into three weighted buckets. The headline is a plain weighted sum, nothing fancier.

```
final_score = 10 × ( 0.40 × mean(C1, C3)    # rapport
                   + 0.40 × mean(C2, C4)    # classification
                   + 0.20 × mean(C5, C6) )  # scheduling
```

That maps to four bands: Gold at 85 and up, Strong at 70 to 84, Developing at 50 to 69, Fail below 50. On top of the number sit two safety layers that have nothing to do with how nice the call was: three hard gates (did the coordinator identify their role, capture the patient's name, and frame the referral correctly) and a patient-urgency override (if someone is in real pain and the coordinator delays intake or pivots to financing, that is recorded as a safety failure).

### The decision I reversed

The first version of the rubric capped any gate-failing call at 49 and subtracted points for a safety miss. It looked principled. Miss a non-negotiable, crater the score.

In practice that cap destroyed information. A genuinely warm, well-sequenced call that happened to use one bit of retail framing would collapse to 49, which told a coach nothing about everything else the coordinator did well. So I removed the cap entirely. The score became the pure weighted sum, and the gate failure became a loud red badge next to it.

<div class="stat-callout stat-amber">
  <div class="stat-value">a flag, not a cap</div>
  <div class="stat-label">A call can now read 84 and still be flagged as failed. The coach sees both at once: how good the call was, and which non-negotiable was missed. The number and the safety flag stopped fighting each other.</div>
</div>

### Why I took the math away from the model

This is the part I would defend hardest. The model produces only three things: the six integer scores, the gate booleans, and the urgency state. A pure Python function turns those into the final number.

Keeping the arithmetic out of the model means the headline score is reproducible. Same inputs, same number, every time. And if the practice decides scheduling should count for 30% instead of 20%, that is a one-line change to a function, not a prompt rewrite and a re-check of every past call. The model does the part it is good at, reading a conversation and judging it with a quote to back it up, and none of the part it is bad at, consistent arithmetic.

## The architecture I would do again

A few design choices shaped everything else. None of them are clever. They are boring on purpose, which is exactly why they held up when real patient data started flowing.

**Ports and adapters, so the cloud is swappable.** Every external dependency (storage, the transcriber, the scorer, the classifier, the patient registry, delivery) sits behind a port. The real Google Cloud services are wired in at a single place. In tests, the same ports get in-memory fakes.

<div class="stat-callout stat-blue">
  <div class="stat-value">safe by default</div>
  <div class="stat-label">One flag, NPC_BAA_ACCEPTED, gates every path that touches real patient data. When it is off, the app wires in fakes and touches nothing real. That is the safe default for demos and local work, and it is why 1,156 tests run with no network and no cloud credentials.</div>
</div>

That one flag came out of a compliance fact that bites a lot of healthcare projects: a Google Workspace agreement does not cover Google Cloud services. Cloud Storage, Vertex AI, and BigQuery need a separate Cloud agreement, and nothing real is allowed to flow until that is signed. I made that a single line of config instead of a rule someone has to remember.

**Cost discipline through structural dedup.** Inbound calls already arrive with a transcript, so we never pay to transcribe them twice. At the practice's volume, that is the single biggest reason the cloud bill lands around 50 to 250 dollars a month instead of several times that. The cheapest API call is the one you never have to make.

**Ship the smaller correct thing first.** The full design is an event-driven mesh with queues between every stage. For the first real run I deliberately did not build all of that. I wired a direct, single-process pipeline so the dashboard could light up on real calls while the heavier plumbing waited its turn. That choice paid off twice: real calls got scored early, and the whole delivery layer the coordinators actually feel (emailed reports, inline recordings, a daily summary) landed on that simple pipeline instead of blocking on the full mesh.

## Four bugs my test suite could not catch

The polished version of a project hides exactly the parts worth writing down. Every one of these passed a green test suite and still went wrong against reality.

<div class="aside">
<strong>The wheel that passed a thousand tests and still failed to deploy.</strong> The first deploy failed at build time even with the whole suite green. A packaging setting tried to add the same asset files to the image twice. The tests never saw it because they use an editable install that never builds a real package. The Docker image does a real install, so it tripped on the first deploy. A green suite proves the code runs, not that it packages.
</div>

<div class="aside">
<strong>Forty percent of real calls came back "not gradeable."</strong> The output schema required an exact transcript quote for any non-zero score, and on a garbled transcript the model could not always find an exact substring, so a perfectly reasonable score got rejected on a technicality. I loosened the quote requirement from mandatory to advisory, made the remaining failures report why instead of failing silently, and added a relevance gate so calls that should never have reached the scorer get filtered earlier.
</div>

<div class="aside">
<strong>Reruns that forked a call's history.</strong> A rerun could create a fresh record instead of updating the original, splitting one call across two IDs. I scoped the claim to the original call ID, so a rerun reattaches to the same call rather than minting a new one. One call, one record, no matter how many times it is reprocessed.
</div>

<div class="aside">
<strong>A transcriber that misheard the practice name a dozen ways.</strong> It rendered "Hybridge" as "High Bridge," "Amadana," "Hyperjet Omaha," and more. There is no Omaha office. Re-transcribing costs money, so I edit the stored text in place for known mishearings, and feed the real practice names into the transcription prompt going forward so the model has the right vocabulary up front.
</div>

<div class="stat-callout stat-emerald">
  <div class="stat-value">diagnosable beats silent</div>
  <div class="stat-label">A call that fails grading and tells you why is a to-do item. A call that fails silently is a hole in your data you find weeks later, if ever.</div>
</div>

## The dashboard a manager actually opens

The pipeline grades the calls. The dashboard is the surface a coordinator and a manager live in. It is a single-page React app behind Google sign-in, backed by 26 endpoints, with one mantra pinned in the sidebar the whole time: correctness over conversion, no patient data in logs.

The heart of it is the call detail view. It opens with a live pipeline stepper (Ingest, Transcribe, Tag, Score, Report) that refreshes while a call is still moving. Then the coaching report itself.

<div class="aside">
<strong>What a coach sees on one call.</strong> A red banner if a hard gate failed, naming which one, and stating plainly that the score is still calculated normally because the gate is a flag, not a cap. A score-breakdown panel showing the three buckets as bars, then the weighted sum and final number, so the math is on the screen instead of hidden in the model. Each of the six criteria with its score, the model's reasoning, the exact transcript quote it cited, and a one-line coaching note. The recording plays inline, right next to the report.
</div>

<div class="stat-callout stat-amber">
  <div class="stat-value">every judgment, a quote</div>
  <div class="stat-label">A coach does not just see the number. They see the exact moment in the transcript that earned it, so the coaching is grounded in something the coordinator already remembers.</div>
</div>

The surprise feature is Settings. The scoring rubric is not buried in the source. It is editable in the browser, and it is the same rubric the scorer runs. A manager can tune the playbook, save a new immutable version with a change note, and roll back without losing history, all without opening a code editor or pinging me.

And a lot of the best features were never in the spec. They came from looking at real output: a voicemail tag that pulls voicemails off the grader, an uncooperative-caller flag so an unfair call does not drag down an average, the relevance gate that came out of the "not gradeable" hunt, and a daily 5pm summary where Gemini rolls the day's calls into one digest for the manager.

## Where it landed

On one real day, the system ingested about 285 recordings, found and scored 40 real new-patient calls with quoted evidence, auto-filtered 3 voicemails, and flagged 28 calls for missing a non-negotiable.

| Metric | Value |
|---|---|
| Calendar time, first to latest commit | 18 days |
| Python source | ~20,800 lines across 20 modules |
| Tests | 1,156, all on synthetic data, no cloud |
| API endpoints | 26 |
| Scoring | 6 criteria, 3 hard gates, 40/40/20 weighting, 4 bands |
| Target volume and cost | 1,000 to 5,000 calls a month, about 50 to 250 dollars |

The prototype told you a call scored 47 out of 60. This tells you the call scored 84, names the exact moment the coordinator missed a gate, quotes what they said, and puts that next to their own 90-day average. That is the difference between a number and a coaching tool.

If there is one lesson under all of it: a green test suite is necessary, not sufficient. It proved the logic ran. It did not catch the packaging break, and it did not tell me 40% of real calls would not grade. The real calls did. Ship the smaller correct thing, watch what real data does to it, and let that drive the next feature, not the original plan.
