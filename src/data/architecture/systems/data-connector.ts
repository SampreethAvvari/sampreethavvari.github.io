import type { Architecture } from "../types";
import svg from "../svg/data-connector.svg?raw";

const arch: Architecture = {
  slug: "data-connector",
  rank: 105,
  name: "Hybridge Data connector",
  project: "Marketing Data",
  kind: "service",
  disciplines: ["aie"],
  post: "/posts/data-connector",
  headline: "Lets Claude query marketing data.",
  tail: "Each person signs in once.",
  lede:
    "People on the list add the connector in Claude and sign in with Google once. Each question runs as one SELECT against that person's own BigQuery dataset of views, built from the boxes an owner ticked, and Claude ends every answer with where the numbers came from.",
  titleBlock: [
    ["System", "Hybridge Data connector"],
    ["Revision", "unversioned"],
    ["Live since", "Oct 23, 2026"],
    ["Runs on", "Cloud Run, FastMCP"],
    ["Region", "us-central1"],
    ["Sign in", "Google, once"],
    ["Live code", "older build, main ahead"],
    ["Views", "6:20 AM daily"],
    ["Scale", "1 call : 1 SELECT"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "3", unit: "hours", label: "from the first connector code at 12:06 PM on Oct 23 to the live service" },
    { value: "13", unit: "boxes", label: "an owner ticks per person; each set of boxes gets its own dataset of views" },
    // BigQuery connector.calls, Oct 23 to Oct 29 2:30 PM ET.
    { value: "469", unit: "calls", label: "from 3 people in the first seven days, Oct 23 to 29, 364 of them queries" },
    { value: "39 of 40", label: "golden questions passed through Claude on the main branch code, Oct 27; all 40 answers were correct" },
  ],
  svg,
  views: [
    { id: "every-source", label: "Every source", focus: ["gads", "msads", "meta", "metaorg", "callrail", "monday", "ga4", "gsc", "gbp", "tapclicks", "drive", "dts", "pulls", "exportjob", "raw"], note: "Eleven outside feeds land in BigQuery every morning: ads, calls, leads, website, search, listings and agency media." },
    { id: "question", label: "A question", focus: ["people", "claude", "connector", "guard", "access", "marts"], note: "Claude writes SQL against the warehouse names. The guard points every table at the person's own dataset of views." },
    { id: "sign-in", label: "Sign in once", focus: ["people", "claude", "connector", "google", "firestore"], note: "Google confirms the email once. Sessions sit encrypted in Firestore and outlast restarts and redeploys." },
    { id: "boxes", label: "Boxes", focus: ["owner", "firestore", "views", "access"], note: "An owner ticks sources per person. Each set of boxes gets its own BigQuery dataset, rebuilt at 6:20 AM." },
  ],
  parts: {
    gads: {
      kind: "Ad platform",
      owner: "outside",
      what: "Google Ads search and Performance Max. It lands through Google's own managed Data Transfer rather than a job of mine.",
      source: "BigQuery Data Transfer, google-ads-dts",
    },
    msads: {
      kind: "Ad platform",
      owner: "outside",
      what: "Microsoft Ads, read through the Reporting API v13: campaign, ad group, keyword, ad and asset by day.",
      source: "src/connectors/msads/main.py:192",
    },
    meta: {
      kind: "Ad platform",
      owner: "outside",
      what: "Meta Ads through the Graph API v21: ad sets, ads, creative and the images and videos behind them. Coded errors wait 10, 30, 60 then 120 seconds and retry.",
      source: "src/connectors/meta/main.py:49",
    },
    metaorg: {
      kind: "Social",
      owner: "outside",
      what: "Facebook Page and Instagram insights for the organic posts, through the same Graph API.",
      source: "src/connectors/meta_organic/main.py:23",
    },
    callrail: {
      kind: "Calls",
      owner: "outside",
      what: "CallRail v3: every tracked call and website form submission with its source, so a lead can be tied to the ad that made the phone ring.",
      source: "src/connectors/callrail/main.py:10",
    },
    monday: {
      kind: "Lead boards",
      owner: "outside",
      what: "The Monday lead and patient boards through GraphQL. Each board is read on its own, with a backoff that honours Monday's retry time.",
      source: "src/connectors/monday/main.py:21",
    },
    ga4: {
      kind: "Website",
      owner: "outside",
      what: "GA4 traffic, sources, landing pages and cities through the Data API, read as a service account with read only access.",
      source: "src/connectors/ga4/main.py:15",
    },
    gsc: {
      kind: "Search",
      owner: "outside",
      what: "Search Console queries and pages through its v3 API, with the same read only service account as GA4.",
      source: "src/connectors/gsc/main.py:21",
    },
    gbp: {
      kind: "Listings",
      owner: "outside",
      what: "Google Business Profile performance and search keywords for each office listing.",
      source: "src/connectors/gbp/main.py:22",
    },
    tapclicks: {
      kind: "Agency feed",
      owner: "outside",
      what: "TapClicks, the agency's feed for streaming TV and print. Every number from it is flagged as agency reported in the answer.",
      source: "src/connectors/tapclicks/main.py:23",
    },
    drive: {
      kind: "Board export",
      owner: "outside",
      what: "A Monday board export dropped in Google Drive, read with a read only scope and merged into BigQuery.",
      source: "sync-monday-export",
    },
    dts: {
      kind: "Managed transfer",
      owner: "managed",
      what: "BigQuery Data Transfer copies Google Ads into the warehouse every day with no code of mine to run.",
      source: "google-ads-dts",
    },
    pulls: {
      kind: "My jobs",
      owner: "mine",
      what: "Nine Cloud Run jobs, one per source, each fired by its own Cloud Scheduler trigger at 6 AM New York time. Every job merges the last few days into BigQuery, so a rerun or a late fix never doubles a row.",
      source: "src/common/bq.py:21",
    },
    exportjob: {
      kind: "My job",
      owner: "mine",
      what: "Reads the Monday export from Drive and merges it into BigQuery, for the board fields the API does not return.",
      source: "sync-monday-export",
    },
    raw: {
      kind: "Managed database",
      owner: "managed",
      what: "BigQuery raw: one table per source feed, written only by MERGE so the pulls stay safe to rerun.",
      source: "src/common/bq.py:21",
    },
    google: {
      kind: "Sign in",
      owner: "managed",
      what: "FastMCP's OAuth proxy sends a person to Google once and asks only for openid and email. With no Google Cloud scope, Workspace's Google Cloud reauthentication never applies.",
      fails: "An email Google has not verified is refused with a sentence that says why.",
      source: "src/data_connector/server.py:54",
    },
    views: {
      kind: "My job",
      owner: "mine",
      what: "Cloud Run job connector-views runs at 6:20 AM, after the pulls, and builds the views for every set of boxes on the list. A set already at the current version costs one metadata call.",
      source: "src/data_connector/prebuild.py",
    },
    people: {
      kind: "People",
      owner: "outside",
      what: "Our marketing lead, a marketing teammate and me. Anyone with a Google account can be added by email, and a new person starts with nothing ticked.",
      source: "docs/superpowers/specs/2026-10-22-hybridge-data-connector-design.md",
    },
    claude: {
      kind: "Claude",
      owner: "outside",
      what: "Claude on the web, the desktop app or a phone adds the connector once and writes the SQL. The connector's instructions carry the business rules, including a Source section on every answer and a TapClicks flag on any number from the agency feed.",
      source: "src/data_connector/instructions.md",
    },
    connector: {
      kind: "My service",
      owner: "mine",
      what: "data-connector on Cloud Run, Python and FastMCP, one instance always warm with CPU billed per request since Oct 29. Its tools list tables, describe one, read the data guide and worked examples, and run a query. Every call is logged with the person, tool, SQL, bytes and rows.",
      fails: "An uptime check calls /health every five minutes and emails me if it fails. Logging never blocks an answer.",
      source: "src/data_connector/server.py",
    },
    guard: {
      kind: "My guard",
      owner: "mine",
      what: "sqlglot parses each query. Anything but one SELECT is refused, along with table functions and time travel, and every table name is pointed at the person's own dataset. Caps: 25 GB scanned, 90 seconds, 1,000 rows.",
      fails: "A capped query comes back with a sentence telling Claude to filter by date or aggregate first.",
      source: "src/data_connector/sql_guard.py:69",
    },
    access: {
      kind: "My views",
      owner: "mine",
      what: "One BigQuery dataset of views for each set of boxes, authorized to read marts and staging. Without the patient box the contact columns are dropped, and without the Elmwood box the family practice rows are. Queries run as one of two identities that can read only these datasets.",
      source: "src/data_connector/datasets.py:1",
    },
    owner: {
      kind: "My page",
      owner: "mine",
      what: "Owners sign in with Google, add a person by email and tick 13 boxes, from Google Ads to patient names. A change applies on that person's next question.",
      source: "src/data_connector/admin.py:1",
    },
    firestore: {
      kind: "Managed database",
      owner: "managed",
      what: "Holds the people list and the sign in sessions, encrypted, so sessions outlast restarts and redeploys. Access tokens last 7 days and refresh tokens 10 years.",
      source: "src/data_connector/server.py:61",
    },
    marts: {
      kind: "Managed database",
      owner: "managed",
      what: "The marketing warehouse's staging and marts in BigQuery, refreshed every morning at 6. Every table needs a rule in the connector's catalog; a table without one stays hidden.",
      source: "src/data_connector/catalog.py:1",
    },
  },
  breaks: [
    { title: "BigQuery stalls", body: "Every BigQuery call on the request path has a timeout, 20 to 30 seconds for metadata and job starts, so a stuck API cannot hold a worker thread.", source: "src/data_connector/datasets.py:30" },
    { title: "The service goes down", body: "An uptime check calls /health every five minutes and emails me when it fails. One instance stays warm for the first question of the day.", source: "deploy/setup_connector.sh:93" },
    { title: "A query asks too much", body: "Past 25 GB, 90 seconds or 1,000 rows, Claude gets a sentence telling it to filter by date or aggregate first.", source: "src/data_connector/queries.py:21" },
  ],
  tuned: [
    { title: "Sign in once", body: "Access tokens last 7 days and refresh tokens 10 years, kept encrypted in Firestore. Google's own refresh token is the real limit.", source: "src/data_connector/server.py:61" },
    { title: "Views built at 6:20", body: "After a deploy changes the table rules, the morning job rebuilds every set of views before anyone asks a question.", source: "src/data_connector/prebuild.py" },
    { title: "Google checks cached", body: "A checked Google token is trusted for five minutes before Google is asked again.", source: "src/data_connector/server.py:66" },
  ],
  guards: [
    { title: "Boxes enforced in BigQuery", body: "Each set of boxes is its own dataset of authorized views. The query identities can read those datasets and cannot read marts, staging or raw directly.", source: "src/data_connector/datasets.py:1" },
    { title: "One SELECT, own dataset", body: "The guard parses every query, refuses anything but a single SELECT, and points each table at the person's own dataset.", source: "src/data_connector/sql_guard.py:69" },
    { title: "New tables start hidden", body: "Every warehouse table needs a rule in the catalog before anyone sees it. Names and phone numbers need the patient box.", source: "src/data_connector/catalog.py:1" },
  ],
  // hybridge-mktg-data bills to account 014441, whose export was switched on
  // Oct 28, 2026 and is still empty (project-docs/fde-refresh/costs/by-project.csv).
  cost: null,
  // Request driven: a person asks Claude. 469 calls from 3 people, Oct 23 to 29
  // (connector.calls). Path: ask, MCP call, guard, own views, warehouse, back.
  live: {
    mode: "event",
    label: "A question in Claude",
    everySeconds: 14,
    path: ["people", "claude", "connector", "guard", "access", "marts", "access", "guard", "connector", "claude", "people"],
    source: "a person on the list asks Claude a marketing question",
  },
};

export default arch;
