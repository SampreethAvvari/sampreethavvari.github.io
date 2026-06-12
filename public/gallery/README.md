# /gallery — how to add things

Every folder here is one project section on https://sampreethavvari.github.io/gallery.
The page builds itself from whatever it finds in these folders. No code changes needed.

## Add screenshots
Drop image files (`.png .jpg .jpeg .webp .gif .avif`) into a project folder.

- **Ordering:** files sort alphabetically with numeric awareness. Prefix to control order:
  `01-login.png`, `02-analyze-tab.png`, `10-trends.png`
- **Captions:** generated from the filename. `03-doctor-trends dark.png` → "doctor trends dark".
  The number prefix is stripped automatically. Use dashes or spaces freely.

## Add PDFs (decks, reports, one-pagers)
Drop `.pdf` files into the same project folder. They appear as document cards
under that project's screenshots, with the file size shown.

## Add a whole new project
Create a new folder here, e.g. `public/gallery/my-new-thing/`, and drop files in.
It appears automatically with the title "My New Thing".
For a custom title, blurb, or accent color, add an entry to the `PROJECTS`
array at the top of `src/pages/gallery.astro`.

## Current folders
- `doc-coach/` — Doc Coach (cyan)
- `treatment-estimator/` — Treatment Estimator (emerald)
- `cowork-dashboard/` — Cowork Dashboard (blue)
- `npc-coach/` — NPC Coach (violet)
- `ai-hour/` — AI Hour (amber)
- `cbct-scan-validator/` — CBCT Scan Validator (rose)

Remember: screenshots of internal tools should have PHI scrubbed or blurred
before they land here. This folder deploys to the public internet.
