---
demo: /demos/reconciliation
title: "Three exports checked by hand every day became one short list"
date: "2026-07-24"
layout: ../../layouts/PostLayout.astro
description: "Our insurance team read the schedule, ledger and notes against each other by hand every day. I built an engine that does the reading and returns only the patients who disagree."
img_path: "/reconciliation.png"
architecture: "reconciliation"
img_alt: "Reconciliation engine: schedule, ledger, and clinical notes flowing into one exception list"
tag: "Backend"
tone: "blue"
stats:
  - value: "8.75 hours"
    label: "from the first commit, a design spec at 5:23 AM, to the first live revision on June 16"
    tone: "emerald"
  - value: "70 hours"
    label: "a week the insurance team spent reading three exports against each other by hand"
    tone: "amber"
  - value: "8 of 8"
    label: "patients a reviewer said were wrongly passed on one Rochester day, all flagged from v1.10.0"
    tone: "blue"
facts:
  - label: "Problem"
    value: "Our insurance team spent about 70 hours a week reading schedule, ledger and notes exports against each other."
  - label: "What I built"
    value: "A web app that reads a day's three exports and returns only patients whose billing, notes or doctor disagree."
  - label: "Who uses it"
    value: "Insurance reviewers at the implant offices on Denticon and the general practice on Eaglesoft."
  - label: "Outcome"
    value: "Flags 8 of 8 Rochester patients a reviewer said an earlier version had wrongly passed."
  - label: "Runs on"
    value: "A pure Python engine on Cloud Run with Firestore, joining every file on patient id."
  - label: "Built"
    value: "8.75 hours from the first commit at 5:23 AM to the first live revision on June 16, 2026."
---

## The problem

A dental visit leaves three records. The schedule says who came in. The production ledger says what was billed. The clinical notes say what happened in the chair. Our insurance team read all three side by side, every day, to confirm that each patient seen was documented and billed under the right doctor.

Across the team that came to about 70 hours a week of reading by hand. Most patients were fine. The ones that were not mattered: a crown written up and never billed is lost money, and a charge with no note behind it is an audit problem.

The group also runs two practice systems. Elmwood, the general practice, is on Eaglesoft. The implant offices are on Denticon. Same job, two very different files.

## What I built

Reconciliation, a web app. A reviewer picks the practice tab, uploads the day's schedule, ledger and notes, and gets summary cards back. Click a card and each flagged patient opens with their schedule, ledger and note rows, down to tooth, surface, provider and amount. Each flag has a Mark fixed button, every run is saved so a past day reopens in one click, and the report can go out by email.

Underneath is a pure Python engine with no network, no database and no clock. Sign in, upload, history and email all wrap it. [Open the drawing](/architecture/reconciliation).

## The sprint

The first commit, at 5:23 AM on June 16, was the design spec. The engine followed 13 minutes later with a golden test against a real day of exports. The web app went in at noon and the first live revision at 2:09 PM. Two days later Denticon got its own tab.

After that the work became a loop with the reviewers. They sent back patients the tool got wrong, I traced each one, fixed the reading, added a test and shipped. Some of those landed late: 12:00 AM on June 19, and <span class="egg" tabindex="0" data-egg="That commit was office policy rules from the team, written down the night they gave them to me. The rules have tests. The schedule that night did not.">4:28 AM on July 17</span>.

On July 24 a reviewer wrote down the rule for which doctor bills a no exam visit. v1.13.0 went live at 4:52 PM that day, two minutes after its commit.

By September 1 it was on v1.19.0. After that last round, one reviewer's August 12 Denticon day came back with zero flags.

## The hard parts

**Notes are written by people.** The ledger says which doctor billed each line, and the note has to agree. Notes name doctors by nickname, by first name, by initials, with "Dr" fused to the name and no space, and with typos. Two doctors share a last name, so a last name alone proves nothing. The registry maps every provider number to one dentist and all of their names, and matches within a spelling mistake or two:

```python
# engine/providers.py
if len(name) < 5:
    return False
maxd = 1 if len(name) < 8 else 2
return _lev(token, name, maxd) <= maxd
```

Names under five letters must match exactly, because too many ordinary words are <span class="egg" tabindex="0" data-egg="Levenshtein distance, with an early exit. The loop gives up as soon as every cell in a row is past the limit, so most words fail in two or three letters.">one edit away</span>. The engine also learned what is not evidence. "Intra/Extra Oral Exam:" is a hygiene screening heading, and "Next visit: exam" is a plan for another day. Both are stripped before it looks for a doctor exam.

**Bad input that looks like good data.** One Monday run showed 85 patients billed with no note. The patients were fine. The notes export had defaulted to the previous Friday. Now the engine compares the dates inside both files and warns on the report and in the email subject. Separately, Eaglesoft leaves line breaks in note text unquoted, so a long note split across rows and lost its bottom half, which is where doctors sign. The parser rejoins the rows. On one test day that cleared 4 false flags and cut provider mismatches from 21 to 13.

**A slash that means upper or lower.** At the implant offices a delivery code carries the arch in where its slash sits. DEL/P is the lower provisional and DELP/ the upper. The first rule read a template label as an answer of "both", so every single arch delivery flagged. Now the note's code, its upper or lower answer and the ledger's codes are compared arch to arch.

## What I said no to

**A model in the verdict.** A Gemini matcher that lines up each billed procedure with the note by tooth, surface and wording is built and stays out of the verdict. Every flag today comes from a rule a reviewer can read, and the terminology list for each practice is still waiting on their confirmation. When it goes in, it will sit on top of the deterministic checks.

**Matching on names.** Every file joins on patient id. The Eaglesoft notes export has no id column, so the engine reads the id off the end of the sort name. An appointment with no id goes to a person to confirm.

**Guessing past a bad file.** A missing column stops the run with an error that names it, and the wrong Denticon report gets an error that says which report to export. In a tool people use to sign off on billing, an error is the safer answer.

## Where it landed

Reviewers at both practices ran their real days through it from June through August, and their last round of notes shipped as v1.19.0 on September 1. One round listed eight Rochester patients the tool had wrongly passed, and v1.10.0 flags all eight.

I have not measured how often it runs now, or the time it saves. The 70 hours a week is the team's own count of the before, and I have no after number. The billing export for its project only switched on October 28, 2026, so there is no measured month of cost yet. The Gemini matcher is the open piece.

What I would keep: write each office rule into a test the day a reviewer says it, and keep the engine a pure function, so any flag can be replayed from the same three files.
