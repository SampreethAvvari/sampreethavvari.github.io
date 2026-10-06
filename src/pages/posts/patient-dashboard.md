---
title: "How I turned a patient table into the practice's patient hub"
date: "2026-10-06"
layout: ../../layouts/PostLayout.astro
description: "The CDF dashboard started as one row per patient with every document one click away, and since September it is where the practice's other software asks who a patient is. This is how a read only Denticon mirror, a small registry API and measured record links got it there, including the green job whose eighteen calls all failed."
img_path: "/patient-dashboard.png"
img_alt: "CDF patient dashboard: the day's appointment list beside a patient profile with its journey checkpoints"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "1 chart"
    label: "intakes, estimates and consult recordings now land on the patient's Denticon chart, instead of in four separate lists"
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

The Denticon id existed in three of them as an optional text field, typed by hand and checked by nothing. My September plan put it plainly: "so today it joins nothing." So the dashboard had four tabs instead of one table, on purpose. The commit says why: "these are not the same people yet. Putting them in one row would be inventing a match."

On September 9, Planet DDS confirmed the practice had API access to Denticon, and the job was clear: make the Denticon patient id the key everywhere, so a row means a person rather than a form.

<div class="aside">
<strong>The limits.</strong> I am the only engineer. Everything here is protected health information, so nothing patient shaped goes in a log, and every number in this post was measured as counts only. The Denticon token is read only, clinical notes cannot be read or written through it, and the API has no patient search by name or email. The dashboard writes only links, the Denticon id and feedback, and never writes into the estimator or DocReview.
</div>

## One service holds the keys

The first design call was who gets to talk to Denticon. The CDF runs as two Cloud Run services built from one image. The dashboard serves staff all day and holds no Denticon credentials. The sync service serves no pages, holds the credentials, and keeps one instance warm, because Denticon checks a webhook address by calling it and wants an answer within ten seconds.

Every other app that needs Denticon data reads it through the CDF rather than holding its own keys. That is one credential set and one PHI boundary, and a shared library was never an option anyway, since the estimator is TypeScript and DocReview is Python. With no patient search in the API, the plan says it straight: "the mirror is not an optimization, it is the only patient index we have." Firestore keeps a read only copy of offices, providers, patients, appointments, production types and chairs. Eighteen webhook subscriptions keep it current as things change, and a nightly sweep polls for whatever they missed.

On top of the mirror sits a small registry API. The estimator reads a day of the appointment book from it, and the [capacity planner](/posts/capacity-planner) reads the book, the providers and the chairs every minute. Each caller has its own bearer secret, "so revoking one does not blind the other."

## Proven means totalCount changed, not a 200

The Denticon API has one habit that shaped everything else. A query parameter it does not recognise is ignored without a word, and the request comes back 200 with the whole table. A misspelled filter turns a small read into a full one that looks fine.

So I transcribed the vendor's developer portal into the repo, 77 operations across seven families, and tested every filter it named. A parameter counts as proven only when sending it changes `totalCount` against the same request without it. Eleven new ones passed, and twelve plausible names turned out to be dead. The answer to the filter puzzle, as the commit put it, was a dot. Date filters are compound keys like `LastChangedOn.DateFrom`, and without the dot you still get a 200 and the whole table.

So nothing off the proven list leaves the building.

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

## The sync that had never run

For about a week after the mirror was built, every sync was started by hand. I chose to put it on a schedule before pointing any monitor at it, because a monitor that goes red on its first day gets muted, and a muted detector still looks like coverage. Putting it on a timer on September 21 found four reasons it had never worked.

<div class="aside">
<ol>
<li><strong>A redirect.</strong> The sync route was missing from the middleware's allowlist, so Cloud Scheduler got a 307 to the login page and the job still reported success.</li>
<li><strong>A door for people only.</strong> The route took a signed in session and nothing else, so the scheduler's bearer would have been refused anyway.</li>
<li><strong>Half a sync.</strong> It refreshed offices and providers and stopped. Patients and appointments, the data that actually goes stale, had no scheduled path.</li>
<li><strong>A carriage return.</strong> All three bearer secrets were created on Windows and carried a trailing <code>\r</code>. Cloud Run held 65 characters, every caller offered the 64 a human can see, and the freshness endpoint answered 401 to its own secret. The check now trims both sides, because cleaning the values only lasts until someone builds the next environment on another Windows machine.</li>
</ol>
</div>

That afternoon the mirror fed itself for the first time.

<div class="stat-callout stat-emerald">
  <div class="stat-value">6.0 days → 2.6 minutes</div>
  <div class="stat-label">How far the mirror trailed its source on September 21, before and after the sync ran on a timer. That was still the staging copy; production came a week later. The matcher refuses to write any link while the mirror is more than 25 hours behind, so this number gates everything after it.</div>
</div>

The same evening I found the one that still bothers me. An hourly job had been green while all eighteen of its calls failed. The missed slice sweep answered `ok: true`, and its log line, `swept=0/0`, was character for character what a healthy idle sweep prints. The 404s were actually correct that day, since no subscriptions existed yet. The bug was in what the sweep said, not what it did. Its log carries the errors now.

## A person's decision always wins

The mirror has every chart. The hard part is deciding which chart a survey or a recording belongs to, without a date of birth (I chose not to ask patients for one) and without guessing.

My first matcher was read adversarially before it ever wrote anything, and it failed on one case in particular. A parent fills in the survey for their child with the family email. Denticon keeps the email on the responsible party, so the child's chart has none. The rule finds exactly one chart with that email, calls it certain, and puts the child's survey and estimate on the parent's chart. Both names were sitting right there, and they disagreed. The rule never compared them. A second review, from eight angles, turned up 4 critical and 11 high distinct defects. Now the matcher refuses when it is unsure and offers a shortlist to a person, and the email rule still runs in shadow mode, recording what it would have linked without writing it.

What does write today was measured first. Record links, shipped September 30, put DocReview's recorded consults and estimator patients onto Denticon charts: by their own id, by the old Rochester chart number, or by a name on that office's appointment book for the day, held to the visit time, the consultation type or the doctor. Blind against consults whose chart the booking already confirmed, the rules picked the same chart every time they picked one, 453 of 453. I ran the backfill by hand that night. It made 259 links with 0 errors.

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

A coordinator's link carries the version they saw, so a stale screen gets a 409 instead of overwriting someone. The matcher never links a chart a person rejected, every change is audited in the same transaction, and a whole run can be undone. A rule disagreeing with a coordinator is not evidence the coordinator was wrong. They had Denticon open. The rules have a name, an email and an office.

Intakes followed the same night with two measured rules, name plus booking, and about four in five now link on their own. All of it lands on a patient profile with a journey card from intake to the next visit. When no chart is linked, a checkpoint says unknown rather than none, because "no consultation" would be a claim, not a fact.

## Where it stands

It is live at v0.24.0, deployed October 5. The sync service has read Denticon production since Planet DDS switched it on September 28, all eighteen webhook subscriptions exist, the estimator reads its schedule from the registry, and the capacity planner reads the appointment book every minute.

What is not done: profiles still join at read time, because the master patients collection is not built. The email matcher stays in shadow mode until 50 of its decisions have been settled by a person. Images live in a separate system, and access to it is still an open conversation. The clinical note still reaches Denticon by a coordinator pasting it. Next is a Send intake assessment button that mails a survey link already bound to the patient's chart, so a new intake arrives matched and needs no matcher at all.

Almost every bad bug in this project looked like success: a 200 with the whole table, a 307 a scheduler logged as fine, a sweep printing exactly what a healthy idle sweep prints. None of them came out of reading the code. They came out of running the thing and asking what it had actually done.
