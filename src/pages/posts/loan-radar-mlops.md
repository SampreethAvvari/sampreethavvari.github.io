---
title: "How I built the boring parts of an ML system on purpose"
date: "2025-05-01"
layout: ../../layouts/PostLayout.astro
description: "A loan-scoring service where I built the unglamorous parts on purpose: training in containers, model history, quality gates, automatic retraining. The gates mattered most."
img_path: "/loan-radar.png"
img_alt: "Loan Radar architecture — training, lineage, gates, inference, retraining"
tag: "MLOps"
tone: "cyan"
stats:
  - value: "0.79 ms"
    label: "median single-caller latency"
    tone: "cyan"
  - value: "~33k req/s"
    label: "sustained throughput before p99 climbs"
    tone: "blue"
  - value: "6"
    label: "quality gates before any promotion"
    tone: "emerald"
---

The hardest part of ML in production is not the model. The hardest part is everything that happens after: how you know when to retrain, who approved the version running right now, what data it was trained on, and how fast you can swap it out when something goes wrong. Most projects skip those questions. They show up as the post-incident follow-up six months later.

Loan Radar was a grad-school project built with that gap in mind. The domain is loan-default scoring, where the modeling problem is well-understood. I picked it precisely because it let me put all my time into the operational layer: lineage, gates, automated retraining, rollback paths. The stuff teams usually defer until the first fire.

## The whole system in one diagram

```
Container: train.py --config configs/baseline.yaml
        │
        ▼
MLflow run = code commit + data hash + hyperparams + metrics + weights
        │
        ▼ candidate
┌────────────────────────────────────────────────┐
│  6 quality gates                               │
│  ── min AUC                                    │
│  ── calibration vs reference                   │
│  ── subgroup fairness                          │
│  ── inference latency p95 ≤ 50ms               │
│  ── output-distribution KL on canary           │
│  ── serialised size cap                        │
└────────────────────────────────────────────────┘
        │  all green
        ▼
Staging → Slack ack → Production (canary rollout)

Weekly Airflow DAG re-runs the whole loop against fresh data.
```

## The six gates are the project

Every model run goes through the same six checks before it can be promoted. Any failure short-circuits the build:

```
gate_01_min_auc            held-out AUC ≥ floor
gate_02_calibration        Brier score within tolerance
gate_03_subgroup_fairness  no subgroup with TPR delta > threshold
gate_04_inference_latency  containerised p95 ≤ 50ms on the harness
gate_05_drift_canary       output-distribution KL within bounds
gate_06_size               serialised model under size cap
```

Reason they're scripts in git instead of checkboxes in a dashboard: it makes "did the model pass our quality bar" a deterministic, auditable thing instead of an opinion.

## Honest latency numbers, not vibes

A benchmark harness runs against the production model on a single 2-CPU container. Results: **0.79ms** median latency for a single caller, **0.87ms** at p95, sustained throughput around **33,000 samples/second** before p99 climbs.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-cyan">
    <div class="stat-value">0.79 ms</div>
    <div class="stat-label">median single-caller latency</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">~33k req/s</div>
    <div class="stat-label">throughput before p99 climbs</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">6 gates</div>
    <div class="stat-label">before any model can be promoted</div>
  </div>
</div>

Numbers exist because the harness exists. Plenty of teams quote "tens of thousands of QPS" off back-of-envelope math. Running the load test is the difference.

## Retraining is half automated, half human

The Airflow DAG runs weekly:

1. Pull the latest data manifest.
2. Skip if manifest diff is below threshold.
3. Train the container against the new manifest.
4. Run the six gates.
5. If green, promote to staging + Slack ack required.
6. After human ack, canary roll to production.

The Slack ack is deliberate. Fully automated rollouts on a financial model only make sense when rollback is trivially safe. A five-minute human pause is cheap compared to an automatic rollout that violates a calibration assumption nobody'd thought to gate on.

## What this taught me

> The boring parts are the parts. A 99% accurate model with no lineage and no gates is operationally worse than a 92% accurate model with both.

The Hybridge work I did later carries the same DNA. The [CBCT validator](/posts/cbct-scan-validator) has a gate before any promotion. The [consultation QA pipeline](/posts/clinical-rag) has schema-validated outputs and a single-retry contract. Both use a hot-swap deploy shape so retrains don't need a rebuild. Both share a single ETL module across train and serve.

Those patterns came out of Loan Radar.

The kind of engineer I want to be is the one who asks "how do we roll this back" before asking "what accuracy did we hit." Demos age out; gates are what survive contact with reality. Loan Radar was the project that taught me to build in that order.

Live demo: [Loan Radar](https://hi.switchy.io/cv-i).
