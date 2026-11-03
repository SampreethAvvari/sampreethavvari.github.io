// Every post's frontmatter and text, read from disk at build time.
//
// Importing a post's markdown module (Astro.glob, import.meta.glob) also imports
// its layout, and Astro then ships PostLayout's stylesheets and scripts with every
// page that did the importing, so a page that only lists posts would pay for the
// reader's whole kit. Reading the files as text keeps those pages light. The
// shape matches what the pages used from Astro.glob.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type PostFile = {
  url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  frontmatter: Record<string, any>;
  rawContent: () => string;
};

// From the project root: a path relative to this file would point into the build
// output once it is bundled.
const postsDir = path.join(process.cwd(), "src", "pages", "posts");

let cached: PostFile[] | null = null;

export function readPosts(): PostFile[] {
  cached ??= fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(postsDir, f), "utf-8"));
      return {
        url: `/posts/${f.replace(/\.md$/, "")}`,
        frontmatter: data,
        rawContent: () => content,
      };
    });
  // A copy each time, so a page may sort its own.
  return [...cached];
}
