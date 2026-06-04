---
title: "How I caught fake news and read the mood of an election"
date: "2024-05-12"
layout: ../../layouts/PostLayout.astro
description: "I built two models for the 2020 election: one to flag fake news, one to read how people felt across 1.8 million tweets. The modeling was the easy part."
img_path: "/fake-news.png"
img_alt: "One model flagging fake news, another reading the mood of millions of tweets"
tag: "Research"
tone: "violet"
stats:
  - value: "76%"
    label: "accuracy catching fake claims"
    tone: "violet"
  - value: "1.8M+"
    label: "election tweets read for mood"
    tone: "blue"
  - value: "2 models"
    label: "one for lies, one for feelings"
    tone: "emerald"
---

Everyone says they want to "detect fake news." That phrase is hiding two completely different jobs.

Job one: someone makes a claim. Is it true? That's a fact-checking problem.

Job two: a million people are tweeting about that claim. How do they feel, and what are they actually mad about? That's a mood problem.

For a grad-school project on the 2020 US election, I built both. And the fun part is: the AI models were the easy bit. The hard, messy, interesting work was everywhere else.

## Two jobs, two models

I didn't try to make one giant model do everything. That almost never works. Instead I picked the right tool for each job.

```
                  text comes in
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   Is this claim fake?           How do people feel?
   Llama 3 (8B)                  RoBERTa
   trained on labeled claims     trained on tweets
        │                             │
        └──────────────┬──────────────┘
                       ▼
              What are they arguing about?
              (topic grouping)
```

For the **fake-news job**, I needed a model that understands the meaning of a short, slippery political statement. I used Llama 3, a big language model, and trained it on a public set of claims that experts had already labeled true or false.

For the **mood job**, I had 1.8 million tweets and zero patience for a slow, expensive model running on all of them. So I used RoBERTa, a smaller, faster model that's great at reading tone. The right tool isn't always the biggest one. At 1.8 million tweets, "cheap and fast" wins.

## The cheap trick that made the big model affordable

Training an 8-billion-parameter model sounds like it needs a server farm. It doesn't, if you're a little clever.

I used a trick called **QLoRA**. The short version: instead of retraining the whole giant model (expensive, slow, needs lots of memory), you freeze it and train a tiny add-on layer on top. The big model stays put; you only teach the small new piece. It fits on a single regular GPU, and the thing you ship at the end is a few megabytes instead of gigabytes.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-violet">
    <div class="stat-value">76%</div>
    <div class="stat-label">accuracy on hard, expert-labeled claims</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">1 GPU</div>
    <div class="stat-label">all it took, thanks to the QLoRA trick</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">megabytes</div>
    <div class="stat-label">the size of what I actually shipped</div>
  </div>
</div>

**76% accuracy** might not sound flashy, but these claims are short and politically loaded with no extra context to lean on. They're genuinely hard. If I'd reported 95%, I'd have assumed I'd cheated somewhere by accident.

## What actually broke (and what it taught me)

**The model learned to be lazy.** The labeled claims weren't evenly split, so my first model figured out it could look smart just by guessing the most common answer. Accuracy looked fine; the model was useless. The fix was to stop trusting one number and start checking how it did on *each* type of claim. Lesson that stuck: a single accuracy score can lie to your face.

**My two models disagreed on basic cleanup.** Early on, the tweet cleaner and the claim cleaner were slightly different, so "the same sentence" got chopped up two different ways depending on which model saw it. I merged them into one shared cleanup step. Boring fix, big difference.

**My "topics" were mostly punctuation.** I also grouped the tweets by topic to see what people were arguing about. The first run proudly told me the hottest topics were... hashtags and exclamation marks. After cleaning those out, real themes finally showed up.

## So what's the actual takeaway?

The flashy way to describe this is "I fine-tuned an LLM to detect fake news."

The honest way is "I figured out there were two different problems, used a cheap fast model for the big firehose and a smart one only where it mattered, and refused to believe a single accuracy number without looking underneath it."

> The model is the footnote. Knowing which problem you're solving, and how you'll know you solved it, is the actual job.

That's the habit I took from this one: when someone hands you a big fuzzy goal like "detect fake news," the first move isn't to grab a model. It's to ask what you're really being asked to do.

Full project: [Fake News and Sentiment Analysis](https://hi.switchy.io/U4wO).
