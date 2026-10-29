---
title: "I taught Llama 3 to argue with a judge trained on Reddit deltas"
date: "2025-09-10"
layout: ../../layouts/PostLayout.astro
description: "Research at NYU. Replies that earned a ChangeMyView delta became training pairs, a reward model learned to judge them, and GRPO let a fine tuned Llama 3 8B practice against it."
img_path: "/llm-persuasion.png"
architecture: "llama-rlhf"
img_alt: "Teaching a model to write more convincing arguments, then checking with real people"
tag: "Research"
tone: "violet"
stats:
  - value: "1,000"
    label: "premises per GRPO run, four sampled replies each, scored by the reward model"
    tone: "violet"
  - value: "5,000"
    label: "replies in the first judge's set, 2,511 that earned a delta and 2,489 that did not"
    tone: "blue"
  - value: "4 bit"
    label: "Llama 3 8B under every stage, with LoRA rank 64 doing the learning"
    tone: "emerald"
facts:
  - label: "Problem"
    value: "NYU research: train Llama 3 to write replies to controversial claims that people find more convincing."
  - label: "What I built"
    value: "A pipeline where a fine tuned writer practices with GRPO against a reward model trained on ChangeMyView deltas."
  - label: "Runs on"
    value: "NYU's GPU cluster, every stage starting from one 4 bit Llama 3 8B with LoRA rank 64."
  - label: "Built"
    value: "In bursts between classes, August 6, 2024 to June 16, 2025."
  - label: "Status"
    value: "Research code in the lab's private repo, not deployed."
---

## The problem

I worked on this in Prof. Marco Morucci's group at NYU. The question sounds simple: take a controversial claim and train a model to write a reply that people find more convincing than what it already says.

Simple to ask. Sneaky to pull off. You need examples of arguments that actually changed someone's mind, and Reddit has a community built for that. On ChangeMyView a person posts an opinion and awards a delta to the reply that moved them. That delta is a real human saying "okay, you convinced me."

## What I built

A training pipeline on NYU's GPU cluster, every stage starting from the same Llama 3 8B loaded in 4 bit. Pairs from the same debate, one reply that earned a delta and one that did not, feed two jobs. Supervised fine tuning teaches the writer from the winners. A reward model learns to score the winner above the loser.

Then GRPO lets the writer practice. For each premise it writes four replies, the reward model scores each one, and the replies that beat their group's average get pushed up. An eval script scores held out premises with BLEU, ROUGE-L and the reward model. [Open the drawing](/architecture/llama-rlhf).

## The sprint

Research runs in bursts between classes, and the git history shows it, running from August 6, 2024 to June 16, 2025. It starts with a Longformer judge. The next push landed at <span class="egg" tabindex="0" data-egg="A delta goes to whoever changes your mind. Nobody earned one for changing my bedtime.">1:12 AM</span> on August 15 and moved the judge to Llama 2 7B. GRPO arrived in February 2025, a rewrite on Unsloth in May, and the final SFT, reward and GRPO scripts on June 16.

Every run name carries its date, from June09_SFT_Run1 to June15_GRPO_Run1. The habit came from two experiments that grabbed the same name. One overwrote the other halfway through, and I recovered from checkpoints.

## The hard parts

**The judge decides everything.** It went through three versions. A Longformer classifier on 5,000 replies, 2,511 with a delta and 2,489 without. Then a Llama 2 7B judge. Then a Llama 3 8B reward model with a one number head, trained with TRL. An early judge quietly decided that longer meant more convincing, and a writer trained against that judge learns to <span class="egg" tabindex="0" data-egg="Reward hacking in one line: the judge liked long answers, so the model wrote long answers. Very persuasive about nothing.">ramble</span>. The fix was in the pairs, built so length could not give the winner away.

**Score only the reply.** In fine tuning the prompt tokens get the ignore label, so the loss counts the winning reply alone and the model never learns to echo the premise back:

```python
# Sampreeth/Unsloth/SFT_unsloth.py
labels = [-100] * len(base_tokens["input_ids"])
labels += full_tokens["input_ids"][len(labels):]  # only the chosen reply is scored
```

**An 8B model on a shared cluster.** NF4 with double quantization holds the base, and rank stabilized LoRA at rank 64 on every attention and MLP projection does the learning. A premise is cut to its first 470 words so prompt and reply fit in 768 tokens. GRPO samples four replies of up to 256 tokens from a 512 token prompt.

## What I learned

**Lock the starting point.** A couple of pieces were once built on slightly different base models, and the scores drifted in ways nobody could explain. Now SFT, the reward model and GRPO all load the same 4 bit Llama 3 8B.

**Look for how the judge could cheat.** I caught the length trap by asking that question before a long run, and it was cheaper than any amount of compute after.

**Spend the time on the data.** I also tried ORPO in April 2025, which folds preference into one stage. Changing the pairs taught me more than changing the loop.

## Where it landed

It is research code in the lab's private repo, and nothing serves traffic. The eval script compares the GRPO adapter against the untrained base on 100 held out premises. I have not put a win rate on this page. The scores from those runs live in Weights and Biases, and I only quote what I can point to in the repo.

What I would keep: plan around the obvious way the judge can be fooled before you let a model practice against it.
