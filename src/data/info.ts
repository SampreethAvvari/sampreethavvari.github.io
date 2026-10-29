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
      "I'm an AI engineer who likes building things right next to the people who'll actually use them. After my MS at NYU, I joined a dental implant company as its only engineer, and the systems I ship there are used every day by doctors, coordinators, finance and the lab. I also make movies, which is where I learned to work with people who don't write code.",
    // Everything on one axis for the About timeline. start/end are "YYYY-MM";
    // "present" pins to today. short is the label inside the bar.
    timeline: [
      {
        title: "Bachelor of Technology, Computer Science",
        short: "BTech CSE · JNTU",
        org: "Jawaharlal Nehru Technological University",
        location: "Hyderabad, India",
        date: "July 2017 to June 2021",
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
        short: "Software Engineer · Shure",
        org: "Shure Incorporated",
        location: "India",
        date: "Aug 2021 to Aug 2023",
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
        short: "MS CompE · NYU",
        org: "New York University",
        location: "New York",
        date: "Aug 2023 to May 2025",
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
        short: "Video Producer · NYU",
        org: "New York University",
        location: "New York",
        date: "Jan 2024 to May 2025",
        start: "2024-01",
        end: "2025-05",
        logo: "/logos/nyu.svg",
        accent: "#F43F5E",
        rgb: "244,63,94",
        kind: "work",
        blurb:
          "Directed and edited educational video for NYU public health faculty, shot on a Sony Alpha 7III and cut in DaVinci Resolve and Premiere Pro, with motion graphics in After Effects.",
      },
      {
        title: "Graduate Machine Learning Researcher",
        short: "ML Researcher · NYU",
        org: "New York University",
        location: "New York",
        date: "May 2024 to Sep 2025",
        start: "2024-05",
        end: "2025-09",
        logo: "/logos/nyu.svg",
        accent: "#A78BFA",
        rgb: "167,139,250",
        kind: "work",
        blurb:
          "Language model research: turned ChangeMyView replies into preference pairs, trained a reward model, then fine tuned a 4 bit Llama 3 8B with SFT and GRPO using TRL, Unsloth and QLoRA on NYU's GPU cluster.",
        projects: [
          { label: "How I trained Llama to argue", href: "/posts/llama-rlhf" },
        ],
      },
      {
        title: "AI Engineer",
        short: "AI Engineer · Hybridge",
        org: "Hybridge Implants",
        location: "New York",
        date: "Sept 2025 to present",
        start: "2025-09",
        end: "present",
        logo: "/logos/hybridge.webp",
        accent: "#F5A524",
        rgb: "245,165,36",
        kind: "work",
        blurb:
          "The AI engineer for a dental implant practice with three offices and its own lab: 45 live services on Google Cloud, from Gemini consult grading and call coaching to a Denticon mirror, a capacity planner, a quoting tool that freezes every quoted price, and a reconciliation engine.",
        projects: [
          { label: "Patient Dashboard", href: "/posts/patient-dashboard" },
          { label: "Capacity Planner", href: "/posts/capacity-planner" },
          { label: "Doc Coach", href: "/posts/clinical-rag" },
          { label: "NPC Coach", href: "/posts/npc-coach" },
          { label: "Treatment Estimator", href: "/posts/treatment-estimator" },
          { label: "Reconciliation", href: "/posts/reconciliation" },
          { label: "CDF Diagnostic Filter", href: "/posts/cdf-diagnostic-filter" },
          { label: "Platform map", href: "/posts/platform" },
        ],
      },
    ],
    education: [
      {
        title: "Master of Science, Computer Engineering",
        date: "Aug 2023 to May 2025",
        location: "New York University, NYC, NY",
        logo: "/logos/nyu.svg",
        gpa: "3.84 / 4",
      },
      {
        title: "Bachelor of Technology, Computer Science and Engineering",
        date: "July 2017 to June 2021",
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
        date: "Sept 2025 to present",
        location: "Hybridge Implants, New York",
        logo: "/logos/hybridge.webp",
        logoClass: "h-12",
        highlights: [
          "[Consultation QA Pipeline](/posts/clinical-rag). A Zoom webhook starts a Gemini grader that scores every consult against the CEO's seven criterion rubric, with a transcript quote and timestamp behind each score. 471 consults scored live from May 19 to Oct 28 across three offices; median 2.7 minutes from transcript to sent report in October. It also drafts the doctor's chart note, guarded so a truncated note never ships.",
          "[Pipeline observability hardening](/posts/pipeline-ghosting). Runs went green while emails never sent. I moved the run row to the top, made every failure retry or turn amber, resent 13 runs that had scored but never emailed, and added a Logs tab anyone can read.",
          "[NPC Coach](/posts/npc-coach). Rebuilt an n8n call grader into a coaching platform for the front desk: it finds new patient calls among thousands of recordings, grades each on six criteria with a transcript quote behind every score, and tracks each coordinator against their own 30 day average. 690 real calls graded since June 17, a median 14 minutes after the call ends; live calls 16 days after the first commit.",
          "[CBCT Scan Validator](/posts/cbct-scan-validator). In house dental CT quality gate, built in 38 days against a $98,200 vendor quote. Frozen DentalSegmentator encoder on OpenVINO CPU, a cost tuned threshold, SFTP both ways with the lab system. Honest 0.63 AUROC on a strict holdout; the testing team has run 123 real studies through it.",
          "[Treatment Estimator](/posts/treatment-estimator). Next.js and Postgres quoting tool for three offices. Every saved line keeps its price, tier, label and price book version, so a later price change never reaches a saved quote. v1.0.0 shipped 14.5 hours after the first commit.",
          "[Cowork Dashboard](/posts/cowork-dashboard). Monday.com boards turned into the leadership dashboard, moved from Apps Script to Cloud Run in September with one definition per metric. Fixing the patient to lead join surfaced about $460K of patient value no lead pointed at, and cash flow now reads Monday every morning.",
          "[Accounting Automation Suite](/posts/accounting-automation). Our controller's nine Python scripts moved from a laptop terminal to one page behind IAP in one evening. Every question is asked before the run, and every script edit is tested before it is committed.",
          "[Reconciliation](/posts/reconciliation). A deterministic engine that cross checks the schedule, production ledger, and clinical notes across Eaglesoft and Denticon to confirm every patient seen got documented and billed correctly, surfacing only the exceptions. About 70 hours a week of manual cross checking by the insurance team became an exception review; live on Cloud Run.",
          "[Centralized Diagnostic Filter](/posts/cdf-diagnostic-filter). Intake and experience surveys with Gemini writing the doctor's page and a panorex read under the founder's own ruleset. Every Gemini call falls back through newer models, and clinic emails wait for both reports.",
          "[Platform map](/posts/platform). 45 live services in 14 Google Cloud projects for three offices and a lab. One service holds the Denticon credentials, every other app reads the mirror through a registry, and six apps file feature requests through one relay.",
        ],
      },
      {
        title: "Graduate Machine Learning Researcher",
        date: "May 2024 to Sep 2025",
        location: "New York University, New York",
        logo: "/logos/nyu.svg",
        highlights: [
          "Language model research: turned ChangeMyView replies into preference pairs, trained a reward model with TRL and QLoRA, and fine tuned a 4 bit Llama 3 8B with SFT and GRPO on NYU's GPU cluster.",
        ],
      },
      {
        title: "Video Producer",
        date: "Jan 2024 to May 2025",
        location: "New York University, New York",
        logo: "/logos/nyu.svg",
        highlights: [
          "Directed and edited educational video for NYU GPH faculty and their Brightspace courses on public health topics.",
          "Shot on a Sony Alpha 7III; edited in DaVinci Resolve and Adobe Premiere Pro with motion graphics and titles in After Effects.",
        ],
      },
      {
        title: "Software Engineer",
        date: "Aug 2021 to Aug 2023",
        location: "Shure Incorporated, India",
        logo: "/logos/shure.svg",
        highlights: [
          "Built and deployed REST APIs in Flask for the Shure Cloud audio analytics pipeline on AWS (DynamoDB, S3, Amazon MSK).",
          "Built test automation frameworks in Python with Selenium, using object oriented design with Factory and Strategy patterns.",
          "Ran backend services and CI/CD pipelines in Python and Jenkins for build, test and release.",
        ],
      },
    ],
    research: [
      {
        title: "Machine Learning Researcher",
        date: "May 2024 to Sep 2025",
        location: "New York University, New York",
        logo: "/logos/nyu.svg",
        highlights: [
          "Built the data pipeline that turned ChangeMyView threads into preference pairs: a reply that earned a delta against one that did not.",
          "Trained a Llama 3 8B reward model with TRL's RewardTrainer and QLoRA on NYU's GPU cluster, tracked in Weights & Biases.",
          "Ran SFT, then GRPO against the reward model, plus an ORPO run, and compared each adapter with the untrained base on BLEU and ROUGE-L.",
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
          "RLHF (GRPO / ORPO)",
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
      date: "Jun 2026 to present",
      description:
        "I built the staff side of our patient platform: one row per patient, every document one click away, and a live read only mirror of the practice management system that the estimator and capacity planner read through.",
      link: "",
      post: "/posts/patient-dashboard",
      details: {
        summary_short:
          "The staff dashboard behind the CDF platform. One row per patient for treatment coordinators, every document one click away, and a read only Denticon mirror that the estimator and capacity planner read through.",
        stats: [
          { value: "453 of 453", label: "Blind test against bookings: every chart the record linker picked was right" },
          { value: "2.6 min", label: "How far the Denticon mirror trailed once the sync ran on a timer, down from 6.0 days" },
          { value: "81 of 103", label: "Intake surveys that linked to their chart on their own by Sep 30" },
          { value: "259 links", label: "Put onto charts by the first backfill with 0 errors, each audited and undoable" },
        ],
        star: {
          problem:
            "Coordinators had four tabs and four ids for one patient. Each system named a patient its own way: the intake survey by response id, the estimator by its own number, the consult grader by Zoom meeting, the experience survey by email. The Denticon id sat in three of them as a hand typed field nothing checked, so it joined nothing.",
          solution:
            "Two Cloud Run services from one image. The dashboard, behind Google sign in limited to the company domain, holds no Denticon credentials; a sync service that serves no pages holds them. Webhooks and three scheduled jobs keep a Firestore mirror of offices, providers, patients and appointments current, and a registry API with one secret per caller serves it to the estimator and the capacity planner. Profiles join every record on the Denticon id at read time.",
          process:
            "The vendor API has no patient search, so the mirror is the only patient index there is. It also ignores unknown query parameters and returns the whole table with a 200, so a parameter is allowed only once it is proven to change totalCount. The record matcher was attacked from three angles before it could write, ran in shadow mode, and refuses when unsure. A person's decision always wins: each link write is a transaction that decides again on fresh documents, and every link is versioned, audited and undoable. A journey step with no linked chart reads as unknown.",
          result:
            "Started in June 2026 and rebuilt around the Denticon API in September; the sync read the live practice on 29 September. Once the sync ran on a timer the mirror went from 6.0 days behind to 2.6 minutes behind, the linker picked the right chart 453 times out of 453 in a blind test against bookings, 81 of 103 intakes had linked to their chart on their own by 30 September, and the capacity planner reads the registry every minute.",
        },
        summary:
          "The staff side of the Centralized Diagnostic Filter platform for treatment coordinators: patients, intake surveys, manual intake, patient experience, estimates and consultations in one place. Behind it sit a read only Denticon mirror kept fresh by webhooks and scheduled sweeps, a record matcher that refuses when unsure, and a registry API that other internal apps read through.",
        highlights: [
          "Two Cloud Run services from one image: the dashboard holds no vendor credentials, and the sync service that holds them serves no pages.",
          "A query parameter is allowed only once it is proven to change totalCount, because Denticon ignores unknown ones and still answers 200.",
          "77 vendor API operations transcribed, and 14 filters proven before any of them is used.",
          "Record matcher attacked from three angles before it could write (4 critical and 11 high findings), then kept in shadow mode.",
          "Registry API with one secret per caller, so revoking one consumer never blinds another.",
          "18 webhook subscriptions across three offices, with an hourly sweep and a nightly poll behind them.",
          "Caught an hourly sweep printing swept=0/0 while every call failed, and secrets that carried a hidden Windows carriage return.",
        ],
      },
      tech: ["Next.js 15", "TypeScript", "Firestore", "Cloud Run", "Cloud Scheduler", "Cloud Storage", "Cloud Build", "GitHub Actions"],
      img_alt: "Patient Dashboard, Hybridge Implants LLC",
      img_path: "/patient-dashboard.png",
    },
    {
      title: "Capacity Planner",
      tier: "industry",
      flagshipRank: 2,
      date: "Sep 2026 to present",
      description:
        "I replaced the operations lead's staffing workbook with a planner that shows demand, capacity and capability across three offices, reads the live schedule every minute, and never writes back.",
      link: "",
      post: "/posts/capacity-planner",
      details: {
        summary_short:
          "One forward view of demand, capacity and capability across three offices. A pure scheduling engine, live Denticon bookings every minute through the patient dashboard, and read only by design, down to the type system.",
        stats: [
          { value: "Every minute", label: "Live schedule sync, with no vendor credential in the planner" },
          { value: "0 write methods", label: "Toward Denticon, held there by a test that fails the build" },
          { value: "360 of 360", label: "Day cells from the old workbook the engine reproduces on every test run" },
          { value: "17 days", label: "From the first commit on Sep 11 to production on Sep 28" },
        ],
        star: {
          problem:
            "Staffing for three offices lived in the operations lead's workbook: twenty pasted copies of the same week. Fixed ranges undercounted silently when a row landed outside them, typing over a formula deleted it, and time off entered later never changed the plan. The real cost was last minute coverage calls, and a doctor slammed at one office while another had a free chair.",
          solution:
            "A pnpm monorepo: a pure TypeScript engine package with no I/O, and a Next.js 16 app on Cloud Run with Cloud SQL Postgres, Drizzle and Google sign in. The same engine runs in the minute sync and in the browser for instant what if changes, golden tested against the workbook. Bookings come from Denticon through the patient dashboard's registry, so the planner holds no vendor credential and only reads.",
          process:
            "Read only is a type level test: the appointment source may have no member named like write, create, update, delete, cancel or book. A mass cancel guard stops any sync that would cancel an office's bookings in bulk and changes nothing, after a silently dropped office code nearly did exactly that. Sync failures return 200 so the scheduler does not retry storm, and staleness shows on a status pill. Cover suggestions rank five keys (capability, willingness, presence, free day, pairing), and every reason shown comes from the rule that produced it.",
          result:
            "v0.1.0 reached production on 28 September 2026, 17 days after the first commit, and the first full read of live Denticon data landed at 5:34 the next morning. The operations lead and the office directors plan from it every day, with a Room Board since 20 October and a 7 AM weekday email of what needs action. It cost $27 to run from October 1 to 28, measured.",
        },
        summary:
          "An internal capacity planner for a three office implant practice: demand, capacity and capability in one forward view, with burnout treated as a design goal (proposed defaults flag three heavy days in a row). Role based access, an audit log, and logs that record only the Postgres error code, constraint and table. Explainable rules only, no generated advice.",
        highlights: [
          "Pure engine package with no I/O: the same math in the minute sync and the browser's instant what if, golden tested against the workbook.",
          "Postgres over Firestore for person by weekday by location joins; NextAuth over IAP alone so roles and the audit log know who signed in.",
          "Its own cloud project, to isolate patient data and stay clear of a sibling app's database connection ceiling.",
          "Minute sync behind a version pointer; failures return 200 and show up as staleness.",
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
      demo: "/demos/enterprise-search",
      tier: "industry",
      date: "Jun to Jul 2026",
      description:
        "I built an internal search over Hybridge documents: ask in plain language and get an answer cited to the exact passage, filtered by who may see what. Paused since October 2026.",
      link: "",
      post: "/posts/enterprise-search",
      details: {
        summary_short:
          "An internal search for Hybridge. It searches by meaning and by exact words inside each asker's permissions, reranks to 8 passages, settles conflicts by rule and cites every answer. Paused since October 2026.",
        stats: [
          { value: "24 days", label: "From the first commit to real models in production" },
          { value: "8 passages", label: "The most Gemini sees per question, from up to 100 candidates" },
          { value: "55 min", label: "For the whole read path on June 27, permission filter to eval test" },
          { value: "Paused", label: "Since October 2026, after a month of build" },
        ],
        star: {
          problem:
            "Company knowledge sat in drives, decks and people's heads. A plain vector search misses exact terms, cannot settle two documents that disagree, and has no idea who may read what.",
          solution:
            "One Postgres on Cloud SQL holds vectors, the keyword index, permissions, versions and chats. Each question is searched by meaning with pgvector and by exact words with full text search, inside the asker's groups. The lists are fused, Vertex AI reranks them to 8 passages, conflict rules pick between documents, and Gemini 2.5 Flash answers with citations. Dropoff, the upload tab, hashes each file, skips duplicates, keeps the original in Cloud Storage and chunks it.",
          process:
            "Built in five stages, each with its own spec, plan and tests. The permission filter is a SQL condition inside both searches, so a restricted passage never becomes a candidate. A seeded retrieval test fails the build if recall at 8 drops below 0.8 or mean reciprocal rank below 0.35.",
          result:
            "It ran on Google Cloud from June 23, with company Google sign in, the Dropoff portal and cited answers streaming into a chat, and real models in production by July 16. Higher priority tools came first after July 23, and its billing has been off since October 8, 2026, so it is paused.",
        },
        summary:
          "An internal search on Google Cloud: staff ask in a chat, and authorized users add documents through Dropoff. Two searches inside the asker's permissions, reranking, conflict rules and cited answers. Paused since October 2026.",
        highlights: [
          "Two searches in one Postgres, pgvector by meaning and full text by exact words, fused and reranked to 8 passages.",
          "Conflict rules: superseded versions drop out, then authority, then effective date, and a near tie is shown as a conflict.",
          "Group access is a SQL condition inside both searches, so a restricted passage never becomes a candidate.",
          "A seeded retrieval test fails the build below recall at 8 of 0.8 or MRR of 0.35.",
          "One Postgres for vectors, keywords, permissions and chats, after my research found no speed reason for a separate vector database.",
        ],
      },
      tech: ["FastAPI", "Cloud Run", "Cloud SQL pgvector", "Vertex AI Gemini", "Vertex AI Ranking", "Identity Platform", "Firebase Hosting", "Terraform"],
      img_alt: "Enterprise Search, Hybridge Implants LLC",
      img_path: "/enterprise-search.png",
    },
    {
      title: "CBCT Scan Validator",
      demo: "/demos/scan-validator",
      tier: "industry",
      date: "Mar to May 2026",
      description:
        "I built an in house checker that flags bad dental CT scans before they reach the design team, in 38 days, against a $98,200 vendor quote.",
      link: "",
      post: "/posts/cbct-scan-validator",
      details: {
        summary_short:
          "Flags bad dental CT scans before they reach the implant design queue. Built in house in 38 days on Cloud Run CPU, and checked by the testing team on real studies.",
        stats: [
          { value: "$62", label: "Google Cloud in October, measured" },
          { value: "2.2 s", label: "Encoder pass on a laptop CPU with OpenVINO" },
          { value: "0.6309", label: "Honest AUROC (leaky 0.80 caught)" },
          { value: "26 of 30", label: "Bad studies flagged in testing" },
        ],
        star: {
          problem:
            "Some CBCT scans arrive unusable: the patient moved, metal threw streaks, or part of the jaw sat outside the field of view. Nobody knew until a designer opened the case and waited on a rescan. A vendor quoted $98,200 to build a checker and $2,200 a month to run it.",
          solution:
            "An in house quality gate. The lab's case system exports each case over SFTP to a small locked down VM, the zip lands in Cloud Storage, Eventarc fires, and the validator on Cloud Run scores it with a frozen DentalSegmentator encoder and a small head, then sends the verdict back over SFTP.",
          process:
            "Six candidate models sat behind one interface by April 7. Model H's first 0.80 AUROC leaked: seven of the ten bad holdout studies had been in its training data, so I rebuilt the split and kept the honest 0.6309 on 44 test studies. The threshold is priced in rescans, with a missed bad scan counting 15 times a false flag.",
          result:
            "Deployed on Cloud Run since April 22 and on v0.6.1 since May 1, 38 days after the first commit. The testing team checks it on real studies in a review app: of the 30 they marked bad, the model flagged 26. It cost $62 on Google Cloud in October, measured.",
        },
        summary:
          "SFTP from the lab's case system, Cloud Storage, Eventarc, a frozen DentalSegmentator encoder with a small head on OpenVINO, a cost tuned threshold, and SFTP back. On Cloud Run CPU, scaling to zero.",
        highlights: [
          "Six candidate models behind one interface by April 7; Model H, a frozen DentalSegmentator encoder with a head of about 500K parameters, is the one that worked.",
          "Threshold priced in rescans: a missed bad scan costs 15 times a false flag.",
          "A strict 20 scan holdout caught a leaky AUROC of 0.80.",
          "OpenVINO ran the 30.79M parameter encoder in 2.20 s per pass on a laptop CPU, against 2.56 s for PyTorch and 3.93 s for ONNX Runtime.",
          "SFTP both ways with the lab's case system after its API license lapsed.",
        ],
      },
      tech: ["PyTorch Lightning", "MONAI", "OpenVINO", "FastAPI", "Cloud Run", "Eventarc", "Cloud Storage", "GitHub Actions"],
      img_alt: "CBCT Scan Validator, Hybridge Implants LLC",
      img_path: "/cbct-validator.png",
    },
    {
      title: "Hybridge Platform",
      tier: "industry",
      date: "Mar 2026 to present",
      description:
        "I mapped the 45 live services I built for a three office practice and its lab, across 14 Google Cloud projects, and the patterns that keep them running.",
      link: "",
      post: "/posts/platform",
      details: {
        summary_short:
          "45 live services on 14 Google Cloud projects, with one service holding the Denticon credentials for every other app.",
        stats: [
          { value: "45 services", label: "Live on Google Cloud across 14 projects, checked Oct 29, 2026" },
          { value: "1 key holder", label: "For Denticon: every other app reads the mirror through the CDF registry" },
          { value: "1 min", label: "The tightest loops: the planner reads the book and the forms worker sweeps" },
          { value: "$132", label: "Google Cloud from Oct 1 to 28 for the six projects the billing export measured" },
        ],
        star: {
          problem:
            "Hybridge runs three offices and its own lab on systems that do not talk to each other: Denticon for charts and bookings, Monday for leads and patient boards, Zoom for consults, a phone system that records calls, the lab's case and scan systems, and a lot of spreadsheets. Every team brought one problem.",
          solution:
            "Solve each problem where the data already lives. Three shared services carry the most weight: the Denticon sync keeps a copy of Denticon, the CDF registry serves it to other apps, and the PDF renderer turns surveys into reports.",
          process:
            "One service holds the Denticon credentials, and every other app reads the mirror. Six apps file feature requests through one relay into one list, and a request filed on October 28 was live 19 minutes later.",
          result:
            "45 live services in 14 Google Cloud projects on October 29, 2026. The six projects the billing export measured cost $132 from October 1 to 28.",
        },
        summary:
          "The map of every service I run for Hybridge: forms and surveys, the patient hub, coaching and grading, planning and quoting, data and reporting, and the board that lists them all.",
        highlights: [
          "45 live services in 14 Google Cloud projects, listed read only with gcloud on Oct 29, 2026.",
          "One Denticon key holder; the estimator and the planner read through the CDF registry.",
          "The tightest loops run every minute: the planner's sync and the forms delivery sweep.",
          "Six apps file feature requests into one list through one relay.",
        ],
      },
      tech: ["Cloud Run", "Firestore", "Cloud SQL", "BigQuery", "Cloud Scheduler", "Cloud Tasks", "Vertex AI Gemini", "Cloud IAP"],
      img_alt: "Hybridge Platform, Hybridge Implants LLC",
      img_path: "/platform.png",
    },
    {
      title: "Treatment Estimator",
      flagshipRank: 5,
      demo: "/demos/treatment-estimator",
      tier: "industry",
      date: "May 2026 to present",
      description:
        "I rebuilt the practice's quoting tool so every saved line keeps the price it was quoted. v1.0.0 shipped 14.5 hours after the first commit, followed by visit sequences and the day's consult schedule as its front page.",
      link: "",
      post: "/posts/treatment-estimator",
      details: {
        summary_short:
          "Quoting tool for three offices where every saved line keeps its captured price, tier, label and price book version. Live since May 2026, now with visit sequences, the day's consult schedule as its landing page, and the Hybridge design.",
        stats: [
          { value: "14.5 hrs", label: "First commit to v1.0.0" },
          { value: "4 fields", label: "Frozen on every saved line: price, tier, label, price book version" },
          { value: "5", label: "Pricing model kinds" },
          { value: "$34", label: "Measured cloud cost, October 1 to 28" },
        ],
        star: {
          problem:
            "Coordinators quoted from one shared price list with no office prices or tiers. The six month price promise was a line on the PDF, and nothing held a saved quote to it.",
          solution:
            "Next.js 16, Postgres and Drizzle. Five pricing model kinds (flat, tiered, tiered by zone, price range, per surface), and every saved line keeps its captured price, tier, label and price book version, so a later price change never reaches a saved quote. Each office has its own versioned price book, and only an admin publishes a change.",
          process:
            "Nine architecture decisions written on May 6, before any code. The pricing engine tests reached full coverage at 2:32 AM on the first night, and v1.0.0 shipped 14.5 hours after the first commit. A list of questions with worked numbers let the practice review pricing without reading code.",
          result:
            "Live since May 8, 2026. Since then: a drag and drop workspace with phases and scenarios, an Excel export that matches the coordinator's own file, a landing page that is the day's consult schedule, visit sequences built from the estimate, the Hybridge design in one day on September 29, and reopening a presented estimate as its next revision on October 28. It cost $34 to run from October 1 to 28, measured.",
        },
        summary:
          "Next.js 16, Postgres and Drizzle for treatment coordinators across three offices. Five pricing models with prices frozen on every saved line, and per office price books only an admin can publish. Since May it has added visit sequences, the day's consult schedule as its landing page, and the Hybridge design.",
        highlights: [
          "Nine architecture decisions with tradeoffs, written before any code.",
          "Every saved line keeps its captured price, tier, label and price book version, so the six month price promise holds.",
          "Full test coverage on the pricing engine, and a never check so a new pricing model cannot go unhandled.",
          "Visit sequences generated from the estimate and edited in a three pane builder, from the shared Treatment Sequence packages.",
          "The landing page is the day's consultation schedule, read from the patient dashboard's registry API.",
          "An estimate's arch now comes from its options, so the up front Upper, Lower or Both question is gone.",
          "Reopening a presented estimate moves its rows into the next revision, because payments point at option and line ids.",
        ],
      },
      tech: ["Next.js 16", "TypeScript", "Drizzle", "PostgreSQL", "Auth.js", "Cloud Run", "@react-pdf/renderer", "Zod"],
      img_alt: "Treatment Estimator, Hybridge Implants LLC",
      img_path: "/treatment-estimator.png",
    },
    {
      title: "Treatment Sequence",
      tier: "industry",
      date: "Aug 2026 to present",
      description:
        "I replaced hand built Word visit plans with shared packages that generate the plan from an estimate, let the coordinator edit it in a three pane builder, and export it to Word and PDF.",
      link: "",
      post: "/posts/treatment-sequence",
      details: {
        summary_short:
          "The ordered plan of visits, with chair time, that delivers an accepted treatment. Generated from an estimate by picking one of eleven transcribed practice masters, and edited by the treatment coordinator inside the estimator.",
        stats: [
          { value: "11", label: "Practice masters transcribed word for word as data, all validated" },
          { value: "0 errors", label: "In 271 generation attempts across 75 live estimates, production audit of Aug 27" },
          { value: "4.5 hours", label: "From the first commit to the builder live in the estimator, Aug 27" },
          { value: "0 tokens", label: "Shipped as a committed build snapshot, so no registry credential can expire" },
        ],
        star: {
          problem:
            "Coordinators wrote each patient's visit plan by hand in Word, copied from master documents in Drive. Every change meant renumbering the visits and redating everything after it by hand, on a case that can run for months.",
          solution:
            "Two packages. sequence-core holds the domain model, the practice masters stored as data, generation from an estimate, date and wait arithmetic, and the Word and text renderers, with no React. sequence-ui is a three pane React editor: visit list, flowchart and a live document preview. The estimator stores a living plan plus immutable version snapshots, and one shared text module keeps the preview, Word and PDF from drifting apart.",
          process:
            "Generation picks a transcribed master that fits the estimate. A procedure with no matching visit prints as a yellow open item, an unsupported combination asks for a manual build, and a free text wait stops date projection instead of guessing. The packages reach the estimator as a committed build snapshot stamped with its source commit, and a check fails if core and ui come from different commits.",
          result:
            "Live inside the estimator since 27 August 2026, with save, versions and PDF in a second release that evening. A production audit on 27 August tried every scenario of 75 live estimates: 263 of 271 attempts matched a validated master, 8 opened empty for a manual build, and 0 errored.",
        },
        summary:
          "Shared TypeScript packages that turn an accepted treatment estimate into an ordered plan of visits, with chair time in 15 minute units, providers, teeth, waits and dates, edited by the treatment coordinator in a three pane builder inside the estimator.",
        highlights: [
          "Every template is a word for word transcription of one practice master, with its source document recorded.",
          "Staging became an explicit mode after a bug sent every full arch case to manual build: no implant teeth had been read as no staging.",
          "The both arches master was transcribed instead of glued from two single arch masters, because glued plans put visit 6 and visit 8 in the wrong order.",
          "A unique index on plan and version number makes the second of two racing saves fail; at most one accepted plan per estimate.",
          "Coordinators download Word or PDF of what is on screen, without saving first.",
          "No registry and no package token in the Dockerfile: a committed snapshot, after pnpm's file protocol quietly kept serving an old build.",
        ],
      },
      tech: ["TypeScript", "React", "Tailwind CSS", "dnd-kit", "docx", "PostgreSQL", "Drizzle", "pnpm"],
      img_alt: "Treatment Sequence, Hybridge Implants LLC",
      img_path: "/treatment-sequence.png",
    },
    {
      title: "Cowork Dashboard",
      demo: "/demos/cowork-dashboard",
      tier: "industry",
      date: "May 2026 to present",
      description:
        "I fixed the join behind our leadership dashboard, which surfaced about $460K nobody attributed, then rebuilt it on Cloud Run with every metric defined once and cash flow read every morning.",
      link: "",
      post: "/posts/cowork-dashboard",
      details: {
        summary_short:
          "Monday.com boards turned into the leadership dashboard. Moved from Apps Script to Cloud Run in September 2026, with one metric registry so cards and drilldowns cannot disagree.",
        stats: [
          { value: "~$460K", label: "Patient value on 25 retreatment cases no lead pointed at" },
          { value: "5.2 s → ~17 ms", label: "Weekly tab over a multi year range" },
          { value: "31% → 5.8%", label: "Ambiguous patient to lead links, after first name checks" },
          { value: "19 min", label: "From the finance lead's request in the Feature requests tab to it live" },
        ],
        star: {
          problem:
            "The first version, in Apps Script, joined patients to leads by name. In a review on June 3, Buffalo's consults and case acceptances read zero; only 49.5% of Rochester patients and 65.3% of Buffalo patients linked to a lead. Every metric also had three implementations (card, drilldown and trend), so two tabs could disagree.",
          solution:
            "A rebuild on Cloud Run behind IAP. Cloud Scheduler checks Drive every five minutes; a private ingest service parses the four exports with ExcelJS, joins and hashes them, and writes an immutable snapshot to Cloud Storage. The browser loads one pinned snapshot of about 0.4 MB and computes everything locally with the same core package the ingest uses, and each card number is a function of its drilldown rows by construction. Every morning at six the same check reads the three patient boards from the Monday API for the Cash Flow tab.",
          process:
            "Business rules were ported verbatim and diffed against the original Apps Script code. When that parity check missed a one day date shift (both sides used the same Excel reader), a golden test pinned 948 dates read off the old production dashboard. A request sequence guard stops stale results from landing.",
          result:
            "Live on Cloud Run since 2 September 2026. The Weekly tab dropped from about 5.2 seconds to about 17 ms, ambiguous links fell from 31% to 5.8%, a Cash Flow tab shipped on 15 September and reads Monday every morning since 8 October, and on 28 October a request from the finance lead was live 19 minutes after it was filed.",
        },
        summary:
          "A leadership dashboard on Monday.com boards, first in Apps Script and rebuilt on Cloud Run in September 2026. Nine tabs, one metric registry, and a snapshot the browser computes from locally.",
        highlights: [
          "Linkage from 49.5% to 98.8% in Rochester and 99.9% in Buffalo by joining on the boards' connect column, then made correct in September: first name checks cut ambiguous links from 31% to 5.8%.",
          "Cash flow reads the three patient boards from the Monday API every morning at 6, with Refresh now, pace against a usual month and Rest of month.",
          "One metric registry: every card is computed from its own drilldown rows, so the two cannot disagree.",
          "Weekly tab from about 5.2 s to about 17 ms.",
          "Surfaced about $460K of patient value on 25 retreatment cases that no lead pointed at.",
          "A Feature requests tab wired to Launchpad: an October 28 request was live 19 minutes after it was filed.",
        ],
      },
      tech: ["TypeScript", "Node.js", "ExcelJS", "Cloud Run", "Cloud Storage", "Cloud Scheduler", "Cloud IAP", "Chart.js"],
      img_alt: "Cowork Dashboard, Hybridge Implants LLC",
      img_path: "/cowork-dashboard.png",
    },
    {
      title: "Loan Radar",
      tier: "academic",
      date: "Jan to May 2025",
      description:
        "A three person class project that scores loan default risk. I built the data pipeline, the MLflow stack and the stress tests, and made training and serving load one saved transform.",
      link: "https://github.com/ds28-ops/loan-default-risk-assessment",
      post: "/posts/loan-radar-mlops",
      details: {
        summary:
          "Loan Radar scores loan default risk from the public LendingClub book on Chameleon Cloud: containerized ETL, MLflow on Postgres and MinIO, XGBoost, a FastAPI scorer and Prometheus monitoring.",
        highlights: [
          "Built ETL containers that fit medians, encoders and a scaler on training rows only and save them as one pickle that validation and the API both load.",
          "Wrote the compose stack for MLflow 2.20 on Postgres and MinIO, plus a Ray head and two workers.",
          "Built stress tests on 22,607 held out loans: top features zeroed or inflated, and noise on every feature.",
          "0.79 ms median to score one loan row with the model in process; ROC AUC 0.71 in 2 fold cross validation over 1.81M loans.",
        ],
      },
      tech: ["Docker Compose", "FastAPI", "Flask", "MLflow", "MinIO", "PostgreSQL", "XGBoost", "Ray", "Prometheus", "Grafana", "Terraform"],
      img_alt: "Loan Radar",
      img_path: "/loan-radar.png",
    },
    {
      title: "Teaching Llama to Argue Better",
      tier: "research",
      date: "Aug 2024 to Jun 2025",
      description:
        "I trained Llama 3 8B to write counterarguments: SFT first, then a reward model trained on ChangeMyView deltas, then GRPO against that judge.",
      link: "",
      post: "/posts/llama-rlhf",
      details: {
        summary:
          "A research project on persuasion: I trained Llama 3 8B to write counterarguments, with SFT, a reward model trained on ChangeMyView deltas, and GRPO.",
        highlights: [
          "SFT, reward model and GRPO with QLoRA (4 bit, LoRA rank 64) in TRL and Unsloth.",
          "Preference pairs from ChangeMyView: a reply that earned a delta against one that did not.",
          "Evaluated with BLEU, ROUGE-L and the reward model, against the untrained base as control.",
        ],
      },
      tech: ["Llama 3", "GRPO", "ORPO", "RLHF", "TRL", "Unsloth", "QLoRA", "LoRA", "PyTorch"],
      img_alt: "LLM persuasion research",
      img_path: "/llm-persuasion.png",
    },
    {
      title: "Doc Coach, Consultation QA Pipeline",
      demo: "/demos/doc-coach",
      tier: "industry",
      flagshipRank: 3,
      date: "May 2026 to present",
      description:
        "I built the tool that grades every implant consult from its Zoom call and sends a colored report to the doctor, the treatment coordinator and the CEO.",
      link: "",
      post: "/posts/clinical-rag",
      details: {
        summary_short:
          "Grades every implant consult from the Zoom transcript against the CEO's seven criterion rubric. A colored report to the doctor, the CEO and the treatment coordinator.",
        stats: [
          { value: "471", label: "Consults scored live since May 19" },
          { value: "2.7 min", label: "Median transcript to report, Oct" },
          { value: "7 + 25", label: "Criteria and sub checks" },
          { value: "392", label: "Older consults regraded on the same rubric" },
        ],
        star: {
          problem:
            "Consult reviews were written by hand against the CEO's seven criterion Word document, and nothing graded every consult.",
          solution:
            "One Cloud Run service in Python. A Zoom webhook starts it when a transcript is ready; it checks the signature, finds the doctor, and asks Vertex AI Gemini 2.5 Pro for a scorecard as JSON against a versioned rubric prompt and schema. Every rationale must quote the transcript with a real timestamp, and each score is colored against that doctor's own 30 day average before the report and PDF go out.",
          process:
            "The doctor is found in three layers: Zoom participants against the doctor directory, then transcript speaker labels, then the names Gemini pulls out while scoring. A response that did not finish cleanly is never accepted, and the token budget doubles on a retry. Instead of Workspace domain wide delegation, the pipeline uses a user OAuth grant.",
          result:
            "471 consults scored live from May 19 to Oct 28 across three offices; median 2.7 minutes from transcript to sent report in October. 392 older consults from November 2025 to May 2026 were regraded on the same rubric, so the trends start in November.",
        },
        summary:
          "Cloud Run pipeline grading every implant consultation across three offices, with weekly and monthly report cards for each doctor.",
        highlights: [
          "471 consults scored live from May 19 to Oct 28 across three offices; median 2.7 minutes from transcript to sent report in October.",
          "Versioned rubric prompt and JSON schema for every Gemini response, with a real timestamp behind every quote.",
          "A truncated response is never accepted; no consult needed a second scoring attempt in October.",
          "Master Sheet ledger joined to Monday.com case outcomes for analytics.",
          "A user OAuth grant instead of Workspace domain wide delegation.",
          "Report cards for every doctor each Monday at 8 AM and on the first weekday of each month.",
        ],
      },
      imageStyle: "object-position: center 20%;",
      tech: ["FastAPI", "Vertex AI Gemini 2.5 Pro", "Cloud Run", "Firestore", "BigQuery", "Google Sheets", "Gmail API", "Drive API"],
      img_alt: "Doc Coach, Hybridge Implants LLC",
      img_path: "/doc-coach.png",
    },
    {
      title: "NPC Coach",
      demo: "/demos/npc-coach",
      tier: "industry",
      flagshipRank: 4,
      date: "Jun 2026 to present",
      description:
        "I rebuilt a brittle n8n call grader into a coaching platform: it finds every new patient call, grades it with a quoted transcript line behind each score, and tracks each coordinator's trend.",
      link: "",
      post: "/posts/npc-coach",
      details: {
        summary_short:
          "Finds the new patient calls among thousands of recordings, grades each against the practice playbook with a transcript quote behind every criterion, and tracks each coordinator's trend. A full rebuild of an n8n prototype.",
        stats: [
          { value: "690", label: "Real calls graded since June 17" },
          { value: "14 min", label: "Median from call end to grade, October" },
          { value: "40 / 40 / 20", label: "Weighted score + 3 hard gates" },
          { value: "16 days", label: "First commit to live calls" },
        ],
        star: {
          problem:
            "An earlier n8n grader proved the idea. Every hour it scored calls as a flat sum out of 60, wrote each result into a Google Doc named after the patient, shared it with the whole company and emailed a link. It kept no database, so no coordinator had a trend, and no quote stood behind a score.",
          solution:
            "A full rebuild on Google Cloud. Every five minutes from 6 AM to 6 PM a Cloud Run Job takes the new recordings from the phone system's SFTP drop, transcribes them with Vertex AI Gemini, keeps the new patient calls, and grades each on six criteria with a transcript quote behind each score, plus three hard gates. Verdicts land in BigQuery, and each coordinator gets the report by email.",
          process:
            "The model returns integers and gate answers; plain Python does the 40/40/20 math, so the same verdict always gives the same score. Hard gates show as a flag beside the score. A run lease stops overlapping runs from grading or emailing a call twice.",
          result:
            "690 real calls graded since June 17, out of 28,745 recordings the poller read; a median 14 minutes from the end of a call to its grade in October. Live calls were graded 16 days after the first commit. Live on Cloud Run behind Google sign in.",
        },
        summary:
          "A New Patient Coordinator coaching platform. It finds the new patient calls among thousands, grades each against the founder's playbook, and gives coordinators and managers per call reports plus team trends. Correctness over conversion.",
        highlights: [
          "Full rebuild of an n8n prototype: weighted 40/40/20 score, 3 hard gates, a patient urgency state.",
          "A verbatim transcript quote behind each of six scoring criteria.",
          "The model returns integers and gate answers; plain Python does the 40/40/20 math, so the same verdict always gives the same score.",
          "BigQuery system of record behind a React dashboard with per coordinator trends, each colored against their own 30 day average.",
          "A 70 minute run lease after overlapping runs sent every report twice.",
          "Booking rate is not graded: the playbook calls a patient who books to get off the phone a failure of advocacy.",
        ],
      },
      imageStyle: "object-position: center 20%;",
      tech: ["Python", "FastAPI", "Vertex AI Gemini", "React", "TypeScript", "BigQuery", "Cloud Storage", "Cloud Run", "pytest"],
      img_alt: "NPC Coach, Hybridge Implants LLC",
      img_path: "/npc-coach.png",
    },
    {
      title: "Reconciliation",
      demo: "/demos/reconciliation",
      tier: "industry",
      date: "Jun 2026 to present",
      description:
        "I replaced 70 hours a week of manual cross checking with an engine that reads three exports and shows the insurance team only the flagged patients.",
      link: "",
      post: "/posts/reconciliation",
      details: {
        summary_short:
          "Confirms every patient seen got documented and billed correctly across two practice management systems, and returns only the patients who disagree. Live on Cloud Run.",
        stats: [
          { value: "70 hrs/week", label: "Manual cross checking returned to a three person team" },
          { value: "8.75 hours", label: "From the first commit, a design spec, to the first live revision" },
          { value: "8 of 8", label: "Wrongly passed patients on one Rochester day, all flagged from v1.10.0" },
          { value: "85", label: "False flags on one Monday that a date check now catches" },
        ],
        star: {
          problem:
            "A three person insurance team spent about 70 hours a week cross checking the schedule, the production ledger, and the clinical notes by hand to confirm every patient seen got documented and billed under the right doctor. It was slow and it failed exactly where mistakes cost the most: care documented but never billed, billed with no note behind it, or billed under the wrong provider.",
          solution:
            "A pure, deterministic reconciliation engine inside a thin FastAPI app. Two source adapters (Eaglesoft CSV, Denticon xlsx) turn hostile exports into the same typed models, the matcher keys everything on patient_id, and a stack of checks (money against the note, the billing provider against the doctor named in the note, the codes a note claims against the ledger, perio charting, office policy rules) separates verified patients from the few that need a human.",
          process:
            "The engine has no network, no database and no clock, and it takes the timestamp as a parameter, so identical inputs give byte identical output and every count traces to a source row. Columns map by name and a missing one stops the run with an error that names it. The app checks the dates inside every file and warns when an export covers the wrong day, after one Monday's notes export defaulted to the previous Friday and showed 85 patients billed with no note. Reviewers sent back every patient the tool got wrong, and each one was traced, fixed, tested and shipped.",
          result:
            "Live on Cloud Run. About 70 hours a week of manual cross checking became an exception review, over 3,600 hours a year.",
        },
        summary:
          "A reconciliation tool for a multi location dental group. A deterministic Python engine confirms each patient seen was documented and billed across Eaglesoft and Denticon; the FastAPI shell adds sign in, a dashboard, history and Gmail delivery.",
        highlights: [
          "Pure deterministic engine split from the app shell: same inputs, byte identical, auditable output.",
          "Two practice management systems normalized into one set of typed models through a source adapter registry.",
          "Matching keyed on patient_id; doctor names in notes match by nickname, initials or one or two typos, and names under five letters must match exactly.",
          "A date check across every file caught a notes export from the wrong day that had shown 85 false flags.",
          "From spec to first live revision in 8.75 hours on June 16; on July 24 a reviewer's rule went live two minutes after its commit.",
          "A Gemini matcher for tooth, surface and wording is built and stays out of the verdict; every flag comes from a rule a reviewer can read.",
        ],
      },
      tech: ["Python", "FastAPI", "Vertex AI Gemini", "Firestore", "Cloud Run", "Google OAuth", "pytest"],
      img_alt: "Reconciliation, Hybridge Implants LLC",
      img_path: "/reconciliation.png",
    },
    {
      title: "Daily Sales Report",
      tier: "industry",
      date: "Sep 2026 to present",
      description:
        "I turned the VP of Finance's morning Excel forecast into an automated pipeline that projects lab revenue and new arch starts three months out, with honest error bands and commentary that cannot invent a number.",
      link: "",
      post: "/posts/daily-sales-report",
      details: {
        summary_short:
          "Projects invoiced lab revenue and new arch starts for this month and the next two, each with a band calibrated to cover about 68% of outcomes. A faithful port of the finance team's model, built by 6:25 every weekday, with LLM commentary fenced in by code.",
        stats: [
          { value: "4.2% → 1.5%", label: "Current month revenue error, early in the month to late" },
          { value: "49 s", label: "Average run from wake to finished report, over 22 sent mornings" },
          { value: "16 of 16", label: "Weekday mornings sent since the October 7 fix, through October 29" },
          { value: "108", label: "Model constants ported exactly from the original" },
        ],
        star: {
          problem:
            "The VP of Finance had built a sound forecast in a 14 tab Excel workbook and handed it over with a spec, but it needed a manual paste, recalculate and send every morning, fed by two daily export emails from the dental lab's case system.",
          solution:
            "A pure Python engine package with no I/O, and a pipeline package with parsers, a dedupe ledger and a BigQuery loader, with Terraform for the infrastructure. A Cloud Run job runs the model each weekday morning, and a Cloud Run web app behind IAP shows the dashboard, history and a Projections tab. An Apps Script bridge runs inside the VP's own Google account and copies the report attachments to a landing bucket, so the project never holds a credential that can read that mailbox. Gemini writes the commentary over finished numbers only.",
          process:
            "Parity first: every acceptance value and edge case from the spec is pinned in the test suite. Every number in the Gemini commentary must appear in the report payload, a list of banned phrases blocks advice the model has no business giving, and if the guard fails the report falls back to a deterministic template. No auto tuning: the best in sample parameter grid scored 2.59% but was 0.62 points worse out of sample. A better lag model sits behind a switch because its 0.28 point gain did not clear the noise floor.",
          result:
            "First scheduled report on 24 September 2026, 16 days after the first commit, built by 6:25 each weekday since, in about 49 seconds a run. Every weekday since the 7 October fix went out, 16 of 16 through 29 October. Current month revenue error falls from 4.2% early in the month to 1.5% late, and the report never depends on the LLM.",
        },
        summary:
          "An automated daily sales report for an implant practice's lab revenue: a pure forecasting engine ported exactly from the finance team's model, a weekday Cloud Run pipeline into BigQuery, a dashboard behind IAP, and Gemini commentary that is checked number by number.",
        highlights: [
          "Bands calibrated to cover about 68% of outcomes, for this month and the next two.",
          "The mail bridge runs in the VP's own account, so the project never holds a mailbox credential.",
          "A number guard on the LLM: any figure not in the payload fails the check and the template takes over.",
          "No auto tuning: an in sample win that lost 0.62 points out of sample stayed out.",
          "A hand typed figure that lived in container memory now persists in BigQuery as rows that supersede instead of overwrite.",
        ],
      },
      tech: ["Python", "BigQuery", "Cloud Run Jobs", "Cloud Run", "Cloud IAP", "Gemini", "Apps Script", "Terraform"],
      img_alt: "Daily Sales Report, Hybridge Implants LLC",
      img_path: "/daily-sales-report.png",
    },
    {
      title: "Marketing Data Warehouse",
      demo: "/demos/marketing-warehouse",
      tier: "industry",
      date: "Aug 2026 to present",
      description:
        "I built a BigQuery warehouse that joins ad spend, calls and leads to booked patients and treatment value every day, documented so both people and LLMs can query it.",
      link: "",
      post: "/posts/marketing-warehouse",
      details: {
        summary_short:
          "Ten marketing sources pulled daily into one BigQuery warehouse and joined from ad spend through calls and leads to booked patients and treatment value. Every column described, a data guide written for LLMs to read first, a 6:30 AM email, and a weekly eval of golden questions.",
        stats: [
          { value: "3,334 of 3,383", label: "Lead to patient matches from the staff's own Monday link" },
          { value: "99.3%", label: "Agreement with Monday's weekly export" },
          { value: "21 of 22", label: "Weekly Gemini eval, 26 October" },
          { value: "3.5 hours", label: "From design spec to the first sync job in the cloud" },
        ],
        star: {
          problem:
            "Our marketing numbers lived in five logins, and nothing joined an ad click to a booked patient.",
          solution:
            "Google Ads lands through the BigQuery Data Transfer Service; Microsoft Ads, Meta, CallRail, Monday, GA4, Search Console, Business Profile and TapClicks come in through Python connectors running as Cloud Run jobs on Cloud Scheduler. Data moves from raw to staging to marts, every column carries a description, and a data guide tells an LLM what to read first.",
          process:
            "A daily ops job checks freshness and drift, alerting on a z score above 3 against a 28 day baseline, and a weekly eval asks Gemini 22 golden questions. The lead to patient join moved from fuzzy phone, click id and email matching to the link staff already keep in Monday, with the match method recorded on every row.",
          result:
            "Live since 4 August 2026. Ten sources land by 6 AM, a 6:30 email with one tab per source goes to the marketing team every morning, and a Claude connector has answered questions from it since 23 October. The weekly eval scored 21 of 22 on 26 October.",
        },
        summary:
          "A marketing data warehouse for a multi office implant practice: daily pulls from ten sources, a described raw, staging and marts layout, freshness and drift checks, a 6:30 AM email, a weekly LLM eval, and a Claude connector.",
        highlights: [
          "Lead to patient join on the link staff already keep in Monday: 3,334 of 3,383 matches, the other 49 by email, with the method on every row.",
          "All 657 staging and marts columns described, and a data guide written for LLMs, so a model reads the map first.",
          "A 6:30 AM email with one tab per source, sent every morning since October 22.",
          "Drift alerts at a z score above 3 against a 28 day baseline.",
          "A CallRail backfill looked like the account had no history; the API silently ignores created_after, and start_date brought calls back to June 2025.",
          "A rule of thumb for any model reading it: a funnel conversion near 96 percent means a bad join.",
        ],
      },
      tech: ["Python", "BigQuery", "BigQuery Data Transfer", "Cloud Run Jobs", "Cloud Scheduler", "Gemini", "Gmail API", "MCP"],
      img_alt: "Marketing Data Warehouse, Hybridge Implants LLC",
      img_path: "/marketing-warehouse.png",
    },
    {
      title: "Marketing Data Connector",
      tier: "industry",
      date: "Oct 2026 to present",
      description:
        "I built a Claude connector for our marketing warehouse: sign in with Google once, and see only the data an owner ticked. It went live three hours after its first line of code.",
      link: "",
      post: "/posts/data-connector",
      details: {
        summary_short:
          "A remote MCP server on Cloud Run that Claude adds as a custom connector. Each person signs in with Google once and queries only the BigQuery views an owner ticked for them.",
        stats: [
          { value: "3 hours", label: "From the first connector code to the live service on Oct 23" },
          { value: "469 calls", label: "From 3 people in the first seven days, Oct 23 to 29" },
          { value: "13 boxes", label: "An owner ticks per person; each set gets its own dataset of views" },
          { value: "39 of 40", label: "Golden questions passed through Claude on main, all 40 answers correct" },
        ],
        star: {
          problem:
            "Asking Claude about our marketing data took the Google Cloud SDK, two command line sign ins, a database tool, a hand edited Claude config and a fresh Google Cloud login most days. Every new person would repeat all of it.",
          solution:
            "A remote MCP server on Cloud Run. An owner page lists the people and 13 boxes, one per data source plus patient names and the family practice and lab, and each set of boxes gets its own BigQuery dataset of views. Claude writes SQL against the warehouse's own table names, and a guard points every table at that person's dataset before anything runs.",
          process:
            "Each question runs as one SELECT against the asker's own views, and Claude ends every answer with where the numbers came from. An accuracy layer that moves metric math to the server is built on main, with an eval that asks Claude 40 golden questions through the connector.",
          result:
            "Live since October 23. From October 23 to 29, three people made 469 tool calls on six days, 364 of them queries.",
        },
        summary:
          "A Claude connector over the marketing warehouse: Google sign in once, a dataset of views per person, and a guard that points every table at the asker's dataset.",
        highlights: [
          "Live three hours after the first connector code, at 3:06 PM on October 23.",
          "13 boxes per person, and each set of boxes gets its own dataset of views.",
          "A guard points every table at the asker's dataset before anything runs.",
          "Claude ends every answer with where the numbers came from.",
          "An accuracy layer on main moves metric math to the server; 39 of 40 golden questions passed through Claude.",
        ],
      },
      tech: ["Python", "MCP", "Cloud Run", "BigQuery", "Google OAuth", "Claude"],
      img_alt: "Marketing Data Connector, Hybridge Implants LLC",
      img_path: "/data-connector.png",
    },
    {
      title: "Centralized Diagnostic Filter",
      demo: "/demos/patient-assessment",
      tier: "industry",
      flagshipRank: 6,
      date: "Jun 2026 to present",
      description:
        "I built the intake and experience surveys where Gemini writes the doctor's page and reads the panorex under the founder's own rules, and the clinic email waits for both reports.",
      link: "",
      post: "/posts/cdf-diagnostic-filter",
      details: {
        summary_short:
          "The practice's own intake and experience surveys, with Gemini writing the doctor's page and a panorex read under the founder's written ruleset. AI assists, doctors validate.",
        stats: [
          { value: "6", label: "Gemini calls, each through one retry and fallback chain" },
          { value: "2 of 2", label: "Reports before a clinic list gets an email" },
          { value: "4 cases", label: "The founder read aloud, turned into the written ruleset" },
          { value: "103", label: "Real intakes by September 30" },
        ],
        star: {
          problem:
            "The pre consult assessment ran on a third party intake platform. The practice did not own its patients' answers, one person could edit a question or add a recipient, and a staff member screenshotted pages of each report into OneNote and filed them in Drive by hand.",
          solution:
            "An intake and experience survey owned by the practice on Google Cloud. Each submit becomes one Cloud Task for the renderer, which draws the patient summary and the doctor report, with Gemini writing the psychographic and reading the panorex. The governing rule is AI assists, doctors validate.",
          process:
            "I recorded the founder reading four panorexes on camera, turned the narration into a written ruleset where each rule cites its case and timestamp, and implemented it as a Gemini read with structured output: the model lists the teeth, and plain code recomputes the score. Every Gemini call goes through one chain of retries and newer fallback models inside a time budget.",
          result:
            "Patients at all three offices fill in the intake before a consult, 103 real intakes by 30 September. The founder's review of the first reads shipped as ruleset v2 on 8 July, and since 23 October the clinic email goes out with both reports or waits.",
        },
        summary:
          "Intake and experience surveys for complex implant cases, built with the practice founder: a patient summary, a doctor report with a 0 to 200 risk score for the doctor to explain, and a panorex read under the founder's own reviewed ruleset.",
        highlights: [
          "Turns a veteran clinician's narrated reads into a written, cited panorex ruleset and a running Gemini read.",
          "The founder's review of the first AI reads shipped as ruleset v2.",
          "The model observes and the code counts: Gemini lists the teeth, and plain code recomputes the score.",
          "Every Gemini call has a way out: three tries on the same model, then newer models, inside a time budget.",
          "The clinic email waits for both reports, after a single 429 once sent the summary alone.",
        ],
      },
      tech: ["TypeScript", "Next.js", "Cloud Run", "Cloud Tasks", "Vertex AI Gemini", "Firestore", "Terraform", "PDF generation"],
      img_alt: "Centralized Diagnostic Filter, Hybridge Implants LLC",
      img_path: "/cdf-diagnostic-filter.png",
    },
    {
      title: "Denticon Sync",
      tier: "industry",
      date: "Sep 2026 to present",
      description:
        "I built the sync that keeps our copy of Denticon fresh for every app: webhooks first, a nightly poll behind them, and the only Denticon credentials in the company.",
      link: "",
      post: "/posts/denticon-sync",
      details: {
        summary_short:
          "Mirrors Denticon into Firestore for four services. Webhooks first, a worker every ten minutes, an hourly sweep and a 4 AM poll, on the one service that holds Denticon credentials.",
        stats: [
          { value: "2.6 min", label: "Behind Denticon once the sync ran on a timer on Sep 21, down from 6.0 days" },
          { value: "20,111 charts", label: "And 22,688 appointments in the first read of the live practice, Sep 29" },
          { value: "1 key holder", label: "Denticon credentials live on this service alone" },
          { value: "6 days", label: "From the first Denticon commit on Sep 15 to the sync service live" },
        ],
        star: {
          problem:
            "Denticon holds every chart and appointment at our three offices, and four services need what is in it. Its API has no patient search, so a copy of our own is the only patient index we have, and only one service should ever hold its credentials. The copy measured 6.0 days behind Denticon on September 21, because nothing ran the sync on a schedule.",
          solution:
            "A sync service: the CDF's own image deployed as a second Cloud Run service, holding the only Denticon credentials. Denticon posts a pointer when records change; the receiver saves it and answers inside Denticon's ten second window. A worker every ten minutes fetches each slice and upserts the rows into Firestore, a sweep at twenty past each hour lists any slice a webhook missed, and a 4 AM poll reads everything.",
          process:
            "Denticon ignores a query parameter it does not know and returns the whole table with a 200, so only filters proven to change totalCount are allowed. A freshness report starts from the cursors it expects, so a missing one shows as the worst status.",
          result:
            "Four services read the mirror and none holds a Denticon credential: the CDF's patient list, the estimator and the capacity planner through the registry, and the report renderer before it emails a patient.",
        },
        summary:
          "The service that holds Denticon credentials and keeps a Firestore mirror of offices, providers, patients and appointments current for every other app.",
        highlights: [
          "Webhooks first, a worker every ten minutes, an hourly sweep and a 4 AM poll behind them.",
          "From 6.0 days behind to 2.6 minutes behind once the sync ran on a timer.",
          "20,111 charts and 22,688 appointments in the first read of the live practice.",
          "A webhook body is a pointer; the worker fetches the record itself.",
        ],
      },
      tech: ["Next.js", "TypeScript", "Cloud Run", "Firestore", "Cloud Scheduler", "Secret Manager"],
      img_alt: "Denticon Sync, Hybridge Implants LLC",
      img_path: "/denticon-sync.png",
    },
    {
      title: "CDF Registry",
      tier: "industry",
      date: "Sep 2026 to present",
      description:
        "I built a small read only API over our Denticon mirror, so the estimator and the capacity planner get the appointment book without holding Denticon keys.",
      link: "",
      post: "/posts/cdf-registry",
      details: {
        summary_short:
          "Five read only routes over the Denticon mirror, with a secret per caller and strict office codes. The estimator reads the day, and the planner reads the book every minute.",
        stats: [
          { value: "1 key holder", label: "Denticon credentials sit on one service; each caller holds only its own bearer" },
          { value: "27 min", label: "From the planner's routes going live on Sep 29 to the planner reading through them" },
          { value: "400", label: "The answer to an office code the routes do not know, so a typo cannot empty a calendar" },
          { value: "Every minute", label: "The capacity planner reads the book and the provider list" },
        ],
        star: {
          problem:
            "On September 21 two apps needed Denticon's appointment book: the treatment estimator for a landing page of who is coming in today, and the capacity planner for the whole book every minute. Only the CDF may hold Denticon credentials.",
          solution:
            "A registry: five read only routes on the CDF dashboard service, over the Firestore mirror that the Denticon sync keeps fresh. The estimator gets one local day of the book, joined to patient and provider names; the planner gets the book by date window or by what changed, plus providers, visit types and chairs.",
          process:
            "Each caller has its own bearer secret, compared in constant time, and the registry never calls Denticon. Answers to the planner carry each office's mirror health, so it can show old data as old.",
          result:
            "Two apps read it: the estimator's landing page, the first screen every coordinator sees, and the capacity planner every minute.",
        },
        summary:
          "A read only API over the Denticon mirror for other Hybridge apps, with one secret per caller.",
        highlights: [
          "One secret per caller, so revoking one never blinds another.",
          "An unknown office code gets a 400, so a typo cannot empty a calendar.",
          "Answers carry each office's mirror health, so old data shows as old.",
        ],
      },
      tech: ["Next.js", "TypeScript", "Cloud Run", "Firestore"],
      img_alt: "CDF Registry, Hybridge Implants LLC",
      img_path: "/cdf-registry.png",
    },
    {
      title: "PDF Renderer",
      tier: "industry",
      date: "Jun 2026 to present",
      description:
        "I built the renderer that turns every patient survey into a summary and a doctor report, emails both, and finishes the job on retry.",
      link: "",
      post: "/posts/pdf-renderer",
      details: {
        summary_short:
          "A Fastify service on Cloud Run that renders each PDF in a fresh headless Chromium, stores it and delivers it. Three callers share it, and it records each step as it lands.",
        stats: [
          { value: "7 min", label: "From the first renderer commit on Jun 19 to the service on Cloud Run" },
          { value: "60 to 90 s", label: "For one survey's whole delivery, run inside the request with the CPU kept on" },
          { value: "3 callers", label: "The delivery queue, the CDF dashboard and an hourly sweep" },
          { value: "2 of 2", label: "Reports before a clinic list gets an email" },
        ],
        star: {
          problem:
            "Every intake survey needs a one page summary for the patient and a doctor report for the office. In August my own comment in the code described what kept happening: the patient got their summary, the clinic got nothing, and no error surfaced anywhere.",
          solution:
            "A Fastify service on Cloud Run that renders each PDF in a fresh headless Chromium, stores it and delivers it. A survey submit becomes one named Cloud Task, staff on the CDF dashboard can regenerate a report, and an hourly sweep picks up anything unfinished.",
          process:
            "Each step is recorded as it lands, and every retry reads that record first. The clinic email waits until both reports exist.",
          result:
            "Every intake and experience survey from the three offices goes through it, and so does the CDF dashboard's Regenerate button.",
        },
        summary:
          "The shared report renderer behind the CDF surveys: one service, three callers, and a delivery record that every retry reads first.",
        highlights: [
          "A fresh headless Chromium for every PDF.",
          "Three callers, each with a Google identity token: the queue, the dashboard and an hourly sweep.",
          "Each step is recorded as it lands, and every retry reads that record first.",
        ],
      },
      tech: ["TypeScript", "Fastify", "Headless Chromium", "Cloud Run", "Cloud Tasks", "Cloud Scheduler", "Firestore", "Vertex AI Gemini"],
      img_alt: "PDF Renderer, Hybridge Implants LLC",
      img_path: "/pdf-renderer.png",
    },
    {
      title: "Fake News and Sentiment Analysis",
      tier: "academic",
      date: "Feb to May 2024",
      description:
        "Three of us labeled 2020 election tweets with a 4 bit Llama 3 8B fine tuned on LIAR (76% on its test claims) and read their mood with RoBERTa. I built the sentiment pass, the maps and the report.",
      link: "https://github.com/SampreethAvvari/us2020electionanalysis",
      post: "/posts/fake-news-sentiment",
      details: {
        summary_short:
          "A 4 bit Llama 3 8B labels election tweets true, false or opinion, and RoBERTa reads their mood across about 1.7M tweets.",
        stats: [
          { value: "76%", label: "Llama 3 8B accuracy on LIAR test claims" },
          { value: "1.7M", label: "election tweets in the dataset" },
          { value: "315,020", label: "tweets under both hashtags, removed from both" },
          { value: "1 GPU", label: "whole fine tune in 4 bit on a V100" },
        ],
        star: {
          problem:
            "\"Detect fake news\" hides two jobs: is a claim true, and how does a crowd feel. They need different models and different data.",
          solution:
            "Llama 3 8B fine tuned with QLoRA on LIAR for True, False or Personal labels, zero shot Twitter RoBERTa for mood, LDA for topics, and Power BI state maps.",
          process:
            "Collapsed LIAR's six labels to two, removed tweets that appeared under both hashtags, and capped each answer at one token.",
          result:
            "76% on LIAR test claims, more than 156,000 tweets labeled per hashtag, state and swing state maps, and a nine theme topic table.",
        },
        summary:
          "Two model NLP study of the 2020 U.S. election: a 4 bit Llama 3 8B with a QLoRA adapter for misinformation, Twitter RoBERTa for mood, LDA for topics.",
        highlights: [
          "76% on LIAR test claims with a 4 bit Llama 3 8B and an 84M parameter LoRA adapter on one V100.",
          "Removed 315,020 tweets that appeared under both hashtags so neither candidate counted them.",
          "Built the sentiment pass, the state and swing state maps in Power BI, and the report.",
        ],
      },
      tech: ["Llama 3", "QLoRA", "Unsloth", "RoBERTa", "LDA", "Power BI", "Python"],
      img_alt: "Fake News and Sentiment Analysis",
      img_path: "/fake-news.png",
    },
    {
      title: "ResNet Under 5M Parameters",
      tier: "academic",
      date: "Apr 2024",
      description:
        "A class contest on CIFAR-10 under a 5M parameter, ResNet only cap. Augmentation took our model from 93.76% to 97.12% without adding a parameter.",
      link: "https://docs.google.com/spreadsheets/d/1ZGsL-hlqXFQmKHCA-6-J81xIbBcJNZBSGYnldBHzYlA/edit?usp=sharing",
      post: "/posts/resnet-under-5m",
      details: {
        summary_short:
          "A 5M parameter cap took the bigger model off the table, so we fed the model more varied data. 97.12% on the test set with 21,190 parameters to spare.",
        stats: [
          { value: "97.12%", label: "on the 10,000 CIFAR-10 test images" },
          { value: "4,978,810", label: "parameters, under the 5M cap" },
          { value: "0 params", label: "added by augmentation" },
        ],
        star: {
          problem:
            "A class contest: the best CIFAR-10 classifier, with hard rules. Stay a ResNet, and stay under 5 million parameters.",
          solution:
            "With a bigger model off the table, we added data instead. AutoAugment, random crops, flips and perspective changes gave the model far more variety without adding a single parameter.",
          process:
            "Flip and crop alone topped out at 93.76%. Adding AutoAugment reached 95.34%, and adding perspective reached 97.12%. A cosine learning rate schedule beat a step schedule, 97.12% against 92%.",
          result:
            "97.12% on the 10,000 CIFAR-10 test images after 300 epochs, with 4,978,810 parameters, 21,190 under the cap.",
        },
        summary:
          "A CIFAR-10 class contest under a 5M parameter, ResNet only cap, won on data instead of model size.",
        highlights: [
          "Augmentation took our best run from 93.76% to 97.12% at zero parameter cost.",
          "4,978,810 trainable parameters, 21,190 under the 5 million cap.",
          "A cosine schedule over 300 epochs beat a step schedule, 97.12% against 92%.",
        ],
      },
      tech: ["ResNet", "PyTorch", "Data Augmentation", "CIFAR-10"],
      img_alt: "ResNet CIFAR-10 class competition",
      img_path: "/resnet-compact.png",
    },
    {
      title: "Customer Segmentation and Recommendation System",
      tier: "academic",
      date: "Feb to May 2024",
      description:
        "A three person capstone on 33.8M MovieLens ratings: Spark ALS for recommendations, and my MinHash notebook that found movie twins among 330,975 users after Spark kept losing nodes.",
      link: "https://github.com/SampreethAvvari/BigData",
      post: "/posts/recsys-spark-bigdata",
      details: {
        summary_short:
          "Movie twins among 330,975 users in 37 seconds of LSH, beside a Spark ALS recommender.",
        stats: [
          { value: "33.8M", label: "MovieLens ratings" },
          { value: "37 s", label: "LSH index and query for 330,975 users" },
          { value: "0.73", label: "rating correlation of the top 100 twins, 0.03 for random pairs" },
          { value: "22.2M", label: "candidate pairs from LSH" },
        ],
        star: {
          problem:
            "Find the 100 most similar users among 330,975, judged by which movies they rated. Comparing every pair means about 55 billion comparisons.",
          solution:
            "MinHash with 30 permutations and an LSH index with 6 bands in datasketch, after Spark's MinHashLSH join kept losing nodes on Dataproc.",
          process:
            "Tried 15 to 500 permutations and 2 to 8 bands, kept the setting with the best top 100 correlation, and checked it against random pairs.",
          result:
            "0.7348 average rating correlation for the top 100 twins against 0.0323 for random pairs, in 37 seconds of indexing and querying.",
        },
        summary:
          "NYU Big Data capstone: movie twins with MinHash and LSH, and a Spark ALS recommender scored against a popularity baseline.",
        highlights: [
          "Moved the twins search from Spark to one Python process after Spark's similarity join kept losing nodes.",
          "Validated the twins against random pairs: 0.7348 against 0.0323.",
          "Team Spark pipeline: per user time split to Parquet on HDFS, damped popularity baseline, ALS at rank 200.",
        ],
      },
      tech: ["Spark", "HDFS", "ALS", "MinHash LSH", "datasketch", "pandas", "Python"],
      img_alt: "Customer Segmentation and Recommendation System",
      img_path: "/customer-segmentation.png",
    },
    {
      title: "Enterprise Data Project",
      tier: "industry",
      date: "Aug 2025 to present",
      description:
        "I moved team automations onto one self hosted n8n platform on AWS.",
      link: "",
      details: {
        summary_short:
          "Self hosted AI workflow infrastructure on AWS, with team automations in one place.",
        stats: [
          { value: "Self hosted", label: "n8n on AWS via Docker" },
          { value: "One platform", label: "For team automations and scheduled analytics" },
        ],
        star: {
          problem:
            "Per seat SaaS automations were adding up, and executive analytics depended on manual weekly exports.",
          solution:
            "Self hosted n8n on AWS via Docker: one platform for every team automation, with standard data flows across teams.",
          process:
            "Moved existing automations into n8n, and built executive analytics pipelines that publish on a schedule.",
          result:
            "Team automations and executive analytics run on one shared, self hosted platform.",
        },
        summary:
          "Self hosted AI workflow infrastructure on AWS to centralize automation and analytics across teams.",
        highlights: [
          "Self hosted n8n on AWS via Docker.",
          "Executive analytics pipelines that publish on a schedule.",
          "Standard data flows for automations across teams.",
        ],
      },
      tech: ["AWS", "Docker", "n8n", "Data Pipelines", "Automation"],
      img_alt: "Enterprise Data Project, Hybridge Implants LLC",
      img_path: "/enterprise-data.png",
    },
    {
      title: "Case Intake",
      tier: "industry",
      date: "Sep 2026",
      description:
        "I built a morning list of lab cases that duplicate an earlier scan case, so customer service could merge them. It ran as a demo on sample data, and the Doctor Portal took its place.",
      link: "",
      details: {
        summary_short:
          "Listed the prescription cases in the lab's case system that duplicate an earlier scan case. A demo on sample data, parked on 30 Sep 2026 when the lab chose a doctor portal instead.",
        stats: [
          { value: "Parked", label: "Turned down by the lab on 30 Sep 2026; its code feeds the Doctor Portal" },
          { value: "1 letter", label: "The most a name can be mistyped and still match" },
        ],
        star: {
          problem:
            "Doctors write the prescription in the lab vendor's customer portal, which cannot edit an existing case, so every prescription arrives as a second case that duplicates the scan case already in the system, and customer service has to catch each pair to merge it.",
          solution:
            "A Next.js app in the Hybridge design on Cloud Run behind IAP that lists the likely duplicates. The data sits behind a case source and store interface: sample data, with the vendor's API and Firestore planned.",
          process:
            "The name matcher forgives case, spacing, a middle initial, swapped first and last names, and a single mistyped letter. Anything more is a different person.",
          result:
            "Demo deployed on 30 September 2026 on sample data. The lab turned the approach down that day, and the Doctor Portal took its place, live on sample data since 28 October 2026.",
        },
        summary:
          "A duplicate case finder for the dental lab: prescription cases matched to earlier scan cases, behind IAP, with the data source behind an interface so moving from sample data to the vendor API swaps one implementation.",
        highlights: [
          "Forgiving but bounded name matching: case, spacing, middle initial, swapped names, one typo.",
          "Case source and store interfaces: sample data now, the vendor API and Firestore later.",
          "Built in the Hybridge design system.",
        ],
      },
      tech: ["Next.js", "TypeScript", "Cloud Run", "Cloud IAP"],
      img_alt: "Case Intake, Hybridge Implants LLC",
      img_path: "/case-intake.png",
    },
    {
      title: "Doctor Portal",
      tier: "industry",
      date: "Sep 2026 to present",
      description:
        "I built the lab's doctor portal, where the Rx joins the case the scanner already made, so a doctor never sees a duplicate case. Live on sample data.",
      link: "",
      post: "/posts/doctor-portal",
      details: {
        summary_short:
          "A doctor portal built from the lab lead's own mockup: Submit Rx, Cases, Accounting, Resources and Account. The Rx joins the scan's case. Live on sample data since Oct 28, 2026.",
        stats: [
          { value: "3.7 hours", label: "From the sync that made it top priority to a working live link, Oct 28" },
          { value: "9 min", label: "From the revision that failed its first visit to the one that fixed it" },
          { value: "4 things", label: "Still pretend, listed on every release note" },
          { value: "1,664", label: "Uploads doctors made in the old portal since March 27, about ten a business day" },
        ],
        star: {
          problem:
            "More than 200 outside doctors send our lab work. A doctor scans the patient and the scanner opens a case in MagicTouch, the lab's case system. The doctor then writes the Rx in MagicTouch's own portal, which cannot edit a case that already exists, so the Rx opens a second case. In the lab lead's words, the doctors \"see us cancel one and then they get freaked out.\"",
          solution:
            "A doctor portal built from the lab lead's own July mockup. The doctor sends the scan from the scanner, then adds the Rx to that same case here. A switch in the bar flips between the doctor's view and the lab's, which stands in for MagicTouch until a real link exists.",
          process:
            "It went from the sync that made it top priority to a working live link in 3.7 hours. Every release note ends with what is still pretend: sample data, files by name, payments and emails off, no doctor sign in.",
          result:
            "A live link on sample data since 28 October 2026, for the lab lead to review. Only Hybridge Google accounts can sign in. Real data waits on a vendor license and the lab server's details, and file uploads to Cloud Storage are next.",
        },
        summary:
          "The lab's own doctor portal on Cloud Run behind IAP, on sample data in Firestore, with real lab data planned through a connector and the vendor API.",
        highlights: [
          "Built from the lab lead's own July mockup.",
          "Top priority to a working live link in 3.7 hours.",
          "Every release note lists what is still pretend.",
          "A doctor and lab switch stands in for MagicTouch until a real link exists.",
        ],
      },
      tech: ["Next.js", "TypeScript", "Firestore", "Cloud Run", "Cloud IAP"],
      img_alt: "Doctor Portal, Hybridge Implants LLC",
      img_path: "/doctor-portal.png",
    },
    {
      title: "Hybridge Forms",
      flagshipRank: 7,
      tier: "industry",
      date: "Sep 2026 to present",
      description:
        "I built our own forms service to replace the Tally, Zapier and Monday chain on our practice websites, around one rule: no submission is ever lost.",
      link: "",
      post: "/posts/hybridge-forms",
      details: {
        summary_short:
          "A public forms app with an embed script, a private delivery worker to Monday and email, a dashboard and form builder behind IAP, and nightly checks. Live since Oct 6, 2026.",
        stats: [
          { value: "32 of 32", label: "Live Tally forms the importer handles, found across 539 pages" },
          { value: "0", label: "Answers, names, emails or phones in any log line" },
          { value: "67 leads", label: "Got all six tracking fields on Oct 26, the day the gap was seen" },
          { value: "$9", label: "Measured Google Cloud cost in October, a partial month" },
        ],
        star: {
          problem:
            "Every patient inquiry on our websites went through Tally, then Zapier, before it reached Monday.",
          solution:
            "One owned platform: a public forms app with an embed script, a delivery worker that puts each inquiry on the Monday Leads board and emails the copies, a dashboard and form builder behind IAP, and nightly checks.",
          process:
            "Built around one rule: no submission is ever lost. If Firestore fails, the answers go to a private Cloud Storage bucket and the visitor still sees success. If both fail, the server answers 503 and the browser retries over about 15 seconds with the same id, then keeps the answers on the device. A queue task wakes the worker on every send, and a sweep runs every minute. An importer brings over all 32 live Tally forms.",
          result:
            "Live since 6 October 2026. Elmwood's contact form moved off Tally on 14 October, and on 26 October all six tracking fields reached the Monday board, backfilled on 67 leads.",
        },
        summary:
          "An owned forms platform for a multi office practice's websites, designed so a submission survives a database outage, a storage outage and a flaky connection.",
        highlights: [
          "Firestore first, a private Cloud Storage bucket as the fallback, and the visitor still gets a success.",
          "The browser retries over about 15 seconds with the same id, then keeps the answers locally.",
          "The logger drops patient fields by name and by shape, so no answer reaches a log line.",
          "The Tally importer works on all 32 live forms.",
          "A delivery worker wakes on every send, and a sweep runs every minute.",
        ],
      },
      tech: ["TypeScript", "Firestore", "Cloud Storage", "Cloud Run", "Cloud Tasks", "Cloud IAP", "Vitest"],
      img_alt: "Hybridge Forms, Hybridge Implants LLC",
      img_path: "/hybridge-forms.png",
    },
    {
      title: "Launchpad",
      tier: "industry",
      date: "Oct 2026 to present",
      description:
        "I built one board where staff open every Hybridge app, leaders see what is being built, and six apps send feature requests into one list.",
      link: "",
      post: "/posts/launchpad",
      details: {
        summary_short:
          "Every Hybridge app on one board behind IAP, Work and History for four leaders, one editor, and one feature request list that six apps share.",
        stats: [
          { value: "78 min", label: "From the first commit to a working live board, Oct 22" },
          { value: "38 projects", label: "On one board in panes by status, 22 of them live" },
          { value: "19 min", label: "From the VP of finance's request in the Cowork tab to the live fix, Oct 28" },
          { value: "$0.32", label: "The whole Google Cloud project, October 1 to 28, measured" },
        ],
        star: {
          problem:
            "By October the list of Hybridge projects had reached 38. Staff needed one place to open any of them, four leaders wanted to see what is being built, and change requests arrived in chats and in passing, with no screenshot, no id and no record of what happened to them.",
          solution:
            "One page behind Google sign in. The Apps tab shows every project as a card in panes by status, the four leaders also get Work and History, and a Feature requests tab takes a pasted screenshot and a line. The same request screen lives inside six other apps, which all send to one relay.",
          process:
            "One editor changes the cards, and each save writes the project and a history entry with who, when and every field's old and new value. The relay is Launchpad's own image deployed a second time, so the board and the relay always run the same code.",
          result:
            "38 projects and 21 logged edits by October 29. The request counter reached FR-0006: four requests about three apps, two of them shipped.",
        },
        summary:
          "The board where staff open every Hybridge app and leaders follow the work, with one feature request list for every app.",
        highlights: [
          "Live 78 minutes after the first commit.",
          "One editor; every save logs who, when and each field's old and new value.",
          "Six apps file feature requests through one relay into one list.",
          "One image deployed twice, so the board and the relay always run the same code.",
        ],
      },
      tech: ["Next.js 15", "React 19", "TypeScript", "Firestore", "Cloud Run", "Cloud IAP", "Google Chat"],
      img_alt: "Launchpad, Hybridge Implants LLC",
      img_path: "/launchpad.png",
    },
    {
      title: "Feature Requests Relay",
      tier: "industry",
      date: "Oct 2026 to present",
      description:
        "I built one request screen that six apps share, and a relay that trusts each app only to say who is asking.",
      link: "",
      post: "/posts/feature-requests",
      details: {
        summary_short:
          "Six apps file feature requests through one relay into Launchpad's list. Each app checks its own people, and the relay checks only the app.",
        stats: [
          { value: "6 apps", label: "Call one relay, each with its own Google ID token" },
          { value: "8 min", label: "From the relay going live on Oct 23 to the first request" },
          { value: "19 min", label: "From a request filed in the Cowork Dashboard to the live fix, Oct 28" },
          { value: "0 admins", label: "Through an app: only Launchpad sets a status" },
        ],
        star: {
          problem:
            "Change requests for our apps arrived in chats and in passing. Launchpad sits behind IAP, and six apps on their own Google Cloud projects needed to file requests from their servers.",
          solution:
            "A relay: Launchpad's own image deployed a second time as its own Cloud Run service, with relay mode on and no IAP. Each app serves the same request screen and forwards every call from its own server with a Google ID token for its own account and the person its own sign in already checked.",
          process:
            "In relay mode the service answers only the request API and a health check, and Cloud Run lets in only the six app service accounts. Each app may file only about itself, and only Launchpad sets a status.",
          result:
            "Six apps file through it: the treatment estimator, the capacity planner, the CDF Patient Dashboard, Hybridge Forms, the Cowork Dashboard and the Doctor Portal. Requests land in Launchpad's Firestore and ping one Google Chat space.",
        },
        summary:
          "One request screen and one relay for every Hybridge app, landing in Launchpad.",
        highlights: [
          "Each app checks its own people; the relay checks only the app.",
          "Every request gets an FR number that never changes.",
          "An October 28 request from the Cowork Dashboard was live 19 minutes after it was filed.",
        ],
      },
      tech: ["Next.js 15", "TypeScript", "Firestore", "Cloud Run", "Google Chat"],
      img_alt: "Feature Requests Relay, Hybridge Implants LLC",
      img_path: "/feature-requests.png",
    },
    {
      title: "Hybridge Websites",
      tier: "industry",
      date: "Oct 2026 to present",
      description:
        "I rebuilt the patient site and the lab site in the premium lab look, checked at 1440 and 390, and both are previewing on Cloud Run.",
      link: "",
      post: "/posts/hybridge-websites",
      details: {
        summary_short:
          "Two Astro sites on the Hybridge design system, each its own Cloud Run service, every page prerendered. Previews for the team to review.",
        stats: [
          { value: "20 min", label: "From the first commit on the patient site to its first preview on Cloud Run" },
          { value: "7.0 screens", label: "Patient home page length at 1440 after the marketing review, down from 13.7" },
          { value: "73 pages", label: "Crawled from the live lab site with 118 images, the source of its facts" },
          { value: "12 stories", label: "From real patients, self hosted at 720p, playing in place" },
        ],
        star: {
          problem:
            "Hybridge has two public websites: the patient site, where someone weighing full arch implants first meets the practice, and the lab site for the dentists who send our lab their cases. The ask on October 28 was to recreate the patient site with better modern taste, more colour and better UX, then the lab site.",
          solution:
            "Two Astro sites on the Hybridge design system, each its own Cloud Run service. Every page is prerendered at build time. The patient site has a 3D full arch to turn and twelve patient stories that play in place; the lab site opens on an exploded full arch that assembles as you scroll.",
          process:
            "Pages were built by parallel page agents and read at 1440 and 390, and a marketing review cut the patient home page from 13.7 screens to 7.0.",
          result:
            "In build: both sites are previews on Cloud Run for the team to review, not yet on their public domains. The forms show what they would send, and the lab site already redirects 21 old addresses.",
        },
        summary:
          "The patient and lab websites rebuilt in the premium lab look on Cloud Run, previewing for the team.",
        highlights: [
          "The patient site went from first commit to a Cloud Run preview in 20 minutes.",
          "A marketing review cut the patient home page from 13.7 screens to 7.0 at 1440.",
          "The lab site's facts come from 73 pages and 118 images crawled from the live site.",
        ],
      },
      tech: ["Astro", "TypeScript", "Cloud Run", "Cloud Build"],
      img_alt: "Hybridge Websites, Hybridge Implants LLC",
      img_path: "/hybridge-websites.png",
    },
    {
      title: "JobPilot",
      demo: "/demos/jobpilot",
      tier: "personal",
      date: "Jun to Aug 2026",
      description:
        "My open source job hunt autopilot. It watched 163 company boards, scored each role against my profile, and tailored a resume and cover letter per match, with a calibrated judge keeping the rewrites honest.",
      link: "https://github.com/SampreethAvvari/job-pilot",
      post: "/posts/jobpilot-v2",
      details: {
        summary:
          "An open source job hunt platform: direct board watching across eleven sources, Gemini scoring locked to a schema, a calibrated resume judge with a rewrite loop that keeps to the truth, outreach drafted into Gmail for me to send, and a Next.js console behind IAP. It ran 1,008 times from June 10 to October 8, and a public demo runs on fictional data.",
        highlights: [
          "163 company boards watched directly, polled in parallel by June 12.",
          "16 patterns of citizenship, clearance and no sponsorship text drop a job before any model sees it.",
          "My first resume checker scored a file 100 where ResumeWorded gave 73, so I rebuilt the judge.",
          "Recruiter and company outreach drafted into Gmail for me to send, and replies flagged when they land.",
          "Open sourced under MIT with a fork guide written to hand to an AI coding agent.",
        ],
      },
      tech: ["Python", "Next.js", "Vertex AI Gemini", "LaTeX", "Google Sheets", "Cloud Run", "Cloud IAP", "GitHub Actions"],
      img_alt: "JobPilot open source job hunt autopilot",
      img_path: "/jobpilot-flagship.png",
    },
  ],

  contact: {
    email: "spa9659@nyu.edu",
    // Switchy short links so outbound clicks are tracked. The canonical profile
    // URLs stay in the JSON-LD sameAs (BaseLayout) for name-SEO, not here.
    linkedin: "https://www.linkedin.com/in/sampreethavvari/",
    github: "https://github.com/SampreethAvvari",
    instagram: "https://www.instagram.com/sampreeth.sharma/",
  },
};
