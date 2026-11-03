// Everything a Teaching page does once it is up. Its own chunk, so none of it
// competes with the styles and the words for a slow connection on first load.

import { mountStage } from "./stage";
import { mountDepth } from "./depth";
import { mountDeck } from "./deck";

export function mountAll(signal: AbortSignal): Array<void | (() => void)> {
  const stops: Array<void | (() => void)> = [];
  for (const mount of [mountStage, mountDepth, mountDeck]) {
    try {
      stops.push(mount(signal));
    } catch (err) {
      console.error(err);
    }
  }
  return stops;
}
