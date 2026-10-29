// Tell Bing, Yandex, Seznam and Naver (and through Bing, ChatGPT search and
// Copilot) that pages changed, so they recrawl now instead of in weeks.
//   node scripts/indexnow.mjs            every URL in the live sitemap
//   node scripts/indexnow.mjs /posts/x   just these paths
// Run after a deploy is live. The key file sits at the site root
// (public/<key>.txt), which is how IndexNow proves the site is ours.
import { readdirSync } from "node:fs";

const HOST = "sampreethavvari.com";
const SITE = `https://${HOST}`;
const keyFile = readdirSync("public").find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("No IndexNow key file in public/");
const key = keyFile.replace(/\.txt$/, "");

async function sitemapUrls() {
  const index = await (await fetch(`${SITE}/sitemap-index.xml`)).text();
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = [];
  for (const m of maps) {
    const xml = await (await fetch(m)).text();
    urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]));
  }
  return urls;
}

const args = process.argv.slice(2);
const urlList = args.length ? args.map((p) => new URL(p, SITE).toString()) : await sitemapUrls();

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation: `${SITE}/${keyFile}`, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
if (res.status >= 400) console.log(await res.text());
