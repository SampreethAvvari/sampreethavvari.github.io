---
title: "Teaching an AI to read the whole patient and lean toward a treatment, before the doctor does"
date: "2026-06-20"
layout: ../../layouts/PostLayout.astro
description: "The Centralized Diagnostic Filter is HYBRIDGE's diagnostic operating system. AI reads every input a complex case generates (CBCT, intraoral scans, clinical photos, radiographs, a risk survey), surfaces the findings, scores future tooth-loss risk, and leans toward a treatment direction, all before the consult. Then the doctor validates every finding. This is the forward-deployed problem at its hardest: turning a veteran clinician's mental model into a buildable, phased system. Phase 1 is in build."
img_path: "/cdf-diagnostic-filter.png"
img_alt: "Centralized Diagnostic Filter: CBCT, intraoral scans, photographs, and a risk survey converging into one standardized diagnostic report"
tag: "FDE"
tone: "amber"
stats:
  - value: "AI reads first"
    label: "decay, missing teeth, bone levels, prognosis, then a treatment leaning, before the consult"
    tone: "emerald"
  - value: "0-200"
    label: "future tooth-loss risk score across four bands, kept from the model the practice already trusts"
    tone: "blue"
  - value: "doctors validate"
    label: "every AI finding stays provisional until a doctor signs it, wired into the architecture"
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

## Phase 1: own the front door first

You do not build the operating system on day one. You build the thing the rest of it plugs into, and you ship it.

Today the patient assessment lives in a third-party intake platform. The HIPAA posture is unverified, one person is the single point of edit, output gets screenshotted by hand into OneNote, each patient's Drive folder is populated manually, and there are three duplicate questionnaires for the three markets (Rochester, Buffalo, Syracuse). It works, but it is fragile and it is not ours.

Phase 1 replaces all of that with a HYBRIDGE-owned intake on Google Cloud: one questionnaire with location-aware routing for all three markets, a premium patient-facing PDF delivered the moment the patient submits, automatic filing into the patient's Drive folder with no human in the loop, and self-serve admin so the practice's intake lead can edit questions, manage recipients per office, and add team members without filing a ticket. BAA-covered, audit-logged, role-based from the first commit.

It reads less like a dental form and more like an Apple product. That is deliberate. A premium intake experience is the first thing a patient touches, and it is also the data plane the AI reads from later, so it has to be owned and structured from day one.

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

## The AI layer, and where it is allowed to act

Phase 3 is the part that makes the heading literal: the AI does the reading. Decay, missing teeth, restorations, and root-canal identification on 2D radiographs, plus the bone-level mapping that feeds the visualization. It assembles all of that into the draft assessment before anyone sits down with the patient.

But every AI output lands in a doctor validation queue and stays provisional until a doctor signs it. Those corrections are not discarded. They feed a continuous-learning loop on HYBRIDGE's own validated cases, so every signed case strengthens the next prediction. The AI reads first, the doctor decides, and the doctor's decisions are what teach the AI. The data compounds, and it stays ours.

That ownership is a principle, not an afterthought. Data, code, brand, and integrations live under HYBRIDGE accounts with no vendor lock-in, the schema is versioned and auditable from day one so Phase 4 plugs in without re-architecture, and Phase 4 itself is the integration layer: write-back into practice-management software so nobody re-keys data, outcome tracking that validates predictability against real results, multi-office rollout, and a pre-consult patient portal.

## The roadmap, with honest status

Each phase ships independently and delivers visible value without waiting on the ones after it.

| Phase | Scope | Status |
|---|---|---|
| 1: Questionnaire system | HYBRIDGE-owned premium intake, PDF, auto-distribution, self-serve admin | In build |
| 2: Diagnostic report (CDF v1) | One report from fourteen inputs, consult dashboard, risk + treatment lean | Designed, queued |
| 3: AI-assisted findings | Radiograph assist, bone-support visualization, doctor validation queue | Designed |
| 4: Scale and integrations | PMS write-back, outcome tracking, multi-office, patient portal | Planned |

What is actually in place today, with no rounding up: the spec is written and the architecture approved, with a 19-task implementation plan and three planning sessions done with the practice's intake lead. The private repository is live under the HYBRIDGE org. The Google Cloud foundation is set up with a dedicated billing account, isolated dev and prod projects, Terraform-managed infrastructure, and HIPAA-eligible services only. The brand system is applied, six cover concepts are designed for the patient PDF, and the risk model is preserved at its existing scale and bands. Underway right now: the questionnaire schema (thirty-plus questions with conditional logic, fully tested), the patient form interface, the PDF report generator, and the email-and-Drive delivery pipeline.

## Why this one is the interesting problem

The engineering here is real, but it is not the hard part. The hard part is the elicitation: sitting with a clinician, pulling the structure out of how he actually reasons, and deciding what a system should standardize versus what it must leave to the doctor. Get that boundary wrong in either direction and you have either a glorified form or a liability. Phasing it is how you de-risk it: own the front door first, prove the intake, then build the report, then let the AI read but never decide. The goal was never to automate the diagnosis. It was to have the AI do the first read so the doctor walks in already holding a consistent, legible, evidence-backed assessment, and still holds the pen.
