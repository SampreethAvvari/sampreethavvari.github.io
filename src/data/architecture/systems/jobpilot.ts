import type { Architecture } from "../types";
import svg from "../svg/jobpilot.svg?raw";

const arch: Architecture = {
  slug: "jobpilot",
  rank: 150,
  status: "preview",
  statusNote: "Open source, demo on fictional data",
  name: "JobPilot",
  project: "JobPilot",
  kind: "system",
  disciplines: ["sde", "aie"],
  post: "/posts/jobpilot-v2",
  headline: "Finds fresh jobs, tailors each resume.",
  tail: "1,008 runs, June to October.",
  lede:
    "A Cloud Run job pulls fresh postings from 163 company boards and four aggregators, drops the roles I could never take, and has Gemini score the rest into a Google Sheet. A private console reads that Sheet, each tailored resume passes a judge before it reaches Drive, and the public demo runs the same console on fictional data.",
  titleBlock: [
    ["System", "JobPilot"],
    ["Revision", "unversioned"],
    ["Live since", "Jun 10, 2026"],
    ["Runs on", "Cloud Run, Sheets"],
    ["Region", "us-central1"],
    ["License", "MIT, public repo"],
    ["Runs", "1,008, Jun 10 to Oct 8"],
    ["Sign in", "IAP, per user allowlist"],
    ["Scale", "10 rewrites : 1 resume"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "40", unit: "min", label: "from an empty Google Cloud project to a running pipeline and console, 3:14 to 3:54 AM on June 10" },
    { value: "0", label: "outreach emails it sends on its own. Every one waits in Gmail drafts for my click" },
    // Live audit of the Sheet in docs/superpowers/specs/2026-07-23-console-cards-freshness-design.md.
    { value: "5,093", unit: "jobs", label: "tracked in the Sheet by July 23, with 22 to 58 fresh rows added each day" },
    { value: "1,008", unit: "runs", label: "of the pipeline, June 10 to October 8: every 30 minutes at first, then twice each morning" },
  ],
  svg,
  views: [
    { id: "full-run", label: "A full run", focus: ["scheduler", "pipeline", "boards", "gemini", "sheet", "gmail"], note: "The scheduler starts the job. It pulls fresh postings, drops dead ends, has Gemini score the rest and writes rows to the Sheet." },
    { id: "judge-loop", label: "The judge loop", focus: ["pipeline", "gemini", "judge", "gmail"], note: "Gemini rewrites, the judge scores the PDF and sends back its issues. Best of up to 10 tries goes to Drive." },
    { id: "morning", label: "The morning review", focus: ["me", "console", "sheet", "gmail"], note: "I sign in, read the scored list and click Apply. Replies move rows forward, and a real next step sends an alert." },
    { id: "today", label: "What runs today", focus: ["visitors", "demo", "worker"], note: "The code is open source. The public demo runs the real console on fictional data, with one small live model." },
  ],
  parts: {
    boards: {
      kind: "Job sources",
      owner: "outside",
      what: "Public job board APIs for 163 company boards across seven ATS types, plus RemoteOK, Hacker News hiring threads, Adzuna, and LinkedIn through an Apify actor capped at 50 results. Each source has an adapter that turns its postings into one model. Adding a company is one row in the Companies tab, and a resolver works out which ATS it runs on.",
      fails: "One dead source never stops a run. Each source's count or error lands in the digest's run notes.",
      source: "src/jobpilot/pipeline.py:56",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "As the repo sets it up, two jobs: a fast fetch at a quarter past and a quarter to every hour, and full runs at midnight, 6, noon and 6. My own copy ran every 30 minutes in June, then twice each morning from June 26.",
      fails: "A scheduler 403 is silent. The fast fetch never ran until its service account got the role that allows argument overrides, so the bug log tells every fork to check job status after an IAM change.",
      source: "docs/gcp-setup.md:17",
    },
    pipeline: {
      kind: "My service",
      owner: "mine",
      what: "One Cloud Run job in Python 3.12, 2 GiB, a 45 minute timeout and no retries. Fetch, filter, dedup, score, write, then watch the inboxes. A full run adds tailoring, outreach drafts and the digest.",
      fails: "Unscored jobs are never written, so they stay out of dedup memory and get scored next run. Tailoring is idempotent, so the next run finishes whatever a cut off run left.",
      source: "src/jobpilot/pipeline.py:142",
    },
    gemini: {
      kind: "Managed model",
      owner: "managed",
      what: "Gemini 2.5 Flash on Vertex AI, reached with the job's service account, so there is no API key. Scoring sends batches of 10 against a JSON schema: fit from 0 to 100, one line of why, a sponsorship signal and a role type. The console's copilot uses Vertex too.",
      fails: "A malformed batch gets one retry. After that it stays unscored and the run carries on.",
      source: "src/jobpilot/scorer.py:91",
    },
    judge: {
      kind: "My code",
      owner: "mine",
      what: "A replica of ResumeWorded's rubric: about 40 checks weighted impact 35, brevity 20, style 15, sections 15 and soft skills 15. Each tailored resume loops: compile, judge, hand the issues back to Gemini. Up to 10 tries, early exit at 90, and the best attempt wins.",
      source: "src/jobpilot/rewrite_loop.py:31",
    },
    sheet: {
      kind: "Database",
      owner: "managed",
      what: "One Google Sheet is the database and a dashboard I can fix from my phone, with tabs for Jobs, Archive, Companies, Outreach, InboxWatch and more. Fit 75 and up lands in Jobs. Lower fits and sponsorship rejects go to Archive, and dedup reads both, so nothing archived comes back.",
      source: "src/jobpilot/sheets.py:225",
    },
    gmail: {
      kind: "Google Workspace",
      owner: "managed",
      what: "The pipeline acts as me through one OAuth grant with four narrow scopes: Sheets, Gmail compose, Gmail read only, and only the Drive files it created. Tailored PDFs go to Drive and outreach becomes drafts. The digest and reply alerts are the only mail it sends, and they go to me.",
      source: "src/jobpilot/gauth.py:15",
    },
    console: {
      kind: "My app",
      owner: "mine",
      what: "Next.js 16 on Cloud Run behind IAP, so the app has no login code of its own. Jobs, Applied, Replies, Resumes, Companies, Outreach and an assistant grounded in my GitHub, portfolio and resumes. Tailor, Draft and Refresh buttons start the pipeline job with arguments for one row.",
      source: "ui/src/lib/run.ts:19",
    },
    me: {
      kind: "The user",
      owner: "outside",
      what: "Me. I read the scored list, click Apply, confirm when I am back, and send every email myself. Anyone who forks the repo becomes this box.",
      source: "README.md",
    },
    visitors: {
      kind: "People",
      owner: "outside",
      what: "Anyone on the public demo. Each visitor gets three live tailor tries a day, and the whole demo gets 200.",
      source: "jobpilot-demo repo, worker/wrangler.toml",
    },
    demo: {
      kind: "My app",
      owner: "mine",
      what: "The real console UI as a static site on Cloudflare Pages, running on a fictional dataset held in memory. Jane Doe does not exist, none of the companies are real, and every click resets on reload. The AI moments in it are labelled replays, except Tailor.",
      source: "jobpilot-demo repo, src/lib/store.ts",
    },
    worker: {
      kind: "My service",
      owner: "mine",
      what: "One Cloudflare Worker behind the demo's Tailor page. It checks Turnstile, counts per visitor and per day in KV, then asks a small Llama model on Workers AI for bullet rewrites under the same rule: rephrase, never invent. It keeps nothing but the counters.",
      fails: "Bad JSON from the model gets one retry. After that, or once the daily cap is spent, the page shows a labelled sample.",
      source: "jobpilot-demo repo, worker/src/index.js:97",
    },
  },
  breaks: [
    { title: "A job source goes down", body: "Each source runs in its own try block, so one dead API never kills a run. Its error shows in the digest's run notes.", source: "src/jobpilot/pipeline.py:56" },
    { title: "Gemini returns bad JSON", body: "The batch gets one retry, then stays unscored and out of the Sheet, so the next run picks it up.", source: "src/jobpilot/scorer.py:97" },
    { title: "A posting has no description", body: "Tailoring fetches the live posting page first. Under 200 characters it refuses and says why on the row, with a retry button.", source: "src/jobpilot/tailor.py:140" },
  ],
  tuned: [
    { title: "2 GiB for 163 boards", body: "The parallel board fetch ran out of memory at the 512 MiB default, so the job runs with 2 GiB.", source: ".github/workflows/deploy.yml" },
    { title: "Dedup on company and title", body: "Location left the key after boards listed one role per city, 23 duplicate groups in 426 rows. When two sources carry a job, the higher fidelity one wins.", source: "src/jobpilot/dedup.py:30" },
    { title: "Fresh first", body: "Company boards keep 14 days, aggregators 7, and undated postings are dropped. A July audit found 2,960 New rows older than 30 days in the Sheet.", source: "src/jobpilot/config.py:65" },
  ],
  guards: [
    { title: "Drafts only", body: "Outreach is created as Gmail drafts and nothing else. No published recipient email means no draft at all.", source: "src/jobpilot/outreach.py:135" },
    { title: "The tailor cannot invent", body: "The prompt allows reordering, rephrasing and emphasis, never a new employer, title, date, metric or tool. Length stays within 5 percent of the master so it fits one page.", source: "src/jobpilot/prompts/tailor_v1.txt" },
    { title: "No personal data in git", body: "My profile and resumes load from Secret Manager at run time. The public repo ships a Jane Doe template.", source: "src/jobpilot/config.py:128" },
  ],
  // jobpilot-sva is a personal project; its billing was unlinked after Oct 8
  // (project-docs/fde-refresh/costs/coverage.md), so there is no October month.
  cost: null,
  // Only the public demo runs today (billing off on jobpilot-sva since Oct 8).
  // Its Tailor page is request driven: visitor, demo, worker, back.
  live: {
    mode: "event",
    label: "A demo tailor",
    everySeconds: 14,
    path: ["visitors", "demo", "worker", "demo", "visitors"],
    source: "a visitor pastes a job description into the public demo's Tailor page",
  },
};

export default arch;
