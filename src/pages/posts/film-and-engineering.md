---
title: "On making movies, shipping AI, and the work between the two"
date: "2026-05-20"
layout: ../../layouts/PostLayout.astro
description: "Two crafts I keep being told are separate. They aren't. Here's what ten years of writing, directing, and editing short films does to the way I show up to engineering work, and why the engineering work I'm proudest of looks the way it does because of it."
img_path: "/paper.png"
img_alt: "Film set and engineering workspace"
---

I make movies. I write screenplays, I direct, I edit. There's one I'm cutting right now, between work weeks. I'm also an AI Engineer at Hybridge Implants, where most of my time goes into systems that classify CBCT scans, score doctor-patient consultations, automate pricing, replace manual cashflow imports, all built for and used by people who don't code.

People keep treating those two things as separate. They aren't.

What follows isn't an essay about how creative pursuits make you a better engineer in some abstract sense. It's a concrete answer to a question I keep getting from hiring managers and from teammates: what makes you good at the in-the-room part of engineering, the part where you sit with the customer until the system you ship is the system they needed.

The honest answer is that I learned almost all of it on film sets and in edit suites, years before I learned to code.

## Situation

A film set has a producer, a director, an actor, a DP, a sound mixer, a gaffer, a costumer, an art department, and on a good day a craft services table. On a small short, often the same person is two of those things. On a bad day, the same person is four. Every one of them has a different vocabulary, a different idea of what "done" looks like, and a different threshold for when to escalate to the director.

Your job as director is not to know how each department does its job. Your job is to know what the scene needs to feel like when the audience sees it, and to translate that into the eight languages spoken on your set. The art department doesn't care about your emotional arc. They care whether the lamp on the table is from before 1962 because the script is set in 1962. The sound mixer doesn't care about your blocking. He cares whether the room tone will match between this shot and the wide because if it doesn't his foley budget just doubled.

This is the same situation I walk into at Hybridge, and at every engineering job I've had. The senior treatment coordinator who's been quoting full-arch implant cases for ten years doesn't care about my Postgres trigger. She cares that the system gives her the same number Chelsea quoted last month if the patient walks back in. The controller doesn't care about my retry-with-backoff decorator. He cares that the bank CSV he just downloaded actually makes it into the cashflow sheet before his 5pm cutoff.

The shape of the problem in both cases is the same: a bunch of specialists, none of whom is wrong, all of whom care about a sliver of the system, and one person whose job is to make the whole thing add up to a coherent result.

## Task

If you're good at film, what you're good at is translation. You take a screenplay, which is a 90-page document of mostly white space, and you turn it into a set of instructions for sixty people that lasts six weeks. The screenplay alone doesn't tell anyone what they need to know. The screenplay plus the director's vision, plus the production designer's mood board, plus the DP's shot list, plus the AD's call sheet, is what the film actually gets made out of.

The same thing in engineering, when the engineering work matters: a product requirement is half a page. The system you build is forty files. The thing that connects them is a person who can hold both versions in their head at once and translate between them, all day, for months.

The CBCT scan validator I shipped at Hybridge is roughly fifty Python files. The reason it works is that I spent the first four weeks sitting with the validation team mapping out their actual SOP. The thirteen-class artifact taxonomy I encoded into the model came out of that mapping. Nobody on the team would have written the taxonomy down if I'd asked them to. Together, over the course of those four weeks, we drew it out on a whiteboard. The validation lead's hand on the marker. My job: ask the question that surfaced the next class. That's directing, with worse lighting.

The Hybridge pricing engine is the same shape of work. Chelsea, the senior TC, had been pricing cases with a five-model implicit structure (flat / tiered / tiered-zoned / price-range / per-surface) for years. The structure didn't exist in any document. It lived in her head and in a Word file called `Drop Down Pricing NEW.docx`. The job wasn't to invent a pricing engine. The job was to extract the engine that already existed in Chelsea's brain, write it down precisely enough that a Postgres trigger could enforce it, and verify with her that the system priced everything the way she'd been pricing it for a decade.

You don't extract that with a single requirements meeting. You extract it the way you extract a great performance from an actor: small, specific, recurring conversations. Lots of "show me one more time how you'd quote that." Lots of working from the most specific example and generalising backward. Lots of trust.

## Action

A few things I do, that I learned on film sets, that I keep using in engineering.

### Block before you light

The first thing you do on a set when the scene starts is block it: walk the actors through their movements, mark their positions in tape, run it twice. Only then do you bring in lighting and camera. Lighting before blocking is how you spend ninety minutes setting up a shot you have to break down and reset because the actor needs to be sitting, not standing.

In engineering: I'll spend a week with a stakeholder mapping the workflow on paper before I touch a database schema. Every project I'm proudest of has an ADR or a spec written before any code: the [treatment estimator](/posts/treatment-estimator) ADR was nine architectural decisions with tradeoff tables, written and committed before the schema. The [consultation QA pipeline](/posts/clinical-rag) PRD was nineteen sections and eleven acceptance tests, locked before the first FastAPI route went up. The reason is the same as the reason you block before you light: building from a shape you've sketched costs less than building from a shape you haven't.

### Listen to the script supervisor

On a set, the script supervisor is the person who keeps track of continuity: which hand the actor held the coffee in, which way the actor was facing, what time of day the room is supposed to be. The script supervisor has the lowest production-credit hierarchy on the call sheet and the highest practical authority on the day. If she says "your actor turned left in coverage and right in the master," you reshoot the coverage. The film fails without her.

The engineering version: the person who actually does the work every day knows things you don't, and most of them aren't in any documentation. Garrett, our controller, knew that the bank's `AccountTransactionDetail.csv` glob picks up half-downloaded files from previous weeks. I would not have built the y/s/d prompt in the cashflow import [if he hadn't told me](/posts/accounting-automation). Chelsea knew that her pricing book has a $3,000 cap on extractions per arch per option. The cap-clamping code in the pricing engine exists because she walked me through one case where the legacy tool had charged $3,400 and a TC had manually fudged the line. Those are script-supervisor details. You don't get them by asking. You get them by hanging out.

### Cut to the bone

Editing a film is mostly about removing things. The script you wrote, the takes you shot, all of it goes through a meat grinder of "is this earning its place." A 20-minute short usually starts as a 45-minute assembly. The cuts that hurt to make are usually the right ones.

In engineering, I write the same way. The [Cowork Dashboard](/posts/cowork-dashboard) replaced a 2,803-line live-API version with a 1,400-line weekly-Excel version that's strictly more correct. The [treatment estimator](/posts/treatment-estimator) backlog has 30+ deliberately-deferred items, each with a revisit trigger. The [CBCT validator](/posts/cbct-scan-validator) skipped a learned 13-class head and used a deterministic heuristic router because eight of the thirteen classes had a single training sample. None of those were "this is too hard to build" decisions. They were "this isn't earning its place in the cut" decisions.

Less is harder than more. A film student adds. A director cuts. An engineer two years in adds. A staff engineer cuts. Same skill, different medium.

### Show one cut to the right person

When I'm editing, the first person I show a rough cut to isn't another editor. It's somebody from outside the project who's been in my target audience. They watch it, and I watch them watch it. Their face tells me everything: where they're lost, where they're bored, where the joke landed. I don't ask them to give notes. I watch.

In engineering, the same thing: the first demo of a new feature isn't to the engineering team. It's to the person who's going to use it every day. I'd rather watch Chelsea fumble through the tooth chart for thirty seconds in silence than read a stakeholder slack thread about it. I learn the same kind of thing from her hand on the trackpad that I learn from a stranger's face during a rough cut. The system tells me what it actually does, not what I think it does.

### A scene works or it doesn't

Films don't get judged on the elegance of the camerawork. They get judged on whether the scene works. A great scene with one bad cut is still a great scene. A polished sequence of bad scenes is a polished bad film.

The corollary in engineering: I'm relentless about whether the shipped thing actually solved the problem the customer brought. The 0.6309 honest AUROC on the CBCT validator is the version I shipped, not the 0.80 leaky version, because the 0.80 version would have set an expectation we couldn't meet. The 99% patient-to-lead linkage on the dashboard is the version that ships, not the 49% name-join version dressed in nicer UI. The point isn't to look good on a deck. The point is the scene to work.

## Result

Three things that come out of working this way.

**I get hired for the engineering, but I keep getting kept for the way I work.** Engineering jobs are hired on technical bar. The reason I've kept moving toward larger and weirder scopes (medical imaging, finance automation, consultation scoring, all inside a non-tech company that didn't have an in-house ML team before I arrived) is that the customers I work with trust the systems I ship, because they were in the room when the systems were designed. That trust compounds. Year two looks different than year one because the customer is starting projects with me earlier in their thinking.

**The systems I ship survive contact with non-engineers.** Half the time, the version-1 of an internal tool fails because nobody who actually uses it was in the design loop. The Cowork Dashboard's quirks (the deliberate decision to include "Hung up" leads in the Scheduled count but exclude them from the Leads count, the orphan re-treatment patients shown in a Data Quality panel and counted in per-board metrics but not the cohort funnel) are not technical decisions. They're judgement calls that came out of arguments with the front-desk team. The system has stayed in production because it encodes the way the people there actually think.

**I can work alone in scopes that would normally need a team.** A film director on a small short is the writer, the director, the editor, the colourist, the producer's bad cop, the actor's good cop. I went into engineering already used to wearing eight hats on a project. The Hybridge work I'm proudest of (the CBCT validator, the pricing engine, the consultation QA pipeline, the dashboard, the accounting suite) is all single-person work, from spec to production. The reason I can do that isn't that I'm faster than other engineers. It's that I've spent ten years being the person on a set who has to talk to the costumer about the lamp and the actor about the line and the sound mixer about the tone, in the same hour. The context-switching cost is lower because the muscle is older.

---

The version of this essay that an engineering manager wants to read is a list of skills. I keep writing it as a list of moves I make on set that I also make at a keyboard. That's because the move is the thing. The skill is downstream of the move.

If you're reading this and you're hiring for the kind of role that wants engineers who can sit with a customer until the system you ship is the system they needed: this is the work I want. The Hybridge engineering portfolio is what comes out the other end when you treat every project like a small film. A spec written before the schema. A handful of department heads who all need to be heard. A scene that needs to actually work. A cut that gets shorter every week until it's the right length.

I have a film in my hard drive right now that I'm cutting between work weeks. I'll be cutting another one next year. In between, I'll be shipping production systems for the people in the room who don't write code. The two crafts are the same craft. Anyone hiring for one of them is hiring for the other one whether they know it or not.
