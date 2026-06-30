# Teaching Hub — Design Spec

Date: 2026-06-30
Status: Approved design (pending written-spec review)
Repo: `sampreethavvari.github.io` (Astro static site, GitHub Pages)

## 1. Goal

Add a **Teaching** section: a hub where Sampreeth publishes learning materials —
each material is **one of**: a PDF, a blog, or a video. Materials are grouped by
engineering stream (**AIE / MLE / SDE / FDE**), browsable with **filter + sort**,
viewable **in-site** (no new tab), **downloadable behind a mandatory private
review**, and every material shows **live view + download counts** and ends with
**Sampreeth's contact/branding** block.

First content: the **AI Engineers Handbook** PDF, under AIE.

## 2. Decisions (locked)

- **Backend:** new dedicated **Cloudflare Worker + D1** (separate from the
  existing `sampreeth-chatbot` worker, to keep chat untouched/low-risk).
- **Download gate:** mandatory **1–5★ rating + feedback**. Feedback is
  **private** — never shown on the site. On submit it is **emailed to
  spa9659@nyu.edu** (via Resend) and stored in D1 as a backup. The numeric
  ratings aggregate into a public **average ★** (enables "sort by rating").
- **Authoring:** one entry in a single `src/data/teaching.ts`; drop the PDF in
  `/public/teaching/`; rebuild → live. No DB for content.
- **Initial scope:** only the AI Engineers Handbook (AIE). Other handbooks
  (ML/SW/Data Science, Vol 2, cheat sheet, interview QA) are added later the
  same way.
- **Nav:** "Teaching" tab, `fa-graduation-cap` icon, placed after "Blog".
- **Viewer:** PDF inline (native browser viewer via `<iframe>`); video embedded
  inline (YouTube/Vimeo iframe); blog renders its body. All in-site.
- **Email provider:** Resend (free tier; `RESEND_API_KEY` as a worker secret;
  sends from `onboarding@resend.dev` to `spa9659@nyu.edu`). Alternative if
  preferred later: Cloudflare Email Routing `send_email` binding.

## 3. Architecture

Three layers:

1. **Content (static):** `src/data/teaching.ts` — the list of materials. Edited
   by hand, version-controlled.
2. **Pages (static, Astro):** the `/teaching` index and `/teaching/<slug>`
   viewer pages, built at deploy time from `teaching.ts`.
3. **Dynamic API (Cloudflare Worker + D1):** view/download counters and the
   review submission + email. The browser calls it at runtime via
   `PUBLIC_TEACHING_API`. The site is fully functional without it (counts show
   "—", downloads fail-open) so a backend outage never blocks a reader.

```
teaching.ts ──build──> /teaching (index)          ┐
                       /teaching/<slug> (viewer)   │ static, GitHub Pages
                                                   ┘
browser ──fetch──> sampreeth-teaching Worker ──> D1 (materials, reviews)
                                            └──> Resend ──> spa9659@nyu.edu
```

## 4. Content model — `src/data/teaching.ts`

```ts
export type Stream = "aie" | "mle" | "sde" | "fde";
export type MaterialType = "pdf" | "blog" | "video";

export interface TeachingMaterial {
  slug: string;          // URL + stats key, e.g. "ai-engineers-handbook"
  type: MaterialType;
  stream: Stream;        // grouping/filter
  title: string;         // card + page heading
  description: string;   // one-line card subtitle ("what this post is")
  whatToExpect: string;  // longer "What to expect" paragraph(s) on the page
  cover: string;         // /teaching/<slug>.png (Nano-Banana cover, dark-neon)
  addedAt: string;       // ISO date; default sort = newest first
  // exactly one of:
  file?: string;         // pdf:   /teaching/ai-engineers-handbook.pdf
  videoUrl?: string;     // video: embeddable URL (YouTube/Vimeo)
  body?: string;         // blog:  markdown/HTML (or import a .md)
  pages?: number;        // optional meta for PDFs
  durationMin?: number;  // optional meta for videos
}

export const teaching: TeachingMaterial[] = [ /* entries */ ];
```

Validation: each entry must have the field matching its `type` (`file` for pdf,
`videoUrl` for video, `body` for blog). A tiny build-time assert in the data
file guards this.

## 5. Pages & components

### `/teaching` (index) — `src/pages/teaching.astro`
- Hero (title + intro line).
- Renders all `teaching` entries **server-side** as cards (cover via `<Picture>`,
  type badge, title, description) — so content is in the static HTML.
- Wraps the grid in a React island **`TeachingBrowser.tsx`** that receives the
  entries as props and provides:
  - **Filter chips:** All · AIE · MLE · SDE · FDE.
  - **Sort dropdown:** Newest · Most viewed · Most downloaded · Top rated.
  - Fetches `GET /stats` once on mount, injects live 👁/⬇/★ per card, and
    re-orders for the views/downloads/rating sorts. Before stats load (or if the
    API is down) it shows counts as "—" and defaults to Newest.
- Empty streams render a quiet "More coming" state (like the gallery page) so
  all four streams read as intentional structure.

### `/teaching/<slug>` (viewer) — `src/pages/teaching/[slug].astro`
- `getStaticPaths()` from `teaching.ts` → one page per material.
- Layout: backlink → stream/type badges → **title** → **"What to expect"**.
- **Viewer block** by type:
  - `pdf`: inline `<iframe src={file}>` (native viewer) sized to a comfortable
    reading height; never opens a new tab.
  - `video`: responsive embedded iframe.
  - `blog`: rendered body.
- **`MaterialActions.tsx`** React island (props: `slug`, `type`, `file`):
  - On mount → `POST /view` once per browser session (sessionStorage guard) and
    shows live 👁 views + ⬇ downloads (from `GET /stats?slug=`).
  - **Download button** (PDF/any downloadable):
    - If `localStorage["reviewed:"+slug]` set → `POST /download` → download file.
    - Else → open **Review modal** (1–5★ required + feedback textarea required) →
      `POST /review` → on success set the localStorage flag, download, refresh
      counts. On network failure: show error + a "download anyway" fallback so a
      backend outage never traps the reader.
- **`TeachingBranding.astro`** at the very bottom of every material: "Connect
  with me" — LinkedIn, email, GitHub from `info.contact`. Reusable component.

### Nav — `src/components/navbar/Nav.jsx`
Add `{ name: "Teaching", href: "/teaching", icon: "fas fa-graduation-cap",
match: "teaching" }` after the Blog entry (the hamburger reuses the same array).

### Cover image
Generate `AI Engineers Handbook` cover in the dark-neon house style (Nano Banana
/ gemini-2.5-flash-image), save to `public/teaching/ai-engineers-handbook.png`,
referenced via `<Picture>` so the deep image optimizer makes AVIF/WebP and
`prune-dist` keeps the deploy lean (consistent with existing pipeline).

## 6. Backend — `sampreeth-teaching` Worker + D1

New folder `teaching-worker/` mirroring `chatbot-worker/` conventions (TS,
`wrangler.toml`, CORS via `ALLOWED_ORIGINS`, observability).

### D1 schema (`teaching-worker/schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS materials (
  slug      TEXT PRIMARY KEY,
  views     INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_slug ON reviews(slug);
```

### Endpoints (JSON; CORS-guarded; OPTIONS preflight handled)
- `POST /view` `{slug}` → `INSERT INTO materials(slug,views) VALUES(?,1) ON
  CONFLICT(slug) DO UPDATE SET views=views+1` → `{views, downloads}`.
- `POST /download` `{slug}` → upsert `downloads=downloads+1` → `{downloads}`.
- `POST /review` `{slug, rating(1-5), feedback(non-empty)}` → validate → insert
  review → upsert `downloads=downloads+1` → email feedback to `FEEDBACK_TO` via
  Resend → `{downloads, ratingAvg, ratingCount}`. (Review submission IS the
  gated first download.)
- `GET /stats` (all) / `GET /stats?slug=` (one) →
  per slug `{views, downloads, ratingAvg, ratingCount}` using
  `AVG(rating)`/`COUNT(*)` from `reviews`.

### Email (Resend)
`POST https://api.resend.com/emails` with `Authorization: Bearer RESEND_API_KEY`,
`from: "Teaching <onboarding@resend.dev>"`, `to: FEEDBACK_TO`,
`subject: "New feedback: <title> (<rating>★)"`, body = material + rating +
feedback + timestamp. Email failure is logged but does **not** fail the request
(the review is already saved; the reader still gets their download).

### `wrangler.toml` additions
`name = "sampreeth-teaching"`, `[[d1_databases]]` binding `TEACHING_DB`,
`[vars] ALLOWED_ORIGINS` (mirror chatbot) and `FEEDBACK_TO = "spa9659@nyu.edu"`,
secret `RESEND_API_KEY`.

### Frontend env
Add `PUBLIC_TEACHING_API` (deployed worker URL) to the site's env / build. All
client calls read `import.meta.env.PUBLIC_TEACHING_API`.

## 7. Deploy steps (run under Sampreeth's Cloudflare account)
1. `cd teaching-worker && npm i`
2. `npx wrangler d1 create sampreeth-teaching` → paste the binding into `wrangler.toml`.
3. `npx wrangler d1 execute sampreeth-teaching --file=schema.sql` (and `--remote`).
4. `npx wrangler secret put RESEND_API_KEY` (key from a free resend.com account).
5. `npx wrangler deploy` → note the worker URL → set `PUBLIC_TEACHING_API`.

All code/config/migrations are authored by the assistant; these are the
human-run steps requiring Cloudflare/Resend login.

## 8. Build phases (for the implementation plan)
- **Phase A (static, ships immediately):** `teaching.ts` + types; Nav tab;
  `/teaching` index with filter/sort (`TeachingBrowser`); `/teaching/<slug>`
  viewer (PDF/video/blog) + `TeachingBranding`; cover image; first content
  (AI Engineers Handbook). Phase A ships the review-gate UI; until Phase B
  wires the API, counts show "—" and submitting the review isn't persisted —
  the download proceeds (fail-open).
- **Phase B (dynamic):** `teaching-worker` + D1 + endpoints + Resend; wire
  `MaterialActions`/`TeachingBrowser` to live stats + the review gate; deploy.

## 9. Testing
- Worker: unit tests (mirror `chatbot-worker/test`) for each endpoint —
  validation (reject rating out of 1–5, empty feedback), upsert increments,
  stats aggregation, CORS, email-failure-is-non-fatal.
- Frontend: verify `getStaticPaths` builds a page per entry; review modal
  requires both fields; session-guarded view increment; fail-open download;
  `verify-sources.mjs` passes (cover AVIF/WebP resolve); build clean.
- Manual: filter/sort behavior; in-site PDF + video viewing; counts update;
  test email arrives at spa9659@nyu.edu.

## 10. Out of scope (future)
- Public display of reviews/comments (explicitly not wanted).
- In-app admin/authoring UI.
- Seeding the other handbooks (done later via the same `teaching.ts` flow).
- Per-reader auth / accounts.
- pdf.js custom-branded viewer (native viewer is sufficient to start).
