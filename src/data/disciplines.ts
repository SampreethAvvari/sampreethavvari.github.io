// Single source of truth for the four-disciplines section on the landing page
// and the /work area. Order is intentional everywhere: AIE, FDE, MLE, SDE.
// `accent` and `rgb` only colour the mind graph's stars now; the /work pages
// tell disciplines apart by name, never by colour.

export type DxStatus =
  | "In production"
  | "Pilot-ready"
  | "In build"
  | "In testing"
  | "Design complete"
  | "Running program"
  | "Live"
  | "Paused"
  | "Offline"
  | "Open source"
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
      "I build LLM pipelines for a dental practice that fill a schema, quote their evidence, keep patient fields out of logs, and leave the final call to a person.",
    narrative: [
      "Most of my AI work has shipped inside Hybridge, a dental implant practice with three offices and a lab. Real patients and real doctors read what these systems write, so the model never free writes. It fills a validated JSON schema, quotes the transcript with a real timestamp for every rationale, and a response that did not finish cleanly is never accepted.",
      "The pattern repeats across systems. The consult grader colors each score against that doctor's own 30 day average. The call coaching platform has Gemini return integers and gate answers while plain Python does the math, so the same verdict always gives the same score. The patient record matcher refuses when unsure, and a coordinator's decision always wins.",
      "The interesting work is everything around the prompt: schemas, retries, fallback models, audit trails, and deciding where a human stays in the loop.",
    ],
    points: [
      { lead: "Built for a dental practice.", text: "Doctors, coordinators and patients read what these systems write, so there is no room for confident nonsense." },
      { lead: "The model fills a schema.", text: "It fills a validated JSON schema and quotes the transcript, with a timestamp, for every rationale." },
      { lead: "The code does the math.", text: "Gemini returns integers and gate answers, and plain Python turns them into the score." },
      { lead: "Patient fields stay out of logs.", text: "The forms logger drops answers, names, emails and phones by name and by shape." },
      { lead: "A person decides the match.", text: "The record matcher refuses when unsure, and a coordinator's link decision always wins." },
      { lead: "The prompt is the small part.", text: "The real work is schemas, retries, fallback models, audit trails and where a human stays in the loop." },
    ],
    strengths: [
      {
        title: "Structured output, enforced",
        body: "Schemas with validation, retries and fallback models. The model fills a contract.",
      },
      {
        title: "Evidence behind every score",
        body: "Every score quotes the transcript with a timestamp, or it does not get said.",
      },
      {
        title: "Patient data kept out of logs",
        body: "Loggers that drop patient fields by name and by shape, and one service holding the practice system's credentials.",
      },
      {
        title: "Humans where it matters",
        body: "Uncertain matches wait for a person. AI proposes; people approve anything irreversible.",
      },
    ],
    projects: [
      {
        name: "Enterprise Search (RAG)",
        demo: "/demos/enterprise-search",
        status: "Paused",
        oneLiner:
          "An internal search over Hybridge documents that cites the exact passage, filtered by who may see what. Paused since October 2026.",
        img: "/enterprise-search.png",
        href: "/posts/enterprise-search",
        highlights: [
          "Two searches in one Postgres, pgvector by meaning and full text by exact words, reranked to 8 passages",
          "Conflict rules: superseded versions drop out, then authority, then effective date",
          "Group access is a SQL condition inside both searches, so a restricted passage never becomes a candidate",
          "A seeded retrieval test fails the build below recall at 8 of 0.8 or MRR of 0.35",
        ],
      },
      {
        name: "Doc Coach: Consultation QA",
        demo: "/demos/doc-coach",
        status: "In production",
        oneLiner:
          "Every Zoom consult scored by Gemini on seven clinical criteria; in October the median report landed 2.7 minutes after the transcript.",
        img: "/doc-coach.png",
        href: "/posts/clinical-rag",
        highlights: [
          "471 consults scored live from May 19 to Oct 28 across three offices",
          "Three layer doctor identity: Zoom participants, then transcript speakers, then names Gemini pulls out",
          "Truncation and schema failures handled apart; no second scoring attempt needed in October",
          "Weekly and monthly report cards for every doctor, with nobody pressing send",
        ],
      },
      {
        name: "NPC Coach: Call Coaching",
        demo: "/demos/npc-coach",
        status: "In production",
        oneLiner:
          "Finds the new patient calls among thousands of recordings and grades each against the playbook, with a quote behind every criterion.",
        img: "/npc-coach.png",
        href: "/posts/npc-coach",
        highlights: [
          "690 real calls graded since June 17, a median 14 minutes after the call ends",
          "Hard gates show as a flag beside the score: a call can score 84 and still carry a missed gate",
          "The model returns integers and gate answers; plain Python does the 40/40/20 math",
          "Booking rate is not graded. The playbook calls a patient who books to get off the phone a failure of advocacy",
        ],
      },
      {
        name: "CDF: Gemini reads the patient first",
        demo: "/demos/patient-assessment",
        status: "In production",
        oneLiner:
          "Gemini writes the doctor's page from the intake survey and reads the panorex under the founder's own rules; a doctor makes the call.",
        img: "/cdf-diagnostic-filter.png",
        href: "/posts/cdf-diagnostic-filter",
        highlights: [
          "A ruleset written from four cases the founder read aloud, each rule citing its case and timestamp",
          "The model lists the teeth, and plain code recomputes the score",
          "Every Gemini call has a way out: retries on the same model, then newer models, inside a time budget",
          "The clinic email waits for both reports",
        ],
      },
      {
        name: "Marketing Data Warehouse",
        status: "In production",
        oneLiner:
          "A BigQuery warehouse joining ten marketing sources, ad spend to treatment value, documented so LLMs read a guide first.",
        img: "/marketing-warehouse.png",
        href: "/posts/marketing-warehouse",
        highlights: [
          "All 657 staging and marts columns described, plus a data guide written for LLMs to read first",
          "3,334 of 3,383 lead to patient matches come from the link staff already keep in Monday",
          "A weekly Gemini eval on 22 golden questions scored 21 of 22 on October 26",
          "A 6:30 AM email with one tab per source, every morning since October 22",
        ],
      },
      {
        name: "Marketing Data Connector",
        status: "In production",
        oneLiner:
          "A Claude connector over the warehouse: sign in with Google once, and query only the data an owner ticked.",
        img: "/data-connector.png",
        href: "/posts/data-connector",
        highlights: [
          "Live three hours after the first connector code on October 23",
          "A guard points every table at the asker's own dataset of views before anything runs",
          "469 tool calls from 3 people in its first seven days",
        ],
      },
      {
        name: "CRM intelligence layer",
        status: "Design complete",
        oneLiner:
          "Duplicate patients proposed by an LLM with mandatory human review, plus structured extraction of free text activity logs.",
        img: "/cowork-dashboard.png",
        highlights: [
          "No merges on its own. The data has 74 shared phone numbers (married couples)",
          "Every parse carries a confidence score and source reference for reruns",
          "Consent tokens extracted into an append only ledger",
        ],
      },
      {
        name: "Portfolio chatbot",
        status: "Live",
        oneLiner:
          "The assistant in the corner of this site, on Cloudflare Workers AI and running on the free tier.",
        img: "/jobpilot-judge.png",
        href: "/posts/jobpilot-v2",
        highlights: [
          "Free tier serving on Workers AI, with no API keys and no vector database",
          "Context as code: site copy compiled into the worker at deploy time",
        ],
      },
    ],
    articles: [
      { title: "The CEO's consult checklist now grades every Zoom consult", href: "/posts/clinical-rag", img: "/doc-coach.png" },
      { title: "Every new patient call graded, with the quote behind each score", href: "/posts/npc-coach", img: "/npc-coach.png" },
      { title: "Gemini reads the patient first, and the clinic waits for both reports", href: "/posts/cdf-diagnostic-filter", img: "/cdf-diagnostic-filter.png" },
      { title: "Ten marketing sources joined by 6 AM and in the inbox by 6:30", href: "/posts/marketing-warehouse", img: "/marketing-warehouse.png" },
      { title: "A company search that cites its sources or says it does not know", href: "/posts/enterprise-search", img: "/enterprise-search.png" },
      { title: "JobPilot: the open source app that ran my job hunt", href: "/posts/jobpilot-v2", img: "/jobpilot-flagship.png" },
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
      "My role at Hybridge is titled AI engineer, and the work is embedded engineering: the people I build for are surgeons, a VP of finance, treatment coordinators, an operations lead and the lab, and none of them write tickets. Requirements live in their spreadsheets, their meeting transcripts and their workarounds. The discovery work is the work.",
      "The leadership dashboard is the cleanest example. It joined patients to leads by name, and in a June review one office's consults read zero. I measured the join, moved it to the patient boards' own connect column, and the fix surfaced about $460K of patient value that no lead pointed at. Later the finance lead filed a request in the dashboard's own Feature requests tab, and it was live 18 minutes later.",
      "The other half is enablement. I started a weekly AI Power Hour and office hours for seven nontechnical departments, built from a needs survey, with privacy and compliance covered in every session.",
      "And sometimes the most valuable deliverable is the honest no. The CRM blueprint I wrote tells leadership plainly: without funded engineering, the correct decision is to stay on the current vendor.",
    ],
    points: [
      { lead: "No one writes tickets.", text: "My users are surgeons, a VP of finance, treatment coordinators, an operations lead and the lab." },
      { lead: "Discovery is the work.", text: "Requirements live in their spreadsheets, meeting transcripts and workarounds, so that is where I dig." },
      { lead: "Build where they work.", text: "The planner started from the operations lead's own workbook, and the doctor portal from the lab lead's own mockup." },
      { lead: "Fix the data first.", text: "Fixing the broken patient to lead join surfaced about $460K of patient value the old reports dropped." },
      { lead: "Ask, then ship.", text: "Six apps share one feature request list, and a request filed on October 28 was live 18 minutes later." },
      { lead: "The honest no.", text: "My CRM blueprint tells leadership plainly: without funded engineering, stay on the current vendor." },
    ],
    strengths: [
      {
        title: "Discovery from primary sources",
        body: "Requirements from real exports, transcripts and mockups: eight data problems catalogued with row counts.",
      },
      {
        title: "Ship into existing workflows",
        body: "Monday boards for leadership, a web page for finance, email reports for doctors.",
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
          "The Denticon mirror went from 6.0 days behind to 2.6 minutes behind once the sync ran on a timer",
          "A journey step with no linked chart is reported as unknown",
        ],
      },
      {
        name: "Capacity Planner",
        status: "In production",
        oneLiner:
          "Replaced a workbook of twenty pasted weeks with one forward view of demand and capacity across three offices.",
        img: "/capacity-planner.png",
        href: "/posts/capacity-planner",
        highlights: [
          "Started from the workbook itself, including the fixed ranges that undercounted without a warning",
          "Burnout treated as a design goal: proposed defaults flag three heavy days in a row",
          "Cover suggestions explain themselves: five ranked keys, every reason traced to its rule",
          "The operations lead and office directors plan from it every day, with a 7 AM weekday email of what needs action",
        ],
      },
      {
        name: "Doctor Portal",
        status: "Prototype",
        oneLiner:
          "The lab's own doctor portal, where the Rx joins the case the scanner made. Live on sample data.",
        img: "/doctor-portal.png",
        href: "/posts/doctor-portal",
        highlights: [
          "Built from the lab lead's own July mockup",
          "Top priority to a working live link in 3.7 hours",
          "Every release note lists what is still pretend; real data waits on a vendor license",
        ],
      },
      {
        name: "Launchpad",
        status: "In production",
        oneLiner:
          "Every Hybridge app on one board, the work in progress for four leaders, and one feature request list six apps share.",
        img: "/launchpad.png",
        href: "/posts/launchpad",
        highlights: [
          "A working live board 78 minutes after the first commit",
          "38 projects on one board, 22 of them live, with every edit logged",
          "A request filed in the Cowork Dashboard on October 28 was live 19 minutes later",
        ],
      },
      {
        name: "Cowork Dashboard",
        demo: "/demos/cowork-dashboard",
        status: "In production",
        oneLiner:
          "The operations dashboard leadership runs the business on: Monday.com boards turned into a full funnel view.",
        img: "/cowork-dashboard.png",
        href: "/posts/cowork-dashboard",
        highlights: [
          "One definition per metric since the September rebuild, so a card and its drilldown cannot disagree",
          "Surfaced about $460K of patient value on 25 retreatment cases the old join dropped",
          "Ambiguous patient to lead links cut from 31% to 5.8% with first name checks, recorded per row",
          "Cash flow reads the three patient boards from the Monday API every morning at 6",
        ],
      },
      {
        name: "AI Lab & Office Hours",
        status: "Running program",
        oneLiner:
          "Weekly AI Power Hour sessions and open office hours for seven nontechnical departments, built from a needs survey.",
        img: "/film-and-engineering.png",
        highlights: [
          "Curriculum built from a structured needs survey across seven departments",
          "Decks generated from a build script, versioned like code",
          "Plain language, no jargon, no code; privacy and compliance in every session",
        ],
      },
      {
        name: "Hybridge CRM blueprint",
        status: "Design complete",
        oneLiner:
          "A ready to build architecture for moving about 15K patient records off Monday.com, with a marketing firewall around patient data.",
        img: "/enterprise-data.png",
        highlights: [
          "The PRD says it plainly: without funded maintenance, don't build this",
          "Human in the loop dedup; reversible merges; an audit log that captures reads as well as writes",
          "NY SHIELD analysis citing a $2.85M settlement in Hybridge's own market",
        ],
      },
      {
        name: "Accounting automation platform",
        status: "Offline",
        oneLiner:
          "Our controller's nine accounting scripts on one page behind IAP: upload, answer one form, download. Built in an evening.",
        img: "/accounting-automation.png",
        href: "/posts/accounting-automation",
        highlights: [
          "26 prompts across the nine old scripts, now asked up front in one form",
          "The browser editor our controller asked for was live 3.7 hours after the first commit",
        ],
      },
    ],
    articles: [
      { title: "Every patient record on one Denticon chart, linked without guessing", href: "/posts/patient-dashboard", img: "/patient-dashboard.png" },
      { title: "A twenty copy Excel workbook became a live capacity planner", href: "/posts/capacity-planner", img: "/capacity-planner.png" },
      { title: "From top priority to a live doctor portal in under four hours", href: "/posts/doctor-portal", img: "/doctor-portal.png" },
      { title: "Every number defined once, and cash flow read every morning", href: "/posts/cowork-dashboard", img: "/cowork-dashboard.png" },
      { title: "Every Hybridge app on one board, every request in one list", href: "/posts/launchpad", img: "/launchpad.png" },
      { title: "Nine accounting scripts moved to one page in an evening", href: "/posts/accounting-automation", img: "/accounting-automation.png" },
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
      "I ship models with the unglamorous parts done properly, like a dental CT checker built in 38 days that cost $62 on Google Cloud in October, against a $98,200 vendor quote.",
    narrative: [
      "The CBCT scan validator at Hybridge taught me what production ML costs. The model is the small part: a frozen DentalSegmentator encoder with a small head, running on CPU with OpenVINO. The big part is everything that keeps it honest: a 20 scan holdout kept out of training, a threshold priced in rescans, and a training data job with a lock so overlapping runs never multiply the work.",
      "Six candidate models sat behind one interface by April 7. The first one that worked scored 0.80 AUROC, and seven of its ten bad holdout studies had been in its training data. I rebuilt the split and kept the honest 0.6309.",
      "Before Hybridge, I spent my NYU research training Llama 3 8B to argue: SFT, a reward model trained on ChangeMyView deltas, then GRPO against it. That training side depth is why I trust myself to debug the serving side.",
    ],
    points: [
      { lead: "The model is the small part.", text: "A frozen dental segmentation encoder runs on CPU in 2.2 seconds; the rest is the data pipeline, the holdout and the threshold." },
      { lead: "One transform for train and serve.", text: "In Loan Radar, training and the scoring API load the same saved transform, fit on training rows only." },
      { lead: "A holdout that stays out.", text: "A frozen 20 scan holdout stays out of training, and it caught a leaky 0.80 AUROC." },
      { lead: "Six models, one interface.", text: "Six candidates sat behind one interface by April 7 before Model H won." },
      { lead: "Thresholds priced in rescans.", text: "A missed bad scan costs 15 times a false flag, and the threshold is set from that." },
      { lead: "Depth on the training side.", text: "At NYU I trained Llama 3 8B to argue with SFT, a reward model and GRPO." },
    ],
    strengths: [
      {
        title: "No train and serve skew",
        body: "Training and serving load one saved transform, fit on training rows only.",
      },
      {
        title: "Honest evaluation",
        body: "A holdout kept out of training, and the honest number kept when a leaky one looked better.",
      },
      {
        title: "Training side depth",
        body: "SFT, reward models and GRPO at NYU; a frozen segmentation encoder with a tuned head at Hybridge.",
      },
      {
        title: "Cost aware serving",
        body: "Scale to zero Cloud Run, $62 measured in October against a vendor quote of $98,200 to build.",
      },
    ],
    projects: [
      {
        name: "CBCT Scan Validator",
        demo: "/demos/scan-validator",
        status: "In testing",
        oneLiner:
          "Flags bad dental CT scans before a designer opens the case: good or bad, an artifact family, and a class from rules.",
        img: "/cbct-validator.png",
        href: "/posts/cbct-scan-validator",
        highlights: [
          "Six candidate models behind one interface; a frozen DentalSegmentator encoder with a small head won",
          "Event driven: a scan lands in storage, Eventarc fires, and a real zip went end to end in 26.7 seconds",
          "Of 30 real studies the testing team marked bad, the model flagged 26",
          "$62 on Google Cloud in October, measured",
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
          "Training Llama 3 8B to argue: SFT, a reward model trained on ChangeMyView deltas, then GRPO against that judge.",
        img: "/llm-persuasion.png",
        href: "/posts/llama-rlhf",
        highlights: [
          "Preference pairs from ChangeMyView: a reply that earned a delta against one that did not",
          "4 bit Llama 3 8B under every stage, with LoRA rank 64 doing the learning",
        ],
      },
      {
        name: "Loan Radar",
        status: "Academic",
        oneLiner:
          "MLOps for a loan default model on Chameleon Cloud: containerized ETL, MLflow on Postgres and MinIO, a FastAPI scorer and stress tests.",
        img: "/loan-radar.png",
        href: "/posts/loan-radar-mlops",
        highlights: ["Training and serving load one saved transform"],
      },
      {
        name: "ResNet under 5M parameters",
        status: "Academic",
        oneLiner:
          "CIFAR-10 under a hard parameter cap: augmentation took the model from 93.76% to 97.12% without adding a parameter.",
        img: "/resnet-compact.png",
        href: "/posts/resnet-under-5m",
      },
      {
        name: "Movie twins at 33.8M ratings",
        status: "Academic",
        oneLiner:
          "MinHash and LSH found movie twins among 330,975 users after Spark kept losing nodes, beside a Spark ALS recommender.",
        img: "/customer-segmentation.png",
        href: "/posts/recsys-spark-bigdata",
      },
    ],
    articles: [
      { title: "A dental CT scan checker in 38 days, on CPU, for $62 a month", href: "/posts/cbct-scan-validator", img: "/cbct-validator.png" },
      { title: "The finance forecast now builds itself by 6:25 every weekday", href: "/posts/daily-sales-report", img: "/daily-sales-report.png" },
      { title: "I taught Llama 3 to argue with a judge trained on Reddit deltas", href: "/posts/llama-rlhf", img: "/llm-persuasion.png" },
      { title: "Loan Radar: training and serving that load one saved transform", href: "/posts/loan-radar-mlops", img: "/loan-radar.png" },
      { title: "Augmentation took our capped ResNet to 97.12% on CIFAR-10", href: "/posts/resnet-under-5m", img: "/resnet-compact.png" },
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
      "Every AI system I ship sits in software built to last: databases that enforce their rules, strict typing, tests that run before a deploy, and runbooks.",
    narrative: [
      "My favorite class of bug is the one the database makes impossible. The treatment estimator keeps four fields on every saved line (price, tier, label and price book version) and reads them back as saved, because a patient quoted in March deserves the same number in September, and a policy memo is weaker than a constraint.",
      "I hold solo projects to team standards, because when you're the only engineer there is no one else to catch it: strict typing, golden tests against the system being replaced, idempotency at every boundary so replays never duplicate, and deploys that run from a clean checkout.",
      "The discipline pays off in unglamorous ways. The capacity planner's engine reproduces all 360 day cells of the old workbook on every test run. Before the leadership dashboard moved to Cloud Run, the old code ran against the same exports and every metric was diffed. The capacity planner cannot write to Denticon, because a test fails the build if a write method appears.",
    ],
    points: [
      { lead: "Quotes that never drift.", text: "Every saved line keeps its price, tier, label and price book version, so a later price change never reaches it." },
      { lead: "Team standards, solo.", text: "Strict typing and golden tests, because when I'm the only engineer, no one else catches it." },
      { lead: "Safe to run twice.", text: "Idempotency at every boundary, so a replay never duplicates anything." },
      { lead: "Read only, by test.", text: "The capacity planner has 0 write methods toward Denticon, held there by a test that fails the build." },
      { lead: "Golden against the old system.", text: "The planner's engine reproduces 360 of 360 day cells from the workbook it replaced." },
      { lead: "One key holder.", text: "One service holds the Denticon credentials, and every other app reads the mirror through a registry." },
    ],
    strengths: [
      {
        title: "Invariants in the database",
        body: "Captured prices stored with the quote, append only ledgers, revision snapshots.",
      },
      {
        title: "Tests that hold the line",
        body: "Golden tests against the system being replaced, and type tests that fail the build on a forbidden method.",
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
          "Two Cloud Run services from one image: a dashboard with no Denticon credentials and a sync that mirrors Denticon into Firestore.",
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
          "360 of 360 day cells from the old workbook reproduced on every test run",
          "A mass cancel guard: a sync that would cancel an office's bookings in bulk changes nothing",
          "The logger records only the Postgres error code, constraint and table, so no SQL parameter reaches a log",
          "17 days from the first commit to production, deployed through Workload Identity Federation",
        ],
      },
      {
        name: "Treatment Estimator",
        demo: "/demos/treatment-estimator",
        status: "In production",
        oneLiner:
          "The chairside pricing tool: v1.0.0 in 14.5 hours, and a saved price never moves.",
        img: "/treatment-estimator.png",
        href: "/posts/treatment-estimator",
        highlights: [
          "Frozen prices: every saved line keeps its captured price, tier, label and price book version",
          "Per office price books that only an admin can publish, so pricing changes need no developer",
          "Presented versions frozen as snapshots; reopening moves rows into the next revision",
          "$34 measured for October 1 to 28",
        ],
      },
      {
        name: "Treatment Sequence",
        status: "In production",
        oneLiner:
          "Turns an accepted estimate into a visit plan from one of eleven practice masters, exported to Word and PDF.",
        img: "/treatment-sequence.png",
        href: "/posts/treatment-sequence",
        highlights: [
          "0 errors in 271 generation attempts across 75 live estimates, production audit of Aug 27",
          "A living plan plus immutable version snapshots, with a unique index as the concurrency guard",
          "Shipped as a committed build snapshot: no registry, no token to expire, and a check that core and ui share one commit",
          "Masters transcribed whole, because glued single arch plans put visit 6 and visit 8 in the wrong order",
        ],
      },
      {
        name: "Hybridge Forms",
        status: "In production",
        oneLiner:
          "Replaced the Tally, Zapier and Monday chain on our practice websites, built so no submission is ever lost.",
        img: "/hybridge-forms.png",
        href: "/posts/hybridge-forms",
        highlights: [
          "Firestore first, a private Cloud Storage bucket as the fallback, and the browser retries with the same id",
          "The logger drops patient fields by name and by shape, so no answer reaches a log line",
          "The importer handles all 32 live Tally forms; live since October 6",
        ],
      },
      {
        name: "Accounting automation platform",
        status: "Offline",
        oneLiner:
          "FastAPI behind Cloud IAP: upload a file, answer one form, run the script, download the output.",
        img: "/accounting-automation.png",
        href: "/posts/accounting-automation",
        highlights: [
          "One shared contract for every script, with the first one tested end to end from upload to download",
          "In browser script editing that commits to GitHub, so fixes ship without a terminal",
          "Keyless CI/CD through Workload Identity Federation",
        ],
      },
      {
        name: "NPC pipeline engineering",
        demo: "/demos/npc-coach",
        status: "In production",
        oneLiner:
          "Ports and adapters in Python: the model returns integers and gate answers, and plain code does the math.",
        img: "/npc-coach.png",
        href: "/posts/npc-coach",
        highlights: [
          "Each stage behind a port and written test first",
          "A run lease so overlapping runs never grade or email a call twice",
        ],
      },
      {
        name: "Doctor Portal",
        status: "Prototype",
        oneLiner:
          "The lab's own doctor portal, where the Rx joins the case the scanner made, so no doctor sees a duplicate. Live on sample data.",
        img: "/doctor-portal.png",
        href: "/posts/doctor-portal",
        highlights: [
          "Top priority to a working live link in 3.7 hours",
          "Every release note lists what is still pretend; real data waits on a vendor license",
        ],
      },
      {
        name: "JobPilot",
        demo: "/demos/jobpilot",
        status: "Open source",
        oneLiner:
          "My open source job hunt autopilot that watched 163 company boards, and the one project that spans all four disciplines.",
        img: "/jobpilot-flagship.png",
        href: "/posts/jobpilot-v2",
        highlights: [
          "Open sourced under MIT with a fork guide written to hand to an AI coding agent",
          "Tailors a resume and cover letter per match, checked by a calibrated judge",
          "Ran 1,008 times from June 10 to October 8; a public demo runs on fictional data",
          "A Next.js console behind IAP, the Google Sheet as the database, keyless CI/CD on Workload Identity Federation",
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
      { title: "Every patient record on one Denticon chart, linked without guessing", href: "/posts/patient-dashboard", img: "/patient-dashboard.png" },
      { title: "A twenty copy Excel workbook became a live capacity planner", href: "/posts/capacity-planner", img: "/capacity-planner.png" },
      { title: "A quoting tool live in 14.5 hours, where a saved price stays put", href: "/posts/treatment-estimator", img: "/treatment-estimator.png" },
      { title: "Visit plans generated from the practice's own masters", href: "/posts/treatment-sequence", img: "/treatment-sequence.png" },
      { title: "Lead forms off Tally and Zapier, into our own Google Cloud", href: "/posts/hybridge-forms", img: "/hybridge-forms.png" },
      { title: "No more green checks on consults that never emailed", href: "/posts/pipeline-ghosting", img: "/pipeline-ghosting.png" },
      { title: "How one engineer runs 45 services for a three office practice", href: "/posts/platform", img: "/platform.png" },
    ],
    heroImg: "/discipline-sde.png",
  },
];

export const disciplineBySlug = (slug: string) =>
  disciplines.find((d) => d.slug === slug);
