---
title: "Rebuilding a decade-old dental quoting tool around a price-freeze invariant"
date: "2026-05-18"
layout: ../../layouts/PostLayout.astro
description: "The legacy tool quoted today at one price and reopened next month at a different one. The redesign makes the 6-month guarantee a real database invariant."
img_path: "/treatment-estimator.svg"
img_alt: "Treatment Estimator wizard, decision tree, and frozen-price snapshot"
---

The treatment estimator at Hybridge had been running for about ten years. It worked. It also had three quiet problems that nobody had time to fix.

**One price for every clinic.** Rochester, Buffalo, and the planned Syracuse location all shared a single set of numbers. Want to charge differently? Fork the script.

**No tiers.** Chelsea, our senior treatment coordinator, has been quoting full-arch implant cases for a decade with a structure like "first implant $2,800, second $2,300, third+ $1,800." That structure lived in her head, not in the tool. Coordinators were hand-editing the printed estimate.

**No price freeze.** Write a $24,300 quote today. Raise prices next month. Patient comes back to accept. The legacy tool happily reads the new price book. The "6-month guarantee" at the bottom of the PDF was a promise the software couldn't actually keep.

A vendor tried to fix this around ten years ago. Their version never shipped.

## The decoupling that made it all work

Before any code, I wrote an ADR with one decision the rest of the system falls out of:

> **Code-driven decision tree. DB-driven price catalog. Prices snapshotted onto each estimate at capture time.**

The *flow* of an estimator session lives in TypeScript. The *prices* live in Postgres. The two meet at one function, and the result is written to disk in a way that can't be changed by a later price update.

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

Exactly one function in the codebase decides what tier any line is. If somebody adds a new pricing model and forgets to update the resolver, the TypeScript compiler refuses to build. Compile-time guarantees on money.

## The 6-month guarantee, as a database constraint

Every line item on an estimate snapshots four things at the moment it's written: the price, the tier number, the procedure label, and the *price book version ID* that was active at the time.

A Postgres trigger refuses any change to those columns:

```sql
CREATE TRIGGER trg_freeze_capture
BEFORE UPDATE ON estimate_line_item
FOR EACH ROW EXECUTE FUNCTION freeze_capture();
```

If application code tries to recompute a price into an existing line, Postgres throws. The 6-month guarantee is no longer a sticker on the PDF. It's an invariant the database enforces.

## Per-clinic, with a lifecycle

Each clinic has its own *price book version chain*. A version has a status: `draft → proposed → approved → published`. You edit a draft, propose it, get it approved by an org admin, publish it with an effective-from timestamp. Past versions stay readable forever.

Rochester at version 12 and Buffalo at version 8 coexist. No fork. No shared global table.

## The wizard, the only piece of UI worth lingering on

The legacy tool's real problem was that coordinators got lost mid-consult. Ten steps, no orientation. Patient is in the chair, watching the screen.

The redesign stacks three things that tell the TC where they are:

- **Top progress strip** — phase chips: ✓ done, ▶ here, ⌧ locked, — skipped.
- **Left rail checklist** — shows their answer in parentheses: `Extractions (#4, 6, 8) ✓`. Click to jump back.
- **Right rail "Selections so far"** — sticky, color-coded blue (upper) / green (lower), with running subtotals.

## By the numbers

| | Legacy | New |
|---|---|---|
| Pricing models supported | 1 (flat) | 5 |
| Per-clinic pricing | Hardcoded everywhere | First-class object with a lifecycle |
| 6-month price guarantee | PDF sticker | Postgres trigger |
| Wizard orientation | "Which step am I on?" | Three stacked affordances |
| Cost target | n/a | $35/month at S1 volume on Cloud Run |
| Time to working end-to-end | The vendor 10 years ago: didn't ship | About two days |

Read enough code and you'll see Drizzle and Postgres and Next.js everywhere. The thing this rebuild actually did, the thing the legacy tool spent ten years avoiding, was draw a clean line between *how a quote is built* and *what those parts cost today*. Once that line is in schema and code, the next person extending the system can't blur it.

That's most of the work.
