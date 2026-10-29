import type { Architecture } from "../types";
import svg from "../svg/doctor-portal.svg?raw";

const arch: Architecture = {
  slug: "doctor-portal",
  rank: 60,
  status: "preview",
  statusNote: "Preview on sample data",
  name: "Doctor Portal",
  project: "Doctor Portal",
  kind: "system",
  disciplines: ["fde", "sde"],
  post: "/posts/doctor-portal",
  headline: "Adds the Rx to the scanner's case.",
  tail: "Live on sample data.",
  lede:
    "Hybridge staff sign in through Google IAP and click through one made up practice, as the doctor or as the lab, with every case kept as sample data in Firestore. Real lab data is planned in two steps: the lab's own server through a connector that only sends out, then the MagicTouch API once its license is bought.",
  titleBlock: [
    ["System", "Doctor Portal"],
    ["Revision", "v0.3.0"],
    ["Live since", "Oct 28, 2026"],
    ["Runs on", "Cloud Run, Firestore"],
    ["Region", "us-east1"],
    ["Data", "Sample only"],
    ["Sign in", "Hybridge Google, IAP"],
    ["Views", "Doctor and lab"],
    ["Scale", "1 scan : 1 case"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "3.7", unit: "hours", label: "from the sync that made it top priority to a working live link" },
    { value: "4", label: "things still pretend, listed on every release note" },
    // gcloud run revisions list: doctor-portal-00001 at 19:03:13Z failed its first visit, 00002 at 19:12:54Z fixed it.
    { value: "9", unit: "min", label: "from the revision that failed its first visit to the one that fixed it" },
    { value: "1,664", unit: "uploads", label: "doctors made in the old portal since March 27, about ten a business day" },
  ],
  svg,
  views: [
    { id: "today", label: "What runs today", focus: ["people", "iap", "ui", "app", "firestore", "seed"], note: "Hybridge accounts pass IAP and click through one made up practice. Every case is sample data in Firestore." },
    { id: "one-case", label: "One case, not two", focus: ["scanner", "dlcpm", "app", "ui", "people"], note: "The scanner makes the case. The doctor adds the Rx to that same case here. Today it runs on sample cases." },
    { id: "planned", label: "Real data, planned", focus: ["dlcpm", "connector", "gateway", "app"], note: "The lab server through an outbound connector first, the MagicTouch API once licensed. Neither is live." },
    { id: "requests", label: "Ask for a change", focus: ["ui", "app", "relay"], note: "The Feature requests tab goes through the portal to Launchpad, carrying only the identity IAP verified." },
  ],
  parts: {
    scanner: {
      kind: "Scanners",
      owner: "outside",
      what: "The intraoral scanners in doctors' offices send the scan straight into the lab's case system, which opens the case. That part works today and the portal does not touch it.",
      source: "docs/phase-2-portal/PLAN.md",
    },
    dlcpm: {
      kind: "Lab case system",
      owner: "outside",
      what: "MagicTouch DLCPM is where every lab case really lives, and the lab keeps working in it. Its own doctor portal cannot edit a case that already exists, so an Rx sent there opens a second case.",
      source: "docs/phase-2-portal/findings.md",
    },
    connector: {
      kind: "Planned",
      owner: "planned",
      what: "Planned, not live. A small program on a lab machine that reads the lab's local server with a read only login and sends changes out over HTTPS, so no port opens into the lab network. It waits on the server details and that login.",
      source: "docs/phase-2-portal/PLAN.md",
    },
    gateway: {
      kind: "Vendor API",
      owner: "planned",
      what: "Planned, not live. MagicTouch's Digital Gateway license, $126 a month, covers both of its APIs and is not bought yet. Whether that API can add an Rx and files to a case the scanner made is the open question the whole plan rests on.",
      source: "docs/phase-2-portal/PLAN.md",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "doctor-portal on Cloud Run, Next.js 16 in standalone mode, no minimum instances and at most three. Server actions carry every change. A hand deploy script that refuses uncommitted changes, so no CI minutes are spent.",
      fails: "The first revision failed its first visit on a Firestore rule the laptop store never enforced. The fixed revision went live 9 minutes after it.",
      source: "scripts/deploy-portal.sh:72",
    },
    ui: {
      kind: "My app",
      owner: "mine",
      what: "Submit Rx, Cases, Accounting, Resources and Account in React 19. A switch in the bar flips between the doctor's view of one made up practice and the lab's view, which stands in for MagicTouch until a link exists. Colour says whose move it is.",
      source: "apps/portal/DESIGN.md",
    },
    people: {
      kind: "People",
      owner: "outside",
      what: "Today, the lab lead and Hybridge reviewers on Hybridge Google accounts. More than 200 outside doctors and their staff come later, with a sign in of their own.",
      source: "docs/phase-2-portal/PLAN.md",
    },
    iap: {
      kind: "Sign in",
      owner: "managed",
      what: "Identity Aware Proxy lets only Hybridge Google accounts reach the service. The app still verifies Google's signed header on every request and matches the domain exactly, never as a suffix.",
      fails: "A wrong audience setting would refuse every sign in, so the deploy reads the setting back and stops if it did not land.",
      source: "apps/portal/lib/auth/iap.ts:37",
    },
    relay: {
      kind: "My service",
      owner: "mine",
      what: "Launchpad's request relay, in another project, keeps the one list every Hybridge app writes feature requests to. The portal forwards each call with its own Google ID token and the person IAP verified, nothing the browser says about itself.",
      source: "apps/portal/lib/featureRequests/relay.ts",
    },
    firestore: {
      kind: "Managed database",
      owner: "managed",
      what: "One generic document store under a portal_ prefix, in the same database as the parked duplicate list, so the two never mix. A small codec wraps arrays inside arrays, which Firestore refuses.",
      source: "apps/portal/lib/store/firestoreCodec.ts",
    },
    seed: {
      kind: "Sample data",
      owner: "mine",
      what: "One made up practice with its cases, invoices and messages. A version number decides when the live store is cleared and filled again, and a script fills it before anyone visits.",
      source: "apps/portal/lib/app.ts",
    },
  },
  breaks: [
    { title: "Firestore refuses a shape", body: "The laptop store took arrays inside arrays and Firestore did not, so the first revision failed its first visit. A codec wraps them now, and a live round trip test proves it.", source: "apps/portal/lib/store/firestoreCodec.ts" },
    { title: "The sample fill fails", body: "A failed fill is not cached. The next request tries again instead of serving an empty portal until a restart.", source: "apps/portal/lib/app.ts:73" },
    { title: "The IAP audience is wrong", body: "Every sign in would be refused. The deploy reads the setting back and stops with a plain message if it did not land.", source: "scripts/deploy-portal.sh:79" },
  ],
  tuned: [
    { title: "Scale to zero", body: "No minimum instances, at most three, 512 MiB each. A portal on sample data should cost nothing while nobody looks.", source: "scripts/deploy-portal.sh:72" },
    { title: "One store, two homes", body: "Memory on a laptop, Firestore when deployed, behind one small interface. Screens never touch the store directly.", source: "apps/portal/lib/store/types.ts" },
    { title: "Uploads stream through", body: "Feature request files up to 25 MB pass to the relay as the stream they arrive as, never read into memory.", source: "apps/portal/lib/featureRequests/relay.ts" },
  ],
  guards: [
    { title: "One domain, matched exactly", body: "The app verifies IAP's signed header on every request and compares the domain after the last @, never as a suffix.", source: "apps/portal/lib/auth/iap.ts:37" },
    { title: "No forged names to Launchpad", body: "The person comes from the verified IAP identity only. Authorization, cookies and relay headers from the browser are dropped.", source: "apps/portal/lib/featureRequests/relay.ts:39" },
    { title: "One Rx per scan case", body: "An Rx for a case that already has one, or that belongs to another practice, is refused with a sentence that says what to do instead.", source: "apps/portal/app/(app)/rx/actions.ts:36" },
  ],
  // GCP billing export, account 013C47, Oct 1 to 28 2026, net of credits
  // (project-docs/fde-refresh/costs/by-service.csv). Whole project, shared
  // with the parked Case Intake app; the portal went live on Oct 28.
  cost: {
    total: "$0.06",
    period: "in October",
    method: "Measured from the Google Cloud billing export, October 1 to 28, net of credits: six cents for the whole project, which it shares with the parked duplicate list. The portal went live on the 28th, a day still loading when measured, so its own month is not measured yet. Firestore does not show up at all.",
    parts: [
      { label: "Secret Manager, the parked app's", usd: 0.05 },
      { label: "Image registry", usd: 0.01 },
      { label: "Cloud Run, per request", usd: 0.0 },
    ],
  },
  // Request driven: no scheduler job in hybridge-case-intake (gcloud scheduler
  // jobs list, 0 items). One Rx sent: browser, server action, Firestore, back.
  live: {
    mode: "event",
    label: "A new Rx",
    everySeconds: 14,
    path: ["people", "ui", "app", "firestore", "app", "ui", "people"],
    source: "a reviewer sends an Rx on the live preview, on sample data",
  },
};

export default arch;
