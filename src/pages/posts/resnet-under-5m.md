---
title: "97.12% on CIFAR-10 with a parameter budget: designing a ResNet under 5M weights"
date: "2024-12-08"
layout: ../../layouts/PostLayout.astro
description: "A budget of 5M parameters changes how you design a network. I built ResNet variants from scratch for CIFAR-10 and got 97.12% on the best one by spending the budget where it earned accuracy, not where convention put it."
img_path: "/resnet-compact.png"
img_alt: "Compact ResNet block diagram with a parameter budget"
tag: "Research"
tone: "emerald"
stats:
  - value: "97.12%"
    label: "test accuracy, best model (ResNet26)"
    tone: "emerald"
  - value: "< 5M"
    label: "hard parameter budget, every variant"
    tone: "blue"
  - value: "from scratch"
    label: "no pretrained weights, no torchvision shortcut"
    tone: "violet"
---

A model with no constraints is a model with no decisions. The moment someone hands you a parameter budget, every layer has to justify itself, and the project gets interesting. The brief here was simple and unforgiving: beat strong CIFAR-10 accuracy with a ResNet **under 5 million parameters**, built from scratch. No pretrained backbone, no torchvision import. The best variant landed at **97.12%**.

The budget is the whole point. 5M parameters is roughly an order of magnitude under the ResNets people reach for by reflex, and that constraint is exactly the one you hit in the real world the day a model has to fit on an edge device or under a serving latency cap.

## The budget reframes the design

Without a budget you stack depth until accuracy stops improving. With one, every parameter is a purchase, and you ask a different question on each block: *does this width or this depth buy more accuracy per parameter?*

```
Budget: < 5,000,000 trainable parameters
        │
        ▼
Spend it on:        Don't spend it on:
── deeper residual   ── a fat first conv
   stacks (cheap      ── oversized FC head
   per param)         ── redundant channel
── BN + good init        width late in the net
── strong augment
   (free at inference)
```

The cheapest accuracy in the whole project costs zero parameters: data augmentation and a good training schedule. Random crops, flips, normalization, a cosine learning-rate schedule, label smoothing. None of that touches the budget, all of it moves the number.

## The variants

I built several ResNet configurations from scratch and compared them at depth/width settings that all stayed under the cap:

| Variant | Depth | Params | Test acc |
|---|---|---|---|
| ResNet (shallow) | fewer blocks | well under budget | baseline |
| ResNet (wide) | wider channels | near budget | mid |
| **ResNet26** | balanced depth | **< 5M** | **97.12%** |

The winner wasn't the widest or the deepest. It was the one that spent the budget on residual depth (cheap accuracy per parameter) instead of channel width late in the network (expensive, diminishing).

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-emerald">
    <div class="stat-value">97.12%</div>
    <div class="stat-label">ResNet26 test accuracy on CIFAR-10</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">&lt; 5M</div>
    <div class="stat-label">parameters, enforced as a hard gate</div>
  </div>
  <div class="stat-callout stat-violet">
    <div class="stat-value">0 params</div>
    <div class="stat-label">cost of the augmentation that moved the number most</div>
  </div>
</div>

## What broke and what fixing it taught me

**Counting parameters by hand, badly.** Early on I trusted my mental math on layer sizes and quietly blew the budget on a variant before I caught it. Fix: a parameter-count assertion in the training script that fails the run if the model exceeds 5M. The budget became a gate, not a hope. Same instinct as the [CI/CT gates](/posts/loan-radar-mlops) I lean on for everything since: if a constraint matters, make a script enforce it.

**Overfitting the moment I added capacity.** Every time I spent budget on width, train accuracy ran away from test. Fix: the parameters I was tempted to add were better spent as augmentation and regularization, which cost nothing at inference. The budget made me reach for the free wins first.

**Reproducibility drift.** Two runs of "the same" config disagreed by almost a point because seeds and augmentation order weren't pinned. Fix: fixed seeds, logged configs, reproducible settings in the notebooks. A result you can't reproduce isn't a result.

## The MLE outlook: why a budget is the realistic case

Unconstrained accuracy is a leaderboard sport. Constrained accuracy is the job.

| | Unbounded model | This project |
|---|---|---|
| Goal | Max accuracy | Max accuracy *per parameter* |
| Real-world analog | Research demo | Edge / mobile / latency-capped serving |
| Deployment | "It'll fit somewhere" | Fits a known footprint by construction |
| Failure mode | Silent bloat | Caught by the parameter gate in CI |

Every production model I've shipped since has carried a version of this constraint. The [CBCT classifier](/posts/cbct-scan-validator) runs a **500K-parameter head** on a frozen encoder precisely because a smaller head that clears the bar is cheaper to retrain, ship, and serve on CPU. This project is where that habit started: treat size as a first-class requirement, not an afterthought.

## The takeaway

> Accuracy with no constraint is a number. Accuracy under a budget is an engineering decision, and the budget tells you where to spend.

The kind of engineer I want to be is the one who, given a parameter cap, treats it as the most useful line in the spec, because it turns "stack more layers" into "earn every weight." 97.12% is the headline. The discipline of spending the budget where it pays is the part I kept.

Full project: [ResNet Under 5M Parameters](https://hi.switchy.io/q3I_).
