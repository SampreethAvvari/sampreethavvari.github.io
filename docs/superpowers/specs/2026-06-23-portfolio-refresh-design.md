# Portfolio Refresh — Design & Plan

**Date:** 2026-06-23
**Owner:** Sampreeth Avvari
**Status:** Approved by user ("go ahead"); executing.

## Goal

Refresh the portfolio (`sampreethavvari.github.io`) into a high-premium, modern AI-engineer
site: write/refresh project blogs in a new explanatory voice, make Enterprise Search (RAG)
the flagship, redo the landing page (parallax + animated 4-color background, photo moved),
rebuild the skills section into 4 discipline buckets with official logos, and ship an
iOS-26 glass nav that shrinks to icons on scroll.

## Blog voice (applies to all project blogs I write/rewrite)

- Plain, conversational, explanatory English. The reader should *see my thinking, design,
  and implementation*, like a teaching blog. No slang. Calm and clear, not marketing-punchy.
- Dense technical material (stack, configs, exact metrics, schemas, code) lives in
  **separate boxes/callouts** (stat callouts, tech-stack asides, code blocks, tables), so
  the prose stays readable.
- **No em-dashes or en-dashes** (—, –). Use commas, periods, parentheses. Normal hyphens in
  compound words (in-house) and numeric ranges (24-48 hrs) are fine.
- Short paragraphs. Quantified. Light dry human humor allowed. No AI tell.

## Workstreams

### 1. Enterprise Search (RAG) — new flagship
- New blog `posts/enterprise-search.md`: honest, architecture-forward deep dive. Hybrid
  retrieval (BM25 + pgvector) -> RRF -> Vertex rerank -> deterministic conflict resolution
  -> grounded generation + citations, gated CRAG loop, eval harness. Built stage by stage;
  Foundation+Auth shipped, Ingestion designed. Trust + governance is the spine.
- `info.ts`: new industry entry "Enterprise Search", placed FIRST. Old n8n "Enterprise Data
  Project" stays as a separate, smaller card lower down.
- Generate cover `/enterprise-search.png` (nano-banana house style).

### 2. CDF + Reconciliation + NPC blogs
- CDF (`cdf-diagnostic-filter.md`): rewrite in new voice.
- Reconciliation (`reconciliation.md`): rewrite in new voice.
- NPC: merge 5 blogs (rebuild, architecture, scoring, bugs, dashboard) into ONE
  `npc-coach.md` flagship with sections. Delete the other 4; update every cross-reference
  (info.ts, disciplines.ts, projects.astro POST_FOR, index.astro highlights).

### 3. Site-wide de-dash
- Strip em/en dashes from every other blog post; convert to natural punctuation. Keep
  legit hyphens. Light cleanup only for the ~20 not-in-scope posts (not full rewrites).

### 4. Projects tab ordering
- Industry order: Enterprise Search, Doc Coach, CBCT, CDF, NPC, then Treatment Estimator,
  Cowork Dashboard, Reconciliation, n8n Enterprise Data (last).
- Add JobPilot to the projects page (currently missing). Keep Llama RLHF research prominent.

### 5. Landing hero
- Remove portrait photo from hero. Hero becomes copy-led.
- Parallax: 2-3 generated nano-banana art layers at different depths, drift on scroll + mouse.
- Animated background "video": 4 discipline colors (emerald AIE, amber FDE, violet MLE,
  blue SDE). Produce BOTH a Veo-generated clip and a CSS/canvas animated field; pick the
  better. Must blend in light AND dark mode (swap opacity/blend-mode per theme).
- Move portrait to the About section near Education/Experience with `.floaty` + glow + shimmer.

### 6. Skills section -> 4 discipline buckets + logos
- Buckets: AIE (emerald), MLE (violet), FDE (amber), SDE (blue). Each shows relevant skills
  as official logos, downloaded as self-hosted SVGs in `public/logos/`.

### 7. Nav — iOS-26 glass + scroll collapse
- Liquid-glass translucent top bar (backdrop blur). On scroll: shrinks; labels collapse to
  icons only. Works light + dark.

## Image/video generation
- Mechanism: Vertex `gemini-2.5-flash-image` for stills (see `scripts/gen-*-images.ps1`),
  project `hybridge-npc-prod`, PS 5.1 fix (Expect100Continue=false, TLS1.2), ASCII-only
  prompts, responseModalities IMAGE, imageConfig.aspectRatio.
- Video: try Veo on Vertex; fall back to CSS/canvas field if unavailable/poor.

## Constraints
- Commit author is Sampreeth (local git config); no Co-Authored-By trailer.
- Verify with `npm run build` before claiming done. Hold push/deploy until user confirms.
- "I don't see changes" is usually browser cache; verify live via gh run list + fetch.
