import type { Architecture } from "../types";
import svg from "../svg/hybridge-lab.svg?raw";

const arch: Architecture = {
  slug: "hybridge-lab",
  rank: 135,
  status: "preview",
  statusNote: "Preview on Cloud Run",
  name: "Hybridge Dental Lab Website",
  project: "Hybridge Websites",
  kind: "system",
  disciplines: ["sde"],
  post: "/posts/hybridge-websites",
  headline: "Serves the lab website to dentists.",
  tail: "Prerendered, on Cloud Run.",
  lede:
    "Dentists and their teams open pages prerendered from a crawl of the live lab site and served by Cloud Run, under a runtime account that holds no roles. The home hero assembles a full arch as you scroll, and the Rx and setup forms build their PDF on the dentist's device.",
  titleBlock: [
    ["System", "Lab website"],
    ["Revision", "unversioned"],
    ["Live since", "Oct 29, 2026"],
    ["Runs on", "Cloud Run"],
    ["Region", "us-central1"],
    ["Facts", "73 live pages"],
    ["Redirects", "21 old addresses"],
    ["Rollback", "Prior revision"],
    ["Scale", "1 screen : 1 moving thing"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    // Commit 5b03310 at 01:31:35 (commits-index.csv); revision
    // hybridge-lab-website-00001 created 05:34:56 UTC, 01:34 New York.
    { value: "3", unit: "minutes", label: "from the premium redesign commit at 1:31 AM on Oct 29 to its first preview on Cloud Run" },
    { value: "0", unit: "roles", label: "on the runtime account, because the site calls no Google API" },
    // Hero flip 91a6e2c at 2:30 PM (git log); revision 00004-dxg created 18:32:54 UTC, 2:32 PM New York.
    { value: "2", unit: "minutes", label: "from the hero arch flip commit at 2:30 PM on Oct 29 to it live on Cloud Run" },
    { value: "73", unit: "pages", label: "crawled from the live site with 118 images, the source of the new site's facts" },
  ],
  svg,
  views: [
    { id: "open-page", label: "Open a page", focus: ["doctors", "site", "app"], note: "Every page is prerendered and served by Cloud Run. The runtime account has no roles, because the site calls no Google API." },
    { id: "micron", label: "Engineered to the micron", focus: ["nano", "site", "hero"], note: "One render and its wireframe twin, cut into layers. As you scroll, a cyan scan line turns the wire into the real arch." },
    { id: "facts", label: "Facts from the live site", focus: ["research", "astro", "build", "app"], note: "Every number and claim comes from a crawl of the live lab site. A deploy builds a clean copy of the pushed main branch." },
    { id: "doctor-tools", label: "Doctor tools", focus: ["doctors", "pdf", "site", "clips"], note: "Forms build a PDF on the dentist's device. Doctor clips and the lab film play in place from our own files." },
  ],
  parts: {
    research: {
      kind: "My research",
      owner: "mine",
      what: "A crawl of the live lab site: 73 pages as text and links, 118 original images with their alt text. It is read only, and the new site's numbers and quotes come from it or from the owner.",
      source: "CLAUDE.md:59",
    },
    hero: {
      kind: "My component",
      owner: "mine",
      what: "A pinned exploded view of a full arch. As you scroll, a cyan scan line turns the CAD wireframe into the photoreal render, the implants, framework and teeth assemble, and dimension lines draw in for Plan, Mill and Deliver.",
      fails: "Without JavaScript, under reduced motion and for screenshot tools, it shows the assembled photoreal frame.",
      source: "src/components/home/Hero.astro:2",
    },
    astro: {
      kind: "My code",
      owner: "mine",
      what: "Astro 5 with static output, plain CSS on the Hybridge tokens, GSAP and Lenis for the motion kit and pdf-lib for the forms. The system is copied from the patient site and adapted for clinicians.",
      source: "package.json",
    },
    build: {
      kind: "Managed build",
      owner: "managed",
      what: "Cloud Build turns the Dockerfile into an image on each deploy. Deploys start from a clean worktree of the pushed main branch. The repo has no CI workflows.",
      source: "docs/DEPLOY.md:65",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "hybridge-lab-website on Cloud Run, a second service in the patient site's project. No minimum instances, at most two, 512 MiB. Its runtime account has no roles.",
      fails: "A bad revision rolls back by moving traffic to the previous one, one command in the deploy doc.",
      source: "docs/DEPLOY.md:21",
    },
    site: {
      kind: "My app",
      owner: "mine",
      what: "The pages in the dentist's browser: porcelain and titanium greys with one cyan scan light as the only accent. The loader builds the Hybridge H on a first open, and clicks between pages play a frosted veil.",
      source: "docs/DESIGN.md:387",
    },
    doctors: {
      kind: "People",
      owner: "outside",
      what: "Dentists who send the lab cases, dentists deciding whether to partner, and their teams. Patients who land here are sent on to the patient site.",
      source: "CLAUDE.md:21",
    },
    nano: {
      kind: "Image model",
      owner: "managed",
      what: "Gemini's image model on Vertex AI, in the website's own project. It makes the studio renders, the hero arch and its wireframe twin among them, each keyed to real transparency. People and the lab itself stay real photos.",
      source: "tools/gen-image.py:1",
    },
    clips: {
      kind: "Self hosted media",
      owner: "mine",
      what: "Four doctor clips and the lab film as our own mp4 files from the lab's YouTube channel. They play in place, and on phones they warm up only when half in view on a 4G or faster connection.",
      source: "src/components/motion/ClipCard.astro:13",
    },
    pdf: {
      kind: "My forms",
      owner: "mine",
      what: "The Rx, new client setup, starter kit and partner forms. Submit checks the required fields and shows what would be sent; Save as PDF builds a US Letter PDF in the browser.",
      source: "src/scripts/form-pdf.ts:1",
    },
  },
  breaks: [
    { title: "No JavaScript or reduced motion", body: "The hero shows the assembled photoreal arch by default, so the page never waits on the animation.", source: "src/components/home/Hero.astro:16" },
    { title: "An old address is opened", body: "21 live addresses without a new page redirect to the closest one. Course forms go to the live forms until they are rebuilt.", source: "astro.config.mjs:24" },
    { title: "A browser blocks sound", body: "Clips start muted with a pulsing Tap for sound. One click and every clip in the session has sound.", source: "src/components/motion/ClipCard.astro:5" },
  ],
  tuned: [
    { title: "No pin on phones", body: "Desktop pins the hero for about 1.3 screens. Phones, tablets and low end devices skip the pin and play it once in 2.2 seconds.", source: "src/components/home/home-motion.ts:10" },
    { title: "Two sizes per layer", body: "Each hero layer ships small for phones, where the frame is about 330 pixels wide, and large for desktop.", source: "src/components/home/Hero.astro:31" },
    { title: "pdf-lib on first click", body: "The PDF library loads only when someone saves a form, so pages that never save one never fetch it.", source: "src/scripts/form-pdf.ts:3" },
  ],
  guards: [
    { title: "No roles at runtime", body: "The runtime account holds no roles, since the site calls no Google API.", source: "docs/DEPLOY.md:21" },
    { title: "Touch parity", body: "Every hover style sits behind a fine pointer query. Anything hover shows also works by tap.", source: "docs/DESIGN.md:349" },
    { title: "Facts from the crawl", body: "Numbers, quotes, prices and dates come only from the crawled live site or the owner.", source: "CLAUDE.md:176" },
  ],
  // Same project as the patient site, hybridge-website, billing account 01CA21:
  // export switched on Oct 28, 2026, 0 rows (project-docs/fde-refresh/costs/by-project.csv).
  cost: null,
  // Request driven: Cloud Scheduler is not enabled in hybridge-website.
  live: {
    mode: "event",
    label: "A dentist opens a page",
    everySeconds: 14,
    path: ["doctors", "site", "app", "site", "doctors"],
    source: "a dentist opens a page on the preview",
  },
};

export default arch;
