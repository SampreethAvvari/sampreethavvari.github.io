---
demo: /demos/jobpilot
title: "The open source app that ran my job hunt 1,008 times"
date: "2026-06-13"
layout: ../../layouts/PostLayout.astro
description: "JobPilot watched 163 company boards, scored what survived the filters with Gemini, rewrote each resume against a strict judge, and drafted every email for me to send. Here is the whole system."
img_path: "/jobpilot-flagship.png"
architecture: "jobpilot"
img_alt: "A glass autopilot console with four colored data streams converging into a single resume taking flight"
tag: "Process"
tone: "blue"
stats:
  - value: "1,008 runs"
    label: "of the pipeline from June 10 to October 8, every 30 minutes at first, then twice each morning"
    tone: "blue"
  - value: "163 boards"
    label: "of companies' own career pages polled in parallel by June 12, across seven ATS types"
    tone: "emerald"
  - value: "100 vs 73"
    label: "my first resume checker's score against ResumeWorded's for the same file, so I rebuilt the judge"
    tone: "amber"
facts:
  - label: "Problem"
    value: "My first resume checker gave my resume 100 out of 100 where ResumeWorded gave the same file 73."
  - label: "What I built"
    value: "An open source app that ran my job search: 163 company boards, Gemini scoring, a resume judge, Gmail drafts."
  - label: "Outcome"
    value: "The pipeline ran 1,008 times, June 10 to October 8, and my ResumeWorded score rose from 73 to 82."
  - label: "Runs on"
    value: "A Cloud Run job, a Google Sheet as database and dashboard, and Gemini."
  - label: "Cost"
    value: "$11.64 on Google Cloud in September 2026, its last full month; $7.86 of it was Gemini."
  - label: "Status"
    value: "Off since October 8, 2026; the code stays public under MIT and the demo runs on fictional data."
---

## The problem

[The first version](/posts/jobpilot) took one night. It found jobs and wrote resumes. Then I used it every morning, and the gaps showed up one at a time.

My resume checker gave my real resume <span class="egg" tabindex="0" data-egg="The bug log calls that checker a golden retriever. Loyal, delighted with everything, no use as a grader.">100 out of 100</span>. ResumeWorded gave the same file 73. Recruiter replies sat in my inbox while the Sheet still said Applied. Adding a company meant editing a config file.

I was the only user, so the spec was whatever had annoyed me the morning before.

## What I built

JobPilot grew into a small product. A Cloud Run job polls 163 company boards and four aggregators. A Google Sheet is both the database and the dashboard. A resume judge drives a rewrite loop, an inbox watcher reads replies, outreach becomes Gmail drafts, and a console with a copilot sits on top. It is MIT licensed on [GitHub](https://github.com/SampreethAvvari/job-pilot), with a fork guide written to be handed to a coding agent.

[Open the drawing](/architecture/jobpilot) to see every part. The [live demo](/demos/jobpilot) runs the real console on fictional data.

## The sprint

v1.0 went public at 7:12 PM on June 10. The inbox watcher went in that same night and was done at 9:56 PM. By 11:10 the next morning it had a guard for one time passcode emails, after it alerted me twice that a company had replied when the company had only sent a login code.

June 11 brought the company watchlist and four more ATS types: Workday, SmartRecruiters, Workable and Recruitee. At 12:19 AM on June 12 the job got 2 GiB of memory, because the parallel fetch across 163 boards ran out at the default. The copilot shipped that afternoon and the US only location wall at 7:55 PM. Cold outreach landed at <span class="egg" tabindex="0" data-egg="Cold emails written at 4:41 AM. None of them were sent at 4:41 AM. Drafts only.">4:41 AM on June 18</span>.

The busiest day came a month later. On July 23 an audit of the Sheet turned into a rebuilt console, and July 24 went into knowledge graphs of my portfolio and GitHub to ground the copilot. The last change went in at 3:23 AM on July 25.

## The hard parts

**A judge I could check against a real one.** The first checker only measured keyword coverage, which is why it loved everything. I rebuilt it as a replica of ResumeWorded's rubric: about 40 checks, weighted impact 35, brevity 20, style 15, sections 15 and soft skills 15. Calibrated against the real thing, it scored my old resumes 76 to 86 where ResumeWorded said 73. Then every tailored resume goes through a loop:

```python
# src/jobpilot/rewrite_loop.py
report = judge(tex, pdf, keywords)
if best is None or report["score"] > best[0]:
    best = (report["score"], tex, pdf, report)
issues = report["issues"]
if passes(report, min_score):
    break
```

The issues go back to Gemini, which may reorder and rephrase but never invent. Up to 10 tries, an early exit at 90 with 85 percent keyword coverage, and the best attempt wins. My real ResumeWorded score went from 73 to 82 after one pass.

**The same job, five times.** One role sat in the Jobs tab five times, and there were 23 duplicate groups in 426 rows. Exact duplicates were zero. The key was the problem: it hashed company, title and location, and boards list one role per city. The key is now company and title, and the Sheet's old ids are recomputed from those two columns, so rows saved under the old key are recognized.

**Failures that made no sound.** The fast fetch never ran once. Its trigger passes arguments to the job, which needs a permission the plain invoker role lacks, so every attempt returned 403 to nobody. The console's Tailor and Draft buttons failed the same way. One narrow role on the job fixed both, and the bug log tells every fork to check job status after any IAM change.

## What I said no to

**Guessing email addresses.** Outreach uses a careers email the company published, found on its site, in the job post, or through a web search. No recipient means no draft.

**A database migration.** The July audit found 5,093 rows in the Jobs tab and 2,960 New rows older than 30 days. I kept the Sheet and added an Archive tab, a 14 day window and a fit 75 gate. Dedup reads both tabs, so nothing archived comes back.

**Big tech portals.** The seeded watchlist leaves out the largest companies with custom career sites built to block scrapers. The aggregators already cover them.

## Where it landed

It ran my search every morning. The pipeline ran 1,008 times from June 10 to October 8: every 30 minutes through June 25, then twice each morning, at 7 and 9. By the July audit it was adding 22 to 58 fresh rows a day.

In September, its last full month, Google billed $11.64 for the project, and $7.86 of that was Gemini. My own copy has been off since October 8. The code stays public, and the demo runs the console on fictional data.

I never measured hours saved or which interviews came from it.

What I would keep: run the cheapest filter first, check any judge against a real grader before trusting it, and keep a person on the send button.
