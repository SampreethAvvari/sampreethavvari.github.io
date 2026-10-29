---
title: "A report renderer that keeps trying until every email lands"
date: "2026-06-19"
layout: ../../layouts/PostLayout.astro
description: "Every patient survey becomes a summary and a doctor report, emailed to the patient and the office. I built one renderer that three callers share, records each step, and finishes the job on retry."
img_path: "/pdf-renderer.png"
architecture: "pdf-renderer"
img_alt: "PDF renderer: a survey becomes a queued task, the renderer draws two PDFs, checks whose email it is, and mails the patient and the office"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "7 minutes"
    label: "from the first renderer commit at 11:00 PM on Jun 19 to the service running on Cloud Run"
    tone: "emerald"
  - value: "60 to 90 s"
    label: "for one survey's whole delivery, run inside the request with the CPU kept on"
    tone: "blue"
  - value: "3 ways in"
    label: "the delivery queue, the CDF dashboard and an hourly sweep, each with a Google identity token"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Patients got their survey summary while the clinic got nothing, and no error surfaced anywhere."
  - label: "What I built"
    value: "A shared renderer that turns each patient survey into a summary and a doctor report and emails them."
  - label: "Who uses it"
    value: "Every intake and experience survey from the three offices, plus staff pressing Regenerate on the CDF dashboard."
  - label: "Outcome"
    value: "Each delivery step is recorded as it lands, so a retry finishes the job and never mails twice."
  - label: "Runs on"
    value: "Fastify and headless Chromium on Cloud Run, fed by Cloud Tasks and an hourly sweep."
  - label: "Built"
    value: "7 minutes from the first renderer commit at 11:00 PM on June 19, 2026 to running on Cloud Run."
---

## The problem

A patient fills in our intake survey on an office tablet before a consult. The practice needs two documents from it: a one page summary for the patient and a doctor report for the office team. The summary goes to the patient by email, and both go to that office's list.

In August my own comment in the code described what kept happening: "the patient got their summary, the clinic got nothing, and no error surfaced anywhere."

## What I built

A Fastify service on Cloud Run that renders each PDF in a <span class="egg" tabindex="0" data-egg="Every render launches a brand new browser and closes it after one PDF. About 300 MB of Chrome for a one page summary.">fresh headless Chromium</span>, stores it, and delivers it. Three callers share it: a survey submit becomes one named Cloud Task, staff on the CDF dashboard press Regenerate or upload an old assessment PDF, and Cloud Scheduler calls an hourly sweep. When an intake is done it tells the CDF, which puts it on the patient's chart. [Open the drawing](/architecture/pdf-renderer).

## The sprint

The first renderer commit went in at 11:00 PM on June 19, and the service was running on Cloud Run at 11:07 PM.

August 24 was the delivery day. Between 10:33 AM and 2:09 PM I stopped losing office emails, sized the service for a browser per render, added the hourly sweep, moved the work inside the request, and put every render on a queue. It was all live by 2:28 PM.

On August 25 a practice leader asked for three changes to the experience survey, one of them its own office lists, separate from intake. A post surgery complaint should not land with the people who book consultations. It was live on August 27 at 10:01 AM.

The CDF handshake was live at 1:21 AM on September 30, and the email owner check at 3:37 PM on October 26.

## The hard parts

**Work that ran after the reply.** `/render` used to answer and then deliver. Cloud Run throttles the CPU once a response is out, so the delivery crawled, and died when the instance was recycled. Now the work is awaited inside the request, which holds the instance with full CPU for the 60 to 90 seconds it takes. Concurrency is 8 an instance, because each render forks a browser of about 300 MB.

**Retries that never mail twice.** Cloud Tasks retries until it gets a 2xx, so a survey can run through `/render` more than once. Every run first reads what already went out:

```ts
// apps/pdf-renderer/src/server.ts
const prior = ((await db.collection('reports').doc(responseId).get()).data() ?? {}) as Record<string, any>;
const patientAlreadySent = prior.delivery?.patient?.status === 'sent';
```

While any step is missing it answers 500 and the queue comes back, ten tries from 10 seconds to 5 minutes apart. Behind the queue, the hourly sweep reads seven days of surveys and leaves the newest 75 minutes alone, so it never races a retry.

**Whose email is it.** A typed address can belong to someone else, so before a patient email goes out, it is looked up in the Denticon mirror. When it is on file only for other patients, the patient email is held and the office email says why. The practice's own inboxes are never held, and an address on no chart goes out, because a new patient's email is often not in Denticon yet.

## What I said no to

**A risk score in the patient's copy.** That number is for the doctor to explain in the room.

**A shared secret with the CDF.** The intake event carries a Google identity token for the renderer's own account, and only an answer of ack counts as delivered.

**Letting the CDF hold up an email.** The event tries twice, then rides the queue for about 25 minutes, then sends one alert with ids and the error. Nothing about it can delay, fail or repeat a patient's or an office's email.

## Where it landed

Every intake and experience survey from the three offices goes through it, and so does the CDF dashboard's Regenerate button.

Its cost is not measured: the billing export for its project only switched on Oct 28, 2026. I have not counted deliveries from the logs either.

What I would keep: record each step as it lands, and make every retry read that record first.
