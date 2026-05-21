---
title: "Fine-tuning Llama 3.1 with RLHF for persuasive counter-arguments"
date: "2025-09-10"
layout: ../../layouts/PostLayout.astro
description: "Llama 3.1 8B trained for more persuasive counter-arguments on ChangeMyView debates. SFT with QLoRA, a reward model, GRPO. Which design choices actually mattered."
img_path: "/llm-persuasion.png"
img_alt: "RLHF pipeline diagram — SFT, reward model, policy optimisation"
tag: "Research"
tone: "violet"
stats:
  - value: "~67%"
    label: "RLHF (GRPO) vs base, human eval"
    tone: "violet"
  - value: "38k"
    label: "preference pairs from CMV"
    tone: "blue"
  - value: "~71%"
    label: "reward model held-out pair accuracy"
    tone: "emerald"
---

Argument mining sits at an awkward intersection. Academic tradition treats persuasion as structure. Practical default is "just prompt a big model." Neither has a good answer to: *given a controversial claim, produce a counter-argument that real humans find more persuasive than what the base model already says.*

I joined Prof. Marco Morucci's group at NYU to take a swing at it.

## The dataset

ChangeMyView (CMV) is one of the few sizeable corpora where you can mine real persuasion signal at scale, because the OP literally awards a "delta" (∆) to commenters who change their mind. We mined 118 monthly shards and extracted preference pairs:

- **chosen**: a comment that received a delta
- **rejected**: a no-delta comment from the same thread

~38k clean pairs after filtering, split 90/5/5 by post (not by row, to prevent leakage of the same OP appearing in train and eval).

## The pipeline, end to end

```
CMV monthly shards
        │
        ▼  thread walker + pair builder
38k preference pairs
        │
        ├─ SFT on `chosen` only          (Llama 3.1 8B in 4-bit, Unsloth + QLoRA)
        ├─ Reward model on pairs         (Llama-3 8B, sequence-classification head)
        └─ Policy optimisation            (GRPO and PPO compared on identical data)
                │
                ▼
Held-out eval: BLEU/ROUGE + Qualtrics human blind A/B
```

## What broke and what fixing it taught me

**Length bias in the reward model.** The first training pass produced a reward model that treated longer responses as more persuasive. The policy then collapsed onto length maximisation. Fix: length-controlled pair sampling (chosen and rejected within 0.5σ of each other).

**Tokenisation mismatch between SFT and the reward model.** They'd been LoRA'd from slightly different base checkpoints. The reward distribution drifted oddly across training with no obvious signal. Fix: lock the base checkpoint for every pass.

**WandB run-id collisions** overwrote one PPO run partway through. Recovered from checkpoints. Now every run gets a non-collidable prefix.

## GRPO vs PPO, on identical data

I ran both PPO and GRPO from the same SFT-aligned base, same reward model, same rollout budget. The cleanest comparison I could make.

| | PPO | GRPO |
|---|---|---|
| Value head | Yes | No |
| Steps to plateau | Baseline | ~60% of PPO |
| Stability across batches | Smoother | Spikier (advantage normalisation within group) |
| Won at human eval vs base | ~66% | ~67% |
| Won at human eval vs each other | ~50/50 within rater noise |

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-violet">
    <div class="stat-value">~67%</div>
    <div class="stat-label">RLHF (GRPO) win rate vs base</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">38k pairs</div>
    <div class="stat-label">clean preference pairs from CMV</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">~71%</div>
    <div class="stat-label">reward model held-out pair accuracy</div>
  </div>
</div>

GRPO converges faster. PPO is less spiky. On this data and at this scale, the policy algorithm wasn't the limiting factor.

## The takeaway

| | Result |
|---|---|
| Reward model held-out pair accuracy | ~71% |
| SFT-only vs base (blind human A/B) | ~58% win for SFT-only |
| RLHF (GRPO) vs base | ~67% win for RLHF |
| RLHF (PPO) vs base | ~66% win for RLHF |
| Trainable parameters | ~50M LoRA adapters on Llama 3.1 8B (base in 4-bit) |

The lesson I keep repeating to anyone trying RLHF for the first time:

> The reward model is the thing. Spend the time on its data, on the pair sampling, on the length and formatting controls.

A great reward model with a competent PPO loop will beat a mediocre reward model with the most exotic policy algorithm you can find. GRPO is faster. It doesn't save you from a bad reward model.

Full project: [marcomorucci/LLM-Persuasion (Sampreeth)](https://github.com/marcomorucci/LLM-Persuasion/tree/main/Sampreeth).
