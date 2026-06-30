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
      "A practical field guide to building real AI systems — RAG, agents, evals, and shipping.",
    whatToExpect:
      "A hands-on handbook for engineers building production AI: how to design retrieval that stays grounded, when to actually reach for agents, how to evaluate systems you can't fully predict, and the operational habits that keep them trustworthy. Written from systems shipped to real users, not demos.",
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
