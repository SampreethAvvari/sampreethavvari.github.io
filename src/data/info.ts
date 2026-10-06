export const info = {
  name: "Sampreeth Avvari",
  brief_description: "AI engineer and filmmaker. I build software people actually use.",
  role: "AI Engineer",
  picture: "/pic.png",
  picture_alt: "Sampreeth Avvari",
  location: "New York, NY",
  cv: "/resume",

  about: {
    description:
      "I'm an AI engineer who likes building things right next to the people who'll actually use them. After my MS at NYU, I spent the last few years as the only engineer at a dental implant company, shipping real systems people use every day, not demos. I also make movies, which is where I learned to work with people who don't write code.",
    // Everything on one axis for the About timeline. start/end are "YYYY-MM";
    // "present" pins to today. short is the label inside the bar.
    timeline: [
      {
        title: "Bachelor of Technology, Computer Science",
        short: "BTech CSE \u00b7 JNTU",
        org: "Jawaharlal Nehru Technological University",
        location: "Hyderabad, India",
        date: "July 2017 - June 2021",
        start: "2017-07",
        end: "2021-06",
        logo: "/logos/griet.png",
        accent: "#5B8DEF",
        rgb: "91,141,239",
        kind: "education",
        blurb:
          "Computer science degree at GRIET. Graduated with a 3.92 GPA and a habit of building things outside the syllabus.",
      },
      {
        title: "Software Engineer",
        short: "Software Engineer \u00b7 Shure",
        org: "Shure Incorporated",
        location: "India",
        date: "Aug 2021 - Aug 2023",
        start: "2021-08",
        end: "2023-08",
        logo: "/logos/shure.svg",
        accent: "#34D399",
        rgb: "52,211,153",
        kind: "work",
        blurb:
          "APIs and data pipelines for Shure Cloud audio analytics on AWS, plus the test automation frameworks and the CI/CD around them.",
      },
      {
        title: "Master of Science, Computer Engineering",
        short: "MS CompE \u00b7 NYU",
        org: "New York University",
        location: "New York",
        date: "Aug 2023 - May 2025",
        start: "2023-08",
        end: "2025-05",
        logo: "/logos/nyu.svg",
        accent: "#22D3EE",
        rgb: "34,211,238",
        kind: "education",
        blurb:
          "Machine learning and systems at NYU Tandon. Graduated May 2025 with a 3.84 GPA while holding two jobs on campus.",
      },
      {
        title: "Video Producer",
        short: "Video Producer \u00b7 NYU",
        org: "New York University",
        location: "New York",
        date: "Jan 2024 - May 2025",
        start: "2024-01",
        end: "2025-05",
        logo: "/logos/nyu.svg",
        accent: "#F43F5E",
        rgb: "244,63,94",
        kind: "work",
        blurb:
          "Directed and edited educational video for NYU public health faculty. Over 100 videos across 20 plus courses, shot on a Sony Alpha 7III and cut in DaVinci Resolve and Premiere Pro, with motion graphics in After Effects.",
      },
      {
        title: "Graduate Machine Learning Researcher",
        short: "ML Researcher \u00b7 NYU",
        org: "New York University",
        location: "New York",
        date: "May 2024 - Sep 2025",
        start: "2024-05",
        end: "2025-09",
        logo: "/logos/nyu.svg",
        accent: "#A78BFA",
        rgb: "167,139,250",
        kind: "work",
        blurb:
          "Language model optimization: built debate datasets and trained reward models for RLHF, then ran the SFT to GRPO and PPO lifecycle with Llama 3.1, TRL and QLoRA on NYU's HPC cluster.",
        projects: [
          { label: "How I trained Llama to argue", href: "/posts/llama-rlhf" },
        ],
      },
      {
        title: "AI Engineer",
        short: "AI Engineer \u00b7 Hybridge",
        org: "Hybridge Implants",
        location: "New York",
        date: "Sept 2025 - Present",
        start: "2025-09",
        end: "present",
        logo: "/logos/hybridge.webp",
        accent: "#F5A524",
        rgb: "245,165,36",
        kind: "work",
        blurb:
          "The AI engineer for a multi office dental implant company: RAG, agentic pipelines, evals, guardrails and MLOps, all in production on GCP and Vertex AI. Enterprise search that cites or abstains, Gemini consultation scoring, a CT scan validator that replaced a six figure vendor quote, call coaching, a pricing engine that freezes every quoted price, and a deterministic reconciliation engine.",
        projects: [
          { label: "Enterprise Search RAG", href: "/posts/enterprise-search" },
          { label: "Doc Coach", href: "/posts/clinical-rag" },
          { label: "CBCT Scan Validator", href: "/posts/cbct-scan-validator" },
          { label: "NPC Coach", href: "/posts/npc-coach" },
          { label: "Treatment Estimator", href: "/posts/treatment-estimator" },
          { label: "Reconciliation", href: "/posts/reconciliation" },
          { label: "CDF Diagnostic Filter", href: "/posts/cdf-diagnostic-filter" },
        ],
      },
    ],
    education: [
      {
        title: "Master of Science, Computer Engineering",
        date: "Aug 2023 - May 2025",
        location: "New York University, NYC, NY",
        logo: "/logos/nyu.svg",
        gpa: "3.84 / 4",
      },
      {
        title: "Bachelor of Technology, Computer Science and Engineering",
        date: "July 2017 - June 2021",
        location: "Jawaharlal Nehru Technological University, India",
        logo: "/logos/griet.png",
        gpa: "3.92 / 4",
      },
    ],
    photos: [
      {
        src: "/About%20page%20pics/Shure%201.JPG",
        alt: "Shure team moment",
        context: "Shure days. Building and testing in the lab.",
        position: "center 60%",
        tag: "Shure",
      },
      {
        src: "/About%20page%20pics/Shure%202.JPG",
        alt: "Shure office snapshot",
        context: "Graduate Engineer Trainees 2021.",
        position: "center 60%",
        tag: "Shure",
      },
      {
        src: "/About%20page%20pics/NYU%201.AVIF",
        alt: "NYU campus",
        context: "NYU. The grind, the skyline, the good kind of chaos.",
        position: "center 60%",
        tag: "Grad",
      },
      {
        src: "/About%20page%20pics/NYU%202.AVIF",
        alt: "NYU academic moment",
        context: "NYU milestones. Long nights, big wins.",
        position: "center 70%",
        tag: "Grad",
      },
      {
        src: "/About%20page%20pics/NYU%203.AVIF",
        alt: "NYU graduation era",
        context: "Graduating with my best friends, May 2025.",
        tag: "Grad",
      },
      {
        src: "/About%20page%20pics/Hybridge%201.JPG",
        alt: "Hybridge team moment",
        context: "Hybridge Implants. Where AI meets dentistry.",
        position: "center 10%",
        tag: "Hybridge",
      },
      {
        src: "/About%20page%20pics/Hybridge%202.JPG",
        alt: "Hybridge office snapshot",
        context: "Hybridge. Build, ship, repeat.",
        tag: "Hybridge",
      },
    ] as Array<{
      src: string;
      alt: string;
      context: string;
      position?: string;
      tag?: "Grad" | "Shure" | "Hybridge";
    }>,
    experience: [
      {
        title: "AI Engineer",
        date: "Sept 2025 - Present",
        location: "Hybridge Implants, New York",
        logo: "/logos/hybridge.webp",
        logoClass: "h-12",
        highlights: [
          "[Consultation QA Pipeline](/posts/clinical-rag). Cloud Run + FastAPI grades every Zoom consult against a 7-criterion rubric. Schema-validated Gemini scoring, three-layer doctor ID, HIPAA-clean without Workspace DWD. -35% hallucinations vs the no-schema baseline; +130% acceptance and +43% revenue downstream. Now also drafts the doctor's clinical note from the transcript, iterated with the clinical team and guarded so a truncated note can never ship.",
          "[Pipeline observability hardening](/posts/pipeline-ghosting). Hardened that same QA pipeline after it kept showing ✅ complete while emails never sent and Sheet rows never appeared. Killed 9 silent-failure modes (bare-except graveyard, connection-level retry gaps, status-color drift), added durable webhook rows, a rerun-replaces-old flow, a consistency reconciler, and a plain-English Logs UI. 51/0/0 in the audit, +50 targeted tests.",
          "[NPC Coach](/posts/npc-coach). Rebuilt a brittle n8n call grader into a coaching platform for the front desk: it finds every new-patient call, grades it against the practice playbook with a verbatim transcript quote behind each of six criteria, and tracks each coordinator's trend in BigQuery behind a 26-endpoint React dashboard. 40/40/20 weighted score plus 3 hard gates as flags, not caps; ports-and-adapters gated by one NPC_BAA_ACCEPTED switch so 1,156 tests run with no cloud and no PHI. Day one on live calls: ~285 ingested, 40 scored, 3 voicemails auto-filtered, 28 flagged.",
          "[CBCT Scan Validator](/posts/cbct-scan-validator). In-house dental CT classifier. Replaced a $98K + $26K/yr vendor quote with a Cloud Run service under $50/mo. Frozen DentalSegmentator + multi-scale head, OpenVINO on CPU, ~5.5s end-to-end. 20-scan CICT gate on every push.",
          "[Treatment Estimator](/posts/treatment-estimator). Next.js + Postgres rebuild of a decade-old quoting tool. Every saved line stores its captured price and price book version, so the 6-month price guarantee holds. Shipped end-to-end in ~1 month; a prior vendor never shipped in a decade.",
          "[Cowork Dashboard](/posts/cowork-dashboard). Weekly Monday.com exports turned into an always in sync dashboard, moved from Apps Script to Cloud Run in September with one definition per metric. Surfaced ~$460k of orphan patient value. Weekly recon: half a day to 3 minutes.",
          "[Accounting Automation Suite](/posts/accounting-automation). A dozen Python scripts that replaced the controller's manual weekly imports across Denticon, MagicTouch, Paychex, and two banks. About 6 to 8 hours a week down to 30 to 45 minutes, roughly 400 hours a year back.",
          "[Reconciliation](/posts/reconciliation). A deterministic engine that cross checks the schedule, production ledger, and clinical notes across Eaglesoft and Denticon to confirm every patient seen got documented and billed correctly, surfacing only the exceptions. ~70 hours/week of manual cross checking by a three person insurance team down to an exception review; 200+ tests on synthetic fixtures, no PHI in git; live on Cloud Run.",
          "[Centralized Diagnostic Filter](/posts/cdf-diagnostic-filter). Turning the founder's diagnostic model into a standardized, HYBRIDGE-owned system where AI assists and doctors validate. The owned intake is live on Google Cloud for all three markets, and a Gemini engine now reads the panorex under the founder's own written ruleset (v2 after his review of the first outputs), generating doctor and consultation reports from an internal dashboard.",
          "Cross-cutting MLOps: one shared ETL module so train/serve skew is impossible. Hot-swap checkpoints via GCS, tag-based Cloud Build CI/CD, OpenTelemetry with strict no-PHI logs.",
        ],
      },
      {
        title: "Graduate Machine Learning Researcher",
        date: "May 2024 - Sep 2025",
        location: "New York University, New York",
        logo: "/logos/nyu.svg",
        highlights: [
          "Language model optimization: engineered debate datasets into preference pairs, trained LLM reward models with Transformers, TRL and QLoRA, and ran the RLHF lifecycle from SFT through GRPO and PPO on NYU's HPC cluster.",
        ],
      },
      {
        title: "Video Producer",
        date: "Jan 2024 - May 2025",
        location: "New York University, New York",
        logo: "/logos/nyu.svg",
        highlights: [
          "Directed and edited educational video content for NYU GPH faculty and their Brightspace curriculum, producing over 100 videos across 20 plus courses on public health topics.",
          "Shot on a Sony Alpha 7III; edited in DaVinci Resolve and Adobe Premiere Pro with motion graphics and titles in After Effects.",
        ],
      },
      {
        title: "Software Engineer",
        date: "Aug 2021 - Aug 2023",
        location: "Shure Incorporated, India",
        logo: "/logos/shure.svg",
        highlights: [
          "Engineered and deployed RESTful APIs with Flask (Python) to streamline the audio analytics data pipeline for Shure Cloud, leveraging AWS services (DynamoDB, S3, Amazon MSK) and reducing processing time by 20%.",
          "Designed scalable software frameworks in Python with Selenium, applying object-oriented design with Factory and Strategy patterns; automated 150+ test cases to improve test coverage and reduce manual effort by 70%.",
          "Operationalized backend services and CI/CD pipelines using Python and Jenkins, streamlining build, testing, and release workflows, reducing deployment errors by 40%, and improving delivery timelines by 35%.",
        ],
      },
    ],
    research: [
      {
        title: "Machine Learning Researcher",
        date: "May 2024 - Sep 2025",
        location: "New York University, New York",
        logo: "/logos/nyu.svg",
        highlights: [
          "Engineered a data pipeline using Python, SQL, and Airflow-style orchestration to ingest and clean 118 monthly CMV shards, normalize debate threads, and materialize data into preference pairs for downstream model training.",
          "Trained LLM-based reward models with Transformers, TRL, and QLoRA on GPU clusters, adding checkpointed recovery and logging loss, precision, recall, and F1 in WandB to speed up iteration.",
          "Implemented an RLHF policy-optimization lifecycle from SFT to GRPO/PPO, producing comparative inference artifacts to improve persuasion quality.",
        ],
      },
    ],
    skills: [
      {
        label: "Languages",
        items: ["Python", "TypeScript", "Go", "Java", "JavaScript", "C++", "C#", "SQL"],
      },
      {
        label: "Frontend",
        items: [
          "React",
          "Next.js 16",
          "Astro",
          "Tailwind CSS",
          "TanStack Query",
          "Zustand",
          "Apps Script (HTMLService)",
        ],
      },
      {
        label: "Backend",
        items: [
          "FastAPI",
          "Flask",
          "Node.js",
          "Express.js",
          "Spring Boot",
          "Apps Script",
          "Auth.js",
          "Zod / Pydantic",
        ],
      },
      {
        label: "Databases",
        items: [
          "PostgreSQL",
          "MySQL",
          "MongoDB",
          "DynamoDB",
          "Redis",
          "Milvus",
          "Firestore",
          "pgvector",
          "Drizzle ORM",
        ],
      },
      {
        label: "Cloud / GCP",
        items: [
          "Cloud Run",
          "Cloud SQL",
          "Eventarc",
          "Pub/Sub",
          "Vertex AI Gemini",
          "BigQuery",
          "Firestore",
          "Secret Manager",
          "Cloud Build",
          "Cloud Logging",
          "Drive / Sheets / Gmail APIs",
        ],
      },
      {
        label: "Cloud / AWS",
        items: [
          "EC2",
          "S3",
          "DynamoDB",
          "ECR",
          "RDS",
          "ElastiCache",
          "Amazon MSK",
          "CloudWatch",
        ],
      },
      {
        label: "MLOps / DevOps",
        items: [
          "Docker",
          "Kubernetes",
          "K3s",
          "Terraform",
          "GitHub Actions",
          "Workload Identity Federation",
          "MLflow",
          "Weights & Biases",
          "Airflow",
          "Ray",
          "OpenTelemetry",
          "Kafka",
          "Spark",
        ],
      },
      {
        label: "AI / ML",
        items: [
          "PyTorch",
          "PyTorch Lightning",
          "MONAI",
          "nnU-Net v2",
          "OpenVINO",
          "ONNX Runtime",
          "Transformers",
          "TRL",
          "HuggingFace",
          "Unsloth",
          "QLoRA / LoRA",
          "RLHF (GRPO / PPO / ORPO)",
          "Reward Modeling",
          "LangChain",
          "RAG (pgvector / Milvus)",
        ],
      },
      {
        label: "Testing",
        items: [
          "pytest",
          "Vitest",
          "JUnit",
          "Selenium",
          "vcrpy",
          "Integration tests (testcontainers)",
          "CI/CT gates",
          "Golden snapshots",
        ],
      },
      {
        label: "Tools",
        items: [
          "GraphQL",
          "Git",
          "GitHub",
          "Jenkins",
          "Figma",
          "Mermaid",
          "Prometheus",
          "Grafana",
          "Slack APIs",
        ],
      },
      {
        label: "Libraries",
        items: [
          "Pandas",
          "NumPy",
          "OpenCV",
          "Matplotlib",
          "NLTK",
          "gspread",
          "weasyprint",
          "Jinja2",
          "@react-pdf/renderer",
        ],
      },
    ],
  },

  projects: [
    {
      title: "Patient Dashboard",
      tier: "industry",
      flagshipRank: 1,
      date: "Jun 2026 - Present",
      description:
        "I built the staff side of our patient platform: one row per patient, every document one click away, and a live read only mirror of the practice management system that the estimator and capacity planner read through.",
      link: "",
      post: "/posts/patient-dashboard",
      details: {
        summary_short:
          "The staff dashboard behind the CDF platform. One row per patient for treatment coordinators, every document one click away, and the only app that talks to the Denticon API; the estimator and capacity planner read through it.",
        stats: [
          { value: "1 chart", label: "intakes, estimates and consult recordings land on the patient's Denticon chart" },
          { value: "100%", label: "Right chart chosen in a blind test of the record matcher" },
          { value: "~4 in 5", label: "Intake surveys that link to their chart on their own" },
          { value: "38", label: "Findings from an eight lens adversarial review, run before the matcher could write" },
        ],
        star: {
          problem:
            "Every system built for the practice named a patient differently: the intake survey by response id, the estimator by its own number, the consult grader by Zoom meeting, the experience survey by email. The Denticon id was optional, typed by hand, and joined nothing. Offices had three spellings, nightly smoke tests sat among real intakes, and the experience report PDF was in storage all along, but the dashboard could not open it.",
          solution:
            "Two Cloud Run services from one image. The dashboard, behind Google sign in limited to the company domain, holds no Denticon credentials; a sync service that serves no pages holds them. Webhooks and three scheduled jobs keep a Firestore mirror of offices, providers, patients and appointments current, and a registry API with one secret per caller serves it to the estimator and the capacity planner. Profiles join every record on the Denticon id at read time.",
          process:
            "The vendor API has no patient search, so the mirror is the only patient index there is. It also drops unknown query parameters silently and returns the whole table with a 200, so a parameter is allowed only once it is proven to change totalCount. The record matcher went through an adversarial review, ran in shadow mode, and refuses when unsure. A person's decision always wins: each link write is a transaction that decides again on fresh documents, and every link is versioned, audited and undoable. A journey step with no linked chart reads unknown, never no.",
          result:
            "Started in June 2026 and rebuilt around the Denticon API in September; production reads were proven on 29 September and v0.24.0 shipped on 5 October. Once the sync ran on a timer the mirror went from six days behind to 2.6 minutes behind on the staging copy, the matcher picked the right chart every time in a blind test, about four in five intakes link to their chart on their own, and the capacity planner reads the registry every minute.",
        },
        summary:
          "The staff side of the Centralized Diagnostic Filter platform for treatment coordinators: patients, intake surveys, manual intake, patient experience, estimates and consultations in one place. Behind it sit a read only Denticon mirror kept fresh by webhooks and scheduled sweeps, a record matcher that refuses when unsure, and a registry API that other internal apps read through.",
        highlights: [
          "Two Cloud Run services from one image: the dashboard holds no vendor credentials, and the sync service that holds them serves no pages.",
          "Only query parameters proven to change totalCount are allowed, because the vendor drops unknown ones silently and still answers 200.",
          "A freshness report that starts from the cursors it expects, so a missing one shows as the worst status instead of vanishing.",
          "Record matcher kept in shadow mode after an adversarial review (38 findings that collapsed to 4 critical and 11 high defects), lifted only for rules that were measured.",
          "Registry API with one secret per caller, so revoking one consumer never blinds another.",
          "77 vendor API operations transcribed and tested, 18 webhook subscriptions across three offices, and 1,000+ tests.",
          "Caught a sweep that reported green while all 18 of its calls failed, and secrets that carried a hidden Windows carriage return.",
        ],
      },
      tech: ["Next.js 15", "TypeScript", "Firestore", "Cloud Run", "Cloud Scheduler", "Cloud Storage", "Cloud Build", "GitHub Actions"],
      img_alt: "Patient Dashboard, Hybridge Implants LLC",
      img_path: "/patient-dashboard.png",
    },
    {
      title: "Capacity Planner",
      tier: "industry",
      flagshipRank: 7,
      date: "Sep 2026 - Present",
      description:
        "I replaced the operations lead's staffing workbook with a planner that shows demand, capacity and capability across three offices, reads the live schedule every minute, and never writes back.",
      link: "",
      post: "/posts/capacity-planner",
      details: {
        summary_short:
          "One forward view of demand, capacity and capability across three offices. A pure scheduling engine, live Denticon bookings every minute through the patient dashboard, and read only by design, down to the type system.",
        stats: [
          { value: "Every minute", label: "Live schedule sync, with no vendor credential in the planner" },
          { value: "48", label: "Tagged releases in the first eight days after the first deploy" },
          { value: "1,600+", label: "Tests across engine, web, Postgres integration and Playwright" },
          { value: "0", label: "Write paths to the source system, enforced by a type test" },
        ],
        star: {
          problem:
            "Staffing for three offices lived in the operations lead's workbook: seven sheets and twenty pasted week blocks. Fixed ranges undercounted silently when a row landed outside them, typing over a formula deleted it, and time off entered later never changed the plan. Leadership spent its time solving last minute coverage gaps instead of asking who the best person to place was.",
          solution:
            "A pnpm monorepo: a pure TypeScript engine package with no I/O, and a Next.js 16 app on Cloud Run with Cloud SQL Postgres, Drizzle and Google sign in. The same engine runs in the minute sync and in the browser for instant what if changes, golden tested against the workbook. Bookings come from Denticon through the patient dashboard's registry, so the planner holds no vendor credential and only reads.",
          process:
            "Read only is a type level test: the appointment source may have no member named like write, create, update, delete, cancel or book. A mass cancel guard stops any sync that would cancel an office's bookings in bulk and changes nothing, after a silently dropped office code nearly did exactly that. Sync failures return 200 so the scheduler does not retry storm, and staleness shows on a status pill. Cover suggestions rank five keys (capability, willingness, presence, free day, pairing), and every reason shown comes from the rule that produced it.",
          result:
            "Deployed internally on 28 September 2026, reading live Denticon data the next day, and at v0.44.0 by 5 October with a Needs action tab and Bandwidth suggestions. It plans doctors, assistants, treatment coordinators and front desk. Live data caught real modeling bugs early, like one doctor stacked three rows deep because the schedule books the doctor in the assistant's chair.",
        },
        summary:
          "An internal capacity planner for a three office implant practice: demand, capacity and capability in one forward view, with burnout treated as a design goal (proposed defaults flag three heavy days in a row). HIPAA from day one: role based access, an audit log, and logs that never carry patient data. Explainable rules only, no generated advice.",
        highlights: [
          "Pure engine package with no I/O: the same math in the minute sync and the browser's instant what if, golden tested against the workbook.",
          "Postgres over Firestore for person by weekday by location joins; NextAuth over IAP alone so roles and the audit log know who signed in.",
          "Its own cloud project, to isolate patient data and stay clear of a sibling app's database connection ceiling.",
          "Minute sync behind a version pointer, never a hot swap; failures return 200 and show up as staleness.",
          "Excel files parsed in the browser and never stored.",
          "A dependency upgrade put SQL parameters into error messages, so the logger now records only the Postgres error code, constraint and table.",
          "Cover suggestions ranked on five explainable keys, with ties broken on person id.",
        ],
      },
      tech: ["Next.js 16", "TypeScript", "Cloud SQL Postgres", "Drizzle", "NextAuth", "Cloud Run", "Cloud Scheduler", "Playwright"],
      img_alt: "Capacity Planner, Hybridge Implants LLC",
      img_path: "/capacity-planner.png",
    },
    {
      title: "Enterprise Search",
      demo: "https://sampreethavvari.github.io/ai-systems-tours/tours/enterprise-search/",
      tier: "industry",
      flagshipRank: 2,
      date: "Jun 2026 - Present",
      description:
        "I am building an internal AI search over all of Hybridge's knowledge. Ask a question in plain language, get a cited answer, and get an honest 'I don't know' when the evidence is not there.",
      link: "",
      details: {
        summary_short:
          "An agentic enterprise-search RAG for Hybridge. Hybrid retrieval, reranking, deterministic conflict resolution, and citations, built trustworthy-first on Google Cloud and shipped stage by stage.",
        stats: [
          { value: "Hybrid + rerank", label: "BM25 + dense retrieval, fused and reranked, not vector-only" },
          { value: "Cite or abstain", label: "answers are grounded in retrieved evidence, or it says it does not know" },
          { value: "Authority + recency", label: "conflicts resolved by rule, or the disagreement is declared" },
          { value: "End to end", label: "auth, ingestion, serving, and both front ends shipped; eval in build" },
        ],
        star: {
          problem:
            "Company knowledge is scattered across drives, decks, and people's heads, and in a HIPAA shop a confident wrong answer is a liability, not a demo bug. A basic chunk-embed-and-pray RAG fails on exact terms, on conflicting documents, and on access control.",
          solution:
            "A trust-first RAG. The read path filters by permission, retrieves with BM25 and pgvector together, fuses with RRF, reranks a bounded top-k, resolves conflicts deterministically, and answers with citations or abstains. The governed write path dedups, parses with layout awareness, chunks semantically, and stamps every chunk with its model and strategy versions.",
          process:
            "Built like a curriculum, one stage at a time, with an eval harness as the referee: recall, nDCG, MRR, and faithfulness measured against a managed baseline before any answer is trusted. The agentic corrective loop is gated behind a confidence check, so it never runs on a simple query.",
          result:
            "The loop runs end to end as of July 2026: domain-locked sign-in, documents added through the governed Dropoff portal with visibility, tags, class, and effective date set at upload, and cited answers streaming back in a chat with conversation history. The abstain rule is enforced in code, an empty retrieval short-circuits with no model call. The eval harness is the remaining referee, so no quality numbers are quoted until it produces them.",
        },
        summary:
          "An internal enterprise-search RAG on Google Cloud. Employees Ask Hybridge in a chat experience; authorized users add documents through a governed Dropoff portal. Hybrid retrieval, reranking, conflict resolution, grounded generation with citations, and a gated agentic loop, all measured by an eval harness.",
        highlights: [
          "Hybrid retrieval (BM25 + pgvector) fused with RRF and reranked, beats vector-only on exact terms.",
          "Deterministic conflict resolution: validity, then authority, then recency, else declare the disagreement.",
          "Group access enforced as a pre-retrieval filter, so restricted docs never enter a non-member's search.",
          "Agentic corrective loop gated by a confidence grader, kept off the hot path of simple queries.",
          "Eval harness (recall, nDCG, MRR, faithfulness) vs a managed baseline decides when complexity earns its place.",
        ],
      },
      tech: ["FastAPI", "Cloud Run", "Cloud SQL pgvector", "Vertex AI Gemini", "Document AI", "Pub/Sub", "Identity Platform", "Terraform"],
      img_alt: "Enterprise Search - Hybridge Implants LLC",
      img_path: "/enterprise-search.png",
    },
    {
      title: "CBCT Scan Validator",
      demo: "https://sampreethavvari.github.io/ai-systems-tours/tours/scan-validator/",
      tier: "industry",
      flagshipRank: 4,
      date: "Mar 2026 - Present",
      description:
        "I built the tool that catches bad dental scans before they ever reach the design team.",
      link: "",
      details: {
        summary_short:
          "Catches bad dental CT scans before they reach the implant-design queue. An in-house Cloud Run service replaced a vendor quote.",
        stats: [
          { value: "$98K → <$50/mo", label: "Vendor quote vs in-house cost" },
          { value: "~5.5s", label: "Per scan, CPU-only" },
          { value: "0.6309", label: "Honest AUROC (leaky 0.80 caught)" },
          { value: "20-scan", label: "CICT gate, every push" },
        ],
        star: {
          problem:
            "Bad CBCT scans (poor field-of-view, motion, missing anatomy) kept reaching the implant-design queue. A vendor wanted $98K up front + $26K/yr to fix it.",
          solution:
            "An in-house classifier. Frozen DentalSegmentator nnU-Net v2 encoder + a compact 500K-param head, packaged as a Cloud Run service that scores every scan in seconds.",
          process:
            "Bake-off across six architectures, then iterated through Models G, H, J as data taught more. A strict 20-scan CICT holdout caught a leaky AUROC of 0.80 in CI. Shipped the honest 0.6309 rather than game the gate. Tag-based CI/CD lets us hot-swap the head checkpoint via GCS with no OpenVINO IR rebuild.",
          result:
            "Under $50/mo running cost. ~5.5s per scan on CPU, scale-to-zero. The 10-year recurring loss from bad scans closes.",
        },
        summary:
          "End-to-end MLOps. SFTP ingest from MagicTouch DLCPM → parity-checked ETL → frozen DentalSegmentator + multi-task head → OpenVINO on Cloud Run → verdict PDF + email + write-back. ~5.5s end-to-end, CPU-only, scale-to-zero.",
        highlights: [
          "Bake-off across six architectures (A through F), then iterated through Models G, H, J.",
          "Model H: frozen DentalSegmentator nnU-Net v2 encoder + multi-scale taps + compact 500K-param head. Cost-tuned threshold (FN cost = 15× FP).",
          "20-scan CICT holdout in GitHub Actions caught a leaky AUROC 0.80.",
          "Tag-based CI/CD with hot-swap checkpoint via GCS, no OpenVINO IR rebuild.",
          "Found the partner's bidirectional SFTP path (DLCPM has no API license).",
        ],
      },
      tech: ["PyTorch Lightning", "MONAI", "OpenVINO", "FastAPI", "Cloud Run", "Eventarc", "W&B", "GitHub Actions"],
      img_alt: "CBCT Scan Validator - Hybridge Implants LLC",
      img_path: "/cbct-validator.png",
    },
    {
      title: "Treatment Estimator",
      demo: "https://sampreethavvari.github.io/ai-systems-tours/tours/treatment-estimator/",
      tier: "industry",
      date: "May 2026 - Present",
      description:
        "I rebuilt a ten year old pricing tool, and every quoted price is now frozen with the estimate, so the six month price promise holds. Since May it has shipped 72 releases, including visit sequences and the day's consult schedule as its front page.",
      link: "",
      details: {
        summary_short:
          "Rebuilt a decade old quoting tool; the six month price guarantee is a database invariant. 72 releases since May 2026, now with visit sequences, the day's consult schedule as its landing page, and the Hybridge design.",
        stats: [
          { value: "~1 month", label: "Spec → end-to-end (vendor: never)" },
          { value: "100%", label: "Branch coverage on pricing engine" },
          { value: "5", label: "Pricing model kinds" },
          { value: "72", label: "Tagged releases from May to October 2026" },
        ],
        star: {
          problem:
            "A 10-year-old single-price tool couldn't handle three clinics with different price books. The 6-month price-lock was a promise on the PDF, not a system property. An earlier vendor attempt never shipped.",
          solution:
            "Next.js 16 + Postgres + Drizzle rebuild. Five pricing models (flat, tiered, tiered-zoned, price-range, per-surface). Captured `*_at_capture` columns freeze every saved price, with per-location price book versions.",
          process:
            "9-decision ADR with tradeoff tables and library citations before any code. 100% branch coverage on the pricing engine. Golden snapshots lock every documented wizard path. A `questions-for-Chelsea` doc with worked numbers lets the clinical SME review without reading code.",
          result:
            "Shipped end-to-end in about a month, what a vendor failed to ship in a decade. Runs under $35/mo. Since then, 72 tagged releases through October 2026: a three pane drag and drop workspace with phases and scenarios, an Excel export that matches the coordinator's own file with live formulas, a landing page that is the day's consult schedule, visit sequences built from the estimate, and a full restyle in the Hybridge design in nine releases on one day.",
        },
        summary:
          "Next.js 16 + Postgres + Drizzle for treatment coordinators across three clinics. Five pricing models with write-once price snapshots. Price-book lifecycle: proposed → approved → published. Since May it has added visit sequences, the day's consult schedule as its landing page, and the Hybridge design.",
        highlights: [
          "9-decision ADR with tradeoff tables before any code.",
          "Captured *_at_capture columns freeze every saved price, so the 6-month guarantee holds.",
          "Three-affordance wizard so the TC never loses context mid-consult.",
          "100% branch coverage on the pricing engine; golden snapshots per wizard path.",
          "72 tagged releases from May to October 2026, with about 800 test cases in the repo.",
          "Visit sequences generated from the estimate and edited in a three pane builder, from the shared Treatment Sequence packages.",
          "The landing page is the day's consultation schedule, read from the patient dashboard's registry API.",
          "An estimate's arch now comes from its options, so the up front Upper, Lower or Both question is gone.",
          "Restyled in the Hybridge design (glass shell, Inter, a new logo, restyled PDFs) in nine releases on one day.",
        ],
      },
      tech: ["Next.js 16", "TypeScript", "Drizzle", "PostgreSQL", "Auth.js", "Cloud Run", "@react-pdf/renderer", "Zod"],
      img_alt: "Treatment Estimator - Hybridge Implants LLC",
      img_path: "/treatment-estimator.png",
    },
    {
      title: "Treatment Sequence",
      tier: "industry",
      date: "Aug 2026 - Present",
      description:
        "I replaced hand built Word visit plans with shared packages that generate the plan from an estimate, let the coordinator edit it in a three pane builder, and export it to Word and PDF.",
      link: "",
      post: "/posts/treatment-sequence",
      details: {
        summary_short:
          "The ordered plan of visits, with chair time, that delivers an accepted treatment. Generated from an estimate by picking a transcribed practice master, never by guessing, and edited by the treatment coordinator inside the estimator.",
        stats: [
          { value: "11", label: "Practice masters transcribed verbatim as data, all validated" },
          { value: "84 of 92", label: "Generation attempts matched to a validated master in a dev database audit, 0 errors" },
          { value: "~8 hrs", label: "Chair time in a full arch case, spread across about nine months" },
          { value: "0 tokens", label: "Shipped as a committed build snapshot, so no registry credential can expire" },
        ],
        star: {
          problem:
            "Coordinators wrote each patient's visit plan by hand in Word, copied from master documents in Drive, in two formats: a flat list of chair time units, and a six column table for full arch cases and dentures. Every change meant renumbering the visits and redating everything after it by hand, on a case that can run nine months.",
          solution:
            "Two packages. sequence-core holds the domain model, the practice masters stored as data, generation from an estimate, date and wait arithmetic, and the Word and text renderers, with no React. sequence-ui is a three pane React editor: visit list, flowchart and a live document preview. The estimator stores a living plan plus immutable version snapshots, and one shared text module keeps the preview, Word and PDF from drifting apart.",
          process:
            "Generation picks a template; it never infers a plan. A procedure with no matching visit prints as a yellow open item, an unsupported combination asks for a manual build, and a free text wait stops date projection instead of guessing. Anything not transcribed from a master carries a DRAFT banner on screen, in the PDF and in Word. The packages reach the estimator as a committed build snapshot stamped with its source commit, and a check fails if core and ui come from different commits.",
          result:
            "Live inside the estimator since 27 August 2026, with save, versions and PDF a release later, a read only lookup for the patient dashboard, and a Word export that now embeds Inter instead of opening in Times New Roman. A dev database audit matched 84 of 92 generation attempts to a validated master with 0 errors. The named tradeoff: nothing fails yet when the two repos fall out of step, so automating the refresh is next.",
        },
        summary:
          "Shared TypeScript packages that turn an accepted treatment estimate into an ordered plan of visits, with chair time in 15 minute units, providers, teeth, waits and dates, edited by the treatment coordinator in a three pane builder inside the estimator.",
        highlights: [
          "Every template is a verbatim transcription of one practice master, with its source document recorded.",
          "Staging became an explicit mode after a bug sent every full arch case to manual build: no implant teeth had been read as no staging.",
          "The both arches master was transcribed instead of composed from two single arch masters, because composing them puts the visits in the wrong order.",
          "A unique index on sequence and version number guards concurrent saves; at most one accepted plan per estimate.",
          "Export routes take the plan in the request body, so a coordinator can export what is on screen without saving first.",
          "No registry and no package token in the Dockerfile: a committed snapshot, after pnpm's file protocol quietly kept serving an old build.",
        ],
      },
      tech: ["TypeScript", "React", "Tailwind CSS", "dnd-kit", "docx", "PostgreSQL", "Drizzle", "pnpm"],
      img_alt: "Treatment Sequence, Hybridge Implants LLC",
      img_path: "/treatment-sequence.png",
    },
    {
      title: "Cowork Dashboard",
      demo: "https://sampreethavvari.github.io/ai-systems-tours/tours/cowork-dashboard/",
      tier: "industry",
      date: "Apr 2026 - Present",
      description:
        "I rebuilt a flaky dashboard on weekly exports, then rebuilt it again on Cloud Run so a card and its drilldown can never disagree. The Weekly tab went from 5.2 seconds to about 17 ms.",
      link: "",
      details: {
        summary_short:
          "Weekly Monday.com exports turned into an always in sync leadership dashboard. Moved from Apps Script to Cloud Run in September 2026, with one metric registry so cards and drilldowns cannot disagree.",
        stats: [
          { value: "5.2 s → ~17 ms", label: "Weekly tab over a multi year range" },
          { value: "1 registry", label: "Every card number is computed from its own drilldown rows" },
          { value: "31% → 5.8%", label: "Ambiguous patient to lead links, after first name checks" },
          { value: "½ day → 3 min", label: "Weekly recon time, still just drop four files" },
        ],
        star: {
          problem:
            "The April version on Apps Script replaced a live API dashboard that broke constantly, but it claimed more than it delivered. Every metric had three implementations (card, drilldown and trend overlay), so two tabs could disagree. The connect column holds only the surname, so about 31% of patients resolved to an arbitrary lead: the 49% to 99% jump measured coverage, not correctness. A multi year Weekly view took about 5.2 seconds.",
          solution:
            "A rebuild on Cloud Run behind IAP. Cloud Scheduler checks Drive every five minutes; a private ingest service parses the four exports with ExcelJS, joins and hashes them, and writes an immutable snapshot to Cloud Storage. The browser loads one pinned snapshot of about 0.4 MB and computes everything locally with the same core package the ingest uses, and each card number is a function of its drilldown rows by construction.",
          process:
            "Business rules were ported verbatim and held to a parity gate that runs the original Apps Script code in a Node VM. When parity could not catch a one day date shift (both sides used the same reader), a golden test pinned figures read off the old production dashboard. A sorted date index means a one week query touches about 60 rows instead of scanning every lead, and a request sequence guard stops stale results from landing.",
          result:
            "Live on Cloud Run since 2 September 2026. The Weekly tab dropped from about 5.2 seconds to about 17 ms, ambiguous links fell from 31% to 5.8% with link quality recorded on every row, a Cash Flow tab shipped on 15 September, and on 30 September it took on the Hybridge design while staying dark. The weekly routine did not change: drop four files.",
        },
        summary:
          "A leadership dashboard on weekly Monday.com exports, first in Apps Script and rebuilt on Cloud Run in September 2026. Eight tabs, one metric registry, and a snapshot the browser computes from locally.",
        highlights: [
          "Linkage 49% → 99% via the Monday connect column, then made correct in September: first name checks cut ambiguous links from 31% to 5.8%.",
          "Weekly recon: half a day → 3 minutes, and the routine is still drop four files.",
          "One metric registry: every card is computed from its own drilldown rows, so the two cannot disagree.",
          "Weekly tab from about 5.2 s to about 17 ms with a sorted date index.",
          "Cash Flow tab: what is booked to begin, windowed on treatment start date, with weekly totals built from the daily numbers.",
          "Surfaced ~$460k of orphan patient value the old dashboard was silently dropping.",
        ],
      },
      tech: ["TypeScript", "Node.js", "ExcelJS", "Cloud Run", "Cloud Storage", "Cloud Scheduler", "Cloud IAP", "Chart.js"],
      img_alt: "Cowork Dashboard - Hybridge Implants LLC",
      img_path: "/cowork-dashboard.png",
    },
    {
      title: "Loan Radar",
      tier: "academic",
      date: "Jan - May 2025",
      description:
        "I built the whole pipeline for loan-default scoring: training and serving in containers, full model history, and quality gates before anything ships.",
      link: "https://hi.switchy.io/cv-i",
      post: "/posts/loan-radar-mlops",
      details: {
        summary:
          "Loan Radar is a production-grade loan default scoring platform with containerized services, observability, and resilient retraining and deployment workflows.",
        highlights: [
          "Built ML CI/CD with Docker plus FastAPI services, MLflow artifact lineage (MinIO + PostgreSQL), and automated unit/integration quality gates.",
          "Developed low-latency microservices with FastAPI, Flask, and Uvicorn, delivering 0.79ms median and 0.87ms p95 inference at 33k+ samples/sec throughput.",
          "Operationalized retraining via Airflow and Terraform-provisioned multi-node infra, packaging Ray head/worker, API, and MLflow services for Kubernetes scaling, rolling updates, and rollback-safe deployments.",
        ],
      },
      tech: ["FastAPI", "Flask", "Uvicorn", "Docker", "Kubernetes", "MLflow", "Airflow", "Terraform", "Ray"],
      img_alt: "Loan Radar",
      img_path: "/loan-radar.png",
    },
    {
      title: "Teaching Llama to Argue Better",
      tier: "research",
      date: "May 2024 - Sep 2025",
      description:
        "I trained Llama to write more convincing counter-arguments, using a reward model and RLHF (GRPO and PPO), with real people judging the results.",
      link: "",
      post: "/posts/llama-rlhf",
      details: {
        summary:
          "A research project on persuasion: I trained Llama to argue better, comparing two training methods (GRPO and PPO) against a learned reward model.",
        highlights: [
          "SFT + RLHF pipeline with QLoRA/LoRA and TRL, trained against a reward model.",
          "Compared GRPO and PPO-style optimization for persuasive response quality.",
          "Evaluated with BLEU/ROUGE plus human scoring to validate improvements.",
        ],
      },
      tech: ["Llama 3.1", "GRPO", "PPO", "RLHF", "TRL", "QLoRA", "LoRA", "PyTorch"],
      img_alt: "LLM persuasion research",
      img_path: "/llm-persuasion.png",
    },
    {
      title: "Doc Coach, Consultation QA Pipeline",
      demo: "https://sampreethavvari.github.io/ai-systems-tours/tours/doc-coach/",
      tier: "industry",
      flagshipRank: 3,
      date: "Aug 2025 - Present",
      description:
        "I built the tool that grades every implant consult from its Zoom call and sends a color-coded report to the doctor and CEO.",
      link: "",
      details: {
        summary_short:
          "Grades every implant consult from the Zoom transcript. Color-coded report to doctor, CEO, and TC.",
        stats: [
          { value: "+130%", label: "Treatment acceptance" },
          { value: "+43%", label: "Revenue" },
          { value: "-35%", label: "Hallucinations" },
          { value: "HIPAA", label: "Eligible, no Workspace DWD" },
        ],
        star: {
          problem:
            "Implant consultations vary in quality and there was no scalable way to grade them. The CEO had a 7-criterion framework but no system enforced it.",
          solution:
            "Cloud Run + FastAPI pipeline. Vertex AI Gemini scores against a versioned `consultation-rubric.md` prompt + JSON Schema 2020-12 contract. Every response must validate (one retry on schema-fail) before it renders a color-coded PDF.",
          process:
            "Doctor↔TC identity resolves per meeting via the participants list, transcript alias matching, and an LLM tie-break, with explicit failure modes. Avoided Workspace Domain-Wide Delegation by using a user-OAuth grant on the build owner's account (refresh token in Secret Manager).",
          result:
            "-35% hallucinations vs the no-schema baseline is the engineering win; +130% treatment acceptance and +43% revenue followed downstream. A 19-section, 11-acceptance-test PRD with locked column orderings serves as engineering brief and clinical-stakeholder reference.",
        },
        summary:
          "Cloud Run pipeline grading every implant consultation across two Zoom Business orgs and three TCs.",
        highlights: [
          "-35% hallucinations vs no-schema baseline; +130% acceptance and +43% revenue downstream, under HIPAA controls.",
          "Versioned rubric prompt + JSON Schema contract for every Gemini response.",
          "19-section, 11-acceptance-test PRD with locked column orderings.",
          "Cloud SQL pgvector + GraphQL for longitudinal scoring analytics.",
          "User-OAuth grant bypasses Workspace DWD entirely.",
        ],
      },
      imageStyle: "object-position: center 20%;",
      tech: ["FastAPI", "Vertex AI Gemini 2.5", "Cloud Run", "Cloud SQL pgvector", "GraphQL", "Firestore", "BigQuery", "Drive/Sheets/Gmail APIs"],
      img_alt: "Doc Coach - Hybridge Implants LLC",
      img_path: "/doc-coach.png",
    },
    {
      title: "NPC Coach",
      demo: "https://sampreethavvari.github.io/ai-systems-tours/tours/npc-coach/",
      tier: "industry",
      flagshipRank: 6,
      date: "Aug 2025 - Present",
      description:
        "I rebuilt a brittle n8n call grader into a coaching platform: it finds every new-patient call, grades it with a quoted transcript line behind each score, and tracks each coordinator's trend.",
      link: "",
      details: {
        summary_short:
          "Finds the new-patient calls among thousands, grades each against the practice playbook with a verbatim quote behind every criterion, and tracks each coordinator's trend. A full rebuild of an n8n prototype.",
        stats: [
          { value: "1,156", label: "Tests on the green gate" },
          { value: "40 / 40 / 20", label: "Weighted score + 3 hard gates" },
          { value: "285 → 40", label: "Calls ingested → scored, day one" },
          { value: "$50-250/mo", label: "Cloud cost at full volume" },
        ],
        star: {
          problem:
            "An earlier n8n grader proved the idea, scoring each call out of 60 from recordings it pulled off SFTP every hour. But it emitted a brittle semicolon-delimited blob into a single Google Doc, carried no transcript evidence, computed no real score, shared the patient's name and full transcript company-wide, and silently skipped any call when the workflow died mid-run.",
          solution:
            "A full rebuild on a HIPAA-scoped Google Cloud footprint. A pipeline ingests recordings from SFTP and CallRail, transcribes with Vertex Gemini, classifies the call, scores relevant new-patient calls on six criteria with a verbatim quote behind each, resolves a stable patient ID, and writes a validated verdict to BigQuery with the report in Cloud Storage.",
          process:
            "Ports-and-adapters so the same code runs on in-memory fakes in tests and real cloud in prod, gated by one NPC_BAA_ACCEPTED compliance switch. The scoring math is pure Python, not the model: the 0-100 headline is a 40/40/20 weighted sum, while three hard gates and a patient-urgency override ride alongside as loud flags, never a hidden score cap.",
          result:
            "First full day on live calls: ~285 recordings ingested, 40 real new-patient calls scored with quoted evidence, 3 voicemails auto-filtered, 28 flagged for missing a non-negotiable. 1,156 tests green. Live on Cloud Run behind Google sign-in, locked to the practice domain.",
        },
        summary:
          "A New Patient Coordinator coaching platform for Hybridge and Elmwood. It finds the new-patient calls among thousands, grades each against Dr. Frank LaMar's playbook, and gives coordinators and managers per-call reports plus team trends. Correctness over conversion; no PHI in logs.",
        highlights: [
          "Full rebuild of an n8n prototype: weighted 40/40/20 score, 3 hard gates, a patient-urgency override.",
          "A verbatim transcript quote behind every one of six scoring criteria.",
          "Ports-and-adapters plus one NPC_BAA_ACCEPTED switch gate all real PHI; 1,156 tests run with no cloud.",
          "BigQuery system of record feeding a 26-endpoint React dashboard with per-coordinator trends.",
          "Deterministic call IDs so a call is never graded twice or lost; voicemails auto-filtered.",
          "Reports view, print, download, and email through a Gmail send identity; recordings transcode to MP3 and play inline.",
        ],
      },
      imageStyle: "object-position: center 20%;",
      tech: ["Python", "FastAPI", "Vertex AI Gemini", "React", "TypeScript", "BigQuery", "Cloud Storage", "Cloud Run", "pytest"],
      img_alt: "NPC Coach - Hybridge Implants LLC",
      img_path: "/npc-coach.png",
    },
    {
      title: "Reconciliation",
      demo: "https://sampreethavvari.github.io/ai-systems-tours/tours/reconciliation/",
      tier: "industry",
      date: "Jun 2026 - Present",
      description:
        "I replaced 70 hours a week of manual cross checking with an engine that reads three exports and shows the insurance team only the flagged patients.",
      link: "",
      details: {
        summary_short:
          "Confirms every patient seen got documented and billed correctly, across two practice-management systems, and surfaces only the exceptions. Shipped and live.",
        stats: [
          { value: "70 hrs/week", label: "Manual cross checking returned to a three person team" },
          { value: "2 systems, 1 engine", label: "Eaglesoft + Denticon through one core" },
          { value: "200+ tests", label: "All on synthetic fixtures, no PHI in git" },
          { value: "8 of 120", label: "Typical flags per day, everyone else clears automatically" },
        ],
        star: {
          problem:
            "A three person insurance team spent about 70 hours a week cross checking the schedule, the production ledger, and the clinical notes by hand to confirm every patient seen got documented and billed under the right doctor. It was slow and it failed exactly where mistakes cost the most: care documented but never billed, billed with no note behind it, or billed under the wrong provider.",
          solution:
            "A pure, deterministic reconciliation engine wrapped in a thin FastAPI app. Two source adapters (Eaglesoft CSV, Denticon xlsx) normalize hostile exports into the same typed models, the matcher keys everything on patient_id, and a stack of checks (money vs note, billing provider vs the doctor named in the note, note-claimed codes vs the ledger, perio charting proof, office policy rules) separates verified patients from the handful that need a human.",
          process:
            "The engine has no network, no database, and no clock, and it takes the timestamp as a parameter, so identical inputs give byte-identical output and every count traces to a source row. Columns map by name and a missing one fails loud; the app also checks the dates inside every file and warns when an export covers the wrong day. 200+ tests run on synthetic fixtures that mirror every real quirk, plus an opt-in golden test against a real day, so no PHI ever enters the repo. Every false flag the team reported got traced, fixed, tested, and redeployed the same day.",
          result:
            "Shipped and live on Cloud Run, in daily use. About 70 hours a week of manual cross checking became an exception review of roughly a dozen flags out of ~120 patients a day, over 3,600 hours a year returned. A Gemini clinical matcher is built and waiting behind a preview-mode rollout.",
        },
        summary:
          "A HIPAA-safe reconciliation tool for a multi-location dental group. A deterministic Python engine confirms each patient seen was documented and billed across Eaglesoft and Denticon; the FastAPI shell adds auth, a dashboard, history, and Gmail delivery.",
        highlights: [
          "Pure deterministic engine split from the app shell: same inputs, byte-identical, auditable output.",
          "Two practice-management systems normalized into one set of typed models via a source-adapter registry.",
          "Matching keyed on patient_id with a fuzzy-name fallback that flags low-confidence rather than guessing.",
          "Reads free-text notes despite human habits: nicknames, typos, and template lines that look like exams but are not.",
          "200+ tests on synthetic fixtures plus an opt-in golden test; no patient data in git, ever.",
          "Gemini clinical matcher (tooth, surface, procedure code) built but gated behind a preview rollout.",
        ],
      },
      tech: ["Python", "FastAPI", "Vertex AI Gemini", "Firestore", "Cloud Run", "Google OAuth", "pytest"],
      img_alt: "Reconciliation - Hybridge Implants LLC",
      img_path: "/reconciliation.png",
    },
    {
      title: "Daily Sales Report",
      tier: "industry",
      date: "Sep 2026 - Present",
      description:
        "I turned the VP of Finance's morning Excel forecast into an automated pipeline that projects lab revenue and new arch starts three months out, with honest error bands and commentary that cannot invent a number.",
      link: "",
      post: "/posts/daily-sales-report",
      details: {
        summary_short:
          "Projects invoiced lab revenue and new arch starts for this month and the next two, each with a band calibrated to cover about 68% of outcomes. A faithful port of the finance team's model, automated, with LLM commentary fenced in by code.",
        stats: [
          { value: "4.2% → 1.5%", label: "Current month revenue error, early in the month to late" },
          { value: "15 + 6", label: "Acceptance values and edge cases pinned on every commit" },
          { value: "108", label: "Model constants ported exactly from the original" },
          { value: "~290", label: "Tests, up from 31 at the start" },
        ],
        star: {
          problem:
            "The VP of Finance had built a sound forecast in Excel and handed it over with a spec, but it needed a manual paste, recalculate and send every morning, fed by two daily export emails from the dental lab's case system.",
          solution:
            "A pure Python engine package with no I/O, and a pipeline package with parsers, a dedupe ledger and a BigQuery loader, with Terraform for the infrastructure. A daily Cloud Run job runs the model, and a Cloud Run web app behind IAP shows the dashboard, history and a Projections tab. An Apps Script bridge runs inside the VP's own Google account and copies the report attachments to a landing bucket, so the project never holds a credential that can read his mailbox. Gemini writes the commentary over finished numbers only.",
          process:
            "Parity first: every acceptance value and edge case from the spec is pinned on every commit. Every number in the Gemini commentary must appear in the report payload, a list of banned phrases blocks advice the model has no business giving, and if the guard fails the report falls back to a deterministic template. No auto tuning: the best in sample parameter grid scored 2.59% but was 0.62 points worse out of sample. A better lag model sits behind a switch because its 0.28 point gain did not clear the noise floor.",
          result:
            "In production since 25 September 2026. Current month revenue error falls from 4.2% early in the month to 1.5% late, and the report never depends on the LLM. The one hand typed figure now lives in BigQuery as rows that supersede instead of overwrite, after a scale to zero quietly lost it while the form still said Saved.",
        },
        summary:
          "An automated daily sales report for an implant practice's lab revenue: a pure forecasting engine ported exactly from the finance team's model, a daily Cloud Run pipeline into BigQuery, a dashboard behind IAP, and Gemini commentary that is checked number by number.",
        highlights: [
          "Bands calibrated to cover about 68% of outcomes, for this month and the next two.",
          "The mail bridge runs in the VP's own account, so the project never holds a mailbox credential.",
          "A number guard on the LLM: any figure not in the payload fails the check and the template takes over.",
          "No auto tuning: an in sample win that lost 0.62 points out of sample stayed out.",
          "Fixed reflected XSS and path traversal through untrusted filenames, including escaping the model's own output.",
          "A hand typed figure that lived in container memory now persists in BigQuery as superseding rows.",
        ],
      },
      tech: ["Python", "BigQuery", "Cloud Run Jobs", "Cloud Run", "Cloud IAP", "Gemini", "Apps Script", "Terraform"],
      img_alt: "Daily Sales Report, Hybridge Implants LLC",
      img_path: "/daily-sales-report.png",
    },
    {
      title: "Marketing Data Warehouse",
      tier: "industry",
      date: "Aug 2026 - Present",
      description:
        "I built a BigQuery warehouse that joins ad spend, calls and leads to booked patients and treatment value every day, documented so both people and LLMs can query it.",
      link: "",
      post: "/posts/marketing-warehouse",
      details: {
        summary_short:
          "Six marketing sources pulled daily into one BigQuery warehouse and joined from ad spend through calls and leads to booked patients and treatment value. Every column described, a data guide written for LLMs to read first, and a weekly eval of golden questions.",
        stats: [
          { value: "98.5%", label: "Patients linked to their lead" },
          { value: "99.5%", label: "Join agreement with the weekly exports" },
          { value: "22", label: "Golden questions in the weekly Gemini eval" },
          { value: "~2 days", label: "From spec to a running pipeline" },
        ],
        star: {
          problem:
            "Marketing numbers lived in five separate logins, and no off the shelf connector could join ad spend all the way through to treatment value, so a connector product was ruled out.",
          solution:
            "Google Ads lands through the BigQuery Data Transfer Service; Microsoft Ads, Meta, CallRail, Monday CRM and TapClicks come in through Python connectors running as Cloud Run jobs on Cloud Scheduler. Data moves from raw to staging to marts, every column carries a description, and a data guide tells an LLM what to read first. People query it through Looker Studio, Gemini and an MCP connection.",
          process:
            "A daily ops job checks freshness and runs a drift check that alerts on a z score above 3 against a 28 day baseline, and a weekly eval harness asks Gemini 22 golden questions. The lead to patient join moved from fuzzy phone, click id and email matching to the CRM's own board relation link, with the match method recorded on every row. View types that carry the identities of callers, reviewers or leads are blocked in code, whatever the config asks for.",
          result:
            "Live since early August 2026, with the TapClicks connector added on 25 September. 98.5% of patients link to their lead, and the join agrees with the weekly exports 99.5% of the time. It is not perfect: the first eval run passed 77% against an 80% gate, and on 23 September pipeline health stood at 32 of 36 checks with the CallRail sync failing two nights running.",
        },
        summary:
          "A marketing data warehouse for a multi office implant practice: daily pulls from six sources, a documented raw, staging and marts layout, freshness and drift checks, a weekly LLM eval, and a pipeline monitoring dashboard.",
        highlights: [
          "A CallRail backfill looked like the account had no history; the API silently ignores created_after, and start_date brought calls back to June 2025.",
          "Lead to patient join on the CRM's own relation link, with match_method on every row.",
          "Every column described and a data guide written for LLMs, so a model reads the map first.",
          "Drift alerts at a z score above 3 against a 28 day baseline.",
          "Identity carrying view types blocked in code: callers, reviewers, commenters and leads.",
          "A demo rule of thumb: a funnel conversion near 96 percent means a bad join.",
        ],
      },
      tech: ["Python", "BigQuery", "BigQuery Data Transfer", "Cloud Run Jobs", "Cloud Scheduler", "Gemini", "Looker Studio", "MCP"],
      img_alt: "Marketing Data Warehouse, Hybridge Implants LLC",
      img_path: "/marketing-warehouse.png",
    },
    {
      title: "Centralized Diagnostic Filter",
      demo: "https://sampreethavvari.github.io/ai-systems-tours/tours/patient-assessment/",
      tier: "industry",
      flagshipRank: 5,
      date: "Jun 2026 - Present",
      description:
        "I am turning a founder's diagnostic mental model into a standardized system: every scan, photo, and survey into one report, with the doctor validating every finding.",
      link: "",
      details: {
        summary_short:
          "A standardized restorative prognosis operating system for complex implant cases. AI assists, doctors validate. The intake is live in production and the AI panorex read runs under the founder's own reviewed ruleset.",
        stats: [
          { value: "Live", label: "Intake, PDF, Drive filing, dashboard in production" },
          { value: "0-200", label: "Future tooth-loss risk score, 4 bands" },
          { value: "v2", label: "Doctor-reviewed ruleset behind the AI read" },
          { value: "3", label: "AI generators per clinical report" },
        ],
        star: {
          problem:
            "The practice's diagnostic intelligence lived in the founder's head and a third-party intake tool. Assessments were screenshotted by hand, filed manually, duplicated across three markets, and the HIPAA posture was unverified. There was no standardized, owned way to turn a complex case into one consistent report.",
          solution:
            "The Centralized Diagnostic Filter: a HYBRIDGE-owned system that pulls CBCT, scans, photos, and a risk survey into one standardized report, with a future-tooth-loss risk score and a treatment leaning, never a final diagnosis. The governing rule is AI assists, doctors validate.",
          process:
            "Phased to de-risk. Phase 1 replaced the third-party intake with an owned, BAA-covered questionnaire and premium PDF on Google Cloud. I then recorded the founder reading four real cases, turned his narration into a written panorex ruleset with per-rule citations, and implemented it as a Gemini engine on Vertex AI with structured output, where the model observes and the code recomputes every count.",
          result:
            "Intake, PDF delivery, and Drive filing are live for all three markets with a nightly end-to-end smoke test. An internal dashboard links cases to Drive folders and generates doctor and consultation reports on demand from three chained AI generators. The founder reviewed the first AI reads and his corrections shipped as ruleset v2; tooth numbering is in a measured eval before more diagnostic scope is added.",
        },
        summary:
          "A standardized diagnostic operating system for complex restorative and implant dentistry, built with the practice founder. One report from every modality, a preserved 0-200 risk model, and a human-in-the-loop AI layer where every finding is doctor-confirmed.",
        highlights: [
          "Turns a veteran clinician's diagnostic model into a written, cited panorex ruleset and a running Gemini engine.",
          "The validation loop is real: the founder's review of the first AI reads shipped as ruleset v2.",
          "A 0-200 future tooth-loss risk score across four bands, preserved from the existing model.",
          "Three chained AI generators per report, with one source of truth so pages never contradict.",
          "HYBRIDGE-owned on Google Cloud, schema-versioned and auditable from day one.",
        ],
      },
      tech: ["TypeScript", "Next.js", "Google Cloud", "Terraform", "Vertex AI Gemini", "Cloud Run", "PDF generation", "HIPAA"],
      img_alt: "Centralized Diagnostic Filter - Hybridge Implants LLC",
      img_path: "/cdf-diagnostic-filter.png",
    },
    {
      title: "Fake News and Sentiment Analysis",
      tier: "academic",
      date: "Feb - May 2024",
      description:
        "I built two models for the 2020 election: one to flag fake news (76% on the LIAR benchmark), one to read how 1.8M tweets felt.",
      link: "https://hi.switchy.io/U4wO",
      post: "/posts/fake-news-sentiment",
      details: {
        summary_short:
          "Two models for the 2020 election: one to catch fake news, one to read the public mood across 1.8M tweets.",
        stats: [
          { value: "76%", label: "Llama 3 8B accuracy on LIAR" },
          { value: "1.8M+", label: "tweets through the sentiment pipeline" },
          { value: "2 models", label: "misinformation + sentiment, shared ETL" },
          { value: "1 GPU", label: "whole fine-tune in 4-bit" },
        ],
        star: {
          problem:
            "\"Detect fake news\" hides two problems: labeling whether a claim is checkably false, and reading how a crowd of 1.8M tweets feels about it. They need different models and different data.",
          solution:
            "Llama 3 8B fine-tuned with QLoRA on the LIAR benchmark for misinformation, RoBERTa fine-tuned for sentiment over the tweet firehose, and LDA for topic clusters, all hanging off one shared cleaning module.",
          process:
            "Watched per-class precision/recall instead of trusting raw accuracy on imbalanced LIAR. Unified the tweet and LIAR cleaners to kill train/serve skew. Tuned LDA by coherence after stopword/hashtag handling.",
          result:
            "76% on LIAR (honest, given short politically-loaded claims), cheap RoBERTa inference across 1.8M rows, and defensible topic clusters. Route the cheap model over everything, spend the 8B only on flagged claims.",
        },
        summary:
          "Two-model NLP pipeline over the 2020 U.S. election: Llama 3 8B (QLoRA) for misinformation on LIAR, RoBERTa for sentiment across 1.8M+ tweets, LDA for topic-level patterns.",
        highlights: [
          "76% on the LIAR misinformation benchmark with a 4-bit Llama 3 8B + LoRA adapters.",
          "RoBERTa, not an LLM, for the 1.8M-tweet stream, because throughput beats the last point of accuracy.",
          "One shared cleaning module across both models to prevent train/serve skew.",
          "LDA topic clusters tuned by coherence, not eyeballed.",
        ],
      },
      tech: ["LLaMA 3", "QLoRA", "RoBERTa", "LDA", "Python"],
      img_alt: "Fake News and Sentiment Analysis",
      img_path: "/fake-news.png",
    },
    {
      title: "ResNet Under 5M Parameters",
      tier: "academic",
      date: "2024",
      description:
        "A class competition: 55 teams, 2 weeks, CIFAR-10, under 5M params. I went from 42nd to 1st on the unseen test set by adding data, not a bigger model.",
      link: "https://docs.google.com/spreadsheets/d/1ZGsL-hlqXFQmKHCA-6-J81xIbBcJNZBSGYnldBHzYlA/edit?usp=sharing",
      post: "/posts/resnet-under-5m",
      details: {
        summary_short:
          "55 teams, a 5M-parameter cap, two weeks. I stopped tuning the model and started multiplying the data. We won on the images nobody had seen.",
        stats: [
          { value: "#1 / 55", label: "on the professor's unseen test set" },
          { value: "97.12%", label: "CIFAR-10 accuracy, up from ~92%" },
          { value: "< 5M", label: "param cap, ResNet-only" },
          { value: "0 params", label: "added by augmentation" },
        ],
        star: {
          problem:
            "A deep-learning class competition: 55 teams, two weeks, best CIFAR-10 classifier. Hard rules: stay a ResNet, stay under 5M parameters. We cleared the 85% bar and then sat at a frustrating 42nd.",
          solution:
            "The rules said no bigger model, so I added data instead. Augmentation, rotating, cropping, and flipping the CIFAR-10 images, gave the model far more to learn from without adding a single parameter.",
          process:
            "I tried different ResNet variants and swept hyperparameters to a solid setup (~92%, 16th in class), but tuning hit a wall under the cap. I read papers and open-source repos to see how the best were doing it, then reframed the problem from 'better model' to 'more data.'",
          result:
            "97.12% accuracy, 2nd of 55 teams (0.17% behind 1st). On the professor's secret unseen test set, our model generalized best and finished 1st in the whole class. Earned a bonus grade point.",
        },
        summary:
          "A CIFAR-10 class competition across 55 teams under a 5M-parameter, ResNet-only cap. I won it by augmenting the data instead of growing the model.",
        highlights: [
          "Went from 42nd to 1st on the unseen test set by adding data, not parameters.",
          "Augmentation (rotate/crop/flip) multiplied the training data at zero parameter cost.",
          "Hyperparameter tuning alone stalled at ~92% under the 5M cap.",
          "2nd of 55 on CIFAR-10 test (0.17% off 1st); 1st on the professor's unseen set.",
        ],
      },
      tech: ["ResNet", "PyTorch", "Data Augmentation", "CIFAR-10"],
      img_alt: "ResNet CIFAR-10 class competition",
      img_path: "/resnet-compact.png",
    },
    {
      title: "Customer Segmentation and Recommendation System",
      tier: "academic",
      date: "Feb - May 2024",
      description:
        "I built a recommender for 22M+ records: a fast step to shortlist, a smart step to rank. 20% better than just showing what's popular.",
      link: "https://hi.switchy.io/U4wS",
      post: "/posts/recsys-spark-bigdata",
      details: {
        summary_short:
          "A recommender for 22M+ records: one fast step to shortlist, one smart step to rank. The same shape big rec teams use.",
        stats: [
          { value: "22M+", label: "records processed on Spark / Hadoop" },
          { value: "+20%", label: "Precision@K over a popularity baseline" },
          { value: "2-stage", label: "candidate generation → ranking" },
          { value: "100s", label: "candidates ranked per user, not millions" },
        ],
        star: {
          problem:
            "At 22M+ records on HDFS, scoring every user against every item is intractable. The question stops being \"which model\" and becomes \"how do I not compute the things I don't need to.\"",
          solution:
            "A two-stage pipeline: MinHash LSH buckets similar entities for cheap, recall-oriented candidate generation, then ALS matrix factorization ranks only the few hundred survivors per user.",
          process:
            "Salted hot keys and repartitioned to fix Spark data skew. Tuned LSH bands/rows against candidate recall as an explicit knob. Fell back to the popularity baseline for cold-start users.",
          result:
            "+20% Precision@K over the popularity baseline (the honest thing to beat) at 22M+ records. Swap LSH for ANN and ALS for a learned ranker and it's the literal production blueprint.",
        },
        summary:
          "A large-scale two-stage recommendation pipeline using Spark on Hadoop, built to handle tens of millions of records efficiently.",
        highlights: [
          "MinHash LSH for candidate generation, ALS matrix factorization for ranking.",
          "Processed 22M+ records with distributed Spark jobs on HDFS-backed storage.",
          "Beat the popularity baseline (not random) on Precision@K by ~20%.",
          "Fixed Spark data skew by salting hot keys before the join.",
        ],
      },
      tech: ["Spark", "Hadoop", "MinHash LSH", "ALS", "Python"],
      img_alt: "Customer Segmentation and Recommendation System",
      img_path: "/customer-segmentation.png",
    },
    {
      title: "Enterprise Data Project",
      tier: "industry",
      date: "Aug 2025 - Present",
      description:
        "I moved every team's automations onto one self-hosted AI platform on AWS, and cut the bill doing it.",
      link: "",
      details: {
        summary_short:
          "Self-hosted AI workflow infra on AWS. Centralized automation across teams.",
        stats: [
          { value: "-20%", label: "Automation cost" },
          { value: "500+ hrs/yr", label: "Recovered on exec analytics" },
          { value: "Self-hosted", label: "n8n on AWS via Docker" },
          { value: "Org-wide", label: "Standard data flows" },
        ],
        star: {
          problem:
            "Per-seat SaaS automations were expensive and getting more so. C-suite analytics relied on manual exports each week.",
          solution:
            "Self-hosted n8n on AWS via Docker. One platform for every team automation, with data flows standardized across the org.",
          process:
            "Migrated existing automations into n8n. Built executive analytics pipelines that publish on a schedule instead of on-demand.",
          result:
            "20% lower automation cost. 500+ hours/year recovered on executive analytics. AI initiatives ship on a shared substrate.",
        },
        summary:
          "Self-hosted AI workflow infrastructure on AWS to centralize automation and analytics across teams.",
        highlights: [
          "Self-hosted n8n on AWS via Docker, cutting costs 20%.",
          "Automated C-suite analytics pipelines recovering 500+ hours/year.",
          "Standardized data flows for AI initiatives across the org.",
        ],
      },
      tech: ["AWS", "Docker", "n8n", "Data Pipelines", "Automation"],
      img_alt: "Enterprise Data Project - Hybridge Implants LLC",
      img_path: "/enterprise-data.png",
    },
    {
      title: "Case Intake",
      tier: "industry",
      date: "Sep 2026 - Present",
      description:
        "I built a morning list of lab cases that duplicate an earlier scan case, so customer service can merge them. It runs as a demo on sample data while the vendor API license is pending.",
      link: "",
      details: {
        summary_short:
          "Each morning it lists the prescription cases in the dental lab's case system that duplicate an earlier scan case, so customer service can merge them. A demo on sample data; live mode waits on a vendor API license.",
        stats: [
          { value: "06:00 ET", label: "Daily run on Cloud Scheduler" },
          { value: "1 letter", label: "The most a name can be mistyped and still match" },
          { value: "67", label: "Tests" },
          { value: "Demo", label: "Deployed 30 Sep 2026 on sample data; live mode waits on a license" },
        ],
        star: {
          problem:
            "Doctors write the prescription in the lab vendor's customer portal, which cannot edit an existing case, so every prescription arrives as a second case that duplicates the scan case already in the system, and customer service has to catch each pair to merge it.",
          solution:
            "A Next.js app in the Hybridge design on Cloud Run behind IAP. A Cloud Scheduler job runs at 06:00 ET and lists the likely duplicates. The data sits behind a case source and store interface: sample data today, the vendor's API and Firestore once the license lands.",
          process:
            "The name matcher forgives case, spacing, a middle initial, swapped first and last names, and a single mistyped letter. Anything more is a different person.",
          result:
            "Demo deployed on 30 September 2026 on sample data, with 67 tests. Live mode is blocked on a vendor API license, and a second phase doctor portal is parked.",
        },
        summary:
          "A duplicate case finder for the dental lab: prescription cases matched to earlier scan cases every morning, behind IAP, with the data source behind an interface so moving from sample data to the vendor API swaps one implementation.",
        highlights: [
          "Forgiving but bounded name matching: case, spacing, middle initial, swapped names, one typo.",
          "Case source and store interfaces: sample data now, the vendor API and Firestore later.",
          "Runs every morning at 06:00 ET on Cloud Scheduler, on Cloud Run behind IAP.",
          "Built in the Hybridge design system.",
        ],
      },
      tech: ["Next.js", "TypeScript", "Cloud Run", "Cloud Scheduler", "Cloud IAP"],
      img_alt: "Case Intake, Hybridge Implants LLC",
      img_path: "/case-intake.png",
    },
    {
      title: "Hybridge Forms",
      tier: "industry",
      date: "Sep 2026 - Present",
      description:
        "I am building our own forms platform to replace a Tally, Zapier and Monday chain on four company websites, around one rule: no submission is ever lost.",
      link: "",
      details: {
        summary_short:
          "A forms platform to replace Tally, Zapier and Monday on four company websites: a public forms app and embed script, an admin dashboard and form builder behind IAP, a read API and nightly checks. In build, not deployed yet.",
        stats: [
          { value: "32 of 32", label: "Live Tally forms the importer handles" },
          { value: "1,300+", label: "Tests across core, admin, renderer and forms" },
          { value: "11 of 18", label: "Build tasks done as of October 2026" },
          { value: "4 sites", label: "Company websites it will serve" },
        ],
        star: {
          problem:
            "Website forms on four company sites ran through a chain of three vendors: Tally to collect, Zapier to move, Monday to land.",
          solution:
            "One owned platform: a public forms app with an embed script, an admin dashboard with a form builder behind IAP, a read API for downstream tools, and nightly checks.",
          process:
            "Built around one rule: no submission is ever lost. If Firestore fails, the answers go to a private Cloud Storage bucket and the visitor still sees success. If both fail, the server answers 503 and the browser retries four times over about 15 seconds with the same id, then keeps the answers on the device. An importer brings over all 32 live Tally forms.",
          result:
            "In build: about 11 of 18 build tasks done as of October 2026, with over 1,300 tests across the core, admin, renderer and forms packages. Not deployed yet.",
        },
        summary:
          "An owned forms platform for a multi office practice's websites, designed so a submission survives a database outage, a storage outage and a flaky connection.",
        highlights: [
          "Firestore first, a private Cloud Storage bucket as the fallback, and the visitor still gets a success.",
          "The browser retries four times over about 15 seconds with the same id, then keeps the answers locally.",
          "The Tally importer works on all 32 live forms.",
          "Admin dashboard and form builder behind IAP, plus a read API for downstream tools.",
        ],
      },
      tech: ["TypeScript", "Firestore", "Cloud Storage", "Cloud IAP", "Vitest"],
      img_alt: "Hybridge Forms, Hybridge Implants LLC",
      img_path: "/hybridge-forms.png",
    },
    {
      title: "JobPilot",
      demo: "https://jobpilot-demo.pages.dev",
      tier: "personal",
      date: "2026 - Present",
      description:
        "My open-source job-hunt autopilot. It watches 160+ company boards directly, scores each role against my profile, and tailors a resume and cover letter per match, with a calibrated AI judge keeping the rewrites honest.",
      link: "https://hi.switchy.io/yIOl",
      post: "/posts/jobpilot-v2",
      details: {
        summary:
          "An open-source job-hunt platform: direct board watching across eleven sources, schema-locked LLM scoring, a calibrated resume judge with a truth-locked rewrite loop, recruiter outreach drafted but never auto-sent, and a multi-page Next.js console behind IAP. The one project that spans all four disciplines.",
        highlights: [
          "160+ company boards watched directly, not scraped through a job aggregator.",
          "Schema-locked LLM scoring per role, plus a per-job chat copilot grounded in the live description.",
          "A calibrated resume judge with a truth-locked rewrite loop, so a tailored resume never invents experience.",
          "A company watchlist that auto-detects each board's ATS; recruiter and cold outreach drafted into Gmail (never auto-sent), and replies flagged the moment they land.",
          "Open-sourced under MIT with a fork guide written to hand to an AI coding agent.",
        ],
      },
      tech: ["Python", "Next.js", "Vertex AI Gemini", "LaTeX", "Google Sheets", "Cloud Run", "Cloud IAP", "GitHub Actions"],
      img_alt: "JobPilot open-source job-hunt autopilot",
      img_path: "/jobpilot-flagship.png",
    },
  ],

  contact: {
    email: "spa9659@nyu.edu",
    // Switchy short links so outbound clicks are tracked. The canonical profile
    // URLs stay in the JSON-LD sameAs (BaseLayout) for name-SEO, not here.
    linkedin: "https://hi.switchy.io/q378",
    github: "https://hi.switchy.io/q37N",
    instagram: "https://hi.switchy.io/q37U",
  },
};
