---
title: "Two Hybridge websites rebuilt in a day, both previewing on Cloud Run"
date: "2026-10-29"
layout: ../../layouts/PostLayout.astro
description: "The patient site and the lab site, rebuilt in the premium lab look by parallel page agents with a marketing review, checked at 1440 and 390 and previewing on Cloud Run."
img_path: "/hybridge-websites.png"
architecture: "hybridge-website"
img_alt: "The rebuilt Hybridge patient and lab websites"
tag: "Architecture"
tone: "blue"
stats:
  - value: "20 minutes"
    label: "from the first commit on the patient site to its first preview on Cloud Run, Oct 28"
    tone: "emerald"
  - value: "7.0 screens"
    label: "of scroll on the patient home page at 1440 after the marketing review, down from 13.7"
    tone: "blue"
  - value: "73 pages"
    label: "crawled from the live lab site with 118 images, the source of the new site's facts"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Hybridge's patient and lab websites needed rebuilding with better modern taste, more colour and better UX."
  - label: "What I built"
    value: "Two Astro sites: one for patients weighing full arch implants, one for dentists who send our lab cases."
  - label: "Outcome"
    value: "The patient home page went from 13.7 screens of scroll at 1440 to 7.0 after a marketing review."
  - label: "Runs on"
    value: "Two prerendered Cloud Run services that scale to zero, in the website's own Google Cloud project."
  - label: "Built"
    value: "20 minutes from the first commit to the patient site's first preview on Cloud Run, October 28, 2026."
  - label: "Status"
    value: "Previews on Cloud Run, not yet on their public domains; every page carries noindex."
---

## The problem

Hybridge has two public websites. The patient site is where someone weighing full arch implants, at an average of $18K to $22K an arch, first meets the practice. The lab site is for the dentists who send our lab their cases. In our design doc's words, Hybridge is "a mobile first company."

The ask on October 28 was to recreate the patient site "with better modern taste," more colour and better UX, then the lab site. My first lab landing put the hero on a dark navy stage. The team's verdict came back that night: "not a big fan of the dark blue." Looking at it again, I found it wordy too.

What stayed was the next version of the lab home: porcelain whites, titanium greys, one cyan scan light used like a laser line, studio renders and very few words. The design doc calls it engineered to the micron, and both sites follow it now.

## What I built

Two Astro sites on the Hybridge design system, each its own Cloud Run service in the website's own Google Cloud project. Every page is prerendered at build time. Both open with the H loader, where the Hybridge H builds itself (posts rise, the bridge sets, a smile line draws), and play a frosted glass veil between pages.

The patient site has a 3D full arch to turn on the home page, twelve patient stories that play in place from our own copies, and a referral form that saves a PDF on the dentist's device. The lab site opens on an exploded full arch that assembles as you scroll while a cyan scan line turns the CAD wireframe into the real render.

[Open the drawing](/architecture/hybridge-website) for the patient site, or [the lab site's drawing](/architecture/hybridge-lab).

## The sprint

Times are New York time, from git and the Cloud Run revision list.

- **Oct 28, 5:28 PM.** First commit on the patient site: the whole site and its docs.
- **5:48 PM.** First revision on Cloud Run, in the website's own project.
- **6:37 PM.** A landing page for every tab.
- **9:45 PM.** The lab site's foundation, with a crawl of the live lab site: 73 pages and 118 images as the source of facts.
- **Oct 29, 1:31 AM.** The lab site rebuilt in the new style. Live at 1:34 AM.
- **4:27 AM.** Touch parity on the lab site, so every hover interaction works by tap.
- **5:02 AM.** The patient site's premium round, every page rebuilt to the lab's standard.
- **Afternoon.** I noticed the lab hero's arch was an <span class="egg" tabindex="0" data-egg="The fix was a script. tools/hero-flip.py turned the layers upside down, made the implants 14% smaller and gave the framework a rounder curve.">upper arch stacked like a lower one</span>. The flip was committed at 2:30 PM and live at 2:32 PM.

Both repos deploy by hand from a clean, pushed main branch.

## The hard parts

**Many builders, one rulebook.** Both sites were built by parallel agent sessions, one per area (eight areas on the patient site, seven on the lab site), with one session owning the shared styles, layout and scripts. Each repo has a rules file every builder reads first. Then an agent played head of marketing: it measured each page at 1440 and 390, wrote the cuts and checked again after round two. The patient home page went from 13.7 screens of scroll at 1440 to 7.0.

**Phone fixes leave desktop alone.** Phone fixes live only inside a max width of 759 pixels. Each changed page is captured at 1440 before and after a phone fix and compared pixel by pixel, and the diff has to print <span class="egg" tabindex="0" data-egg="tools/deskdiff.py counts a pixel as moved when it shifts by more than 24 grey levels. IDENTICAL means it found none.">IDENTICAL</span>. Touch parity works the same way: every hover style sits behind a fine pointer media query, and whatever hover shows also opens with one tap.

**A 3D arch that loads only near view.** The patient home page ships a still photo of the arch and a tiny script. three.js loads when the card comes within 600 pixels of view and the browser can do WebGL, and frames render only while something moves.

```ts
// src/components/home/ArchViewer.astro
if (!webgl() || (needsGzip && typeof DecompressionStream === 'undefined')) { el.dataset.state = 'still'; return; }
el.dataset.state = 'loading';
import('./arch-viewer.js')
  .then((m) => m.mount(el))
  .catch((err) => { console.warn('3D arch unavailable', err); el.dataset.state = 'still'; });
}, { rootMargin: '600px 0px' });
```

## What I said no to

**Dark navy blocks.** After the dark blue verdict, neither site has a large dark block. On the lab site, night survives as a small accent on the Submit a case pill. On the patient site, the pages for referring dentists went light as well.

**Generated people.** Nano banana renders are for products, materials and the arch, each keyed to real transparency. Patients, doctors, the offices and the lab stay real photos.

**Working around a locked video host.** The patient stories sit on a video host locked to Hybridge's domain and account. I left the lock alone and used Hybridge's own published copies from its YouTube channel: twelve stories at 720p, self hosted, playing in place.

## Where it landed

Both sites are previews on Cloud Run and are not on their public domains yet. Every page carries noindex, and the forms show what they would send and send nothing. They exist for the team to review. I have no visitor numbers.

Cost is not measured. The billing export for the website's project only switched on October 28, 2026, so there is no measured month yet. Both services scale to zero.

Before either replaces a live site: wire the forms to real intake, move the lab's legal texts over, redirect the remaining live addresses (the lab site already redirects 21), then lift noindex and point the domains.

What I would keep: write the rules file before the first page, and read each page at 1440 and 390 before anyone else does.
