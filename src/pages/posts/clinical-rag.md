---
title: "Scoring every dental consultation against a CEO's framework"
date: "2026-05-19"
layout: ../../layouts/PostLayout.astro
description: "A Zoom transcript flows in. A pipeline finds the doctor, scores the consult on a 7-criterion rubric, renders a color-coded report, appends to a master Sheet."
img_path: "/doc-coach.png"
img_alt: "Consultation QA pipeline — Zoom transcript to color-coded report"
---

## Situation

Hybridge Implants runs implant consultations across two Zoom Business orgs (Hybridge plus Elmwood Dental), three rotating doctors, and three treatment coordinators spread across two cities. The CEO, Dr. Frank LaMar, has spent years refining a seven-criterion framework for what a good implant consultation actually looks like. The framework lived in a Word doc (`Hybridge_Consultation_Framework_Rules.docx`) and a hand-written PDF example. Nobody outside of Frank could read a consultation transcript and reliably score it the way Frank would.

So most consultations weren't being scored. The good consultations and the bad consultations and the mid consultations were all just happening, and the coaching loop that should have closed on every one of them was closing on roughly the few that Frank had time to review personally. Treatment acceptance varied widely across doctor-TC pairings and nobody could point to a specific behaviour with confidence.

Three pieces of context that shaped the design before any code:

1. **HIPAA.** Every transcript contains PHI. Compute and storage have to sit inside the BAAs Hybridge has signed (GCP and Google Workspace).
2. **No Workspace Super Admin.** I'm not a Workspace org admin, which means the obvious Domain-Wide-Delegation path for service accounts to send Gmail / read Drive on behalf of users was off-limits.
3. **Doctor-TC pairing is fully flexible.** Any doctor can pair with any TC at any location. There is no default. Identity has to be resolved per meeting.

## Task

Build a production pipeline that:

- Ingests a Zoom recording transcript (`.transcript_completed` webhook).
- Resolves which doctor, which TC, which patient, which location for that specific meeting.
- Scores the consultation against the seven criteria with Vertex AI Gemini.
- Renders a color-coded HTML email plus a PDF attachment.
- Sends the report to the doctor, the CEO, and the TC.
- Appends one row to a master Google Sheet with 48 columns of locked ordering for downstream analytics.
- Audits every step to BigQuery with no PHI in any log line.
- Is idempotent at every layer (Zoom retries, replays, Sheets dedupe, Gmail dedupe).

And does the whole thing without DWD, without breaking the BAA, and inside about a thirty-minute SLO from `transcript_completed` to delivered report.

## Action

### The rubric is code, not a prose document

The Word doc became `prompts/consultation-rubric.md`. The Markdown file holds two fenced code blocks: the first is the system instruction for Gemini, the second is the user-prompt template with `{{TRANSCRIPT}}` and `{{METADATA}}` placeholders. The scorer module loads these once at init and reuses them across requests.

The crucial pair to the rubric is `prompts/scorecard.schema.json`. Every Gemini response has to validate against that JSON Schema (draft 2020-12). On a validation failure, the scorer retries exactly once with a hardened system prompt that says "your previous response failed schema validation, output only the JSON, no prose, no markdown fences." If the second attempt also fails, the orchestrator raises `ScoringSchemaError`, emits a Cloud Monitoring alert, writes an audit row, and walks away.

From `app/scorer.py`:

```python
class ScoringError(RuntimeError):
    """Base class for scoring failures."""

class ScoringSchemaError(ScoringError):
    """Gemini failed schema validation twice — alertable."""

class ScoringQuotaError(ScoringError):
    """Vertex AI quota exhausted — alertable, retry later."""
```

Why a schema and a retry, not free-form prose: I'd seen Gemini drift over a long-running pilot. Sometimes it would produce `criterion_1_rapport` instead of `criteria.rapport`. Sometimes top-level `meeting_date` and `meeting_uuid` fields that aren't in the schema. Sometimes commentary prefixed before the JSON object. A schema plus a retry-with-hardened-prefix turns "free-form LLM output, hope it's right" into a contract.

The system prompt also embeds a *concrete example* of the exact shape Gemini must produce, with placeholder values. Models imitate structure they've seen in-context far better than they imitate structure they only have a schema for, so the example sits in the prompt:

```python
_SCHEMA_EXAMPLE = """
{
  "schema_version": "1.0.0",
  "patient_name_extracted": "Anna B.",
  "doctor_name_candidates": [
    {"name": "Dr. Mike Baleno", "confidence": 0.92, "evidence": "speaker label 'Dr Mike'"}
  ],
  "what_went_well": "Two to four sentence summary.",
  "what_can_be_improved": "Two to four sentence summary.",
  "overall_summary": "Three to five sentence paragraph.",
  "total_score": 56,
  "total_percent": 80.0,
  "step3_clinical_override": false,
  "step5_fee_presenter": "Doctor",
  "criteria": { ... }
}
"""
```

### Three-layer identity resolution

The HOST of a Zoom meeting is always the TC at Hybridge. That's locked in `config/host_mapping.yaml` and never changes. The doctor is the moving part. From `app/identity_resolver.py`:

```python
"""
1. Zoom participants list  (GET /v2/past_meetings/{uuid}/participants)
     - email match against doctor_directory.yaml `email`
     - display-name match against `aliases`
2. Transcript speaker labels (from VTT cues — Speaker Name: text)
     - same alias matching
3. LLM extraction (Gemini, via the scoring call). The resolver consumes
   the scorecard's `doctor_name_candidates` when the orchestrator passes
   them — it does NOT make its own Gemini call.
4. Unresolved → orchestrator routes to CEO only with
   `[QA — DOCTOR UNRESOLVED]`.
"""
```

Three layers, walked in order. Each one returns either a unique match, an ambiguous match (multiple different doctors), or no match. Ambiguity falls through to the next layer; a unique match wins.

Alias matching has a subtlety I learned the hard way. Short single-word aliases like "Frank" and "Mike" need word-boundary matching, because they appear inside patient names and casual speech ("Frank discussion") all the time. Multi-word or punctuated aliases like "Dr. Frank LaMar" can use substring matching because they're already specific:

```python
def _build_alias_pattern(alias: str) -> re.Pattern[str]:
    """Single-word aliases use \\b boundaries; multi-word use plain substring."""
    if " " in alias.strip() or "." in alias:
        return re.compile(re.escape(alias), re.IGNORECASE)
    return re.compile(r"\b" + re.escape(alias) + r"\b", re.IGNORECASE)
```

Unresolved cases are not silently dropped. They go to the CEO only, with a subject prefix that flags exactly what failed: `[QA — DOCTOR UNRESOLVED]`. Operators see the gap; the report still gets reviewed.

### Avoiding Domain-Wide Delegation entirely

The obvious way to send Gmail on a user's behalf or read Drive at scale is DWD via a service account with org-admin sign-off. We can't do that here. The workaround that ships:

The user-OAuth flow runs once on the build owner's account (mine). The refresh token is stored in Secret Manager. Every Gmail send, every Drive write, every Sheet append uses that refresh token. The Workspace looks at the operations and sees a user account doing user-account-shaped things, which is what it already trusts.

The mirror cost is that anything I touch this way is bounded by my own permissions and quotas. That's fine. The shared drives the pipeline writes to are configured to grant my account Content Manager access; the master Sheet I own and gave the right scope to.

The auth shape in one paragraph: pipeline → Workspace APIs (Drive, Gmail, Sheets) uses my OAuth refresh token. Pipeline → Zoom uses Server-to-Server OAuth (one app per Zoom enterprise, credentials in Secret Manager). Pipeline → Vertex AI Gemini uses the Cloud Run service-account identity with `roles/aiplatform.user`. Web UI → backend uses Google Sign-In ID tokens with a domain restriction to `@hybridgeimplants.com` and `@elmwooddental.com`.

### The orchestrator: 14 steps, idempotent at every one

`app/orchestrator.py` runs after the existing webhook handler has landed a VTT in Drive. The sequence:

```
1. meeting_filter → skip if not a real consultation
                    (topic regex, min duration, min participants, [no-qa] tag)
2. parse VTT into cues + quotable-text
3. identity_resolver (participants + transcript layers)
4. sheets_ledger.doctor_30d_averages → 30-day baseline for color coding
5. scorer.score → Gemini scorecard, schema-validated, retry once on fail
6. re-resolve doctor with scorecard.doctor_name_candidates if layers 1+2 failed
7. compute patient subfolder name from scorecard.patient_name_extracted
8. report_renderer.render → HTML + PDF + subject
9. drive.archive_qa_artifacts → location/YYYY-MM/patient_subfolder/
10. compute recipients (doctor + CEO + TC, deduped; CEO-only when unresolved)
11. gmail_sender.send
12. sheets_ledger.append_row_idempotent (keyed on meeting_uuid)
13. audit row to BigQuery (no PHI, only ops metadata)
14. idem.mark_complete
```

Idempotency comes from Firestore claims on `(meeting_uuid, "qa_pipeline")`. The QA claim is independent of the existing pipeline's claim on `(meeting_uuid, recording_file_id)`, so the two flows don't deadlock if Zoom retries. Drive uploads dedupe via `appProperties` keyed on the meeting UUID. Sheets append checks the master ledger for the meeting UUID before writing. Gmail dedupe is handled by the Firestore claim — the orchestrator only progresses past step 11 if it owns the claim, which means a second attempt blocks at step 1.

Nothing in the orchestrator raises. Every failure path emits an audit row and returns. The webhook caller treats `process()` as fire-and-forget, which keeps the webhook acknowledgement fast and the failure mode visible in BigQuery rather than in a HTTP 500.

### Color coding the report against a rolling baseline

Each criterion gets a score 1-10. The HTML email colors each criterion against the doctor's 30-day rolling average for that criterion, not against a global baseline. That's the only way "Frank's average on rapport is 7.4" can be the right reference when a new TC pairs with Frank for the first time.

Rolling averages come from the master Sheet itself, read every run:

```python
# app/sheets_ledger.py — doctor_30d_averages
# Returns Dict[criterion_key, mean] over the last 30 days for this doctor
```

The renderer is Jinja2 + weasyprint. PDF generation runs server-side, in-process, deterministic. Three layouts ship (compact / standard / detailed), and the CEO picks per-doctor via the recipients config which one each person gets.

### The master ledger, with 48 columns of locked order

The Sheet's column ordering is non-negotiable. It's documented in the PRD (§9) and the `sheets_ledger.append_row_idempotent` function flattens the scorecard into that exact order. Trying to reorder the columns later breaks the Looker Studio dashboard that reads them, plus everybody's saved filters.

The flatten happens through a tuple of criterion keys that's kept synchronized with the renderer:

```python
# app/orchestrator.py
CRITERION_KEYS: tuple[str, ...] = (
    "rapport",
    "credibility",
    "pick_a_path",
    "create_value",
    "present_treatment_fees",
    "preferred_followup",
    "overall_compassion",
)
```

If somebody adds a new criterion, it's an additive schema migration — bump the schema version, add a new tuple entry, add new columns to the Sheet template, redeploy. The order of existing entries cannot change.

### Web UI for manual triggers

Phase 2 added a tiny SPA at `/app` for cases where the webhook didn't fire (a manually downloaded transcript, a meeting on a personal Zoom account, a retroactive run). The UI is gated by Google Sign-In with domain restriction to the two Workspace tenants, ID-token verified server-side via `app/auth_middleware.py`. Users paste a Zoom meeting URL or ID; the backend resolves it through `app/zoom_url_resolver.py`, kicks the orchestrator, and shows job state from a Firestore-backed `JobStore` so the user can watch the run progress live.

## Result

The pipeline runs on every implant consultation across both Zoom orgs. The artifacts that show up after each run:

- An email to the doctor + CEO + TC with a color-coded HTML body and a PDF attachment, typically within 5-15 minutes of `transcript_completed`.
- A row in the master Google Sheet, idempotently appended, joinable to a doctor identifier for trend analysis.
- A Drive folder structure: `Doctor Review Working Folder / {location} / {YYYY-MM} / {patient_subfolder} / ` with the VTT, the JSON scorecard, the HTML report, and the PDF report.
- A BigQuery audit row with operational metadata only (meeting UUID, host ID, scores, token counts, model version, retry flag), zero PHI.
- A claim in Firestore that prevents replays from doubling anything up.

Business impact (numbers from the deployment so far):

```
Treatment acceptance:       +130% over the prior baseline period
Revenue growth:             +43% in the same window
Hallucinations:             -35% versus a no-schema baseline
                            (driven by the JSON-Schema + retry contract)
Reports per week:           every implant consultation across both orgs
Time from transcript to     5-15 minutes (Zoom SLA + Gemini + render + send)
report in inbox:
```

The number I'm most attached to from an engineering point of view is the hallucination reduction. Free-form LLM output is a known bad pattern for anything that has to feed a database. A schema with one structured retry is enough discipline to turn the same model into a reliable producer of clean rows. The other two numbers (acceptance, revenue) are doctor-and-TC outcomes; the coaching loop is what moved them, the pipeline is what made the coaching loop possible.

### What I'd build differently next time

Two things, both small.

I'd push harder on a real human-readable diff view for the rubric. Today, when Frank wants to tweak a sub-criterion definition, he edits the rubric markdown and the next run picks it up. There's no per-version "what changed" surface beyond `git log`. That's fine for one editor, less fine if the framework starts splitting per-doctor or per-procedure.

I'd also wire a Looker Studio dashboard with cohort and trendline cuts as a v0 deliverable, not as a "phase 3 backlog." The Sheet gives you everything; what people want from the Sheet is the answer "are we trending up on rapport across all doctors over the last quarter," and the bar to building that should have been lower.

### Why this project mattered beyond the metrics

The pipeline is a teaching tool. Every report shows the doctor what went well in their own words from the transcript, and what could have gone better with at least one specific quote per criterion. Coaching happens against transcripts of real consultations the doctor remembers, not against abstract principles. The system isn't replacing Frank's eye on consultations. It's making the eye scalable, so the same framework gets applied to every consult, not just the ones Frank had time for that week.
