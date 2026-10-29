import type { Architecture } from "../types";
import svg from "../svg/hybridge-website.svg?raw";

const arch: Architecture = {
  slug: "hybridge-website",
  rank: 130,
  status: "preview",
  statusNote: "Preview on Cloud Run",
  name: "Hybridge Patient Website",
  project: "Hybridge Websites",
  kind: "system",
  disciplines: ["sde", "fde"],
  post: "/posts/hybridge-websites",
  headline: "Serves the prerendered patient site.",
  tail: "One Node server on Cloud Run.",
  lede:
    "Patients and referring dentists open pages that Astro prerendered at build time, served by one small Node server on Cloud Run in the website's own Google Cloud project. The 3D arch, twelve self hosted patient stories and a referral form that saves its PDF on the device all run in the browser.",
  titleBlock: [
    ["System", "Patient website"],
    ["Revision", "unversioned"],
    ["Live since", "Oct 28, 2026"],
    ["Runs on", "Cloud Run"],
    ["Region", "us-central1"],
    ["Pages", "Prerendered"],
    ["Checked", "1440 and 390"],
    ["Rollback", "Prior revision"],
    ["Scale", "1 colour : 1 meaning"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    // First commit 17:28:02 (commits-index.csv); revision hybridge-website-00001
    // created 21:48:13 UTC, 17:48 New York (gcloud run revisions list).
    { value: "20", unit: "minutes", label: "from the first commit at 5:28 PM on Oct 28 to the first preview on Cloud Run" },
    { value: "759", unit: "px", label: "the widest screen a phone fix may change; a pixel diff at 1440 must read IDENTICAL" },
    // src/data/site.ts:146, 12 clip entries at 720p.
    { value: "12", unit: "stories", label: "from real patients, self hosted at 720p from Hybridge's own published copies, playing in place" },
    { value: "7.0", unit: "screens", label: "home page length at 1440 after the marketing review, down from 13.7" },
  ],
  svg,
  views: [
    { id: "open-page", label: "Open a page", focus: ["visitors", "site", "app"], note: "Every page is prerendered, so Cloud Run hands over finished HTML. A first open plays the H loader, later clicks the glass veil." },
    { id: "ship", label: "Ship a revision", focus: ["nano", "astro", "build", "app"], note: "Renders are made ahead and committed. A deploy builds a clean copy of the pushed main branch into a new revision." },
    { id: "turn-play", label: "Turn it, play it", focus: ["site", "arch3d", "stories"], note: "The 3D arch loads three.js only near view. Twelve patient stories play in place from our own copies." },
    { id: "refer", label: "Refer a patient", focus: ["visitors", "referral", "site"], note: "A referring dentist fills the form and saves a PDF on their own device. The preview sends nothing." },
  ],
  parts: {
    nano: {
      kind: "Image model",
      owner: "managed",
      what: "Nano banana, Gemini's image model on Vertex AI, run in the website's own project by a small script. It makes art for objects, materials and the arch. Each pick is keyed to real transparency before it is committed.",
      source: "tools/gen-image.py:1",
    },
    arch3d: {
      kind: "My component",
      owner: "mine",
      what: "A Hybridge full arch you can turn on the home page, upper or lower, by drag, sideways swipe or arrow keys. three.js loads as its own chunk when the card comes within 600 pixels of view.",
      fails: "No WebGL, no JavaScript or a failed load: the still capture stays and the arch switch hides.",
      source: "src/components/home/ArchViewer.astro:19",
    },
    astro: {
      kind: "My code",
      owner: "mine",
      what: "Astro 5 with static output, so every page is HTML before anyone asks for it. Plain CSS on the Hybridge design tokens, page data in typed files, and one rules file every builder reads first.",
      source: "astro.config.mjs:21",
    },
    build: {
      kind: "Managed build",
      owner: "managed",
      what: "Cloud Build turns the Dockerfile into an image on each deploy. Only a clean, pushed main branch goes out, so what is live is a commit anyone can find. The repo has no CI workflows.",
      source: "docs/DEPLOY.md:53",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "hybridge-website on Cloud Run: the Astro Node server in standalone mode on a mirrored Node 22 image. No minimum instances, at most two.",
      fails: "A bad revision rolls back by moving traffic to the previous one, one command in the deploy doc.",
      source: "docs/DEPLOY.md:66",
    },
    site: {
      kind: "My app",
      owner: "mine",
      what: "The pages in the visitor's browser. A first open plays the H loader, where the Hybridge H builds itself; a click between pages plays a frosted glass veil. The motion kit loads GSAP and Lenis lazily, and reduced motion turns every animation off.",
      source: "src/layouts/Base.astro:52",
    },
    visitors: {
      kind: "People",
      owner: "outside",
      what: "Patients first, choosing between full arch and conventional implants, then referring dentists. Hybridge designs for phones first, so each page is checked at 390 wide before 1440.",
      source: "docs/DESIGN.md:345",
    },
    stories: {
      kind: "Self hosted media",
      owner: "mine",
      what: "Twelve patient stories, our own 720p copies from Hybridge's YouTube channel. They play in place: hover on desktop, one tap on a phone. Nothing downloads until it is needed.",
      source: "src/data/site.ts:146",
    },
    referral: {
      kind: "My form",
      owner: "mine",
      what: "The online referral asks what the paper form asks, plus an email. Save as PDF builds the filled form in the browser with pdf-lib. In the preview the form sends nothing.",
      source: "src/components/referral/ReferralForm.astro:2",
    },
  },
  breaks: [
    { title: "No WebGL on the device", body: "The home page ships a still capture of the arch. Without WebGL or JavaScript, or when the load fails, the still stays.", source: "src/components/home/ArchViewer.astro:23" },
    { title: "A browser blocks sound", body: "Stories start muted with a pulsing Tap for sound. One click and every clip in the session plays with sound.", source: "src/components/motion/ClipCard.astro:4" },
    { title: "A bad revision ships", body: "Traffic moves back to the previous Cloud Run revision with one command from the deploy doc.", source: "docs/DEPLOY.md:106" },
  ],
  tuned: [
    { title: "three.js only near view", body: "The 3D arch loads as its own chunk within 600 pixels of view. Desktop post processing is a further chunk.", source: "src/components/home/ArchViewer.astro:82" },
    { title: "Frames only while moving", body: "The arch renders during a drag, inertia or a switch, on screen, with the tab visible. Phones render at 1.5x without bloom or grain.", source: "src/components/home/arch-viewer.js:24" },
    { title: "Scale to zero", body: "No minimum instances and at most two, so no instance runs while nobody looks.", source: "docs/DEPLOY.md:66" },
  ],
  guards: [
    { title: "Desktop stays put", body: "Phone fixes live only under 760 pixels wide. A pixel diff of each changed page at 1440 must print IDENTICAL.", source: "CLAUDE.md:291" },
    { title: "Touch parity", body: "Every hover style sits behind a fine pointer query, and anything hover shows also opens with one tap.", source: "CLAUDE.md:300" },
    { title: "Hidden from search", body: "Every page carries noindex and robots.txt blocks crawlers until the site replaces the live one.", source: "docs/DEPLOY.md:27" },
  ],
  // hybridge-website bills to account 01CA21, whose export was switched on
  // Oct 28, 2026 and has 0 rows (project-docs/fde-refresh/costs/by-project.csv).
  cost: null,
  // Request driven: Cloud Scheduler is not enabled in hybridge-website. One page
  // open: the visitor asks, the browser fetches prerendered HTML, the page shows.
  live: {
    mode: "event",
    label: "A visitor opens a page",
    everySeconds: 14,
    path: ["visitors", "site", "app", "site", "visitors"],
    source: "a visitor opens a page on the preview",
  },
};

export default arch;
