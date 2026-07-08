# Spatial redesign: landing page and blogs page

Date: 2026-07-07
Scope: `src/pages/index.astro` (landing and home), `src/pages/posts.astro` (blogs index), `src/components/navbar/*` (visual restyle only), plus the performance fixes from the code review. Every other page stays: Work, Projects, Gallery, Filmmaking, Teaching, Resume, and every post page keep their current layouts and remain reachable from the nav exactly as today.

## Direction

Glass, refraction, and depth on the existing Apple neutral palette. Dark near black, light near white, the four discipline accents (emerald, violet, amber, blue) plus cyan and film crimson. No new colors. The page should feel like polished panes of glass floating over slow moving fields of color, with one real 3D moment in the hero and small physical interactions everywhere else. Less text than today, tighter alignment, everything on an 8px spacing grid.

## Design language (applies to both pages)

- **Glass panels**: translucent surfaces with backdrop blur and saturation, a 1px light border on the top edge, soft deep shadow. A faint chromatic gradient rim on featured panels only.
- **Pointer glare**: a soft specular highlight that follows the cursor across glass surfaces. Desktop only.
- **Moving glows**: every section carries one or two large blurred color orbs drifting slowly behind the content, in that section's accent. Subtle: opacity around 0.3, animation 17s or longer, off under reduced motion.
- **Grain**: a fixed film grain overlay at around 5% opacity for texture.
- **Cursor**: the existing glitter trail from `Pointer.jsx` stays as is (it also gains a reduced motion check, see performance). No dot and ring cursor.
- **Magnetics**: primary buttons and discipline pills lean a few pixels toward the cursor and spring back. Desktop only.
- **Tilt**: cards tilt up to 4 to 6 degrees under the cursor. Desktop only.
- **Depth arrival**: sections ease in with a small translate, scale, and fade as they enter the viewport. One shared scroll handler with rAF batching, off under reduced motion.
- **Count ups**: numeric metrics animate once when they first become visible.
- **Typography**: the existing SF system stack. Display headings tighter (letter spacing about -0.035em), body copy at most 56ch. Monospace only for acronyms, numbers, and eyebrows.

## Nav (all pages)

A floating glass dock, docked top right, replacing the current full width bar. Contents unchanged: links to Work, Projects, Writing, Film, plus the search trigger and theme toggle, and a filled "Get in touch" pill. On mobile it collapses to the SA mark plus a menu button opening the existing sheet with all pages (Home, About, Work, Gallery, Projects, Filmmaking, Writing, Teaching, Resume, Contact). A light sheen sweeps across the dock every few seconds. Search keeps working exactly as today (single instance, see performance).

## Landing page (index.astro)

Section order: Hero, Marquee, Disciplines, Work, About, Writing, Filmmaking, Contact. Scroll snap is removed; normal scrolling with depth arrival replaces it. The left ScrollSpine is replaced by a slimmer progress rail of six dots (hidden below lg).

### Hero (100svh)
- Background: raymarched glass metaballs in raw WebGL (no dependencies), refracting a slow four color gradient, drifting on their own and gently following the cursor. Fallbacks in order: WebGL unavailable or reduced motion or small screen (below lg) gets the static aurora image treatment instead.
- Left: eyebrow "AI Engineer · New York", the headline "I'm Sampreeth. I ship AI and direct films.", one sentence lead, four discipline pills, two buttons (See the work, Read the writing). Nothing else. The name carries a slow gradient shimmer.
- Right: the portrait (`/pic.avif`) in a glass frame at its true 4:5 aspect ratio, object-fit cover, gentle tilt on hover, pointer glare. Nothing floats over or around the photo.
- A single scroll cue arrow at the bottom center.

### Marquee
One thin glass strip with the core toolkit scrolling continuously (Python, PyTorch, RAG, Vertex Gemini, FastAPI, BigQuery, TypeScript, and so on), pausing on hover. This replaces the four skill tile walls, cutting the heaviest text block on the page.

### Disciplines
Four equal glass tiles (AIE, MLE, FDE, SDE) in one row on lg, two by two on md, stacked on mobile. Each: acronym, name, one line, project count link into `/work/[slug]`. An orbiting glow lives inside each tile in its accent.

### Work
Six systems as a strict uniform grid: three columns by two rows on lg, two by three on md, single column on mobile. Every card identical in structure and height: number, metric (count up, accent color), system name, one line description, one uppercase tag line pinned to the bottom. No bento size mixing. Cards link to their posts. Below the grid: one link, "Browse all 15 projects →" into `/projects`.

### About (compressed)
Two columns on lg: left is the short bio paragraph and a "See all the projects" link; right is Education and Experience as compact brand badge rows (unchanged data, tighter spacing). The old skill tile walls are gone (the marquee covers skills); a one line link "Full toolkit on the resume →" points to `/resume`.

### Writing
Featured latest post as a wide glass panel (cover image, title, one line, reading time), plus the next three as compact cards in a side stack. Link to `/posts`.

### Filmmaking
The crimson quote, one sentence, the four credits as hover rows with year, IMDb and full slate buttons. Unchanged content, glass treatment.

### Contact
Centered: heading, one sentence, the email as a large magnetic glass pill, then the existing social icon row. The chat widget and top button stay.

### Copy budget
Total visible words on the landing page drop by roughly 40%. Every section: eyebrow, heading, at most one supporting sentence. No paragraph over two lines at desktop width.

## Blogs page (posts.astro)

Editorial magazine on the same glass language:
- Compact header: eyebrow, "Writing.", one sentence.
- Featured latest post: full width glass panel, cover left or top, title at display size, one line description, date and reading time, pointer glare.
- The rest in a three column grid on lg (two on md, one on mobile): cover, title, date and reading time, one line. Cards lift and glare on hover. Each card takes an accent from a rotating cycle, as today.
- Reading time is computed at build from word count for every post and shown on all cards.
- Moving glows behind the grid, same as landing sections.

## Mobile rules (both pages)

- Tilt, magnetics, glare, and the WebGL hero are desktop only (pointer fine and lg and up). Mobile gets the static gradient hero, full width stacked panels, and the same content.
- Blur radii reduced on mobile (backdrop blur 12px instead of 22px) for GPU health.
- Marquee runs slower on mobile; all motion honors reduced motion.
- Touch targets minimum 44px; the nav dock never overlaps content.

## Performance work folded in (from the code review)

1. Any rAF loop (WebGL hero, glitter cursor) pauses via IntersectionObserver or visibility when its canvas is offscreen; `Pointer.jsx` gains a reduced motion bail.
2. Remove the Roboto Google Fonts link and its preconnects (font stack resolves to system fonts everywhere).
3. Remove the normalize.css CDN link (Tailwind preflight already resets).
4. Replace CDN FontAwesome with a small set of self hosted inline SVGs for the icons actually used.
5. Split page specific CSS out of `global.css` (post prose styles into PostLayout, hero styles into index, chat styles into the widget), keeping only true globals shared.
6. Build search items once in a shared module instead of globbing all posts in BaseLayout on every page; mount one Search instance; memoize the Fuse index.
7. Debounce the reveal MutationObserver.

## Error handling and fallbacks

- WebGL context failure, reduced motion, or small screens fall back to the static hero images already in `/public`.
- All decorative layers are `aria-hidden` and `pointer-events: none`; content stays readable and navigable with JS disabled (motion simply absent).
- Focus states: every interactive element keeps a visible focus ring (2px accent outline, offset 3px).

## Testing and acceptance

- `npm run build` passes; localhost preview reviewed and approved by Sampreeth before any commit or push.
- Lighthouse on the built site: performance 90 plus on desktop and mobile for `/` and `/posts`, no CLS from the portrait or covers (all images keep explicit dimensions and true aspect ratios).
- Manual pass: dark and light themes, 390px, 768px, 1280px, 1536px widths, keyboard navigation, reduced motion.
- All existing routes (work, projects, gallery, filmmaking, teaching, resume, posts/*) still render and remain linked from the nav.

## Out of scope

Post article layout (PostLayout), Work detail pages, Projects, Gallery, Filmmaking, Teaching, Resume page designs, chatbot behavior, RSS, and the teaching worker. They inherit the new nav dock and any global CSS slimming but are otherwise untouched.
