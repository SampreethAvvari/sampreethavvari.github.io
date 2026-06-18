---
title: "The compliance switch and other architecture I'd do again"
date: "2026-06-17"
layout: ../../layouts/PostLayout.astro
description: "Ports and adapters so the cloud is swappable, one flag that keeps real patient data out by default, scoring math kept out of the model, and the smaller correct thing I shipped before the full event mesh."
img_path: "/npc-coach-architecture.png"
img_alt: "Ports-and-adapters architecture — a single composition root binding either in-memory fakes or real cloud adapters"
tag: "Architecture"
tone: "blue"
stats:
  - value: "1 flag"
    label: "NPC_BAA_ACCEPTED gates every real-PHI path; safe state is the default"
    tone: "blue"
  - value: "1,156"
    label: "tests run with no network and no GCP credentials"
    tone: "emerald"
  - value: "$50-250/mo"
    label: "cloud spend target, mostly thanks to structural dedup"
    tone: "amber"
---

*Part of a series on the [New Patient Coordinator coaching platform](/posts/npc-coach-rebuild). The [scoring post](/posts/npc-coach-scoring) covers how a call becomes a number; this one covers the decisions underneath that I'd make again on the next healthcare build.*

A few design choices shaped everything else. None of them are clever. All of them are boring on purpose, which is exactly why they held up when real PHI started flowing.

## Ports and adapters, so the cloud is swappable

Every external dependency — storage, the transcriber, the scorer, the classifier, the patient registry, delivery — sits behind a port. The real Google Cloud adapters are bound at a single composition root. In tests, the same ports get in-memory fakes.

That's why the suite can run **more than a thousand tests with no network and no GCP credentials**, and why the exact same code runs locally on synthetic data and in production on real PHI without branching logic scattered through the codebase. Adding a new call source later is one new adapter, not a rewrite.

## A master switch for compliance

The whole system gates on one flag: `NPC_BAA_ACCEPTED`. When it's false, the app wires in the in-memory fakes and touches no real patient data — the safe default for demos and local work. Only when it's true does it bind the real cloud adapters.

This came out of a compliance fact that bites a lot of healthcare projects: **a Google Workspace BAA does not cover Google Cloud services.** Cloud Storage, Speech-to-Text, Vertex AI, and BigQuery need a *separate* Cloud BAA, and nothing real is allowed to flow until that's accepted. I made that a single line of config rather than a tribal rule someone has to remember.

<div class="stat-callout stat-blue">
  <div class="stat-value">safe by default</div>
  <div class="stat-label">Real patient data is one flag away from never touching the system by accident — and that's exactly where you want that decision to live: at the composition root, not in a wiki.</div>
</div>

## Deterministic scoring, outside the model

The model produces the six criterion scores, the gate booleans, and the urgency state. A pure Python function turns those into the final number. Keeping the arithmetic out of the LLM means the headline score is reproducible and I can change the weighting without re-prompting anything. (The [scoring post](/posts/npc-coach-scoring) has the actual formula and why this split matters so much.)

## Cost discipline through structural dedup

Inbound calls already arrive with a CallRail transcript, so we never pay to transcribe them twice — only outbound recordings hit the cloud transcriber. At the practice's volume that's the single biggest reason the Phase 1 cloud spend target lands around **$50-250 a month** rather than several times that. The cheapest API call is the one you structurally never make.

## An interim single-process pipeline

The full design is an event-driven mesh: Pub/Sub topics between every stage, Eventarc triggers, dead-letter queues. For the first real run I deliberately did *not* build all of that.

Instead I wired a direct, single-process pipeline backed by Vertex Gemini and Cloud Storage, so the dashboard could light up on real calls while the heavier eventing waits for its turn. Shipping the smaller correct thing first beat waiting on the full mesh — and it meant real calls, not my assumptions, got to vote on what to build next. The mesh is designed and queued; it just isn't the thing standing between the coordinators and their first coaching report.

## The thread through all of it

Put the irreversible decision where it can't be forgotten, keep the parts that must be reproducible out of the parts that are probabilistic, and ship the smallest correct slice so real data can correct you early. Three boring rules. They're the reason a solo build could carry real PHI on day one without me lying awake about it — and the rest of the war stories live in [the bugs the test suite couldn't catch](/posts/npc-coach-bugs).
