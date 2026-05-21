---
title: "Loan Radar: building the boring parts of an ML platform on purpose"
date: "2025-05-01"
layout: ../../layouts/PostLayout.astro
description: "A loan-default scoring service with the parts that usually get hand-waved actually built — containerised training, MLflow lineage, automated quality gates before promotion, retraining on Airflow, infra by Terraform, scale-out via Ray and Kubernetes. The interesting bit was the gates."
img_path: "/loan-radar.svg"
img_alt: "Loan Radar architecture — training, lineage, gates, inference, retraining"
---

## Situation

Most ML projects that I'd worked on or seen up close had the same shape: a Jupyter notebook with a 90%-accurate model, a Flask wrapper to call it from a UI, and a long tail of operational questions (when do we retrain, who reviewed this model, what data version did it see, how do we roll back) that the team got to "later." Later usually meant "after a production incident." The reality of running an ML system in front of users is that the model itself is something like 15% of the total system, and the other 85% is the surrounding plumbing nobody enjoys building.

Loan Radar was a project I built in graduate school (Jan-May 2025, NYU MS) to make that other 85% the focus, on a problem (loan default scoring on tabular financial data) where the model itself is well-understood and not the interesting part. The point wasn't to advance the state of the art on default prediction. The point was to make every operational concern that production-ML teams handle in real life into a concrete, runnable, dockerised component that I could point at when someone asked "how would you actually deploy this."

## Task

Build an end-to-end ML CI/CD system that:

- Trains a model in a reproducible container.
- Records every artifact (data version, hyperparameters, metrics, learned weights) to MLflow with lineage.
- Runs unit and integration tests against the trained model before any promotion.
- Promotes only on green gates, with rollback safety built in.
- Serves the model over a low-latency API with throughput characteristics you can actually measure.
- Retrains on a schedule from Airflow.
- Provisions all infrastructure from Terraform so the whole thing stands up reproducibly.
- Scales out to a cluster via Ray + Kubernetes when the training set or the inference traffic crosses a threshold.

That's a lot of "and." The whole point was that each "and" is a concrete component you can wire up, test, and stand up independently.

## Action

### Containerise training, with lineage from day zero

The training image runs a single command: `train.py --config configs/baseline.yaml`. The config is checked into git. The output of a successful run is an MLflow run record containing:

- The git commit hash of the training code.
- The hash of the data manifest used (a JSON descriptor pointing at versioned data in MinIO).
- All hyperparameters, including the random seed.
- Per-epoch metrics (loss, AUC, precision/recall at the operating threshold).
- The serialised model artifact, stored in MinIO under a key derived from the run ID.
- Any plots (ROC, calibration, feature-importance) written to the run.

The MinIO bucket plus a PostgreSQL backend gave MLflow the on-prem-shaped lineage store I wanted, instead of relying on a managed service. Every promoted model has a complete trace back to the data hash and code commit that produced it.

### Automated quality gates before any promotion

A "gate" in this system is a script that takes a candidate model run ID, loads the model and its metadata from MLflow, runs a battery of checks, and either marks the run as `promotable` or fails the build:

```
gate_01_min_auc            held-out AUC >= a configured floor
gate_02_calibration        Brier score within tolerance vs reference
gate_03_subgroup_fairness  no subgroup with TPR delta > threshold vs population
gate_04_inference_latency  containerised inference p95 <= 50ms on the test harness
gate_05_drift_canary       output-distribution KL on a canary dataset within bounds
gate_06_size               serialised model under a configured size cap
```

The gates run as a sequence in a CI pipeline; any failure short-circuits promotion and surfaces the failing gate in the build output. The model can't reach the inference image until every gate passes. The reason these are scripts in git rather than checkbox steps in a dashboard: it makes "did the model pass our quality bar" a deterministic, auditable thing instead of an opinion.

### Inference: FastAPI behind Uvicorn, benchmarked honestly

The inference service is a single FastAPI app with `/predict`, `/health`, and `/version` endpoints. Loaded model lives in-process, warmed up at startup. The benchmark harness I built measures three things:

- **Median per-request latency**, single concurrent caller.
- **p95 per-request latency**, single concurrent caller.
- **Sustained throughput**, scaled until p99 latency starts to climb.

The measured numbers on a single 2-CPU container with the production-sized model:

```
Median latency        0.79ms
p95 latency           0.87ms
Sustained throughput  ~33,000 samples / second
                      (before p99 latency starts walking)
```

Those numbers exist because the harness exists. Lots of teams quote "tens of thousands of QPS" off back-of-envelope math; getting a real number that you can compare across model versions requires actually running the load test, which the harness automates as part of CI.

### Retraining on Airflow

The retraining DAG runs weekly. Steps:

1. Pull the latest data manifest from the data lake.
2. Compute manifest diff vs last training run; if change is below a threshold, skip.
3. Spin up the training container against the new manifest.
4. Run the gate pipeline against the resulting run.
5. If gates pass, promote to staging; ping a Slack channel; await sign-off.
6. After sign-off, promote to production with a canary rollout.

The "ping Slack; await sign-off" step is deliberate. Fully automated production rollouts on a financial model are not a thing you do unless the rollback story is trivially safe. We had a rollback story, but the cost of a five-minute human ack was negligible compared to the cost of an automatic rollout that violated a calibration assumption nobody'd thought to write a gate for.

### Infrastructure as Terraform, scale-out via Ray on K8s

The whole stack stands up from Terraform: VPC, K8s cluster, MinIO, PostgreSQL, MLflow tracking server, Airflow scheduler, the inference Deployment with HPA, and the Ray operator. Adding a new environment (staging, prod, an experiment cluster) was a `terraform apply` with a different tfvars file.

Ray came in once the inference load profile in tests crossed a level where horizontal scale-out made sense. The K8s Deployment for inference scales on CPU; Ray was used for the training-cluster path where data sharding mattered (large-scale feature engineering passes that needed to fan out across worker pods).

### Tests, not just metrics

The repo's `tests/` directory has three layers:

- **Unit tests** on the data transformations, feature pipeline, and model wrapper. Pytest, fast.
- **Integration tests** that spin up an ephemeral MLflow tracking server in a container, run a tiny training job, and assert the resulting run has the expected lineage shape. Slow (seconds), but catches a class of bug that unit tests can't.
- **Acceptance tests** that compare the production-grade model on a frozen reference dataset. Same dataset, every commit. Drift in the acceptance numbers is a signal worth investigating.

The split is the same one you'd see in a normal software project, applied to ML. The reason it's worth calling out is that "we test our ML system" usually means "we run sklearn metrics on a held-out split." That's a unit test. Production ML systems need the other two layers too.

## Result

The deliverable was an end-to-end runnable system with the components above. Numbers worth pinning:

```
Per-request inference latency       0.79ms median, 0.87ms p95
                                    (single-instance container, prod-sized model)
Sustained throughput                ~33k samples/sec before p99 climbs
Training reproducibility            every model has a git commit + data manifest hash
                                    + MLflow run linked to its artifact
Promotion path                      6 automated gates + 1 human-ack canary rollout
Retraining cadence                  weekly Airflow DAG, skipped when data delta is below
                                    the configured threshold
Infrastructure                      100% Terraform-provisioned across staging + prod;
                                    Ray-on-K8s available for fan-out training jobs
```

The thing this project taught me, that I keep using on every system I've built since: **the boring parts are the parts.** A 99%-accurate model with no lineage and no gates is operationally worse than a 92%-accurate model with both. The Hybridge work I did later (the [CBCT scan validator](/posts/cbct-scan-validator), the [consultation QA pipeline](/posts/clinical-rag)) carries the same DNA: a CI/CT gate before any promotion, a single ETL module shared between training and serving so preprocessing skew can't happen, a hot-swap deployment shape so retrains don't need a rebuild. Those patterns came out of Loan Radar.

I built Loan Radar because I didn't want to learn those lessons in production. Now every system I ship starts with the gates.

Live demo: [Loan Radar](https://hi.switchy.io/cv-i).
