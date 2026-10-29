---
title: "One registry serves the Denticon book to every Hybridge app"
date: "2026-09-28"
layout: ../../layouts/PostLayout.astro
description: "Two apps needed the appointment book, and only one service may hold the Denticon keys. I built a small read only API over our mirror, with a secret per caller and strict offices."
img_path: "/cdf-registry.png"
architecture: "cdf-registry"
img_alt: "CDF Registry API: the Denticon mirror in the middle, the estimator and the capacity planner reading it through their own secrets"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "27 minutes"
    label: "from the planner's routes going live at 5:04 AM on Sep 29 to the planner's production reading through them"
    tone: "emerald"
  - value: "1 key holder"
    label: "Denticon credentials sit on one service; the estimator and the planner each hold only a bearer for the registry"
    tone: "blue"
  - value: "400"
    label: "the answer to an office code the planner's routes do not know, so a typo can never empty a calendar"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Two apps needed the Denticon appointment book, and only one service may hold Denticon credentials."
  - label: "What I built"
    value: "A small read only registry API over our Firestore mirror of Denticon, with its own secret per caller."
  - label: "Who uses it"
    value: "The treatment estimator's landing page and the capacity planner, which reads the book every minute."
  - label: "Outcome"
    value: "Neither app holds Denticon credentials, and an unknown office code answers 400 so no calendar is emptied."
  - label: "Runs on"
    value: "Routes on the CDF dashboard service on Cloud Run, reading Firestore and never calling Denticon."
  - label: "Built"
    value: "27 minutes from the planner's routes going live to its production reading them, September 29, 2026."
---

## The problem

Denticon, our practice system, holds every appointment at the three offices. On September 21 two of my apps needed that book.

The treatment estimator was getting a new landing page. My commit that day put it plainly: "The thing a coordinator opens this app to find out is who is coming in today." The capacity planner, which places doctors across the three offices, needed the whole book every minute.

One rule stood in the way, and I had written it myself: only the CDF holds Denticon credentials, and no other repo gets its own, not even as a fallback. The planner's early plan had reserved Denticon secrets in its own project, and my handoff flagged that as a contradiction to fix.

## What I built

A registry: five read only routes on the CDF dashboard service, over the Firestore mirror that the [Denticon sync](/posts/denticon-sync) keeps fresh. The estimator gets one local day of the book, joined to patient and provider names. The planner gets the book by date window or by what changed, plus providers, visit types and chairs.

Each caller has its own bearer secret, compared in constant time, and the registry never calls Denticon. Answers to the planner carry each office's mirror health, so it can show old data as old. [Open the drawing](/architecture/cdf-registry).

## The sprint

The first route went in at 1:42 PM on September 21. At 6:19 PM a run against real data found the query had no index, which would have shown the estimator an empty day while the log said "failed after 300ms: Error".

On September 28 both sides went live three minutes apart: the estimator's new landing page at 1:50 AM and the route it reads at 1:53 AM.

The planner's routes went in between 3:24 AM and 4:22 AM on September 29 and were live at 5:04 AM. At 5:31 AM the planner's production was reading its appointments through them.

On October 1 the registry started serving a block's text as a note, so a reserved hour could read <span class="egg" tabindex="0" data-egg="Denticon stores a block's text in the patient name columns, so the lunch break arrives looking like a patient named LUNCH, LUNCH.">LUNCH</span> on the planner. Both sides shipped that day.

## The hard parts

**A day is a local day.** A day is computed per office from the office table, with the offset read from `Intl`, because March 8, 2026 is 23 hours long and November 1 is 25. A fixed minus five puts a March morning appointment on the previous day.

**What counts as a consult.** An appointment carries only a production type id. Consults are types 8 and 19, In Off Consult and Zoom Consult. At 6:03 PM on September 21 I took out NP Intake, the paperwork visit before the consult: counting its 1,054 visits in the staging mirror would have put consults at 1,693 instead of 639. Rows from before the Rochester migration carry no type, so the route reports how many it could not judge.

**A dropped office is a cancelled calendar.** The planner cancels whatever a full read does not return. The estimator's day view can drop a mistyped office and lose nothing, but on the planner's routes an unknown office answers 400:

```ts
// lib/registry/shared.ts
const office = byEstimatorCode[code as EstimatorCode];
if (!office) return { ok: false, error: OFFICES_ERROR };
```

A window over 10,000 rows answers 413, and a change set over 5,000 tells the caller to read windows, because a sweep stamps one time on every row and leaves nothing to page on.

## What I said no to

**Denticon credentials in the planner's project.** The planner holds one bearer for the registry and nothing else. Revoking it does not touch the estimator's.

**Live calls to Denticon per request.** Every answer comes from the mirror in Firestore.

**One shared secret.** Each caller gets its own, so a leak in one app is one rotation.

## Where it landed

Two apps read the registry: the estimator's landing page, the first screen every coordinator sees, and the planner, which reads the book and the provider list every minute.

Its cost is not measured: the billing export for the CDF's project only switched on Oct 28, 2026. I have not counted requests either.

What I would keep: a route that refuses what it cannot answer correctly. An empty answer that looks valid is the one a caller acts on.
