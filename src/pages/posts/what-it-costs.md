---
title: "What 45 services cost to run for a three office dental practice"
date: "2026-10-29"
layout: ../../layouts/PostLayout.astro
description: "Six measured Google Cloud projects for a dental practice cost $131.71 from October 1 to 28. Two always on databases are the biggest lines. Here is the table and what drives it."
img_path: "/what-it-costs.png"
img_alt: "Glass coin stacks of different heights, each topped by a small server block, joined by one line of light like a cost chart"
tag: "Architecture"
tone: "amber"
stats:
  - value: "$131.71"
    label: "on Google Cloud from Oct 1 to 28 for the six Hybridge projects the billing export measured, net of credits"
    tone: "emerald"
  - value: "$23.45"
    label: "for one small always on Postgres instance, the biggest line in both the estimator's and the planner's bill"
    tone: "blue"
  - value: "$1.29"
    label: "for all of the capacity planner's Cloud Run time in October, a sync every minute included"
    tone: "amber"
facts:
  - label: "Measured total"
    value: "$131.71 for six Hybridge projects, October 1 to 28, 2026, net of credits"
  - label: "Biggest line"
    value: "A small always on Cloud SQL Postgres instance, $23.45 each for the estimator and the planner"
  - label: "Scale to zero"
    value: "The estimator's Cloud Run cost $0.14 because it scales to zero between consults"
  - label: "One warm instance"
    value: "$7.14 of the forms project's $8.62, so the first patient never waits on a cold start"
  - label: "An AI app"
    value: "The CT scan checker cost $61.76; all its services, scoring included, used $0.68 of Cloud Run"
  - label: "Not measured yet"
    value: "Eight projects whose billing export only switched on October 28, 2026"
---

## How much does it cost to run 45 services on Google Cloud?

The six Hybridge projects with a measured month cost $131.71 on Google Cloud from October 1 to 28, 2026, net of credits. Most of it goes to the parts that never sleep: two small Postgres databases, one VM and one warm instance came to $76.55.

Hybridge is a dental implant practice with offices in Rochester, Buffalo and Syracuse and its own lab. I run 45 live services for it across 14 Google Cloud projects, mapped in [the platform post](/posts/platform). Six of those projects have a measured month. The other eight do not yet, because their billing export only switched on October 28, 2026.

## What did each project cost in October?

Net of credits, in US dollars, October 1 to 28, from the standard billing export:

| Project | What runs there | Oct 1 to 28 | Biggest line item |
|---|---|---|---|
| [CBCT scan validator](/architecture/cbct-scan-validator) | Scan checker, review app, training data jobs, SFTP VM | $61.76 | Cloud Run jobs CPU, $30.91 |
| [Treatment estimator](/architecture/treatment-estimator) | Estimator app and its Postgres | $33.88 | Cloud SQL instance, $23.45 |
| [Capacity planner](/architecture/capacity-planner) | Planner app, minute sync and its Postgres | $27.07 | Cloud SQL instance, $23.45 |
| [Hybridge Forms](/architecture/hybridge-forms) | Public forms, dashboard, delivery worker, nightly checks | $8.62 | Warm instance CPU, $4.76 |
| [Launchpad](/architecture/launchpad) | Board, request relay, the retired June board | $0.32 | Secret Manager, $0.20 |
| [Doctor Portal](/architecture/doctor-portal) | Portal on sample data, a parked duplicate list | $0.06 | Secret Manager, $0.05 |
| **Six projects** | | **$131.71** | |

Forms is a partial month, since its first cost landed on October 6. The Doctor Portal went live on the 28th, a day that was still loading when I queried, so its own month is not in this number.

## Why is the database most of the bill?

A Cloud SQL instance bills every hour it exists. The apps beside it bill only while they answer a request.

The estimator's Cloud SQL came to $33.20 of its $33.88, and $23.45 of that is the small instance alone. The planner's came to $24.98 of $27.07: the same $23.45 instance plus $1.53 of storage. For that the planner gets managed Postgres with daily backups and point in time recovery.

The apps themselves cost cents. The estimator's Cloud Run was $0.14 for the month, because it scales to zero between consults. [Open the estimator's drawing](/architecture/treatment-estimator) to see the database next to the app.

## What does a sync every minute cost?

All of the planner's Cloud Run time from October 1 to 28 came to <span class="egg" tabindex="0" data-egg="October 1 to 28 holds 40,320 minutes. Even if the sync had used every cent of it, each run cost well under a hundredth of a cent.">$1.29</span>. That covers the sync Cloud Scheduler fires every minute and every page people opened. The scheduler job itself cost $0.09.

It stays small because most minutes move only the rows that changed, with a full read at least once an hour to heal anything a delta missed. Open boards ask a tiny endpoint whether anything changed before they offer a refresh. [Open the planner's drawing](/architecture/capacity-planner) and press Replay to watch the minute sync run.

## When is one warm instance worth paying for?

When a person outside the company should never wait. Hybridge Forms keeps one public instance warm, so the first patient of the morning never waits on a cold start. That instance was $7.14 of the project's $8.62. Requests across the public forms, the dashboard and the delivery worker came to $0.56, and the nightly check job to $0.03.

No other service in these six projects shows a warm instance charge. Launchpad's whole project cost $0.32, most of it the retired June board's secrets and sync job, and request time for its three services came to under two cents. The [Denticon sync](/architecture/denticon-sync) also keeps one instance warm, because Denticon wants a webhook answered within ten seconds. Its project is one of the eight not measured yet.

## What does an AI app cost to run?

The one AI system with a measured month is the [CBCT scan validator](/architecture/cbct-scan-validator), which flags unusable dental CT scans before the design team opens a case. It cost $61.76.

Scoring a scan is the cheap part. A frozen dental segmentation encoder compiled for CPU runs on Cloud Run and scales to zero, and all the CBCT services together, the validator and the review app included, used $0.68 of Cloud Run. Training runs on my laptop's GPU, so model training adds nothing to this bill.

The money goes to the parts around the model. Cloud Run jobs that turn labeled scans into training data cost $45.54. The main one woke every five minutes until October 28 and now runs once a day at 6 AM; the drop is not measured yet. The always on SFTP VM, where the lab's case system leaves scans and picks up verdicts, cost $11.23.

The apps that call Gemini, including Doc Coach, NPC Coach, the patient survey reports and the Daily Sales Report, sit in projects whose export switched on October 28. Their model spend is not measured yet.

## What costs more than the compute?

In three of the six projects, Secret Manager cost more than Cloud Run. The estimator's secrets came to $0.39 against $0.14 of Cloud Run. Launchpad's came to $0.20 against $0.04. The Doctor Portal project's came to $0.05 against less than a cent.

At this size, an app that scales to zero costs less than the secrets it reads.

## How were these numbers measured?

From Google Cloud's standard billing export in BigQuery, with read only SELECT queries on October 29, 2026. Net is cost plus credits, in US dollars, by Pacific usage day, which is the billing console's day. October 28 was still loading when I queried, so its last hours are missing. As a check, September summed the same way came within five cents of the invoice month.

The standard export carries no service name for Cloud Run, so where a project runs several services the figure covers all of them. Tax posts separately, and October's had not posted yet.

Not measured yet: the projects that hold the CDF and patient surveys, marketing data, the Cowork Dashboard, the Daily Sales Report, Doc Coach, NPC Coach, Reconciliation and the websites. Their billing export switched on October 28, 2026 and had delivered no rows when I checked, so there is no measured month for them.

What I would keep: scale to zero on everything that can sleep, and keep something on all the time only where a database or a waiting person needs it.
