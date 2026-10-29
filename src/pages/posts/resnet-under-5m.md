---
title: "Augmentation took our capped ResNet to 97.12% on CIFAR-10"
date: "2024-12-08"
layout: ../../layouts/PostLayout.astro
description: "A class contest: CIFAR-10, a ResNet, a hard cap of 5 million parameters. Flip and crop topped out at 93.76%. Augmentation, which adds zero parameters, took us to 97.12%."
img_path: "/resnet-compact.png"
architecture: "resnet-under-5m"
img_alt: "A compact ResNet learning from rotated, cropped, flipped CIFAR-10 images"
tag: "Research"
tone: "violet"
stats:
  - value: "97.12%"
    label: "on the 10,000 CIFAR-10 test images after 300 epochs"
    tone: "emerald"
  - value: "4,978,810"
    label: "trainable parameters, 21,190 under the 5 million cap"
    tone: "blue"
  - value: "93.76%"
    label: "our best run with flip and crop only, before AutoAugment and perspective"
    tone: "violet"
facts:
  - label: "Problem"
    value: "A class contest: the best CIFAR-10 ResNet under a hard cap of 5 million trainable parameters."
  - label: "What I built"
    value: "With two teammates, a PyTorch training pipeline that put the effort into augmentation, which costs no parameters."
  - label: "Outcome"
    value: "97.12% on the 10,000 CIFAR-10 test images, up from 93.76% with flip and crop alone."
  - label: "Runs on"
    value: "PyTorch notebooks; the final ResNet has 4,978,810 trainable parameters, 21,190 under the cap."
  - label: "Built"
    value: "April 11 to 24, 2024; the final model trained for 300 epochs."
  - label: "Status"
    value: "Coursework, finished in April 2024 and not deployed."
---

## The problem

In our deep learning class the final became a contest. Build the best CIFAR-10 classifier you can, keep it a ResNet, and keep it under 5 million trainable parameters. The course scored every team on 10,000 hidden images that nobody had labels for. We were a team of three.

The cap takes away the usual lever. The official ResNet18 has over 11 million parameters and scored 88.56% in our own runs. So the job was to find accuracy that does not cost parameters.

## What I built

A PyTorch training pipeline in notebooks. Every training image is augmented as it loads, batches of 128 go through a ResNet with four stages of three blocks, and SGD runs on a cosine schedule for 300 epochs. A cell counts trainable parameters before the first epoch. Each epoch is scored on the 10,000 labeled test images, and the final model writes a CSV of labels for the 10,000 hidden ones. Every run went into a shared results sheet. [Open the drawing](/architecture/resnet-under-5m).

## The sprint

The repo's history runs April 11 to 24, 2024, with three of us pushing into it. The busiest stretch came just after midnight on April 13, from 12:05 to 12:50 AM, while we merged notebooks and model weights into one repo. The report went in at 6:10 PM that day.

## The hard parts

**Tuning hit a ceiling.** Our first runs used flip and crop with a step schedule, and they landed between 79% and 91% whatever we changed. A ResNet34 with 11.7 million parameters, more than twice the cap, scored 90%. Bigger was not working, and it was against the rules anyway. Adadelta on a cosine schedule got the best flip and crop run to 93.76%.

**The data was the lever.** If the model is as big as the rules allow and the hyperparameters are dialed in, what is left? The cap was on parameters, and augmentation costs none. Each image becomes a slightly different image every time it loads, and a <span class="egg" tabindex="0" data-egg="AutoAugment's CIFAR-10 policy was itself found by a search. We borrowed a machine's taste in rotations.">cat rotated a little</span> is still a cat. The report lines it up: flip and crop, 93.76%. Add AutoAugment, 95.34%. Add a perspective warp, 97.12%.

```python
# Notebooks/ResNet26_97_best_model_1.ipynb, cell 2
transforms.AutoAugment(torchvision.transforms.AutoAugmentPolicy.CIFAR10),
transforms.RandomCrop(32, padding=4),
transforms.RandomHorizontalFlip(p=0.5),
transforms.RandomPerspective(distortion_scale=0.6, p=0.5),
```

**Spending the budget.** With the data settled, the parameters went where they helped. Channels of 128, 100, 164 and 200 came out of sweeping widths under the cap. The plain 16, 32, 64, 128 ladder scored 79%, and ResNet34's 3, 4, 6, 3 blocks scored 91% while needing 5.3 million. The final model has four stages of three blocks, 3 by 3 kernels, 1 by 1 shortcuts and 4,978,810 parameters, with <span class="egg" tabindex="0" data-egg="Enough for one more 3 by 3 convolution from 48 channels to 48. We let it go.">21,190 to spare</span>.

## What I said no to

**Heavier machinery.** Teacher student setups and exotic architectures were on the table, and we had only half heard of some of them. We read papers and open source CIFAR-10 repos instead, kept the plain residual block, and put the effort into data and training.

**Trusting one test score.** The repo keeps two finalists. ResNet26 scored 97.12% on the labeled test set. A slimmer ResNet24, with 3, 3, 2, 3 blocks and 4,969,776 parameters, scored 96.82% there, and it is the one the repo names best on unseen data. The test set we could see was never the one that counted.

## Where it landed

It was coursework, finished in April 2024. The report, the notebooks and the trained weights are public in the repo, along with the results sheet of every run. The ResNet26 notebook's last epoch read 9,712 of 10,000 test images right.

What I would keep: when the obvious lever is capped, step back and find the one nobody is pulling. Ours was data, and it cost zero parameters.
