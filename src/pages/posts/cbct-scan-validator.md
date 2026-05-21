---
title: "Shipping a CBCT scan validator in-house for $50 a month"
date: "2026-05-02"
layout: ../../layouts/PostLayout.astro
description: "A vendor wanted $98K up front and $26K a year to flag bad dental CT scans. I built it in-house on Cloud Run for under $50 a month, with one painful lesson."
img_path: "/cbct-validator.svg"
img_alt: "CBCT volume slices, multi-task head, verdict pipeline"
---

## Situation

For about ten years Hybridge has been absorbing the same recurring loss in the design queue. A dental office runs a CBCT scan on a patient, uploads the volume to the design team through MagicTouch DLCPM, and a designer starts working on the case. Sometime in the next twenty minutes the designer realises the volume is unusable: motion blur from a patient who couldn't hold still, beam-hardening streaks from a metal restoration, a field-of-view cut that misses the mandible, a "green ring of death" from a calibration issue on the scanner. Work stops. The case escalates. The patient gets called back for a rescan. We're now 24-48 hours behind on a case that was on the critical path.

The volume of this: roughly 600 cases a month flow through. A conservative 10-15% artifact rate is 60-90 ruined design starts a month. Every month. For a decade.

Nobody on staff is a radiologist or an ML engineer. The framing inside the company was "this is an ops problem, get the scanning team to do a better intake check." A vendor proposal showed up to solve it externally: $98,200 up front for a binary good/bad classifier, $2,200 a month recurring. No MLOps. Vendor keeps the model.

## Task

Build a thirteen-class artifact classifier that ingests cases through the existing MagicTouch handoff, returns a verdict in seconds, writes a PDF back into the case file, emails the front desk, and runs cheaply enough on GCP that the math beats the vendor. Also: make it retrainable, evaluatable, and operable by one person.

Constraints:

- One developer, me.
- Hardware available for training: an RTX 4080 laptop with 12.9 GB of VRAM. No GPU servers, no SageMaker, no Databricks.
- Hardware for inference: whatever's cheapest on GCP that meets the SLO. Preferably CPU.
- BAA-eligible everything (the scans are PHI).
- A working MagicTouch integration even though we don't have an API license. The "Digital Gateway" API costs extra and the seat budget had lapsed.

## Action

### Bake-off across six architectures, not because we had to, because we had so little data

When the project started I had 17 to 23 labeled studies, depending on how strict you wanted to be about "labeled." A single-model decision at that data size is a coin flip on which family of architectures has the right inductive biases. So I implemented six in parallel, each behind the same `BaseClassifier` / `MultiTaskHead` interface:

```
Model A   ConvNeXt-Tiny + gated-attention MIL over 16 slabs   2D transfer, MIL pooling
Model B   ConvNeXt + 4-layer Transformer over 64 slices       2D + sequence
Model C   MONAI DenseNet-3D                                   Honest 3D, no pretrained
Model D   nnU-Net Adapter / MONAI ResNet18-3D                 Pathway to seg features
Model E   3D VAE                                              Unsupervised anomaly
Model F   ST-MAE (spatio-temporal masked autoencoder)         Goods-only reconstruction
```

The full bake-off lives in `docs/In_House_Architecture_Report.md`. The point of running six in parallel wasn't that I expected to use all six. It was that I had no basis to pick one a priori, and the cost of running each in parallel was hours, not weeks.

### Model F got us numbers, Model F couldn't pass CICT

Model F won the first phase. Trained on 24 good scans, never saw a bad one. Patch-mask-reconstruct: 75% of 3,136 3D patches hidden, model reconstructs them, anomaly score is reconstruction error. Test AUROC on a 6-pair held-out set: 0.889. I deployed it to Cloud Run, declared "we have a model," and walked into the Continuous Integration Continuous Testing harness I'd just set up.

CICT is a 20-scan holdout (10 good, 10 bad) that the model has never seen during training. It runs on every push and on a weekly cron via GitHub Actions, with an accuracy gate that fails the build if the model regresses below the floor. First run on Model F:

```
ACCURACY: 50.0%
  Good scans: 10 / 10 correctly classified
  Bad scans:    0 / 10 correctly classified
```

Ten out of ten goods correct, zero out of ten bads. The reconstruction-error score never crossed the threshold for any bad scan, because the model had been trained on so few unique studies that it had essentially memorised an "everything looks fine" prior.

The instinct here for somebody new to MLOps is to delete the CICT gate, lower the threshold, or "let me hyperparameter-tune that real quick." The discipline you want is: the gate is right, the model is wrong, the AUROC on six pairs was probably leaky, name the cause and keep moving. I named it and kept moving.

### Models G and H — and how the second one finally fit

Model G (PatchCore, ImageNet-pretrained memory bank) was a sanity check that confirmed pretrained 2D features don't transfer to dental volumetric data — AUROC came in at 0.41, worse than random. Killed it.

Model H is the architecture that actually fits the data, and it's the one in production. Three things had to be right:

```
Volume (B, 1, 64, 224, 224)
  |
  v
Frozen DentalSegmentator nnU-Net v2 encoder  (30.79M params, no gradients)
  |
  +-- F_global  : stage 5 GAP                 (B, 320)
  +-- F_mid     : stage 3 GAP                 (B, 256)
  +-- F_seq     : stage 1 spatial-pool        (B, D_seq, 64)
  |
  v
SliceSeqEncoder: BiGRU(2 layers, hidden=256) + MHA(4 heads) + attention pool
  -> (B, 512)
  |
  v
Concat [F_global, F_mid, e_seq]               (B, 1088)
  |
  v
LayerNorm -> Dropout(0.4) -> Linear(1088 -> 512) -> GELU -> Dropout(0.4)
                                                 (~4.5M trainable, encoder frozen)
  |
  +-- Binary head                             (B, 2)    good vs bad
  +-- Family head                             (B, 4)    clean / patient / xray / scanner
```

In `scan_val/models/dentalseg_head.py`:

```python
# Compact head: a single linear projection + LayerNorm + heavy
# dropout, then per-task linear heads. With only ~117 training
# samples a deeper body memorises and collapses (verified
# empirically — see git log entry 10a37fd). Stay shallow,
# over-regularise, and make the optimisation landscape easy.
self.body = nn.Sequential(
    nn.LayerNorm(fusion_dim),
    nn.Dropout(head_dropout),
    nn.Linear(fusion_dim, body_hidden),
    nn.GELU(),
    nn.Dropout(head_dropout),
)
```

Three load-bearing decisions in that snippet:

1. **The encoder is frozen.** 30.79M params, no gradient. With 117 training scans you cannot fine-tune a 3D backbone without destroying the dental-segmentation prior that makes the features useful at all.
2. **Multi-scale taps.** Global gives gross-anatomy semantics; mid gives structure; sequence gives slice-axis patterns (movement gradients, ring-depth bands). Concatenating gives the head a 1088-dim joint embedding without me having to pre-decide which scale matters.
3. **A compact head, not a deep one.** A 4M-parameter body collapsed to a degenerate constant prediction on 117 samples. The diagnostic that proved this is committed at `scripts/diagnose_test_collapse.py`. Shrinking the head 9× to ~500K parameters made the collapse vanish.

The other thing that mattered: feature-space augmentation. The frozen encoder is deterministic, so without injecting noise the head sees the same 132 unique embeddings every epoch and overfits. The fix is post-encoder noise plus channel-wise dropout on the joint embedding:

```python
if self.training:
    if self.feature_noise_std > 0:
        joint = joint + torch.randn_like(joint) * self.feature_noise_std
    if self.feature_dropout_p > 0:
        joint = self.feature_dropout(joint)
```

That single change is what stopped the head memorising and started it generalising.

### Skipping the learned 13-class head on purpose

The taxonomy has 13 classes. 8 of those classes have exactly 1 training sample. A learned 13-class softmax over that is statistically impossible to generalise. The choice I made: keep the binary head and family head learned (those are well-supported), and route to specific 13-class labels with a deterministic heuristic that combines the family prediction with segmentation-derived signals (per-anatomy voxel counts, segmentation entropy, streak energy):

```python
# scan_val/inference/heuristic_router.py
DEFAULT_THRESHOLDS = {
    "mandible_low": 25_000,       # below this many mandible voxels we suspect FOV cut
    "maxilla_low":  25_000,
    "entropy_high": 0.6,           # nats — anything above is "uncertain"
    "boundary_uncertainty_high": 0.4,
    "streak_energy_high": 1.0e6,   # arbitrary units, calibrate on val set
}
```

Rules are interpretable, easy to add new ones to, and don't require retraining when the taxonomy expands. The hybrid (learned where data supports it + rules where data doesn't) is the right shape for this kind of sparse-tail problem.

### The honest AUROC, and why I shipped it

After everything was wired together, the test set returned AUROC 0.80. Beautiful number. I drafted the announcement, almost shipped.

Then I went back and re-checked the data splits. Seven of the ten CICT bads had also appeared in training during an earlier experiment, when I'd been iterating on splits faster than I should have. They'd bled across. After I redid the split cleanly (33 goods + 11 bads, never seen during training, with cohort-level constraints to prevent the same scanner-day pair appearing in train and test), the honest test AUROC was **0.6309**.

That number is the one in production. The reason it's the one in production isn't that I prefer worse numbers. It's that 0.80 was a measurement of how well the model fit a leaky test set, and 0.63 is a measurement of how well it generalises to unseen scans. Shipping 0.80 would have set an expectation we couldn't meet, and the next person who ran a proper holdout would have caught it. Better to take the number for what it is and pair it with a clear active-learning queue that captures borderline cases (anomaly score within ±0.10 of the operating threshold) for human review.

### Cost-tuned threshold, not accuracy-tuned

A false negative on a bad scan costs the practice 24-48 hours of delay plus a rescan appointment. A false positive on a good scan costs the human reviewer maybe 30 seconds to confirm. So the operating threshold isn't tuned to maximise accuracy. It's tuned to minimise:

```
cost = 15 * FN_count + 1 * FP_count
```

That gives an operating threshold of **0.176** on the binary anomaly score. The active-learning queue captures everything in a band around the threshold (±0.10) for human-in-the-loop review, so the most uncertain calls flow into the labeling pool that feeds the next retrain.

### Production deployment: OpenVINO encoder, hot-swap head

The encoder is the heavy part: 30.79M parameters of nnU-Net 3D convolutions. I benchmarked PyTorch CPU, ONNX Runtime, and OpenVINO. OpenVINO FP32 came in at **2.20s per forward pass on Cloud Run's CPU tier**, comfortably inside the 30s Cloud Run SLO and well under the latency budget for a verdict (end-to-end is 5.5s including ETL, head, report generation, and writeback).

That single benchmark meant no GPU tier was needed in production — most of the cost savings of the whole project flow from that decision. Inference deployment:

```
OpenVINO IR (encoder, immutable per release)
   +
PyTorch head ckpt   (hot-swappable via gs://.../models/model_h_head_latest.ckpt)
```

Retraining the head produces a new ckpt; rotating it in production is one `gsutil cp` and a Cloud Run cold start. No rebuild of the encoder IR. No Docker tag bump. The encoder stays pinned per release; the head moves on its own cadence.

### MagicTouch integration, without an API

DLCPM (MagicTouch's case management system) is where new cases land. We don't have their "Digital Gateway" API license; we never will at our case volume. The pivot that kept the project unblocked was reading DLCPM's user-facing documentation more carefully than necessary and discovering that the "Import / Export Digital Files" SFTP path is bidirectional. Cases flow out on SFTP; verdicts flow back in on SFTP.

```
DLCPM (MagicTouch)              outbound SFTP push
   |
   v
cbct-sftp VM (e2-small)         chrooted user dlcpm-export, fail2ban, static IP
   |  inotifywait + sftp-fanout systemd
   v
GCS inference-inbox/  +  Drive "Inference inbox/" (audit copy)
   |  Eventarc finalize (ack 600s, absorbs cold starts)
   v
Cloud Run  cbct-validator       FastAPI, CPU-only, scale 0 to 3, 8 GiB
   |
   +--> GCS reports bucket   PDF + JSON
   +--> Drive "Processed/"   archive original
   +--> Gmail API            verdict email + PDF
   +--> DLCPM SFTP /inbox/   write-back (gated until creds rotate)
```

Every subsystem watches GCS prefixes; nothing knows about the layers next to it. If Cloud Run dies, work queues up in GCS. If SFTP dies, Drive copies still pile in. The fault isolation matters because there's nobody on call but me.

### Single ETL module, no preprocessing skew

This one is invisible from the outside but it's the bug class I'm most paranoid about. Every preprocessing step (HU windowing, resize, slice sampling, intensity normalisation) lives in exactly one file: `scan_val/etl/dicom_etl.py`. Training, evaluation, CICT, and production inference all import it. The module exposes an `ETL_VERSION` constant; any change to behaviour bumps the version and the GCS layout reprocesses everything under a new `v{N}/` prefix.

The classic silent ML failure is "model accuracy on holdout is great, production accuracy is mysteriously bad," and 90% of those bugs are train/serve preprocessing skew. Sharing the module is the cheapest defense.

## Result

The system is live, classifying cases ingested through SFTP, returning verdicts in about 5.5 seconds end-to-end, archiving artifacts to Drive, emailing the front desk, and writing back to DLCPM.

Cost comparison:

```
                              Vendor proposal      In-house build
Build cost (year 1)           ~$98K up front       $0 external — internal eng only
Year-1 ongoing                ~$26K / yr           < $600 / yr cloud spend
IP ownership                  vendor retains       100% Hybridge
Scope delivered               binary good/bad      13-class taxonomy + 4-family routing
                                                   + confidence + active learning
                                                   + full MLOps + DLCPM integration
Hardware bought               TBD                  none — RTX 4080 laptop existed
```

Year-1 delta versus outsourcing: about **$124K of avoided spend** with strictly more scope delivered, full IP retention, and a run rate under $50/month including production inference, billing export, dashboards, and CI.

The operational impact, which is the number I actually care about: removing 60-90 bad-scan incidents a month at 24-48 hours of delay each removes roughly **60-120 hours of wasted design-team time per month**, every month, forever, with a 1-2 day reduction in patient case turnaround on every affected case.

The system is one component. The estimator is another. The ETL, the SFTP fan-out, the Eventarc plumbing, the CICT gate, the dashboard, the hot-swap retraining loop — those are the parts that make the model usable. A model on its own is a science fair. A model with the seven other systems is the thing that actually closes a ten-year operating loss.

Worth saying out loud: I'm not a radiologist. The thing that mattered most wasn't picking the right architecture (I picked six and let the data tell me). It was reading the SOP closely enough to know what 13 classes actually mean in the validation team's day, and then giving the model a feedback loop honest enough that nobody upstream of me has to take my AUROC on faith.
