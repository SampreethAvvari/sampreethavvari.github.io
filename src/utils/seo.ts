// Structured data for search engines and AI answer engines. Every page emits
// one JSON-LD @graph: the person and the website (shared ids, so engines join
// them into one entity), plus the page's own node (a profile page, an
// article, a technical article about a system, a list) and its breadcrumbs.
// Facts come from the same data the pages render, so they never disagree.

export type Crumb = { name: string; path: string };

export const PERSON_ID = "/#person";
export const WEBSITE_ID = "/#website";

const abs = (base: string, path: string) => new URL(path, base).toString();

export function personNode(base: string, opts: { image: string; email: string; description: string }) {
  return {
    "@type": "Person",
    "@id": abs(base, PERSON_ID),
    name: "Sampreeth Avvari",
    // His film credits read Sampreeth Sharma, so both names are one person.
    alternateName: ["Sampreeth Sharma"],
    url: abs(base, "/"),
    image: abs(base, opts.image),
    email: `mailto:${opts.email}`,
    jobTitle: "Forward Deployed Engineer",
    description: opts.description,
    worksFor: { "@type": "Organization", name: "Hybridge Implants", url: "https://hybridgeimplants.com" },
    alumniOf: [
      { "@type": "CollegeOrUniversity", name: "New York University", department: "Tandon School of Engineering" },
      { "@type": "CollegeOrUniversity", name: "Gokaraju Rangaraju Institute of Engineering and Technology" },
    ],
    address: { "@type": "PostalAddress", addressLocality: "New York", addressRegion: "NY", addressCountry: "US" },
    knowsAbout: [
      "Forward deployed engineering",
      "AI engineering",
      "Machine learning engineering",
      "Software engineering",
      "Retrieval augmented generation",
      "Large language model evaluation",
      "Google Cloud Run",
      "BigQuery",
      "Healthcare software",
      "HIPAA minded system design",
      "System architecture",
      "Filmmaking",
    ],
    sameAs: [
      "https://www.linkedin.com/in/sampreethavvari/",
      "https://github.com/SampreethAvvari",
      "https://www.instagram.com/sampreeth.sharma/",
      "https://www.youtube.com/@DudeStrong",
      "https://www.instagram.com/on.my.earth/",
    ],
  };
}

// His films, from the filmmaking page's credits. Among Monsters carries its
// IMDb page, so engines join the film, its IMDb record and him into one
// entity; the rest are named with their year and his roles.
const FILMS: Array<{ name: string; year?: string; imdb?: string; roles: string[] }> = [
  { name: "Among Monsters", year: "2026", imdb: "https://www.imdb.com/title/tt39700295/", roles: ["Director", "Writer", "Editor", "Music"] },
  { name: "Tiger Man", year: "2022", roles: ["Director", "Writer", "Editor"] },
  { name: "Solstice", year: "2025", roles: ["Editor"] },
  { name: "Swechcha", year: "2024", roles: ["Editor"] },
  { name: "Strangers", year: "2019", roles: ["Cinematographer", "Music"] },
  { name: "Extraordinary Lives", roles: ["Director", "Writer"] },
  { name: "Pupa", roles: ["Writer"] },
];

export function filmNodes(base: string) {
  const me = { "@id": abs(base, PERSON_ID) };
  return FILMS.map((f) => ({
    "@type": "Movie",
    "@id": abs(base, `/filmmaking#${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
    name: f.name,
    ...(f.year ? { dateCreated: f.year } : { creativeWorkStatus: "In development" }),
    ...(f.imdb ? { url: f.imdb, sameAs: f.imdb } : {}),
    ...(f.roles.includes("Director") ? { director: me } : {}),
    ...(f.roles.includes("Writer") ? { author: me } : {}),
    ...(f.roles.includes("Editor") ? { editor: me } : {}),
    ...(f.roles.includes("Music") ? { musicBy: me } : {}),
    ...(f.roles.includes("Cinematographer") ? { contributor: me } : {}),
  }));
}

export function websiteNode(base: string, description: string) {
  return {
    "@type": "WebSite",
    "@id": abs(base, WEBSITE_ID),
    url: abs(base, "/"),
    name: "Sampreeth Avvari",
    description,
    inLanguage: "en-US",
    publisher: { "@id": abs(base, PERSON_ID) },
    author: { "@id": abs(base, PERSON_ID) },
  };
}

export function breadcrumbNode(base: string, crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(base, c.path) })),
  };
}

export function profilePageNode(base: string, path: string) {
  return {
    "@type": "ProfilePage",
    "@id": abs(base, path) + "#page",
    url: abs(base, path),
    isPartOf: { "@id": abs(base, WEBSITE_ID) },
    mainEntity: { "@id": abs(base, PERSON_ID) },
    about: { "@id": abs(base, PERSON_ID) },
  };
}

export function articleNode(
  base: string,
  path: string,
  a: {
    type?: "BlogPosting" | "TechArticle";
    title: string;
    description: string;
    date?: string;
    modified?: string;
    image?: string;
    keywords?: string[];
    facts?: Array<{ label: string; value: string }>;
    about?: { name: string; url: string; description: string };
    wordCount?: number;
  },
) {
  const url = abs(base, path);
  return {
    "@type": a.type ?? "BlogPosting",
    "@id": url + "#article",
    headline: a.title,
    description: a.description,
    url,
    mainEntityOfPage: url,
    isPartOf: { "@id": abs(base, WEBSITE_ID) },
    author: { "@id": abs(base, PERSON_ID) },
    publisher: { "@id": abs(base, PERSON_ID) },
    inLanguage: "en-US",
    ...(a.date ? { datePublished: a.date, dateModified: a.modified ?? a.date } : {}),
    ...(a.image ? { image: abs(base, a.image) } : {}),
    ...(a.keywords?.length ? { keywords: a.keywords.join(", ") } : {}),
    ...(a.wordCount ? { wordCount: a.wordCount } : {}),
    ...(a.facts?.length ? { abstract: a.facts.map((f) => `${f.label}: ${f.value}`).join(" ") } : {}),
    ...(a.about
      ? {
          about: {
            "@type": "SoftwareApplication",
            name: a.about.name,
            url: a.about.url,
            description: a.about.description,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            creator: { "@id": abs(base, PERSON_ID) },
          },
        }
      : {}),
  };
}

export function itemListNode(base: string, path: string, name: string, items: Array<{ name: string; path: string }>) {
  return {
    "@type": "ItemList",
    "@id": abs(base, path) + "#list",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: abs(base, it.path) })),
  };
}

export function faqNode(base: string, path: string, qa: Array<{ q: string; a: string }>) {
  return {
    "@type": "FAQPage",
    "@id": abs(base, path) + "#faq",
    mainEntity: qa.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
  };
}

export const graph = (nodes: unknown[]) => ({ "@context": "https://schema.org", "@graph": nodes.filter(Boolean) });
