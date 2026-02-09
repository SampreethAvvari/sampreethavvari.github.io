---
title: "Building Multi-Modal RAG for Clinical Consultations"
date: "2025-11-15"
layout: ../../layouts/PostLayout.astro
description: "Designing a multi-modal RAG system with hybrid retrieval and agentic orchestration for clinical workflows."
img_path: "/paper.png"
img_alt: "Multi-modal RAG system diagram"
---

I built a multi-modal RAG platform to analyze clinical consultations and improve treatment acceptance. The goal was to combine audio transcripts, clinical notes, and structured metadata into one reliable system that could support real-time decision-making.

## Architecture
The core pipeline uses LangChain with Gemini 3 Pro. Retrieval blends keyword search and vector search using Supabase pgvector, with GraphQL for structured queries against rubrics and metadata. This hybrid approach improved precision on long, noisy consultations.

## Agentic Orchestration and Safety
I implemented stateful agent chains to detect clinical friction points through sentiment analysis. By controlling context windows and chunking strategies, hallucinations dropped by 35% while staying within HIPAA constraints.

## Impact
Treatment acceptance rose by 130% and revenue grew 43%. The system became a reliable foundation for future AI initiatives across the organization.
