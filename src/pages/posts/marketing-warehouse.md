---
title: "How I joined five marketing logins into one warehouse a model can read"
date: "2026-10-02"
layout: ../../layouts/PostLayout.astro
description: "Our marketing numbers lived in five separate logins, and no connector on the market could follow a click through a phone call and a CRM lead to a booked patient. I built a BigQuery warehouse that does that join every morning, describes itself for the language models that query it, and grades those models every week, including the first run that failed its own gate."
img_path: "/marketing-warehouse.png"
img_alt: "Marketing warehouse: six sources flowing through raw, staging and marts into Claude, Gemini and Looker Studio"
tag: "AIE"
tone: "emerald"
stats:
  - value: "98.5%"
    label: "of patients linked straight to the lead they came from, and every joined row records how it was matched"
    tone: "emerald"
  - value: "22 questions"
    label: "asked every week against an 80 percent gate. The first run scored 77 percent and failed it"
    tone: "blue"
  - value: "$5 to $15"
    label: "a month to run six daily sources on Google Cloud"
    tone: "amber"
---

Our marketing lead had a question that sounds like it should take thirty seconds. Of the people who clicked one of our Google ads, how many called, how many came in for a consult, and how much treatment did they end up accepting?

Answering it meant five logins. Google Ads for the clicks and the spend. Microsoft Ads and Meta for the rest of the spend. CallRail for the phone calls, since a lot of people thinking about dental implants call before they ever fill out a form. And Monday, our CRM, where leads live on one board and patients live on three others, split by office. Every tab had its own date picker and its own idea of what counts as a lead. Getting the answer out took a spreadsheet, an afternoon, and a lot of faith in a lookup formula.

I wanted that question to be one sentence in a chat window, with an answer you could check. This is how I built the warehouse behind it, the join that turned out to be the whole product, and the checks that tell me when it is wrong.

## Why I did not buy a connector

Connector services that copy ad platform data into a warehouse do that part well. None of them do the part we needed: follow a click to a call to a CRM lead to a patient record to a treatment value. That path runs through how our staff use Monday, which board links to which, and which columns they actually fill in. Nobody sells a connector for our CRM habits.

So the join was going to be custom no matter what, and paying a monthly fee to move the easy data made less sense. Every source has a free API. I built the whole thing on Google Cloud, and it runs for 5 to 15 dollars a month.

## The shape of it

Google Ads comes in through BigQuery Data Transfer Service, Google's managed connector. Everything else is a small Python connector: Microsoft Ads, Meta, CallRail, Monday, and later TapClicks. Each runs as a Cloud Run job, started by Cloud Scheduler at 6 AM Eastern.

<div class="aside">
<strong>The pipeline, in order.</strong>
<ol>
<li><strong>Pull</strong> each source every morning. The ad connectors refetch the last 30 days, because platforms restate conversions after the click.</li>
<li><strong>Upsert</strong> into <code>raw</code> on a stable key, so a rerun overwrites instead of duplicating and a missed night heals on the next good run.</li>
<li><strong>Clean</strong> in <code>staging</code>: typed, deduplicated views for ad performance, calls, leads, and patients.</li>
<li><strong>Answer</strong> in <code>marts</code>: a daily summary, the lead to patient funnel, cost per outcome, and channel attribution. The only layer people and models touch.</li>
<li><strong>Check</strong> at 6:45 AM: freshness for every source, then a drift test.</li>
</ol>
</div>

From the design spec to all five sources landing took less than two days. The connectors were not the hard part. They rarely are.

## The join is the whole product

The first version of the lead to patient join did what anyone would guess. Match a lead to a patient by normalized phone number, then by Google click ID, then by email. Then I looked at what it produced.

The funnel said 96 percent of leads became patients.

No marketing works that well. Monday's API returns an empty text field as an empty string, not a null. The join already skipped nulls, but an empty string is not null, and it equals every other empty string. Every lead with a blank email or click ID matched every patient with a blank one. I turned every empty text value in staging into a real null and wrote the number into the demo runbook: "A funnel conversion near 96 percent means a bad join." The same rule sits in the Claude skill, so the model checks its own answers against it.

Then I looked at which keys were actually firing. Phone and click ID matched zero pairs. Not a few. Zero. The phone column on the patient boards came back empty on every row through the API, and click IDs never lined up. The fuzzy join was running on email and luck.

Meanwhile the staff had been doing the join by hand the whole time. When a lead becomes a patient, they link the patient back to the lead with a Monday board relation column. My connector was not pulling it. Once it did, 98.5 percent of patients carried a direct link to their lead. That link became the primary join, with phone, click ID and email as fallbacks in that order, and every matched row records which one fired.

```sql
-- sql/marts/lead_to_patient_funnel.sql, lines 46 to 58
  CASE
    WHEN p.item_id IS NULL THEN NULL
    WHEN p.linked_lead_id = l.item_id THEN 'direct_link'
    WHEN l.phone IS NOT NULL AND l.phone = p.phone THEN 'phone'
    WHEN l.gclid IS NOT NULL AND l.gclid = p.gclid THEN 'gclid'
    ELSE 'email'
  END AS match_method
FROM `{{PROJECT}}.staging.stg_leads` l
LEFT JOIN `{{PROJECT}}.staging.stg_patients` p
  ON (p.linked_lead_id IS NOT NULL AND p.linked_lead_id = l.item_id)
  OR (l.phone IS NOT NULL AND l.phone = p.phone)
  OR (l.gclid IS NOT NULL AND l.gclid = p.gclid)
  OR (l.email IS NOT NULL AND LOWER(l.email) = LOWER(p.email))
```

That `match_method` column looks like bookkeeping. It is the column I would fight hardest to keep. When a number looks wrong, the first question is always how the rows got joined, and now the answer is one GROUP BY away.

I also wanted a second opinion that did not come from my own code. Monday has a mirror column showing each patient's linked lead, which its API cannot return but its weekly export can. So a separate connector picks up that export from Drive every Wednesday, and a validation view compares the two joins person by person. They agree 99.5 percent of the time.

<div class="stat-callout stat-emerald">
  <div class="stat-value">trust the link people already make</div>
  <div class="stat-label">The best join key was one the staff were already making by hand. My job was to pull it, and to record every time I fell back to guessing.</div>
</div>

## Writing the warehouse for a model to read

Our marketing lead should not have to write SQL. They ask Claude or Gemini in plain English, and the model writes the query. So the reader I designed for is a language model that has never seen this warehouse and has no idea the board called "1960 Patients" is our Rochester office.

Every view and every column carries a description, written into the SQL file itself so it survives every redeploy. The descriptions are where the gotchas live. Rows in the daily summary never overlap, so a plain SUM is safe. Calls have no office attached. Ad conversions restate for about three days. A human analyst learns these over months. A model has to read them every time, so they have to be written down exactly where the model looks.

On top of that sits `marts.data_guide`, a catalog view with one row per table: purpose, grain, key columns, and gotchas. Its own description says to query it first. Next to it, `marts.query_examples` holds 15 question and SQL pairs already run against the real schema, so a model can adapt a proven query instead of inventing one. The instructions every model gets are short and point at both:

```python
# src/evals/run_evals.py, lines 34 to 45
SYSTEM_PROMPT = """You have a run_sql tool against a BigQuery data warehouse,
project {project}. For any marketing question:

1. Start by querying marts.data_guide to see what tables exist, their
   purpose, grain, key columns, and gotchas.
2. Check marts.query_examples for a similar question before writing new SQL.
3. Prefer the marts dataset over staging; avoid the raw dataset entirely.
4. Read table and column descriptions before writing SQL; they carry
   important gotchas (disjoint metric rows, PHI, restatement windows,
   double counting, messy source data).
5. Answer ONLY from what your queries actually returned. If the warehouse
   cannot answer the question, say so plainly rather than estimating.
```

There are three ways in: Claude through Google's MCP Toolbox for Databases, with a skill package that carries our business rules and ends every answer with the SQL behind it; Gemini straight from the BigQuery console; and Looker Studio for anyone who wants a dashboard. All three read the same marts and the same descriptions.

## Twenty two questions, every Monday

Descriptions are a hope. I wanted a measurement, so an eval harness runs as a Cloud Run job every Monday at 8 AM.

It holds 22 questions I wrote by hand across spend, calls, the funnel, cost, attribution, metadata, and freshness. Each is paired with a canonical SQL query, run at the same moment the model answers, with relative date windows so the answer key never goes stale. Gemini 2.5 Flash on Vertex AI gets the instructions above and one tool, `run_sql`, which refuses anything but a single read only query and stops after eight calls. Numbers must land within a tolerance, and lists are scored on whether the right items show up. Below an 80 percent pass rate, the job exits with an error and the same alert email fires as for a broken sync.

The first run scored 17 out of 22. That is 77 percent, and it failed the gate I had written that same night. I went through all five misses before touching anything.

<div class="aside">
<strong>The five misses from the first run.</strong>
<ol>
<li><strong>My answer key was wrong.</strong> The canonical query still counted leads from a separate family practice that shares the board. The model had filtered them out, and it was right.</li>
<li><strong>A scale mismatch.</strong> The model gave a percentage as a fraction between 0 and 1. Same number, different scale.</li>
<li><strong>A formatting miss.</strong> Valid SQL, but no clean answer line the scorer could parse.</li>
<li><strong>A guess instead of a lookup.</strong> The model assumed the text format of an attribution value instead of checking the column description.</li>
<li><strong>A filter it invented.</strong> It added its own condition, got zero rows, and reported "no data" when the right answer was one row per office with an empty value.</li>
</ol>
</div>

I fixed the first three in the answer key and the prompt. The last two stayed as they were. They are real model behavior, and changing the answer key to match a wrong answer would make the scorecard greener and the harness useless.

<div class="stat-callout stat-amber">
  <div class="stat-value">77 percent, on the record</div>
  <div class="stat-label">Missing the gate on the first run told me more than passing it would have. A gate that passes on day one was probably set too low.</div>
</div>

## Watching the pipes every morning

Evals tell me whether a model can read the warehouse. They do not tell me whether the warehouse is still true. That is what the daily ops job checks at 6:45 AM, after the syncs finish.

First it checks freshness: a source is stale if its newest row is more than 2 days old for the ad platforms, 1 day for CallRail and Monday, or 3 days for TapClicks. Then it runs a drift check on five daily numbers: spend on each of the three ad platforms, CallRail calls, and new Monday leads. Each one is compared against the mean and standard deviation of the 28 days before it.

```python
# src/connectors/ops/main.py, lines 130 to 140
    for r in metric_rows:
        history_days = r.get("history_days") or 0
        stddev = r.get("baseline_stddev")
        if history_days < 14 or not stddev:
            continue
        mean = r.get("baseline_mean")
        today_value = r.get("today_value")
        if today_value is None:
            today_value = 0
        z = compute_z(today_value, mean, stddev)
        is_flagged = z is not None and abs(z) > 3
```

Two choices in there are deliberate. A metric with fewer than 14 days of history is skipped, because a standard deviation from five days of data is noise. And a missing day counts as zero, because a connector that quietly stopped landing rows is exactly the drift I care about most. A z score above 3 in either direction joins the failure message, and every check gets logged.

The first time I ran it against live data, it flagged Google Ads spend at a z score of about minus 3.2. Nothing was wrong with our ads. Google's transfer runs about a day behind, so yesterday had not fully landed. I kept the sensitivity and wrote the lag into the docs. A check that is sometimes too nervous beats one that stays calm while a source dies.

A small monitoring dashboard on Cloud Run sits on top: six checks per source (connection, schedule, sync, data, views, quality), each green, amber or red.

## Keeping people out of the TapClicks feed

TapClicks came last. It is the reporting platform our ad agency uses, and it covers what my connectors do not: streaming TV delivery, GA4, Google Business Profile, and organic social. It also offers views I never want here. Its CallRail feed carries caller names and numbers. Its review, comment, form and lead views carry the identities of real people.

A list of views to pull is configuration, and configuration gets edited. So the views that must never be pulled live in code that refuses to run:

```python
# src/connectors/tapclicks/main.py, lines 61 to 66 and 85 to 89
# Never requested, whatever VIEWS says. CallRail rows carry caller names and
# numbers (sync-callrail already pulls calls), and these view types carry the
# identities of reviewers, commenters, callers, or leads.
BLOCKED_SERVICES = {"115"}
BLOCKED_VIEW = re.compile(
    r"call|form|review|comment|question|answer|mention|customermedia|lead", re.I)

def check_views(views):
    blocked = [f"{s}/{v}" for s, v in views
               if s in BLOCKED_SERVICES or BLOCKED_VIEW.search(v)]
    if blocked:
        raise ValueError(f"tapclicks: refusing blocked views {blocked}")
```

`check_views` is the first thing the job's entry point does, before it even reads its credentials. If someone adds a review view to the list a year from now, the job fails loudly instead of quietly filling a table with reviewers' names. The pattern is broad, and it might refuse a harmless view someday. I would rather explain that than the alternative.

## The backfill that looked like missing history

The bug I think about most never threw an error.

When I backfilled 13 months of CallRail, 182 calls came back, all from the most recent week. I wrote it down as a finding: the account has no history before July 28, 2026. That seemed thin, but the API had returned clean, valid data, so I believed it.

It was wrong. The connector filtered with a parameter called `created_after`, which CallRail's calls endpoint silently ignores in favor of its own recent default window. No warning, no error. Every backfill, however wide, landed the same last week of calls. Testing the API directly with `start_date` returned the real history. I changed one word in two functions, reran with a 400 day window, and the table went from 182 calls to 4,877, reaching back to June 30, 2025.

Two habits came out of that. When a backfill comes back short, check the filter before believing the data. And an API that ignores a parameter it does not recognize is more dangerous than one that rejects it, because the failure looks exactly like an answer.

## Where it stands

The warehouse has been live since early August, and TapClicks joined on September 25. Six sources land every morning. About 180 tests run against fixture data with no live API or cloud calls. Our marketing lead can ask questions like the one at the top of this post in plain English and get an answer with the SQL attached.

It is not perfect. On September 23 the monitoring dashboard read 89 percent, 32 of 36 checks green, and the CallRail sync had failed two nights running. CallRail refetches the last seven days on every run, so those nights fill back in once a run succeeds, but two in a row is a reminder that six vendor APIs never stop changing under you. Other known gaps, like a patient with two leads counting twice in cost per outcome, are written into the data guide where a model will see them.

The connectors were the easy part. Moving rows is a solved problem. The value was in the join, in seeing how every row got joined, and in writing the warehouse down so plainly that a model reading it cold reaches the same answer a careful analyst would. Then checking, every Monday, whether it actually does.
