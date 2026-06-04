---
title: "How I built a recommender for 22 million records"
date: "2024-05-18"
layout: ../../layouts/PostLayout.astro
description: "I built a recommendation system that handles 22 million records: one fast step to narrow the field, one smart step to rank it. It beat 'just show what's popular' by 20%."
img_path: "/customer-segmentation.png"
img_alt: "A big pile of data narrowed down to a short, ranked list of recommendations"
tag: "MLOps"
tone: "cyan"
stats:
  - value: "22M+"
    label: "records, handled without melting a laptop"
    tone: "cyan"
  - value: "+20%"
    label: "better than just showing what's popular"
    tone: "emerald"
  - value: "2 steps"
    label: "shortlist fast, then rank smart"
    tone: "blue"
---

Most recommendation tutorials hand you a tiny dataset and one neat algorithm, and everything fits in your laptop's memory. That teaches you the math and none of the real problem.

The real problem shows up the moment you have **22 million records**. Now you can't just compare every person to every product, that's trillions of comparisons, and your computer quietly bursts into flames. The question stops being "which fancy algorithm?" and becomes "how do I avoid doing work I don't need to do?"

That question has a well-known answer, and building it was the whole point of this project.

## Why you can't do it in one shot

If you try to score every user against every item, the numbers explode instantly. So real recommenders split the job into two steps, like a hiring funnel:

```
22 million records
        │
        ▼  Step 1: Shortlist (fast and rough)
  Group similar things together,
  only compare within a group
        │  a few hundred candidates per person, not millions
        ▼  Step 2: Rank (slow and smart)
  Score just that shortlist properly
        │
        ▼
  Top picks for each person
```

**Step 1 is the bouncer.** Its only job is to throw out the obviously-irrelevant stuff fast. I used a trick that groups similar users and items into the same "buckets," so each person only ever gets compared to a few hundred likely matches instead of millions. It's a little sloppy on purpose, speed matters more than perfection here.

**Step 2 is the judge.** Now that the list is short, I could afford the smarter, slower math (the part that actually learns personal taste) and run it only on the few hundred survivors. Cheap, because the bouncer already did the heavy filtering.

## Spreading the work across many computers

Even the shortlist step is too big for one machine at 22 million records. So the whole thing ran on **Spark**, which is basically a way to split a giant job across a cluster of computers and have them all chip away at once.

Getting that split right, who does what, when the machines have to talk to each other, is honestly most of the real engineering. The algorithm is the easy part to write. Making it run across a cluster without choking is the hard part.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-cyan">
    <div class="stat-value">22M+</div>
    <div class="stat-label">records, split across many machines at once</div>
  </div>
  <div class="stat-callout stat-emerald">
    <div class="stat-value">+20%</div>
    <div class="stat-label">better than just recommending what's trending</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">100s</div>
    <div class="stat-label">items ranked per person, not millions</div>
  </div>
</div>

The number I'm proud of is **+20% better than just showing what's popular**. Beating random guessing is easy. Beating "just recommend whatever's trending" is the honest bar, because that's the lazy option that's secretly pretty good. Clearing it by 20% means the personalization actually earned its keep.

## What broke (and what it taught me)

**A few mega-popular items jammed everything.** When you split work across machines, a handful of super-popular items can dump a giant pile on one poor machine while the others sit idle, and the whole job crawls. The fix is to spread those hot items out deliberately. Nobody warns you about this in the tutorials, because tutorials never have a mega-popular item.

**The "shortlist" step is a dial, not a setting.** Make the buckets too tight and good matches fall out; too loose and the bouncer stops saving you any work. I had to tune it on purpose, treating it like the trade-off it is.

**New users broke the smart step.** The ranking math has nothing to say about someone with zero history. So for brand-new users, I just fell back to "show them what's popular", which is also why having that popularity baseline built in from day one paid off twice.

## The takeaway

The lesson here isn't about the dataset. It's that the two-step shape, shortlist fast, then rank smart, is exactly how the big recommendation teams (think the "you might also like" on any huge site) keep things running. I built the small version of the real thing.

> When the data is huge, the model is only half the system. The other half is refusing to compute things you don't actually need.

That stuck with me. Faced with 22 million rows, the instinct shouldn't be "find a fancier algorithm." It should be "what work can I avoid?" That's the move that keeps a system standing when the data grows another ten times bigger.

Full project: [Customer Segmentation and Recommendation System](https://hi.switchy.io/U4wS).
