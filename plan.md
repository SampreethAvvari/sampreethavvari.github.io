# Portfolio redesign — master plan

Pick this up in a fresh chat if needed. Everything required to keep going lives in this file. Last update at the end of Phase 1.

---

## Where things stand right now

**Live:** https://sampreethavvari.github.io (auto-deploys from `main` on every push via the existing GitHub Actions workflow at `.github/workflows/deploy.yml`).

**Repo:** `SampreethAvvari/sampreethavvari.github.io` — Astro 4 + Tailwind + React component islands.

**Local working copy** (Windows): `c:\Users\SAvvari\Downloads\Claude Cowork\website-work\sampreethavvari.github.io\`

Phase 1 of the Apple-style redesign is shipped. Phases 2–4 are not yet started.

### Phase 1 (DONE — commit `3af8d9e` + earlier commits this session)

- Home page is a 6-chapter vertical narrative with gentle scroll-snap (proximity, not mandatory).
- Apple-neutral palette swapped in via `tailwind.config.mjs` (near-white / near-black / electric blue accent, plus per-section accents for hero metrics).
- System font stack registered as `font-display` and applied site-wide.
- Eight blog posts rewritten shorter / fun / more visual.
- Filmmaking page placeholder quotes removed.
- Hybridge work-experience bullets rewritten as 6 punchy lines with `[name](/posts/slug)` links (rendered as anchors by `Experience.tsx`).
- Optimal Living Systems moved from work experience to projects.
- Skills section refreshed with the actual stack used (Drizzle, Auth.js, OpenVINO, MONAI, Vertex AI, etc.).
- Chatbot rebuilt TDD-first as a Cloudflare Worker + Llama 3.1 8B on Groq (`chatbot-worker/` directory). Nine Vitest cases pass. README documents the one-time deploy.

### Locked design decisions (don't re-litigate)

| Decision | Choice | Why |
|---|---|---|
| Phasing | One phase at a time, ship and react | User wants to see + redirect between phases |
| Palette | Apple-neutral, electric-blue accent | Background near-white / near-black; accents reserved for hero number or project name only |
| Scroll | Gentle proximity snap | Easy on mobile + long sections; doesn't trap users |
| Project layout on home | Single "01–05" strip in one chapter | Deep dives stay on `/projects` and the individual blog posts |
| Voice | Grounded, no AI tell, no em-dash spam | See `~/.claude/projects/.../memory/feedback_writing_voice.md` |
| Commits | As Sampreeth, no `Co-Authored-By: Claude` trailer | Already the local git author |

### Saved memories (auto-applies across future sessions)

Memory dir: `C:\Users\SAvvari\.claude\projects\c--Users-SAvvari-Downloads-Claude-Cowork\memory\`

- `user_role.md` — Sole AI engineer at Hybridge, NYU MS '25, applying for forward-deployed-style roles (do NOT use "FDE" or "product manager" in copy), filmmaker.
- `project_hybridge_portfolio.md` — Active Hybridge projects, which live in private repos vs local-only.
- `feedback_commits_no_ai_trailer.md` — Commit only as Sampreeth, no AI trailer.
- `feedback_writing_voice.md` — Grounded human voice for portfolio content, STAR for project blogs.

---

## Phase 2 — Blog post visual polish (NEXT)

Goal: every post on `/posts/...` should feel color-coded and scannable, not a wall of prose.

### Files to touch

- `src/layouts/PostLayout.astro` — add a hero stat strip below the cover image, gradient section dividers, refined prose styling.
- `src/styles/global.css` — add utility classes for the STAR-tinted bands, stat callout cards, quote blocks, table styling.
- Each `src/pages/posts/*.md` — add an optional `stats: [{ label, value }]` frontmatter array consumed by the hero stat strip. Update STAR section headings to use a custom syntax (see below) so they pick up tints.

### Concrete plan

1. **Hero stat strip.** Below the cover image, render up to 3 stat chips from the post frontmatter. Each chip = a colored gradient card with a big number on top and a small label below. Add the array to each post:

   ```yaml
   stats:
     - { label: "Patient↔lead linkage",   value: "49% → 99%",   tone: "blue" }
     - { label: "Weekly reconciliation",  value: "Half day → 3 min", tone: "amber" }
     - { label: "Orphan revenue surfaced", value: "~$169k",     tone: "emerald" }
   ```

   Tones map to the existing per-section accents (`blue / cyan / violet / emerald / amber`).

2. **STAR section tinting.** Posts already use `## Situation`, `## Task`, `## Action`, `## Result` headers. In `PostLayout.astro`, render the post body inside a `<div class="prose">` but post-process the markdown HTML on the client OR use a remark plugin to wrap each `## Situation` (and the prose until the next `##`) in a `<section class="star-band star-situation">`. Each band gets a faint background tint (slate for Situation, amber for Task, blue for Action, emerald for Result) and a colored left border.

   The simplest path that doesn't need a remark plugin: re-shape each post's markdown to wrap the four sections in `:::situation` / `:::task` / `:::action` / `:::result` MDX-style containers using `astro-remark-directive`. Or, even simpler: do it manually in each post by adding HTML wrappers around the existing markdown sections.

   **Simplest option (recommended):** add inline HTML `<div class="star situation">…</div>` around each STAR section in each post. No build-time plugin needed; Astro renders inline HTML inside markdown.

3. **Stat callouts inside post body.** Add a `<div class="stat-callout">` utility for big inline numbers. Example:

   ```html
   <div class="stat-callout stat-cyan">
     <div class="stat-value">$50/mo</div>
     <div class="stat-label">total cloud spend vs $124K vendor quote</div>
   </div>
   ```

   CSS in `global.css` styles these as full-width gradient cards with the value at `display-sm` size.

4. **Gradient section dividers.** Replace `---` markdown horizontal rules with a CSS `<hr class="grad-divider">` that renders as a horizontal gradient line fading from accent to transparent at both ends.

5. **Quote blocks.** Pull `>` blockquotes out of the default `prose` styling, give them a 4px colored left border, italic 1.25× type, and a faint background tint.

6. **Tables.** Already styled via `prose`. Confirm alternating rows + a colored header background.

7. **Inline code.** Confirm `<code>` inline renders with a soft tinted bg.

### CSS to add (drop into `global.css`)

```css
/* STAR bands — tinted backgrounds, colored left border. */
.star {
  border-radius: 1rem;
  padding: 2rem 1.5rem;
  margin: 2rem -1rem;
  border-left: 4px solid currentColor;
}
.star.situation { color: #64748B; background: rgba(100, 116, 139, 0.06); }
.star.task      { color: #F5A524; background: rgba(245, 165, 36, 0.06); }
.star.action    { color: #5B8DEF; background: rgba(91, 141, 239, 0.06); }
.star.result    { color: #34D399; background: rgba(52, 211, 153, 0.06); }

.star > h2:first-child {
  margin-top: 0;
  color: currentColor;
}
.star > * { color: inherit; }
.star > p, .star > ul, .star > table { color: theme(colors.text); }
html.dark .star > p,
html.dark .star > ul,
html.dark .star > table { color: theme(colors.dk-text); }

/* Stat callouts */
.stat-callout {
  border-radius: 1rem;
  padding: 2rem;
  margin: 2rem 0;
  background: linear-gradient(135deg, rgba(91,141,239,0.12), rgba(34,211,238,0.08));
  border: 1px solid rgba(91,141,239,0.25);
}
.stat-callout .stat-value {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1;
}
.stat-callout .stat-label {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  opacity: 0.7;
}
.stat-cyan    { background: linear-gradient(135deg, rgba(34,211,238,0.14), rgba(91,141,239,0.08)); border-color: rgba(34,211,238,0.30); }
.stat-violet  { background: linear-gradient(135deg, rgba(167,139,250,0.14), rgba(91,141,239,0.08)); border-color: rgba(167,139,250,0.30); }
.stat-emerald { background: linear-gradient(135deg, rgba(52,211,153,0.14), rgba(34,211,238,0.08));  border-color: rgba(52,211,153,0.30); }
.stat-amber   { background: linear-gradient(135deg, rgba(245,165,36,0.14), rgba(220,38,38,0.08));   border-color: rgba(245,165,36,0.30); }

/* Gradient divider */
hr.grad-divider {
  height: 1px;
  border: 0;
  background: linear-gradient(90deg, transparent, theme(colors.secondary), transparent);
  margin: 3rem 0;
}

/* Quote blocks */
.prose blockquote {
  border-left: 4px solid theme(colors.secondary);
  padding-left: 1.5rem !important;
  font-size: 1.25rem;
  font-style: italic;
  background: rgba(91,141,239,0.04);
  padding-top: 1rem !important;
  padding-bottom: 1rem !important;
  border-radius: 0 0.5rem 0.5rem 0;
}
```

### Acceptance check

- Open `/posts/cowork-dashboard`. The hero image has 3 stat chips below it. STAR sections each have a tinted band. The "$169k of revenue surfaced" line is in a gradient stat callout.
- Same shape on every post.
- Mobile width: bands wrap clean, stats stack vertically.

---

## Phase 3 — Filmmaking page redesign

Goal: it should feel like a film's press kit, not a portfolio page.

### File to touch

- `src/pages/filmmaking.astro` — full restructure.
- Maybe add `src/components/filmmaking/` for re-usable bits.

### New section order

1. **Among Monsters opener** — full-bleed dark hero with the poster prominent. Byline: "An independent feature in post. Director · Writer · Editor · Music — Sampreeth Sharma." IMDb pill + screenplay pill.
2. **Filmography row** — 7 cards in a horizontal scroll/snap row. Each card has: poster (or generated still), year, title, role chips.
3. **Roles strip** — the existing 5 role cards (Director / Writer / Editor / Cinematographer / Music), smaller, more refined, in a horizontal strip.
4. **Behind the scenes (BTS) masonry** — clean uneven grid of stills, no captions overlapping image. Lightbox on click (already exists in `PhotoCarousel`?).
5. **Cast & crew portraits** — uniform aspect-ratio cards (4:5), no quote box (already removed in Phase 1). Single Instagram link per card. Tag-coloured by role group.
6. **Screenplay download** — a big colored CTA card with the screenplay PDF link.

### Visual rules

- Hero is dark `bg-black` with the poster image inside a wide letterboxed container.
- Use the existing `Among Monsters` poster image (`/among-monsters-poster.jpg`) plus the Filmmaking Page pics folder.
- Section dividers between scenes mimic a "REEL 1 / REEL 2 / REEL 3" feel via small uppercase tracked labels.
- Filmography row uses `scroll-snap-type: x mandatory` for that "swipe through the catalogue" feel on mobile.

### Image prompts needed (paste into Gemini, give to me)

If real BTS stills are limited, generate replacement stills with these prompts:

1. **For the filmography row of films missing a poster** — for each film without a poster, generate a "moody minimalist poster" image:

   > Generate a minimalist film poster, 2:3 aspect ratio, deep navy and charcoal palette with a single accent color (use desaturated crimson). Bold title typography "[FILM TITLE]" in the lower third, year "[YEAR]" small at the bottom. A single evocative image element: [for Tiger Man use a silhouetted figure facing a glowing window; for Extraordinary Lives use two chairs in an empty room with a hanging lightbulb; for Pupa use a hand reaching up through fog]. Texture: very subtle film grain. Layout: clean, generous negative space, like a Criterion Collection cover. Output a vertical poster image.

2. **For the BTS masonry** — if more stills are needed, generate "on-set" abstract images:

   > Generate a behind-the-scenes still from an independent film shoot, 16:9 aspect ratio. Soft cinematic lighting (golden hour or low-key). Foreground: a clapperboard or camera viewfinder. Background: shallow depth-of-field, blurred crew silhouettes. Tone: muted earth colors with a single warm light source. Film grain. Looks like a candid moment, not posed.

3. **For section dividers / decorative film-strip imagery** — to use as the chapter visual between sections:

   > Generate a horizontal film-strip illustration in vector style. Aspect ratio 16:3. A row of 5–6 small "frames" each showing a minimalist scene (a silhouette, an interior, a face in shadow, etc.) in a sequence. Color palette: charcoal background with the frames in warm desaturated tones (sepia, brick, ochre). Sprocket holes on top and bottom. Slight perspective tilt. Vector flat style, not photorealistic.

4. **For the Among Monsters hero (if you don't want the existing poster front-and-center)** — generate a hero banner image:

   > Generate a cinematic wide hero image for an independent crime drama titled "Among Monsters", 21:9 aspect ratio. A figure in silhouette stands in a desaturated urban backstreet, single overhead street light, wet pavement reflection. Color palette: deep blues, blacks, with a single amber sodium-vapor highlight. Slight film grain. No text. Mood: tense, intimate, dangerous. Composition: subject left-third, vast empty street to the right with negative space.

### Acceptance check

- Page reads as: hero → filmography → roles → stills → crew → screenplay CTA.
- No skewed alignments — every card uses the same aspect ratio per row.
- Hover states are calm, not jumpy.

---

## Phase 4 — Projects page tiered masonry

Goal: less rigid grid; Hybridge projects feel bigger / more important than older ones, without losing the rest.

### File to touch

- `src/pages/projects.astro`
- `src/components/projects_section/ProjectCard.tsx` (likely fine; add a `featured` prop for span control)

### Plan

- Top 5 Hybridge projects each get `lg:col-span-2` (full half-row width on large screens). Layout the row as `lg:grid-cols-4` and these 5 spans give a nice asymmetric stagger.
- Older projects use `lg:col-span-1` (quarter width).
- Add a small "tier" tag at the top of each card ("Hybridge" / "Research" / "Industry") in a per-tier accent color.
- Optional: a tiny filter strip above the grid: "All / Hybridge / Research / Industry / Coursework".

### Acceptance check

- Top of the grid has the 5 Hybridge cards prominently sized.
- Older work present but visually subordinate.
- Filter strip works (Astro can do this with simple JS or just bookmark-style anchors).

---

## Phase 5 (optional, nice-to-have)

- A `/about` standalone page with the full bio, skills, and a "what I've been reading" section. Linked from the home About chapter via "More about me →".
- A `/uses` page (à la wesbos.com/uses) listing the tools / setup.
- A favicon refresh.

---

## Chatbot — still waiting on you

Everything is built and tested. Two action items on your side:

1. **Groq key** — sign up at https://console.groq.com (free, no card), create a key.
2. **Cloudflare deploy** — from `chatbot-worker/`:
   ```bash
   npm install -g wrangler
   wrangler login
   cd chatbot-worker
   npm install
   wrangler secret put GROQ_API_KEY     # paste your Groq key
   npm run deploy                        # prints your worker URL
   ```
3. **Wire the site** — in `.github/workflows/deploy.yml`, set `PUBLIC_CHAT_ENDPOINT` to `<worker-url>/chat`. Or add a repo variable `PUBLIC_CHAT_ENDPOINT` and reference it in the build step.

When you paste the worker URL back into the chat, I'll wire the workflow file in one edit.

---

## Local environment setup (for any new chat)

```powershell
# from C:\Users\SAvvari\Downloads\Claude Cowork\website-work\sampreethavvari.github.io
npm install
npm run dev      # http://localhost:4321
npm run build    # builds to dist/, used by the GitHub Action
```

The repo is already cloned at the path above. If a fresh clone is needed:

```powershell
git clone https://github.com/SampreethAvvari/sampreethavvari.github.io.git
cd sampreethavvari.github.io
npm install
```

Wrangler tests for the chatbot worker:

```powershell
cd chatbot-worker
npm install
npx vitest run     # 9 tests, should all pass
```

---

## File index — what lives where

```
sampreethavvari.github.io/
├── src/
│   ├── pages/
│   │   ├── index.astro            ← 6-chapter Apple-style home (DONE)
│   │   ├── projects.astro         ← grid; widen for Phase 4
│   │   ├── posts.astro            ← writing index; visual is fine
│   │   ├── filmmaking.astro       ← needs Phase 3 rewrite
│   │   └── posts/*.md             ← 8 posts; need Phase 2 visual polish
│   ├── layouts/
│   │   ├── BaseLayout.astro       ← no inner wrapper anymore (Phase 1)
│   │   └── PostLayout.astro       ← needs Phase 2 stat strip + dividers
│   ├── components/
│   │   ├── about_section/         ← About + Experience + Skills + Education
│   │   ├── projects_section/      ← ProjectCard + Carousel
│   │   ├── post_section/Post.astro ← writing card (Phase 1 alignment fix)
│   │   ├── chatbot/ChatWidget.jsx ← reads PUBLIC_CHAT_ENDPOINT
│   │   └── footer/, navbar/, common/, contact_section/
│   ├── data/info.ts               ← single content source for projects + about
│   └── styles/global.css          ← palette utilities + chapter / eyebrow / display
├── chatbot-worker/                ← Cloudflare Worker + Groq Llama 3.1 8B (TDD)
├── public/                        ← all images, SVG illustrations, posters
├── tailwind.config.mjs            ← Apple-neutral palette (Phase 1)
└── plan.md                        ← THIS FILE
```

---

## Voice + style rules (apply to every page)

- No em-dash spam. Use commas, periods, semicolons, parens.
- No "robust / seamless / leverage / comprehensive / cutting-edge / best-in-class / at scale".
- No "Crucially / Importantly / Notably / In essence".
- First person ("I"), not editorial "we".
- STAR shape for blog posts (Situation / Task / Action / Result) with section headers.
- Real numbers, real file paths, real dates.
- Eyebrow line above every h1: small uppercase tracked label.
- Generous section padding (`py-24 lg:py-32`).
- One accent per section, used in headline or stats only.

## Things never to do

- Don't push the `dashboard/` directory or `Garrett files/` to git. They stay local.
- Don't modify source code in the three private Hybridge repos (`treatment-estimator`, `cbct-scan-validator`, `hybridge-consultation-qa`). README-only.
- Don't add `Co-Authored-By: Claude` to commit messages.
- Don't use the literal terms "Forward Deployed Engineer" / "FDE" / "Product Manager" anywhere in copy.

---

## Skills to invoke (Claude Code superpowers)

These are the Claude Code "superpowers" skills the agent should use as it works on this redesign. Invoke them via the `Skill` tool (or `/skill-name` from the user).

| Skill | When to invoke |
|---|---|
| `superpowers:using-superpowers` | At the start of every new conversation. Establishes how to find and use skills, requires skill invocation before any response. |
| `superpowers:brainstorming` | Before any new creative work — designing a new section, a new component, a Phase 5+ idea. Hard-gates against implementation without a presented design. Skip only if user has already approved a concrete fix. |
| `superpowers:writing-plans` | When you have a spec/requirements and need a multi-step implementation plan. Invoked automatically at the end of brainstorming. |
| `superpowers:executing-plans` | When working through a written implementation plan in a separate session, with review checkpoints. |
| `superpowers:test-driven-development` | Any time production code is being written — new feature, bug fix, refactor. Rigid: write test → watch fail → minimal code → watch pass → refactor. Already applied to `chatbot-worker/`. |
| `superpowers:systematic-debugging` | When hitting any bug, test failure, or unexpected behavior, before proposing fixes. |
| `superpowers:verification-before-completion` | Before claiming any work is done. Requires running verification commands (`npm run build`, `npm test`, etc.) and confirming output. |
| `superpowers:receiving-code-review` | When the user pushes back on code or wants something redone. Requires technical rigor, not performative agreement. |
| `superpowers:requesting-code-review` | When completing a phase / before merging. Verify work meets requirements. |
| `superpowers:finishing-a-development-branch` | When all phases are complete and you need to decide how to integrate (the site auto-deploys, but useful for end-of-session cleanup). |
| `superpowers:subagent-driven-development` | If a phase has independent sub-tasks that can run in parallel, dispatch via Agent tool. |
| `superpowers:dispatching-parallel-agents` | Same idea, formalised. |
| `superpowers:using-git-worktrees` | Probably overkill for this single-developer Astro repo; skip unless doing a long-running parallel experiment. |
| `superpowers:writing-skills` | NOT for general writing. It's about creating new Claude Code skills. Skip for this project. |
| `frontend-design:frontend-design` | Use for new components or pages that need creative visual design. The whole Apple-style redesign falls under its umbrella, but only invoke when actively designing — not for content edits. |
| `code-review:code-review` | Optional — for a deeper review pass on a PR or set of changes. |

### Skill priority order

1. **Process skills first** — `brainstorming`, `systematic-debugging`. These determine HOW to approach.
2. **Implementation skills second** — `test-driven-development`, `frontend-design`. These guide execution.

Example flows:

- "Let's redesign the blog template" → `brainstorming` → `frontend-design` → `test-driven-development` (if there's logic to test).
- "Fix the chat widget not showing" → `systematic-debugging` → `test-driven-development`.
- "Continue from plan.md" → `using-superpowers` (auto on session start) → read `plan.md` → pick the next phase → invoke the relevant implementation skill.

### Things to verify before claiming a phase is done

`superpowers:verification-before-completion` requires:
- `npm run build` passes with no errors
- `cd chatbot-worker && npx vitest run` shows all tests green
- The new pages render in `npm run dev` and look as intended
- Commits are clean and authored as Sampreeth (no Co-Authored-By trailer)
- Pushed to `main`

---

## How to pick this up in a new chat

Paste this opener:

> I'm continuing a portfolio redesign for `SampreethAvvari/sampreethavvari.github.io`. Read `plan.md` in the repo root, then continue from "Phase 2 — Blog post visual polish" onward. The home page (Phase 1) is already live; do not redo it. Invoke `superpowers:brainstorming` only when you need to design something new; otherwise apply locked design decisions and voice rules and proceed with `superpowers:test-driven-development` + `superpowers:verification-before-completion`. Commit as Sampreeth, no AI trailer. Do not push `dashboard/` or `Garrett files/` to git.

That's enough for any reasonable agent to resume without re-doing locked work.
