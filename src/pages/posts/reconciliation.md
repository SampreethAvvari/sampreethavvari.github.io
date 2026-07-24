---
title: "How I gave a three person insurance team 70 hours back every week"
date: "2026-07-24"
layout: ../../layouts/PostLayout.astro
description: "A three person insurance team at a multi office dental group spent about 70 hours a week cross checking three exports by hand to confirm every patient seen got documented and billed correctly. I built a deterministic engine that does the reading for them and hands back only the flagged patients. Shipped, live, and HIPAA safe by construction."
img_path: "/reconciliation.png"
img_alt: "Reconciliation engine: schedule, ledger, and clinical notes flowing into one exception list"
tag: "Backend"
tone: "blue"
stats:
  - value: "70 hrs/week"
    label: "of manual cross checking returned to a three person insurance team, over 3,600 hours a year"
    tone: "blue"
  - value: "2 systems, 1 engine"
    label: "Eaglesoft and Denticon exports run through the same reconciliation core"
    tone: "amber"
  - value: "200+ tests"
    label: "all on synthetic fixtures, no patient data in the repo ever"
    tone: "emerald"
---

Every evening in a dental office, after the last patient leaves, someone sits down with three reports and starts cross checking. Did every patient who came in today get billed? Does every charge have a clinical note behind it? Did the doctor who billed the exam actually do the exam? Was that suture removal written up, even though it was free?

At the dental group I work with, a multi office practice in upstate New York, this job took a three person insurance team most of their day, every day. Across the team it added up to about 70 hours a week. That is nearly two full time jobs spent reading the same three reports against each other, line by line, patient by patient.

I built a small web app that does the reading for them. Now they upload the day's files, wait a few seconds, and get back a short list: here are the eight patients out of 120 where something does not line up. Everyone else is fine, go home.

Seventy hours a week. Over 3,600 hours a year. For a tool that, at its heart, plays a very careful game of spot the difference.

## The problem, in plain words

A dental visit leaves three paper trails. The schedule says who was supposed to come in. The production ledger says what was billed. The clinical notes say what actually happened in the chair.

In theory these three always agree. In practice they drift. A hygienist forgets to write a note. A front desk posts a charge under the wrong doctor. A crown delivery gets documented but never billed, which is money quietly walking out the door. An insurance auditor asking about a charge with no note behind it is a much worse conversation.

None of these mistakes are dramatic on their own. The problem is finding them, because the only way is to compare everything against everything, and 99 percent of patients are perfectly fine. Humans are terrible at jobs like that. Software is great at them.

## Two systems, same underlying reality

The team exports three files from their practice management system each day, the same exports they were already printing and reading by hand: the schedule, the production ledger, and the clinical notes. There is an optional fourth, the perio charting report, which I will get to.

The complication is that the group runs two different practice systems across its offices, and the exports look nothing alike on disk. The general practice runs Eaglesoft: legacy exports, binary `.xls` then CSV, Windows `cp1252` encoding, and duplicate column headers (three different `start_time` columns in one file). The implant centers run Denticon: `.xlsx` with title and footer junk rows, merged cells, a header that is not on the first row, and a column name literally spelled `OIffice Name`. Same problem, two hostile file shapes. The app reads both: same screen, one tab per system, and every check adapts to whichever one you pick.

The second complication is HIPAA. Every one of those files is full of protected health information, so anything I built had to treat patient data as radioactive: never logged carelessly, never committed, never sent anywhere it should not go.

## A deterministic engine, then everything else wraps it

The single most important decision was to split the system into a pure reconciliation engine and a thin application shell around it.

```
engine/   pure Python. No network, no database, no clock, no UI.
          Three files in, one structured auditable result out.

app/      FastAPI. Auth, upload, dashboard, history, email, and the
          waiting AI clinical matcher. All of it wraps engine.reconcile(...).
```

The engine is the part that has to be correct, so I kept it free of side effects. No I/O, no randomness, no reading the wall clock. It even takes the "generated at" timestamp as a parameter instead of calling `now()`, so identical inputs produce byte identical output. That is what makes the result auditable: same three files, same answer, every count traceable back to specific source rows. The messy real world concerns (sessions, OAuth, uploads, email) all live in the shell, where they can be messy without threatening correctness.

The parsers follow two rules. Map columns by name rather than position, because positions drift between exports and names are more stable. And give each system its own adapter that validates the columns it needs and emits clean typed records, so once parsed, Eaglesoft and Denticon rows are indistinguishable to the rest of the system. A missing required column is a loud, specific error, never a silently wrong answer. In a tool people use to sign off on money and compliance, "wrong but confident" is the worst possible failure.

Everything joins on the patient ID number, never the name, so two patients named Michael Smith can never get mixed up. The Eaglesoft notes file has no ID column at all, but its `sort_name` field carries the ID as trailing digits on the name string, so the matcher recovers the key from there. When an ID cannot be lined up, the system attempts a normalized name match and tags the patient as low confidence, needs human review. It never silently guesses. "I am not sure, look at this one" is always a safe answer.

## What it checks

The core verdict starts with two facts per scheduled patient: `has_money` (at least one real production charge, excluding credits, adjustments, and courtesy codes) and `has_note` (at least one non deleted clinical note).

| Bucket | Condition | What it means |
|---|---|---|
| verified | money and note | Done and documented, no review needed |
| note_no_money | note, no production | Documented but nothing posted (lost revenue) |
| money_no_note | production, no note | Posted but undocumented (compliance risk) |
| neither | no money, no note | No show or missed |
| review_non_scheduled | production for someone not on the schedule | Walk in or mispost |
| review_low_confidence | matched only by name | Needs a human to confirm |

The green `verified` bucket is the whole point: most of the schedule lands there automatically and disappears from the team's workload. But the check stack has grown well past those two booleans, one team request at a time:

**The doctor who billed must be the doctor in the note.** The ledger says which provider billed each line. The app then looks for that doctor in the note text. If Dr. A billed the exam but the note says Dr. B did it, that is a flag, and it is one of the most valuable flags the tool produces, because billing under the wrong provider is the kind of error that is nearly invisible by hand.

**"No exam" codes must tell a consistent story.** When the doctor does not come by during a hygiene visit, the office bills a special no exam code. The note should say so too. If the ledger says no exam but the note describes one, flag. If the note says no exam but the code was never billed, flag. The team also asked for one more twist: on those visits the code should be billed under the patient's assigned doctor, which the note lists as the preferred provider. The app checks that match, and if the note forgot to list a preferred provider at all, it says exactly that.

**The codes a note claims must be in the ledger.** At the implant offices, notes often list the codes that were billed. The app reads those lists and checks every one against the ledger. This is how it catches things like a note listing three x ray codes when only two were billed, or an upper arch code billed when the treatment plan clearly says lower. It even knows which full arch codes are upper versus lower, so swapping the two gets called out by name.

**Perio charting must have proof.** If the ledger bills perio charting, that patient has to appear in the perio charting export. Billed measurements with no chart behind them: flag.

**Office policy is built in.** A few codes never need a note, like x rays taken at another office. A zero dollar suture removal still needs a note, because the patient was in the chair and that has to be documented. A patient walking in to buy a water flosser does not need a chart note at all. A generic "patient medical history updated" entry never counts as documentation of a visit, because it says nothing about what happened. Each of these rules came from a conversation with the team, and each one is written down in the code, in tests, where it cannot quietly drift.

**Deliveries get their own card.** The team wanted visibility on every crown cement, bridge delivery, retainer and night guard handoff, so those codes show up as their own count on the dashboard. One click shows exactly those patients.

<div class="stat-callout stat-amber">
  <div class="stat-value">fail loud, never guess</div>
  <div class="stat-label">A missing column errors out. An uncertain match gets flagged for a human. In a financial and clinical tool, a confident wrong answer is far worse than an honest "look at this one."</div>
</div>

## The hard part: notes are written by humans

Here is the thing that makes this more interesting than a spreadsheet comparison. Clinical notes are free text, typed fast, by different people, with their own habits.

The same doctor shows up in notes as "Dr. Kenyon", "Dr Kyle", "drkyle" with no space, or by his initials. One dentist is "Dr. Missy" in every note but Melissa in the payroll system. Two doctors share a last name, so last names alone prove nothing. People typo: "Kenyan" for Kenyon, "Melisa" for Melissa. The app handles all of it. Nicknames are mapped, "Dr" stuck to a name still parses, and names match within a spelling mistake or two, with short names kept strict so the word "than" can never match a Dr. Khan.

It also learned what NOT to read as evidence. Every hygiene note has template lines like "Intra/Extra Oral Exam: WNL". That is a routine screening checkbox, not a doctor exam, and early versions of the tool got fooled by it. "Next visit: exam and cleaning" is a plan for the future, not proof of today. And "Preferred Doctor: Dr. Comfort" names the patient's assigned dentist, not whoever was in the room, a distinction that, once handled, immediately caught a real case of an exam billed under one doctor while the note said a different doctor performed it.

Every one of those lessons came from a real flagged patient the team sent back with a note saying "this one is wrong." I would trace it, fix the reading, add a test, and redeploy the same day. The false flag rate fell week by week, and the flags that remain are the kind a human reviewer would also stop on.

## Protecting against bad inputs

The scariest failure of a tool like this is being confidently wrong because the input was wrong. Two protections came out of real incidents.

One Monday the report claimed 85 patients had money but no notes. Nothing was wrong with the patients. The notes export had defaulted to the previous Friday. The engine was comparing Monday's charges against Friday's notes. Now the app checks the dates inside every file, and if the notes file covers a different day than the ledger, a large warning appears on the report and in the email subject telling the team exactly which file to re export.

The second was sneakier. The practice system exports notes with line breaks that split one long note across several rows of the file. The tool used to lose the bottom half of long notes, which is exactly where doctors sign. The app now stitches split notes back together, which recovered signatures, cleared a batch of false flags, and made the full note readable in the app.

## The shell: dashboard, history, email

Around the engine sits a FastAPI app on Cloud Run, with Firestore holding users, recipients, saved reports, and config. The dashboard has a source tab, then upload the files, reconcile, and read color coded summary cards; click any card and a popup shows every patient's schedule, ledger, and note rows down to tooth, surface, provider, dollar amount, and full note text. Every run is saved and searchable, so last Tuesday is always one click away. Each flagged patient has a mark as fixed button, so the list works like a checklist: open the report, work the flags, mark them done.

Any run can be emailed to the team, and the email is built from the same logic as the dashboard, so the two never disagree. Email needs no IT involvement: an admin clicks Connect Gmail once, and the app sends reports as that user through a stored refresh token.

## Privacy, because this is health data

Everything about patients is protected health information, so the boring parts got done first. The app lives on Google Cloud under a healthcare agreement. Sign in is Google only and restricted to the company's two email domains plus an admin managed allowlist, so a stray Gmail account cannot get in. Uploaded files are processed and immediately deleted. Matching runs on ID numbers, and no patient data ever touches the code repository: `.gitignore` blocks every `.xls`, `.xlsx`, `.csv`, and `.pdf`, and real exports stay on local machines only. The 200+ tests run against synthetic fixtures generated at runtime that reproduce every real world quirk (duplicate headers, the trailing ID `sort_name`, deleted notes, credits, split notes, fuzzy name patients) without a single byte of PHI, so CI runs entirely clean.

## Where the AI is, honestly

People assume a tool like this is a language model reading charts. It mostly is not, on purpose. The checks are deterministic rules: the same files produce the same answer every time, every rule traces back to a decision the insurance team made, and there are over 200 automated tests pinning the behavior down. When a flag shows up, the team can see exactly why. Auditability beats magic here.

AI shows up in two places. It was my pair programmer throughout, which is a big part of why every fix the team requested could ship the same day. And there is a clinical matching layer built and waiting, using a language model on Vertex AI to match each billed procedure to the clinical language in the note, so it knows "cement crown" and "delivered crown" are the same event. It is deliberately not wired into the live verdict yet. Clinical matching is high stakes, and the two practices document differently (per procedure at the general practice, long consult narratives at the implant centers). Turning it on is gated on finalizing the terminology lists with each practice's billing lead, and it will sit on top of the deterministic checks, not replace them.

## What it adds up to

A three person team used to spend around 70 hours a week being human spreadsheet comparators. Now the daily review is uploading files and reading roughly a dozen flags, most of which are real. The hours went back into the work that actually needs people: calling insurers, chasing claims, talking to patients.

The lesson I keep coming back to: the software is not clever. It is thorough. It reads every line, every day, without getting bored, and it learned the office's handwriting one correction at a time. Sometimes the best thing you can build is a very patient reader.
