---
demo: /demos/marketing-warehouse
title: "Ten marketing sources joined by 6 AM and in the inbox by 6:30"
date: "2026-10-02"
layout: ../../layouts/PostLayout.astro
description: "Our marketing numbers lived in five logins, and nothing joined an ad click to a booked patient. I built a BigQuery warehouse that makes that join every morning and mails it at 6:30."
img_path: "/marketing-warehouse.png"
architecture: "marketing-warehouse"
img_alt: "Marketing warehouse: six sources flowing through raw, staging and marts into Claude, Gemini and Looker Studio"
tag: "AIE"
tone: "emerald"
stats:
  - value: "3,334 of 3,383"
    label: "lead to patient matches made by the link staff already keep in Monday"
    tone: "emerald"
  - value: "3.5 hours"
    label: "from the design spec to the first sync job running in the cloud on Aug 4"
    tone: "blue"
  - value: "8 of 8"
    label: "mornings the 6:30 email has gone out since it started on Oct 22"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Our marketing numbers lived in five logins, and nothing joined an ad click to a booked patient."
  - label: "What I built"
    value: "A BigQuery warehouse that pulls ten marketing sources at 6 AM and joins ad spend and calls to patients."
  - label: "Who uses it"
    value: "Our marketing lead, a marketing teammate and me, by a 6:30 AM email and through Claude."
  - label: "Outcome"
    value: "3,334 of 3,383 lead to patient matches come from the link staff already keep in Monday."
  - label: "Runs on"
    value: "Cloud Run jobs and Google's Ads Data Transfer into BigQuery, in its own Google Cloud project."
  - label: "Built"
    value: "3.5 hours from the design spec to the first sync job running in the cloud on August 4, 2026."
---

## The problem

Our marketing lead had a question that sounds like thirty seconds of work. Of the people who clicked a Google ad, how many called, how many came in for a consult, and how much treatment did they accept?

In August the answer lived in five logins. Google Ads for clicks and spend, Microsoft Ads and Meta for the rest of the spend, CallRail for phone calls, and Monday, our CRM, where leads sit on one board and patients on three others, one per office. Each had its own date picker and its own idea of a lead. Answering took a spreadsheet and an afternoon.

By October the ask had grown. The marketing lead and I wanted to ask Claude and get answers that say where every number came from, plus a morning email with one Excel tab per source.

## What I built

A BigQuery warehouse in its own Google Cloud project. Google Ads arrives through Google's managed Data Transfer. Everything else comes through ten small Python connectors, each a Cloud Run job: Microsoft Ads, Meta ads and organic pages, CallRail, Monday, GA4, Search Console, Google Business Profile, a weekly copy of Monday's own export, and TapClicks, the reporting platform our ad agency uses.

Data moves from raw to staging to marts. At 6 AM the pulls run, at 6:30 the email goes out, at 6:45 a job checks that every source landed, and every Monday Gemini takes a 22 question test against the marts. [Open the drawing](/architecture/marketing-warehouse).

## The sprint

August 4 was one long day. The design spec went in at 12:35 PM, and the first sync job ran in the cloud at 4:07 PM, three and a half hours later. The CallRail fix followed at 7:11 PM. The join fixes came after midnight: <span class="egg" tabindex="0" data-egg="Monday sends a blank email field as an empty string. Two empty strings are equal, so every blank lead found every blank patient.">1:37 AM</span> and 2:44 AM on August 5. The first eval run, at 1:53 AM, scored 17 of 22 and failed its own 80 percent gate.

TapClicks joined on September 25.

October 21 brought TapClicks metrics, Performance Max, CallRail source and office on every call, a freshness view, and the morning email. The first test email went out at 3:15 PM, and the 6:30 email has gone out every morning since October 22. On October 27 GA4, Search Console and organic Facebook and Instagram moved to direct pulls. On October 29 Business Profile did too.

When a marketing teammate asked which video ads hold attention, thumb stop and watch depth went into the creative mart on October 28 at 4:46 PM. A backfill of 270 days of Meta history ran from 4:56 to 5:43 PM that afternoon.

I deploy the jobs by hand with gcloud scripts.

## The hard parts

**The join was already being made by hand.** My first lead to patient join matched on phone, then Google click ID, then email. The funnel said 96 percent of leads became patients. Blanks from Monday were matching each other, so I turned them into nulls. Then I checked which keys fired. Phone and click ID matched zero pairs. Meanwhile staff link each patient back to its lead with a Monday board relation. That link became the primary join, the old keys became fallbacks, and every row records which one fired:

```sql
-- sql/marts/lead_to_patient_funnel.sql
WHEN p.linked_lead_id = l.item_id THEN 'direct_link'
WHEN l.phone IS NOT NULL AND l.phone = p.phone THEN 'phone'
WHEN l.gclid IS NOT NULL AND l.gclid = p.gclid THEN 'gclid'
ELSE 'email'
```

Today 3,334 of 3,383 matches come from the staff's own link and 49 from email. A weekly copy of Monday's export, compared person by person, agrees on 3,371 patients, 99.3 percent.

**A backfill that looked like missing history.** The first 13 month CallRail backfill returned 182 calls, all from the last week. The connector filtered with `created_after`, which CallRail's calls endpoint ignores without an error. Switching to `start_date` brought back 4,877 calls reaching to June 2025.

**Writing it for a model that reads it cold.** All 657 staging and marts columns carry a description written in the SQL file, so each redeploy writes it again. A data guide lists purpose, grain, keys and gotchas for 40 tables, next to 30 worked examples. Rows from TapClicks keep a source label, and the rule for Claude is a line that starts "TapClicks flag:" on any answer that uses one.

## What I said no to

**A connector subscription.** None of the services that copy ad data into a warehouse follow a click through a call and a CRM lead to a patient, and every source here has a free API.

**TapClicks where a direct pull exists.** TapClicks is a copy of other platforms' numbers. I pull GA4, Search Console, Business Profile and organic social straight from Google and Meta, and keep TapClicks for streaming TV delivery and older dates. Its call, review, comment and lead views are blocked in code before the job reads its credentials.

**An office that is not ours.** The agency's TapClicks account also carries an office in another city that shares the Hybridge name. I cut it from staging, the email and the connector.

## Where it landed

Three people get the 6:30 email: our marketing lead, a marketing teammate and me. Each gets a summary and <span class="egg" tabindex="0" data-egg="One tab per source, plus a summary. Coffee is not in the warehouse yet.">11 source tabs</span>, each saying where its rows came from and when they were pulled. The same three ask Claude through the [connector](/posts/data-connector), which logged 469 tool calls from October 23 to 29. On October 29 all nine daily direct sources had landed by the afternoon, and the Monday eval scored 21 of 22 on October 26.

Cost is not measured yet. The billing export for this project switched on October 28, 2026, so there is no measured month. I have no number for how long the old spreadsheet answer took or how often the email gets opened. Streaming TV delivery after early October waits on the agency loading the new platform into TapClicks.

What I would keep: the `match_method` column. When a number looks wrong, the first question is how the rows were joined, and the answer is one GROUP BY away.
