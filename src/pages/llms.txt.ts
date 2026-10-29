// /llms.txt: a short, plain map of the site for AI tools and answer engines
// (https://llmstxt.org). Who he is in one paragraph, then every system's
// architecture page and every post with its one line summary. Generated at
// build time from the same data the pages use, so it never drifts.
import type { APIRoute } from "astro";
import { info } from "../data/info";
import { architectures } from "../data/architecture";

type PostModule = { frontmatter: Record<string, any>; url?: string };

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() ?? "https://sampreethavvari.com/").replace(/\/$/, "");
  const posts = Object.entries(import.meta.glob<PostModule>("./posts/*.md", { eager: true }))
    .map(([path, mod]) => ({ slug: path.replace(/^.*\/|\.md$/g, ""), fm: mod.frontmatter }))
    .sort((a, b) => String(b.fm.date).localeCompare(String(a.fm.date)));

  const lines: string[] = [];
  lines.push(`# ${info.name}`);
  lines.push("");
  lines.push(
    `> Sampreeth Avvari is a forward deployed engineer in New York and the only engineer at a three office dental implant practice, building and running about 45 services: patient intake and AI diagnosis, call and consult grading, scheduling, pricing, a marketing data warehouse and the practice websites. Every system on this site has a clickable architecture drawing with its real monthly cost, failure paths and guards. Sampreeth is also a filmmaker.`,
  );
  lines.push("");
  lines.push(
    "Numbers on this site come from git history, Google Cloud billing exports and the systems' own logs. Each post ends with what is not measured.",
  );
  lines.push("");
  lines.push("## Start here");
  lines.push(`- [Home](${base}/): who he is, four impact numbers, featured systems`);
  lines.push(`- [Architecture](${base}/architecture): every system drawn, with parts, failure paths and monthly cost`);
  lines.push(`- [The platform](${base}/posts/platform): all live services and how they connect`);
  lines.push(`- [What a forward deployed engineer does](${base}/posts/forward-deployed-engineer)`);
  lines.push(`- [Projects](${base}/projects)`);
  lines.push(`- [Writing](${base}/posts)`);
  lines.push(`- [Full text of every post](${base}/llms-full.txt)`);
  lines.push("");
  lines.push("## Architecture pages");
  for (const a of architectures) {
    lines.push(`- [${a.name}](${base}/architecture/${a.slug}): ${a.headline} ${a.tail}`);
  }
  lines.push("");
  lines.push("## Posts");
  for (const p of posts) {
    lines.push(`- [${p.fm.title}](${base}/posts/${p.slug}): ${p.fm.description ?? ""}`);
  }
  lines.push("");
  lines.push("## Contact");
  lines.push(`- Email: ${info.contact.email}`);
  lines.push("- LinkedIn: https://www.linkedin.com/in/sampreethavvari/");
  lines.push("- GitHub: https://github.com/SampreethAvvari");
  lines.push("");

  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
