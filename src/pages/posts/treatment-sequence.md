---
title: "Visit plans generated from the practice's own masters"
date: "2026-10-04"
layout: ../../layouts/PostLayout.astro
description: "Coordinators retyped every plan of visits into Word. Now the estimate picks one of eleven transcribed practice masters and a builder edits it. The engine ships as a committed snapshot, with no registry."
img_path: "/treatment-sequence.png"
architecture: "treatment-sequence"
img_alt: "Treatment sequence builder: the visit list, a flowchart of the plan, and a live document preview side by side"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "11 masters"
    label: "the practice's own documents, transcribed word for word, all validated"
    tone: "emerald"
  - value: "0 errors"
    label: "in 271 generation attempts across 75 live production estimates, audit of Aug 27"
    tone: "blue"
  - value: "4.5 hours"
    label: "from the first commit at 11:35 AM on Aug 27 to the builder live in the estimator at 4:05 PM"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Coordinators retyped every plan of visits into Word, renumbering visits and dates by hand when a plan changed."
  - label: "What I built"
    value: "A visit plan generator and builder that picks one of eleven transcribed practice masters for each estimate."
  - label: "Who uses it"
    value: "Coordinators open a plan from any estimate, edit it and download Word or PDF."
  - label: "Outcome"
    value: "0 errors in 271 generation attempts across 75 live estimates in the August 27 audit."
  - label: "Runs on"
    value: "Inside the treatment estimator, as a committed snapshot from its own repo, with no package registry."
  - label: "Built"
    value: "4.5 hours from the first commit at 11:35 AM on August 27, 2026 to the builder live."
---

## The problem

It is the end of a full arch consult and the patient has said yes. The coordinator opens Word, finds the right master in a shared Drive folder, copies it, types in the patient's name and fills the blanks: which teeth, who does the work, how long each visit holds the chair.

Then the plan changes. The case needs one more visit after visit 3, so every visit after it needs a new number. Every date is the previous date plus a wait, so every date after the new visit is wrong too. The coordinator fixes them one at a time, and nothing checks the work.

By then the [estimate](/posts/treatment-estimator) already knew the arch, the treatment path, the teeth and the implant staging. The plan was being retyped from data one screen away.

## What I built

Two packages in their own repo, and no app. sequence-core holds eleven of the practice's masters, transcribed word for word as data. It picks the master that fits the estimate, fills in the real teeth, projects the dates from the waits, and writes the Word file. sequence-ui is a three pane builder: the visits, a flowchart with each gap sized by its real wait, and a live preview of the document. Time is kept in <span class="egg" tabindex="0" data-egg="The masters write .5h, 1.25h and 4.5h. In units that is 2, 5 and 18. Integers all the way down.">15 minute units</span>, because every value in the masters divides evenly.

The estimator carries a built copy of both, committed in its own repo and stamped with the commit it came from. [Open the drawing](/architecture/treatment-sequence).

## The sprint

The repo's history starts at 11:35 AM on August 27 with the core package. The first run against real estimates found the worst bug, fixed at 12:03 PM. Estimator v1.27.0 shipped the builder and the Word export at 4:05 PM, and v1.28.0 added saving, versions and the PDF at 7:04 PM.

That noon fix also closed a gap a real estimate had hit: an upper Hybridge in two stages with a lower Hybridge in one. The practice had a master for it, so the same commit transcribed it.

The second round came on September 29, when the estimator moved into the practice's design. The last change here went in at 10:44 PM for the Word file, and the estimator took it at 11:06 PM. It reaches production only through an estimator release.

## The hard parts

**Empty lists read as no staging.** The first version passed its tests, then sent every Hybridge case to a manual build. I had worked out staging from the teeth: implant teeth listed as two stage meant a two stage case. A full arch option decides staging for the whole arch and lists no single teeth, so both lists were empty, the code read that as no staging, and every Hybridge master demands one. The fix was to stop guessing:

```ts
// packages/core/src/generate.ts
const hasStaging = options.some((o) => o.implantStaging !== null);
const anyTwo = options.some((o) => o.implantStaging?.mode === 'two');
const staging: 'one' | 'two' | null = !hasStaging ? null : anyTwo ? 'two' : 'one';
```

Staging is now a mode the option states, pinned by tests.

**A copy that never refreshed.** I started with pnpm's `file:` protocol, which copies the folder once and copies again only when the dependency spec changes. The spec never changes. So node_modules kept serving the old build while the repo showed the new one, and nothing said a word. `link:` points into the vendored folder, so a refresh is live the moment it lands. <span class="egg" tabindex="0" data-egg="Both are equally hermetic. Only one of them tells the truth.">Same files, different honesty.</span> The vendor script now checks that node_modules serves the new stamp and fails if it does not.

**Masters are transcribed whole.** I could have glued two single arch masters together. The arches run on different clocks: the lower is finished at visit 6, before the upper surgery at visit 8. Glued plans get that order wrong in a way that looks fine on paper. A test pins the order. When the practice has already written the document, I copy it.

## What I said no to

**A model that writes the plan.** A treatment sequence is a clinical document, and the practice already wrote the right ones. So generation picks a master and never invents a visit. A procedure with no visit prints in a yellow open items block, a plan with no master opens empty, and a wait like "As needed" stops the dates instead of guessing one.

**A package registry.** Publishing would need a write credential in this repo and a read credential everywhere the estimator installs, including the Docker build. The repo's note says it plainly: "There is no auth step to get wrong at 6pm before a deploy." The cost is real: nothing goes red when a consumer falls behind, and both repos carry a file marked TEMPORARY that says so.

**Five tables for a plan.** Each save is one immutable JSON version, because nothing queries inside the steps. A unique index on plan and version number makes the second of two racing saves fail instead of overwrite. There is no foreign key to the options either, since editing an estimate deletes and recreates them.

## Where it landed

Coordinators open a plan from any estimate, edit it in the builder, and download Word or PDF of what is on screen. A read only audit tries every scenario and option of every live estimate. Run against production on August 27: 75 estimates, 271 attempts, 263 matched a validated master, 8 opened empty, 0 errors. All 8 were plans that mix Hybridge and dentures. The practice has masters for those; they are not transcribed yet.

It has no bill of its own. It runs inside the estimator, which cost $34 for October 1 to 28. I have not counted how many plans coordinators have saved since.

The drift the TEMPORARY file warns about has already happened once: the capacity planner carries an older snapshot, to borrow one popover component. Automating the refresh is the next job, before the CDF patient dashboard starts using the packages too.

What I would keep: when the clinic has already written the answer, transcribe it, and make the code admit what it does not know.
