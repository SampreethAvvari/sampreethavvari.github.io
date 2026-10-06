---
demo: https://sampreethavvari.github.io/ai-systems-tours/tours/cowork-dashboard/
title: "How I built a clinic dashboard people actually trust"
date: "2026-05-12"
layout: ../../layouts/PostLayout.astro
description: "Two clinics, three messy boards, and a patient-to-lead match that was only 49% right. The fix wasn't a clever algorithm. It was reading the data properly."
img_path: "/cowork-dashboard.png"
img_alt: "Cowork Dashboard scorecards, trend chart, and funnel"
tag: "MLOps"
tone: "amber"
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

The old dashboard had filtering logic copy-pasted into eight tabs. They drifted. I rebuilt the data layer around three flat tables, one per Monday board, pulled from weekly Excel exports. Every metric lives in exactly one function *(not quite, see the update at the end)*:

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

Change the definition of "marketing source" in one place and every chart on every tab updates. Two tabs cannot disagree about the same number anymore. *(Not quite. See the update at the end.)*

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

The front office uses this dashboard every day. They do not think about how it works. They open it, see one number, and trust it. That is only possible because every business rule lives in one function. *(Not quite. See the update at the end.)* When leadership asks "why does this tab say X," there is exactly one place to look. The orphans do not disappear silently anymore. If a re-treatment patient has no Lead row, the dashboard shows them as an orphan instead of dropping them from the funnel. That is the job: not shipping code, but making sure the business can see itself clearly.

## Update, September 2026: I moved it off Apps Script, and found what I got wrong

In September I moved this dashboard off Apps Script and onto Cloud Run. Porting it meant rereading every line of the old build, and two things I wrote above did not survive that.

The first is the claim that every metric lived in one function, so two tabs could not disagree. It was not true. The old build had three implementations of every metric: one for the card, one for the drilldown list behind it, and one for the trend overlay. Three copies of "what counts as a case acceptance" is exactly how a card and its own drilldown could show different numbers. I had unified the filters, solved one layer of the problem, and written as if I had solved all of it.

### What moved

The weekly routine did not change: export the Leads board and one patient board per clinic (three now, since Syracuse went live in June) and drop the four files into a Drive folder.

<div class="aside">
<strong>How it runs now.</strong>
<ol>
<li>A scheduler checks the folder every 5 minutes.</li>
<li>A private ingest service rebuilds only when all four exports have changed, so a half finished upload never becomes a half updated dashboard.</li>
<li>It writes an immutable snapshot named by a hash of its contents, then writes the pointer to it last, so a failed build leaves the last good one in place.</li>
<li>The browser pins one snapshot for the whole session and computes everything locally. A newer one raises a banner, and the numbers change only when you click.</li>
</ol>
</div>

One core package runs in both the ingest service and the browser, with a single metric registry where the card number is computed from the drilldown rows. From `packages/core/src/metrics.ts`, lines 305 to 313:

```ts
/** The card number. By construction this is a function of the drilldown rows. */
export function metricValue(
  snap: Snapshot, f: Filter, key: MetricKey, opts: MetricOpts = {},
): number {
  const def = DEFS[key];
  if (!def) return 0;
  const rows = metricRows(snap, f, key, opts);
  return def.value ? def.value(rows) : rows.length;
}
```

There is no second copy to drift, and a test checks this for every metric across a grid of date ranges and locations.

Custom dates now apply when you press Go, instead of recalculating on every half typed date. Every load carries a sequence number, so a stale result can no longer land on top of a newer one. The Weekly tab over several years went from about 5.2 seconds to about 17 milliseconds. The old code scanned every lead about 1,900 times for that view; with sorted date indexes, a one week query touches about 60 rows.

### The join was quietly wrong

Above, I said the fix took linkage from 49 to 99 percent. That measured coverage, how many patients pointed at some lead, not whether it was the right one. The connect column holds only the lead's surname, and surnames repeat a lot. The old join took the first match, so about 31 percent of patients resolved to an arbitrary lead who shared their last name.

Breaking ties on the patient's first name cut that to 5.8 percent, and every row now records how it was linked, so the leftovers are counted instead of hidden. No card moved, since the cards read lead fields copied onto each patient row. What was wrong was the linkage claim, mine and the Data Quality panel's.

### A bug the parity test could not see

Before switching over, I ran the original Apps Script code in a Node VM against the same exports and diffed every metric. It matched, and it was still off by a day. ExcelJS returns date cells as midnight UTC, and reading them in New York time pushed each one back a day: 948 case acceptance dates on one clinic's board. Parity could not see it because both sides used the same reader. So I added a golden test with figures read straight off the production dashboard, and that is what caught it.

### What is new

A Cash Flow tab. Every other tab looks back at what we sold. This one looks forward, windowed on treatment start date instead of acceptance date, so it shows what is booked to begin. Only accepted cases count, because a few lost cases still carry a start date nobody cleared.

Late in September I restyled it in the Hybridge design. The capacity planner, built after it, copied its pinned snapshot pattern, since it is the one live data setup we have that I know holds up.

A sentence like "two tabs cannot disagree" should come with a test that proves it. This time it does.
