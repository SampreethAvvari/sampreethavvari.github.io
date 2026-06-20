---
title: "Four bugs my test suite couldn't catch"
date: "2026-06-20"
layout: ../../layouts/PostLayout.astro
description: "A wheel that passed a thousand tests and still failed to deploy. 40% of real calls coming back 'not gradeable.' Reruns that forked a call's history. A transcriber that heard the practice name a dozen wrong ways. Real episodes, real fixes."
img_path: "/npc-coach-bugs.png"
img_alt: "A green test gate next to a red production failure — the gap between code that runs and code that ships"
tag: "Process"
tone: "blue"
stats:
  - value: "1,156 green"
    label: "tests that still missed the packaging break and the 40% drop-out"
    tone: "amber"
  - value: "~40% → low"
    label: "calls that came back 'not gradeable,' before and after the fix"
    tone: "emerald"
  - value: "1 call = 1 record"
    label: "reruns reattach instead of forking the history"
    tone: "blue"
---

*Part of a series on the [New Patient Coordinator coaching platform](/posts/npc-coach-rebuild). The polished version of a project hides exactly the parts worth writing down, so here are four episodes that actually cost me time.*

## The wheel build that passed every test and still failed to deploy

**Situation.** The first Cloud Run deploy failed at image-build time, even though the entire test gate was green.

**Task.** Figure out why a thousand passing tests didn't catch a build break.

**Action.** The packaging config had a `force-include` table that re-added the report templates and the built frontend — both of which already lived inside their package directories. The packaging tool ships *every* file under a package directory, not just the Python files, so the build tried to add the same file to the archive twice and errored out. Why the tests never saw it: the test gate uses an editable install, which never actually builds a wheel. The Docker image does a real, non-editable install, so it tripped the collision on the very first deploy.

**Result.** I removed the redundant table; the assets still ship through the normal package directories, verified by counting them in the built wheel. The lesson stuck: **a green test gate proves the code runs, not that it packages.**

## Forty percent of calls came back "not gradeable"

**Situation.** On the first real batch, close to 40% of relevant calls failed grading entirely. The scorer would try to produce a structured verdict, fail validation twice on the most garbled transcripts, and give up.

**Task.** Get those calls graded without lowering the bar on the calls that grade cleanly.

**Action.** Two things were fighting the model. First, the output schema *required* a verbatim evidence quote for any non-zero criterion — and on a garbled transcript the model couldn't always find an exact substring, so a perfectly reasonable score got rejected on a technicality. Second, the smaller model occasionally just couldn't satisfy the full schema. I loosened the evidence requirement from mandatory to advisory, made the remaining failures *diagnosable* instead of silent, and added an eval-time relevance gate so calls that should never have reached the scorer get filtered earlier.

**Result.** Far fewer calls drop out, and the ones that still fail now report *why* — which turns a black box into a fixable list.

<div class="stat-callout stat-emerald">
  <div class="stat-value">diagnosable beats silent</div>
  <div class="stat-label">A call that fails grading and tells you why is a to-do item. A call that fails silently is a hole in your data you'll find weeks later, if ever.</div>
</div>

## Reruns that forked the call history

**Situation.** When a call was rerun or auto-retried, the pipeline could create a *fresh* record instead of updating the original — splitting one call's history across two IDs.

**Task.** Make a rerun share the original call's identity and lineage.

**Action.** I scoped the orchestrator's claim to the original `call_id` paired with the job, so a rerun reattaches to the same call rather than minting a new one.

**Result.** One call, one record, no matter how many times it's reprocessed. This is the kind of bug the two-stage review process caught before it ever reached a real call — every plan went through a spec review and a separate code-quality review, and each pass caught at least one real bug.

## Transcripts that misheard the practice name a dozen ways

**Situation.** The transcriber rendered "Hybridge" as "High Bridge," "Amadana," "Hyperjet Omaha," "Hudson Living," and more. There is no Omaha office. There are two practices, across Rochester, Buffalo, and Syracuse.

**Task.** Clean the names without paying to re-transcribe hundreds of calls.

**Action.** Re-transcribing costs money, so instead I edit the stored transcript text in place for the known misheard names, and going forward I feed the real practice names into the transcription prompt so the model has the right vocabulary up front.

**Result.** Cleaner transcripts and cleaner reports, at no extra transcription cost.

## Recordings that played fine for the phone system and not at all in a browser

**Situation.** Recording playback landed in the dashboard, and the files would not play. The phone system stores call recordings as GSM 6.10, a codec a browser's audio element does not handle.

**Task.** Get recordings playing inline so a coach can listen to the exact moment a quote came from, without re-fetching or re-processing them on every view.

**Action.** The recording is fetched on demand and transcoded to MP3 before it reaches the browser, so the player gets a format it actually supports while the stored source stays untouched.

**Result.** Recordings play inline right next to the report. A coach can hear the call instead of taking the transcript's word for it, which matters when the whole system is built on quoting the transcript back.

## The thread

Every one of these passed the test suite. The wheel collision lived in a code path tests don't exercise. The 40% drop-out only showed up against real, garbled audio. The rerun fork needed a real retry to surface. The misheard names needed a real transcriber on real accents.

A green suite is necessary, not sufficient. It proves the logic runs; it does not prove the thing packages, deploys, survives bad input, or hears your company's name. Ship the smaller correct thing, watch what real data does to it, and let *that* write your next ticket. The wins from doing exactly that are in [the rebuild story](/posts/npc-coach-rebuild).
