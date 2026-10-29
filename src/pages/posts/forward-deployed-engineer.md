---
title: "What a forward deployed engineer actually does, at a dental practice"
date: "2026-10-29"
layout: ../../layouts/PostLayout.astro
description: "A forward deployed engineer works beside the people who have a problem and ships the fix into their systems. Here is that job at a three office dental practice, each example linked."
img_path: "/forward-deployed-engineer.png"
img_alt: "A glass workbench with a laptop, a clipboard and a coffee cup, three office buildings glowing through the window behind it"
tag: "Essay"
tone: "emerald"
stats:
  - value: "19 minutes"
    label: "from our finance lead's request in a dashboard's request tab to the change live on Oct 28"
    tone: "emerald"
  - value: "45 services"
    label: "live on Google Cloud for a three office dental practice and its lab, listed on Oct 29, 2026"
    tone: "blue"
  - value: "~$460K"
    label: "of patient value on 25 retreatment cases no lead pointed at, surfaced by fixing one join"
    tone: "amber"
facts:
  - label: "Role"
    value: "A software engineer who works beside the people with the problem and ships into their systems"
  - label: "What it means in practice"
    value: "Learn the work from the people doing it, build on their data, ship within days"
  - label: "Versus a software engineer"
    value: "The same production code, plus finding the problem, writing the spec and owning what happens after launch"
  - label: "Fastest ask to live"
    value: "19 minutes, from a finance lead's request to the change in production"
  - label: "Proof"
    value: "45 live services for a dental practice, each system drawn at /architecture"
  - label: "What makes a good one"
    value: "Writes the old rules down, ships early, puts guards in code, says what is not measured"
---

## What does a forward deployed engineer do?

A forward deployed engineer works beside the people who have a problem, learns how their work actually runs, and ships software that fixes it inside the systems they already use. The job is measured by whether those people use what ships, and how soon it reaches them.

I do this job at Hybridge, a dental implant practice with offices in Rochester, Buffalo and Syracuse and its own lab. The work starts from a person. Our operations lead had a workbook. Our lab lead had a mockup. Our finance lead typed one line into a request tab. Each became a live system, and each example below links to its write up or its drawing.

## How is a forward deployed engineer different from a software engineer?

Both write production code and both own its quality. The difference is where the work starts and where it ends.

A software engineer on a product team usually starts from a ticket and a spec someone else wrote. A forward deployed engineer starts from a person and a messy process, and writes the spec themselves. On September 11 I took our operations lead's planning workbook apart cell by cell, wrote the spec, and sent eleven questions. Each question already had a default coded, so nothing waited on an answer. The [capacity planner](/posts/capacity-planner) was in production 17 days later.

The other end is after launch. The people who asked are the ones who find the edge cases. For [Reconciliation](/posts/reconciliation), reviewers sent back patients the tool got wrong, and I traced each one, fixed the reading, added a test and shipped. When a practice director wrote <span class="egg" tabindex="0" data-egg="It shipped at 3:34 PM that day. The Room Board that came later drags people between rooms with its own Undo.">"I need an undo button!"</span> in the planner, it shipped the same day.

## What does the work look like day to day?

Five asks from five teams, and the time each took to go live:

| Who had the problem | What they had | What shipped | Time to live |
|---|---|---|---|
| Operations lead | A workbook of twenty pasted weeks | [Capacity planner](/posts/capacity-planner), reading Denticon every minute | 17 days, first commit to production |
| Insurance team | Three exports read against each other by hand | [Reconciliation](/posts/reconciliation), which returns only the patients who disagree | 8.75 hours, first commit to first live revision |
| Marketing lead | A fresh login most days to ask Claude about marketing data | [Data connector](/posts/data-connector) with one Google sign in | 3 hours, first code to live |
| Lab lead | A July mockup of a doctor portal | [Doctor Portal](/posts/doctor-portal), live on sample data | 3.7 hours from the sync that made it top priority |
| Finance lead | One line in a request tab | Today included in Rest of month on the [Cowork Dashboard](/posts/cowork-dashboard) | 19 minutes |

The finance lead's request is the clearest picture of the loop. It arrived at 11:44 AM on October 28 through the request tab inside the Cowork Dashboard, which files into one list that six apps share through [Launchpad](/posts/launchpad). The change was live at 12:03 PM.

The lab lead's portal shows the other half. At the 11:30 AM sync that same day it became the top priority, with a request for a live link starting at version 0.1. The first version went up at 12:59 PM, built from the lab lead's own mockup, and a working revision was live at 3:12 PM. Every release note ends with the four things still pretend: sample data, files listed by name only, payments and emails off, and no doctor sign in.

Underneath all of it is the [platform](/posts/platform): 45 live services in 14 Google Cloud projects, listed on October 29.

## How do you ship fast in a practice that holds patient data?

Speed is only safe when the code refuses the dangerous things by itself.

**Read only toward the system of record.** Denticon holds the charts and the bookings, and one service holds its credentials. Other apps read a mirror through the [CDF registry](/architecture/cdf-registry), each with its own secret. The capacity planner's contract with Denticon has only read methods, and a type level test fails the build if anything shaped like a write appears.

**Patient details stay out of logs.** When an ORM upgrade started putting SQL parameters into error messages, the planner's logger switched to describing a failed query by its Postgres code, constraint and table. A test drives a real duplicate insert with a patient style name to prove no log line carries it. The [forms](/architecture/hybridge-forms) logger drops 18 field names outright, from name and email to phone.

**Access the code enforces.** The [data connector](/architecture/data-connector) lets approved staff ask Claude about marketing data. A guard parses every query Claude writes, refuses anything but one SELECT, and points each table at that person's own set of views. Without the patient box ticked, the contact columns are gone.

## How do you measure a forward deployed engineer's impact?

In value found, hours a team spent before, and what it costs to run. Where something is not measured, I say so.

- **About $460K of patient value.** The first leadership dashboard joined patients to leads by name, and only 49.5 percent of Rochester patients linked. Joining on the boards' own connect column took Rochester to 98.8 percent. The 25 patients left over were retreatment cases carrying about $460K of patient value nobody had attributed. ([Cowork Dashboard](/posts/cowork-dashboard))
- **70 hours a week.** That is the insurance team's own count of the time spent reading three exports against each other by hand. The engine does that reading now and returns a short list. I have no after number yet. ([Reconciliation](/posts/reconciliation))
- **$132 of Google Cloud** from October 1 to 28 for the six projects the billing export measures. [What it costs](/posts/what-it-costs) has the table and the projects not measured yet.

I have not measured hours saved on the planner either. Nobody timed the workbook, so there is no before number.

## What makes a good forward deployed engineer?

Five habits, each one from the work above:

1. **Write the old rules down before replacing them.** The planner reproduces all 360 day cells of the old workbook, checked on every test run.
2. **Ask with a default.** Questions go out with an answer already coded, so the build never waits on a reply.
3. **Ship something real early.** A live link on the day the work becomes the priority, and live data by day two.
4. **Put the guards in code.** Read only by contract, names out of logs, access checked on every query.
5. **Say no with a reason.** The planner ranks cover suggestions on five plain rules our operations lead can read, with no generated advice. Reconciliation keeps a model out of the verdict until each practice confirms its terminology list.

## How to read a forward deployed engineer's portfolio

Look for systems in production with real users, the time from an ask to live, what each system does when it breaks, and what it costs a month.

Every system I run has a drawing at [/architecture](/architecture). Each one marks which parts I built, which Google manages and which belong to outside systems. Click a part to read what it does and how it fails. Below the drawing sit three lists, When it breaks, What I tuned and Guards, each item with the source file it came from, then the October cost where the billing export measured it. Start with the [platform map](/architecture/platform), then open the [capacity planner](/architecture/capacity-planner).
