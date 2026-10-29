// /llms-full.txt: every post as plain markdown in one file, newest first,
// each with its URL, date, key facts and full text, for AI tools that read a
// whole site at once. Easter eggs keep their words and drop the markup.
import type { APIRoute } from "astro";
import { info } from "../data/info";

type PostModule = { frontmatter: Record<string, any>; rawContent: () => string };

const plain = (md: string) =>
  md
    .replace(/<span class="egg"[^>]*>([\s\S]*?)<\/span>/g, "$1")
    .replace(/<div class="(?:aside|stat-callout)[^"]*">/g, "")
    .replace(/<\/?(?:div|span|strong|em|br)[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() ?? "https://sampreethavvari.com/").replace(/\/$/, "");
  const posts = Object.entries(import.meta.glob<PostModule>("./posts/*.md", { eager: true }))
    .map(([path, mod]) => ({ slug: path.replace(/^.*\/|\.md$/g, ""), fm: mod.frontmatter, body: mod.rawContent() }))
    .sort((a, b) => String(b.fm.date).localeCompare(String(a.fm.date)));

  const out: string[] = [`# ${info.name}: every post, full text`, ""];
  for (const p of posts) {
    out.push(`## ${p.fm.title}`);
    out.push("");
    out.push(`URL: ${base}/posts/${p.slug}`);
    if (p.fm.date) out.push(`Date: ${p.fm.date}`);
    if (p.fm.architecture) out.push(`Architecture: ${base}/architecture/${p.fm.architecture}`);
    out.push(`Summary: ${p.fm.description ?? ""}`);
    if (Array.isArray(p.fm.facts) && p.fm.facts.length) {
      out.push("");
      out.push("Key facts:");
      for (const f of p.fm.facts) out.push(`- ${f.label}: ${f.value}`);
    }
    out.push("");
    out.push(plain(p.body));
    out.push("");
    out.push("---");
    out.push("");
  }
  return new Response(out.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
