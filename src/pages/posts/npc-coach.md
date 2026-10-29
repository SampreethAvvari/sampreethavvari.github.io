---
demo: /demos/npc-coach
title: "Every new patient call graded, with the quote behind each score"
date: "2026-06-21"
layout: ../../layouts/PostLayout.astro
description: "The old grader sent a number out of 60 and a Google Doc link. Mine has graded 690 real calls with a quote behind every score, a median 14 minutes after the call ends."
img_path: "/npc-coach.png"
architecture: "npc-coach"
img_alt: "New Patient Coordinator coaching platform: call recordings in, evidence backed coaching reports out"
tag: "AIE"
tone: "emerald"
stats:
  - value: "690 calls"
    label: "graded since June 17, out of 28,745 recordings the poller read"
    tone: "emerald"
  - value: "14 min"
    label: "median from the end of a call to its grade, across 172 calls in October"
    tone: "blue"
  - value: "16 days"
    label: "from the first commit on June 2 to grading live calls on June 18"
    tone: "amber"
facts:
  - label: "Problem"
    value: "The old grader sent a score out of 60 and a Google Doc link, with no quote behind it."
  - label: "What I built"
    value: "A grader for every new patient call, with a transcript quote behind each criterion score."
  - label: "Who uses it"
    value: "New Patient Coordinators get a report per graded call; leaders get a 5 PM summary."
  - label: "Outcome"
    value: "690 calls graded since June 17; in October the median grade came 14 minutes after the call ended."
  - label: "Runs on"
    value: "A Cloud Run Job every five minutes, 6 AM to 6 PM, with Gemini transcribing and judging."
  - label: "Built"
    value: "16 days from the first commit on June 2 to grading live calls on June 18, 2026."
---

## The problem

A New Patient Coordinator, an NPC, takes the first phone call. The caller is often nervous and sometimes in pain, and that call decides whether they ever walk in. The practice founder wrote the playbook for it. The founder's rule: the NPC is the patient's "first advocate, not a clinician, not a salesperson," and "correctness always beats conversion."

A grader already existed, built in n8n. Every hour it scored calls as a flat sum out of 60, wrote each result into a Google Doc named after the patient, shared it with the whole company and emailed a link. No database, so no NPC had a trend. No quote behind a score, so nobody could say why a call got a 47. If the workflow died halfway, the call was simply gone.

The phone system also records everything: 6,670 recordings in October, most not new patients.

## What I built

NPC Coach grades every new patient call and puts the result in front of the NPC who took it. Every five minutes from 6 AM to 6 PM, a Cloud Run Job takes the files it has not seen from the phone system's SFTP drop. Lines that are not NPC stations, call park recordings and calls under a minute stop there. Gemini transcribes the rest, and a strict Gemini Pro check asks whether this really is a new patient talking to an NPC before any grading.

The grade is six criteria from 0 to 10, each with a quote from the transcript, plus three hard gates: did the NPC say who they are, get the patient's name, and frame the source as a referral. The NPC gets the report by email, a summary goes out at 5 PM on weekdays, and a dashboard behind Google sign in holds every call and trend. [Open the drawing](/architecture/npc-coach).

## The sprint

First commit: June 2. On June 3 I worked from 2:13 AM to 8:10 PM on scoring, transcription, tagging and ingestion, each behind a port and written test first.

The first batch of real calls ran just after midnight on June 18, sixteen days after the first commit. That night I took the score cap out at 3:05 AM, found the real cause of the "not gradeable" calls, and shipped the uncooperative caller flag at <span class="egg" tabindex="0" data-egg="It needs quoted evidence, and being brief never counts. I was very brief at 4:49 AM.">4:49 AM</span>. The poller job went live at 5:25. The next night brought the report email, recording playback, the 5 PM summary and the Pro relevance gate.

A few days in, our COO asked, "is a 60.5 from one call or several?" By June 23 every average carried its call count. In July, NPCs disputed four grades; the founder ruled, and the rubric changed on July 23. On August 4 the founder ruled that NPCs may quote the cost range on the practice website, and that shipped the same afternoon as prompt 1.5.0.

## The hard parts

**A flag beside the score.** The first rubric capped any call that failed a hard gate at 49. On real calls that destroyed information: a warm, well sequenced call with one retail phrase collapsed to 49 and told the coach nothing else. Now the score is the plain 40/40/20 weighted sum and a failed gate is a loud red banner beside it. A call can read 84 and still be flagged. 125 of the 690 graded calls carry that banner.

**"Not gradeable" was a number format.** About 15 of the first 43 real new patient calls came back with no score. I assumed <span class="egg" tabindex="0" data-egg="It also heard the practice name as Hyperjet Omaha. None of our three offices is in Nebraska.">garbled transcripts</span>. The cause was smaller: Gemini sometimes wrote its confidence as 95 instead of 0.95, the schema allowed at most 1.0, and the whole verdict was thrown away. The fix coerces that field, records which field failed, and sends the error back for one repair try.

**Every report went out twice.** The trainer and an NPC both got two emails for every call. Cloud Scheduler fires every five minutes whether or not the last run finished, and a run was making about 7,700 SFTP stat calls, so runs overlapped and each graded and emailed the same new call. On July 23 the poller started skipping known file names before touching SFTP, and a Firestore lease let only one run work at a time:

```python
# src/processor/poll_lock.py
try:
    self._ref().create({"holder": holder, "expires_at": self._now() + self._lease_s})
    return True
except AlreadyExists:
    return False
```

Create fails if the lease exists, so that one call is the whole lock. If Firestore is down it fails open: a duplicate email beats no grading.

## What I said no to

**Grading booking rate.** The rubric has no booking criterion. In the playbook's words, a patient who books "just to get off the phone" is "a failure of advocacy, not a success."

**Letting the model do arithmetic.** Gemini returns six integers, three gate answers and an urgency state, and a Python function turns them into the score. Same verdict, same number. Moving scheduling from 20 to 30 percent is one line of code.

**The full design on day one.** The plan had queues between every stage. I wired one process instead, so real calls were graded on June 18. The queue Terraform is still in the repo, never applied.

## Where it landed

Seven NPC lines are on the allow list. Each NPC gets a report for every graded call, their numbers colored against their own 30 day average. Leaders get the 5 PM summary, and since October 5 so does every NPC with a graded call that day. Since June 17 the poller has read 28,745 recordings and graded 690 calls; in October it graded 172, a median 14 minutes after the call ended. 34 graded calls have been pulled out of the averages.

No cost yet: this project's billing export only switched on Oct 28, 2026, so there is no measured month.

I have not measured whether coaching moved the scores. The grading prompt changed four times on live data, so a raw before and after would compare different rulers. A design for call intelligence and insights is written and not built.

What I would keep: a quote behind every number, the arithmetic in code, and when a job sends email, only one copy of it running.
