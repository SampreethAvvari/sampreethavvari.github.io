---
title: "When a single connect column rescued a year of reporting"
date: "2026-05-12"
layout: ../../layouts/PostLayout.astro
description: "Two clinics, three Monday boards, a patient-to-lead join only 49% accurate. The fix wasn't an algorithm. It was reading the schema."
img_path: "/cowork-dashboard.svg"
img_alt: "Cowork Dashboard scorecards, trend chart, and funnel"
---

## Situation

Hybridge Dental runs two clinics. Rochester (we still call it "1960" from the street number) and Buffalo. Operations lives across three Monday.com boards: a Leads board for every inbound caller, and a separate Patients board per location for everyone who actually shows up.

Three boards is fine for daily work. Front desk knows who to call. Doctors know who's on the schedule. The problem starts the moment somebody asks "are we ahead of last year on case acceptance for Rochester marketing leads?" Because to answer that you have to join the Patients board back to the Leads board, and historically that join was broken in ways nobody had measured.

The way reporting actually worked before this project: every Monday at 8am, I exported the three boards to Excel, opened a workbook of pivots, and hand-reconciled. **Half a working day, every week.** Across me, Kym, and the front desk that's roughly 12-15 hours of senior time a week being spent reformatting numbers that should have been a single click. The numbers themselves never agreed with whatever Kym had pulled in her own spreadsheet, because we filtered slightly differently. Were we excluding *Hung up*? Were *Yes, virtual* consults counted as shown? Was a *Family/Friend* referral marketing? Every answer drifted person to person.

There was also a first attempt at the dashboard that I'm not proud of. A 2,803-line Apps Script web app that hit the Monday GraphQL API directly. Live data, nice cache, real-time-ish dashboard. It also gave different numbers on different tabs.

Two structural problems were doing that to me. First, the patient boards inherit fields from Leads as Monday *mirror* columns: Intake Date, Consult Date, Intake Show, Lead Source. Mirrors render fine in the Monday UI. They return `null` over the API. So my live dashboard couldn't see any of that data, which meant I had to join patients back to leads in JavaScript to pull those fields off the original lead.

I joined on `last_name | first_name | creation_date`. That's the second problem.

Two real people share a name. Typos drift across boards. Marriage name changes happen. Monday inserts `(copy)` on duplicates. When I finally added instrumentation to count the matches:

```
1960 Patients name-based join: 412 of 832 patients matched leads (49.5%)
Buffalo Patients name-based join: 187 of 286 patients matched leads (65.3%)
```

A third to half of the patients I was reporting on weren't linked to their original lead. Every funnel was wrong by a different amount on every tab.

## Task

Rebuild the dashboard so that:

1. Every metric, on every tab, agrees with every other metric, in every drill-down.
2. The patient-to-lead join is correct enough that doctors and partners trust the numbers in their own funnels.
3. The weekly reporting workload drops from a workday to a button click.
4. A second engineer (which we don't have, but might one day) could maintain it with no internal documentation beyond the code itself.

Also: do all of this without buying anything, without standing up a server, and without breaking the existing Monday workflows the front desk uses every hour.

## Action

### Read the schema again

I'd built the whole live-API version before reading the patient board's column definitions carefully. When I went back, there it was, in `link_to_leads__1` on 1960 and `connect_boards9__1` on Buffalo: a Monday *board_relation*. Not a mirror. A real, persistent pointer from the patient item to the lead item.

The board_relation isn't returned over the API as easily as a regular text column, but it does appear in the Excel export, rendered as the linked lead's name string. That was enough.

After switching the join to look up via the connect column, my numbers:

```
1960 Patients: 99 of 100 sampled patients matched leads (98.8%)
Buffalo Patients: 100 of 100 sampled patients matched leads (99.9%)
```

That's the entire trick. The whole dashboard pivoted around that one column.

### Count the 25 patients that didn't match

99% linkage left a residue of 25 patients (24 on 1960, 1 on Buffalo) that genuinely had no lead pointer. I assumed bugs. They weren't bugs. Of the 24 on 1960, 17 were tagged `Secondary Lead Source = "Additional Tx"`. Re-treatment cases. The ops team had skipped creating a new Lead row when an existing patient came back for another procedure, which is fine, except the dashboard hadn't been counting them.

Combined treatment value across those orphans: **$169k YTD**. Real revenue, made visible because the new join finally surfaced the patients carrying it.

I made a call: count them in per-board metrics (consults, case acceptance, doctor performance), exclude them from the cohort funnel with a footnote, and surface them on a Data Quality panel so ops could clean them up over time.

### Stop hitting the API

The original version was real-time, except the data it returned was wrong half the time because of mirror nulls. Once I had the connect column, I could have stayed on the live API. I almost did. The reason I didn't: Monday's Excel export *does* render mirror columns. The API doesn't. So if I went to weekly exports, I'd get the Intake Date / Consult Date / Lead Source mirrors as plain values, no fallback gymnastics, and I'd get the connect-column linkage at the same time.

The cadence trade was real (weekly, not real time) but the volume of reporting we actually do is weekly anyway. We don't have a use case for a 7pm Tuesday refresh. I rewrote the data layer:

```js
// Code.gs:1011 — once-a-week refresh
function doRefresh() {
  const ctx = _bootCtx_();
  const files = _findLatestExports_(ctx); // Leads_*, 1960_Patients_*, Buffalo_Patients_*
  const out = {};
  for (const tag of ['leads', 'p1960', 'pbuf']) {
    const tmpSheet = Drive.Files.copy(
      { name: 'tmp_' + tag, mimeType: MimeType.GOOGLE_SHEETS },
      files[tag].id
    );
    out[tag] = _parseMondayExport_(tmpSheet.id);
    Drive.Files.remove(tmpSheet.id);
  }
  _writeFlatTabs_(out);
  _writeSyncState_(ctx, files, out);
}
```

The web app endpoints read those three flat tabs, build an in-memory snapshot with the join already computed, cache it for 5 minutes, and serve everything off that. The refresh happens when I drop new exports in the Drive folder and click *Refresh now*. **Three minutes**, including the click.

### Resolve the join from the connect column

The connect column in Excel comes through as the linked lead's name. I build a name → lead index from the Leads tab, then resolve each patient by looking up their connect column string:

```js
// Code.gs:1340 — patient → lead resolution
const leadIndex = {};
function addKey(k, idx) {
  if (!k) return;
  if (!leadIndex[k]) leadIndex[k] = [];
  leadIndex[k].push(idx);
}
for (let i = 0; i < leads.length; i++) {
  const l = leads[i];
  const last  = stripParens_(l.name).toLowerCase();
  const first = stripParens_(l.first_name).toLowerCase();
  if (last) addKey(last, i);
  if (last && first) {
    addKey(first + ' ' + last, i);
    addKey(last + ' ' + first, i);
    addKey(last + ', ' + first, i);
  }
}

function resolve(p) {
  if (!p.leads_link) return -1;
  const k = stripParens_(p.leads_link).toLowerCase();
  const arr = leadIndex[k];
  if (arr && arr.length) return arr[0];
  return -1;
}
```

The crucial difference from the original name-join: this isn't matching on `(last, first, creation_date)`. It's matching the lead name that Monday itself stored as the connect-column value. If two real people share a name, Monday inserted `(copy)` on the export, which `stripParens_` removes, but the underlying connect pointer is unique per patient.

### One source of truth, in code

Every metric on the dashboard, every tab, every drill-down: they all call the same set of functions. There is exactly one definition of *what is a Lead*:

```js
// Code.gs:1483
function getLeads_(snap, f) {
  const locOk = _locPredicateForFilter(f);
  let n = 0;
  for (let i = 0; i < snap.leads.length; i++) {
    const l = snap.leads[i];
    if (!locOk(l.location)) continue;
    if (_hasExcludedReason(l.reason_not_scheduled)) continue;
    if (!_inRange(l.creation_date, f.start, f.end)) continue;
    n++;
  }
  return n;
}
```

`getMarketingLeads_` adds the marketing-source filter. `getScheduled_` filters by `conversion_date` and `lead_status = 'Scheduled'`. `getCA_` lives on the Patients side and filters by `tx_status = 'Case Acceptance'` and CA date in range.

The point of putting them in one file isn't elegance. It's that the original version had filtering logic copy-pasted into eight tabs of the frontend, drifted independently, and produced eight versions of "leads this week." Now if Kym wants to change the marketing taxonomy, I edit `_isMarketingSource()` once and every chart on every tab updates.

One subtlety worth calling out. `getLeads_` excludes leads with `reason_not_scheduled ∈ {Hung up, Not a Lead, Number Not in Service}`. But `getScheduled_` does *not* apply that exclusion:

```js
// Code.gs:1511 (comment block)
// Intentionally does NOT filter by `reason_not_scheduled`: front-desk staff
// don't always clear that field when a lead originally flagged "Hung up" /
// "Not a Lead" calls back and actually schedules. If lead_status='Scheduled',
// the lead scheduled — full stop. The EXCLUDE_REASONS filter only matters
// for top-of-funnel Leads counts (see getLeads_).
```

I learned this from a two-day argument with the front desk team. Hung-up callers really do call back. The pre-refactor dashboard was dropping those re-engagements out of *both* the Leads and the Scheduled counts.

### Keep the frontend boring

Six tabs, one filter bar at the top (date range, location selector, presets for last completed week / last 4 weeks / YTD).

```
Dashboard      KPI cards + cohort funnel + per-doctor table + data quality
Monthly        Month-over-month vs prior year, partial-month flagged
History        Continuous monthly timeline since Jan 2024
Lead Sources   Digital / Traditional / Radio / Other + re-treatment
Trends         Weekly trend for any metric, prior-year overlay
Playground     Any metric, any range, any location
```

KPI cards are clickable. Click *Case Acceptance Value* and a drill-down opens with first name, last name, doctor, proposed treatment, treatment value, treatment start date. Click *Consults* and the drill-down columns change to fit that metric. The same getter functions back each one, so the drill-down is the same view of the same truth at row level instead of aggregate level.

When the location filter is set to *Both*, ROC and BUF are never silently combined into a single number. Cards split into two color-coded blocks. Funnels stack. Doctor tables sit side by side. Trend charts draw two solid lines (ROC blue `#5b8def`, BUF orange `#f5a524`) plus dashed prior-year overlays. The intent is that a partner glancing at the screen always knows which clinic they're looking at.

The one Chart.js gotcha that cost me an afternoon: if you set `responsive: true` and `maintainAspectRatio: false` on a Chart.js canvas without wrapping it in a parent div with an explicit height, the chart's resize loop never converges and the canvas grows past the viewport on every redraw. Every chart on the dashboard is wrapped in a `.chart-host` div with `height: 320px` (or 220 or 360 depending on context). Boring fix, hard to discover.

## Result

The system now sits as the single reporting surface for the whole practice. The numbers that matter:

```
Patient-to-lead join coverage     49.5% / 65.3%   →  98.8% / 99.9%
Weekly reconciliation time        ~6-8 hours      →  3 minutes
                                  per senior staff   per refresh
Revenue made visible              ~$169k of YTD case-acceptance value
                                  recovered from orphan re-treatment patients
                                  the old dashboard was silently dropping
Source of truth                   8 separate filter logics  →  1
Tabs disagreeing on the same      every week                →  structurally
metric                                                         impossible
```

Three metrics in particular moved the weekly leadership meeting:

**Per-doctor case-acceptance value, sliceable by week, month, YTD.** Before this, "Dr. X is converting well" was anecdotal. Now there's a number, with a side-by-side against peers, refreshed weekly. Doctors see their own funnel.

**Marketing-only Scheduled and CA Value.** Stripping out doctor referrals and family/friend referrals from the funnel was the only way to actually price what the ad spend is doing. The old way mixed paid leads with walk-ins.

**YoY weekly overlay.** Every weekly meeting now opens with "are we ahead of last year on this week?" instead of a guess. The prior-year line is the same shape, drawn dashed, on the same chart.

The dashboard is about 4,200 lines of code total, down from the 5,500 of the original less-correct version. It deploys as an Apps Script web app restricted to the Hybridge Workspace. It costs nothing. It refreshes on a button click.

The biggest shift isn't technical. It's that leadership meetings now argue about strategy on top of numbers everybody trusts, instead of arguing about whose number is right. The lesson I keep coming back to: read the schema. Then read it again. The fix was always sitting in a column I had been looking at for months.
