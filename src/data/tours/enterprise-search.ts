import type { Tour } from "./types";

export const enterpriseSearch: Tour = {
  slug: "enterprise-search",
  name: "Enterprise Search",
  tail: "Cited answers, or an honest I don't know.",
  post: "/posts/enterprise-search",
  cover: "/enterprise-search.png",
  kicker: "RAG · Permission-aware retrieval",
  accent: "#22D3EE",
  accentRgb: "34, 211, 238",
  pitch:
    "Ask the company a plain-language question and get a streamed answer grounded only in internal documents, every claim cited, with sources that open to the exact passage. If retrieval finds nothing you may see, it says so, and the model is never even called.",
  problem:
    "Years of policies, SOPs, and specs lived across drives where the only search was asking a colleague. Worse, documents disagree: the 2025 schedule says Thursday, the 2026 one says Friday. A useful system has to know who may see what, which version is current, and when to admit it does not know.",
  metrics: [
    { label: "Eval recall@8", value: "1.0", sub: "floor 0.80, seeded eval harness" },
    { label: "Retrieval", value: "hybrid + RRF", sub: "dense 50 ‖ BM25 50 → rerank to 8" },
    { label: "Tests", value: "122", sub: "96 backend, 26 frontend" },
    { label: "Abstention", value: "0 tokens", sub: "no eligible sources = no model call" },
  ],
  concepts: ["RAG", "Hybrid retrieval", "Reciprocal Rank Fusion", "Reranking", "ACL pre-filtering", "Grounded generation", "Cite or abstain", "Document versioning"],
  stack: ["Python", "FastAPI", "Postgres + pgvector", "gemini-embedding-001 (768d)", "Gemini 2.5 Flash/Pro", "React 19", "Cloud Run", "Terraform"],
  steps: [
    {
      title: "Ingestion is governed, not casual",
      body: "An uploader drops a document and must scope it on the spot: who can find it, what class it is (Official Policy, Approved SOP, Draft, Note), and its effective date. Authority is computed server-side from class and uploader role, never client-supplied. Same content twice dedupes by hash; same source with new content becomes version n+1 and supersedes the old one.",
      screen: {
        kind: "cards",
        title: "Scope this document",
        cards: [
          { name: "Who can find it", lines: ["Everyone", "or specific groups: engineering, finance, restricted-alpha"], badge: "ACL" },
          { name: "Document class", lines: ["Approved SOP", "authority computed server-side"], badge: "governance" },
          { name: "Effective date", lines: ["2026-06-01", "newer effective date wins ties"] },
          { name: "Versioning", lines: ["Same source, new content → v2", "v1 stamped superseded, linked both ways"] },
        ],
      },
    },
    {
      title: "Layout-aware chunking and indexing",
      body: "Parsers emit typed blocks with reading order; the chunker packs about 800 tokens with 12% overlap and keeps headings attached to their sections, recording exact character offsets per chunk. Chunks get 768-dimension embeddings and land in three indexes at once: HNSW vector, full-text, and an ACL array index.",
      screen: {
        kind: "terminal",
        title: "Ingest pipeline",
        lines: [
          "$ ingest weekly-session-schedule-2026.pdf",
          "parse → 14 blocks (headings, paragraphs, tables)",
          "chunk → 6 chunks · ~800 tokens · 12% overlap · char offsets kept",
          "embed → 768d · index: HNSW ✓ tsvector ✓ ACL ✓ · status: Ready",
        ],
      },
    },
    {
      title: "Permissions filter before retrieval, not after",
      body: "The caller's groups are resolved server-side from their verified identity and applied as a SQL pre-filter: chunks outside their groups, and chunks of superseded documents, never enter the candidate pool. There is nothing to leak downstream because the model never sees it.",
      screen: {
        kind: "terminal",
        title: "Query plan",
        lines: [
          "$ ask \"When is the weekly AI office hour?\" as user in [engineering]",
          "WHERE acl && {engineering, everyone} AND status = 'current'",
          "dense top-50 ‖ BM25 top-50 → RRF (k=60) → rerank → top 8",
          "governance ladder: drop superseded → authority → effective date",
        ],
      },
    },
    {
      title: "Grounded answer with a conflict callout",
      body: "The model writes only from the eight selected passages and streams the answer. When two documents of equal authority disagree, the system says so out loud, follows the newer effective date, and cites both, instead of silently picking one.",
      screen: {
        kind: "search",
        query: "When is the weekly AI office hour, and has the time changed?",
        answer:
          "The weekly session runs Fridays at 11:00 AM Central for 45 minutes.¹ The earlier standing slot was Thursdays at 3:00 PM Central.² Sources disagree: two documents of equal authority give different times; this answer follows the more recent one (effective 2026-06-01) and cites both.",
        citations: [
          { doc: "Weekly Session Schedule (2026) · Approved SOP · effective 2026-06-01", snippet: "Effective June 2026, the weekly session moves to Fridays, 11:00 AM Central, 45 minutes…" },
          { doc: "Weekly Session Schedule (2025) · Approved SOP · effective 2025-11-01", snippet: "The weekly session is held Thursdays at 3:00 PM Central…" },
        ],
      },
    },
    {
      title: "Honest abstention",
      body: "Ask about a restricted document from an account outside its group and retrieval returns nothing eligible. The assistant says it does not have that, with zero sources, and the model is never invoked, so the refusal costs nothing and cannot hallucinate.",
      screen: {
        kind: "chat",
        messages: [
          { from: "user", text: "What are the FY planning priorities for the leadership group?" },
          { from: "agent", text: "I don't have that in the knowledge base. (No eligible sources were found for your access level, so no answer was generated.)" },
        ],
      },
    },
    {
      title: "Citations open the real passage",
      body: "Every citation carries document id, chunk id, and character offsets. Clicking one opens the source pane scrolled to the highlighted passage, and downloading the original goes through a permission check and a short-lived signed link.",
      screen: {
        kind: "report",
        title: "Source pane",
        sections: [
          { name: "Weekly Session Schedule (2026)", note: "…all hands-on help moves with it. Effective June 2026, the weekly session moves to Fridays, 11:00 AM Central, 45 minutes, in the shared virtual room. Recordings post the same day…" },
        ],
      },
    },
  ],
  architecture: [
    { lane: "Store", items: ["One Postgres + pgvector for chunks, vectors, tsvectors, ACLs, versions, audit", "Similarity AND permission AND currency collapse into one query plan", "Originals in Cloud Storage behind signed URLs"] },
    { lane: "Retrieval", items: ["HNSW cosine top-50 ‖ BM25 top-50", "Reciprocal Rank Fusion, k=60", "Cross-encoder rerank to 8, with graceful fallback"] },
    { lane: "Generation", items: ["Gemini 2.5 Flash default, Pro selectable", "Cite-or-abstain system prompt, streamed over SSE", "No eligible retrieval → no model call at all"] },
    { lane: "Governance", items: ["Server-side authority from class + role", "Version chains with supersede links", "Deny-by-default ACL, audit log, Terraform infra"] },
  ],
  outcome:
    "The retrieval stack scores recall@8 of 1.0 and MRR 0.42 on a seeded eval harness with deterministic fakes, honest framing: those are eval-rig numbers, not production traffic. The design decisions that matter survived adversarial review, which caught a permission-sentinel bug, an authority-scoring bug, and a race that would have wiped the first streamed answer. Attachments, voice input, and doc-type facets ship in the real UI as visibly disabled, coming-soon controls rather than pretending.",
};
