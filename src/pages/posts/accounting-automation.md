---
title: "Nine accounting scripts moved from a laptop to one page in an evening"
date: "2026-05-20"
layout: ../../layouts/PostLayout.astro
description: "Our controller ran nine Python scripts by hand, with 26 terminal prompts between them. I put them behind one page that asks every question before the run, in one evening."
img_path: "/accounting-automation.png"
architecture: "accounting-automation"
img_alt: "Accounting automation pipeline: Denticon, MagicTouch, Paychex, banks into Google Sheets and QuickBooks"
tag: "Process"
tone: "amber"
stats:
  - value: "62 minutes"
    label: "from the first commit to the first live revision on May 20"
    tone: "emerald"
  - value: "3.7 hours"
    label: "from the first commit to the browser editor our controller asked for, live at 7:56 PM"
    tone: "blue"
  - value: "26 prompts"
    label: "typed into a terminal across the nine old scripts, now asked up front in one form"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Our controller ran nine Python scripts on a laptop, answering 26 terminal prompts between them."
  - label: "What I built"
    value: "One page that suggests the script for each export, asks its questions in one form and runs it."
  - label: "Outcome"
    value: "The scripts kept their logic and ran from a browser, with a diff shown before any edit was published."
  - label: "Runs on"
    value: "FastAPI on Cloud Run behind Identity Aware Proxy, with reference workbooks in Cloud Storage."
  - label: "Built"
    value: "Live 62 minutes after the first commit, and finished in one evening on May 20, 2026."
  - label: "Status"
    value: "Offline now: the Google Cloud project's billing is off."
---

## The problem

Our controller turned exports into books with nine Python scripts on a Windows laptop. Each one found its file in the Downloads folder by a hard coded path, stopped halfway to ask questions in a terminal, and wrote its result back to Downloads. Out came QuickBooks import files from Denticon, the lab system, Ramp and the bank, a cleaned Paychex time off workbook and a receivables aging report. Two of the scripts wrote straight into Google Sheets.

Between them the scripts called `input()` <span class="egg" tabindex="0" data-egg="Counted with grep across the old scripts. Some sit inside loops, so a file with many cash payments asks far more than 26 times.">26 times</span>. Which deposit account does this cash payment go to? Which department does this new employee belong to? Which of these vendors does this ACH line match? Write this tab or skip it?

Our controller asked for one internal site: upload a file, have it pick the right script, ask what it needs, run it, and hand back the output. Our controller also wanted to edit the scripts from a browser and see a diff before publishing.

## What I built

Accounting Tools, a FastAPI app on Cloud Run behind Google's Identity Aware Proxy. Upload an export and the page recommends a script from the file name. The script's questions come up as one form, then it runs and leaves a file to download, or rows in a Sheet.

Around that: a Scripts tab with an editor, a diff view, version history and revert, a Reference files tab for the three workbooks the scripts keep, a Run history tab, and an Access tab for admins. A second service built from the same image runs the checks import, which pulls check sheets out of Gmail into the outstanding checks Sheet. [Open the drawing](/architecture/accounting-automation).

## The sprint

All of it happened on May 20. The spec was approved that day and the first commit went in at 4:12 PM. The shared contract every script would follow came minutes later. By 4:56 PM one script, the Ramp reformatter, worked from upload to download with an end to end test. The first live revision went up at 5:14 PM, 62 minutes after the first commit.

Then the rest of the upload scripts moved onto the contract between 5:44 PM and 6:22 PM, simplest first. The checks import had its own live service by 6:57 PM.

The editor our controller asked for was live at 7:56 PM: open a script, change it, see the diff, publish. That was 3.7 hours after the first commit. The Access tab followed at 8:20 PM and the last change of the night at 8:46 PM.

## The hard parts

**A web page cannot wait at a prompt.** A terminal script can stop and wait for someone to type. A web request cannot. So each script now has two entry points. Prescan reads the file and the reference workbooks, writes nothing, and returns every question the run will need. Run takes the answers and does the work. A small adapter in each script turns the JSON it gets into one or the other:

```python
# scripts/_lib.py
if mode == "prescan":
    result = prescan_fn(ctx)
elif mode == "run":
    result = run_fn(ctx, request.get("answers", {}))
```

Cashflow import, the largest, turned ambiguous ACH matches, unmatched vendors and a confirm for each Sheet tab into one form. Deleting the matched outstanding checks became a second step after the run, with its own confirm.

**Running code that can change.** Scripts can be edited from the browser, so the server never imports one. Each runs as its own process with JSON in, JSON out and a timeout, so a broken script returns an error and the server keeps going. A publish first compiles the new code and runs that script's smoke test in a copy of the project. If either fails, the editor shows the error and nothing is committed.

**Two bugs that had been there all along.** In the aging report, the list of platinum customers was missing a comma, so Python <span class="egg" tabindex="0" data-egg="Two string literals side by side are joined into one. Python calls it a feature. Here it quietly made a customer number that does not exist.">joined two customer numbers into one</span> and one platinum customer dropped off the list. In the Denticon production import, the line that names the output file was indented into the block above it, so some paths reached the write with no file name. Both were fixed in the move, and the comma has a regression test.

## What I said no to

**Rewriting the scripts.** They stayed in Python with their logic intact, so our controller still recognizes them. I changed where they read and write, how they ask, and the two bugs.

**A database for reference data.** The ACH matcher, the cashflow matcher and the department list stayed Excel workbooks. Our controller works in Excel and sometimes downloads one, edits it and puts it back. On a GCS Fuse mount they are plain files to the scripts, and bucket versioning keeps each old copy for 30 days.

**A general platform.** The spec ruled out more users, other scripts, phones and a custom domain. It runs these nine scripts for our controller, and that kept it to an evening.

## Where it landed

It went live on May 20 for our controller. The Google Cloud project's billing is off now, so the site is offline. I have no record of how often it was used while it ran, no measured cost, and no measure of time saved, so I am not going to guess at one.

What I would keep: the prescan and run split. Asking every question before anything is written made the old terminal scripts work in a browser without changing what they do.
