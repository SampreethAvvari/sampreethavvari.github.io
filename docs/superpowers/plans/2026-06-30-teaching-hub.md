# Teaching Hub Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a `/teaching` hub: filterable/sortable materials (PDF/blog/video) grouped by stream (AIE/MLE/SDE/FDE), viewed in-site, downloaded behind a private rating+feedback gate (emailed to spa9659@nyu.edu), with live view/download counts and a Sampreeth branding block — seeded with the AI Engineers Handbook.

**Architecture:** Static Astro pages built from `src/data/teaching.ts`; a dedicated `sampreeth-teaching` Cloudflare Worker + D1 serves counts and the review/email; the browser calls it via `PUBLIC_TEACHING_API` and degrades gracefully when absent.

**Tech Stack:** Astro + React islands + Tailwind (existing); Cloudflare Workers + D1; Resend (email); Font Awesome icons; existing `<Picture>` image pipeline.

## Global Constraints

- Commits authored as `SampreethAvvari <spa9659@nyu.edu>`, no Claude trailer.
- Streams are exactly `aie | mle | sde | fde` (match `src/data/disciplines.ts`).
- Reviews are PRIVATE: feedback never rendered; only emailed + stored. Only aggregate avg rating + counts are public.
- Images via `<Picture>` (so deep optimizer + prune-dist keep deploy lean); PDFs live in `/public/teaching/`.
- Client reads `import.meta.env.PUBLIC_TEACHING_API`; all dynamic features fail-open (no API → counts "—", download still works).
- Don't touch the `chatbot-worker`; the teaching backend is a separate worker.

---

## File Structure

- `src/data/teaching.ts` — types (`Stream`, `MaterialType`, `TeachingMaterial`) + `teaching[]` data + per-entry validation.
- `src/lib/teachingApi.ts` — tiny client: `getStats()`, `getStat(slug)`, `postView(slug)`, `postDownload(slug)`, `postReview(slug,rating,feedback)`; all no-throw (return null on failure).
- `src/components/teaching/MaterialCard.astro` — one card (cover via `<Picture>`, badge, title, description, stats slots).
- `src/components/teaching/TeachingBrowser.tsx` — React island: filter chips + sort dropdown + grid; fetches stats, injects counts, sorts.
- `src/components/teaching/MaterialActions.tsx` — React island: view increment + download button + review-gate modal + live counts.
- `src/components/teaching/TeachingBranding.astro` — "Connect with me" block from `info.contact`.
- `src/pages/teaching.astro` — index page (hero + `<TeachingBrowser>`).
- `src/pages/teaching/[slug].astro` — viewer page (PDF/video/blog + What to expect + `<MaterialActions>` + `<TeachingBranding>`).
- `src/components/navbar/Nav.jsx` — add Teaching link.
- `public/teaching/ai-engineers-handbook.pdf` — the PDF; `public/teaching/ai-engineers-handbook.png` — generated cover.
- `teaching-worker/` — `wrangler.toml`, `schema.sql`, `src/index.ts`, `src/handler.ts`, `package.json`, `tsconfig.json`, `test/handler.test.ts`.
- `docs/superpowers/plans/DEPLOY-teaching-worker.md` — human deploy steps.

---

## Task 1: Content model — `src/data/teaching.ts`

**Files:** Create `src/data/teaching.ts`.

**Produces:** `Stream`, `MaterialType`, `TeachingMaterial`, `teaching: TeachingMaterial[]`, `streamMeta` (label/acronym per stream).

- [ ] **Step 1:** Write the file:

```ts
export type Stream = "aie" | "mle" | "sde" | "fde";
export type MaterialType = "pdf" | "blog" | "video";

export interface TeachingMaterial {
  slug: string;
  type: MaterialType;
  stream: Stream;
  title: string;
  description: string;   // one-line card subtitle
  whatToExpect: string;  // longer paragraph(s) on the page
  cover: string;         // /teaching/<slug>.png
  addedAt: string;       // ISO date
  file?: string;         // pdf
  videoUrl?: string;     // video (embeddable)
  body?: string;         // blog (HTML/markdown string)
  pages?: number;
  durationMin?: number;
}

export const streamMeta: Record<Stream, { acronym: string; label: string; accent: string }> = {
  aie: { acronym: "AIE", label: "AI Engineering", accent: "#34D399" },
  mle: { acronym: "MLE", label: "ML Engineering", accent: "#A78BFA" },
  sde: { acronym: "SDE", label: "Software Engineering", accent: "#5B8DEF" },
  fde: { acronym: "FDE", label: "Forward-Deployed Eng", accent: "#F5A524" },
};

export const teaching: TeachingMaterial[] = [
  {
    slug: "ai-engineers-handbook",
    type: "pdf",
    stream: "aie",
    title: "The AI Engineer's Handbook",
    description: "A practical field guide to building real AI systems — RAG, agents, evals, and shipping.",
    whatToExpect:
      "A hands-on handbook for engineers building production AI: how to design retrieval that stays grounded, when to reach for agents, how to evaluate systems you can't fully predict, and the operational habits that keep them trustworthy. Written from systems actually shipped, not demos.",
    cover: "/teaching/ai-engineers-handbook.png",
    addedAt: "2026-06-30",
    file: "/teaching/ai-engineers-handbook.pdf",
    pages: 0,
  },
];

// Build-time guard: each entry has the field matching its type.
for (const m of teaching) {
  const ok = m.type === "pdf" ? !!m.file : m.type === "video" ? !!m.videoUrl : !!m.body;
  if (!ok) throw new Error(`teaching: "${m.slug}" (${m.type}) is missing its content field`);
}
```

- [ ] **Step 2:** `npx astro check` (or build later) parses without TS errors.
- [ ] **Step 3:** Commit `feat(teaching): content model + first AIE entry`.

---

## Task 2: PDF + generated cover

**Files:** `public/teaching/ai-engineers-handbook.pdf`, `public/teaching/ai-engineers-handbook.png` (+ generated `.avif/.webp`).

- [ ] **Step 1:** Copy the PDF:
```bash
mkdir -p public/teaching
cp "/c/Users/SAvvari/Downloads/Claude Cowork/Research work/AI Engineering Mastery/AI_Engineers_Handbook.pdf" "public/teaching/ai-engineers-handbook.pdf"
```
- [ ] **Step 2:** Generate the cover via Nano Banana (gemini-2.5-flash-image, jobpilot-sva, curl) in the dark-neon house style — a book/handbook motif, "AI Engineer's Handbook", emerald/AIE accent. Save to `public/teaching/ai-engineers-handbook.png` (landscape ~1200x750).
- [ ] **Step 3:** `node scripts/optimize-images-deep.mjs` (generates `.avif/.webp` for the new subfolder cover).
- [ ] **Step 4:** Commit `feat(teaching): add AI handbook PDF + cover`.

---

## Task 3: Nav tab — `src/components/navbar/Nav.jsx`

- [ ] **Step 1:** In the `links` array, after the Blog entry add:
```jsx
{ name: "Teaching", href: "/teaching", icon: "fas fa-graduation-cap", match: "teaching" },
```
- [ ] **Step 2:** Build; confirm the tab shows on desktop + hamburger.
- [ ] **Step 3:** Commit `feat(teaching): add Teaching nav tab`.

---

## Task 4: API client — `src/lib/teachingApi.ts`

**Produces:** `getStats(): Promise<Record<string,Stat>|null>`, `getStat(slug)`, `postView(slug)`, `postDownload(slug)`, `postReview(slug,rating,feedback): Promise<{downloads,ratingAvg,ratingCount}|null>`. `Stat = {views,downloads,ratingAvg,ratingCount}`. All catch errors → return null.

- [ ] **Step 1:** Write the module:
```ts
const API = import.meta.env.PUBLIC_TEACHING_API as string | undefined;
export type Stat = { views: number; downloads: number; ratingAvg: number; ratingCount: number };
const post = async (path: string, body: object) => {
  if (!API) return null;
  try {
    const r = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
};
export const getStats = async (): Promise<Record<string, Stat> | null> => {
  if (!API) return null;
  try { const r = await fetch(`${API}/stats`); return r.ok ? await r.json() : null; } catch { return null; }
};
export const postView = (slug: string) => post("/view", { slug });
export const postDownload = (slug: string) => post("/download", { slug });
export const postReview = (slug: string, rating: number, feedback: string) => post("/review", { slug, rating, feedback });
```
- [ ] **Step 2:** Commit `feat(teaching): API client (fail-open)`.

---

## Task 5: Branding block — `src/components/teaching/TeachingBranding.astro`

- [ ] **Step 1:** Build a "Connect with me" card pulling LinkedIn / email / GitHub from `info.contact` (read `src/data/info.ts` for exact field names first), styled like existing cards (rounded, ring, dark-mode aware). Email link `mailto:`, LinkedIn/GitHub `target=_blank rel=noreferrer`.
- [ ] **Step 2:** Commit `feat(teaching): branding/contact block`.

---

## Task 6: Material card — `src/components/teaching/MaterialCard.astro`

**Consumes:** a `TeachingMaterial`. **Produces:** a card with `data-slug`, `data-stream`, `data-added`, cover `<Picture>`, type badge, title, description, and stat placeholders (`[data-stat="views|downloads|rating"]` showing "—").

- [ ] **Step 1:** Implement the card (link wraps to `/teaching/<slug>`). Use `<Picture src={m.cover} .../>`.
- [ ] **Step 2:** Commit `feat(teaching): material card`.

---

## Task 7: Index page + browser island

**Files:** Create `src/pages/teaching.astro`, `src/components/teaching/TeachingBrowser.tsx`.

- [ ] **Step 1:** `teaching.astro`: BaseLayout + hero + render `<TeachingBrowser client:load entries={teaching} />` (pass serializable entries).
- [ ] **Step 2:** `TeachingBrowser.tsx`: state `stream` (all|aie|mle|sde|fde) + `sort` (newest|views|downloads|rating). Renders filter chips + sort `<select>` + responsive grid of cards (mirror MaterialCard markup in JSX). `useEffect` → `getStats()` → store map → display counts + enable views/downloads/rating sorts. Default newest (by `addedAt`). Empty stream → quiet "More coming" tile.
- [ ] **Step 3:** Build; verify filter/sort work with stats absent (counts "—", newest sort).
- [ ] **Step 4:** Commit `feat(teaching): index page with filter + sort`.

---

## Task 8: Viewer page + actions island

**Files:** Create `src/pages/teaching/[slug].astro`, `src/components/teaching/MaterialActions.tsx`.

- [ ] **Step 1:** `[slug].astro`: `getStaticPaths()` from `teaching`. Render badges + title + "What to expect" + the viewer:
  - pdf: `<iframe src={m.file} class="w-full rounded-xl" style="height:80vh">`.
  - video: responsive 16/9 iframe of `m.videoUrl`.
  - blog: render `m.body`.
  Then `<MaterialActions client:load slug={m.slug} type={m.type} file={m.file} title={m.title} />` and `<TeachingBranding />`.
- [ ] **Step 2:** `MaterialActions.tsx`: on mount → if `!sessionStorage["v:"+slug]` then `postView(slug)` + set flag; load counts via `getStat`/`getStats`. Render live 👁/⬇ + a Download button. Click: if `localStorage["r:"+slug]` → `postDownload` then trigger download; else open modal (1–5★ required + feedback textarea required; submit disabled until both set) → `postReview` → on success (or null/fail-open) set flag, trigger download, refresh counts. Download = create `<a href={file} download>` and click it (same-origin, no new tab).
- [ ] **Step 3:** Build; verify each type renders in-site; modal validation; fail-open download.
- [ ] **Step 4:** Commit `feat(teaching): material viewer + download/review gate`.

---

## Task 9: Cloudflare teaching worker + D1

**Files:** Create `teaching-worker/{wrangler.toml,schema.sql,package.json,tsconfig.json,src/index.ts,src/handler.ts,test/handler.test.ts}` (copy package.json/tsconfig conventions from `chatbot-worker`).

**Interfaces (handler):** `handleRequest(request, env)`; `Env = { TEACHING_DB: D1Database; ALLOWED_ORIGINS?: string; FEEDBACK_TO?: string; RESEND_API_KEY?: string }`.

- [ ] **Step 1:** `schema.sql` — `materials(slug PK, views, downloads)` + `reviews(id, slug, rating CHECK 1..5, feedback, created_at)` + index (verbatim from spec §6).
- [ ] **Step 2:** `wrangler.toml` — `name="sampreeth-teaching"`, `main="src/index.ts"`, `[[d1_databases]] binding="TEACHING_DB"`, `[vars] ALLOWED_ORIGINS` (mirror chatbot) + `FEEDBACK_TO="spa9659@nyu.edu"`, observability on.
- [ ] **Step 3:** Write failing handler tests (mirror `chatbot-worker/test`): rejects rating 0/6 and empty feedback (400); `/view` upserts views+1; `/review` inserts + downloads+1 + returns aggregates; `/stats` aggregates avg/count; OPTIONS returns CORS; email failure non-fatal. Use a fake D1 (`prepare/bind/run/all/first`) + fake fetch.
- [ ] **Step 4:** Implement `handler.ts`: CORS (allow GET+POST), route by `URL.pathname` (`/view`,`/download`,`/review`,`/stats`), D1 upserts (`ON CONFLICT(slug) DO UPDATE`), aggregate stats query, Resend email in `/review` wrapped in try/catch (non-fatal), JSON responses with CORS headers.
- [ ] **Step 5:** `npm test` in `teaching-worker` → pass.
- [ ] **Step 6:** Commit `feat(teaching): cloudflare worker + D1 (counts, reviews, email)`.

---

## Task 10: Wire env + deploy doc + final verify

- [ ] **Step 1:** Document `PUBLIC_TEACHING_API` in the site env (and GitHub Actions build env if counts should work in prod). Until set, fail-open path already covers it.
- [ ] **Step 2:** Write `docs/superpowers/plans/DEPLOY-teaching-worker.md` with the exact deploy steps (spec §7: d1 create, schema execute --remote, secret put RESEND_API_KEY, deploy, set PUBLIC_TEACHING_API).
- [ ] **Step 3:** `npm run build` (site) → `node scripts/verify-sources.mjs` → 0 broken; `/teaching` + `/teaching/ai-engineers-handbook` pages exist in `dist`.
- [ ] **Step 4:** Commit `docs(teaching): deploy steps` and push (deploys Phase A live).

---

## Self-Review

- **Spec coverage:** nav tab (T3), filter+sort+cards+covers (T1,T6,T7), in-site viewer (T8), view/download counts (T4,T8,T9), private rating+feedback gate emailed to spa9659@nyu.edu (T8,T9), branding (T5), data-file authoring (T1), first content (T2). Avg-rating sort uses aggregates from T9 `/stats`.
- **Placeholders:** none (worker code shaped in T9 steps with concrete queries; component tasks specify exact props/markup intent).
- **Type consistency:** `Stat{views,downloads,ratingAvg,ratingCount}` used in T4/T7/T8/T9; `TeachingMaterial` fields consistent across T1/T6/T7/T8; endpoints `/view /download /review /stats` consistent T4↔T9.
