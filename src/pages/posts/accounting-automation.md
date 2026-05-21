---
title: "The dozen scripts that ate the controller's manual import work"
date: "2026-05-20"
layout: ../../layouts/PostLayout.astro
description: "The controller was hand-reformatting CSVs from five upstream systems every week. A dozen small Python scripts now do it, with a UX that respects how accountants work."
img_path: "/enterprise-data.svg"
img_alt: "Accounting automation pipeline — Denticon, MagicTouch, Paychex, banks into Google Sheets and QuickBooks"
tag: "Process"
tone: "amber"
stats:
  - value: "~400 hrs/yr"
    label: "of senior accounting time recovered"
    tone: "amber"
  - value: "6-8 h → 30 min"
    label: "weekly reformat workload"
    tone: "emerald"
  - value: "12"
    label: "small Python scripts replacing one platform"
    tone: "blue"
---

Garrett runs accounting for Hybridge. Every Monday he'd download CSVs from five different systems, open each one, rename columns, copy-paste rows, hand-tag deposit accounts, look up vendor names by check number. Repeat. Repeat. Repeat. An entire workday a week was disappearing into spreadsheet reformatting.

Nobody senses this kind of work is broken until they sit next to the person doing it.

## The five upstream systems

```
MagicTouch (DLCPM)  →  payments + production
Denticon            →  Buffalo location's PMS
Paychex             →  payroll, time-off exports
Bank (Buffalo)      →  AccountTransactionDetail CSV
Bank (Hybridge)     →  AccountTransactionDetail CSV
```

None of them speak each other's format. None of them export the columns the downstream sheets need. The bank CSV has a two-line preamble and a two-line trailer. Paychex encodes company name into the filename and department codes need a lookup table. Denticon and MagicTouch label the same payment type three different ways.

## What I built instead

A dozen small Python scripts. Each one is the verb for one upstream system. Each one is short enough to read in ten minutes.

```
AR_Aging.py                             receivables aging, multi-sheet Excel
Buffalo_Ramp_IIF_Reformat.py            IIF for QuickBooks
cashflow_import.py                      bank CSV → master cashflow Sheet
checks_import.py                        outstanding checks ledger
Denticon_Payment_Import_Buffalo.py      Denticon payments
Denticon_Production_Import_Buffalo.py   Denticon production
MT_Payments_Import.py                   MagicTouch payments
MT_Sales_Import.py                      MagicTouch sales
Paychex_Time_Off_Information_Cleanup.py payroll time-off
+ three reference Excel files
```

Garrett never runs a generic ETL command. He runs `python MT_Payments_Import.py` after he downloads the MagicTouch export, and a clean IIF appears in his Downloads folder. The mental model matches the calendar reality.

## Configuration that respects how the user actually works

Each script has the same shape: imports, then a config block, then the functions. The config sits at the top so Garrett can edit it himself without asking me.

```python
DEPOSIT_ACCOUNTS = {
    "credit card":     "Cardpointe Clearing",
    "check":           "ACH Check Clearing",
    "echeck":          "ACH Check Clearing",
    "ach":             "ACH Check Clearing",
    "direct deposit":  "ACH Check Clearing",
    "echecks/ach":     "ACH Check Clearing",
    "direct deposits": "ACH Check Clearing",
}
```

When MagicTouch invents a new deposit type label, Garrett opens the file and adds a line. No database migration. No deploy. No engineer.

## The interactive y/s/d prompt, because automation shouldn't be silent

I'd originally written the bank import as a one-pass loop that processes every matching file. Garrett pushed back. Half the time the glob picks up old downloads, partial files, test files from a vendor call. He wants to see each one and decide.

```python
for f in files:
    print(f"\nFile detected:\n{f}")
    choice = input("Process this file? (y = yes, s = skip, d = delete): ").strip()
    if choice == 'y': approved.append(f)
    elif choice == 's': pass
    elif choice == 'd': os.remove(f)
```

This is the kind of detail you only know if you watch the work get done. The script *could* be silent. The accountant doesn't *want* silent. Trust grows by showing each step.

## Retry with backoff, because Sheets API throttles

Long imports hit `APIError: Quota exceeded` two or three times mid-run. The decorator that wraps every Sheets call:

```python
def retry_with_backoff(retries=5, backoff_in_seconds=1):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for x in range(retries + 1):
                try: return func(*args, **kwargs)
                except APIError as e:
                    if x == retries: raise
                    time.sleep(backoff_in_seconds * (2 ** x))
        return wrapper
    return decorator
```

Garrett never sees the throttle. He sees a one-line "retrying in 4s" message and the run continues.

## By the numbers

<div class="stat-callout stat-amber">
  <div class="stat-value">~400 hrs/yr</div>
  <div class="stat-label">Of senior accounting time the controller stopped losing to manual CSV reformatting</div>
</div>

| | Before | After |
|---|---|---|
| Weekly accounting reformat workload | ~6-8 hours | ~30-45 minutes |
| Of which is actual work | All of it | Downloading files + answering y/s/d |
| Reformat errors per quarter | Occasional silent paste-wrong-column | Near zero (deterministic output) |
| Lines of code per script | 80-500 | Short enough to read in 10 min |

The pattern I keep coming back to: **most internal automation projects fail not because the engineering is bad but because the engineering builds a platform when the user wanted a tool.** A tool is a thing you keep in a drawer. A platform is a thing you log into. Tools are easier to trust.

Garrett doesn't run a server. He runs scripts. The right level of platformisation for one accountant doing weekly closes is "give him scripts he can read and edit." Anything heavier would have been a tax, not an asset.
