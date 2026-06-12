// Single source of truth for the four-disciplines section on the landing page
// and the /work area. Order is intentional everywhere: AIE, FDE, MLE, SDE.
// Colors come from the site accent palette (tailwind.config) — cyan stays free.

export type DxStatus =
  | "In production"
  | "Pilot-ready"
  | "In build"
  | "Design complete"
  | "Running program"
  | "Live"
  | "Research"
  | "Prototype"
  | "Academic";

export interface DxProject {
  name: string;
  status: DxStatus;
  oneLiner: string;
  img?: string;
  href?: string;
  highlights?: string[];
}

export interface DxArticle {
  title: string;
  href: string;
  img?: string;
}

export interface Discipline {
  slug: "aie" | "fde" | "mle" | "sde";
  acronym: string;
  name: string;
  accent: string;
  rgb: string;
  icon: string;
  tagline: string;
  summary: string;
  narrative: string[];
  strengths: { title: string; body: string }[];
  projects: DxProject[];
  articles: DxArticle[];
  heroImg: string;
}

export const disciplines: Discipline[] = [
  {
    slug: "aie",
    acronym: "AIE",
    name: "AI Engineering",
    accent: "#34D399",
    rgb: "52, 211, 153",
    icon: "fa-solid fa-wand-magic-sparkles",
    tagline:
      "LLM systems that hold up in a regulated industry. Structured outputs, evidence rules, and humans where it matters.",
    summary:
      "I build LLM pipelines for healthcare, where a made-up sentence isn't a quirk, it's a liability. Every system I ship forces the model into a schema, makes it cite its evidence, strips patient data before inference, and routes anything uncertain to a person.",
    narrative: [
      "Most of my AI work runs inside a dental implant company, which means HIPAA, real patients, and zero tolerance for confident nonsense. That constraint shaped how I build: the model never free-writes. It fills a validated JSON schema, cites a verbatim transcript quote for every claim it makes, and gets one retry with a hardened prompt before the pipeline escalates to a human.",
      "The pattern repeats across systems. The consultation grader scores doctors against their own 30-day average, not an arbitrary bar. The call-coaching pipeline runs Cloud DLP de-identification before the model ever sees a transcript, so the LLM physically can't leak what it never saw. Patient de-duplication proposes matches with confidence scores but never merges on its own.",
      "I think of it as designing the cage before admiring the animal. The interesting work isn't the prompt, it's everything around it: schemas, retries, idempotency, audit trails, and the judgment call about where a human stays in the loop.",
    ],
    strengths: [
      {
        title: "Structured output, enforced",
        body: "Response schemas with validation and retry loops. The model fills a contract; it doesn't write prose that gets parsed by hope.",
      },
      {
        title: "Evidence-grounded scoring",
        body: "Every score cites a verbatim quote and timestamp. If the model can't point to it in the transcript, it doesn't get to say it.",
      },
      {
        title: "PHI-safe by architecture",
        body: "De-identification before inference, BAA-covered model endpoints, no PHI in logs, audit trails in BigQuery. Compliance is in the data flow, not a policy doc.",
      },
      {
        title: "Humans where it matters",
        body: "Confidence thresholds route uncertain calls to review queues. AI proposes; people approve the irreversible stuff.",
      },
    ],
    projects: [
      {
        name: "Doc Coach — Consultation QA",
        status: "In production",
        oneLiner:
          "Every Zoom consult scored against a 7-criterion clinical rubric by Gemini with structured output, delivered as color-coded coaching reports to doctors and the CEO within minutes of the call.",
        img: "/doc-coach.png",
        href: "/posts/clinical-rag",
        highlights: [
          "Three-tier identity resolution: Zoom participants → transcript speakers → LLM extraction",
          "Verbatim-quote requirement cut hallucinated feedback by ~35%",
          "Idempotent at three layers: webhook, ledger append, Drive upload",
          "Weekly and monthly auto-generated comparative insight reports across doctors",
        ],
      },
      {
        name: "NPC Coach — Call Coaching",
        status: "Pilot-ready",
        oneLiner:
          "A Pub/Sub pipeline that coaches new-patient phone calls: bilingual transcription, Cloud DLP de-identification before the LLM, rubric scoring with hard gates, and per-coordinator trend reports.",
        img: "/npc-coach.png",
        href: "/posts/doctor-report-cards",
        highlights: [
          "PHI stripped via Cloud DLP before any model sees the text",
          "Hard gates cap the score: miss patient identification and no rubric points save you",
          "Emergency-call logic: financial pressure on an urgent caller is a major penalty",
          "Booking rate deliberately not a success metric — correctness over conversion",
        ],
      },
      {
        name: "CRM intelligence layer",
        status: "Design complete",
        oneLiner:
          "Inside the CRM blueprint: LLM-proposed patient de-duplication with mandatory human review, and structured extraction of five thousand free-text activity logs with the originals preserved verbatim.",
        img: "/cowork-dashboard.png",
        highlights: [
          "No autonomous merges, ever — the data has 74 shared phone numbers (married couples)",
          "Every parse carries a confidence score and source reference for re-runs",
          "Consent tokens extracted into an append-only ledger",
        ],
      },
      {
        name: "Portfolio chatbot",
        status: "Live",
        oneLiner:
          "The assistant in the corner of this site: Llama 3.1 8B on Cloudflare Workers AI, context baked into the worker, running entirely on the free tier.",
        img: "/jobpilot-judge.png",
        href: "/posts/jobpilot-v2",
        highlights: [
          "Zero-cost serving: Workers AI free tier, no API keys, no vector DB",
          "Context-as-code: site copy compiled into the worker at deploy time",
        ],
      },
    ],
    articles: [
      { title: "How I built an AI that grades every patient consult", href: "/posts/clinical-rag", img: "/doc-coach.png" },
      { title: "Doctor report cards", href: "/posts/doctor-report-cards", img: "/doctor-report-cards.png" },
      { title: "Job Pilot v2", href: "/posts/jobpilot-v2", img: "/jobpilot-judge.png" },
    ],
    heroImg: "/discipline-aie.png",
  },
  {
    slug: "fde",
    acronym: "FDE",
    name: "Forward-Deployed Engineering",
    accent: "#F5A524",
    rgb: "245, 165, 36",
    icon: "fa-solid fa-compass",
    tagline:
      "Embedded with doctors, finance, and ops. Find the real problem, ship into their workflow, teach them to run it.",
    summary:
      "I'm the only engineer at a dental implant company, which makes every project forward-deployed: sit with the person who has the problem, dig the requirements out of their actual data, ship into the tools they already use, then train them until they don't need me in the loop.",
    narrative: [
      "My job title says AI engineer, but the actual job is closer to embedded engineer: the stakeholders are surgeons, a CFO, treatment coordinators, and a chief sales officer, and none of them write tickets. Requirements live in their spreadsheets, their meeting transcripts, and their workarounds. The discovery work is the work.",
      "The dashboard is the cleanest example. Leadership ran the company on a hand-built Excel sheet with patient-to-lead links that silently broke on duplicate names. I rebuilt it where ops already lives (Google Sheets), encoded the ops manager's exact business rules as reviewable config, iterated on it live in meetings with the CSO, and backed every number with an independent verification harness. Fixing the linkage surfaced roughly $460K of patient value the old reports were quietly dropping.",
      "The other half of forward-deployed work is enablement. One engineer doesn't scale; an organization that uses AI well does. I run a weekly AI Power Hour plus office hours for seven non-technical departments, built from a needs survey rather than a hype deck, with privacy and compliance addressed in every single session.",
      "And sometimes the most valuable deliverable is the honest no. The CRM blueprint I wrote tells leadership plainly: if you won't fund ongoing engineering, the correct decision is to stay on the current vendor. Knowing when not to build is part of the job.",
    ],
    strengths: [
      {
        title: "Discovery from primary sources",
        body: "Requirements pulled from real exports, meeting transcripts, and shadowing sessions — eight catalogued data-quality problems with row counts, not vibes.",
      },
      {
        title: "Ship into existing workflows",
        body: "Sheets for ops, a web UI for finance, email reports for doctors. Adoption beats elegance; the tool that gets used wins.",
      },
      {
        title: "Enablement and training",
        body: "A weekly training program and office hours that take non-technical teams from zero to confident, compliant AI use.",
      },
      {
        title: "Honest scoping",
        body: "Build-vs-buy and build-vs-stay analyses with real cost lines, including the ones that recommend against building.",
      },
    ],
    projects: [
      {
        name: "Cowork Dashboard",
        status: "In production",
        oneLiner:
          "The operations dashboard Hybridge leadership runs the business on: weekly Monday.com exports parsed into a full funnel view, iterated live with the CSO, every metric independently verifiable.",
        img: "/cowork-dashboard.png",
        href: "/posts/cowork-dashboard",
        highlights: [
          "Patient-to-lead linkage fixed from 49% to 99% by replacing name-matching with real foreign keys",
          "Surfaced ~$460K of orphan patient value the old reports dropped",
          "A Python port of the entire metric logic re-computes every number as an audit",
          "Three-minute weekly workflow: drop three exports, hit refresh",
        ],
      },
      {
        name: "AI Lab & Office Hours",
        status: "Running program",
        oneLiner:
          "A company-wide enablement program: weekly AI Power Hour sessions plus open office hours for seven non-technical departments, grounded in a needs survey, privacy-first in every session.",
        img: "/film-and-engineering.png",
        highlights: [
          "Curriculum built from a structured 7-department needs assessment",
          "Decks generated programmatically from a build script — versioned like code",
          "Plain language, no jargon, no code; HIPAA awareness in every session",
        ],
      },
      {
        name: "Hybridge CRM blueprint",
        status: "Design complete",
        oneLiner:
          "A build-ready architecture for migrating 15K patient records off Monday.com: immutable patient identity, append-only consent ledgers, a marketing firewall that structurally can't leak PHI, and a survivability plan for when I'm not in the room.",
        img: "/enterprise-data.png",
        highlights: [
          "PRD says the quiet part out loud: without funded maintenance, don't build this",
          "Human-in-the-loop dedup; reversible merges; audit log captures reads, not just writes",
          "NY SHIELD analysis citing a $2.85M settlement in Hybridge's own market",
        ],
      },
      {
        name: "Accounting automation platform",
        status: "In production",
        oneLiner:
          "A self-serve web platform that lets the finance lead run every accounting ETL himself: upload a file, get a script recommendation, run it, download the result. About 400 hours a year of senior time back.",
        img: "/accounting-automation.png",
        href: "/posts/accounting-automation",
        highlights: [
          "Zero-trust access via Cloud IAP; adding a user is a UI action, not a gcloud command",
          "Success criterion: the engineer is no longer needed in the loop",
        ],
      },
      {
        name: "CDF — diagnostic operating system",
        status: "Design complete",
        oneLiner:
          "Current frontier: a product design framework built with Hybridge's founder for unifying every imaging modality into AI-assisted, doctor-validated diagnostic reporting.",
        highlights: [
          "Fourteen input classes mapped to nine standardized report sections",
          "Governing rule: AI assists, doctors validate",
        ],
      },
    ],
    articles: [
      { title: "How I fixed the patient-to-lead link and found the orphan revenue", href: "/posts/cowork-dashboard", img: "/cowork-dashboard.png" },
      { title: "Accounting automation: 400 hours a year", href: "/posts/accounting-automation", img: "/accounting-automation.png" },
      { title: "Film and engineering", href: "/posts/film-and-engineering", img: "/film-and-engineering.png" },
    ],
    heroImg: "/discipline-fde.png",
  },
  {
    slug: "mle",
    acronym: "MLE",
    name: "Machine Learning Engineering",
    accent: "#A78BFA",
    rgb: "167, 139, 250",
    icon: "fa-solid fa-brain",
    tagline:
      "Models are easy; pipelines that keep them honest are the work. Medical imaging, RLHF research, and MLOps that survives contact with production.",
    summary:
      "I train and ship models with the unglamorous parts done properly: versioned data pipelines with no train/serve skew, holdout gates that block bad models from promoting, experiment tracking, and honest evals. Flagship: a medical-imaging system that replaced a $98K vendor quote for about $25 a month.",
    narrative: [
      "The CBCT scan validator is the project that taught me what production ML actually costs. The model is the small part: a self-supervised spatiotemporal masked autoencoder that runs inference in 58 milliseconds on half a gigabyte of VRAM. The big part is everything that keeps it honest — a fully automated, versioned training-data pipeline where training and inference share one preprocessing path, and a weekly CI/CT job that evaluates against a deterministic holdout and refuses to promote a model that fails the gate.",
      "I benchmarked six architectures behind one shared interface before picking the production model: a 2D ConvNeXt baseline, a hybrid transformer, a 3D CNN, an nnU-Net adapter, a VAE anomaly detector, and the ST-MAE that won. When the model is wrong, confidence thresholds route the scan to a human instead of pretending.",
      "Before Hybridge, I spent a year and a half at NYU researching whether RLHF-family methods (PPO, GRPO) could make Llama a measurably better persuader — reward modeling and preference optimization, the same machinery behind modern aligned models, pointed at argument quality. That training-side depth is why I trust myself to debug the serving side.",
    ],
    strengths: [
      {
        title: "No train/serve skew",
        body: "One ETL path feeds both training and inference. Versioned tensors, idempotent processing, object-lock concurrency control.",
      },
      {
        title: "Gated promotion",
        body: "Weekly CI/CT evaluation on a deterministic holdout with an accuracy gate. A model that can't prove itself doesn't ship.",
      },
      {
        title: "Training-side depth",
        body: "RLHF, GRPO, PPO, reward modeling at NYU; self-supervised pretraining (DINO, ST-MAE) at work. Not just an API consumer.",
      },
      {
        title: "Cost-conscious serving",
        body: "Scale-to-zero Cloud Run, event-driven inference, ~$25/month for a system a vendor quoted at $98K up front.",
      },
    ],
    projects: [
      {
        name: "CBCT Scan Validator",
        status: "In production",
        oneLiner:
          "An in-house medical-imaging quality gate that catches bad dental CT scans at upload time across 13 artifact classes, routing corrective actions to the front desk before a designer wastes hours.",
        img: "/cbct-validator.png",
        href: "/posts/cbct-scan-validator",
        highlights: [
          "Six architectures benchmarked behind one interface; ST-MAE won on accuracy-per-watt",
          "Event-driven inference: scan lands in storage, verdict email in ~20 seconds",
          "Fully automated versioned training pipeline — new labeled scans flow in continuously",
          "~$125K year-one cost displacement vs the vendor proposal",
        ],
      },
      {
        name: "LLM Persuasion (NYU research)",
        status: "Research",
        oneLiner:
          "Eighteen months of research on making Llama argue better: reward modeling over argument quality, then PPO and GRPO fine-tuning against it — the full RLHF stack, hands-on.",
        img: "/llm-persuasion.png",
        href: "/posts/llama-rlhf",
        highlights: [
          "Preference data collection and reward-model training from scratch",
          "Policy optimization with PPO and GRPO; the tradeoffs between them, learned the hard way",
        ],
      },
      {
        name: "Loan Radar",
        status: "Academic",
        oneLiner:
          "End-to-end MLOps for a loan-default model: MLflow experiment tracking, Airflow orchestration, Kubernetes serving, and CI/CD that retrains and redeploys without a human.",
        img: "/loan-radar.png",
        href: "/posts/loan-radar-mlops",
        highlights: [
          "The full lifecycle: data validation, training, registry, deployment, monitoring",
        ],
      },
      {
        name: "ResNet under 5M parameters",
        status: "Academic",
        oneLiner:
          "CIFAR-10 under a hard parameter budget: architecture search and training discipline when you can't just scale up.",
        img: "/resnet-compact.png",
        href: "/posts/resnet-under-5m",
      },
      {
        name: "RecSys at 22M records",
        status: "Academic",
        oneLiner:
          "Spark pipeline with LSH candidate generation and ALS collaborative filtering — recommendation at a scale where O(n²) is a budget line.",
        img: "/customer-segmentation.png",
        href: "/posts/recsys-spark-bigdata",
      },
    ],
    articles: [
      { title: "How I built a validator that catches bad dental scans", href: "/posts/cbct-scan-validator", img: "/cbct-validator.png" },
      { title: "Teaching Llama to argue better (RLHF / GRPO / PPO)", href: "/posts/llama-rlhf", img: "/llm-persuasion.png" },
      { title: "Loan Radar: ML CI/CD end to end", href: "/posts/loan-radar-mlops", img: "/loan-radar.png" },
      { title: "ResNet under 5M parameters", href: "/posts/resnet-under-5m", img: "/resnet-compact.png" },
    ],
    heroImg: "/discipline-mle.png",
  },
  {
    slug: "sde",
    acronym: "SDE",
    name: "Software Engineering",
    accent: "#5B8DEF",
    rgb: "91, 141, 239",
    icon: "fa-solid fa-code",
    tagline:
      "The foundation under everything else: schemas with invariants, test pyramids, infrastructure as code, and systems that survive their author.",
    summary:
      "Every AI system I ship is wrapped in software built to last: databases that enforce their own rules, sixteen-thousand-line codebases held to strict typing and seven hundred tests, Terraform for everything, and runbooks so the next engineer isn't archaeology-ing my decisions.",
    narrative: [
      "My favorite class of bug is the one the database makes impossible. The treatment estimator rewrite freezes every price at the moment it's captured — write-once columns enforced by triggers, full revision snapshots on every status change — because a patient quoted $38,000 in March deserves the same number in September, and a policy memo is weaker than a constraint.",
      "I hold solo projects to team standards, because at a company with one engineer there's no one else to catch it: strict typing across the board, four-tier test pyramids with golden-file fixtures, idempotency at every boundary so replays never duplicate, CI/CD with keyless auth, and infrastructure that rebuilds from a clean checkout with one command.",
      "The discipline pays off in unglamorous ways. The dashboard ships with a second, independent implementation of every metric purely as an audit oracle. The accounting platform's tests verify outputs byte-for-byte. The NPC pipeline's 734 tests run against in-memory fakes, so no test ever touches real patient data. Boring, deliberate, durable.",
    ],
    strengths: [
      {
        title: "Invariants in the database",
        body: "Write-once columns via triggers, append-only ledgers, revision snapshots. The schema enforces the business promise.",
      },
      {
        title: "Test discipline at solo scale",
        body: "734 tests on one system, strict typing, golden-file fixtures, in-memory fakes — no real cloud, no real PHI in any test.",
      },
      {
        title: "Idempotency everywhere",
        body: "Webhooks, ledger appends, file uploads, ETL runs: replay anything, duplicate nothing.",
      },
      {
        title: "Built to be left",
        body: "Terraform, runbooks, ADRs, admin panels for non-engineers. A system that needs its author forever is a liability, not an asset.",
      },
    ],
    projects: [
      {
        name: "Treatment Estimator",
        status: "In production",
        oneLiner:
          "The pricing tool coordinators use chairside during live consults — shipped in about a month after a vendor failed at it for ten years, now being rebuilt as a Next.js 16 + Postgres app with a five-model pricing engine.",
        img: "/treatment-estimator.png",
        href: "/posts/treatment-estimator",
        highlights: [
          "Frozen-price invariant: write-once columns enforced by database triggers",
          "Per-location price books with propose/approve workflows — no developer needed for pricing changes",
          "Six-year estimate reproducibility for HIPAA record-keeping",
          "~$35/month total cloud footprint",
        ],
      },
      {
        name: "Accounting automation platform",
        status: "In production",
        oneLiner:
          "FastAPI platform behind Cloud IAP: upload a file, the system recognizes it and recommends the right ETL script, runs it with live logs, hands back the output.",
        img: "/accounting-automation.png",
        href: "/posts/accounting-automation",
        highlights: [
          "Golden-file tests: outputs verified byte-identical against fixtures",
          "In-browser script editing that commits to GitHub — fixes ship without a terminal",
          "Keyless CI/CD via Workload Identity Federation",
        ],
      },
      {
        name: "NPC pipeline engineering",
        status: "Pilot-ready",
        oneLiner:
          "The software story under the AI: 16K lines, 167 modules, 734 tests, mypy strict, event-driven microservices on Pub/Sub with dead-letter handling and dual-source dedup.",
        img: "/npc-coach.png",
        href: "/posts/pipeline-ghosting",
        highlights: [
          "Adapter-pattern ingestion: a new call source is one new module",
          "Four-tier test pyramid against in-memory fakes — zero PHI in the repo",
        ],
      },
      {
        name: "JobPilot",
        status: "Prototype",
        oneLiner:
          "A personal SaaS prototype for job-search automation — scraping, matching, and an LLM judge — built to scratch my own itch and learn the full product loop.",
        img: "/jobpilot.png",
        href: "/posts/jobpilot-v2",
        highlights: [
          "Two full iterations; v2 rebuilt around an evaluation-first design",
        ],
      },
      {
        name: "This website",
        status: "Live",
        oneLiner:
          "Astro + Tailwind, hand-built design system, React islands, a free-tier chatbot on Cloudflare Workers, deployed by GitHub Actions. The portfolio is also the proof.",
        img: "/pic.png",
      },
    ],
    articles: [
      { title: "Rebuilding a 10-year-old pricing tool in a month", href: "/posts/treatment-estimator", img: "/treatment-estimator.png" },
      { title: "Pipeline observability and silent-failure hardening", href: "/posts/pipeline-ghosting", img: "/pipeline-ghosting.png" },
      { title: "Accounting automation: 400 hours a year", href: "/posts/accounting-automation", img: "/accounting-automation.png" },
    ],
    heroImg: "/discipline-sde.png",
  },
];

export const disciplineBySlug = (slug: string) =>
  disciplines.find((d) => d.slug === slug);
