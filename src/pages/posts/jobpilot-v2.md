---
title: "I built an open-source app to run my job hunt"
date: "2026-06-13"
layout: ../../layouts/PostLayout.astro
description: "JobPilot finds fresh roles across 160+ company boards, scores each against my profile, writes a tailored resume and cover letter per match, and tracks every reply to offer. It's now open-source, and it ended up touching all four things I do: data, ML, software, and shipping."
img_path: "/jobpilot-flagship.png"
img_alt: "A glass autopilot console with four colored data streams converging into a single resume taking flight"
tag: "Process"
tone: "blue"
stats:
  - value: "Open source"
    label: "MIT, fork it in an afternoon"
    tone: "amber"
  - value: "160+ boards"
    label: "company career pages watched directly"
    tone: "blue"
  - value: "< $10/mo"
    label: "the whole thing, end to end"
    tone: "emerald"
---

A few days ago [I built JobPilot in about five hours](/posts/jobpilot): a job-search autopilot that runs on GCP while I sleep. Then I actually used it, every day, and kept fixing what annoyed me. It has since grown from a one-night hack into the thing my whole search runs on, so today I did the obvious last step and open-sourced it: **[github.com/SampreethAvvari/job-pilot](https://github.com/SampreethAvvari/job-pilot)**, MIT, with a fork guide written to be handed straight to a coding agent.

Here is what it does now, and why it quietly turned into four projects wearing one trench coat.

## What a morning looks like

I open the console, sort by *recently posted*, and run down one role category at a time. Each job already has a fit score, a one-line "why," and the right tailored resume sitting one click away. I read the score's reasoning, hit **Apply ↗**, and the posting opens in a new tab. When I come back, the console asks whether I actually applied; yes stamps the date and moves it to **Applied**. An irrelevant job gets one **✕** and is gone forever, but logged, so the dismissals become filter training data later.

That is the whole daily ritual. No scrolling LinkedIn, no rereading the same reposted listing, no tab graveyard. The machine did the finding, scoring, and writing overnight; I do the deciding.

## Where the jobs actually come from

The trick is still to skip the aggregator lag and read companies' own boards. JobPilot now watches **160+ company career pages directly** across seven ATS types (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, Recruitee), plus RemoteOK, Hacker News "Who is Hiring," Adzuna, and LinkedIn through a pay-per-result Apify actor. Adding a company is one row in a watchlist: I paste a name and a careers URL, a resolver works out which of the seven ATSs it runs on, and that board joins the next poll. Eleven source adapters, one normalized job behind them. Free sources get polled **every hour**; the full run (LinkedIn, tailoring, outreach, digest) fires **four times a day**.

Two walls run before any compute is spent. A regex wall drops citizenship, clearance, and "cannot sponsor" postings, plus senior/staff/contract titles I'd never apply to. A new **US-only location wall** drops non-US roles entirely, and it knows that a state code beats a city-name collision, so "Vancouver, WA" stays and "Vancouver, BC" goes. A job posted on a company's board this morning is in my console by the next hourly run.

## The scorer, and the resume judge that argues back

Every surviving job goes to Vertex AI Gemini under a JSON-schema contract: fit 0 to 100, the reasoning, a sponsorship signal, a role category, and which of my four resume variants fits best. Anything scoring 60+ gets tailored automatically.

The piece I'm proudest of is the judge. My first version's "ATS check" gave my real resume a 100 while [ResumeWorded gave it a 73](/posts/jobpilot). So I rebuilt the grader as a replica: about **40 deterministic checks** weighted impact 35, brevity 20, style 15, sections 15, soft-skills 15. Then every resume, master or per-job tailored, runs a judge-guided rewrite loop:

```
judge → violations list → Gemini rewrites (truth-locked) → recompile → judge again
```

Up to ten attempts, early exit at 90, and the best attempt wins. A rewrite that scores worse is thrown away; the system can only ever publish an improvement. The rewrites are truth-locked: reorder, rephrase, and re-emphasize, yes; invent an employer, a date, or a metric, never. My real score went 73 to 82 on one calibration pass, and every application ships with its own ATS report you can open in the console.

## The copilot

The biggest addition since launch is a grounded chat assistant. It loads a knowledge pack (my GitHub, this portfolio, my resumes, my profile) and answers through a guardrailed Vertex chat, so it talks about *my* search with real context instead of guessing. Every job row also has a **💬** that opens its own independent chat drawer with the live job description fetched on the spot, and I can attach a PDF or an image (a JD screenshot, a recruiter's note) straight into the conversation. There's also a manual-job tailor flow for the role a friend forwards that no board ever surfaced.

## More than a table

The console grew with the search. It is no longer one screen but a small app: a jobs registry I triage every morning, an applied funnel that advances itself as replies arrive, a replies feed, a resume armory that shows each of the four variants with its live ATS score and a one-click rebuild, a companies watchlist with per-board health, and an outreach console where the drafts wait. The Google Sheet underneath is still the database, so I can fix anything from my phone and the console just reflects it.

## It never sends anything on its own

Two rules I refuse to ship without. The system **never sends an email by itself**: recruiter outreach is looked up through Apollo, written, and dropped into my Gmail drafts for me to send. For a company on my watchlist I have not applied to yet, it can find two or three hiring contacts and draft a cold intro the same way. Every one waits in drafts until I read it and hit send. And automation **never overwrites my manual edits**; it only moves a status forward.

The reply tracking got smarter too. An hourly inbox watcher reads the last couple of days across every inbox I connect, and a genuine next step (interview invite, scheduling request, assessment) triggers an **instant alert email** telling me which company replied in which inbox, with a link to the exact message. Rejections quietly update the tracker; "thanks for applying" autoresponders are ignored.

## Why it ended up being four projects in one

This is the part that surprised me. JobPilot isn't an AI project or a web project. It's all four things I do, stacked:

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-emerald">
    <div class="stat-value">Data + ML</div>
    <div class="stat-label">11 source adapters behind one schema; schema-locked Gemini scoring, a calibrated judge, and a truth-locked rewrite loop</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">Software</div>
    <div class="stat-label">Next.js 16 console behind IAP, a Cloud Run pipeline, 50+ tests, keyless CI/CD on Workload Identity Federation</div>
  </div>
  <div class="stat-callout stat-amber">
    <div class="stat-value">Shipping</div>
    <div class="stat-label">I was the user, so the spec was "what annoyed me yesterday." Every feature earned its place by surviving the next morning's search</div>
  </div>
</div>

That's the data engineer, the ML engineer, the software engineer, and the forward-deployed instinct of building the thing that actually gets used, in a single repo. It's the most honest portfolio piece I have, because I run it on myself.

## Fork it

The whole thing is public under MIT: **[github.com/SampreethAvvari/job-pilot](https://github.com/SampreethAvvari/job-pilot)**.

- A **fork guide** (`docs/FORK-SETUP.md`) written to be handed directly to an AI coding agent, covering every gcloud command, every OAuth click, and exactly which Google scopes it needs and why (drafts-only email, never auto-send).
- A structured **bug log** of everything I hit, so nobody pays the same tuition: the XeTeX PDFs that ATS parsers read as "New Y ork," the Docker CMD that ate my job arguments, the 163-board parallel fetch that OOM'd at the default memory.
- Zero secrets and zero personal data in the repo or its history. My resumes and profile live in Secret Manager; the repo ships a Jane Doe template.

## By the numbers

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-blue">
    <div class="stat-value">160+ boards</div>
    <div class="stat-label">company pages watched directly, plus 4 aggregator sources</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">73 → 82</div>
    <div class="stat-label">real ResumeWorded score after one calibration pass</div>
  </div>
  <div class="stat-callout stat-amber">
    <div class="stat-value">~1¢</div>
    <div class="stat-label">per tailored resume + cover letter, rewrite loop included</div>
  </div>
</div>

| | A normal job search | JobPilot |
|---|---|---|
| Job freshness | days to weeks old, reposts | hours old, straight from company boards |
| Sponsorship dead ends | you read every one | dropped before they reach you |
| Resume per application | one generic PDF | 1 of 4 variants, tailored and judged, ~1¢ |
| Tracking | a spreadsheet you forget | statuses update from your inbox |
| When a recruiter replies | you notice eventually | instant alert, with the message linked |

The first post said a job search is a pipeline problem, not a willpower problem. Three days of using my own pipeline taught me the sequel: a job search is also a *product* problem. The reason it works is not the model. It's the hundred small decisions around the model about what to drop, what to trust, and what to leave to me. So I open-sourced all of them.
