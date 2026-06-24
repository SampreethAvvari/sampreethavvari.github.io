---
title: "How I built a job-search autopilot in 5 hours"
date: "2026-06-10"
layout: ../../layouts/PostLayout.astro
description: "Refreshing LinkedIn for jobs that were posted three weeks ago is not a strategy. So I built JobPilot: 7 job sources, 4 runs a day, 4 tailored resumes, one dashboard, for under $5 a month."
img_path: "/jobpilot.png"
img_alt: "JobPilot, a stream of job postings funneling into one tailored resume, taking flight"
tag: "Process"
tone: "blue"
stats:
  - value: "5 hours"
    label: "from idea to deployed on GCP"
    tone: "blue"
  - value: "< $5/mo"
    label: "total running cost"
    tone: "emerald"
  - value: "7 sources, 4×/day"
    label: "fresh jobs, automatically"
    tone: "amber"
---

Here's what applying from LinkedIn alone actually looks like: a posting says "2 weeks ago," it's been reposted twice, 1,000+ people clicked Apply, and (the part that stings if you're an international student) paragraph six says *"unable to provide visa sponsorship."* You read all of it anyway. Multiply by fifty, every day, forever.

I decided my evenings were worth more than that. So one night I sat down with Claude Code and built **JobPilot**, a job-search autopilot that runs on GCP while I sleep. Total build time: **about 5 hours**.

## Where the jobs actually come from

The trick is to skip the aggregator lag and go to the source. JobPilot pulls from **7 sources**, almost all free:

- **Greenhouse, Lever, and Ashby**: the ATS boards companies *actually post to first*. I watch **39 companies** directly: Stripe, Anthropic, OpenAI, Databricks, Notion, Ramp, Figma, Datadog, Palantir, Cursor… These APIs are public, keyless, and free.
- **Hacker News "Who is Hiring"**: free via the Algolia API.
- **RemoteOK**: free public JSON.
- **Adzuna**: free API key, capped to postings ≤ 2 days old.
- **LinkedIn**: yes, it's still in there, via an Apify scraper actor on free credits, capped at 50 results from the last 24 hours so it never costs real money.

A job posted on a company's Greenhouse board this morning is in my inbox by the next run. That's the whole point: **I see jobs hours old, not weeks old.**

## The pipeline (runs 4× a day)

Cloud Scheduler kicks off a Cloud Run job at midnight, 6 AM, noon, and 6 PM ET:

```
fetch (7 sources)          ~100 jobs per source, in parallel
  → filter                 drop stale, senior, contract, no-sponsorship
  → dedupe                 SHA1(company|title|location) across sources
  → score                  Gemini 2.5 Flash, fit 0-100, batches of 10
  → record                 Google Sheet, 27 columns
  → scan Gmail             classify replies → update statuses
  → tailor                 auto-tailor every job scoring ≥ 60
  → digest                 one email: today's shortlist, ranked
```

The dedupe step matters more than it sounds: the same job shows up on LinkedIn, Adzuna, *and* the company's own board. JobPilot hashes company + title + location, keeps the highest-fidelity source, and I see it exactly once.

## Built for the international-student reality

This is the part no job board does for you. Before any job even reaches the scorer, **13 regex patterns** auto-reject the dead ends:

- "US citizenship required" → gone
- "security clearance / TS-SCI / polygraph / ITAR" → gone
- "unable to provide visa sponsorship" / "cannot sponsor" → gone
- senior / staff / principal / 5+ years / contract / part-time → gone (I'm early-career; 0 to 2 years only)

Then the scorer double-checks: if the description *hints* sponsorship is unlikely, the fit score gets capped at 10 and the row is auto-rejected with a note. I never spend ten minutes reading a posting that was never going to work.

## Four resumes, tailored while I sleep

I keep **4 master resumes** as one-page LaTeX files: SDE, MLE, AI Engineer, and Forward-Deployed Engineer. The scorer picks which variant fits each job, then Gemini tailors it:

- **Automatic** for anything scoring ≥ 60 (capped at 15 per run).
- **One click** for everything else, a Tailor button in the dashboard.
- Output: a tailored one-page PDF **plus a matching cover letter**, compiled with pdflatex, filed into Drive as `{company}_resume.pdf`.

Two guardrails I refuse to ship without. First, **truth**: the model may reorder, rephrase, and re-emphasize, but it may never invent an employer, a date, a metric, or a skill. Second, **format**: if the PDF spills past one page, it gets recut automatically, and an ATS check gates every resume at ≥ 85% keyword coverage.

Cost per tailored resume + cover letter? **About a penny.** Gemini 2.5 Flash is absurdly cheap for this.

## The application pipeline, tracked

Every job moves through stages in the Sheet: **New → Applied → Response → Interview → Offer** (or Rejected). The fun part is that the statuses update themselves: a Gmail scanner reads the last 3 days of replies, matches them to tracked applications, and classifies each one: rejection, interview invite, next steps.

Two hard rules: the system **never sends an email on its own** (outreach drafts land in my Gmail drafts, I hit send), and automation **never overwrites my manual edits**, it only ever moves a status forward.

## The dashboard

A Next.js console on Cloud Run (locked behind IAP, so only I can see it) sitting on top of a Google Sheet that serves as the entire database. Filter by fit, source, status, resume variant; click Tailor; read the "why" the scorer wrote for each match. Plus a morning digest email with the day's shortlist ranked by fit. Most days I make my apply list from the email alone.

## Tech stack & what it costs

- **Pipeline:** Python 3.12, httpx, pydantic, on a Cloud Run job
- **Brain:** Gemini 2.5 Flash on Vertex AI (scoring + tailoring + reply classification)
- **Resumes:** LaTeX + pdflatex in Docker
- **Dashboard:** Next.js 16 on Cloud Run, behind IAP
- **Database:** a Google Sheet (genuinely; it's free, visual, and I can edit it from my phone)
- **Glue:** Cloud Scheduler, Secret Manager, GitHub Actions auto-deploy on push

| | Cost |
|---|---|
| Setup | $0 |
| Cloud Run + Scheduler + Sheets + Drive | ≈ $0 (free tiers) |
| Gemini 2.5 Flash (scoring ~hundreds of jobs + tailoring daily) | pennies |
| Apify LinkedIn scraper | $0 to $5/mo (free credits) |
| **Total** | **< $5/month** |

## By the numbers

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-blue">
    <div class="stat-value">5 hours</div>
    <div class="stat-label">idea → deployed on GCP</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">&lt; $5/mo</div>
    <div class="stat-label">to run the whole thing</div>
  </div>
  <div class="stat-callout stat-amber">
    <div class="stat-value">~1¢</div>
    <div class="stat-label">per tailored resume + cover letter</div>
  </div>
</div>

| | LinkedIn alone | JobPilot |
|---|---|---|
| Job freshness | days to weeks old, reposts | hours old, straight from ATS boards |
| Sponsorship dead ends | read them all yourself | auto-rejected before you see them |
| Resume per application | one generic PDF | 1 of 4 variants, tailored per job, ~1¢ |
| Tracking | a spreadsheet you forget to update | statuses update from your inbox |
| Daily effort | hours of scrolling | read one digest email |

One last detail: the hero image on this post was generated by Nano Banana inside the same GCP project the pipeline runs in. The job hunt is fully on-brand now.

The realization that made me build this: **a job search is a pipeline problem, not a willpower problem.** Recruiters have ATS systems, dashboards, and automation on their side of the table. There's no rule that says applicants can't have the same. Mine just had to cost less than a coffee.
