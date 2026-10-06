---
title: "How I moved visit plans out of Word and into the estimate"
date: "2026-10-04"
layout: ../../layouts/PostLayout.astro
description: "Coordinators used to type every patient's plan of visits into Word from a master document, then renumber and redate it by hand on every change. Now the estimate picks one of the practice's own transcribed masters, a three pane builder edits it, and Word and PDF come out the other end. Two packages in their own repo, vendored into the estimator with no registry and no token."
img_path: "/treatment-sequence.png"
img_alt: "Treatment sequence builder: the visit list, a flowchart of the plan, and a live document preview side by side"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "11 masters"
    label: "the practice's own documents, transcribed word for word, so generation picks a plan instead of inferring one"
    tone: "emerald"
  - value: "84 of 92"
    label: "generation attempts on the dev database matched a validated master, the other 8 opened empty for a manual build, 0 errors"
    tone: "blue"
  - value: "no registry"
    label: "two packages vendored into the estimator as a committed snapshot stamped with its source commit, and no token to rotate"
    tone: "amber"
---

It is the end of a full arch consult. The patient has said yes, and the coordinator opens Word. They find the right master in a shared Drive folder, copy it, type the patient's name into the heading, and fill in the blanks: which teeth, who does the work, how long each visit holds the chair. Then the plan changes. The case needs one more visit after visit 3, so the old visit 4 becomes visit 5 and everything after it gets a new number. Every date is the previous date plus a wait, so every date after the new visit is wrong too. The coordinator fixes them one at a time, and nothing checks the work.

That document is a treatment sequence. A full arch case is roughly eight hours of chair time spread across nine months, and the sequence is the map of it: every visit in order, its chair time, its provider, its teeth, and the wait before the next one.

I had already rebuilt the practice's [pricing tool](/posts/treatment-estimator), so by the time a coordinator opened Word, the estimate already knew the arch, the treatment path, the teeth and the implant staging. The plan was being retyped from data one screen away. This is how I closed that gap, the bugs that taught me the most, and the packaging trade off I am still paying down.

## Two kinds of document, both in daily use

The practice writes sequences two ways. The units format is a flat list for segmented work like single implants, partials, and crown and bridge: a chair time in 15 minute units, the provider's initials, and the visit. Leave out the initials and it reads "2U Pre surg", then "5U Extract/graft #19", then "Wait 10 days". The eXact table is for full arch Hybridge and dentures: six columns, paired appointments (1a for records, 1b for the pre surgical review), a checklist per visit, and a "Then wait" column.

Both had to be first class. Time is stored in 15 minute units everywhere, because every value in the masters divides evenly, so hours are only a way of printing it.

## The rule: pick a master, never infer a plan

The tempting version of this project is a model that reads the estimate and writes a plan. I did not build that. A treatment sequence is a clinical document, and the practice already has the right plans, written down as its own masters.

So generation is template selection. I transcribed eleven of the practice's masters into data, word for word, each one recording the Drive document it came from. The generator reads the arch, path and staging off the estimate, picks the matching master, fills the real teeth into its blanks ("Extract/graft #" becomes "Extract/graft #19"), and attaches the estimate lines each visit delivers. Templates are data on purpose. When Chelsea, our senior treatment coordinator, corrects a unit count, it is a one line change, not a logic change.

```ts
// hybridge-treatment-sequence/packages/core/src/templates/index.ts, lines 54 to 69
export function selectTemplates(input: SelectTemplateInput): SequenceTemplate[] {
  const matches = ALL_TEMPLATES.filter((t) => {
    if (!t.match.arch.includes(input.arch)) return false;
    if (!input.paths.some((p) => t.match.paths.includes(p))) return false;
    if (t.match.staging && input.staging && t.match.staging !== input.staging) return false;
    // A template that demands a staging cannot be chosen when the selection has
    // no implants to stage.
    if (t.match.staging && input.staging === null) return false;
    return true;
  });

  return matches.sort((a, b) => {
    if (b.match.priority !== a.match.priority) return b.match.priority - a.match.priority;
    return a.id.localeCompare(b.id);
  });
}
```

It returns a ranked list, not a winner. If two masters fit, the coordinator sees both and picks, and the top of the list is only the default. Keep an eye on the two staging checks. They mattered more than anything else in the file.

What the generator refuses to do matters as much as what it matches.

<div class="aside">
<strong>Three things it will not do.</strong>
<ol>
<li><strong>Invent a visit.</strong> A procedure the chosen master has no visit for comes back unmatched and prints in a yellow "Open items" block, so a paper copy never looks finished when it is not.</li>
<li><strong>Guess a master.</strong> A plan that mixes Hybridge and dentures has no master yet, so it opens an empty editor for a manual build instead of bending a Hybridge master to fit.</li>
<li><strong>Make up a date.</strong> A plain text wait like "As needed" or "3 month recall" stops date projection. A guessed appointment in a clinical document is worse than a blank.</li>
</ol>
</div>

Any template that is not a transcription has to be marked unvalidated, and then the screen, the PDF and the Word file all carry a banner: "DRAFT, generated from an unvalidated template. Not clinically reviewed." All eleven are validated, so the banner is there for the day someone adds a master in a hurry.

## The bug that sent every full arch case to manual build

The first version passed its tests. Then I ran it against real estimates, and every Hybridge case fell through to a manual build. Full arch Hybridge is the practice's flagship, and it generated nothing.

I had been working out staging from the teeth: implant teeth listed under two stage meant a two stage case. But a full arch option decides staging for the whole arch and lists no individual implant teeth. Both arrays were empty, so the code read the case as having no staging, and the last check in the selector throws out any master that demands a staging when there is none. Every Hybridge master demands one.

The fix was to stop inferring it. Staging became an explicit mode on the option, pinned by two tests.

```ts
// hybridge-treatment-sequence/packages/core/src/generate.ts, lines 136 to 142
  // Staging comes from the option's explicit mode, never from whether a tooth
  // array happens to be empty. Any two stage arch makes the case two stage,
  // which is how the practice titles the document: "Two Stage" appears as soon
  // as one arch is staged.
  const hasStaging = options.some((o) => o.implantStaging !== null);
  const anyTwo = options.some((o) => o.implantStaging?.mode === 'two');
  const staging: 'one' | 'two' | null = !hasStaging ? null : anyTwo ? 'two' : 'one';
```

The same pass found two smaller problems. A full arch extraction printed as sixteen comma separated tooth numbers where the documents write `#1-16`, so long runs now collapse to a span. And a scenario spanning two treatment paths quietly used one path's master and dropped the other path's procedures into the unmatched pile with no explanation. Now it raises a mixed path warning instead of half covering the plan in silence.

<div class="stat-callout stat-amber">
  <div class="stat-value">empty is not "none"</div>
  <div class="stat-label">An empty list of teeth meant "decided for the whole arch", and I read it as "not decided". The fix was making staging something the option states, not something the code guesses from what is missing.</div>
</div>

## Why the both arches master was transcribed, not composed

That commit also closed a gap a real estimate had hit: an upper Hybridge in two stages with a lower Hybridge in one. I could have composed it from the single arch masters I already had, upper then lower. I transcribed the practice's own master instead, because of the order of its visits.

The two arches run on different clocks. The lower is one stage and finishes early. The upper is extracted, carried on a temporary denture through a long heal, and only then implanted. So the lower Hybridge is delivered at visit 6, before the upper surgery even happens at visit 8. Two single arch plans glued end to end would get that wrong, in a way that looks perfectly reasonable on paper. A test pins the order now. My rule since then: when the practice has already written the document, copy it. Deciding clinical order is not my call.

## Dates that follow the visits

Every edit renumbers the plan and reprojects the dates, which is exactly the job the coordinator used to do by hand. Each rule in the projection came from how the masters are actually written.

```ts
// hybridge-treatment-sequence/packages/core/src/schedule.ts, lines 166 to 186
export function projectDates(steps: readonly SequenceStep[]): SequenceStep[] {
  const out = steps.map((s) => ({ ...s }));
  let cursor: string | null = null;

  for (const group of visitGroups(out)) {
    // A booking anywhere in the visit anchors the whole visit.
    const booked = group.find((s) => s.scheduledAt)?.scheduledAt;
    if (booked) cursor = booked;
    if (cursor) for (const s of group) s.scheduledAt = cursor;
    if (!cursor) continue;

    // The wait for a paired visit sits on whichever sub-step carries it, which
    // in the masters is the first one.
    const wait = group.find((s) => s.waitAfter)?.waitAfter;
    if (wait) cursor = applyWait(cursor, wait);
    else if (group.some((s) => s.waitAfterText)) cursor = null;
    // else: no wait at all, so the next visit shares this date.
  }

  return out;
}
```

A booking wins. It anchors everything after it, so dragging one appointment pulls the rest along instead of being overwritten. No wait line means back to back, not unknown, because that is how the masters write it. A plain text wait stops the cursor. And a paired visit (1a and 1b) moves as one, with its wait read from whichever part carries it, which in the masters is the first. Hold onto that detail. It comes back in the Word export.

## The builder

The editor is a three pane workspace inside the estimator. The visits sit on the left, a flowchart of the plan in the middle with each gap sized by its real wait, and a live preview of the document on the right, drawn by the same functions that write the Word file. All three show from 1,400 pixels wide. On a phone it is one pane at a time.

Dragging moves whole visits, never half of one, since 1a and 1b are a single appointment. A visit can be marked Complete, Partial or Plan changed, and the document prints partial rows in yellow and changed rows struck through in red. Aftercare moved from green to sky blue, since green now means done.

Duplicating is a small call I like. A copy drops its booking and its estimate line keys, because two appointments cannot share a slot, and a copy that keeps the line keys makes the same procedure look billed twice.

When the estimator moved into the Hybridge design language in September, restyling the builder turned up bugs no unit test would have caught. The drag library's accessibility ids differed between the server render and the browser, which broke hydration on every visit row. Buttons holding only an icon kept the padding of their size setting, which left a 16 pixel icon 4 pixels of room, so undo, redo and the card menu rendered as empty circles. And a plan that had never been saved showed a disabled button reading "Saved".

## Saving, versions and the Word file

In the estimator a sequence is two tables: a living plan with a pointer to its current version, and immutable versions, one per save, holding the whole plan as JSON. Last week's printout stays readable after today's edits. A unique index on the plan and version number means two people saving at once cannot overwrite each other, because the second insert simply fails. And there is deliberately no foreign key to the source scenario or options, because editing an estimate deletes and recreates those rows, and a saved plan should never block an ordinary edit.

The exports take the plan in the request body, so a coordinator can download what is on screen without saving first. One shared text module feeds the preview, the Word file and the PDF, so the three should never disagree.

The Word file drifted anyway. It named no font, so Word opened it in Times New Roman. It now embeds Inter in three weights with Calibri as the fallback, and I checked it by opening the file in Word. It went from A4 to Letter. And the units document had been dropping the wait after every two part visit, because it read only the last part while the masters keep the wait on the first. Same rule as the dates, missed in one renderer.

## Two packages, vendored, with no registry

The engine and the editor live in their own repo as two packages: `@hybridge/sequence-core` (the masters, generation, date math and the Word renderer, with no React) and `@hybridge/sequence-ui` (the editor). The reason is a second consumer. The [CDF patient dashboard](/posts/patient-dashboard) needs the same sequences, and two apps should share one engine and one set of masters. For now it reads saved sequences through a read only lookup in the estimator.

The usual way to share packages is a registry, and I chose not to use one. The estimator commits a built snapshot of both under `vendor/sequence` and depends on it as a local folder. One command, `pnpm vendor:sequence`, builds the sibling repo, copies the compiled output, and stamps each package with the commit it came from. The doc I wrote for whoever touches this next says why: no registry, no read token in the Dockerfile, nothing to rotate. "There is no auth step to get wrong at 6pm before a deploy." GitHub Packages needs a write credential in one repo and a read credential everywhere the app installs, including the Docker build, and those are exactly the credentials that expire quietly.

The packaging bit me anyway. I started with pnpm's `file:` protocol, which copies the folder once and only copies again when the dependency spec changes. The spec never changes. So node_modules kept serving the previous build while the repo showed the new one, and nothing said a word. I switched to `link:`, which symlinks into the vendored folder, so a refresh is live the moment the files land. Both are equally hermetic. Only one of them tells the truth. The vendor script now verifies the install and fails loudly if it did not take.

CI runs a guard that checks both packages are built, stamped, taken from committed code, and from the same commit:

```js
// treatment-estimator/scripts/check-vendor-sequence.mjs, lines 74 to 80
const commits = new Set(stamps.map((s) => s.commit));
if (commits.size > 1) {
  problems.push(
    `core and ui come from different commits (${[...commits].map((c) => c.slice(0, 7)).join(', ')}). ` +
      'Re-run pnpm vendor:sequence so both come from one commit.',
  );
}
```

A core and an editor from different commits is a pairing nobody ever tested, so it does not ship.

The trade off is real, and I want to be straight about it: nothing fails when the two repos fall out of step. If I push a fix to the sequence repo and forget the refresh, the estimator keeps running the old engine and CI stays green, because CI cannot see the other repo. Both repos carry a file marked TEMPORARY that says so and lists three fixes: a workflow that opens the refresh pull request on every push, a scheduled job that fails when the vendored commit falls behind, or publishing to a registry after all. The rule in that file is the right one. Automate the refresh before the dashboard ships, not after.

## Where it landed

The first version shipped on August 27 as estimator v1.27.0, 117 files and about 8,800 new lines, and saving, versions and PDF export followed that evening as v1.28.0.

Before the first deploy I wrote a read only audit that tries to generate a sequence for every scenario and every option of every live estimate. On the dev database it made 92 attempts across 30 estimates: 84 matched a validated master, 8 opened empty for a manual build, and 0 errored. A CI job can run the same audit against production on demand, and it prints estimate ids and which master matched, never anything that identifies a patient.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-emerald">
    <div class="stat-value">65</div>
    <div class="stat-label">tests on the core engine, across generation, dates and teeth</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">0 errors</div>
    <div class="stat-label">across 92 generation attempts on the dev database</div>
  </div>
  <div class="stat-callout stat-violet">
    <div class="stat-value">8 left</div>
    <div class="stat-label">attempts that open an empty editor, each waiting on a master not yet transcribed</div>
  </div>
</div>

Those 8 are the to do list: plans that mix Hybridge and dentures, and a lower Hybridge in two stages. The practice has masters for the mixed plans. They just are not transcribed yet. After that comes the automated refresh, then the dashboard consuming the packages directly.

Looking back, the hard bugs all had one shape: something empty got read as a meaning it did not have. An empty tooth list read as no staging. A document with no font named opened in Times New Roman. A wait on the first part of a visit got skipped because the renderer only looked at the last. A spec that never changed meant a folder that never refreshed. The part I am proudest of is the same idea pointed the other way. When the generator does not know, it does not fill the gap. It leaves the visit unbuilt, the date blank, or the item in yellow on the page, and lets the coordinator decide.
