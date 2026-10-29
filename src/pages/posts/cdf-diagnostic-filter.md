---
demo: /demos/patient-assessment
title: "Gemini reads the patient first, and the clinic waits for both reports"
date: "2026-07-10"
layout: ../../layouts/PostLayout.astro
description: "Intake and experience surveys with Gemini writing the doctor's page and a panorex read under the founder's own rules. Every call falls back through newer models, and clinic emails wait for both reports."
img_path: "/cdf-diagnostic-filter.png"
architecture: "cdf-diagnostic-filter"
img_alt: "Centralized Diagnostic Filter: CBCT, intraoral scans, photographs, and a risk survey converging into one standardized diagnostic report"
tag: "Architecture"
tone: "amber"
stats:
  - value: "6 Gemini calls"
    label: "psychographic, panorex read, risk read, intake extract, feedback summary and voice, all through one retry and fallback chain"
    tone: "emerald"
  - value: "2 of 2"
    label: "reports before a clinic list gets an email. Until then the task retries, and an hourly sweep keeps trying after"
    tone: "blue"
  - value: "4 cases"
    label: "the founder read aloud on camera, turned into the written ruleset the panorex read follows, then revised in the founder's own review"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Our pre consult assessment ran on a third party platform, with each report screenshotted into OneNote by hand."
  - label: "What I built"
    value: "Intake and experience surveys that become a patient summary and a doctor report, with Gemini writing the doctor's page."
  - label: "Who uses it"
    value: "Patients at all three offices fill in the intake before a consult: 103 real intakes by September 30."
  - label: "Outcome"
    value: "One questionnaire now serves three offices, and reports email the patient and the clinic and file to Drive."
  - label: "Runs on"
    value: "Cloud Run, Cloud Tasks and Gemini on Vertex AI, with every call falling back through newer models."
  - label: "Built"
    value: "First commit at 1:48 AM on June 19, 2026, and on Cloud Run at 3:06 AM."
---

## The problem

In June our founder gave me an overview of what the founder called the Centralized Diagnostic Filter. Its first rule was in capitals: the goal is "NOT simply to create AI that reads radiographs." The goal was every input a complex case generates turned into one consistent first read before the consult. And one line that does not bend: "AI assists, doctors validate." The final diagnosis stays with the doctor, which the founder called "critical both clinically and legally."

The front door was broken first. The pre consult assessment ran on a third party intake platform. My June 19 spec lists what I was told: the practice did not own its patients' answers, one person could edit a question or add a recipient, a staff member screenshotted pages of each report into OneNote and filed it in Drive by hand, and three offices ran three copies of one questionnaire because the vendor could not route by office.

## What I built

Two surveys, a report pipeline, and the AI that reads them. The intake is one questionnaire for three offices; the experience survey takes spoken answers too. A submit becomes one named Cloud Task. A renderer makes the patient's summary, with no risk score on it, and a doctor report with a psychographic page Gemini writes from the answers. It emails the patient, then the office's clinic list, and files everything to Drive.

On demand from the dashboard, the diagnostic read sends the patient's panorex and photos to Gemini under a ruleset built from four cases our founder read aloud. Six features call Gemini, and all six go through one function that retries and falls back to newer models. [Open the drawing](/architecture/cdf-diagnostic-filter).

## The sprint

The first commit went in at 1:48 AM on June 19, and a branded shell was on Cloud Run at 3:06 AM. By 11:49 PM the renderer, delivery and an append only audit log were in. By June 24 Gemini 2.5 Pro was writing the psychographic. On July 8 the founder's written review became ruleset v2.

August 24 was the hard day. Twice, the patient had their summary and the clinic got nothing, and no error surfaced anywhere. By that night I had shipped CPU kept on after the reply, memory sized for a browser per render, a reconcile sweep, then Cloud Tasks retries with a render that is safe to repeat. Two days later the experience survey went from first commit at 2:15 PM to last at 10:09 PM, voice input included.

When the practice rewrote the old ambassador question into ways a delighted patient can share their story, their approved copy was live on October 5 at 12:22 PM.

## The hard parts

**The clinic email waits for both reports.** On October 22 one intake's psychographic hit a single 429 from Vertex. Nothing tried again, so the clinic got the summary alone, and nothing would have gone back for it. Since October 23 the clinic email goes with both files or not yet. The hold is written on the report, the render answers 500, and Cloud Tasks comes back, up to ten attempts, with one alert before the last. Then the hourly sweep keeps trying, and it leaves the last <span class="egg" tabindex="0" data-egg="A held email retries for about an hour: ten tries of up to three minutes, plus backoff. Seventy five minutes is that hour plus a polite margin.">75 minutes</span> alone so it never races a retry and mails a list twice. The patient never waits for any of it.

**Every Gemini call has a way out.** The same week Google listed 2.5 Pro and 2.5 Flash as retired on October 20, while both still answered. So every call goes through one chain:

```ts
// packages/lib/src/gemini-models.ts
export const DEFAULT_GEMINI_MODELS: Record<GeminiTier, readonly string[]> = {
  pro: ['gemini-2.5-pro', 'gemini-4-argon', 'gemini-3.1-pro-preview', 'gemini-3.8-flash'],
  flash: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash'],
};
```

A 429, 5xx or timeout gets up to three tries on the same model, with a 2 to 20 second wait. A 404 means retired: skip it for six hours and send one alert. Anything else moves to the next model. All of it runs inside a time budget, 120 seconds for the psychographic, so a retry never outlasts the request. I checked all four pro models live on October 23.

**The model observes, the code counts.** Our founder read four panorexes on camera, narrating every call. Each rule in the ruleset cites its case and timestamp, and anything I synthesized is marked for the founder to confirm. Gemini lists which teeth are decayed, missing and filled. Plain code recomputes the destruction score and its band, so a model slip cannot produce a wrong total. The feedback summary works the same way: every point must cite a real quote, and one that does not is dropped in code. Where the model is weak, I measured it. Its tooth positions on a panorex were 50 to 70 percent wrong, so <span class="egg" tabindex="0" data-egg="Every finding hangs off a tooth number. Getting the number wrong is how you diagnose the neighbour.">tooth numbering</span> got its own evaluation before anything else was added.

## What I said no to

**A diagnosis or a treatment path.** The read is decision support. It never states a final diagnosis, and it does not pick a treatment path. That waits on our founder explaining, on the record, how a path gets chosen.

**The risk score on the patient's copy.** The patient gets a cover and a one page summary. The 0 to 200 score is for the doctor to explain in the room.

**Mixing that score into the panorex read.** The score stays separate until our founder reviews its weights. Answers like smoking or dry mouth can only raise risk.

## Where it landed

Patients at all three offices fill in the intake before a consult. By September 30 there were 103 real intakes. Each office's list is read at send time, so changing a recipient needs no deploy. I have not measured how often staff run the panorex read. The billing export for this project only switched on October 28, so there is no measured month of cost yet. Tooth numbering is still an open evaluation, because no ready to run open model for it exists.

What I would keep: anything that reports success while a clinic got nothing is the bug. Make the failure loud and the retry safe.
