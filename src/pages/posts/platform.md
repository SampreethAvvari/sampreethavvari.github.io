---
title: "How one engineer runs 45 services for a three office practice"
date: "2026-10-29"
layout: ../../layouts/PostLayout.astro
description: "A dental implant practice with three offices and its own lab runs on 45 live services I built. Here is the map, every service on it, and the patterns that keep them running."
img_path: "/platform.png"
architecture: "platform"
img_alt: "Hybridge Platform: patient forms, three shared services and the apps around them, with Denticon, Monday and Google outside"
tag: "Architecture"
tone: "blue"
stats:
  - value: "45 services"
    label: "live on Google Cloud across 14 projects, checked on Oct 29, 2026"
    tone: "emerald"
  - value: "1 key holder"
    label: "for Denticon: every other app reads the mirror through the CDF registry"
    tone: "blue"
  - value: "$132"
    label: "Google Cloud from Oct 1 to 28 for the six projects the billing export measured"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Hybridge's day runs on systems that do not talk: Denticon, Monday, Zoom, a phone system and spreadsheets."
  - label: "What I built"
    value: "45 live services in 14 Google Cloud projects, around three shared services and one request relay."
  - label: "Who uses it"
    value: "Coordinators, doctors, office directors, leadership, marketing, the lab, and every patient who fills in a form."
  - label: "Runs on"
    value: "Cloud Run, BigQuery and Firestore on Google Cloud, listed with gcloud on October 29, 2026."
  - label: "Cost"
    value: "$132 from October 1 to 28, 2026, for the six projects the billing export measured."
  - label: "Built"
    value: "Live since April 21, 2026, all built and run by one engineer."
---

## The problem

Hybridge is a dental implant practice with offices in Rochester, Buffalo and Syracuse, and its own lab. Its day runs on systems that do not talk to each other: Denticon for charts and bookings, Monday for leads and patient boards, Zoom for consults, a phone system that records calls, the lab's case and scan systems, and a lot of spreadsheets.

Every team brought me one problem. Our VP of finance wanted every website inquiry inside our own cloud, with none lost. Coordinators had four tabs and four ids for one patient. The operations lead planned doctors in an Excel workbook of twenty pasted weeks. Our marketing lead's simplest question lived in five logins.

Each problem is small. Solving each one where the data already lives is how a practice this size ends up with 45 services.

## What I built

45 live services in 14 Google Cloud projects, <span class="egg" tabindex="0" data-egg="Counted from read only gcloud listings that afternoon. The on call rotation for all of them fits on one line.">listed with gcloud on October 29</span>. Three shared services carry the most weight: the Denticon sync keeps a copy of Denticon, the CDF registry serves it to other apps, and the PDF renderer turns surveys into reports. A fourth, the request relay, lets six apps file feature requests into one list. [Open the drawing](/architecture/platform), or browse [every drawing](/architecture).

## Patient forms and surveys

Drawing: [Hybridge Forms](/architecture/hybridge-forms).

- **Public forms.** Shows the inquiry forms on four Hybridge websites and saves each send with its delivery jobs in one write. One instance stays warm.
- **Forms dashboard.** Staff build and publish forms, read inquiries and map fields to Monday columns, behind Google sign in.
- **Delivery worker.** Puts each inquiry on the Monday Leads board and emails the copies within seconds. A queue task wakes it on every send, and a sweep runs every minute.
- **Nightly checks.** At 2 AM loads every form, sends a test, and moves any inquiry stuck in the backup bucket into the database.
- **Patient surveys.** The intake survey before a consult and the experience survey after, on an office tablet or from a link. Each submit becomes one named task for the renderer.

## The shared core

Drawings: [Denticon sync](/architecture/denticon-sync), [CDF registry](/architecture/cdf-registry), [PDF renderer](/architecture/pdf-renderer), [CDF dashboard](/architecture/patient-dashboard).

- **Denticon sync.** Keeps the Firestore mirror of Denticon from webhooks, a worker every ten minutes and a 4 AM poll. The only service with Denticon credentials.
- **CDF dashboard and registry.** The staff screen with one row per patient, and the read only routes the estimator and the planner call with their own secrets.
- **PDF renderer.** Turns a finished survey into a patient summary and a doctor report, mails them, and tells the CDF. The survey queue, the CDF and an hourly sweep call it.

## Estimator and planner

Drawings: [Treatment estimator](/architecture/treatment-estimator), [Capacity planner](/architecture/capacity-planner).

- **Treatment estimator.** Coordinators build and present estimates and treatment sequences, and open on the day's consults from the registry.
- **Capacity planner.** Shows leadership who is where across the three offices. A scheduler job reads the book every minute, and a 7 AM email goes out on weekdays.

## Launchpad

Drawings: [Launchpad](/architecture/launchpad), [request relay](/architecture/feature-requests).

- **Launchpad.** One page that opens every Hybridge app, with a Work board for four leaders and every app's feature requests.
- **Request relay.** Launchpad's image deployed a second time without IAP. Six apps call it from their servers with their own Google ID tokens.

## Marketing data

Drawings: [Marketing warehouse](/architecture/marketing-warehouse), [Data connector](/architecture/data-connector).

- **Nine source pulls.** At 6 AM one Cloud Run job per source copies recent days from CallRail, Meta ads, Meta organic, Microsoft Ads, TapClicks, Monday, GA4, Search Console and Business Profile into BigQuery.
- **Google Ads transfer.** A managed BigQuery transfer copies the Google Ads tables daily.
- **Monday backup.** Wednesdays at 7 AM loads the board exports staff drop in Drive, to check the API copy.
- **View rebuild.** At 6:20 rebuilds each person's data views, so nobody waits on a first question.
- **Morning email.** At 6:30 sends the Marketing Data email with one Excel tab per source.
- **Health check.** At 6:45 checks that every source landed and no number jumped oddly.
- **Question quiz.** Mondays at 8 AM asks a model questions with known answers, to check the warehouse still answers them right.
- **Data connector.** Lets approved staff ask Claude about marketing data with their own Google sign in.
- **Status page.** One page that shows whether each feed ran.

## Coaching

Drawings: [Doc Coach](/architecture/doc-coach), [NPC Coach](/architecture/npc-coach).

- **Doc Coach.** When a Zoom consult recording finishes, Gemini scores the doctor against a written rubric and drafts a note, and the report goes to the doctor and the coordinator. Zoom's webhook wakes it.
- **NPC call poller.** Every five minutes in the work day picks up new phone recordings, keeps new patient calls and grades them against the playbook.
- **NPC daily summary.** At 5 PM on weekdays emails each coordinator's average and what to work on.
- **NPC Coach dashboard.** Managers and coordinators browse graded calls, transcripts and recordings.

## The lab

Drawings: [CBCT validator](/architecture/cbct-scan-validator), [Doctor Portal](/architecture/doctor-portal).

- **CBCT validator.** When a scan zip lands in storage, a model checks its quality, and a PDF verdict is written and emailed. A storage event wakes it.
- **SFTP drop box.** A small VM where the lab's scan system leaves scans and picks up verdicts.
- **Training data job.** At 6 AM turns labeled scans in Drive into training data for the model.
- **CBCT review app.** The testing team uploads a study, records the true verdict, and sees each model's hits and misses.
- **Doctor Portal.** Where outside doctors will send an Rx and follow their cases, in preview on sample data.

## Money and operations

Drawings: [Cowork Dashboard](/architecture/cowork-dashboard), [Daily Sales Report](/architecture/daily-sales-report).

- **Cowork ingest.** Turns the weekly Monday exports in Drive and a daily read of the three patient boards into one snapshot. A scheduler checks it every five minutes.
- **Cowork Dashboard.** Leads, cases, cash flow and pace, computed in the browser from that snapshot.
- **DSR pipeline.** Weekday mornings reads the lab's sales and new starts reports, updates the warehouse, forecasts, checks the numbers and publishes the Daily Sales Report.
- **DSR dashboard.** The report as sent, past runs and the monthly inputs.
- **Reconciliation.** Staff upload a day's schedule, ledger and notes exports and get back only the patients whose billing and notes disagree.

## Websites

Drawings: [Patient website](/architecture/hybridge-website), [Lab website](/architecture/hybridge-lab).

- **Patient website.** The new patient site in preview, with a tool that shows a visitor a new smile on a photo of their own.
- **Lab website.** The new site for doctors who send cases to the lab, in preview.

## The hard parts

**One holder of each key.** Denticon credentials live on the sync service and nowhere else. The estimator and the planner each hold one bearer for the registry, so revoking one never blinds the other.

**Machines sign their calls.** Every scheduler job, queue task and app to app call carries a token. The relay checks each app's Google ID token and lets an app file only about itself. The renderer and the CDF trade identity tokens instead of a shared secret.

**Zero instances, except where speed matters.** The estimator, the planner, Launchpad and the forms worker scale to zero. The Denticon webhook receiver keeps one instance warm because Denticon wants a reply in ten seconds, and the public forms keep one as well.

**A sweep behind every queue.** Forms deliveries retry at one minute, ten minutes and an hour. The renderer's queue has an hourly sweep behind it. Denticon's webhooks have a 4 AM poll. Gemini calls retry and fall back through newer models.

## What I said no to

**Writing to Denticon.** Every app reads; staff make every real change in Denticon themselves.

**Replacing the tools staff already use.** Denticon stays the record and Monday stays the board. The services read from them and, for leads, add one item to Monday.

**A second build for a second service.** The CDF dashboard and the Denticon sync share one image, and so do Launchpad and its relay.

## Where it landed

Coordinators, doctors, office directors, leadership, marketing and the lab use these services, and so does every patient who fills in a form or a survey.

The six projects the billing export measured cost $132 from October 1 to 28: CBCT validation $61.76, the estimator $33.88, the capacity planner $27.07, and Forms, Launchpad and the Doctor Portal $9.00 together. The other eight projects hold the CDF, marketing data, Cowork, the Daily Sales Report, Doc Coach, NPC Coach, Reconciliation and the websites. Their billing export only switched on Oct 28, 2026, so they have no measured month yet. I have not counted requests from the logs either.

What I would keep: one holder for each key, and a sweep behind every queue.
