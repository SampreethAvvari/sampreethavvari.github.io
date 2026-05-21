---
title: "Fine-tuning Llama 3.1 with RLHF for persuasive counter-arguments"
date: "2025-09-10"
layout: ../../layouts/PostLayout.astro
description: "Llama 3.1 8B trained for more persuasive counter-arguments on ChangeMyView debates. SFT with QLoRA, a reward model, GRPO. Which design choices actually mattered."
img_path: "/llm-persuasion.png"
img_alt: "RLHF pipeline diagram — SFT, reward model, policy optimisation"
---

## Situation

Argument mining as a research area sits at an awkward intersection. On one hand there's a long tradition of computational rhetoric (Toulmin diagrams, premise-conclusion extraction, dialogical pragmatics) that treats persuasion as a structural property of arguments. On the other hand, since ChatGPT became a commodity, the actual *practice* of producing persuasive text has collapsed onto a single primitive: prompt a large model and see what it says. Neither side has a great answer to "given a controversial claim and a counter-position, generate a counter-argument that real human readers find genuinely more persuasive than what the base model produces."

I joined Professor Marco Morucci's group at NYU to take a swing at this. The supervised material we had was the ChangeMyView (CMV) dataset: Reddit debates where the original poster awards a "delta" (∆) to any commenter whose argument changes their mind. CMV is one of the few sizeable corpora where you can mine real human persuasion signal at scale, because the delta is a behavioural label, not a survey response. We extracted preference pairs from 118 monthly CMV shards: for each original-post / counter-argument premise, a "chosen" response (the delta-awarded one) and a "rejected" response (a counter-argument that didn't change the OP's mind).

The constraint: I had one cluster of GPUs to work with, no dedicated compute budget for very long runs, and a research timeline that demanded reproducibility week to week. Whatever I built had to fit on a single 8-bit-quantised model with LoRA adapters, and the whole training and evaluation loop had to be runnable end-to-end inside a normal academic day.

## Task

Build an RLHF pipeline that takes a base Llama 3.1 8B Instruct model and produces a fine-tuned policy that generates more persuasive counter-arguments on held-out CMV premises. "More persuasive" had to be measured both:

- **Automatically** with surface-level metrics (BLEU, ROUGE) against held-out chosen responses, as a sanity check.
- **Behaviourally** with human raters on Qualtrics, blind A/B comparing the fine-tuned policy's output against the base model's output across a set of fixed premises.

And the pipeline had to be modular enough that I could swap the policy-optimisation algorithm (PPO vs GRPO vs ORPO) without rebuilding the data layer or the reward model.

## Action

### Data prep and preference pairs

The 118 monthly CMV shards came as raw JSON. The pipeline normalised them in two stages. First, a thread-walker extracted every (post, top-level comment, delta-flag) triple, dropping deleted comments and bot replies. Second, a pair-builder produced preference pairs by sampling, for each delta-awarded comment, a rejected counter-argument from the same post that did *not* receive a delta. The pair sampling was constrained so chosen and rejected came from comparable-length comments (within 0.5σ of each other) to prevent the reward model from learning a length bias.

The pairs landed in a Hugging Face `datasets` format with three columns: `premise` (the OP's claim plus context), `chosen` (the delta response), `rejected` (the no-delta response from the same thread). Roughly 38k clean pairs after filtering, split 90/5/5 into train/val/test by post (not by row, to prevent leakage across the same OP's thread appearing in both train and eval).

### SFT with QLoRA on the chosen responses

The first training pass was supervised fine-tuning on the `chosen` half only. Llama 3.1 8B in 4-bit (Unsloth) with LoRA adapters on Q/K/V/O projections, instruction-formatted as `(premise) → (chosen)`. The point of this pass was to align the model's output distribution with the style and length characteristics of delta-awarded responses before doing any preference learning.

The Unsloth-plus-QLoRA combination is what made the project tractable on a single GPU. The same training run on full-precision Llama 3.1 8B would have spilled over VRAM and forced multi-GPU bookkeeping I didn't have time to support. 4-bit base weights with LoRA adapters added kept the trainable parameter count under 50M while preserving the base model's generation quality.

### Reward model: Llama-3 8B with a sequence-classification head

The reward model is a separate fine-tuned model, not a function of the policy. Architecture is Llama-3 8B with a single linear head over the final hidden state at the last token, projecting to a scalar score. Training: minimise the Bradley-Terry loss on chosen/rejected pairs:

```
L_RM = -log σ(r_θ(chosen) - r_θ(rejected))
```

The reward model trained for 3 epochs over the SFT-aligned pairs, with LoRA adapters again to keep memory in budget. The two things that mattered for reward model quality:

1. **Length-controlled pair sampling.** Without it, the reward model learned that longer responses are more persuasive (which is a real-world correlation on CMV), and the policy then collapsed onto length maximisation during RL.
2. **Instruction formatting consistency.** Reward model input is the same `(premise) [SEP] (response)` template that the policy uses at generation time. Any drift in formatting between RM training and policy rollout produced misaligned reward signal that took an embarrassing weekend to diagnose.

The reward model's final pair accuracy on the held-out test split came in at roughly 71%, which is in the range CMV-trained reward models typically reach. Higher than that on this data tends to come at the cost of overfitting to surface artifacts in the chosen responses.

### Policy optimisation: GRPO and PPO, compared

The policy fine-tune used TRL. The pipeline supports both PPO (the OpenAI-style on-policy RL with a value head) and GRPO (the group-relative variant that compares K sampled responses per prompt and skips the value head entirely). I ran both on the same SFT-aligned base, with identical reward model and identical rollout budget, so the comparison was as clean as I could make it.

The GRPO loss for a single prompt with K = 4 sampled responses simplifies to:

```
advantages_i = (r_i - mean(r)) / std(r)
loss = -mean_i( advantages_i * log π(response_i | prompt) )
       + β * KL(π || π_ref)
```

The KL term to the SFT-aligned reference policy is the regulariser that prevents the policy from drifting into reward-hacking territory. β = 0.05 worked across both algorithms on this data.

What I observed across the runs:

- **GRPO converged faster.** With K = 4 group sampling, the policy reached a stable reward-improvement plateau in roughly 60% of the PPO step count. No value head meant fewer moving parts and one less thing to tune.
- **PPO was less spiky.** GRPO is sensitive to the prompt-batch composition because the advantage normalisation happens within the group; a "flat" group where all four samples scored similarly gives near-zero advantage to anything. PPO smoothed across batches, which made the training curve cleaner even if slower.
- **Both beat the SFT-only baseline on held-out reward**, by similar margins. The clearer separation came in human evaluation.

### Evaluation: BLEU, ROUGE, and human blind A/B

Surface metrics gave noisy but consistent signal. Both fine-tuned policies improved on BLEU-4 and ROUGE-L against held-out chosen responses, but by margins (≈1-2 points) that I'd never trust on their own. The decisive evaluation was Qualtrics-based human ratings: for each of 40 held-out premises, I produced three responses (base model, SFT-only, RLHF-policy), randomised, and presented them in pairs to human raters who picked the more persuasive one.

The pattern across raters:

- Base Llama 3.1 → RLHF policy: rated more persuasive in roughly two-thirds of pairs.
- SFT-only → RLHF policy: rated more persuasive in roughly 55% of pairs (smaller but consistent).
- GRPO vs PPO heads: essentially tied within rater noise on the small premise set.

The takeaway from human eval that didn't show up in the automatic metrics: the RLHF policies produced responses that were more *structurally* persuasive (clearer concession-then-rebuttal moves, fewer purely assertive sentences, more explicit warrants) than the SFT-only baseline. Surface metrics can't tell you that.

### What broke, and what fixing it taught me

Three things that ate time:

1. **A subtle tokenisation mismatch between the SFT model and the reward model**, because they had been LoRA'd from slightly different base checkpoints. The fix was the obvious one (lock the base ckpt for both passes), but the symptom was a reward distribution that drifted weirdly over training, not a clean error.
2. **A logging path collision in WandB** that overwrote one of the PPO runs partway through. Recovered from the model checkpoints. Now I prefix every run with a non-collidable run-id.
3. **The length-bias in the RM**, mentioned above. The chosen/rejected length-control was the highest-leverage change to the whole pipeline.

## Result

The trained policy:

```
Reward model held-out pair accuracy       ~71%
SFT-only vs base (human eval, blind)      ~58% win rate for SFT-only
RLHF (GRPO) vs base (human eval, blind)   ~67% win rate for RLHF
RLHF (PPO) vs base (human eval, blind)    ~66% win rate for RLHF
GRPO vs PPO (human eval, blind)           ~50/50 within rater noise
GRPO training steps to plateau            ~60% of PPO step count
Trainable parameters                      ~50M LoRA adapters on Llama 3.1 8B
                                          (base in 4-bit via Unsloth)
```

The artifacts that came out of the project: a reproducible TRL-based pipeline, comparative inference samples across base / SFT / RLHF, a writeup that ties the human-eval signal to the reward-model design choices that produced it, and a clean separation between the data layer, the reward model, and the policy algorithm so future work can swap any one without rebuilding the others.

The deeper lesson, the one I'd repeat to anyone trying RLHF for the first time: the reward model is the thing. Spend the time on its data, on the pair sampling constraints, on the length and formatting controls. A great reward model with a competent PPO loop will beat a mediocre reward model with the most exotic policy algorithm you can find. GRPO is faster to train; it does not save you from a bad reward model.

Full project: [marcomorucci/LLM-Persuasion (Sampreeth)](https://github.com/marcomorucci/LLM-Persuasion/tree/main/Sampreeth).
