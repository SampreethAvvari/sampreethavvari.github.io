---
title: "How I rebuilt a 10-year-old quoting tool with a real price lock"
date: "2026-05-18"
layout: ../../layouts/PostLayout.astro
description: "A decade-old quoting tool, rebuilt around a Postgres trigger that makes the 6-month price guarantee a real database invariant. One month of work versus ten years of attempts."
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
  - value: "Postgres trigger"
    label: "enforcing the 6-month price guarantee"
    tone: "cyan"
---

Hybridge's treatment coordinators were closing full-arch implant cases worth $24,000 or more while mentally adjusting numbers the software got wrong. The quoting tool was ten years old. It worked, roughly, but three problems had been quietly absorbing coordinator effort the whole time.

**One price for every clinic.** Rochester, Buffalo, and the planned Syracuse location all shared a single set of numbers. Want to charge differently? Fork the script.

**No tiers.** Chelsea, our senior treatment coordinator, has been quoting full-arch implant cases for a decade with a structure like "first implant $2,800, second $2,300, third+ $1,800." That structure lived in her head, not in the tool. Coordinators were hand-editing the printed estimate.

**No price freeze.** Write a $24,300 quote today. Raise prices next month. Patient comes back to accept. The legacy tool happily reads the new price book. The "6-month guarantee" at the bottom of the PDF was a promise the software couldn't keep.

A vendor spent a decade trying to fix this. They never shipped. I shipped in two days.

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

## The 6-month guarantee, as a database constraint

Every line item snapshots four things at write time: the price, the tier number, the procedure label, and the *price book version ID* active at that moment.

A Postgres trigger refuses any change to those columns:

```sql
CREATE TRIGGER trg_freeze_capture
BEFORE UPDATE ON estimate_line_item
FOR EACH ROW EXECUTE FUNCTION freeze_capture();
```

If application code tries to recompute a price into an existing line, Postgres throws. The 6-month guarantee is no longer a sticker on the PDF. It's a database invariant.

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
| 6-month price guarantee | PDF sticker | Postgres trigger |
| Wizard orientation | "Which step am I on?" | Three stacked affordances |
| Cost target | n/a | $35/month at S1 volume on Cloud Run |
| Time to working end-to-end | The vendor 10 years ago: never shipped | About one month |

Drizzle and Postgres and Next.js are everywhere these days. The tools were not the hard part. The hard part was sitting with Chelsea until her mental pricing model was precise enough to write a schema for, writing nine ADR decisions before touching code, and knowing that a service-level check on price changes would always be one missed call away from a broken promise. A Postgres trigger cannot be skipped. A business guarantee probably can.

That gap, between what an org says it does and what the system actually enforces, is where this kind of work lives. Draw the line in schema and code, and the next engineer extending it cannot blur it by accident.
