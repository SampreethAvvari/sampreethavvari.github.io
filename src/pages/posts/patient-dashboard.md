---
title: "How I turned a patient table into the practice's patient hub"
date: "2026-10-06"
layout: ../../layouts/PostLayout.astro
description: "The CDF dashboard started as one row per patient with every document one click away. Since September it is also where the practice's other software asks who a patient is: a read only mirror of Denticon, an API the capacity planner and the estimator read from, and links that put consult recordings, estimates and intakes on the right chart. This is how it got there, including the green job whose eighteen calls all failed."
img_path: "/patient-dashboard.png"
img_alt: "CDF patient dashboard: the day's appointment list beside a patient profile with its journey checkpoints"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "6.0 days → 2.6 min"
    label: "how far the Denticon mirror trailed the practice, before and after the sync went on a timer"
    tone: "emerald"
  - value: "453 of 453"
    label: "blind test against bookings: every time the record matcher picked a chart, it was the right one"
    tone: "blue"
  - value: "259 links, 0 errors"
    label: "records put onto their charts by the first backfill, each one audited and undoable"
    tone: "amber"
---

A treatment coordinator has a consult at nine. Before it starts she wants the patient's intake answers, the recording of last week's Zoom call, the estimate a colleague started, and whether the surgery is actually booked. In August that meant four tabs on my dashboard, Denticon open in another window, and a guess about whether the first name a Zoom transcript caught was the person on the estimate.

Now she clicks the patient on the day's list and it is all on one profile, joined on the one number every system now shares.

That dashboard is the staff side of the Centralized Diagnostic Filter. In July I wrote about [the diagnostic side](/posts/cdf-diagnostic-filter). This is the other half: how a table of survey rows became the place the practice's other software asks who a patient is, and how many things along the way reported success while doing nothing.

## Four systems, four names for one person

The dashboard went up on June 23 as one row per patient, every document one click away. But "one row per patient" really meant one row per survey submission, because that was the only key it had. Every system I had built named a patient differently.

| System | How it knew a patient |
| --- | --- |
| Intake survey | the survey response id |
| Treatment estimator | its own PT number |
| DocReview, the [consult grader](/posts/doctor-report-cards) | the Zoom meeting id |
| Experience survey | a lowercased email |
| Denticon, the practice software | a numeric patient id, which every patient already has |

The Denticon id existed in three of them as an optional text field, typed by hand and checked by nothing. My September plan put it plainly: "so today it joins nothing." So in late August the dashboard had four tabs instead of one table, on purpose. The commit says why: "these are not the same people yet. Putting them in one row would be inventing a match." On top of that, about two in five rows in both survey tabs were test data, from the nightly smoke test on one and seeded or test rows on the other.

## What I could and could not touch

On September 9, Planet DDS confirmed the practice had API access to Denticon, and the job was clear: make the Denticon patient id the key everywhere, so a row means a person rather than a form.

<div class="aside">
<strong>The limits.</strong> I am the only engineer. Everything here is protected health information, so nothing patient shaped goes in a log, and every number in this post was measured as counts only. The Denticon token is read only, and clinical notes cannot be read or written through the API at all. The dashboard writes only links, the Denticon id and feedback, and never writes into the estimator or DocReview. And the API sets traps: an unknown query parameter is ignored and the request still returns 200 with the whole table, webhooks are unsigned pointers rather than data, there is no patient search by name or email, and the staging copy I built against was frozen on May 15, before any of our survey patients existed.
</div>

## One service holds the keys

The first design call was who gets to talk to Denticon. The CDF runs as two Cloud Run services built from one image. The dashboard serves staff all day and, since v0.13.0, holds no Denticon credentials. The sync service serves no pages, holds the credentials, and keeps one instance warm, because Denticon checks a webhook address by calling it and wants an answer within ten seconds.

Every other app that needs Denticon data reads it through the CDF rather than holding its own keys. That means one credential set and one PHI boundary, and a shared library was never an option anyway, since the estimator is TypeScript and DocReview is Python. With no patient search in the API, the plan says it straight: "the mirror is not an optimization, it is the only patient index we have." Firestore keeps a read only copy of offices, providers, patients, appointments, production types and chairs, fed four ways.

| Channel | How often | What it does |
| --- | --- | --- |
| Webhooks | as things change | 18 subscriptions, six entity types × three offices. The receiver records a pointer and answers 200 |
| Slice worker | every 10 minutes | fetches each pointed slice over an authenticated call and applies it |
| Missed slice sweep | hourly | asks Denticon for any slice we never heard about |
| Nightly sweep | 4 AM Eastern | polls whatever changed since the last cursor. The safety net |

The receiver answers 200 even when Firestore is down, and its header says why: "A dropped pointer is a sweep. A failed subscription is a phone call to Planet DDS."

On top of the mirror sits a small registry API. The estimator reads a day of the appointment book from it, and the [capacity planner](/posts/capacity-planner) reads appointments, providers, production types and chairs every minute. Each crossing has its own bearer secret, "so revoking one does not blind the other," and all of them go through one check.

```ts
// lib/bearer.ts:38-54
export function bearerMatches(header: string | null, expected: string | undefined): boolean {
  // An unset secret closes the door rather than opening it. This is the whole
  // reason the check is a function and not an inline comparison: `!expected`
  // read as "no check required" is how a machine endpoint ends up public.
  if (!expected) return false;
  const want = Buffer.from(expected.trim());
  if (want.length === 0) return false;

  if (!header?.startsWith('Bearer ')) return false;
  const offered = Buffer.from(header.slice('Bearer '.length).trim());

  // timingSafeEqual throws on a length mismatch, and the throw would itself
  // leak the length, so the lengths are compared first and both paths cost the
  // same.
  if (offered.length !== want.length) return false;
  return timingSafeEqual(offered, want);
}
```

Those `trim()` calls look like tidiness. They are there because of a carriage return, which I will get to.

## Proven means totalCount changed, not a 200

I transcribed the vendor's developer portal into the repo, 77 operations across seven families, and then tested every filter it named. Since unknown parameters are ignored, a 200 proves nothing. A parameter counts as proven only when sending it changes `totalCount` against the same request without it. Eleven new ones passed, and twelve plausible names turned out to be dead.

The answer to the filter puzzle, as the commit put it, was a dot. Date filters are compound keys like `LastChangedOn.DateFrom`, and without the dot you still get a 200 and the whole table. So nothing off the proven list leaves the building.

```ts
// lib/denticon/paging.ts:117-131
export function buildQuery(params: DenticonQuery): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (!VERIFIED.has(key)) {
      throw new Error(
        `Denticon query parameter "${key}" is not in VERIFIED_QUERY_PARAMS. ` +
          'An unknown parameter is dropped silently and the whole table comes back with a 200, ' +
          'so prove totalCount changes before adding it.',
      );
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}
```

The freshness report has the same distrust built in. It does not list the sync cursors it finds, because a cursor that was never created leaves nothing to find and the board looks clean. It starts from the twelve it expects, and an expected cursor with no document is `missing`, the worst status there is.

## The sync that had never run

For about a week every sync was started by hand. I chose to put the sync on a schedule before pointing any monitor at it, because a monitor that goes red on its first day gets muted, and a muted detector still looks like coverage. Putting it on a timer on September 21 found four reasons it had never worked.

<div class="aside">
<ol>
<li><strong>A redirect.</strong> The sync route was missing from the middleware's allowlist, so Cloud Scheduler got a 307 to the login page, the handler never ran, and the job reported success.</li>
<li><strong>A door for people only.</strong> The route took a signed in session and nothing else, so the scheduler's bearer would have been refused anyway.</li>
<li><strong>Half a sync.</strong> It refreshed offices and providers and stopped. Patients and appointments, the data that actually goes stale, had no scheduled path at all.</li>
<li><strong>A carriage return.</strong> All three bearer secrets were created on Windows and carried a trailing <code>\r</code>. Cloud Run held 65 characters, every caller offered the 64 a human can see, and the freshness endpoint answered 401 to its own secret.</li>
</ol>
A fifth came free: a missing Firestore index made the slice worker answer 500 on an empty queue, and it had since the day I wrote it.
</div>

That afternoon the mirror fed itself for the first time.

<div class="stat-callout stat-emerald">
  <div class="stat-value">6.0 days → 2.6 minutes</div>
  <div class="stat-label">How far the mirror trailed Denticon on September 21, before and after the sync ran on a timer. The matcher refuses to write any link while the mirror is more than 25 hours behind, so this number gates everything below it.</div>
</div>

The same evening I found the one that still bothers me. An hourly job had been green while all eighteen of its calls failed. The missed slice sweep answered `ok: true`, and its log line, `swept=0/0`, was character for character what a healthy idle sweep prints. The 404s were actually correct that day, since no subscriptions existed yet. The bug was in what the sweep said, not what it did. Its log carries the errors now.

<div class="aside">
<strong>Other things that reported success.</strong> The image build had been running out of memory for six days and CI said so twelve times. Nobody looked, because merging to main ships nothing. The sync service deployed and answered 403 to everyone while the build printed SUCCESS. And on production day the slice files arrived wrapped in PascalCase, so the worker read every slice as zero rows until I fixed it that morning.
</div>

Every entry on the middleware's allowlist now sits under a comment I would put on a lot of systems: "Removing one does not break a page, it breaks a machine that has no way to tell you."

## Matching people without inventing them

The mirror has every chart. The hard part is deciding which chart a survey or a recording belongs to, with no date of birth (I chose not to ask patients for one) and no guessing.

My first matcher was read adversarially from three angles before it ever wrote anything, and it failed. The case that mattered: a parent fills in the survey for their child with the family email. Denticon keeps the email on the responsible party, so the child's chart has none. The rule finds exactly one chart with that email, calls it certain, and puts the child's survey and estimate on the parent's chart. Both names were sitting right there, and they disagreed. The rule never compared them.

A second review, from eight angles, produced 38 findings, 9 critical and 14 high, which came down to 4 critical and 11 high distinct defects once I measured them. In one, 233 charts could have been linked unattended even though a second chart in the same office carried the identical name. Another was the household check I had written for the parent case. It was dead code in production, because the loader never read the responsible party field, and the unit tests passed because they built their index through a different function with the same name.

<div class="aside">
<strong>How the matcher behaves now.</strong> When it is not sure, it refuses and offers a shortlist to a person. A missing value produces null, never a shared placeholder, because a key built from an empty email would quietly join every patient who never gave one. And the email rule runs in shadow mode: it records the chart it would have linked, and whether the coordinator who settles the row reaches for the same chart decides if the rule may ever write. My first version wrote the shadow to a field nothing read, and "a shadow nobody can settle measures nothing."
</div>

The staging match rate fooled me once, too. The first dry run matched almost none of our intakes, which looked like a broken mirror. Staging froze in May and our intakes arrived from July on, so no rule could ever find them there. The number measured the fixture, not the matcher.

## Record links, where a person's decision always wins

What does write today was measured before it was allowed to. Record links, shipped September 30, put DocReview's recorded consults and estimator patients onto Denticon charts. The links live in the CDF's own collection rather than being written into either system.

For a consult the rules run in order: the recording's own Denticon id, then the old Rochester id through Denticon's chart number, then the office's appointment book for that day, matched by full name, by first name and initial, or by a first name only one patient on the book answers to. Each step is also held to the visit time, the consultation type or the doctor. Anything else goes to a person.

Blind against the consults whose chart the booking already confirms, the rules picked the same chart every time they picked one: 453 of 453 on cleaned names, and 314 of 314 on the raw names the transcript caught. I ran the backfill by hand that night. It made 259 links with 0 errors, and 40 recordings are waiting for a person.

<div class="stat-callout stat-blue">
  <div class="stat-value">453 of 453</div>
  <div class="stat-label">Every time the rules picked a chart in the blind test, it was the chart the booking confirmed. When they could not be sure, they picked nothing.</div>
</div>

Every link write is a transaction that reads the link again and decides again on freshly read mirror documents, so "exactly one chart" is true at the moment it is written. The first thing it checks is who decided last.

```ts
// lib/links/store.ts:119-125
export async function applyMatcherDecision(db: Firestore, w: MatcherWrite): Promise<MatcherOutcome> {
  const ref = db.collection(LINKS).doc(linkDocId(w.source, w.recordId));
  return db.runTransaction(async (tx) => {
    const current = readLink((await tx.get(ref)).data());
    if (current?.decidedBy === 'person') return 'kept-person';

    const decision = await w.decide(txReads(tx), current?.rejected ?? []);
```

A coordinator's link carries the version they saw, so a stale screen gets a 409 instead of overwriting someone. The matcher never links a chart a person rejected, every change writes its audit entry in the same transaction, and a whole run can be undone. A rule disagreeing with a coordinator is not evidence the coordinator was wrong. They had Denticon open. The rules have a name, an email and an office.

Intakes followed the same night. I lifted shadow mode for two rules only, name plus booking, after measuring them, and about four in five intakes now link on their own. The family email cases go to a person. The assessment pipeline tells the CDF when an intake finishes, retries for about 25 minutes, and emails me if the CDF never answers, and a sweep catches every intake anyway.

## A profile per patient, and an honest unknown

Patients became the landing section on September 29. The list is a day of the Denticon book or a range up to 31 days, filtered by the scheduler's own appointment types, and search reaches every chart in the mirror. A profile joins everything on the Denticon id at read time: the intake and its psychographic analysis, consults with their notes and recordings, estimates and [treatment sequences](/posts/treatment-sequence), every visit on a timeline, and the medical, financial and experience records. A journey card across the top tracks five checkpoints, from intake to the next visit, and each one is in one of five states.

```ts
// lib/profiles/journey.ts:21-29
 * Every checkpoint is one of five states, and the fifth is the honest one:
 *
 * - `done`       it happened, `at` says when
 * - `active`     under way but not finished (an estimate still in draft)
 * - `scheduled`  booked in Denticon for `at`
 * - `none`       we can see the whole record, and it has not happened
 * - `unknown`    we cannot see the record that would say. A patient whose intake
 *                is not linked to a Denticon chart has visits we cannot join,
 *                and "no consultation" would be a claim, not a fact.
```

<div class="stat-callout stat-amber">
  <div class="stat-value">unknown, not none</div>
  <div class="stat-label">When the dashboard cannot see the record that would answer, it says so. A coordinator deciding who to call should never act on a gap that looks like a fact.</div>
</div>

The journey also taught me the practice's vocabulary, mostly by me getting it wrong. I had NP Intake visits in the consult filter at first, which would have counted about 2.6 times as many consultations as really happened. NP Intake is the paperwork and history visit. The consultation is the conversation after it. And every patient with an estimate showed an amber Draft, because the [estimator](/posts/treatment-estimator) keeps its status at draft until someone presses Mark as presented, which nobody does. It now sends its real stage, and the card shows what is still to do.

## Keeping test rows out of real numbers

Two smaller sections exist mostly to keep bad rows out of good numbers. Manual intake turns the practice's old assessment PDFs into our documents, and a person checks every answer the model read before anything renders. Nothing is emailed. Patient experience keeps its test rules deliberately narrow, because a test row in the list is untidy, while hiding a real patient "loses someone who filled in a questionnaire and is waiting for a call." The test nobody can detect, like a staff member checking the email with their own address, gets marked by hand, and marking is not deleting.

## Where it stands

It is live at v0.24.0, deployed October 5. Here is what is true today, with no rounding up.

- The sync service has read Denticon production since Planet DDS switched it on September 28, and all eighteen webhook subscriptions exist, with the nightly poll as the safety net.
- The estimator reads its schedule from the registry, and the capacity planner reads the appointment book every minute, with 21 chairs mirrored.
- Consults, estimator patients and intakes land on charts through the link rules, and anything uncertain goes to a person.
- The repo carries about 1,060 test cases across 63 files.

And what is not done:

- Profiles join at read time. The master patients collection from the plan is not built.
- The email matcher is still in shadow mode. It needs 50 settled shadow decisions before it may write.
- "Create in OneNote" is a placeholder button.
- Images live in a separate imaging system, and access to it is its own conversation, still open.
- The clinical note still reaches Denticon by a coordinator pasting it.

Next is a Send intake assessment button that mails a survey link already bound to the patient's chart, so a new intake arrives matched instead of needing a matcher at all. After that comes the Denticon id in the Zoom meeting topic, so a consult is exact at the source, then writing the resolved id back to DocReview, the master patients collection, and imaging.

## What I took from it

Almost every bad bug in this project looked like success. A 200 that returned the whole table. A 307 to a login page that a scheduler logged as fine. A build that printed SUCCESS over a service nobody could reach. A sweep printing exactly what a healthy idle sweep prints. None of those came out of reading the code. They came out of running the thing and asking what it had actually done.

So the system is built to say what it did, to refuse when it is unsure, and to let a person overrule it every time. If coordinators are going to trust one screen with a patient's whole history, that screen has to be honest about the parts it cannot see.
