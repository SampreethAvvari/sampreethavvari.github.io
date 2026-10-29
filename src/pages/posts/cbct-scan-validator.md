---
demo: /demos/scan-validator
title: "A dental CT scan checker in 38 days, on CPU, for $62 a month"
date: "2026-05-02"
layout: ../../layouts/PostLayout.astro
description: "A vendor quoted $98,200 to flag bad dental CT scans. I built the checker in house in 38 days. It runs on Cloud Run CPU, and our testing team checks it on real studies."
img_path: "/cbct-validator.png"
architecture: "cbct-scan-validator"
img_alt: "CBCT volume slices, multi-task head, verdict pipeline"
tag: "MLOps"
tone: "violet"
stats:
  - value: "0.63 AUROC"
    label: "on 44 test studies kept out of training and validation, after a leaky split had shown 0.80"
    tone: "amber"
  - value: "26 of 30"
    label: "bad studies the testing team found that the model also flagged, Aug 19 to Oct 28"
    tone: "blue"
  - value: "$62"
    label: "on Google Cloud in October, measured, against a vendor quote of $2,200 a month"
    tone: "cyan"
facts:
  - label: "Problem"
    value: "Unusable dental CT scans went unnoticed until a designer opened the case, costing 24 to 48 hours each."
  - label: "What I built"
    value: "An in house checker, built in 38 days, that flags bad CBCT scans and returns a verdict PDF."
  - label: "Outcome"
    value: "Flagged 26 of the 30 bad studies our testing team marked on real scans, August 19 to October 28."
  - label: "Runs on"
    value: "Cloud Run CPU with an OpenVINO encoder, woken by Eventarc, plus a small SFTP VM."
  - label: "Cost"
    value: "$62 on Google Cloud in October 2026, measured, against a vendor quote of $2,200 a month."
  - label: "Status"
    value: "Testing on real scans; no real lab case has gone through it yet."
---

## The problem

Our design team plans implant cases from CBCT scans, the 3D X-rays taken in our offices. Some scans arrive unusable. The patient moved, metal threw streaks, or part of the jaw sat outside the field of view. Nobody knew until a designer opened the case, flagged it and waited on a rescan. My April brief to leadership put the cost at 24 to 48 hours per bad scan.

The same brief estimated about 600 scans a month, so a 10 to 15 percent bad rate meant 60 to 90 cases a month waiting on a rescan.

A vendor had quoted $98,200 to build a checker and $2,200 a month to run it. It would answer good or bad. I built one in house.

## What I built

A quality gate between the lab's case system and the design team. MagicTouch DLCPM, where the lab's cases live, can export each case over SFTP. The zip lands on a small locked down VM I run, which copies it into Cloud Storage. The new object fires Eventarc, and the validator on Cloud Run scores the scan: a frozen dental segmentation encoder compiled for CPU, a small trained head, and a rules router that names the artifact and the next step. The verdict PDF goes back through the same SFTP box, named so DLCPM attaches it to the right case.

Two pieces feed it. A daily job turns labeled scans in Drive into training tensors. A review app lets our testing team upload a real study, see the verdict and record the true answer. [Open the drawing](/architecture/cbct-scan-validator).

## The sprint

The first commit went in on March 25 at 6:27 PM. By April 7 six candidate models sat behind one interface.

- April 22, 3:57 AM: first deploy to Cloud Run. A real CBCT zip went through end to end in 26.7 seconds. v0.4.0 was tagged at 7:36 AM.
- April 27, 6:45 PM to 11:51 PM: the training data job got a lock after overlapping runs multiplied the work, and 16 GiB of memory after a 400 MB scan zip ran it out of 4.
- April 29: MagicTouch confirmed its API license had lapsed. By 3 PM the SFTP route both ways was live and verified end to end with a test zip.
- May 1: Model H, the first model that worked, landed at <span class="egg" tabindex="0" data-egg="Its commit message: first model that actually works. Seventeen hours later another commit explained it had peeked at the answers.">5:44 AM</span>. v0.6.1 went out at 11:42 PM.

From the first commit to Model H took 38 days.

## The hard parts

**The 0.80 that leaked.** The 5:44 AM model scored 0.80 AUROC. Seven of the ten bad holdout studies had been in its training data. The older trainer already refused to start on a holdout study, and the new Model H script had no such check. I rebuilt its split so all 20 holdout studies sit in test only.

**A 0.95 that meant nothing.** On the clean split, a bigger head with about 4.5 million trainable parameters and 117 training studies reported 0.95 AUROC on validation. A diagnostic script showed every scan getting nearly the same output: good, at about 88 percent confidence. The 0.95 was measuring noise. I cut the head to about 500,000 parameters and the scores spread out. On 44 test studies the result was 0.6309 AUROC, catching 7 of 11 bad ones. The commit calls it the honest baseline.

**Thresholds priced in rescans.** A bad scan that reaches design wastes hours. A flagged good scan wastes minutes. So the threshold minimises <span class="egg" tabindex="0" data-egg="Fifteen lives in a config file, so anyone who disagrees about the price of a rescan can change one number.">15 times the misses</span> plus the false alarms, tuned on validation data only:

```python
# scripts/build_and_eval_dentalseg_head.py
for thr in candidates:
    pred = (scores_a >= thr).astype(int)
    fn = int(((ys_a == 1) & (pred == 0)).sum())
    fp = int(((ys_a == 0) & (pred == 1)).sum())
    cost = fn_fp_cost_ratio * fn + fp
```

That picked 0.176. The eval also lists the studies within 0.10 of it as the next ones worth labeling.

## What I said no to

**The API license.** MagicTouch's API needs a Digital Gateway license, and ours had lapsed. DLCPM's Import and Export Digital Files feature works over SFTP in both directions and matches files to cases by name. Only status flips and automatic calls need the API, and front desk staff can flip a status by hand.

**A GPU in production.** OpenVINO ran the 30.79 million parameter encoder in 2.20 seconds per pass on a laptop CPU. PyTorch took 2.56 seconds and ONNX Runtime alone 3.93. The validator runs on Cloud Run CPU and scales to zero.

**Learning classes from one example.** Eight of the 13 classes had a single training scan each. A learned 13 class head was memorising them, so I removed it. The model predicts good or bad and an artifact family, and a rules router assigns the class.

## Where it landed

The validator has been deployed since April 22 and on v0.6.1 since May 1, tested end to end with test zips. DLCPM's export to the SFTP box is a setting on the lab's side that has not been switched on, so no real lab case has gone through yet.

The testing team uses the review app. Since August 19, three people have uploaded 123 real studies on 38 different days and recorded the true answer on 103. Of the 30 they marked bad, the model had flagged 26. It also flagged 44 of the 73 good ones. Its threshold was set to catch about nine in ten bad scans. 90 reviewed studies have joined the training pool.

It cost $62 on Google Cloud in October, measured. About three quarters of that was the training ETL, which woke every 5 minutes on 4 CPUs and 16 GiB, 53,086 runs since April. On October 28 I moved it to once a day at 6 AM. The drop is not measured yet.

Not measured: rescans avoided and designer hours saved. Those need real lab cases flowing through.

What I would keep: freeze the holdout before the first model, and make every training script refuse to run when a holdout study shows up.
