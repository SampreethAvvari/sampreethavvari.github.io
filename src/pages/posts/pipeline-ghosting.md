---
demo: /demos/doc-coach
title: "No more green checks on consults that never emailed"
date: "2026-05-29"
layout: ../../layouts/PostLayout.astro
description: "Runs went green while emails never sent. I moved the run row to the top, made every failure retry or turn amber, and added logs anyone can read."
img_path: "/pipeline-ghosting.png"
img_alt: "Run dashboard with a green status pill that hides amber and red failures underneath"
architecture: "doc-coach"
tag: "Process"
tone: "blue"
stats:
  - value: "13 runs"
    label: "that scored but never emailed, found and resent on May 29"
    tone: "emerald"
  - value: "36 failures"
    label: "since May, 9 scoring, 10 note and 17 Drive upload, each shown as a row with a code and a plain English fix"
    tone: "blue"
  - value: "5 min"
    label: "between sweeps that retry a failed run, up to 3 times before a person gets an email"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Consult grading runs showed green while the email never went out and the Sheet never got its row."
  - label: "What I built"
    value: "A run row for every event, one status legend, two layers of retry and a plain English Logs tab."
  - label: "Who uses it"
    value: "Treatment coordinators and our CEO, who read the run dashboard."
  - label: "Outcome"
    value: "13 runs that scored but never emailed were found and resent; every failure now shows as a row."
  - label: "Runs on"
    value: "The Doc Coach service on Cloud Run, with a sweep every 5 minutes retrying up to 3 times."
  - label: "Built"
    value: "May 27 to June 2, 2026, on a grader that had been live about a week."
---

## The problem

The consult grader had been live for about a week, and it was a polite liar. A run could show complete while the email never went out and the master Sheet never got its row. Some consults never showed up at all.

The complaints came in two shapes. "I ran it but no email came." And errors nobody could see in All Runs, the dashboard table. I was rerunning consults by hand and could not always say why the first run had failed.

The people reading that dashboard are treatment coordinators (TCs) and our CEO. "Check Cloud Logging" is not an answer they can use. The job was to make every failure visible, make every temporary failure retry itself, and make the dashboard agree with what really happened.

## What I built

Four changes to the same pipeline. Every transcript event now gets a run row before any gate, so nothing can vanish. One status legend everywhere: green done, amber needs attention, red failed, blue running, and green only when both the email and the Sheet row landed. Two layers of retry: in the call for Google API blips, and a sweep every 5 minutes for runs that failed anyway. And a Logs tab on every run, with an Easy view in plain English and a Developer view with the audit events and the raw record. Behind all of it, a reconciler checks the Sheet after every status change. [Open the drawing](/architecture/doc-coach).

## The sprint

The first fix went in on May 27 at 5:14 PM: run rows for every event, TCs with more than one mailbox, one status legend.

On May 29 the work ran from 2:31 PM to 10:58 PM. The fix for "I ran it but no email came" was one flipped default: the Rerun button's send email flag had defaulted to off. A one shot script found 13 runs that had scored but never emailed and resent them. The same script replayed 4 missing Sheet rows from the scorecards still in Drive; the other 9 had no saved scorecard and needed a full rerun. Then the reconciler, retries with backoff, the broken pipe fix at 9:24 PM, and the Logs tab at 10:58 PM.

June 1 added the 5 minute sweep. Between 1:34 AM and <span class="egg" tabindex="0" data-egg="The sweep runs every five minutes. I ran on a slightly less reliable schedule.">2:20 AM</span> on June 2 came delete as a tombstone so the sweep stops touching a meeting, repair the delivery without scoring again, escalate when the budget runs out, and a Mark complete button for when a human knows better.

## The hard parts

**The run row came too late.** It used to be created deep in the webhook flow, after the host check, the dedupe claim and the Zoom download. Anything dropped before that left no trace. Two TCs had moved mailboxes from one company domain to the other, the host allowlist only knew their old addresses, and their consults were dropped without a trace. Now the row comes first, every drop marks it failed with a reason and a fix, and a TC can have several addresses.

**Errors that are not HTTP errors.** The retry helper caught Google's HTTP errors and OAuth refresh errors. A <span class="egg" tabindex="0" data-egg="A broken pipe is the network hanging up mid sentence. Python, being polite, does not call it an HTTP error.">BrokenPipeError</span> from the TLS socket never becomes an HTTP response, so it slipped past, and a bare except swallowed it: the consult scored cleanly and the Sheet row was never written. In June an SSL error killed a report card run the same way, because it is an OSError but not a ConnectionError. Now the transient set is explicit:

```python
# zoom-transcript-pipeline/app/retry.py
TRANSIENT_CONNECTION_ERRORS = (
    BrokenPipeError, ConnectionResetError, ConnectionAbortedError,
    ConnectionRefusedError, TimeoutError,
    ssl.SSLError, http.client.HTTPException,
)
```

Three attempts with 1 and 2 seconds of backoff plus a little jitter, then it raises, so the run turns amber.

**A flag set before the work finished.** The record said "Sheet appended" when the append had not happened, and sometimes the opposite, when an error came after the append succeeded. The reconciler reads the Sheet after every status change. Flag says yes and the row is missing: flip it and show amber. Flag says no and the row is there: flip it and show green. It never appends or deletes rows on its own, because that is the direction it cannot prove safe.

## What I said no to

**Retrying everything.** The sweep only touches failure codes a rerun can fix. A host it does not know, a filtered meeting, a duplicate or an unresolved doctor is a config question, so it waits for a person. Each run gets 3 tries. The code comment says it plainly: burning model tokens on a broken meeting is worse than leaving the red row.

**Throwing away the last good run.** A rerun that succeeds replaces the original row and dedupes the Sheet, so there is one row per consult. A rerun that fails leaves the original alone as the known good baseline.

**A queue I did not need yet.** The work runs as a background task after the 202. The scaling notes say when to move to Cloud Tasks: around five consults at once per instance, or Zoom retries climbing. At about 80 consults a month, a queue would be one more system to watch.

## Where it landed

Every transcript event leaves a row, and every failure path in the pipeline marks that row with a code and a plain English fix. Since May the audit log shows 9 scoring failures, 10 note failures and 17 Drive upload failures, each a row someone could see.

The sweep, the repair path and the reconciler still run every day. The Logs tab now walks ten stages, since the chart note became one.

What is not measured: I do not have a count of manual reruns before and after, so I will not claim a drop.

What I would keep: never set a flag before the work it describes is done, and check it against the real thing after.
