// Shapes the writing index passes to its sections. Every field comes from a
// post's own frontmatter (or its reading time), never from anywhere else.

export type CaseHero = {
  slug: string;
  /** A short name for the index beside the heroes. */
  short: string;
  url: string;
  title: string;
  description: string;
  /** "Oct 29, 2026" */
  date: string;
  isoDate: string;
  minutes: number;
  tag?: string;
  /** The post's tone as "r,g,b", for the light around its art. */
  rgb: string;
  /** Base path of the hero art, e.g. /writing/platform (then -2560.avif). */
  art?: string;
  /** The post's own cover, used when there is no hero art. */
  cover?: string;
  alt: string;
  stat?: { value: string; label: string };
};

export type ArchivePost = {
  slug: string;
  url: string;
  title: string;
  description: string;
  date: string;
  time: number;
  minutes: number;
  img?: string;
  alt: string;
  /** Shown in place of a cover that is still being made. */
  fallback: string;
  dx: string[];
  impact: number;
  /** One of the six heroes at the top of the page. */
  featured: boolean;
};
