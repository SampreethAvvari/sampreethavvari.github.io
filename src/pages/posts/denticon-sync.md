---
title: "Our Denticon mirror went from six days behind to under three minutes"
date: "2026-09-21"
layout: ../../layouts/PostLayout.astro
description: "Four Hybridge services need Denticon, and only one may hold its keys. I built the sync that keeps our copy fresh: webhooks first, a nightly poll behind them, and a check that notices silence."
img_path: "/denticon-sync.png"
architecture: "denticon-sync"
img_alt: "Denticon sync: webhooks save pointers, a worker every ten minutes fetches each slice, and a nightly poll keeps the Firestore mirror whole"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "2.6 minutes"
    label: "behind Denticon once the sync ran on a timer on Sep 21, down from 6.0 days earlier that day"
    tone: "emerald"
  - value: "20,111 charts"
    label: "and 22,688 appointments in the first read of the live practice on Sep 29"
    tone: "blue"
  - value: "1 key holder"
    label: "Denticon credentials live on this service alone, and four services read the mirror it keeps"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Our copy of Denticon was 6.0 days behind on September 21 because nothing ran the sync on a schedule."
  - label: "What I built"
    value: "A sync service that alone holds Denticon credentials: webhooks first, a worker every ten minutes, a 4 AM poll."
  - label: "Who uses it"
    value: "Four services read the mirror: the CDF patient list, the estimator, the capacity planner and the report renderer."
  - label: "Outcome"
    value: "The mirror trailed Denticon by 2.6 minutes once the sync ran on a timer, down from 6.0 days."
  - label: "Runs on"
    value: "Cloud Run with one warm instance and four at most, writing a Firestore mirror."
  - label: "Built"
    value: "Deployed September 21, 2026; the first live read on September 29 wrote 20,111 charts and 22,688 appointments."
---

## The problem

Denticon, from Planet DDS, holds every chart and appointment at our three offices. The CDF's patient list, the treatment estimator, the capacity planner and the report renderer all need what is in it.

Two things made a direct read a bad idea. Denticon's API has no patient search, so a copy of our own is the only patient index we have. And I had decided that only one service would ever hold Denticon credentials. Until September 21 those credentials sat on the CDF dashboard, a service that also serves pages to people all day.

The copy itself was going stale. My handoff measured it 24.9 hours behind Denticon on September 16 and 6.0 days behind on September 21, because nothing ran the sync on a schedule.

## What I built

A sync service: the CDF's own image, deployed as a second Cloud Run service with one warm instance and four at most, holding the only Denticon credentials.

Webhooks come first. When records change, Denticon posts a pointer to a slice; the receiver saves it and answers within Denticon's ten second window. A worker every ten minutes claims pointers, fetches each slice with credentials, and upserts the rows into Firestore by record id. A sweep at twenty past each hour lists any slice a webhook missed, and a 4 AM poll reads everything changed since each office's cursor. [Open the drawing](/architecture/denticon-sync), and [the registry's drawing](/architecture/cdf-registry) for how other apps read the mirror.

## The sprint

The first Denticon commit went in at 12:36 AM on September 15, a token client and the office table. By 2:44 AM the API reference was transcribed from the vendor portal and tested against staging. The patient and appointment mirror was backfilled that afternoon.

On September 21 the sync service was deployed at 12:48 PM. At 1:33 PM I committed <span class="egg" tabindex="0" data-egg="The commit message, word for word. All four turned up only once the job actually ran.">"Putting the sync on a timer found four reasons it had never worked"</span>. The same day the mirror trailed Denticon by 2.6 minutes.

Planet DDS turned on our production integration on September 28. At 2:57 AM on September 29 the sync read the live practice, and the backfill wrote 20,111 charts and 22,688 appointments. At 5:24 AM I fixed the two faults the first real webhooks found.

## The hard parts

**Four reasons it had never worked.** The nightly job got a redirect to the sign in page, because its route was missing from the middleware's allow list, while Cloud Scheduler recorded a success. The route took a session and nothing else. It synced offices and providers and never patients or appointments. And every bearer secret carried a trailing carriage return from Windows, so the freshness check refused its own secret. The shared check now trims both sides:

```ts
// lib/bearer.ts
if (!expected) return false;
const want = Buffer.from(expected.trim());
```

**Green while every call failed.** On its first scheduled hour the slice sweep answered ok with all eighteen of its vendor calls failing, before the subscriptions existed. Its log line read exactly like a healthy idle sweep, so it now names its errors. The freshness check starts from the twelve cursors it expects and reports a missing one as the worst status.

**Production did not match the reference.** The live slice file wraps records in a PascalCase envelope, so the worker read every slice of September 29 as zero rows, and the receiver refused real notifications. It reads both shapes now.

## What I said no to

**A one minute poller.** Webhooks carry the load and the 4 AM poll is the safety net.

**Trusting a webhook.** A notification is a pointer and nothing in it is stored as data. The worker always fetches the slice itself.

**Deleting what Denticon deletes.** A Delete slice marks the mirror row as deleted upstream, so a record that still points at the chart can see what happened.

## Where it landed

Four services read the mirror and none holds a Denticon credential: the CDF's patient list, the estimator's day through the registry, the capacity planner every minute through the registry, and the report renderer before it emails a patient.

Its cost is not measured: the billing export for its project only switched on Oct 28, 2026, so there is no measured month yet.

What I would keep: run the scheduled job by hand on day one and read what it actually did.
