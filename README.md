# sampreethavvari.github.io

The source for **[sampreethavvari.com](https://sampreethavvari.com)**, my personal site.

I'm Sampreeth Avvari. I ship production AI systems at Hybridge Implants and, when the schedule allows, I write and direct independent films. This repo is what runs the public front of all of that.

## What you'll find on the site

| Page | What lives there |
| --- | --- |
| `/` | The narrative home: hero, the work, about, writing, filmmaking, connect |
| `/projects` | Industry deep dives with flip-card case studies, research, and academic projects |
| `/posts` | Long-form write-ups of each production system |
| `/filmmaking` | Festival-catalog page for *Among Monsters* and the rest of the slate |

Every industry project has a click-to-flip image. The front is a screenshot; the back is a four-panel STAR breakdown (problem, solution, process, result). The number panel on the right gives the proof at a glance.

## How it's built

- **Astro** for the static shell and content collections
- **Tailwind** for the design system, with a small custom palette (acc-cyan / acc-violet / acc-emerald / acc-blue / acc-amber) reserved for accents only
- **React island** for the chatbot widget (powered by a small Cloudflare Worker)
- **Markdown** for the writing, with custom prose styles tuned for an Apple-spec article feel
- **Astro Image** for hero screenshots; SVG noise dither overlay to kill 8-bit gradient banding on the near-black backgrounds
- Deployed via GitHub Actions to GitHub Pages

The look is deliberately quiet: black and matte-gray surfaces, one faint coloured glow per section, monospace numbers for stats. No marketing register. No em-dashes.

## Run locally

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:4321`. For a production build:

```bash
npm run build      # outputs to ./dist
npm run preview    # serves the build
```

## Repo layout

```
src/
  pages/         # routed pages (home, projects, posts, filmmaking, …)
    posts/       # markdown write-ups, one per project
  components/    # Astro + React components (Pointer, ChatWidget, …)
  layouts/       # BaseLayout, shared head, theme bootstrap
  data/info.ts   # single source of truth for projects, experience, photos
  styles/        # global.css (design system + components)
public/          # static assets: project screenshots, logos, avatars
```

`src/data/info.ts` is where new projects, experience entries, and skills get added. Everything downstream reads from it.

## Chatbot

The “ask anything about Sampreeth” widget calls a Cloudflare Worker that grounds answers in the site copy. The worker source lives in `chatbot-worker/`. The widget falls back to a stock greeting if `PUBLIC_CHAT_ENDPOINT` isn't set.

## License

Code: MIT. Content (writing, photos, screenplay assets, project screenshots): all rights reserved.
