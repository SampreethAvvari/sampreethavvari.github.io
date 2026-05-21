# Portfolio redesign — master plan

Open this in a fresh chat. Everything needed to keep going is in here.

**Last update:** end of session after commit `f171d1b` — nav redesign, photo+text glass shimmer, brighter eyebrows.

---

## 🔥 TOP OF QUEUE — Latest user feedback (start here)

These came in at the end of the session and haven't shipped yet. They are P0 for the next chat.

### F1. Add institutional logos to the About chapter

User said: *"id like to see the nyu, hybridge, jntu and shure icons where you display them and the headings a little clear. I oversaw them. eyes must stick there. think as a marketing person when designing and making creative choices"*

What this means:
- The Education + Experience timelines in the About chapter (Chapter 02) currently show only text. Add the institutional logo next to each entry.
- Logos available in `public/logos/`: `nyu.svg`, `hybridge.webp`, `shure.svg`. JNTU logo needs to be added (see Image prompts below).
- Make the headlines more eye-catching so the user doesn't skim past them. Consider:
  - Larger size (use `.display` instead of `.display-sm` on Skills + About headlines)
  - `text-shimmer` on a key word in each chapter headline (currently only the hero has it)
  - A leading colored bar or icon next to the eyebrow
  - More breathing room above + below the headline

Concrete shape for each Education / Experience row:

```astro
<li class="flex items-start gap-3">
  <div class="shrink-0 w-12 h-12 rounded-xl bg-white dark:bg-white/[0.05] border border-text/10 dark:border-dk-text/10 flex items-center justify-center overflow-hidden">
    <img src={ed.logo} alt={`${ed.location} logo`} class="w-9 h-9 object-contain" />
  </div>
  <div class="min-w-0 flex-1">
    <p class="font-semibold text-text dark:text-dk-text leading-snug">{ed.title}</p>
    <p class="text-text/60 dark:text-dk-text/60 text-sm leading-snug">{ed.location}</p>
    <p class="text-text/40 dark:text-dk-text/40 text-xs mt-1">
      {ed.date}{ed.gpa ? ` · GPA ${ed.gpa}` : ""}
    </p>
  </div>
</li>
```

Update `info.ts` so JNTU has a logo path: add `logo: "/logos/jntu.svg"` to the Bachelor's entry.

### F2. JNTU logo prompt for Gemini

JNTU doesn't have a logo file yet. Generate one with:

> Generate a minimalist SVG-style logo for "Jawaharlal Nehru Technological University" (JNTU India). Square aspect ratio, transparent background. Use a single deep blue color (#0066CC). Design: a stylized open book with a rising torch flame on top (the standard JNTU iconography), in a clean modern flat-vector style. No text. Save as a 512×512 PNG with transparency. Style should match Apple's app icons (clean, geometric, generous padding).

Save the result as `public/logos/jntu.svg` (or `.png` if vector isn't possible) and reference it in `info.ts`.

### F3. Colorful gradient skill pills

User said: *"i want to see more fluent colors in the text/skills type buttons or stuff. make it more creative and visually pleasing"*

Right now skill pills are muted `bg-text/5 border border-text/10 text-text/75`. Replace with vibrant gradient pills. Plan:

- Map each skill category to a specific gradient (per-section accents already in `tailwind.config.mjs`):

```
Languages         → blue→cyan
Frontend          → cyan→emerald
Backend           → violet→blue
Databases         → emerald→amber
Cloud — GCP       → blue→violet
Cloud — AWS       → amber→cyan
MLOps / DevOps    → violet→emerald
AI / ML           → emerald→cyan
Testing           → amber→violet
Tools             → cyan→blue
Libraries         → blue→amber
```

CSS utility:

```css
.skill-pill {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;
  border-radius: 9999px;
  color: white;
  border: 1px solid rgba(255,255,255,0.18);
  background-clip: padding-box;
  transition: transform 0.2s, box-shadow 0.2s;
}
.skill-pill:hover { transform: translateY(-1px); box-shadow: 0 6px 20px -8px currentColor; }

.skill-pill.lang     { background: linear-gradient(135deg, #5B8DEF, #22D3EE); }
.skill-pill.frontend { background: linear-gradient(135deg, #22D3EE, #34D399); }
.skill-pill.backend  { background: linear-gradient(135deg, #A78BFA, #5B8DEF); }
.skill-pill.db       { background: linear-gradient(135deg, #34D399, #F5A524); }
.skill-pill.gcp      { background: linear-gradient(135deg, #5B8DEF, #A78BFA); }
.skill-pill.aws      { background: linear-gradient(135deg, #F5A524, #22D3EE); }
.skill-pill.mlops    { background: linear-gradient(135deg, #A78BFA, #34D399); }
.skill-pill.ai       { background: linear-gradient(135deg, #34D399, #22D3EE); }
.skill-pill.testing  { background: linear-gradient(135deg, #F5A524, #A78BFA); }
.skill-pill.tools    { background: linear-gradient(135deg, #22D3EE, #5B8DEF); }
.skill-pill.libs     { background: linear-gradient(135deg, #5B8DEF, #F5A524); }
```

Apply in the (yet-to-be-added) Skills chapter. Also apply to the 10 tech pills in the About chapter (use mixed gradients — pick one gradient per pill, rotating through the palette so they vary).

### F4. Blog page colors and visuals (still pending from earlier)

User said: *"the blog page just looks dead with the black bg and text. make it exciting to read with nice colors and vizs"*

Implement everything under **TAB 5: Individual blog posts** below. The full spec with CSS + per-post stat callouts is already in this file. This is the next big phase after F1–F3.

### F5. Writing chapter on home looks boring + scroll-snap not visibly snapping

User on the Writing chapter (`#writing` on home): *"this screen look very boring"*. Cards are flat dark-on-dark, the section has lots of empty vertical space, no visual energy.

Plan to fix:
- Add a subtle gradient mesh background to this chapter (similar to `.landing-atmos` but emerald/blue toned to match the section's eyebrow color).
- Restyle the post cards:
  - Add a colored top border (per-post accent — match the home work strip's accents).
  - Hover state: rotate the card 1deg + add a colored shadow.
  - Bigger image (h-48 instead of h-40).
  - A small "Read time" chip or "Latest" badge on the most recent post.
  - Each card gets a soft inner glow matching its accent.
- Headline shimmer: apply `.text-shimmer` to "the work." in "Notes from the work."
- Add a "Featured post" hero above the 4-card row for the most recent post — bigger image, full description, read-time + tag chips.

User also said: *"i dont see the snap when we scroll."*

Fix applied in CSS but not yet pushed:
- `scroll-snap-type: y proximity` moved from `.snap-chapters` (a non-scrolling wrapper) to `html.snap-home` (the actual scrolling element).
- In `src/pages/index.astro` add `<script>` to add `snap-home` class to `<html>` on mount, or in BaseLayout for the home page only.

Easiest: in `index.astro` add at the bottom of the `<BaseLayout>` slot:

```astro
<script>
  document.documentElement.classList.add("snap-home");
</script>
```

And remove the class on navigation away (Astro view transitions or page nav resets this naturally).

### F6. Marketing-eye creative direction

User said: *"think as a marketing person when designing and making creative choices"*

This is a meta-directive applying to everything below. Translation: every screen should have one thing that grabs attention immediately and one thing that makes you want to keep scrolling. Don't be subtle. The current site is leaning too tasteful + minimal. The next chat should push more visual contrast, more gradient color where it sells the work, bigger numbers, more cinematic backgrounds.

When in doubt:
- **Bigger headline** > smaller headline
- **Saturated accent color** > muted accent
- **Real institutional logos** > text-only
- **Animated subtle motion** > static
- **One memorable number per section** > balanced prose

---

## Live state right now

**Site:** https://sampreethavvari.github.io (auto-deploys on push to `main`)

**Repo:** `SampreethAvvari/sampreethavvari.github.io`

**Local clone:** `c:\Users\SAvvari\Downloads\Claude Cowork\website-work\sampreethavvari.github.io\`

### Already shipped this session (do NOT redo)

| Commit | What |
|---|---|
| `09fb030` and earlier | Pre-session baseline |
| `5d9da72` | Layout width fix (drop body container), system fonts, soft hover, motion polish, 8 blog posts shortened, Hybridge experience bullets restructured, Optimal Living Systems moved to projects, Skills section expanded in info.ts, filmmaking quote fields removed |
| `d3f505a` | Chatbot worker (Cloudflare Worker + Llama 3.1 8B on Groq) built TDD-first with 9 passing Vitest tests |
| `d6b6bf7` | First Apple-style hero polish |
| `3af8d9e` | Phase 1: 6-chapter scroll-snap home + Apple-neutral palette |
| `e5fbaa1` | First plan.md |
| `8dfd482` | Chapter tightening so each fits a viewport |
| `f171d1b` | Floating-glass nav, photo + text shimmer, brighter eyebrow |

### Locked design decisions (don't re-litigate)

| Decision | Value | Source |
|---|---|---|
| Phasing | One phase at a time, ship and react | User said in the brainstorm |
| Palette | Apple-neutral: near-white / near-black + electric blue accent, per-section accents only on hero numbers | User picked from 3 options |
| Scroll | Gentle proximity snap on home | User picked |
| Project layout on home | One numbered strip of all 5 systems; deep dives on /projects + individual posts | User picked |
| Home structure | Vertical chapters with their own bg, accent, headline | "Each screen is solid bg, scrolls feel premium" |
| Voice | Grounded, first-person, no em-dash spam, no marketing register | Saved memory; STAR shape for project blogs |
| Commits | As Sampreeth, no `Co-Authored-By: Claude` trailer | Saved memory |
| Dashboard repo | Stays local. Do not push. | Saved memory |
| FDE / Product Manager | Never use literal terms in copy | Saved memory |

### Saved memories (auto-apply in new chats)

Dir: `C:\Users\SAvvari\.claude\projects\c--Users-SAvvari-Downloads-Claude-Cowork\memory\`

- `user_role.md` — Sole AI engineer at Hybridge, NYU '25, applying for forward-deployed-style roles (without naming them), filmmaker
- `project_hybridge_portfolio.md` — Hybridge projects, which repos exist, which stay local
- `feedback_commits_no_ai_trailer.md` — No `Co-Authored-By: Claude` in commits
- `feedback_writing_voice.md` — Grounded human voice, STAR for blogs

---

## TAB 1: Home page (`/`)

### What exists now

6 chapters, scroll-snap-proximity, each min-h-screen:

1. **Hero** — name, role pill, photo with `floaty` + glass `photo-shimmer`, accent name has `text-shimmer`, three CTA pills
2. **01 — The work** — eyebrow + display headline + 5-row strip with per-row accent metric
3. **02 — About** — short bio + Education + Experience + 10 tech pills + "See all projects" link
4. **03 — Filmmaking** — Quote + Among Monsters IMDb pill + filmography list
5. **04 — Writing** — latest 4 posts in image cards
6. **05 — Connect** — big email CTA + social row

### Still to do (priority order)

**P0 — Insert a Skills chapter as new `03 — Skills`**, renumber everything below.

The user explicitly said: "I don't see education and all the skills in the screens." About chapter only shows 10 tech pills + Education/Experience timelines. The full 11-category skills list from `info.about.skills` is invisible.

New chapter shape:

```
[chapter, snap-chapter, bg-text/[0.02] dark:bg-dk-text/[0.03]]
  max-w-screen-2xl wrapper
    eyebrow "03 — Skills" in acc-violet
    display-sm "What I reach for."
    para "Stack I work with day to day." (one line)
    grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 mt-10
      for each skill category in info.about.skills:
        div
          p.eyebrow.text-text/40 (category label)
          div.flex.flex-wrap.gap-1.5 (items as small pills)
```

Pill style: `text-xs px-2.5 py-1 rounded-full bg-text/5 dark:bg-dk-text/[0.08] border border-text/10 dark:border-dk-text/10 text-text/75 dark:text-dk-text/80`

Make pills compact so 95+ items fit in one viewport at the same time. If overflow risk on short screens, allow internal scroll only on this single chapter (override `.chapter { overflow: hidden }` with `overflow-y: auto` here).

**P0 — Per-chapter accent rotation on eyebrows.** Currently all chapters use `text-acc-cyan` after a careless replace_all. The intended rotation is:

| Chapter | Eyebrow color class |
|---|---|
| 01 The work | `text-acc-cyan dark:text-acc-cyan` |
| 02 About | `text-secondary dark:text-dk-secondary` |
| 03 Skills (NEW) | `text-acc-violet dark:text-acc-violet` |
| 04 Filmmaking | `text-acc-amber dark:text-acc-amber` |
| 05 Writing | `text-acc-emerald dark:text-acc-emerald` |
| 06 Connect | `text-secondary dark:text-dk-secondary` |

Find the existing eyebrow lines via `grep -n "eyebrow text-acc-cyan" src/pages/index.astro` and assign each chapter its proper accent.

**P1 — More liveliness across chapters.** The user said: "id love to have some liveliness like some glass moving on my photo like that in main text in all screens or something like that."

What's already done:
- `.photo-shimmer` on hero photo
- `.text-shimmer` on hero "Sampreeth." span

What to add:
- `.text-shimmer` on the big display headline in each non-hero chapter (the headline span / single accent word). The shimmer is currently white-band over `currentColor`, so apply only on a word the user wants to glint.
- Animate the per-row accent number on the work strip with a slow pulse (`animate-pulse style="animation-duration: 4s"`).
- Add a parallax-lite effect: each chapter's headline floats up a bit faster than its body when scrolling (use CSS scroll-driven animations: `animation-timeline: scroll()`). Modern browsers only, fallback to no animation.

**P1 — Hide the chat widget's "Resume" double.** The new nav has a Resume pill in the top-right. The page used to have a separate floating Resume button. Confirm there's no duplicate. (Check `BaseLayout.astro` and the original Nav — old Nav had a `Download Resume` button mid-bar; the new Nav has it on the right.)

**P2 — Hero subtitle could be sharper.** Right now: "I ship ML systems in the room with the people using them." Apple-y rewrite candidates:
- "Production AI, built in the room."
- "ML systems, built alongside the people using them."
- "Built for the people in the room."

Pick one with the user when they're back.

**P2 — Re-evaluate the landing-atmos gradient blobs.** They're animating a radial gradient with `filter: blur(60px)` behind the hero. In the screenshot they show as small blue dots in the corners. Either:
- Remove the dots entirely (they look out of place against pure black bg)
- Make the gradient stronger so it reads as ambient glow, not stippling
- Scope the atmos only to the hero (currently it's on the section, that's fine)

---

## TAB 2: Projects page (`/projects`)

### What exists now

A simple grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` of 13 cards. Each card uses `ProjectCard.tsx` (image, title, description, expand-for-details, tech tags).

Page eyebrow: "Selected work", page title: "Projects."

### Still to do

**P0 — Hero header for the page.** Currently it's just `display-sm` with no real opener. Apple-style would be a brief paragraph under the title explaining what these are. Add:

```html
<p class="eyebrow text-secondary dark:text-dk-secondary mb-3">Selected work</p>
<h1 class="display mb-4">Projects.</h1>
<p class="text-lg lg:text-xl text-text/70 dark:text-dk-text/70 max-w-2xl mb-10">
  Production systems and research artifacts. The Hybridge ones I shipped solo;
  the older work is from grad school and earlier internships.
</p>
```

**P1 — Tiered masonry.** Top 5 Hybridge projects each span `lg:col-span-2` (wider) inside an `lg:grid-cols-4` layout. Older work gets `lg:col-span-1`. This automatically gives the recent work visual prominence.

Implementation in `ProjectCard.tsx`: add an optional `featured` prop. In `info.ts.projects`, mark the 5 Hybridge entries with `featured: true`. In `projects.astro`, render each card with the featured class:

```tsx
<div class={project.featured ? "lg:col-span-2" : "lg:col-span-1"}>
  <ProjectCard project={project} />
</div>
```

**P1 — Tier tags on each card.** Add a small chip in the upper-left of each card image: "Hybridge", "Research", "Industry", "Coursework". Different chip colors per tier:
- Hybridge: emerald
- Research: violet
- Industry: cyan
- Coursework: amber

Data goes in `info.ts.projects[i].tier`. Default to "Coursework" if absent.

**P2 — Optional filter strip.** A row of tier filters above the grid: `All / Hybridge / Research / Industry / Coursework`. Click filters the grid by tier via Astro's view-transitions or simple `data-tier` + `:not([data-tier="…"])` CSS. Or skip this entirely — sorting by tier (Hybridge first) is enough.

**P2 — Card image polish.** Some cards use placeholders (`paper.png`). Replace with proper imagery for: Loan Radar, LLM Persuasion, Optimal Living Systems, RAG-IPL, Fake News, ResNet, Customer Segmentation, NPC Coach, Enterprise Data Project. See the **Image prompts** section below.

---

## TAB 3: Filmmaking page (`/filmmaking`)

### What exists now

A long single-column flow:
1. Header label "Photographer • Writer • Filmmaker • Traveler"
2. Quote + Among Monsters opener
3. Roles grid (Director / Writer / Editor / Cinematographer / Music)
4. Among Monsters detail section
5. Cast lists (key creators / main cast / supporting cast / music)
6. Stills carousel
7. Misc galleries (general gallery + Swechcha)

The user said this page can be "10x better in visual appeal."

### Still to do (this is the biggest redesign)

**P0 — Full restructure into a "festival catalog" shape:**

```
1. AMONG MONSTERS OPENER (chapter-height, dark bg, big poster left + byline right)
2. FILMOGRAPHY (horizontal scroll-snap row of 7 film cards: Among Monsters,
   Extraordinary Lives, Pupa, Solistice, Swecha, Tiger Man, Strangers)
3. CREATIVE ROLES (the existing 5-role grid, polished smaller)
4. AMONG MONSTERS DEEP DIVE (full-width section with synopsis, cast, IMDb link,
   screenplay download CTA)
5. STILLS (clean uneven masonry; no overlapping captions; lightbox on click)
6. CREW & CAST (uniform 4:5 portraits, single Instagram link per card,
   tag-colored by role group)
7. MISC GALLERIES (general gallery + Swechcha) — keep as the last section
```

**P0 — Replace `text-secondary` headings with display-sm + eyebrows.** Every heading on the page should follow the same shape as the home chapters: eyebrow line + display title + body para.

**P0 — Among Monsters opener.** Currently uses the existing poster image plus a quote. Make it cinematic:

```html
<section class="relative min-h-[80vh] bg-black flex items-center">
  <div class="absolute inset-0 opacity-30">
    <Image src="/among-monsters-poster.jpg" class="w-full h-full object-cover blur-2xl scale-110" />
  </div>
  <div class="relative grid lg:grid-cols-12 gap-12 px-6 lg:px-12 max-w-screen-2xl mx-auto items-center">
    <div class="lg:col-span-5">
      <Image src="/among-monsters-poster.jpg" class="aspect-[2/3] w-full rounded-lg shadow-2xl" />
    </div>
    <div class="lg:col-span-7 text-white">
      <p class="eyebrow text-acc-cyan mb-4">In post · 2026</p>
      <h1 class="display mb-6">Among Monsters.</h1>
      <p class="text-xl text-white/80 leading-relaxed mb-6">
        An independent crime drama about gray characters, tight spaces, and the
        chaos hiding inside ordinary lives.
      </p>
      <p class="text-sm uppercase tracking-[0.2em] text-white/60 mb-8">
        Director · Writer · Editor · Music
      </p>
      <div class="flex flex-wrap gap-3">
        <a href="https://imdb.com/title/tt39700295/" class="pill-cta">IMDb</a>
        <a href="/among-monsters-screenplay.pdf" class="pill-cta-outline">Screenplay</a>
      </div>
    </div>
  </div>
</section>
```

**P1 — Filmography horizontal scroll row.** 7 poster cards. CSS `scroll-snap-type: x mandatory` so the user swipes through them. Each card: poster image + year + title + roles list. Need posters for the 6 films other than Among Monsters — see Image prompts section.

**P1 — Crew portraits.** Currently inconsistent — some have `imageStyle` overrides, some scale, some position-shift. Standardize to a single 4:5 portrait card with `object-cover object-center`. All `crewPhoto()` images get a uniform rounded-2xl + soft border. Instagram link as a small chip below the name.

**P2 — Lightbox on stills.** Click a still to open it full-screen. There's no current lightbox component — would need to write one or pull in a tiny one (`yet-another-react-lightbox` is small). Or skip and just rely on the browser's image right-click.

**P2 — Hide the "Photographer • Writer • Filmmaker • Traveler" header** or restyle. It feels dated compared to the new typography.

### Image prompts for Gemini

When you need to generate film posters for the 6 missing films, paste the prompt below into Gemini (one per film):

**Generic film poster generator prompt:**

> Generate a minimalist film poster, 2:3 aspect ratio. Color palette: deep navy and charcoal with a single accent color [PICK FROM: desaturated crimson / muted ochre / cold cyan / vintage sepia]. Bold sans-serif title typography "[FILM TITLE]" in the lower third; year "[YEAR]" small at the bottom in the same font. A single evocative central image element: [DESCRIPTION OF SCENE]. Subtle film grain texture. Generous negative space. Style: Criterion Collection cover. Output a vertical poster.

Per-film descriptors:

- **Extraordinary Lives** (2027 upcoming) — "Two empty wooden chairs facing each other in an empty room with one hanging incandescent bulb casting a circle of warm light on a hardwood floor. Slight haze in the air."
- **Pupa** (upcoming) — "A single human hand reaching upward through dense fog, fingers slightly curled, the wrist disappearing into deeper haze below. Dawn-grey light from above."
- **Solistice** (2025) — "A lone figure standing on a snowy ridge at dawn, silhouetted against a pale lavender sky, breath visible in the cold air, vast valley below."
- **Swecha** (2024) — "A pair of bare feet stepping into a still pool of water reflecting a single tree, ripples expanding outward from the foot. Warm afternoon light."
- **Tiger Man** (2022) — "A silhouetted figure facing a glowing rectangular window in an otherwise dark wall, the figure's posture tense, hand near the window frame."
- **Strangers** (2019) — "Two figures walking away from the viewer down a long, empty city street at night, their reflections in wet pavement, single sodium-vapor streetlight overhead."

**BTS still generator prompt** (for stills masonry, if you need filler):

> Generate a behind-the-scenes still from an independent film shoot, 16:9 aspect ratio. Soft cinematic lighting (golden hour or low-key). Foreground: a clapperboard, a camera viewfinder, or a director's monitor. Background: shallow depth of field, blurred crew silhouettes. Muted earth colors with one warm light source. Film grain. Candid, not posed.

---

## TAB 4: Writing index page (`/posts`)

### What exists now

`Post.astro` cards in a 4-column grid. Each card: image + date + title (clamp-3) + description (clamp-3) + "Read more" with arrow. Cards use `bg-text/[0.03]` faint background. Title pops on hover.

### Still to do

**P1 — Tag chips on cards.** Add a small chip at the top-right of each card image indicating the post type: "MLOps / Architecture / Process / Personal". Different colors per tag matching the home chapter accents. Tag data goes in each post's frontmatter (`tags: [...]`).

**P1 — Featured post hero.** The most recent post gets a hero treatment at the top of `/posts` — full-width card with bigger image, larger title, the description shown in full. Then the grid of remaining posts below.

**P2 — Reading time.** Add an estimated reading time in the card (under the date). Compute at build time via word count of the markdown body. Astro frontmatter or remark plugin.

---

## TAB 5: Individual blog posts (`/posts/*`)

The user said: "the blog page just looks dead with the black bg and text. make it exciting to read with nice colors and vizs."

### What exists now

`PostLayout.astro` renders:
- Hero with title + date + back link + cover image
- A `prose dark:prose-invert` body
- Right-side author card

Most of the body is just text on near-black. No color, no visual breaks.

### Still to do — this is THE high-priority next phase

**P0 — Color-coded STAR sections.** Wrap each `## Situation / ## Task / ## Action / ## Result` section in a tinted band:

- Situation: slate tint, slate left-border
- Task: amber tint, amber left-border
- Action: blue tint, blue left-border
- Result: emerald tint, emerald left-border

Simplest implementation that doesn't need a remark plugin: wrap each STAR section manually inside each `.md` file with `<div class="star situation">…</div>` (Astro renders inline HTML inside markdown). The CSS:

```css
.star {
  border-radius: 1rem;
  padding: 2rem 1.5rem;
  margin: 2.5rem 0;
  border-left: 4px solid currentColor;
}
.star.situation { color: #64748B; background: rgba(100, 116, 139, 0.06); }
.star.task      { color: #F5A524; background: rgba(245, 165, 36, 0.06); }
.star.action    { color: #5B8DEF; background: rgba(91, 141, 239, 0.06); }
.star.result    { color: #34D399; background: rgba(52, 211, 153, 0.06); }
.star > h2:first-child { margin-top: 0; color: currentColor; }
.star > p,
.star > ul,
.star > table { color: theme(colors.text); }
html.dark .star > p,
html.dark .star > ul,
html.dark .star > table { color: theme(colors.dk-text); }
```

For each of the 8 posts, edit the markdown so each STAR header is wrapped:

```markdown
<div class="star situation">

## Situation

… existing prose …

</div>

<div class="star task">

## Task

… existing prose …

</div>

…
```

The blank lines between the div and the `##` are required for markdown to keep parsing the content as markdown.

**P0 — Stat callouts.** Each post should have one or two big stat callouts inline — gradient cards with a huge number on top and a label below. Example for `cowork-dashboard.md`:

```html
<div class="stat-callout stat-blue">
  <div class="stat-value">49% → 99%</div>
  <div class="stat-label">patient-to-lead linkage after the schema fix</div>
</div>
```

CSS:

```css
.stat-callout {
  border-radius: 1rem;
  padding: 2rem;
  margin: 2.5rem 0;
  background: linear-gradient(135deg, rgba(91,141,239,0.14), rgba(34,211,238,0.08));
  border: 1px solid rgba(91,141,239,0.28);
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
  opacity: 0.75;
}
.stat-cyan    { background: linear-gradient(135deg, rgba(34,211,238,0.16), rgba(91,141,239,0.08)); border-color: rgba(34,211,238,0.30); }
.stat-violet  { background: linear-gradient(135deg, rgba(167,139,250,0.16), rgba(91,141,239,0.08)); border-color: rgba(167,139,250,0.30); }
.stat-emerald { background: linear-gradient(135deg, rgba(52,211,153,0.16), rgba(34,211,238,0.08));  border-color: rgba(52,211,153,0.30); }
.stat-amber   { background: linear-gradient(135deg, rgba(245,165,36,0.16), rgba(220,38,38,0.08));   border-color: rgba(245,165,36,0.30); }
.stat-blue    { background: linear-gradient(135deg, rgba(91,141,239,0.16), rgba(34,211,238,0.08));  border-color: rgba(91,141,239,0.30); }
```

Per-post stat callouts to add (one each, where the punchline is):

- `cowork-dashboard.md` → `49% → 99%` blue, "patient-to-lead linkage"
- `treatment-estimator.md` → `2 days` violet, "spec to production end-to-end"
- `cbct-scan-validator.md` → `$50/month` cyan, "vs the $124K year-one vendor quote"
- `clinical-rag.md` → `+130%` emerald, "treatment acceptance"
- `accounting-automation.md` → `~400 hrs/yr` amber, "of senior accounting time recovered"
- `film-and-engineering.md` → maybe skip; it's an essay, not a project
- `llama-rlhf.md` → `~67%` blue, "human-eval win rate vs base"
- `loan-radar-mlops.md` → `0.79ms` cyan, "median inference latency"

**P0 — Hero stat strip below the cover image.** Three small chip-cards. Use frontmatter:

```yaml
stats:
  - { label: "Patient ↔ lead linkage", value: "49% → 99%", tone: "blue" }
  - { label: "Weekly reconciliation",  value: "½ day → 3 min", tone: "amber" }
  - { label: "Revenue surfaced",        value: "~$169k", tone: "emerald" }
```

In `PostLayout.astro`, render below the hero image:

```astro
{frontmatter.stats && (
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mt-6">
    {frontmatter.stats.map((s) => (
      <div class={`stat-callout stat-${s.tone}`}>
        <div class="stat-value text-xl lg:text-2xl">{s.value}</div>
        <div class="stat-label text-xs">{s.label}</div>
      </div>
    ))}
  </div>
)}
```

**P0 — Gradient section dividers.** Replace markdown `---` with `<hr class="grad-divider">`:

```css
hr.grad-divider {
  height: 1px;
  border: 0;
  background: linear-gradient(90deg, transparent, theme(colors.secondary), transparent);
  margin: 4rem 0;
}
```

**P0 — Quote blocks restyled.** Loud, colored, italic:

```css
.prose blockquote {
  border-left: 4px solid theme(colors.secondary);
  padding: 1rem 1.5rem !important;
  font-size: 1.25rem;
  font-style: italic;
  background: rgba(91,141,239,0.06);
  border-radius: 0 0.75rem 0.75rem 0;
  color: theme(colors.text) !important;
}
html.dark .prose blockquote { color: theme(colors.dk-text) !important; }
```

**P0 — Better tables.** Tailwind typography `prose` already styles them, but the dark-mode contrast is weak. Add:

```css
.prose table { border-collapse: separate; border-spacing: 0; width: 100%; margin: 2rem 0; }
.prose thead { background: rgba(91,141,239,0.08); }
.prose thead th { color: theme(colors.secondary); font-weight: 700; padding: 0.75rem 1rem; }
.prose tbody tr:nth-child(odd) td { background: rgba(255,255,255,0.02); }
.prose tbody td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
```

**P1 — Inline code styling.** Currently `prose` renders `<code>` plain. Add a soft tint:

```css
.prose :not(pre) > code {
  background: rgba(91,141,239,0.10);
  color: theme(colors.secondary);
  padding: 0.15em 0.4em;
  border-radius: 0.3rem;
  font-size: 0.92em;
  font-weight: 500;
}
html.dark .prose :not(pre) > code {
  background: rgba(91,141,239,0.18);
  color: theme(colors.dk-secondary);
}
.prose :not(pre) > code::before,
.prose :not(pre) > code::after { content: ""; }
```

**P1 — Code block syntax highlighting.** Astro uses Shiki by default. Confirm it's enabled in `astro.config.mjs`. If not, set it up with a dark theme (`dracula` or `nord`).

**P2 — Reading progress bar.** A thin colored bar at the top of the screen that tracks how far the user has scrolled. JS or CSS scroll-driven animation.

### Implementation order for the blog template

1. Add all CSS classes to `global.css` (stat-callout, star bands, grad-divider, quote, table, inline code).
2. Update `PostLayout.astro` to render the optional `stats` strip.
3. Edit each of the 8 `src/pages/posts/*.md` files:
   - Add `stats:` to frontmatter (per the list above).
   - Wrap each `## Situation/Task/Action/Result` section in `<div class="star situation/task/action/result">…</div>`.
   - Replace `---` with `<hr class="grad-divider">` where appropriate.
   - Add one in-body `<div class="stat-callout stat-X">` for the punchline.
4. Build + push, eyeball each post.

---

## TAB 6: Profile README (`SampreethAvvari/SampreethAvvari`)

### Status: shipped earlier this session. Don't touch unless explicitly asked.

The README is the modern 2026 hand-crafted profile with project box, selected earlier work, tech stack, engineering principles, filmmaking note.

---

## Chatbot — waiting on user

Worker code + 9 passing tests + README are at `chatbot-worker/`. Two action items the user owns:

1. **Groq key** — https://console.groq.com (free, no card)
2. **Cloudflare deploy** — from `chatbot-worker/`:
   ```bash
   npm install -g wrangler && wrangler login
   cd chatbot-worker
   npm install
   wrangler secret put GROQ_API_KEY
   npm run deploy
   ```
3. **Wire the site** — set `PUBLIC_CHAT_ENDPOINT` (e.g. `https://sampreeth-chatbot.<sub>.workers.dev/chat`) as a repo variable in GitHub Actions and reference it in `.github/workflows/deploy.yml` build step.

When the user pastes the worker URL, wire the workflow file in one edit.

---

## Design system reference

### Palette (live in `tailwind.config.mjs`)

```
Light mode:
  primary    #FBFBFD   page bg
  text       #1D1D1F   body
  secondary  #0066CC   primary accent (links, eyebrows)
  accent     #0040AA   secondary accent (hover)

Dark mode:
  dk-primary    #000000   page bg
  dk-text       #F5F5F7   body
  dk-secondary  #5B8DEF   primary accent
  dk-accent     #22D3EE   secondary accent

Per-section accents (for hero metrics only, NEVER body):
  acc-cyan     #22D3EE   01 The work
  acc-violet   #A78BFA   03 Skills, Treatment Estimator hero metric
  acc-emerald  #34D399   05 Writing, Consultation QA hero metric
  acc-blue     #5B8DEF   Cowork Dashboard hero metric
  acc-amber    #F5A524   04 Filmmaking, Accounting Automation hero metric
```

### Typography (live in `global.css`)

- Body font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Segoe UI", Roboto, …`
- `font-display` Tailwind utility uses the same stack.
- Headlines: `letter-spacing: -0.025em` (h1), `-0.018em` (h2)
- Body: `line-height: 1.6`, `font-feature-settings: "ss01" "cv11" "kern" "liga"`
- `.display` = clamp(2.5rem, 6vw, 5.5rem), 700, -0.03em
- `.display-sm` = clamp(2rem, 4vw, 3.5rem), 600, -0.025em
- `.eyebrow` = 0.8rem, uppercase, 0.28em letter-spacing, 700, with leading dot bullet
- `.metric-number` = clamp(3rem, 6vw, 5rem), 700, tabular-nums

### Motion (live in `global.css`)

- `.floaty` — gentle vertical drift, 6s loop. On the hero photo wrapper.
- `.photo-shimmer` — diagonal white sweep over photos every 6s. On the hero photo container.
- `.text-shimmer` — diagonal white sweep through text every 6s. On the hero accent name.
- `.snap-chapters` / `.snap-chapter` — proximity scroll-snap.
- `.chapter` — min-h-screen flex column vertically centered, overflow-hidden, responsive top/bottom padding clamped to viewport height.
- Stagger reveal on grid children inside `[data-reveal]` sections (`.reveal-visible > .grid > *:nth-child(N) { transition-delay: 0.05N s; }`).
- `.landing-atmos::before` — slow radial gradient drift behind hero.
- Global hover: `translateY(-1px)` cubic-bezier. Cards use `hover:scale-[1.02]`.
- All animations respect `prefers-reduced-motion: reduce`.

### Layout

- `BaseLayout.astro` has no inner wrapper. Pages opt into `<div class="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20">`.
- Nav is fixed-top with frosted backdrop-blur.
- `html { scroll-padding-top: 4.5rem }` so anchor jumps clear the fixed nav.

---

## Voice + style rules

- No em-dash (`—`) as default punctuation. Use commas, periods, semicolons, parens.
- No "robust / seamless / leverage / comprehensive / cutting-edge / best-in-class / at scale".
- No "Crucially / Importantly / Notably / In essence".
- First person ("I"), not editorial "we".
- STAR shape for blog posts: explicit `## Situation / ## Task / ## Action / ## Result` headers; prose inside, not resume bullets.
- Real numbers, file paths, dates.
- Eyebrow above every h1.
- Section padding `py-24 lg:py-32` for breathing room (or `.chapter` for full-viewport).
- One accent per chapter on the eyebrow + the hero metric.

### Things never to do

- Don't push the `dashboard/` directory or `Garrett files/` to git.
- Don't modify code in the three private Hybridge repos (treatment-estimator, cbct-scan-validator, hybridge-consultation-qa) — README-only.
- Don't add `Co-Authored-By: Claude` to commit messages.
- Don't use "Forward Deployed Engineer", "FDE", or "Product Manager" anywhere in copy.

---

## Skills to invoke (Claude Code superpowers)

| Skill | When |
|---|---|
| `superpowers:using-superpowers` | Auto at conversation start |
| `superpowers:brainstorming` | Before any creative work — designing a new section / component. Hard-gates implementation without an approved design. |
| `superpowers:writing-plans` | When a spec needs a multi-step impl plan |
| `superpowers:executing-plans` | When working a written plan with review checkpoints |
| `superpowers:test-driven-development` | All production code: test → fail → minimal code → pass → refactor |
| `superpowers:systematic-debugging` | Any bug, test failure, unexpected behavior |
| `superpowers:verification-before-completion` | Before claiming work done — run `npm run build`, `npx vitest run`, confirm output |
| `superpowers:requesting-code-review` / `:receiving-code-review` | At phase completion / when user pushes back |
| `superpowers:dispatching-parallel-agents` | When phase has independent sub-tasks |
| `frontend-design:frontend-design` | Whenever designing new components/pages with creative visual choices |
| `code-review:code-review` | Optional deeper review pass on a PR |

### Skill priority

1. Process skills (brainstorming, debugging) — decide HOW to approach
2. Implementation skills (TDD, frontend-design) — guide execution

Example flow for blog template phase:
- `brainstorming` (or skip if user pre-approves) → `frontend-design` (for the visual choices) → manual implementation per the spec in this file → `verification-before-completion` → commit + push as Sampreeth.

---

## Local dev quickstart

```powershell
# From C:\Users\SAvvari\Downloads\Claude Cowork\website-work\sampreethavvari.github.io
npm install
npm run dev      # http://localhost:4321
npm run build    # builds to dist/
```

Chatbot worker tests:

```powershell
cd chatbot-worker
npm install
npx vitest run   # 9 tests should pass
```

---

## File index

```
sampreethavvari.github.io/
├── src/
│   ├── pages/
│   │   ├── index.astro            ← 6-chapter home, needs P0 fixes (Skills chapter, per-chapter accent rotation)
│   │   ├── projects.astro         ← needs P0 hero header + P1 tiered masonry
│   │   ├── posts.astro            ← needs P1 featured-post hero
│   │   ├── filmmaking.astro       ← needs P0 restructure (festival catalog)
│   │   └── posts/*.md             ← needs P0 STAR bands + stat callouts (8 posts)
│   ├── layouts/
│   │   ├── BaseLayout.astro       ← no inner wrapper (correct)
│   │   └── PostLayout.astro       ← needs P0 stats strip rendering
│   ├── components/
│   │   ├── about_section/         ← About.tsx exists but is unused on the new home
│   │   ├── projects_section/      ← ProjectCard.tsx (add featured prop in P1)
│   │   ├── post_section/Post.astro
│   │   ├── chatbot/ChatWidget.jsx
│   │   ├── navbar/Nav.jsx         ← Phase-1 fixed-top redesign shipped
│   │   ├── footer/, common/, contact_section/, search/
│   │   └── about_section/{About,Education,Experience,Skills,PhotoCarousel}.tsx
│   ├── data/info.ts               ← projects, about, skills, experience, contact
│   └── styles/global.css          ← Apple typography + motion + chapter utilities
├── chatbot-worker/                ← Cloudflare Worker + Llama 3.1 8B Groq, TDD
├── public/                        ← /pic.png, /Among Monsters poster, SVG illustrations
├── tailwind.config.mjs            ← Apple-neutral palette + per-section accents + font-display
├── plan.md                        ← THIS FILE
└── package.json
```

---

## How to pick this up in a new chat

Paste this opener:

> I'm continuing the Apple-style portfolio redesign for `SampreethAvvari/sampreethavvari.github.io`. Read `plan.md` in the repo root and start from the highest-priority P0 items across all tabs. The home page (Phase 1) is largely live; do NOT redo it, but apply the listed P0 fixes (insert a Skills chapter as `03 — Skills`, rotate per-chapter eyebrow accent colors). Then move to the blog template P0 work (color-coded STAR bands, stat callouts, gradient dividers, hero stats strip) since the user said "blog page looks dead." Then projects page header, then filmmaking page redesign. Commit as Sampreeth, no AI trailer. Don't push `dashboard/` or `Garrett files/`. Apply the locked design decisions and voice rules.

That's the only thing the new chat needs.
