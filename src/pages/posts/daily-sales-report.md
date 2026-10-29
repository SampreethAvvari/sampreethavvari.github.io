---
title: "The finance forecast now builds itself by 6:25 every weekday"
date: "2026-10-03"
layout: ../../layouts/PostLayout.astro
description: "The VP of Finance pasted two lab exports into a 14 tab workbook every morning and sent the forecast by hand. Now a pipeline builds the same forecast by 6:25 each weekday."
img_path: "/daily-sales-report.png"
architecture: "daily-sales-report"
img_alt: "Daily Sales Report pipeline: two lab exports in, a three month forecast with bands out every weekday morning"
tag: "MLOps"
tone: "emerald"
stats:
  - value: "16 days"
    label: "from the first commit to the first report from the scheduled job"
    tone: "emerald"
  - value: "49 seconds"
    label: "average run from wake to a finished report, over 22 sent mornings"
    tone: "blue"
  - value: "16 of 16"
    label: "weekday mornings sent since the October 7 fix, through October 29"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Our VP of Finance pasted two lab exports into a 14 tab workbook each morning to send the forecast."
  - label: "What I built"
    value: "A weekday pipeline that builds the same forecast, with nine checks deciding whether the report goes out."
  - label: "Who uses it"
    value: "The VP of Finance, who gets the report each weekday morning from their own Google account."
  - label: "Outcome"
    value: "16 of 16 weekday mornings sent since the October 7 fix; a run averages 49 seconds."
  - label: "Runs on"
    value: "Cloud Run and BigQuery, with Apps Script carrying the exports and Gemini writing one checked paragraph."
  - label: "Built"
    value: "16 days from the first commit to the first scheduled report, September 8 to 24, 2026."
---

## The problem

Every morning our VP of Finance ran the same routine. Two exports from the dental lab's case system landed in their inbox. They pasted one at cell A4 of a 14 tab workbook and the other onto another tab, recalculated, checked that the data quality block read <span class="egg" tabindex="0" data-egg="The emailed report still prints those exact words, above nine numbered checks in the workbook's order.">ALL CHECKS PASS</span>, and sent the summary tab.

The workbook projects invoiced lab revenue and new arch starts for this month and the next two, each with a band sized to hold about 68 percent of past outcomes. The VP built it and handed it over on August 25 with a 700 line spec and 15 acceptance values. One line sat above them: "If a rebuild does not reproduce them, the rebuild is wrong, not the spec."

The spec also listed two Excel bugs that had quietly returned wrong numbers. The job: take the person out of the morning and leave the model exactly as it was.

## What I built

A weekday Cloud Run job reads the two exports, drops patient and practice fields as it parses them, loads BigQuery, and runs a pure Python port of the model. Nine checks decide whether the report goes out, and Gemini writes one paragraph over the finished numbers. A short Apps Script in the VP's own Google account carries the exports in and the report out. A dashboard behind Google sign in shows the report as sent and every run with its steps.

[Open the drawing](/architecture/daily-sales-report).

## The sprint

The first commit, at 2:18 PM on September 8, was the engine reproducing all 15 acceptance values. By 5:14 PM that day the daily orchestrator and a first dashboard were in.

- September 10: deployed behind Google sign in.
- September 24: the first report from the scheduled job, 16 days after the first commit.
- October 7: the VP asked for the report to fill in a missing number on its own. The fix and an alert were committed at 6:03 PM, and the next morning's report was built at 6:22.
- October 9, 3:08 to 3:39 PM: all nine tabs and the emailed report restyled, one screen at a time.

## The hard parts

**Reading the lab reports without reading a mailbox.** My first design used the Gmail API with domain wide delegation. Delegation is granted to an identity, and that identity could have read any mailbox in the company. Instead, an Apps Script inside the VP's own account asks Gmail for headers and the attachment layout only, and copies matching files to a bucket where that account can add files and do nothing else. The same script emails the finished report. Nothing in the project holds a credential that can read mail.

**A number nobody typed.** Check 6 wants last month's new arch starts, typed by hand from the P&L into a dashboard form. September's was never typed, and a failed check holds the report, so four mornings from October 2 to 7 were built and held. The VP's reaction: "Wait it already knows! Tell it to learn from itself." The lab's own starts report does count every arch. Now a closed month with no typed figure takes that count, once every row for the month comes from a pull made after it ended, and a typed figure still wins. An alert on the job's own log line now emails me about any held or broken morning.

**Gemini writes the paragraph, code checks every number.** Gemini's only input is a payload of finished projections, bands and check results. Code checks that every number in the paragraph appears in that payload, in some reasonable rounding.

```python
# packages/pipeline/dsr_pipeline/narrative.py
allowed = _allowed_numbers(payload)
for m in _NUM.finditer(text):
    token = m.group().rstrip(".")
    if token in allowed or token.replace(",", "") in allowed:
        continue
    return "states a number not present in the inputs: %s" % token
```

The guard also rejects "starts lead revenue", a claim the spec tested and found not significant, and any advice to retune. On an error, a timeout or a rejection, a deterministic template ships.

## What I said no to

**Letting the model tune itself.** Across a 1,280 combination grid, the spec's best setting scored 2.59 percent on the months it was tuned on and did 0.62 points worse on months it had not seen. <span class="egg" tabindex="0" data-egg="Days in a month share one final number, so the spec counts months. Halving an error bar takes four times the sample.">315 days of forecasts</span> share 15 monthly actuals. Nothing in the pipeline can write a constant. A refit script proposes changes once a year, and a person decides.

**My own better model.** The spec lags arch starts by a whole month, though an arch's invoices spread out, centered about 20 business days after the start. My version attached each start to the days that earn from it. Over 8 scorable months it improved next month's error by 0.28 points and worsened this month's by 0.29, both under the spec's 0.3 point bar for calling a change real. Rerun on September 28 with July and August closed, the gain was gone. It sits behind a one line switch, off, until there are 18 scorable months.

**Retries.** The job has none. A crash leaves the landed files in place and the next 15 minute slot reads them again.

## Where it landed

The VP of Finance gets the report each weekday morning from their own account, and two named accounts can open the dashboard. 22 reports have been published since September 24, including 16 of 16 weekday mornings since the October 7 fix. A run that builds one averages 49 seconds.

The accuracy is the VP's work: the spec measured current month revenue error falling from 4.2 percent early in the month to 1.5 percent late. My part is keeping the 6:20 run on that same model, with the 15 acceptance values pinned in its tests.

The billing export for this project only switched on October 28, 2026, so there is no measured month of cost yet. I never timed the old routine, so I claim no minutes saved. Whether the live bands hold 68 percent needs more closed months.

What I would keep: the acceptance values as the first commit, and a language model that only restates numbers code has already checked.
