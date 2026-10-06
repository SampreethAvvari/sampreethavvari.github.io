---
title: "How I turned a hand built scheduling workbook into a live capacity planner"
date: "2026-10-05"
layout: ../../layouts/PostLayout.astro
description: "Our operations lead planned doctors, assistants and coordinators across three offices in an Excel workbook of pasted week blocks and fixed ranges. I replaced it with one forward view of demand, capacity and capability that reads Denticon every minute and never writes back. This is how it is built, what live data broke in the first day, and what is still waiting on answers."
img_path: "/capacity-planner.png"
img_alt: "Hybridge Capacity Planner: three offices on one coverage board, each day showing who is where and which rule placed them"
tag: "Architecture"
tone: "emerald"
stats:
  - value: "360 of 360"
    label: "day cells from the operations lead's workbook that the pure engine reproduces, checked on every test run"
    tone: "emerald"
  - value: "0 write methods"
    label: "on the Denticon source contract, held there by a type level test that fails the typecheck if one appears"
    tone: "blue"
  - value: "48 releases"
    label: "in eight days, from the first deploy on Sep 28 to v0.44.0 on Oct 5, on live Denticon data from the second morning"
    tone: "amber"
---

The workbook had twenty copies of the same week. Our operations lead built it by hand to answer one question for our offices in Rochester, Buffalo and Syracuse: which doctor is where, and is any office about to have patients booked and no doctor in the building. Each week was a block of formulas pasted under the last one with the date anchor nudged forward. Eight blocks for Q3, twelve more for Q4. When the board ran out of weeks, you pasted another block.

It worked better than it had any right to. It also failed quietly. The row that counted Rochester's doctors was a COUNTIF over rows 6 to 11, so a doctor added on row 12 simply did not count, and nothing warned you. To move a doctor off their default for one day, you typed over the cell, and the formula was gone. That cell stopped knowing about time off. If the doctor later booked a vacation covering that day, the board would still say Syracuse.

And the sheet disagreed with itself. Its Read Me said the post op visit keeps its clinical date, one day after surgery. Every post op date actually recorded in the projector, seven out of seven, was typed onto the following Monday instead.

None of that is a knock on the workbook. It was a real model of how the practice runs. It had just grown to the size where a spreadsheet stops telling you when it is wrong.

So I built the Hybridge Capacity Planner: one forward view of demand, capacity and capability across three offices, so leadership can place doctors, assistants and treatment coordinators where they are needed without burning anyone out. It reads Denticon, our practice management system, every minute. It never writes back.

## What the workbook was really doing

Before writing any code I took the workbook apart cell by cell and wrote down every rule. Besides the weekly views it held a roster, a time off list and a surgery projector that lays out each patient's follow up visits from the surgery date. Every day cell ran the same chain: time off wins, then a fellow's date windows, then the person's weekly default, unless someone typed over it.

Leadership's brief asked for demand plus capacity plus capability, and framed the question as "who is the best person to place here?", not "who happens to be free?". Behind it sat two real problems: time spent on last minute coverage, and doctors overloaded at one office while capacity sat idle at another.

<div class="aside">
<strong>What the workbook could not do.</strong> Look further ahead without more pasting. Count past its fixed ranges. Remember the rules behind a typed over cell. Notice a Syracuse surgery entered on a Friday, a day that office is closed. Or know what Denticon actually had booked.
</div>

## The rules I set before writing code

On September 11 I wrote the spec and sent our operations lead eleven questions where the workbook was ambiguous, each with a default already coded so nothing waited on her answer. A few constraints were fixed from day one.

**Read only toward Denticon.** The planner shows availability, gaps and who to ask. A person makes the actual change in Denticon. I did not want that to rest on good intentions, so the contract every appointment source implements has only read methods, and a test holds it there at the type level:

```ts
// packages/engine/test/types.test.ts, lines 14 to 28
// Spec invariant 3.3.1: no write path to a source system exists.
type WriteShapedName =
  | `write${string}`
  | `create${string}`
  | `update${string}`
  | `delete${string}`
  | `cancel${string}`
  | `book${string}`;

type WriteShapedMembers = Extract<keyof AppointmentSource, WriteShapedName>;

describe('AppointmentSource', () => {
  it('has no write shaped member', () => {
    expectTypeOf<WriteShapedMembers>().toBeNever();
  });
```

If anyone adds a `cancelAppointment` to that interface, the typecheck fails in CI and again in the deploy.

**HIPAA from the first commit.** Signed in staff can see patient names, so there are two roles, admin and viewer, and no grant means viewer. Every write is a server action that ends in an audit row. Logs never carry a patient detail.

**Burnout is a constraint, not a side effect.** The defaults: a day is worth 480 chair minutes, 420 booked minutes makes a heavy day, and a run that goes past three heavy days in a row puts that person on the overloaded list. Nothing in the planner treats a packed schedule as the goal. Our operations lead has not confirmed those numbers yet.

**Explainable rules only.** Cover suggestions rank candidates on five keys in order: capability for the appointment type, willingness to work at that office, already being there, a provably free day, and a preferred assistant or coordinator also free. Ties break on person id, and every reason on screen comes from the rule that produced it. Generated advice is deferred on purpose.

## One engine, run in two places

All the planning math lives in one pure TypeScript package with zero IO: availability, coverage, cadence projection, bandwidth, gaps and cover suggestions. No database, no network, no clock. The same functions run in the minute sync on the server and in the browser when someone asks what happens if a doctor takes Thursday off. Two copies of a rule cannot drift apart if there is only one copy.

Being pure also made it testable against the real thing. A small script reads the workbook's Q3 week blocks, all 360 day cells (nine people across forty weekdays), and never opens the two sheets that hold patient rows. It derives the typed over cells by difference: any value the formula chain would not have produced becomes an override row. Fifteen qualified. Then the engine has to match every one of the 360 cells. A second test scans the fixtures against the workbook's patient column, and when it fails it prints a count, never a value.

<div class="stat-callout stat-emerald">
  <div class="stat-value">360 of 360</div>
  <div class="stat-label">The engine reproduces every day cell in the workbook's Q3 blocks, including the fifteen typed over by hand. It is the test that told me each later rule change had not broken the old ones.</div>
</div>

The rest of the stack is boring on purpose: Next.js 16 and React 19 to match our [treatment estimator](/posts/treatment-estimator), Postgres 16 on Cloud SQL with Drizzle because "this person, on this weekday, at this office, joined to these appointments" is a relational question, and NextAuth with Google sign in, because the audit log and the two roles need a real signed in identity. It runs in its own Google Cloud project so patient data is fenced off, and it deploys only from a version tag.

The data path is three hops. Denticon feeds the [CDF patient dashboard](/posts/patient-dashboard), which keeps a mirror and serves it over a registry API, and the planner reads that every minute: a change read most minutes, a full read at least hourly. The planner holds no Denticon credential at all. A failed sync still answers the scheduler with a 200 so it never becomes a retry storm, and the staleness shows on a status pill instead.

## What live data broke

Production switched to live Denticon data early on September 29, less than a day after the first deploy. Within hours the real schedule showed me two things the workbook never could have.

**One doctor, three rows deep.** Denticon books the doctor as the provider on visits in his assistant's chair too. Bandwidth counted by Denticon provider, so at Buffalo one doctor stacked three rows deep across his own chair, the intake chair and the surgery chair. The fix was a chair table: each Denticon chair gets a row saying who runs it and what it is for, and a visit in an assistant's chair now lands on that assistant's lane.

**"Need Dr" on a day with two doctors.** Coverage carried the workbook's rule over: patients booked and no doctor scheduled means Need Dr. But "scheduled" came only from the roster rules. On September 28, Syracuse showed Need Dr while Denticon had two doctors booked there with patients that day. The plan said one thing and the bookings said another, and the bookings were right.

So Denticon now outranks the plan. This is the top of the chain every person's day runs through:

```ts
// packages/engine/src/availability.ts, lines 193 to 229
      const override = overrides?.get(date);
      if (override !== undefined) {
        byDate.set(date, override);
        continue;
      }

      if (timeOff.some((row) => inRange(date, row.startDate, row.endDate))) {
        byDate.set(date, { kind: 'off', location: null, decidedBy: 'time_off' });
        continue;
      }

      // A block note in Denticon says they are out.
      const noted = notes?.get(date);
      if (noted === null) {
        byDate.set(date, { kind: 'off', location: null, decidedBy: 'block_note' });
        continue;
      }

      // Denticon has them booked somewhere that day, so that is where they are.
      const bookedAt = booked?.get(date);
      if (bookedAt !== undefined) {
        byDate.set(date, { kind: 'chairside', location: bookedAt, decidedBy: 'denticon' });
        continue;
      }

      // A block note in Denticon says which office they are at.
      if (noted !== undefined) {
        byDate.set(date, { kind: 'chairside', location: noted, decidedBy: 'block_note' });
        continue;
      }

      // The doctor calendar says where they will be that day.
      const plannedAt = planned?.get(date);
      if (plannedAt !== undefined) {
        byDate.set(date, { kind: 'chairside', location: plannedAt, decidedBy: 'calendar' });
        continue;
      }
```

Below it come the fellow's date windows, the weekly pattern and the home default. The override at the top is the workbook's typed over cell made visible: a row with a reason, and an Undo.

The order is an argument, not an accident. Time off beats a booking because a booking on a vacation day means patients who need rescheduling, and those show up on the Needs action tab. A booking beats the shared doctor calendar because a calendar is a plan and a booking is what happened. A Denticon block note saying a doctor is out goes ahead of the bookings, because it is news the bookings have not caught up with yet.

Those block notes needed restraint. Staff type free text into reserved blocks, so the reader acts only on a note that names exactly one doctor and says plainly out, here, or at an office. A note that hedges with "poss" or a question mark, covers part of a day like "out at 2pm", or says two things gets left alone. On my local copy of the data it acted on roughly one noted block in ten. I would rather it miss a note than move a doctor on a guess.

<div class="stat-callout stat-blue">
  <div class="stat-value">every cell says why</div>
  <div class="stat-label">Each day carries the rule that decided it: Override, Time off, Denticon block note, Booked in Denticon, Doctor calendar, Fellowship window, Weekly pattern or Home default. The hover names it, so nobody has to trust a cell they cannot explain.</div>
</div>

## The bug that could have cancelled an office

A full read works by sweep. Upsert everything CDF lists for an office and date range, then cancel whatever the planner held in that range that CDF no longer lists. That is how a visit cancelled in Denticon disappears from the planner. It is also a loaded gun.

On September 28, while planning the sync, I read through CDF's older schedule route, the one built for a single day view, and found it dropped an unknown office code instead of refusing it. Harmless for a day view. For the planner, one wrong code would come back looking like "this office has no appointments", and the sweep would cancel that office's whole calendar. Nothing would have thrown an error.

I closed it from three sides. The new registry routes refuse an unknown office outright, and the planner checks that the offices CDF says it read are exactly the ones it asked for. Full reads are all or nothing: a full read is split into 31 day windows and writes nothing unless every window answered, because a missing window would look like a cancelled month. And the sweep has its own guard:

```ts
// apps/web/lib/import/syncBatch.ts, lines 341 to 356
    // Counted before the sweep so a read gone wrong changes nothing at all:
    // throwing here rolls the whole transaction back, the upserts included.
    if (sweep && batch.guard) {
      const [counts] = await tx
        .select({
          active: sql<number>`count(*)::int`,
          stale: sql<number>`(count(*) filter (where ${appointment.syncBatchId} is distinct from ${batchId}))::int`,
        })
        .from(appointment)
        .where(inRange(source));
      const active = counts?.active ?? 0;
      const stale = counts?.stale ?? 0;
      if (stale >= batch.guard.min && stale > batch.guard.maxShare * active) {
        throw new MassCancelError(locationCode, stale, active);
      }
    }
```

The live sync refuses when a full read would cancel more than half of an office's booked rows and at least 20 of them. The error's message names the office and two counts, never a row, so it is safe to show in Sync history.

<div class="stat-callout stat-amber">
  <div class="stat-value">refuse, then explain</div>
  <div class="stat-label">A refused read leaves the last good schedule in place and a line in Sync history. A wrong sweep would have cost an office its calendar.</div>
</div>

## Keeping patient names out of the logs

Trivy flagged a SQL injection CVE in the version of Drizzle I was on, and the fix was an upgrade to 0.45. The upgrade had a quiet side effect: a failed query now throws an error whose message and stack carry the SQL and every bound parameter. A parameter can be a patient's name. A routine unique constraint error would have written one straight into Cloud Logging.

So the logger refuses to describe a query error by anything except facts about it:

```ts
// apps/web/lib/logger.ts, lines 47 to 52
  // A failed drizzle query's message and stack carry the SQL and every bound
  // parameter, and a parameter can be a patient's name, so it is logged by its
  // Postgres code, constraint and table, and by its stack frames alone.
  if (isQueryError(value)) {
    return { name: 'DrizzleQueryError', cause: dbErrorFacts(value), stack: stackFrames(value.stack) };
  }
```

An integration test drives a real duplicate insert carrying a patient style name through a server action and checks that no log line holds the name or the SQL. The same rule runs outward: the reschedule emails to office admin directors carry a count per office and a link, never a name.

## Small things that bit

<div class="aside">
<strong>A secret with a trailing newline.</strong> Secret Manager hands back exactly the bytes you stored, and the way I first stored the Google client id kept the newline from pressing Enter. A client id ending in a newline makes Google answer invalid_client, so sign in would have failed on the first deploy. The app now trims every secret it reads, and the runbook stores values with printf, which writes no newline. Three days later a cousin bit: a PowerShell pipe between two gcloud commands stored blank values, so secrets move through files now.
</div>

<div class="aside">
<strong>The font the bundler dropped.</strong> Our house design standard loaded Inter with an @import from Google Fonts. Once that stylesheet stopped being the first one in the bundle, the bundler dropped the @import without a word, and production drew every screen in the system fallback font for a few releases. Inter now ships with the app as one self hosted file, so a screen full of patient names never makes a request to a third party either. A test pins the file and fails on any remote @import.
</div>

## Where it landed

The planner went live on September 28 and has read live Denticon data every minute since the next morning. By October 5 it was on v0.44.0, after 48 releases and 70 pull requests. Each tab answers one question. Calendar: what is booked in each chair. Coverage: who is where, and does every office have a doctor. Needs action: every patient to reschedule or place, eight weeks out. Bandwidth: who has free time, with suggestions that match a doctor's light day to where help is needed. Then Time off, Projector, Team and Settings.

Real use started shaping it right away. On October 1 a practice director's request was, word for word, "I need an undo button!" It shipped as v0.38.0 the same day.

| The workbook | The planner |
|---|---|
| Twenty pasted week blocks | One rolling view over any range |
| COUNTIF over fixed rows | Coverage computed over everyone on the roster |
| A typed over cell that forgets its rules | An override row with a reason, the rule underneath on hover, and Undo |
| Time off that only the weekly view read | Time off read by every view, with booked patients flagged to reschedule |
| Who is where, from the roster alone | Denticon bookings, block notes and the doctor calendar, in a stated order |

Now the honest part. I have not measured hours saved. I do not have a before number for how long the workbook took each week, and I would rather say that than invent one. Several of our operations lead's answers are still open: each office's hours (the planner uses 8 to 5 until she types them in), categories for the 44 Denticon appointment types that are not mapped yet, which days Syracuse really opens, and whether the heavy day numbers are right. Nobody is entering surgery dates in the Projector yet, so the check for projected visits that never got booked has nothing to report. Assistant and front desk schedules come later.

What I would keep from this one: write the old system's rules down cell by cell before replacing it, and make the new engine prove it reproduces them. Then get onto live data as early as you can, because the plan and the real schedule disagree in ways no spec predicts. And anywhere software can cancel something at scale, make it refuse first and explain itself second.
