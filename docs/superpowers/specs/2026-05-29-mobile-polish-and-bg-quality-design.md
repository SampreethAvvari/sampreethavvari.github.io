# Mobile Polish & Background Rendering Quality — Design

Date: 2026-05-29
Branch: `mobile-polish-and-bg-quality`

## Goal

Two threads, one effort:

- **A — Mobile polish.** Make the mobile breakpoint feel sleek and intentional (Apple-grade) across every page, fixing interactions that silently break on touch.
- **B — Background quality.** Make the ambient glow/atmosphere backgrounds render smooth and high-quality at every resolution and orientation — they currently look blurry/banded on 4K displays.

## The desktop guarantee (hard constraint)

The laptop/desktop view must stay visually identical.

- Never change an existing `lg:` / `xl:` / `2xl:` Tailwind class value, nor the desktop branch of any `@media (min-width: …)` query.
- Mobile changes land only in: unprefixed base classes, new `max-lg:`/`sm:`/`md:`-scoped utilities, or `@media (max-width: …)` blocks.
- The single allowed cross-cutting change is the background-quality refactor (Thread B), because the user explicitly asked for it on all screens. Its result on desktop must be the **same look, rendered smoother** — same colors, same bloom positions, no layout change.

## Architecture decision

No separate mobile/desktop versions. Single responsive codebase (current setup) is correct and is how Apple's own pages work. Effort = refine the mobile breakpoint + improve shared background rendering.

## Verification method

Per user choice: **no formal automated tests.** Verify by visual/screenshot review at 4K (3840px), 1440p, laptop (~1280px), and mobile (375/390px), in light + dark, portrait + landscape, plus `npm run build` passing. Prove desktop unchanged with a before/after at laptop width.

---

## Thread B — Background rendering quality

### Root causes (4K blur/banding)
1. **GPU texture-size cap.** Atmos layers have `filter: blur(80–120px)` + animated `transform`. At ~3840px wide with `inset:-10%` and `scale(1.08)`, the rasterized layer exceeds the common 4096px texture limit, gets downscaled, and looks soft.
2. **`transparent` color stops** = transparent *black* (`rgba(0,0,0,0)`), muddying gradients toward gray → visible banding on near-black.
3. **Animation jank** from repainting huge blurred layers every frame.

### Fix (applies to all atmos/glow layers, all pages)
- **Remove `filter: blur()` from pure-gradient ambient layers** and bake softness into the gradient itself via wider, multi-stop radial falloff. Same colors, same positions, same vibe — rendered cleanly. Affected: `.work-atmos`, `.about-atmos`, `.writing-atmos`, `.filmmaking-atmos`, `.connect-atmos`, `.hero-atmos`, `.landing-atmos::before`, `.posts-index-hero::before`, `.post-hero-atmos` (global.css); `.projects-hero-atmos::before`, `.project-screen-atmos.*`, `.project-screen-imagewrap::before` (projects.astro inline styles).
- **Replace every `transparent` stop with `rgba(<same color>, 0)`** in those gradients.
- **Keep `filter: blur()` only where it blurs a real image** — e.g. `.film-hero-backdrop-img` in filmmaking.astro. That's a genuine image blur; leave it (optionally add `transform: translateZ(0)` for stability).
- **Re-tune the noise dither** (`body::after`) so residual banding is still erased at high DPI.
- Add `transform: translateZ(0)` / `will-change: transform` to the animated atmos layers as a stability measure; keep them sized so they stay under the texture cap.
- Keep `@media (prefers-reduced-motion: reduce)` behavior intact.

---

## Thread A — Mobile polish (per file)

### global.css — mobile design tokens + viewport units
- Full-height sections use small/dynamic viewport units: `.chapter { min-height: 100svh }` (with `100dvh` where appropriate) instead of `100vh`. Desktop identical.
- Review mobile floors of `.display`, `.display-sm`, `.metric-number`, `.eyebrow`, `.post-title`, `.post-prose` for a clean small-screen rhythm. Adjust only the mobile/base end; leave clamp upper bounds (desktop) untouched.

### Nav.jsx — mobile menu redesign
- Replace the open mobile menu (bare icons; labels only on `:hover`, impossible on touch) with an Apple-style sheet: full-width rows, **icon + always-visible text label**, ≥44px tap targets, dividers, grouped resume/search/theme.
- Remove the odd `blur-3xl` on the backdrop overlay.
- Desktop nav (`hidden lg:flex`) untouched.

### filmmaking.astro — touch fixes + mobile polish
- **Role tiles**: the film list currently shows only on `:hover` (`.role-tile-hover`), invisible on touch. Under `lg`, show each role's film list visibly by default (e.g. stacked beneath the title); keep hover-reveal only at `lg+`.
- `.film-hero` `100vh` → `svh`. Verify filmography horizontal-scroll, people-card grids, stills grids feel deliberate on a phone.

### projects.astro — touch fixes + mobile polish + Thread B inline styles
- **Flip cards**: the "Click for the case study" hint shows only on hover. Make it persistent on touch screens so the tap-to-flip is discoverable.
- Hero `min-height: 92vh` → `svh`; `.project-screen` `100vh` → `svh`.
- Two-column → stacked spacing, stat-grid, tech pills on mobile.
- Apply Thread B background fix to this file's inline `<style is:global>` atmos blocks.

### index.astro — mobile layout polish
- "The work" rows (`flex-col lg:flex-row`): tidy the mobile stack (number, title, tagline, metric, arrow) so it reads as intentional, not wrapped.
- Hero spacing, CTA button wrapping, eyebrow rhythm on small screens.

### posts.astro + PostLayout.astro — mobile reading polish
- Post grid, featured post, hero spacing on mobile.
- Prose readability on small screens: drop cap, pull-quote (already desktop-only break-out), lede sizing, code blocks not overflowing. Desktop untouched.

---

## Execution model

Sequential subagent-driven development (fresh implementer + spec review + quality review per task), because the work shares `global.css` and page files — parallel implementers would conflict. Order:

1. `global.css` — Thread B backgrounds + viewport units + mobile tokens (foundation).
2. `Nav.jsx` — mobile menu.
3. `index.astro` — mobile layout.
4. `projects.astro` — touch fixes + inline-style backgrounds + mobile.
5. `filmmaking.astro` — role-tile touch fix + mobile.
6. `posts.astro` + `PostLayout.astro` — mobile reading polish.

Then parallel screenshot-verification agents (independent, read-only render) across resolutions/themes/orientations.
