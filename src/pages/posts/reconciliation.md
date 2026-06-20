---
title: "Reconciling a dental day without opening the spreadsheets"
date: "2026-06-20"
layout: ../../layouts/PostLayout.astro
description: "Two front-desk staff spent about three hours each every day cross-checking three exports by hand to confirm every patient seen got documented and billed. I built a deterministic engine that does the cross-check and shows them only the flagged patients. Shipped, live, and HIPAA-safe by construction."
img_path: "/reconciliation.png"
img_alt: "Reconciliation engine: schedule, ledger, and clinical notes flowing into one exception list"
tag: "Backend"
tone: "blue"
stats:
  - value: "6 hrs → minutes"
    label: "daily manual cross-checking across three spreadsheets, now an exception review"
    tone: "blue"
  - value: "2 systems, 1 engine"
    label: "Eaglesoft and Denticon exports run through the same reconciliation core"
    tone: "amber"
  - value: "150+ tests"
    label: "all on synthetic fixtures, no patient data in the repo ever"
    tone: "emerald"
---

Every day, each location in the group sees roughly 40 patients. For the books to be right and the chart to be defensible, every one of those encounters has to line up across three separate documents: the schedule (who was supposed to be seen), the production ledger (what got charged), and the clinical notes (what got documented). When the three agree, there is nothing to do. The whole job is the disagreements.

Two front-office staff were finding those disagreements by hand, eyeballing three spreadsheets side by side. It took each of them about three hours a day, every day, forever. And because it was manual, it failed exactly where mistakes are most expensive: a patient treated and documented but never billed (lost revenue), or billed with no clinical note behind it (a compliance liability).

I built Reconciliation to do the cross-check automatically and hand the staff only the handful of flagged patients instead of the whole schedule. It is shipped and live (v1.6.0) on Cloud Run, it reads two completely different practice-management systems through one engine, and no patient data has ever touched the repository.

## Two systems, same underlying reality

The first complication is that the two practices run different software, and the exports look nothing alike on disk.

The general practice runs Eaglesoft: legacy exports, binary `.xls` then CSV, Windows `cp1252` encoding, and duplicate column headers (three different `start_time` columns in one file). The implant centers run Denticon: `.xlsx` with title and footer junk rows, merged cells, a header that is not on the first row, and a column name literally spelled `OIffice Name`. Same problem, two hostile file shapes.

The second complication is HIPAA. Every one of those files is full of protected health information, so anything I built had to treat patient data as radioactive: never logged carelessly, never committed, never sent anywhere it should not go.

## A deterministic engine, then everything else wraps it

The single most important decision was to split the system into a pure reconciliation engine and a thin application shell around it.

```
engine/   pure Python. No network, no database, no clock, no UI.
          Three files in, one structured auditable result out.

app/      FastAPI. Auth, upload, dashboard, history, email, and the
          in-progress AI clinical matcher. All of it wraps engine.reconcile(...).
```

The engine is the part that has to be correct, so I kept it free of side effects. No I/O, no randomness, no reading the wall clock. It even takes the "generated at" timestamp as a parameter instead of calling `now()`, so identical inputs produce byte-identical output. That is what makes the result auditable: same three files, same answer, every count traceable back to specific source rows. The messy real-world concerns (sessions, OAuth, uploads, email) all live in the shell, where they can be messy without threatening correctness.

## Parsing: map columns by name, and fail loud

The parsers follow two rules. Map columns by name rather than position, because positions drift between exports and names are more stable, and when a name is duplicated, pick the right occurrence deterministically. And give each system its own adapter that validates the columns it needs and emits clean typed records. A missing required column is a loud, specific error, never a silently wrong answer. In a tool people use to sign off on money and compliance, "wrong but confident" is the worst possible failure.

Both adapters emit the same typed models, so once parsed, Eaglesoft and Denticon records are indistinguishable to the rest of the system. A small `SOURCES` registry dispatches to the right adapter based on a `source` argument, which means adding a third practice-management system later is one new adapter, not a rewrite of the matching logic.

## Matching: patient_id is the spine

To compare three files you need a reliable join key. The schedule and ledger both carry a clean `patient_id`. The Eaglesoft notes file has no ID column at all. What it does have is a `sort_name` like `ROTHFUSS, JAMES E15612`, with the patient ID hiding as trailing digits on the name string, so the matcher recovers the key from there. I confirmed that was 100% extractable across a real notes export before relying on it.

Keying on the ID rather than the name means two patients with the same name never collide. Names are only a fallback: when an ID cannot be lined up, the system attempts a normalized last-first match and tags the patient as low-confidence, needs human review. It never silently guesses. "I am not sure, look at this one" is always a safe answer.

## Classification: a small set of honest buckets

For each scheduled patient, the engine computes two facts: `has_money` (at least one real production charge, explicitly excluding credits, adjustments, and courtesy codes) and `has_note` (at least one non-deleted clinical note). Those two booleans produce the verdict.

| Bucket | Condition | What it means |
|---|---|---|
| verified | money and note | Done and documented, no review needed |
| note_no_money | note, no production | Documented but nothing posted (lost revenue) |
| money_no_note | production, no note | Posted but undocumented (compliance risk) |
| neither | no money, no note | No-show or missed |
| review_non_scheduled | production for someone not on the schedule | Walk-in or mis-post |
| review_low_confidence | matched only by fuzzy name | Needs a human to confirm |

The green `verified` bucket is the whole point. On a representative day of about 41 scheduled patients, roughly 30 land there automatically and disappear from the staff's workload, leaving about a dozen exceptions to actually look at. Every record carries the evidence that placed it in its bucket (the specific ledger and note rows), a plain-English reason, and the input files' SHA-256 hashes and row counts for audit.

<div class="stat-callout stat-amber">
  <div class="stat-value">fail loud, never guess</div>
  <div class="stat-label">A missing column errors out. An uncertain match gets flagged for a human. In a financial and clinical tool, a confident wrong answer is far worse than an honest "look at this one."</div>
</div>

## HIPAA-safe testing, with no compromise

This is the constraint that shaped the whole test strategy, and I am happy with where it landed. No real patient data lives in the repo: `.gitignore` blocks every `.xls`, `.xlsx`, `.csv`, and `.pdf`, and real exports stay on local machines only. The 150+ tests run against synthetic fixtures generated at runtime that reproduce every real-world quirk (duplicate headers, the trailing-ID `sort_name`, deleted notes, credits, multi-appointment patients, non-scheduled production, fuzzy-name-only patients) without a single byte of PHI, so CI runs entirely clean. A golden test does run against a real day's files, but it is opt-in, gated behind a `REAL_DATA_DIR` variable, and skipped automatically when that is absent. The acceptance numbers from that real day became the literal definition of done.

## The shell: auth, dashboard, history, email

Around the engine sits a FastAPI app on Cloud Run, with Firestore holding users, recipients, saved reports, and config. Google sign-in is restricted to the practices' own domains plus an admin-managed allowlist, with two roles and self-serve user management so nobody files a ticket to add a colleague. The dashboard has a source tab, then upload three files, reconcile, and read color-coded summary cards; click any card and a popup shows every patient's schedule, ledger, and note rows down to tooth, surface, provider, dollar amount, full note text, and the original spreadsheet row numbers. Every run is saved and searchable, with a reversible mark-as-fixed so a staff member can tick off a flagged patient once they have resolved it. Email needs no IT involvement: an admin clicks Connect Gmail once, and the app sends reports as that user through a stored refresh token.

## The next frontier, built but not switched on

The current verdict is structural: production exists and a note exists, so the patient is verified. The real prize is clinical matching, confirming that the specific procedures billed are the specific procedures documented, tooth by tooth. I have built that layer on Gemini through Vertex AI, matching ledger procedures against note text by tooth, surface, description, and procedure code with a curated clinical-terminology dictionary (a "Cement Crown" charge maps to a "Delivered Crown" note, surface-letter counts have to match the procedure code, X-ray and tray codes are normalized, billing and admin lines are ignored).

It is deliberately not wired into the live verdict yet. Clinical matching is high stakes, and the two practices document differently (per-procedure at the general practice, long consult narratives at the implant centers). Turning it on is gated on finalizing the terminology lists with each practice's billing lead, so the engine asks instead of guesses. The plan is a preview mode that shows the AI's read alongside the official structural verdict before it is ever allowed to change a count.

## Where it landed

Shipped and live at v1.6.0, in daily use. About six person-hours of manual cross-checking became a few minutes of exception review. Lost-revenue and compliance gaps are caught structurally every day instead of depending on a tired human noticing a discrepancy across three windows. Two practice-management systems flow through one engine and one dashboard. The output is deterministic and auditable, the repository has never held a byte of PHI, and the AI clinical matcher is ready and waiting behind a conservative rollout rather than rushed into a place where it could quietly change the books.
