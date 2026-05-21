---
title: "The dozen scripts that ate the controller's manual import work"
date: "2026-05-20"
layout: ../../layouts/PostLayout.astro
description: "Hybridge's controller was hand-reformatting CSVs from five upstream systems every week. A suite of small, well-bounded Python scripts now does it, with retry/backoff against Google Sheets and a UX that respects the way an accountant actually works."
img_path: "/enterprise-data.svg"
img_alt: "Accounting automation pipeline — Denticon, MagicTouch, Paychex, banks into Google Sheets and QuickBooks"
---

## Situation

Garrett runs accounting for Hybridge. Every week, he was opening exports from five systems and hand-reformatting them into the shape QuickBooks and our internal cashflow tracker need. The list of upstream sources, none of which speak each other's format:

- **MagicTouch (DLCPM)** — the dental practice management system. Produces a CSV of payments and a separate CSV of sales/production. Format is wide, account names are inconsistent across rows, and the cash account the payment lands in depends on the payment type (credit card vs ACH vs check, with seven different sub-labels for things that map to two clearing accounts).
- **Denticon** — the practice management system used at the Buffalo location. Different CSV shape from MagicTouch entirely.
- **Paychex** — payroll exports come in as `Time-Off-Information-*.xlsx` per company. Company name is encoded into the filename; departments are encoded as one-character codes that need a reference table to expand.
- **The bank** — `AccountTransactionDetail*.csv` exports for two accounts (Buffalo, Hybridge). One file has a two-line preamble before headers and a two-line trailer. Debit and Credit are separate columns with dollar signs and commas.
- **Outstanding-checks ledger** — already in Google Sheets, two tabs (one per account), needs to be joined against bank transactions to mark cleared checks.

The work each week looked like this: download the files, open each one, manually rename columns, copy and paste into the right destination sheet, hand-tag deposit accounts by reading the description column, look up the outstanding check by check number, paste the vendor name into the cashflow row. Repeat. Repeat. Repeat.

It's the kind of work that consumes an entire workday a week and that nobody senses is broken until they sit next to the person doing it.

## Task

Replace the manual reformat-and-paste loop with a small suite of Python scripts. Constraints from Garrett:

- He keeps running them on his Windows machine. No cloud-only solution. (The bank doesn't have an API; the export step is unavoidably local.)
- The scripts have to be tolerant of the messy reality of accounting files: malformed CSVs, partial downloads, the same file present in three slightly different versions in his Downloads folder.
- They have to write to specific Google Sheets with locked tab names and column orders, because the reports that flow downstream from those sheets (cashflow projection, AR aging report, payroll summary) are already wired to them.
- They should be cheap to modify. Reference data (account mappings, platinum customer lists, the deposit-type-to-clearing-account map) should live near the top of each file, in plain Python, editable by Garrett directly.

So: not a generic ETL platform. A purpose-built kit, each script a different verb against a different upstream system, all writing into the same downstream surface.

## Action

### Scripts as verbs, one per upstream system

The suite is twelve files. Naming follows the pattern `{Upstream}_{Direction}_{Optional Location}.py`:

```
AR_Aging.py                              receivables aging from a CSV
                                         platinum customer list + multi-sheet Excel
Buffalo_Ramp_IIF_Reformat.py             Ramp / GRB Operating IIF for QuickBooks
                                         account → TRNS-type mapping
cashflow_import.py                       bank CSV → master cashflow Google Sheet
                                         outstanding-check lookup, OAuth + retries
checks_import.py                         standalone outstanding-checks ledger update
Denticon_Payment_Import_Buffalo.py       Denticon payments → bank/clearing accounts
Denticon_Production_Import_Buffalo.py    Denticon production rows → revenue ledger
MT_Payments_Import.py                    MagicTouch payments → QuickBooks IIF
                                         deposit-type-to-clearing-account map
MT_Sales_Import.py                       MagicTouch sales/production → QuickBooks IIF
Paychex_Time_Off_Information_Cleanup.py  payroll time-off → cleaned Excel
                                         per-company filename parsing + dept lookup
ach_matcher.xlsx                         reference: ACH descriptor → vendor name
Cashflow_matcher.xlsx                    reference: cashflow categorisation rules
Employee Department Reference.xlsx       reference: dept code → dept name
```

The split is on system boundaries, not on internal architecture. Garrett never runs a generic ETL command. He runs `python MT_Payments_Import.py` after he downloads the MagicTouch export, and a freshly cleaned IIF appears in his Downloads folder. The mental model matches the calendar reality.

### Configuration that respects the way an accountant works

The MagicTouch payments script needs to know which clearing account each deposit type maps to. The naïve version of that is a database table. The right version of that for Garrett is:

```python
# MT_Payments_Import.py
DEPOSIT_ACCOUNTS = {
    "credit card":      "Cardpointe Clearing",
    "check":            "ACH Check Clearing",
    "echeck":           "ACH Check Clearing",
    "ach":              "ACH Check Clearing",
    "direct deposit":   "ACH Check Clearing",
    "echecks/ach":      "ACH Check Clearing",
    "direct deposits":  "ACH Check Clearing",
}

CASH_ACCOUNT_OPTIONS = [
    "Cardpointe Clearing",
    "ACH Check Clearing",
    "Global Payments Clearing",
    "360 Payments Clearing",
    "1003 - LAB GRB Operating",
]
```

That's a Python dict at the top of the file. If a new deposit type appears, Garrett opens the file, adds a line, saves. No database migration. No deploy step. Zero engineering involvement. The script is, in a real sense, configuration for a workflow he already understands.

The QuickBooks IIF reformat for Ramp uses the same idiom:

```python
# Buffalo_Ramp_IIF_Reformat.py
ACCOUNT_MAPPING = {
    "GRB Operating - HISR":   "CHECK",
    "Ramp Card":              "CREDIT CARD",
    "Accounts Payable - HISR": "BILL",
}
```

The bank account number to entity mapping in the cashflow script:

```python
# cashflow_import.py
ACCOUNT_MAPPING = {
    "4184": "Buffalo",
    "8128": "Hybridge",
}
```

Each mapping is small, near the code that uses it, editable by a non-engineer. That's the whole "configuration as code, near the code" pattern, applied to a finance team instead of an SRE team.

### The interactive UX, because accountants don't trust silent automation

The bank export step doesn't produce one file. It produces all files matching a glob:

```python
# cashflow_import.py
def get_input_csv_paths():
    """
    Returns a list of files that the user approves for processing.
    Allows skipping or deleting files.
    """
    files = glob.glob(r"C:\Users\<user>\Downloads\AccountTransactionDetail*.csv")
    if not files:
        raise FileNotFoundError("No AccountTransactionDetail CSV file found in Downloads.")

    approved_files = []
    for f in files:
        print(f"\nFile detected:\n{f}")
        while True:
            choice = input("Process this file? (y = yes, s = skip, d = delete): ").strip().lower()
            if choice == 'y':
                approved_files.append(f)
                break
            elif choice == 's':
                break
            elif choice == 'd':
                os.remove(f)
                break
            else:
                print("Please enter y, s, or d.")
    return approved_files
```

I'd originally written this as a single-pass loop that processes every matching file. Garrett pushed back: half the time the glob picks up old downloads from previous weeks, partial downloads where the browser cancelled, or test files from a vendor call. He wants to see each file's path and decide y/s/d.

This is the kind of detail you only know if you watch the work get done. The script *could* be silent. The accountant doesn't *want* silent. Trust grows by showing each step.

### Retry with backoff, because Sheets is flaky

Google Sheets and Drive APIs throttle. A long cashflow import will hit `APIError` ("Quota exceeded for write requests") two or three times mid-run if you don't back off. The decorator that wraps every Sheets/Drive call:

```python
def retry_with_backoff(
    retries=5,
    backoff_in_seconds=1,
    exceptions=(HttpError, ConnectionError, APIError),
):
    def decorator_retry(func):
        @functools.wraps(func)
        def wrapper_retry(*args, **kwargs):
            x = 0
            while True:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    x += 1
                    if x > retries:
                        print(f"Max retries exceeded for function: {func.__name__}")
                        raise e
                    sleep = backoff_in_seconds * (2 ** (x - 1))
                    print(f"{func.__name__} failed with '{e.__class__.__name__}'. Retrying in {sleep:.1f} seconds.")
                    time.sleep(sleep)
        return wrapper_retry
    return decorator_retry
```

Exponential backoff up to five retries. The decorator wraps the read-tab, append-row, batch-update calls. Garrett never sees the throttle; he sees a one-line "retrying in 4s" message in the terminal and then the run continues.

### Reformat that survives malformed exports

The bank CSV has a two-line preamble, a two-line trailer, dollar signs and commas in the amount columns, and inconsistent date formats. The reformat function tries the most common shape first and falls back if it gets a `ParserError`:

```python
# cashflow_import.py
def reformat_transaction_df(input_path):
    try:
        try:
            df = pd.read_csv(input_path, skiprows=2, encoding='utf-8-sig')
        except pd.errors.ParserError:
            df = pd.read_csv(input_path, skiprows=2, delimiter='\t', encoding='utf-8-sig')

        df = df[:-2]   # drop trailer
        df.columns = [col.strip().replace('﻿', '') for col in df.columns]
        df = df.drop(columns=["Account Type", "Balance"], errors='ignore')

        if "Account Number" in df.columns:
            df["Account Number"] = df["Account Number"].astype(str).str.lstrip("xX")

        if "Date" in df.columns:
            df["Date"] = pd.to_datetime(df["Date"], format="%m/%d/%Y", errors='coerce')
            df["Month"] = df["Date"].dt.strftime("%B")
            df["Year"]  = df["Date"].dt.strftime("%Y")

        for col in ["Debit", "Credit"]:
            if col in df.columns:
                df[col] = (
                    df[col].astype(str)
                    .str.replace("$", "", regex=False)
                    .str.replace(",", "", regex=False)
                    .str.strip()
                )
                df[col] = pd.to_numeric(df[col], errors='coerce')

        if "Debit" in df.columns and "Credit" in df.columns:
            df["Credit"] = df["Credit"].fillna(0) + df["Debit"].fillna(0).mul(-1)
        df = df.drop(columns=["Debit"], errors='ignore')
        df = df.rename(columns={"Credit": "Amount"})

        if "Amount" in df.columns:
            df["Amount"] = df["Amount"].round(2)
        if "Date" in df.columns:
            df = df.sort_values(by="Date", ascending=True)

        return df
    except Exception as e:
        print(f"Error during reformatting: {e}")
        return pd.DataFrame()
```

That's not glamorous code. It's the right code. Half a dozen real exports have died on each of those steps at some point. The function survives them all and returns an empty DataFrame if something genuinely catastrophic happens, so the caller can decide whether to abort the whole run or skip this one file.

### The outstanding-check join

A check clears the bank a few days after it's written. The bank export shows the check by check number; the outstanding-checks Google Sheet has vendor name keyed to check number. Joining them turns "$425.00 - CHECK 102341" into "$425.00 to Henry Schein for May supplies":

```python
# cashflow_import.py
def map_check_to_outstanding(df, buffalo_df, hybridge_df):
    buffalo_df["Ck #"]  = buffalo_df["Ck #"].astype(str).str.replace(".0", "", regex=False).str.zfill(6)
    hybridge_df["Ck #"] = hybridge_df["Ck #"].astype(str).str.replace(".0", "", regex=False).str.zfill(6)
    buffalo_dict  = buffalo_df.set_index("Ck #")["Vendor"].to_dict()
    hybridge_dict = hybridge_df.set_index("Ck #")["Vendor"].to_dict()
    # ... entity-aware lookup applied to each bank row
```

Two details worth pulling out of that snippet. First, `.str.replace(".0", "")` exists because gspread sometimes pulls integer check numbers back as floats. Defensive. Second, `.str.zfill(6)` because bank exports zero-pad to 6 digits and the source sheet doesn't. Same number, six different string representations across this codebase. The five lines of normalisation save Garrett an hour of "why isn't this matching" every week.

## Result

Twelve scripts, one per upstream verb. Each is between 80 and 500 lines of Python. None is generalised beyond what the workflow actually needs. Together they replace the manual import-reformat-paste loop that used to fill a workday a week.

What changed in measurable terms:

```
Weekly accounting reformat workload (before)    ~6-8 hours per week, hand-reformatting
Weekly accounting reformat workload (after)     ~30-45 minutes, mostly downloading
                                                 files and answering y/s/d prompts
Reformatting errors (before)                    occasional pasted-wrong-column kind
                                                 of mistake, hard to catch downstream
Reformatting errors (after)                     near zero — formats are produced
                                                 deterministically per script
Recurring annual hours saved across             ~400 hours of senior accounting time
the suite                                       that flows back into reconciliation
                                                 and forecasting work
```

The "near zero" is worth a sentence. Manual reformat workflows fail silently. A column gets pasted into the wrong position; the resulting cashflow line is off by a category; the bottom-line number is still right, so nobody catches it for a quarter. Deterministic script output is auditable: same input, same output, every run. When something does go wrong, it goes wrong loud, in the terminal, on the line where the parse failed.

### What this is, and what it isn't

It is a kit of small focused scripts, each one short enough to read in ten minutes, configured through Python dicts at the top of the file, run locally by the accountant on his Windows machine.

It is not an n8n graph or an Airflow DAG or a "modern data stack." Garrett doesn't run a server. He runs scripts. The right level of platformisation for one accountant doing weekly closes is "give him scripts he can read and edit." Anything heavier would have been a tax, not an asset.

The pattern I keep coming back to: most internal automation projects fail not because the engineering is bad but because the engineering builds a platform when the user wanted a tool. A tool is a thing you keep in a drawer. A platform is a thing you log into. Tools are easier to trust.

### What's next

The current weak link is reference data drift. The Cashflow_matcher.xlsx and ach_matcher.xlsx files are owned by Garrett, edited by hand, and read by every script that needs categorisation. A typo in a category name silently miscategorises every matching row until somebody runs the downstream report. Two paths from here, both small:

1. A validation step at script start that checks the reference files against a known-good schema and raises if there's drift.
2. A simple internal web form to edit the reference files with autocomplete on known categories. Lower error surface, same workflow.

Both are on the list. Neither is urgent. The current suite has been running long enough that the categorisation files are stable.

The line I draw between "this is the right amount of engineering" and "this is over-engineering" sits roughly where the user's mental model sits. Garrett models his week as "I run these scripts after downloading these files." A web app or a workflow engine would have moved that model out of his head and into something he had to be trained on. Twelve focused scripts kept the model where it already was, and just made the parts of it that were boring stop being his job.
