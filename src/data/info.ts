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
        location: "New York University, New York",
        logo: "/logos/nyu.svg",
      },
      {
        title: "Bachelor of Technology, Computer Science and Engineering",
        date: "Jul 2017 - Jun 2021",
        location: "Gokaraju Rangaraju Institute of Engineering and Technology, India",
        logo: "/logos/griet.png",
        logoClass: "h-14",
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
        title: "AI Specialist Engineer",
        date: "Aug 2025 - Present",
        location: "Hybridge Implants, New York",
        logo: "/logos/hybridge.webp",
        logoClass: "h-12",
        highlights: [
          "Sole AI specialist at Hybridge Implants, leading AI adoption in dental care.",
          "Partner with the C‑suite to modernize consultations for new doctors.",
          "Build automation workflows that make teams faster and more consistent.",
          "Own AI infrastructure so the company stays AI‑ready and ahead in dentistry.",
        ],
      },
      {
        title: "Lead Machine Learning Researcher and Author",
        date: "May 2024 - Sep 2025",
        location: "New York University, New York",
        logo: "/logos/nyu.svg",
        highlights: [
          "Fine‑tuned Llama 3.1 8B with Unsloth + QLoRA using SFT and GRPO RLHF via TRL.",
          "Trained reward models with LoRA on premise/chosen/rejected debate pairs.",
          "Built data pipelines and evaluation scripts (BLEU, ROUGE, Qualtrics).",
          "Tracked experiments and results in Weights and Biases.",
        ],
      },
      {
        title: "Software Engineer",
        date: "Aug 2021 - Aug 2023",
        location: "Shure Incorporated, India",
        logo: "/logos/shure.svg",
        highlights: [
          "Built Flask APIs for Shure Cloud audio analytics on AWS (DynamoDB, S3, MSK).",
          "Optimized data flow to cut processing time by 20%.",
          "Built CI/CD pipelines and Selenium testing to reduce deployment errors by 40%.",
        ],
      },
    ],
    skills: [
      {
        label: "Languages",
        items: ["Python", "Go", "Java", "C++", "JavaScript", "TypeScript"],
      },
      {
        label: "Frameworks and Platforms",
        items: [
          "React",
          "Next.js",
          "Node.js",
          "Express.js",
          "Angular",
          "Spring Boot",
          "Flask API",
          "FastAPI",
          "GraphQL",
          "Microservices",
          "MCP",
        ],
      },
      {
        label: "Databases",
        items: ["MySQL", "PostgreSQL", "Milvus", "DynamoDB", "MongoDB", "Redis", "InfluxDB"],
      },
      {
        label: "Tools",
        items: [
          "AWS",
          "Kafka",
          "Docker",
          "Kubernetes",
          "N8N",
          "Jenkins",
          "Selenium",
          "Playwright",
          "Test Runner",
          "Pytest",
          "Prometheus",
          "Grafana",
          "Git",
          "SVN",
        ],
      },
      {
        label: "ML and Data",
        items: [
          "PyTorch",
          "TensorFlow",
          "Transformers",
          "TRL",
          "Hugging Face",
          "Unsloth",
          "Accelerate",
          "Pandas",
          "NumPy",
          "Scikit-learn",
          "Matplotlib",
          "NLTK",
          "Weights and Biases",
        ],
      },
      {
        label: "Specialization",
        items: [
          "Agentic AI",
          "Model Training",
          "RLHF",
          "LLM Finetuning",
          "MLOps",
        ],
      },
    ],
  },

  projects: [
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
      title: "Doc Coach - Hybridge Implants LLC",
      date: "Aug 2025 - Present",
      description:
        "Built a multi-modal RAG platform for clinical consultations to boost treatment acceptance and reduce hallucinations.",
      link: "",
      details: {
        summary:
          "A clinical decision-support system that combines audio transcripts, clinical notes, and metadata with hybrid retrieval and agentic orchestration.",
        highlights: [
          "130% increase in treatment acceptance and 43% revenue growth.",
          "Hybrid keyword + vector search using Supabase (pgvector) with GraphQL queries.",
          "Stateful agent chains cut hallucinations by 35% while staying HIPAA-compliant.",
        ],
      },
      imageStyle: "object-position: center 20%;",
      tech: ["LangChain", "Gemini 3 Pro", "Supabase pgvector", "GraphQL", "Python"],
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
      title: "Loan Radar",
      date: "Jan - May 2025",
      description:
        "Built a distributed MLOps pipeline with Ray Tune and FastAPI to cut inference latency below 200ms and serve 5k+ predictions reliably for financial risk scoring.",
      link: "https://hi.switchy.io/cv-i",
      details: {
        summary:
          "Loan-Radar is a cloud-native ML system that predicts loan default risk from LendingClub data, combining distributed training with production-grade serving and monitoring.",
        highlights: [
          "Processed 1.9M loan rows (~2GB) and trained tabular models with Ray Tune hyper-parameter search tracked in MLflow.",
          "Containerized stack deployed on Chameleon Cloud with FastAPI inference plus Prometheus/Grafana monitoring.",
          "Achieved sub‑millisecond median latency with a real-time risk label API and feature-level explanations.",
        ],
      },
      tech: ["Ray Tune", "FastAPI", "MLOps", "Python"],
      img_alt: "Loan Radar",
      img_path: "/loan-radar.svg",
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
    linkedin: "https://hi.switchy.io/q378",
    github: "https://hi.switchy.io/q37N",
    instagram: "https://hi.switchy.io/q37U",
  },
};
