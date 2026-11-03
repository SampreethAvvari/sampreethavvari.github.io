// What a teaching material needs from its PDF before its reader opens.
//
// 1. Each book's page count and page sizes, in src/data/teaching-pages.json, so
//    the reader can lay out every page at once, before any of the file has come.
// 2. Three real pages of each book, as small images in public/teaching/pages, so
//    the stack on the material page needs no PDF code until someone reads.
//
// Run by hand when a PDF is added or changed. The pages are drawn in a real browser,
// the same drawing a visitor gets, since node's canvas gets the books' gradients
// wrong. Playwright is not a dependency of this site, so point at a copy:
//   PLAYWRIGHT=/path/to/node_modules/playwright node scripts/make-teaching-pages.mjs
// Without it only the sizes are written. A material without these still works: its
// stack shows blank paper, and the reader reads the sizes from the file.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = "public/teaching";
const OUT = path.join(DIR, "pages");
// The cover, the contents and a page with a figure on it.
const PAGES = [1, 3, 9];
const WIDTH = 800;
const LIB = "node_modules/pdfjs-dist/legacy/build";

const files = readdirSync(DIR).filter((f) => f.endsWith(".pdf"));
const books = {};
for (const file of files) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path.join(DIR, file))), isEvalSupported: false, verbosity: 0 }).promise;
  // Most pages share one size: that, plus the ones that differ.
  const sizes = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { width, height } = (await doc.getPage(n)).getViewport({ scale: 1 });
    sizes.push([Math.round(width * 100) / 100, Math.round(height * 100) / 100]);
  }
  const counts = new Map();
  for (const s of sizes) counts.set(s.join(), (counts.get(s.join()) || 0) + 1);
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
  const odd = {};
  sizes.forEach((s, i) => {
    if (s.join() !== common.join()) odd[i + 1] = s;
  });
  books[file.replace(/\.pdf$/, "")] = { pages: doc.numPages, w: common[0], h: common[1], odd };
  await doc.destroy();
}
writeFileSync("src/data/teaching-pages.json", `${JSON.stringify(books, null, 1)}\n`);
console.log(`sizes of ${files.length} books written`);

if (!process.env.PLAYWRIGHT) {
  console.log("no PLAYWRIGHT set: page images left as they are");
  process.exit(0);
}
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
// A made up origin that serves only these files, so no server is needed.
const ORIGIN = "https://pages.invalid";
await page.route(`${ORIGIN}/**`, (route) => {
  const name = new URL(route.request().url()).pathname.slice(1);
  if (!name) return route.fulfill({ contentType: "text/html", body: "<!doctype html>" });
  const from = name.endsWith(".pdf") ? path.join(DIR, name) : path.join(LIB, name);
  route.fulfill({ contentType: name.endsWith(".pdf") ? "application/pdf" : "text/javascript", body: readFileSync(from) });
});
await page.goto(`${ORIGIN}/`);
for (const file of files) {
  const slug = file.replace(/\.pdf$/, "");
  const shots = await page.evaluate(
    async ({ file, pages, width }) => {
      const lib = await import("/pdf.min.mjs");
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await lib.getDocument({ url: `/${file}`, isEvalSupported: false, verbosity: 0 }).promise;
      const out = {};
      for (const n of pages) {
        if (n > doc.numPages) continue;
        const p = await doc.getPage(n);
        const viewport = p.getViewport({ scale: width / p.getViewport({ scale: 1 }).width });
        const c = document.createElement("canvas");
        c.width = Math.round(viewport.width);
        c.height = Math.round(viewport.height);
        await p.render({ canvasContext: c.getContext("2d", { alpha: false }), viewport }).promise;
        out[n] = c.toDataURL("image/png");
      }
      await doc.destroy();
      return out;
    },
    { file, pages: PAGES, width: WIDTH },
  );
  for (const [n, url] of Object.entries(shots)) {
    const png = Buffer.from(url.split(",")[1], "base64");
    // The cover is the page people look at. The others mostly show at their edges.
    const shot = n === PAGES[0] ? sharp(png).resize(640) : sharp(png).resize(420);
    await shot.clone().avif({ quality: 46, effort: 6 }).toFile(path.join(OUT, `${slug}-${n}.avif`));
    await shot.clone().webp({ quality: 66 }).toFile(path.join(OUT, `${slug}-${n}.webp`));
    console.log(`${slug} page ${n}`);
  }
}
await browser.close();
