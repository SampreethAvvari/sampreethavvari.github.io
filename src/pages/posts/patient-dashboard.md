---
title: "Every patient record on one Denticon chart, linked without guessing"
date: "2026-10-06"
layout: ../../layouts/PostLayout.astro
description: "Our coordinators had four tabs and four ids for one patient. I built a read only Denticon mirror, a registry the other apps share, and record links that prove a match before they write."
img_path: "/patient-dashboard.png"
architecture: "patient-dashboard"
img_alt: "CDF patient dashboard: the day's appointment list beside a patient profile with its journey checkpoints"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "453 of 453"
    label: "blind test against bookings: every time the record linker picked a chart, it was the right one"
    tone: "emerald"
  - value: "259 links, 0 errors"
    label: "records put onto their charts by the first backfill, each one audited and undoable"
    tone: "blue"
  - value: "2.6 minutes"
    label: "how far the Denticon mirror trailed the practice once its sync ran on a timer, down from 6.0 days"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Coordinators had four tabs and four ids for one patient, and the Denticon id joined nothing."
  - label: "What I built"
    value: "A staff dashboard that puts each patient's intake, consult, estimates and appointments on one Denticon chart."
  - label: "Who uses it"
    value: "Coordinators and office staff at all three offices; it opens on the day's appointment book."
  - label: "Outcome"
    value: "The linker was right 453 of 453 times blind, and its first backfill made 259 links with 0 errors."
  - label: "Runs on"
    value: "Cloud Run and Firestore, reading a read only Denticon mirror that one sync service keeps."
  - label: "Built"
    value: "Live June 23, 2026; joined to Denticon charts on September 29, when the sync read the live practice."
---

## The problem

A treatment coordinator has a consult at nine. Before it starts the coordinator needs the patient's intake answers, last week's recorded consult, the estimate a colleague started, and whether surgery is booked. In August that meant four tabs on my dashboard, Denticon in another window, and a guess.

The guess was the problem. Each system I had built named a patient its own way: a survey response id, an estimator patient number, a Zoom meeting, an email. The Denticon patient id sat in three of them as a hand typed field nothing checked. My plan from September 9 said it plainly: "so today it joins nothing."

So the tabs stayed apart on purpose. Merging two records because the names look alike is a made up match, and in a dental practice that puts one patient's estimate on another patient's chart.

## What I built

The CDF dashboard is the staff screen for every patient at our three offices. It opens on the day's appointment book with that day's intakes beside it. Click a patient and one profile holds the intake, the recorded consult and its note, the estimates, the appointments and uploads, joined on the Denticon id.

Three pieces make that work. A sync service is the only thing holding Denticon credentials, and it keeps a read only mirror in Firestore. A small registry API serves that mirror to the estimator and the capacity planner, each with its own secret. And a record linker puts an outside record on a chart only when it can prove which one, and hands the rest to a person. [Open the drawing](/architecture/patient-dashboard), and the registry has [its own](/architecture/cdf-registry).

## The sprint

The dashboard went up on June 23 as one row per survey, built between 6:52 PM and 12:54 AM. On August 28 it moved into its own repo.

Planet DDS confirmed our API access on September 9. The first Denticon commit landed at 12:36 AM on September 15. On September 21 the mirror went on a timer, and the same day the Denticon credentials came off the dashboard.

On September 29, at <span class="egg" tabindex="0" data-egg="The commit is titled The sync service reads the live practice. Its author, at that hour, was reading very little.">2:57 AM</span> the sync service switched to the live practice. The capacity planner's routes shipped at 4:58 AM, the first real webhooks found two faults, and the fix went out at 5:27 AM. That evening every patient got a profile, and between 6:44 PM and 1:33 AM record links and intake links went live. The backfill ran that night: 259 links, 0 errors.

On October 15 the practice asked for a focus groups option on the experience survey. The survey shipped it at 1:00 PM and this dashboard's filter at 1:10 PM.

## The hard parts

**Denticon says 200 when it ignored you.** The API ignores a query parameter it does not know and returns the whole table, so a misspelled filter looks fine. I transcribed the vendor's portal, 77 operations, and proved each filter by watching `totalCount` change. Fourteen made the list. Anything else throws before the request leaves.

**The sync that had never run.** Putting the mirror on a timer on September 21 found four reasons it had never run by itself. The route was missing from the login allowlist, so the scheduler got a 307 to the sign in page and logged success. It only accepted a signed in person. It refreshed offices and providers and stopped. And every bearer secret carried a trailing <span class="egg" tabindex="0" data-egg="Sixty five characters in the environment, sixty four in every caller. Windows remembers how each line it wrote ended.">carriage return</span>, so the freshness check answered 401 to its own secret. That afternoon the mirror went from 6.0 days behind Denticon to 2.6 minutes.

**A person's decision always wins.** I had the first matcher attacked from three angles before it wrote anything. The worst case: a parent and adult child with the same name, the family email only on the parent's chart. The child uses that email, the rule finds one chart and calls it certain. The review found 4 critical and 11 high distinct defects. What writes today was measured first: blind against consults whose chart the booking confirmed, the rules were right every time they picked, 453 of 453. Each write is one transaction that decides again on fresh reads, starting with who decided last:

```ts
// lib/links/store.ts
export async function applyMatcherDecision(db: Firestore, w: MatcherWrite): Promise<MatcherOutcome> {
  const ref = db.collection(LINKS).doc(linkDocId(w.source, w.recordId));
  return db.runTransaction(async (tx) => {
    const current = readLink((await tx.get(ref)).data());
    if (current?.decidedBy === 'person') return 'kept-person';
```

## What I said no to

**Asking patients for a date of birth.** It would make matching easier and add a field to a form patients fill in before meeting anyone. Matching uses email, name, office and booking instead.

**Giving other apps their own Denticon keys.** The capacity planner's first plan kept Denticon secrets in its own project. I cut that. One service holds the credentials, everyone else reads the registry, and revoking one caller's secret does not blind the other.

**Letting the email rule write.** Email alone is the rule the family case breaks. It runs in shadow mode, recording what it would have linked, until at least 50 of its calls are settled by a coordinator with zero disagreements.

## Where it landed

It is built for coordinators and office staff at all three offices, and Patients is the page it opens on. Intakes link on their own when a name and a booking agree, which on September 30 covered 81 of 103. I have not measured how often staff open a profile or what time it saves. The billing export for this project only switched on October 28, so there is no measured month of cost yet.

Still open: a Send intake button that mails a survey link already bound to the chart. Clinical notes cannot be written through the Denticon API, so they still reach the chart by paste.

What I would keep: almost every bad bug here looked like success. A 200 with the whole table, a 307 logged as fine, an hourly sweep printing `swept=0/0` while every call failed. I found each one by running the thing and asking what it had actually done.
