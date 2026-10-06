---
title: "How I automated a finance forecast without letting anything touch the math"
date: "2026-10-03"
layout: ../../layouts/PostLayout.astro
description: "Every morning the VP of Finance pasted two lab exports into his Excel forecast, recalculated, and sent it by hand. I rebuilt it as a daily pipeline that ports his model exactly, refuses to tune itself, keeps Gemini away from every number, and never holds a credential that can read his inbox."
img_path: "/daily-sales-report.png"
img_alt: "Daily Sales Report pipeline: two lab exports in, a three month forecast with bands out every weekday morning"
tag: "MLOps"
tone: "emerald"
stats:
  - value: "15 + 6"
    label: "acceptance values and edge cases from the spec, pinned on every commit"
    tone: "emerald"
  - value: "108"
    label: "fitted constants ported exactly, with no code path that can rewrite them"
    tone: "blue"
  - value: "0.62 points"
    label: "how much worse the best in sample setting did on unseen months, so nothing auto tunes"
    tone: "amber"
---

Every morning, the VP of Finance at Hybridge ran the same routine. Two reports from the dental lab's case system landed in his inbox. He pasted the invoice export at cell A4 on one tab of a 14 tab workbook, pasted the new starts report onto another, recalculated, checked that the data quality block read ALL CHECKS PASS, and sent the summary page.

The forecast inside that workbook was careful work. He built it, measured it, and wrote down every place it could break. The weak part was the routine, which needed a person at a keyboard every morning.

Hybridge is a multi office dental implant practice in upstate New York that runs its own dental lab, and I am its only AI engineer. I rebuilt the routine as a pipeline that does the morning by itself. This post is about what I changed, and mostly about what I would not let anything change, including me.

## What the spreadsheet forecast

The model projects invoiced lab revenue and new arch starts, a count of the new arches the lab begins, for the current month and the next two.

For the current month it blends two guesses. One is pace: what has been invoiced so far, scaled up by how far through the month we are, where a busy Monday counts for more of the month than a quiet Friday. The other is an anchor built from what the last few closed months did per business day. Early in the month the anchor carries most of the weight. On the last business day the projection is simply the actual.

Every projection has a band, the part people misread most. It is sized so that, looking back over the months the model was tested on, the real number landed inside it about 68 percent of the time, roughly two months out of three. One time in three the real number should land outside, and a band that never misses is too wide to tell you anything.

The 68 comes from one standard deviation on a bell curve, but the model's errors were not bell shaped, so the VP measured them and took the width that covered 68 percent directly. The band tightens as the current month fills in and stays wider for the months further out.

## The handoff, and the job

He handed it over on 25 August 2026: a specification of about 700 lines, a refit script, and the workbook. Two things in the spec shaped everything I built.

The first was 15 acceptance values, exact outputs for one known day of data, and 6 edge cases, awkward days like a year boundary that must not break anything. Above them sat one line: "If a rebuild does not reproduce them, the rebuild is wrong, not the spec."

The second was a section on traps. Two bugs in his own Excel version had returned silently wrong numbers, and only an independent reimplementation caught them. That told me what to be afraid of. Not a crash. A plausible number that is a little wrong, sent out every morning.

So the job was narrow: take the person out of the morning and keep the model exactly as it was. The exports carry patient names, providers and addresses, so the parsers drop the patient and practice details before anything reaches the warehouse, and a test enforces it. The reports also arrive in the VP's own mailbox, which became the hardest design question.

## The model is not up for negotiation

That line is in bold at the top of the README, and the code is built to keep it true.

The engine is pure Python with no file access, no network and no clock. The as of date is always passed in, so the same inputs give the same numbers and the acceptance suite runs on every commit and blocks the deploy when it fails. The first commit in the repo reproduces all 15 values. The 108 fitted constants live in versioned sets, and the suite pins the original set by name.

I made three deliberate departures from the spec's reference code, each to satisfy the spec itself. My favorite came from feeding the engine the workbook's daily grid, which is prebuilt through 2027. A padded month of zeros in the trailing window computes cleanly and quietly drags the projection toward zero. The engine now raises `InsufficientHistory` instead of answering.

### Why it does not tune itself

The obvious move is to point an optimizer at the model. The VP had already measured what that costs. Across a grid of 1,280 parameter combinations, the best one scored better on the data it was tuned on and did 0.62 points worse than the shipped settings on months it had not seen.

The reason is sample size. Three hundred days of forecasts sounds like plenty. It is about fifteen months, because every day inside a month is graded against the same final number. The spec's rule is that a 0.3 point improvement should never be treated as real. So nothing in the pipeline can write a constant. A refit script is meant to run once a year, propose changes with the statistic behind each one, and leave the decision to a human.

### The better model I did not ship

I got to test that rule on my own work. The spec ties arch starts to revenue with a whole month lag, so an arch started on the first business day of a month and one started on the last count as the same input, even though their invoices land about a month apart. Measured on the aggregates, revenue from an arch spreads out over time, centered about 20 business days after the start. I built a version that attaches each start to the days that actually earn from it.

Over eight scorable months, it improved next month's revenue error by 0.28 points and made the current month worse by about the same. Neither cleared the noise floor, and it moved the projections a lot for a gain that small. So it shipped behind a switch, not as the default. When I reran it at the end of September with two more closed months, the gain was gone.

```python
# packages/engine/dsr_engine/params.py, lines 190 to 194
#: The mechanism it implements is real and separately evidenced: see
#: ``dsr_engine.maturation``. What is missing is the sample to show it helps.
#: Revisit when there are 18+ scorable months, which is the same bar spec
#: section 11.6 sets for the band tables. Switching is one line here.
CURRENT = V2026_07
```

<div class="stat-callout stat-amber">
  <div class="stat-value">a switch, not a default</div>
  <div class="stat-label">The better idea is in the code, tested, and one line away. It stays off until there are enough months to show it helps. Feeling right is not evidence.</div>
</div>

## Gemini writes the paragraph, code checks every number

The daily run has seven stages, and only one of them, narrate, uses a language model. Gemini on Vertex AI, which our Google Cloud business associate agreement covers, writes a few sentences of commentary.

It never sees a row of data. One function builds its only payload of finished projections, bands and check results, and a test scans it for every row level field name. The prompt says not to invent numbers, but I do not trust a prompt with that, so code checks that every number in the commentary appears in the payload, in any rounding a sentence might reasonably use:

```python
# packages/pipeline/dsr_pipeline/narrative.py, lines 227 to 235
    allowed = _allowed_numbers(payload)
    for m in _NUM.finditer(text):
        token = m.group().rstrip(".")
        if token in allowed or token.replace(",", "") in allowed:
            continue
        # Tolerate a bare year and small ordinals.
        if re.fullmatch(r"(19|20)\d\d", token):
            continue
        return "states a number not present in the inputs: %s" % token
```

The same guard rejects a short list of claims. The spec tested whether starts lead revenue by a month and found it was not significant, so "starts lead" or "leading indicator" gets the paragraph thrown out, and so does anything that recommends retuning the model. It even rejects dash characters, a rule I hold myself to.

If Gemini errors, times out, or fails the guard, a deterministic template written from the same inputs ships instead, and the run records which one was used. The report never depends on the model being up, or being right.

<div class="stat-callout stat-emerald">
  <div class="stat-value">the template is the floor</div>
  <div class="stat-label">Gemini can make the paragraph read better. It cannot make the report late, and it cannot put a number on the page that the engine did not compute.</div>
</div>

## Reading the lab reports without reading his inbox

My first design used the Gmail API with domain wide delegation, a read only scope, and a search pinned to the lab's sender and report subjects. I did not like it. Delegation is granted to an identity, not to a mailbox. The pinned search was a promise my code made, not a limit the permissions enforced, and that identity could have read every mailbox in the company.

So I turned it around. A small Apps Script runs inside the VP's own Google account. Every 15 minutes it finds the lab report emails, asks Gmail for headers and the attachment layout only, and copies matching attachments into a landing bucket where his account can create objects and do nothing else.

```javascript
// mailbridge/Code.gs, lines 27 to 31
// Ask Gmail for headers and the attachment layout only, never message bodies.
const PART = 'filename,mimeType,body/attachmentId';
const FIELDS =
  'id,internalDate,payload(headers,' + PART +
  ',parts(' + PART + ',parts(' + PART + ',parts(' + PART + '))))';
```

The same script emails the finished report once, from his own account. Nothing in the project holds a credential that can read a mailbox.

The reading rules came from watching the reports arrive. The invoice export lands just after 6 a.m., while the starts reports are not emailed until 7 at night. So a morning is read once its invoice export lands, and a file is deleted only after a run that read it finishes. The job runs every 15 minutes on weekday mornings with no retries, because the schedule is the retry. A morning is read by about 6:35 at the latest.

## What broke

### The number that said Saved

One number in the report does not come from the feeds. When a month closes, someone types its new starts figure from the P&L into a form on the dashboard. One of the nine data quality checks stays red until it is entered, and a failed check holds the report. So losing that number does not make the report worse. It stops it.

In mid September that check kept going red for a month that had already been entered. The early trial mode held the figure in one container's memory, and the service had no minimum instances, so Cloud Run scaled it to zero when idle and the next container started without it. Meanwhile the form had said "Saved", and the note under it said every change was recorded with who made it and when. Neither was true.

The figure now lives in BigQuery, where a correction supersedes the old row in one transaction instead of overwriting it. And the form stopped lying:

```python
# packages/webapp/dsr_web/app.py, lines 580 to 586
    except Exception as exc:
        # Saying "Saved" over a write that did not land is how a figure goes
        # missing for a month without anyone noticing.
        return RedirectResponse(
            "/inputs?failed=%s" % quote_plus("%s: %s" % (type(exc).__name__, exc)),
            status_code=303,
        )
```

Fixing it turned up a second bug: the save method the app called was not defined anywhere, so the first save in cloud mode would have crashed.

### Filenames are input too

A security review flagged a filename reaching a filesystem path. There were two such places, not one: the browser upload and the email attachment name. Joining a directory with `../../x` climbs out of it, and on Windows joining it with `C:/x` throws the directory away. Filenames are now stripped to a safe character set, and a second function refuses any resolved path outside the scratch directory.

The same review found reflected XSS in the error panel. Fixing it, I went looking for the same class of bug and found one in my own design. Gemini's commentary went into the page raw. The guard checks numbers and claims. It says nothing about markup.

```python
# packages/pipeline/dsr_pipeline/render.py, lines 452 to 455
            # Gemini wrote this. The guard in narrative.py rejects invented
            # numbers and disallowed claims, but it does not stop markup,
            # so the text is escaped at the point it becomes HTML.
            FONT, INK, html.escape(narrative or ""),
```

<div class="aside">
<strong>The pattern under both.</strong> I trusted a success signal over the thing it described: a Saved message over a lost write, and a paragraph that passed one check treated as safe for another.
</div>

## Where it landed

The pipeline has run in production since 25 September 2026. The repo has 21 commits over three weeks, and about 290 tests, up from 31 in the first commit.

Each weekday morning the report reaches the VP from his own account. The dashboard sits behind IAP and shows today's report, every past run, each run's steps, and a Projections tab that shows what the report said about a month day by day, then scores it once the month closes. The dashboard and the email read the same run record, so they cannot disagree.

The spec measured the model's current month revenue error falling from about 4.2 percent early in the month to 1.5 percent late. My job was never to beat that. It was to make sure the thing running at six in the morning is the same model that earned it.

The most useful skill on this project was restraint. I wrote a better lag model and left it off. I put a language model on the page and fenced it away from every number. I could have read a mailbox and instead chose a design where nothing can. None of that shows up in a demo. It shows up a year from now, when the forecast is still the one the VP built, checked against his numbers on every change, and nobody has to paste anything to get it.
