import fs from "node:fs";
import path from "node:path";

const PUBLIC = path.join(process.cwd(), "public");
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
export function optimizedSources(
  src: string | undefined,
): { avif: string; webp: string } | null {
  if (!src || !/^\/[^?#]+\.(png|jpe?g|avif|webp)$/i.test(src)) return null;
  const base = src.replace(RASTER, "");
  const avif = base + ".avif";
  const webp = base + ".webp";
  const onDisk = (p: string) =>
    path.join(PUBLIC, decodeURIComponent(p).replace(/^\//, ""));
  if (!fs.existsSync(onDisk(avif))) return null;
  return { avif, webp };
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
