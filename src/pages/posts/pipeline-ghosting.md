---
title: "How I caught my pipeline lying to me (and made it confess)"
date: "2026-05-29"
layout: ../../layouts/PostLayout.astro
description: "Runs showed ✅ done while emails never sent, rows never appeared, and whole meetings just vanished. Nine kinds of silent failure, all hidden. The fix was making the dashboard stop lying."
img_path: "/pipeline-ghosting.png"
img_alt: "Run dashboard with a green status pill that hides amber and red failures underneath"
tag: "Process"
tone: "blue"
stats:
  - value: "51 / 0 / 0"
    label: "green / amber / red in the consistency audit"
    tone: "emerald"
  - value: "+50"
    label: "new tests on the exact silent-fail paths"
    tone: "blue"
  - value: "9"
    label: "flavors of silent failure, all swallowed by bare except"
    tone: "amber"
---

A while back I wrote about [the pipeline that grades every implant consult](/posts/clinical-rag) against our CEO's seven-criterion rubric. Zoom drops a transcript, Gemini scores it, an email goes to the doctor + treatment coordinator + CEO, and a row appends to a master Sheet. Beautiful on paper.

In practice it was a polite liar. Runs would proudly show ✅ **complete** while the email never went out, the Sheet never got the row, and half my coordinators' meetings just… weren't there. I'd been manually rerunning consults for two weeks and didn't know why, while the CEO was actively testing in prod. Cool cool cool.

The task: stop the lying. Every failure visible, every transient error retry-able, every state in sync, and the logs readable by humans who don't write Python.

## Nine flavors of silent failure, stacked like a sad lasagna

1. **The missing-host mystery.** Two coordinators were migrated to `@hybridgeimplants.com` mailboxes; the allowlist only knew their old `@elmwooddental.com` ones. Every meeting they hosted just quietly `return`-ed. Now multi-email TCs live in `host_mapping.yaml`, a YAML edit, no Secret Manager dance.
2. **The rerun ghost button.** `RerunBody.send_email: bool = False`. Click *Rerun*, get a green checkmark, no email lands. Flipped the default.
3. **The bare-except graveyard.** Gmail, Sheets, and OAuth blips all swallowed while the run marched on to mark itself "complete." Each one now surfaces as amber **needs attention** with a plain-English line.
4. **The yellow that wasn't there.** One tab painted *running* yellow, another painted *failed* yellow. Same run, two meanings. I unified the legend: 🟢 done · 🟠 needs attention · 🔴 failed · 🔵 running.
5. **The retry that wasn't.** A single 429 or broken pipe was a silent kill. Added exponential backoff with jitter for transient errors (more below).
6. **The rerun-creates-duplicates problem.** A successful rerun left two rows for one consultation. Built *rerun-replaces-old*: successful reruns delete the original and dedupe the Sheet; failed reruns leave the known-good baseline alone.
7. **The disappearing runs.** Events that died at the host gate or download step, before scoring, left zero trace. Moved dashboard row creation to the very top of the webhook handler, so every event leaves a clickable row even if it died at step zero.
8. **The "logs are in Cloud Logging" wall** and **9. the orphan-state drift**, both below.

## Make the failures retry themselves

The connection-level errors were the sneaky ones. `HttpError` covers the 429/5xx case Google's client knows how to raise, but a `BrokenPipeError` or `ConnectionResetError` comes up from the socket layer and never wears an `HttpError` jacket, so a decorator that only caught `HttpError` waved them straight through to a silent kill. The fix: retry on all three families, with jittered backoff so a herd of reruns doesn't synchronize into the next rate-limit wall.

```python
RETRYABLE = (HttpError, RefreshError, BrokenPipeError,
             ConnectionResetError, TimeoutError)

for attempt in range(MAX_RETRIES):
    try:
        return fn()
    except RETRYABLE as e:
        if attempt == MAX_RETRIES - 1:
            raise            # loud — surfaces as amber, never swallowed
        sleep(BASE * 2**attempt + jitter())
```

A transient blip is no longer a death sentence, and a permanent failure still raises loudly instead of being marked complete.

## Logs humans can read, state that can't lie

The biggest cultural fix was killing "the logs are in Cloud Logging" as an answer. Every run detail page now has a **Logs tab** with two views: an **Easy view**, the nine stages as a stepper (✅ ⚠️ ❌ ⏭ 🔄 ⏸), each non-passed stage carrying a plain-English line plus *what to do*, and a **Developer view** with BigQuery audit events, tracebacks, and the raw Firestore doc. A non-technical operator can finally tell what failed without learning what a `RefreshError` is.

Behind it runs a consistency reconciler after every status change: if the doc says "Sheet appended" but the row isn't there → flip to amber; if the row *is* there but the flag says no → flip to green. The dashboard mirrors reality instead of trusting a flag set optimistically before the work finished.

<div class="stat-callout stat-amber">
  <div class="stat-value">0 drift</div>
  <div class="stat-label">Doc state and real-world state reconcile after every status change, so the flag can't lie about what actually happened</div>
</div>

A sprinkle of one-off cleanup scripts repaired the existing damage: resent 13 silently-failed emails (no duplicates), backfilled 4 missing Sheet rows, deduped one stray row, and reconciled one stubborn consultation that had lost its scorecard to a broken pipe.

## Where it landed

<div class="post-stats-grid my-10">
  <div class="stat-callout stat-emerald">
    <div class="stat-value">51 / 0 / 0</div>
    <div class="stat-label">green / amber / red, with 0 drift and 0 duplicates in the audit</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">234</div>
    <div class="stat-label">tests green, +50 of them covering the exact silent-fail paths</div>
  </div>
  <div class="stat-callout stat-amber">
    <div class="stat-value">7 → 1</div>
    <div class="stat-label">production deploys shipped in a single push</div>
  </div>
</div>

The best part: the next time something breaks (and something always breaks) I'll know in five seconds, because the dashboard isn't allowed to lie to me anymore.

The lesson, free of charge: **`bare except` is technical debt accruing interest.** Every silent failure I caught had been swallowed by one. Make your code loud when things go wrong. Your future self will thank you, and your CEO will stop emailing at 11pm asking "why didn't I get the report?"
