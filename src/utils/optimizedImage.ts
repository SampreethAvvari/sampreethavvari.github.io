import fs from "node:fs";
import path from "node:path";
import sized from "../data/image-sizes.json";

const PUBLIC = path.join(process.cwd(), "public");

// The smaller copies made by scripts/make-sized-images.mjs: for each image its
// full size and the widths that exist under /sized.
const SIZED = sized as Record<string, { w: number; h: number; sizes: number[] }>;
const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const RASTER = /\.(png|jpe?g|avif|webp)$/i;

/**
 * Given a /public URL for an image, return the encoded .avif/.webp sibling URLs
 * — but ONLY if the .avif exists on disk at build time. Returns null otherwise.
 *
 * Accepts any of .png/.jpg/.jpeg/.avif/.webp as input (directory-driven
 * galleries now reference the generated .avif directly, since the originals are
 * archived out of public/). The existence check keeps <picture> wrappers safe:
 * we never emit a <source> that would 404.
 */
export function optimizedSources(src: string | undefined): {
  avif: string;
  webp: string;
  /** The full image and its smaller copies, as srcset values, when copies exist. */
  avifSet?: string;
  webpSet?: string;
  width?: number;
  height?: number;
} | null {
  if (!src || !/^\/[^?#]+\.(png|jpe?g|avif|webp)$/i.test(src)) return null;
  const base = src.replace(RASTER, "");
  const avif = base + ".avif";
  const webp = base + ".webp";
  const onDisk = (p: string) =>
    path.join(PUBLIC, decodeURIComponent(p).replace(/^\//, ""));
  if (!fs.existsSync(onDisk(avif))) return null;
  const entry = SIZED[decodeURIComponent(base)];
  if (!entry) return { avif, webp };
  // A copy that would be no smaller than the full file was never made. The full
  // file then takes its place on the ladder (each step is half as wide again), so
  // the browser moves up to it where it would have moved up to that copy, and not
  // only at the file's true width, by which point a card has been showing a copy
  // far narrower than it is drawn. Only the browser's choice reads this number.
  const top = entry.sizes[entry.sizes.length - 1];
  const fullW = Math.min(entry.w, Math.round(top * 1.5));
  const set = (ext: string, full: string) =>
    entry.sizes.length
      ? [...entry.sizes.map((w) => `${encodePath(`/sized${decodeURIComponent(base)}-${w}${ext}`)} ${w}w`), `${full} ${fullW}w`].join(", ")
      : undefined;
  return { avif, webp, avifSet: set(".avif", avif), webpSet: set(".webp", webp), width: entry.w, height: entry.h };
}

/**
 * The sizes value to hand the browser. Between two copies it keeps the smaller
 * until the space is well past it, so a card on a 2x screen can land on a copy a
 * fifth narrower than it is drawn. A quarter more room on anything with a
 * min-width rule keeps desktop and tablet pictures sharp. The last, phone value
 * is left alone: at 3x a small shortfall does not show, and phones pay for bytes.
 */
export function roomySizes(sizes: string): string {
  return sizes
    .split(",")
    .map((part) => {
      const s = part.trim();
      if (!s.startsWith("(min-width")) return s;
      return s.replace(/([\d.]+)(px|vw)$/, (_, n, unit) => `${Math.ceil(Number(n) * 1.25)}${unit}`);
    })
    .join(", ");
}

/**
 * A sizes value for a picture cropped to fill a box (object-fit: cover), which is
 * shown wider than the box when it is wider in shape than the box is. Each box is
 * [minimum viewport width, box width, box height], widest screens first; the last
 * one has 0. `extra` allows for a zoom in the picture's own style.
 */
export function coverSizes(src: string | undefined, boxes: Array<[number, number, number]>, extra = 1): string {
  const stem = decodeURIComponent((src ?? "").replace(RASTER, ""));
  const entry = SIZED[stem];
  const ratio = entry ? entry.w / entry.h : 16 / 9;
  return boxes
    .map(([min, w, h]) => {
      const px = Math.ceil(Math.max(w, h * ratio) * extra);
      return min ? `(min-width: ${min}px) ${px}px` : `${px}px`;
    })
    .join(", ");
}

/**
 * Collapse a directory listing to one filename per image, so galleries built
 * from fs.readdirSync don't render each photo multiple times now that every
 * image has .avif + .webp siblings sitting next to it. Prefers .avif, then
 * .webp, then the original.
 */
export function canonicalImageList(files: string[]): string[] {
  const rank = (f: string) =>
    /\.avif$/i.test(f) ? 0 : /\.webp$/i.test(f) ? 1 : 2;
  const byBase = new Map<string, string>();
  for (const f of files) {
    const base = f.replace(RASTER, "").replace(/\.gif$/i, "");
    const cur = byBase.get(base);
    if (cur === undefined || rank(f) < rank(cur)) byBase.set(base, f);
  }
  return [...byBase.values()];
}
