# Spatial Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing page and blogs index in the glass/depth spatial language from the approved spec, restyle the nav into a floating glass dock, and land the performance fixes from the code review, all reviewed on localhost before any commit.

**Architecture:** Astro static site with Tailwind and React islands. New visual work lives in scoped styles and two new components (WebGL hero, icon set). Shared interactive behaviors (glare, tilt, magnetics, depth arrival, count ups) live in one script module loaded by the pages that use them. CSS currently in the monolithic global.css gets split toward its consumers.

**Tech Stack:** Astro 4, Tailwind, React (islands), raw WebGL (no new dependencies), TypeScript where files are already TS.

## Global Constraints

- NO commits or pushes at any point until Sampreeth approves the localhost review. All "commit" gates in the standard flow are replaced by "verify in dev server".
- Copy rules: no em or en dashes anywhere in user facing text; middots for separators; no AI-tell vocabulary (see CLAUDE.md).
- Palette is unchanged: primary #FBFBFD / dk #000000, secondary #0066CC / dk #5B8DEF, accents #34D399 emerald, #A78BFA violet, #F5A524 amber, #5B8DEF blue, #22D3EE cyan, #F43F5E film.
- Every route that exists today must still render: /, /posts, /posts/*, /work, /work/*, /projects, /gallery, /filmmaking, /teaching, /teaching/*, /resume, /rss.xml.
- Desktop-only interactions gate on `matchMedia("(pointer: fine)")` and viewport >= 1024px where specified; all motion honors `prefers-reduced-motion: reduce`.
- Images keep true aspect ratios with explicit width/height (no CLS).
- Spec: `docs/superpowers/specs/2026-07-07-home-blogs-spatial-redesign-design.md`.

---

### Task 1: Branch and baseline

**Files:** none created.

- [ ] `git checkout -b redesign/spatial-glass`
- [ ] `npm install` if node_modules missing, then `npm run dev` in background; confirm `http://localhost:4321/` serves the current site.
- [ ] `npm run build` once to capture a passing baseline. Expected: build succeeds.

### Task 2: BaseLayout head cleanup (Roboto, normalize, FontAwesome loading)

**Files:**
- Modify: `src/layouts/BaseLayout.astro` (head block, lines ~152-174)

**Steps:**
- [ ] Delete the Google Fonts Roboto `<link>` and both `fonts.googleapis.com` / `fonts.gstatic.com` preconnects.
- [ ] Delete the normalize.css jsdelivr `<link>` (Tailwind preflight already resets).
- [ ] Replace the inline script that appends FontAwesome CSS with a non-blocking pattern plus preconnect:

```html
<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin />
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
  integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
  crossorigin="anonymous"
  referrerpolicy="no-referrer"
  media="print"
  onload="this.media='all'"
/>
```

- [ ] Verify: dev server, load `/`, `/posts`, `/resume`, `/gallery`. Icons still render (FA arrives async; brief pop-in is acceptable on non-critical icons). Fonts render via system stack; no console errors.

### Task 3: Shared search items module and single Search instance

**Files:**
- Create: `src/data/searchItems.ts`
- Modify: `src/layouts/BaseLayout.astro` (frontmatter: drop `Astro.glob`, import the module)
- Modify: `src/components/navbar/Nav.jsx` (render one `<Search>`)
- Modify: `src/components/search/Search.tsx` (memoize Fuse)

**Interfaces:**
- Produces: `getSearchItems(): SearchItem[]` where `SearchItem = { title: string; description: string; url: string; type: "page" | "post" }`.

**Steps:**
- [ ] Create `src/data/searchItems.ts`:

```ts
export type SearchItem = {
  title: string;
  description: string;
  url: string;
  type: "page" | "post";
};

const pages: SearchItem[] = [
  { title: "Home", description: "Landing, hero, and quick intro.", url: "/", type: "page" },
  { title: "About", description: "Bio, education, skills, and experience.", url: "/#about", type: "page" },
  { title: "Work", description: "Four disciplines: AI, forward-deployed, ML, and software engineering.", url: "/work", type: "page" },
  { title: "Gallery", description: "Screenshots and documents from production systems, by project.", url: "/gallery", type: "page" },
  { title: "Projects", description: "AI, research, and industry projects.", url: "/projects", type: "page" },
  { title: "Filmmaking", description: "Among Monsters and film work.", url: "/filmmaking", type: "page" },
  { title: "Writing", description: "Blog posts and research notes.", url: "/posts", type: "page" },
  { title: "Teaching", description: "Course materials and the teaching hub.", url: "/teaching", type: "page" },
  { title: "Contact", description: "Email and social links.", url: "/#contact", type: "page" },
];

const postFiles = import.meta.glob("../pages/posts/*.md", { eager: true }) as Record<
  string,
  { frontmatter: { title: string; description: string }; url: string }
>;

const posts: SearchItem[] = Object.values(postFiles).map((p) => ({
  title: p.frontmatter.title,
  description: p.frontmatter.description,
  url: p.url,
  type: "post",
}));

export const searchItems: SearchItem[] = [...pages, ...posts];
```

- [ ] In `BaseLayout.astro`, delete the `Astro.glob` call, the `pages` array, and the `searchItems` construction; `import { searchItems } from "../data/searchItems";` instead. Keep passing `searchItems` to `<Nav>`.
- [ ] In `Nav.jsx`, reduce the three `<Search ...>` renders to one that works for both breakpoints (reposition via CSS if needed).
- [ ] In `Search.tsx`, wrap Fuse construction: `const fuse = useMemo(() => new Fuse(items ?? [], {...same options...}), [items]);`
- [ ] Verify: search opens on desktop and mobile widths, finds a post title and a page, keyboard shortcut still works.

### Task 4: Pointer.jsx motion hygiene

**Files:**
- Modify: `src/components/Pointer.jsx`

**Steps:**
- [ ] At mount, bail entirely when `window.matchMedia("(prefers-reduced-motion: reduce)").matches` (return null / skip effect).
- [ ] Pause the emit interval and rAF loop on `document.visibilitychange` (hidden), resume when visible.
- [ ] Verify: glitter trail unchanged with motion allowed; gone under Windows reduced-motion setting; CPU drops when tab hidden.

### Task 5: Reveal observer debounce

**Files:**
- Modify: `src/layouts/BaseLayout.astro` (the reveal `<script>`)

**Steps:**
- [ ] Coalesce MutationObserver callbacks:

```js
let pending = false;
const observer = new MutationObserver(() => {
  if (pending) return;
  pending = true;
  setTimeout(() => { pending = false; setupReveal(); }, 120);
});
```

- [ ] Verify: reveal animations still fire on `/posts` and `/work`; chat widget usage does not spam `setupReveal` (check via console.count in dev, remove after).

### Task 6: Icon set for critical surfaces

**Files:**
- Create: `src/components/common/Icon.astro`

**Interfaces:**
- Produces: `<Icon name="arrow-down" class? size?>` rendering inline SVG. Names needed by later tasks: `arrow-down`, `arrow-right`, `arrow-up-right`, `search`, `sun`, `moon`, `menu`, `close`, `github`, `linkedin`, `instagram`, `imdb`, `mail`, `clock`.

**Steps:**
- [ ] Create `Icon.astro` with a `paths` record mapping each name to its SVG path data (24x24 viewBox, `fill="currentColor"` or stroke as appropriate), rendering `<svg width={size} height={size} ...><path .../></svg>`. Source path data from Lucide (ISC) for UI glyphs and Simple Icons (CC0) for brand marks; paste the `d` strings into the record.
- [ ] Verify: temporary test render of all names on a scratch page or the dev homepage, then remove the scratch usage. New pages (Tasks 8-10) consume this component so above-the-fold never waits on FontAwesome.

### Task 7: Nav glass dock

**Files:**
- Modify: `src/components/navbar/Nav.jsx` (structure + classes)
- Modify: `src/styles/global.css` (replace old navbar rules with dock rules; keep class names additive `gdock-*` to avoid touching other pages)

**Steps:**
- [ ] Restructure desktop nav into a fixed top-right floating pill: SA mark, links (Work, Projects, Writing, Film), search trigger, theme toggle, filled "Get in touch" pill. Mobile: SA mark + search + menu button opening the existing sheet listing all pages (Home, About, Work, Gallery, Projects, Filmmaking, Writing, Teaching, Resume, Contact).
- [ ] Dock styling: `position: fixed; top: 16px; right: 16px; border-radius: 999px;` glass tokens (backdrop blur 22px saturate 175%, translucent bg, 1px light border, inset top highlight, soft shadow), sheen sweep via `::after` keyframe (off under reduced motion), `max-width: calc(100vw - 32px)`.
- [ ] Ensure the dock never overlaps page content: pages get enough top padding (landing hero already full-viewport; other pages keep their existing top spacing, check `/resume` and `/posts/*`).
- [ ] Verify: every route shows the dock, links navigate, search and theme toggle work, mobile sheet lists all pages, no overlap at 390px and 1440px.

### Task 8: Spatial interaction module and landing styles

**Files:**
- Create: `src/scripts/spatial.ts`
- Create: `src/styles/landing.css`

**Interfaces:**
- Produces (from `spatial.ts`, all idempotent, called once from a page script): `initGlare(selector)`, `initTilt(selector)` (reads `data-tiltmax`), `initMagnetic(selector)`, `initArrive(selector)` (one shared rAF scroll handler), `initCountUps(selector)` (IntersectionObserver, `data-count`, `data-prefix`, `data-suffix`). All bail on reduced motion; tilt/magnetic/glare additionally bail on coarse pointers.
- Produces (from `landing.css`): class contracts used by Tasks 9-10: `.pane` (glass panel), `.glow` (drifting orb, variants `.g2 .g3`), `.grain`, `.dpill`, `.gbtn` / `.gbtn.ghost`, `.eyebrow`, `.display`, `.metric`, `.mq` (marquee), `.rail` (progress dots), `.tcard` (tilt card base).

**Steps:**
- [ ] Implement `spatial.ts` with the five exported init functions (same math as validated in the v3 mockup: glare sets `--gx/--gy` percent vars; tilt rotateX/Y clamped by `data-tiltmax`; magnetic translate max 7px with spring-back transition; arrive maps distance from viewport center to translateY/scale/opacity/blur with a dead zone so docked content sits at rest; count up eases cubic over 950ms).
- [ ] Implement `landing.css` with the glass token classes above, using Tailwind theme colors via CSS vars defined at the top (`--glass`, `--glass-brd`, `--glass-hi`, `--glare`, light and dark values under `html.dark`). Mobile: blur 12px instead of 22px; glows smaller and static below lg.
- [ ] Verify: imported nowhere yet; `npm run build` still passes (tree-shaken or unused import safe).

### Task 9: GlassHero WebGL component

**Files:**
- Create: `src/components/hero/GlassHero.astro`

**Interfaces:**
- Produces: `<GlassHero />` rendering `<canvas class="hero-blob">` plus fallback markup. Self-contained script: raymarched metaballs fragment shader (three blended spheres, one cursor-driven; fresnel rim from the four discipline colors; refraction offset of a flowing gradient; specular). Constraints: DPR capped at 1.2, 44 march steps, IntersectionObserver pauses the loop offscreen, `uDark` uniform follows `html.dark`, canvas hidden and loop never started when: reduced motion, `pointer: coarse`, viewport < 1024px, or WebGL context failure. Fallback renders the existing `/hero-aurora-dark.png` and `/hero-aurora-light.png` via `<Picture>`.

**Steps:**
- [ ] Port the v3 mockup shader and JS into the component with the gating above (mockup validated: compile-checked shader, alpha blending, cursor spring).
- [ ] Verify: place temporarily on the dev homepage; blobs render dark and light; scrolling past the hero stops the rAF (log frame count in dev, remove log); resize behaves; fallback appears when DevTools emulates reduced motion or a phone viewport.

### Task 10: Landing page rebuild (index.astro)

**Files:**
- Modify: `src/pages/index.astro` (full rewrite of template and its scoped script/style; frontmatter keeps `systems`, `filmCredits`, `brandFor`, drops `skillGroups`)
- Modify: `src/layouts/BaseLayout.astro` (remove `snap-home` injection if landing no longer uses it)

**Interfaces:**
- Consumes: `<GlassHero />`, `Icon.astro`, `landing.css`, `spatial.ts` inits, `searchItems` unchanged, `readingTime` from Task 11 for the writing block (safe: Task 11 creates it before this page ships; if executing strictly in order, stub reading time as `post.frontmatter.readingTime ?? null` and fill in Task 11).

**Structure (per spec):**
- [ ] Hero: `<GlassHero />` background; left column eyebrow / headline (name shimmer) / one sentence lead / four `.dpill` links / two `.gbtn`; right column portrait `<Picture src="/pic.avif" width={520} height={640}>` inside `.pane` frame, `aspect-ratio: 520/640; object-fit: cover;` tilt + glare; nothing overlapping the photo; scroll cue arrow.
- [ ] Marquee: `.mq` glass strip, toolkit items duplicated for the loop, pause on hover, slower on mobile.
- [ ] Disciplines: four equal `.pane` tiles (orbiting glow per accent), one row lg / 2x2 md / stacked mobile, each linking `/work/[slug]` with project count from `disciplines` data.
- [ ] Work: strict grid `lg:grid-cols-3 md:grid-cols-2 grid-cols-1`, six identical-structure cards (number, metric with `data-count` where numeric, name, one line, bottom-pinned tag), equal heights via `h-full flex flex-col`; "Browse all 15 projects →" below.
- [ ] About: two columns; left bio + projects link; right Education / Experience compact `brandFor` rows; one line "Full toolkit on the resume →". No skill tile walls.
- [ ] Writing: featured latest (cover, title, one line, reading time) + three compact cards; link to `/posts`.
- [ ] Filmmaking: quote, one sentence, four credit hover rows, IMDb + slate buttons.
- [ ] Contact: heading, one sentence, magnetic email pill (`spa9659@nyu.edu`), existing `<Contact>` socials.
- [ ] Page script: import and call the five `spatial.ts` inits; progress rail with six dots tracked by IntersectionObserver; glows and grain markup `aria-hidden`.
- [ ] Remove scroll snap: drop `snap-home` class injection and any `snap-chapter` usage on this page.
- [ ] Verify (the big one): dev server at 390 / 768 / 1280 / 1536px, dark and light. Checklist: portrait at true aspect, zero horizontal scroll, work cards perfectly aligned rows, count ups fire once, marquee loops seamlessly, magnetics and tilt desktop-only, keyboard tab order sane, reduced motion kills all animation, glitter cursor still present.

### Task 11: Reading time utility

**Files:**
- Create: `src/utils/readingTime.ts`
- Modify: `src/pages/posts.astro`, `src/pages/index.astro` (writing block)

**Interfaces:**
- Produces: `readingTime(rawContent: string): number` (minutes, ceil of words/220, minimum 1). Astro glob results expose `rawContent()` for md pages.

**Steps:**
- [ ] Implement:

```ts
export function readingTime(rawContent: string): number {
  const words = rawContent.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 220));
}
```

- [ ] Wire into both pages: `const mins = readingTime(post.rawContent());`
- [ ] Verify: a long post shows a plausibly larger number than a short one.

### Task 12: Blogs page rebuild (posts.astro)

**Files:**
- Modify: `src/pages/posts.astro` (full rewrite)
- Modify: `src/components/post_section/Post.astro` only if reused; otherwise card markup lives in posts.astro and Post.astro remains for other consumers.

**Structure (per spec):**
- [ ] Header: eyebrow, "Writing.", one sentence.
- [ ] Featured latest: full width `.pane`, cover with true aspect (existing frontmatter dimensions), display-size title, one line, date + reading time via `Icon name="clock"`, glare + subtle tilt, `preloadImage` kept for LCP.
- [ ] Grid: `lg:grid-cols-3 md:grid-cols-2 grid-cols-1`, cards with cover, title, date · reading time, one line, rotating accent cycle (blue, emerald, violet, amber), hover lift + glare.
- [ ] Moving glows behind sections; grain; depth arrival via `spatial.ts`.
- [ ] Verify: all posts listed, images correct aspect, LCP preload present in head, mobile single column clean, dark and light.

### Task 13: global.css split and dead code removal

**Files:**
- Modify: `src/styles/global.css` (remove moved/dead blocks)
- Modify: `src/layouts/PostLayout.astro` (gains post prose styles in `<style is:global>`)
- Modify: `src/components/chatbot/ChatWidget.*` (gains chat markdown styles)
- Modify: `src/pages/work/index.astro` or relevant work component (gains work-tabs styles)
- Delete usage: old landing CSS (hero-nebula, hero-aurora orbs, snap chapters, ScrollSpine styles) once index.astro no longer references them; delete `src/components/ScrollSpine.astro` if now unused (grep first).

**Steps:**
- [ ] Move the post article block (~lines 1089-1850: prose, TOC, stat callouts, pull quotes, dropcap) into `PostLayout.astro` `<style is:global>`.
- [ ] Move chat widget markdown styles (~lines 2019-2043) into the ChatWidget component.
- [ ] Move work-tabs styles (~lines 2210-2325) into the work page/component that uses them.
- [ ] Delete old landing-only blocks (~lines 2616-2984 and snap/spine rules) after confirming via grep that no other page references those classes.
- [ ] Verify: visit every route in dev; `/posts/jobpilot-v2` article styling intact (TOC, callouts), chat widget renders markdown, work tabs styled, gallery/teaching/resume unaffected; `npm run build` passes; note global.css size before/after.

### Task 14: Full verification pass and handoff

- [ ] `npm run build` clean; `npx astro check` if configured (skip if not).
- [ ] Route sweep on the built preview (`npm run preview`): /, /posts, one post, /work, one work slug, /projects, /gallery, /filmmaking, /teaching, one teaching slug, /resume, /rss.xml.
- [ ] Breakpoint sweep on landing + blogs: 390, 768, 1280, 1536; dark + light; reduced motion on and off.
- [ ] Console: zero errors on landing and blogs.
- [ ] Leave dev server running; hand Sampreeth `http://localhost:4321/` for review. NO commits.

## Self-review notes

- Spec coverage: nav dock (T7), hero + fallbacks (T9, T10), marquee/disciplines/work/about/writing/film/contact (T10), copy budget (T10), blogs editorial + reading time (T11, T12), mobile rules (T8-T12 gates), perf items 1-7 (T2 FA/fonts/normalize, T3 search, T4 pointer, T5 reveal, T9 rAF gating, T13 CSS split), fallbacks and a11y (T8-T10), acceptance (T14). Lighthouse 90+ target checked informally at T14; formal run happens post-approval.
- Type consistency: `SearchItem` (T3) consumed only by Nav/Search; `readingTime` signature consistent across T11 consumers; `spatial.ts` init names match T10/T12 usage.
- No placeholders: shader and interaction math reference the validated v3 mockup implementation which is ported, not reinvented.
