---
title: "How I caught my pipeline ghosting me (and made it confess)"
date: "2026-05-29"
layout: ../../layouts/PostLayout.astro
description: "Runs showed ✅ complete while emails never sent, Sheet rows never appeared, and whole meetings just weren't there. Nine flavors of silent failure, all swallowed by bare excepts. The fix was making the dashboard stop lying."
img_path: "/pipeline-ghosting.png"
img_alt: "Run dashboard with a green status pill that hides amber and red failures underneath"
tag: "Process"
tone: "amber"
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

A while back I wrote about [the pipeline that grades every implant consult](/posts/clinical-rag) against our CEO's seven-criterion rubric. Zoom drops a transcript, Gemini scores it, an email goes to the doctor + treatment coordinator + CEO, and a row appends to a master Sheet for trend analytics. Beautiful on paper.

In practice it was a polite liar. Runs would proudly show ✅ **complete** on the dashboard while, in real life:

- the email never went out,
- the Sheet never got the row,
- half my coordinators' meetings just… weren't there.

I'd been manually rerunning consults for two weeks and didn't know why. Meanwhile the CEO was actively testing in prod. Cool cool cool.

The task was simple to state and annoying to deliver: stop the lying. Every failure visible, every transient error retry-able, every state in sync, and the logs readable by humans who don't write Python.

## Nine flavors of silent failure, stacked like a sad lasagna

I went looking under the hood and found nine ways the pipeline could fail without ever admitting it.

**1. The missing-host mystery.** Two of our coordinators, Heather and Chelsea, had been migrated to `@hybridgeimplants.com` mailboxes. The allowlist only knew their old `@elmwooddental.com` versions. Every meeting they hosted under the new domain just quietly `return`-ed. I added multi-email TCs to `host_mapping.yaml` — a YAML edit now handles it, no Secret Manager dance.

**2. The rerun ghost button.** `RerunBody.send_email: bool = False`. Click *Rerun*, get a green checkmark, no email lands. Flipped the default.

**3. The bare-except graveyard.** Gmail blips, Sheets blips, OAuth refresh blips — all swallowed while the run marched on to mark itself "complete." Every silent failure now surfaces as amber **needs attention** with a plain-English line.

**4. The yellow that wasn't there.** The All Runs tab painted *running* yellow and *failed* red; the picker painted *failed* yellow. Same run, two different yellows in two different tabs. I unified everything:

| Color | Means |
|---|---|
| 🟢 green | done |
| 🟠 amber | needs attention |
| 🔴 red | failed |
| 🔵 blue | running |

**5. The retry that wasn't.** A single 429? A single broken pipe? Silent kill. I added exponential backoff with jitter (1s / 2s / 4s) for HTTP 429/5xx, OAuth `RefreshError`, **and** `BrokenPipeError` / `ConnectionResetError` / `TimeoutError`. The connection-level ones bypass `HttpError` entirely — that one cost me a real run before I traced it in Cloud Logging.

**6. The rerun-creates-duplicates problem.** A successful rerun used to leave two rows in both the dashboard and the Sheet for one consultation. I built *rerun-replaces-old*: successful reruns delete the original doc and dedupe the Sheet row. Failed reruns leave the original alone, so I keep my known-good baseline.

**7. The disappearing runs.** Webhook events that died at the host gate, the dedupe step, or a download error — before scoring — left zero trace. I moved dashboard row creation to the very top of the webhook handler. Every event now leaves a clickable row, even if it died at step zero.

**8. The "logs are in Cloud Logging" excuse.** This one wasn't a bug, it was a wall. See below.

**9. The orphan-state problem.** A doc could say "Sheet appended" while the row wasn't there, or the reverse. See the reconciler, further down.

## Make the failures retry themselves

The connection-level errors were the sneaky ones. `HttpError` covers the 429/5xx case Google's client knows how to raise — but a `BrokenPipeError` or a `ConnectionResetError` comes up from the socket layer and never wears an `HttpError` jacket. So the retry decorator that only caught `HttpError` waved them straight through to a silent kill.

The fix was to retry on the union of all three families, with jittered backoff so a thundering herd of reruns doesn't synchronize into the next rate-limit wall:

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

## Two tabs of logs, one for each kind of human

The single biggest cultural fix was killing "the logs are in Cloud Logging" as an answer. I built a **Logs tab** on every run detail page, with two sub-tabs:

- **Easy view** — the nine pipeline stages as a stepper: ✅ ⚠️ ❌ ⏭ 🔄 ⏸. Each non-passed stage carries a one-line plain-English explanation plus a *what to do* line.
- **Developer view** — BigQuery audit events, Cloud Logging tracebacks, and the raw Firestore doc JSON.

A non-technical operator can finally tell what failed without learning what a `RefreshError` is. The CEO can read it. That alone ended the 11pm "why didn't I get the report?" emails.

## The reconciler that keeps the dashboard honest

The last piece is a consistency reconciler that runs after every status change. If the doc says "Sheet appended" but the row isn't there → flip the flag to amber. If the row *is* there but the flag says no → flip to green. The dashboard now mirrors reality automatically, instead of trusting a flag that was set optimistically before the work actually finished.

<div class="stat-callout stat-amber">
  <div class="stat-value">0 drift</div>
  <div class="stat-label">Doc state and real-world state now reconcile after every status change — the flag can't lie about what actually happened</div>
</div>

Then a sprinkle of one-off cleanup scripts to repair the damage already done: resent 13 silently-failed emails (without duplicates), backfilled 4 missing Sheet rows, deduped one stray row, and manually reconciled one stubborn Baleno consultation that had lost its scorecard to a broken pipe.

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

Seven production changes went out in one push: allowlist → durable rows → retry-on-transient → rerun-replaces-old → consistency reconciler → connection-retry hardening → Logs UI. Thirteen silent-failed emails got resent, zero duplicates delivered. And a CEO who can now read the dashboard without asking me what anything means.

The best part: the next time something breaks — and something always breaks — I'll know in five seconds, because the dashboard isn't allowed to lie to me anymore.

The lesson, free of charge: **`bare except` is technical debt accruing interest.** Every silent failure I caught had been swallowed by one. Make your code loud when things go wrong. Your future self will thank you, and your CEO will stop emailing at 11pm asking "why didn't I get the report?"
