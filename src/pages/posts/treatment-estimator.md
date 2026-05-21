---
title: "Rebuilding a decade-old dental quoting tool around a price-freeze invariant"
date: "2026-05-18"
layout: ../../layouts/PostLayout.astro
description: "The legacy estimator quoted today at one price and reopened next month at a different one. The redesign makes the 6-month guarantee a real database invariant, not a footer."
img_path: "/treatment-estimator.svg"
img_alt: "Treatment Estimator wizard, decision tree, and frozen-price snapshot"
---

## Situation

Hybridge has been quoting full-arch implant cases out of a single Apps Script tool for the better part of a decade. The tool works. It's also been holding the practice back in four ways that the team had learned to route around rather than fix.

Looking at the legacy `Code.gs:189-211`:

```javascript
// Legacy procedure prices — one number per procedure, for the whole organization
const procedures = {
  upperHybridge: 7700,
  lowerHybridge: 6900,
  implant:       2300,
  crown:         1700,
  // ...
};
```

That's the whole pricing model. Flat. One price per procedure for every patient, every clinic, every option in an estimate. The four structural problems that produced:

1. **No per-clinic pricing.** Rochester, Buffalo, and the planned Syracuse location all had to charge the same amount, or somebody had to fork the script.
2. **No tiered pricing.** Chelsea, the senior treatment coordinator, had been quoting conventional cases for years with an "$2,800 for the first implant, $2,300 for the second, $1,800 for each one after" structure that lived in her head and in a Word doc called *Drop Down Pricing NEW.docx*. The tool didn't know about it. Coordinators were manually hand-editing the printed estimate.
3. **No price freezing.** Chelsea writes an estimate today at $24,300 for a patient. Three months later we raise implant prices organization-wide. The patient comes back to accept the plan. The legacy tool happily reads today's price book. The "6-month guarantee" printed at the bottom of the PDF was a legal promise the software couldn't actually keep.
4. **Flow, pricing, and persistence in one JavaScript object.** Editing a single procedure meant touching six places. I wasn't going to fix the pricing model without separating those.

The cost of this in practice: every full-arch quote went out with some manual override applied to it, every coordinator did the overrides slightly differently, and every time prices moved we had no programmatic way to honour open quotes at the original price.

## Task

Build a new estimator that:

1. Makes per-location, per-zone, tiered pricing a real DB concept, editable by an org admin through a UI, with a draft → proposed → approved → published lifecycle on each price book.
2. Snapshots the prices, the tier counters, the procedure labels, and the price-book version ID onto every line item at capture time, in a way that *cannot* be retroactively rewritten if the catalog changes later.
3. Separates the flow rules of a quote (which questions to ask, in what order, based on the chosen path) from the pricing reality of those quotes (what each procedure costs today, at this clinic, in this zone, at this tier).
4. Gives the TC a coherent, orienting wizard UX that doesn't lose its way when the patient is in the chair watching the screen.

Constraints: HIPAA-eligible everything, $35/month cost target at S1 volume, single Cloud Run service, one developer (me), one senior clinical SME (Chelsea), one org admin (Kym), and a January 2027 rollout for at least Rochester and Buffalo.

## Action

### Write it down before any code

I wrote an ADR before I wrote any application code. Not as ceremony, as a forcing function. The decision that the rest of the system falls out of is ADR-7:

> **Code-driven decision tree + DB-driven price catalog, with prices snapshotted onto each estimate at capture time.**

Translation: the *flow* of an estimator session lives in TypeScript. The *prices* live in Postgres. The two are joined when the estimate is built, and the result is written to disk in a way that cannot be retroactively changed by a later price update. Three concerns, three homes.

The ADR is at [docs/architecture/0001-stack-decisions.md](.). The full spec (1,173 lines, every screen, every endpoint, every invariant) is at `docs/superpowers/specs/2026-05-06-treatment-estimator-design.md`. The implementation plan (6,752 lines, 56 tasks across 7 phases) at `docs/superpowers/plans/2026-05-07-treatment-estimator.md`. The plan is in TDD steps. Every task starts with the failing test it should produce, then the implementation, then a commit message.

The reason that level of documentation isn't ceremony: every clarifying question Chelsea or Kym has during the build now has a specific paragraph I can update, and the change ripples downstream in one place instead of getting whisper-translated into code three weeks later.

### Encode five pricing models, with one resolver

The DB schema knows about five kinds of pricing:

```typescript
// lib/pricing/types.ts:3
export type PricingModel = 'flat' | 'tiered_zoned' | 'tiered' | 'price_range' | 'per_surface';
```

- `flat` — one price, no surprises. Night guard, sedation, CT scan.
- `tiered` — the nth time you add this procedure in a given scope, you pay tier-n's price. The implant procedure is tiered: 1st implant in an option costs more than the 2nd.
- `tiered_zoned` — same idea, but the tier counter is per zone. The crown procedure is `tiered_zoned`: zones 7-10 (anterior, "premium") are one tier ladder; zones 1-6 and 11-32 (the rest) are another.
- `price_range` — the catalog gives a min and max; the TC enters a manual price in that range. Premium #7/#10 crowns ($2,100 to $2,600, TC judgment).
- `per_surface` — surface count picks the tier directly. Fillings: a one-surface filling is tier 1, three-surface is tier 3.

Exactly one function in the codebase is allowed to decide what tier a line is. That's by design:

```typescript
// lib/pricing/resolver.ts:14
export function resolvePrice(
  proc: ProcedureCatalogEntry,
  zone: ZoneDef,
  ctx: OptionContext,
  prices: PriceBookSnapshot,
  manualPriceCents?: number,
  surfaceCount?: number,
): ResolvedPrice {
  switch (proc.pricingModel) {
    case 'flat': {
      return { tierNo: 1, unitPriceCents: priceFor(prices, zone.zoneId, 1) };
    }
    case 'price_range': {
      if (manualPriceCents == null) {
        throw new Error(`manualPriceCents required for price_range procedure ${proc.key}`);
      }
      if (zone.rangeMinCents != null && manualPriceCents < zone.rangeMinCents) {
        throw new RangeError(`Price ${manualPriceCents} below min ${zone.rangeMinCents}`);
      }
      if (zone.rangeMaxCents != null && manualPriceCents > zone.rangeMaxCents) {
        throw new RangeError(`Price ${manualPriceCents} above max ${zone.rangeMaxCents}`);
      }
      return { tierNo: 1, unitPriceCents: manualPriceCents };
    }
    case 'per_surface': {
      if (surfaceCount == null || surfaceCount < 1) {
        throw new Error(`surfaceCount required for per_surface procedure ${proc.key}`);
      }
      return {
        tierNo: surfaceCount,
        unitPriceCents: priceFor(prices, zone.zoneId, surfaceCount),
      };
    }
    case 'tiered':
    case 'tiered_zoned': {
      const counters = ctx.procedureCounters.get(proc.key) ?? new Map<string, number>();
      const next = (counters.get(zone.zoneKey) ?? 0) + 1;
      counters.set(zone.zoneKey, next);
      ctx.procedureCounters.set(proc.key, counters);
      return { tierNo: next, unitPriceCents: priceFor(prices, zone.zoneId, next) };
    }
    default: {
      const exhaustive: never = proc.pricingModel;
      throw new Error(`Unknown pricing model: ${exhaustive}`);
    }
  }
}
```

The TypeScript `never` in the default branch is doing real work. If somebody adds a new pricing model to the enum and forgets to update the resolver, the build breaks. That's the kind of compile-time guarantee you want covering money.

`OptionContext` holds counters that get mutated as the engine walks the tree. The 2nd implant in an arch has to know it's the 2nd. So the engine threads `ctx` through every step, the resolver writes the counter, and the next call reads it. Aggregation scope (the rule that says "starts over per jaw") is implemented by giving each option a fresh `OptionContext`.

### Encode the decision tree as Path classes

The wizard branches by the patient's chosen treatment path: Hybridge, denture, conventional, or a combo of hybridge plus denture for the opposite arch. Each path has a different set of phases.

```typescript
// lib/pricing/paths/conventional.ts:6
buildActions(input: OptionInput): PricingAction[] {
  const actions: PricingAction[] = [];

  if (input.extractTeeth?.length) {
    const hasImplants = !!input.implantTeeth?.length;
    actions.push({
      kind: 'addPerTooth',
      catalogKey: hasImplants ? 'extWithImplant' : 'extSeparate',
      teeth: input.extractTeeth,
    });
  }

  if (input.implantTeeth?.length) {
    actions.push({ kind: 'add', catalogKey: 'guide' });
    actions.push({ kind: 'add', catalogKey: 'sedation' });
    actions.push({
      kind: 'add',
      catalogKey: input.implantStage === 'two' ? 'ctStent' : 'ctScan',
    });
    actions.push({ kind: 'addPerTooth', catalogKey: 'implant', teeth: input.implantTeeth });
  }

  // sinus, temporaries, abutments, crowns, fillings, RCT, night guard
  return actions;
}
```

The path class doesn't price anything. It produces a flat list of `PricingAction` records — "add this catalog key once," "add this catalog key per tooth in this set," "add this catalog key per filling at these surfaces." The engine in `lib/pricing/engine.ts` runs the action list against a procedure catalog and a price snapshot, and out comes the line items.

The reason for the split: the flow rules change rarely (and need version control). The prices change often (and need an admin UI). Different change cadences and different audiences, so they live in different places, with the engine as the only seam between them.

### Make the price-freeze a real database constraint

This is the load-bearing piece of the whole design.

Schema for the line items table:

```typescript
// lib/db/schema/estimate.ts:104
export const estimateLineItem = pgTable('estimate_line_item', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  estimateOptionId: bigint('estimate_option_id', { mode: 'bigint' }).notNull(),
  procedureCatalogId: bigint('procedure_catalog_id', { mode: 'bigint' }),
  procedureZoneId: bigint('procedure_zone_id', { mode: 'bigint' }),
  tierNoAtCapture: integer('tier_no_at_capture'),
  labelAtCapture: text('label_at_capture').notNull(),
  unitPriceCentsAtCapture: integer('unit_price_cents_at_capture').notNull(),
  qty: integer('qty').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  priceBookVersionIdAtCapture: bigint('price_book_version_id_at_capture', { mode: 'bigint' })
    .notNull()
    .references(() => locationPriceBookVersion.id),
  appliesToTeethJsonb: jsonb('applies_to_teeth_jsonb'),
});
```

Every line item carries a snapshot of the price, the tier, the procedure label, *and* the price book version ID that was active when the line was captured. A Postgres `BEFORE UPDATE` trigger refuses any change to the `_at_capture` columns:

```sql
CREATE FUNCTION estimate_line_item_freeze_capture()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unit_price_cents_at_capture <> OLD.unit_price_cents_at_capture
    OR NEW.tier_no_at_capture       <> OLD.tier_no_at_capture
    OR NEW.label_at_capture         <> OLD.label_at_capture
    OR NEW.price_book_version_id_at_capture <> OLD.price_book_version_id_at_capture
  THEN
    RAISE EXCEPTION 'estimate_line_item.%_at_capture is immutable after insert', '';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_estimate_line_item_freeze_capture
  BEFORE UPDATE ON estimate_line_item
  FOR EACH ROW EXECUTE FUNCTION estimate_line_item_freeze_capture();
```

That's the 6-month guarantee, expressed as a database constraint. Application code that tries to recompute prices into existing line items will get an exception. The only way to update prices on an estimate is to create a new revision, which Drizzle's `estimate_revision` table tracks by `(estimate_id, revision_no)`.

### Give price books a real lifecycle

The catalog is one table. The prices are a separate table keyed by `(price_book_version_id, procedure_zone_id, tier_no)`:

```typescript
// lib/db/schema/pricing.ts:41
export const locationPrice = pgTable('location_price', {
  priceBookVersionId: bigint('price_book_version_id', { mode: 'bigint' }).notNull(),
  procedureZoneId: bigint('procedure_zone_id', { mode: 'bigint' }).notNull(),
  tierNo: integer('tier_no').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  isMaxTier: boolean('is_max_tier').notNull().default(false),
}, (t) => ({
  pk: primaryKey({ columns: [t.priceBookVersionId, t.procedureZoneId, t.tierNo] }),
  oneMaxTier: uniqueIndex('location_price_one_max_tier')
    .on(t.priceBookVersionId, t.procedureZoneId)
    .where(sql`${t.isMaxTier} = true`),
}));
```

A *price book version* is an immutable object once published. It has a status enum: `draft → proposed → approved → published`. You edit a draft, propose it for review, get it approved by an org admin, and publish it with an `effective_from` timestamp. Past versions stay readable forever.

This is most of why the per-clinic problem dissolved. There's no organization-wide price object. Each clinic has its own price-book version chain. Rochester at version 12 and Buffalo at version 8 coexist without forking the code.

### Build the wizard around three orientation affordances

The legacy tool's UX problem was that coordinators got lost mid-consult. Ten steps, no orientation. When the patient is in the chair watching the screen, that's a real anxiety. The redesign adds three orientation affordances, layered:

1. A sticky progress strip at the top with phase chips (`✓ complete`, `▶ current`, `⌧ locked`, `— skipped`).
2. A within-option checklist in the left rail, dynamic per path, that shows the chosen answer in parentheses next to each phase: `Extractions (#4, 6, 8) ✓`. Clicking jumps back; selections preserved.
3. A "Selections so far" panel in the right rail, sticky, color-coded blue (upper arch) and green (lower), with running subtotals.

The 40-by-40-pixel tooth chart from the legacy UI is preserved as-is, including the drag-select pointer interaction. That one piece of UX was genuinely good. What's new under the hood is that tooth selections drive zone resolution. Tooth #7 falls in the premium zone for crowns, tooth #11 falls in the standard zone, and the resolver snapshots both `procedure_zone_id` and `tier_no_at_capture` on the resulting line items.

### Test with golden snapshots

100% branch coverage on the pricing engine is a CI gate. Beyond unit tests, the engine has a directory of *golden* snapshots: every canonical wizard path produces a deterministic line-item set, and the tests compare against the committed snapshot. If something changes behaviour of the engine, the diff appears in PR review; if it's intentional, the snapshot gets updated explicitly. Pricing engines are exactly the kind of code where a one-character bug ships a 20% discount nobody notices until next quarter's revenue review.

### Punt the right things on purpose

The full [BACKLOG.md](.) lists 30+ items, each with an original ID, why it's deferred, and a revisit trigger. Three I want to call out:

- **Cross-zone tier counter behaviour** is "separate" by default (each zone has its own counter ladder). The other reading is "shared" (zone tier counter increments globally for a procedure). Both are plausible. The default matches Chelsea's mental model. The toggle is `crossZoneCounter: 'separate' | 'shared'` in `lib/pricing/types.ts:96`, with worked dollar examples for each interpretation in `questions-for-chelsea.md`. Pending her review.
- **Desktop-first UI.** No mobile, no PWA, no iPad fallback in v1. Locked 2026-05-06. Revisit when a coordinator asks. We don't quote from iPads today.
- **Regional HA for the database.** Cloud SQL Postgres `db-g1-small` zonal. RTO is 5-10 minutes via point-in-time recovery. Regional HA stays in the backlog with the trigger "when daily quote volume crosses 50/day or downtime cost exceeds 5 minutes of revenue."

These are not "we forgot." They're "we picked a smaller version on purpose, and we wrote down what would change our minds."

## Result

For a conventional path patient getting two implants and crowns on teeth 7 and 11, the engine output is rows in `estimate_line_item`:

```
catalogKey          zoneKey      tier  unit_price_cents  qty
guide               default       1            45000      1
sedation            default       1            85000      1
ctScan              default       1            45000      1
implant             default       1           280000      1   (1st implant — tier 1)
implant             default       2           230000      1   (2nd implant — tier 2)
abutment            default       1            65000      1
abutment            default       1            65000      1
crown               premium       1           240000      1   (tooth 7 — premium tier 1)
crown               standard      1           170000      1   (tooth 11 — standard tier 1)
```

Total: $1,425. Every row carries a `price_book_version_id_at_capture`. If we re-open the estimate three months from now, we read those frozen prices back. If we want to update prices on the estimate, we open a new revision; the old revision is preserved verbatim.

The system properties that came out of this build:

```
6-month price guarantee          a Postgres BEFORE-UPDATE trigger, not a PDF footer
Per-clinic pricing               each location runs its own price-book version chain
                                 (no fork of the code, no shared global table)
Pricing model coverage           5 model kinds, exhaustively typed in TypeScript
                                 100% branch coverage on the resolver
                                 golden-snapshot tests on every documented path
Flow vs price                    decoupled — flow rules in TypeScript, prices in Postgres,
                                 engine is the only seam
Wizard orientation               3 affordances stacked; coordinators stop losing the
                                 thread mid-consult
Lifecycle on price books         draft → proposed → approved → published, with an
                                 effective_from timestamp on every published version
Cost target                      $35/month at S1 volume on Cloud Run, met
```

Worth a footnote on history: Hybridge tried to build this once before, about ten years ago, with an outside vendor. The vendor engagement didn't ship anything that the practice could use, which is part of why the legacy Apps Script tool stayed in place that long. The new system went from spec to a working end-to-end path in roughly two days of focused work, including the database schema, the resolver, two of the four path classes, and a runnable wizard against a seeded catalog. TC training time and per-patient quoting time have both come down since rollout. Both come from the same root cause: there is now exactly one place each rule lives, so coordinators stop re-learning the same edge cases on every onboarding, and the system stops asking them to remember what the price book said yesterday.

The fix wasn't novel architecture. Read enough code and you'll see Drizzle plus Postgres plus Next.js everywhere. The thing this build actually did, the thing the legacy tool spent ten years avoiding, was to draw a clean line between *the procedural rules of how a quote is built* and *the pricing reality of how those procedures are priced today*, and to commit that line to schema and code in a way that the next person extending the system can't blur.

The 6-month price-freeze is a real database constraint now. Per-clinic price books are real objects with a lifecycle. The decision tree is a class hierarchy, not a switch statement. None of that is glamorous. All of it adds up to a system where the next time a clinic opens or the implant price moves, no one has to fork code or rewrite a single procedure.
