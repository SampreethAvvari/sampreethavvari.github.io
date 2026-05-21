---
title: "Loan Radar: building the boring parts of an ML platform on purpose"
date: "2025-05-01"
layout: ../../layouts/PostLayout.astro
description: "A loan-default scoring service with the boring parts actually built: containerised training, MLflow lineage, quality gates, an Airflow retraining DAG. The gates mattered most."
img_path: "/loan-radar.svg"
img_alt: "Loan Radar architecture — training, lineage, gates, inference, retraining"
---

Most ML projects I'd seen up close had the same shape: a Jupyter notebook with a 90% accurate model, a Flask wrapper, and a long tail of operational questions (when do we retrain, who reviewed this, what data version did it see, how do we roll back) that the team got to "later." Later usually meant "after the production incident."

Loan Radar was a grad-school project to flip that ratio. Make the boring 85% the focus on a problem (loan-default scoring) where the model itself is well-understood.

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

A benchmark harness measures three things on a single 2-CPU container with the production model:

| | Value |
|---|---|
| Median latency, single caller | **0.79ms** |
| p95 latency, single caller | **0.87ms** |
| Sustained throughput before p99 climbs | **~33,000 samples / second** |

Numbers exist because the harness exists. Plenty of teams quote "tens of thousands of QPS" off back-of-envelope math. Running the load test is the difference.

## Retraining is half automated, half human

The Airflow DAG runs weekly:

1. Pull the latest data manifest.
2. Skip if manifest diff is below threshold.
3. Train the container against the new manifest.
4. Run the six gates.
5. If green, promote to staging + Slack ack required.
6. After human ack, canary roll to production.

The Slack ack is deliberate. Fully automated production rollouts on a financial model are a thing you do only if your rollback story is trivially safe. The five-minute human pause is cheap compared to the cost of an automatic rollout that violates a calibration assumption nobody'd thought to write a gate for.

## What this taught me

> The boring parts are the parts. A 99% accurate model with no lineage and no gates is operationally worse than a 92% accurate model with both.

The Hybridge work I did later carries the same DNA. The [CBCT validator](/posts/cbct-scan-validator) has a CICT gate before any promotion. The [consultation QA pipeline](/posts/clinical-rag) has schema-validated outputs and a single-retry contract. Both use a hot-swap deploy shape so retrains don't need a rebuild. Both share a single ETL module across train and serve.

Those patterns came out of Loan Radar.

I built Loan Radar because I didn't want to learn those lessons in production. Now every system I ship starts with the gates.

Live demo: [Loan Radar](https://hi.switchy.io/cv-i).
