// Search index built once at build time and served as /search-index.json, which
// the search dialog fetches the first time it opens. Post entries are read from
// disk as text: importing the markdown modules would bring PostLayout and its CSS
// into the graph of whatever imports this.
import fs from "node:fs";
import path from "node:path";

export type SearchItem = {
  title: string;
  description: string;
  url: string;
  type: "page" | "post";
};

const pages: SearchItem[] = [
  { title: "Home", description: "Landing, hero, and quick intro.", url: "/", type: "page" },
  { title: "Resume", description: "Experience, education, skills, and the PDFs.", url: "/resume", type: "page" },
  { title: "Work", description: "Four disciplines: AI, forward-deployed, ML, and software engineering.", url: "/work", type: "page" },
  { title: "Projects", description: "AI, research, and industry projects.", url: "/projects", type: "page" },
  { title: "Architecture", description: "The drawing of each system.", url: "/architecture", type: "page" },
  { title: "Mind", description: "Projects, posts, and tools as one star map.", url: "/mind", type: "page" },
  { title: "Live demos", description: "Interactive tours of the systems, with synthetic data, and the JobPilot app.", url: "/demos", type: "page" },
  { title: "Filmmaking", description: "Among Monsters and film work.", url: "/filmmaking", type: "page" },
  { title: "Writing", description: "Blog posts and research notes.", url: "/posts", type: "page" },
  { title: "Teaching", description: "Course materials and the teaching hub.", url: "/teaching", type: "page" },
  { title: "Contact", description: "Email and social links.", url: "/#ch-connect", type: "page" },
];

// From the project root. Relative to this file it would point into the build
// output once bundled, where there are no markdown files, and find no posts.
const postsDir = path.join(process.cwd(), "src/pages/posts");

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
