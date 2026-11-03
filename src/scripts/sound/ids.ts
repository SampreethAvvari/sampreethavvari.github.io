// Which movement belongs to a page. Shared by the engine and the placard.
export const MOVEMENT_IDS = ["home", "projects", "architecture", "work", "writing", "film", "mind", "teaching"] as const;
export type MovementId = (typeof MOVEMENT_IDS)[number];

/** Teaching pages wear Writing's colour, but they have their own movement. */
export function movementFor(tone: string | undefined, path: string): MovementId {
  if (/^\/teaching(\/|$)/.test(path)) return "teaching";
  return (MOVEMENT_IDS as readonly string[]).includes(tone || "") ? (tone as MovementId) : "home";
}
