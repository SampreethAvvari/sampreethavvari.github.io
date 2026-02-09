---
title: "Loan Radar: Low-Latency MLOps for Risk Scoring"
date: "2025-05-20"
layout: ../../layouts/PostLayout.astro
description: "A distributed pipeline that keeps inference under 200ms while serving thousands of predictions."
img_path: "/paper.png"
img_alt: "MLOps pipeline"
---

Loan Radar addressed real-time risk scoring at scale. The challenge was to keep inference latency low while sustaining high throughput.

## Pipeline
I built a distributed MLOps pipeline with Ray Tune and FastAPI, focusing on efficient model selection and lightweight deployment.

## Performance
Inference latency dropped below 200ms, enabling 5k+ predictions with high availability. The system met real-time SLAs without sacrificing model quality.

## Lessons
Designing for latency early in the pipeline prevented costly rework at deployment time.
