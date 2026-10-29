import type { Architecture } from "../types";
import svg from "../svg/marketing-warehouse.svg?raw";

const arch: Architecture = {
  slug: "marketing-warehouse",
  rank: 100,
  name: "Marketing Data Warehouse",
  project: "Marketing Data",
  kind: "system",
  disciplines: ["aie", "sde"],
  post: "/posts/marketing-warehouse",
  headline: "Pulls eleven feeds into BigQuery.",
  tail: "Every morning at 6 AM.",
  lede:
    "Every morning at 6, nine Cloud Run jobs and Google's Ads transfer copy ten marketing sources into BigQuery raw. Described staging and marts views join ad spend, calls and Monday leads to the patients they became, and the warehouse feeds a 6:30 email, a 6:45 health check and the Claude connector.",
  titleBlock: [
    ["System", "Marketing Data Warehouse"],
    ["Revision", "unversioned"],
    ["Live since", "Aug 4, 2026"],
    ["Runs on", "Cloud Run, BigQuery"],
    ["Region", "us-central1"],
    ["Sources", "10 daily, 1 weekly"],
    ["Checked", "6:45 AM, daily"],
    ["Eval", "21 of 22 on Oct 26"],
    ["Scale", "11 tabs : 1 coffee"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "3.5", unit: "hours", label: "from the design spec at 12:35 PM on Aug 4 to the first sync job running in the cloud" },
    { value: "9 of 9", label: "daily direct sources pulled on Oct 29, read from the warehouse's own freshness view", ring: 1 },
    { value: "3,334", unit: "of 3,383", label: "lead to patient matches made by the link staff already keep in Monday" },
    // email-daily: 8 scheduled runs Oct 22 to 29, all succeeded (gcloud run jobs executions list).
    { value: "8 of 8", label: "mornings the 6:30 email has gone out since it started on Oct 22" },
  ],
  svg,
  views: [
    { id: "morning-pull", label: "The 6 AM pull", focus: ["scheduler", "sync", "apis", "tapclicks", "ads", "raw"], note: "Nine jobs and the Google Ads transfer refetch recent days at 6 AM and upsert into raw, so a rerun overwrites." },
    { id: "join", label: "Lead to patient", focus: ["raw", "marts"], note: "Staging cleans each source. Marts join a lead to a patient through the link staff already make in Monday." },
    { id: "email", label: "The 6:30 email", focus: ["marts", "email", "team"], note: "Waits for the pulls, then sends one Excel tab per source with where and when its rows came from." },
    { id: "checks", label: "Checks", focus: ["raw", "checks", "marts", "evals"], note: "Freshness and drift at 6:45 AM every day, and 22 questions with known answers for Gemini every Monday." },
  ],
  parts: {
    tapclicks: {
      kind: "Agency feed",
      owner: "outside",
      what: "The reporting platform our ad agency uses. The warehouse takes from it only what no direct pull covers: streaming TV delivery and older Facebook, social and Business Profile days. Every TapClicks row keeps a source label so an answer can flag it.",
      fails: "Its feeds run two to three days behind, so the freshness check gives it three days before it alerts.",
      source: "src/connectors/tapclicks/main.py",
    },
    ads: {
      kind: "Managed transfer",
      owner: "managed",
      what: "Google's BigQuery Data Transfer copies the Google Ads tables into raw every morning with no code of mine. Performance Max comes from the campaign tables, since it has no ad groups.",
      source: "deploy/google_ads_transfer.sh",
    },
    connector: {
      kind: "My service",
      owner: "mine",
      what: "The Hybridge Data connector lets people on its list ask Claude about this warehouse with their own Google sign in. It has its own drawing.",
      source: "src/data_connector/server.py",
    },
    team: {
      kind: "People",
      owner: "outside",
      what: "Our marketing lead, a marketing teammate and me. All three get the morning email and ask questions through the connector.",
    },
    apis: {
      kind: "Vendor APIs",
      owner: "outside",
      what: "Microsoft Ads, Meta ads and organic pages, CallRail, Monday, GA4, Search Console and Google Business Profile, each read through its own free API.",
      source: "src/connectors",
    },
    sync: {
      kind: "My jobs",
      owner: "mine",
      what: "Ten Python connectors, one Cloud Run job each, from one Dockerfile and one shared library for retries, secrets and BigQuery loads. Nine run at 6 AM and reread the last 4 to 35 days, because platforms restate recent days. The tenth reads Monday's weekly export on Wednesdays as a second copy to check against.",
      fails: "A failed run logs an ERROR, which emails me within the hour. The next good run rereads its window and fills the gap.",
      source: "deploy/setup_alerts.sh",
    },
    raw: {
      kind: "Managed database",
      owner: "managed",
      what: "BigQuery dataset raw keeps every source as it arrived: 124 tables plus the transfer's own views. Loads merge on a stable key, so a rerun overwrites its rows.",
      source: "src/common/bq.py:8",
    },
    marts: {
      kind: "My SQL",
      owner: "mine",
      what: "21 staging views type and clean each source. 22 marts tables answer questions: the daily summary, the lead to patient funnel, cost per outcome, ad creative, website, TV. All 657 columns carry a description, and marts.data_guide is the map a model reads first.",
      source: "sql/marts/lead_to_patient_funnel.sql",
    },
    email: {
      kind: "My job",
      owner: "mine",
      what: "At 6:30 AM it waits up to an hour for the pulls, then mails one Excel workbook to three people: a summary and 11 source tabs from the first of last month, each tab saying where its rows came from and when they were pulled.",
      fails: "A tab whose query fails is marked not ready and the email still goes. It has sent every morning since Oct 22.",
      source: "src/connectors/daily_email/main.py",
    },
    scheduler: {
      kind: "Managed cron",
      owner: "managed",
      what: "Fourteen Cloud Scheduler triggers, all on New York time: nine pulls at 6:00, connector views at 6:20, the email at 6:30, checks at 6:45, the board export backup on Wednesdays and the eval on Mondays.",
      source: "deploy/deploy_jobs.sh",
    },
    checks: {
      kind: "My job",
      owner: "mine",
      what: "ops-daily checks the newest row of ten sources against an age limit of 1 to 4 days each. Then it compares yesterday's spend, calls and leads with the 28 days before and logs every comparison.",
      fails: "A stale source or a z score above 3 fails the run, and the failure emails me.",
      source: "src/connectors/ops/main.py",
    },
    evals: {
      kind: "My eval",
      owner: "mine",
      what: "Every Monday at 8 AM, Gemini 2.5 Flash answers 22 questions with one read only SQL tool, and each answer is scored against a canonical query run at the same moment. Below 80 percent the job fails. The first run scored 17 of 22; the Oct 26 run scored 21.",
      source: "src/evals/run_evals.py:31",
    },
  },
  breaks: [
    { title: "A source misses its morning", body: "ops-daily fails when a source's newest row is older than its limit, 1 to 4 days by source. The ERROR line emails an alert within the hour.", source: "src/connectors/ops/main.py:5" },
    { title: "A number jumps overnight", body: "Spend, calls and leads are each compared with the 28 days before. A z score above 3 joins the same failure.", source: "src/connectors/ops/main.py:127" },
    { title: "A tab is not ready", body: "The email waits up to an hour for the pulls. A tab whose query fails says so, and the other tabs still send.", source: "src/connectors/daily_email/main.py:487" },
  ],
  tuned: [
    { title: "Managed where it exists", body: "Google Ads, the biggest source, arrives through Google's own Data Transfer. There is no connector of mine to keep alive for it.", source: "deploy/google_ads_transfer.sh" },
    { title: "Reread, then merge", body: "Each pull rereads 4 to 35 days, because platforms restate recent days, and merges on a stable key. A missed morning heals on the next run.", source: "src/common/bq.py:8" },
    { title: "Descriptions live in the SQL", body: "Every view and column description sits in its SQL file, so each redeploy writes them again. All 657 columns are described.", source: "sql/marts/00_data_guide.sql" },
  ],
  guards: [
    { title: "Blocked TapClicks views", body: "Call, form, review, comment and lead views are refused in code before the job reads its credentials. Editing the view list cannot turn them on.", source: "src/connectors/tapclicks/main.py:62" },
    { title: "No names in the workbook", body: "The email reads BigQuery only. Names, phone numbers, emails and record IDs stay in BigQuery, and landing page links are cut at the query string.", source: "src/connectors/daily_email/main.py:1" },
    { title: "One send per morning", body: "email-daily allows a single retry, since a retry after a good send would mail it twice. It runs as its own account with read access to BigQuery.", source: "deploy/setup_daily_email.sh:46" },
  ],
  // hybridge-mktg-data bills to account 014441, whose export was switched on
  // Oct 28, 2026 and is still empty (project-docs/fde-refresh/costs/by-project.csv).
  cost: null,
  // gcloud scheduler jobs list --project hybridge-mktg-data --location us-central1:
  // nine trigger-* pulls at 0 6 * * * America/New_York, trigger-email at 30 6.
  live: {
    mode: "daily",
    label: "Next morning pull",
    at: "06:00",
    path: ["scheduler", "sync", "apis", "sync", "raw", "marts", "email", "team"],
    source: "Cloud Scheduler, nine trigger jobs at 6:00 AM, then email-daily at 6:30",
  },
};

export default arch;
