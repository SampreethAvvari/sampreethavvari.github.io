---
title: "How I replaced a $98K quote with a $50-a-month tool"
date: "2026-05-02"
layout: ../../layouts/PostLayout.astro
description: "A vendor wanted $98K up front and $26K a year to flag bad dental CT scans. I built it in-house on Cloud Run for under $50 a month, with one painful lesson."
img_path: "/cbct-validator.png"
img_alt: "CBCT volume slices, multi-task head, verdict pipeline"
tag: "MLOps"
tone: "violet"
stats:
  - value: "$50/mo"
    label: "vs the $124K year-one vendor quote"
    tone: "cyan"
  - value: "~5.5 s"
    label: "end-to-end latency on CPU"
    tone: "blue"
  - value: "AUROC 0.6309"
    label: "the honest test number, not the leaky 0.80"
    tone: "amber"
---

About 10-15% of the 600 CBCT scans that flow through our design team each month are unusable: motion blur, metal streaks, a missing jaw region, a calibration ring of death. A designer doesn't catch it for twenty minutes. The case gets escalated. The patient gets a rescan appointment two days later.

That loop had been running for ten years.

A vendor offered to break it: **$98K up front + $26K a year**. Binary good/bad classifier, no MLOps, they keep the IP. Hybridge would have been paying $26K a year indefinitely to flag scans it never owned the logic for.

So I built it instead, as sole AI engineer at Hybridge, on a laptop GPU and a CPU-only Cloud Run service.

## The cost picture, before anything else

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-cyan">
    <div class="stat-value">$124K</div>
    <div class="stat-label">vendor year-one cost</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">&lt; $600</div>
    <div class="stat-label">year-one cloud spend, in-house</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">100%</div>
    <div class="stat-label">IP retained: weights, code, MLOps stack</div>
  </div>
</div>

| | Vendor proposal | What I built |
|---|---|---|
| Year 1 | ~$98K + $26K = **$124K** | < $600 cloud spend |
| Year 2 onward | $26K / yr | < $600 / yr |
| IP | Vendor keeps it | 100% ours |
| Scope | Binary classifier | 13-class taxonomy + 4-family routing + active learning + full MLOps |
| Hardware | TBD | None bought, RTX 4080 laptop existed |

## The model picked itself

When the project started I had 17 to 23 labeled studies. At that data size, picking a single architecture is a coin flip. So I built six in parallel behind the same interface:

```
A   ConvNeXt-Tiny + gated-attention MIL
B   ConvNeXt + 4-layer Transformer over slices
C   MONAI DenseNet-3D
D   nnU-Net adapter
E   3D VAE (anomaly)
F   ST-MAE (reconstruction anomaly)
```

Let the data tell me which one held up. Model F won round one. Then Model H, an architecture using a frozen DentalSegmentator nnU-Net encoder with a small multi-scale head, won the production slot once I had more labeled bads to evaluate against.

The whole stack in one diagram:

```
CBCT volume (1, 64, 224, 224)
    │
    ▼
Frozen DentalSegmentator encoder (30.79M params, no gradients)
    ├─ deep stage  → global pool      (320 dims)
    ├─ mid stage   → global pool      (256 dims)
    └─ early stage → BiGRU + attention (512 dims)
    │
    ▼
Concat (1088 dims) → small head (500K trainable params)
    │
    ├─ Binary head (good / bad)
    └─ Family head (clean / patient / xray / scanner)
```

13-class assignment is done by a deterministic router downstream, because eight of the thirteen classes have exactly one training sample. Don't try to learn what you can compute.

## The painful lesson

After several weeks of tuning, my test AUROC came in at **0.80**. Beautiful number. I drafted the announcement.

Then I went back and checked the splits one more time. Seven of the ten test bads had also appeared in earlier training during an experiment I'd run. They'd leaked. After redoing the split cleanly, the honest test AUROC was **0.6309**.

I shipped 0.6309.

<div class="stat-callout stat-cyan">
  <div class="stat-value">&lt;$50/mo</div>
  <div class="stat-label">Cloud spend vs the $124K year-one vendor quote, same ten-year operating loss closed in-house</div>
</div>

Shipping 0.80 would have promised something the model couldn't deliver. The next person to run a proper holdout would have caught it. Better to be honest about where the model stands and lean on the active-learning queue for borderline cases.

> A 99%-accurate model with no lineage and no honest holdout is operationally worse than a 75%-accurate model with both.

## Cost-tuned threshold, not accuracy-tuned

A missed bad scan costs 24-48 hours of delay plus a rescan appointment. A false positive costs maybe 30 seconds of human review. So the threshold isn't tuned to maximise accuracy. It's tuned to minimise this cost:

```
cost = 15 × FN_count + 1 × FP_count
```

That gives an operating threshold of **0.176** on the binary score. Anything within ±0.10 of that lands in a human-review queue, which feeds the next retrain.

## Production deployment in one paragraph

Cases flow in from MagicTouch DLCPM over SFTP (no API license needed). Eventarc fires on the GCS upload. Cloud Run pulls the encoder (OpenVINO IR, immutable per release) and the head checkpoint (hot-swappable via GCS, no rebuild needed for retrain). End-to-end latency including PDF report generation: about **5.5 seconds**.

## The numbers that matter

| | Before | After |
|---|---|---|
| Vendor cost over year 1 | $124K + 22 hrs/mo of internal time | $0 external, <$50/mo cloud |
| End-to-end latency | n/a | ~5.5 s |
| 60-90 bad scans/month reaching design | 24-48 hours wasted each | Caught at intake |
| Wasted design-team hours / month | 60-120 | Near zero |
| Patient case turnaround on affected cases | +24-48 hrs | Same-day |

I ran six model architectures, picked the frozen-encoder design because the data supported it, and shipped 0.6309 when 0.80 would have looked nicer on a slide. A model on its own is a science fair. A model with SFTP fan-out, Eventarc, CICT gates, a tag-based release pipeline, a hot-swap retrain loop, and a dashboard somebody actually opens: that's the thing that closes a ten-year operating loss. The number that matters isn't the peak AUROC from a leaky split. It's the one you can stand behind when the next holdout runs.
