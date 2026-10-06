import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import robotsTxt from "astro-robots-txt";
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  markdown: {
    rehypePlugins: [rehypeAccessibleEmojis],
  },
  site: 'https://sampreethavvari.github.io',
  devToolbar: { enabled: false },
  // Fetch a page as soon as a link is hovered or tapped, so moving between
  // tabs feels instant on phones too.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [tailwind(), react(), robotsTxt(), sitemap()]
});
