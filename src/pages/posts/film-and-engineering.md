---
title: "How making movies made me a better engineer"
date: "2026-05-20"
layout: ../../layouts/PostLayout.astro
description: "People keep telling me films and engineering are separate. They're not. Here's what ten years of making movies did to the way I build."
img_path: "/film-and-engineering.png"
img_alt: "Film clapperboard and laptop, same craft"
tag: "Personal"
tone: "film"
stats:
  - value: "7 films"
    label: "directed, written, edited, or scored"
    tone: "amber"
  - value: "10 yrs"
    label: "from first short to Among Monsters"
    tone: "rose"
  - value: "8 hats"
    label: "I've worn on a small short"
    tone: "violet"
---

I make movies. I write screenplays, direct, edit, occasionally compose music. I also build production AI systems at a dental implant company. People keep treating those two as separate. They aren't.

<blockquote class="pull-quote">
The customer is the cast. The system is the scene. The job is to make the scene work for them.
</blockquote>

Here's the credit list, so we're talking about specifics:

| Year | Project | Role |
|---|---|---|
| 2026 | **Among Monsters** ([IMDb](https://www.imdb.com/title/tt39700295/)) | Director / Writer / Editor / Color / Music |
| upcoming | Extraordinary Lives | Director / Writer |
| upcoming | Pupa | Writer |
| 2025 | Solistice | Editor |
| 2024 | Swecha | Editor |
| 2022 | Tiger Man | Director / Writer / Editor |
| 2019 | Strangers | Cinematographer / Music |

I'm cutting *Among Monsters* between work weeks right now.

## A film set looks like an engineering room

A small short has a director, a writer, a DP, a sound mixer, a gaffer, a costumer, an art department, an editor. Each one speaks a different vocabulary. Each one defines "done" differently. Your job as director is not to know how each department does its job. Your job is to translate the scene you're trying to make into the eight languages on your set.

This is the same situation I walk into at work. The senior treatment coordinator who's quoted full-arch implant cases for ten years doesn't care about my Postgres trigger. She cares whether the system gives her the same number she quoted last month. The controller doesn't care about my retry-with-backoff decorator. He cares whether the bank CSV makes it into the cashflow sheet before his 5pm cutoff.

Specialists. None of them wrong. One person whose job is to make it add up.

## Things I do at a keyboard that I learned on set

<div class="aside aside-amber">

**Block before you light.** On set, you walk the actors through the scene before anyone touches a lamp. In code, I write the ADR before I touch the schema. Every project I'm proud of has a spec written first. Building from a shape you've sketched costs less than building from a shape you haven't.

</div>

<div class="aside">

**Listen to the script supervisor.** The script supervisor has the lowest credit on the call sheet and the highest practical authority on the day. The engineering equivalent is the person who does the actual work every day. Garrett knew the bank CSV glob picks up half-downloaded files. I would not have built the y/s/d prompt in the cashflow import if he hadn't told me.

</div>

<div class="aside aside-emerald">

**Cut to the bone.** Editing a film is mostly about removing. A 20-minute short usually starts as a 45-minute assembly. The cuts that hurt to make are usually the right ones. The same with code. The dashboard rebuild replaced 2,803 lines of live-API code with 1,400 lines of weekly-Excel code that's strictly more correct. Less is harder than more.

</div>

<div class="aside aside-amber">

**Show one cut to the right person.** The first person I show a rough cut to isn't another editor. It's somebody from the target audience. I don't ask for notes. I watch them watch it. Same thing in code: the first demo of a new feature isn't to the engineering team. It's to the person who's going to use it every day. I'd rather watch Chelsea fumble through the tooth chart for thirty seconds in silence than read a stakeholder Slack thread about it.

</div>

<div class="aside">

**A scene works or it doesn't.** Films don't get judged on the elegance of the camerawork. They get judged on whether the scene works. A great scene with one bad cut is still a great scene. A polished sequence of bad scenes is a polished bad film. I'm relentless about whether the shipped thing actually solved the problem the customer brought.

</div>

## What this does to the engineering portfolio

Three things, all downstream of the same instinct:

> The customer is the cast. The system is the scene. The job is to make the scene work for them.

**The systems I ship survive contact with non-engineers.** Consider the quirks in the dashboard, the estimator, the consultation pipeline: the deliberate inclusion of "Hung up" leads in the Scheduled count, the orphan re-treatment patients shown in a Data Quality panel but still counted in CA, the three-affordance wizard orientation. None of those are technical decisions. They're judgement calls from arguments with the people who'd be using the thing.

**I can work alone in scopes that would normally need a team.** A director on a small short is the writer, the editor, the colourist, the producer's bad cop, the actor's good cop. I went into engineering already used to wearing eight hats on a project. The single-person Hybridge work (CBCT validator + estimator + consultation pipeline + dashboard + accounting suite) wouldn't have been possible without that muscle.

**The post-mortem is part of the work.** Every film I've made gets re-watched a year later with a list of "what didn't work and why." Every system I've shipped has a `BACKLOG.md` of consciously-deferred items with revisit triggers. Same instinct: name the loose ends out loud, then come back when the moment is right.

## The version a hiring manager wants

If you're hiring an engineer who can sit with a customer until the system you ship is the system they needed, that's the work I want. The Hybridge portfolio is what comes out the other end when you treat every project like a small film. A spec written before the schema. A handful of department heads who all need to be heard. A scene that needs to actually work. A cut that gets shorter every week until it's the right length.

Two crafts, same muscle.
