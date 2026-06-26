import fs from "node:fs";
import path from "node:path";

const PUBLIC = path.join(process.cwd(), "public");

/**
 * Given a /public URL (optionally %-encoded) for a .png/.jpg/.jpeg image,
 * return the encoded .avif/.webp sibling URLs — but ONLY if those files
 * actually exist on disk at build time. Returns null otherwise.
 *
 * The existence check makes <picture> wrappers safe: we never emit a <source>
 * that would 404 (a broken source shows a broken image, not the fallback).
 * Images already in a modern format (.avif/.webp) return null — they're served
 * as-is by the <img> fallback.
 */
export function optimizedSources(
  src: string | undefined,
): { avif: string; webp: string } | null {
  if (!src || !/^\/[^?#]+\.(png|jpe?g)$/i.test(src)) return null;
  const base = src.replace(/\.(png|jpe?g)$/i, "");
  const avif = base + ".avif";
  const webp = base + ".webp";
  // On-disk paths are not %-encoded; decode before checking. Strip the leading
  // slash so path.join treats it as relative to /public.
  const onDisk = (p: string) =>
    path.join(PUBLIC, decodeURIComponent(p).replace(/^\//, ""));
  if (!fs.existsSync(onDisk(avif))) return null;
  return { avif, webp };
}
