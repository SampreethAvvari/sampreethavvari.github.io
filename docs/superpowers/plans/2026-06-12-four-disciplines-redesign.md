# Four Disciplines Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Four disciplines" section (AIE / FDE / MLE / SDE) as the first numbered
section on the landing page, renumber the existing sections, and ship a new `/work` area
with four in-depth discipline pages — Apple-sleek, using the site's existing design system.

**Architecture:** One new data module (`src/data/disciplines.ts`) is the single source of
truth for all four disciplines (colors, copy, projects, articles). The landing section and
all five `/work` pages render from it. Discipline hero images are generated with Vertex AI
`gemini-2.5-flash-image` (nano banana) via the existing `scripts/gen-post-image.ps1` pattern.

**Tech Stack:** Astro 4, Tailwind (existing custom design system in `src/styles/global.css`),
no new dependencies. Deploy: push to `main` → GitHub Actions → GitHub Pages.

**Research base:** `c:\Users\SAvvari\Downloads\Claude Cowork\project-docs\` (13 docs + confirmed
decisions in `00-INDEX.md`).

**Confirmed decisions:**
- Labels: full names + acronym badges. Order everywhere: **AIE, FDE, MLE, SDE**.
- Colors: AIE emerald `#34D399`, FDE amber `#F5A524`, MLE violet `#A78BFA`, SDE blue `#5B8DEF`.
- Honest status chips ("In production", "Pilot-ready", "Design complete").
- Dashboard orphan-revenue figure: **~$460K** (replaces $169K everywhere).
- LLM-Persuasion research: methodology story, no invented numbers.
- AI Lab = full FDE project card. CDF = "current frontier" teaser. JobPilot stays (SDE+AIE).
- Filmmaking page untouched.

---

## File Structure

- Create: `src/data/disciplines.ts` — discipline definitions, project cards, article refs
- Create: `src/components/work_section/DisciplineGrid.astro` — landing-page 4-panel section
- Create: `src/components/work_section/WorkTabs.astro` — sub-tab nav shared by /work pages
- Create: `src/pages/work/index.astro` — overview page (4 large panels + framing copy)
- Create: `src/pages/work/[slug].astro` — static paths for aie/fde/mle/sde detail pages
- Create: `scripts/gen-discipline-images.ps1` — nano banana generation for 4 hero images
- Create: `public/discipline-{aie,fde,mle,sde}.png` (generated)
- Modify: `src/pages/index.astro` — insert section, renumber 01→02…05→06, $169k→$460K
- Modify: `src/components/navbar/Nav.jsx` — add "Work" link
- Modify: `src/styles/global.css` — `.dx-*` panel styles, work-page styles, status chips
- Modify: `src/pages/posts/cowork-dashboard.md` — $169K→~$460K in stats/copy

## Content map (from project-docs)

| Discipline | Projects (order) | Articles |
|---|---|---|
| AIE | Doc Coach (prod), NPC Coach (pilot-ready), CRM AI design (design), Site chatbot (live), JobPilot (prototype) | clinical-rag, doctor-report-cards, jobpilot-v2 |
| FDE | Cowork Dashboard (prod), AI Lab & Office Hours (running), CRM blueprint (design complete), Accounting platform (prod), CDF teaser | cowork-dashboard, accounting-automation, film-and-engineering |
| MLE | CBCT Validator (prod, flagship), LLM Persuasion (research), Loan Radar, ResNet <5M, RecSys 22M | cbct-scan-validator, llama-rlhf, loan-radar-mlops, resnet-under-5m, recsys-spark-bigdata |
| SDE | Treatment Estimator v1+v2 (prod/build), Accounting platform (prod), NPC engineering story, Dashboard verify harness, This site, JobPilot | treatment-estimator, pipeline-ghosting, accounting-automation |

Existing thumbnails in `/public`: `doc-coach.png`, `npc-coach.png`, `cbct-validator.png`,
`treatment-estimator.png`, `cowork-dashboard.png`, `accounting-automation.png`,
`llm-persuasion.png`, `loan-radar.png`, `resnet-compact.png`, `customer-segmentation.png`,
`jobpilot.png`, `pipeline-ghosting.png`, `doctor-report-cards.png`.

---

### Task 1: Discipline data module

**Files:** Create `src/data/disciplines.ts`

- [ ] **Step 1:** Write the module exporting `disciplines: Discipline[]` with this shape:

```ts
export type DxStatus = "In production" | "Pilot-ready" | "In build" | "Design complete"
  | "Running program" | "Live" | "Research" | "Prototype" | "Academic";

export interface DxProject {
  name: string; status: DxStatus; oneLiner: string; img?: string; href?: string;
  highlights?: string[];   // used on detail pages only
}
export interface DxArticle { title: string; href: string; img?: string; }
export interface Discipline {
  slug: "aie" | "fde" | "mle" | "sde";
  acronym: string; name: string; accent: string; rgb: string;
  tagline: string;          // landing panel one-liner
  summary: string;          // /work index paragraph
  narrative: string[];      // detail-page paragraphs (grounded voice, no marketing register)
  strengths: { title: string; body: string }[];
  projects: DxProject[]; articles: DxArticle[];
  heroImg: string;          // /discipline-<slug>.png
}
```

Populate all four from the content map above; copy drafted from
`project-docs/01…12`. Voice rules: grounded, first person, STAR-flavored, no em-dash spam.

- [ ] **Step 2:** `npx astro check` (or `npm run build`) to verify types compile.
- [ ] **Step 3:** Commit: `feat: add disciplines data module`

### Task 2: Landing-page section + renumbering

**Files:** Create `src/components/work_section/DisciplineGrid.astro`; Modify `src/pages/index.astro`, `src/styles/global.css`

- [ ] **Step 1:** Build `DisciplineGrid.astro`: section `id="disciplines"`, eyebrow
  `01 / What I do`, heading, then a `lg:grid-cols-4 md:grid-cols-2` grid of `.dx-panel`
  anchors (each `href=/work/{slug}`). Each panel: acronym badge + full name, tagline,
  2 project preview rows (thumb image + name + status chip) and 1 article row, "Explore →"
  footer. Panels set `--dx` / `--dx-rgb` inline (skills-card pattern).
- [ ] **Step 2:** Add `.dx-panel` styles to `global.css` (accent-washed glass cards,
  hover lift + border glow, reduced-motion safe).
- [ ] **Step 3:** Insert `<DisciplineGrid />` in `index.astro` between Hero and Work
  chapters. Renumber eyebrows: Work `01→02`, About `02→03`, Writing `03→04`,
  Filmmaking `04→05`, Connect `05→06`. Point the hero "See the work" button at
  `#disciplines`.
- [ ] **Step 4:** Update Cowork Dashboard metric in `index.astro` systems array:
  `metric: "$169k"` → `"~$460K"`, metricLabel → `"of orphan revenue surfaced"`, tagline
  "six figures" stays accurate.
- [ ] **Step 5:** `npm run build` — expect success; eyeball dist or dev server.
- [ ] **Step 6:** Commit: `feat: four-disciplines section on landing, renumber chapters`

### Task 3: Work pages

**Files:** Create `src/components/work_section/WorkTabs.astro`, `src/pages/work/index.astro`,
`src/pages/work/[slug].astro`; Modify `src/styles/global.css`, `src/components/navbar/Nav.jsx`

- [ ] **Step 1:** `WorkTabs.astro` — horizontal pill tab bar (All / AIE / FDE / MLE / SDE),
  active tab tinted with that discipline's accent; sticky under the navbar on detail pages.
- [ ] **Step 2:** `/work/index.astro` — hero ("Four disciplines, one operating mode"),
  then four full-width alternating panels (hero image right/left, summary, top-3 project
  rows, link to detail).
- [ ] **Step 3:** `/work/[slug].astro` with `getStaticPaths()` over `disciplines` —
  per page: atmospheric hero (generated image + acronym watermark + narrative),
  strengths grid (skills-card language), project cards (image, status chip, one-liner,
  highlights list, blog link), articles strip, prev/next discipline footer nav.
- [ ] **Step 4:** Status chip styles `.status-chip` (+ per-status tints) in `global.css`.
- [ ] **Step 5:** Nav.jsx: add `{ name: "Work", href: "/work", icon: "fas fa-layer-group",
  match: "work" }` after Home.
- [ ] **Step 6:** `npm run build`; click through all 5 routes locally.
- [ ] **Step 7:** Commit: `feat: /work area with four discipline deep-dive pages`

### Task 4: Hero images via nano banana

**Files:** Create `scripts/gen-discipline-images.ps1`; outputs to `public/`

- [ ] **Step 1:** Script loops 4 prompts → Vertex `gemini-2.5-flash-image`
  (project `hybridge-npc-prod`, `gcloud auth print-access-token`), 16:9, dark premium
  tech-editorial style matching existing post art, each tinted to its discipline color,
  no text/people/logos.
- [ ] **Step 2:** Run; verify images exist and look coherent; re-roll weak ones.
- [ ] **Step 3:** Wire into `disciplines.ts` heroImg fields (already pathed).
- [ ] **Step 4:** Commit: `feat: discipline hero art`

### Task 5: Blog metric correction

**Files:** Modify `src/pages/posts/cowork-dashboard.md`

- [ ] **Step 1:** Replace $169K stat value/copy with ~$460K (keep the 49%→99% linkage stat).
- [ ] **Step 2:** Commit: `fix: cowork dashboard orphan-revenue figure to ~$460K`

### Task 6: Verify + deploy

- [ ] **Step 1:** `npm run build` clean; check all internal links resolve in dist.
- [ ] **Step 2:** Push to main; `gh run list` until deploy succeeds; WebFetch live URL to
  confirm new section renders (cache-busting lesson: verify the deploy, not the browser).

## Self-review notes
- Spec coverage: landing panel section ✔ (Task 2), renumbering ✔ (Task 2), Work tab with
  4 sub-tabs ✔ (Task 3), images ✔ (Task 4), per-discipline depth ✔ (data in Task 1).
- Commits per task; no TDD test framework exists in this repo — verification is
  `npm run build` + manual route checks, consistent with repo practice.
