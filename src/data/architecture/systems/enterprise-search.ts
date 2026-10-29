import type { Architecture } from "../types";
import svg from "../svg/enterprise-search.svg?raw";

const arch: Architecture = {
  slug: "enterprise-search",
  rank: 12,
  status: "preview",
  statusNote: "Paused since October 2026",
  name: "Enterprise Search",
  project: "Enterprise Search",
  kind: "system",
  disciplines: ["aie"],
  post: "/posts/enterprise-search",
  headline: "Answers staff questions with citations.",
  tail: "On Cloud Run, paused since October.",
  lede:
    "Staff sign in with a company Google account and ask in a chat, and the API searches Postgres by meaning and by keyword inside their group permissions, reranks to 8 passages and has Gemini answer from them with citations. Uploaders add documents through Dropoff, where each file is hashed, kept, carded, chunked and embedded before anyone can find it.",
  titleBlock: [
    ["System", "Enterprise Search"],
    ["Revision", "unversioned"],
    ["Live since", "Jun 23, 2026"],
    ["Paused", "Oct 8, 2026"],
    ["Runs on", "Cloud Run, Cloud SQL, Firebase"],
    ["Region", "us-central1"],
    ["Checked", "both test suites, every deploy"],
    ["Demo set", "13 documents"],
    ["Scale", "50 + 50 : 8"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "55", unit: "minutes", label: "for the read path on June 27, from the permission filter to the eval test" },
    { value: "10", unit: "minutes", label: "the life of a link to a full source file, handed out only after the group check" },
    { value: "24", unit: "days", label: "from the first commit to real models in production on July 16" },
    { value: "8", unit: "passages", label: "reach Gemini per question, cut from 50 vector and 50 keyword matches" },
  ],
  svg,
  views: [
    { id: "ask", label: "Ask a question", focus: ["staff", "auth", "web", "api", "gemini", "db", "rerank"], note: "Embed the question, search Postgres two ways inside the permission filter, rerank to 8, then Gemini answers from them or abstains." },
    { id: "dropoff", label: "Add a document", focus: ["web", "api", "bucket", "gemini", "db"], note: "An uploader sets who may see it. The API hashes the file, keeps the original, gets a card and vectors, then indexes chunks." },
    { id: "access", label: "Who sees what", focus: ["auth", "web", "api", "db"], note: "Only the company domain signs in. Each chunk carries its groups, and SQL drops what you may not see before any ranking." },
    { id: "ship", label: "Every deploy", focus: ["migrate", "db", "api"], note: "Cloud Build runs both test suites, then this job migrates the schema before the API and the web app go out." },
  ],
  parts: {
    staff: {
      kind: "People",
      owner: "outside",
      what: "Anyone with a Hybridge Google account could sign in and search. Uploaders add documents and make groups on the fly; admins manage users and roles.",
      source: "docs/superpowers/specs/2026-06-22-hybridge-enterprise-search-master-design.md",
    },
    auth: {
      kind: "Sign in",
      owner: "managed",
      what: "Identity Platform runs Google sign in. The API checks every token itself: the email must be verified and on the company domain, a disabled account is refused, and a first sign in creates the user and an audit row.",
      fails: "On June 30 the token check ran before its SDK was set up, so every sign in got a 401. The fix shipped at 11:57 PM that night.",
      source: "api/app/auth.py:47",
    },
    web: {
      kind: "My app",
      owner: "mine",
      what: "A React app on Firebase Hosting. Ask Hybridge streams answers with inline citations and keeps conversation history; a citation opens the source scrolled to the cited passage. The Dropoff tab only shows for uploaders and admins.",
      source: "web/src/components/SourcePane.tsx",
    },
    api: {
      kind: "My service",
      owner: "mine",
      what: "FastAPI on Cloud Run, no minimum instances and at most 20, 1 vCPU and 1 GiB each. It runs search, streaming and ingestion in one process, with every model behind a small interface so tests run on fakes.",
      fails: "If Vertex cannot be reached, the chat shows that search is unavailable for now, and no half answer is saved.",
      source: "api/app/routers/conversations.py:139",
    },
    db: {
      kind: "Managed database",
      owner: "managed",
      what: "Cloud SQL Postgres 16 holds everything: documents, chunks with 768 dimension vectors on an HNSW index, a generated keyword column on a GIN index, groups, users, audit rows and chats. One query can filter, match and rank.",
      fails: "Billing for the project went off on October 8, 2026, and the instance has been suspended since, so nothing answers.",
      source: "api/migrations/versions/f9eb9ccc7186_ingestion_schema.py:72",
    },
    gemini: {
      kind: "Managed models",
      owner: "managed",
      what: "Vertex AI. gemini-embedding-001 at 768 dimensions embeds chunks in batches of 32 and each question. Gemini 2.5 Flash writes the document card and the answer, told to use only the given passages, cite each claim, and otherwise say it does not have that.",
      source: "api/app/serving/generate.py:127",
    },
    rerank: {
      kind: "Managed ranking",
      owner: "managed",
      what: "The Vertex AI ranking API rescores the fused candidates against the question and keeps the top 8.",
      fails: "Any failure falls back to the fused order, cut to 8, and is logged. From July 16 to 23 its library was missing from the image, and search ran on the fused order.",
      source: "api/app/serving/rerank.py:11",
    },
    bucket: {
      kind: "Managed storage",
      owner: "managed",
      what: "Cloud Storage keeps every original under its SHA-256 hash. The full file is only handed out as a link that expires in 10 minutes, after the same group check as search.",
      source: "api/app/ingestion/gcp.py:140",
    },
    migrate: {
      kind: "My job",
      owner: "mine",
      what: "A Cloud Run job that applies Alembic migrations. Cloud Build runs the Python tests, the web tests and the web build first, then this job, then deploys the API and the web app.",
      source: "cloudbuild.yaml",
    },
  },
  breaks: [
    { title: "The reranker fails", body: "Search falls back to the fused order, cut to 8, and logs the error, so questions still get answers.", source: "api/app/serving/rerank.py:11" },
    { title: "Vertex cannot be reached", body: "The chat streams a plain message that search is unavailable for now, and nothing broken is saved to the conversation.", source: "api/app/routers/conversations.py:139" },
    { title: "Ingestion stops halfway", body: "The document is marked failed with its error, or stays processing if the process died. Its owner or an admin can retry it from Dropoff.", source: "api/app/routers/dropoff.py:248" },
  ],
  tuned: [
    { title: "Fifty and fifty, then eight", body: "Top 50 by vector and top 50 by keyword, merged with reciprocal rank fusion at k 60, reranked down to 8 passages for the model.", source: "api/app/serving/pipeline.py:31" },
    { title: "Chunks of 800 tokens", body: "Layout blocks stay whole when they fit. Longer ones split into 800 token windows with 12 percent overlap, keeping exact character offsets for citations.", source: "api/app/ingestion/chunking.py:11" },
    { title: "One Postgres, both searches", body: "Vectors and the keyword index sit in the same table under the same filter, so there is no second store to keep in sync.", source: "api/app/serving/retrieval.py" },
  ],
  guards: [
    { title: "Permissions inside the query", body: "Each chunk carries its document's groups. Both searches run with that filter and a current documents only clause in SQL, before any ranking or model call.", source: "api/app/serving/acl.py:13" },
    { title: "No evidence, no model call", body: "If no passage is visible to the asker, the API returns the fixed abstain line and never calls Gemini. Otherwise Gemini may only use the 8 passages it is given.", source: "api/app/serving/pipeline.py:38" },
    { title: "Links cannot reach inside", body: "A link added in Dropoff must be http or https, must resolve to a public address, and is fetched without following redirects.", source: "api/app/ingestion/url_guard.py:11" },
  ],
  // hybridge-search has had no billing account linked since Oct 8, 2026 and
  // never appears in any billing export (costs/coverage.md), so there is no
  // measured month.
  cost: null,
  // Request driven: a question in the chat. Path: embed the question, search
  // Postgres, rerank, generate, stream back. No scheduler job in this project.
  live: {
    mode: "event",
    label: "A question",
    everySeconds: 14,
    path: ["staff", "web", "api", "gemini", "api", "db", "api", "rerank", "api", "gemini", "api", "web", "staff"],
    source: "a signed in staff member asks in the chat",
  },
};

export default arch;
