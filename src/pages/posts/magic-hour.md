---
title: "AI has the memory of a goldfish with a film degree"
date: "2026-08-17"
layout: ../../layouts/PostLayout.astro
description: "At the GDG Brooklyn hackathon at NYU Tandon we looked at a four hour timer and decided to build an entire AI filmmaking studio. Ask an image model for the same character twice and you get siblings. This is how we made a character stay one person across a whole film, and put the proof on screen as a number."
img_path: "/magic-hour.png"
img_alt: "Five identical storyboard frames of one character, every one of them drawn from a single locked reference card"
tag: "AIE"
tone: "film"
stats:
  - value: "4 hour timer"
    label: "one FastAPI service, five surfaces, 105 commits, four people who had never shipped together"
    tone: "film"
  - value: "2 referees, on screen"
    label: "every generated frame carries a face match score, every generated line a voice match score, both visible to the room"
    tone: "violet"
  - value: "0.48"
    label: "the cosine between two different people's reference sheets, the number that proved whole frame embeddings cannot referee identity"
    tone: "amber"
---

"You need discipline in life. If not discipline, motivation. If not motivation, at least be audacious."

I said that out loud on a Saturday morning and three people unfortunately believed me.

So at the Google Developer Group Brooklyn hackathon at NYU Tandon, we looked at the four hour timer and decided to build an entire AI filmmaking studio. Not a demo of one feature. The studio. Hyperfocus kicked in, the first commit landed at 11:06, and the four of us pushed 105 commits into one repo before the day was out.

This is what we built, why the hard part was not the pictures, and what I would keep.

## Why I wanted this specifically

I have directed, written, or cut seven films. The part nobody outside a set believes is hard is pre-production, because on paper it is just planning. In practice it is the whole movie. You decide who this person is, what she looks like, how she talks, what she knows and when she learned it, and then you hold that one version of her steady across 60 pages, 40 shots, and 12 people who each read the script slightly differently.

On a real set, continuity is somebody's actual full time job. That person is not being fussy. They are the reason the movie holds together.

So the tool I wanted was never a picture generator. It was a continuity department.

## The problem, stated plainly

AI has the memory of a goldfish with a film degree.

Ask an image model for the same character twice and you get siblings. By scene 18 your heroine has a new face and a new backstory. The models are genuinely brilliant at moments and genuinely terrible at movies, and the gap between those two things is the entire product opportunity.

Dialogue drifts the same way and it is worse, because it is harder to see. Scene 3 sounds like her. Scene 18 sounds like a competent screenwriter doing an impression of her. No single line is wrong. The drift sits under the resolution of any one check.

Here is the diagnosis the spike gave us, and everything else follows from it.

<blockquote class="pull-quote">
Drift is not caused by bad models. It is caused by re-deriving.
</blockquote>

Every time you build a prompt by summarising your character afresh, you get a slightly different summary. Nothing is broken at any step. Each summary is defensible. But you are compounding a small rewrite 40 times, and by shot 40 you are conditioning on a description nobody ever approved.

So the rule for the whole system: compile identity once, store it, inject it word for word, and recompile only when the canon itself changes.

## Magic Hour, five surfaces

| Surface | What it does | What it really is |
|---|---|---|
| **Cast** | A 100 question interview that turns a name into someone who can speak | Context engineering |
| **Board** | Storyboards, shot by shot, with faces that stay the same | Multimodal generation, embeddings, and a judge |
| **Screenwriter** | A writing partner that knows your story and your voice | Agentic AI over a knowledge graph |
| **Bible** | The knowledge layer everything else reads from | Retrieval, hybrid and logged |
| **Scout** | Real locations for a scene, pinned to scene numbers | Agentic tool use |

They are not five apps. They are five windows onto one story bible, which is the only reason nothing drifts between them.

## Cast: compile the person once

The interview is 100 questions, in seven parts, of which 12 are flagged as core. Answer the 12 and the character becomes usable. Answer fewer and the system refuses to write dialogue for them rather than inventing a person, which is a refusal I am proud of.

Those answers compile into two frozen cards.

The **Identity Card** is the visual one: a fixed descriptor, the wardrobe, and a `negative` field for what this character must never look like. From it we generate exactly one reference sheet, front, three quarter, and profile, neutral grey, flat light. Every shot after that is conditioned on that sheet image plus that card text.

The **Voice Card** is structured rather than a vibe summary. It carries the register, the phrases they actually use, sample lines, and a `never_says` list. That last field earns more than everything else in the card put together. Telling a model what a character would never say constrains it far harder than telling it what they might.

<div class="aside">
<strong>Why "word for word" is doing so much work.</strong> The temptation at every step is to compress. The card is long, the prompt is getting big, so you summarise it just this once. That single act is the bug. The moment any part of the pipeline paraphrases the card, you are re-deriving again, only less often, and the drift comes back slower and harder to catch.
</div>

## Board: shot 6 provably matches shot 1

Every frame is conditioned on the locked reference sheet. Then the generated face is cropped out, embedded, and cosine scored against the fingerprint taken from that same sheet. The score is a badge on the frame. Regenerate a shot and you watch the number move.

The cropping is not an optimization. It is the whole referee, and we only know that because the spike measured it at 13:07 that day:

| Comparison | Score |
|---|---|
| Maya's sheet vs Maya's three shots | 0.39, 0.39, 0.51 |
| Ravi's sheet vs Maya's three shots (control) | 0.20, 0.28, 0.31 |
| Maya's sheet vs Ravi's sheet | **0.48** |

Read that last row again. Two reference sheets of two completely different people scored 0.48, higher than two genuine matches of the same person. Not because the model is broken, but because `multimodalembedding@001` encodes the whole image, and both sheets are grey three view character sheets under flat light. Composition swamped identity.

A whole frame referee would have passed everything, looked authoritative on screen, and been worse than having no referee at all. Crop to the face and the composition signal disappears.

The same spike caught a second failure: style drifts even when identity holds. Our first shot came back as a digital painting from a photoreal sheet, because the prompt said "storyboard frame" and nothing pinned the medium. So the medium got pinned into three preset strings, and every shot in a board uses one of them, character for character.

The voice referee has the same shape, and its threshold is where I nearly fooled myself. The obvious way to calibrate is to score each sample line against the centroid and set the bar below the worst one. That reads as rigorous and it is nonsense, because each sample is part of the centroid it is being scored against. It inflated to 0.77, which would have rejected almost every real line the product makes. So we measured generated lines instead:

| Measurement | Score |
|---|---|
| Generated Maya lines vs Maya's fingerprint | 0.715, 0.827, 0.806 |
| Generated Ravi lines vs Ravi's fingerprint | 0.682, 0.647, 0.684 |
| Best cross character score | 0.613 |

0.62 sits in the gap between the best impostor and the worst genuine line, so 0.62 is the bar. And a score that could not be computed reads "no score" rather than quietly passing, because a referee that silently approves everything is the most expensive kind of theater.

## Screenwriter: the twist that got spoiled on line three

One subagent per character, each holding its own Voice Card, plus a director agent planning the beats.

We learned the next part the hard way. A character read the shared scene notes and spoiled a twist on line three. Not dramatically. She simply knew something she had not been told yet, said it in passing, and the scene died on the spot with no error raised anywhere.

So every character carries a knowledge horizon: what they know as of scene N, passed into their subagent as a hard boundary. In our seeded story, a depot dispatcher named Maya learns in scene 1 that the night route is being cut. Ravi, who has driven that route for 22 years, does not find out until scene 3. Scene 3 is entirely about what she does not say.

The facts live on a story graph with typed edges, and one edge kind, `implies`, carries the weight. Learning the route is cut implies the depot is losing a shift, which implies somebody is being moved. A character who learns the first fact can reason to the third. A character who has learned none of them cannot refer to any of it. One recursive closure gets that right for every fact at once, instead of asking whoever writes the story to enumerate it by hand.

The same graph answers what the audience knows that a character does not, which is the definition of dramatic irony, and what two people have on each other if you put them in a room. That is a story tool, and it fell out of a data structure we needed for correctness anyway.

## Bible: one assembler, and it tells you what it sent

Retrieval is hybrid: dense vectors and lexical matching, fused by reciprocal rank. Pure vector search fails on exactly the things screenplays are made of. A slugline and "the motel" are the same place and are not neighbours in embedding space, and character names demand exact matching.

The rule I care about more is that **one function assembles context for every model call in the product**, with fixed slots, fixed budgets, and a report of what it did. Every dialogue line and every storyboard frame rides in with the story's style, the scene spine, and the character cards pulled from this one shared source, so nothing gets invented twice.

That report renders as a Context tab in the UI. It is the difference between diagnosing a bad line in five seconds and in twenty minutes, and it cost about forty lines to build.

## Scout: real corners, not vibes

Describe a mood and it reasons over Google Maps and comes back with actual Brooklyn corners, real photos, real coordinates, street view links, pinned to a scene number. Like a friend who knows a guy.

The unglamorous detail that made it usable on stage: Places photo URLs expire, so every photo gets cached to disk the moment it arrives. A demo that needs a live fetch is a demo that fails in front of people.

## 13:20, and the list of things we cancelled

By 13:20 we had a design spec I was proud of and about 100 minutes left on the clock. The spec called for Cloud SQL with pgvector, Terraform, CI/CD, Workload Identity, a Next.js rewrite, a migration to Google's Agent Development Kit, an MCP server, and a split into two Cloud Run services. All correct engineering for a project with a future. All worthless inside 100 minutes.

So I wrote a file called `NOW.md` that opened with "Cancelled. Do not start any of these today", and it overrode the spec for the rest of the day.

| Cancelled | Replaced by |
|---|---|
| Cloud SQL and pgvector | numpy, over about 50 chunks, in memory |
| Terraform, CI/CD, Workload Identity | one deploy script that smoke tests the new revision |
| Login and sessions | Google Sign In, no session store |
| Next.js rewrite, ADK migration, MCP server | the one FastAPI process we already had |
| Two Cloud Run services | one, pinned to a warm instance |

Cloud SQL alone is eight minutes of provisioning before the first debugging round trip. An exhaustive scan of 50 vectors in numpy is faster than any index lookup at that size, so using numpy as the vector database was not even a compromise. What survived the cut was hybrid retrieval, because that one is load bearing.

The other rule in that file: no test driven development, for one day only. Write the feature, run it once, confirm the app still boots, push. The real verification was localhost, and clicking the thing.

## Four people, one repo, no merge hell

105 commits in a single day stayed survivable because of rules that cost nothing to follow and would have cost us the demo to skip.

Routers are auto discovered, so nobody ever edits `main.py`. Each person owns exactly one file in that package. Shared modules are off limits without saying so in chat first, because two people adding a line to the same file is a conflict for no reason. `main.py` mounts the whole API inside a try and except, so a half written tab cannot stop the app from booting. A router returning `{"ready": false}` is a completely acceptable state: it means everybody else is unblocked. And push every 10 to 15 minutes, rebasing first. Not every finished feature. Every working change.

<div class="aside aside-amber">
<strong>A half finished tab behind a disabled button is worth more than a perfect tab that never merges.</strong> Five branches merging at once in the last ten minutes is how a hackathon actually dies. Not the code. The integration.
</div>

The split: **Sahaj Mekala** took the board and authentication, **Kyangchat Kapio** took the character interview, **Gaurav Poddar** took location scouting, and I took the knowledge layer, the screenwriter, and the front and back ends around them. The contract between us was one line: the interview emits a flat dictionary of question to answer, and that dictionary is the only input both card compilers need. One person's tab unblocked everyone else's, and nothing else was coupled.

I built my side with Claude Code in VS Code the whole way, which is the only reason one person could hold four surfaces at that speed.

## What actually went wrong

Every one of these cost real minutes, and all of them are written into the repo now so nobody rediscovers them:

- **Every Vertex call returning 429.** Application default credentials with no quota project bill against a starvation tier bucket, and it looks exactly like a broken app. One `gcloud auth application-default set-quota-project` fixed everything at once.
- **`gemini-flash-latest` returning 404.** It is an AI Studio alias and does not exist on Vertex. Use the pinned version names.
- **The client dying mid flight.** Constructing a fresh Vertex client per call gets it garbage collected, and the next request fails with "the client has been closed". Cache the client.
- **CRLF line endings blocking every deploy**, on Windows, silently, until a `.gitattributes` forced LF on the shell scripts.
- **Location search returning nothing**, because one extra filter field was invalidating the whole query instead of narrowing it.
- **30 seconds per generated frame**, on a lab project shared with every other team in the room. So every generated image gets cached to disk and committed, and live generation on stage is a bonus that is allowed to fail, never the demo.

That last one is the lesson I would carry into a demo of anything. The version of your product that runs with the network unplugged is the version you are actually presenting.

## The stack, and the honest scorecard

Gemini 2.5 Pro and Flash, Nano Banana for images, multimodal and text embeddings, all on Vertex AI. One FastAPI service on Cloud Run. numpy as the vector database. Four hours.

Not recommended. Would do again immediately.

The repo is public. The deployed app is not, because the lab project expired the same evening it was created, which was known going in and is why nothing irreplaceable ever went into it. A real demo is coming.

What survives is the idea, and it holds well outside a hackathon. Every AI product that has to stay coherent across a long piece of work has this problem, not only the ones making movies. Support agents drift. Long documents drift. Anything that rebuilds its context from scratch on every call is drifting quietly, and if you are not measuring it you will hear about it from a user instead.

Compile the identity once. Store it. Inject it exactly as written. Measure every output against what you stored, and put the number where somebody can see it.

Code: [SampreethAvvari/previz](https://github.com/SampreethAvvari/previz). The architecture spec and `docs/NOW.md` are both in there, and `NOW.md` is the more honest of the two.

If you make films, or you make tools for people who do, come find me.
