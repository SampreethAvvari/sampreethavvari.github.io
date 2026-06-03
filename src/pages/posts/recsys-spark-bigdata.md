---
title: "A two-stage recommender on 22M records: MinHash LSH for candidates, ALS for ranking, Spark for scale"
date: "2024-05-18"
layout: ../../layouts/PostLayout.astro
description: "Built a recommendation pipeline on Spark over Hadoop that handles 22M+ records: MinHash LSH to generate candidates, ALS to rank them, +20% Precision@K over a popularity baseline. The architecture is the same one production recsys teams use."
img_path: "/customer-segmentation.png"
img_alt: "Two-stage recommender: LSH candidate generation feeding ALS ranking on Spark"
tag: "MLOps"
tone: "cyan"
stats:
  - value: "22M+"
    label: "records processed on Spark / Hadoop"
    tone: "cyan"
  - value: "+20%"
    label: "Precision@K over a popularity baseline"
    tone: "emerald"
  - value: "2-stage"
    label: "candidate generation → ranking, the production shape"
    tone: "blue"
---

Most recommendation tutorials hand you a 10k-row dataset and a single matrix factorization, and the whole thing fits in memory. That teaches you the math and none of the engineering. The moment you have **22 million records** sitting on HDFS, the question stops being "which model" and becomes "how do I not score every user against every item." That question has a standard answer, and building it is what this project was about.

This was a big-data course project, but the architecture I landed on, **two stages: cheap candidate generation, then expensive ranking**, is exactly the shape production recommenders run at companies far past 22M rows. That wasn't an accident; it's the only shape that scales.

## Why one stage doesn't scale

Naive collaborative filtering wants to score every (user, item) pair. With millions of users and items that's a number you don't write down. So real systems split the problem:

```
22M+ records on HDFS
        │
        ▼  Stage 1 — Candidate generation (cheap, recall-oriented)
  MinHash LSH: bucket similar users/items,
  only compare within buckets
        │  a few hundred candidates per user, not millions
        ▼  Stage 2 — Ranking (expensive, precision-oriented)
  ALS matrix factorization: score the candidate set
        │
        ▼
  Top-K recommendations
        │
        ▼  Eval: Precision@K vs popularity baseline
```

**Stage 1 (MinHash LSH)** throws away the obviously-irrelevant pairs fast. Instead of comparing a user to every item, LSH hashes similar entities into the same buckets, so you only ever compare within a bucket. It trades a little recall for an enormous cut in compute.

**Stage 2 (ALS)** does the expensive, accurate work, matrix factorization for personalized scores, but only on the few hundred candidates Stage 1 survived, not the full catalog.

## Spark is the point, not a detail

Running this on **Spark over Hadoop** is what made 22M records tractable. The work is distributed: the LSH bucketing, the ALS factor updates, the join between candidates and the model, all of it runs across the cluster instead of choking a single machine. Getting the partitioning and the joins right is most of the actual engineering.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-cyan">
    <div class="stat-value">22M+</div>
    <div class="stat-label">records, processed distributed on Spark</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">+20%</div>
    <div class="stat-label">Precision@K over the popularity baseline</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">100s</div>
    <div class="stat-label">candidates ranked per user, not millions</div>
  </div>
</div>

The **+20% Precision@K over a popularity baseline** is the number that matters, because the popularity baseline ("just recommend what's trending") is the honest thing to beat. Beating random is trivial; beating popularity means the personalization actually earned its compute.

## What broke and what fixing it taught me

**Data skew killed the first Spark run.** A handful of mega-popular items pulled enormous partitions while everything else sat idle, so one executor did all the work and the job crawled. Fix: salt the hot keys and repartition before the join. Skew is the big-data failure mode the in-memory tutorials never warn you about.

**LSH tuning is a recall/cost dial, not a setting.** Too few hash bands and good candidates fell out of every bucket; too many and Stage 1 stopped saving any compute. Fix: tune bands/rows explicitly against candidate recall, treating it as the knob it is.

**The cold-start gap.** ALS has nothing to say about a user with no history, and the eval quietly punished it. Fix: fall back to the popularity baseline for cold users, which is also why having that baseline wired in from the start paid off twice.

## The MLE outlook: this is the production pattern

The reason this project matters for an ML engineering profile isn't the dataset, it's that the architecture transfers directly:

| | This project | Production recsys |
|---|---|---|
| Stage 1 | MinHash LSH on Spark | ANN / two-tower retrieval |
| Stage 2 | ALS ranking | Gradient-boosted or neural ranker |
| Scale strategy | Distributed Spark jobs | Distributed + a feature store |
| Baseline to beat | Popularity | Popularity / last-model |
| Metric | Precision@K | Precision@K, NDCG, online A/B |

Swap LSH for an approximate-nearest-neighbor index and ALS for a learned ranker and you have the literal blueprint modern recommendation teams run. I built the small version of the real thing, which is far more useful than the perfect version of a toy.

## The takeaway

> At scale, the model is half the system. The other half is refusing to compute things you don't need to, which is what candidate generation is for.

The kind of engineer I want to be is the one who, looking at 22M rows, reaches for the two-stage architecture before reaching for a fancier model, because the architecture is what keeps the system standing when the data grows another order of magnitude.

Full project: [Customer Segmentation and Recommendation System](https://hi.switchy.io/U4wS).
