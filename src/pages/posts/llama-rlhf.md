---
title: "How I trained Llama to argue more convincingly"
date: "2025-09-10"
layout: ../../layouts/PostLayout.astro
description: "I trained Llama 3.1 to write better comebacks in online debates, using a reward model and RLHF. Here's what actually moved the needle, and what didn't."
img_path: "/llm-persuasion.png"
img_alt: "Teaching a model to write more convincing arguments, then checking with real people"
tag: "Research"
tone: "violet"
stats:
  - value: "~67%"
    label: "of people preferred my model over the base"
    tone: "violet"
  - value: "38k"
    label: "real 'you changed my mind' examples"
    tone: "blue"
  - value: "~71%"
    label: "how often the judge model got it right"
    tone: "emerald"
---

I worked on this with Prof. Marco Morucci's group at NYU, and the question sounds simple: take a controversial claim, and train a model to write a comeback that real people find *more convincing* than what the model already said.

Simple to ask. Sneaky to pull off. Most people assume the magic is in which training algorithm you pick. It isn't. By the time I got to the fancy algorithm choices, that part barely mattered. The thing that decided everything was much earlier and much more boring: where do you get good examples of "convincing," and how do you stop the model from learning the wrong lesson?

## Where do you find "convincing" arguments?

You need examples of arguments that actually changed someone's mind. Turns out Reddit has a perfect spot for this: a community called **ChangeMyView**, where someone posts an opinion and hands out a little award (a "delta") to any reply that genuinely changes how they think.

That award is gold. It's a real human saying "okay, you convinced me." So I mined a few years of these debates and built pairs:

- **the winner**: a reply that earned a "you changed my mind"
- **the loser**: a reply in the same thread that didn't

That gave me about **38,000 clean pairs**. I split them carefully so the same debate never showed up in both training and testing, otherwise the model could just memorize instead of learn.

## The plan, in plain English

```
38k "winner vs loser" pairs
        │
        ├─ Step 1: show Llama lots of winning replies
        │          (basically, "write more like this")
        │
        ├─ Step 2: train a JUDGE model
        │          (given two replies, which one won?)
        │
        └─ Step 3: let Llama practice, and reward it
                   whenever the judge likes its answer
                │
                ▼
        Test it: real people, blind, pick the better reply
```

Three moves. First, teach Llama to imitate good arguments. Second, train a separate **judge** model that can look at two replies and call the better one. Third, let Llama practice writing arguments and give it a thumbs-up whenever the judge approves. That last loop is the "RLHF" everyone talks about. It's really just practice with a scorekeeper.

## What broke (and what it taught me)

**The judge fell for long-winded answers.** My first judge quietly decided that *longer* meant *more convincing*. So when Llama practiced against it, Llama learned to just... ramble. More words, higher score, worse arguments. The fix was to make sure my winner/loser pairs were about the same length, so the judge had to learn quality, not word count.

**Two versions of "the same" model didn't match.** A couple of pieces had been built on slightly different starting points, and the scores drifted in weird ways for no obvious reason. The fix was dull and important: lock everything to the exact same starting model.

**A naming clash ate one of my runs.** Two experiments grabbed the same name and one overwrote the other halfway through. I recovered from saved checkpoints and started giving every run its own unmistakable name. Lesson learned the annoying way.

## The fancy-algorithm showdown that... didn't matter much

There are two popular ways to run that "practice with a scorekeeper" loop: one's called PPO, the other GRPO. People argue about them a lot. So I ran both from the exact same starting point, same judge, same everything, the cleanest comparison I could set up.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-violet">
    <div class="stat-value">~67%</div>
    <div class="stat-label">of people preferred my trained model over the base</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">38k</div>
    <div class="stat-label">real "you changed my mind" examples</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">~71%</div>
    <div class="stat-label">how often the judge model picked the true winner</div>
  </div>
</div>

The result? GRPO got there faster. PPO was a bit smoother. In a blind test where real people picked the better reply, both beat the original model about **66–67%** of the time, and against each other it was basically a coin flip. The big, much-debated algorithm choice was the *least* important decision in the whole project.

## The takeaway

> The judge model is the whole ballgame. Spend your time on the examples you feed it, not on the fancy training algorithm.

A great judge with a basic training loop beats a weak judge with the most exotic algorithm you can find, every time. GRPO is faster. It will not save you from a judge that secretly rewards rambling.

And the part I'm actually proud of isn't the 67%. It's that I saw the "longer = better" trap coming *before* it wasted a week of computing, because I stopped to think about how the judge could cheat. That's the kind of engineer I want to be: the one who plans around the obvious mistake before it happens, not the one who explains it afterward.

This was research with Prof. Marco Morucci's group at NYU.
