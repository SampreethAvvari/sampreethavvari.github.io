---
title: "Two models, one election: fine-tuning Llama 3 for fake news and RoBERTa for sentiment on 1.8M tweets"
date: "2024-05-12"
layout: ../../layouts/PostLayout.astro
description: "Fine-tuned Llama 3 8B with QLoRA to flag misinformation and RoBERTa to read sentiment across 1.8M+ 2020-election tweets, then used LDA to see what people were actually arguing about. The modeling was the easy part."
img_path: "/fake-news.png"
img_alt: "Misinformation classifier, sentiment model, and topic clusters over election tweets"
tag: "Research"
tone: "violet"
stats:
  - value: "76%"
    label: "Llama 3 8B accuracy on the LIAR benchmark"
    tone: "violet"
  - value: "1.8M+"
    label: "election tweets through the sentiment pipeline"
    tone: "blue"
  - value: "2 models"
    label: "misinformation + sentiment, one shared ingest"
    tone: "emerald"
---

Everyone wants to "detect fake news." The phrase hides two completely different problems. One is a labeling problem: given a short political claim, is it true? The other is a reading problem: given a flood of tweets reacting to that claim, how does the crowd feel and what are they actually talking about? I built both for the 2020 US election, and the interesting engineering was never the model architecture. It was the data plumbing and refusing to trust a single accuracy number.

This started as a graduate NLP project, but I built it the way I'd build a service: one ingest path, two models hanging off it, and evaluation I could defend.

## The two-model split

```
                  raw text
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  Misinformation             Sentiment
  Llama 3 8B + QLoRA         RoBERTa fine-tune
  (LIAR claims)              (1.8M election tweets)
        │                         │
        └────────────┬────────────┘
                     ▼
              LDA topic model
        (what the crowd is arguing about)
```

Two models because the labels live in two different places. **LIAR** is a curated benchmark of short PolitiFact statements with truthfulness labels, the right place to teach a model what "checkably false" looks like. The **1.8M election tweets** have no truth labels at all, but they carry sentiment and topic signal, which is what you actually want when you're trying to understand a narrative, not adjudicate a single claim.

## Misinformation: Llama 3 8B, but cheaply

I fine-tuned Llama 3 8B with **QLoRA** (4-bit base, LoRA adapters) on the LIAR claims. The point of QLoRA here wasn't research novelty, it was that an 8B model fits on a single consumer GPU in 4-bit, and the adapters are a few tens of MB to ship. That's the MLE framing: the cheapest checkpoint that clears the bar wins, because you have to retrain and redeploy it later.

Held-out accuracy landed at **76%**.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-violet">
    <div class="stat-value">76%</div>
    <div class="stat-label">Llama 3 8B (QLoRA) on LIAR held-out</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">4-bit</div>
    <div class="stat-label">base weights; LoRA adapters are the only thing trained</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">1 GPU</div>
    <div class="stat-label">whole fine-tune fits on a single consumer card</div>
  </div>
</div>

76% on LIAR is a respectable number and an honest one. LIAR is hard precisely because the statements are short and politically loaded; there's no headline-and-body to lean on. A model that claimed 95% here would be a model I'd assume had leaked.

## Sentiment: RoBERTa over 1.8M tweets

For the tweet stream I fine-tuned **RoBERTa**, not an LLM. At 1.8M rows, inference cost matters more than the last point of accuracy, and a fine-tuned encoder is an order of magnitude cheaper to run than an 8B decoder. Right tool for the throughput.

The work that actually took time was the ingest: deduping retweets, stripping handles and URLs without destroying tokens, normalising emoji, and dropping non-English and bot-pattern rows before they polluted the distribution.

## What broke and what fixing it taught me

**Class imbalance on LIAR.** The truthfulness labels aren't balanced, and the first model quietly learned to over-predict the majority class while looking fine on raw accuracy. Fix: I stopped trusting accuracy alone and watched per-class precision/recall, then weighted the loss. The headline 76% only means something next to the per-class numbers underneath it.

**Preprocessing leakage between the two models.** Early on the tweet cleaner and the LIAR cleaner diverged, so "the same text" got tokenised two different ways. Classic train/serve skew in miniature. Fix: one shared cleaning module both models import. The same instinct shows up in everything I built later, like the [single ETL module across train and serve](/posts/cbct-scan-validator) at Hybridge.

**LDA topic drift.** Topic models are easy to over-read. Half my first "topics" were just punctuation and campaign hashtags. Fix: aggressive stopword and hashtag handling, then fixing the topic count by coherence rather than eyeballing.

## The MLE outlook: what productionizing this looks like

This was coursework, but the gap between it and a real misinformation service is the interesting part:

| | What I built | What production needs |
|---|---|---|
| Serving | Notebook inference | RoBERTa behind a batch endpoint; Llama adapters hot-swappable |
| Eval | Held-out accuracy + per-class | A frozen golden set + drift monitoring as language shifts |
| Labels | Static LIAR snapshot | A human-review queue feeding active learning |
| Topics | One LDA pass | Scheduled re-fit; topics move week to week in a campaign |
| Cost | One GPU, one run | RoBERTa for the 1.8M firehose, the 8B only for flagged claims |

That last row is the whole MLE thesis: route the cheap model over everything and spend the expensive model only where it earns its keep.

## The takeaway

The seductive version of this project is "I fine-tuned an LLM to detect fake news." The honest version is "I built one ingest path, hung the right-sized model on each problem, and refused to report a single accuracy number without the per-class table underneath it."

> A misinformation model is only as trustworthy as the holdout you can defend. The architecture is a footnote; the evaluation is the product.

The kind of engineer I want to be is the one who, handed "detect fake news," first asks "which of the two problems hiding in that sentence are we actually solving, and how will we know we did?"

Full project: [Fake News and Sentiment Analysis](https://hi.switchy.io/U4wO).
