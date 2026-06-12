---
title: "How we went from 42nd to 1st in a class AI contest"
date: "2024-12-08"
layout: ../../layouts/PostLayout.astro
description: "A CIFAR-10 competition across 55 teams, a hard 5M-parameter cap, and two weeks. Tuning got us stuck at 92%. The thing that actually won it was almost embarrassingly simple."
img_path: "/resnet-compact.png"
img_alt: "A compact ResNet learning from rotated, cropped, flipped CIFAR-10 images"
tag: "Research"
tone: "violet"
stats:
  - value: "#1 / 55"
    label: "on the professor's secret unseen test set"
    tone: "emerald"
  - value: "97.12%"
    label: "CIFAR-10 accuracy, up from ~92%"
    tone: "blue"
  - value: "< 5M"
    label: "hard parameter cap, ResNet-only"
    tone: "violet"
---

In our deep learning class, the professor turned the final into a competition. **55 teams. Two weeks. One job:** build the best image classifier for CIFAR-10. Two rules. Keep it a ResNet, and keep it **under 5 million parameters**. Inside those lines you could do anything, any ResNet variant, any trick you'd read about. The bar to clear was 85% accuracy.

We cleared it. And then the leaderboard came out and we were sitting at **42nd**.

That did not sit right with me.

## Two weeks, one stubborn ceiling

So I put my head down. I tried different ResNet architectures. I swept hyperparameters, learning rates, schedules, weight decay, batch sizes, until I found a combination that genuinely worked. Our accuracy climbed to about **92%**.

I shared the winning hyperparameters with my team. That jumped us to **16th** in the class.

Better. Not good enough. Because I could see where this was going: the teams ahead of us were hitting **94 to 94.5%**, and no amount of extra tuning was closing that gap. Under a 5-million-parameter cap, the model can only get so smart. The rules said I couldn't buy more accuracy with more parameters, and I'd already squeezed hyperparameters dry. I'd hit a wall.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-amber">
    <div class="stat-value">42nd → 16th</div>
    <div class="stat-label">after architecture + hyperparameter tuning (~92%)</div>
  </div>
  <div class="stat-callout stat-violet">
    <div class="stat-value">94–94.5%</div>
    <div class="stat-label">what the teams ahead of us were hitting</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">5M params</div>
    <div class="stat-label">the cap that made "just tune harder" a dead end</div>
  </div>
</div>

(If you want the receipts, every run and result is in our [results sheet](https://docs.google.com/spreadsheets/d/1ZGsL-hlqXFQmKHCA-6-J81xIbBcJNZBSGYnldBHzYlA/edit?usp=sharing).)

## So I asked a different question

If the model is already as good as the rules let it be, and the hyperparameters are dialed in, what's actually left to improve?

Not the model. The **data**.

More data makes almost any model better. But there was a catch: we had to stick to CIFAR-10. We couldn't go grab more images. So how do you get more data out of a fixed dataset?

**Augmentation.**

It's a simple idea. Take each training image and make new versions of it on the fly: rotate it a little, flip it, crop out a piece, nudge the colors. The label doesn't change, a cat rotated ten degrees is still a cat, but the model now sees far more variety. You get a flood of new training examples without collecting a single new image, and without adding a single parameter to the model.

Which was the whole point. The cap was on *parameters*, not on *data*.

## The game changer

This is where it turned. Feeding my already-good models all that augmented data, accuracy just shot up. We landed at **97.12%**.

That put us **2nd in the entire class**, a heartbreaking **0.17%** behind the team in 1st.

<div class="stat-callout stat-emerald">
  <div class="stat-value">97.12%</div>
  <div class="stat-label">final CIFAR-10 accuracy, 2nd of 55 teams, 0.17% off the top spot</div>
</div>

We were thrilled. And then came the cherry on top.

## The secret test set

The professor had held something back: a set of images **none of us had ever seen** while building. After submissions closed, he ran every team's model against it.

Every model did worse on the secret set than on CIFAR-10's own test data. That was the tell, most teams had quietly *memorized* the CIFAR-10 test images. Their models knew the test, not the world.

Ours dropped the least. By a lot. Because we'd trained on all those rotated, cropped, flipped versions, our model had learned the actual shapes of things instead of the exact pixels of the test set. On data it had never seen before, **it came first in the whole class.**

We did not see that coming. We partied that night. Genuinely did not know we had it in us.

## Why I keep telling this one

Here's the part I love. Going in, we thought we were average. Other teams were pulling out heavy machinery, teacher–student setups, exotic architectures, things we'd only half-heard of. We assumed someone like that would run away with it.

Instead we:

- **kept the problem simple** and refused to over-engineer it,
- **read everything**, papers and open-source repos, to see how the best people in the world were attacking CIFAR-10,
- **learned from them**, used a little common sense, and just put our heads down for two weeks.

That's it. No magic. The team that thought it was average finished 2nd on the test set and **1st on the data that actually mattered**, the stuff the model had never seen. The professor handed us a bonus grade point for the effort.

> The teams ahead of us had fancier models. We had more data and a model that generalized. On unseen data, generalization wins.

The lesson stuck: when the obvious lever (a bigger model) is off the table, don't push harder on it, step back and find the lever nobody's pulling. Ours was data. It cost zero parameters and won the only test that didn't tell us the answers ahead of time.

Full results: [our CIFAR-10 competition sheet](https://docs.google.com/spreadsheets/d/1ZGsL-hlqXFQmKHCA-6-J81xIbBcJNZBSGYnldBHzYlA/edit?usp=sharing).
