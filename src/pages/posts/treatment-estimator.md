---
demo: /demos/treatment-estimator
title: "A quoting tool live in 14.5 hours, where a saved price stays put"
date: "2026-05-18"
layout: ../../layouts/PostLayout.astro
description: "Coordinators quoted from one shared price list with no office prices or tiers. The estimator I built writes the price onto every saved line, and shipped 14.5 hours after its first commit."
img_path: "/treatment-estimator.png"
architecture: "treatment-estimator"
img_alt: "Treatment Estimator wizard, decision tree, and frozen-price snapshot"
tag: "Architecture"
tone: "blue"
stats:
  - value: "14.5 hours"
    label: "from the first commit on May 7 to v1.0.0 on May 8"
    tone: "blue"
  - value: "4 fields"
    label: "frozen on every saved line: price, tier, label and price book version"
    tone: "emerald"
  - value: "$34"
    label: "to run from October 1 to 28, measured from the billing export. The app itself cost 14 cents"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Coordinators quoted full arch cases from one shared price list with no office prices or tiers."
  - label: "What I built"
    value: "A quoting app for three offices that writes price, tier, label and price book version onto every saved line."
  - label: "Outcome"
    value: "A saved line keeps its quoted price when an office changes its price book."
  - label: "Runs on"
    value: "Cloud Run and Cloud SQL Postgres, reading the day's consults from the CDF."
  - label: "Cost"
    value: "$34 from October 1 to 28, 2026, measured; the app itself cost 14 cents."
  - label: "Built"
    value: "14.5 hours from the first commit on May 7, 2026 to v1.0.0 on May 8."
---

## The problem

Our treatment coordinators quote full arch implant cases with the patient in the chair. They did it in an Apps Script page on top of a Google Sheet. It had one price list with no column for the office, so Rochester, Buffalo and Syracuse shared every number. It had no tiers, though our senior coordinator's own pricing sheet did: a first implant at one price, a second lower, a third lower again. And if the page could not read the sheet, it quietly fell back to prices typed into its own code.

The printout guarantees every fee for six months. So the first goal in the spec was plain: any estimate can be reproduced six months later at the exact prices quoted, even after an office changes its prices.

The coordinators named the rest. Listing courtesies and general anesthesia under each scenario was, in our senior coordinator's email, "a major need for this to be successful."

## What I built

A web app on Cloud Run where a coordinator builds an estimate in a drag and drop workspace: options for each arch, phases, and scenarios that pair an upper with a lower. A pricing engine prices every line from that office's published price book, and the save writes four things onto each line: price, tier, label and price book version. Totals, the PDF and the Excel read those back.

Each office has its own versioned price book, and only an admin publishes a change. The app opens on the day's consults, read from the CDF, my service that holds the practice system's credentials. [Open the drawing](/architecture/treatment-estimator).

## The sprint

I wrote the spec and nine architecture decisions on May 6. The first commit went in at 4:26 PM on May 7. The pricing paths landed at 2:21 AM, the engine tests reached full coverage at 2:32 AM, and I kept going until 6:54 AM, when a session fix became v1.0.0, 14.5 hours after the first commit.

The trial ran at Rochester first, with coordinators trying to break it. Our senior coordinator got six pricing questions, each with a safe default already coded so nothing waited. The answers came on May 20, and the coordinator's rule for implant tiers, one running count across the whole arch, shipped as v1.7.0 on June 4.

On September 29 every screen moved into the practice's design in one day.

Most of it came from the people quoting. On August 19 our senior coordinator asked to price a crown on an implant already in the mouth. That commit went in at <span class="egg" tabindex="0" data-egg="Abutment and crown on an implant already in place, no placement fee. Sleep was not placed either.">4:58 AM</span> and shipped as v1.14.0 five minutes later. On October 28 a coordinator could not add a courtesy to an estimate already presented, and the only way around it was editing the Excel by hand. Reopen to edit shipped as v1.56.0 that day.

## The hard parts

**A quote has to survive a price change.** Price books change faster than six months, so the price is written down where it was decided. Every saved line carries its price in <span class="egg" tabindex="0" data-egg="Every amount is stored as whole cents. Floating point was not invited to the consult.">integer cents</span> and the price book version it came from, and every reader uses those. Presenting also freezes the whole estimate as a snapshot. An earlier version of this post said a Postgres trigger enforced the freeze. The design called for one, and it never shipped. The freeze lives in the stored lines and the code that reads them. Saving an option again reprices it from the current book on purpose, the only way a saved number moves.

**The arch had to stop being a question.** Coordinators picked Upper, Lower or Both before building anything. One picked upper only, built a lower option in the workspace, which always shows both arches, and could not reach the summary. Since September 28 the arch is whatever the saved options add up to, set inside the same transaction as every option save and delete.

**Reopening without breaking payments.** Copying the estimate into a new revision would have been simple and wrong, because payments point at option and line ids. So reopening moves the live rows to the next revision and leaves the presented version frozen. Presented again, an estimate with payments goes straight back to accepted. The status change is guarded, so two clicks cannot both move the rows:

```ts
// app/_actions/estimate.ts
.where(and(
  eq(estimate.id, est.id),
  eq(estimate.status, from),
  eq(estimate.currentRevisionNo, oldRev),
))
```

The second click finds nothing to update and stops.

## What I said no to

**A rules engine in the database.** The flow of a consult lives in TypeScript with tests, and only prices live in rows. Rules in JSON would turn every change to the clinical flow into a data migration no diff explains.

**Talking to the practice system, or faking it.** The day's consults come from the CDF with a secret of their own, and the CDF reads a patient lookup back with a different one, so revoking one never blinds the other. Without the secret, production shows an empty day and says why. Sample patients that look real would be worse than a blank screen.

**A staging environment nobody used.** The design had one. Its deploy workflow went on day two, and its database sat stopped, still billing, until October 29. The billing export shows the hourly cost falling by $0.0053 from then.

## Where it landed

Coordinators quote from it for all three offices. A read only audit on August 27 counted 75 live estimates in production. I have no usage count since then.

It cost $34 from October 1 to 28, measured from the billing export. The always on database is $33.20 of that. The app cost 14 cents, because it scales to zero between consults.

I have not measured time per quote, before or after, or how often a printed number used to be wrong.

What I would keep: write the money down where it was decided, and when other records point at your rows, move them.
