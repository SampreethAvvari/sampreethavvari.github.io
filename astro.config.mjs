import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import robotsTxt from "astro-robots-txt";
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import { readdirSync, readFileSync } from "node:fs";

import sitemap from "@astrojs/sitemap";

const SITE = 'https://sampreethavvari.com';

// Search and AI crawlers, named so the welcome is explicit. Everyone else is
// covered by the * rule.
const CRAWLERS = [
  'Googlebot', 'Bingbot', 'Applebot', 'DuckDuckBot',
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'CCBot',
];

// Last modified dates for the sitemap: each post's own date, and each
// architecture page's post date. Everything else gets the build date.
const fm = (file) => readFileSync(file, "utf8").split(/^---\s*$/m)[1] || "";
const postDates = Object.fromEntries(
  readdirSync("src/pages/posts")
    .filter((f) => f.endsWith(".md"))
    .map((f) => [f.replace(/\.md$/, ""), (fm(`src/pages/posts/${f}`).match(/^date:\s*"?([\d-]+)/m) || [])[1]]),
);
const archDates = Object.fromEntries(
  readdirSync("src/data/architecture/systems")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => {
      const post = (readFileSync(`src/data/architecture/systems/${f}`, "utf8").match(/^\s*post:\s*"([^"]+)"/m) || [])[1];
      const slug = (post || "").replace(/^\/?posts\//, "").replace(/\/$/, "");
      return [f.replace(/\.ts$/, ""), postDates[slug]];
    }),
);
const built = new Date().toISOString();
const lastmodFor = (url) => {
  const path = new URL(url).pathname.replace(/\/$/, "");
  const post = path.match(/^\/posts\/(.+)$/);
  if (post && postDates[post[1]]) return new Date(postDates[post[1]]).toISOString();
  const arch = path.match(/^\/architecture\/(.+)$/);
  if (arch && archDates[arch[1]]) return new Date(archDates[arch[1]]).toISOString();
  return built;
};

// https://astro.build/config
export default defineConfig({
  markdown: {
    rehypePlugins: [rehypeAccessibleEmojis],
  },
  site: SITE,
  devToolbar: { enabled: false },
  // Fetch a page as soon as a link is hovered or tapped, so moving between
  // tabs feels instant on phones too.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [
    tailwind(),
    react(),
    robotsTxt({
      policy: [
        ...CRAWLERS.map((userAgent) => ({ userAgent, allow: '/' })),
        { userAgent: '*', allow: '/' },
      ],
    }),
    sitemap({
      serialize(item) {
        item.lastmod = lastmodFor(item.url);
        return item;
      },
    }),
  ],
});
