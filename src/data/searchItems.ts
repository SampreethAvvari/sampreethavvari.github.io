// Search index built once at build time. Post entries are read from disk as
// text instead of importing the markdown modules: importing them would pull
// every post (and PostLayout plus its CSS) into the module graph of every
// page that renders BaseLayout.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type SearchItem = {
  title: string;
  description: string;
  url: string;
  type: "page" | "post";
};

const pages: SearchItem[] = [
  { title: "Home", description: "Landing, hero, and quick intro.", url: "/", type: "page" },
  { title: "About", description: "Bio, education, skills, and experience.", url: "/#about", type: "page" },
  { title: "Work", description: "Four disciplines: AI, forward-deployed, ML, and software engineering.", url: "/work", type: "page" },
  { title: "Gallery", description: "Screenshots and documents from production systems, by project.", url: "/gallery", type: "page" },
  { title: "Projects", description: "AI, research, and industry projects.", url: "/projects", type: "page" },
  { title: "Filmmaking", description: "Among Monsters and film work.", url: "/filmmaking", type: "page" },
  { title: "Writing", description: "Blog posts and research notes.", url: "/posts", type: "page" },
  { title: "Teaching", description: "Course materials and the teaching hub.", url: "/teaching", type: "page" },
  { title: "Contact", description: "Email and social links.", url: "/#contact", type: "page" },
];

const postsDir = fileURLToPath(new URL("../pages/posts/", import.meta.url));

function frontmatterField(fm: string, key: string): string {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']/, "").replace(/["']$/, "");
}

const posts: SearchItem[] = fs
  .readdirSync(postsDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const raw = fs.readFileSync(path.join(postsDir, f), "utf-8");
    const fm = raw.match(/^---\s*([\s\S]*?)\n---/);
    const block = fm ? fm[1] : "";
    return {
      title: frontmatterField(block, "title"),
      description: frontmatterField(block, "description"),
      url: `/posts/${f.replace(/\.md$/, "")}`,
      type: "post" as const,
    };
  })
  .filter((p) => p.title);

export const searchItems: SearchItem[] = [...pages, ...posts];
