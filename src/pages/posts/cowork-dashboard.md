---
demo: /demos/cowork-dashboard
title: "Every number defined once, and cash flow read every morning"
date: "2026-05-12"
layout: ../../layouts/PostLayout.astro
description: "Our leadership numbers came from Monday boards joined by name. Fixing the join surfaced about $460K nobody attributed. Then I moved it to Cloud Run, defined every metric once, and made cash flow daily."
img_path: "/cowork-dashboard.png"
architecture: "cowork-dashboard"
img_alt: "Cowork Dashboard scorecards, trend chart, and funnel"
tag: "MLOps"
tone: "amber"
stats:
  - value: "~$460K"
    label: "of patient value on 25 retreatment cases no lead pointed at, found by fixing the join"
    tone: "emerald"
  - value: "3 → 1"
    label: "copies of every metric: the card, the drilldown and the trend each had one, and now the card counts its drilldown rows"
    tone: "blue"
  - value: "19 minutes"
    label: "from the finance lead's request in the dashboard's Feature requests tab to it live"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Leadership numbers joined Monday boards by name, and only 49.5 percent of Rochester patients linked to a lead."
  - label: "What I built"
    value: "A dashboard that turns the Monday boards into one snapshot, with every metric defined once."
  - label: "Who uses it"
    value: "Nine Hybridge accounts, including our finance lead, who files requests in its Feature requests tab."
  - label: "Outcome"
    value: "Fixing the join surfaced about $460K of patient value on 25 retreatment cases nobody had attributed."
  - label: "Runs on"
    value: "Cloud Run and Cloud Storage, with the three patient boards read from the Monday API at 6 AM."
  - label: "Built"
    value: "A finance request filed at 11:44 AM on October 28, 2026 was live 19 minutes later."
---

## The problem

The practice runs on Monday, a work board app: a Leads board, plus a patient board each for Rochester, Buffalo and Syracuse. Leadership reviews come from those boards. The first dashboard joined patients to leads by name. In a review on June 3, Buffalo's consults and case acceptances read zero. Our chief sales officer asked: "What does that mean? The join was failing."

I measured it. Only 49.5 percent of Rochester patients and 65.3 percent of Buffalo patients linked to a lead. Every funnel was off by a different amount.

Later our finance lead asked for the cash booked to start this month, every day.

## What I built

A dashboard that turns the Monday boards into one snapshot. Each week the four board exports go into a Drive folder. A private service checks it every five minutes, rebuilds when all four files have changed, writes an immutable snapshot to Cloud Storage and moves a pointer to it last.

<span class="egg" tabindex="0" data-egg="Monday the work board app. It gets read on Sundays too.">Every morning at six</span>, the same check reads the three patient boards from the Monday API for the Cash Flow tab. Anyone can also press Refresh now.

The browser pins the snapshot and computes all nine tabs with the same code the ingest runs. The business rules our operations lead signed off were ported line for line. [Open the drawing](/architecture/cowork-dashboard).

## The sprint

The first version was Apps Script, built in the spring. There, joining on the patient boards' own connect column to Leads took linkage to 98.8 percent in Rochester and 99.9 in Buffalo. The 25 patients left over were retreatment cases filed without a Lead row. Together they carried about $460K of patient value nobody had attributed.

The move to Cloud Run landed at 4:59 PM on September 2. Both Cloud Run services were created four minutes later.

- Sep 15: the Cash Flow tab.
- Sep 30, 12:29 AM to 12:54 AM: the restyle in the Hybridge design.
- Oct 8: the daily Monday read at 2:45 PM, and the pace against a usual month at 5:01 PM.
- Oct 22: calendar presets for the Cash Flow tab.
- Oct 23: a Feature requests tab wired to Launchpad.

On October 26 at 4:39 PM our finance lead filed a request in that tab: "please add a quick toggle after MTD with Rest of Month." It was live at 12:03 PM the next day. On October 28 at 11:44 AM came a second: "Rest of Month toggle should include current day." It was live at 12:03 PM, 19 minutes later.

Each merge to main runs the tests and deploys both services.

## The hard parts

**Three copies of every metric.** In May I wrote that every metric lived in one function, so two tabs could not disagree. Porting the code proved it wrong. The old build had one implementation for the card, one for the drilldown list behind it, and one for the trend overlay. Three copies of "what counts as a case acceptance" is how a card and its own drilldown showed different numbers. Now each metric is defined once and the card number is computed from the drilldown's rows:

```ts
// packages/core/src/metrics.ts, inside metricValue()
const def = DEFS[key];
if (!def) return 0;
const rows = metricRows(snap, f, key, opts);
return def.value ? def.value(rows) : rows.length;
```

A test checks this for every metric across date ranges and locations.

The linkage number had the same flaw: it counted patients that pointed at some lead. The connect column holds only the surname, and the old join took the <span class="egg" tabindex="0" data-egg="One surname on the Leads board belongs to 75 different leads. The old join picked the first of them every time.">first match</span>, so 31.2 percent of patients resolved to an arbitrary lead. Breaking ties on first name cut that to 5.8 percent, and each row now records how it linked. No card moved, because the cards read lead fields copied onto each patient row.

**A past nobody saved.** The pace line compares the cash on the books by today's business day with the 12 month average at the same day. Monday keeps only the board as it is now, so the code rebuilds each past day backwards from the board and its activity log. Before it shipped, the rebuild matched 45 of 45 stored snapshot checks exactly: 5 export dates, 3 practices, 3 months each. Our finance lead chose what "on the books" means: the month as it stood at the end of that day, including cases that later fell through.

**A test that could not see.** Before switching over, I ran the old Apps Script code against the same exports and diffed every metric. It matched and was still off by a day. The Excel reader returns a date cell as midnight UTC, which New York reads as the day before: 948 case acceptance dates on the Rochester board. Both sides used my reader, so parity could not see it. A golden test with figures from the production dashboard caught it.

## What I said no to

**Making every tab live.** Only cash flow reads Monday daily. Every column it needs is native to the patient boards. The other tabs mix in the Leads board, so they stay on the weekly exports.

**Counting stale start dates as cash.** On the September 14 exports, the Rochester board had 356 accepted cases with no start date. 337 were accepted in 2024 or 2025, before the column was filled in reliably, and are finished treatments. Only the last 90 days of acceptances count as pipeline. The rest show as a data quality count.

**Swapping numbers under someone.** A newer snapshot raises a banner. The numbers change when someone clicks it.

## Where it landed

Nine Hybridge accounts can open it. Our finance lead files requests in its Feature requests tab. Both requests above went live within a day. I have not measured how often each person opens it.

The billing export for its Google Cloud project only switched on Oct 28, 2026, so there is no measured month of cost yet.

What I would keep: make the card count the rows behind it, and back a claim like "two tabs cannot disagree" with a test.
