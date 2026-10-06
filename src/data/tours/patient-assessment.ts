import type { Tour } from "./types";

export const patientAssessment: Tour = {
  slug: "patient-assessment",
  name: "Patient Assessment",
  tail: "One form in place of three vendor questionnaires.",
  post: "/posts/cdf-diagnostic-filter",
  cover: "/cdf-diagnostic-filter.png",
  kicker: "Full-stack product · Psychographics",
  accent: "#2DD4BF",
  accentRgb: "45, 212, 191",
  pitch:
    "An in-house replacement for a third-party questionnaire vendor: a schema-driven patient assessment that produces a premium patient-facing PDF with a psychographic profile, routes copies to the right clinic's distribution list, and files itself into the patient's records folder.",
  problem:
    "Three near-duplicate questionnaires, one per location, ran on a paid vendor with no signed healthcare agreement. Staff screenshotted results into notes, hand-filed PDFs, and re-keyed lead sources into the CRM, several minutes of copy-paste per patient, with the interesting signal (how this patient decides) buried in raw answers.",
  metrics: [
    { label: "Vendor replaced", value: "3-in-1", sub: "one schema-driven form with location routing" },
    { label: "Manual loop removed", value: "0 re-keying", sub: "email, filing, and routing are automatic" },
    { label: "Questions", value: "30+", sub: "with conditional logic and auto-save" },
    { label: "Compliance", value: "CMEK + audit", sub: "append-only audit log from day one" },
  ],
  concepts: ["Schema-driven forms", "Conditional logic", "LLM profile synthesis", "PDF rendering pipelines", "Monorepo architecture", "HIPAA-minded design"],
  stack: ["Next.js 15", "TypeScript", "Tailwind + shadcn/ui", "Firestore", "Playwright PDF rendering", "Vertex AI", "Cloud Run", "Terraform", "Workload Identity Federation"],
  steps: [
    {
      title: "A personalized link, no login",
      body: "The coordinator sends a signed link whose token encodes the location. The patient just opens it: no account, no password, and the form already knows which clinic's branding, questions, and distribution list apply.",
      screen: {
        kind: "terminal",
        title: "Signed link",
        lines: [
          "$ /assess?token=eyJs…",
          "token verified · location: Clinic A · schema v3",
          "patient session created · progress auto-saves per section",
        ],
      },
    },
    {
      title: "Sections that adapt as you answer",
      body: "Emotional and social context, scope of concern, functional limitations, treatment vision, future outlook, fixed versus removable preference, risk factors, dental health, and doctor-only fields. Conditional questions render only when relevant, and a refresh resumes exactly where the patient left off.",
      screen: {
        kind: "cards",
        title: "Questionnaire flow",
        cards: [
          { name: "Emotional & Social", lines: ["how dental health affects daily life"], badge: "1 of 9" },
          { name: "Scope of Concern", lines: ["one tooth, several, or everything"], badge: "2 of 9" },
          { name: "Risk Factors", lines: ["conditional: renders per prior answers"], badge: "7 of 9" },
          { name: "Doctor-only fields", lines: ["clinical observations, staff view"], badge: "9 of 9" },
        ],
      },
    },
    {
      title: "Submit fans out automatically",
      body: "On submit: schema-version validation, risk scoring, a server-side PDF render, email to the patient and to that location's distribution list, and a write into the patient's records folder, queued for retry if the folder is not matched yet. The screenshot-and-re-key loop is gone.",
      screen: {
        kind: "terminal",
        title: "Submission pipeline",
        lines: [
          "$ submit response #4821 (schema v3)",
          "validate ✓ · risk score 42/100 (moderate)",
          "render PDF (Playwright, React templates) ✓",
          "email: patient ✓ · Clinic A list ✓ · Drive: filed ✓",
        ],
      },
    },
    {
      title: "The psychographic page",
      body: "The signature artifact: an archetype hero with cards for identity, emotional state, dominant motivation, decision-making style, aspirations, and buying personality, ending in a coaching block for staff on how to connect with this specific patient. Synthesis is LLM-assisted; no diagnosis or treatment recommendation is produced.",
      screen: {
        kind: "report",
        title: "Understanding Jordan (synthetic)",
        subtitle: "Archetype: The Careful Restorer",
        sections: [
          { name: "Emotional state", note: "Guarded optimism after years of avoidance; anxiety centers on being judged for waiting this long." },
          { name: "Decision-making style", note: "Wants the full option set in writing before committing; distrusts pressure, responds to patient education." },
          { name: "Buying personality", note: "Value over price. Needs a named single point of contact and a clear sequence of what happens next." },
          { name: "How to connect", tone: "good", note: "Acknowledge the wait without judgment, lead with the plan's certainty, put everything in writing before the fee conversation." },
        ],
      },
    },
    {
      title: "Staff review and iterate",
      body: "An admin dashboard (SSO, domain-restricted) shows recent responses, completion rates, and delivery status, with a re-send button and a report regeneration loop. A question editor lets staff reorder questions, edit conditional logic, and adjust scoring weights behind a draft-then-publish flow.",
      screen: {
        kind: "table",
        title: "Admin · recent responses (synthetic)",
        headers: ["Patient", "Location", "Risk", "Delivery", "Filed"],
        rows: [
          ["Jordan R.", "Clinic A", { text: "42 moderate", tone: "warn" }, { text: "sent ✓", tone: "good" }, { text: "✓", tone: "good" }],
          ["Casey M.", "Clinic B", { text: "18 low", tone: "good" }, { text: "sent ✓", tone: "good" }, { text: "queued", tone: "warn" }],
          ["Avery T.", "Clinic A", { text: "67 elevated", tone: "bad" }, { text: "sent ✓", tone: "good" }, { text: "✓", tone: "good" }],
        ],
      },
    },
    {
      title: "Phase 1 of something bigger",
      body: "This is the first phase of a centralized diagnostic filter: the structured responses later join CBCT imaging and clinical photos into one unified diagnostic packet. Deploys are keyless (Workload Identity Federation) on version tags, with CMEK encryption and an append-only audit log from day one.",
      screen: {
        kind: "cards",
        title: "Roadmap position",
        cards: [
          { name: "Phase 1 · Assessment", lines: ["structured psychographic + risk intake"], badge: "live", highlight: true },
          { name: "Phase 2 · Imaging join", lines: ["CBCT and photo context in one packet"], badge: "next" },
          { name: "Phase 3 · Diagnostic packet", lines: ["AI reads, doctor validates"], badge: "planned" },
        ],
      },
    },
  ],
  architecture: [
    { lane: "Apps", items: ["pnpm monorepo: questionnaire app, staff app, PDF renderer", "Next.js 15 + Tailwind + shadcn/ui", "Shared schema, lib, and UI packages"] },
    { lane: "Pipeline", items: ["Signed location-encoded links, no patient login", "Schema-version validation on submit", "Playwright renders React templates to PDF"] },
    { lane: "Delivery", items: ["Patient email + per-location distribution lists", "Records-folder filing with retry queue", "Report regeneration feedback loop"] },
    { lane: "Platform", items: ["Firestore + Cloud Storage + Firebase Auth", "CMEK, append-only audit log", "Keyless deploys via Workload Identity Federation on version tags"] },
  ],
  outcome:
    "One schema-driven system replaced three vendor questionnaires and an entire manual routing ritual, and turned raw answers into a document staff actually use in the consult room. The honest boundary is stated in the product itself: this phase produces context and a risk score, never a diagnosis or treatment recommendation. The patient and profile shown here are entirely synthetic.",
};
