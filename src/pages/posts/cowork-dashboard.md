---
title: "When a single connect column rescued a year of reporting"
date: "2026-05-12"
layout: ../../layouts/PostLayout.astro
description: "Two clinics, three Monday boards, a patient-to-lead join only 49% accurate. The fix wasn't an algorithm. It was reading the schema."
img_path: "/cowork-dashboard.png"
img_alt: "Cowork Dashboard scorecards, trend chart, and funnel"
tag: "MLOps"
tone: "blue"
stats:
  - value: "49% → 99%"
    label: "patient-to-lead linkage"
    tone: "blue"
  - value: "~$169k"
    label: "revenue surfaced"
    tone: "emerald"
  - value: "½ day → 3 min"
    label: "weekly reconciliation"
    tone: "amber"
---

Every Monday at 8 a.m., I used to spend half a day exporting three Monday.com boards into Excel, hand-pivoting them, and trying to make the numbers match across tabs. They never did.

The reason was subtle. Our dental practice runs two clinics. Each one has a Patients board on Monday, both linked back to a single Leads board. To answer any real question, you had to join Patients back to Leads. The legacy dashboard joined them by name. Two real people share a name. Typos happen. Monday inserts `(copy)` on duplicates.

I measured the damage one afternoon and almost didn't believe the number:

| Board | Name-based join | After the fix |
|---|---|---|
| Rochester Patients | **49.5%** | **98.8%** |
| Buffalo Patients | **65.3%** | **99.9%** |

A third to half of our patients weren't being linked to the original lead. Every funnel on every tab was off by a different amount. Leadership meetings were arguments about whose number was right.

## The fix was a column I'd been looking at for months

Both Patient boards already had a real pointer field back to the Leads board. Monday calls it a *board_relation*. The API hides it. The Excel export shows it.

I switched the join from "match by name + creation date" to "match by the linked lead's name string." That one change took the linkage to 99%.

The 25 leftover patients turned out to be re-treatment cases the ops team had filed without re-creating a Lead row. Combined treatment value across them: **~$169k of YTD revenue** that nobody had been counting.

<div class="stat-callout stat-emerald">
  <div class="stat-value">$169k</div>
  <div class="stat-label">Orphan re-treatment revenue surfaced after a single schema fix</div>
</div>

## One source of truth, finally

The old dashboard had filtering logic copy-pasted into eight tabs. They drifted. So I rebuilt the data layer around three flat tables (one per Monday board), pulled from weekly Excel exports, with every metric living in exactly one function:

```js
function getLeads_(snap, f) {
  let n = 0;
  for (const l of snap.leads) {
    if (!locOk(l.location)) continue;
    if (excluded(l.reason_not_scheduled)) continue;
    if (!inRange(l.creation_date, f.start, f.end)) continue;
    n++;
  }
  return n;
}
```

Change the definition of "marketing source" in one place and every chart on every tab updates. Two tabs cannot disagree about the same number anymore.

## What changed

A weekly workflow that used to eat 6-8 hours of senior time across the team now takes 3 minutes. The leadership meetings are about strategy, not arithmetic.

<div class="post-stats-grid my-10">
  <div class="stat-callout stat-blue">
    <div class="stat-value">49% → 99%</div>
    <div class="stat-label">patient-to-lead linkage, both boards</div>
  </div>
  <div class="stat-callout stat-amber">
    <div class="stat-value">½ day → 3 min</div>
    <div class="stat-label">weekly reconciliation, end to end</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">8 → 1</div>
    <div class="stat-label">filter logics across tabs</div>
  </div>
</div>

The dashboard has six tabs: Dashboard, Monthly, History, Lead Sources, Trends, Playground. All of them pull from the same in-memory snapshot and the same metric functions. About 4,200 lines of code total, deployed as an internal Apps Script web app, costs nothing to run.

The lesson I keep coming back to: read the schema. Then read it again. The fix to a year of bad reporting was sitting in a column I'd been looking at all along.
