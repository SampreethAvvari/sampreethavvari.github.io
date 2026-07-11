---
title: "Teaching an AI to read the whole patient and lean toward a treatment, before the doctor does"
date: "2026-07-10"
layout: ../../layouts/PostLayout.astro
description: "The Centralized Diagnostic Filter is HYBRIDGE's diagnostic operating system. AI reads every input a complex case generates, surfaces the findings, scores future tooth-loss risk, and leans toward a treatment direction, all before the consult. Then the doctor validates every finding. The intake shipped and is live in production, the AI panorex read is real and running under a written ruleset extracted from the founder, and his review of the first outputs has already revised that ruleset once. The validation loop is not a diagram anymore."
img_path: "/cdf-diagnostic-filter.png"
img_alt: "Centralized Diagnostic Filter: CBCT, intraoral scans, photographs, and a risk survey converging into one standardized diagnostic report"
tag: "FDE"
tone: "amber"
stats:
  - value: "AI reads first"
    label: "the panorex read is live: tooth by tooth findings, a destruction score, bone loss, per arch verdicts, before the consult"
    tone: "emerald"
  - value: "0-200"
    label: "future tooth-loss risk score across four bands, kept from the model the practice already trusts"
    tone: "blue"
  - value: "doctors validate"
    label: "Dr. Frank reviewed the first AI reads and his written corrections became ruleset v2. The loop is running, not planned."
    tone: "amber"
---

Most of my projects start from a broken workflow. This one started from a clinician's head, and it is the only one I have built where the point is to have an AI read the patient before the doctor walks in.

Dr. Frank LaMar, who founded the practice, has a way of reading a complex restorative case. He looks at the bone, the wear, the decay pattern, the patient's own words about pain and confidence, and he forms a judgment about whether the natural teeth are a dependable long-term bet or whether the honest conversation is about replacement. The Centralized Diagnostic Filter, CDF, is the attempt to put that first read into software: take every input a case generates, let the AI surface the findings and lean toward a treatment direction, and hand the doctor a finished assessment to confirm or correct, before the consultation even begins.

That last part is the whole philosophy. The CDF is not AI that replaces the dentist, and it is not AI that just reads x-rays. It is a standardized restorative prognosis operating system, and its governing rule is simple: **AI assists, doctors validate.** The AI does the first pass. Every finding it produces is provisional until a doctor signs it.

This was the hardest requirements job I have done. The other systems replaced a spreadsheet or a brittle script. This one had to extract a thirty-year mental model from the person who has it, and shape it into something a computer can carry without flattening the clinical nuance that makes it useful.

## What "reading the patient" actually means

A complex case is not one image. It is a pile of them, plus everything the patient says. The CDF pulls fourteen input classes into one place and analyses each for something specific:

<div class="aside">

- **CBCT scan**, and a panoramic view derived from that same scan, not a separate one: 3D bone, ridge architecture, available bone for implants.
- **Intraoral scans** from the TRIOS scanner: missing teeth, wear, occlusion, supraeruption, crowding, collapse.
- **Clinical photo series** (full-face smile, retracted frontal, occlusal, buccal, profile): aesthetics, recession, support loss, visible deterioration.
- **Bitewings and periapicals**: decay, recurrent decay, restorations, root canals, structural breakdown.
- **Risk survey**: pain, embarrassment, function, urgency, dry mouth, smoking, grinding, medical risk, and treatment goals.

</div>

The AI's job is to look across all of that and surface what a doctor would otherwise reconstruct by hand: where the decay is, which teeth are gone, what is restored, how much bone support is left, and how the upper and lower jaws are each holding up.

## The output the doctor is meant to confirm

The CDF walks into the consult having already done the reading. For every case it produces the same artifact: findings surfaced, risk scored, prognosis classified for each jaw, and a single treatment-direction leaning chosen from a fixed ladder.

| Leaning | What it says |
|---|---|
| Conventional Viable | The natural teeth are a dependable long-term bet |
| Conventional Compromised | Restoration is possible, but the risk factors are real |
| Localized Implant Enhancement | A segment needs implants, the rest can stay |
| Full Arch Consider | Replacement is worth the honest conversation |
| Full Arch Likely | Replacement is the more predictable path |
| Full Arch Highly Appropriate | Replacement is clearly the better long-term bet |

It never states a final diagnosis. It proposes a direction, shows the evidence behind it, and leaves the call to the doctor. That is the difference between a treatment leaning and a treatment decision, and the whole system is built to respect it.

<div class="stat-callout stat-amber">
  <div class="stat-value">the doctor always confirms</div>
  <div class="stat-label">The report suggests a leaning and surfaces the evidence for it. It never delivers a final diagnosis. That boundary is clinical and legal, and it is wired into the architecture, not left to discipline.</div>
</div>

## Phase 1: own the front door first. It shipped.

You do not build the operating system on day one. You build the thing the rest of it plugs into, and you ship it. We did.

When this project started, the patient assessment lived in a third-party intake platform. The HIPAA posture was unverified, one person was the single point of edit, output got screenshotted by hand into OneNote, each patient's Drive folder was populated manually, and there were three duplicate questionnaires for the three markets (Rochester, Buffalo, Syracuse). It worked, but it was fragile and it was not ours.

That is replaced. The HYBRIDGE-owned intake is live in production on Google Cloud: one questionnaire with location-aware routing for all three markets, a premium patient-facing PDF delivered the moment the patient submits, and automatic filing into the patient's Drive folder with no human in the loop. BAA-covered, audit-logged, role-based, deployed through a tagged CI pipeline with a nightly end-to-end smoke test that submits a real assessment and checks that the PDF actually lands.

Two shipping details I care about. The copy on every screen was rewritten with the practice's intake lead, question by question, because she is the one who answers the phone when a patient is confused. And the patient's copy of the report is deliberately a cover plus a one-page summary with **no risk score on it**. The 0 to 200 number frames a clinical conversation; it is for the doctor to deliver in the room, not for a patient to Google alone the night before.

It reads less like a dental form and more like an Apple product. That is deliberate. A premium intake experience is the first thing a patient touches, and it is also the data plane the AI reads from later, so it has to be owned and structured from day one.

## The dashboard where the reports live

Once real submissions started flowing, the practice needed a place to work with them, so Phase 1 grew an internal dashboard. Sign-in is Google OAuth locked to the company domain, sessions fail closed if the secret is missing, and the whole thing runs as its own service next to the questionnaire.

The dashboard is a patient table, and each row opens into the case: the submitted answers, the risk score, and the generated reports streaming in place. It also solves the unglamorous problem that actually blocks automation: matching a submission to the right patient folder in Drive. The system indexes the patient folders, normalizes the names, and ranks match candidates; when it is confident it links automatically, and when it is not, a human picks from the ranked suggestions and the link sticks, with merges de-duplicated so nothing gets filed twice. Every case has a Regenerate button, separate downloads for the doctor and consultation report variants, and a thumbs up or down with comments on each generated report, which is the seed of the feedback loop the AI phase depends on.

## The risk model, kept intact on purpose

The clinical core of the intake is a future-tooth-loss risk score, and one of the firmest decisions was to preserve the model the practice already trusts rather than invent a new one.

It is twelve weighted questions. Smoking, uncontrolled diabetes, dry mouth, and a history of periodontal disease carry the heaviest weights; missing a full arch of teeth, family denture history, grinding and clenching, and self-rated hygiene fill in the rest. The weights sum to a 0 to 200 score across four bands:

| Band | Score | What it frames |
|---|---|---|
| Low risk | 0-25 | Restoration is a viable long-term option |
| Above average | 30-70 | Restoration is possible, but other factors matter |
| High risk | 75-100 | Replacement may be the more predictable path |
| Very high risk | 110-200 | Replacement is likely the better long-term bet |

The score is not a diagnosis. It is a way to frame the restore-versus-replace conversation in a consistent, defensible way. Keeping the existing scale and bands means a patient who took the old questionnaire and the new one will not see a confusing numeric shift. Same clinical meaning, better instrument.

## The full report, in nine sections

Phase 2 is the report Dr. Frank actually sketched: every patient produces the same artifact set, and every doctor reads the same document. Those fourteen inputs land in one visual report organized into nine sections.

- **Executive Summary** answers four questions in plain language: what is happening, how severe, the long-term outlook, and the most reasonable treatment direction.
- **Risk Scoring** carries the 0 to 200 score and a separate read on long-term predictability.
- **Anatomical Mapping** locates the sinuses, mental foramina, ridge architecture, available bone, and implant zones.
- **Bone Support Visualization** is the centerpiece (more on it below).
- **Structural Analysis** outlines missing teeth, restorations, bridgework, implants, root canals, retained roots, and structural collapse.
- **Functional Analysis** grades occlusal wear, guidance, posterior support, parafunction, and occlusal disease from none to severe.
- **Prognosis** classifies the maxilla and mandible separately, because an upper jaw can be poor while the lower is fair, and that distinction changes the plan.
- **Patient Impact** surfaces the emotional and functional drivers from the survey: this is the "why now" that a consultation lives or dies on.
- **Treatment Leaning** picks a direction off the ladder above without ever stating a final diagnosis. The doctor always confirms.

## The centerpiece: bone support, current versus ideal

The innovation at the heart of the CDF is not the AI. It is a way of showing bone.

Standardized Bone Support Visualization Mapping renders a patient's current bone architecture against an ideal reference, so the support discrepancy and ridge atrophy are visible at a glance. A patient who would glaze over at a periodontal chart understands a picture of where their bone is versus where it should be. It also standardizes how doctors read periodontal health and frame long-term predictability. One concept, doing real work for both audiences.

There is a clinical insight underneath it that the system has to respect: not every heavily restored mouth is failing. The design distinguishes a generalized terminal dentition from a stable restorative adaptation, evaluating bone support, decay pattern, maintainability, biological risk, functional stability, and restorative burden rather than just counting fillings. That distinction came straight out of early testing, and getting it wrong would make the system confidently misleading.

## Extracting the ruleset: four cases, read aloud

The AI layer is no longer a plan. Here is how it became real, because the process is the part worth copying.

I asked Dr. Frank to do what he does anyway, on camera: read panorexes for four real cases and narrate every judgment as he made it. Where he starts, what he marks, what makes a tooth hopeless, when a heavily restored mouth is stable and when it is failing. Then I turned those recordings into a written ruleset where every rule carries a citation back to the case and timestamp where he said it, and anything I synthesized across cases is explicitly marked as needing his confirmation rather than passed off as his words.

That document, not a prompt I invented, is what the diagnostic engine implements:

<div class="aside">

- **A fixed reading sequence**, the same one he runs on every film: orient right versus left first, mark current bone levels, then work through the dentition.
- **Tooth by tooth classification** on the standard 1 to 32 numbering, wisdom teeth excluded from the missing count, with each tooth landing in exactly one bucket. A tooth with both decay and a filling counts once, as decayed, because decay outranks the repair.
- **A dental destruction score**, a modified radiographic DMFT, with bands he confirmed: 0 to 12 low, 13 to 16 moderate, 17 to 19 high, 20 and above very high. The score means accumulated disease and restorative history. It does not by itself make anything hopeless.
- **Bone loss estimated the way he does it**: calibrate against the roughly 11 mm crown of a front tooth, account for panoramic magnification, and band the loss from minimal to advanced, with 30 percent as the flag threshold.
- **Two axes, per arch**: dental destruction and periodontal support are scored separately for the upper and lower jaw, and the overall read is the worse of the two. An upper jaw can be failing while the lower is maintainable, and the plan changes on exactly that.
- **Modifiers only raise risk.** Smoking, uncontrolled diabetes, dry mouth, grinding can push the risk up a level. Their absence never pulls a bad radiographic finding back down.
- **Calibrated honesty about the film itself.** A panorex cannot definitively diagnose decay, so the engine grades findings as obvious, suspected, or needing clinical confirmation instead of pretending to certainty the image cannot support.

</div>

The engine runs on Gemini on Vertex AI with structured output, and there is one implementation detail that matters more than the model choice: **the code recomputes every total**. The model lists which teeth are decayed, missing, and filled; arithmetic is done in plain code, because the one consistent failure we caught in testing was the model counting its own lists wrong. The model observes, the code counts.

## The loop closed, which was the whole point

"AI assists, doctors validate" was always the governing rule. In July it stopped being an architecture diagram and happened for real: Dr. Frank sat with the first AI-generated diagnostic reads, reviewed them against his own reading, and sent back written corrections. Those corrections became version 2 of the ruleset, which is what runs in production now. He renamed the score so it could not be mistaken for a formal clinical index, corrected the counts on the calibration cases, pinned the exact band boundaries, and drew a line the engine now respects: a single hopeless tooth does not make an arch hopeless, and an arch is never judged hopeless by percentages alone when only a few teeth remain.

<div class="stat-callout stat-amber">
  <div class="stat-value">ruleset v1 → v2</div>
  <div class="stat-label">The first doctor review pass produced written corrections, and the corrections shipped. This is the validation loop the whole system was designed around, running once, end to end.</div>
</div>

One thing is deliberately still missing. The ruleset covers diagnosis, not treatment selection, so the "which path" block in the report is clearly labelled as pending his calibration rather than filled with a guess. The next recorded session is him explaining how he goes from a risk read to a recommended path. Same extraction method, next layer of the model.

## Three generators, one source of truth

The clinical report is now assembled by three AI generators, and the order matters. The **CDF diagnostic read** runs first, over the panorex and photos pulled from the patient's linked Drive folder. The **holistic risk analysis** consumes that read as its source of truth for the destruction score and bone loss instead of estimating its own, so two pages of the same report can never quietly disagree. And a **psychographic profile** reads the survey answers for the "why now": what the patient is afraid of, what they want back, how they talk about their own mouth. That one renders only in the doctor's variant. From the dashboard, one click regenerates the whole chain and produces the doctor and consultation PDFs.

## Where the model is still weak, measured instead of hidden

Here is the honest part. Gemini reads pathology usefully, but its spatial localization on a panorex is bad: in our testing it puts findings on the wrong tooth number 50 to 70 percent of the time. For a report a doctor validates tooth by tooth, that is not a rounding error, it is the difference between useful and dangerous.

So tooth numbering became its own evaluation track before any more diagnostic capability gets added. Phase 1 of that eval does exactly one thing: detect every present tooth on the film, assign the correct number, and flag missing positions, benchmarked against purpose-built dental detectors rather than a general vision model. Per-tooth condition detection stays out of scope until the numbering is trustworthy, because every downstream finding hangs off the number being right. The research finding so far: a packaged, ready-to-run open model for tooth numbering essentially does not exist, so this is being built as a proper evaluation of the candidates that do.

## Ownership, and what plugs in next

That ownership is a principle, not an afterthought. Data, code, brand, and integrations live under HYBRIDGE accounts with no vendor lock-in, the schema is versioned and auditable from day one so Phase 4 plugs in without re-architecture, and Phase 4 itself is the integration layer: write-back into practice-management software so nobody re-keys data, outcome tracking that validates predictability against real results, multi-office rollout, and a pre-consult patient portal. Every doctor correction collected along the way stays ours, and every signed case strengthens the next read.

## The roadmap, with honest status

Each phase ships independently and delivers visible value without waiting on the ones after it.

| Phase | Scope | Status |
|---|---|---|
| 1: Questionnaire system | HYBRIDGE-owned premium intake, PDF, auto-distribution, internal dashboard | **Shipped, live in production** |
| 2: Diagnostic report (CDF v1) | Doctor + consultation reports, Drive-linked cases, regenerate + feedback | **Generating end to end** |
| 3: AI-assisted findings | Panorex diagnostic read under the doctor's ruleset, validation loop | **Live behind doctor review; tooth-numbering eval underway** |
| 4: Scale and integrations | PMS write-back, outcome tracking, multi-office, patient portal | Planned |

What is actually in place today, with no rounding up: the intake, PDF delivery, and Drive filing run live on Google Cloud for all three markets, deployed by tagged CI with a nightly end-to-end smoke test. The internal dashboard is in daily shape: patient table, Drive folder matching, streamed reports, regenerate, downloads, and per-report feedback. The diagnostic engine produces the full doctor and consultation reports from a real case folder, implementing ruleset v2 that Dr. Frank reviewed and corrected himself. Treatment-path selection is deliberately unbuilt pending his calibration session, and tooth-level localization is in a measured evaluation because the general model's numbering accuracy is not good enough to trust yet. The 0 to 200 risk model is preserved at its existing scale and bands, and it stays separate from the radiographic read until he confirms how the two should combine.

## Why this one is the interesting problem

The engineering here is real, but it is not the hard part. The hard part is the elicitation: sitting with a clinician, pulling the structure out of how he actually reasons, and deciding what a system should standardize versus what it must leave to the doctor. Get that boundary wrong in either direction and you have either a glorified form or a liability. Phasing it is how you de-risk it: own the front door first, prove the intake, then build the report, then let the AI read but never decide. The goal was never to automate the diagnosis. It was to have the AI do the first read so the doctor walks in already holding a consistent, legible, evidence-backed assessment, and still holds the pen.
