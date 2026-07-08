// Reading time in whole minutes from raw markdown, 220 wpm, minimum 1.
export function readingTime(rawContent: string): number {
  const words = rawContent.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 220));
}
