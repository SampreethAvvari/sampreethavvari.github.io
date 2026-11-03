// Which movement belongs to a page. Shared by the engine and the placard.
export const MOVEMENT_IDS = ["home", "projects", "architecture", "work", "writing", "film", "mind", "teaching", "resume"] as const;
export type MovementId = (typeof MOVEMENT_IDS)[number];

/**
 * Teaching pages wear Writing's colour, but they have their own movement. The
 * resume is not a tab with a colour, so its page alone chooses it.
 */
export function movementFor(tone: string | undefined, path: string): MovementId {
  if (/^\/teaching(\/|$)/.test(path)) return "teaching";
  if (/^\/resume(\/|$)/.test(path)) return "resume";
  return (MOVEMENT_IDS as readonly string[]).includes(tone || "") ? (tone as MovementId) : "home";
}
