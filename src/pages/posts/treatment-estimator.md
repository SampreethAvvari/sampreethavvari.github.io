---
demo: /demos/treatment-estimator
title: "How I rebuilt a 10-year-old pricing tool in a month"
date: "2026-05-18"
layout: ../../layouts/PostLayout.astro
description: "A 10-year-old pricing tool, rebuilt in about a month around one rule: a saved price never changes, so the 6-month price promise holds."
img_path: "/treatment-estimator.png"
img_alt: "Treatment Estimator wizard, decision tree, and frozen-price snapshot"
tag: "Architecture"
tone: "blue"
stats:
  - value: "1 month"
    label: "spec to working end-to-end"
    tone: "violet"
  - value: "5"
    label: "pricing model kinds, one resolver"
    tone: "blue"
  - value: "Frozen at save"
    label: "every line keeps its captured price and price book version, so the 6-month guarantee holds"
    tone: "cyan"
---

Hybridge's treatment coordinators were closing full-arch implant cases worth $24,000 or more while mentally adjusting numbers the software got wrong. The quoting tool was ten years old. It worked, roughly, but three problems had been quietly absorbing coordinator effort the whole time.

**One price for every clinic.** Rochester, Buffalo, and the planned Syracuse location all shared a single set of numbers. Want to charge differently? Fork the script.

**No tiers.** Chelsea, our senior treatment coordinator, has been quoting full-arch implant cases for a decade with a structure like "first implant $2,800, second $2,300, third+ $1,800." That structure lived in her head, not in the tool. Coordinators were hand-editing the printed estimate.

**No price freeze.** Write a $24,300 quote today. Raise prices next month. Patient comes back to accept. The legacy tool happily reads the new price book. The "6-month guarantee" at the bottom of the PDF was a promise the software couldn't keep.

A vendor spent a decade trying to fix this. They never shipped. I shipped in a month.

## The decoupling that made it all work

Before any code, I wrote an ADR with one decision the rest of the system falls out of:

> **Code-driven decision tree. DB-driven price catalog. Prices snapshotted onto each estimate at capture time.**

The *flow* of an estimator session lives in TypeScript. The *prices* live in Postgres. They meet at one function. The result is written to disk in a form no later price update can touch.

## Five pricing models, one resolver

```
flat            One price. Night guard, sedation, CT scan.
tiered          Nth time you add this procedure, you pay tier-n's price.
                First implant cheaper than the second? Wait, no, more expensive.
tiered_zoned    Same idea, but tiers are per zone. Premium #7-10 crowns
                have their own ladder.
price_range     Catalog gives min/max. TC picks within the range.
per_surface     Surface count picks the tier. Fillings.
```

Exactly one function in the codebase decides what tier any line item is. Add a new pricing model and forget to update the resolver: the TypeScript compiler refuses to build. Compile-time guarantees on money.

## The 6-month guarantee, frozen at save

Every line item snapshots four things at write time: the price, the tier number, the procedure label, and the *price book version ID* active at that moment.

When a saved estimate is opened again, the pricing engine reads those captured values. It never looks the price up again. Raise prices next month and every estimate saved before the change still shows the number the patient was quoted, because that number is stored on the line itself, next to the version of the price book it came from. The 6-month guarantee is no longer a sticker on the PDF. It is what the data says.

*Correction, October 2026: an earlier version of this post said a Postgres trigger refuses any change to those columns. The design called for one, but what shipped freezes the price in the stored line and in the pricing engine, not in a trigger. I would rather say that plainly than leave the stronger claim up.*

<div class="stat-callout stat-violet">
  <div class="stat-value">1 month</div>
  <div class="stat-label">From ADR to working end-to-end, versus a vendor attempt that never shipped in ten years</div>
</div>

## Per-clinic, with a lifecycle

Each clinic has its own *price book version chain* with a status: `draft → proposed → approved → published`. You edit a draft, propose it, get approval from an org admin, then publish with an effective-from timestamp. Past versions stay readable forever.

Rochester at version 12 and Buffalo at version 8 coexist. No fork. No shared global table.

## The wizard, the only piece of UI worth lingering on

The legacy tool's real problem was that coordinators got lost mid-consult. Ten steps, no orientation. Patient is in the chair, watching the screen.

The redesign stacks three things that tell the TC where they are:

- **Top progress strip:** phase chips: ✓ done, ▶ here, ⌧ locked, skipped.
- **Left rail checklist:** shows their answer in parentheses: `Extractions (#4, 6, 8) ✓`. Click to jump back.
- **Right rail "Selections so far":** sticky, color-coded blue (upper) / green (lower), with running subtotals.

## By the numbers

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-violet">
    <div class="stat-value">1 → 5</div>
    <div class="stat-label">pricing model kinds, one resolver</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">$35/mo</div>
    <div class="stat-label">target cost at S1 volume on Cloud Run</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">100%</div>
    <div class="stat-label">branch coverage on the pricing engine</div>
  </div>
</div>

| | Legacy | New |
|---|---|---|
| Pricing models supported | 1 (flat) | 5 |
| Per-clinic pricing | Hardcoded everywhere | First-class object with a lifecycle |
| 6-month price guarantee | PDF sticker | Frozen at save, read back as saved |
| Wizard orientation | "Which step am I on?" | Three stacked affordances |
| Cost target | n/a | $35/month at S1 volume on Cloud Run |
| Time to working end-to-end | The vendor 10 years ago: never shipped | About one month |

Drizzle and Postgres and Next.js are everywhere these days. The tools were not the hard part. The hard part was sitting with Chelsea until her mental pricing model was precise enough to write a schema for, writing nine ADR decisions before touching code, and knowing that a price looked up again is one missed call away from a broken promise. A price stored with the quote cannot drift. The trigger the design called for would go one step further and make it impossible to overwrite, and it is still worth adding.

That gap, between what an org says it does and what the system actually enforces, is where this kind of work lives. Draw the line in schema and code, and the next engineer extending it cannot blur it by accident.

## Update, October 2026

The estimator has shipped 72 releases since May, and a lot has changed:

- **A workspace instead of a wizard.** In August a three pane, drag and drop workspace became the default way to build an estimate, with phases and a scenario builder that sets upper and lower options side by side. The wizard above is still there.
- **Visit sequences.** From any estimate, a coordinator can now generate the patient's plan of visits from one of the practice's own master documents, edit it, and export it to Word and PDF. That grew big enough to get [its own post](/posts/treatment-sequence).
- **The day's schedule is the front page.** The app now opens on today's consults, pulled from the CDF registry, and one click opens that patient's estimate or starts a new one.
- **The arch comes from the options.** Coordinators used to pick Upper, Lower or Both before building anything, a guess that could disagree with what they built. Now the arch is whatever the saved options add up to, set in the same transaction as every option save and delete, with a one time backfill for older estimates.
- **The Hybridge design.** Nine releases in one day at the end of September moved every screen and both PDFs into the practice's design language: a glass navigation shell, Inter, and the new logo.
- **Printing.** The PDF and the Excel export carry the office's logo, list the workup first, and keep each option whole on a page.
- **Coordinator feedback in October.** Future phases and "to be determined" fees still print but stay out of the totals. Options can be duplicated, a tooth can come off a grouped line onto its own, each card can show the math behind its fees, and a fee box accepts a formula.

The unit test count went from about 300 in mid August to 527 by the end of September. Most of the October changes came straight from coordinators' notes on real estimates, which is still the best spec I get.
