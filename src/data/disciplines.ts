// Single source of truth for the four-disciplines section on the landing page
// and the /work area. Order is intentional everywhere: AIE, FDE, MLE, SDE.
// `accent` and `rgb` only colour the mind graph's stars now; the /work pages
// tell disciplines apart by name, never by colour.

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
  demo?: string;
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
  // The long form. The pages show `points` instead; this stays as the record.
  narrative: string[];
  // The story as short points: a bold lead, then one plain sentence.
  points: { lead: string; text: string }[];
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
      "I build healthcare LLM pipelines that fill a schema, cite their evidence, strip patient data first, and send anything uncertain to a person.",
    narrative: [
      "Most of my AI work has shipped inside Hybridge, a dental implant company. That means HIPAA, real patients, and zero tolerance for confident nonsense. The constraint shaped how I build: the model never free-writes. It fills a validated JSON schema, cites a verbatim transcript quote for every claim it makes, and gets one retry with a hardened prompt before the pipeline escalates to a human.",
      "The pattern repeats across systems. The consultation grader scores doctors against their own 30-day average, not an arbitrary bar. The call-coaching platform gates every real-PHI path behind one compliance switch and keeps the patient's name and transcript out of every log line, so a demo or a test can't touch real data by accident. Patient de-duplication proposes matches with confidence scores but never merges on its own.",
      "The interesting work isn't the prompt. It's everything around it: schemas, retries, idempotency, audit trails, and deciding where a human stays in the loop.",
    ],
    points: [
      { lead: "Built for healthcare.", text: "My AI work ships inside a dental implant company: HIPAA, real patients, no room for confident nonsense." },
      { lead: "The model fills a schema.", text: "It fills a validated JSON schema and cites a verbatim transcript quote for every claim." },
      { lead: "One retry, then a person.", text: "A failed answer gets one retry with a hardened prompt, then the pipeline hands it to a human." },
      { lead: "Patient data stays out.", text: "One compliance switch gates every real patient data path, and names and transcripts never reach a log." },
      { lead: "Matches proposed, never merged.", text: "Duplicate patient matching suggests pairs with confidence scores and never merges on its own." },
      { lead: "The prompt is the small part.", text: "The real work is schemas, retries, idempotency, audit trails and where a human stays in the loop." },
    ],
    strengths: [
      {
        title: "Structured output, enforced",
        body: "Schemas with validation and retries. The model fills a contract, not free prose.",
      },
      {
        title: "Evidence-grounded scoring",
        body: "Every score cites a verbatim quote and timestamp, or it doesn't get said.",
      },
      {
        title: "PHI-safe by architecture",
        body: "Data stripped before inference, BAA covered endpoints, no PHI in logs, BigQuery audit trails.",
      },
      {
        title: "Humans where it matters",
        body: "Uncertain calls go to review queues. AI proposes; people approve anything irreversible.",
      },
    ],
    projects: [
      {
        name: "Enterprise Search (RAG)",
      demo: "/demos/enterprise-search",
        status: "In build",
        oneLiner:
          "An internal AI search over Hybridge's knowledge, with citations and an honest 'I don't know' when evidence is thin.",
        img: "/enterprise-search.png",
        href: "/posts/enterprise-search",
        highlights: [
          "Hybrid retrieval (BM25 + pgvector) fused with RRF and reranked, not vector-only",
          "Conflict resolution by rule: validity, authority, recency, else declare the disagreement",
          "Group access enforced as a pre-retrieval filter, so restricted docs never leak into a search",
          "An eval harness (recall, nDCG, MRR, faithfulness) decides when complexity earns its place",
        ],
      },
      {
        name: "Doc Coach: Consultation QA",
      demo: "/demos/doc-coach",
        status: "In production",
        oneLiner:
          "Every Zoom consult scored by Gemini on seven clinical criteria, with coaching reports to doctors within minutes.",
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
        name: "NPC Coach: Call Coaching",
      demo: "/demos/npc-coach",
        status: "In production",
        oneLiner:
          "Finds the relevant new patient calls among thousands and scores each against the playbook, a quote behind every criterion.",
        img: "/npc-coach.png",
        href: "/posts/npc-coach",
        highlights: [
          "A verbatim transcript quote behind every one of six scoring criteria",
          "Hard gates are flags, not caps: a call can score 84 and still carry a red 'missed a non-negotiable' badge",
          "Patient-urgency override: schedule a consult-only for someone in real pain and it's recorded as a safety failure",
          "Booking rate is deliberately not a success metric. Correctness over conversion",
        ],
      },
      {
        name: "CDF: AI-assisted diagnosis",
      demo: "/demos/patient-assessment",
        status: "In build",
        oneLiner:
          "AI reads CBCT, radiographs, scans and photos for decay, missing teeth and bone support; a doctor validates every finding.",
        img: "/cdf-diagnostic-filter.png",
        href: "/posts/cdf-diagnostic-filter",
        highlights: [
          "AI-assisted findings on 2D radiographs and CBCT: decay, missing teeth, restorations, bone levels",
          "Every AI finding stays provisional until a doctor confirms it in a validation queue",
          "Signed corrections feed a continuous-learning loop on the practice's own validated cases",
          "Standardized bone-support visualization: current architecture against an ideal reference",
        ],
      },
      {
        name: "Marketing Data Warehouse",
        status: "In production",
        oneLiner:
          "A BigQuery warehouse joining six marketing sources, ad spend to treatment value, documented so LLMs read a guide first.",
        img: "/marketing-warehouse.png",
        href: "/posts/marketing-warehouse",
        highlights: [
          "Every column described, plus a data guide written for LLMs to read first",
          "A weekly Gemini eval on 22 golden questions with an 80% gate; the first run scored 77%, short of it",
          "98.5% of patients linked to their lead; 99.5% join agreement with the weekly exports",
          "View types that carry callers', reviewers' or leads' identities are blocked in code",
        ],
      },
      {
        name: "CRM intelligence layer",
        status: "Design complete",
        oneLiner:
          "Duplicate patients proposed by an LLM with mandatory human review, plus structured extraction of five thousand activity logs.",
        img: "/cowork-dashboard.png",
        highlights: [
          "No autonomous merges, ever. The data has 74 shared phone numbers (married couples)",
          "Every parse carries a confidence score and source reference for re-runs",
          "Consent tokens extracted into an append-only ledger",
        ],
      },
      {
        name: "Portfolio chatbot",
        status: "Live",
        oneLiner:
          "The assistant in the corner of this site, on Cloudflare Workers AI and running entirely on the free tier.",
        img: "/jobpilot-judge.png",
        href: "/posts/jobpilot-v2",
        highlights: [
          "Zero-cost serving: Workers AI free tier, no API keys, no vector DB",
          "Context-as-code: site copy compiled into the worker at deploy time",
        ],
      },
    ],
    articles: [
      { title: "Building an enterprise search that knows when to say 'I don't know'", href: "/posts/enterprise-search", img: "/enterprise-search.png" },
      { title: "How I built an AI that grades every patient consult", href: "/posts/clinical-rag", img: "/doc-coach.png" },
      { title: "Rebuilding a brittle call grader into a coaching platform", href: "/posts/npc-coach", img: "/npc-coach.png" },
      { title: "A marketing warehouse that people and LLMs can both read", href: "/posts/marketing-warehouse", img: "/marketing-warehouse.png" },
      { title: "JobPilot: my open-source job-hunt app", href: "/posts/jobpilot-v2", img: "/jobpilot-flagship.png" },
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
      "As the only engineer at a dental implant company, I sit with the person who has the problem, ship into their tools, then train them.",
    narrative: [
      "My role at Hybridge is titled AI engineer, but the actual work is closer to embedded engineering: the stakeholders are surgeons, a CFO, treatment coordinators, and a chief sales officer, and none of them write tickets. Requirements live in their spreadsheets, their meeting transcripts, and their workarounds. The discovery work is the work.",
      "The dashboard is the cleanest example. Leadership ran the company on a hand-built Excel sheet with patient-to-lead links that silently broke on duplicate names. I rebuilt it where ops already lives (Google Sheets), encoded the ops manager's exact business rules as reviewable config, iterated on it live in meetings with the CSO, and backed every number with an independent verification harness. Fixing the linkage surfaced roughly $460K of patient value the old reports were quietly dropping.",
      "The other half of forward-deployed work is enablement. One engineer doesn't scale; an organization that uses AI well does. At Hybridge I started a weekly AI Power Hour plus office hours for seven non-technical departments, built from a needs survey rather than a hype deck, with privacy and compliance addressed in every single session.",
      "And sometimes the most valuable deliverable is the honest no. The CRM blueprint I wrote tells leadership plainly: if you won't fund ongoing engineering, the correct decision is to stay on the current vendor. Knowing when not to build is part of the job.",
    ],
    points: [
      { lead: "No one writes tickets.", text: "My users are surgeons, a CFO, treatment coordinators and a chief sales officer. None of them write tickets." },
      { lead: "Discovery is the work.", text: "Requirements live in their spreadsheets, meeting transcripts and workarounds, so that is where I dig." },
      { lead: "Build where they work.", text: "I rebuilt leadership's Excel dashboard in Google Sheets, iterated live with the CSO, every number independently checked." },
      { lead: "Fix the data first.", text: "Fixing the broken patient to lead links surfaced about $460K of patient value the old reports dropped." },
      { lead: "Teach, then step back.", text: "A weekly AI Power Hour and office hours for seven nontechnical departments, built from a needs survey." },
      { lead: "The honest no.", text: "My CRM blueprint tells leadership plainly: without funded engineering, stay on the current vendor." },
    ],
    strengths: [
      {
        title: "Discovery from primary sources",
        body: "Requirements from real exports, transcripts and shadowing: eight data problems catalogued with row counts.",
      },
      {
        title: "Ship into existing workflows",
        body: "Sheets for ops, a web UI for finance, email reports for doctors.",
      },
      {
        title: "Enablement and training",
        body: "Weekly training and office hours that get nontechnical teams to confident, compliant AI use.",
      },
      {
        title: "Honest scoping",
        body: "Build versus buy analyses with real costs, including the ones that say don't build.",
      },
    ],
    projects: [
      {
        name: "Patient Dashboard",
        status: "In production",
        oneLiner:
          "One row per patient, every document one click away, in a practice where every system named patients differently.",
        img: "/patient-dashboard.png",
        href: "/posts/patient-dashboard",
        highlights: [
          "Patients, intake surveys, manual intake, patient experience, estimates and consultations in one place",
          "Records now join on the Denticon id, and a person's link decision always beats the matcher",
          "Data freshness went from six days behind to 2.6 minutes behind once the sync ran on a timer (measured on staging)",
          "An honest unknown: a journey step with no linked chart is never reported as a no",
        ],
      },
      {
        name: "Capacity Planner",
        status: "In production",
        oneLiner:
          "Replaced a seven sheet staffing workbook with one forward view of demand and capacity across three offices.",
        img: "/capacity-planner.png",
        href: "/posts/capacity-planner",
        highlights: [
          "Started from the workbook itself, including the fixed ranges that undercounted without a warning",
          "Burnout treated as a design goal: proposed defaults flag three heavy days in a row",
          "Cover suggestions explain themselves: five ranked keys, every reason traced to its rule",
          "Plans doctors, assistants, treatment coordinators and front desk; reschedule emails go to each office's admin director",
        ],
      },
      {
        name: "Centralized Diagnostic Filter",
      demo: "/demos/patient-assessment",
        status: "In build",
        oneLiner:
          "A diagnostic system built with the practice founder that unifies every imaging type into one doctor validated report.",
        img: "/cdf-diagnostic-filter.png",
        href: "/posts/cdf-diagnostic-filter",
        highlights: [
          "Elicited a veteran clinician's diagnostic model into a phased, buildable spec",
          "Fourteen input classes mapped to nine standardized report sections",
          "A preserved 0-200 future-tooth-loss risk score across four bands",
          "Governing rule: AI assists, doctors validate, every finding doctor-confirmed",
        ],
      },
      {
        name: "Cowork Dashboard",
      demo: "/demos/cowork-dashboard",
        status: "In production",
        oneLiner:
          "The operations dashboard leadership runs the business on: weekly Monday.com exports turned into a full funnel view.",
        img: "/cowork-dashboard.png",
        href: "/posts/cowork-dashboard",
        highlights: [
          "One definition per metric since the September rebuild, so a card and its drilldown cannot disagree",
          "Surfaced ~$460K of orphan patient value the old reports dropped",
          "Ambiguous patient to lead links cut from 31% to 5.8% with first name checks, recorded per row",
          "Weekly routine unchanged: drop four exports in a Drive folder, the dashboard rebuilds itself",
        ],
      },
      {
        name: "AI Lab & Office Hours",
        status: "Running program",
        oneLiner:
          "Weekly AI Power Hour sessions and open office hours for seven nontechnical departments, built from a needs survey.",
        img: "/film-and-engineering.png",
        highlights: [
          "Curriculum built from a structured 7-department needs assessment",
          "Decks generated programmatically from a build script, versioned like code",
          "Plain language, no jargon, no code; HIPAA awareness in every session",
        ],
      },
      {
        name: "Hybridge CRM blueprint",
        status: "Design complete",
        oneLiner:
          "A ready to build architecture for moving 15K patient records off Monday.com, with a marketing firewall that can't leak PHI.",
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
          "A self serve platform where the finance lead runs every accounting ETL himself, about 400 hours a year back.",
        img: "/accounting-automation.png",
        href: "/posts/accounting-automation",
        highlights: [
          "Zero-trust access via Cloud IAP; adding a user is a UI action, not a gcloud command",
          "Success criterion: the engineer is no longer needed in the loop",
        ],
      },
    ],
    articles: [
      { title: "The patient dashboard and the Denticon mirror behind it", href: "/posts/patient-dashboard", img: "/patient-dashboard.png" },
      { title: "Replacing a staffing workbook with a capacity planner", href: "/posts/capacity-planner", img: "/capacity-planner.png" },
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
      "I ship models with the unglamorous parts done properly, like an imaging system that replaced a $98K vendor quote for about $25 a month.",
    narrative: [
      "The CBCT scan validator at Hybridge is the project that taught me what production ML actually costs. The model is the small part: a self-supervised spatiotemporal masked autoencoder that runs inference in 58 milliseconds on half a gigabyte of VRAM. The big part is everything that keeps it honest: a fully automated, versioned training data pipeline where training and inference share one preprocessing path, and a weekly CI/CT job that evaluates against a deterministic holdout and refuses to promote a model that fails the gate.",
      "I benchmarked six architectures behind one shared interface before picking the production model: a 2D ConvNeXt baseline, a hybrid transformer, a 3D CNN, an nnU-Net adapter, a VAE anomaly detector, and the ST-MAE that won. When the model is wrong, confidence thresholds route the scan to a human instead of pretending.",
      "Before Hybridge, I spent a year and a half at NYU researching whether RLHF methods (PPO, GRPO) could make Llama a measurably better persuader. Reward modeling and preference optimization, the same machinery behind modern aligned models, pointed at argument quality. That training-side depth is why I trust myself to debug the serving side.",
    ],
    points: [
      { lead: "The model is the small part.", text: "The scan validator's masked autoencoder runs in 58 milliseconds on half a gigabyte of VRAM." },
      { lead: "One path for train and serve.", text: "Training and inference share one preprocessing path in a fully automated, versioned data pipeline." },
      { lead: "Bad models don't ship.", text: "A weekly job tests each model on a fixed holdout and refuses to promote one that fails." },
      { lead: "Six architectures, one interface.", text: "I benchmarked six, from a ConvNeXt baseline to nnU-Net and a VAE, before the ST-MAE won." },
      { lead: "Unsure scans go to a person.", text: "Confidence thresholds route a scan to a human instead of pretending." },
      { lead: "Depth on the training side.", text: "Eighteen months at NYU researching whether PPO and GRPO could make Llama a better persuader." },
    ],
    strengths: [
      {
        title: "No train/serve skew",
        body: "One ETL path feeds training and inference, with versioned tensors and idempotent processing.",
      },
      {
        title: "Gated promotion",
        body: "Weekly holdout evaluation with an accuracy gate; a model that fails it doesn't ship.",
      },
      {
        title: "Training-side depth",
        body: "RLHF, PPO and GRPO at NYU; self supervised pretraining (DINO, ST-MAE) at Hybridge.",
      },
      {
        title: "Cost-conscious serving",
        body: "Scale to zero Cloud Run, about $25 a month against a $98K vendor quote.",
      },
    ],
    projects: [
      {
        name: "CBCT Scan Validator",
      demo: "/demos/scan-validator",
        status: "In production",
        oneLiner:
          "Catches bad dental CT scans at upload across 13 artifact classes, before a designer wastes hours on them.",
        img: "/cbct-validator.png",
        href: "/posts/cbct-scan-validator",
        highlights: [
          "Six architectures benchmarked behind one interface; ST-MAE won on accuracy-per-watt",
          "Event-driven inference: scan lands in storage, verdict email in ~20 seconds",
          "~$125K year-one cost displacement vs the vendor proposal",
          "Fully automated versioned training pipeline; new labeled scans flow in continuously",
        ],
      },
      {
        name: "Daily Sales Report",
        status: "In production",
        oneLiner:
          "Forecasts lab revenue and new arch starts for this month and the next two, calibrated to about 68% coverage.",
        img: "/daily-sales-report.png",
        href: "/posts/daily-sales-report",
        highlights: [
          "Current month revenue error falls from 4.2% early in the month to 1.5% late",
          "No auto tuning: the best in sample grid lost 0.62 points out of sample, so it stayed out",
          "A better lag model waits behind a switch until its gain clears the noise floor",
          "Gemini commentary checked number by number, with a deterministic template as the fallback",
        ],
      },
      {
        name: "LLM Persuasion (NYU research)",
        status: "Research",
        oneLiner:
          "Eighteen months making Llama argue better: a reward model for argument quality, then PPO and GRPO fine tuning.",
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
          "MLOps for a loan default model: MLflow, Airflow, Kubernetes, and CI/CD that retrains and redeploys without a human.",
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
          "Spark pipeline with LSH candidate generation and ALS collaborative filtering, built for a scale where O(n²) is a budget line.",
        img: "/customer-segmentation.png",
        href: "/posts/recsys-spark-bigdata",
      },
    ],
    articles: [
      { title: "How I built a validator that catches bad dental scans", href: "/posts/cbct-scan-validator", img: "/cbct-validator.png" },
      { title: "A daily sales forecast that refuses to tune itself", href: "/posts/daily-sales-report", img: "/daily-sales-report.png" },
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
    accent: "#F43F5E",
    rgb: "244, 63, 94",
    icon: "fa-solid fa-code",
    tagline:
      "The foundation under everything else: schemas with invariants, test pyramids, infrastructure as code, and systems that survive their author.",
    summary:
      "Every AI system I ship sits in software built to last: databases that enforce their rules, strict typing, over a thousand tests, and runbooks.",
    narrative: [
      "My favorite class of bug is the one the database makes impossible. The treatment estimator rewrite freezes every price at the moment it's captured, with the price, tier and price book version stored on every saved line and read back as saved, because a patient quoted $38,000 in March deserves the same number in September, and a policy memo is weaker than a constraint.",
      "I hold solo projects to team standards, because when you're the only engineer there is no one else to catch it: strict typing across the board, four-tier test pyramids with golden-file fixtures, idempotency at every boundary so replays never duplicate, CI/CD with keyless auth, and infrastructure that rebuilds from a clean checkout with one command.",
      "The discipline pays off in unglamorous ways. The dashboard ships with a second, independent implementation of every metric purely as an audit oracle. The accounting platform's tests verify outputs byte for byte. The NPC pipeline's 1,156 tests run against in-memory fakes, so no test ever touches real patient data. Boring on purpose, and durable because of it.",
    ],
    points: [
      { lead: "Quotes that never drift.", text: "A patient quoted $38,000 in March sees the same number in September: every saved line keeps its price." },
      { lead: "Team standards, solo.", text: "Strict typing and four tier test pyramids, because when I'm the only engineer, no one else catches it." },
      { lead: "Safe to run twice.", text: "Idempotency at every boundary, so a replay never duplicates anything." },
      { lead: "Rebuilds in one command.", text: "Keyless CI/CD and infrastructure that rebuilds from a clean checkout with one command." },
      { lead: "Every metric, computed twice.", text: "The dashboard ships an independent second implementation of every metric, purely as an audit." },
      { lead: "No patient data in tests.", text: "The NPC pipeline's 1,156 tests run against in memory fakes, so none touches real patient data." },
    ],
    strengths: [
      {
        title: "Invariants in the database",
        body: "Captured prices stored with the quote, append only ledgers, revision snapshots.",
      },
      {
        title: "Test discipline at solo scale",
        body: "1,156 tests on one system, all on in memory fakes with no real PHI.",
      },
      {
        title: "Idempotency everywhere",
        body: "Webhooks, ledger appends, uploads, ETL runs: replay anything, duplicate nothing.",
      },
      {
        title: "Built to be left",
        body: "Terraform, runbooks, ADRs and admin panels, so the system doesn't need its author.",
      },
    ],
    projects: [
      {
        name: "Patient Dashboard",
        status: "In production",
        oneLiner:
          "Two Cloud Run services from one image: a credential free dashboard and a sync that mirrors Denticon into Firestore.",
        img: "/patient-dashboard.png",
        href: "/posts/patient-dashboard",
        highlights: [
          "Only query parameters proven to change totalCount are allowed; the query builder throws on anything else",
          "The freshness report starts from the cursors it expects, so a missing one shows as the worst status",
          "Link writes are transactions that decide again on fresh reads, and every link is versioned, audited and undoable",
          "Bearer checks where an unset secret closes the door and a length mismatch costs the same as a wrong key",
        ],
      },
      {
        name: "Capacity Planner",
        status: "In production",
        oneLiner:
          "A pnpm monorepo: pure TypeScript engine, Postgres on Cloud Run, read only source access enforced by a type test.",
        img: "/capacity-planner.png",
        href: "/posts/capacity-planner",
        highlights: [
          "1,600+ tests: engine, web unit, Postgres integration with testcontainers, and Playwright",
          "A mass cancel guard: a sync that would cancel an office's bookings in bulk changes nothing",
          "Logs carry Postgres error codes, never SQL parameters that could hold a patient's name",
          "48 tagged releases in its first eight days, deployed only on tags through Workload Identity Federation",
        ],
      },
      {
        name: "Treatment Estimator",
      demo: "/demos/treatment-estimator",
        status: "In production",
        oneLiner:
          "The chairside pricing tool, shipped in about a month after a vendor failed at it for ten years.",
        img: "/treatment-estimator.png",
        href: "/posts/treatment-estimator",
        highlights: [
          "Frozen prices: every saved line keeps its captured price and price book version",
          "Per-location price books with propose/approve workflows, so pricing changes need no developer",
          "Six-year estimate reproducibility for HIPAA record-keeping",
          "~$35/month total cloud footprint",
        ],
      },
      {
        name: "Treatment Sequence",
        status: "In production",
        oneLiner:
          "Turns an accepted estimate into a visit plan from a practice master, never a guess, exported to Word and PDF.",
        img: "/treatment-sequence.png",
        href: "/posts/treatment-sequence",
        highlights: [
          "Never invents a visit, never guesses a template, never makes up a date",
          "A living plan plus immutable version snapshots, with a unique index as the concurrency guard",
          "Shipped as a committed build snapshot: no registry, no token to expire, and a check that core and ui share one commit",
          "The Word export embeds Inter after it kept opening in Times New Roman",
        ],
      },
      {
        name: "Accounting automation platform",
        status: "In production",
        oneLiner:
          "FastAPI behind Cloud IAP: upload a file, get the right ETL script recommended, run it, download the output.",
        img: "/accounting-automation.png",
        href: "/posts/accounting-automation",
        highlights: [
          "Golden-file tests: outputs verified byte-identical against fixtures",
          "In-browser script editing that commits to GitHub, so fixes ship without a terminal",
          "Keyless CI/CD via Workload Identity Federation",
        ],
      },
      {
        name: "NPC pipeline engineering",
      demo: "/demos/npc-coach",
        status: "In production",
        oneLiner:
          "19K lines of Python across 19 modules and 1,156 tests, with strict typing and a ports and adapters design.",
        img: "/npc-coach.png",
        href: "/posts/npc-coach",
        highlights: [
          "Ports-and-adapters: a new call source is one new adapter; tests bind in-memory fakes",
          "One NPC_BAA_ACCEPTED switch gates all real PHI; 1,156 tests touch no cloud and no PHI",
        ],
      },
      {
        name: "JobPilot",
      demo: "/demos/jobpilot",
        status: "Live",
        oneLiner:
          "My open source job hunt autopilot watching 160+ company boards, and the one project that spans all four disciplines.",
        img: "/jobpilot-flagship.png",
        href: "/posts/jobpilot-v2",
        highlights: [
          "Open-sourced under MIT with a fork guide written to hand to an AI coding agent",
          "Tailors a resume and cover letter per match; every resume ships its own ATS report",
          "Grounded AI copilot with a per-job chat drawer over the live job description",
          "A multi-page Next.js console behind IAP, the Google Sheet as the database, keyless CI/CD on Workload Identity Federation",
        ],
      },
      {
        name: "Case Intake",
        status: "Prototype",
        oneLiner:
          "A morning list of lab cases that duplicate an earlier scan case, so customer service can merge them.",
        highlights: [
          "Name matching forgives case, spacing, a middle initial, swapped names and one typo; anything more is a different person",
          "The data source sits behind an interface: sample data now, the vendor API and Firestore once the license lands",
        ],
      },
      {
        name: "Hybridge Forms",
        status: "In build",
        oneLiner:
          "Replaces a Tally, Zapier and Monday chain on four company websites, built so no submission is ever lost.",
        highlights: [
          "About 11 of 18 build tasks done and 1,300+ tests; not deployed yet",
          "The importer handles all 32 live Tally forms",
        ],
      },
      {
        name: "This website",
        status: "Live",
        oneLiner:
          "Astro and Tailwind, a hand built design system, React islands and a free tier chatbot, deployed by GitHub Actions.",
        img: "/pic.png",
      },
    ],
    articles: [
      { title: "The patient dashboard and the Denticon mirror behind it", href: "/posts/patient-dashboard", img: "/patient-dashboard.png" },
      { title: "Replacing a staffing workbook with a capacity planner", href: "/posts/capacity-planner", img: "/capacity-planner.png" },
      { title: "Rebuilding a 10-year-old pricing tool in a month", href: "/posts/treatment-estimator", img: "/treatment-estimator.png" },
      { title: "Turning hand built visit plans into shared packages", href: "/posts/treatment-sequence", img: "/treatment-sequence.png" },
      { title: "Pipeline observability and silent-failure hardening", href: "/posts/pipeline-ghosting", img: "/pipeline-ghosting.png" },
      { title: "Accounting automation: 400 hours a year", href: "/posts/accounting-automation", img: "/accounting-automation.png" },
    ],
    heroImg: "/discipline-sde.png",
  },
];

export const disciplineBySlug = (slug: string) =>
  disciplines.find((d) => d.slug === slug);
