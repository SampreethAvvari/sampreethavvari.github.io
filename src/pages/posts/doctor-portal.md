---
title: "From top priority to a live doctor portal in under four hours"
date: "2026-10-28"
layout: ../../layouts/PostLayout.astro
description: "Doctors who scanned, then sent the Rx, ended up with two lab cases and got scared when we cancelled one. I built a portal where the Rx joins the scan's case. Early, on sample data."
img_path: "/doctor-portal.png"
architecture: "doctor-portal"
img_alt: "A glass prescription sheet sliding into the case folder a scanner already opened"
tag: "Architecture"
tone: "blue"
stats:
  - value: "3.7 hours"
    label: "from the sync that made it top priority to a working live link on Oct 28"
    tone: "emerald"
  - value: "9 minutes"
    label: "from the revision that failed its first visit to the one that fixed it"
    tone: "blue"
  - value: "4 things"
    label: "still pretend, listed at the end of every release note: sample data, files by name, payments and emails off, no doctor sign in"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Doctors who scanned, then sent the Rx, got two lab cases and were scared when one was cancelled."
  - label: "What I built"
    value: "A doctor portal, from the lab lead's own mockup, where the Rx joins the case the scanner opened."
  - label: "Who uses it"
    value: "Meant for the more than 200 outside doctors who send our lab work; the lab lead reviews it now."
  - label: "Runs on"
    value: "Cloud Run and Firestore, behind Google IAP, open only to Hybridge Google accounts for now."
  - label: "Built"
    value: "3.7 hours from the October 28, 2026 sync that made it top priority to a working live link."
  - label: "Status"
    value: "Preview on sample data; real lab data waits on the Digital Gateway license and a vendor call."
---

## The problem

Our dental lab makes the teeth for implant cases, and more than 200 outside doctors send it work. A doctor scans the patient, and the scanner opens a case in MagicTouch, the lab's case system. Then the doctor writes the prescription in MagicTouch's own doctor portal, which cannot edit a case that already exists. So the Rx opens a second case.

The lab knew which one to keep. The doctor did not. In our lab lead's words, the doctors "see us cancel one and then they get freaked out." The lab lead also said the old portal had "a few workarounds that are confusing to our team," and that doctors reached the lab by email, text, phone and MagicTouch. The ask was one place for all of it.

## What I built

A doctor portal built from the lab lead's own July mockup: Submit Rx, Cases with approvals and messages, Accounting, Resources and Account. The core move is simple. The doctor sends the scan from the scanner, then adds the Rx to that same case here.

It is early. Everything runs on one made up practice, and only Hybridge Google accounts can sign in. A switch in the bar flips between the doctor's view and the lab's, which stands in for MagicTouch until a real link exists. [Open the drawing](/architecture/doctor-portal) to see what is live and what is planned.

## The sprint

The repo started at 2:12 AM on September 29 with a different idea: a morning list of duplicate cases for customer service to merge. It was deployed on sample data that night, last fix at <span class="egg" tabindex="0" data-egg="That fix: Git Bash had helpfully turned the sign in audience into a Windows path. Every sign in was refused, mine included. The deploy script now reads the setting back.">12:51 AM</span>. At the 11:31 AM sync that day, the lab lead turned it down.

Then the portal sat for four weeks behind other work.

On October 28, at the 11:30 AM sync, the lab lead made it the top priority and asked for a live link, starting at version 0.1.

- 12:59 PM: v0.1, most of the lab lead's mockup on sample data.
- 2:20 PM: v0.2. It worked but read like a spreadsheet, so the tables came out.
- 3:00 PM: drag came back. In July the lab lead had asked to arrange the case view their own way and keep it.
- 3:03 PM: first revision live. It failed its first visit.
- 3:12 PM: 0.2.1 live and working, with a version pill and a What's new page. 3.7 hours after the sync started.

v0.3 added a Feature requests tab the next afternoon. I deploy by hand from main, so no CI minutes are spent.

## The hard parts

**One case rests on a question nobody has answered.** In the portal, an Rx sent against a scan case joins it, and the send refuses a case that already has an Rx. That part is code. Whether MagicTouch's API can add an Rx and files to a case the scanner created is not. The vendor says one API only sees its own cases and the other has no file endpoints. It is the first question for a vendor call planned for early October that has not happened.

**My laptop lied to me.** On my laptop the portal keeps documents in memory. Deployed, they go to Firestore, which refuses an array directly inside an array, and an Rx keeps each answer as a question and answer pair. The memory store never complained, so the first revision died on its first visit. The fix wraps inner arrays on the way in and unwraps them on the way out:

```ts
// apps/portal/lib/store/firestoreCodec.ts
if (Array.isArray(value)) {
  const items = value.map((v) => toFirestore(v, true));
  return insideArray ? { [WRAP]: items } : items;
}
```

Now a live round trip test, and a script that fills the store before anyone visits, catch it first.

**Colour that answers one question.** Whose move is it? Amber is yours, blue is the other side, green is on its way, red is stuck. One function decides it for both views, so a case waiting on approval is amber for the doctor and blue for the lab. Work sits in lanes of equal width, with a written rule against an <span class="egg" tabindex="0" data-egg="A lone card on the last row of a grid. I sent a screenshot of one, called it weird, and it became rule one in the design file.">orphan card</span>.

## What I said no to

**Merging duplicates after the fact.** That was the September build. The lab lead said no, and was right: a merge on our side still leaves the doctor watching a case get cancelled. I parked it instead of polishing it, and kept its MagicTouch code.

**Pretending the link exists.** Every release note ends with the same four lines: sample data only, files listed by name only, payments and emails off, doctors cannot sign in yet. A feed of upload emails from the old portal, 1,664 since March 27, would make the demo feel alive. It carries patient names, so it stays out.

**Doctor logins and a hole in the lab's network on day one.** Outside doctors will need their own sign in, after the core flow works on real cases. For lab data, the plan is a small connector on a lab machine that only sends changes out over HTTPS, so no port opens into the lab network.

## Where it landed

It has no real users yet. It is a live link on sample data for the lab lead to pick apart. I have no usage numbers.

The Google Cloud project it shares with the parked duplicate list cost six cents from October 1 to 28. The portal went live on the 28th, so its own month is not measured yet.

Real data waits on the Digital Gateway license at $126 a month, not bought; the vendor call; and the lab server's details and a read only login. File uploads to Cloud Storage are next and need none of them.

What I would keep: put the lab lead's own mockup on a live link the day it becomes the priority, and write down on every release what is still pretend.
