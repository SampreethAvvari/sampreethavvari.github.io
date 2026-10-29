import type { Architecture } from "../types";
import svg from "../svg/treatment-sequence.svg?raw";

const arch: Architecture = {
  slug: "treatment-sequence",
  rank: 35,
  name: "Treatment Sequence",
  project: "Treatment Estimator",
  kind: "service",
  disciplines: ["sde"],
  post: "/posts/treatment-sequence",
  headline: "Builds visit plans from eleven practice masters.",
  tail: "Runs inside the estimator.",
  lede:
    "The engine and its editor live in their own repo and reach the estimator as a built snapshot committed under vendor/sequence, stamped with the commit it came from. The estimator generates a plan from a transcribed practice master on the server, the builder edits it, and each save is a new version in Postgres.",
  titleBlock: [
    ["System", "Treatment Sequence"],
    ["Revision", "unversioned"],
    ["Live since", "Aug 27, 2026"],
    ["Runs on", "Inside the estimator"],
    ["Region", "us-east1"],
    ["Exports", "Word and PDF"],
    ["Saves", "One version each"],
    ["Snapshot", "f40b034, in sync"],
    ["Scale", "1 unit : 15 minutes"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    // commits-index.csv: first sequence commit e06892f at 11:35 AM Aug 27; estimator tag v1.27.0 at 4:05 PM.
    { value: "4.5", unit: "hours", label: "from the first commit at 11:35 AM on Aug 27 to the builder live in the estimator" },
    // estimator scripts/check-vendor-sequence.mjs
    { value: "2 of 2", label: "packages built from the same clean commit, or the estimator's CI fails" },
    // packages/core/src/templates/*.ts, 11 with validated: true.
    { value: "11", unit: "masters", label: "the practice's own documents, transcribed word for word, all validated" },
    { value: "0", unit: "errors", label: "in 271 attempts across 75 live estimates, production audit of Aug 27" },
  ],
  svg,
  views: [
    { id: "ship-change", label: "Ship an engine change", focus: ["repo", "tests", "vendor", "snapshot", "ci", "estimator"], note: "Test and commit here first, vendor with one command, CI checks the stamp, and only an estimator v tag deploys it." },
    { id: "generate", label: "Generate a plan", focus: ["masters", "repo", "estimator", "builder"], note: "The engine reads the estimate, picks a transcribed master, fills in the real teeth, and the builder opens it." },
    { id: "save-print", label: "Save and print", focus: ["builder", "estimator", "db", "exports"], note: "Each save appends a version that never changes. Word and PDF come from the plan on screen." },
    { id: "drift", label: "Where it can drift", focus: ["vendor", "planner", "snapshot", "ci"], note: "The capacity planner carries an older snapshot. Nothing goes red when a consumer falls behind." },
  ],
  parts: {
    masters: {
      kind: "Practice documents",
      owner: "outside",
      what: "The practice's own treatment sequence masters, written as Word documents. Eleven are transcribed word for word into data, each one recording the document it came from.",
      source: "packages/core/src/templates/index.ts:24",
    },
    planner: {
      kind: "My app",
      owner: "mine",
      what: "The capacity planner vendors the same packages for its anchored popovers. Its snapshot is from 28e81cd, older than the estimator's.",
      fails: "Nothing fails when it falls behind. That is the gap SYNC-STATUS.md exists to name.",
      source: "capacity-planner/vendor/sequence/README.md",
    },
    ci: {
      kind: "Guard",
      owner: "mine",
      what: "pnpm vendor:check runs in the estimator's CI. Both packages must be built, stamped with a full commit, taken from a clean tree, and taken from the same commit.",
      fails: "Any one of those wrong and CI fails, with the command that fixes it in the message.",
      source: "estimator/scripts/check-vendor-sequence.mjs",
    },
    repo: {
      kind: "My repo",
      owner: "mine",
      what: "Two packages and no app. sequence-core holds the masters, generation, date math and the Word renderer, with no React. sequence-ui is the editor. Nothing is published to a registry.",
      source: "README.md",
    },
    vendor: {
      kind: "My script",
      owner: "mine",
      what: "One command in the estimator builds this repo, copies the compiled output without source maps, and stamps each package with the commit and whether the tree was dirty. Then it proves node_modules serves the new build.",
      fails: "If node_modules still serves the old build, it exits 1 and says how to fix it.",
      source: "estimator/scripts/vendor-sequence.mjs:154",
    },
    snapshot: {
      kind: "Committed files",
      owner: "mine",
      what: "vendor/sequence in the estimator repo, depended on with link: so a refresh is live at once. Docker and CI install nothing from outside the repo, so there is no token to rotate.",
      source: "estimator/docs/sequence-packages.md",
    },
    estimator: {
      kind: "My service",
      owner: "mine",
      what: "The estimator's sequence page reads the estimate on the server and calls the engine, which ranks the masters by arch, path and staging. If generation throws, the page shows a plain problem panel with a way back.",
      source: "estimator/app/(app)/estimates/[id]/sequence",
    },
    builder: {
      kind: "My app",
      owner: "mine",
      what: "The three pane builder from sequence-ui: the visits, a flowchart with each gap sized by its real wait, and a live preview of the document. Every edit renumbers the visits and projects the dates again.",
      source: "packages/ui/src/SequenceWorkspace.tsx",
    },
    tests: {
      kind: "Tests",
      owner: "mine",
      what: "Vitest tests on core, across generation, date projection and tooth notation. They run with typecheck and build before anything is pushed.",
      source: "packages/core/test",
    },
    db: {
      kind: "Managed database",
      owner: "managed",
      what: "Two tables in the estimator's Cloud SQL: the living plan, and one immutable JSON version per save. A unique index on plan and version number makes the second of two racing saves fail instead of overwriting.",
      source: "estimator/lib/db/schema/sequence.ts:146",
    },
    exports: {
      kind: "My code",
      owner: "mine",
      what: "Word and PDF from the plan in the request body, so a coordinator can download what is on screen without saving. The Word file embeds Inter and prints on Letter.",
      source: "estimator/docs/treatment-sequences.md:82",
    },
  },
  breaks: [
    { title: "A consumer falls behind", body: "Nothing goes red. vendor:check only notes it when the source repo sits beside it, and both repos carry a file marked TEMPORARY that says so.", source: "SYNC-STATUS.md" },
    { title: "No master fits the case", body: "The builder opens empty for a manual build instead of bending a master to fit. The Aug 27 audit found 8 such cases in 271.", source: "estimator/scripts/audit" },
    { title: "A refresh does not take", body: "The vendor script compares node_modules with the new stamp and exits 1 if it still serves the old build.", source: "estimator/scripts/vendor-sequence.mjs:167" },
  ],
  tuned: [
    { title: "link:, not file:", body: "file: copied the folder once and never again, because the spec never changed. link: points into the folder, so a refresh is live.", source: "estimator/docs/sequence-packages.md" },
    { title: "15 minute units everywhere", body: "Every value in the masters divides evenly into 15 minute units, so hours are only a way of printing it.", source: "README.md" },
    { title: "One JSON version per save", body: "The editor and both renderers already read that shape, and nothing queries inside the steps, so five tables would be a second thing to keep in step.", source: "estimator/docs/treatment-sequences.md:39" },
  ],
  guards: [
    { title: "One commit for both packages", body: "A core and an editor from different commits is a pairing nobody tested, so CI refuses it.", source: "estimator/scripts/check-vendor-sequence.mjs" },
    { title: "Staging is stated, not guessed", body: "Staging is an explicit mode on the option. Reading empty tooth lists as no staging once sent every Hybridge case to a manual build.", source: "packages/core/src/generate.ts:140" },
    { title: "Unvalidated means a banner", body: "A master not transcribed from the practice prints a draft, not clinically reviewed banner on screen, PDF and Word. All 11 are validated.", source: "packages/core/src/render/text.ts:15" },
  ],
  // No bill of its own: it runs inside estimator-prod, whose cost is on the
  // treatment-estimator page.
  cost: null,
  live: {
    mode: "event",
    label: "A coordinator opens a plan",
    everySeconds: 15,
    path: ["builder", "estimator", "snapshot", "estimator", "builder", "estimator", "db"],
    source: "a coordinator opening Sequence on an estimate, then pressing Save",
  },
};

export default arch;
