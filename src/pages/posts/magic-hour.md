---
title: "AI has the memory of a goldfish with a film degree"
date: "2026-08-17"
layout: ../../layouts/PostLayout.astro
description: "At a GDG Brooklyn hackathon at NYU Tandon, four of us built an AI filmmaking studio in four hours. The hard part was keeping one character the same person across a whole film."
img_path: "/magic-hour.png"
img_alt: "Five identical storyboard frames of one character, every one of them drawn from a single locked reference card"
tag: "AIE"
tone: "film"
architecture: "magic-hour"
stats:
  - value: "4 hour timer"
    label: "one FastAPI service, four people, first commit at 11:06, hard deadline at 15:30"
    tone: "film"
  - value: "2 referees, on screen"
    label: "every generated frame carries a face match score, every generated line a voice match score, both visible to the room"
    tone: "violet"
  - value: "0.48"
    label: "the cosine between two different people's reference sheets, the number that proved whole frame embeddings cannot referee identity"
    tone: "amber"
facts:
  - label: "Problem"
    value: "Image models redraw the same character with a new face by scene 18, and the dialogue drifts too."
  - label: "What I built"
    value: "A four person hackathon build: an AI filmmaking studio that locks each character's identity and scores every frame."
  - label: "Outcome"
    value: "Every frame carries a face match score and every line a voice match score, visible to the room."
  - label: "Runs on"
    value: "One FastAPI service on Cloud Run with Gemini 2.5, Nano Banana and Vertex embeddings."
  - label: "Built"
    value: "Four hours at a GDG Brooklyn hackathon at NYU Tandon: first commit 11:06, deadline 15:30."
  - label: "Status"
    value: "Demo day build from July 25, 2026, not running now."
---

"You need discipline in life. If not discipline, motivation. If not motivation, at least be audacious."

I said that out loud on a Saturday morning and three people unfortunately believed me. So at the Google Developer Group Brooklyn hackathon at NYU Tandon, we looked at the four hour timer and decided to build an entire AI filmmaking studio. The first commit landed at 11:06. The deadline was 15:30.

## Why I wanted this specifically

I have directed, written, or cut seven films. On a real set, continuity is somebody's full time job. The tool I wanted was a continuity department.

## The problem, stated plainly

AI has the memory of a goldfish with a film degree.

Ask an image model for the same character twice and you get siblings. By scene 18 your lead has a new face, and the dialogue drifts too.

<blockquote class="pull-quote">
Drift is caused by re-deriving.
</blockquote>

Summarize a character afresh for every prompt and you end up conditioning on a description nobody approved. So the rule: compile identity once, store it, inject it word for word. A 100 question interview compiles each character into a frozen Identity Card and Voice Card, and with fewer than 12 core answers the system refuses to write that character.

## Board: shot 6 provably matches shot 1

Every frame is conditioned on one locked reference sheet. Then the face is cropped, embedded and scored against that sheet, and the score sits on the frame.

The crop is the whole referee, and a spike at 13:07 proved it. Maya's sheet against Maya's three shots scored 0.39, 0.39 and 0.51. Against Ravi's sheet, a different person, it scored <span class="egg" tabindex="0" data-egg="Higher than two of the three real matches. Composition is a very confident liar.">0.48</span>, because both were grey three view sheets under flat light. A whole frame referee would have passed everything, looked authoritative on screen, and been worse than no referee at all.

The voice bar sits at 0.62, between the best impostor line at 0.613 and real lines at 0.647 and up. A score that cannot be computed reads "no score", because a referee that silently approves everything is the most expensive kind of theater.

## Screenwriter: the twist that got spoiled on line three

Each character speaks through its own subagent. In the first run one read the shared scene brief and spoiled a twist on line three. The model did nothing wrong. The context did.

So every character carries a knowledge horizon on a story graph, and one edge kind, `implies`, does the work. Learning the route is cut implies the depot is losing a shift, which implies somebody is being moved.

## 13:20, and the list of things we cancelled

By 13:20 we had a design spec I was proud of and about 100 minutes left. It called for Cloud SQL, Terraform, CI/CD and an MCP server. All correct engineering for a project with a future. All worthless inside 100 minutes.

So I wrote `NOW.md`, which opened with "Cancelled. Do not start any of these today." Retrieval became a cosine scan over about 50 chunks in <span class="egg" tabindex="0" data-egg="At 50 chunks a full scan beats any index. The vector database was a for loop with good posture.">numpy</span>, fused with lexical matching for names.

## Four people, one repo, no merge hell

Each person owns one file and everyone pushes every 10 to 15 minutes. A half finished tab behind a disabled button is worth more than a perfect tab that never merges.

**Sahaj Mekala** took the board and authentication, **Kyangchat Kapio** the character interview, **Gaurav Poddar** location scouting, and I took the knowledge layer, the screenwriter, and the front and back ends around them.

## The stack, and the honest scorecard

Gemini 2.5 Pro and Flash, Nano Banana for images and Vertex embeddings, behind one FastAPI service on Cloud Run. You can follow one shot request through it in [the drawing](/architecture/magic-hour). A frame took about 30 seconds on a project shared with every team in the room, so every image was cached and committed. The version of your product that runs with the network unplugged is the version you are actually presenting.

Not recommended. Would do again immediately.

Compile the identity once. Store it. Inject it exactly as written. Measure every output against what you stored, and put the number where somebody can see it.

Code: [SampreethAvvari/previz](https://github.com/SampreethAvvari/previz). Start with `docs/NOW.md`.

If you make films, or you make tools for people who do, come find me.
