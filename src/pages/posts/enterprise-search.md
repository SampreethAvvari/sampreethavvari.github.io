---
title: "Building an enterprise search that knows when to say 'I don't know'"
date: "2026-06-23"
layout: ../../layouts/PostLayout.astro
description: "Hybridge's knowledge is scattered across drives, decks, and people's heads. I'm building an internal search that answers questions in plain language, with citations, and that refuses to guess when it isn't sure. This is how I'm thinking about a RAG you can actually trust, built one stage at a time."
img_path: "/enterprise-search.png"
img_alt: "Enterprise Search: documents flowing into one governed index, a question flowing out as a cited answer"
tag: "AIE"
tone: "emerald"
stats:
  - value: "Ask Hybridge"
    label: "one chat box over the whole company's knowledge, with citations"
    tone: "emerald"
  - value: "cite or abstain"
    label: "the model answers from retrieved evidence, or it says it doesn't know"
    tone: "blue"
  - value: "stage by stage"
    label: "foundation, ingestion, serving, and both front ends shipped; evaluation is the referee still being built"
    tone: "amber"
---

Every company my size has the same quiet problem. The answer to your question exists. It is in a slide deck from eight months ago, or a policy doc nobody re-shares, or in one person's head, and that person is on vacation. So you ask around, you guess, and sometimes you act on a version of the truth that got replaced in March.

I am building the fix for Hybridge: an internal search where anyone signs in with their company account, types a question in plain language, and gets a real answer with the sources attached. We call it **Ask Hybridge**. People who are allowed to add documents drop them into a portal, and those documents flow through a careful pipeline before they ever become searchable.

The easy version of this is a weekend project now. You chunk some documents, embed them, stuff the top matches into a prompt, and call it RAG. I did not want the easy version. We work in healthcare, which means patient data, HR records, and trade secrets all live in the same building. In that setting a confident wrong answer is not a cute demo bug. It is a liability. So the whole design is organized around one idea: the system should be trustworthy first, and clever second.

## The one rule everything serves

Here is the principle I keep coming back to. The system should answer from what it actually found, and when it did not find enough, it should say so. No filling the gap with a plausible guess. An honest "I don't know, here is the closest thing" is a feature, not a failure.

That sounds obvious. It is surprisingly hard, and almost every shortcut in RAG quietly breaks it.

<div class="stat-callout stat-emerald">
  <div class="stat-value">trust first, clever second</div>
  <div class="stat-label">Every stage either makes the answer more trustworthy (hybrid retrieval, reranking, conflict resolution, citations, grounding) or it stays off the hot path until the evaluation says it earns its place.</div>
</div>

## Why I am not building a "basic" RAG

A basic RAG fails in three ways that matter in a real company, so I planned for all three from the start.

It fails on exact terms. Pure vector search is great at meaning and bad at specifics. Search a part number, a policy code, or a person's name and a semantic-only index will hand you something that "feels related" instead of the exact match. The fix is to run keyword search and vector search together.

It fails on conflicts. Two documents disagree. One is the current SOP, one is a draft from last year that nobody deleted. A naive system picks whichever happens to rank higher and presents it with total confidence. That is the dangerous one.

It fails on permissions. The marketing team should never retrieve a document restricted to the clinical group, even by accident, even as "context" the model quietly reads. Access has to be enforced before retrieval, not bolted on after.

## How a question gets answered (the read path)

When someone asks a question, the answer travels a fixed path. I kept the common case fast and simple, and put the expensive, clever steps behind a gate so they only run when a question actually needs them.

<div class="aside">
<strong>The read path, in order.</strong>
<ol>
<li><strong>Rewrite</strong> the question only if it is vague or part of a back-and-forth chat. A well-formed question skips this.</li>
<li><strong>Filter by permission</strong> first, as a database condition. Documents you are not allowed to see never enter the search.</li>
<li><strong>Retrieve two ways at once</strong>: keyword search (BM25) for exact terms, vector search for meaning.</li>
<li><strong>Merge</strong> the two result lists with Reciprocal Rank Fusion.</li>
<li><strong>Rerank</strong> a small top slice with a dedicated ranking model, for precision without paying the latency on everything.</li>
<li><strong>Resolve conflicts</strong> deterministically (see below).</li>
<li><strong>Answer</strong>, citing the exact passages. If the evidence is thin, abstain.</li>
</ol>
</div>

Most questions are simple lookups, and they take the fast path and finish. Only the hard ones, the low-confidence or multi-step questions, trigger a corrective loop: re-plan, retrieve again, fall back to a web search if the answer genuinely is not in our knowledge, check the draft answer against the evidence, and only then respond.

I want to be clear about why that loop is gated rather than always-on. An agent that re-plans on every single query feels smart and behaves badly. It is slower, it costs more, and it pulls in noisier context that can make a simple answer worse. So the expensive behavior only switches on when a confidence check says the simple path did not work. The default is fast and boring. The cleverness is held in reserve.

## When sources disagree, the model does not get to pick

This is the part I am most careful about. When two retrieved passages make conflicting claims, the model is never allowed to just choose one. A small piece of plain code ranks the evidence first, by rules anyone can read.

<div class="aside">
<strong>The conflict ladder (deterministic).</strong>
<ol>
<li>Group the evidence by what each piece actually claims.</li>
<li>Drop anything marked superseded or deprecated. A replaced document cannot win.</li>
<li>Higher authority wins (an official policy outranks a personal note).</li>
<li>If authority ties, the most recent effective date wins.</li>
<li>If it still cannot be resolved, declare the disagreement: show both answers with their author, date, and source, and say plainly that the sources disagree.</li>
</ol>
</div>

The model's job is only to notice that two passages genuinely contradict each other and to write the answer in a way that honors that ranking, or to surface the disagreement honestly. The decision about which source is more authoritative is made by rules, not vibes. That is the difference between a search you can run a company on and a search that sounds confident.

## What happens when a document comes in (the write path)

Retrieval is only as good as what got indexed, so the ingestion side gets the same care. A document does not become searchable just because someone uploaded it.

<div class="aside">
<strong>The write path, in order.</strong> Store the original safely and fingerprint it. Skip it if it is a duplicate. Parse it with layout awareness so tables and slides survive. Chunk it on real topic and structure boundaries, not blind fixed windows. Attach metadata and a short "document card" (a title, a one-paragraph summary, key entities, the effective date, who can see it). Embed in batches. Index the vectors, the keyword text, and the permissions together.
</div>

Two details there do a lot of quiet work. The **document card** stays small no matter how long the document is, so the system can route and display a document without re-reading the whole thing. And every chunk is stamped with the version of the embedding model and chunking strategy that produced it, so when I improve either one later, I can re-index safely instead of guessing what is stale.

## The part most people skip: measuring it

Here is the question that started the whole project for me. How do I know the answer is good before I trust it? Most RAG demos never answer that. They look impressive in a screenshot and nobody checks the hit rate.

So I am building an evaluation harness alongside the system, not after it. It measures retrieval with the standard metrics (did the right document show up, and how high), and it measures the generation for faithfulness, whether every claim in the answer is actually backed by a cited source. It even runs a managed search product in parallel as a yardstick, so I can compare what I built against a strong baseline and know whether my extra machinery is earning its keep.

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-emerald">
    <div class="stat-value">recall · nDCG · MRR</div>
    <div class="stat-label">did the right source come back, and did it rank near the top</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">faithfulness</div>
    <div class="stat-label">is every sentence in the answer grounded in a citation, or did the model improvise</div>
  </div>
  <div class="stat-callout stat-amber">
    <div class="stat-value">vs. a managed baseline</div>
    <div class="stat-label">my pipeline runs next to an off-the-shelf one so the comparison is honest</div>
  </div>
</div>

The harness is the referee. It is what decides when a fancier idea actually goes into production and when it stays a nice diagram. That rule is how I keep an ambitious system from turning into an over-engineered one.

## The stack, in one box

<div class="aside">
<strong>Built on Google Cloud, open-source and GCP-native only (no third-party SaaS).</strong> Identity Platform for domain-locked Google sign-in. Cloud Run for the API and pipeline jobs, with Pub/Sub and Eventarc for event-driven ingestion. Document AI for layout-aware parsing. Vertex AI for embeddings, reranking, and Gemini for generation (a bigger model for ingestion, a fast one for most answers). Postgres on Cloud SQL holding the vectors (pgvector), the keyword index, the metadata, and the access rules in one place. Terraform for the infrastructure, Cloud Build for CI/CD. Everything chosen is HIPAA-eligible under a Google business associate agreement, with customer-managed encryption and full audit logging.
</div>

I deliberately started on Cloud SQL with pgvector instead of a heavier specialized vector database. It meets every need we have at our current size of hundreds to low thousands of documents, at roughly half the cost, and there is a clean upgrade path the day the evaluation harness tells me I have outgrown it. That is the theme again: pick the simple thing, and let the measurements, not the hype, tell me when to add complexity.

## Where it stands, with no rounding up

I am building this the way you would teach it, one stage at a time, because each stage is also a chunk of RAG I wanted to learn properly by hand.

| Stage | What it owns | Status |
|---|---|---|
| Foundation and auth | GCP setup, domain-locked sign-in, roles and groups, secrets, CI/CD, infrastructure as code | Shipped |
| Ingestion | upload, dedup, parse, chunk, metadata, embed, index | Shipped |
| Query serving | filter, hybrid retrieval, rerank, grounded streaming answer, abstain guardrail | Shipped, first version |
| Evaluation | retrieval and faithfulness metrics, conflict tests, managed baseline | In build; the numbers are not published until it says so |
| Search and Dropoff front ends | the chat experience and the upload portal | Shipped |

What is real today, as of July 2026: the whole loop works end to end. You sign in with your company account, ask a question, and watch a cited answer stream back from documents you are allowed to see, with conversation history kept. The abstain rule is not a prompt suggestion anymore, it is enforced in code: if retrieval comes back empty, the system short-circuits and says it does not have the answer, and the model is never even called. Authorized people add documents through the Dropoff portal, scoping each one at upload time with its visibility, tags, document class, and effective date, exactly the metadata the conflict ladder needs later, and then watch it move through the pipeline. Tabs and uploads are gated by role, and the API degrades gracefully instead of hallucinating when the AI backend is unavailable.

The evaluation harness is the part still being built, and it is the reason I am not quoting recall or faithfulness numbers here. The referee gets built before the victory lap.

One war story from shipping it, because it repeats a pattern I keep seeing: the bug that blocked every single login for a day was not the retrieval stack or the model. It was an auth SDK that needed initializing before its first token check. The AI is rarely the thing that breaks. The plumbing is.
