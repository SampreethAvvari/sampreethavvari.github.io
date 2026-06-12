---
title: "How I built a clinic dashboard people actually trust"
date: "2026-05-12"
layout: ../../layouts/PostLayout.astro
description: "Two clinics, three messy boards, and a patient-to-lead match that was only 49% right. The fix wasn't a clever algorithm. It was reading the data properly."
img_path: "/cowork-dashboard.png"
img_alt: "Cowork Dashboard scorecards, trend chart, and funnel"
tag: "MLOps"
tone: "blue"
stats:
  - value: "49% → 99%"
    label: "patient-to-lead linkage"
    tone: "blue"
  - value: "~$460k"
    label: "orphan value surfaced"
    tone: "emerald"
  - value: "½ day → 3 min"
    label: "weekly reconciliation"
    tone: "amber"
---

The previous dashboard hit Monday.com's live API directly. It broke on rate limits, broke on schema changes, broke whenever a column got renamed. Every Monday morning the front office would open it and see stale numbers or an error. Leadership would pull their own exports. Two people would walk into the same meeting with different totals for the same metric, and the meeting would turn into an argument about the spreadsheet instead of the business.

At some point the front office stopped trusting their own reports. That is a worse problem than a broken API call.

I'm the sole engineer touching this system at Hybridge. The move I kept resisting was the obvious one: stop fighting the live API and pull from the weekly Excel exports Monday already generates. Stable files, predictable schema, no rate limits. Once I committed to that, the real problem became visible: the join was wrong.

Our dental practice runs two clinics. Each has a Patients board on Monday, both linked back to a single Leads board. To answer any real business question you have to join Patients to Leads. The old dashboard joined them by name. Two real people share a name. Typos happen. Monday inserts `(copy)` on duplicates.

I measured the damage one afternoon and almost didn't believe the number:

| Board | Name-based join | After the fix |
|---|---|---|
| Rochester Patients | **49.5%** | **98.8%** |
| Buffalo Patients | **65.3%** | **99.9%** |

A third to half of our patients weren't being linked to the original lead. Every funnel on every tab was off by a different amount. Leadership meetings were arguments about whose number was right.

## The fix was a column I'd been looking at for months

Both Patient boards already had a real pointer field back to the Leads board. Monday calls it a *board_relation*. The API hides it. The Excel export shows it.

I switched the join from "match by name + creation date" to "match by the linked lead's name string." That one change took the linkage to 99%.

The 25 leftover patients were re-treatment cases the ops team had filed without creating a Lead row. Combined treatment value: **~$460k of patient value** that nobody had been attributing.

<div class="stat-callout stat-emerald">
  <div class="stat-value">~$460k</div>
  <div class="stat-label">Orphan patient value surfaced after a single schema fix</div>
</div>

## One source of truth, finally

The old dashboard had filtering logic copy-pasted into eight tabs. They drifted. I rebuilt the data layer around three flat tables, one per Monday board, pulled from weekly Excel exports. Every metric lives in exactly one function:

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

The dashboard has six tabs: Dashboard, Monthly, History, Lead Sources, Trends, Playground. All pull from the same in-memory snapshot and the same metric functions. About 4,200 lines of Apps Script, deployed internally, costs nothing to run.

The front office uses this dashboard every day. They do not think about how it works. They open it, see one number, and trust it. That is only possible because every business rule lives in one function. When leadership asks "why does this tab say X," there is exactly one place to look. The orphans do not disappear silently anymore. If a re-treatment patient has no Lead row, the dashboard shows them as an orphan instead of dropping them from the funnel. That is the job: not shipping code, but making sure the business can see itself clearly.
