---
title: "Fine-Tuning Llama 3.1 with RLHF for Argument Mining"
date: "2025-09-10"
layout: ../../layouts/PostLayout.astro
description: "RLHF with QLoRA and GRPO to improve argument persuasiveness in human evaluation."
img_path: "/paper.png"
img_alt: "LLM fine-tuning and evaluation"
---

This research project focused on improving persuasive counter-arguments using Llama 3.1 8B. I built a full RLHF pipeline with Unsloth, TRL, and a custom reward model to score debate responses.

## Data Pipeline
I prepared balanced premise/chosen/rejected debate pairs and formatted them into instruction-style prompts for training and evaluation.

## Training and Evaluation
I ran SFT with QLoRA in 4-bit (Unsloth) and then applied GRPO via TRL. A Llama-3-8B reward model (sequence classification with LoRA) served as the judge to score counter-arguments. Evaluation combined BLEU, ROUGE, and Qualtrics-based human scoring.

## Takeaway
A strong reward model and consistent prompt formatting were the biggest contributors to improved persuasiveness.
