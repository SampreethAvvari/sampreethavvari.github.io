// Which movement belongs to a page. Shared by the engine and the placard.
export const MOVEMENT_IDS = ["home", "projects", "architecture", "work", "writing", "film", "mind", "teaching", "resume", "demos"] as const;
export type MovementId = (typeof MOVEMENT_IDS)[number];

/**
 * Teaching pages wear Writing's colour, but they have their own movement. The
 * resume is not a tab with a colour, so its page alone chooses it. The demos
 * wear Projects' colour, and have a short interlude of their own.
 */
export function movementFor(tone: string | undefined, path: string): MovementId {
  if (/^\/teaching(\/|$)/.test(path)) return "teaching";
  if (/^\/resume(\/|$)/.test(path)) return "resume";
  if (/^\/demos(\/|$)/.test(path)) return "demos";
  return (MOVEMENT_IDS as readonly string[]).includes(tone || "") ? (tone as MovementId) : "home";
}
