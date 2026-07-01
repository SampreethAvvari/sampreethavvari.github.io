// Teaching Hub content. Add a material here, drop its PDF in /public/teaching/,
// drop a cover at /public/teaching/<slug>.png, then rebuild. Grouped/filtered by
// `stream`, ordered by `addedAt`. See docs/superpowers/specs/2026-06-30-teaching-hub-design.md
export type Stream = "aie" | "mle" | "sde" | "fde";
export type MaterialType = "pdf" | "blog" | "video";

export interface TeachingMaterial {
  slug: string; // URL + stats key, e.g. "ai-engineers-handbook"
  type: MaterialType;
  stream: Stream;
  title: string;
  description: string; // one-line card subtitle ("what this post is")
  whatToExpect: string; // longer paragraph(s) on the page
  cover: string; // /teaching/<slug>.png
  addedAt: string; // ISO date; default sort = newest first
  file?: string; // pdf:   /teaching/<slug>.pdf
  videoUrl?: string; // video: embeddable URL (YouTube/Vimeo)
  body?: string; // blog:  HTML string
  pages?: number; // optional meta for PDFs
  durationMin?: number; // optional meta for videos
}

export const streamMeta: Record<
  Stream,
  { acronym: string; label: string; accent: string }
> = {
  aie: { acronym: "AIE", label: "AI Engineering", accent: "#34D399" },
  mle: { acronym: "MLE", label: "ML Engineering", accent: "#A78BFA" },
  sde: { acronym: "SDE", label: "Software Engineering", accent: "#5B8DEF" },
  fde: { acronym: "FDE", label: "Forward-Deployed Eng", accent: "#F5A524" },
};

export const STREAM_ORDER: Stream[] = ["aie", "mle", "sde", "fde"];

export const typeMeta: Record<MaterialType, { label: string; icon: string }> = {
  pdf: { label: "PDF", icon: "fas fa-file-pdf" },
  blog: { label: "Blog", icon: "fas fa-pen-nib" },
  video: { label: "Video", icon: "fas fa-play" },
};

export const teaching: TeachingMaterial[] = [
  {
    slug: "ai-engineers-handbook",
    type: "pdf",
    stream: "aie",
    title: "The AI Engineer's Handbook",
    description:
      "A working guide to building AI systems that ship: retrieval, agents, evaluation, and everything around them.",
    whatToExpect:
      "Written for engineers who have to put AI in front of real users. It covers retrieval that stays grounded, deciding when an agent earns its complexity, evaluating systems you cannot fully predict, and the habits that keep them reliable once people depend on them. Everything here is drawn from work that runs in production.",
    cover: "/teaching/ai-engineers-handbook.png",
    addedAt: "2026-06-30",
    file: "/teaching/ai-engineers-handbook.pdf",
  },
];

// Build-time guard: every entry has the content field matching its type.
for (const m of teaching) {
  const ok =
    m.type === "pdf" ? !!m.file : m.type === "video" ? !!m.videoUrl : !!m.body;
  if (!ok) {
    throw new Error(
      `teaching: "${m.slug}" (${m.type}) is missing its content field (file/videoUrl/body)`,
    );
  }
}
