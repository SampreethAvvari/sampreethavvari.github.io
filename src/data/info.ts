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
          "[Consultation QA Pipeline](/posts/clinical-rag). Cloud Run + FastAPI grades every Zoom consult against a 7-criterion rubric. Schema-validated Gemini scoring, three-layer doctor ID, HIPAA-clean without Workspace DWD. -35% hallucinations vs the no-schema baseline; +130% acceptance and +43% revenue downstream.",
          "[Pipeline observability hardening](/posts/pipeline-ghosting). Hardened that same QA pipeline after it kept showing ✅ complete while emails never sent and Sheet rows never appeared. Killed 9 silent-failure modes (bare-except graveyard, connection-level retry gaps, status-color drift), added durable webhook rows, a rerun-replaces-old flow, a consistency reconciler, and a plain-English Logs UI. 51/0/0 in the audit, +50 targeted tests.",
          "[NPC Coach](/posts/npc-coach). Rebuilt a brittle n8n call grader into a coaching platform for the front desk: it finds every new-patient call, grades it against the practice playbook with a verbatim transcript quote behind each of six criteria, and tracks each coordinator's trend in BigQuery behind a 26-endpoint React dashboard. 40/40/20 weighted score plus 3 hard gates as flags, not caps; ports-and-adapters gated by one NPC_BAA_ACCEPTED switch so 1,156 tests run with no cloud and no PHI. Day one on live calls: ~285 ingested, 40 scored, 3 voicemails auto-filtered, 28 flagged.",
          "[CBCT Scan Validator](/posts/cbct-scan-validator). In-house dental CT classifier. Replaced a $98K + $26K/yr vendor quote with a Cloud Run service under $50/mo. Frozen DentalSegmentator + multi-scale head, OpenVINO on CPU, ~5.5s end-to-end. 20-scan CICT gate on every push.",
          "[Treatment Estimator](/posts/treatment-estimator). Next.js + Postgres rebuild of a decade-old quoting tool. Write-once `_at_capture` columns + Postgres triggers turn the 6-month price guarantee into a real DB invariant. Shipped end-to-end in ~1 month; a prior vendor never shipped in a decade.",
          "[Cowork Dashboard](/posts/cowork-dashboard). Apps Script on weekly Monday.com exports. Patient-to-lead linkage went from 49% to 99% via the Monday connect column. Surfaced ~$460k of orphan patient value. Weekly recon: half a day → 3 minutes.",
          "[Accounting Automation Suite](/posts/accounting-automation). A dozen Python scripts that replaced the controller's manual weekly imports across Denticon, MagicTouch, Paychex, and two banks. ~6-8 hrs/week → 30-45 min. ~400 hrs/yr recovered.",
          "[Reconciliation](/posts/reconciliation). A deterministic engine that cross-checks the schedule, production ledger, and clinical notes across Eaglesoft and Denticon to confirm every patient seen got documented and billed, surfacing only the exceptions. ~6 staff-hours/day of manual cross-checking down to a few minutes; 150+ tests on synthetic fixtures, no PHI in git; live on Cloud Run (v1.6.0).",
          "[Centralized Diagnostic Filter](/posts/cdf-diagnostic-filter). Turning the founder's diagnostic model into a standardized, HYBRIDGE-owned system: every scan, photo, and survey into one report with a 0-200 risk score and a treatment leaning, where AI assists and doctors validate. Phase 1, the owned in-house intake on Google Cloud, in progress.",
          "Cross-cutting MLOps: one shared ETL module so train/serve skew is impossible. Hot-swap checkpoints via GCS, tag-based Cloud Build CI/CD, OpenTelemetry with strict no-PHI logs.",
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
      title: "Enterprise Search",
      tier: "industry",
      flagshipRank: 1,
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
          { value: "Foundation shipped", label: "auth + infra live; ingestion in build; query + eval designed" },
        ],
        star: {
          problem:
            "Company knowledge is scattered across drives, decks, and people's heads, and in a HIPAA shop a confident wrong answer is a liability, not a demo bug. A basic chunk-embed-and-pray RAG fails on exact terms, on conflicting documents, and on access control.",
          solution:
            "A trust-first RAG. The read path filters by permission, retrieves with BM25 and pgvector together, fuses with RRF, reranks a bounded top-k, resolves conflicts deterministically, and answers with citations or abstains. The governed write path dedups, parses with layout awareness, chunks semantically, and stamps every chunk with its model and strategy versions.",
          process:
            "Built like a curriculum, one stage at a time, with an eval harness as the referee: recall, nDCG, MRR, and faithfulness measured against a managed baseline before any answer is trusted. The agentic corrective loop is gated behind a confidence check, so it never runs on a simple query.",
          result:
            "Foundation and auth shipped: domain-locked Identity Platform sign-in, roles and groups, Terraform, and tested CI/CD, all GCP-native and HIPAA-eligible. Ingestion is fully specified and in build; query serving, evaluation, and the front ends are designed and queued.",
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
      tier: "industry",
      flagshipRank: 3,
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
      tier: "industry",
      date: "May 2026 - Present",
      description:
        "I rebuilt a 10-year-old pricing tool. The 6-month price promise is now something the database itself enforces.",
      link: "",
      details: {
        summary_short:
          "Rebuilt a decade-old quoting tool. The 6-month price guarantee is now a database invariant.",
        stats: [
          { value: "~1 month", label: "Spec → end-to-end (vendor: never)" },
          { value: "100%", label: "Branch coverage on pricing engine" },
          { value: "5", label: "Pricing model kinds" },
          { value: "<$35/mo", label: "Cost target hit" },
        ],
        star: {
          problem:
            "A 10-year-old single-price tool couldn't handle three clinics with different price books. The 6-month price-lock was a promise on the PDF, not a system property. An earlier vendor attempt never shipped.",
          solution:
            "Next.js 16 + Postgres + Drizzle rebuild. Five pricing models (flat, tiered, tiered-zoned, price-range, per-surface). Write-once `*_at_capture` columns enforced by Postgres triggers + per-location price-book versions. The price lock is a real DB invariant.",
          process:
            "9-decision ADR with tradeoff tables and library citations before any code. 100% branch coverage on the pricing engine. Golden snapshots lock every documented wizard path. A `questions-for-Chelsea` doc with worked numbers lets the clinical SME review without reading code.",
          result:
            "Shipped end-to-end in about a month, what a vendor failed to ship in a decade. Runs under $35/mo. A BACKLOG.md of 30+ consciously deferred items keeps scope honest.",
        },
        summary:
          "Next.js 16 + Postgres + Drizzle for treatment coordinators across three clinics. Five pricing models with write-once price snapshots. Price-book lifecycle: proposed → approved → published.",
        highlights: [
          "9-decision ADR with tradeoff tables before any code.",
          "Write-once *_at_capture columns + Postgres triggers turn the 6-month guarantee into a DB invariant.",
          "Three-affordance wizard so the TC never loses context mid-consult.",
          "100% branch coverage on the pricing engine; golden snapshots per wizard path.",
        ],
      },
      tech: ["Next.js 16", "TypeScript", "Drizzle", "PostgreSQL", "Auth.js", "Cloud Run", "@react-pdf/renderer", "Zod"],
      img_alt: "Treatment Estimator - Hybridge Implants LLC",
      img_path: "/treatment-estimator.png",
    },
    {
      title: "Cowork Dashboard",
      tier: "industry",
      date: "Apr 2026 - May 2026",
      description:
        "I rebuilt a flaky dashboard on weekly exports. Two clinics, one set of numbers everyone finally trusts.",
      link: "",
      details: {
        summary_short:
          "Replaced a brittle live-API dashboard with weekly Excel exports. Two clinics, one source of truth.",
        stats: [
          { value: "49% → 99%", label: "Patient ↔ lead linkage" },
          { value: "~$460k", label: "Orphan value surfaced" },
          { value: "½ day → 3 min", label: "Weekly recon time" },
          { value: "6 tabs, 1 truth", label: "Shared metrics module" },
        ],
        star: {
          problem:
            "The old dashboard hit the Monday.com API live, broke constantly, and patient↔lead linkage sat at 49% / 65% across the two clinics. Leadership argued about whose numbers were right.",
          solution:
            "Apps Script on weekly Excel exports. One shared metrics module so every tab and widget computes from the same definitions. Six tabs share one filter bar.",
          process:
            "Found that Monday's connect column (a real board_relation, not a mirror) survives Excel export. Encoded every business rule explicitly: marketing taxonomy, location filter, excluded reasons, scheduled-date semantics, consult-show parsing.",
          result:
            "Linkage 49.5% / 65.3% → 98.8% / 99.9% across two boards. Weekly recon: half a day → 3 minutes. Surfaced orphan re-treatment patients worth ~$460k of treatment value.",
        },
        summary:
          "Apps Script web app on weekly Monday.com exports for two clinics (Rochester / Buffalo).",
        highlights: [
          "Linkage 49% → 99% via the Monday connect column.",
          "Weekly recon: half a day → 3 minutes.",
          "Six tabs share one filter bar and one metric module.",
          "Surfaced ~$460k of orphan patient value the old dashboard was silently dropping.",
        ],
      },
      tech: ["Google Apps Script", "Monday.com GraphQL", "Drive API", "Chart.js", "JavaScript"],
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
      tier: "industry",
      flagshipRank: 2,
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
      tier: "industry",
      flagshipRank: 5,
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
      tier: "industry",
      date: "Jun 2026 - Present",
      description:
        "I replaced a daily six-hour manual cross-check with an engine that reads three exports and shows staff only the flagged patients.",
      link: "",
      details: {
        summary_short:
          "Confirms every patient seen got both documented and billed, across two practice-management systems, and surfaces only the exceptions. Shipped and live.",
        stats: [
          { value: "6 hrs → minutes", label: "Daily cross-check vs exception review" },
          { value: "2 systems, 1 engine", label: "Eaglesoft + Denticon through one core" },
          { value: "150+ tests", label: "All on synthetic fixtures, no PHI in git" },
          { value: "v1.6.0", label: "Shipped and live on Cloud Run" },
        ],
        star: {
          problem:
            "Two front-office staff spent about three hours each every day cross-checking the schedule, the production ledger, and the clinical notes by hand to confirm every patient seen got documented and billed. It was slow and it failed exactly where mistakes cost the most: care documented but never billed, or billed with no note behind it.",
          solution:
            "A pure, deterministic reconciliation engine wrapped in a thin FastAPI app. Two source adapters (Eaglesoft CSV, Denticon xlsx) normalize hostile exports into the same typed models, the matcher keys everything on patient_id, and a small set of honest buckets separates verified patients from the handful that need a human.",
          process:
            "The engine has no network, no database, and no clock, and it takes the timestamp as a parameter, so identical inputs give byte-identical output and every count traces to a source row. Columns map by name and a missing one fails loud. 150+ tests run on synthetic fixtures that mirror every real quirk, plus an opt-in golden test against a real day, so no PHI ever enters the repo.",
          result:
            "Shipped and live at v1.6.0 on Cloud Run. About six person-hours of daily cross-checking became a few minutes of exception review; roughly 30 of 41 patients a day clear automatically. A Gemini clinical matcher is built and waiting behind a preview-mode rollout.",
        },
        summary:
          "A HIPAA-safe reconciliation tool for a multi-location dental group. A deterministic Python engine confirms each patient seen was documented and billed across Eaglesoft and Denticon; the FastAPI shell adds auth, a dashboard, history, and Gmail delivery.",
        highlights: [
          "Pure deterministic engine split from the app shell: same inputs, byte-identical, auditable output.",
          "Two practice-management systems normalized into one set of typed models via a source-adapter registry.",
          "Matching keyed on patient_id with a fuzzy-name fallback that flags low-confidence rather than guessing.",
          "150+ tests on synthetic fixtures plus an opt-in golden test; no patient data in git, ever.",
          "Gemini clinical matcher (tooth, surface, procedure code) built but gated behind a preview rollout.",
        ],
      },
      tech: ["Python", "FastAPI", "Vertex AI Gemini", "Firestore", "Cloud Run", "Google OAuth", "pytest"],
      img_alt: "Reconciliation - Hybridge Implants LLC",
      img_path: "/reconciliation.png",
    },
    {
      title: "Centralized Diagnostic Filter",
      tier: "industry",
      flagshipRank: 4,
      date: "Jun 2026 - Present",
      description:
        "I am turning a founder's diagnostic mental model into a standardized system: every scan, photo, and survey into one report, with the doctor validating every finding.",
      link: "",
      details: {
        summary_short:
          "A standardized restorative prognosis operating system for complex implant cases. AI assists, doctors validate. Phase 1, the in-house intake, is in progress.",
        stats: [
          { value: "4 phases", label: "Intake to report to AI findings to scale" },
          { value: "0-200", label: "Future tooth-loss risk score, 4 bands" },
          { value: "14 to 9", label: "Input classes into report sections" },
          { value: "Phase 1", label: "In progress on Google Cloud" },
        ],
        star: {
          problem:
            "The practice's diagnostic intelligence lived in the founder's head and a third-party intake tool. Assessments were screenshotted by hand, filed manually, duplicated across three markets, and the HIPAA posture was unverified. There was no standardized, owned way to turn a complex case into one consistent report.",
          solution:
            "The Centralized Diagnostic Filter: a HYBRIDGE-owned system that pulls CBCT, scans, photos, and a risk survey into one standardized report across nine sections, with a future-tooth-loss risk score and a treatment leaning, never a final diagnosis. The governing rule is AI assists, doctors validate.",
          process:
            "Phased to de-risk. Phase 1 replaces the third-party intake with an owned, BAA-covered questionnaire and premium PDF on Google Cloud; later phases add the unified diagnostic report, AI-assisted radiograph and bone-support findings behind a doctor validation queue, and practice-management integrations. Schema-versioned, auditable, and role-based from the first commit.",
          result:
            "Phase 1 is in progress: spec and architecture approved, private repo and Terraform-managed GCP foundation live, brand and six cover concepts done, the 0-200 risk model preserved, and the questionnaire schema, patient form, PDF generator, and delivery pipeline underway.",
        },
        summary:
          "A standardized diagnostic operating system for complex restorative and implant dentistry, built with the practice founder. One report from every modality, a preserved 0-200 risk model, and a human-in-the-loop AI layer where every finding is doctor-confirmed.",
        highlights: [
          "Translates a veteran clinician's diagnostic model into a buildable, phased spec.",
          "Standardized Bone Support Visualization: current bone architecture against an ideal reference.",
          "A 0-200 future tooth-loss risk score across four bands, preserved from the existing model.",
          "AI assists, doctors validate: every AI finding is provisional until a doctor signs it.",
          "HYBRIDGE-owned on Google Cloud, schema-versioned and auditable from day one.",
        ],
      },
      tech: ["Python", "Google Cloud", "Terraform", "Vertex AI", "DICOM / CBCT", "PDF generation", "HIPAA"],
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
      title: "JobPilot",
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
