---
demo: /demos/enterprise-search
title: "A company search that cites its sources or says it does not know"
date: "2026-06-23"
layout: ../../layouts/PostLayout.astro
description: "Hybridge staff could ask a question and get an answer cited to the exact passage, filtered by who may see what. Built in a month, paused since October."
img_path: "/enterprise-search.png"
img_alt: "Enterprise Search: documents flowing into one governed index, a question flowing out as a cited answer"
architecture: "enterprise-search"
tag: "AIE"
tone: "emerald"
stats:
  - value: "24 days"
    label: "from the first commit to real models in production, with sign in, permissions and cited answers"
    tone: "emerald"
  - value: "8 passages"
    label: "the most Gemini sees per question, picked from up to 100 candidates the asker may see"
    tone: "blue"
  - value: "55 minutes"
    label: "for the whole read path on June 27, from the permission filter to the eval test"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Hybridge documents were spread across shared drives, decks and SOPs, so answers meant asking around."
  - label: "What I built"
    value: "A staff chat that answers from passages the asker may see, with citations, or says it does not know."
  - label: "Who uses it"
    value: "Anyone at Hybridge with a company Google account; uploaders added documents through Dropoff."
  - label: "Runs on"
    value: "FastAPI on Cloud Run, Postgres with pgvector on Cloud SQL, Vertex AI reranking and Gemini 2.5 Flash."
  - label: "Built"
    value: "24 days from the first commit to real models in production."
  - label: "Status"
    value: "Paused since October 8, 2026, when billing for its Google Cloud project was turned off."
---

## The problem

Hybridge runs on documents spread across shared drives, slide decks, SOPs and a few people's heads. When someone needs an answer, they ask around, or they find a document and hope it is the current one.

A search box over all of it is harder than it sounds. Patient details, HR records and business plans sit side by side, so the search has to know who may see what before it looks. Documents disagree, like an old schedule nobody deleted next to the new one. And a confident wrong answer is worse than none, because people act on it.

## What I built

Ask Hybridge is a chat. Anyone with a company Google account signs in, asks a question, and gets an answer streamed back with numbered citations. Click one and the source opens beside the chat, scrolled to the highlighted passage.

Behind it, a FastAPI service on Cloud Run searches Postgres two ways inside the asker's group permissions: by meaning with pgvector and by exact words with full text search. Vertex AI reranks the merged list down to 8 passages. Gemini 2.5 Flash answers from those 8, cites every claim, and otherwise replies "I don't have that in the knowledge base." If the asker can see no passages at all, the API sends that line without calling the model.

Dropoff is the second tab, for uploaders. You drop a file and set who can see it, its class and its effective date. The API hashes it, skips duplicates, keeps the original in Cloud Storage, has Gemini write a short card, then chunks it with character offsets, embeds it and indexes it. [Open the drawing](/architecture/enterprise-search) to see every part.

## The sprint

I wrote the retrieval research and the design on June 22, then built it in five stages, each with its own spec, plan and tests. June 23 was the busiest day: sign in, roles and audit logs after midnight, then Terraform and the Cloud Build pipeline, then the whole ingestion pipeline that evening. The last commit of that night landed at <span class="egg" tabindex="0" data-egg="It told Terraform which project to bill for sign in. Months later, the billing switch is what paused the whole thing.">3:44 AM</span>.

On June 27 the read path went in between 10:42 and 11:37 PM: the permission filter, both searches, rank fusion, the reranker, the conflict rules, the generator and a small eval test. It took 55 minutes, against a plan written four days earlier. The chat front end followed on June 30 and the Dropoff front end on July 1. On July 16 I wired the real models into ingestion and wrote a demo guide and a slide deck. The last merge was July 23.

From the first commit to real models in production took 24 days. Much of the work happened after 10 PM. The deploy pipeline runs both test suites before it migrates the schema and ships the API and the web app.

## The hard parts

**Permissions before ranking.** Every chunk carries the groups of its document. The filter is a SQL condition inside both searches, next to a clause that keeps only current documents, so a restricted passage never becomes a candidate. It never reaches the reranker or the model, so no prompt can talk it out.

```python
# api/app/serving/acl.py
acl = Chunk.group_acl == []
if caller_groups:
    acl = acl | Chunk.group_acl.op("&&")(list(caller_groups))
clauses.append(acl)
```

In the demo, a leadership document exists only for members of the leadership group.

**When two documents disagree, rules decide.** Each document gets an authority score from its class, its uploader's role and its source. Superseded versions drop out, and the rest sort by authority, then effective date. If the top two are within one point and dated differently, the API adds a conflict note that Gemini must address and the chat shows in a callout. The demo set has two office hours schedules that disagree, <span class="egg" tabindex="0" data-egg="Same authority, different dates. Friday wins on recency, and both get cited, so nobody turns up on Thursday.">Thursday at 3 PM and Friday at 11 AM</span>. The newer one wins and both are cited.

**The breakages were plumbing.** The bug that blocked every sign in was a Google SDK that had to be set up before its first token check; the fix went in at 11:57 PM on June 30. Later, the reranking library was missing from the image for a week, and the wrapper around the reranker fell back to the fused order and logged why.

## What I said no to

**A separate vector database.** At hundreds to low thousands of documents, one Postgres on Cloud SQL holds vectors, the keyword index, permissions, versions and chats under one filter. My research before the first line of code found no speed reason for a second store at that size.

**GraphRAG and vectorless trees.** In the benchmarks I checked, graph retrieval lost to vector search with reranking on simple fact lookups and used far more prompt tokens. Vectorless page trees had no verified benchmark and no managed option on Google Cloud. Both stay off until a real question needs several hops.

**An agent loop on every question.** The design put a corrective loop (plan again, search again, check the draft) behind a confidence check. Nothing ever measured a need for it, so I never built it.

## Where it landed

It ran on Google Cloud from June 23, and anyone at Hybridge with a company Google account could sign in. I built a demo set of 13 short documents about Hybridge projects, with a conflicting pair and a restricted one. The <a href="/enterprise-search/demo-guide.html">demo guide</a> walks each stage, and the <a href="/enterprise-search/slides.html">slides</a> are the short version.

It is paused. Higher priority tools came first after July 23, and billing for its Google Cloud project has been off since October 8, 2026, so the database is suspended and the chat does not answer. I have no usage numbers. No billing export ever covered the project, so its cost was never measured.

Retrieval quality on real staff questions was not measured either. A seeded test fails the build if recall at 8 drops below 0.8 or mean reciprocal rank below 0.35, but it runs on test models and a fixed set, so it guards the wiring.

What I would keep: the permission filter inside the SQL, before anything ranks or reads a passage.
