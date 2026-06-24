---
title: "How I taught the consult grader to write report cards"
date: "2026-06-10"
layout: ../../layouts/PostLayout.astro
description: "We already score every patient consult. Now an AI reads all those scores and writes each doctor a coaching report card, every Monday at 8 AM, with nobody clicking anything. Plus the five bugs I squashed on the way."
img_path: "/doctor-report-cards.png"
img_alt: "Doctor coaching report cards: scored consults in, weekly emailed report out"
tag: "MLOps"
tone: "emerald"
stats:
  - value: "0 clicks"
    label: "weekly + monthly reports send themselves"
    tone: "emerald"
  - value: "411"
    label: "tests passing"
    tone: "blue"
  - value: "5"
    label: "bugs squashed, 1 radar chart sacrificed"
    tone: "amber"
---

Last month I wrote about [the pipeline that grades every patient consult](/posts/clinical-rag): a Zoom call ends, Gemini scores it against the CEO's seven-criterion rubric, and a color-coded report lands in three inboxes within fifteen minutes.

That system has a quiet problem. It produces one report per consult. A doctor who did twelve consults last week got twelve separate emails, and the question that actually matters, *how is this doctor doing, overall, lately?*, was still answered the old way: someone scrolling through a spreadsheet, squinting.

So I built the layer on top. An AI reads all the scorecards we already saved and writes each doctor a **coaching report card**. Then it compares the doctors to each other, nicely.

## What it does

You pick any set of doctors and any date range: last **7**, **14**, or **30** days, or your own. The system reads the stored scorecards. No re-watching videos, no re-reading transcripts; that work was already done at consult time.

For each doctor it writes:

- ✅ strengths
- ⚠️ things to improve
- a short summary across the same **7 skill categories** the per-consult grader uses

Then comes the part a spreadsheet can't do: a comparison across everyone. What the top performers are doing differently. What's worth copying. What isn't. And it closes with **three green "do this" and three red "avoid this" examples**, each one pulled from a real consult, not invented.

## The good part: it runs itself

- **Every Monday at 8 AM** → last week's report.
- **First workday of the month, 8 AM** → last month's report.

Cloud Scheduler fires, the report writes itself, and it lands in the CEO's inbox and mine. Nobody clicks a button. Nobody remembers to run anything.

One small rule that matters more than it looks: a doctor with **zero consults** in the window gets skipped. No empty pages, no "N/A across 7 categories" filler, no spam. The report only contains people there's something to say about.

## Five bugs I squashed on the way

**1. The picky robot.** I reused the strict JSON Schema discipline from the per-consult grader: every response must validate, retry once on failure, then give up. For report cards, my schema was *too* strict. The model failed validation twice in a row and the batch quit with only **20% of the doctors** done. The fix was humbling: I showed the model one worked example of a valid report and loosened the rules that were strictness for strictness's sake. Now it finishes every run. Schema validation is a great servant and a terrible master.

**2. The mystery email.** The first version of the email contained a link. The link opened a wall of raw JSON. Technically the report was "delivered." 🤦 Now the email *is* the report, readable HTML right in the inbox, with a proper PDF attached for anyone who wants to file it.

**3. No clock in the box.** "Every Monday at 8 AM" sounds simple until you ask the server *whose* 8 AM. The slim container image I deployed had **zero timezone data** in it. The moment the code asked for Eastern time, it would have crashed. Added the timezone package to the image. Crisis avoided before anyone got a 3 AM report card.

**4. The ghost upload.** My registry login had quietly expired. The image push *failed silently*, and the deploy yelled "image not found" at an image I was sure I'd just built. Classic. Re-logged in, verified the push actually landed this time, shipped.

**5. The ugly radar chart.** I gave each doctor a radar chart of their 7 categories. It looked bad. I deleted it. Zero regrets. Not every report needs a chart; some reports need fewer charts.

## By the numbers

<div class="post-stats-grid my-8">
  <div class="stat-callout stat-emerald">
    <div class="stat-value">0 clicks</div>
    <div class="stat-label">weekly + monthly reports, fully automatic</div>
  </div>
  <div class="stat-callout stat-blue">
    <div class="stat-value">411</div>
    <div class="stat-label">tests passing</div>
  </div>
  <div class="stat-callout stat-amber">
    <div class="stat-value">3 + 3</div>
    <div class="stat-label">real "do this" and "avoid this" examples per report</div>
  </div>
</div>

| | Before | After |
|---|---|---|
| Per-doctor coaching view | Someone scrolls a spreadsheet | Written report card, per doctor |
| Cross-doctor comparison | Didn't exist | Every report, automatically |
| Effort to produce it | Manual, whenever someone had time | 0 clicks, Monday 8 AM + monthly |
| Doctors with no consults | Empty rows | Skipped entirely |

Same privacy rules as the rest of the stack: no patient information ever lands in our logs.

Here's the part worth noticing. Of the five bugs, exactly **one** was about the AI. The other four were an email, a clock, a login, and a chart. That's been the pattern across everything I've shipped at Hybridge: the model is rarely the hard part. The hard part is the plumbing around it, and the plumbing is where the thing earns the right to run unattended at 8 AM on a Monday with nobody watching.
