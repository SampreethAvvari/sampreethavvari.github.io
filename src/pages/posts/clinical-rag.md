---
demo: /demos/doc-coach
title: "The CEO's consult checklist now grades every Zoom consult"
date: "2026-05-19"
layout: ../../layouts/PostLayout.astro
description: "Consult reviews were written by hand against a seven criterion Word doc. Now a Zoom webhook starts a Gemini grader, and in October the median report landed 2.7 minutes after the transcript."
img_path: "/doc-coach.png"
img_alt: "Consultation QA pipeline: Zoom transcript to color-coded report"
architecture: "doc-coach"
tag: "MLOps"
tone: "emerald"
stats:
  - value: "471"
    label: "consults scored live from May 19 to Oct 28, across Rochester, Buffalo and Syracuse"
    tone: "emerald"
  - value: "2.7 min"
    label: "median from transcript to sent report in October, and 9 in 10 under 3.8"
    tone: "blue"
  - value: "392"
    label: "older consults, Nov 2025 to May 2026, regraded on the same rubric so the trends start in November"
    tone: "violet"
facts:
  - label: "Problem"
    value: "Consult reviews were written by hand, one consult at a time, against the CEO's seven step Word doc."
  - label: "What I built"
    value: "A service that grades each recorded Zoom consult on the CEO's seven criteria with Gemini and emails a report."
  - label: "Who uses it"
    value: "Doctors, treatment coordinators and the CEO get each report; coordinators also get the chart note."
  - label: "Outcome"
    value: "471 consults scored live by October 28; the October median from transcript to report was 2.7 minutes."
  - label: "Runs on"
    value: "Cloud Run, Firestore and Gemini 2.5 Pro, started by a Zoom webhook."
  - label: "Built"
    value: "Deployed the evening of the first commit; the first consult went through at 8:36 PM on May 19, 2026."
---

## The problem

Our CEO has a framework for a good implant consult. Seven steps: build rapport, earn credibility, pick a treatment path, create value, present the fee, agree how to follow up, and stay compassionate throughout. It lived in a Word doc. A consult review was a document someone wrote by hand, one consult at a time.

The ask was simple to say. Score every doctor against that framework after every recorded consult, get a color coded report to the doctor, the treatment coordinator (TC) and the CEO within minutes of the transcript, and log every consult to one master sheet.

Two facts made it harder. Any doctor can pair with any TC, so the system has to work out who the doctor was on every call. And I had no Super Admin rights in our Google Workspace.

## What I built

One Cloud Run service in Python. Zoom posts a webhook when a transcript is ready. The service checks the signature, answers 202, and works in the background: skip what is not a consult, find the doctor, ask Gemini 2.5 Pro for a scorecard as JSON, render the report and PDF, draft a chart note, file it in Drive, send the emails, and append one row to the master Sheet.

The rubric has 7 criteria and 25 sub checks. Every rationale must quote the transcript, with a real timestamp or none. Each score is colored against that doctor's own 30 day average, so it coaches a doctor against themselves. [Open the drawing](/architecture/doc-coach).

## The sprint

The first commit landed May 19 at 7:28 PM, already the working pipeline, deployed the same evening. The first consult went through it at 8:36 PM that night. I kept going until 2:17 AM, including a fix for Zoom payloads that were being dropped. By 6:15 PM on May 20 it had a four tier test suite and CI.

Then the people using it shaped it. TCs paste the chart note into Denticon, our practice system, and copying from a PDF turned every wrapped line into a hard break. On July 1 the note became its own email in plain, copyable text. A TC sent three corrections on surgical stages, palliative offers and option order; they went into the prompt on July 6.

On July 29 I ran 392 older consults, November 2025 to May 2026, through the same pipeline so the charts start in November.

## The hard parts

**A truncated scorecard needs more room.** On September 11 a consult failed scoring, and <span class="egg" tabindex="0" data-egg="Doing the same thing at the same token budget and expecting a different finish_reason.">four reruns</span> failed the exact same way. It looked like Vertex being flaky. The cause was the budget. On Gemini 2.5 Pro the thinking spends the same output budget as the answer: a scorecard is about 3,200 tokens and thinking ran 3,500 to 4,400 on identical input, against a ceiling of 8,192. Cross it and the JSON stops mid string. Five more consults had hit it the month before. Asking again at the same ceiling fails every time, so the scorer now tells the two failures apart:

```python
# zoom-transcript-pipeline/app/scorer.py
if truncated:
    budget = min(budget * 2, _MAX_MODEL_OUTPUT_TOKENS)
else:
    prompt = _HARDENED_PREFIX + base_prompt
```

A response that did not finish cleanly is never accepted, even when it happens to parse. The ceiling also went to 32,768, which costs nothing when unused: thinking measured 3,534 tokens at 8,192 and 3,589 at 32,768. In October, no consult needed a second scoring attempt.

**Who was the doctor?** Three layers: Zoom participants matched against the doctor directory, then transcript speaker labels, then the names Gemini pulls out while scoring. A layer that matches two doctors falls through to the next. Short aliases like a first name only match as whole words, or a <span class="egg" tabindex="0" data-egg="A regex word boundary is the cheapest bouncer in the building. Short first names do not get in without one.">doctor's first name</span> fires inside patient names and small talk. If all three fail, the report goes to the CEO alone, flagged unresolved. Of the 392 regraded consults, none ended unresolved.

**A half note that looked whole.** In July a chart note went out cut off after the General Health section: 869 characters where a normal note runs about 5,000. Three holes lined up: nobody checked why the model stopped, the 4,096 token budget was shared with thinking, and the check accepted any 3 of 7 sections. Now an unclean finish is rejected, all seven sections must be there, and the retry doubles the budget.

## What I said no to

**Waiting on domain wide delegation.** That needs a Super Admin, and I am not one. The service files and sends with a user OAuth grant whose refresh token lives in Secret Manager, so nothing waited on a permission.

**A cheaper model before proving quality.** The config says to drop to Flash only after validating quality on the fixture set. Scoring, notes and report cards all still run on 2.5 Pro.

**Scores outside the app.** When the CDF dashboard needed consult details, it got a route that returns the note, recording and transcript, and never a score. The fields are an allowlist, and a test feeds it a record stuffed with scores and checks that none come back.

## Where it landed

From May 19 to October 28 it scored 471 consults live: 325 in Rochester, 91 in Buffalo and 55 in Syracuse. In October the median consult went from transcript to sent report in 2.7 minutes, and nine in ten took under 3.8. Doctors, TCs and the CEO get the report, TCs get the chart note, and every Monday the scores become report cards.

Cost is not measured yet. The billing export for this project only switched on October 28, 2026, so there is no measured month. Since October 29 the warm instance only runs 7 AM to 7 PM.

I have not measured whether the reports change how consults go. The dashboard joins scores to case outcomes, but there is no clean before and after to quote.

What I would keep: make the model's output a contract the code can check, and when it breaks, find out which way it broke before you retry.
