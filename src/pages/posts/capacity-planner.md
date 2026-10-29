---
title: "A twenty copy Excel workbook became a live capacity planner"
date: "2026-10-05"
layout: ../../layouts/PostLayout.astro
description: "Our operations lead planned three offices in a workbook of pasted week blocks. I replaced it with a planner that reads Denticon every minute and cannot write back. Seventeen days to production."
img_path: "/capacity-planner.png"
architecture: "capacity-planner"
img_alt: "Hybridge Capacity Planner: three offices on one coverage board, each day showing who is where and which rule placed them"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "360 of 360"
    label: "day cells from the old workbook that the engine reproduces, checked on every test run"
    tone: "emerald"
  - value: "0 write methods"
    label: "toward Denticon, held there by a test that fails the build if one appears"
    tone: "blue"
  - value: "17 days"
    label: "from the first commit on Sep 11 to v0.1.0 in production on Sep 28"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Our operations lead planned three offices in a workbook of pasted week blocks."
  - label: "What I built"
    value: "A planner showing who is where, which days have patients and no doctor, and who could cover."
  - label: "Outcome"
    value: "The operations lead and office directors plan from it every day, on live Denticon bookings."
  - label: "Runs on"
    value: "Cloud Run and Cloud SQL Postgres, reading Denticon every minute through the CDF, with no way to write back."
  - label: "Cost"
    value: "$27 a month to run, measured in October 2026; the sync every minute is $1.29 of it."
  - label: "Built"
    value: "17 days from the first commit on September 11 to production on September 28, 2026."
---

## The problem

Our operations lead planned which doctor works where across Rochester, Buffalo and Syracuse in one Excel workbook. Every week was a block of formulas pasted under the last one. Twenty copies of the same week, and when the board ran out you pasted another.

It worked better than it had any right to. It also failed quietly. The row that counted Rochester's doctors was a COUNTIF over rows 6 to 11, so a doctor added on row 12 did not exist. Typing over a cell to move someone for a day deleted its formula, so that cell forgot about time off. And none of it knew what Denticon, our practice system, actually had booked.

The real cost was people. Last minute coverage calls, and a doctor slammed at one office while another office had a free chair.

## What I built

One forward view of demand, capacity and capability for all three offices. It reads Denticon every minute through the CDF, my service that holds the Denticon credentials, and it has no way to write back. A person still makes every real change in Denticon. The planner shows who is where, which day has patients and no doctor, who is overloaded, and who could cover.

All the planning math lives in one pure TypeScript package with no database, no network and no clock. The same code runs in the minute sync on the server and in the browser when someone asks what happens if a doctor takes Thursday off. [Open the drawing](/architecture/capacity-planner) to see every part.

## The sprint

On September 11 I took the workbook apart cell by cell, wrote the spec, and sent our operations lead eleven questions. Each one already had a default coded, so nothing waited on an answer. The first commit went in the same day.

v0.1.0 hit production at 3:27 PM on September 28. By 6:50 PM the People screen, the Bandwidth screen, the Coverage board and the Projector were live too. The first full read of live Denticon data landed at 5:34 the next morning, about 12,300 appointments. On October 1 a fix went in at <span class="egg" tabindex="0" data-egg="The planner never writes back to Denticon. I, on the other hand, never wrote back to sleep.">4:53 AM</span>. Later that day a practice director wrote, word for word, "I need an undo button!" It shipped as v0.38.0 at 3:34 PM the same day.

## The hard parts

**Denticon outranks the plan.** Live data broke two assumptions within hours. Denticon books the doctor as the provider on visits in the assistant's chair too, so one Buffalo doctor stacked three rows deep. And Syracuse showed "Need Dr" on a day Denticon had two doctors booked there. The roster said one thing, the bookings said another, and the bookings were right. So every day now runs one ordered chain: an override, then time off, then a Denticon block note, then a booking, then the doctor calendar, then the weekly pattern. Each cell says which rule placed it.

**The bug that could have cancelled an office.** A full read upserts what the CDF lists, then cancels what the planner holds that the CDF no longer lists. That is how a cancelled visit disappears. It is also a loaded gun. I found an older CDF route that dropped an unknown office code instead of refusing it, which would have read as "this office has no appointments" and swept its whole calendar away. So the routes refuse unknown offices, a full read writes nothing unless every 31 day window answered, and the sweep counts before it cuts:

```ts
// apps/web/lib/import/syncBatch.ts
if (stale >= batch.guard.min && stale > batch.guard.maxShare * active) {
  throw new MassCancelError(locationCode, stale, active);
}
```

More than half of an office's rows and at least 20 of them, and the whole read rolls back. The error names only an office and two counts.

**Patient names stay out of logs.** An ORM upgrade for a security fix started putting SQL and every bound parameter into error messages. A parameter can be a patient's name. The logger now describes a failed query by its Postgres code, constraint and table only, and an integration test drives a real duplicate insert with a patient style name to prove no log line carries it.

## What I said no to

**Writing to Denticon.** The contract every appointment source implements has only read methods, and a <span class="egg" tabindex="0" data-egg="It scans the interface for anything shaped like write, create, update, delete, cancel or book. A very strict librarian for verbs.">type level test</span> fails the build if anything shaped like a write appears.

**Generated advice on who to place.** Cover suggestions rank people on five plain rules: can do the work, will work at that office, already there, provably free, preferred assistant free too. Ties break on person id. Every reason on screen comes from a rule our operations lead can read.

**Guessing from free text.** Staff type notes into Denticon blocks. The reader acts only on a note that names exactly one doctor and says plainly out or here. On my local copy it acted on about one noted block in ten. I would rather miss a note than move a doctor on a guess.

## Where it landed

The operations lead and the office directors plan from it every day. Each tab answers one question: Calendar, Coverage, Needs action, Bandwidth, and since October 20 a Room Board where people and blocks drag between rooms with Undo. A 7 AM email goes to the office directors Monday to Friday with what needs action.

It costs $27 a month to run. The database is nine tenths of that. The sync that runs every minute, all month, costs $1.29.

I have not measured hours saved. I do not have a before number for how long the workbook took each week. Office hours for each site and categories for 44 appointment types are still waiting on answers.

What I would keep: write the old system's rules down cell by cell, make the new engine prove it reproduces them, and get onto live data on day two. And anywhere software can cancel something at scale, make it refuse first and explain itself second.
