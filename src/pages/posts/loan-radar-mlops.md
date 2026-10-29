---
title: "Loan Radar: training and serving that load one saved transform"
date: "2025-05-01"
layout: ../../layouts/PostLayout.astro
description: "A three person NYU class project that scores loan default risk from the public LendingClub book. I built the data pipeline and the tests, and made training and serving share one transform."
img_path: "/loan-radar.png"
architecture: "loan-radar-mlops"
img_alt: "Loan Radar architecture: training, lineage, gates, inference, retraining"
tag: "MLOps"
tone: "violet"
stats:
  - value: "0.79 ms"
    label: "median to score one loan row with the model in process, over 100 calls"
    tone: "cyan"
  - value: "1.81M"
    label: "loans in the training split, scored with 2 fold cross validation"
    tone: "blue"
  - value: "22,607"
    label: "held out loans the stress tests run the model on"
    tone: "emerald"
facts:
  - label: "Problem"
    value: "Credit risk officers wanted a low or high default risk label back while the applicant waited."
  - label: "What I built"
    value: "My part of a three person NYU project: the ETL, one saved transform for training and serving, and tests."
  - label: "Outcome"
    value: "ROC AUC of 0.71 in 2 fold cross validation, catching about two thirds of high risk loans."
  - label: "Runs on"
    value: "Chameleon Cloud, with XGBoost, MLflow, a Ray cluster and a FastAPI scorer."
  - label: "Built"
    value: "May 5 to 11, 2025, for the class demo."
  - label: "Status"
    value: "School project, not running; no lender used it."
---

## The problem

Our Machine Learning Systems course at NYU asked for a system, not a notebook. The brief we wrote named a user: credit risk officers at regional banks and micro finance lenders, whose rule based underwriting was slow and subjective. They wanted a low or high default risk label back while the applicant waited.

The data was the public LendingClub loan book, 2007 to 2018, about 2 GB of accepted loans. A model like this rarely fails on the math. It fails when the loan scored at serving time is prepared differently from the loans it learned from.

## What I built

Loan Radar was a three person project on Chameleon Cloud. My part was data engineering and offline evaluation: the ETL containers, the compose file that runs MLflow and a Ray cluster, and the pytest suite. Teammates ran training and built the FastAPI scorer, the Flask page and the monitoring.

The ETL pulls the loan book, turns each loan's status into a risk label, fits medians, modes, encoders and a scaler on the training rows only, and saves that fitted state as <span class="egg" tabindex="0" data-egg="joblib.dump on one side, joblib.load on the other. The whole train and serve contract is two calls.">one pickle</span> beside the data. Validation and the API both load it, so a loan gets the same treatment wherever it goes. [Open the drawing](/architecture/loan-radar-mlops).

## The sprint

The repo opened on March 30, 2025, with our proposal. The build ran from May 5 to May 11. My first commit on May 10 was at 1:39 AM. The change that saves the fitted transform went in at 11:10 PM that night. At 4:01 AM on May 11 the three risk levels became two, low and high, and the stress test sets followed from 6:31 AM. My last README commit landed at 11:34 PM.

## The hard parts

**One transform, two places.** The first version fit its medians and its scaler on whatever file it was handed. That is fine for training and wrong everywhere else, because a validation row filled with validation medians has already seen its own answers. So I split it: the training step fits and saves, and every later step loads.

```python
# etl/docker/docker-compose-etl.yaml, val-transform-data
artifacts = joblib.load("/mnt/data/LoanData/train/transform_artifacts.pkl")
median_values = artifacts["median_values"]
scaler = artifacts["scaler"]
df[numeric_cols] = scaler.transform(df[numeric_cols])
```

**Tests that know the answer.** A validation score says little about how a model fails. So I cut a stratified tenth off validation, 22,607 loans, and built five altered copies: the top five features zeroed, everything else zeroed, the top five raised by <span class="egg" tabindex="0" data-egg="Adding 10,000,000 to a standardized feature is the statistics version of shouting.">ten million</span>, everything else raised, and Gaussian noise on every feature. The top five by importance were sub grade, revolving accounts opened in the last year, interest rate, unverified income and funded amount. pytest checks macro F1 and average confidence on each copy.

**A skewed label.** About one loan in seven was high risk: 244,480 of 1,808,534 training rows. XGBoost's scale_pos_weight of 6.4 is that ratio, so the two classes carry about equal weight in training.

## What I learned

**Set a threshold from a baseline.** The noise checks failed. They asserted a macro F1 below 0.10, and the model scored 0.373 and 0.517. A model that always answers low risk already scores a macro F1 near 0.46 on that mix, so a working model could never pass. I had picked the ceiling by feel. Now I score a dumb baseline first and set the bar from it.

**Know which number you measured.** The 0.79 ms median, 0.87 ms at the 95th percentile, is the model scoring one row inside a notebook over 100 calls. A request through FastAPI adds parsing and the transform on top, and we never load tested that path. Next time I measure the round trip first.

## Where it landed

It ran for the class demo on Chameleon and is not running now. No lender used it. In 2 fold cross validation the served model reached a ROC AUC of 0.71 and caught about two thirds of the high risk loans.

What I would keep: fit the data transform once, save it, and load that same file everywhere a row gets scored. And write tests whose right answer you already know.

Code and README: [Loan Radar on GitHub](https://github.com/ds28-ops/loan-default-risk-assessment).
