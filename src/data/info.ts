export const info = {
  name: "Sampreeth Avvari",
  brief_description: "Software Engineer | Specialised in ML Systems, Agentic AI and ML Infra",
  role: "AI Engineer",
  picture: "/pic.png",
  picture_alt: "Sampreeth Avvari",
  location: "New York, NY",
  cv: "/resume.pdf",

  about: {
    description:
      "I’m an AI Engineer who likes turning big, messy ideas into clean, working products. I completed my MS at NYU, and I’ve built systems that help real teams move faster without losing their sanity. I care about clarity, good taste, and tech that feels human. Also: I’m happiest when the prototype survives real users and still behaves.",
    education: [
      {
        title: "Master of Science, Computer Engineering",
        date: "Aug 2023 - May 2025",
        location: "New York University, NYC, NY",
        logo: "/logos/nyu.svg",
        gpa: "3.9 / 4",
      },
      {
        title: "Bachelor of Technology, Computer Science and Engineering",
        date: "July 2017 - June 2021",
        location: "Jawaharlal Nehru Technological University, India",
        gpa: "3.92 / 4",
      },
    ],
    photos: [
      {
        src: "/About%20page%20pics/Shure%201.JPG",
        alt: "Shure team moment",
        context: "Shure days — building and testing in the lab.",
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
        context: "NYU — the grind, the skyline, the good kind of chaos.",
        position: "center 60%",
        tag: "Grad",
      },
      {
        src: "/About%20page%20pics/NYU%202.AVIF",
        alt: "NYU academic moment",
        context: "NYU milestones — long nights, big wins.",
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
        context: "Hybridge Implants — where AI meets dentistry.",
        position: "center 10%",
        tag: "Hybridge",
      },
      {
        src: "/About%20page%20pics/Hybridge%202.JPG",
        alt: "Hybridge office snapshot",
        context: "Hybridge — innovation, iteration, impact.",
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
          "Architected an event-driven, GCP-hosted AI workflow using Python/FastAPI to ingest Zoom call webhooks, run transcript ETL plus rule-based scoring, and deliver post-consultation doctor coaching reports in under five minutes.",
          "Built a production scoring RAG with Cloud SQL (PostgreSQL plus pgvector), GraphQL, and rubric-backed SQL analytics to persist longitudinal doctor performance and generate feedback, contributing to +130% treatment acceptance and +43% revenue growth.",
          "Operationalized ML infra with containerized API/worker services, queue-based orchestration, and tool-agnostic CI/CD promotion gates to scale across multi-doctor concurrent workflows while reducing hallucinations by 35% under HIPAA-compliant controls.",
        ],
      },
      {
        title: "Backend Engineer Intern",
        date: "May 2025 - Sept 2025",
        location: "Optimal Living Systems, New York",
        highlights: [
          "Built an enterprise version of the Optimal Living Systems AI platform by extending and integrating core product frontend, backend, and chatbot repositories (React, Next.js, Golang), enabling modular and client-specific SaaS deployments.",
          "Created a production-ready AMI by provisioning frontend, backend, bots, and databases (MySQL, Redis, Milvus) within a lightweight K3s Kubernetes cluster on AWS EC2, enabling seamless deployment to enterprise private clouds.",
          "Implemented tag-scoped RAG retrieval with Milvus filtering at index and query time; added CloudWatch for on-call troubleshooting and supported cross-region migration (ap-southeast1 to us-east-1) across S3, ECR, RDS, and ElastiCache, cutting latency by 50ms.",
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
          "Implemented an RLHF policy-optimization lifecycle from SFT to GRPO/ORPO, producing comparative inference artifacts to improve persuasion quality.",
        ],
      },
    ],
    skills: [
      {
        label: "Languages",
        items: ["Python", "Go", "Java", "C++", "C#", "TypeScript", "JavaScript", "SQL"],
      },
      {
        label: "Full Stack",
        items: [
          "React",
          "Next.js",
          "Angular",
          "FastAPI",
          "Flask",
          "Spring Boot",
          "Node.js",
          "Express.js",
          "Microservices",
        ],
      },
      {
        label: "Databases",
        items: ["PostgreSQL", "MySQL", "MongoDB", "DynamoDB", "Redis", "Milvus", "pgvector"],
      },
      {
        label: "Data / Infra",
        items: [
          "Kafka",
          "Amazon MSK",
          "AWS (S3, DynamoDB)",
          "GCP (Cloud SQL, Pub/Sub)",
          "Docker",
          "Kubernetes",
          "Spark",
        ],
      },
      {
        label: "Testing",
        items: [
          "Unit Tests",
          "Integration Tests",
          "Test Coverage",
          "pytest",
          "JUnit",
          "Selenium",
        ],
      },
      {
        label: "Tools",
        items: [
          "GraphQL",
          "Jenkins",
          "Git",
          "SVN",
          "Figma",
          "CloudWatch",
          "Prometheus",
          "Grafana",
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
          "PyTorch",
          "TensorFlow",
          "Transformers",
          "TRL",
          "HuggingFace",
          "WandB",
        ],
      },
    ],
  },

  projects: [
    {
      title: "CBCT Scan Validator — Hybridge Implants LLC",
      date: "Mar 2026 - Present",
      description:
        "Production medical-imaging AI replacing a $98K + $26K/yr vendor quote with an in-house stack running <$50/mo on GCP. Closes a 10-year recurring loss from bad CBCT scans reaching the design queue.",
      link: "",
      details: {
        summary:
          "End-to-end MLOps pipeline: SFTP ingest from MagicTouch DLCPM → ETL parity-checked across train/eval/serve → DentalSegmentator-backboned multi-task head → OpenVINO inference on Cloud Run → verdict PDF + email + write-back. ~5.5s end-to-end, CPU-only, scale-to-zero.",
        highlights: [
          "Bake-off across six architectures (A–F: ConvNeXt-MIL, Hybrid Transformer, 3D CNN, nnU-Net, VAE, ST-MAE), then iterated through Models G, H, and J as data and failure modes taught more.",
          "Model H: frozen DentalSegmentator nnU-Net v2 encoder + multi-scale taps (global/mid/slice-seq BiGRU + attention) + compact 500K-param head with feature-space augmentation and cost-tuned threshold (FN cost = 15× FP).",
          "Strict 20-scan CICT holdout wired into GitHub Actions caught a leaky AUROC 0.80 — shipped the honest 0.6309 number rather than gaming the gate.",
          "Tag-based CI/CD (git tag vX.Y.Z → Cloud Build → Cloud Run) with hot-swap head checkpoint via GCS, no rebuild of the OpenVINO encoder IR required.",
          "Drove the partner integration (DLCPM, no API license) by discovering their bidirectional SFTP path — single architectural pivot that kept the project unblocked.",
        ],
      },
      tech: ["PyTorch Lightning", "MONAI", "OpenVINO", "FastAPI", "Cloud Run", "Eventarc", "W&B", "GitHub Actions"],
      img_alt: "CBCT Scan Validator - Hybridge Implants LLC",
      img_path: "/cbct-validator.svg",
    },
    {
      title: "Treatment Estimator — Hybridge Implants LLC",
      date: "May 2026 - Present",
      description:
        "Decoupled a decade-old single-price quoting tool into a code-driven decision tree + per-location frozen-at-capture price catalog. Makes the 6-month price-guarantee a real system property, not a sticker on the PDF.",
      link: "",
      details: {
        summary:
          "Next.js 16 + Postgres + Drizzle internal tool for treatment coordinators across three clinics. Five pricing model kinds (flat, tiered, tiered-zoned, price-range, per-surface) with write-once price snapshots and an immutable price-book versioning workflow (proposed → approved → published).",
        highlights: [
          "Wrote a 9-decision ADR with tradeoff tables and library citations before any code — Next.js, Drizzle, Cloud Run, Auth.js, RBAC topology, all justified against a $35/mo cost target.",
          "Designed write-once *_at_capture columns enforced by Postgres triggers + per-location price-book versions — the 6-month price guarantee becomes a real invariant, not a PDF claim.",
          "Three-affordance wizard orientation (phase progress strip + within-option checklist with answer recap + sticky 'selections so far' sidebar) so the TC never loses context mid-consult.",
          "Code-driven decision tree (Path strategy classes) + DB-driven price catalog with a 100% branch-coverage gate on the pricing engine; golden snapshots lock every documented wizard path.",
          "BACKLOG.md of 30+ consciously-deferred items with revisit triggers and a `questions-for-Chelsea` doc with worked numerical examples so the clinical SME could review without reading code.",
        ],
      },
      tech: ["Next.js 16", "TypeScript", "Drizzle", "PostgreSQL", "Auth.js", "Cloud Run", "@react-pdf/renderer", "Zod"],
      img_alt: "Treatment Estimator - Hybridge Implants LLC",
      img_path: "/treatment-estimator.svg",
    },
    {
      title: "Cowork Dashboard — Hybridge Implants LLC",
      date: "Apr 2026 - May 2026",
      description:
        "Replaced a brittle live-Monday-API dashboard with a weekly-Excel pipeline that lifted patient↔lead linkage from 49% to ~99%. Single source of truth for every operational metric across two clinics.",
      link: "",
      details: {
        summary:
          "Internal operations dashboard for two clinics (Rochester / Buffalo). Apps Script web app on top of weekly Monday.com Excel exports, with one shared metrics module so every tab and widget computes from the same definitions.",
        highlights: [
          "Found that Monday's connect column (a real board_relation, not a mirror) survives Excel export — drove patient↔lead linkage from 49.5% / 65.3% to 98.8% / 99.9% across two boards.",
          "Cut the weekly reporting cycle from half a day of manual reconciliation to a 3-minute drop-three-Excels-and-refresh workflow.",
          "Six tabs (Dashboard, Monthly, History, Lead Sources, Trends, Playground) share one filter bar and one set of metric functions — structurally impossible for two tabs to disagree.",
          "Encoded every business rule explicitly (marketing taxonomy, location filter, excluded reasons, scheduled-date semantics, consult-show parsing) so leadership stops arguing about whose number is right.",
          "Surfaced 24 orphan re-treatment patients carrying $169k of YTD treatment value that the old dashboard was silently dropping.",
        ],
      },
      tech: ["Google Apps Script", "Monday.com GraphQL", "Drive API", "Chart.js", "JavaScript"],
      img_alt: "Cowork Dashboard - Hybridge Implants LLC",
      img_path: "/cowork-dashboard.svg",
    },
    {
      title: "Loan Radar",
      date: "Jan - May 2025",
      description:
        "Architected end-to-end ML CI/CD for loan-default scoring with containerized training and serving, MLflow model lineage, and automated quality gates before promotion.",
      link: "https://hi.switchy.io/cv-i",
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
      img_path: "/loan-radar.svg",
    },
    {
      title: "LLM Persuasion (RLHF with GRPO/PPO) - Research",
      date: "May 2024 - Sep 2025",
      description:
        "Built RLHF pipelines to improve persuasive counter-arguments using GRPO and PPO, with reward modeling and human evaluation.",
      link: "https://github.com/marcomorucci/LLM-Persuasion/tree/main/Sampreeth",
      details: {
        summary:
          "Research project focused on persuasion and argument mining using RLHF, comparing GRPO and PPO-style updates and a learned reward model.",
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
      title: "Doc Coach — Consultation QA Pipeline (Hybridge Implants LLC)",
      date: "Aug 2025 - Present",
      description:
        "Zoom transcript → Vertex AI Gemini scoring against a proprietary 7-criterion clinical framework → color-coded PDF reports to doctor + CEO + TC, with a master Sheet ledger for trend analysis. HIPAA-eligible, multi-tenant Zoom.",
      link: "",
      details: {
        summary:
          "Production-grade Cloud Run pipeline that grades every implant consultation across two Zoom Business orgs and three TCs. Doctor↔TC pairing is fully flexible — identity is resolved per-meeting through participants list, transcript alias matching, and an LLM tie-break, with explicit failure modes for unresolved cases.",
        highlights: [
          "Drove +130% treatment acceptance and +43% revenue growth, with stateful agent chains cutting hallucinations by 35% under HIPAA-compliant controls.",
          "Translated the CEO's hand-written 7-criterion framework into a versioned `consultation-rubric.md` prompt + JSON Schema 2020-12 contract that every Gemini response must validate against (with one retry on schema-fail).",
          "Wrote a 19-section, 11-acceptance-test PRD with locked column orderings and explicit edge cases (Step 3 clinical override, Step 5 fee-presenter attribution) — usable as engineering brief AND clinical-stakeholder reference.",
          "Built a production scoring RAG with Cloud SQL pgvector + GraphQL + rubric-backed SQL analytics for longitudinal doctor performance and feedback generation.",
          "Avoided Workspace Domain-Wide Delegation by using a user-OAuth grant on the build owner's account (refresh token in Secret Manager) — bypassed Super Admin dependency entirely.",
        ],
      },
      imageStyle: "object-position: center 20%;",
      tech: ["FastAPI", "Vertex AI Gemini 2.5", "Cloud Run", "Cloud SQL pgvector", "GraphQL", "Firestore", "BigQuery", "Drive/Sheets/Gmail APIs"],
      img_alt: "Doc Coach - Hybridge Implants LLC",
      img_path: "/doc-coach.png",
    },
    {
      title: "NPC Coach - Hybridge Implants LLC",
      date: "Aug 2025 - Present",
      description:
        "Agentic AI automation framework for New Patient Coordinators (NPCs) with real-time coaching and QA.",
      link: "",
      details: {
        summary:
          "An n8n-based agentic QA system that grades performance and triggers coaching feedback for New Patient Coordinators (NPCs).",
        highlights: [
          "Intake conversion improved from 3% to 12% with real-time coaching.",
          "End-to-end CoT grading engine analyzing 6-phase performance metrics.",
          "Automated feedback emails and workflow orchestration in n8n.",
        ],
      },
      imageStyle: "object-position: center 20%;",
      tech: ["n8n", "Gemini 3 Pro", "JavaScript", "pgvector", "Automation"],
      img_alt: "NPC Coach - Hybridge Implants LLC",
      img_path: "/npc-coach.png",
    },
    {
      title: "RAG-IPL",
      date: "Jan - May 2025",
      description:
        "Designed a natural-language-to-SQL system with LangChain and RapidFuzz, using OpenAI embeddings and Streamlit to deliver verifiable IPL insights without hallucinations.",
      link: "",
      details: {
        summary:
          "A natural-language-to-SQL assistant for IPL stats that prioritizes verifiable answers by compiling queries into SQL instead of free‑form generation.",
        highlights: [
          "Hybrid parsing with LangChain + RapidFuzz to map user questions to IPL schema and metrics.",
          "OpenAI embeddings for retrieval, with a Streamlit UI for interactive exploration.",
          "All responses are grounded in SQL results to minimize hallucinations.",
        ],
      },
      tech: ["LangChain", "RapidFuzz", "OpenAI Embeddings", "Streamlit", "SQLite"],
      img_alt: "RAG-IPL",
      img_path: "/rag-ipl.svg",
    },
    {
      title: "Fake News and Sentiment Analysis",
      date: "Feb - May 2024",
      description:
        "Fine-tuned LLaMA 3 8B (QLoRA) and RoBERTa on 1.8M+ tweets to model misinformation and sentiment; achieved 76% on LIAR and used LDA for topic-level patterns.",
      link: "https://hi.switchy.io/U4wO",
      details: {
        summary:
          "Research project analyzing fake news and sentiment trends in 2020 U.S. election tweets using Llama 3 and RoBERTa with topic modeling.",
        highlights: [
          "Llama 3-based fake news detection paired with RoBERTa sentiment analysis.",
          "Topic modeling with LDA to surface narrative clusters.",
          "Project notebooks cover fine‑tuning, inference, and analysis workflows.",
        ],
      },
      tech: ["LLaMA 3", "QLoRA", "RoBERTa", "LDA", "Python"],
      img_alt: "Fake News and Sentiment Analysis",
      img_path: "/fake-news.svg",
    },
    {
      title: "ResNet Under 5M Parameters",
      date: "2024",
      description:
        "Designed compact ResNet variants for CIFAR-10 under 5M parameters and achieved 97.12% accuracy on the best model.",
      link: "https://hi.switchy.io/q3I_",
      details: {
        summary:
          "Designed ResNet variants from scratch for CIFAR‑10 while keeping model size under 5M parameters.",
        highlights: [
          "Best model (ResNet26) reached 97.12% test accuracy with <5M parameters.",
          "Multiple architectures compared across depth/width configurations.",
          "Training runs documented in notebooks with reproducible settings.",
        ],
      },
      tech: ["ResNet", "PyTorch", "CIFAR-10"],
      img_alt: "ResNet Under 5M Parameters",
      img_path: "/resnet-compact.svg",
    },
    {
      title: "Customer Segmentation and Recommendation System",
      date: "Feb - May 2024",
      description:
        "Built a Spark-based recommendation pipeline on Hadoop using MinHash LSH and ALS matrix factorization over 22M+ records, improving Precision@K by 20%.",
      link: "https://hi.switchy.io/U4wS",
      details: {
        summary:
          "A large-scale recommendation pipeline for customer segmentation using Spark on Hadoop, built to handle tens of millions of records efficiently.",
        highlights: [
          "MinHash LSH for candidate generation and ALS matrix factorization for personalized recommendations.",
          "Processed 22M+ records with scalable Spark jobs on HDFS-backed storage.",
          "Improved Precision@K by ~20% over popularity baselines.",
        ],
      },
      tech: ["Spark", "Hadoop", "MinHash LSH", "ALS", "Python"],
      img_alt: "Customer Segmentation and Recommendation System",
      img_path: "/customer-segmentation.svg",
    },
    {
      title: "Enterprise Data Project - Hybridge Implants LLC",
      date: "Aug 2025 - Present",
      description:
        "Unified AI infrastructure and data pipelines to cut costs and automate executive analytics.",
      link: "",
      details: {
        summary:
          "Self-hosted AI workflow infrastructure on AWS to centralize automation and analytics across teams.",
        highlights: [
          "Deployed self-hosted n8n on AWS via Docker, cutting costs by 20%.",
          "Automated C‑suite analytics pipelines to recover 500+ hours annually.",
          "Standardized data flows for AI initiatives across the org.",
        ],
      },
      tech: ["AWS", "Docker", "n8n", "Data Pipelines", "Automation"],
      img_alt: "Enterprise Data Project - Hybridge Implants LLC",
      img_path: "/enterprise-data.svg",
    },
  ],

  contact: {
    email: "spa9659@nyu.edu",
    linkedin: "https://hi.switchy.io/MMTw",
    github: "https://hi.switchy.io/q37N",
    instagram: "https://hi.switchy.io/q37U",
  },
};
