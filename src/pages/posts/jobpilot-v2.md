---
title: "My resume scored 73/100. So I built the grader."
date: "2026-06-11"
layout: ../../layouts/PostLayout.astro
description: "JobPilot, one day later: a ResumeWorded-style judge that scores every resume, a rewrite loop that argues with Gemini until the score goes up, and the whole thing open-sourced."
img_path: "/jobpilot-judge.png"
img_alt: "A resume being graded by a glowing rubric machine, red marks turning green"
tag: "Process"
tone: "amber"
stats:
  - value: "73 → 82"
    label: "real ResumeWorded score, one calibration loop in"
    tone: "amber"
  - value: "≤ 10 rewrites"
    label: "judge-guided attempts per resume, best one wins"
    tone: "blue"
  - value: "20 runs/day"
    label: "hourly fetches + 4 full pipeline runs"
    tone: "emerald"
---

[Yesterday I built JobPilot](/posts/jobpilot), a job-search autopilot on GCP. Then I actually used it for a day, applied to 29 jobs, and found out everything the first version got wrong. This is the changelog, with receipts.

## The humbling

I dropped my best resume into ResumeWorded, the grader recruiters keep recommending. **73/100.** My hand-tuned, keyword-stuffed, very-proud-of-it resume. 73.

Worse: my own pipeline's "ATS check" was giving that same resume a 100. My grader was a golden retriever. It loved everything.

So I did the only reasonable thing: researched how the real graders actually work (their published checks, help docs, and a pile of score reports people posted online) and rebuilt my judge as a replica.

## What resume graders actually punish

The rubric that came out of the research, now encoded as ~40 deterministic checks:

- **Impact (35 pts):** every bullet needs a number. Not "improved performance." A number. Each unquantified bullet bleeds points.
- **Brevity (20):** bullets over 2 lines (about 24 words) get skipped by humans and dinged by machines. Recruiters give each bullet about 2 seconds.
- **Style (15):** buzzwords are radioactive. Their own ban list includes "scalable" and "robust," which is most engineering resumes. Also: em dashes read as machine-written, so the judge bans those too.
- **Sections (15):** standard headers, education dates, one page, a summary with at least one concrete fact in it.
- **Soft skills (15):** the silent killer for engineers. The graders look for *evidence* of leadership and collaboration in your bullets, not a "team player" line. No "led" or "managed" or "partnered" anywhere? That's up to 15 points gone.

Calibration check: my new judge scored the old resumes 76 to 86. ResumeWorded said 73. Close enough to trust.

## The rewrite loop

Here's the part I like. A score is useless without a path up, so every resume now goes through a loop:

```
judge → violations list → Gemini rewrites (truth-locked) → recompile → judge again
```

Up to **10 attempts**, early exit at 90+, and the **best attempt wins**. A rewrite that scores worse gets thrown away; the system can only ever publish an improvement. Same loop runs for every per-job tailored resume, so each application ships with its own ATS report. About a penny per attempt.

The rewrites are truth-locked: reorder, rephrase, tighten, yes. Invent an employer, a metric, a skill: never. The score has to come from better writing, not better fiction.

Result so far: **73 → 82** on the real ResumeWorded, masters at 97 to 100 on the replica, and the gap closes a little more every time I feed a real report back in as new rules.

## Other things v1 missed

- **Hourly fetches.** The free job boards now get polled every hour, 20 runs a day total. LinkedIn stays on the 4 full runs because scraping it hourly would eat my free credits like popcorn.
- **The LinkedIn scraper was silently dead.** The actor I'd picked 403'd on every single run because it's rental-only on paid plans. Switched to a pay-per-result one: 65 fresh LinkedIn jobs landed in the first fixed run. Lesson: read the pricing model, not the star count.
- **An Applied tab with a confirm popup.** Click Apply, the posting opens, and when you come back the console asks "did you actually apply?" Yes: green tick, date stamped, moved to Applied. The count sits in the sidebar judging me. Currently: 29.
- **A dismiss button.** One ✕ and an irrelevant job is gone forever, but logged, so the dismissals become training data for the filters later.
- **Role filters.** The scorer now tags every job FDE / AIE / MLE / DE / DS / SWE, so I can run down all the forward-deployed roles in one sitting.
- **A real report viewer.** Click any resume's score and you get the PDF on the left, the full violation list on the right. Trust, but verify, but make it a modal.

## And then I open-sourced it

The whole thing is now public under MIT: [github.com/SampreethAvvari/job-pilot](https://github.com/SampreethAvvari/job-pilot).

- A fork guide written to be handed directly to an AI coding agent ("build me this"), covering every gcloud command, every OAuth click, and exactly which four Google scopes it needs and why.
- A structured **bug log of all 15 bugs** I hit, so nobody pays the same tuition: the XeTeX PDFs that ATS parsers read as "New Y ork," the Docker CMD that ate my job arguments, the OAuth consent I granted from the wrong Google account twice.
- Zero secrets and zero personal data in the repo or its history. My resumes and profile live in Secret Manager; the repo ships a Jane Doe.

## By the numbers

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-amber">
    <div class="stat-value">73 → 82</div>
    <div class="stat-label">external resume score after one calibration pass</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">~40 checks</div>
    <div class="stat-label">in the judge: impact, brevity, style, sections, soft skills</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">15 bugs</div>
    <div class="stat-label">hit, fixed, and published so you don't have to</div>
  </div>
</div>

The first post ended with "a job search is a pipeline problem, not a willpower problem." Day two's corollary: **a resume is a code-review problem.** You don't get better by staring at it harder; you get better by running it against a ruthless linter and shipping the fix. Mine just happens to argue with Gemini ten times before it lets anything through.
