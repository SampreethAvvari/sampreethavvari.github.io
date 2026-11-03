// What the Work world says. Everything here is read from, or copied word for
// word out of, the site's own data (src/data/disciplines.ts and
// src/data/info.ts). Each number names where it comes from, so it can be
// checked against its record.

import { disciplines, type Discipline, type DxProject } from "../../data/disciplines";
import { info } from "../../data/info";

export interface BayStat {
  value: string;
  label: string;
}

export interface BayCopy {
  slug: Discipline["slug"];
  /** What the bay is, as a thing you can look at. */
  form: string;
  stats: BayStat[];
  /** Names of projects to show first, in order; must exist in the discipline. */
  lead: string[];
}

export const BAYS: BayCopy[] = [
  {
    slug: "aie",
    form: "A reading room. Lines of transcript stream in and fill a schema.",
    stats: [
      // Doc Coach highlight: "471 consults scored live from May 19 to Oct 28 across three offices"
      { value: "471", label: "consults scored live, May 19 to Oct 28" },
      // NPC Coach highlight: "690 real calls graded by October 29"
      { value: "690", label: "real calls graded by October 29" },
      // Doc Coach one liner: "in October the median report landed 2.7 minutes after the transcript"
      { value: "2.7 min", label: "median report after the transcript, October" },
    ],
    lead: ["Doc Coach: Consultation QA", "NPC Coach: Call Coaching", "CDF: Gemini reads the patient first"],
  },
  {
    slug: "fde",
    form: "An open dock. A boom reaches out to three offices and a lab.",
    stats: [
      // Launchpad highlight: "A request filed in the Cowork Dashboard on October 28 was live 19 minutes later"
      { value: "19 min", label: "from a filed request to live, October 28" },
      // Launchpad highlight: "38 projects on one board on Oct 29, 22 of them live"
      { value: "38", label: "projects on one board on Oct 29, 22 of them live" },
      // Doctor Portal highlight: "Top priority to a working live link in 3.7 hours"
      { value: "3.7 hours", label: "top priority to a working live link" },
    ],
    lead: ["Patient Dashboard", "Capacity Planner", "Doctor Portal"],
  },
  {
    slug: "mle",
    form: "A scanner. Rings turn around an arch, and twenty scans stay sealed.",
    stats: [
      // CBCT highlight: "$62 on Google Cloud from October 1 to 28, measured"
      { value: "$62", label: "on Google Cloud, October 1 to 28" },
      // MLE point: "A frozen 20 scan holdout stays out of training"
      { value: "20", label: "scan holdout kept out of training" },
      // MLE article: "A dental CT scan checker in 37 days"
      { value: "37 days", label: "to a dental CT scan checker" },
    ],
    lead: ["CBCT Scan Validator", "Daily Sales Report", "LLM Persuasion (NYU research)"],
  },
  {
    slug: "sde",
    form: "The keel. A wall of 360 cells, and ledgers that only grow.",
    stats: [
      // Capacity Planner highlight: "360 of 360 day cells from the old workbook reproduced on every test run"
      { value: "360 of 360", label: "workbook day cells, on every test run" },
      // Treatment Sequence highlight: "0 errors in 271 generation attempts"
      { value: "0 errors", label: "in 271 plan generation attempts" },
      // Treatment Estimator one liner: "v1.0.0 in 14.5 hours"
      { value: "14.5 hours", label: "to Treatment Estimator v1.0.0" },
    ],
    lead: ["Treatment Estimator", "Capacity Planner", "Hybridge Forms"],
  },
];

/** The tagline's first sentence, or the part before its colon. */
export const taglineHead = (t: string) => {
  const dot = t.indexOf(". ");
  if (dot > 0) return t.slice(0, dot + 1);
  const colon = t.indexOf(": ");
  return colon > 0 ? t.slice(0, colon) + "." : t;
};

export const leadProjects = (d: Discipline, names: string[]): DxProject[] =>
  names.map((n) => {
    const p = d.projects.find((x) => x.name === n);
    if (!p) throw new Error(`No project named ${n} in ${d.slug}`);
    return p;
  });

type Span = (typeof info.about.timeline)[number];
const span = (title: string, org?: string): Span => {
  const s = info.about.timeline.find((t) => t.title === title && (!org || t.org === org));
  if (!s) throw new Error(`No timeline entry for ${title}`);
  return s;
};

export interface TrailStop {
  id: string;
  /** The body in space, for the score and for hover. */
  body: string;
  year: number;
  title: string;
  org: string;
  place: string;
  date: string;
  facts: string[];
  blurb: string;
  links: { label: string; href: string }[];
}

const bt = span("Bachelor of Technology, Computer Science");
const sh = span("Software Engineer");
const ms = span("Master of Science, Computer Engineering");
const vp = span("Video Producer");
const ml = span("Graduate Machine Learning Researcher");
const ai = span("AI Engineer");

export const TRAIL: TrailStop[] = [
  {
    id: "t2017",
    body: "moon",
    year: 2017,
    title: "B.Tech, Computer Science",
    org: "JNTU",
    place: bt.location,
    date: bt.date,
    facts: ["3.92 GPA"],
    blurb: bt.blurb,
    links: [],
  },
  {
    id: "t2021",
    body: "gate",
    year: 2021,
    title: sh.title,
    org: "Shure",
    place: sh.location,
    date: sh.date,
    facts: ["Python and Selenium test automation", "Conference WorkBench and Designer"],
    blurb: sh.blurb,
    links: [],
  },
  {
    id: "t2023",
    body: "giant",
    year: 2023,
    title: "M.S. Computer Engineering",
    org: "NYU Tandon",
    place: ms.location,
    date: ms.date,
    facts: ["3.84 GPA", "Two jobs on campus"],
    blurb: ms.blurb,
    links: [],
  },
  {
    id: "t2024v",
    body: "iris",
    year: 2024,
    title: vp.title,
    org: "NYU",
    place: vp.location,
    date: vp.date,
    facts: ["Sony Alpha 7III", "DaVinci Resolve and Premiere Pro"],
    blurb: vp.blurb,
    links: [],
  },
  {
    id: "t2024r",
    body: "binary",
    year: 2024,
    title: ml.title,
    org: "NYU",
    place: ml.location,
    date: ml.date,
    facts: ["Llama 3 8B, trained to argue", "A judge trained on ChangeMyView"],
    blurb: ml.blurb,
    links: [...(ml.projects ?? [])],
  },
  {
    id: "t2025",
    body: "station",
    year: 2025,
    title: ai.title,
    org: "Hybridge Implants",
    place: ai.location,
    date: ai.date,
    // Platform map highlight: "45 live services in 14 Google Cloud projects for three offices and a lab"
    facts: ["45 live services", "14 Google Cloud projects", "Three offices and a lab"],
    blurb: ai.blurb,
    links: [{ label: "Platform map", href: "/posts/platform" }],
  },
];

/** How many cards go in each screen, so no card is ever alone on a last row. */
export function groupCards<T>(list: T[]): T[][] {
  const out: T[][] = [];
  let i = 0;
  while (i < list.length) {
    const left = list.length - i;
    const take = left === 4 ? 2 : left === 2 ? 2 : 3;
    out.push(list.slice(i, i + take));
    i += take;
  }
  return out;
}

/** The stops a discipline's page has: arrive, how, bring, project groups, writing, exit. */
export const bayStopCount = (d: Discipline) => 3 + groupCards(d.projects).length + 2;

export { disciplines };
