---
demo: /demos/doc-coach
title: "Monday report cards for every doctor, with nobody pressing send"
date: "2026-06-10"
layout: ../../layouts/PostLayout.astro
description: "Every consult already had a score. Now Gemini reads them all and writes each doctor a report card, every Monday at 8 AM and on the first weekday of each month."
img_path: "/doctor-report-cards.png"
img_alt: "Doctor coaching report cards: scored consults in, weekly emailed report out"
architecture: "doc-coach"
tag: "MLOps"
tone: "emerald"
stats:
  - value: "2 h 7 min"
    label: "on June 8, from the design spec at 2:32 PM to the email that carries the whole report at 4:39 PM"
    tone: "emerald"
  - value: "3 + 3"
    label: "green and red examples the prompt requires in every comparison"
    tone: "blue"
  - value: "3 consults"
    label: "the minimum before a doctor's page drops its limited data caveat"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Every consult had a scorecard, but seeing how a doctor was doing lately meant scrolling the master Sheet."
  - label: "What I built"
    value: "Gemini report cards for each doctor from stored consult scores, plus a comparison page across doctors."
  - label: "Who uses it"
    value: "The CEO, the operations group and every doctor who had consults in the period."
  - label: "Outcome"
    value: "Weekly cards land Monday at 8 AM and monthly ones on the first weekday, with nobody pressing send."
  - label: "Runs on"
    value: "A loop inside the Doc Coach service on Cloud Run, with Gemini and a Firestore marker per period."
  - label: "Built"
    value: "2 hours 7 minutes on June 8, 2026, from the design spec to the email carrying the report."
---

## The problem

By June every consult already had a scorecard. That was the trouble. A doctor got one report email per consult, and the questions that matter, how is this doctor doing lately and how do they compare, still meant scrolling the master Sheet and squinting.

The goal, in the words of the feature doc, was to keep every consult to the same bar regardless of who runs it or when. That needs a view across consults and across doctors, written so a clinician reads it as coaching. The comparison prompt says it in one line: <span class="egg" tabindex="0" data-egg="This line is in the prompt verbatim. It turns out models need tone notes too.">the reader is a clinician, not a defendant</span>.

## What I built

Analyse, a second pipeline on top of the same ledger. Pick doctors and a range of 7, 14, 30, 60 or 90 days, or your own dates. It reads the per consult summaries already stored in the master Sheet, plus each doctor's best and worst scoring transcript for concrete moments. Then one Gemini call per doctor and one for the comparison.

The report has a cover, one page per doctor with strengths and things to work on across the same 7 categories the consult grader uses, a comparison page with what top performers do and what pulls scores down, 3 green and 3 red examples, and a weekly trend chart. A doctor with fewer than 3 consults in range gets a "limited data, directional only" label. It is only complete when the PDF is rendered and the Sheet is synced; email comes after.

It also runs itself. Every Monday at 8 AM it covers the previous Monday to Sunday, and on the first weekday of each month the whole previous month. [Open the drawing](/architecture/doc-coach).

## The sprint

June 8. The design spec went in at 2:32 PM. By 3:33 PM it had prompts and schemas, the ledger reader, the Gemini generator, charts, the renderer, the job store, the orchestrator, the API, a retry sweep for failed reports, the UI, an end to end test and the docs. At 4:17 PM came the fix for the first real run, and at 4:39 PM the email that carries the whole report.

June 9 at 1:30 PM the weekly and monthly schedules shipped.

Then a Monday report did not arrive, and someone noticed. A single network blip at 8 AM had claimed that week's marker before the ledger read failed, so the scheduler thought the week was done. The fix released the marker whenever an attempt fails before a report exists, so the next tick five minutes later tries again.

On September 14 the recipient list grew from two people to the CEO, the operations group and every doctor with at least one consult in the period. Doctors see each other's scores on purpose. A doctor with no consults in the window is left off.

## The hard parts

**Strict where it feeds a database, forgiving where it feeds a page.** I copied the consult grader's discipline: validate the JSON against a schema, retry once with a hardened prompt, then stop. For report cards that was too strict. The model failed validation twice and the first real run quit at 20 percent. The scorecard schema stays strict because every field becomes a column in the ledger. The comparison schema went from four required sections, closed objects and length caps to one required headline and plain types. A worked example in the prompt now drives the quality, and the renderer reads every field with a default. The schema's own description says it: forgiving on purpose.

**8 AM, exactly once.** There is no Cloud Scheduler job here. A loop inside the service wakes every 5 minutes and fires when it is past 8 AM in New York and the period is not yet claimed. The claim is an atomic Firestore marker, so two instances or a restart cannot send the week twice, and a deploy over 8:00 just means it fires a few minutes late. The slim container image also had <span class="egg" tabindex="0" data-egg="Python knows the date. It just had no idea where it was. tzdata fixed its sense of place.">no timezone data</span>, so asking for New York time would have crashed. tzdata went into the image before the first Monday.

**Examples that are real.** A comparison is only useful if its examples happened. Each report pulls at most two transcripts per doctor, their best and worst by percent, and the prompt asks for exactly 3 good and 3 bad moments, each with the doctor, the quote and the lesson. When outcomes from the case boards are available, it may compare conversion, but only with the numbers it was handed. The prompt says never invent or recompute a statistic.

## What I said no to

**The radar chart.** I built one at 3:00 PM and removed it at 4:39 PM the same day. It looked bad, so it went. The weekly trend line stayed.

**Watching the videos again.** Analyse reads the stored summaries and at most two transcripts a doctor. The expensive reading already happened at consult time, and a report card should not pay for it twice.

**Pages about nobody.** A doctor with zero consults in the window gets no page and no email, and a period with no consults at all is skipped quietly. Its marker is still claimed, so the scheduler does not check again every five minutes all day.

## Where it landed

The weekly report lands Monday at 8 AM and the monthly one on the first weekday, for the CEO, the operations group and the doctors who had consults. Anyone can also run one from the Analytics tab for any doctors and range, and every run is saved with its PDF in Drive and rows in two Sheet tabs.

Since October 29 the instance stays warm 7 AM to 7 PM, and 8 AM sits inside that window. Cost is not measured yet: the billing export for this project only switched on October 28, 2026.

I have not pulled a count of reports sent, and I do not have a measure of whether report cards changed how doctors run consults. Both are open.

What I would keep: let the strictness of a schema follow where its output goes. A database row needs a contract. A page of coaching needs a good example.
